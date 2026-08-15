// pages/api/cron/purge-candidature-drafts.ts
//
// Supprime automatiquement, avec leurs pièces jointes (bucket
// candidature-documents) :
//   - les brouillons de candidature abandonnés depuis plus de 30 jours ;
//   - les dossiers refusés ou en liste d'attente depuis plus de 60 jours,
//     même si le bailleur n'a jamais clôturé l'annonce correspondante.
//     close-listing.ts fait déjà ce ménage à la clôture d'une annonce, mais
//     rien n'oblige un bailleur à clôturer — ce cron est le filet de
//     sécurité basé sur le temps qui évite que des pièces d'identité, avis
//     d'imposition et bulletins de salaire de candidats déjà écartés
//     restent en stockage indéfiniment (RGPD, minimisation des données).
// Les candidatures toujours en attente ("submitted") ou retenues
// ("accepted"/"converted") ne sont jamais touchées.
// Déclenchement : quotidien via Vercel Cron ou appel manuel.

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { alertCronFailures } from "../../../lib/cronAlert";

const DRAFT_TTL_DAYS = 30;
const DECIDED_TTL_DAYS = 60;

async function purgeBatch(statuses: string[], cutoffIso: string): Promise<{ count: number; filesRemoved: number }> {
  const { data: expired, error: selectError } = await supabaseAdmin!
    .from("candidatures")
    .select("id, listing_id, rental_listings(user_id)")
    .in("status", statuses)
    .lt("updated_at", cutoffIso);

  if (selectError) throw new Error(selectError.message);

  let filesRemoved = 0;
  for (const row of expired || []) {
    const landlordUserId = (row as any).rental_listings?.user_id;
    if (!landlordUserId) continue;
    const folder = `${landlordUserId}/${row.listing_id}/${row.id}`;
    const { data: files } = await supabaseAdmin!.storage.from("candidature-documents").list(folder);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${folder}/${f.name}`);
      const { error: removeError } = await supabaseAdmin!.storage.from("candidature-documents").remove(paths);
      if (!removeError) filesRemoved += paths.length;
    }
  }

  const ids = (expired || []).map((row) => row.id);
  if (ids.length > 0) {
    const { error: deleteError } = await supabaseAdmin!.from("candidatures").delete().in("id", ids);
    if (deleteError) throw new Error(deleteError.message);
  }

  return { count: ids.length, filesRemoved };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!hasValidCronSecret(req)) {
    return res.status(401).json({ error: "Non autorisé." });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  try {
    const draftCutoff = new Date();
    draftCutoff.setDate(draftCutoff.getDate() - DRAFT_TTL_DAYS);
    const decidedCutoff = new Date();
    decidedCutoff.setDate(decidedCutoff.getDate() - DECIDED_TTL_DAYS);

    const drafts = await purgeBatch(["draft"], draftCutoff.toISOString());
    const decided = await purgeBatch(["rejected", "waitlist"], decidedCutoff.toISOString());

    const totalDeleted = drafts.count + decided.count;
    const totalFiles = drafts.filesRemoved + decided.filesRemoved;

    console.log(
      `[cron/purge-candidature-drafts] ${totalDeleted} candidature(s) supprimée(s) ` +
        `(${drafts.count} brouillon(s), ${decided.count} refusé(s)/liste d'attente), ${totalFiles} pièce(s) jointe(s) supprimée(s)`
    );

    return res.status(200).json({
      ok: true,
      deletedDrafts: drafts.count,
      deletedDecided: decided.count,
      filesRemoved: totalFiles,
    });
  } catch (e: any) {
    await alertCronFailures("purge-candidature-drafts", [{ error: e?.message || String(e) }]);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
