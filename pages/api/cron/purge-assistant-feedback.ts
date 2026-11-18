// pages/api/cron/purge-assistant-feedback.ts
//
// Supprime les votes 👍/👎 sur les réponses de Loky (question + réponse en
// clair, cf. pages/api/landlord/assistant/feedback.ts) au-delà de 90 jours.
// Audit RGPD du 2026-11-18 : cette table n'avait aucune limite de
// conservation (déjà noté dans l'audit de 2026-09, jamais traité) — le seul
// autre garde-fou est la cascade de suppression de compte
// (20261118100000_assistant_feedback_rgpd_cascade.sql), qui ne couvre pas un
// compte resté actif indéfiniment.
// Déclenchement : quotidien via Vercel Cron ou appel manuel.

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { alertCronFailures } from "../../../lib/cronAlert";

const FEEDBACK_TTL_DAYS = 90;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!hasValidCronSecret(req)) {
    return res.status(401).json({ error: "Non autorisé." });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - FEEDBACK_TTL_DAYS);

    const { data: deleted, error } = await supabaseAdmin
      .from("assistant_feedback")
      .delete()
      .lt("created_at", cutoff.toISOString())
      .select("id");
    if (error) throw new Error(error.message);

    const count = deleted?.length || 0;
    console.log(`[cron/purge-assistant-feedback] ${count} feedback(s) Loky supprimé(s) (> ${FEEDBACK_TTL_DAYS} jours)`);

    return res.status(200).json({ ok: true, deleted: count });
  } catch (e: any) {
    await alertCronFailures("purge-assistant-feedback", [{ error: e?.message || String(e) }]);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
