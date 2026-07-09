import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { stampPdf, type SignatureAuditEntry } from "../../../lib/pdfStamp";
import { contractPdfPath } from "../../../lib/leaseContract";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lokt.fr";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "lokt.fr <noreply@lokt.fr>", to, subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

function completedEmailHtml(opts: { documentLabel: string; downloadUrl: string }) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <tr><td style="background:linear-gradient(135deg,#635bff,#00d4ff);padding:28px 32px">
    <img src="${SITE_URL}/lokt-logo-small.jpg" alt="lokt.fr" height="32" style="display:block;border-radius:6px">
  </td></tr>
  <tr><td style="padding:32px">
    <p style="margin:0 0 8px;font-size:13px;color:#059669;font-weight:600;text-transform:uppercase;letter-spacing:.08em">Document signé</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;font-weight:700">${opts.documentLabel}</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6">
      Les deux parties ont signé. Vous trouverez ci-dessous le PDF certifié avec le certificat de signature électronique en dernière page.
    </p>
    <table cellpadding="0" cellspacing="0"><tr><td style="background:#059669;border-radius:100px">
      <a href="${opts.downloadUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:14px;font-weight:700;text-decoration:none">
        Télécharger le document signé →
      </a>
    </td></tr></table>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8">Signature électronique simple conforme au Règlement eIDAS (UE) n°910/2014.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { token } = req.body as { token: string };
  if (!token) return res.status(400).json({ error: "Token manquant." });

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const userAgent = req.headers["user-agent"] || "";

  const { data: sigReq, error } = await supabaseAdmin
    .from("signature_requests")
    .select("*")
    .or(`landlord_token.eq.${token},tenant_token.eq.${token}`)
    .single();

  if (error || !sigReq) return res.status(404).json({ error: "Demande introuvable." });
  if (sigReq.status === "completed") return res.status(200).json({ status: "completed", alreadySigned: true });
  if (sigReq.status === "expired" || new Date(sigReq.expires_at) < new Date()) {
    return res.status(410).json({ error: "Ce lien de signature a expiré." });
  }

  const isLandlord = sigReq.landlord_token === token;
  const isTenant = sigReq.tenant_token === token;

  if (isLandlord && sigReq.landlord_signed_at) {
    return res.status(200).json({ status: sigReq.status, alreadySigned: true });
  }
  if (isTenant && sigReq.tenant_signed_at) {
    return res.status(200).json({ status: sigReq.status, alreadySigned: true });
  }

  const now = new Date().toISOString();
  const updateFields = isLandlord
    ? { landlord_signed_at: now, landlord_ip: ip, landlord_user_agent: userAgent }
    : { tenant_signed_at: now, tenant_ip: ip, tenant_user_agent: userAgent };
  const otherSigned = isLandlord ? !!sigReq.tenant_signed_at : !!sigReq.landlord_signed_at;

  // Bug 10 fix: atomic guard — `.is()` ensures the field is still NULL before writing,
  // preventing two concurrent requests from both believing they signed last.
  // Bug 1 fix: always write "partially_signed" here; "completed" is set only after the
  // PDF has been successfully stamped and uploaded.
  const { data: updateResult, error: updateErr } = await supabaseAdmin
    .from("signature_requests")
    .update({ ...updateFields, status: "partially_signed" })
    .eq("id", sigReq.id)
    .is(isLandlord ? "landlord_signed_at" : "tenant_signed_at", null)
    .select("id");

  if (updateErr) return res.status(500).json({ error: "Erreur lors de l'enregistrement de la signature." });
  if (!updateResult?.length) {
    // Concurrent request beat us — treat as already signed
    return res.status(200).json({ status: sigReq.status, alreadySigned: true });
  }

  if (!otherSigned) {
    return res.status(200).json({ status: "partially_signed" });
  }

  // ── Both signed — stamp the PDF ──
  const [bucket, ...pathParts] = sigReq.original_pdf_url.split(":");
  const storagePath = pathParts.join(":");

  const { data: pdfBlob, error: downloadErr } = await supabaseAdmin.storage.from(bucket).download(storagePath);
  if (downloadErr || !pdfBlob) {
    return res.status(500).json({ error: "Impossible de récupérer le PDF." });
  }

  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
  const landlordSignedAt = isLandlord ? new Date(now) : new Date(sigReq.landlord_signed_at);
  const tenantSignedAt = isLandlord ? new Date(sigReq.tenant_signed_at) : new Date(now);
  const landlordIp = isLandlord ? ip : sigReq.landlord_ip;
  const tenantIp = isLandlord ? sigReq.tenant_ip : ip;

  const auditEntries: SignatureAuditEntry[] = [
    {
      role: "Bailleur",
      name: sigReq.landlord_name || sigReq.landlord_email,
      email: sigReq.landlord_email,
      ip: landlordIp,
      signedAt: landlordSignedAt,
    },
    {
      role: "Locataire",
      name: sigReq.tenant_name || sigReq.tenant_email,
      email: sigReq.tenant_email,
      ip: tenantIp,
      signedAt: tenantSignedAt,
    },
  ];

  let signedPath: string;
  let signedBucket: string;
  if (sigReq.document_type === "bail" && sigReq.lease_contract_id && sigReq.lease_id && sigReq.landlord_id) {
    signedBucket = "lease-contract-pdfs";
    signedPath = contractPdfPath(sigReq.landlord_id, sigReq.lease_id, sigReq.lease_contract_id, true);
  } else {
    signedBucket = bucket;
    signedPath = storagePath.replace(/\.pdf$/, ".signed.pdf");
  }

  // Bug 5 fix: wrap PDF work so a crash here doesn't leave status permanently stuck.
  // The signature IS recorded; only the PDF generation failed.
  let signedPdfUrl: string;
  try {
    const stampedBytes = await stampPdf(pdfBytes, {
      documentLabel: sigReq.document_label,
      referenceId: sigReq.id,
      auditEntries,
      documentHash: sigReq.document_hash,
    });

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(signedBucket)
      .upload(signedPath, stampedBytes, { contentType: "application/pdf", upsert: true });

    if (uploadErr) throw new Error(`Upload: ${uploadErr.message}`);

    signedPdfUrl = `${signedBucket}:${signedPath}`;
  } catch (err) {
    console.error("[signatures/confirm] PDF stamping failed:", err);
    return res.status(500).json({
      error: "La signature a été enregistrée mais la génération du PDF a échoué. Contactez le support.",
    });
  }

  // Bug 1 fix: set "completed" only after successful PDF upload.
  // Bug 7 fix: check errors on all three DB updates.
  const { error: completeErr } = await supabaseAdmin
    .from("signature_requests")
    .update({ signed_pdf_url: signedPdfUrl, status: "completed" })
    .eq("id", sigReq.id);
  if (completeErr) console.error("[signatures/confirm] Failed to mark completed:", completeErr);

  if (sigReq.document_type === "bail" && sigReq.lease_contract_id) {
    const { error: bailUpdateErr } = await supabaseAdmin
      .from("lease_contract_documents")
      .update({ signed_pdf_url: signedPdfUrl, signed_at: now, status: "signed" })
      .eq("id", sigReq.lease_contract_id);
    if (bailUpdateErr) console.error("[signatures/confirm] Failed to update lease_contract_documents:", bailUpdateErr);
  } else if (sigReq.document_type === "edl" && sigReq.inventory_report_id) {
    const { error: edlUpdateErr } = await supabaseAdmin
      .from("inventory_reports")
      .update({ pdf_url: signedPdfUrl, status: "signed" })
      .eq("id", sigReq.inventory_report_id);
    if (edlUpdateErr) console.error("[signatures/confirm] Failed to update inventory_reports:", edlUpdateErr);
  }

  const { data: signedUrlData } = await supabaseAdmin.storage
    .from(signedBucket)
    .createSignedUrl(signedPath, 60 * 60 * 24 * 7); // 7 jours
  const downloadUrl = signedUrlData?.signedUrl || `${SITE_URL}/espace-bailleur`;

  // Bug 4 fix: log email failures rather than silently swallowing them.
  const emailResults = await Promise.allSettled([
    sendEmail(sigReq.landlord_email, `Document signé — ${sigReq.document_label}`, completedEmailHtml({ documentLabel: sigReq.document_label, downloadUrl })),
    sendEmail(sigReq.tenant_email, `Document signé — ${sigReq.document_label}`, completedEmailHtml({ documentLabel: sigReq.document_label, downloadUrl })),
  ]);
  emailResults.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[signatures/confirm] Email ${i} failed:`, r.reason);
  });

  return res.status(200).json({ status: "completed", signedPdfUrl });
}
