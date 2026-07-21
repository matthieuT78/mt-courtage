// pages/api/inventory/cleanup-superseded-pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { invalidateStorageCache } from "../../../lib/storageQuota";

const INVENTORY_BUCKET = "inventory-pdfs";

function parseStoredUrl(value?: string | null) {
  const raw = String(value || "");
  const index = raw.indexOf(":");
  if (index < 1) return null;
  return { bucket: raw.slice(0, index), path: raw.slice(index + 1) };
}

// Supprime l'ancien PDF d'un état des lieux une fois remplacé par un import externe ou
// une nouvelle génération — sinon l'ancien fichier reste orphelin en stockage indéfiniment
// (doublon silencieux, découvert en auditant un compte de test avec un quota anormalement élevé).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, reportId, previousPdfUrl } = (req.body || {}) as {
      userId?: string;
      reportId?: string;
      previousPdfUrl?: string | null;
    };
    if (!userId) return res.status(400).json({ error: "userId requis." });
    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!reportId) return res.status(400).json({ error: "reportId requis." });
    if (!previousPdfUrl) return res.status(200).json({ ok: true, skipped: "no_previous_pdf" });

    const { data: report } = await supabaseAdmin.from("inventory_reports").select("id,user_id,pdf_url").eq("id", reportId).maybeSingle();
    if (!report || String(report.user_id) !== String(userId)) return res.status(403).json({ error: "Accès refusé." });

    // Ne supprime jamais le PDF actuellement référencé — seulement une ancienne version déjà remplacée.
    if (report.pdf_url && String(report.pdf_url) === String(previousPdfUrl)) {
      return res.status(200).json({ ok: true, skipped: "still_current" });
    }

    const parsed = parseStoredUrl(previousPdfUrl);
    if (!parsed || parsed.bucket !== INVENTORY_BUCKET) {
      return res.status(200).json({ ok: true, skipped: "not_inventory_bucket" });
    }

    await supabaseAdmin.storage.from(INVENTORY_BUCKET).remove([parsed.path]);
    invalidateStorageCache(String(userId));
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[api/inventory/cleanup-superseded-pdf] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
