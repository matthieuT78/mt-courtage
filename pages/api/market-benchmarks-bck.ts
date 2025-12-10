import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type MarketBenchmarks = {
  inseeCode: string;
  cityName: string;
  postalCode: string;
  referencePriceM2Sale: number | null;
  referenceRentM2: number | null;
  source: string;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ service role, BACK uniquement
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const inseeCode = req.query.inseeCode as string | undefined;
  const postalCode = req.query.postalCode as string | undefined;
  const cityName = req.query.cityName as string | undefined;
  const surface = parseFloat((req.query.surface as string) || "0");

  if (!inseeCode && !postalCode) {
    return res.status(400).json({
      error: "Paramètres manquants : inseeCode ou postalCode requis.",
    });
  }

  try {
    // 1) Construire la requête Supabase
    let query = supabaseAdmin
      .from("city_market_benchmarks")
      .select("*")
      .limit(1);

    if (inseeCode) {
      query = query.eq("insee_code", inseeCode);
    } else if (postalCode) {
      query = query.eq("postal_code", postalCode);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return res
        .status(500)
        .json({ error: "Erreur lors de la récupération des benchmarks." });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        error:
          "Aucune donnée marché trouvée pour cette zone (vérifiez votre table city_market_benchmarks).",
      });
    }

    const row = data[0];

    const result: MarketBenchmarks = {
      inseeCode: row.insee_code,
      cityName: row.city_name || cityName || "Ville inconnue",
      postalCode: row.postal_code,
      referencePriceM2Sale: row.reference_price_m2_sale,
      referenceRentM2: row.reference_rent_m2,
      source: row.source || "DVF / loyers (agrégation interne)",
    };

    // Ajustement facultatif selon la surface (comme dans ton mock)
    if (surface && surface > 0 && result.referencePriceM2Sale) {
      if (surface < 30) {
        result.referencePriceM2Sale *= 1.08;
      }
    }

    return res.status(200).json(result);
  } catch (e) {
    console.error("Erreur /api/market-benchmarks", e);
    return res
      .status(500)
      .json({ error: "Erreur serveur benchmarks marché (runtime)" });
  }
}
