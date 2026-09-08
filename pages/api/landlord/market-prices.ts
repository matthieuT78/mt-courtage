// pages/api/landlord/market-prices.ts
// Historique du prix moyen au m² par commune (DVF) pour la section Performance —
// city_market_benchmarks_history est verrouillée en RLS (cf.
// 20260602194500_harden_public_table_rls.sql), donc le client bailleur ne peut pas
// la lire directement : ce endpoint lit avec la clé service role et ne renvoie
// qu'un historique agrégé par commune (donnée déjà publique sur /prix-m2, rien de
// spécifique à un utilisateur).
//
// Utilisé pour valoriser un bien par évolution : prix d'achat renseigné × (prix
// moyen commune aujourd'hui / prix moyen commune à l'achat) — plutôt qu'un prix
// moyen commune × surface, qui sous/sur-estime systématiquement les biens dont la
// taille ou le type s'écarte de la moyenne (un studio se vend toujours au-dessus
// du prix moyen communal, par exemple).
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
  if (codes.length === 0) return res.status(200).json({ history: {} });
  if (!supabaseAdmin) return res.status(200).json({ history: {} });

  const { data, error } = await supabaseAdmin
    .from("city_market_benchmarks_history")
    .select("insee_code, year, reference_price_m2_sale")
    .eq("property_type", "tous")
    .in("insee_code", codes)
    .order("year", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const history: Record<string, Array<{ year: number; priceM2: number }>> = {};
  for (const row of data || []) {
    if (row.reference_price_m2_sale == null) continue;
    const list = history[row.insee_code] || (history[row.insee_code] = []);
    list.push({ year: row.year, priceM2: row.reference_price_m2_sale });
  }

  res.setHeader("Cache-Control", "private, max-age=3600");
  return res.status(200).json({ history });
}
