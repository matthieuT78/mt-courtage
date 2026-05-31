import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import {
  buildTenantPaymentReminderContent,
  getTenantPaymentReminderContext,
  sendTenantPaymentReminder,
  type TenantPaymentReminderChannel,
  type TenantPaymentReminderReason,
} from "../../../lib/tenantPaymentReminder";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function parseReason(value: unknown): TenantPaymentReminderReason {
  return value === "partial" ? value : "unpaid";
}

function parseChannels(value: unknown): TenantPaymentReminderChannel[] {
  if (!Array.isArray(value)) return ["email"];
  return value.filter((channel): channel is TenantPaymentReminderChannel => channel === "email" || channel === "messaging");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, leaseId, periodStart, periodEnd, reason, action, channels, body } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId requis." });
    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!leaseId || !periodStart || !periodEnd) return res.status(400).json({ error: "leaseId + periodStart + periodEnd requis." });

    const reminderReason = parseReason(reason);
    if (action === "preview") {
      const context = await getTenantPaymentReminderContext({
        userId: String(userId),
        leaseId: String(leaseId),
        periodStart: String(periodStart),
        periodEnd: String(periodEnd),
        reason: reminderReason,
      });
      const content = buildTenantPaymentReminderContent(context, {
        reason: reminderReason,
        periodStart: String(periodStart),
        periodEnd: String(periodEnd),
      });
      const { data: history, error } = await supabaseAdmin
        .from("tenant_payment_reminder_sends")
        .select("id,channels,trigger_type,status,missing_amount,sent_at,error_message")
        .eq("user_id", String(userId))
        .eq("lease_id", String(leaseId))
        .eq("period_start", String(periodStart))
        .eq("period_end", String(periodEnd))
        .order("sent_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return res.status(200).json({
        ok: true,
        ...content,
        missingAmount: context.missingAmount,
        emailAvailable: !!context.tenantEmail,
        messagingAvailable: context.messagingAvailable,
        history: history || [],
      });
    }

    const result = await sendTenantPaymentReminder({
      userId: String(userId),
      leaseId: String(leaseId),
      periodStart: String(periodStart),
      periodEnd: String(periodEnd),
      reason: reminderReason,
      channels: parseChannels(channels),
      body: String(body || ""),
      triggerType: "manual",
    });
    return res.status(result.ok ? 200 : 207).json(result);
  } catch (error: any) {
    console.error("[api/payments/reminder] error:", error);
    return res.status(500).json({ error: error?.message || "Erreur interne" });
  }
}
