import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { removeTrackedPartialPaymentTransactions } from "../../../lib/rentPaymentFinance";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type Json = { ok: boolean; error?: string; receipt_id?: string; payment_id?: string | null; deleted_pdf?: boolean };

const RECEIPT_BUCKET = "rent-receipts-pdfs";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function parsePdfUrl(pdfUrl?: string | null): { bucket: string; path: string } | null {
  if (!pdfUrl) return null;
  const raw = String(pdfUrl).trim();
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  const bucket = raw.slice(0, idx).trim();
  const path = raw.slice(idx + 1).trim().replace(/^\/+/, "").split("?")[0].split("#")[0];
  if (bucket !== RECEIPT_BUCKET || !path) return null;
  return { bucket, path };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

    const {
      userId: rawUserId,
      receiptId: rawReceiptId,
      paymentId: rawPaymentId,
      leaseId: rawLeaseId,
      periodStart: rawPeriodStart,
      periodEnd: rawPeriodEnd,
    } = (req.body || {}) as {
      userId?: string;
      receiptId?: string;
      paymentId?: string;
      leaseId?: string;
      periodStart?: string;
      periodEnd?: string;
    };
    const userId = safeStr(rawUserId);
    const receiptId = safeStr(rawReceiptId);
    const paymentIdFromBody = safeStr(rawPaymentId);
    const leaseIdFromBody = safeStr(rawLeaseId);
    const periodStartFromBody = safeStr(rawPeriodStart);
    const periodEndFromBody = safeStr(rawPeriodEnd);

    if (!userId) return res.status(400).json({ ok: false, error: "userId requis." });
    if (!receiptId && !paymentIdFromBody && !(leaseIdFromBody && periodStartFromBody && periodEndFromBody)) {
      return res.status(400).json({ ok: false, error: "receiptId, paymentId ou période de bail requis." });
    }
    if (auth.userId !== userId) return res.status(403).json({ ok: false, error: "Accès refusé (user mismatch)." });

    let receipt: any = null;
    let leaseId = leaseIdFromBody;
    let periodStart = periodStartFromBody;
    let periodEnd = periodEndFromBody;

    if (receiptId) {
      const receiptRes = await supabaseAdmin.from("rent_receipts").select("*").eq("id", receiptId).single();
      if (receiptRes.error || !receiptRes.data) return res.status(404).json({ ok: false, error: "Quittance introuvable." });
      receipt = receiptRes.data;
      leaseId = safeStr(receipt.lease_id);
      periodStart = safeStr(receipt.period_start);
      periodEnd = safeStr(receipt.period_end);
    }

    if (!leaseId && paymentIdFromBody) {
      const paymentRes = await supabaseAdmin
        .from("rent_payments")
        .select("id,lease_id,period_start,period_end")
        .eq("id", paymentIdFromBody)
        .single();
      if (paymentRes.error || !paymentRes.data) return res.status(404).json({ ok: false, error: "Paiement introuvable." });
      leaseId = safeStr(paymentRes.data.lease_id);
      periodStart = safeStr(paymentRes.data.period_start);
      periodEnd = safeStr(paymentRes.data.period_end);
    }

    const leaseRes = await supabaseAdmin.from("leases").select("id,user_id").eq("id", leaseId).single();
    if (leaseRes.error || !leaseRes.data) return res.status(404).json({ ok: false, error: "Bail introuvable." });
    if (String(leaseRes.data.user_id) !== userId) return res.status(403).json({ ok: false, error: "Accès refusé." });

    const paymentId = safeStr(receipt?.payment_id) || paymentIdFromBody || null;
    const parsedPdf = parsePdfUrl(receipt?.pdf_url);
    let deletedPdf = false;

    if (parsedPdf) {
      const remove = await supabaseAdmin.storage.from(parsedPdf.bucket).remove([parsedPdf.path]);
      if (remove.error) return res.status(500).json({ ok: false, error: `Suppression PDF échouée: ${remove.error.message}` });
      deletedPdf = true;
    }

    if (paymentId) {
      const updPayment = await supabaseAdmin
        .from("rent_payments")
        .update({
          rent_amount: 0,
          charges_amount: 0,
          total_amount: 0,
          paid_at: null,
          payment_method: null,
          source: "payment_cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);
      if (updPayment.error) return res.status(500).json({ ok: false, error: `Update paiement échoué: ${updPayment.error.message}` });
    } else {
      const existingPayment = await supabaseAdmin
        .from("rent_payments")
        .select("id")
        .eq("lease_id", leaseId)
        .eq("period_start", periodStart)
        .gte("period_end", periodEnd)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPayment.error) return res.status(500).json({ ok: false, error: `Lecture paiement échouée: ${existingPayment.error.message}` });
      if (existingPayment.data?.id) {
        const updPayment = await supabaseAdmin
          .from("rent_payments")
          .update({
            rent_amount: 0,
            charges_amount: 0,
            total_amount: 0,
            paid_at: null,
            payment_method: null,
            source: "payment_cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPayment.data.id);
        if (updPayment.error) return res.status(500).json({ ok: false, error: `Update paiement échoué: ${updPayment.error.message}` });
      }
    }

    const txDelete = await supabaseAdmin
      .from("transactions")
      .delete()
      .eq("user_id", userId)
      .eq("receipt_id", receipt?.id || "__no_receipt__");
    if (txDelete.error) return res.status(500).json({ ok: false, error: `Suppression Finance échouée: ${txDelete.error.message}` });

    await removeTrackedPartialPaymentTransactions({ leaseId, periodStart, periodEnd });

    if (receipt?.id && String(receipt?.status || "") !== "closed_by_deposit") {
      const receiptUpdate = await supabaseAdmin
        .from("rent_receipts")
        .update({
          payment_id: null,
          pdf_url: null,
          status: "draft",
          sent_at: null,
          sent_to_tenant_email: null,
          send_error: null,
          edited_at: new Date().toISOString(),
        })
        .eq("id", receipt.id);

      if (receiptUpdate.error) {
        return res.status(500).json({ ok: false, error: `Update quittance échoué: ${receiptUpdate.error.message}` });
      }
    }

    return res.status(200).json({ ok: true, receipt_id: receipt?.id || null, payment_id: paymentId, deleted_pdf: deletedPdf });
  } catch (e: any) {
    console.error("[api/receipts/cancel-payment] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Erreur interne" });
  }
}
