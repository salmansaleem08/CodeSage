import Link from "next/link";
import { redirect } from "next/navigation";
import { Brain, Code2, Target } from "lucide-react";

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
      {/* Very subtle radial background gradient only */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,_color-mix(in_oklab,var(--primary)_8%,transparent),transparent_70%)]" />

      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-7 pb-0 md:px-10">
        <p className="text-sm font-semibold tracking-wide text-foreground">CodeSage</p>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" className="h-9 px-4 text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="h-9 px-5 text-sm">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero — centered, clean */}
      <section className="mx-auto w-full max-w-4xl px-6 pt-20 pb-24 text-center md:px-10 lg:pt-28 lg:pb-32">
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className="text-[2.75rem] leading-[1.12] font-bold tracking-tight md:text-5xl lg:text-[3.5rem]">
              Learn to think,{" "}
              <span className="text-primary">not copy.</span>
            </h1>
            <p className="mx-auto max-w-lg text-lg leading-relaxed text-muted-foreground">
              An AI coding mentor that adapts to your level — guiding your reasoning without giving away the answer.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/signup">
              <Button className="h-11 px-7 text-sm font-medium shadow-sm">
                Start Learning Free
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="h-11 px-6 text-sm font-medium">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto grid w-full max-w-5xl gap-5 px-6 pb-28 md:grid-cols-3 md:px-10">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 inline-flex rounded-lg border border-border bg-muted p-2.5">
                <Icon className="size-4 text-foreground/70" />
              </div>
              <h2 className="text-sm font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
