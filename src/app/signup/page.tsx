import Link from "next/link";

import { AuthForm } from "@/features/auth/components/auth-form";

export default function SignupPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 py-16 md:px-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_color-mix(in_oklab,var(--secondary)_20%,transparent),transparent_60%)]" />
      <div className="mx-auto flex min-h-[80vh] w-full max-w-6xl items-center justify-between gap-10">
        <div className="hidden max-w-xl space-y-5 lg:block">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">CodeSage</p>
          <h1 className="text-4xl leading-tight font-bold">Build deep problem-solving skill with guided practice.</h1>
          <p className="text-lg text-muted-foreground">
            Create your account and start learning through structured mentor modes designed for lasting improvement.
          </p>
          <Link href="/" className="text-sm text-foreground hover:underline">
            Back to landing
          </Link>
        </div>
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
