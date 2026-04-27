export function formatSeedHintComment(language: "cpp" | "python", frontierStep: number, body: string): string {
  const compact = body.replace(/\s+/g, " ").trim();
  const clipped = compact.length > 260 ? `${compact.slice(0, 257)}…` : compact;
  return language === "cpp" ? `// Step ${frontierStep}: ${clipped}` : `# Step ${frontierStep}: ${clipped}`;
}
