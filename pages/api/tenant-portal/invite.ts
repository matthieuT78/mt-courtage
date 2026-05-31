import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getOrCreateTenantThread } from "../../../lib/tenantPortal";

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

    let tenantUser = await findUserByEmail(email);
    let invitationSent = false;
    if (!tenantUser) {
      const redirectTo = `${String(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://lokt.fr").replace(/\/$/, "")}/espace-locataire`;
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          full_name: tenant.full_name || [tenant.first_name, tenant.last_name].filter(Boolean).join(" ") || "Locataire",
          account_type: "tenant",
        },
      });
      if (error) throw error;
      tenantUser = data.user;
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
