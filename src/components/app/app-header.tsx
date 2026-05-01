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
    <header className="sticky top-0 z-10 h-14 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-4 sm:px-6 md:px-10">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="text-base font-semibold text-foreground transition-opacity hover:opacity-70"
        >
          CodeSage
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5">
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/editor", label: "Editor" },
            { href: "/feed", label: "Feed" },
            { href: "/settings", label: "Settings" }
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt="Profile avatar"
              className="size-8 rounded-full ring-1 ring-border object-cover"
            />
          ) : (
            <div className="grid size-8 place-content-center rounded-full ring-1 ring-border bg-muted">
              <UserCircle2 className="size-4 text-muted-foreground" />
            </div>
          )}

          <form action={signOutAction}>
            <Button variant="ghost" className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground">
              Logout
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
