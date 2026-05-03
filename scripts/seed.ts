import { createClient } from "@supabase/supabase-js";


const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

type Topic = "Strings" | "Arrays" | "Loops" | "OOP" | "Data Structures" | "Recursion" | "Other";
type Mode = "SEED" | "FOCUS" | "SHADOW";

const TOPICS: Topic[] = ["Strings", "Arrays", "Loops", "OOP", "Data Structures", "Recursion", "Other"];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeAttempts(userId: string, count: number, accuracy: number) {
  return Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    problem_id: `problem_seed_${i + 1}`,
    topic: pick(TOPICS),
    is_correct: Math.random() < accuracy,
    attempts_count: Math.floor(Math.random() * 4) + 1,
    hints_used: Math.floor(Math.random() * 4),
    created_at: daysAgo(Math.floor(Math.random() * 28))
  }));
}

async function ensureUser(email: string, password: string, fullName: string): Promise<string | null> {
  const { data: listData } = await supabase.auth.admin.listUsers();
  const existing = listData?.users?.find((u) => u.email === email);
  if (existing) {
    console.log(`  User ${email} already exists (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

  if (error) {
    console.error(`  Failed to create ${email}:`, error.message);
    return null;
  }

  console.log(`  Created user ${email} (${data.user.id})`);
  return data.user.id;
}

async function upsertProfile(id: string, email: string, fullName: string, mode: Mode) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id,
      email,
      full_name: fullName,
      bio: `CS student passionate about algorithms and competitive programming.`,
      degree: "BS Computer Science",
      interests: ["Data Structures", "Algorithms", "Web Development"],
      default_mode: mode,
      default_hint_level: 3,
      code_preference: "No code unless requested"
    },
    { onConflict: "id" }
  );
  if (error) console.error(`  Profile upsert failed for ${email}:`, error.message);
  else console.log(`  Profile upserted for ${email}`);
}

async function ensureFriendship(userA: string, userB: string) {
  const { error } = await supabase.from("friendships").upsert(
    { user_id: userA, friend_id: userB, status: "accepted" },
    { onConflict: "user_id,friend_id", ignoreDuplicates: true }
  );
  if (error && !error.message.includes("duplicate")) {
    console.error("  Friendship upsert failed:", error.message);
  }
}

async function seedAttempts(userId: string, email: string, count: number, accuracy: number) {
  const { error: delErr } = await supabase.from("problem_attempts").delete().eq("user_id", userId);
  if (delErr) console.error("  Delete attempts error:", delErr.message);

  const attempts = makeAttempts(userId, count, accuracy);
  const { error } = await supabase.from("problem_attempts").insert(attempts);
  if (error) console.error(`  Attempts insert failed for ${email}:`, error.message);
  else console.log(`  Inserted ${count} problem attempts for ${email}`);
}

async function seedFeedEvents(userId: string, name: string) {
  const { error: delErr } = await supabase.from("feed_events").delete().eq("actor_id", userId);
  if (delErr) console.error("  Delete feed_events error:", delErr.message);

  const events = [
    {
      actor_id: userId,
      event_type: "daily_practice" as const,
      title: `${name} practiced today`,
      description: "Completed a coding session and made progress.",
      metadata: { problems: 3 },
      event_key: `${userId}_daily_${Date.now()}`,
      created_at: daysAgo(0)
    },
    {
      actor_id: userId,
      event_type: "streak_milestone" as const,
      title: `${name} hit a 7-day streak!`,
      description: "Seven consecutive days of problem solving.",
      metadata: { streak: 7 },
      event_key: `${userId}_streak_7_${Date.now()}`,
      created_at: daysAgo(1)
    },
    {
      actor_id: userId,
      event_type: "problems_solved_milestone" as const,
      title: `${name} solved 10 problems`,
      description: "Reached the 10 problems solved milestone.",
      metadata: { count: 10 },
      event_key: `${userId}_solved_10_${Date.now()}`,
      created_at: daysAgo(4)
    },
    {
      actor_id: userId,
      event_type: "accuracy_improved" as const,
      title: `${name}'s accuracy is improving`,
      description: "Correctness rate went above 70% this week.",
      metadata: { accuracy: 73 },
      event_key: `${userId}_accuracy_${Date.now()}`,
      created_at: daysAgo(7)
    }
  ];

  const { error } = await supabase.from("feed_events").insert(events);
  if (error) console.error(`  Feed events insert failed for ${name}:`, error.message);
  else console.log(`  Inserted ${events.length} feed events for ${name}`);
}

async function main() {
  console.log("=== CodeSage Database Seeder ===\n");

  // 1. Ensure all three users exist
  console.log("Step 1: Creating/verifying users...");
  const salmanId = await ensureUser("msalmansaleem08@gmail.com", "existing-user", "Salman Saleem");
  const abdullahId = await ensureUser("i220904@nu.edu.pk", "salman1234", "AbdullahSaghir");
  const salmanAliId = await ensureUser("salmanss4790489@gmail.com", "salman1234", "Salman Ali");

  if (!salmanId || !abdullahId || !salmanAliId) {
    console.error("\nFailed to resolve all users. Aborting.");
    process.exit(1);
  }

  // 2. Upsert profiles
  console.log("\nStep 2: Upserting profiles...");
  await upsertProfile(salmanId, "msalmansaleem08@gmail.com", "Salman Saleem", "FOCUS");
  await upsertProfile(abdullahId, "i220904@nu.edu.pk", "AbdullahSaghir", "SEED");
  await upsertProfile(salmanAliId, "salmanss4790489@gmail.com", "Salman Ali", "SHADOW");

  // 3. Friendships between all 3 (bidirectional)
  console.log("\nStep 3: Creating friendships...");
  await ensureFriendship(salmanId, abdullahId);
  await ensureFriendship(abdullahId, salmanId);
  await ensureFriendship(salmanId, salmanAliId);
  await ensureFriendship(salmanAliId, salmanId);
  await ensureFriendship(abdullahId, salmanAliId);
  await ensureFriendship(salmanAliId, abdullahId);
  console.log("  Friendships created");

  // 4. Problem attempts
  console.log("\nStep 4: Seeding problem attempts...");
  await seedAttempts(salmanId, "msalmansaleem08@gmail.com", 32, 0.78);
  await seedAttempts(abdullahId, "i220904@nu.edu.pk", 24, 0.71);
  await seedAttempts(salmanAliId, "salmanss4790489@gmail.com", 18, 0.65);

  // 5. Feed events
  console.log("\nStep 5: Seeding feed events...");
  await seedFeedEvents(salmanId, "Salman Saleem");
  await seedFeedEvents(abdullahId, "AbdullahSaghir");
  await seedFeedEvents(salmanAliId, "Salman Ali");

  console.log("\n=== Seeding complete ===");
}

main().catch(console.error);
