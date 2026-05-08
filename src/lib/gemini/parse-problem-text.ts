import { GeminiConfigError, GeminiResponseError } from "@/lib/gemini/generate-seed-steps";

export type ParsedProblem = {
  title: string;
  description: string;
  constraints: string;
  inputOutputFormat: string;
  examples: string;
};

const MAX_PROMPT_SOURCE_CHARS = 14_000;

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  return trimmed;
}

function extractLikelyJsonBlock(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasUsefulParsedContent(parsed: ParsedProblem): boolean {
  return Boolean(parsed.title || parsed.description || parsed.constraints || parsed.inputOutputFormat || parsed.examples);
}

function looksLikeVowelProblem(source: string): boolean {
  return /count\s+vowel|vowel/i.test(source);
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "for", "in", "on", "at", "by", "with",
  "is", "are", "be", "this", "that", "these", "those", "it", "its", "as", "from",
  "you", "your", "we", "our", "given", "find", "write", "program", "code", "solve",
  "such", "any", "all", "each", "into", "out", "if", "else", "then", "than",
  "input", "output", "constraints", "examples", "example", "sample", "test", "case",
  "should", "must", "may", "can", "will", "do", "does", "would", "have", "has",
  "use", "using", "uses", "which", "what", "where", "when", "while", "after",
  "before", "between", "without", "via"
]);

function titleCase(words: string[]): string {
  return words
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

function deriveTitleFromText(rawText: string): string {
  const compact = rawText.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const tokens = compact
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const counts = new Map<string, number>();
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.length < 3) continue;
    if (STOPWORDS.has(lower)) continue;
    if (/^\d+$/.test(lower)) continue;
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
  }
  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([word]) => word);
  if (top.length === 0) return "";
  return titleCase(top);
}

function looksLikeProseSentence(value: string): boolean {
  const s = value.trim();
  if (!s) return true;
  if (s.length > 80) return true;
  // ends with sentence punctuation, or contains multiple sentences
  if (/[.!?](\s|$)/.test(s) && !/^[A-Z][\w-]*\s?[\w-]*$/.test(s)) return true;
  // looks like an instruction line
  if (/^(write|given|find|return|print|read|compute|implement|you\s+are|count\s+the|determine)\b/i.test(s)) return true;
  return false;
}

function finalizeProblem(rawText: string, parsed: ParsedProblem): ParsedProblem {
  const compact = rawText.replace(/\s+/g, " ").trim();
  const firstLine = rawText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  const candidateTitleFromFirstLine =
    firstLine && firstLine.length <= 80 && !looksLikeProseSentence(firstLine) ? firstLine : "";

  const parsedTitleClean = parsed.title && !looksLikeProseSentence(parsed.title) ? parsed.title : "";

  const derived = deriveTitleFromText(rawText);

  const generatedTitle =
    parsedTitleClean ||
    candidateTitleFromFirstLine ||
    derived ||
    "Generated Practice Problem";

  const generatedDescription =
    parsed.description ||
    (compact
      ? `Solve the following problem based on this statement: ${compact.slice(0, 500)}${compact.length > 500 ? "..." : ""}`
      : "Read input, apply the required logic, and print the expected output.");

  const isVowel = looksLikeVowelProblem(`${rawText}\n${parsed.title}\n${parsed.description}`);

  const generatedConstraints =
    parsed.constraints ||
    (isVowel
      ? "Constraints:\n- 1 <= s.length <= 10^5\n- s consists of English letters and spaces.\n- Treat vowels as: a, e, i, o, u (case-insensitive)."
      : "Constraints:\n- 1 <= n <= 10^5\n- Input values are within 32-bit signed integer range.\n- Design an approach with linear or near-linear complexity when possible.");

  const generatedInputOutput =
    parsed.inputOutputFormat ||
    (isVowel
      ? "Input:\nA single string s.\n\nOutput:\nPrint a single integer: the number of vowels in s."
      : "Input:\nRead values from standard input according to the statement.\n\nOutput:\nPrint the required answer in the exact format.");

  const generatedExample =
    parsed.examples ||
    (isVowel
      ? "Example 1:\nInput: abcdefg\nOutput: 2\nExplanation: The vowels are 'a' and 'e'.\n\nExample 2:\nInput: HELLO WORLD\nOutput: 3\nExplanation: The vowels are 'E', 'O', and 'O'."
      : "Example 1:\nInput: 5\nOutput: 5\nExplanation: Replace with the expected result for the given problem.");

  return {
    title: generatedTitle,
    description: generatedDescription,
    constraints: generatedConstraints,
    inputOutputFormat: generatedInputOutput,
    examples: generatedExample
  };
}

