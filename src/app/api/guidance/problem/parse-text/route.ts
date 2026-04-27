import { NextResponse } from "next/server";

import { GeminiConfigError, GeminiResponseError } from "@/lib/gemini/generate-seed-steps";
import { parseProblemTextWithGemini } from "@/lib/gemini/parse-problem-text";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ParseBody = {
  text?: string;
};

const MAX_TEXT_LENGTH = 24_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: ParseBody;
  try {
    body = (await request.json()) as ParseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Text file is too large for parsing." }, { status: 413 });
  }

  try {
    const parsed = await parseProblemTextWithGemini(text);
    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof GeminiConfigError) {
      return NextResponse.json({ error: "Guidance service is unavailable." }, { status: 503 });
    }
    if (error instanceof GeminiResponseError) {
      return NextResponse.json({ error: "Could not parse this file. Please review and try again." }, { status: 502 });
    }
    return NextResponse.json({ error: "Could not parse this file." }, { status: 500 });
  }
}
