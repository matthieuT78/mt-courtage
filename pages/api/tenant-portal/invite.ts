import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getOrCreateTenantThread } from "../../../lib/tenantPortal";
import { sendEmailViaResend } from "../../../lib/mailer/resend";

function tenantPortalRedirectUrl(req: NextApiRequest) {
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const host = forwardedHost || String(req.headers.host || "").trim();
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
  const requestOrigin = host ? `${protocol}://${host}` : "";
  const configured = String(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const configuredIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
  const requestIsPublic = requestOrigin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);
  const origin = requestIsPublic && configuredIsLocal ? requestOrigin : configured || requestOrigin || "https://lokt.fr";
  return `${origin.replace(/\/$/, "")}/espace-locataire/connexion`;
}

async function sendInviteEmail(params: { to: string; tenantName: string; actionLink: string; isNew: boolean; messagingEnabled: boolean }) {
  const { to, tenantName, actionLink, isNew, messagingEnabled } = params;
  const subject = isNew
    ? "Votre espace locataire lokt.fr est pret"
    : "Acces a votre espace locataire lokt.fr";
  const ctaLabel = isNew ? "Creer mon mot de passe" : "Acceder a mon espace";
  const intro = isNew
    ? "Votre bailleur vous invite a acceder a votre espace locataire lokt.fr."
    : "Votre bailleur vous invite a acceder a votre espace locataire lokt.fr.";

  const features = [
    "<li>Consulter et telecharger vos quittances de loyer</li>",
    "<li>Suivre le statut de votre loyer mensuel</li>",
    "<li>Acceder a vos documents de location (bail, EDL, DPE)</li>",
    ...(messagingEnabled ? ["<li>Echanger directement avec votre bailleur</li>"] : []),
  ].join("\n          ");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:ui-sans-serif,system-ui,sans-serif">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">
    <div style="overflow:hidden;border-radius:24px;border:1px solid #e2e8f0;background:#fff">
      <div style="height:6px;background:linear-gradient(90deg,#635bff,#00d4ff,#00e5a8)"></div>
      <div style="padding:32px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
          <span style="display:inline-flex;width:28px;height:28px;border-radius:10px;background:linear-gradient(90deg,#635bff,#00d4ff,#00e5a8);align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700">L</span>
          <span style="font-size:11px;color:#64748b;letter-spacing:0.15em;text-transform:lowercase">lokt.fr</span>
        </div>
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a">Bonjour ${tenantName},</h1>
        <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6">${intro}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">Depuis votre espace vous pouvez :</p>
        <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#475569;line-height:1.8">
          ${features}
        </ul>
        <a href="${actionLink}" style="display:inline-block;border-radius:999px;background:#0f172a;color:#fff;padding:12px 24px;font-size:14px;font-weight:700;text-decoration:none">${ctaLabel}</a>
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">Ce lien est valable 24h. Si vous n'attendiez pas cet email, ignorez-le.</p>
      </div>
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#94a3b8">lokt.fr &mdash; Gestion locative simplifiee</p>
  </div>
</body>
</html>`;

  await sendEmailViaResend({ to, subject, html });
}

async function findUserByEmail(email: string) {
  if (!supabaseAdmin) return null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = (data.users || []).find((row) => String(row.email || "").toLowerCase() === email);
    if (user) return user;
    if ((data.users || []).length < 100) break;
  }
  return null;
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const tenantId = String(req.body?.tenantId || "");
    const messagingEnabled = req.body?.messagingEnabled !== false; // défaut true
    if (!tenantId) return res.status(400).json({ error: "tenantId requis." });

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id,email,full_name,first_name,last_name")
      .eq("id", tenantId)
      .eq("user_id", auth.userId)
      .single();
    if (tenantError || !tenant) return res.status(404).json({ error: "Locataire introuvable." });

    const email = String(tenant.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Ajoutez d’abord l’adresse email du locataire." });

    const tenantName = tenant.full_name || [tenant.first_name, tenant.last_name].filter(Boolean).join(" ") || "Locataire";
    let tenantUser = await findUserByEmail(email);
    let invitationSent = false;
    const redirectTo = tenantPortalRedirectUrl(req);

    if (!tenantUser) {
      // Nouveau locataire : générer lien invitation (sans email Supabase)
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo,
          data: { full_name: tenantName, account_type: "tenant" },
        },
      });
      if (error) throw error;
      tenantUser = data.user;
      const actionLink = (data as any).properties?.action_link || "";
      if (actionLink) {
        await sendInviteEmail({ to: email, tenantName, actionLink, isNew: true, messagingEnabled });
      }
      invitationSent = true;
    } else {
      // Locataire existant : générer lien de récupération pour réinvitation
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (error) throw error;
      const actionLink = (data as any).properties?.action_link || "";
      if (actionLink) {
        await sendInviteEmail({ to: email, tenantName, actionLink, isNew: false, messagingEnabled });
      }
      invitationSent = true;
    }
    if (!tenantUser?.id) throw new Error("Compte locataire introuvable.");

    const now = new Date().toISOString();
    const { data: access, error: accessError } = await supabaseAdmin
      .from("tenant_portal_access")
      .upsert(
        {
          tenant_id: tenant.id,
          landlord_user_id: auth.userId,
          tenant_user_id: tenantUser.id,
          invited_email: email,
          status: "invited",
          messaging_enabled: messagingEnabled,
          invited_at: now,
          updated_at: now,
        },
        { onConflict: "tenant_id" }
      )
      .select("*")
      .single();
    if (accessError) throw accessError;

    const { data: lease } = await supabaseAdmin
      .from("leases")
      .select("id,property_id")
      .eq("user_id", auth.userId)
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await getOrCreateTenantThread({
      landlordUserId: auth.userId,
      tenantId: tenant.id,
      leaseId: lease?.id || null,
      propertyId: lease?.property_id || null,
    });

    return res.status(200).json({
      ok: true,
      access,
      invitationSent,
      message: invitationSent
        ? "Invitation envoyée au locataire."
        : "Accès activé : ce locataire possède déjà un compte lokt.fr.",
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Invitation impossible." });
  }
}
