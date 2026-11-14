import { supabaseAdmin } from "./supabaseAdmin";

// profiles.email peut être vide alors qu'auth.users.email est bien renseigné
// (ligne profiles créée/recréée hors du trigger normal de signup — cas
// confirmé le 2026-11-14 sur un compte réel, mécanisme exact non identifié).
// Sert de filet de sécurité pour ne pas exclure silencieusement ces comptes
// des sollicitations d'avis.
export async function resolveProfileEmail(profile: { id: string; email: string | null }): Promise<string | null> {
  if (profile.email) return profile.email;
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  return data?.user?.email || null;
}
