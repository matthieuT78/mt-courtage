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

// ⚙️ On lit les variables SERVER-SIDE (pas les NEXT_PUBLIC ici)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Petit garde-fou au chargement du module
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error(
    "[market-benchmarks] Variables d'environnement manquantes : " +
      "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

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

  if (!supabaseAdmin) {
    return res.status(500).json({
      error:
        "Supabase n'est pas correctement configuré côté serveur (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants).",
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
      console.error("[market-benchmarks] Supabase error:", error);

      // En dev, on renvoie un peu plus de détails pour t'aider
      if (process.env.NODE_ENV !== "production") {
        return res.status(500).json({
          error: "Erreur lors de la récupération des benchmarks.",
          supabaseMessage: error.message,
          supabaseDetails: (error as any).details ?? null,
          supabaseHint: (error as any).hint ?? null,
        });
      }

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
