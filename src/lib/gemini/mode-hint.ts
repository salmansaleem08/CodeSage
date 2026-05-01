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

// ── System prompts ──────────────────────────────────────────────────

const SEED_SYSTEM_PROMPT = `You are a foundational programming tutor embedded in an educational coding platform called CodeSage.

ROLE: You teach absolute beginners. You assume ZERO prior programming knowledge.
LANGUAGE: {LANGUAGE} — every code fragment, variable name, and syntax reference must use {LANGUAGE} only.

CORE RULES — NEVER VIOLATE:
1. Never reveal a full solution or a complete code block.
2. One concept per hint. Do not chain multiple ideas in one response.
3. Respect the current step number exactly — do not jump ahead or refer to later steps.
4. Use plain English. Define any jargon immediately after using it.
5. Keep the tone warm, patient, and encouraging.
6. If the student has submitted code, acknowledge something correct before giving the hint.
7. Each hint MUST reference the actual problem given — not a generic programming example.

RESPONSE LENGTH — STRICTLY ENFORCE:
- Depth 1: 1–2 sentences max. Pure thinking prompt. No concept names, no syntax.
- Depth 2: 2–3 sentences max. Name the concept, explain in plain English. No code.
- Depth 3: 3–4 sentences max. Explain concept with analogy relevant to THIS problem. No code.
- Depth 4: 4–8 lines max. Pseudocode only, using variable names that match the problem.
- Depth 5: 6–10 lines max. Partial {LANGUAGE} snippet with ________ blanks. End with one question.

WHAT YOU MUST NEVER DO:
- Write a working, complete function or block.
- Reveal the answer in disguised form.
- Give generic advice unrelated to the specific problem.
- Exceed the length limit for the depth level.
- Use markdown headers or bullet lists (exception: pseudocode at depth 4).`;

const FOCUS_SYSTEM_PROMPT = `You are a strategic programming mentor embedded in an educational coding platform called CodeSage.

ROLE: You help intermediate students who understand {LANGUAGE} syntax but are stuck on LOGIC.
LANGUAGE: {LANGUAGE} — all code must be {LANGUAGE}.

CORE RULES — NEVER VIOLATE:
1. NEVER explain what a loop is, what a variable is, or how I/O works.
2. Assume full syntax knowledge. Start from where they are stuck.
3. Focus ONLY on the algorithm, approach, or logic error.
4. Always reference the specific problem given in your hint.
5. Never reveal the complete solution.
6. Be concise — every sentence must add new information.

RESPONSE LENGTH — STRICTLY ENFORCE:
- Depth 1: 1 sentence. One pointed question or directional nudge.
- Depth 2: 2–3 sentences. Name the precise issue and the correct concept.
- Depth 3: 3–5 sentences. Explain exactly WHY the current approach is wrong, referencing their code.
- Depth 4: Up to 8 lines. Corrected pseudocode using their variable names. End with a question.
- Depth 5: Up to 10 lines. Their code with partial fix containing ________ blanks. Ask targeted questions.

WHAT YOU MUST NEVER DO:
- Explain syntax basics.
- Repeat what the student already knows.
- Be verbose. Cut mercilessly.
- Give the complete working solution.`;

const SHADOW_SYSTEM_PROMPT = `You are a silent assistant in a competitive-programming practice environment called CodeSage.

ROLE: Minimal intervention. The student solves problems independently.
LANGUAGE: {LANGUAGE}.

CORE RULES — NEVER VIOLATE:
1. Respond ONLY when the student explicitly clicks Help.
2. Each help click = exactly ONE hint. One sentence only — never more.
3. No explanations. No teaching. No praise.
4. Successive clicks escalate specificity from vague to direct.
5. Never reveal the solution.
6. Reference the actual problem. Do not give generic advice.`;

// ── Error overlays ───────────────────────────────────────────────────

const SEED_ERROR_OVERLAY = `IMPORTANT — the student has a compiler or runtime error:
- First name what TYPE of error this is in plain English (e.g., "This is a type mismatch error").
- Then give the hint at the requested depth as normal.
- Do NOT just quote the error message back verbatim.
- Stay within the step-progression rules.`;

