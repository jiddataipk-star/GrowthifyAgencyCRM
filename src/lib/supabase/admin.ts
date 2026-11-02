import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client. BYPASSES Row Level Security — use only on the server for:
 *   - owner bootstrap at first sign-in,
 *   - reading/writing encrypted social tokens,
 *   - the daily social-stats cron.
 * Always authorise the caller before using it.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.supabaseUrl(), serverEnv.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
