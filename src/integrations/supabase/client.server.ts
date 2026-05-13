import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.LAB_SUPABASE_URL!;
const serviceKey = process.env.LAB_SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.LAB_SUPABASE_ANON_KEY!;

if (!url || !serviceKey || !anonKey) {
  console.warn("[supabase] LAB_SUPABASE_* env vars are not all set");
}

/** Service-role client. Bypasses RLS. Server-only. */
export const supabaseAdmin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Build a per-request anon client that acts as the signed-in user. */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export const SUPABASE_PUBLIC_CONFIG = { url, anonKey };
