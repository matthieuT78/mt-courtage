import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const ALLOWED_STATUSES = ["accepted", "rejected", "waitlist", "submitted"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { candidature_id, status, landlord_note } = req.body || {};

  if (!candidature_id || !status) return res.status(400).json({ error: "candidature_id et status requis." });
  if (!ALLOWED_STATUSES.includes(status)) return res.status(400).json({ error: "Statut invalide." });

  // Vérifier que la candidature appartient à une annonce du bailleur
  const { data: candidature } = await supabaseAdmin
    .from("candidatures")
    .select("id, listing_id")
    .eq("id", candidature_id)
    .maybeSingle();

  if (!candidature) return res.status(404).json({ error: "Candidature introuvable." });

  const { data: listing } = await supabaseAdmin
    .from("rental_listings")
    .select("id")
    .eq("id", candidature.listing_id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!listing) return res.status(403).json({ error: "Accès refusé." });

  const update: Record<string, any> = { status, updated_at: new Date().toISOString() };
  if (landlord_note !== undefined) update.landlord_note = landlord_note;

  const { data, error } = await supabaseAdmin
    .from("candidatures")
    .update(update)
    .eq("id", candidature_id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ candidature: data });
}
