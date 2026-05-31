import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { getLeaseRentPeriod } from "../../../lib/rentPeriod";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendTenantPaymentReminder, type TenantPaymentReminderChannel, type TenantPaymentReminderReason } from "../../../lib/tenantPaymentReminder";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const yyyymm = (date: Date) => iso(date).slice(0, 7);
const shiftedMonth = (offset: number) => {
  const now = new Date();
  return yyyymm(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)));
};

function channelsFromSetting(value: unknown): TenantPaymentReminderChannel[] {
  if (value === "email") return ["email"];
  if (value === "messaging") return ["messaging"];
  return ["email", "messaging"];
}

function targetDateForPeriod(lease: any, period: string, delayDays: number) {
  const [year, month] = period.split("-").map(Number);
  const dueMonth = String(lease.payment_type || "terme_a_echoir").toLowerCase() === "terme_echu" ? month : month - 1;
  const lastDay = new Date(Date.UTC(year, dueMonth + 1, 0)).getUTCDate();
  const target = new Date(Date.UTC(year, dueMonth, Math.min(Math.max(Number(lease.payment_day || 1), 1), lastDay)));
  target.setUTCDate(target.getUTCDate() + delayDays);
  return iso(target);
}

function reasonFor(payment: any, expected: { rent: number; charges: number; total: number }): TenantPaymentReminderReason | null {
  const total = Number(payment?.total_amount || 0);
  if (total >= expected.total - 0.01) return null;
  return total > 0 ? "partial" : "unpaid";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const today = iso(new Date());
    const { data: settings, error } = await supabaseAdmin.from("tenant_payment_reminder_settings").select("*").eq("auto_enabled", true);
    if (error) throw error;
    let sent = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const setting of settings || []) {
      const { data: lease } = await supabaseAdmin.from("leases").select("*").eq("id", setting.lease_id).maybeSingle();
      if (!lease || String(lease.status || "").toLowerCase() === "draft") {
        skipped++;
        continue;
      }
      for (const shift of [0, -1]) {
        const period = shiftedMonth(shift);
        const rentPeriod = getLeaseRentPeriod(lease, period);
        if (!rentPeriod || targetDateForPeriod(lease, period, Number(setting.auto_delay_days || 3)) !== today) continue;
        const { data: existing } = await supabaseAdmin
          .from("tenant_payment_reminder_sends")
          .select("id")
          .eq("lease_id", lease.id)
          .eq("period_start", rentPeriod.periodStart)
          .eq("period_end", rentPeriod.periodEnd)
          .eq("trigger_type", "automatic")
          .in("status", ["sent", "partial"])
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }
        const { data: payment } = await supabaseAdmin
          .from("rent_payments")
          .select("*")
          .eq("lease_id", lease.id)
          .eq("period_start", rentPeriod.periodStart)
          .eq("period_end", rentPeriod.periodEnd)
          .maybeSingle();
        const reason = reasonFor(payment, rentPeriod);
        if (!reason) {
          skipped++;
          continue;
        }
        try {
          const result = await sendTenantPaymentReminder({
            userId: String(lease.user_id),
            leaseId: String(lease.id),
            periodStart: rentPeriod.periodStart,
            periodEnd: rentPeriod.periodEnd,
            reason,
            channels: channelsFromSetting(setting.default_channel),
            triggerType: "automatic",
          });
          sent++;
          results.push({ leaseId: lease.id, period, status: result.status });
        } catch (sendError: any) {
          skipped++;
          results.push({ leaseId: lease.id, period, error: sendError?.message || String(sendError) });
        }
      }
    }
    return res.status(200).json({ ok: true, sent, skipped, results });
  } catch (error: any) {
    console.error("[cron/tenant-payment-reminders] error:", error);
    return res.status(500).json({ error: error?.message || "Erreur interne" });
  }
}
