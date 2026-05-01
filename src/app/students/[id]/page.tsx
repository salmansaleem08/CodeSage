import { redirect } from "next/navigation";
import { BarChart3, Medal, Target, UserCircle2 } from "lucide-react";

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
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 md:px-10">
        {/* Profile card */}
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="size-16 rounded-full object-cover"
                />
              ) : (
                <div className="grid size-16 place-content-center rounded-full border border-border bg-muted">
                  <UserCircle2 className="size-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold">{profile.full_name || profile.email.split("@")[0]}</h1>
                <div className="mt-1 flex flex-wrap gap-4">
                  <span className="text-sm text-muted-foreground">{profile.email}</span>
                  {profile.degree ? <span className="text-sm text-muted-foreground">{profile.degree}</span> : null}
                </div>
              </div>
            </div>
            {user.id !== profile.id ? (
              <StudentRequestButton currentUserId={user.id} targetUserId={profile.id} existingStatus={existingStatus} />
            ) : null}
          </div>
          {profile.bio ? <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{profile.bio}</p> : null}
          {profile.interests?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.interests.map((interest: string) => (
                <span
                  key={interest}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs"
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : null}
        </article>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Medal className="mb-3 size-4 text-muted-foreground/60" />
            <p className="text-2xl font-bold tracking-tight">{solved}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Problems Solved</p>
          </article>
          <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Target className="mb-3 size-4 text-muted-foreground/60" />
            <p className="text-2xl font-bold tracking-tight">{accuracy}%</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Accuracy Rate</p>
          </article>
          <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <BarChart3 className="mb-3 size-4 text-muted-foreground/60" />
            <p className="text-2xl font-bold tracking-tight">{total}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Total Attempts</p>
          </article>
        </section>
      </section>
    </main>
  );
}
