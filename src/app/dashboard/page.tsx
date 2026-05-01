import { redirect } from "next/navigation";
import { Activity, Brain, Target, TrendingUp } from "lucide-react";

import { AppHeader } from "@/components/app/app-header";
import { MotivationQuote } from "@/components/dashboard/motivation-quote";
import { createClient } from "@/lib/supabase/server";

type AttemptRow = {
  is_correct: boolean;
  attempts_count: number;
  hints_used: number;
  topic: "Strings" | "Arrays" | "Loops" | "OOP" | "Data Structures" | "Recursion" | "Other";
  created_at: string;
};

function ChartCard({
  title,
  subtitle,
  values
}: {
  title: string;
  subtitle: string;
  values: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...values.map((item) => item.value));
  return (
    <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-2.5">
        {values.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium tabular-nums text-foreground">{item.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-500"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default async function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileRow } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const profileName = profileRow?.full_name?.trim() || user.email?.split("@")[0] || "Learner";

  const { data: attempts } = await supabase
    .from("problem_attempts")
    .select("is_correct,attempts_count,hints_used,topic,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const attemptsData: AttemptRow[] = (attempts ?? []) as AttemptRow[];
  const totalSubmissions = attemptsData.length;
  const totalSolved = attemptsData.filter((entry) => entry.is_correct).length;
  const totalHints = attemptsData.reduce((sum, entry) => sum + entry.hints_used, 0);
  const avgAttempts = totalSubmissions
    ? attemptsData.reduce((sum, entry) => sum + entry.attempts_count, 0) / totalSubmissions
    : 0;
  const accuracyRate = totalSubmissions ? Math.round((totalSolved / totalSubmissions) * 100) : 0;

  const solvedDays = Array.from(
    new Set(
      attemptsData
        .filter((entry) => entry.is_correct)
        .map((entry) => new Date(entry.created_at).toISOString().slice(0, 10))
    )
  ).sort();

  let streak = 0;
  if (solvedDays.length > 0) {
    let current = new Date(solvedDays[solvedDays.length - 1]);
    if (new Date().toISOString().slice(0, 10) === current.toISOString().slice(0, 10)) {
      streak = 1;
      for (let i = solvedDays.length - 2; i >= 0; i -= 1) {
        const expected = new Date(current);
        expected.setDate(current.getDate() - 1);
        const day = new Date(solvedDays[i]);
        if (day.toISOString().slice(0, 10) !== expected.toISOString().slice(0, 10)) break;
        streak += 1;
        current = day;
      }
    }
  }

  const today = new Date();
  const dailyProblemCounts = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const key = day.toISOString().slice(0, 10);
    return {
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      value: attemptsData.filter((entry) => entry.created_at.slice(0, 10) === key && entry.is_correct).length
    };
  });

  const accuracyTrend = dailyProblemCounts.map((bucket) => {
    const dayAttempts = attemptsData.filter((entry) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - dailyProblemCounts.findIndex((value) => value.label === bucket.label)));
      return entry.created_at.slice(0, 10) === day.toISOString().slice(0, 10);
    });
    const dayCorrect = dayAttempts.filter((entry) => entry.is_correct).length;
    const value = dayAttempts.length ? Math.round((dayCorrect / dayAttempts.length) * 100) : 0;
    return { label: bucket.label, value };
  });

  const topics = ["Strings", "Arrays", "Loops", "OOP", "Data Structures", "Recursion", "Other"];
  const topicDistribution = topics.map((topic) => ({
    label: topic,
    value: attemptsData.filter((entry) => entry.topic === topic).length
  }));

  const hintUsage = attemptsData.slice(-7).map((entry, index) => ({
    label: `P${index + 1}`,
    value: entry.hints_used
  }));

  const insights: string[] = [];
  if (accuracyRate >= 70) insights.push(`Your accuracy is ${accuracyRate}%, showing steady progress.`);
  if (avgAttempts > 0) insights.push(`Average attempts per problem is ${avgAttempts.toFixed(1)}.`);
  if (totalSubmissions > 0) insights.push(`You used ${totalHints} hints across ${totalSubmissions} submissions.`);
  if (topicDistribution.length > 0) {
    const strongest = [...topicDistribution].sort((a, b) => b.value - a.value)[0];
    insights.push(`Most practiced topic: ${strongest.label}.`);
  }
  if (insights.length === 0) {
    insights.push("Start solving problems to unlock personalized learning insights.");
  }

  const stats = [
    { label: "Problems Solved", value: String(totalSolved), trend: `${totalSubmissions} total submissions`, icon: Target },
    { label: "Current Streak", value: `${streak}d`, trend: "consecutive solved days", icon: Activity },
    { label: "Accuracy Rate", value: `${accuracyRate}%`, trend: "correct / submitted", icon: TrendingUp },
    { label: "Avg Attempts", value: avgAttempts.toFixed(1), trend: "per problem", icon: Brain }
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <section className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 md:px-10">
        <MotivationQuote />
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">{profileName}</h1>
        </div>

        {/* Stat cards — always rendered, show 0 when no data */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between">
                  <Icon className="size-4 text-muted-foreground/60" />
                  <span className="text-[11px] text-muted-foreground">{item.trend}</span>
                </div>
                <p className="text-2xl font-bold tracking-tight">{item.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
              </article>
            );
          })}
        </section>

        {/* Charts — always rendered even with all-zero data */}
        <section className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title="Solving Activity"
            subtitle="Daily solved count — last 7 days"
            values={dailyProblemCounts}
          />
          <ChartCard
            title="Accuracy Trend"
            subtitle="Daily correctness % — last 7 days"
            values={accuracyTrend}
          />
          <ChartCard
            title="Topic Distribution"
            subtitle="Problem attempts by topic"
            values={topicDistribution}
          />
          <ChartCard
            title="Hint Usage"
            subtitle="Hints used in your latest attempts"
            values={hintUsage.length > 0 ? hintUsage : topics.map((t) => ({ label: t, value: 0 }))}
          />
        </section>

        {/* Learning Insights */}
        <section>
          <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">Learning Insights</h2>
            <ul className="divide-y divide-border">
              {insights.map((insight) => (
                <li
                  key={insight}
                  className="py-3 text-sm leading-relaxed text-muted-foreground first:pt-0 last:pb-0"
                >
                  {insight}
                </li>
              ))}
            </ul>
          </article>
        </section>
      </section>
    </main>
  );
}
