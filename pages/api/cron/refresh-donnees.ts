// Cron hebdomadaire — tous les lundis à 6h
// Agrège les simulations réelles depuis la table leads
// et met à jour donnees_reference dans Supabase.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";

type Bracket = {
  revenus_nets_mensuels: number;
  mensualite_max: number;
  capital_20_ans: number;
  capital_25_ans: number;
  nb_simulations?: number;
};

const TAUX_REF = 3.5;
const ASSURANCE_REF = 0.36;

function computeCapital(mensualite: number, dureeAns: number, taux: number, assurance: number): number {
  const tauxMensuel = (taux + assurance) / 100 / 12;
  const n = dureeAns * 12;
  if (tauxMensuel === 0) return mensualite * n;
  return Math.round(mensualite * (1 - Math.pow(1 + tauxMensuel, -n)) / tauxMensuel);
}

const INCOME_BRACKETS = [
  { label: 2000, min: 1500, max: 2500 },
  { label: 3000, min: 2500, max: 3500 },
  { label: 4000, min: 3500, max: 4500 },
  { label: 5000, min: 4500, max: 5500 },
  { label: 6000, min: 5500, max: 7000 },
  { label: 8000, min: 7000, max: 9000 },
  { label: 10000, min: 9000, max: 999999 },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase indisponible" });

  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("payload")
    .eq("tool", "capacite")
    .not("payload->output->resume->montantMax", "is", null)
    .not("payload->input->revenusNetMensuels", "is", null)
    .gte("created_at", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()); // 6 derniers mois

  if (error) {
    console.error("[refresh-donnees] leads query error:", error);
    return res.status(500).json({ error: error.message });
  }

  const donnees: Bracket[] = [];
  let nbTotal = 0;

  for (const bracket of INCOME_BRACKETS) {
    const matching = (leads ?? []).filter((lead: any) => {
      const rev = Number(lead.payload?.input?.revenusNetMensuels ?? 0);
      return rev >= bracket.min && rev < bracket.max;
    });

    if (matching.length < 5) {
      // Pas assez de données — valeur théorique
      const mensualite = Math.round(bracket.label * 0.35);
      donnees.push({
        revenus_nets_mensuels: bracket.label,
        mensualite_max: mensualite,
        capital_20_ans: computeCapital(mensualite, 20, TAUX_REF, ASSURANCE_REF),
        capital_25_ans: computeCapital(mensualite, 25, TAUX_REF, ASSURANCE_REF),
      });
    } else {
      const capitals = matching
        .map((l: any) => Number(l.payload?.output?.resume?.montantMax ?? 0))
        .filter((v: number) => v > 10000)
        .sort((a: number, b: number) => a - b);

      const median = capitals[Math.floor(capitals.length / 2)];
      const mensualite = Math.round(bracket.label * 0.35);

      donnees.push({
        revenus_nets_mensuels: bracket.label,
        mensualite_max: mensualite,
        capital_20_ans: Math.round(median / 10000) * 10000,
        capital_25_ans: computeCapital(mensualite, 25, TAUX_REF, ASSURANCE_REF),
        nb_simulations: capitals.length,
      });

      nbTotal += capitals.length;
    }
  }

  const computedData = {
    description: "Capacité d'emprunt médiane par tranche de revenus — calculée à partir des simulations réelles lokt.fr (6 derniers mois)",
    unite: "€",
    hypotheses: { taux_credit_ref: TAUX_REF, assurance_ref: ASSURANCE_REF, taux_endettement_cible: 35 },
    nb_simulations: nbTotal,
    donnees,
  };

  const { error: upsertError } = await supabaseAdmin
    .from("donnees_reference")
    .upsert(
      { key: "capacite_emprunt_computed", data: computedData, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (upsertError) {
    console.error("[refresh-donnees] upsert error:", upsertError);
    return res.status(500).json({ error: upsertError.message });
  }

  console.log(`[refresh-donnees] OK — ${nbTotal} simulations agrégées`);
  return res.status(200).json({ ok: true, nb_simulations: nbTotal, brackets: donnees.length });
}
