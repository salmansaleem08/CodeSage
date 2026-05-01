import { NextResponse } from "next/server";

import { GeminiConfigError, GeminiResponseError } from "@/lib/gemini/generate-seed-steps";
import { generateTestCasesWithGemini, buildFallbackTestCases } from "@/lib/gemini/generate-test-cases";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  language?: string;
  problemTitle?: string;
  problemDescription?: string;
  constraints?: string;
  inputOutputFormat?: string;
  examples?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const problemDescription = (body.problemDescription ?? "").trim();
  if (!problemDescription) {
    return NextResponse.json({ error: "Problem description is required." }, { status: 400 });
  }

  const language: "python" | "cpp" = body.language === "python" ? "python" : "cpp";

  const params = {
    language,
    problemTitle: (body.problemTitle ?? "").trim(),
    problemDescription,
    constraints: (body.constraints ?? "").trim(),
    inputOutputFormat: (body.inputOutputFormat ?? "").trim(),
    examples: (body.examples ?? "").trim(),
  };

  try {
    const testCases = await generateTestCasesWithGemini(params);
    return NextResponse.json({ testCases, fallback: false });
  } catch (error) {
    // On any Gemini failure (timeout, config error, response error, or network error),
    // use fallback test cases and return 200 so the client never sees a 502/503.
    if (
      error instanceof GeminiConfigError ||
      error instanceof GeminiResponseError ||
      (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
    ) {
      const testCases = buildFallbackTestCases(params);
      return NextResponse.json({ testCases, fallback: true });
    }
    // Unknown errors also fall back rather than surfacing a 5xx.
    const testCases = buildFallbackTestCases(params);
    return NextResponse.json({ testCases, fallback: true });
  }
}
