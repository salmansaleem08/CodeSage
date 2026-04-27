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

type ScenarioKey = `${HintMode}_${"code" | "nocode"}_${1 | 2 | 3 | 4 | 5}`;

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
- Never reveal the answer in disguised form (e.g., "the answer is vowels: a,e,i,o,u — just check against those").
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

const SEED_ERROR_OVERLAY = `The student has encountered a compiler or runtime error.
- Do NOT just quote the error message back.
- Explain what the error TYPE means in plain English before giving the hint.
- Keep to the step-progression rules.`;

const FOCUS_ERROR_OVERLAY = `The student has encountered an error.
- Identify the root cause concisely.
- Give a focused fix direction at the current depth.
- Assume syntax knowledge and avoid basic teaching.`;

const SHADOW_ERROR_OVERLAY = `The student has an error.
- One line only.
- Point to cause or fix directly.
- No elaboration.`;

function systemPrompt(mode: HintMode, language: HintLanguage, hasError: boolean): string {
  const raw = mode === "SEED" ? SEED_SYSTEM_PROMPT : mode === "FOCUS" ? FOCUS_SYSTEM_PROMPT : SHADOW_SYSTEM_PROMPT;
  const withLang = raw.replace(/{LANGUAGE}/g, language === "cpp" ? "C++" : "Python");
  if (!hasError) return withLang;
  const overlay = mode === "SEED" ? SEED_ERROR_OVERLAY : mode === "FOCUS" ? FOCUS_ERROR_OVERLAY : SHADOW_ERROR_OVERLAY;
  return `${withLang}\n\n${overlay}`;
}

const FEW_SHOTS: Record<ScenarioKey, string> = {
  SEED_nocode_1: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE 1]
Problem: "Count vowels in a sentence."
Step: 1 of 9 | Student Code: None | Depth: 1
Assistant:
Every program has a starting point — a place where execution begins. Before writing a single line, just think: where does a {LANGUAGE} program begin?
--- END FEW-SHOT ---`,
  SEED_nocode_2: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE 1]
Problem: "Count vowels in a sentence."
Step: 3 of 9 | Student Code: None | Depth: 2
Assistant:
To store the sentence the user types, you need a variable. Since a sentence is text, you need a string.
--- END FEW-SHOT ---`,
  SEED_nocode_3: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE 1]
Problem: "Count vowels in a sentence."
Step: 6 of 9 | Student Code: None | Depth: 3
Assistant:
To check each character one by one, you use a loop. Think of moving through a sentence like reading letter by letter.
--- END FEW-SHOT ---`,
  SEED_nocode_4: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE 1]
Problem: "Count vowels in a sentence."
Step: 7 of 9 | Student Code: None | Depth: 4
Assistant:
for each character in sentence:
  if character equals a vowel:
    increase counter
Can you translate this into {LANGUAGE}?
--- END FEW-SHOT ---`,
  SEED_nocode_5: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE 1]
Problem: "Count vowels in a sentence."
Step: 7 of 9 | Student Code: None | Depth: 5
Assistant:
for (int i = 0; i < sentence.length(); i++) {
  char c = sentence[i];
  if (c == 'a' || c == 'e' || ________ || ________ || ________) { count++; }
}
Which vowels fill the blanks?
--- END FEW-SHOT ---`,
  SEED_code_1: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE 1]
Problem: "Count vowels in a sentence."
Step: 3 of 9 | Depth: 1
Student Code:
cout << "Enter sentence: ";
Assistant:
Good start! Where will the typed text be stored next?
--- END FEW-SHOT ---`,
  SEED_code_2: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE 1]
Problem: "Count vowels in a sentence."
Step: 5 of 9 | Depth: 2
Student Code:
getline(cin, sentence);
Assistant:
Excellent — now add a counter variable that starts from zero and tracks vowel matches.
--- END FEW-SHOT ---`,
  SEED_code_3: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE 1]
Problem: "Count vowels in a sentence."
Step: 6 of 9 | Depth: 3
Student Code:
getline(cin, sentence);
int count = 0;
Assistant:
Great setup. Now walk through the string index by index so each character can be inspected.
--- END FEW-SHOT ---`,
  SEED_code_4: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE 1]
Problem: "Count vowels in a sentence."
Step: 7 of 9 | Depth: 4
Student Code:
for (int i = 0; i < sentence.length(); i++) { char c = sentence[i]; }
Assistant:
if c equals 'a' OR 'e' OR 'i' OR 'o' OR 'u':
  increase count
