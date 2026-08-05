import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../../lib/mailer/resend";
import { buildVisitIcs } from "../../../../lib/ics";

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

// Route publique — pas d'auth requise, accès via token d'annonce uniquement.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const { listing_token, slot_id, first_name, last_name, email, phone } = req.body || {};
  if (!listing_token || !slot_id || !first_name || !last_name || !email) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email).trim())) return res.status(400).json({ error: "Adresse email invalide." });

  const { data: listing } = await supabaseAdmin
    .from("rental_listings")
    .select("id,title,address,user_id")
    .eq("token", listing_token)
    .eq("status", "active")
    .maybeSingle();
  if (!listing) return res.status(404).json({ error: "Annonce introuvable ou fermée." });

  const { data: slot } = await supabaseAdmin
    .from("candidature_visit_slots")
    .select("id,listing_id,starts_at,duration_minutes,capacity")
    .eq("id", slot_id)
    .maybeSingle();
  if (!slot || slot.listing_id !== listing.id) return res.status(404).json({ error: "Créneau introuvable." });
  if (new Date(slot.starts_at).getTime() < Date.now()) return res.status(400).json({ error: "Ce créneau n'est plus disponible." });

  const normalizedEmail = safeStr(email).toLowerCase();

  const { data: existingBooking, error: existingError } = await supabaseAdmin
    .from("candidature_visit_bookings")
    .select("*")
    .eq("slot_id", slot_id)
    .eq("email", normalizedEmail)
    .is("cancelled_at", null)
    .maybeSingle();
  if (existingError) return res.status(500).json({ error: existingError.message });
  // Double-clic / resoumission : on renvoie la réservation déjà existante plutôt
  // que d'en créer une deuxième et de consommer une place en plus pour rien.
  if (existingBooking) return res.status(200).json({ booking: existingBooking, starts_at: slot.starts_at });

  const { count, error: countError } = await supabaseAdmin
    .from("candidature_visit_bookings")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", slot_id)
    .is("cancelled_at", null);
  if (countError) return res.status(500).json({ error: countError.message });
  if ((count || 0) >= slot.capacity) return res.status(409).json({ error: "Ce créneau est complet." });

  const payload = {
    slot_id,
    first_name: safeStr(first_name),
    last_name: safeStr(last_name).toUpperCase(),
    email: normalizedEmail,
    phone: phone ? safeStr(phone) : null,
  };

  const { data: booking, error } = await supabaseAdmin.from("candidature_visit_bookings").insert(payload).select("*").single();
  if (error) return res.status(500).json({ error: error.message });

  const visitDate = new Date(slot.starts_at).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const address = listing.address || listing.title;
  const safeTitle = escapeHtml(listing.title);
  const safeAddress = escapeHtml(address);
  const safeFirstName = escapeHtml(payload.first_name);
  const safeLastName = escapeHtml(payload.last_name);
  const safeEmail = escapeHtml(payload.email);
  const safePhone = payload.phone ? escapeHtml(payload.phone) : null;

  try {
    const ics = buildVisitIcs({
      uid: `visit-${booking.id}@lokt.fr`,
      startsAt: slot.starts_at,
      durationMinutes: slot.duration_minutes,
      summary: `Visite — ${listing.title}`,
      location: address,
      description: `Visite du logement organisée via lokt.fr.`,
    });

    await sendEmailViaResend({
      to: payload.email,
      subject: `Visite confirmée — ${listing.title}`,
      html: `
        <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a;max-width:520px;margin:0 auto">
          <p>Bonjour ${safeFirstName},</p>
          <p>Votre visite pour <strong>${safeTitle}</strong> est confirmée :</p>
          <p style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px">
            <strong>${visitDate}</strong><br/>${safeAddress}
          </p>
          <p>Le fichier joint vous permet d'ajouter ce rendez-vous directement à votre agenda (Google Calendar, Outlook, Apple Calendar...).</p>
          <p style="font-size:12px;color:#94a3b8">lokt.fr · Gestion locative simplifiée</p>
        </div>
      `,
      text: `Visite confirmée pour "${listing.title}" le ${visitDate} — ${address}.`,
      attachments: [{ filename: "visite.ics", content: Buffer.from(ics, "utf8").toString("base64") }],
    });
  } catch {
    // non bloquant
  }

  try {
    const ownerRes = await supabaseAdmin.auth.admin.getUserById(listing.user_id);
    const landlordEmail = ownerRes?.data?.user?.email;
    if (landlordEmail) {
      await sendEmailViaResend({
        to: landlordEmail,
        subject: `Nouvelle réservation de visite — ${listing.title}`,
        html: `
          <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a;max-width:520px;margin:0 auto">
            <p>Bonjour,</p>
            <p><strong>${safeFirstName} ${safeLastName}</strong> (${safeEmail}${safePhone ? `, ${safePhone}` : ""}) vient de réserver une visite pour <strong>${safeTitle}</strong> :</p>
            <p style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px"><strong>${visitDate}</strong></p>
          </div>
        `,
        text: `${payload.first_name} ${payload.last_name} (${payload.email}) a réservé une visite pour "${listing.title}" le ${visitDate}.`,
      });
    }
  } catch {
    // non bloquant
  }

  return res.status(200).json({ booking, starts_at: slot.starts_at });
}
