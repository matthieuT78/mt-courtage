import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type Json = Record<string, any>;

const isMissingRenewalSchema = (error: any) => {
  const message = String(error?.message || error?.details || error || "").toLowerCase();
  return message.includes("auto_renewal_enabled") || message.includes("lease_kind");
};

const withoutRenewalColumns = (payload: Record<string, any>) => {
  const { lease_kind, auto_renewal_enabled, ...rest } = payload;
  return rest;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, payload } = (req.body || {}) as { userId?: string; payload?: Record<string, any> };
    if (!userId) return res.status(400).json({ error: "userId requis." });
    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!payload || typeof payload !== "object") return res.status(400).json({ error: "payload requis." });

    const leasePayload: Record<string, any> = {
      ...payload,
      user_id: String(userId),
      updated_at: payload.updated_at || new Date().toISOString(),
    };

    if (!leasePayload.property_id || !leasePayload.tenant_id || !leasePayload.start_date) {
      return res.status(400).json({ error: "Bien, locataire et date de début requis." });
    }

    const [{ data: property, error: propertyError }, { data: tenant, error: tenantError }] = await Promise.all([
      supabaseAdmin.from("properties").select("id,user_id").eq("id", leasePayload.property_id).eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("tenants").select("id,user_id").eq("id", leasePayload.tenant_id).eq("user_id", userId).maybeSingle(),
    ]);

    if (propertyError) return res.status(500).json({ error: propertyError.message });
    if (tenantError) return res.status(500).json({ error: tenantError.message });
    if (!property) return res.status(403).json({ error: "Bien introuvable ou non autorisé." });
    if (!tenant) return res.status(403).json({ error: "Locataire introuvable ou non autorisé." });

    const inserted = await supabaseAdmin.from("leases").insert(leasePayload).select("id").single();
    if (!inserted.error) return res.status(200).json({ ok: true, id: inserted.data?.id });

    if (!isMissingRenewalSchema(inserted.error)) {
      return res.status(500).json({ error: inserted.error.message });
    }

    const fallbackPayload = withoutRenewalColumns(leasePayload);
    const fallback = await supabaseAdmin.from("leases").insert(fallbackPayload).select("id").single();
    if (fallback.error) return res.status(500).json({ error: fallback.error.message });

    return res.status(200).json({ ok: true, id: fallback.data?.id, renewalSchemaSkipped: true });
  } catch (e: any) {
    console.error("[api/landlord/leases] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