Can you add this inside your existing loop?
--- END FEW-SHOT ---`,
  SEED_code_5: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE 1]
Problem: "Count vowels in a sentence."
Step: 7 of 9 | Depth: 5
Student Code:
for (int i = 0; i < sentence.length(); i++) {
  char c = sentence[i];
}
Assistant:
if (c == 'a' || c == 'e' || ________ || ________ || ________) { ________++; }
Which values fill these blanks?
--- END FEW-SHOT ---`,
  FOCUS_nocode_1: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence." | Depth: 1
Assistant:
Think about what unit you must inspect — whole string or each character?
--- END FEW-SHOT ---`,
  FOCUS_nocode_2: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence." | Depth: 2
Assistant:
Use a linear scan and membership check against the vowel set.
--- END FEW-SHOT ---`,
  FOCUS_nocode_3: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence." | Depth: 3
Assistant:
The common bug is case sensitivity. Handle both uppercase and lowercase to avoid undercounting.
--- END FEW-SHOT ---`,
  FOCUS_nocode_4: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence." | Depth: 4
Assistant:
count = 0
for each c in sentence:
  if c in vowel_set:
    count++
--- END FEW-SHOT ---`,
  FOCUS_nocode_5: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Problem: "Count vowels in a sentence." | Depth: 5
Assistant:
if (vowels.________(c) ________ string::npos) { count++; }
Which method and comparator complete this?
--- END FEW-SHOT ---`,
  FOCUS_code_1: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Student Code:
if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u')
Assistant:
What happens with uppercase letters like 'A'?
--- END FEW-SHOT ---`,
  FOCUS_code_2: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Student Code:
if (x > largest) largest = x;
else if (x > second) second = x;
Assistant:
When x becomes new largest, preserve old largest into second first.
--- END FEW-SHOT ---`,
  FOCUS_code_3: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Student Code:
if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u')
Assistant:
This is case-sensitive. Normalize each character (e.g., tolower) before the comparison.
--- END FEW-SHOT ---`,
  FOCUS_code_4: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Student Code:
if (x > largest) largest = x;
else if (x > second) second = x;
Assistant:
if x > largest:
  second = largest
  largest = x
else if x > second and x != largest:
  second = x
--- END FEW-SHOT ---`,
  FOCUS_code_5: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Student Code:
if (x > largest) largest = x;
else if (x > second) second = x;
Assistant:
if (x > largest) { second = ________; largest = ________; } else if (x > second && x != ________) { second = x; }
--- END FEW-SHOT ---`,
  SHADOW_nocode_1: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE] Problem: "Count vowels." | Help click #1
Assistant: Are you examining every character?
--- END FEW-SHOT ---`,
  SHADOW_nocode_2: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE] Problem: "Count vowels." | Help click #2
Assistant: What defines a vowel?
--- END FEW-SHOT ---`,
  SHADOW_nocode_3: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE] Problem: "Count vowels." | Help click #3
Assistant: Check both uppercase and lowercase.
--- END FEW-SHOT ---`,
  SHADOW_nocode_4: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE] Problem: "Count vowels." | Help click #4
Assistant: Use tolower() before comparing.
--- END FEW-SHOT ---`,
  SHADOW_nocode_5: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE] Problem: "Count vowels." | Help click #5
Assistant: string vowels="aeiouAEIOU"; if (vowels.find(c) != string::npos)
--- END FEW-SHOT ---`,
  SHADOW_code_1: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Student Code:
if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') count++;
Assistant: What about uppercase?
--- END FEW-SHOT ---`,
  SHADOW_code_2: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Student Code:
if (x > largest) largest = x;
Assistant: Save largest into second before overwrite.
--- END FEW-SHOT ---`,
  SHADOW_code_3: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Student Code:
if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u')
Assistant: Use tolower(c) before comparison.
--- END FEW-SHOT ---`,
  SHADOW_code_4: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Student Code:
for (int i = 0; i < n; i++) if (arr[i] > arr[i+1]) return false;
Assistant: for (int i = 0; i < n - 1; i++)
--- END FEW-SHOT ---`,
  SHADOW_code_5: `--- FEW-SHOT EXAMPLES ---
