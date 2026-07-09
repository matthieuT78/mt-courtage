import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase indisponible" });

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("id, name, note, commentaire, created_at")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });

  const total = data?.length ?? 0;
  const average = total > 0
    ? Math.round((data.reduce((s, r) => s + r.note, 0) / total) * 10) / 10
    : null;

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  return res.status(200).json({ reviews: data ?? [], total, average });
}
