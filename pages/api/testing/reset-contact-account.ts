// pages/api/testing/reset-contact-account.ts
//
// Outil de test personnel : réinitialise le compte contact@lokt.fr (compte de test
// utilisé pour rejouer l'assistant de mise en route) pour qu'il redevienne "neuf" :
//   1. Archive tous les logements actifs
//   2. Archive tous les locataires non archivés
//   3. Termine tous les baux non terminés
//   4. Efface les champs de profil qui déterminent "profil complet" (nom, adresse)
//   5. Efface le flag onboarding_wizard_done pour que l'assistant se relance
//
// Volontairement codé en dur sur contact@lokt.fr : aucun paramètre ne permet de cibler
// un autre compte, pour que ce lien (protégé par un seul token, pensé pour être cliqué
// depuis un email) ne puisse jamais toucher un compte réel.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const TARGET_EMAIL = "contact@lokt.fr";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const expected = process.env.TEST_ACCOUNT_RESET_TOKEN || "";
  const token = String((req.body && req.body.token) || req.query.token || "");
  if (!expected || token !== expected) {
    return res.status(403).json({ ok: false, error: "Token invalide." });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });
  }

  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return res.status(500).json({ ok: false, error: listError.message });
  const user = users.users.find((u: any) => (u.email || "").toLowerCase() === TARGET_EMAIL);
  if (!user) return res.status(404).json({ ok: false, error: `${TARGET_EMAIL} introuvable.` });
  const userId = user.id;

  const now = new Date().toISOString();

  const [propertiesResult, tenantsResult, leasesResult] = await Promise.all([
    supabaseAdmin.from("properties").update({ status: "archived" }).eq("user_id", userId).neq("status", "archived").select("id"),
    supabaseAdmin.from("tenants").update({ archived_at: now }).eq("user_id", userId).is("archived_at", null).select("id"),
    supabaseAdmin.from("leases").update({ status: "ended" }).eq("user_id", userId).neq("status", "ended").select("id"),
  ]);

  if (propertiesResult.error) return res.status(500).json({ ok: false, error: propertiesResult.error.message });
  if (tenantsResult.error) return res.status(500).json({ ok: false, error: tenantsResult.error.message });
  if (leasesResult.error) return res.status(500).json({ ok: false, error: leasesResult.error.message });

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      first_name: null,
      last_name: null,
      full_name: null,
      address_line1: null,
      address_line2: null,
      postal_code: null,
      city: null,
      updated_at: now,
    })
    .eq("id", userId);
  if (profileError) return res.status(500).json({ ok: false, error: profileError.message });

  const { error: settingsError } = await supabaseAdmin
    .from("app_settings")
    .delete()
    .eq("key", `onboarding_wizard_done:${userId}`);
  if (settingsError) return res.status(500).json({ ok: false, error: settingsError.message });

  console.log(
    `[testing/reset-contact-account] reset done: properties=${propertiesResult.data?.length ?? 0} tenants=${tenantsResult.data?.length ?? 0} leases=${leasesResult.data?.length ?? 0}`
  );

  return res.status(200).json({
    ok: true,
    propertiesArchived: propertiesResult.data?.length ?? 0,
    tenantsArchived: tenantsResult.data?.length ?? 0,
    leasesEnded: leasesResult.data?.length ?? 0,
  });
}
