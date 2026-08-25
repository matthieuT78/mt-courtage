import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getServerUserPlan } from "../../../lib/serverPermissions";
import { landlordMaxActiveLeases, planAllowsReceiptAutomation } from "../../../lib/permissions";

type Json = Record<string, any>;

const isMissingRenewalSchema = (error: any) => {
  const message = String(error?.message || error?.details || error || "").toLowerCase();
  return message.includes("auto_renewal_enabled") || message.includes("lease_kind");
};

const withoutRenewalColumns = (payload: Record<string, any>) => {
  const { lease_kind, auto_renewal_enabled, ...rest } = payload;
  return rest;
};

const isMissingTrackingSchema = (error: any) => {
  const message = String(error?.message || error?.details || error || "").toLowerCase();
  return message.includes("tracking_from_date");
};

const withoutTrackingColumns = (payload: Record<string, any>) => {
  const { tracking_from_date, ...rest } = payload;
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
      supabaseAdmin.from("properties").select("id,user_id,type").eq("id", leasePayload.property_id).eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("tenants").select("id,user_id").eq("id", leasePayload.tenant_id).eq("user_id", userId).maybeSingle(),
    ]);

    if (propertyError) return res.status(500).json({ error: propertyError.message });
    if (tenantError) return res.status(500).json({ error: tenantError.message });
    if (!property) return res.status(403).json({ error: "Bien introuvable ou non autorisé." });
    if (!tenant) return res.status(403).json({ error: "Locataire introuvable ou non autorisé." });

    // Un immeuble à lots doit toujours préciser le lot loué — cette règle est déjà
    // appliquée côté client (SectionBaux.tsx) mais doit aussi l'être ici, seule
    // source de vérité pour tout appelant (onboarding, script, etc.).
    if (property.type === "building" && !leasePayload.lot_id) {
      return res.status(400).json({ error: "Veuillez sélectionner le lot loué dans cet immeuble." });
    }

    if (leasePayload.lot_id) {
      const { data: lot, error: lotError } = await supabaseAdmin
        .from("property_lots")
        .select("id,property_id,user_id")
        .eq("id", leasePayload.lot_id)
        .eq("user_id", userId)
        .eq("property_id", leasePayload.property_id)
        .maybeSingle();
      if (lotError) return res.status(500).json({ error: lotError.message });
      if (!lot) return res.status(403).json({ error: "Lot introuvable ou non autorisé." });

      // Un lot ne peut avoir qu'un seul bail actif à la fois — contrairement au bien
      // simple (aucune contrainte équivalente aujourd'hui, volontairement inchangé
      // pour ne rien casser sur l'existant).
      const { data: lotLeases, error: lotLeasesError } = await supabaseAdmin
        .from("leases")
        .select("id,status")
        .eq("lot_id", leasePayload.lot_id);
      if (lotLeasesError) return res.status(500).json({ error: lotLeasesError.message });
      const lotHasActiveLease = (lotLeases || []).some((l) => String(l.status || "").toLowerCase() === "active");
      if (lotHasActiveLease) {
        return res.status(409).json({ error: "Ce lot a déjà un bail actif. Terminez-le avant d’en créer un nouveau." });
      }
    }

    const plan = await getServerUserPlan(String(userId));
    if (!planAllowsReceiptAutomation(plan)) {
      leasePayload.auto_quittance_enabled = false;
      leasePayload.auto_reminder_enabled = false;
    }
    const maxActiveLeases = landlordMaxActiveLeases(plan);
    const { data: existingLeases, error: existingLeasesError } = await supabaseAdmin
      .from("leases")
      .select("id,status")
      .eq("user_id", userId);
    if (existingLeasesError) return res.status(500).json({ error: existingLeasesError.message });
    const activeLeaseCount = (existingLeases || []).filter(
      (l) => String(l.status || "").toLowerCase() === "active"
    ).length;
    if (activeLeaseCount >= maxActiveLeases) {
      return res.status(403).json({
        code: "plan_limit",
        error:
          maxActiveLeases <= 0
            ? "La création de locations nécessite un abonnement lokt.one ou supérieur."
            : `Votre abonnement permet ${maxActiveLeases} location(s) active(s). Passez à l’offre supérieure pour en ajouter davantage.`,
      });
    }

    const inserted = await supabaseAdmin.from("leases").insert(leasePayload).select("id").single();
    if (!inserted.error) return res.status(200).json({ ok: true, id: inserted.data?.id });

    if (isMissingTrackingSchema(inserted.error)) {
      const noTracking = withoutTrackingColumns(leasePayload);
      const fallback2 = await supabaseAdmin.from("leases").insert(noTracking).select("id").single();
      if (!fallback2.error) return res.status(200).json({ ok: true, id: fallback2.data?.id });
      if (!isMissingRenewalSchema(fallback2.error)) return res.status(500).json({ error: fallback2.error.message });
      const fallback3 = await supabaseAdmin.from("leases").insert(withoutRenewalColumns(noTracking)).select("id").single();
      if (fallback3.error) return res.status(500).json({ error: fallback3.error.message });
      return res.status(200).json({ ok: true, id: fallback3.data?.id, renewalSchemaSkipped: true });
    }

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
