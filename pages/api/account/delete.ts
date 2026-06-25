// pages/api/account/delete.ts
//
// Suppression complète du compte utilisateur (RGPD art. 17 — droit à l'effacement).
// - Anonymise les leads liés (conserve les stats, efface l'email)
// - Supprime le profil
// - Supprime l'utilisateur auth (cascade côté Supabase)
// Les données de facturation (subscriptions) sont conservées pour obligations légales.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser } from "../../../lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE" && req.method !== "POST") {
    res.setHeader("Allow", "DELETE, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });
  }

  const auth = await requireApiUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ ok: false, error: auth.error });
  }

  const userId = auth.userId;
  const now = new Date().toISOString();

  // 1. Anonymiser les leads liés à cet utilisateur
  await supabaseAdmin
    .from("leads")
    .update({
      email: null,
      phone: null,
      payload: null,
      user_id: null,
      city: null,
      source: null,
      utm: null,
      project_property_kind: null,
      project_usage: null,
      project_timeline: null,
      project_budget_target: null,
      lead_age: null,
      anonymized_at: now,
    })
    .eq("user_id", userId)
    .is("anonymized_at", null);

  // 2. Supprimer le profil (les biens, baux, locataires, etc. sont liés au profil
  //    via FK — la suppression en cascade dépend des règles Supabase configurées)
  await supabaseAdmin.from("profiles").delete().eq("id", userId);

  // 3. Supprimer l'utilisateur auth Supabase (désactive la session + supprime auth.users)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error("[account/delete] deleteUser error:", deleteError);
    return res.status(500).json({ ok: false, error: "Erreur lors de la suppression du compte." });
  }

  console.log(`[account/delete] compte supprimé userId=${userId}`);
  return res.status(200).json({ ok: true });
}
