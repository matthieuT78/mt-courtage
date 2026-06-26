import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const tool = (req.query.tool as string) || "";

  try {
    let query = supabaseAdmin.from("leads").select("*", { count: "exact", head: true });
    if (tool) query = query.eq("tool", tool);

    const { count, error } = await query;
    if (error) throw error;

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ count: count ?? 0 });
  } catch {
    return res.status(200).json({ count: 0 });
  }
}
