import type { NextApiRequest, NextApiResponse } from "next";
import { getCityPriceData } from "../../../lib/cityPriceData";
import { parseCitySlug } from "../../../lib/cityPriceSlug";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = req.query.slug as string | undefined;
  if (!slug) return res.status(400).json({ error: "slug requis" });

  const inseeCode = parseCitySlug(slug);
  if (!inseeCode) return res.status(400).json({ error: "slug invalide" });

  const city = await getCityPriceData(inseeCode);
  if (!city) return res.status(404).json({ error: "ville introuvable" });

  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return res.status(200).json({ city });
}
