// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = (() => {
  if (!url || !serviceKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[supabaseAdmin] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes.");
    }
    return null;
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
})();
