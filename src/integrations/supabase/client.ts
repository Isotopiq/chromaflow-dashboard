import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _initPromise: Promise<SupabaseClient> | null = null;

async function fetchConfig() {
  const res = await fetch("/api/public/config");
  if (!res.ok) throw new Error("Failed to load Supabase config");
  return (await res.json()) as { supabaseUrl: string; supabaseAnonKey: string };
}

/**
 * Lazily-initialised browser Supabase client.
 * Configuration is fetched once from /api/public/config so the URL and anon
 * key never need to be hard-coded into the bundle.
 */
export async function getSupabase(): Promise<SupabaseClient> {
  if (_client) return _client;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const cfg = await fetchConfig();
    _client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "chroma.lab.auth",
      },
    });
    return _client;
  })();
  return _initPromise;
}

/** Read the current access token (for attaching to server-fn requests). */
export async function getAccessToken(): Promise<string | null> {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
