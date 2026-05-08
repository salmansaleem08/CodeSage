// Editor / AI features are limited to a small allowlist while we manage
// API quota. The list can be extended at runtime via the
// `EDITOR_ALLOWED_EMAILS` env var (comma-separated). Defaults are kept
// here so the app works even when the env var is missing.

const DEFAULT_EDITOR_ALLOWED_EMAILS: ReadonlyArray<string> = [
  "msalmansaleem08@gmail.com",
  "i220904@nu.edu.pk",
  "salmanss4790489@gmail.com"
];

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function readEnvList(): string[] {
  const raw = process.env.EDITOR_ALLOWED_EMAILS ?? "";
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
}

export function getEditorAllowedEmails(): string[] {
  const set = new Set<string>([
    ...DEFAULT_EDITOR_ALLOWED_EMAILS.map((entry) => entry.toLowerCase()),
    ...readEnvList()
  ]);
  return Array.from(set);
}

export function isEditorAllowed(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getEditorAllowedEmails().includes(normalized);
}
