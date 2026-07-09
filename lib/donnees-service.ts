// lib/donnees-service.ts
// Lit les données immobilières depuis Supabase.
// Fallback sur les données hardcodées si Supabase est indisponible.

import { supabaseAdmin } from "./supabaseAdmin";
import { DONNEES_IMMO_FALLBACK } from "./donnees-reference";

export type DonneesImmo = typeof DONNEES_IMMO_FALLBACK;

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
