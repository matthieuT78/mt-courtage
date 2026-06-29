import { sendEmailViaResend } from "./mailer/resend";
import { userCanUseReceiptAutomation } from "./serverPermissions";
import { supabaseAdmin } from "./supabaseAdmin";
import { getOrCreateTenantThread, getTenantPortalAccessForLandlord } from "./tenantPortal";
import { getLeaseRentPeriodFromDate } from "./rentPeriod";

export type TenantPaymentReminderReason = "unpaid" | "partial";
export type TenantPaymentReminderChannel = "email" | "messaging";

const safeStr = (value: unknown) => String(value ?? "").trim();
const euro = (value: unknown) => Number(value || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));

function formatDateFR(value: string) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR");
}

function reasonLabel(reason: TenantPaymentReminderReason) {
  if (reason === "partial") return "paiement incomplet";
  return "loyer non reçu";
}

export async function getTenantPaymentReminderContext(params: {
  userId: string;
  leaseId: string;
  periodStart: string;
  periodEnd: string;
  reason: TenantPaymentReminderReason;
}) {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");
  if (!(await userCanUseReceiptAutomation(params.userId))) {
    throw new Error("Les relances locataire sont réservées aux abonnements lokt·one et lokt·plus.");
  }

  const { data: lease, error: leaseError } = await supabaseAdmin.from("leases").select("*").eq("id", params.leaseId).single();
  if (leaseError || !lease) throw new Error("Bail introuvable.");
  if (String(lease.user_id) !== params.userId) throw new Error("Accès refusé.");

  const [{ data: tenant }, { data: property }, { data: landlord }, { data: payment }, portalAccess] = await Promise.all([
    supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).maybeSingle(),
    supabaseAdmin.from("properties").select("*").eq("id", lease.property_id).maybeSingle(),
    supabaseAdmin.from("landlords").select("*").eq("user_id", params.userId).maybeSingle(),
    supabaseAdmin.from("rent_payments").select("*").eq("lease_id", params.leaseId).eq("period_start", params.periodStart).eq("period_end", params.periodEnd).maybeSingle(),
    getTenantPortalAccessForLandlord(params.userId, String(lease.tenant_id)),
  ]);

  const rentPeriod = getLeaseRentPeriodFromDate(lease, params.periodStart);
  if (!rentPeriod) throw new Error("Cette période est en dehors des dates du bail.");
  const receivedRent = Number((payment as any)?.rent_amount || 0);
  const receivedCharges = Number((payment as any)?.charges_amount || 0);
  const receivedTotal = Number((payment as any)?.total_amount || 0);
  const missingAmount = Math.max(0, rentPeriod.total - receivedTotal);
  if (missingAmount <= 0.01) throw new Error("Aucun montant restant à régulariser pour cette période.");

  const tenantEmail = safeStr(lease.tenant_receipt_email) || safeStr((tenant as any)?.email);
  const tenantName = safeStr((tenant as any)?.full_name);
  const landlordName = safeStr((landlord as any)?.display_name) || "Votre bailleur";
  const replyTo = safeStr((landlord as any)?.email) || safeStr(lease.reminder_email) || "contact@lokt.fr";
  const propertyLabel =
    safeStr((property as any)?.label) ||
    [safeStr((property as any)?.address_line1), safeStr((property as any)?.postal_code), safeStr((property as any)?.city)].filter(Boolean).join(", ") ||
    "le logement";

  return {
    lease,
    tenantEmail,
    tenantName,
    landlordName,
    replyTo,
    propertyLabel,
    rentPeriod,
    receivedRent,
    receivedCharges,
    receivedTotal,
    missingAmount,
    messagingAvailable: !!portalAccess && portalAccess.status !== "revoked",
  };
}

export function buildTenantPaymentReminderContent(
  context: Awaited<ReturnType<typeof getTenantPaymentReminderContext>>,
  params: { reason: TenantPaymentReminderReason; periodStart: string; periodEnd: string }
) {
  const { reason, periodStart, periodEnd } = params;
  const explanation =
    reason === "partial"
      ? "Nous avons bien identifié un règlement partiel, mais le montant reçu ne couvre pas encore la totalité du loyer et des charges."
      : "Sauf erreur de notre part, le règlement du loyer et des charges de cette période n’a pas encore été confirmé.";
  const subject =
    reason === "partial"
      ? `Solde de loyer restant dû - ${periodStart.slice(0, 7)}`
      : `Relance loyer - ${periodStart.slice(0, 7)}`;
  const body = `${context.tenantName ? `Bonjour ${context.tenantName},` : "Bonjour,"}

${explanation}

Logement : ${context.propertyLabel}
Période : du ${formatDateFR(periodStart)} au ${formatDateFR(periodEnd)}
Loyer hors charges : ${euro(context.rentPeriod.rent)}
Charges : ${euro(context.rentPeriod.charges)}
Total attendu : ${euro(context.rentPeriod.total)}
${context.receivedTotal > 0 ? `Total identifié : ${euro(context.receivedTotal)} (loyer ${euro(context.receivedRent)} · charges ${euro(context.receivedCharges)})\n` : ""}Montant à régulariser : ${euro(context.missingAmount)}

Si le règlement a déjà été effectué, merci de nous transmettre le justificatif ou la date du virement.

Cordialement,
${context.landlordName}`;
  return { subject, body };
}

