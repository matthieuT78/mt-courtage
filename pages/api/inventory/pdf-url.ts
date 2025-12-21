import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ======================================================
    // METHOD
    // ======================================================
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase admin non configuré." });
    }

    // ======================================================
    // PARAMS
    // ======================================================
    const reportId = String(req.query.reportId || "");
    const userId = String(req.query.userId || "");

    if (!reportId || !userId) {
      return res.status(400).json({ error: "reportId et userId requis." });
    }

    // ======================================================
    // FETCH REPORT
    // ======================================================
    const { data: report, error: reportErr } = await supabaseAdmin
      .from("inventory_reports")
      .select("id,user_id,pdf_url")
      .eq("id", reportId)
      .single();

    if (reportErr || !report) {
      return res.status(404).json({ error: "Report introuvable." });
    }

    if (report.user_id !== userId) {
      return res.status(403).json({ error: "Accès refusé." });
    }

    if (!report.pdf_url) {
      return res.status(400).json({ error: "Aucun PDF généré pour ce report." });
    }

    // ======================================================
    // PARSE STORAGE PATH
    // pdf_url format: "inventory-pdfs:path/to/file.pdf"
    // ======================================================
    const raw = String(report.pdf_url);
    const sepIndex = raw.indexOf(":");

    if (sepIndex === -1) {
      return res.status(400).json({ error: "pdf_url invalide." });
    }

    const bucket = raw.slice(0, sepIndex);
    const path = raw.slice(sepIndex + 1);

    if (!bucket || !path) {
      return res.status(400).json({ error: "pdf_url invalide." });
    }

    // ======================================================
    // SIGNED URL
    // ======================================================
    const { data, error: signErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10); // 10 minutes

    if (signErr || !data?.signedUrl) {
      return res.status(500).json({ error: signErr?.message || "Impossible de signer l’URL." });
    }

    // ======================================================
    // OK
    // ======================================================
    return res.status(200).json({
      signedUrl: data.signedUrl,
      expiresIn: 600,
    });
  } catch (e: any) {
    console.error("[api/inventory/pdf-url] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne serveur." });
  }
}
