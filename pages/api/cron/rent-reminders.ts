// pages/api/cron/rent-reminders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type Json = Record<string, any>;

function yyyymmInTz(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone, year: "numeric", month: "2-digit" })
    .formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value || "0000";
  const m = parts.find((p) => p.type === "month")?.value || "00";
  return `${y}-${m}`;
}

function yyyymmddInTz(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value || "0000";
  const m = parts.find((p) => p.type === "month")?.value || "00";
  const day = parts.find((p) => p.type === "day")?.value || "00";
  return `${y}-${m}-${day}`;
}

function monthStartEnd(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const toISO = (x: Date) => x.toISOString().slice(0, 10);
  return { periodStart: toISO(start), periodEnd: toISO(end) };
}

async function sendEmailViaResend(params: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return { ok: false, error: "RESEND_API_KEY / RESEND_FROM manquants" };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html }),
  });

  const raw = await r.text();
  let json: any = null;
  try { json = raw ? JSON.parse(raw) : null; } catch {}
  if (!r.ok) return { ok: false, error: json?.message || raw || `Resend ${r.status}` };
  return { ok: true, id: json?.id || null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    // Sécurité simple : un secret pour éviter que n’importe qui ping l’endpoint
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers["x-cron-secret"] !== secret) {
      return res.status(401).json({ error: "unauthorized" });
    }

    if (!supabaseAdmin) return res.status(500).json({ error: "supabaseAdmin manquant" });

    // 1) baux éligibles
    const { data: leases, error } = await supabaseAdmin
      .from("leases")
      .select("id,user_id,payment_day,timezone,auto_reminder_enabled,reminder_email,last_auto_sent_period,status")
      .eq("auto_reminder_enabled", true)
      .neq("status", "draft");

    if (error) return res.status(500).json({ error: error.message });

    const now = new Date();
    let sent = 0;
    let skipped = 0;

    for (const l of leases || []) {
      const tz = l.timezone || "Europe/Paris";
      const today = yyyymmddInTz(now, tz);
      const period = yyyymmInTz(now, tz); // YYYY-MM (mois courant local)

      // Évite double envoi
      if (l.last_auto_sent_period === period) { skipped++; continue; }

      // compute (payment_day + 2) dans le mois courant local
      const [y, m] = period.split("-").map(Number);
      const day = Number(l.payment_day || 0);
      if (!day || day < 1 || day > 31) { skipped++; continue; }

      // Date cible en local (approx via Date.UTC puis format dans tz)
      // On prend y/m/day et ajoute 2 jours (UTC), puis compare sur rendu tz
      const targetUtc = new Date(Date.UTC(y, m - 1, day));
      targetUtc.setUTCDate(targetUtc.getUTCDate() + 2);
      const targetLocal = yyyymmddInTz(targetUtc, tz);

      if (today !== targetLocal) { skipped++; continue; }

      const to = l.reminder_email; // email propriétaire pour confirmation
      if (!to) { skipped++; continue; }

      const { periodStart, periodEnd } = monthStartEnd(period);

      // 2) créer token one-shot
      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      const ins = await supabaseAdmin
        .from("receipt_confirm_tokens")
        .insert({
          token,
          user_id: l.user_id,
          lease_id: l.id,
          period_start: periodStart,
          period_end: periodEnd,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (ins.error) { skipped++; continue; }

      const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
      const confirmUrl = `${baseUrl}/api/receipts/confirm-paid?token=${token}`;

      const html = `
        <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
          <p>Bonjour,</p>
          <p>Nous sommes à J+2 après la date prévue de paiement. Le loyer du mois <b>${period}</b> a-t-il été payé ?</p>
          <p>
            <a href="${confirmUrl}" style="display:inline-block;padding:10px 14px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:600">
              Oui, le loyer est payé → Générer & envoyer la quittance
            </a>
          </p>
          <p style="color:#666;font-size:12px">Lien valable 7 jours. Si déjà fait, ignore ce message.</p>
        </div>
      `;

      const mail = await sendEmailViaResend({
        to,
        subject: `Loyer payé ? (${period})`,
        html,
      });

      if (!mail.ok) { skipped++; continue; }

      // 3) marquer “envoyé” pour ce mois (anti-spam)
      await supabaseAdmin
        .from("leases")
        .update({ last_auto_sent_period: period, updated_at: new Date().toISOString() })
        .eq("id", l.id);

      sent++;
    }

    return res.status(200).json({ ok: true, sent, skipped });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "error" });
  }
}
