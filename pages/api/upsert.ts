import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const { userId, profile } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId requis" });

  // Upsert sur profiles
  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, ...(profile || {}), updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
