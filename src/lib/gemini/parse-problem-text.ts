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
- If a field is missing, return an empty string.
- Do not invent constraints or examples.

JSON shape:
{"title":"","description":"","constraints":"","inputOutputFormat":"","examples":""}`;

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
    if (hasUsefulParsedContent(fallback)) return fallback;
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
    if (hasUsefulParsedContent(fallback)) return fallback;
    throw new GeminiResponseError("Empty parse response.");
  }
  try {
    return parsePayload(output);
  } catch {
    const fallback = parseProblemTextHeuristic(text);
    if (hasUsefulParsedContent(fallback)) return fallback;
    throw new GeminiResponseError("Could not parse uploaded problem.");
  }
}
