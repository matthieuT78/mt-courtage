// pages/api/cron/purge-candidature-drafts.ts
//
// Supprime les brouillons de candidature abandonnés depuis plus de 30 jours.
// Les candidatures soumises (submitted/accepted/rejected/waitlist) ne sont pas touchées.
// Déclenchement : quotidien via Vercel Cron ou appel manuel.

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const DRAFT_TTL_DAYS = 30;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-cron-secret"] ?? req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Non autorisé." });
  }

  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DRAFT_TTL_DAYS);

  const { count, error } = await supabaseAdmin
    .from("candidatures")
    .delete({ count: "exact" })
    .eq("status", "draft")
    .lt("updated_at", cutoff.toISOString());

  if (error) return res.status(500).json({ error: error.message });

  console.log(`[cron/purge-candidature-drafts] ${count ?? 0} brouillon(s) supprimé(s)`);
  return res.status(200).json({ ok: true, deleted: count ?? 0 });
}
