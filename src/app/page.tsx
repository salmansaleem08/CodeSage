import Link from "next/link";
import { Brain, ChevronRight, Code2, Sparkles, Target } from "lucide-react";

import { Button } from "@/components/ui/button";

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

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,_color-mix(in_oklab,var(--primary)_20%,transparent),transparent_30%),radial-gradient(circle_at_90%_20%,_color-mix(in_oklab,var(--secondary)_18%,transparent),transparent_30%)]" />

      <section className="mx-auto flex w-full max-w-6xl flex-col px-6 pt-10 pb-16 md:px-10 lg:pt-14">
        <header className="mb-20 flex items-center justify-between">
          <p className="text-sm font-semibold tracking-[0.2em] text-primary uppercase">CodeSage</p>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button className="h-10 px-5">Get Started</Button>
            </Link>
          </div>
        </header>

        <div className="grid items-center gap-16 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-xs">
              <Sparkles className="size-4 text-primary" />
              Learn deeply. Solve independently.
            </div>
            <div className="space-y-6">
              <h1 className="max-w-3xl text-4xl leading-tight font-bold md:text-5xl">
                The AI mentor that teaches you how to think, not what to copy.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Designed for programming fundamentals, OOP, and data structures with guided problem-solving that
                adapts to your level.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/signup">
                <Button className="h-11 px-6 text-sm">
                  Start Learning
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="h-11 px-6">
                  I already have an account
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <p className="mb-4 text-sm font-medium text-primary">Mentor Modes</p>
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold">SEED</p>
                <p className="mt-1 text-sm text-muted-foreground">Step-by-step guidance for foundational learning.</p>
              </div>
              <div className="rounded-lg border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold">FOCUS</p>
                <p className="mt-1 text-sm text-muted-foreground">Targeted hints to unblock your core logic.</p>
              </div>
              <div className="rounded-lg border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold">SHADOW</p>
                <p className="mt-1 text-sm text-muted-foreground">Minimal nudges only when you explicitly ask.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-6 pb-24 md:grid-cols-3 md:px-10">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <Icon className="mb-3 size-5 text-primary" />
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
