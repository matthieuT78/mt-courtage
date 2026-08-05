import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../../lib/apiAuth";

// Résumé léger de toutes les réservations de visite du bailleur, tous biens
// confondus — utilisé pour croiser "qui a réservé une visite" avec la liste
// des candidatures (jointure par email + listing_id).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { userId } = req.query as { userId?: string };
  if (!userId) return res.status(400).json({ error: "userId requis." });
  const match = requireMatchingUser(auth, userId);
  if (!match.ok) return res.status(match.status).json({ error: match.error });

  const { data, error } = await supabaseAdmin
    .from("candidature_visit_bookings")
    .select("email,slot:candidature_visit_slots!inner(starts_at,listing_id,user_id)")
    .eq("candidature_visit_slots.user_id", userId)
    .is("cancelled_at", null);

  if (error) return res.status(500).json({ error: error.message });

  const bookings = (data || []).map((row: any) => ({
    email: String(row.email || "").toLowerCase(),
    listing_id: row.slot?.listing_id,
    starts_at: row.slot?.starts_at,
  }));

  return res.status(200).json({ bookings });
}
