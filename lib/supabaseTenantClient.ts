import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

declare global {
  // eslint-disable-next-line no-var
  var __supabaseTenant: SupabaseClient | null | undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeFetchWithTimeout(timeoutMs = 15000): typeof fetch {
  const attempt: typeof fetch = (input, init) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  };

  return async (input, init) => {
    const method = ((init as RequestInit | undefined)?.method || "GET").toUpperCase();
    try {
      return await attempt(input, init);
    } catch (e: any) {
      // Un seul retry, uniquement pour les lectures (GET) — cf. lib/supabaseClient.ts
      // pour le détail (pics de latence transitoires côté Supabase).
      if (method !== "GET") throw e;
      await sleep(400);
      return attempt(input, init);
    }
  };
}

function makeClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "lokt-tenant-auth",
    },
    global: { fetch: makeFetchWithTimeout(15000) },
  });
}

// Clé de stockage distincte de celle du bailleur → sessions complètement isolées
export const supabaseTenant: SupabaseClient | null =
  globalThis.__supabaseTenant ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__supabaseTenant = supabaseTenant;
}
