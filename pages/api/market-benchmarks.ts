import type { NextApiRequest, NextApiResponse } from "next";

type MarketBenchmarks = {
  inseeCode: string;
  cityName: string;
  postalCode: string;
  referencePriceM2Sale: number | null;
  referenceRentM2: number | null;
  source: string;
};

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
    // ⚠️ ICI c'est du MOCK ⚠️
    // Tu remplaces plus tard par un vrai appel à tes données DVF / open data.
    const mock: MarketBenchmarks = {
      inseeCode: inseeCode || "00000",
      cityName: cityName || "Ville inconnue",
      postalCode: postalCode || "00000",
      referencePriceM2Sale: 3500, // €/m², EXEMPLE
      referenceRentM2: 18,        // €/m², EXEMPLE
      source: "Mock (à remplacer par vraie source DVF/OpenData)",
    };

    // Petit exemple d’ajustement selon la surface (optionnel)
    if (surface && surface > 0) {
      if (surface < 30 && mock.referencePriceM2Sale) {
        mock.referencePriceM2Sale *= 1.08;
      }
    }

    res.status(200).json(mock);
  } catch (e) {
    console.error("Erreur /api/market-benchmarks", e);
    res.status(500).json({ error: "Erreur serveur benchmarks marché" });
  }
}
