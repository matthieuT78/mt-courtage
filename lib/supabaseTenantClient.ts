import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

declare global {
  // eslint-disable-next-line no-var
  var __supabaseTenant: SupabaseClient | null | undefined;
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
  });
}

// Clé de stockage distincte de celle du bailleur → sessions complètement isolées
export const supabaseTenant: SupabaseClient | null =
  globalThis.__supabaseTenant ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__supabaseTenant = supabaseTenant;
}
