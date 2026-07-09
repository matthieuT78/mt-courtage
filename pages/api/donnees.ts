import type { NextApiRequest, NextApiResponse } from "next";
import { getDonneesImmo, type DonneesImmo } from "../../lib/donnees-service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const donnees = await getDonneesImmo();

  const { section } = req.query;
  if (section && typeof section === "string") {
    const key = section as keyof DonneesImmo;
    if (donnees[key]) return res.status(200).json(donnees[key]);
    return res.status(404).json({
      error: `Section '${section}' introuvable.`,
      sections_disponibles: Object.keys(donnees),
    });
  }

  return res.status(200).json(donnees);
}
