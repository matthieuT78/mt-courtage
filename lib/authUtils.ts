import { supabase } from "./supabaseClient";
import { supabaseTenant } from "./supabaseTenantClient";

/** Sign out of both landlord and tenant sessions. Never throws. */
export async function signOutAll(): Promise<void> {
  // scope:'local' clear la session sans appel serveur — fiable même si le token est expiré
  await Promise.allSettled([
    supabase?.auth.signOut({ scope: "local" }),
    supabaseTenant?.auth.signOut({ scope: "local" }),
  ]);
  // Purge de secours : supprime toutes les clés Supabase du localStorage
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") || k === "lokt-tenant-auth") localStorage.removeItem(k);
    });
  } catch {}
}
