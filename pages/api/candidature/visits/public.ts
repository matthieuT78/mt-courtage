import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

// Route publique — pas d'auth requise, accès via token d'annonce uniquement.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const { token } = req.query;
  if (!token || typeof token !== "string") return res.status(400).json({ error: "Token manquant." });

  const { data: listing } = await supabaseAdmin
    .from("rental_listings")
    .select("id")
    .eq("token", token)
    .eq("status", "active")
    .maybeSingle();
  if (!listing) return res.status(404).json({ error: "Annonce introuvable ou fermée." });

  const nowIso = new Date().toISOString();
  const { data: slots, error } = await supabaseAdmin
    .from("candidature_visit_slots")
    .select("id,starts_at,duration_minutes,capacity")
    .eq("listing_id", listing.id)
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const slotIds = (slots || []).map((s: any) => s.id);
  const { data: bookings, error: bookingsError } = slotIds.length
    ? await supabaseAdmin.from("candidature_visit_bookings").select("slot_id").in("slot_id", slotIds).is("cancelled_at", null)
    : { data: [], error: null };
  if (bookingsError) return res.status(500).json({ error: bookingsError.message });

  const bookedCountBySlot = new Map<string, number>();
  for (const b of bookings || []) {
    bookedCountBySlot.set(b.slot_id, (bookedCountBySlot.get(b.slot_id) || 0) + 1);
  }

  const availableSlots = (slots || [])
    .map((s: any) => ({
      id: s.id,
      starts_at: s.starts_at,
      duration_minutes: s.duration_minutes,
      remaining: s.capacity - (bookedCountBySlot.get(s.id) || 0),
    }))
    .filter((s) => s.remaining > 0);

  return res.status(200).json({ slots: availableSlots });
}
