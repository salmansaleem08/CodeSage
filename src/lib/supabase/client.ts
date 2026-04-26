import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/config/env-client";
import type { Database } from "@/lib/supabase/types";

export function createClient() {
  return createBrowserClient<Database>(clientEnv.supabaseUrl, clientEnv.supabasePublishableKey);
}
