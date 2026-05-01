import { GeminiConfigError, GeminiResponseError } from "./generate-seed-steps";

type TestCaseGenParams = {
  language: "cpp" | "python";
  problemTitle: string;
  problemDescription: string;
  constraints: string;
  inputOutputFormat: string;
  examples: string;
};

export type GeneratedTestCase = {
  input: string;
  expectedOutput: string;
};

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  return trimmed;
}

function parseTestCasesPayload(raw: string): GeneratedTestCase[] {
  const text = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiResponseError("Could not parse test cases response.");
  }
  if (!parsed || typeof parsed !== "object" || !("testCases" in parsed)) {
    throw new GeminiResponseError("Test cases response missing key.");
  }
  const cases = (parsed as { testCases?: unknown }).testCases;
  if (!Array.isArray(cases)) throw new GeminiResponseError("Test cases invalid format.");
  const out: GeneratedTestCase[] = [];
  for (const c of cases) {
    if (typeof c === "object" && c !== null && "input" in c && "expectedOutput" in c) {
      const input = String((c as { input: unknown }).input ?? "").trim();
      const expectedOutput = String((c as { expectedOutput: unknown }).expectedOutput ?? "").trim();
      if (expectedOutput !== "") out.push({ input, expectedOutput });
    }
  }
  if (out.length < 1) throw new GeminiResponseError("No valid test cases generated.");
  return out.slice(0, 8);
}

export async function generateTestCasesWithGemini(params: TestCaseGenParams): Promise<GeneratedTestCase[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiConfigError("Mentor service is not configured.");

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const lang = params.language === "cpp" ? "C++" : "Python";

  const prompt = `You are generating test cases for a ${lang} programming problem.

Problem: ${params.problemTitle || "(untitled)"}

Description:
${params.problemDescription}

Constraints: ${params.constraints || "(none)"}
Input/Output format: ${params.inputOutputFormat || "(unspecified)"}
Examples: ${params.examples || "(none)"}

Generate exactly 5 test cases that together verify correctness of a solution.
Include: basic/typical cases, boundary values, and edge cases.
Do NOT copy the provided examples verbatim — create distinct test inputs.

For each test case:
- "input": exact stdin string (use actual newlines for multi-line input)
- "expectedOutput": exact expected stdout (trim trailing whitespace per line)

IMPORTANT: The expectedOutput must be precisely what a correct solution would print — no extra text, no labels.

Return ONLY valid JSON, no markdown fences:
{"testCases":[{"input":"...","expectedOutput":"..."}]}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    throw new GeminiResponseError(`Test case generation failed (${res.status}).`);
  }

  const data: unknown = await res.json();
  const text =
    data &&
    typeof data === "object" &&
    "candidates" in data &&
    Array.isArray((data as { candidates?: unknown }).candidates) &&
    (data as { candidates: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates[0]
      ?.content?.parts?.[0]?.text;

  if (typeof text !== "string" || !text.trim()) {
    throw new GeminiResponseError("Empty response from test case generator.");
  }

  return parseTestCasesPayload(text);
}
