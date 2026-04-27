import { NextResponse } from "next/server";

import { generateSeedStepsWithGemini, GeminiConfigError, GeminiResponseError } from "@/lib/gemini/generate-seed-steps";
import { fingerprintProblem, settingsKey } from "@/lib/guidance/problem-fingerprint";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type BootstrapBody = {
  problemTitle?: string;
  problemDescription?: string;
  constraints?: string;
  inputOutputFormat?: string;
  examples?: string;
  language?: "cpp" | "python";
  codeDisclosure?: "allow_minimal_code" | "no_code";
  hintSpecificity?: number;
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

  let body: BootstrapBody;
  try {
    body = (await request.json()) as BootstrapBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const language = body.language === "python" ? "python" : body.language === "cpp" ? "cpp" : null;
  if (!language) {
    return NextResponse.json({ error: "language must be cpp or python." }, { status: 400 });
  }

  const problemDescription = (body.problemDescription ?? "").trim();
  const constraints = (body.constraints ?? "").trim();
  const inputOutputFormat = (body.inputOutputFormat ?? "").trim();
  const examples = (body.examples ?? "").trim();

  if (!problemDescription && !constraints && !inputOutputFormat && !examples) {
    return NextResponse.json({ error: "Add problem details before generating SEED guidance." }, { status: 400 });
  }

  const codeDisclosure = body.codeDisclosure === "allow_minimal_code" ? "allow_minimal_code" : "no_code";
  const hintSpecificity = Number.isFinite(body.hintSpecificity)
    ? Math.min(5, Math.max(1, Math.round(Number(body.hintSpecificity))))
    : 3;

  const fingerprint = fingerprintProblem({
    title: body.problemTitle ?? "",
    description: problemDescription,
    constraints,
    inputOutputFormat,
    examples
  });

  const sk = settingsKey(codeDisclosure, hintSpecificity);

  const { data: cached, error: selectError } = await seed()
    .select("id, steps, frontier_step")
    .eq("user_id", user.id)
    .eq("problem_fingerprint", fingerprint)
    .eq("language", language)
    .eq("settings_key", sk)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ error: "Could not load guidance session." }, { status: 500 });
  }

  if (cached) {
    const steps = normalizeSteps(cached.steps);
    if (steps.length === 0) {
      return NextResponse.json({ error: "Stored guidance was invalid." }, { status: 500 });
    }
    return NextResponse.json({
      sessionId: cached.id,
      steps,
      frontierStep: Math.min(Math.max(cached.frontier_step, 1), steps.length),
      source: "cache" as const
    });
  }

  let steps: string[];
  try {
    steps = await generateSeedStepsWithGemini({
      language,
      problemTitle: (body.problemTitle ?? "").trim(),
      problemDescription,
      constraints,
      inputOutputFormat,
      examples,
      codeDisclosure,
      hintSpecificity
    });
  } catch (e) {
    if (e instanceof GeminiConfigError) {
      return NextResponse.json({ error: "Guidance service is unavailable." }, { status: 503 });
    }
    if (e instanceof GeminiResponseError) {
      return NextResponse.json({ error: "Could not generate guidance. Try again shortly." }, { status: 502 });
    }
    return NextResponse.json({ error: "Could not generate guidance." }, { status: 502 });
  }

  const { data: inserted, error: insertError } = await seed()
    .insert({
      user_id: user.id,
      problem_fingerprint: fingerprint,
      language,
      settings_key: sk,
      steps,
      frontier_step: 1
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    const { data: raced } = await seed()
      .select("id, steps, frontier_step")
      .eq("user_id", user.id)
      .eq("problem_fingerprint", fingerprint)
      .eq("language", language)
      .eq("settings_key", sk)
      .maybeSingle();

    if (raced) {
      const rs = normalizeSteps(raced.steps);
      if (rs.length === 0) {
        return NextResponse.json({ error: "Stored guidance was invalid." }, { status: 500 });
      }
      return NextResponse.json({
        sessionId: raced.id,
        steps: rs,
        frontierStep: Math.min(Math.max(raced.frontier_step, 1), rs.length),
        source: "cache" as const
      });
    }

    return NextResponse.json({ error: "Could not save guidance session." }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: inserted?.id ?? null,
    steps,
    frontierStep: 1,
    source: "generated" as const
  });
}
