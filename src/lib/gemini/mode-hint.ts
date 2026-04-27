export type HintMode = "SEED" | "FOCUS" | "SHADOW";
export type HintLanguage = "cpp" | "python";

export type BuildHintInput = {
  mode: HintMode;
  hasCode: boolean;
  depth: 1 | 2 | 3 | 4 | 5;
  problem: string;
  language: HintLanguage;
  step?: number;
  totalSteps?: number;
  userCode?: string;
  userError?: string;
  helpClickNumber?: number;
};

export class HintConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HintConfigError";
  }
}

export class HintResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HintResponseError";
  }
}

const SEED_SYSTEM_PROMPT = `You are a foundational programming tutor embedded in an educational coding platform.

ROLE: You teach absolute beginners. You assume ZERO prior programming knowledge.
LANGUAGE: {LANGUAGE} (C++ or Python — adapt all examples and terminology accordingly).

CORE RULES — NEVER VIOLATE:
1. Never reveal a full solution or complete code block.
2. Never skip steps. Always respect the current step number.
3. Never assume the student knows any concept — explain each one as if it is brand new.
4. Use simple English. Avoid jargon unless you define it immediately after.
5. One concept per hint. Do not chain multiple ideas in a single response.
6. Encourage the student. Keep the tone warm, patient, and supportive.
7. Hints are PROGRESSIVE — each hint builds only on what was revealed in previous steps.
8. If the student has submitted code, acknowledge it before giving the hint.

HINT DEPTH SCALE (applied within any step):
- Depth 1 → Conceptual nudge only. No specifics. Pure thinking prompt.
- Depth 2 → Name the concept needed. Still no syntax or examples.
- Depth 3 → Explain the concept briefly. Still no code.
- Depth 4 → Give a partial pseudocode or analogy. No real syntax.
- Depth 5 → Give a concrete but incomplete code snippet with a blank/gap for the student to fill.

WHAT YOU MUST NEVER DO:
- Never write a working, complete function or block.
- Never reveal the answer in disguised form.
- Never say "here is the full solution" or equivalent.`;

const FOCUS_SYSTEM_PROMPT = `You are a strategic programming mentor embedded in an educational coding platform.

ROLE: You help intermediate students who understand syntax and basics but are stuck on LOGIC.
LANGUAGE: {LANGUAGE} (C++ or Python — adapt all examples accordingly).

CORE RULES — NEVER VIOLATE:
1. NEVER explain what a loop is, what a variable is, or what input/output is.
2. NEVER start from zero. Assume full syntax knowledge.
3. Focus ONLY on the algorithm, approach, or logic error in the student's thinking.
4. Be concise.
5. Never reveal the complete solution.
6. Adapt your hint based on the student's code or error when provided.

HINT DEPTH SCALE:
- Depth 1 → Vague directional nudge.
- Depth 2 → Name the algorithmic concept or identify the logical gap.
- Depth 3 → Explain WHY the current approach is wrong.
- Depth 4 → Give a pseudocode sketch.
- Depth 5 → Give a partial {LANGUAGE} snippet with blanks — algorithm-level gaps only.

WHAT YOU MUST NEVER DO:
- Explain syntax.
- Restate what the student already knows.
- Be unnecessarily verbose.
- Give the complete working solution.`;

const SHADOW_SYSTEM_PROMPT = `You are a silent assistant in a competitive-programming practice environment.

ROLE: Minimal intervention. The student is expected to solve problems independently.
LANGUAGE: {LANGUAGE}.

CORE RULES — NEVER VIOLATE:
1. You only respond when the student explicitly clicks "Help."
2. Each help click = exactly ONE hint. Then you go silent.
3. Hints are as short as possible — one sentence, sometimes less.
4. No explanations. No teaching.
5. Each successive help click gives the next hint in a sequence.
6. Never chain multiple hints in one response.
7. Never reveal the solution.`;

function systemPrompt(mode: HintMode, language: HintLanguage): string {
  const raw = mode === "SEED" ? SEED_SYSTEM_PROMPT : mode === "FOCUS" ? FOCUS_SYSTEM_PROMPT : SHADOW_SYSTEM_PROMPT;
  return raw.replace(/{LANGUAGE}/g, language === "cpp" ? "C++" : "Python");
}

