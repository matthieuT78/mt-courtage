import { buildMessageNotificationEmail } from "./emails/messageNotification";
import { sendEmailViaResend } from "./mailer/resend";
import { supabaseAdmin } from "./supabaseAdmin";

type MessageRole = "landlord" | "tenant";

function displayName(row?: Record<string, any> | null, fallback = "Votre interlocuteur") {
  return (
    String(row?.display_name || row?.full_name || "").trim() ||
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
    fallback
  );
}

function siteUrl(requestBaseUrl?: string | null) {
  return String(requestBaseUrl || process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://lokt.fr").replace(/\/$/, "");
}

export async function notifyNewTenantMessage(params: {
  landlordUserId: string;
  tenantId: string;
  leaseId?: string | null;
  senderRole: MessageRole;
  body: string;
  requestBaseUrl?: string | null;
}) {
  if (!supabaseAdmin) return { ok: false as const, skipped: true, error: "Supabase admin non configuré." };

  const [{ data: tenant, error: tenantError }, { data: landlord, error: landlordError }] = await Promise.all([
    supabaseAdmin.from("tenants").select("id,email,full_name,first_name,last_name").eq("id", params.tenantId).maybeSingle(),
    supabaseAdmin.from("landlords").select("user_id,display_name").eq("user_id", params.landlordUserId).maybeSingle(),
  ]);
  if (tenantError) throw tenantError;
  if (landlordError) throw landlordError;

  let to = "";
  let recipientName = "";
  let senderName = "";
  let messageUrl = "";

  if (params.senderRole === "landlord") {
    const { data: access, error } = await supabaseAdmin
      .from("tenant_portal_access")
      .select("invited_email")
      .eq("landlord_user_id", params.landlordUserId)
      .eq("tenant_id", params.tenantId)
      .in("status", ["invited", "active"])
      .maybeSingle();
    if (error) throw error;

    to = String(access?.invited_email || tenant?.email || "").trim().toLowerCase();
    recipientName = displayName(tenant, "Locataire");
    senderName = displayName(landlord, "Votre bailleur");
    messageUrl = `${siteUrl(params.requestBaseUrl)}/espace-locataire?tab=messagerie`;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(params.landlordUserId);
    if (error) throw error;

    to = String(data.user?.email || "").trim().toLowerCase();
    recipientName = displayName(landlord, "Bailleur");
    senderName = displayName(tenant, "Votre locataire");
    messageUrl = `${siteUrl(params.requestBaseUrl)}/espace-bailleur?tab=messagerie`;
  }

  if (!to) return { ok: false as const, skipped: true, error: "Adresse email du destinataire manquante." };

  const email = buildMessageNotificationEmail({
    recipientName,
    senderName,
    messagePreview: params.body,
    messageUrl,
  });
  const sent = await sendEmailViaResend({ to, subject: email.subject, html: email.html, text: email.text });

  try {
    await supabaseAdmin.from("email_logs").insert({
      user_id: params.landlordUserId,
      lease_id: params.leaseId || null,
      to_email: to,
      subject: email.subject,
      body_preview: email.preview,
      sent_at: new Date().toISOString(),
      status: sent.ok ? "sent" : "error",
      error_message: sent.ok ? null : sent.error,
    });
  } catch {
    // Le journal d'email ne doit jamais bloquer la messagerie.
  }

  return sent.ok ? { ok: true as const, to } : { ok: false as const, skipped: false, error: sent.error };
}
