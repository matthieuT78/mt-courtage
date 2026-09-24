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
// Une fois converties en locataire ("converted"), les candidatures ne sont
// jamais purgées ni scrubbées par le temps : rien ne bornait leur
// conservation, alors que convert-to-tenant.ts ne recopie dans la fiche
// locataire que nom/email/téléphone/garant — jamais les pièces jointes ni
// les données financières (revenu, employeur, date de naissance...). Passé
// CONVERTED_SCRUB_TTL_DAYS, on scrube donc ces candidatures : suppression
// des pièces jointes et des champs sensibles devenus inutiles, en gardant
// la ligne (utile au bailleur comme trace que cette candidature a abouti).
// Les candidatures toujours en attente ("submitted") ou retenues sans
// conversion ("accepted") ne sont jamais touchées.
// Déclenchement : quotidien via Vercel Cron ou appel manuel.

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { alertCronFailures } from "../../../lib/cronAlert";

const DRAFT_TTL_DAYS = 30;
const DECIDED_TTL_DAYS = 60;
const CONVERTED_SCRUB_TTL_DAYS = 90;

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

async function scrubConvertedBatch(cutoffIso: string): Promise<{ count: number; filesRemoved: number }> {
  const { data: expired, error: selectError } = await supabaseAdmin!
    .from("candidatures")
    .select("id, listing_id, rental_listings(user_id)")
    .eq("status", "converted")
    .lt("updated_at", cutoffIso)
    // Repère les lignes pas encore scrubbées (au moins un champ sensible
    // encore renseigné) : une fois scrubbée, updated_at repasse récent et
    // sort naturellement de la fenêtre du cutoff, ce qui rend ce cron
    // idempotent sans colonne dédiée.
    .or(
      [
        "docs_identity_path.not.is.null",
        "docs_tax_path.not.is.null",
        "docs_address_path.not.is.null",
        "docs_payslip_1_path.not.is.null",
        "docs_payslip_2_path.not.is.null",
        "docs_payslip_3_path.not.is.null",
        "guarantor_docs_identity_path.not.is.null",
        "guarantor_docs_payslip_1_path.not.is.null",
        "guarantor_docs_payslip_2_path.not.is.null",
        "guarantor_docs_payslip_3_path.not.is.null",
        "guarantor_docs_tax_path.not.is.null",
        "net_monthly_income.not.is.null",
        "extraction_raw.not.is.null",
      ].join(",")
    );

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
    const { error: updateError } = await supabaseAdmin!
      .from("candidatures")
      .update({
        // Pièces jointes : plus de fichiers, plus de chemins.
        docs_identity: false,
        docs_identity_path: null,
        docs_payslips: false,
        docs_payslip_1: false,
        docs_payslip_2: false,
        docs_payslip_3: false,
        docs_payslip_1_path: null,
        docs_payslip_2_path: null,
        docs_payslip_3_path: null,
        docs_tax: false,
        docs_tax_path: null,
        docs_address: false,
        docs_address_path: null,
        guarantor_docs_identity: false,
        guarantor_docs_identity_path: null,
        guarantor_docs_payslips: false,
        guarantor_docs_payslip_1: false,
        guarantor_docs_payslip_2: false,
        guarantor_docs_payslip_3: false,
        guarantor_docs_payslip_1_path: null,
        guarantor_docs_payslip_2_path: null,
        guarantor_docs_payslip_3_path: null,
        guarantor_docs_tax: false,
        guarantor_docs_tax_path: null,
        // Données financières/identité détaillées : plus utiles une fois le
        // locataire créé (convert-to-tenant.ts ne les recopie pas).
        extraction_raw: null,
        birth_date: null,
        net_monthly_income: null,
        employer_name: null,
        professional_situation: null,
        guarantor_income: null,
        guarantor_situation: null,
        visale_number: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);
    if (updateError) throw new Error(updateError.message);
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
    const convertedCutoff = new Date();
    convertedCutoff.setDate(convertedCutoff.getDate() - CONVERTED_SCRUB_TTL_DAYS);

    const drafts = await purgeBatch(["draft"], draftCutoff.toISOString());
    const decided = await purgeBatch(["rejected", "waitlist"], decidedCutoff.toISOString());
    const converted = await scrubConvertedBatch(convertedCutoff.toISOString());

    const totalDeleted = drafts.count + decided.count;
    const totalFiles = drafts.filesRemoved + decided.filesRemoved + converted.filesRemoved;

    console.log(
      `[cron/purge-candidature-drafts] ${totalDeleted} candidature(s) supprimée(s) ` +
        `(${drafts.count} brouillon(s), ${decided.count} refusé(s)/liste d'attente), ` +
        `${converted.count} candidature(s) convertie(s) scrubbée(s), ${totalFiles} pièce(s) jointe(s) supprimée(s)`
    );

    return res.status(200).json({
      ok: true,
      deletedDrafts: drafts.count,
      deletedDecided: decided.count,
      scrubbedConverted: converted.count,
      filesRemoved: totalFiles,
    });
  } catch (e: any) {
    await alertCronFailures("purge-candidature-drafts", [{ error: e?.message || String(e) }]);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
