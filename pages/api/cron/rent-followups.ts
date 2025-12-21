// pages/api/cron/rent-followups.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function yyyymmToPeriod(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { periodStart: iso(start), periodEnd: iso(end) };
}

function clampPaymentDay(year: number, month1to12: number, day: number) {
  // dernier jour du mois
  const last = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  return Math.max(1, Math.min(last, day));
}

function addDaysUTC(isoDate: string, days: number) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function sendEmailToOwner(params: { to: string; subject: string; html: string }) {
  // Tu peux réutiliser ta fonction Resend ici (comme dans /api/receipts/send)
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return { ok: false, error: "RESEND non configuré" };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html }),
  });

  const raw = await r.text();
  if (!r.ok) return { ok: false, error: raw };
  return { ok: true };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1) sécurité cron
    const secret = req.headers["x-cron-secret"];
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin not configured" });

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const yyyymm = `${y}-${String(m).padStart(2, "0")}`;
    const { periodStart, periodEnd } = yyyymmToPeriod(yyyymm);
    const today = new Date().toISOString().slice(0, 10);

    // 2) charger leases actifs (adapte le filtre si tu as un champ status)
    const leasesRes = await supabaseAdmin.from("leases").select("*");
    if (leasesRes.error) return res.status(500).json({ error: leasesRes.error.message });
    const leases = leasesRes.data || [];

    let sent = 0;
    let skipped = 0;

    for (const lease of leases) {
      const userId = lease.user_id;
      const paymentDay = Number(lease.payment_day || lease.paymentDay || 1); // adapte si besoin
      const dd = clampPaymentDay(y, m, paymentDay);

      const due = `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const remindDate = addDaysUTC(due, 2);
      if (today !== remindDate) {
        skipped++;
        continue;
      }

      // 3) si quittance déjà envoyée ce mois → skip
      const rr = await supabaseAdmin
        .from("rent_receipts")
        .select("id,status")
        .eq("lease_id", lease.id)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .maybeSingle();

      if (rr.data && rr.data.status === "sent") {
        skipped++;
        continue;
      }

      // 4) email proprio (on prend user email depuis auth/users si possible, sinon depuis landlord settings)
      // -> simplest: stocker userEmail dans landlord_settings (recommandé)
      const landlordRes = await supabaseAdmin
        .from("landlord_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const ownerEmail =
        landlordRes.data?.email || landlordRes.data?.notification_email || null;

      if (!ownerEmail) {
        skipped++;
        continue;
      }

      // 5) créer token action
      const token = crypto.randomBytes(24).toString("hex");
      const ins = await supabaseAdmin.from("receipt_actions").insert({
        user_id: userId,
        lease_id: lease.id,
        period_start: periodStart,
        period_end: periodEnd,
        token,
        action: "confirm_paid",
        status: "pending",
      });

      if (ins.error) {
        // si token unique collision, skip
        skipped++;
        continue;
      }

      const baseUrl = process.env.APP_BASE_URL || "https://ton-domaine.vercel.app";
      const yesUrl = `${baseUrl}/api/receipts/confirm?token=${token}&action=yes`;
      const noUrl = `${baseUrl}/api/receipts/confirm?token=${token}&action=no`;

      const subject = `Loyer ${yyyymm} : payé ?`;
      const html = `
        <div style="font-family:ui-sans-serif,system-ui;line-height:1.5">
          <p>Bonjour,</p>
          <p>Le loyer prévu le <b>${due}</b> (bail ${lease.id}) n'a pas encore été confirmé.</p>
          <p>Est-il payé ?</p>
          <p>
            <a href="${yesUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:999px;text-decoration:none;margin-right:8px">
              ✅ Oui, générer & envoyer la quittance
            </a>
            <a href="${noUrl}" style="display:inline-block;padding:10px 14px;border:1px solid #ddd;color:#111;border-radius:999px;text-decoration:none">
              ❌ Non
            </a>
          </p>
          <p style="color:#666;font-size:12px">Lien valable 7 jours.</p>
        </div>
      `;

      const email = await sendEmailToOwner({ to: ownerEmail, subject, html });
      if (email.ok) sent++;
      else skipped++;
    }

    return res.status(200).json({ ok: true, yyyymm, sent, skipped });
  } catch (e: any) {
    console.error("[cron/rent-followups] error:", e);
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
