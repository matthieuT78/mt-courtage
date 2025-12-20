// lib/supabaseClient.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

declare global {
  // eslint-disable-next-line no-var
  var __supabase: SupabaseClient | null | undefined;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Timeout fetch + logs réseau.
 * Important: on ne log pas les headers (apikey/authorization).
 */
function makeDebugFetch(timeoutMs = 15000): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as any)?.url || String(input);
    const method = (init?.method || "GET").toUpperCase();
    const t0 = performance.now();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(input, { ...init, signal: ctrl.signal });

      const dt = Math.round(performance.now() - t0);
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log(`[supabase:fetch] ${method} ${res.status} (${dt}ms) ${url}`);
      }

      // Si erreur HTTP, on essaie de lire le body pour aider
      if (!res.ok && isDev) {
        try {
          const clone = res.clone();
          const txt = await clone.text();
          // eslint-disable-next-line no-console
          console.warn(`[supabase:fetch] body (first 600 chars):`, txt.slice(0, 600));
        } catch {
          // ignore
        }
      }

      return res;
    } catch (e: any) {
      const dt = Math.round(performance.now() - t0);

      if (e?.name === "AbortError") {
        const err = new Error(`Timeout réseau (${timeoutMs}ms)`);
        if (isDev) {
          // eslint-disable-next-line no-console
          console.error(`[supabase:fetch] TIMEOUT ${method} (${dt}ms) ${url}`);
        }
        throw err;
      }

      if (isDev) {
        // eslint-disable-next-line no-console
        console.error(`[supabase:fetch] ERROR ${method} (${dt}ms) ${url}`, e);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };
}

function makeClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes. supabase = null");
    }
    return null;
  }

  const debugFetch = makeDebugFetch(15000);

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    // ✅ clé : on force supabase-js à utiliser notre fetch instrumenté
    global: {
      fetch: debugFetch,
    },
  });
}

export const supabase: SupabaseClient | null = globalThis.__supabase ?? makeClient();

if (isDev) {
  globalThis.__supabase = supabase;
}
