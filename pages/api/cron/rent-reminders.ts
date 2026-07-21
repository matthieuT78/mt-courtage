// pages/api/cron/rent-reminders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { userCanUseReceiptAutomation } from "../../../lib/serverPermissions";
import { buildRentReminderOwnerEmail } from "../../../lib/rentReminderEmail";
import { getLeaseRentPeriod } from "../../../lib/rentPeriod";
import { hasValidCronSecret } from "../../../lib/cronAuth";

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
    if (!hasValidCronSecret(req)) {
      return res.status(401).json({ error: "unauthorized" });
    }

    if (!supabaseAdmin) return res.status(500).json({ error: "supabaseAdmin manquant" });

    // 1) baux éligibles
    const { data: leases, error } = await supabaseAdmin
      .from("leases")
      .select("id,user_id,property_id,tenant_id,start_date,end_date,rent_amount,charges_amount,payment_day,timezone,auto_reminder_enabled,reminder_email,last_auto_sent_period,status")
      .eq("auto_reminder_enabled", true)
      .neq("status", "draft");

    if (error) return res.status(500).json({ error: error.message });

    const now = new Date();
    const debug = String(req.query.debug || "") === "1";
    const force = String(req.query.force || "") === "1";
    let sent = 0;
    let skipped = 0;
    const debugResults: any[] = [];

    for (const l of leases || []) {
      const canUseAutomation = await userCanUseReceiptAutomation(String(l.user_id || ""));
      if (!canUseAutomation) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "no_automation_plan" }); continue; }

      if (l.property_id) {
        const { data: prop } = await supabaseAdmin.from("properties").select("delegated_services").eq("id", l.property_id).maybeSingle();
        if (Array.isArray(prop?.delegated_services) && prop.delegated_services.includes("gestion_courante")) {
          skipped++;
          if (debug) debugResults.push({ leaseId: l.id, skip: "gestion_courante_delegated" });
          continue;
        }
      }

      const tz = l.timezone || "Europe/Paris";
      const today = yyyymmddInTz(now, tz);
      const period = yyyymmInTz(now, tz);

      if (!force && l.last_auto_sent_period === period) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "already_sent_this_period", last_auto_sent_period: l.last_auto_sent_period }); continue; }

      const [y, m] = period.split("-").map(Number);
      const day = Number(l.payment_day || 0);
      if (!day || day < 1 || day > 31) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "no_payment_day", payment_day: l.payment_day }); continue; }

      // `period` is always the current calendar month, so the target date must stay within it —
      // Date.UTC silently rolls an out-of-range day into the next month (e.g. day=31 in April
      // becomes May 1), which then never matches `today` while `period` still points at April,
      // so the reminder silently never fires. Clamp both the due day and the day-after target to
      // the month's real length instead.
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const targetDay = Math.min(day + 1, daysInMonth);
      const targetUtc = new Date(Date.UTC(y, m - 1, targetDay));
      const targetLocal = yyyymmddInTz(targetUtc, tz);

      if (today !== targetLocal) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "wrong_date", today, targetLocal, payment_day: day }); continue; }

      const to = l.reminder_email;
      if (!to) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "no_reminder_email" }); continue; }

      const rentPeriod = getLeaseRentPeriod(l, period);
      if (!rentPeriod) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "no_rent_period" }); continue; }
      const { periodStart, periodEnd } = rentPeriod;

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

      const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
      const fullUrl = `${baseUrl}/api/receipts/confirm-paid?token=${token}&action=full`;
      const partialUrl = `${baseUrl}/api/receipts/confirm-paid?token=${token}&action=partial`;

      const [{ data: property }, { data: tenant }] = await Promise.all([
        l.property_id ? supabaseAdmin.from("properties").select("label,address_line1,city").eq("id", l.property_id).maybeSingle() : Promise.resolve({ data: null }),
        l.tenant_id ? supabaseAdmin.from("tenants").select("full_name").eq("id", l.tenant_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      const email = buildRentReminderOwnerEmail({
        baseUrl,
        period,
        propertyLabel: (property as any)?.label || (property as any)?.address_line1 || (property as any)?.city || null,
        tenantName: (tenant as any)?.full_name || null,
        expectedRent: rentPeriod.rent,
        expectedCharges: rentPeriod.charges,
        fullUrl,
        partialUrl,
      });

      const mail = await sendEmailViaResend({
        to,
        subject: email.subject,
        html: email.html,
      });

      if (!mail.ok) { skipped++; continue; }

      // 3) marquer “envoyé” pour ce mois (anti-spam)
      await supabaseAdmin
        .from("leases")
        .update({ last_auto_sent_period: period, updated_at: new Date().toISOString() })
        .eq("id", l.id);

      sent++;
      if (debug) debugResults.push({ leaseId: l.id, sent: true, to });
    }

    return res.status(200).json({ ok: true, sent, skipped, ...(debug ? { debug: debugResults } : {}) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "error" });
  }
}
