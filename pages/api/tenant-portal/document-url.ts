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
    if (!["receipt", "inventory"].includes(kind) || !documentId) {
      return res.status(400).json({ error: "Document invalide." });
    }

    const accesses = await getTenantPortalAccess(auth.userId);
    const tenantIds = accesses.map((access) => access.tenant_id);
    if (tenantIds.length === 0) return res.status(403).json({ error: "Accès refusé." });

    const { data: leases, error: leasesError } = await supabaseAdmin.from("leases").select("id").in("tenant_id", tenantIds);
    if (leasesError) throw leasesError;
    const leaseIds = (leases || []).map((lease: any) => lease.id);
    if (leaseIds.length === 0) return res.status(403).json({ error: "Accès refusé." });

    const table = kind === "receipt" ? "rent_receipts" : "inventory_reports";
    const { data: document, error } = await supabaseAdmin
      .from(table)
      .select("id,lease_id,pdf_url,status")
      .eq("id", documentId)
      .in("lease_id", leaseIds)
      .single();
    if (error || !document) return res.status(404).json({ error: "Document introuvable." });
    if (!document.pdf_url) return res.status(409).json({ error: "PDF indisponible." });

    const parsed = parseStoredPdfUrl(document.pdf_url);
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
