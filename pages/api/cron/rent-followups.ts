import type { NextApiRequest, NextApiResponse } from "next";
import { buildRentReminderOwnerEmail } from "../../../lib/rentReminderEmail";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { getLeaseRentPeriodFromDate } from "../../../lib/rentPeriod";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { userCanUseReceiptAutomation } from "../../../lib/serverPermissions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const FOLLOWUP_DAY = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

async function alreadySent(tokenId: string) {
  const { data, error } = await supabaseAdmin!
    .from("rent_reminder_followup_sends")
    .select("id")
    .eq("token_id", tokenId)
    .eq("followup_day", FOLLOWUP_DAY)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!hasValidCronSecret(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const baseUrl = appUrl();
    if (!baseUrl) return res.status(500).json({ error: "APP_URL ou NEXT_PUBLIC_SITE_URL manquant." });

    const now = new Date();
    const threshold = new Date(now.getTime() - FOLLOWUP_DAY * DAY_MS);
    const { data: tokens, error } = await supabaseAdmin
      .from("receipt_confirm_tokens")
      .select("*")
      .is("used_at", null)
      .gt("expires_at", now.toISOString())
      .lte("created_at", threshold.toISOString());

    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const token of tokens || []) {
      try {
        if (await alreadySent(token.id)) {
          skipped++;
          continue;
        }

        const { data: lease, error: leaseError } = await supabaseAdmin
          .from("leases")
          .select("*")
          .eq("id", token.lease_id)
          .maybeSingle();
        if (leaseError) throw leaseError;
        if (!lease || String(lease.user_id) !== String(token.user_id) || !lease.auto_reminder_enabled) {
          skipped++;
          continue;
        }

        if (!(await userCanUseReceiptAutomation(String(token.user_id || "")))) {
          skipped++;
          continue;
        }

        const rentPeriod = getLeaseRentPeriodFromDate(lease, token.period_start);
        if (!rentPeriod) {
          skipped++;
          continue;
        }

        const { data: payment, error: paymentError } = await supabaseAdmin
          .from("rent_payments")
          .select("total_amount,paid_at")
          .eq("lease_id", token.lease_id)
          .eq("period_start", token.period_start)
          .eq("period_end", token.period_end)
          .maybeSingle();
        if (paymentError) throw paymentError;
        if (payment?.paid_at && Number(payment.total_amount || 0) >= rentPeriod.total) {
          skipped++;
          continue;
        }

        const ownerEmail = safeStr(lease.reminder_email);
        if (!ownerEmail) {
          skipped++;
          continue;
        }

        const [{ data: property }, { data: tenant }] = await Promise.all([
          lease.property_id
            ? supabaseAdmin.from("properties").select("label,address_line1,city").eq("id", lease.property_id).maybeSingle()
            : Promise.resolve({ data: null }),
          lease.tenant_id
            ? supabaseAdmin.from("tenants").select("full_name").eq("id", lease.tenant_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const tokenValue = encodeURIComponent(token.token);
        const email = buildRentReminderOwnerEmail({
          baseUrl,
          period: String(token.period_start).slice(0, 7),
          propertyLabel: (property as any)?.label || (property as any)?.address_line1 || (property as any)?.city || null,
          tenantName: (tenant as any)?.full_name || null,
          expectedRent: rentPeriod.rent,
          expectedCharges: rentPeriod.charges,
          fullUrl: `${baseUrl}/api/receipts/confirm-paid?token=${tokenValue}&action=full`,
          partialUrl: `${baseUrl}/api/receipts/confirm-paid?token=${tokenValue}&action=partial`,
          isFollowup: true,
        });

        const mail = await sendEmailViaResend({
          to: ownerEmail,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        if (!mail.ok) throw new Error(mail.error);

        const { error: insertError } = await supabaseAdmin.from("rent_reminder_followup_sends").insert({
          token_id: token.id,
          user_id: token.user_id,
          followup_day: FOLLOWUP_DAY,
        });
        if (insertError) throw insertError;

        sent++;
        results.push({ tokenId: token.id, leaseId: token.lease_id, sent: true });
      } catch (e: any) {
        skipped++;
        results.push({ tokenId: token.id, leaseId: token.lease_id, sent: false, error: e?.message || String(e) });
      }
    }

    return res.status(200).json({ ok: true, followupDay: FOLLOWUP_DAY, sent, skipped, results });
  } catch (e: any) {
    console.error("[cron/rent-followups] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
