import { canonicalProblemJson, type ProblemPayload } from "@/lib/guidance/canonical-problem";

export async function fingerprintProblemClient(payload: ProblemPayload): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalProblemJson(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
