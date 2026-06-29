import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { listing_id } = req.query;

  // Récupère toutes les annonces + candidatures du bailleur
  const listingsQuery = supabaseAdmin
    .from("rental_listings")
    .select("*, candidatures(*)")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (listing_id) {
    listingsQuery.eq("id", String(listing_id));
  }

  const { data, error } = await listingsQuery;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ listings: data });
}