function sliceSection(source: string, fromIdx: number, nextIndices: number[]): string {
  const future = nextIndices.filter((v) => v > fromIdx);
  const end = future.length ? Math.min(...future) : source.length;
  return source.slice(fromIdx, end).trim();
}

function parseProblemTextHeuristic(rawText: string): ParsedProblem {
  const source = rawText.replace(/\r\n/g, "\n").trim();
  const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);
  const title = lines[0] ?? "";

  const lower = source.toLowerCase();
  const idxConstraints = lower.search(/\bconstraints?\b[:\s]/);
  const idxInput = lower.search(/\binput\b[:\s]/);
  const idxOutput = lower.search(/\boutput\b[:\s]/);
  const idxExample = lower.search(/\bexamples?\b[:\s]/);

  const starts = [idxConstraints, idxInput, idxOutput, idxExample].filter((n) => n >= 0);
  const firstSectionIdx = starts.length ? Math.min(...starts) : -1;

  const description = firstSectionIdx >= 0 ? source.slice(0, firstSectionIdx).trim() : source;
  const constraints = idxConstraints >= 0 ? sliceSection(source, idxConstraints, [idxInput, idxOutput, idxExample]) : "";
  const ioParts: string[] = [];
  if (idxInput >= 0) ioParts.push(sliceSection(source, idxInput, [idxOutput, idxExample]));
  if (idxOutput >= 0) ioParts.push(sliceSection(source, idxOutput, [idxExample]));
  const inputOutputFormat = ioParts.join("\n\n").trim();
  const examples = idxExample >= 0 ? source.slice(idxExample).trim() : "";

  return {
    title,
    description,
    constraints,
    inputOutputFormat,
    examples
  };
}

function parsePayload(raw: string): ParsedProblem {
  const text = extractLikelyJsonBlock(stripJsonFence(raw));
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiResponseError("Could not parse uploaded problem.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new GeminiResponseError("Invalid parsed problem payload.");
  }

  const obj = parsed as Record<string, unknown>;
  const extracted = {
    title: normalizeText(obj.title),
    description: normalizeText(obj.description),
    constraints: normalizeText(obj.constraints),
    inputOutputFormat: normalizeText(obj.inputOutputFormat),
    examples: normalizeText(obj.examples)
  };

  if (!hasUsefulParsedContent(extracted)) {
    throw new GeminiResponseError("Parsed output had no usable content.");
  }

  return extracted;
}

export async function parseProblemTextWithGemini(rawText: string): Promise<ParsedProblem> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiConfigError("Mentor service is not configured.");
  }

  const text = rawText.trim();
  if (!text) {
    throw new GeminiResponseError("Uploaded text is empty.");
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

  const prompt = `You are extracting competitive-programming problem fields from raw text.

Input text:
${text.slice(0, MAX_PROMPT_SOURCE_CHARS)}

Rules:
- Return valid JSON only.
- Keep wording from the source as much as possible.
- Fill missing fields with practical autogenerated content.

JSON shape:
{"title":"","description":"","constraints":"","inputOutputFormat":"","examples":""}

Important:
- The title field MUST always be a concise 2-6 word Title Case phrase (e.g. "Count Vowels", "Maximum Subarray Sum"). Never use a full sentence, never end it with punctuation, and never copy a prose instruction line as the title.
- If the source text has no explicit title, INVENT a meaningful 2-6 word title from the dominant nouns/verbs of the problem.
- If description is weak/missing, write a clear problem description from available context.
- If constraints/inputOutputFormat/examples are absent, generate practical defaults consistent with the problem.
- Never leave any field empty.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });

  if (!res.ok) {
    const fallback = parseProblemTextHeuristic(text);
    if (hasUsefulParsedContent(fallback)) return finalizeProblem(text, fallback);
    throw new GeminiResponseError(`Problem parse request failed (${res.status}).`);
  }

  const data: unknown = await res.json();
  const output =
    data &&
    typeof data === "object" &&
    "candidates" in data &&
    Array.isArray((data as { candidates?: unknown }).candidates) &&
    (data as { candidates: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates[0]?.content?.parts?.[0]?.text;

  if (typeof output !== "string" || !output.trim()) {
    const fallback = parseProblemTextHeuristic(text);
    if (hasUsefulParsedContent(fallback)) return finalizeProblem(text, fallback);
    throw new GeminiResponseError("Empty parse response.");
  }
  try {
    return finalizeProblem(text, parsePayload(output));
  } catch {
    const fallback = parseProblemTextHeuristic(text);
    if (hasUsefulParsedContent(fallback)) return finalizeProblem(text, fallback);
    throw new GeminiResponseError("Could not parse uploaded problem.");
  }
}