export async function sendTenantPaymentReminder(params: {
  userId: string;
  leaseId: string;
  periodStart: string;
  periodEnd: string;
  reason: TenantPaymentReminderReason;
  channels: TenantPaymentReminderChannel[];
  body?: string;
  triggerType: "manual" | "automatic";
}) {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");
  const context = await getTenantPaymentReminderContext(params);
  const generated = buildTenantPaymentReminderContent(context, params);
  const body = safeStr(params.body) || generated.body;
  const channels = Array.from(new Set(params.channels));
  if (!channels.length) throw new Error("Choisis au moins un canal de relance.");

  const outcomes: Array<{ channel: TenantPaymentReminderChannel; ok: boolean; error?: string }> = [];
  if (channels.includes("email")) {
    if (!context.tenantEmail) {
      outcomes.push({ channel: "email", ok: false, error: "Email locataire manquant." });
    } else {
      const mail = await sendEmailViaResend({
        to: context.tenantEmail,
        replyTo: context.replyTo,
        subject: generated.subject,
        text: body,
        html: `<div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.55;color:#0f172a">${esc(body).replace(/\n/g, "<br/>")}<p style="margin-top:18px;color:#64748b;font-size:12px">Relance amiable préparée depuis lokt.fr.</p></div>`,
      });
      outcomes.push({ channel: "email", ok: mail.ok, error: mail.ok ? undefined : mail.error });
      if (mail.ok) {
        try {
          await supabaseAdmin.from("email_logs").insert({
            user_id: params.userId,
            lease_id: params.leaseId,
            to_email: context.tenantEmail,
            subject: generated.subject,
            body_preview: `${reasonLabel(params.reason)} · ${params.periodStart.slice(0, 7)} · reste ${euro(context.missingAmount)}`,
            sent_at: new Date().toISOString(),
            status: "sent",
          });
        } catch {
          // Le journal email existant ne doit pas bloquer une relance déjà envoyée.
        }
      }
    }
  }

  if (channels.includes("messaging")) {
    if (!context.messagingAvailable) {
      outcomes.push({ channel: "messaging", ok: false, error: "Portail locataire non activé." });
    } else {
      try {
        const thread = await getOrCreateTenantThread({
          landlordUserId: params.userId,
          tenantId: String(context.lease.tenant_id),
          propertyId: context.lease.property_id,
          leaseId: params.leaseId,
        });
        const { error } = await supabaseAdmin.from("tenant_messages").insert({
          thread_id: thread.id,
          sender_user_id: params.userId,
          sender_role: "landlord",
          body,
        });
        if (error) throw error;
        await supabaseAdmin.from("tenant_message_threads").update({ updated_at: new Date().toISOString() }).eq("id", thread.id);
        outcomes.push({ channel: "messaging", ok: true });
      } catch (error: any) {
        outcomes.push({ channel: "messaging", ok: false, error: error?.message || "Erreur messagerie." });
      }
    }
  }

  const sentCount = outcomes.filter((item) => item.ok).length;
  const status = sentCount === channels.length ? "sent" : sentCount > 0 ? "partial" : "failed";
  const errorMessage = outcomes.filter((item) => !item.ok).map((item) => `${item.channel}: ${item.error}`).join(" · ") || null;
  const { error: historyError } = await supabaseAdmin.from("tenant_payment_reminder_sends").insert({
    user_id: params.userId,
    lease_id: params.leaseId,
    period_start: params.periodStart,
    period_end: params.periodEnd,
    reason: params.reason,
    trigger_type: params.triggerType,
    channels,
    subject: generated.subject,
    body,
    missing_amount: context.missingAmount,
    status,
    error_message: errorMessage,
  });
  if (historyError) throw historyError;
  if (!sentCount) throw new Error(errorMessage || "Aucune relance n’a pu être envoyée.");
  return { ok: status === "sent", status, outcomes, missingAmount: context.missingAmount };
}
