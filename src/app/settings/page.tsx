import { redirect } from "next/navigation";
import { BarChart3, Lightbulb, Target, Trophy } from "lucide-react";

import { AppHeader } from "@/components/app/app-header";
import { FriendNetwork } from "@/components/friends/friend-network";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { createClient } from "@/lib/supabase/server";

type AttemptRow = {
  is_correct: boolean;
  hints_used: number;
};

type FriendshipRow = {
  id: number;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
};

type FriendProfileRow = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export default async function SettingsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name,email,bio,degree,interests,avatar_url,default_mode,default_hint_level,code_preference")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileRow ?? {
    full_name: user.email?.split("@")[0] ?? "Learner",
    email: user.email ?? "",
    bio: "",
    degree: "",
    interests: [],
    avatar_url: null,
    default_mode: "FOCUS" as const,
    default_hint_level: 3,
    code_preference: "No code unless requested"
  };

  const { data: attempts } = await supabase
    .from("problem_attempts")
    .select("is_correct,attempts_count,hints_used,topic")
    .eq("user_id", user.id);

  const attemptsData: AttemptRow[] = (attempts ?? []) as AttemptRow[];
  const totalSolved = attemptsData.filter((entry) => entry.is_correct).length;
  const totalAttempts = attemptsData.length;
  const correctRate = totalAttempts ? Math.round((totalSolved / totalAttempts) * 100) : 0;
  const hints = attemptsData.reduce((sum, entry) => sum + entry.hints_used, 0);

  const { data: friendships } = await supabase
    .from("friendships")
    .select("id,user_id,friend_id,status")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq("status", "accepted");

  const friendIds = Array.from(
    new Set(
      ((friendships ?? []) as FriendshipRow[]).map((row) => {
        return row.user_id === user.id ? row.friend_id : row.user_id;
      })
    )
  );

  const { data: publicProfilesData } = friendIds.length
    ? await supabase.from("profiles").select("id,full_name,email,avatar_url").in("id", friendIds)
    : { data: [] };
  const publicProfiles = (publicProfilesData ?? []) as FriendProfileRow[];

  const publicProfilesWithStats = await Promise.all(
    (publicProfiles ?? []).map(async (friend) => {
      const { data: friendAttempts } = await supabase
        .from("problem_attempts")
        .select("is_correct")
        .eq("user_id", friend.id);
      const solved = ((friendAttempts ?? []) as Array<{ is_correct: boolean }>).filter((item) => item.is_correct).length;
      const count = (friendAttempts ?? []).length;
      const rating = count ? Math.max(1, Math.min(5, Number(((solved / count) * 5).toFixed(1)))) : 1;
      return {
        id: friend.id,
        name: friend.full_name || friend.email.split("@")[0],
        email: friend.email,
        solved,
        rating,
        avatarUrl: friend.avatar_url
      };
    })
  );

  const { data: incomingRequestsRaw } = await supabase
    .from("friendships")
    .select("id,user_id,friend_id,status")
    .eq("friend_id", user.id)
    .eq("status", "pending");
  const incomingRequests = (incomingRequestsRaw ?? []) as FriendshipRow[];
  const requesterIds = incomingRequests.map((row) => row.user_id);
  const { data: requesterProfilesRaw } = requesterIds.length
    ? await supabase.from("profiles").select("id,full_name,email,avatar_url").in("id", requesterIds)
    : { data: [] };
  const requesterProfiles = new Map(
    ((requesterProfilesRaw ?? []) as FriendProfileRow[]).map((profileRow) => [profileRow.id, profileRow])
  );
  const requestView = incomingRequests.map((request) => {
    const requester = requesterProfiles.get(request.user_id);
    return {
      id: request.id,
      requesterId: request.user_id,
      requesterName: requester?.full_name || requester?.email?.split("@")[0] || "Student",
      requesterEmail: requester?.email || ""
    };
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <section className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 md:px-10 md:py-8">
        <ProfileSettingsForm userId={user.id} initialProfile={profile} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Problems Solved", value: String(totalSolved), icon: Trophy },
            { label: "Accuracy Rate", value: `${correctRate}%`, icon: Target },
            { label: "Total Hints Used", value: String(hints), icon: Lightbulb },
            { label: "Total Attempts", value: String(totalAttempts), icon: BarChart3 }
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.label} className="card-hover rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2">
                  <Icon className="size-4 text-primary" />
                </div>
                <p className="text-3xl font-bold tracking-tight">{metric.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
              </article>
            );
          })}
        </section>

        <FriendNetwork currentUserId={user.id} friends={publicProfilesWithStats} incomingRequests={requestView} />
      </section>
    </main>
  );
}
