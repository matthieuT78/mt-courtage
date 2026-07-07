import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const COOKIE_NAME = "lokt_agence";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token manquant" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Configuration serveur manquante" });
  }

  const { data, error } = await supabaseAdmin
    .from("agence_tokens")
    .select("id, name, active")
    .eq("token", token)
    .single();

  if (error || !data || !data.active) {
    return res.status(403).json({ error: "Token invalide ou inactif" });
  }

  // Mise à jour du last_used_at
  await supabaseAdmin
    .from("agence_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token);

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=1; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`
  );

  return res.status(200).json({ ok: true, name: data.name });
}
