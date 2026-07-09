// Cron hebdomadaire — tous les lundis à 6h
// Recalcule la table de capacité d'emprunt à partir du taux de crédit
// stocké dans donnees_reference (mis à jour manuellement chaque mois).
// Aucune dépendance sur les leads utilisateurs.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { DONNEES_IMMO_FALLBACK } from "../../../lib/donnees-reference";

const INCOME_BRACKETS = [2000, 3000, 4000, 5000, 6000, 8000, 10000];
const TAUX_ENDETTEMENT = 0.35;

function computeCapital(mensualite: number, dureeAns: number, tauxAnnuel: number, assurance: number): number {
  const tauxMensuel = (tauxAnnuel + assurance) / 100 / 12;
  const n = dureeAns * 12;
  if (tauxMensuel === 0) return Math.round(mensualite * n);
  return Math.round(mensualite * (1 - Math.pow(1 + tauxMensuel, -n)) / tauxMensuel / 1000) * 1000;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase indisponible" });

  // 1. Lire le taux de référence depuis Supabase (mis à jour manuellement)
  const { data: tauxRow } = await supabaseAdmin
    .from("donnees_reference")
    .select("data")
    .eq("key", "taux_credit_immobilier")
    .single();

  const tauxData = tauxRow?.data ?? DONNEES_IMMO_FALLBACK.taux_credit_immobilier;
  const taux20 = (tauxData.donnees as any[])?.find((d: any) => d.duree_ans === 20)?.taux_moyen
    ?? DONNEES_IMMO_FALLBACK.taux_credit_immobilier.donnees.find((d) => d.duree_ans === 20)!.taux_moyen;
  const taux25 = (tauxData.donnees as any[])?.find((d: any) => d.duree_ans === 25)?.taux_moyen
    ?? DONNEES_IMMO_FALLBACK.taux_credit_immobilier.donnees.find((d) => d.duree_ans === 25)!.taux_moyen;

  const ASSURANCE = 0.36;

  // 2. Calculer chaque tranche mathématiquement
  const donnees = INCOME_BRACKETS.map((revenus) => {
    const mensualite = Math.round(revenus * TAUX_ENDETTEMENT);
    return {
      revenus_nets_mensuels: revenus,
      mensualite_max: mensualite,
      capital_20_ans: computeCapital(mensualite, 20, taux20, ASSURANCE),
      capital_25_ans: computeCapital(mensualite, 25, taux25, ASSURANCE),
    };
  });

  const computedData = {
    description: `Capacité d'emprunt calculée à partir du taux de référence ${taux20}% sur 20 ans — recalculée chaque lundi`,
    unite: "€",
    hypotheses: {
      taux_credit_20_ans: taux20,
      taux_credit_25_ans: taux25,
      assurance: ASSURANCE,
      taux_endettement_cible: TAUX_ENDETTEMENT * 100,
    },
    donnees,
  };

  // 3. Upsert dans Supabase
  const { error } = await supabaseAdmin
    .from("donnees_reference")
    .upsert(
      { key: "capacite_emprunt_computed", data: computedData, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) {
    console.error("[refresh-donnees] upsert error:", error);
    return res.status(500).json({ error: error.message });
  }

  console.log(`[refresh-donnees] OK — taux 20 ans: ${taux20}%, ${donnees.length} tranches calculées`);
  return res.status(200).json({ ok: true, taux_20_ans: taux20, brackets: donnees });
}
