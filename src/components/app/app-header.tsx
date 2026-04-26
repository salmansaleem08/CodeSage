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
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 md:px-10 md:py-4">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/dashboard" className="text-sm font-semibold tracking-[0.2em] text-primary uppercase">
            CodeSage
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <Link href="/dashboard" className="rounded-md px-3 py-2 text-foreground hover:bg-accent">
              Dashboard
            </Link>
            <Link href="/settings" className="rounded-md px-3 py-2 text-foreground hover:bg-accent">
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt="Profile avatar"
              className="size-9 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="grid size-9 place-content-center rounded-full border border-border bg-background">
              <UserCircle2 className="size-5 text-muted-foreground" />
            </div>
          )}
          <p className="hidden text-sm text-muted-foreground lg:block">{user?.email ?? "Learner"}</p>
          <form action={signOutAction}>
            <Button variant="outline" className="h-9">
              Logout
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
