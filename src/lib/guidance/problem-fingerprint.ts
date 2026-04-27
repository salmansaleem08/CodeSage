import { createHash } from "crypto";

import { canonicalProblemJson, type ProblemPayload } from "@/lib/guidance/canonical-problem";

export type { ProblemPayload } from "@/lib/guidance/canonical-problem";

/** Stable hash for caching mentor plans per problem text (server-side). */
export function fingerprintProblem(payload: ProblemPayload): string {
  return createHash("sha256").update(canonicalProblemJson(payload)).digest("hex");
}

export function settingsKey(codeDisclosure: string, hintSpecificity: number): string {
  return `${codeDisclosure}:${hintSpecificity}:seed-v2`;
}
