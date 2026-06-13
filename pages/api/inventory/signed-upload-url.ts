// pages/api/inventory/signed-upload-url.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { getUserStorageUsage } from "../../../lib/storageQuota";

const INVENTORY_BUCKET = "inventory-pdfs";
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function buildPdfPath(opts: { reportId: string; userId: string; leaseId?: string | null; kind: "signed" | "external" }) {
  return `inventory/${opts.userId}/${opts.leaseId || "standalone"}/${opts.reportId}.${opts.kind}.pdf`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, reportId, kind: rawKind, sizeBytes: rawSizeBytes } = (req.body || {}) as {
      userId?: string;
      reportId?: string;
      kind?: string;
      sizeBytes?: number;
    };
    if (!userId) return res.status(400).json({ error: "userId requis." });
    if (!reportId) return res.status(400).json({ error: "reportId requis." });
    const kind = rawKind === "external" ? "external" : "signed";
    const sizeBytes = Number(rawSizeBytes || 0);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return res.status(400).json({ error: "Taille du PDF requise." });
    if (sizeBytes > MAX_PDF_BYTES) return res.status(400).json({ error: "PDF trop volumineux : 10 Mo maximum." });

    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

    const reportRes = await supabaseAdmin.from("inventory_reports").select("id,user_id,lease_id,status").eq("id", reportId).single();
    if (reportRes.error || !reportRes.data) return res.status(404).json({ error: "État des lieux introuvable." });
    const report: any = reportRes.data;
    if (report.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });
    if (String(report.status || "") === "archived") return res.status(400).json({ error: "Document archivé : import impossible." });

    const usage = await getUserStorageUsage(userId);
    if (sizeBytes > usage.availableBytes) {
      return res.status(413).json({ error: "Espace de stockage insuffisant pour importer ce PDF." });
    }

    const path = buildPdfPath({ reportId, userId, leaseId: report.lease_id, kind });
    const signed = await supabaseAdmin.storage.from(INVENTORY_BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (signed.error || !signed.data) return res.status(500).json({ error: signed.error?.message || "URL d’upload impossible." });

    return res.status(200).json({ ok: true, bucket: INVENTORY_BUCKET, path, token: signed.data.token });
  } catch (e: any) {
    console.error("[api/inventory/signed-upload-url] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
