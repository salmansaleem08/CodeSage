import Link from "next/link";
import { redirect } from "next/navigation";
import { UserCircle2 } from "lucide-react";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type HeaderProfile = {
  avatar_url: string | null;
};

async function signOutAction() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function AppHeader() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: profileData } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const profile = profileData as HeaderProfile | null;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:px-10">
        {/* Brand + Nav */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/dashboard"
            className="text-sm font-bold tracking-[0.22em] text-primary uppercase transition-opacity hover:opacity-80"
          >
            CodeSage
          </Link>
          <nav className="flex items-center">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/editor", label: "Editor" },
              { href: "/feed", label: "Feed" },
              { href: "/settings", label: "Settings" }
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt="Profile avatar"
              className="size-8 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="grid size-8 place-content-center rounded-full border border-border bg-muted">
              <UserCircle2 className="size-4 text-muted-foreground" />
            </div>
          )}

          <p className="hidden max-w-[160px] truncate text-xs text-muted-foreground lg:block">
            {user?.email ?? "Learner"}
          </p>

          <form action={signOutAction}>
            <Button variant="outline" className="h-8 px-3 text-xs">
              Logout
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
