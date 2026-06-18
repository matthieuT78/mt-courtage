import { supabase } from "./supabaseClient";
import { supabaseTenant } from "./supabaseTenantClient";

/** Sign out of both landlord and tenant sessions. Never throws. */
export async function signOutAll(): Promise<void> {
  await Promise.allSettled([
    supabase?.auth.signOut(),
    supabaseTenant?.auth.signOut(),
  ]);
}
