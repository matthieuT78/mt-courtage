// pages/api/cron/free-plan-quittance-reminder.ts
// Relance mensuelle pour les bailleurs en plan GRATUIT (symétrique de
// rent-reminders.ts, qui ne couvre que les abonnés payants). Contrairement à
// ce dernier, aucun lien "un clic" n'exécute d'action côté serveur — le mail
// ramène uniquement vers l'app (section Quittances) + met en avant lokt·one.
// Déclenché 5 jours après le payment_day (pas J+1 comme les payants) : le but
// n'est pas "vous avez peut-être oublié de cliquer", c'est "vous avez
// visiblement laissé tomber, voici la solution" — un délai plus court serait
// prématuré pour un geste qui reste de toute façon manuel chaque mois.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { userCanUseReceiptAutomation } from "../../../lib/serverPermissions";
import { buildFreePlanQuittanceReminderEmail } from "../../../lib/freePlanQuittanceReminderEmail";
import { getLeaseRentPeriod } from "../../../lib/rentPeriod";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { alertCronFailures } from "../../../lib/cronAlert";

const REMINDER_OFFSET_DAYS = 5;

type Json = Record<string, any>;

function yyyymmInTz(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value || "0000";
  const m = parts.find((p) => p.type === "month")?.value || "00";
  return `${y}-${m}`;
}

function yyyymmddInTz(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value || "0000";
  const m = parts.find((p) => p.type === "month")?.value || "00";
  const day = parts.find((p) => p.type === "day")?.value || "00";
  return `${y}-${m}-${day}`;
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
    if (!hasValidCronSecret(req)) return res.status(401).json({ error: "unauthorized" });
    if (!supabaseAdmin) return res.status(500).json({ error: "supabaseAdmin manquant" });

    const { data: leases, error } = await supabaseAdmin
      .from("leases")
      .select("id,user_id,property_id,tenant_id,start_date,end_date,rent_amount,charges_amount,payment_day,timezone,last_free_plan_reminder_period,status,receipts_disabled,reminder_email")
      .neq("status", "draft")
      .neq("status", "ended")
      .eq("receipts_disabled", false);

    if (error) return res.status(500).json({ error: error.message });

    const now = new Date();
    const debug = String(req.query.debug || "") === "1";
    const force = String(req.query.force || "") === "1";
    let sent = 0;
    let skipped = 0;
    const debugResults: any[] = [];
    const failures: Array<{ email?: string | null; error: string }> = [];

    for (const l of leases || []) {
      // Inverse du gate de rent-reminders.ts : on cible uniquement les
      // bailleurs SANS automatisation payante.
      const canUseAutomation = await userCanUseReceiptAutomation(String(l.user_id || ""));
      if (canUseAutomation) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "has_paid_automation" }); continue; }

      const tz = l.timezone || "Europe/Paris";
      const today = yyyymmddInTz(now, tz);
      const period = yyyymmInTz(now, tz);

      if (!force && l.last_free_plan_reminder_period === period) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "already_sent_this_period" }); continue; }

      const [y, m] = period.split("-").map(Number);
      const day = Number(l.payment_day || 0);
      if (!day || day < 1 || day > 31) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "no_payment_day" }); continue; }

      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const targetDay = Math.min(day + REMINDER_OFFSET_DAYS, daysInMonth);
      const targetUtc = new Date(Date.UTC(y, m - 1, targetDay));
      const targetLocal = yyyymmddInTz(targetUtc, tz);

      if (!force && today !== targetLocal) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "wrong_date", today, targetLocal }); continue; }

      // Bail trop récent : la première échéance n'est pas encore passée, pas
      // la peine de relancer sur un mois qui ne s'est pas encore joué.
      const startDate = l.start_date ? new Date(l.start_date) : null;
      if (startDate && startDate > targetUtc) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "lease_too_recent" }); continue; }

      const to = l.reminder_email;
      if (!to) {
        const ownerRes = await supabaseAdmin.auth.admin.getUserById(String(l.user_id));
        const fallbackEmail = ownerRes.data?.user?.email;
        if (!fallbackEmail) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "no_email" }); continue; }
        l.reminder_email = fallbackEmail;
      }

      const rentPeriod = getLeaseRentPeriod(l, period);
      if (!rentPeriod) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "no_rent_period" }); continue; }
      const { periodStart, periodEnd } = rentPeriod;

      const existingPayment = await supabaseAdmin
        .from("rent_payments")
        .select("id")
        .eq("lease_id", l.id)
        .eq("period_start", periodStart)
        .gte("period_end", periodEnd)
        .not("paid_at", "is", null)
        .limit(1)
        .maybeSingle();

      if (existingPayment.data) { skipped++; if (debug) debugResults.push({ leaseId: l.id, skip: "already_confirmed" }); continue; }

      const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

      const [{ data: property }, { data: tenant }] = await Promise.all([
        l.property_id ? supabaseAdmin.from("properties").select("label,address_line1,city").eq("id", l.property_id).maybeSingle() : Promise.resolve({ data: null }),
        l.tenant_id ? supabaseAdmin.from("tenants").select("full_name").eq("id", l.tenant_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      const email = buildFreePlanQuittanceReminderEmail({
        baseUrl,
        period,
        propertyLabel: (property as any)?.label || (property as any)?.address_line1 || (property as any)?.city || null,
        tenantName: (tenant as any)?.full_name || null,
        expectedRent: rentPeriod.rent,
        expectedCharges: rentPeriod.charges,
        leaseId: l.id,
      });

      const mail = await sendEmailViaResend({ to: l.reminder_email, subject: email.subject, html: email.html });

      if (!mail.ok) { skipped++; failures.push({ email: l.reminder_email, error: mail.error || "send_failed" }); continue; }

      await supabaseAdmin
        .from("leases")
        .update({ last_free_plan_reminder_period: period, updated_at: new Date().toISOString() })
        .eq("id", l.id);

      sent++;
      if (debug) debugResults.push({ leaseId: l.id, sent: true, to: l.reminder_email });
    }

    await alertCronFailures("free-plan-quittance-reminder", failures);

    return res.status(200).json({ ok: true, sent, skipped, ...(debug ? { debug: debugResults } : {}) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "error" });
  }
}
