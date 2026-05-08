import { NextResponse } from "next/server";

import { requireEditorAccess } from "@/lib/auth/require-editor-access";

export const runtime = "nodejs";
export const maxDuration = 60;

const WANDBOX_ENDPOINT = "https://wandbox.org/api/compile.json";
const MAX_TEST_CASES = 10;

type Language = "cpp" | "python";

type TestCaseInput = {
  input: string;
  expectedOutput: string;
};

type MatchStrategy = "exact" | "tail" | "stripped-prompts" | "tokens";

type TestCaseResult = {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  exitCode: number;
  stderr: string;
  compileError: string;
  matchStrategy?: MatchStrategy;
};

function getRuntime(language: Language) {
  if (language === "cpp") return { compiler: "gcc-13.2.0", options: "warning,gnu++17" };
  return { compiler: "cpython-3.10.15", options: "" };
}

function toLines(s: string): string[] {
  const lines = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const trimmed = lines.map((line) => line.trim());
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") trimmed.pop();
  return trimmed;
}

function normalizeOutput(s: string): string {
  return toLines(s).join("\n");
}

// A line that looks like an interactive prompt rather than program output.
// Programs often write prompts via cout/print: "Enter number:", "Type your name?",
// "Please input two integers:". These prompts are noise when grading.
function looksLikePromptLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/[?:]$/.test(trimmed)) return true;
  if (/\b(enter|input|please|kindly|type|prompt|provide|give\s+(?:me|the)|ask\s+(?:for|the))\b/i.test(trimmed)) {
    return true;
  }
  return false;
}

function stripPromptLines(lines: string[]): string[] {
  return lines.filter((line) => !looksLikePromptLine(line));
}

function tokenize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Compare actual program output against expected with progressively-lenient
// strategies so user code that prints prompts (e.g. cout << "Enter n: ") still
// grades correctly when its actual answer matches.
function compareOutputs(actualRaw: string, expectedRaw: string): {
  passed: boolean;
  matchStrategy?: MatchStrategy;
} {
  const actual = toLines(actualRaw);
  const expected = toLines(expectedRaw);
  const expectedJoined = expected.join("\n");
  const actualJoined = actual.join("\n");

  if (actualJoined === expectedJoined) return { passed: true, matchStrategy: "exact" };

  // Tail match — many beginner programs print a prompt or two, then the answer.
  if (expected.length > 0 && actual.length >= expected.length) {
    const tail = actual.slice(actual.length - expected.length).join("\n");
    if (tail === expectedJoined) return { passed: true, matchStrategy: "tail" };
  }

  // Strip prompt-ish lines from actual, then compare line-by-line.
  const stripped = stripPromptLines(actual).join("\n");
  if (stripped === expectedJoined) return { passed: true, matchStrategy: "stripped-prompts" };

  // Last resort: whitespace-collapsed token equality after stripping prompts.
  if (tokenize(stripPromptLines(actual).join(" ")) === tokenize(expected.join(" ")) && expectedJoined !== "") {
    return { passed: true, matchStrategy: "tokens" };
  }

  return { passed: false };
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
  const access = await requireEditorAccess();
  if (!access.ok) return access.response;

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
    const compare = r.exitCode === 0 ? compareOutputs(actual, expected) : { passed: false };
    return {
      index: i,
      input: tc.input ?? "",
      expectedOutput: expected,
      actualOutput: actual,
      passed: compare.passed,
      matchStrategy: compare.matchStrategy,
      exitCode: r.exitCode,
      stderr: r.stderr,
      compileError: r.compileError,
    };
  });

  const passed = results.filter((r) => r.passed).length;
  return NextResponse.json({ total: testCases.length, passed, results });
}
