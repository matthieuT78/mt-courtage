import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { buildRentReminderOwnerEmail } from "../../../lib/rentReminderEmail";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function getBaseUrl(req: NextApiRequest) {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const origin = String(req.headers.origin || "");
  if (origin) return origin.replace(/\/$/, "");
  const host = String(req.headers.host || "");
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  return host ? `${proto}://${host}` : "";
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configure." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, leaseId, periodStart, periodEnd, toEmail } = req.body || {};
    if (!userId || !leaseId || !periodStart || !periodEnd) {
      return res.status(400).json({ error: "userId, leaseId, periodStart et periodEnd sont requis." });
    }

    const match = requireMatchingUser(auth, String(userId));
    if (!match.ok) return res.status(match.status).json({ error: match.error });

    const { data: lease, error } = await supabaseAdmin
      .from("leases")
      .select("id,user_id,property_id,tenant_id,reminder_email,rent_amount,charges_amount")
      .eq("id", String(leaseId))
      .eq("user_id", String(userId))
      .maybeSingle();

    if (error) throw error;
    if (!lease) return res.status(404).json({ error: "Bail introuvable pour cet utilisateur." });

    const to = safeStr(toEmail) || safeStr((lease as any).reminder_email) || safeStr(auth.email);
    if (!to) return res.status(400).json({ error: "Aucun email bailleur disponible pour le test." });

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const inserted = await supabaseAdmin
      .from("receipt_confirm_tokens")
      .insert({
        token,
        user_id: String(userId),
        lease_id: String(leaseId),
        period_start: String(periodStart),
        period_end: String(periodEnd),
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (inserted.error) throw inserted.error;

    const baseUrl = getBaseUrl(req);
    const period = String(periodStart).slice(0, 7);
    const link = (action: string) => `${baseUrl}/api/receipts/confirm-paid?token=${encodeURIComponent(token)}&action=${action}`;

    const [{ data: property }, { data: tenant }] = await Promise.all([
      (lease as any).property_id
        ? supabaseAdmin.from("properties").select("label,address_line1,city").eq("id", (lease as any).property_id).maybeSingle()
        : Promise.resolve({ data: null }),
      (lease as any).tenant_id
        ? supabaseAdmin.from("tenants").select("full_name").eq("id", (lease as any).tenant_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const email = buildRentReminderOwnerEmail({
      baseUrl,
      period,
      propertyLabel: (property as any)?.label || (property as any)?.address_line1 || (property as any)?.city || null,
      tenantName: (tenant as any)?.full_name || null,
      expectedRent: (lease as any).rent_amount,
      expectedCharges: (lease as any).charges_amount,
      fullUrl: link("full"),
      partialUrl: link("partial"),
      isTest: true,
    });

    const sent = await sendEmailViaResend({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: "contact@lokt.fr",
    });

    if (!sent.ok) return res.status(500).json({ error: sent.error || "Envoi email test impossible." });

    return res.status(200).json({
      ok: true,
      to,
      token,
      token_id: inserted.data.id,
      expires_at: expiresAt,
      fullUrl: link("full"),
      partialUrl: link("partial"),
      unpaidUrl: link("unpaid"),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erreur envoi email test." });
  }
}
