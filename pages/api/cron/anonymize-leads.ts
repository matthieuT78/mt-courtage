// pages/api/cron/anonymize-leads.ts
//
// Anonymise les leads anciens conformément au RGPD :
// - sans consentement contact  → 12 mois
// - avec consentement contact  → 36 mois
//
// Les colonnes conservées (stats) : id, tool, created_at, status,
// consent_analysis, consent_contact, postal_code, anonymized_at.
// Les colonnes effacées (PII) : email, phone, payload, user_id, city,
// source, utm, project_*.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";

const ANON_FIELDS = {
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
  anonymized_at: new Date().toISOString(),
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