const FOCUS_ERROR_OVERLAY = `IMPORTANT — the student has an error:
- Identify the root cause concisely in one clause.
- Then give a focused fix direction at the current depth.
- Assume full syntax knowledge.`;

const SHADOW_ERROR_OVERLAY = `Error present. One line only: point directly at cause or minimal fix. No elaboration.`;

function systemPrompt(mode: HintMode, language: HintLanguage, hasError: boolean): string {
  const raw =
    mode === "SEED" ? SEED_SYSTEM_PROMPT : mode === "FOCUS" ? FOCUS_SYSTEM_PROMPT : SHADOW_SYSTEM_PROMPT;
  const withLang = raw.replace(/{LANGUAGE}/g, language === "cpp" ? "C++" : "Python");
  if (!hasError) return withLang;
  const overlay =
    mode === "SEED" ? SEED_ERROR_OVERLAY : mode === "FOCUS" ? FOCUS_ERROR_OVERLAY : SHADOW_ERROR_OVERLAY;
  return `${withLang}\n\n${overlay}`;
}

// ── Few-shot examples (varied problems, not all vowels) ───────────────

const FEW_SHOTS: Record<ScenarioKey, string> = {
  // ── SEED nocode ──────────────────────────────────────────────────
  SEED_nocode_1: `--- FEW-SHOT EXAMPLE ---
Problem: "Read N integers and find the largest one."
Step: 1 of 8 | Student Code: None | Depth: 1
Assistant:
Before writing a single line, think about this: if I handed you a printed list of numbers, what would you physically do first to find the biggest one?
--- END ---`,

  SEED_nocode_2: `--- FEW-SHOT EXAMPLE ---
Problem: "Read N integers and find the largest one."
Step: 2 of 8 | Student Code: None | Depth: 2
Assistant:
Every {LANGUAGE} program has exactly one place where execution begins — a special function called main. You need to write that function before anything else can happen.
--- END ---`,

  SEED_nocode_3: `--- FEW-SHOT EXAMPLE ---
Problem: "Read N integers and find the largest one."
Step: 4 of 8 | Student Code: None | Depth: 3
Assistant:
To track the largest number seen so far, think of a scoreboard that holds one record at a time. When a new number beats the record, you erase the old one and write the new one. Your variable acts exactly like this scoreboard — start it with the first number you read, then update it whenever a bigger number arrives.
--- END ---`,

  SEED_nocode_4: `--- FEW-SHOT EXAMPLE ---
Problem: "Read N integers and find the largest one."
Step: 5 of 8 | Student Code: None | Depth: 4
Assistant:
read first number into maxSoFar
for each remaining number x:
  if x is greater than maxSoFar:
    maxSoFar = x
print maxSoFar
Can you translate this into {LANGUAGE}?
--- END ---`,

  SEED_nocode_5: `--- FEW-SHOT EXAMPLE ---
Problem: "Read N integers and find the largest one."
Step: 5 of 8 | Student Code: None | Depth: 5
Assistant:
int maxSoFar = ________;
for (int i = 1; i < n; i++) {
  int x; cin >> x;
  if (x ________ maxSoFar) { maxSoFar = ________; }
}
cout << maxSoFar;
What value should maxSoFar start at, and which operator fills the blank?
--- END ---`,

  // ── SEED code ────────────────────────────────────────────────────
  SEED_code_1: `--- FEW-SHOT EXAMPLE ---
Problem: "Print FizzBuzz from 1 to N (Fizz for multiples of 3, Buzz for 5, FizzBuzz for both)."
Step: 3 of 7 | Depth: 1
Student Code:
int n; cin >> n;
for (int i = 1; i <= n; i++) {
Assistant:
Good — you have the loop. Now think inside it: what is the very first thing you must decide about each number i before you print anything?
--- END ---`,

  SEED_code_2: `--- FEW-SHOT EXAMPLE ---
Problem: "Print FizzBuzz from 1 to N."
Step: 4 of 7 | Depth: 2
Student Code:
for (int i = 1; i <= n; i++) {
  if (i % 3 == 0) cout << "Fizz\n";
}
Assistant:
You have handled multiples of 3 correctly. You now need to check two more cases: divisible by 5, and divisible by both 3 and 5. The divisible-by-both check must come first in your if/else chain, otherwise it will never be reached.
--- END ---`,

  SEED_code_3: `--- FEW-SHOT EXAMPLE ---
Problem: "Print FizzBuzz from 1 to N."
Step: 4 of 7 | Depth: 3
Student Code:
if (i % 3 == 0) cout << "Fizz\n";
else if (i % 5 == 0) cout << "Buzz\n";
Assistant:
Your logic is almost there. The problem is ordering: when i equals 15, both conditions are true, but your if/else picks only the first one it hits (Fizz) and never prints FizzBuzz. Put the combined check — divisible by both 3 AND 5 — at the very top, before the individual checks.
--- END ---`,

  SEED_code_4: `--- FEW-SHOT EXAMPLE ---
Problem: "Print FizzBuzz from 1 to N."
Step: 5 of 7 | Depth: 4
Student Code:
if (i % 3 == 0) cout << "Fizz\n";
else if (i % 5 == 0) cout << "Buzz\n";
else cout << i << "\n";
Assistant:
if i is divisible by both 3 and 5:
  print "FizzBuzz"
else if i is divisible by 3:
  print "Fizz"
else if i is divisible by 5:
  print "Buzz"
else:
  print i
Can you reorder your if/else to match this?
--- END ---`,

  SEED_code_5: `--- FEW-SHOT EXAMPLE ---
Problem: "Print FizzBuzz from 1 to N."
Step: 5 of 7 | Depth: 5
Student Code:
if (i % 3 == 0) cout << "Fizz\n";
else if (i % 5 == 0) cout << "Buzz\n";
else cout << i << "\n";
Assistant:
if (i % ________ == 0 && i % ________ == 0) cout << "FizzBuzz\n";
else if (i % 3 == 0) cout << "Fizz\n";
else if (i % 5 == 0) cout << "Buzz\n";
else cout << i << "\n";
What two numbers fill the blanks in the first condition?
--- END ---`,

  // ── FOCUS nocode ─────────────────────────────────────────────────
  FOCUS_nocode_1: `--- FEW-SHOT EXAMPLE ---
Problem: "Given an array, find two indices i and j such that arr[i] + arr[j] == target." | Depth: 1
Assistant:
What data structure lets you check in constant time whether a complement you need has already been seen?
--- END ---`,

  FOCUS_nocode_2: `--- FEW-SHOT EXAMPLE ---
Problem: "Given an array, find two indices i and j such that arr[i] + arr[j] == target." | Depth: 2
Assistant:
Use a hash map. For each element x, store it in the map. Before storing, check whether (target - x) already exists in the map — if yes, you have found your pair.
--- END ---`,

  FOCUS_nocode_3: `--- FEW-SHOT EXAMPLE ---
Problem: "Given an array, find two indices i and j such that arr[i] + arr[j] == target." | Depth: 3
Assistant:
The brute-force double loop is O(n²) and will TLE on large inputs. The key insight is that for each element x you process, you already know exactly what value you need: (target - x). A hash map lets you answer "have I seen this value before?" in O(1), reducing the whole solution to a single pass.
--- END ---`,

  FOCUS_nocode_4: `--- FEW-SHOT EXAMPLE ---
Problem: "Given an array, find two indices i and j such that arr[i] + arr[j] == target." | Depth: 4
Assistant:
map<int,int> seen  // value → index
for i from 0 to n-1:
  complement = target - arr[i]
  if complement in seen:
    return (seen[complement], i)
  seen[arr[i]] = i
Does this structure match what you were thinking?
--- END ---`,

  FOCUS_nocode_5: `--- FEW-SHOT EXAMPLE ---
Problem: "Given an array, find two indices i and j such that arr[i] + arr[j] == target." | Depth: 5
Assistant:
unordered_map<int,int> seen;
for (int i = 0; i < n; i++) {
  int comp = ________ - arr[i];
  if (seen.________(comp)) return {seen[comp], i};
  seen[________] = i;
}
Which method checks membership, and what value goes in the last blank?
--- END ---`,

  // ── FOCUS code ───────────────────────────────────────────────────
  FOCUS_code_1: `--- FEW-SHOT EXAMPLE ---
Student Code:
if (x > largest) largest = x;
else if (x > second) second = x;
Assistant:
What happens to the old value of largest when x beats it?
--- END ---`,

  FOCUS_code_2: `--- FEW-SHOT EXAMPLE ---
Student Code:
if (x > largest) largest = x;
else if (x > second) second = x;
Assistant:
When x becomes the new largest, you overwrite largest without saving the old value first — so the former largest is lost. You need to copy largest into second before updating largest.
--- END ---`,

  FOCUS_code_3: `--- FEW-SHOT EXAMPLE ---
Student Code:
for (int i = 0; i < n; i++) if (arr[i] > arr[i+1]) return false;
Assistant:
This loop reads arr[i+1] when i equals n-1, which is one position past the end of the array — undefined behaviour. Your loop bound should be i < n - 1 so the last comparison is arr[n-2] vs arr[n-1].
--- END ---`,

  FOCUS_code_4: `--- FEW-SHOT EXAMPLE ---
Student Code:
if (x > largest) largest = x;
else if (x > second) second = x;
Assistant:
if x > largest:
  second = largest   // preserve old champion first
  largest = x
else if x > second and x != largest:
  second = x
Does this ordering fix the issue you are seeing?
--- END ---`,

  FOCUS_code_5: `--- FEW-SHOT EXAMPLE ---
Student Code:
if (x > largest) largest = x;
else if (x > second) second = x;
Assistant:
if (x > largest) { second = ________; largest = ________; }
else if (x > second && x != ________) { second = x; }
What three values fill the blanks to preserve both the champion and runner-up correctly?
--- END ---`,

  // ── SHADOW nocode ────────────────────────────────────────────────
  SHADOW_nocode_1: `--- FEW-SHOT EXAMPLE ---
Problem: "Check whether a string is a palindrome." | Help click #1
Assistant: Does reversing the string and comparing give you the answer directly?
--- END ---`,

  SHADOW_nocode_2: `--- FEW-SHOT EXAMPLE ---
Problem: "Check whether a string is a palindrome." | Help click #2
Assistant: Two pointers — one from the start, one from the end, move inward while they match.
--- END ---`,

  SHADOW_nocode_3: `--- FEW-SHOT EXAMPLE ---
Problem: "Check whether a string is a palindrome." | Help click #3
Assistant: Stop as soon as a mismatch is found; return false immediately.
--- END ---`,

  SHADOW_nocode_4: `--- FEW-SHOT EXAMPLE ---
Problem: "Check whether a string is a palindrome." | Help click #4
Assistant: while (left < right) { if (s[left] != s[right]) return false; left++; right--; }
--- END ---`,

  SHADOW_nocode_5: `--- FEW-SHOT EXAMPLE ---
Problem: "Check whether a string is a palindrome." | Help click #5
Assistant: return s == string(s.rbegin(), s.rend());
--- END ---`,

  // ── SHADOW code ──────────────────────────────────────────────────
  SHADOW_code_1: `--- FEW-SHOT EXAMPLE ---
Student Code:
if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') count++;
Assistant: What about uppercase vowels?
--- END ---`,

  SHADOW_code_2: `--- FEW-SHOT EXAMPLE ---
Student Code:
if (x > largest) largest = x;
Assistant: Save largest into second before overwriting it.
--- END ---`,

  SHADOW_code_3: `--- FEW-SHOT EXAMPLE ---
Student Code:
for (int i = 0; i < n; i++) if (arr[i] > arr[i+1]) return false;
Assistant: Loop bound should be i < n - 1 to avoid out-of-bounds on the last element.
--- END ---`,

  SHADOW_code_4: `--- FEW-SHOT EXAMPLE ---
Student Code:
dp[i] = dp[i-1] + dp[i-2];
Assistant: Initialise dp[0] and dp[1] before the loop or this will read uninitialised memory.
--- END ---`,

  SHADOW_code_5: `--- FEW-SHOT EXAMPLE ---
Student Code:
if (x > largest) largest = x;
else if (x > second) second = x;
Assistant: if(x>largest){second=largest;largest=x;}else if(x>second&&x!=largest){second=x;}
--- END ---`,
};

