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
    // Next.js patche fetch() et met en cache les réponses qui portent des
    // en-têtes Cache-Control (ex: Supabase Storage), même côté serveur.
    // Sans ça, un download() répété sur le même chemin peut renvoyer un
    // contenu périmé pendant toute la durée de vie de l'instance serveur.
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }) },
  });
})();
