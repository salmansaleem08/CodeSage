function getRequiredPublicEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"): string {
  const value =
    name === "NEXT_PUBLIC_SUPABASE_URL"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const clientEnv = {
  supabaseUrl: getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
};