// ── Live prompt templates ─────────────────────────────────────────────

const LIVE_TEMPLATES: Record<ScenarioKey, string> = {
  SEED_nocode_1: `Problem:\n"{PROBLEM}"\n\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Student Code: None | Depth: 1\n\nGive a Depth-1 SEED hint for THIS specific problem and step. One thinking prompt, 1–2 sentences maximum. No concept names, no syntax, no code. Make it clearly about THIS problem.`,
  SEED_nocode_2: `Problem:\n"{PROBLEM}"\n\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Student Code: None | Depth: 2\n\nGive a Depth-2 SEED hint. Name the exact concept the student needs right now for this step. Explain it in 2–3 plain-English sentences. Reference this problem specifically. No code.`,
  SEED_nocode_3: `Problem:\n"{PROBLEM}"\n\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Student Code: None | Depth: 3\n\nGive a Depth-3 SEED hint. Explain the concept with an analogy that relates to THIS problem. 3–4 sentences max. No code.`,
  SEED_nocode_4: `Problem:\n"{PROBLEM}"\n\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Student Code: None | Depth: 4\n\nGive a Depth-4 SEED hint. Write pseudocode (4–8 lines) for this step using variable names relevant to this problem. End with "Can you write this in {LANGUAGE}?"`,
  SEED_nocode_5: `Problem:\n"{PROBLEM}"\n\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Student Code: None | Depth: 5\n\nGive a Depth-5 SEED hint. Provide a partial {LANGUAGE} snippet (6–10 lines) with ________ blanks at the key logic. Leave it incomplete. End with one targeted question.`,

  SEED_code_1: `Problem:\n"{PROBLEM}"\n\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Depth: 1\nStudent Code:\n{USER_CODE}\n\nAcknowledge one correct thing the student has done. Then give a 1-sentence Depth-1 thinking nudge about what comes next. Specific to this problem and step.`,
  SEED_code_2: `Problem:\n"{PROBLEM}"\n\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Depth: 2\nStudent Code:\n{USER_CODE}\n\nBriefly acknowledge their progress. Name the next concept they need and explain it in 2–3 sentences relevant to this problem. No code.`,
  SEED_code_3: `Problem:\n"{PROBLEM}"\n\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Depth: 3\nStudent Code:\n{USER_CODE}\n\nAcknowledge what is good. Then explain the next concept using their own variable names where possible. 3–4 sentences max. No code.`,
  SEED_code_4: `Problem:\n"{PROBLEM}"\n\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Depth: 4\nStudent Code:\n{USER_CODE}\n\nProvide pseudocode (4–8 lines) for the NEXT step, using variable names from the student's code. End with a direct question.`,
  SEED_code_5: `Problem:\n"{PROBLEM}"\n\nStep: {STEP_NUMBER} of {TOTAL_STEPS} | Depth: 5\nStudent Code:\n{USER_CODE}\n\nTake the student's code and show the next step with ________ blanks at the missing logic. Keep it incomplete. Ask one targeted question.`,

  FOCUS_nocode_1: `Problem:\n"{PROBLEM}"\n\nMode: FOCUS | Depth: 1 | Student Code: None\n\nGive exactly one pointed question or directional nudge for this problem. One sentence.`,
  FOCUS_nocode_2: `Problem:\n"{PROBLEM}"\n\nMode: FOCUS | Depth: 2 | Student Code: None\n\nName the algorithm or data structure needed and state why it applies to this problem. 2–3 sentences max.`,
  FOCUS_nocode_3: `Problem:\n"{PROBLEM}"\n\nMode: FOCUS | Depth: 3 | Student Code: None\n\nExplain why the naive approach fails and what the core insight is. Reference this problem directly. 3–5 sentences.`,
  FOCUS_nocode_4: `Problem:\n"{PROBLEM}"\n\nMode: FOCUS | Depth: 4 | Student Code: None\n\nProvide clean pseudocode (up to 8 lines) with one sentence explaining the non-obvious decision.`,
  FOCUS_nocode_5: `Problem:\n"{PROBLEM}"\n\nMode: FOCUS | Depth: 5 | Student Code: None\n\nProvide a partial {LANGUAGE} snippet with ________ blanks at the algorithmic decision points. Ask what fills each blank.`,

  FOCUS_code_1: `Problem:\n"{PROBLEM}"\n\nMode: FOCUS | Depth: 1\nStudent Code:\n{USER_CODE}\n\nIdentify the key logical flaw as one pointed question. One sentence.`,
  FOCUS_code_2: `Problem:\n"{PROBLEM}"\n\nMode: FOCUS | Depth: 2\nStudent Code:\n{USER_CODE}\n\nName the precise issue in their code and state the correct concept. 2–3 sentences. No code.`,
  FOCUS_code_3: `Problem:\n"{PROBLEM}"\n\nMode: FOCUS | Depth: 3\nStudent Code:\n{USER_CODE}\n\nExplain exactly what is wrong and why it fails, referencing their specific code. 3–5 sentences.`,
  FOCUS_code_4: `Problem:\n"{PROBLEM}"\n\nMode: FOCUS | Depth: 4\nStudent Code:\n{USER_CODE}\n\nShow corrected pseudocode (up to 8 lines) using their variable names. End with a question.`,
  FOCUS_code_5: `Problem:\n"{PROBLEM}"\n\nMode: FOCUS | Depth: 5\nStudent Code:\n{USER_CODE}\n\nReturn their code with the fix applied but with ________ blanks at the key changes. Ask targeted questions.`,

  SHADOW_nocode_1: `Problem:\n"{PROBLEM}"\n\nMode: SHADOW | Help click #1 | Student Code: None\n\nOne sentence only. First nudge.`,
  SHADOW_nocode_2: `Problem:\n"{PROBLEM}"\n\nMode: SHADOW | Help click #2 | Student Code: None\n\nOne sentence only. Slightly more specific second nudge.`,
  SHADOW_nocode_3: `Problem:\n"{PROBLEM}"\n\nMode: SHADOW | Help click #3 | Student Code: None\n\nOne sentence only. Name the key technique or condition.`,
  SHADOW_nocode_4: `Problem:\n"{PROBLEM}"\n\nMode: SHADOW | Help click #4 | Student Code: None\n\nOne sentence only. Give a direct implementation direction.`,
  SHADOW_nocode_5: `Problem:\n"{PROBLEM}"\n\nMode: SHADOW | Help click #5 | Student Code: None\n\nMinimal {LANGUAGE} fragment only. No explanation.`,

  SHADOW_code_1: `Problem:\n"{PROBLEM}"\n\nMode: SHADOW | Help click #1\nStudent Code:\n{USER_CODE}\n\nOne sentence: point at the issue.`,
  SHADOW_code_2: `Problem:\n"{PROBLEM}"\n\nMode: SHADOW | Help click #2\nStudent Code:\n{USER_CODE}\n\nOne sentence: name the fix direction.`,
  SHADOW_code_3: `Problem:\n"{PROBLEM}"\n\nMode: SHADOW | Help click #3\nStudent Code:\n{USER_CODE}\n\nOne sentence: exact insight needed.`,
  SHADOW_code_4: `Problem:\n"{PROBLEM}"\n\nMode: SHADOW | Help click #4\nStudent Code:\n{USER_CODE}\n\nMinimal {LANGUAGE} fragment showing the correction. No words.`,
  SHADOW_code_5: `Problem:\n"{PROBLEM}"\n\nMode: SHADOW | Help click #5\nStudent Code:\n{USER_CODE}\n\nReturn the corrected line(s) only.`,
};

