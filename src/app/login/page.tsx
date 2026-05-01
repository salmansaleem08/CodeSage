import Link from "next/link";
import { redirect } from "next/navigation";

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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16 text-foreground">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <p className="text-sm font-semibold tracking-wide text-foreground">CodeSage</p>
            <p className="mt-2 text-xs text-muted-foreground">Sign in to your account</p>
          </div>
          <AuthForm mode="login" />
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-foreground underline underline-offset-2 hover:text-primary transition-colors">
            Sign up
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
