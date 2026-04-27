import { NextResponse } from "next/server";

import { generateHintWithGemini, HintConfigError, HintResponseError, type BuildHintInput } from "@/lib/gemini/mode-hint";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type HintBody = Partial<BuildHintInput>;

function sanitizeDepth(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n))) as 1 | 2 | 3 | 4 | 5;
}

function sanitizePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: HintBody;
  try {
    body = (await request.json()) as HintBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mode = body.mode;
  const language = body.language;
  const problem = (body.problem ?? "").trim();
  if (!problem) return NextResponse.json({ error: "problem is required." }, { status: 400 });
  if (mode !== "SEED" && mode !== "FOCUS" && mode !== "SHADOW") {
    return NextResponse.json({ error: "mode must be SEED, FOCUS, or SHADOW." }, { status: 400 });
  }
  if (language !== "cpp" && language !== "python") {
    return NextResponse.json({ error: "language must be cpp or python." }, { status: 400 });
  }

  try {
    const hint = await generateHintWithGemini({
      mode,
      language,
      problem,
      depth: sanitizeDepth(body.depth),
      hasCode: Boolean(body.hasCode),
      step: sanitizePositiveInt(body.step, 1),
      totalSteps: sanitizePositiveInt(body.totalSteps, 1),
      userCode: (body.userCode ?? "").toString(),
      userError: (body.userError ?? "").toString(),
      helpClickNumber: sanitizeDepth(body.helpClickNumber)
    });
    return NextResponse.json({ hint });
  } catch (error) {
    if (error instanceof HintConfigError) {
      return NextResponse.json({ error: "Guidance service is unavailable." }, { status: 503 });
    }
    if (error instanceof HintResponseError) {
      return NextResponse.json({ error: "Could not generate hint. Try again shortly." }, { status: 502 });
    }
    return NextResponse.json({ error: "Unexpected hint generation error." }, { status: 500 });
  }
}
