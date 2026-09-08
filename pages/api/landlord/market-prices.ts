// pages/api/landlord/market-prices.ts
// Prix marché (DVF) par commune pour la section Performance — city_market_benchmarks
// est verrouillée en RLS (cf. 20260602194500_harden_public_table_rls.sql), donc le
// client bailleur ne peut pas la lire directement : ce endpoint lit avec la clé
// service role et ne renvoie qu'un prix/m² agrégé par commune (donnée déjà publique
// sur /prix-m2, rien de spécifique à un utilisateur).
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const raw = req.query.insee;
  const codes = Array.from(
    new Set(
      (Array.isArray(raw) ? raw.join(",") : raw || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    )
  );
  if (codes.length === 0) return res.status(200).json({ prices: {} });
  if (!supabaseAdmin) return res.status(200).json({ prices: {} });

  const { data, error } = await supabaseAdmin
    .from("city_market_benchmarks")
    .select("insee_code, reference_price_m2_sale")
    .in("insee_code", codes);
  if (error) return res.status(500).json({ error: error.message });

  const prices: Record<string, number> = {};
  for (const row of data || []) {
    if (row.reference_price_m2_sale != null) prices[row.insee_code] = row.reference_price_m2_sale;
  }

  res.setHeader("Cache-Control", "private, max-age=3600");
  return res.status(200).json({ prices });
}
