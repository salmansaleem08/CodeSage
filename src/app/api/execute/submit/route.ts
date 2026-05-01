import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const WANDBOX_ENDPOINT = "https://wandbox.org/api/compile.json";
const MAX_TEST_CASES = 10;

type Language = "cpp" | "python";

type TestCaseInput = {
  input: string;
  expectedOutput: string;
};

type TestCaseResult = {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  exitCode: number;
  stderr: string;
  compileError: string;
};

function getRuntime(language: Language) {
  if (language === "cpp") return { compiler: "gcc-13.2.0", options: "warning,gnu++17" };
  return { compiler: "cpython-3.10.15", options: "" };
}

function normalizeOutput(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
}

async function runOne(
  language: Language,
  code: string,
  stdin: string
): Promise<{ output: string; stderr: string; compileError: string; exitCode: number }> {
  const runtime = getRuntime(language);
  const res = await fetch(WANDBOX_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compiler: runtime.compiler,
      stdin,
      code,
      options: runtime.options,
      save: false,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Execution service unavailable.");
  const result = await res.json();
  return {
    output: result?.program_output ?? "",
    stderr: [result?.program_error, result?.program_message].filter(Boolean).join("\n"),
    compileError: [result?.compiler_output, result?.compiler_error].filter(Boolean).join("\n"),
    exitCode: Number(result?.status ?? 1),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { language?: string; code?: string; testCases?: TestCaseInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const language: Language = body.language === "python" ? "python" : "cpp";
  const code = (body.code ?? "").trim();
  if (!code) return NextResponse.json({ error: "Code is required." }, { status: 400 });

  const rawCases = Array.isArray(body.testCases) ? body.testCases : [];
  const testCases = rawCases.slice(0, MAX_TEST_CASES);
  if (testCases.length === 0) {
    return NextResponse.json({ error: "No test cases provided." }, { status: 400 });
  }

  const settled = await Promise.allSettled(
    testCases.map((tc, i) =>
      runOne(language, code, tc.input ?? "").then((r) => ({ index: i, r, tc }))
    )
  );

  const results: TestCaseResult[] = settled.map((s, i) => {
    const tc = testCases[i];
    if (s.status === "rejected") {
      return {
        index: i,
        input: tc.input ?? "",
        expectedOutput: tc.expectedOutput ?? "",
        actualOutput: "",
        passed: false,
        exitCode: 1,
        stderr: "Execution failed.",
        compileError: "",
      };
    }
    const { r } = s.value;
    const actual = normalizeOutput(r.output);
    const expected = normalizeOutput(tc.expectedOutput ?? "");
    return {
      index: i,
      input: tc.input ?? "",
      expectedOutput: expected,
      actualOutput: actual,
      passed: r.exitCode === 0 && actual === expected,
      exitCode: r.exitCode,
      stderr: r.stderr,
      compileError: r.compileError,
    };
  });

  const passed = results.filter((r) => r.passed).length;
  return NextResponse.json({ total: testCases.length, passed, results });
}
