// pages/api/tenant-portal/acknowledge.ts
//
// Enregistre un accusé de réception locataire pour un document (bail ou EDL).
//
// Migration Supabase requise :
//   CREATE TABLE IF NOT EXISTS document_acknowledgments (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     landlord_user_id uuid NOT NULL,
//     document_type text NOT NULL CHECK (document_type IN ('lease_contract', 'inventory_report')),
//     document_id uuid NOT NULL,
//     tenant_id uuid,
//     tenant_email text,
//     acknowledged_at timestamptz NOT NULL DEFAULT now(),
//     UNIQUE(document_type, document_id)
//   );
//   CREATE INDEX IF NOT EXISTS idx_doc_ack_landlord ON document_acknowledgments(landlord_user_id);
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getTenantPortalAccess } from "../../../lib/tenantPortal";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

    const { documentType, documentId } = req.body || {};
    if (!documentType || !documentId) {
      return res.status(400).json({ ok: false, error: "documentType et documentId requis." });
    }
    if (!["lease_contract", "inventory_report"].includes(documentType)) {
      return res.status(400).json({ ok: false, error: "documentType invalide." });
    }

    // Fetch tenant portal accesses for this user
    const accesses = await getTenantPortalAccess(auth.userId);
    if (accesses.length === 0) {
      return res.status(403).json({ ok: false, error: "Aucun accès locataire pour ce compte." });
    }

    const tenantIds = accesses.map((a) => a.tenant_id);
    const landlordUserIds = Array.from(new Set(accesses.map((a) => a.landlord_user_id)));

    // Verify document belongs to one of the tenant's leases
    let landlordUserId: string | null = null;
    let tenantId: string | null = null;
    let tenantEmail: string | null = null;

    if (documentType === "lease_contract") {
      const { data: doc } = await supabaseAdmin
        .from("lease_contract_documents")
        .select("lease_id, user_id")
        .eq("id", documentId)
        .in("user_id", landlordUserIds)
        .maybeSingle();
      if (!doc) return res.status(404).json({ ok: false, error: "Document introuvable." });

      const { data: lease } = await supabaseAdmin
        .from("leases")
        .select("tenant_id, user_id")
        .eq("id", doc.lease_id)
        .in("tenant_id", tenantIds)
        .maybeSingle();
      if (!lease) return res.status(403).json({ ok: false, error: "Accès refusé." });

      landlordUserId = doc.user_id;
      tenantId = lease.tenant_id;
    } else {
      const { data: report } = await supabaseAdmin
        .from("inventory_reports")
        .select("lease_id, user_id")
        .eq("id", documentId)
        .in("user_id", landlordUserIds)
        .maybeSingle();
      if (!report) return res.status(404).json({ ok: false, error: "Document introuvable." });

      const { data: lease } = await supabaseAdmin
        .from("leases")
        .select("tenant_id")
        .eq("id", report.lease_id)
        .in("tenant_id", tenantIds)
        .maybeSingle();
      if (!lease) return res.status(403).json({ ok: false, error: "Accès refusé." });

      landlordUserId = report.user_id;
      tenantId = lease.tenant_id;
    }

    // Fetch tenant email
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("email")
      .eq("id", tenantId)
      .maybeSingle();
    tenantEmail = tenant?.email || auth.email || null;

    // Upsert acknowledgment
    const { error: ackErr } = await supabaseAdmin.from("document_acknowledgments" as any).upsert(
      {
        landlord_user_id: landlordUserId,
        document_type: documentType,
        document_id: documentId,
        tenant_id: tenantId,
        tenant_email: tenantEmail,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: "document_type,document_id" }
    );

    if (ackErr) {
      console.error("[acknowledge] upsert error:", ackErr.message);
      // Table may not exist yet — return ok anyway so UX doesn't break
      return res.status(200).json({ ok: true, persisted: false, migrationNeeded: true });
    }

    return res.status(200).json({ ok: true, persisted: true });
  } catch (e: any) {
    console.error("[acknowledge] error:", e?.message);
    return res.status(500).json({ ok: false, error: e?.message || "Erreur interne" });
  }
}
