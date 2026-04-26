import { redirect } from "next/navigation";
import { Activity, BarChart3, Brain, Target, TrendingUp } from "lucide-react";

import { AppHeader } from "@/components/app/app-header";
import { MotivationQuote } from "@/components/dashboard/motivation-quote";
import { createClient } from "@/lib/supabase/server";

const stats = [
  { label: "Total Problems Solved", value: "48", trend: "↑ 12%", icon: Target },
  { label: "Current Streak", value: "6 days", trend: "↑ 2", icon: Activity },
  { label: "Accuracy Rate", value: "81%", trend: "↑ 7%", icon: TrendingUp },
  { label: "Avg Attempts / Problem", value: "2.4", trend: "↓ 0.3", icon: Brain }
];

const insights = [
  "You are improving in string and array patterns this week.",
  "Hint usage is high in loop-heavy problems. Try SHADOW mode for 1 practice set.",
  "Accuracy improved by 15% over your last 20 submissions."
];

function ChartPlaceholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="mb-3 h-44 rounded-lg border border-dashed border-border bg-background/70" />
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </article>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <section className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 md:px-10">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="text-3xl font-bold tracking-tight">{user.email?.split("@")[0] ?? "Learner"}</h1>
        </div>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <Icon className="size-5 text-primary" />
                  <p className="text-xs font-medium text-primary">{item.trend}</p>
                </div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <ChartPlaceholder title="Problem Solving Activity" subtitle="Daily problem solved trend over time." />
          <ChartPlaceholder title="Accuracy Trend" subtitle="Correctness progression by day." />
          <ChartPlaceholder title="Topic Distribution" subtitle="Strings, arrays, loops, OOP, and data structures." />
          <ChartPlaceholder title="Hint Usage Behavior" subtitle="Hints used per problem to detect over-reliance." />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Learning Insights</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {insights.map((insight) => (
                <li key={insight} className="rounded-lg border border-border bg-background/60 p-3">
                  {insight}
                </li>
              ))}
            </ul>
          </article>
          <MotivationQuote />
        </section>
      </section>
    </main>
  );
}
