// pages/api/cron/anonymize-leads.ts
//
// Anonymise les leads anciens conformément au RGPD :
// - sans consentement contact  → 12 mois
// - avec consentement contact  → 36 mois
//
// Colonnes CONSERVÉES (données métier agrégées, non identifiantes) :
//   id, tool, created_at, status, consent_*, postal_code,
//   project_usage        ("résidence_principale" / "investissement" / …)
//   project_property_kind ("ancien" / "neuf" / "terrain")
//   project_timeline     ("maintenant" / "6-mois" / "1-an" / …)
//
// Colonnes EFFACÉES (PII ou quasi-identifiants) :
//   email, phone, payload (montants exacts revenus/charges/emprunt),
//   user_id, city, source, utm,
//   lead_age             (âge exact → risque combiné à code postal),
//   project_budget_target (montant exact calculé → risque croisé).
//
// Note : pour conserver des tranches de budget (< 150 k / 150-300 k / …)
// sans exposer de montant exact, ajouter une colonne `budget_bucket` text
// en base et la peupler avant anonymisation.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";

const ANON_FIELDS = {
  // PII directes
  email: null,
  phone: null,
  user_id: null,
  // Données financières détaillées (revenus, charges, montants exacts)
  payload: null,
  // Localisation fine (ville) — on garde postal_code qui reste dans la table
  city: null,
  // Tracking marketing (inutile sans email)
  source: null,
  utm: null,
  // Quasi-identifiants numériques
  lead_age: null,
  project_budget_target: null,
  // Marqueur d'anonymisation
  anonymized_at: new Date().toISOString(),
  // NE SONT PAS NULLÉS (données métier catégorielles, non identifiantes) :
  // project_usage, project_property_kind, project_timeline, postal_code
};

function cutoff(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!hasValidCronSecret(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });
  }

  const now = new Date().toISOString();
  const ANON = { ...ANON_FIELDS, anonymized_at: now };

  // 1. Sans consentement contact → 12 mois
  const { data: d1, error: e1 } = await supabaseAdmin
    .from("leads")
    .update(ANON)
    .eq("consent_contact", false)
    .lt("created_at", cutoff(12))
    .is("anonymized_at", null)
    .select("id");

  if (e1) {
    console.error("[anonymize-leads] no-consent batch:", e1);
    return res.status(500).json({ ok: false, error: e1.message });
  }

  // 2. Avec consentement contact → 36 mois
  const { data: d2, error: e2 } = await supabaseAdmin
    .from("leads")
    .update(ANON)
    .eq("consent_contact", true)
    .lt("created_at", cutoff(36))
    .is("anonymized_at", null)
    .select("id");

  if (e2) {
    console.error("[anonymize-leads] consent batch:", e2);
    return res.status(500).json({ ok: false, error: e2.message });
  }

  const count = (d1?.length ?? 0) + (d2?.length ?? 0);
  console.log(`[anonymize-leads] ${count} leads anonymisés (${d1?.length ?? 0} sans consent, ${d2?.length ?? 0} avec consent)`);

  return res.status(200).json({
    ok: true,
    anonymized: count,
    no_consent_batch: d1?.length ?? 0,
    consent_batch: d2?.length ?? 0,
  });
}
