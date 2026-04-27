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
  return 9;
}

export function buildSeedFallbackSteps(params: SeedPlanParams): string[] {
  const count = targetStepCount(params.hintSpecificity);
  const isStringProblem = /string|sentence|character|vowel|text/i.test(
    `${params.problemTitle} ${params.problemDescription} ${params.constraints}`
  );
  const base = isStringProblem
    ? [
        "Programs begin from one fixed starting point. Think about where execution starts.",
        "Tell the user what input you expect so they know what to type.",
        "Store the whole sentence in a text variable.",
        "If spaces are possible, read a full line instead of a single word.",
        "Create a counter variable and begin it at zero.",
        "Visit each character one by one using repetition.",
        "For each character, check whether it is a vowel.",
        "If it is a vowel, increase the counter by one.",
        "After the loop ends, display the final vowel count."
      ]
    : [
        "Start by identifying exactly what the program receives as input.",
        "Decide which variable(s) will store the input values.",
        "Initialize any counters or tracking values before processing begins.",
        "Process the input one item at a time in a loop.",
        "At each step, apply one clear condition to decide what to do next.",
        "Update your tracking variables when the condition is satisfied.",
        "Once processing is complete, print only the final required result.",
        "Test one normal case and one edge case to confirm behavior."
      ];

  if (count <= base.length) return base.slice(0, count);
  const padded = [...base];
  while (padded.length < count) {
    padded.push("Refine your current step by checking boundaries and formatting carefully.");
  }
  return padded;
}

function normalizeSeedStep(step: string): string {
  const compact = step.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.replace(/^[\-\d\.\)\s]+/, "").trim();
}

function enforceSeedStyle(steps: string[], count: number): string[] {
  const cleaned = steps.map(normalizeSeedStep).filter(Boolean);
  if (cleaned.length < 5) return [];
  if (cleaned.length > count) return cleaned.slice(0, count);
  if (cleaned.length === count) return cleaned;
  return cleaned;
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
- Avoid vague generic statements like "restate the problem". Give concrete learning nudges.
- Prefer a mentor voice similar to: "Think about...", "What should happen when...", "You need...".
- Do not mention all concepts in one step.

Few-shot example for a vowel-count problem (style reference only, do not copy blindly):
{"steps":[
"C++ programs always start from a specific place. Think about where execution begins.",
"The user needs clear guidance. How will your program ask for the sentence?",
"You need a place to store text. Which data type can hold a sentence?",
"A sentence may include spaces. Use an input method that reads a full line.",
"Start a vowel counter variable from zero.",
"Check characters one by one by repeating an action over the sentence.",
"For each character, test whether it matches a vowel.",
"If it matches, increase the counter.",
"Print the final counter for the user."
]}

Bad example (never do this):
{"steps":["Restate input and output","Write full algorithm","Print answer"]}

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

  const parsed = parseStepsPayload(text);
  const enforced = enforceSeedStyle(parsed, count);
  if (enforced.length >= 5) return enforced;
  return buildSeedFallbackSteps(params).slice(0, count);
}
