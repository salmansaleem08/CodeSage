import Link from "next/link";

import { AuthForm } from "@/features/auth/components/auth-form";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 py-16 md:px-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_20%,transparent),transparent_50%)]" />
      <div className="mx-auto flex min-h-[80vh] w-full max-w-6xl items-center justify-between gap-10">
        <div className="hidden max-w-xl space-y-5 lg:block">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">CodeSage</p>
          <h1 className="text-4xl leading-tight font-bold">Return to your growth-focused coding workspace.</h1>
          <p className="text-lg text-muted-foreground">
            Continue solving problems with focused guidance built to sharpen your logic, not replace it.
          </p>
          <Link href="/" className="text-sm text-foreground hover:underline">
            Back to landing
          </Link>
        </div>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
