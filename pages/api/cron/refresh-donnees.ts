// Cron hebdomadaire — tous les lundis à 6h
//
// Pipeline automatique :
// 1. Récupère les taux immobiliers français depuis l'API BCE (gratuite, sans auth)
// 2. Met à jour taux_credit_immobilier dans Supabase
// 3. Recalcule la table de capacité d'emprunt par la formule d'annuité
//
// Source BCE : MIR/M.FR.B.A2A.HH.R.A.2250.EUR.N
// = taux des nouveaux crédits immobiliers aux ménages en France, données mensuelles

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { DONNEES_IMMO_FALLBACK } from "../../../lib/donnees-reference";

const INCOME_BRACKETS = [2000, 3000, 4000, 5000, 6000, 8000, 10000];
const TAUX_ENDETTEMENT = 0.35;
const ASSURANCE = 0.36;

// Spreads constatés entre durées (Observatoire Crédit Logement/CSA)
const SPREAD_15 = -0.20;
const SPREAD_25 = +0.20;

function computeCapital(mensualite: number, dureeAns: number, tauxAnnuel: number, assurance: number): number {
  const tauxMensuel = (tauxAnnuel + assurance) / 100 / 12;
  const n = dureeAns * 12;
  if (tauxMensuel === 0) return Math.round(mensualite * n);
  return Math.round(mensualite * (1 - Math.pow(1 + tauxMensuel, -n)) / tauxMensuel / 1000) * 1000;
}

async function fetchTauxBCE(): Promise<number | null> {
  try {
    // Série BCE : taux nouveaux crédits immobiliers ménages France
    const url =
      "https://data-api.ecb.europa.eu/service/data/MIR/M.FR.B.A2A.HH.R.A.2250.EUR.N" +
      "?format=jsondata&lastNObservations=3&detail=dataonly";

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const json = await res.json();
    // Structure ECB : dataSets[0].series["0:0:0:0:0:0:0:0:0:0:0:0:0"].observations
    const series = json?.dataSets?.[0]?.series;
    if (!series) return null;

    const seriesKey = Object.keys(series)[0];
    const observations = series[seriesKey]?.observations;
    if (!observations) return null;

    // Prendre l'observation la plus récente
    const keys = Object.keys(observations).map(Number).sort((a, b) => b - a);
    const latest = observations[String(keys[0])];
    const value = latest?.[0];

    if (typeof value !== "number" || value <= 0 || value > 10) return null;

    // Arrondir à 2 décimales
    return Math.round(value * 100) / 100;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase indisponible" });

  // ── 1. Récupérer le taux BCE ────────────────────────────────────────────
  const tauxBCE = await fetchTauxBCE();
  let taux20: number;
  let source: string;

  if (tauxBCE !== null) {
    taux20 = tauxBCE;
    source = "BCE (MIR/M.FR.B.A2A.HH.R.A.2250.EUR.N)";
    console.log(`[refresh-donnees] Taux BCE récupéré : ${taux20}%`);
  } else {
    // Fallback : lire le taux déjà en base
    const { data: tauxRow } = await supabaseAdmin
      .from("donnees_reference")
      .select("data")
      .eq("key", "taux_credit_immobilier")
      .single();

    const existingTaux = (tauxRow?.data?.donnees as any[])?.find((d: any) => d.duree_ans === 20)?.taux_moyen;
    taux20 = existingTaux ?? DONNEES_IMMO_FALLBACK.taux_credit_immobilier.donnees.find((d) => d.duree_ans === 20)!.taux_moyen;
    source = "Supabase (fallback — BCE indisponible)";
    console.warn(`[refresh-donnees] BCE indisponible, fallback Supabase : ${taux20}%`);
  }

  const taux15 = Math.round((taux20 + SPREAD_15) * 100) / 100;
  const taux25 = Math.round((taux20 + SPREAD_25) * 100) / 100;

  // ── 2. Mettre à jour les taux dans Supabase ────────────────────────────
  const now = new Date().toISOString();
  const periode = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  if (tauxBCE !== null) {
    await supabaseAdmin.from("donnees_reference").upsert(
      {
        key: "taux_credit_immobilier",
        data: {
          description: `Taux moyens constatés en France, hors assurance emprunteur (${periode})`,
          unite: "% annuel",
          source,
          periode,
          donnees: [
            { duree_ans: 15, taux_moyen: taux15, taux_bas: Math.round((taux15 - 0.30) * 100) / 100, taux_haut: Math.round((taux15 + 0.35) * 100) / 100 },
            { duree_ans: 20, taux_moyen: taux20, taux_bas: Math.round((taux20 - 0.30) * 100) / 100, taux_haut: Math.round((taux20 + 0.35) * 100) / 100 },
            { duree_ans: 25, taux_moyen: taux25, taux_bas: Math.round((taux25 - 0.35) * 100) / 100, taux_haut: Math.round((taux25 + 0.35) * 100) / 100 },
          ],
        },
        updated_at: now,
      },
      { onConflict: "key" }
    );
  }

  // ── 3. Recalculer la capacité d'emprunt ───────────────────────────────
  const donnees = INCOME_BRACKETS.map((revenus) => {
    const mensualite = Math.round(revenus * TAUX_ENDETTEMENT);
    return {
      revenus_nets_mensuels: revenus,
      mensualite_max: mensualite,
      capital_20_ans: computeCapital(mensualite, 20, taux20, ASSURANCE),
      capital_25_ans: computeCapital(mensualite, 25, taux25, ASSURANCE),
    };
  });

  await supabaseAdmin.from("donnees_reference").upsert(
    {
      key: "capacite_emprunt_computed",
      data: {
        description: `Capacité d'emprunt calculée à partir du taux ${taux20}% sur 20 ans (${periode}) — recalculée chaque lundi`,
        unite: "€",
        hypotheses: { taux_credit_20_ans: taux20, taux_credit_25_ans: taux25, assurance: ASSURANCE, taux_endettement_cible: 35 },
        donnees,
      },
      updated_at: now,
    },
    { onConflict: "key" }
  );

  console.log(`[refresh-donnees] OK — taux 20 ans: ${taux20}% (${source}), ${donnees.length} tranches`);
  return res.status(200).json({ ok: true, taux_20_ans: taux20, taux_15_ans: taux15, taux_25_ans: taux25, source, brackets: donnees });
}
