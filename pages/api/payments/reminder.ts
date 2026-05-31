import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { userCanUseReceiptAutomation } from "../../../lib/serverPermissions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getLeaseRentPeriodFromDate } from "../../../lib/rentPeriod";

type ReminderReason = "unpaid" | "partial" | "charges_missing";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function euro(v: unknown) {
  const n = Number(v || 0);
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDateFR(v: string) {
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function reasonLabel(reason: ReminderReason) {
  if (reason === "charges_missing") return "charges manquantes";
  if (reason === "partial") return "paiement incomplet";
  return "loyer non reçu";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, leaseId, periodStart, periodEnd, reason } = (req.body || {}) as {
      userId?: string;
      leaseId?: string;
      periodStart?: string;
      periodEnd?: string;
      reason?: ReminderReason;
    };

    if (!userId) return res.status(400).json({ error: "userId requis." });
    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!leaseId || !periodStart || !periodEnd) return res.status(400).json({ error: "leaseId + periodStart + periodEnd requis." });

    const reminderReason: ReminderReason =
      reason === "partial" || reason === "charges_missing" || reason === "unpaid" ? reason : "unpaid";

    const canSendReminder = await userCanUseReceiptAutomation(String(userId));
    if (!canSendReminder) {
      return res.status(403).json({ error: "Les relances email sont réservées aux abonnements payants." });
    }

    const leaseRes = await supabaseAdmin.from("leases").select("*").eq("id", leaseId).single();
    if (leaseRes.error || !leaseRes.data) return res.status(404).json({ error: "Bail introuvable." });
    const lease: any = leaseRes.data;
    if (String(lease.user_id) !== String(userId)) return res.status(403).json({ error: "Accès refusé." });

    const [{ data: tenant }, { data: property }, { data: landlord }, { data: payment }] = await Promise.all([
      supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).maybeSingle(),
      supabaseAdmin.from("properties").select("*").eq("id", lease.property_id).maybeSingle(),
      supabaseAdmin.from("landlords").select("*").eq("user_id", userId).maybeSingle(),
      supabaseAdmin
        .from("rent_payments")
        .select("*")
        .eq("lease_id", leaseId)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .maybeSingle(),
    ]);

    const tenantEmail = safeStr(lease.tenant_receipt_email) || safeStr((tenant as any)?.email);
    if (!tenantEmail) return res.status(400).json({ error: "Email locataire manquant. Ajoute un email locataire avant d’envoyer une relance." });

    const tenantName = safeStr((tenant as any)?.full_name) || "Bonjour";
    const landlordName = safeStr((landlord as any)?.display_name) || "Votre bailleur";
    const replyTo = safeStr((landlord as any)?.email) || safeStr(lease.reminder_email) || safeStr(auth.email) || "contact@lokt.fr";
    const propertyLabel =
      safeStr((property as any)?.label) ||
      [safeStr((property as any)?.address_line1), safeStr((property as any)?.postal_code), safeStr((property as any)?.city)]
        .filter(Boolean)
        .join(", ") ||
      "le logement";

    const rentPeriod = getLeaseRentPeriodFromDate(lease, periodStart);
    if (!rentPeriod) return res.status(400).json({ error: "Cette période est en dehors des dates du bail." });
    const { rent, charges, total: expectedTotal } = rentPeriod;
    const receivedRent = Number((payment as any)?.rent_amount || 0);
    const receivedCharges = Number((payment as any)?.charges_amount || 0);
    const receivedTotal = Number((payment as any)?.total_amount || 0);
    const missingAmount =
      reminderReason === "charges_missing" ? Math.max(0, charges - receivedCharges) : Math.max(0, expectedTotal - receivedTotal);

    const yyyymm = periodStart.slice(0, 7);
    const subject =
      reminderReason === "charges_missing"
        ? `Charges locatives manquantes - ${yyyymm}`
        : reminderReason === "partial"
        ? `Solde de loyer restant dû - ${yyyymm}`
        : `Relance loyer - ${yyyymm}`;

    const explanation =
      reminderReason === "charges_missing"
        ? `Nous avons bien identifié un règlement partiel, mais les charges prévues pour la période ne semblent pas réglées.`
        : reminderReason === "partial"
        ? `Nous avons bien identifié un règlement partiel, mais le montant reçu ne couvre pas encore la totalité du loyer et des charges.`
        : `Sauf erreur de notre part, le règlement du loyer et des charges de cette période n’a pas encore été confirmé.`;

    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.55;color:#0f172a">
        <p>${tenantName === "Bonjour" ? "Bonjour," : `Bonjour ${tenantName},`}</p>
        <p>${explanation}</p>
        <div style="margin:16px 0;padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc">
          <p style="margin:0 0 6px"><strong>Logement :</strong> ${propertyLabel}</p>
          <p style="margin:0 0 6px"><strong>Période :</strong> du ${formatDateFR(periodStart)} au ${formatDateFR(periodEnd)}</p>
          <p style="margin:0 0 6px"><strong>Loyer hors charges :</strong> ${euro(rent)}</p>
          <p style="margin:0 0 6px"><strong>Charges :</strong> ${euro(charges)}</p>
          <p style="margin:0 0 6px"><strong>Total attendu :</strong> ${euro(expectedTotal)}</p>
          ${receivedTotal > 0 ? `<p style="margin:0 0 6px"><strong>Total identifié :</strong> ${euro(receivedTotal)} (loyer ${euro(receivedRent)} · charges ${euro(receivedCharges)})</p>` : ""}
          <p style="margin:0"><strong>Montant à régulariser :</strong> ${euro(missingAmount)}</p>
        </div>
        <p>Si le règlement a déjà été effectué, vous pouvez simplement répondre à cet email avec le justificatif ou la date du virement.</p>
        <p>Cordialement,<br/>${landlordName}</p>
        <p style="margin-top:18px;color:#64748b;font-size:12px">Message préparé et envoyé depuis lokt.fr après validation du bailleur.</p>
      </div>
    `.trim();

    const text = `
${tenantName === "Bonjour" ? "Bonjour," : `Bonjour ${tenantName},`}

${explanation}

Logement : ${propertyLabel}
Période : du ${formatDateFR(periodStart)} au ${formatDateFR(periodEnd)}
Loyer hors charges : ${euro(rent)}
Charges : ${euro(charges)}
Total attendu : ${euro(expectedTotal)}
${receivedTotal > 0 ? `Total identifié : ${euro(receivedTotal)} (loyer ${euro(receivedRent)} · charges ${euro(receivedCharges)})` : ""}
Montant à régulariser : ${euro(missingAmount)}

Si le règlement a déjà été effectué, vous pouvez simplement répondre à cet email avec le justificatif ou la date du virement.

Cordialement,
${landlordName}
    `.trim();

    const sent = await sendEmailViaResend({ to: tenantEmail, subject, html, text, replyTo });
    if (!sent.ok) return res.status(500).json({ error: sent.error || "Erreur envoi relance." });

    try {
      await supabaseAdmin.from("email_logs").insert({
        user_id: userId,
        lease_id: leaseId,
        to_email: tenantEmail,
        subject,
        body_preview: `${reasonLabel(reminderReason)} · ${yyyymm} · reste ${euro(missingAmount)}`,
        sent_at: new Date().toISOString(),
        status: "sent",
      });
    } catch {
      // log non bloquant
    }

    return res.status(200).json({ ok: true, to: tenantEmail, reason: reminderReason, missingAmount });
  } catch (e: any) {
    console.error("[api/payments/reminder] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
