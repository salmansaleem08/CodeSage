export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export class GeminiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiResponseError";
  }
}

type SeedPlanParams = {
  language: "cpp" | "python";
  problemTitle: string;
  problemDescription: string;
  constraints: string;
  inputOutputFormat: string;
  examples: string;
  codeDisclosure: "allow_minimal_code" | "no_code";
  hintSpecificity: number;
};

function targetStepCount(specificity: number): number {
  if (specificity <= 2) return 12;
  if (specificity <= 4) return 9;
  return 7;
}

export function buildSeedFallbackSteps(params: SeedPlanParams): string[] {
  const count = targetStepCount(params.hintSpecificity);
  const isStringProblem = /string|sentence|character|vowel|text/i.test(
    `${params.problemTitle} ${params.problemDescription} ${params.constraints}`
  );

  const base = [
    "Restate what the program must read and what it must print.",
    "Pick a variable to store the full input value before processing it.",
    "Initialize a counter so you can track how many matches you find.",
    isStringProblem
      ? "Loop through the text one character at a time and examine each character."
      : "Loop through each required element once to process the input in order.",
    isStringProblem
      ? "Define the exact match rule (for vowels: a, e, i, o, u, including uppercase if needed)."
      : "Define the exact condition that decides whether the current value should be counted.",
    "When the condition is true, increase your counter.",
    "After the loop, print only the final counter in the required output format.",
    "Test with one simple case and one edge case to verify your logic.",
    "If output is wrong, trace one iteration manually and compare expected vs actual state."
  ];

  if (count <= base.length) return base.slice(0, count);
  const padded = [...base];
  while (padded.length < count) {
    padded.push("Refine your current step by checking boundaries and formatting carefully.");
  }
  return padded;
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  return trimmed;
}

function parseStepsPayload(raw: string): string[] {
  const text = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiResponseError("Could not parse mentor plan.");
  }
  if (!parsed || typeof parsed !== "object" || !("steps" in parsed)) {
    throw new GeminiResponseError("Mentor plan missing steps.");
  }
  const steps = (parsed as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) {
    throw new GeminiResponseError("Mentor plan invalid.");
  }
  const out = steps.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  if (out.length < 5) {
    throw new GeminiResponseError("Mentor plan too short.");
  }
  if (out.length > 18) {
    return out.slice(0, 18);
  }
  return out;
}

export async function generateSeedStepsWithGemini(params: SeedPlanParams): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiConfigError("Mentor service is not configured.");
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const count = targetStepCount(params.hintSpecificity);
  const codeRule =
    params.codeDisclosure === "no_code"
      ? "Do not include code snippets, function names, or syntax in any step. Use plain language only."
      : "You may include at most one very short illustrative fragment per step when it unlocks understanding (no full solutions, no complete programs).";

  const specificityGuide =
    params.hintSpecificity <= 2
      ? "Keep each step very small and gentle; prefer analogies and intuition."
      : params.hintSpecificity >= 4
        ? "Steps may be slightly larger but still single-concept; be direct about what to think about next."
        : "Balance clarity and brevity for a motivated beginner.";

  const prompt = `You are designing a SEED-mode teaching plan for a programming learner (possibly zero prior experience).

Problem title:
${params.problemTitle || "(untitled)"}

Description:
${params.problemDescription}

Constraints:
${params.constraints || "(none)"}

Input / output format:
${params.inputOutputFormat || "(unspecified)"}

Examples:
${params.examples || "(none)"}

Learner language for their solution: ${params.language === "cpp" ? "C++" : "Python"}.

Rules (must follow):
- Produce exactly ${count} ordered steps (Step 1 → Step ${count}). Each step introduces only ONE new concept or action.
- Do NOT give a full solution, pseudocode blocks, or a recipe that solves the whole problem.
- Do NOT skip prerequisites; assume the learner may not know loops, variables, or I/O unless you already introduced them in an earlier step in this same list.
- Steps must feel like progressive unlocks: reading the problem → thinking about inputs → storing data → core logic → output.
- ${codeRule}
- ${specificityGuide}
- Use supportive, simple language suitable for beginners.

Return ONLY valid JSON (no markdown) in this shape:
{"steps":["...","..."]}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json"
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new GeminiResponseError(errText ? `Mentor request failed (${res.status}).` : `Mentor request failed (${res.status}).`);
  }

  const data: unknown = await res.json();
  const text =
    data &&
    typeof data === "object" &&
    "candidates" in data &&
    Array.isArray((data as { candidates?: unknown }).candidates) &&
    (data as { candidates: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates[0]?.content?.parts?.[0]?.text;

  if (typeof text !== "string" || !text.trim()) {
    throw new GeminiResponseError("Empty mentor response.");
  }

  return parseStepsPayload(text);
}
