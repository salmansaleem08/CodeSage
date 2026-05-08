import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { EditorAccessGate } from "@/components/app/editor-access-gate";
import { CodeWorkspace } from "@/features/workspace/components/code-workspace";
import { isEditorAllowed } from "@/lib/auth/allowlist";
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

  if (!isEditorAllowed(user.email)) {
    return (
      <main className="flex min-h-dvh flex-col bg-background text-foreground">
        <AppHeader />
        <EditorAccessGate email={user.email} />
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <AppHeader />
      <CodeWorkspace />
    </main>
  );
}
