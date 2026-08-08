import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { parseStoredLeaseContractUrl } from "../../../lib/leaseContract";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { buildBailLocataireEmailHtml, buildBailLocataireEmailText } from "../../../lib/emails/bail-locataire";
import { getServerUserPlan } from "../../../lib/serverPermissions";
import { planAllowsDocumentSharing } from "../../../lib/permissions";

const PORTAL_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lokt.fr";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

    const { userId, documentId } = req.body || {};
    if (!userId || !documentId) return res.status(400).json({ ok: false, error: "userId et documentId requis." });

    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ ok: false, error: userCheck.error });

    const plan = await getServerUserPlan(String(userId));
    if (!planAllowsDocumentSharing(plan)) {
      return res.status(403).json({ ok: false, error: "Le partage de documents avec le locataire nécessite un abonnement lokt.one ou supérieur." });
    }

    // Fetch document + verify ownership
    const { data: doc } = await supabaseAdmin
      .from("lease_contract_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!doc) return res.status(404).json({ ok: false, error: "Contrat introuvable." });

    const pdfRef = doc.signed_pdf_url || doc.external_pdf_url || doc.pdf_url;
    if (!pdfRef) return res.status(409).json({ ok: false, error: "Aucun PDF disponible pour ce contrat." });

    // Fetch lease → tenant
    const { data: lease } = await supabaseAdmin
      .from("leases")
      .select("id,tenant_id,property_id")
      .eq("id", doc.lease_id)
      .maybeSingle();
    if (!lease) return res.status(404).json({ ok: false, error: "Bail introuvable." });

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("full_name,email")
      .eq("id", lease.tenant_id)
      .maybeSingle();
    if (!tenant?.email) return res.status(400).json({ ok: false, error: "Email du locataire manquant." });

    // Fetch property for label/address
    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("label,address_line1,postal_code,city")
      .eq("id", lease.property_id)
      .maybeSingle();

    const propertyLabel = property?.label || property?.address_line1 || "Logement";
    const propertyAddress = [property?.address_line1, [property?.postal_code, property?.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");

    // Get a signed URL (long-lived, 7 days) to embed in email
    const parsed = parseStoredLeaseContractUrl(pdfRef);
    let pdfSignedUrl: string | null = null;
    if (parsed) {
      const { data: signed } = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60 * 24 * 7);
      pdfSignedUrl = signed?.signedUrl || null;
    }

    // Build email
    const html = buildBailLocataireEmailHtml({
      tenantName: tenant.full_name || "",
      propertyLabel,
      propertyAddress,
      documentKind: kindLabel(doc.contract_kind),
      portalUrl: `${PORTAL_URL}/espace-locataire`,
    });
    const text = buildBailLocataireEmailText({
      tenantName: tenant.full_name || "",
      propertyLabel,
      propertyAddress,
      documentKind: kindLabel(doc.contract_kind),
      portalUrl: `${PORTAL_URL}/espace-locataire`,
    });

    const result = await sendEmailViaResend({
      to: tenant.email,
      subject: `Votre contrat de location — ${propertyLabel} | lokt.fr`,
      html,
      text,
      replyTo: "contact@lokt.fr",
    });

    if (!result.ok) return res.status(500).json({ ok: false, error: result.error });

    // Track sharing (column may not exist yet — handled gracefully)
    try {
      await supabaseAdmin
        .from("lease_contract_documents")
        .update({ shared_with_tenant_at: new Date().toISOString(), shared_to_tenant_email: tenant.email } as any)
        .eq("id", documentId);
    } catch {
      // migration not yet applied — non-blocking
    }

    return res.status(200).json({ ok: true, sentTo: tenant.email, pdfSignedUrl });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Erreur interne" });
  }
}

function kindLabel(kind: string | null) {
  const map: Record<string, string> = {
    empty_primary: "Location vide — résidence principale",
    furnished_primary: "Location meublée — résidence principale",
    furnished_student: "Location meublée — étudiant 9 mois",
    mobility: "Bail mobilité",
    professional: "Bail professionnel (profession libérale)",
  };
  return map[kind || ""] || "Contrat de location";
}
