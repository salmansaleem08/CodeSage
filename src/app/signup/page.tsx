import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { AuthForm } from "@/features/auth/components/auth-form";
import { createClient } from "@/lib/supabase/server";

const bullets = [
  "Start with SEED mode for full step-by-step guidance.",
  "Progress to FOCUS and SHADOW as your confidence grows.",
  "Build lasting problem-solving skill through deliberate practice."
];

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_60%_at_0%_50%,_color-mix(in_oklab,var(--secondary)_14%,transparent),transparent_70%)]" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 md:px-10">
        {/* Left branding panel */}
        <div className="hidden max-w-md flex-1 space-y-8 pr-16 lg:block">
          <div className="space-y-1">
            <p className="text-xs font-bold tracking-[0.22em] text-primary uppercase">CodeSage</p>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl leading-[1.15] font-bold tracking-tight">
              Begin your learning journey.
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              Create your account and start learning through structured mentor modes designed for lasting improvement.
            </p>
          </div>
          <ul className="space-y-3">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                {bullet}
              </li>
            ))}
          </ul>
          <Link href="/" className="inline-block text-sm text-muted-foreground transition-colors hover:text-foreground">
            ← Back to landing
          </Link>
        </div>

        {/* Divider */}
        <div className="hidden h-80 w-px bg-border lg:block" />

        {/* Right: form */}
        <div className="flex flex-1 items-center justify-center lg:pl-16">
          <AuthForm mode="signup" />
        </div>
      </div>
    </main>
  );
}
