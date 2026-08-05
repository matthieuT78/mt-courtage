import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../../lib/apiAuth";
import { sendEmailViaResend } from "../../../../lib/mailer/resend";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (req.method === "GET") {
    const { userId, listingId } = req.query as { userId?: string; listingId?: string };
    if (!userId || !listingId) return res.status(400).json({ error: "userId et listingId requis." });
    const match = requireMatchingUser(auth, userId);
    if (!match.ok) return res.status(match.status).json({ error: match.error });

    const { data: listing } = await supabaseAdmin.from("rental_listings").select("id,user_id").eq("id", listingId).maybeSingle();
    if (!listing || listing.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });

    const { data: slots, error } = await supabaseAdmin
      .from("candidature_visit_slots")
      .select("*")
      .eq("listing_id", listingId)
      .order("starts_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    const slotIds = (slots || []).map((s: any) => s.id);
    const { data: bookings, error: bookingsError } = slotIds.length
      ? await supabaseAdmin
          .from("candidature_visit_bookings")
          .select("*")
          .in("slot_id", slotIds)
          .is("cancelled_at", null)
      : { data: [], error: null };
    if (bookingsError) return res.status(500).json({ error: bookingsError.message });

    const bookingsBySlot = new Map<string, any[]>();
    for (const b of bookings || []) {
      if (!bookingsBySlot.has(b.slot_id)) bookingsBySlot.set(b.slot_id, []);
      bookingsBySlot.get(b.slot_id)!.push(b);
    }

    return res.status(200).json({
      slots: (slots || []).map((s: any) => ({ ...s, bookings: bookingsBySlot.get(s.id) || [] })),
    });
  }

  if (req.method === "POST") {
    // startsAt peut être soit une date unique, soit un tableau de dates
    // (plage horaire découpée en plusieurs créneaux, générée côté client) —
    // dans les deux cas, un insert groupé unique côté serveur.
    const { userId, listingId, startsAt, durationMinutes, capacity } = req.body || {};
    const startsAtList: string[] = Array.isArray(startsAt) ? startsAt : startsAt ? [startsAt] : [];
    if (!userId || !listingId || startsAtList.length === 0) {
      return res.status(400).json({ error: "userId, listingId et startsAt requis." });
    }
    if (startsAtList.length > 50) {
      return res.status(400).json({ error: "Trop de créneaux à créer en une fois (50 maximum)." });
    }
    const match = requireMatchingUser(auth, String(userId));
    if (!match.ok) return res.status(match.status).json({ error: match.error });

    const { data: listing } = await supabaseAdmin.from("rental_listings").select("id,user_id").eq("id", listingId).maybeSingle();
    if (!listing || listing.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });

    const duration = Number(durationMinutes) > 0 ? Number(durationMinutes) : 30;
    const cap = Number(capacity) > 0 ? Math.floor(Number(capacity)) : 1;

    const rows: { listing_id: string; user_id: string; starts_at: string; duration_minutes: number; capacity: number }[] = [];
    for (const raw of startsAtList) {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Date de créneau invalide." });
      rows.push({ listing_id: listingId, user_id: userId, starts_at: d.toISOString(), duration_minutes: duration, capacity: cap });
    }

    const { data, error } = await supabaseAdmin.from("candidature_visit_slots").insert(rows).select("*");
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ slots: (data || []).map((s: any) => ({ ...s, bookings: [] })) });
  }

  if (req.method === "DELETE") {
    const { userId, slotId } = (req.body || {}) as { userId?: string; slotId?: string };
    if (!userId || !slotId) return res.status(400).json({ error: "userId et slotId requis." });
    const match = requireMatchingUser(auth, safeStr(userId));
    if (!match.ok) return res.status(match.status).json({ error: match.error });

    const { data: slot } = await supabaseAdmin
      .from("candidature_visit_slots")
      .select("id,user_id,listing_id,starts_at")
      .eq("id", slotId)
      .maybeSingle();
    if (!slot || slot.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });

    // Prévenir les candidats déjà inscrits avant de supprimer — sinon ils se
    // présentent à une visite annulée sans le savoir (best-effort, ne bloque
    // jamais la suppression si l'envoi échoue).
    const { data: bookings } = await supabaseAdmin
      .from("candidature_visit_bookings")
      .select("first_name,email")
      .eq("slot_id", slotId)
      .is("cancelled_at", null);

    if (bookings && bookings.length > 0) {
      const { data: listing } = await supabaseAdmin.from("rental_listings").select("title").eq("id", slot.listing_id).maybeSingle();
      const visitDate = new Date(slot.starts_at).toLocaleString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
      const safeTitle = escapeHtml(listing?.title || "");

      await Promise.all(
        bookings.map((b: any) =>
          sendEmailViaResend({
            to: b.email,
            subject: `Visite annulée — ${listing?.title || ""}`,
            html: `
              <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a;max-width:520px;margin:0 auto">
                <p>Bonjour ${escapeHtml(b.first_name)},</p>
                <p>Le bailleur a annulé le créneau de visite du <strong>${visitDate}</strong> pour <strong>${safeTitle}</strong>.</p>
                <p>N'hésitez pas à réserver un autre créneau si de nouvelles disponibilités sont ajoutées.</p>
                <p style="font-size:12px;color:#94a3b8">lokt.fr · Gestion locative simplifiée</p>
              </div>
            `,
            text: `Le créneau de visite du ${visitDate} pour "${listing?.title || ""}" a été annulé par le bailleur.`,
          }).catch(() => {})
        )
      );
    }

    const { error } = await supabaseAdmin.from("candidature_visit_slots").delete().eq("id", slotId);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true, notified: bookings?.length || 0 });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
