// pages/api/receipts/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import PDFDocument from "pdfkit";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type Json = Record<string, any>;
const toISODate = (d: Date) => d.toISOString().slice(0, 10);

function buildPdfBuffer(build: (doc: PDFDocument) => Promise<void>) {
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (e) => reject(e));
      await build(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const { userId, leaseId, periodStart, periodEnd, contentText } = (req.body || {}) as {
      userId?: string;
      leaseId?: string;
      periodStart?: string;
      periodEnd?: string;
      contentText?: string;
    };

    if (!userId) return res.status(400).json({ error: "userId requis." });
    if (!leaseId || !periodStart || !periodEnd) return res.status(400).json({ error: "leaseId + periodStart + periodEnd requis." });

    // lease
    const leaseRes = await supabaseAdmin.from("leases").select("*").eq("id", leaseId).single();
    if (leaseRes.error || !leaseRes.data) return res.status(404).json({ error: "Bail introuvable." });
    const lease: any = leaseRes.data;
    if (lease.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });

    const rent = Number(lease.rent_amount || 0);
    const charges = Number(lease.charges_amount || 0);
    const total = rent + charges;

    // receipt exist ?
    let receipt: any = null;
    const existing = await supabaseAdmin
      .from("rent_receipts")
      .select("*")
      .eq("lease_id", leaseId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (existing.data) {
      const upd = await supabaseAdmin
        .from("rent_receipts")
        .update({
          content_text: contentText || existing.data.content_text,
          edited_at: contentText ? new Date().toISOString() : existing.data.edited_at,
          issue_date: toISODate(new Date()),
          status: existing.data.status || "generated",
        })
        .eq("id", existing.data.id)
        .select("*")
        .single();

      if (upd.error || !upd.data) return res.status(500).json({ error: upd.error?.message || "Update quittance échoué." });
      receipt = upd.data;
    } else {
      const ins = await supabaseAdmin
        .from("rent_receipts")
        .insert({
          lease_id: leaseId,
          period_start: periodStart,
          period_end: periodEnd,
          rent_amount: rent,
          charges_amount: charges,
          total_amount: total,
          issue_date: toISODate(new Date()),
          issued_at: new Date().toISOString(),
          content_text: contentText || "",
          status: "generated",
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (ins.error || !ins.data) return res.status(500).json({ error: ins.error?.message || "Création quittance échouée." });
      receipt = ins.data;
    }

    // PDF
    const pdf = await buildPdfBuffer(async (doc) => {
      doc.fontSize(14).text("QUITTANCE DE LOYER", { align: "center" });
      doc.moveDown(0.8);
      doc
        .fontSize(9)
        .fillColor("#444")
        .text(`Période : ${receipt.period_start} → ${receipt.period_end} • Émise le : ${receipt.issue_date}`, { align: "center" });
      doc.moveDown(1);
      doc.fillColor("#111");
      doc.fontSize(10).text((receipt.content_text || "").trim() || "—", { align: "left" });
      doc.moveDown(2);
      doc.fillColor("#666").fontSize(8).text("Document généré par ImmoPilot", { align: "center" });
    });

    // upload storage
    const yyyymm = String(receipt.period_start || "").slice(0, 7) || toISODate(new Date()).slice(0, 7);
    const filename = `quittance-${yyyymm}.pdf`;
    const storagePath = `${userId}/${receipt.lease_id}/${receipt.id}/${filename}`;

    const up = await supabaseAdmin.storage.from("rent-receipts-pdfs").upload(storagePath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) return res.status(500).json({ error: `Upload PDF échoué: ${up.error.message}` });

    const pdfUrl = `rent-receipts-pdfs:${storagePath}`;

    const upd2 = await supabaseAdmin
      .from("rent_receipts")
      .update({
        pdf_url: pdfUrl,
        status: receipt.status || "generated",
        updated_at: new Date().toISOString(),
      })
      .eq("id", receipt.id);

    if (upd2.error) return res.status(500).json({ error: `Update quittance échoué: ${upd2.error.message}` });

    const signed = await supabaseAdmin.storage.from("rent-receipts-pdfs").createSignedUrl(storagePath, 60 * 10);
    return res.status(200).json({
      ok: true,
      receipt_id: receipt.id,
      pdf_url: pdfUrl,
      storage_path: storagePath,
      signedUrl: signed.data?.signedUrl || null,
    });
  } catch (e: any) {
    console.error("[api/receipts/generate] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
