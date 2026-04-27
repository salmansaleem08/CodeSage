export type ProblemPayload = {
  title: string;
  description: string;
  constraints: string;
  inputOutputFormat: string;
  examples: string;
};

/** Must stay byte-identical between client (Web Crypto) and server (Node crypto). */
export function canonicalProblemJson(payload: ProblemPayload): string {
  return JSON.stringify({
    t: payload.title.trim(),
    d: payload.description.trim(),
    c: payload.constraints.trim(),
    io: payload.inputOutputFormat.trim(),
    ex: payload.examples.trim()
  });
}