// ── Helpers ────────────────────────────────────────────────────────────

function getScenarioKey(mode: HintMode, hasCode: boolean, depth: 1 | 2 | 3 | 4 | 5): ScenarioKey {
  return `${mode}_${hasCode ? "code" : "nocode"}_${depth}`;
}

function clampDepth(value: number | undefined): 1 | 2 | 3 | 4 | 5 {
  const n = Math.round(Number(value ?? 1));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, n)) as 1 | 2 | 3 | 4 | 5;
}

function resolveEffectiveDepth(input: BuildHintInput): 1 | 2 | 3 | 4 | 5 {
  // SHADOW progression is driven by explicit help-click number, not the depth slider
  if (input.mode === "SHADOW") return clampDepth(input.helpClickNumber);
  return clampDepth(input.depth);
}

const MAX_PROBLEM_CHARS = 1_800;

function truncateProblem(text: string): string {
  if (text.length <= MAX_PROBLEM_CHARS) return text;
  return `${text.slice(0, MAX_PROBLEM_CHARS)}…[truncated]`;
}

function interpolate(template: string, input: BuildHintInput): string {
  const effectiveDepth = resolveEffectiveDepth(input);
  return template
    .replace(/{PROBLEM}/g, truncateProblem(input.problem))
    .replace(/{LANGUAGE}/g, input.language === "cpp" ? "C++" : "Python")
    .replace(/{STEP_NUMBER}/g, String(input.step ?? 1))
    .replace(/{TOTAL_STEPS}/g, String(input.totalSteps ?? 9))
    .replace(/{DEPTH}/g, String(effectiveDepth))
    .replace(/{HELP_CLICK_NUMBER}/g, String(clampDepth(input.helpClickNumber)))
    .replace(/{USER_CODE}/g, (input.userCode ?? "").slice(0, 1_200))
    .replace(/{USER_ERROR}/g, (input.userError ?? "").slice(0, 600));
}

