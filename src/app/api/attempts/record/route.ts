import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Topic = "Strings" | "Arrays" | "Loops" | "OOP" | "Data Structures" | "Recursion" | "Other";

function detectTopic(text: string): Topic {
  const t = text.toLowerCase();
  if (/string|char|text|substring|palindrome|reverse|vowel|sentence|word/.test(t)) return "Strings";
  if (/array|list|element|index|sort|search|max|min|sum/.test(t)) return "Arrays";
  if (/loop|iteration|repeat|count|sequence|series/.test(t)) return "Loops";
  if (/class|object|inherit|polymorphism|encapsul/.test(t)) return "OOP";
  if (/tree|graph|stack|queue|heap|linked list|hash|set|map/.test(t)) return "Data Structures";
  if (/recursion|recursive|backtrack|fibonacci|factorial/.test(t)) return "Recursion";
  return "Other";
}

type Body = {
  problemFingerprint?: string;
  problemTitle?: string;
  problemDescription?: string;
  isCorrect?: boolean;
  hintsUsed?: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const problemId = (body.problemFingerprint ?? "").trim();
  if (!problemId) {
    return NextResponse.json({ error: "problemFingerprint required." }, { status: 400 });
  }

  const topic = detectTopic(`${body.problemTitle ?? ""} ${body.problemDescription ?? ""}`);
  const isCorrect = body.isCorrect ?? false;
  const hintsUsed = Math.max(0, Number(body.hintsUsed ?? 0));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Check if an attempt record already exists for this user+problem
  const { data: existing } = await sb
    .from("problem_attempts")
    .select("id, attempts_count")
    .eq("user_id", user.id)
    .eq("problem_id", problemId)
    .maybeSingle();

  if (existing) {
    await sb
      .from("problem_attempts")
      .update({
        is_correct: isCorrect,
        attempts_count: (existing.attempts_count ?? 0) + 1,
        hints_used: hintsUsed,
      })
      .eq("id", existing.id);
  } else {
    await sb.from("problem_attempts").insert({
      user_id: user.id,
      problem_id: problemId,
      topic,
      is_correct: isCorrect,
      attempts_count: 1,
      hints_used: hintsUsed,
    });
  }

  return NextResponse.json({ recorded: true });
}
