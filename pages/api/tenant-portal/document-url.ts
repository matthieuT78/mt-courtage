import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getTenantPortalAccess, parseStoredPdfUrl } from "../../../lib/tenantPortal";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const kind = String(req.body?.kind || "");
    const documentId = String(req.body?.documentId || "");
    if (!["receipt", "inventory", "lease_contract", "dpe"].includes(kind) || !documentId) {
      return res.status(400).json({ error: "Document invalide." });
    }

    const accesses = await getTenantPortalAccess(auth.userId);
    const tenantIds = accesses.map((access) => access.tenant_id);
    if (tenantIds.length === 0) return res.status(403).json({ error: "Accès refusé." });

    const { data: leases, error: leasesError } = await supabaseAdmin.from("leases").select("id").in("tenant_id", tenantIds);
    if (leasesError) throw leasesError;
    const leaseIds = (leases || []).map((lease: any) => lease.id);
    if (leaseIds.length === 0) return res.status(403).json({ error: "Accès refusé." });

    if (kind === "dpe") {
      const { data: propertyLeases } = await supabaseAdmin.from("leases").select("property_id").in("id", leaseIds);
      const propertyIds = (propertyLeases || []).map((lease: any) => lease.property_id).filter(Boolean);
      const { data: dpe, error: dpeError } = await supabaseAdmin
        .from("property_dpe_documents")
        .select("id,storage_bucket,storage_path")
        .eq("id", documentId)
        .in("property_id", propertyIds)
        .single();
      if (dpeError || !dpe) return res.status(404).json({ error: "DPE introuvable." });
      const { data, error: signedError } = await supabaseAdmin.storage.from(dpe.storage_bucket).createSignedUrl(dpe.storage_path, 60 * 10);
      if (signedError || !data?.signedUrl) return res.status(500).json({ error: signedError?.message || "Ouverture du DPE impossible." });
      return res.status(200).json({ signedUrl: data.signedUrl });
    }

    const table = kind === "receipt" ? "rent_receipts" : kind === "inventory" ? "inventory_reports" : "lease_contract_documents";
    const pdfColumn = kind === "lease_contract" ? "signed_pdf_url" : "pdf_url";
    const { data: document, error } = await supabaseAdmin
      .from(table)
      .select(`id,lease_id,${pdfColumn},status`)
      .eq("id", documentId)
      .in("lease_id", leaseIds)
      .single();
    if (error || !document) return res.status(404).json({ error: "Document introuvable." });
    const pdfUrl = (document as any)[pdfColumn];
    if (!pdfUrl) return res.status(409).json({ error: "PDF indisponible." });

    const parsed = parseStoredPdfUrl(pdfUrl);
    if (!parsed) return res.status(400).json({ error: "Référence PDF invalide." });

    const { data, error: signedError } = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 10);
    if (signedError || !data?.signedUrl) {
      return res.status(500).json({ error: signedError?.message || "Ouverture du document impossible." });
    }

    return res.status(200).json({ signedUrl: data.signedUrl });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Ouverture du document impossible." });
  }
}
