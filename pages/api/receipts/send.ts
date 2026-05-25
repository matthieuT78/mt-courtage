// pages/api/receipts/send.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { userCanUseReceiptAutomation } from "../../../lib/serverPermissions";

type Json = Record<string, any>;

type ResendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; disabled?: boolean };

// ✅ Guard ultra robuste (ne dépend pas du narrowing TS)
function isResendDisabled(r: ResendResult): r is { ok: false; error: string; disabled: true } {
  if ((r as any)?.ok === true) return false;
  const obj = r as unknown as Record<string, unknown>;
  return obj["disabled"] === true;
}

function getResendError(r: ResendResult): string | null {
  if ((r as any)?.ok === true) return null;
  const obj = r as unknown as Record<string, unknown>;
  return typeof obj["error"] === "string" ? (obj["error"] as string) : "Erreur email inconnue";
}

async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[]; // ✅ Resend expects `content` (base64)
}): Promise<ResendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  // ✅ Email "désactivé" si pas de config
  if (!apiKey || !from) {
    return {
      ok: false,
      disabled: true,
      error: "Email non configuré (RESEND_API_KEY / RESEND_FROM manquants).",
    };
  }

  const payload: any = {
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  };

  if (params.attachments?.length) payload.attachments = params.attachments;

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
  } catch {}

  if (!r.ok) {
    return { ok: false, error: json?.message || raw || `Erreur Resend ${r.status}` };
  }

  return { ok: true, id: json?.id || null };
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req, { allowInternal: true });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, receiptId, resendOnly } = (req.body || {}) as {
      userId?: string;
      receiptId?: string;
      resendOnly?: boolean;
    };

    if (!userId) return res.status(400).json({ error: "userId requis." });
    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!receiptId) return res.status(400).json({ error: "receiptId requis." });

    // 1) receipt
    const r0 = await supabaseAdmin.from("rent_receipts").select("*").eq("id", receiptId).single();
    if (r0.error || !r0.data) return res.status(404).json({ error: "Quittance introuvable." });
    const receipt: any = r0.data;

    // 2) lease (pour check user)
    const leaseRes = await supabaseAdmin.from("leases").select("*").eq("id", receipt.lease_id).single();
    if (leaseRes.error || !leaseRes.data) return res.status(404).json({ error: "Bail introuvable." });
    const lease: any = leaseRes.data;

    if (lease.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });
    const canSendReceiptEmail = await userCanUseReceiptAutomation(userId);
    if (!canSendReceiptEmail) {
      return res.status(402).json({
        error:
          "L’envoi des quittances par email est réservé aux abonnements payants. La génération PDF manuelle reste disponible en gratuit.",
      });
    }

    // 3) tenant email
    const tenantRes = await supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).single();
    const tenant: any = tenantRes.data || null;

    const toEmail = safeStr(tenant?.email);
    if (!toEmail) return res.status(400).json({ error: "Le locataire n’a pas d’email." });

    // 4) signed url + download pdf from storage
    if (!receipt.pdf_url) return res.status(400).json({ error: "PDF manquant. Génère d’abord le PDF." });

    // pdf_url format: rent-receipts-pdfs:<path>
    const [bucketRef, storagePath] = String(receipt.pdf_url).split(":");
    if (bucketRef !== "rent-receipts-pdfs" || !storagePath) {
      return res.status(400).json({ error: "pdf_url invalide (attendu rent-receipts-pdfs:<path>)" });
    }

    const signed = await supabaseAdmin.storage.from("rent-receipts-pdfs").createSignedUrl(storagePath, 60 * 10);
    if (signed.error) return res.status(500).json({ error: `Signed URL échoué: ${signed.error.message}` });

    // Télécharger le PDF via signedUrl pour pièce jointe
    const pdfResp = await fetch(signed.data.signedUrl);
    if (!pdfResp.ok) return res.status(500).json({ error: `Lecture PDF échouée (${pdfResp.status})` });
    const pdfBuf = Buffer.from(await pdfResp.arrayBuffer());

    const yyyymm = String(receipt.period_start || "").slice(0, 7) || "quittance";
    const filename = `quittance-${yyyymm}.pdf`;

    // 5) send
    const subject = `Quittance de loyer – ${yyyymm}`;
    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.5">
        <p>Bonjour,</p>
        <p>Veuillez trouver en pièce jointe votre quittance de loyer pour <b>${yyyymm}</b>.</p>
        <p>Cordialement,<br/>lokt.fr — <a href="mailto:contact@lokt.fr">contact@lokt.fr</a></p>
      </div>
    `;

    const email = await sendEmailViaResend({
      to: toEmail,
      subject,
      html,
      attachments: [{ filename, content: pdfBuf.toString("base64") }], // ✅ content
    });

    const disabled = isResendDisabled(email);
    const emailError = getResendError(email);
    const logStatus = (email as any)?.ok === true ? "sent" : disabled ? "disabled" : "error";

    // 5.b) log email (non bloquant)
    try {
      await supabaseAdmin.from("email_logs").insert({
        user_id: userId,
        lease_id: receipt.lease_id,
        receipt_id: receipt.id,
        to_email: toEmail,
        subject,
        body_preview: `Quittance ${yyyymm}`,
        status: logStatus,
        error_message: (email as any)?.ok === true ? null : emailError,
        sent_at: new Date().toISOString(),
      });
    } catch {
      // non bloquant
    }

    // ✅ 6) si email désactivé => on NE FAIL PAS
    if ((email as any)?.ok !== true && disabled) {
      await supabaseAdmin
        .from("rent_receipts")
        .update({
          status: receipt.status || "generated",
          send_error: emailError,
        })
        .eq("id", receipt.id);

      return res.status(200).json({
        ok: true,
        email_disabled: true,
        message: emailError,
        receipt_id: receipt.id,
        signedUrl: signed.data.signedUrl,
        resendOnly: !!resendOnly,
      });
    }

    // ❌ vrai échec Resend
    if ((email as any)?.ok !== true) {
      await supabaseAdmin
        .from("rent_receipts")
        .update({
          send_error: emailError,
        })
        .eq("id", receipt.id);

      return res.status(400).json({ error: emailError });
    }

    // ✅ 7) update receipt "sent"
    const upd = await supabaseAdmin
      .from("rent_receipts")
      .update({
        sent_to_tenant_email: toEmail,
        sent_at: new Date().toISOString(),
        status: "sent",
        send_error: null,
      })
      .eq("id", receipt.id);

    if (upd.error) return res.status(500).json({ error: `Update quittance échoué: ${upd.error.message}` });

    return res.status(200).json({
      ok: true,
      receipt_id: receipt.id,
      signedUrl: signed.data.signedUrl,
      resendOnly: !!resendOnly,
    });
  } catch (e: any) {
    console.error("[api/receipts/send] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
