import Link from "next/link";
import { redirect } from "next/navigation";
import { Brain, ChevronRight, Code2, Sparkles, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    title: "Guidance Modes",
    description: "Switch between SEED, FOCUS, and SHADOW to control exactly how much support you receive.",
    icon: Brain
  },
  {
    title: "Logic-First Coaching",
    description: "Build thinking patterns that transfer to interviews, contests, and real software work.",
    icon: Target
  },
  {
    title: "Practice Workflow",
    description: "Bring your own coding problems and solve them inside an immersive learning environment.",
    icon: Code2
  }
];

const modeCards = [
  {
    name: "SEED",
    description: "Step-by-step guidance for foundational learning.",
    accent: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/40"
  },
  {
    name: "FOCUS",
    description: "Targeted hints to unblock your core logic.",
    accent: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40"
  },
  {
    name: "SHADOW",
    description: "Minimal nudges only when you explicitly ask.",
    accent: "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/40"
  }
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Subtle ambient gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_10%_-10%,_color-mix(in_oklab,var(--primary)_14%,transparent),transparent_70%),radial-gradient(ellipse_50%_40%_at_90%_5%,_color-mix(in_oklab,var(--secondary)_12%,transparent),transparent_70%)]" />

      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-7 pb-0 md:px-10">
        <p className="text-sm font-bold tracking-[0.22em] text-primary uppercase">CodeSage</p>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" className="h-9 px-4 text-sm">
              Login
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="h-9 px-5 text-sm">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-20 md:px-10 lg:pt-20 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          {/* Left: copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
              <Sparkles className="size-3.5 text-primary" />
              Learn deeply. Solve independently.
            </div>

            <div className="space-y-5">
              <h1 className="max-w-2xl text-[2.5rem] leading-[1.15] font-bold tracking-tight md:text-5xl lg:text-[3.25rem]">
                The AI mentor that teaches you{" "}
                <span className="text-primary">how to think</span>, not what to copy.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                Designed for programming fundamentals, OOP, and data structures with guided problem-solving that adapts to your level.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/signup">
                <Button className="h-11 px-6 text-sm font-medium shadow-sm">
                  Start Learning
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="h-11 px-6 text-sm font-medium">
                  I already have an account
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: mode cards panel */}
          <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Mentor Modes</p>
            </div>
            <div className="space-y-3">
              {modeCards.map((mode) => (
                <div key={mode.name} className={`rounded-xl border px-5 py-4 ${mode.accent}`}>
                  <p className="text-sm font-bold tracking-wide">{mode.name}</p>
                  <p className="mt-1 text-sm leading-snug text-muted-foreground">{mode.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-28 md:grid-cols-3 md:px-10">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              className="card-hover rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5">
                <Icon className="size-4 text-primary" />
              </div>
              <h2 className="text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
