import type { NextApiRequest, NextApiResponse } from "next";
import { searchCities } from "../../../lib/cityPriceData";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = (req.query.q as string) || "";
  if (q.trim().length < 2) return res.status(200).json({ results: [] });

  const results = await searchCities(q, 8);
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return res.status(200).json({ results });
}
