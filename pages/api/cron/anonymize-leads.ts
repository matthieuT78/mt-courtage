// pages/api/cron/anonymize-leads.ts
//
// Anonymise les leads anciens conformément au RGPD :
// - sans consentement contact  → 12 mois
// - avec consentement contact  → 36 mois
//
// Colonnes CONSERVÉES (données métier agrégées, non identifiantes) :
//   id, tool, created_at, status, consent_*, postal_code,
//   project_usage         ("résidence_principale" / "investissement" / …)
//   project_property_kind ("ancien" / "neuf" / "terrain")
//   project_timeline      ("maintenant" / "6-mois" / "1-an" / …)
//   budget_bucket         ("<150k" / "150-250k" / … — calculé avant anonymisation)
//
// Colonnes EFFACÉES (PII ou quasi-identifiants) :
//   email, phone, payload (revenus/charges/montants exacts),
//   user_id, city, source, utm,
//   lead_age              (âge exact → quasi-identifiant croisé au code postal),
//   project_budget_target (montant exact → remplacé par budget_bucket)
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";

function budgetBucket(amount: number | null): string | null {
  if (!amount || amount <= 0) return null;
  if (amount < 150_000) return "<150k";
  if (amount < 250_000) return "150-250k";
  if (amount < 400_000) return "250-400k";
  if (amount < 600_000) return "400-600k";
  return ">600k";
}

function cutoff(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

function buildAnonFields(row: { project_budget_target?: number | null }, now: string) {
  return {
    email: null,
    phone: null,
    user_id: null,
    payload: null,
    city: null,
    source: null,
    utm: null,
    lead_age: null,
    project_budget_target: null,
    budget_bucket: budgetBucket(row.project_budget_target ?? null),
    anonymized_at: now,
  };
}

async function anonymizeBatch(
  filter: Record<string, unknown>,
  now: string
): Promise<{ count: number; error: string | null }> {
  if (!supabaseAdmin) return { count: 0, error: "no supabase" };

  // Fetch rows to anonymize (need project_budget_target to compute bucket)
  let query = supabaseAdmin
    .from("leads")
    .select("id, project_budget_target")
    .is("anonymized_at", null);

  for (const [col, val] of Object.entries(filter)) {
    if (col === "created_at_lt") {
      query = query.lt("created_at", val as string);
    } else {
      query = (query as any).eq(col, val);
    }
  }

  const { data: rows, error: fetchError } = await query;
  if (fetchError) return { count: 0, error: fetchError.message };
  if (!rows || rows.length === 0) return { count: 0, error: null };

  // Group by budget_bucket to minimize round-trips
  const byBucket = new Map<string | null, string[]>();
  for (const row of rows) {
    const bucket = budgetBucket((row as any).project_budget_target ?? null);
    const key = bucket ?? "__null__";
    if (!byBucket.has(key)) byBucket.set(key, []);
    byBucket.get(key)!.push((row as any).id);
  }

  for (const [bucketKey, ids] of byBucket) {
    const bucket = bucketKey === "__null__" ? null : bucketKey;
    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update({ ...buildAnonFields({ project_budget_target: null }, now), budget_bucket: bucket })
      .in("id", ids);

    if (updateError) {
      console.error("[anonymize-leads] update error:", updateError);
      return { count: 0, error: updateError.message };
    }
  }

  return { count: rows.length, error: null };
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

  // 1. Sans consentement contact → 12 mois
  const r1 = await anonymizeBatch(
    { consent_contact: false, created_at_lt: cutoff(12) },
    now
  );
  if (r1.error) return res.status(500).json({ ok: false, error: r1.error });

  // 2. Avec consentement contact → 36 mois
  const r2 = await anonymizeBatch(
    { consent_contact: true, created_at_lt: cutoff(36) },
    now
  );
  if (r2.error) return res.status(500).json({ ok: false, error: r2.error });

  const count = r1.count + r2.count;
  console.log(`[anonymize-leads] ${count} leads anonymisés (${r1.count} sans consent, ${r2.count} avec consent)`);

  return res.status(200).json({
    ok: true,
    anonymized: count,
    no_consent_batch: r1.count,
    consent_batch: r2.count,
  });
}
