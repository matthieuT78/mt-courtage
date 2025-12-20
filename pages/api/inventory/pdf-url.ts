import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const reportId = String(req.query.reportId || "");
  const userId = String(req.query.userId || "");
  if (!reportId || !userId) return res.status(400).json({ error: "reportId et userId requis." });

  const { data: report, error } = await supabaseAdmin
    .from("inventory_reports")
    .select("id,user_id,pdf_url")
    .eq("id", reportId)
    .single();

  if (error || !report) return res.status(404).json({ error: "Report introuvable." });
  if (report.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });
  if (!report.pdf_url) return res.status(400).json({ error: "Aucun PDF généré pour ce report." });

  // pdf_url stocké sous la forme "inventory-pdfs:path"
  const [bucket, ...rest] = String(report.pdf_url).split(":");
  const path = rest.join(":");
  if (!bucket || !path) return res.status(400).json({ error: "pdf_url invalide." });

  const { data, error: signErr } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (signErr) return res.status(500).json({ error: signErr.message });

  return res.status(200).json({ signedUrl: data.signedUrl });
}
