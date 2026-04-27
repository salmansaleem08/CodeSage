import { GeminiConfigError, GeminiResponseError } from "@/lib/gemini/generate-seed-steps";

export type ParsedProblem = {
  title: string;
  description: string;
  constraints: string;
  inputOutputFormat: string;
  examples: string;
};

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  return trimmed;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parsePayload(raw: string): ParsedProblem {
  const text = stripJsonFence(raw);
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

  return {
    title: normalizeText(obj.title),
    description: normalizeText(obj.description),
    constraints: normalizeText(obj.constraints),
    inputOutputFormat: normalizeText(obj.inputOutputFormat),
    examples: normalizeText(obj.examples)
  };
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
${text}

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
    throw new GeminiResponseError("Empty parse response.");
  }

  return parsePayload(output);
}
