import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

import { AuthForm } from "@/features/auth/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-dvh grid md:grid-cols-2">
      {/* ─── Left panel (desktop only) ──────────────────────────── */}
      <div className="hidden md:flex flex-col justify-center px-12 py-16 border-r border-border bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <div className="mx-auto max-w-sm space-y-8">
          {/* Logo + name */}
          <div className="flex flex-col items-center gap-3 text-center">
            <Image src="/logo.png" alt="CodeSage" width={48} height={48} className="rounded-md" />
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-[oklch(0.52_0.22_300)] bg-clip-text text-transparent">
              CodeSage
            </h1>
          </div>

          {/* Tagline */}
          <p className="text-center text-base font-medium text-foreground/80 leading-snug">
            Master algorithms by thinking, not copying.
          </p>

          {/* Feature bullets */}
          <ul className="space-y-4">
            {[
              "Adaptive AI that meets your level",
              "Logic-first hints, never full solutions",
              "Track your reasoning, not just your code"
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>

          {/* Bottom note */}
          <p className="text-center text-xs text-muted-foreground pt-4">
            Join developers building real skills.
          </p>
        </div>
      </div>

      {/* ─── Right panel ────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo + name (visible on mobile too) */}
          <div className="flex flex-col items-center gap-2 text-center">
            <Image src="/logo.png" alt="CodeSage" width={32} height={32} className="rounded-sm" />
            <span className="text-sm font-semibold text-foreground">CodeSage</span>
          </div>

          {/* Heading */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to continue</p>
          </div>

          {/* Auth form */}
          <AuthForm mode="login" />

          {/* Sign up link */}
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
