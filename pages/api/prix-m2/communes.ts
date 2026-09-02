import type { NextApiRequest, NextApiResponse } from "next";
import { getAreaCommunes } from "../../../lib/cityPriceData";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const type = req.query.type as string;
  const code = req.query.code as string;
  if ((type !== "departement" && type !== "region") || !code) {
    return res.status(400).json({ error: "type et code requis" });
  }

  const cities = await getAreaCommunes(type, code);
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return res.status(200).json({ cities });
}
