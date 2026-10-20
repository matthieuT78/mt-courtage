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

  // Jusqu'à 3 tentatives en lecture — cf. lib/supabaseClient.ts pour le détail
  // (taux de pics de latence Supabase monté à ~1 requête sur 2 le 2026-10-20).
  const MAX_GET_ATTEMPTS = 3;

  return async (input, init) => {
    const method = ((init as RequestInit | undefined)?.method || "GET").toUpperCase();
    const maxAttempts = method === "GET" ? MAX_GET_ATTEMPTS : 1;

    let lastError: any;
    for (let i = 0; i < maxAttempts; i++) {
      if (i > 0) await sleep(300);
      try {
        return await attempt(input, init);
      } catch (e: any) {
        lastError = e;
      }
    }
    throw lastError;
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
    global: { fetch: makeFetchWithTimeout(6000) },
  });
}

// Clé de stockage distincte de celle du bailleur → sessions complètement isolées
export const supabaseTenant: SupabaseClient | null =
  globalThis.__supabaseTenant ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__supabaseTenant = supabaseTenant;
}
