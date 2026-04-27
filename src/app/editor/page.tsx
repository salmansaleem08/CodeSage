import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { CodeWorkspace } from "@/features/workspace/components/code-workspace";
import { createClient } from "@/lib/supabase/server";

export default async function EditorPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader />
      <CodeWorkspace />
    </main>
  );
}
