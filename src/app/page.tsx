import Link from "next/link";
import { redirect } from "next/navigation";
import { Brain, Target, Shield } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative overflow-hidden text-foreground">
      {/* ─── Header / Nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-sm bg-background/80 border-b border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="CodeSage" width={28} height={28} className="rounded-sm" />
            <span className="text-sm font-semibold tracking-wide text-foreground">CodeSage</span>
          </Link>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" className="h-9 px-4 text-sm text-muted-foreground hover:text-foreground">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="h-9 px-5 text-sm font-medium">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-4xl px-6 py-28 text-center sm:py-36 md:px-10">
        {/* Radial gradient backdrop */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_70%)]" />

        <div className="space-y-8">
          {/* Badge chip */}
          <div className="inline-flex">
            <span className="rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
              AI-Powered Learning
            </span>
          </div>

          {/* H1 */}
          <h1 className="text-5xl font-bold tracking-tight leading-[1.12] sm:text-6xl lg:text-7xl">
            Learn to think,{" "}
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-primary to-[oklch(0.52_0.22_300)] bg-clip-text text-transparent">
              not copy.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto max-w-lg text-lg leading-relaxed text-muted-foreground">
            An AI coding mentor that adapts to your level — guiding your reasoning without giving away the answer.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/signup">
              <Button className="h-12 px-8 text-sm font-semibold shadow-md shadow-primary/20">
                Start for Free
              </Button>
            </Link>
            <Link href="#modes">
              <Button variant="outline" className="h-12 px-7 text-sm font-medium">
                See how it works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Stats bar ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 md:px-10">
        <hr className="border-border/60" />
        <div className="grid grid-cols-3 py-6 text-center">
          <div className="flex flex-col items-center gap-1 px-4">
            <span className="text-sm font-semibold text-foreground">3 Learning Modes</span>
            <span className="text-xs text-muted-foreground">Calibrate your support level</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-x border-border/60 px-4">
            <span className="text-sm font-semibold text-foreground">Logic-First Coaching</span>
            <span className="text-xs text-muted-foreground">Reasoning patterns that stick</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-4">
            <span className="text-sm font-semibold text-foreground">No Copy-Paste Answers</span>
            <span className="text-xs text-muted-foreground">You always write the code</span>
          </div>
        </div>
        <hr className="border-border/60" />
      </section>

      {/* ─── Three Modes showcase ─────────────────────────────────── */}
      <section id="modes" className="mx-auto max-w-6xl px-6 py-24 md:px-10">
        <div className="mb-14 text-center space-y-3">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Three modes.{" "}
            <span className="bg-gradient-to-r from-primary to-[oklch(0.52_0.22_300)] bg-clip-text text-transparent">
              One goal.
            </span>
          </h2>
          <p className="mx-auto max-w-md text-base text-muted-foreground">
            Pick the depth that matches where you are — switch at any time.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {/* SEED */}
          <article className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors">
            <div className="mb-4 inline-flex rounded-lg bg-muted p-2.5">
              <Brain className="size-5 text-foreground/70" />
            </div>
            <div className="mb-3">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                SEED
              </span>
            </div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Structured Guidance</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ghost-text scaffolding walks you through each step. Ideal when you&apos;re learning a new pattern from scratch.
            </p>
          </article>

          {/* FOCUS */}
          <article className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors">
            <div className="mb-4 inline-flex rounded-lg bg-muted p-2.5">
              <Target className="size-5 text-foreground/70" />
            </div>
            <div className="mb-3">
              <span className="rounded-full bg-chart-1/10 px-2.5 py-0.5 text-xs font-semibold border border-chart-1/20" style={{ color: "oklch(0.52 0.18 275)" }}>
                FOCUS
              </span>
            </div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Mentor Mode</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Socratic hints push you to think rather than execute. The AI asks questions back instead of giving answers.
            </p>
          </article>

          {/* SHADOW */}
          <article className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors">
            <div className="mb-4 inline-flex rounded-lg bg-muted p-2.5">
              <Shield className="size-5 text-foreground/70" />
            </div>
            <div className="mb-3">
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border border-border">
                SHADOW
              </span>
            </div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Solo with Safety Net</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Minimal hints, maximum independence. You solve it — the AI only intervenes when you&apos;re truly stuck.
            </p>
          </article>
        </div>
      </section>

      {/* ─── Progress preview ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-12 pb-24 md:px-10">
        <div className="mb-14 text-center space-y-3">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Track every breakthrough
          </h2>
          <p className="mx-auto max-w-md text-base text-muted-foreground">
            Watch your reasoning improve — one solved problem at a time.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Topic distribution */}
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Topic Distribution</p>
            <div className="space-y-3.5">
              {[
                { label: "Dynamic Programming", width: "w-[78%]", color: "bg-primary" },
                { label: "Graph Algorithms", width: "w-[62%]", color: "bg-chart-2" },
                { label: "Binary Search", width: "w-[85%]", color: "bg-primary" },
                { label: "Tree Traversal", width: "w-[50%]", color: "bg-chart-2" },
                { label: "Sliding Window", width: "w-[40%]", color: "bg-muted-foreground" }
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div className={`h-full rounded-full ${item.color} ${item.width}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly activity grid */}
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Weekly Activity</p>
            <div className="space-y-2">
              {[
                { day: "Mon", cells: [1, 3, 2, 0, 3, 1, 2, 0, 1, 3, 0, 2] },
                { day: "Tue", cells: [0, 2, 3, 1, 0, 2, 3, 1, 0, 2, 1, 3] },
                { day: "Wed", cells: [3, 1, 0, 2, 3, 0, 1, 2, 3, 0, 2, 1] },
                { day: "Thu", cells: [1, 0, 3, 2, 1, 3, 0, 2, 1, 3, 2, 0] },
                { day: "Fri", cells: [2, 3, 1, 0, 2, 1, 3, 0, 2, 1, 0, 3] }
              ].map((row) => (
                <div key={row.day} className="flex items-center gap-2">
                  <span className="w-6 text-[10px] text-muted-foreground">{row.day}</span>
                  <div className="flex gap-1">
                    {row.cells.map((level, i) => (
                      <div
                        key={i}
                        className={`size-4 rounded-sm ${
                          level === 0
                            ? "bg-muted"
                            : level === 1
                              ? "bg-primary/30"
                              : level === 2
                                ? "bg-primary/60"
                                : "bg-primary"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Less</span>
              {["bg-muted", "bg-primary/30", "bg-primary/60", "bg-primary"].map((cls) => (
                <div key={cls} className={`size-3 rounded-sm ${cls}`} />
              ))}
              <span className="text-[10px] text-muted-foreground">More</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA bottom ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24 md:px-10">
        <div className="rounded-xl bg-foreground px-10 py-16 text-center text-background">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to build real understanding?
          </h2>
          <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed opacity-70">
            Join developers who are learning to think through problems, not search for them.
          </p>
          <Link href="/signup">
            <Button
              variant="outline"
              className="h-11 px-8 text-sm font-semibold border-background/40 bg-background text-foreground hover:bg-background/90"
            >
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 py-8 text-center">
        <p className="text-xs text-muted-foreground">© 2025 CodeSage. All rights reserved.</p>
      </footer>
    </main>
  );
}
