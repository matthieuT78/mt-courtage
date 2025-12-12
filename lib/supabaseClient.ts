// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

/**
 * IMPORTANT
 * - Ces variables DOIVENT être définies dans .env.local
 * - Elles sont publiques (NEXT_PUBLIC_*)
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase non configuré : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

/**
 * Client Supabase unique pour toute l'application
 * - persistSession : garde la session entre les pages
 * - autoRefreshToken : évite les déconnexions silencieuses
 * - detectSessionInUrl : nécessaire après login / magic link
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
