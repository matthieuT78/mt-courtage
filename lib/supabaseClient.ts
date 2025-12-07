// lib/supabaseClient.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// On n’instancie Supabase que si les variables sont présentes
let supabase: SupabaseClient | null = null;

if (!url || !key) {
  // En build sur Vercel, si les variables ne sont pas là, on NE crée PAS le client
  console.warn(
    "⚠️ Supabase non configuré : NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquants."
  );
} else {
  supabase = createClient(url, key);
}

export { supabase };
