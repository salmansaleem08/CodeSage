import { redirect } from "next/navigation";
import { Medal, Star, UserCircle2 } from "lucide-react";

import { AppHeader } from "@/components/app/app-header";
import { StudentRequestButton } from "@/components/friends/student-request-button";
import { createClient } from "@/lib/supabase/server";

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,email,bio,degree,interests,avatar_url")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    redirect("/settings");
  }

  const { data: attempts } = await supabase
    .from("problem_attempts")
    .select("is_correct,hints_used")
    .eq("user_id", profile.id);
  const solved = (attempts ?? []).filter((row: { is_correct: boolean }) => row.is_correct).length;
  const total = (attempts ?? []).length;
  const accuracy = total ? Math.round((solved / total) * 100) : 0;
  const avgHints = total
    ? (attempts ?? []).reduce((sum: number, row: { hints_used: number }) => sum + row.hints_used, 0) / total
    : 0;
  const rating = Math.max(1, Math.min(5, Number((accuracy / 20 + Math.max(0, 1.5 - avgHints / 2)).toFixed(1))));

  let existingStatus: "none" | "pending_sent" | "pending_received" | "accepted" = "none";
  if (user.id !== profile.id) {
    const { data: relation } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${user.id})`
      )
      .limit(1)
      .maybeSingle();
    if (relation) {
      if (relation.status === "accepted") existingStatus = "accepted";
      else if (relation.user_id === user.id) existingStatus = "pending_sent";
      else existingStatus = "pending_received";
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 md:px-10 md:py-8">
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.full_name} className="size-20 rounded-full border border-border object-cover" />
              ) : (
                <div className="grid size-20 place-content-center rounded-full border border-border">
                  <UserCircle2 className="size-10 text-muted-foreground" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{profile.full_name || profile.email.split("@")[0]}</h1>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                {profile.degree ? <p className="mt-1 text-sm text-muted-foreground">{profile.degree}</p> : null}
              </div>
            </div>
            {user.id !== profile.id ? (
              <StudentRequestButton currentUserId={user.id} targetUserId={profile.id} existingStatus={existingStatus} />
            ) : null}
          </div>
          {profile.bio ? <p className="mt-5 text-sm text-muted-foreground">{profile.bio}</p> : null}
          {profile.interests?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.interests.map((interest: string) => (
                <span key={interest} className="rounded-full border border-border bg-background px-3 py-1 text-xs">
                  {interest}
                </span>
              ))}
            </div>
          ) : null}
        </article>

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Medal className="mb-2 size-5 text-primary" />
            <p className="text-2xl font-bold">{solved}</p>
            <p className="text-sm text-muted-foreground">Total Solved</p>
          </article>
          <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Star className="mb-2 size-5 text-primary" />
            <p className="text-2xl font-bold">{accuracy}%</p>
            <p className="text-sm text-muted-foreground">Accuracy</p>
          </article>
          <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Star className="mb-2 size-5 text-primary" />
            <p className="text-2xl font-bold">{rating}</p>
            <p className="text-sm text-muted-foreground">Rating</p>
          </article>
        </section>
      </section>
    </main>
  );
}
