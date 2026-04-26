function getRequiredServerEnv(name: "SUPABASE_SECRET_KEY" | "GEMINI_API_KEY"): string {
  const value = name === "SUPABASE_SECRET_KEY" ? process.env.SUPABASE_SECRET_KEY : process.env.GEMINI_API_KEY;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const serverEnv = {
  supabaseSecretKey: getRequiredServerEnv("SUPABASE_SECRET_KEY"),
  geminiApiKey: getRequiredServerEnv("GEMINI_API_KEY")
};