[EXAMPLE]
Student Code:
if (x > largest) largest = x;
else if (x > second) second = x;
Assistant: if(x>largest){second=largest;largest=x;}else if(x>second&&x!=largest){second=x;}
--- END FEW-SHOT ---`
};

const LIVE_TEMPLATES: Record<ScenarioKey, string> = {
  SEED_nocode_1:
    'Problem: "{PROBLEM}"\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Student Code: None | Depth: 1\n\nGive a Depth-1 SEED hint for this step. Conceptual nudge only — no concept names, no syntax, no examples. Pure thinking prompt. One sentence or two maximum.',
  SEED_nocode_2:
    'Problem: "{PROBLEM}"\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Student Code: None | Depth: 2\n\nGive a Depth-2 SEED hint. Name the concept and explain it in plain English. No syntax, no code.',
  SEED_nocode_3:
    'Problem: "{PROBLEM}"\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Student Code: None | Depth: 3\n\nGive a Depth-3 SEED hint. Explain concept in beginner-friendly language with analogy if useful. No code.',
  SEED_nocode_4:
    'Problem: "{PROBLEM}"\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Student Code: None | Depth: 4\n\nGive a Depth-4 SEED hint using pseudocode or analogy only. End with a translation question.',
  SEED_nocode_5:
    'Problem: "{PROBLEM}"\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Student Code: None | Depth: 5\n\nGive a Depth-5 SEED hint. Provide partial {LANGUAGE} snippet with ________ blanks. Keep it incomplete.',
  SEED_code_1:
    'Problem: "{PROBLEM}"\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Depth: 1\nStudent Code:\n{USER_CODE}\n\nAcknowledge one correct thing, then give a Depth-1 conceptual nudge. No syntax.',
  SEED_code_2:
    'Problem: "{PROBLEM}"\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Depth: 2\nStudent Code:\n{USER_CODE}\n\nAcknowledge progress. Name needed concept and explain in plain English.',
  SEED_code_3:
    'Problem: "{PROBLEM}"\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Depth: 3\nStudent Code:\n{USER_CODE}\n\nAcknowledge progress and explain concept using their variable names.',
  SEED_code_4:
    'Problem: "{PROBLEM}"\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Depth: 4\nStudent Code:\n{USER_CODE}\n\nProvide pseudocode for THIS step using their variable names. End with a direct question.',
  SEED_code_5:
    'Problem: "{PROBLEM}"\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Depth: 5\nStudent Code:\n{USER_CODE}\n\nProvide modified snippet with ________ blanks at missing logic. Keep snippet incomplete and ask targeted questions.',
  FOCUS_nocode_1:
    'Problem: "{PROBLEM}"\nMode: FOCUS | Student Code: None | Depth: 1\n\nGive a Depth-1 FOCUS hint. One question or directional nudge.',
  FOCUS_nocode_2:
    'Problem: "{PROBLEM}"\nMode: FOCUS | Student Code: None | Depth: 2\n\nGive a Depth-2 FOCUS hint. Name algorithm/approach and key variables.',
  FOCUS_nocode_3:
    'Problem: "{PROBLEM}"\nMode: FOCUS | Student Code: None | Depth: 3\n\nExplain why naive approach fails or what core logic is tricky. No code.',
  FOCUS_nocode_4:
    'Problem: "{PROBLEM}"\nMode: FOCUS | Student Code: None | Depth: 4\n\nProvide clean pseudocode with one note on non-obvious decision.',
  FOCUS_nocode_5:
    'Problem: "{PROBLEM}"\nMode: FOCUS | Student Code: None | Depth: 5\n\nProvide partial {LANGUAGE} snippet with algorithmic blanks (________).',
  FOCUS_code_1:
    'Problem: "{PROBLEM}"\nMode: FOCUS | Depth: 1\nStudent Code:\n{USER_CODE}\n\nIdentify key logical issue as one pointed question/observation.',
  FOCUS_code_2:
    'Problem: "{PROBLEM}"\nMode: FOCUS | Depth: 2\nStudent Code:\n{USER_CODE}\n\nName precise issue and correct conceptual approach. No code.',
  FOCUS_code_3:
    'Problem: "{PROBLEM}"\nMode: FOCUS | Depth: 3\nStudent Code:\n{USER_CODE}\n\nExplain exact bug and why it fails, referencing student code.',
  FOCUS_code_4:
    'Problem: "{PROBLEM}"\nMode: FOCUS | Depth: 4\nStudent Code:\n{USER_CODE}\n\nShow corrected pseudocode using their variable names. End with update question.',
  FOCUS_code_5:
    'Problem: "{PROBLEM}"\nMode: FOCUS | Depth: 5\nStudent Code:\n{USER_CODE}\n\nReturn their code with partial fix containing blanks (________).',
  SHADOW_nocode_1:
    'Problem: "{PROBLEM}"\nMode: SHADOW | Help click #1 | Student Code: None\n\nGive first SHADOW hint in one line only.',
  SHADOW_nocode_2:
    'Problem: "{PROBLEM}"\nMode: SHADOW | Help click #2 | Student Code: None\n\nGive second SHADOW hint in one line only.',
  SHADOW_nocode_3:
    'Problem: "{PROBLEM}"\nMode: SHADOW | Help click #3 | Student Code: None\n\nGive third SHADOW hint in one line only.',
  SHADOW_nocode_4:
    'Problem: "{PROBLEM}"\nMode: SHADOW | Help click #4 | Student Code: None\n\nGive fourth SHADOW hint in one line only.',
  SHADOW_nocode_5:
    'Problem: "{PROBLEM}"\nMode: SHADOW | Help click #5 | Student Code: None\n\nGive fifth SHADOW hint as minimal code fragment only.',
  SHADOW_code_1:
    'Problem: "{PROBLEM}"\nMode: SHADOW | Help click #1\nStudent Code:\n{USER_CODE}\n\nOne-line issue pointer only.',
  SHADOW_code_2:
    'Problem: "{PROBLEM}"\nMode: SHADOW | Help click #2\nStudent Code:\n{USER_CODE}\n\nOne-line fix direction only.',
  SHADOW_code_3:
    'Problem: "{PROBLEM}"\nMode: SHADOW | Help click #3\nStudent Code:\n{USER_CODE}\n\nOne-line exact fix insight only.',
  SHADOW_code_4:
    'Problem: "{PROBLEM}"\nMode: SHADOW | Help click #4\nStudent Code:\n{USER_CODE}\n\nOne-line minimal {LANGUAGE} fragment.',
  SHADOW_code_5:
    'Problem: "{PROBLEM}"\nMode: SHADOW | Help click #5\nStudent Code:\n{USER_CODE}\n\nReturn compact corrected line(s) only.'
};

function getScenarioKey(mode: HintMode, hasCode: boolean, depth: 1 | 2 | 3 | 4 | 5): ScenarioKey {
  return `${mode}_${hasCode ? "code" : "nocode"}_${depth}`;
}

function clampDepth(value: number | undefined): 1 | 2 | 3 | 4 | 5 {
  const n = Math.round(Number(value ?? 1));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, n)) as 1 | 2 | 3 | 4 | 5;
}

function resolveEffectiveDepth(input: BuildHintInput): 1 | 2 | 3 | 4 | 5 {
  // SHADOW progression is defined by explicit help clicks, not hint-specificity slider depth.
  if (input.mode === "SHADOW") {
    return clampDepth(input.helpClickNumber);
  }
  return clampDepth(input.depth);
}

function interpolate(template: string, input: BuildHintInput): string {
  const effectiveDepth = resolveEffectiveDepth(input);
  return template
    .replace(/{PROBLEM}/g, input.problem)
    .replace(/{LANGUAGE}/g, input.language === "cpp" ? "C++" : "Python")
    .replace(/{STEP_NUMBER}/g, String(input.step ?? 1))
    .replace(/{TOTAL_STEPS}/g, String(input.totalSteps ?? 9))
    .replace(/{DEPTH}/g, String(effectiveDepth))
    .replace(/{HELP_CLICK_NUMBER}/g, String(clampDepth(input.helpClickNumber)))
    .replace(/{USER_CODE}/g, input.userCode ?? "")
    .replace(/{USER_ERROR}/g, input.userError ?? "");
}

export function buildGeminiPrompt(input: BuildHintInput): { systemInstruction: string; contentText: string } {
  const key = getScenarioKey(input.mode, input.hasCode, resolveEffectiveDepth(input));
  const systemInstruction = systemPrompt(input.mode, input.language, Boolean(input.userError?.trim()));
  const fewShotBlock = interpolate(FEW_SHOTS[key], input);
  const liveBlock = interpolate(LIVE_TEMPLATES[key], input);
  const errorBlock = input.userError?.trim() ? `\nError:\n${input.userError}` : "";

  return {
    systemInstruction,
    contentText: `${fewShotBlock}\n\n${liveBlock}${errorBlock}`
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
