import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

async function signOutAction() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-semibold tracking-[0.2em] text-primary uppercase">
            CodeSage
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className="rounded-md px-3 py-2 text-foreground hover:bg-accent">
              Dashboard
            </Link>
            <Link href="/settings" className="rounded-md px-3 py-2 text-foreground hover:bg-accent">
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <p className="hidden text-sm text-muted-foreground md:block">{user?.email ?? "Learner"}</p>
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