// ── Public API ─────────────────────────────────────────────────────────

export function buildGeminiPrompt(input: BuildHintInput): {
  systemInstruction: string;
  contentText: string;
} {
  const key = getScenarioKey(input.mode, input.hasCode, resolveEffectiveDepth(input));
  const systemInstruction = systemPrompt(input.mode, input.language, Boolean(input.userError?.trim()));
  const fewShotBlock = interpolate(FEW_SHOTS[key], input);
  const liveBlock = interpolate(LIVE_TEMPLATES[key], input);
  const errorBlock = input.userError?.trim() ? `\n\nError context:\n${input.userError.slice(0, 600)}` : "";

  return {
    systemInstruction,
    contentText: `${fewShotBlock}\n\n${liveBlock}${errorBlock}`,
  };
}

export async function generateHintWithGemini(input: BuildHintInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new HintConfigError("GEMINI_API_KEY missing.");

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const prompt = buildGeminiPrompt(input);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: prompt.systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: prompt.contentText }] }],
    generationConfig: {
      temperature: input.mode === "SHADOW" ? 0.05 : input.mode === "FOCUS" ? 0.2 : 0.25,
      maxOutputTokens: input.mode === "SHADOW" ? 80 : 350,
    },
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal: AbortSignal.timeout(22_000),
      });

      if (!res.ok) {
        // Retry once on transient server errors
        if (attempt === 0 && res.status >= 500) {
          await new Promise((r) => setTimeout(r, 1_200));
          continue;
        }
        throw new HintResponseError(`Hint request failed (${res.status}).`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new HintResponseError("Empty hint response.");
      return text;
    } catch (err) {
      if (err instanceof HintConfigError || err instanceof HintResponseError) throw err;
      lastError = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1_200));
      }
    }
  }
  throw new HintResponseError(
    lastError instanceof Error ? `Hint error: ${lastError.message}` : "Hint generation failed."
  );
}