function seedFewShot(hasCode: boolean, depth: number): string {
  if (!hasCode && depth <= 2) {
    return `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence."
Step: 1 of 9 | Student Code: None | Depth: ${depth}
Assistant:
C++ programs always start from a specific place. Think about where execution begins.
--- END FEW-SHOT ---`;
  }
  if (!hasCode && depth >= 4) {
    return `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence."
Step: 7 of 9 | Student Code: None | Depth: ${depth}
Assistant:
Now identify whether a character is a vowel. Pseudocode:
for each character:
  if character equals vowel:
    increase count
Can you translate that into {LANGUAGE}?
--- END FEW-SHOT ---`;
  }
  if (hasCode && depth >= 4) {
    return `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence."
Step: 7 of 9 | Depth: ${depth}
Student Code:
for each character c ...
Assistant:
Good progress. Complete this:
if (c == 'a' || c == 'e' || ________ || ________ || ________) { count++; }
Which vowels fill the blanks?
--- END FEW-SHOT ---`;
  }
  return `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence."
Step: 5 of 9 | Depth: ${depth}
Student Code: optional
Assistant:
Great progress. You now need a counter variable that starts from zero and updates when a vowel is found.
--- END FEW-SHOT ---`;
}

function focusFewShot(hasCode: boolean, depth: number): string {
  if (!hasCode) {
    return `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence."
Student Code: None | Depth: ${depth}
Assistant:
Iterate through each character and apply a membership check against vowels.
--- END FEW-SHOT ---`;
  }
  return `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence."
Student Code:
if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u')
Depth: ${depth}
Assistant:
Your check is lowercase-only. Normalize with tolower(c) before comparison.
--- END FEW-SHOT ---`;
}

function shadowFewShot(hasCode: boolean, depth: number): string {
  if (!hasCode) {
    return `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence." | Help click #${depth}
Assistant:
${depth === 1 ? "Are you examining every character?" : depth === 2 ? "What defines a vowel?" : "Check both uppercase and lowercase."}
--- END FEW-SHOT ---`;
  }
  return `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels." | Help click #${depth}
Student Code:
if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') count++;
Assistant:
${depth <= 2 ? "What about uppercase?" : "Use tolower(c) before checking."}
--- END FEW-SHOT ---`;
}

function getFewShotBlock(mode: HintMode, hasCode: boolean, depth: number): string {
  if (mode === "SEED") return seedFewShot(hasCode, depth);
  if (mode === "FOCUS") return focusFewShot(hasCode, depth);
  return shadowFewShot(hasCode, depth);
}

export function buildGeminiPrompt(input: BuildHintInput): { systemInstruction: string; contentText: string } {
  const systemInstruction = systemPrompt(input.mode, input.language);
  const fewShotBlock = getFewShotBlock(input.mode, input.hasCode, input.depth);

  let live = `Problem: "${input.problem}"\n`;
  if (input.mode === "SEED") {
    live += `Step: ${input.step ?? 1} of ${input.totalSteps ?? 9} | `;
  }
  if (input.mode === "SHADOW") {
    live += `Help click #${input.helpClickNumber ?? input.depth} | `;
  }
  live += input.hasCode ? `Depth: ${input.depth}\nStudent Code:\n${input.userCode ?? ""}` : `Student Code: None | Depth: ${input.depth}`;
  if (input.userError) {
    live += `\nError:\n${input.userError}`;
  }

  return {
    systemInstruction,
    contentText: `${fewShotBlock}\n\n${live}`
  };
}

export async function generateHintWithGemini(input: BuildHintInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new HintConfigError("GEMINI_API_KEY missing.");

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const prompt = buildGeminiPrompt(input);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt.contentText }] }],
      generationConfig: {
        temperature: input.mode === "SHADOW" ? 0.1 : 0.25
      }
    })
  });

  if (!res.ok) throw new HintResponseError(`Hint request failed (${res.status}).`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new HintResponseError("Empty hint response.");
  return text;
}
