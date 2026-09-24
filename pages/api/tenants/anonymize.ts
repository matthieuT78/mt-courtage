// pages/api/tenants/anonymize.ts
//
// Point 2 du chantier RGPD : un locataire archivé qui a un historique de
// bail ne peut pas être supprimé (voir SectionLocataires.tsx, deleteTenant)
// car les quittances/baux/écritures comptables ont besoin d'un tenant_id
// valide. Cette route efface ses données personnelles à la place, en
// gardant la ligne. Révoque aussi son accès à l'espace locataire : une
// fois le nom/email effacés, un accès portail actif n'a plus de sens
// (voir discussion produit — action volontaire du bailleur, avertissement
// affiché côté client avant confirmation).
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const tenantId = String(req.body?.tenantId || "");
  if (!tenantId) return res.status(400).json({ error: "tenantId requis." });

  try {
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, archived_at, anonymized_at, is_company")
      .eq("id", tenantId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (tenantError) throw tenantError;
    if (!tenant) return res.status(404).json({ error: "Locataire introuvable." });

    if (tenant.anonymized_at) {
      return res.status(200).json({ ok: true, already_anonymized: true });
    }
    if (!tenant.archived_at) {
      return res.status(409).json({ error: "Seul un locataire archivé peut être anonymisé." });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("tenants")
      .update({
        full_name: "Locataire anonymisé",
        first_name: null,
        last_name: null,
        email: null,
        phone: null,
        notes: null,
        company_name: null,
        siret: null,
        legal_representative_name: null,
        guarantor_type: null,
        visale_number: null,
        guarantor_first_name: null,
        guarantor_last_name: null,
        guarantor_email: null,
        guarantor_phone: null,
        guarantor_address_line1: null,
        guarantor_postal_code: null,
        guarantor_city: null,
        anonymized_at: now,
        updated_at: now,
      })
      .eq("id", tenantId)
      .eq("user_id", auth.userId);
    if (updateError) throw updateError;

    const { error: portalError } = await supabaseAdmin
      .from("tenant_portal_access")
      .update({ status: "revoked", access_until: now, updated_at: now })
      .eq("tenant_id", tenantId)
      .eq("landlord_user_id", auth.userId)
      .in("status", ["invited", "active"]);
    if (portalError) throw portalError;

    return res.status(200).json({ ok: true, already_anonymized: false });
  } catch (e: any) {
    console.error("[tenants/anonymize] error:", e?.message);
    return res.status(500).json({ error: e?.message || "Anonymisation impossible." });
  }
}
