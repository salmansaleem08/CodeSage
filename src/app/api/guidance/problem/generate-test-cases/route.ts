import { NextResponse } from "next/server";

import { GeminiConfigError, GeminiResponseError } from "@/lib/gemini/generate-seed-steps";
import { generateTestCasesWithGemini } from "@/lib/gemini/generate-test-cases";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  const language = body.language === "python" ? "python" : "cpp";

  try {
    const testCases = await generateTestCasesWithGemini({
      language,
      problemTitle: (body.problemTitle ?? "").trim(),
      problemDescription,
      constraints: (body.constraints ?? "").trim(),
      inputOutputFormat: (body.inputOutputFormat ?? "").trim(),
      examples: (body.examples ?? "").trim(),
    });
    return NextResponse.json({ testCases });
  } catch (error) {
    if (error instanceof GeminiConfigError) {
      return NextResponse.json({ error: "Test case service unavailable." }, { status: 503 });
    }
    if (error instanceof GeminiResponseError) {
      return NextResponse.json(
        { error: "Could not generate test cases. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "Could not generate test cases." }, { status: 500 });
  }
}
