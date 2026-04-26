import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { FeedList } from "@/components/feed/feed-list";
import { createClient } from "@/lib/supabase/server";

type AttemptRow = {
  user_id: string;
  is_correct: boolean;
  created_at: string;
  hints_used: number;
};

function dayKey(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function computeStreak(correctAttempts: AttemptRow[]): number {
  const solvedDays = Array.from(new Set(correctAttempts.map((entry) => dayKey(entry.created_at)))).sort();
  if (solvedDays.length === 0) return 0;
  const todayKey = dayKey(new Date());
  let current = solvedDays[solvedDays.length - 1];
  if (current !== todayKey) return 0;
  let streak = 1;
  for (let i = solvedDays.length - 2; i >= 0; i -= 1) {
    const prev = new Date(current);
    prev.setDate(prev.getDate() - 1);
    const expected = dayKey(prev);
    if (solvedDays[i] !== expected) break;
    streak += 1;
    current = solvedDays[i];
  }
  return streak;
}

export default async function FeedPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: acceptedFriendships } = await supabase
    .from("friendships")
    .select("user_id,friend_id")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq("status", "accepted");

  const friendIds = Array.from(
    new Set(
      (acceptedFriendships ?? []).map((row: { user_id: string; friend_id: string }) =>
        row.user_id === user.id ? row.friend_id : row.user_id
      )
    )
  ) as string[];

  if (friendIds.length === 0) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:px-10">
          <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h1 className="text-2xl font-bold">Friend Feed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Add friends from settings to see their wins, streaks, and growth stories here.
            </p>
          </article>
        </section>
      </main>
    );
  }

  const { data: friendProfiles } = await supabase
    .from("profiles")
    .select("id,full_name,email,avatar_url")
    .in("id", friendIds);
  const typedProfiles = (friendProfiles ?? []) as Array<{
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  }>;
  const profileMap = new Map<string, { id: string; full_name: string; email: string; avatar_url: string | null }>(
    typedProfiles.map((profile) => [
      profile.id,
      profile
    ])
  );

  const { data: friendAttemptsRaw } = await supabase
    .from("problem_attempts")
    .select("user_id,is_correct,created_at,hints_used")
    .in("user_id", friendIds)
    .order("created_at", { ascending: true });
  const friendAttempts = (friendAttemptsRaw ?? []) as AttemptRow[];

  const thresholds = [10, 25, 50, 100, 200];
  const streakThresholds = [3, 7, 14, 30];
  const nowIso = new Date().toISOString();

  for (const friendId of friendIds) {
    const attempts = friendAttempts.filter((entry) => entry.user_id === friendId);
    if (attempts.length === 0) continue;
    const profile = profileMap.get(friendId);
    const displayName = profile?.full_name || profile?.email?.split("@")[0] || "A friend";

    const correctAttempts = attempts.filter((entry) => entry.is_correct);
    const totalSolved = correctAttempts.length;
    const accuracy = Math.round((correctAttempts.length / attempts.length) * 100);
    const todaySolved = correctAttempts.filter((entry) => dayKey(entry.created_at) === dayKey(new Date())).length;
    const streak = computeStreak(correctAttempts);

    if (todaySolved > 0) {
      await supabase.from("feed_events").upsert(
        {
          actor_id: friendId,
          event_type: "daily_practice",
          title: `${displayName} showed up today`,
          description: `Solved ${todaySolved} problem${todaySolved > 1 ? "s" : ""} today and kept momentum alive.`,
          metadata: { todaySolved },
          event_key: `daily-${friendId}-${dayKey(nowIso)}`,
          created_at: nowIso
        },
        { onConflict: "event_key" }
      );
    }

    const hitSolved = thresholds.filter((threshold) => totalSolved >= threshold).at(-1);
    if (hitSolved) {
      await supabase.from("feed_events").upsert(
        {
          actor_id: friendId,
          event_type: "problems_solved_milestone",
          title: `${displayName} crossed ${hitSolved} solved problems`,
          description: `Consistency paying off with ${totalSolved} total solved problems.`,
          metadata: { totalSolved, threshold: hitSolved },
          event_key: `solved-${friendId}-${hitSolved}`,
          created_at: nowIso
        },
        { onConflict: "event_key" }
      );
    }

    const streakHit = streakThresholds.filter((threshold) => streak >= threshold).at(-1);
    if (streakHit) {
      await supabase.from("feed_events").upsert(
        {
          actor_id: friendId,
          event_type: "streak_milestone",
          title: `${displayName} hit a ${streakHit}-day streak`,
          description: `Streak currently at ${streak} days of solving.`,
          metadata: { streak, threshold: streakHit },
          event_key: `streak-${friendId}-${streakHit}-${dayKey(nowIso)}`,
          created_at: nowIso
        },
        { onConflict: "event_key" }
      );
    }

    const latest14 = attempts.slice(-14);
    if (latest14.length >= 10) {
      const prev7 = latest14.slice(0, 7);
      const last7 = latest14.slice(7);
      const prevAcc = prev7.length ? (prev7.filter((entry) => entry.is_correct).length / prev7.length) * 100 : 0;
      const lastAcc = last7.length ? (last7.filter((entry) => entry.is_correct).length / last7.length) * 100 : 0;
      const gain = Math.round(lastAcc - prevAcc);
      if (gain >= 10) {
        await supabase.from("feed_events").upsert(
          {
            actor_id: friendId,
            event_type: "accuracy_improved",
            title: `${displayName}'s accuracy is climbing`,
            description: `Accuracy improved by ${gain}% recently, now at ${accuracy}%.`,
            metadata: { gain, accuracy },
            event_key: `accuracy-${friendId}-${gain}-${dayKey(nowIso)}`,
            created_at: nowIso
          },
          { onConflict: "event_key" }
        );
      }
    }
  }

  const { data: eventsRaw } = await supabase
    .from("feed_events")
    .select("id,actor_id,title,description,created_at")
    .in("actor_id", friendIds)
    .order("created_at", { ascending: false })
    .limit(50);
  const events = eventsRaw ?? [];
  const eventIds = events.map((event: { id: number }) => event.id);

  const { data: reactionsRaw } = eventIds.length
    ? await supabase.from("feed_reactions").select("event_id,user_id,reaction").in("event_id", eventIds)
    : { data: [] };
  const reactions = reactionsRaw ?? [];

  const { data: commentsRaw } = eventIds.length
    ? await supabase.from("feed_comments").select("id,event_id,user_id,body,created_at").in("event_id", eventIds)
    : { data: [] };
  const comments = commentsRaw ?? [];
  const commenterIds = Array.from(new Set(comments.map((comment: { user_id: string }) => comment.user_id)));
  const { data: commentersRaw } = commenterIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", commenterIds)
    : { data: [] };
  const typedCommenters = (commentersRaw ?? []) as Array<{ id: string; full_name: string; email: string }>;
  const commenterMap = new Map<string, { id: string; full_name: string; email: string }>(
    typedCommenters.map((commenter) => [commenter.id, commenter])
  );

  const feedItems = events.map((event: { id: number; actor_id: string; title: string; description: string; created_at: string }) => {
    const actor = profileMap.get(event.actor_id);
    const eventReactions = reactions.filter((reaction: { event_id: number }) => reaction.event_id === event.id);
    const eventComments = comments
      .filter((comment: { event_id: number }) => comment.event_id === event.id)
      .sort((a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at));
    return {
      id: event.id,
      actorId: event.actor_id,
      actorName: actor?.full_name || actor?.email?.split("@")[0] || "Friend",
      actorEmail: actor?.email || "",
      actorAvatar: actor?.avatar_url || null,
      title: event.title,
      description: event.description,
      createdAt: event.created_at,
      reactionCounts: {
        clap: eventReactions.filter((reaction: { reaction: string }) => reaction.reaction === "clap").length,
        fire: eventReactions.filter((reaction: { reaction: string }) => reaction.reaction === "fire").length,
        insight: eventReactions.filter((reaction: { reaction: string }) => reaction.reaction === "insight").length
      },
      viewerReactions: eventReactions
        .filter((reaction: { user_id: string }) => reaction.user_id === user.id)
        .map((reaction: { reaction: "clap" | "fire" | "insight" }) => reaction.reaction),
      comments: eventComments.map((comment: { id: number; body: string; user_id: string; created_at: string }) => {
        const commenter = commenterMap.get(comment.user_id);
        return {
          id: comment.id,
          body: comment.body,
          createdAt: comment.created_at,
          userName: commenter?.full_name || commenter?.email?.split("@")[0] || "Student"
        };
      })
    };
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 md:px-10">
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Friend Success Feed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Growth updates from your network: streaks, solved milestones, accuracy improvements, and daily consistency.
          </p>
        </article>
        <FeedList items={feedItems} currentUserId={user.id} />
      </section>
    </main>
  );
}
