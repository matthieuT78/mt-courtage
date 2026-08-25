import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// Route publique — pas d'auth requise, accès via token uniquement
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const { token } = req.query;
  if (!token || typeof token !== "string") return res.status(400).json({ error: "Token manquant." });

  const { data, error } = await supabaseAdmin
    .from("rental_listings")
    .select("id, token, title, address, rent_amount, charges_amount, property_type, surface_m2, available_at, income_ratio, status, lot_label")
    .eq("token", token)
    .eq("status", "active")
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Annonce introuvable ou fermée." });

  return res.status(200).json({ listing: data });
}
