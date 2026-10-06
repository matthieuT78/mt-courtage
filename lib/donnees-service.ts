// lib/donnees-service.ts
// Lit les données immobilières depuis Supabase.
// Fallback sur les données hardcodées si Supabase est indisponible.

import { supabaseAdmin } from "./supabaseAdmin";
import { DONNEES_IMMO_FALLBACK } from "./donnees-reference";

export type DonneesImmo = typeof DONNEES_IMMO_FALLBACK;

// Même formule que pages/api/cron/refresh-donnees.ts (annuité, assurance
// incluse dans le taux mensuel) — dupliquée ici volontairement pour éviter
// d'importer un handler d'API route depuis du code de page, mais les deux
// DOIVENT rester synchronisées si la méthodologie change.
function computeCapital(mensualite: number, dureeAns: number, tauxAnnuel: number, assurance: number): number {
  const tauxMensuel = (tauxAnnuel + assurance) / 100 / 12;
  const n = dureeAns * 12;
  if (tauxMensuel === 0) return Math.round(mensualite * n);
  return Math.round((mensualite * (1 - Math.pow(1 + tauxMensuel, -n)) / tauxMensuel) / 1000) * 1000;
}

const ASSURANCE_EMPRUNTEUR = 0.36;
const TAUX_ENDETTEMENT = 0.35;

export type CapaciteEmpruntPourSalaire = {
  mensualite: number;
  capital15: number;
  capital20: number;
  capital25: number;
  budget20: number;
  apport20: number;
  budget25: number;
  apport25: number;
  taux15: number;
  taux20: number;
  taux25: number;
  // Capital empruntable (20 ans) après déduction d'un crédit en cours de X €/mois
  capitalApresCredit20: (creditMensuel: number) => number;
};

// Calcule la capacité d'emprunt pour un salaire arbitraire (pas forcément
// une des tranches pré-calculées par refresh-donnees.ts), avec les mêmes
// taux live — utilisé pour injecter des chiffres à jour dans les pages de
// blog combien-emprunter-* au lieu de les figer en dur dans le markdown.
export function computeCapaciteEmpruntPourSalaire(
  salaire: number,
  taux: DonneesImmo["taux_credit_immobilier"]
): CapaciteEmpruntPourSalaire {
  const byDuree = new Map((taux.donnees as any[]).map((d: any) => [d.duree_ans, d.taux_moyen]));
  const taux15 = byDuree.get(15) ?? 3.2;
  const taux20 = byDuree.get(20) ?? 3.4;
  const taux25 = byDuree.get(25) ?? 3.6;

  const mensualite = Math.round(salaire * TAUX_ENDETTEMENT);
  const capital15 = computeCapital(mensualite, 15, taux15, ASSURANCE_EMPRUNTEUR);
  const capital20 = computeCapital(mensualite, 20, taux20, ASSURANCE_EMPRUNTEUR);
  const capital25 = computeCapital(mensualite, 25, taux25, ASSURANCE_EMPRUNTEUR);
  const budget20 = Math.round(capital20 / 0.9 / 1000) * 1000;
  const apport20 = Math.round((budget20 * 0.1) / 1000) * 1000;
  const budget25 = Math.round(capital25 / 0.9 / 1000) * 1000;
  const apport25 = Math.round((budget25 * 0.1) / 1000) * 1000;

  return {
    mensualite,
    capital15,
    capital20,
    capital25,
    budget20,
    apport20,
    budget25,
    apport25,
    taux15,
    taux20,
    taux25,
    capitalApresCredit20: (creditMensuel: number) => {
      const dispo = mensualite - creditMensuel;
      if (dispo <= 0) return 0;
      return computeCapital(dispo, 20, taux20, ASSURANCE_EMPRUNTEUR);
    },
  };
}

export async function getDonneesImmo(): Promise<DonneesImmo> {
  if (!supabaseAdmin) return DONNEES_IMMO_FALLBACK;

  const { data, error } = await supabaseAdmin
    .from("donnees_reference")
    .select("key, data, updated_at");

  if (error || !data || data.length === 0) return DONNEES_IMMO_FALLBACK;

  const db: Record<string, unknown> = {};
  for (const row of data) {
    db[row.key] = { ...row.data, _updated_at: row.updated_at };
  }

  return {
    meta: {
      ...(DONNEES_IMMO_FALLBACK.meta),
      periode: db.meta ? (db.meta as any).periode : DONNEES_IMMO_FALLBACK.meta.periode,
      nb_simulations_capacite: (db.capacite_emprunt_computed as any)?.nb_simulations ?? null,
      derniere_mise_a_jour: (db.capacite_emprunt_computed as any)?._updated_at ?? null,
    },
    taux_credit_immobilier: (db.taux_credit_immobilier as any) ?? DONNEES_IMMO_FALLBACK.taux_credit_immobilier,
    taux_endettement: (db.taux_endettement as any) ?? DONNEES_IMMO_FALLBACK.taux_endettement,
    capacite_emprunt_reference: (db.capacite_emprunt_computed as any) ?? DONNEES_IMMO_FALLBACK.capacite_emprunt_reference,
    loyers_medians_par_ville: (db.loyers_medians_par_ville as any) ?? DONNEES_IMMO_FALLBACK.loyers_medians_par_ville,
    rendements_locatifs_par_type: (db.rendements_locatifs_par_type as any) ?? DONNEES_IMMO_FALLBACK.rendements_locatifs_par_type,
    rendements_par_ville: (db.rendements_par_ville as any) ?? DONNEES_IMMO_FALLBACK.rendements_par_ville,
  };
}
