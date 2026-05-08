import { NextResponse } from "next/server";

import { isEditorAllowed } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";

type EditorUser = { id: string; email: string | null };

type EditorAccess =
  | { ok: true; user: EditorUser; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; response: NextResponse };

const FORBIDDEN_MESSAGE =
  "The CodeSage editor and its AI features are currently in private beta. Email msalmansaleem08@gmail.com to request access.";

export async function requireEditorAccess(): Promise<EditorAccess> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    };
  }

  if (!isEditorAllowed(user.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: FORBIDDEN_MESSAGE, gated: true },
        { status: 403 }
      )
    };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email ?? null },
    supabase
  };
}
