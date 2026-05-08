import Link from "next/link";
import { Lock, Sparkles, BarChart3, Users, ArrowRight, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EditorAccessGateProps {
  email: string | null | undefined;
}

export function EditorAccessGate({ email }: EditorAccessGateProps) {
  const displayEmail = email?.trim() || "your account";

  return (
    <main className="relative isolate flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_50%_-5%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-gradient-to-r from-primary/10 via-fuchsia-500/10 to-cyan-500/10 blur-3xl"
      />

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center md:py-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
          <Lock className="size-3" />
          Private beta
        </div>

        <div className="space-y-5">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            The CodeSage editor is{" "}
            <span className="bg-gradient-to-r from-primary to-[oklch(0.62_0.22_300)] bg-clip-text text-transparent">
              invite-only
            </span>{" "}
            right now.
          </h1>
          <p className="mx-auto max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            CodeSage uses live AI guidance for every hint and seed step. To keep responses
            high-quality, the editor is currently rolled out to a small group of pilot users
            while we expand capacity.
          </p>
          <p className="text-xs text-muted-foreground/80">
            Signed in as <span className="font-medium text-foreground/80">{displayEmail}</span>
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          <FeatureChip
            icon={<Sparkles className="size-4 text-primary" />}
            title="Adaptive AI hints"
            description="Three tunable mentoring modes calibrated to your level."
          />
          <FeatureChip
            icon={<BarChart3 className="size-4 text-primary" />}
            title="Progress dashboard"
            description="Track streaks, accuracy, and topic coverage over time."
          />
          <FeatureChip
            icon={<Users className="size-4 text-primary" />}
            title="Friend network"
            description="Follow other learners and share solving feeds."
          />
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/dashboard">
            <Button className="h-11 gap-2 px-6 text-sm font-semibold shadow-md shadow-primary/20">
              Go to your dashboard
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <a href="mailto:msalmansaleem08@gmail.com?subject=CodeSage%20editor%20access&body=Hi%2C%20I%27d%20like%20editor%20access%20on%20CodeSage.">
            <Button variant="outline" className="h-11 gap-2 px-6 text-sm font-medium">
              <Mail className="size-4" />
              Request editor access
            </Button>
          </a>
        </div>

        <p className="max-w-md text-xs text-muted-foreground/70">
          Your dashboard, feed, and profile remain fully usable — only the editor itself is
          gated while we scale the AI service.
        </p>
      </section>
    </main>
  );
}

function FeatureChip({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4 text-left shadow-sm backdrop-blur-sm transition-colors hover:border-primary/30">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
