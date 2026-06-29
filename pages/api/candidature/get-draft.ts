import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const { token } = req.query;
  if (!token || typeof token !== "string") return res.status(400).json({ error: "token requis." });

  const { data, error } = await supabaseAdmin
    .from("candidatures")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Brouillon introuvable." });

  return res.status(200).json({ candidature: data });
}
