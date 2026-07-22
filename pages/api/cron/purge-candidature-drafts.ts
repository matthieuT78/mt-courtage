// pages/api/cron/purge-candidature-drafts.ts
//
// Supprime les brouillons de candidature abandonnés depuis plus de 30 jours,
// ainsi que les pièces jointes correspondantes dans le bucket
// candidature-documents (sinon les fichiers restent orphelins en stockage
// après la suppression de la ligne en base).
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

  const { data: expired, error: selectError } = await supabaseAdmin
    .from("candidatures")
    .select("id, listing_id, rental_listings(user_id)")
    .eq("status", "draft")
    .lt("updated_at", cutoff.toISOString());

  if (selectError) return res.status(500).json({ error: selectError.message });

  let filesRemoved = 0;
  for (const row of expired || []) {
    const landlordUserId = (row as any).rental_listings?.user_id;
    if (!landlordUserId) continue;
    const folder = `${landlordUserId}/${row.listing_id}/${row.id}`;
    const { data: files } = await supabaseAdmin.storage.from("candidature-documents").list(folder);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${folder}/${f.name}`);
      const { error: removeError } = await supabaseAdmin.storage.from("candidature-documents").remove(paths);
      if (!removeError) filesRemoved += paths.length;
    }
  }

  const ids = (expired || []).map((row) => row.id);
  const count = ids.length;
  if (ids.length > 0) {
    const { error: deleteError } = await supabaseAdmin.from("candidatures").delete().in("id", ids);
    if (deleteError) return res.status(500).json({ error: deleteError.message });
  }

  console.log(`[cron/purge-candidature-drafts] ${count} brouillon(s) supprimé(s), ${filesRemoved} pièce(s) jointe(s) supprimée(s)`);
  return res.status(200).json({ ok: true, deleted: count, filesRemoved });
}
