// pages/api/receipts/send.ts
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

function safeText(v: any) {
  return v == null ? "" : String(v);
}

async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "Email non configuré (RESEND_API_KEY / RESEND_FROM manquants). Le PDF a été généré mais l’envoi email est désactivé.",
    };
  }

  const payload: any = {
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  };

  if (params.attachments?.length) {
    payload.attachments = params.attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
    }));
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await r.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    // ignore
  }

  if (!r.ok) {
    return { ok: false, error: json?.message || raw || `Erreur Resend ${r.status}` };
  }

  return { ok: true, id: json?.id || null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré (env manquantes)." });

    const { userId, leaseId, periodStart, periodEnd, receiptId, contentText } = (req.body || {}) as {
      userId?: string;
      leaseId?: string;
      periodStart?: string; // YYYY-MM-DD
      periodEnd?: string; // YYYY-MM-DD
      receiptId?: string;
      contentText?: string;
    };

    if (!userId) return res.status(400).json({ error: "userId requis." });

    // 1) Charger / créer la quittance
    let receipt: any = null;

    if (receiptId) {
      const r = await supabaseAdmin.from("rent_receipts").select("*").eq("id", receiptId).single();
      if (r.error || !r.data) return res.status(404).json({ error: "Quittance introuvable." });
      receipt = r.data;
    } else {
      if (!leaseId || !periodStart || !periodEnd) {
        return res.status(400).json({ error: "leaseId + periodStart + periodEnd requis si receiptId absent." });
      }

      // Si existe déjà
      const existing = await supabaseAdmin
        .from("rent_receipts")
        .select("*")
        .eq("lease_id", leaseId)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .maybeSingle();

      if (existing.data) {
        receipt = existing.data;
      } else {
        // Charger lease pour montants
        const l = await supabaseAdmin.from("leases").select("*").eq("id", leaseId).single();
        if (l.error || !l.data) return res.status(404).json({ error: "Bail introuvable." });
        if (l.data.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });

        const rent = Number(l.data.rent_amount || 0);
        const charges = Number(l.data.charges_amount || 0);
        const total = rent + charges;

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
            content_text: contentText || "",
            status: "generated",
          })
          .select("*")
          .single();

        if (ins.error || !ins.data)
          return res.status(500).json({ error: ins.error?.message || "Création quittance échouée." });
        receipt = ins.data;
      }
    }

    // 2) Charger lease + tenant
    const leaseRes = await supabaseAdmin.from("leases").select("*").eq("id", receipt.lease_id).single();
    if (leaseRes.error || !leaseRes.data) return res.status(404).json({ error: "Bail introuvable." });
    const lease = leaseRes.data;

    if (lease.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });

    const tenantRes = await supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).single();
    const tenant = tenantRes.data || null;

    const toEmail = safeText(tenant?.email);
    if (!toEmail) {
      return res.status(400).json({ error: "Le locataire n’a pas d’email. Ajoute un email au locataire avant envoi." });
    }

    // 3) Générer PDF “propre”
    const pdf = await buildPdfBuffer(async (doc) => {
      doc.fontSize(14).text("QUITTANCE DE LOYER", { align: "center" });
      doc.moveDown(0.8);

      doc
        .fontSize(9)
        .fillColor("#444")
        .text(`Période : ${receipt.period_start} → ${receipt.period_end} • Émise le : ${receipt.issue_date}`, {
          align: "center",
        });
      doc.moveDown(1);

      doc.fillColor("#111");
      doc.fontSize(10).text((receipt.content_text || "").trim() || "—", { align: "left" });

      doc.moveDown(2);
      doc.fillColor("#666").fontSize(8).text("Document généré par ImmoPilot", { align: "center" });
    });

    // 4) Upload Storage
    const yyyymm = String(receipt.period_start || "").slice(0, 7) || toISODate(new Date()).slice(0, 7);
    const filename = `quittance-${yyyymm}.pdf`;
    const storagePath = `${userId}/${receipt.lease_id}/${receipt.id}/${filename}`;

    const up = await supabaseAdmin.storage.from("rent-receipts-pdfs").upload(storagePath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) return res.status(500).json({ error: `Upload PDF échoué: ${up.error.message}` });

    // 5) Upsert rent_payment (et marquer payé)
    let paymentId: string | null = receipt.payment_id || null;

    const payExisting = await supabaseAdmin
      .from("rent_payments")
      .select("*")
      .eq("lease_id", receipt.lease_id)
      .eq("period_start", receipt.period_start)
      .eq("period_end", receipt.period_end)
      .maybeSingle();

    if (payExisting.data) {
      paymentId = payExisting.data.id;
      const updPay = await supabaseAdmin
        .from("rent_payments")
        .update({
          paid_at: new Date().toISOString(),
          payment_method: lease.payment_method || null,
          source: "receipt",
          rent_amount: receipt.rent_amount,
          charges_amount: receipt.charges_amount,
          total_amount: receipt.total_amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (updPay.error) return res.status(500).json({ error: `Update paiement échoué: ${updPay.error.message}` });
    } else {
      const insPay = await supabaseAdmin
        .from("rent_payments")
        .insert({
          lease_id: receipt.lease_id,
          period_start: receipt.period_start,
          period_end: receipt.period_end,
          rent_amount: receipt.rent_amount,
          charges_amount: receipt.charges_amount,
          total_amount: receipt.total_amount,
          due_date: receipt.period_start, // optionnel, à adapter
          paid_at: new Date().toISOString(),
          payment_method: lease.payment_method || null,
          source: "receipt",
        })
        .select("id")
        .single();

      if (insPay.error || !insPay.data)
        return res.status(500).json({ error: `Insert paiement échoué: ${insPay.error?.message}` });
      paymentId = insPay.data.id;
    }

    // 6) Email (optionnel via Resend)
    const emailSubject = `Quittance de loyer – ${yyyymm}`;
    const emailHtml = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.5">
        <p>Bonjour,</p>
        <p>Veuillez trouver en pièce jointe votre quittance de loyer pour <b>${yyyymm}</b>.</p>
        <p>Cordialement,<br/>ImmoPilot</p>
      </div>
    `;

    const emailResult = await sendEmailViaResend({
      to: toEmail,
      subject: emailSubject,
      html: emailHtml,
      attachments: [{ filename, content: pdf }],
    });

    // Log email
    await supabaseAdmin.from("email_logs").insert({
      user_id: userId,
      lease_id: receipt.lease_id,
      receipt_id: receipt.id,
      to_email: toEmail,
      subject: emailSubject,
      body_preview: `Quittance ${yyyymm}`,
      status: emailResult.ok ? "sent" : "error",
      error_message: emailResult.ok ? null : emailResult.error,
      sent_at: new Date().toISOString(),
    });

    if (!emailResult.ok) {
      return res.status(400).json({ error: emailResult.error, storage_path: storagePath });
    }

    // 7) Update rent_receipts (pdf + sent + payment link)
    const pdfUrl = `rent-receipts-pdfs:${storagePath}`;

    const upd = await supabaseAdmin
      .from("rent_receipts")
      .update({
        pdf_url: pdfUrl,
        payment_id: paymentId,
        sent_to_tenant_email: toEmail,
        sent_at: new Date().toISOString(),
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", receipt.id);

    if (upd.error) return res.status(500).json({ error: `Update quittance échoué: ${upd.error.message}` });

    // 8) Signed URL (pour ouvrir direct)
    const signed = await supabaseAdmin.storage.from("rent-receipts-pdfs").createSignedUrl(storagePath, 60 * 10);
    if (signed.error) return res.status(200).json({ ok: true, pdf_url: pdfUrl, storage_path: storagePath });

    return res.status(200).json({
      ok: true,
      pdf_url: pdfUrl,
      storage_path: storagePath,
      signedUrl: signed.data.signedUrl,
      receipt_id: receipt.id,
      payment_id: paymentId,
    });
  } catch (e: any) {
    console.error("[api/receipts/send] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
