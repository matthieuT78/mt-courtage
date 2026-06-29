import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { listing_id } = req.body || {};
  if (!listing_id) return res.status(400).json({ error: "listing_id requis." });

  // Vérifier que l'annonce appartient au bailleur
  const { data: listing } = await supabaseAdmin
    .from("rental_listings")
    .select("id, status")
    .eq("id", listing_id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!listing) return res.status(404).json({ error: "Annonce introuvable." });
  if (listing.status === "closed") return res.status(409).json({ error: "Annonce déjà clôturée." });

  // Compter les candidatures à supprimer
  const { count } = await supabaseAdmin
    .from("candidatures")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listing_id)
    .in("status", ["draft", "rejected", "waitlist"]);

  // Supprimer les données personnelles des candidats non retenus (RGPD)
  const { error: deleteError } = await supabaseAdmin
    .from("candidatures")
    .delete()
    .eq("listing_id", listing_id)
    .in("status", ["draft", "rejected", "waitlist"]);

  if (deleteError) return res.status(500).json({ error: deleteError.message });

  // Clôturer l'annonce
  const { error: closeError } = await supabaseAdmin
    .from("rental_listings")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", listing_id);

  if (closeError) return res.status(500).json({ error: closeError.message });

  return res.status(200).json({ ok: true, deleted_count: count ?? 0 });
}
