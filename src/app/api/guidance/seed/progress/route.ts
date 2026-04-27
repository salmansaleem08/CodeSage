import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ProgressBody = {
  problemFingerprint?: string;
  language?: "cpp" | "python";
  settingsKey?: string;
  frontierStep?: number;
};

function normalizeSteps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const seed = () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table typing with SSR client schema variance
    (supabase as any).from("seed_guidance_sessions");
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: ProgressBody;
  try {
    body = (await request.json()) as ProgressBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const fingerprint = (body.problemFingerprint ?? "").trim();
  const settingsKeyValue = (body.settingsKey ?? "").trim();
  const language = body.language === "python" ? "python" : body.language === "cpp" ? "cpp" : null;

  if (!fingerprint || !settingsKeyValue || !language) {
    return NextResponse.json({ error: "problemFingerprint, settingsKey, and language are required." }, { status: 400 });
  }

  const frontierRequested = Number(body.frontierStep);
  if (!Number.isFinite(frontierRequested)) {
    return NextResponse.json({ error: "frontierStep must be a number." }, { status: 400 });
  }

  const { data: row, error } = await seed()
    .select("id, steps, frontier_step")
    .eq("user_id", user.id)
    .eq("problem_fingerprint", fingerprint)
    .eq("language", language)
    .eq("settings_key", settingsKeyValue)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not load guidance session." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "No guidance session found." }, { status: 404 });
  }

  const steps = normalizeSteps(row.steps);
  if (steps.length === 0) {
    return NextResponse.json({ error: "Invalid stored steps." }, { status: 500 });
  }

  const max = steps.length;
  const next = Math.min(Math.max(Math.round(frontierRequested), 1), max);

  if (next === row.frontier_step) {
    return NextResponse.json({ frontierStep: next, steps });
  }

  const { error: updateError } = await seed()
    .update({ frontier_step: next })
    .eq("id", row.id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not update progress." }, { status: 500 });
  }

  return NextResponse.json({ frontierStep: next, steps });
}
