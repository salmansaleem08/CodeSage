import { NextResponse } from "next/server";

import { generateHintWithGemini, HintConfigError, type BuildHintInput } from "@/lib/gemini/mode-hint";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type HintBody = Partial<BuildHintInput>;
type HintMode = "SEED" | "FOCUS" | "SHADOW";

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

// Fallback hints when Gemini is unreachable — mode-appropriate and generic
function buildFallbackHint(mode: HintMode, depth: number, clickNumber: number, hasCode: boolean): string {
  if (mode === "SHADOW") {
    const nudges = [
      "Re-read the problem constraints carefully — they often reveal the approach.",
      "Think about what changes between each iteration and whether you can track that incrementally.",
      "Consider what the optimal time complexity should be for the given constraints.",
      "Trace through a small example by hand — where does your logic diverge from the expected output?",
      "Write the brute-force first, then identify the redundant computation to eliminate.",
    ];
    return nudges[Math.min(clickNumber - 1, nudges.length - 1)] ?? nudges[0];
  }

  if (mode === "FOCUS") {
    const byDepth: Record<number, string[]> = {
      1: [
        "What is the minimum information you need to carry through each step of processing?",
        "Is there a relationship between adjacent elements you haven't used yet?",
      ],
      2: [
        "Think about the data structure that gives you O(1) lookup. A hash map often reduces an O(n²) scan to a single pass.",
        "Two-pointer or sliding-window techniques apply when you need to find a contiguous range satisfying a condition.",
      ],
      3: [
        "The brute-force approach re-computes work that could be cached. Identify the repeated sub-problem and store it. That's the core dynamic-programming insight.",
        "Your current approach likely has a loop-invariant violation. State explicitly what must be true at the start of each iteration, then check whether your code maintains that invariant.",
      ],
      4: [
        hasCode
          ? "Pseudocode: for each element, determine its contribution to the answer independently. If contributions are independent, a prefix sum or sorted structure lets you answer each query in O(log n) instead of O(n)."
          : "Pseudocode: preprocess the input once (sort or build an auxiliary structure), then answer each query in O(log n) using binary search or a balanced structure.",
      ],
      5: [
        "Partial code: the critical missing piece is usually the transition formula or the lookup condition — write that single line explicitly before connecting the rest.",
      ],
    };
    const candidates = byDepth[depth] ?? byDepth[3];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // SEED fallback
  return hasCode
    ? "Good progress. Look at the current step again — make sure your code fully satisfies its condition before moving on."
    : "Before writing code, describe in plain English exactly what the next step requires. That description is your pseudocode.";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
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

  const depth = sanitizeDepth(body.depth);
  const helpClickNumber = sanitizeDepth(body.helpClickNumber);
  const hasCode = Boolean(body.hasCode);

  try {
    const hint = await generateHintWithGemini({
      mode,
      language,
      problem,
      depth,
      hasCode,
      step: sanitizePositiveInt(body.step, 1),
      totalSteps: sanitizePositiveInt(body.totalSteps, 1),
      userCode: (body.userCode ?? "").toString(),
      userError: (body.userError ?? "").toString(),
      helpClickNumber,
    });
    return NextResponse.json({ hint, fallback: false });
  } catch (error) {
    // On any AI failure, return a mode-appropriate fallback rather than an error status.
    // This ensures the user always gets something useful even when Gemini is unavailable.
    if (error instanceof HintConfigError) {
      // Key is genuinely missing — this is a config issue, not transient
      return NextResponse.json({ error: "Guidance service is not configured." }, { status: 503 });
    }
    const fallbackHint = buildFallbackHint(mode, depth, helpClickNumber, hasCode);
    return NextResponse.json({ hint: fallbackHint, fallback: true });
  }
}
