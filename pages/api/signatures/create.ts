import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hashPdfBuffer } from "../../../lib/pdfStamp";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lokt.fr";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "lokt.fr <noreply@lokt.fr>", to, subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

function signerEmailHtml(opts: {
  role: "bailleur" | "locataire";
  recipientName: string;
  otherName: string;
  documentLabel: string;
  signerUrl: string;
  expiresAt: string;
}) {
  const roleLabel = opts.role === "bailleur" ? "bailleur" : "locataire";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <tr><td style="background:linear-gradient(135deg,#635bff,#00d4ff);padding:28px 32px">
    <img src="${SITE_URL}/lokt-logo-small.jpg" alt="lokt.fr" height="32" style="display:block;border-radius:6px">
  </td></tr>
  <tr><td style="padding:32px">
    <p style="margin:0 0 8px;font-size:13px;color:#635bff;font-weight:600;text-transform:uppercase;letter-spacing:.08em">Signature électronique</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;font-weight:700">${opts.documentLabel}</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6">
      Bonjour ${opts.recipientName},<br><br>
      En tant que <strong>${roleLabel}</strong>, vous êtes invité·e à signer ce document électroniquement.<br>
      ${opts.otherName} devra également apposer sa signature pour que le document soit finalisé.
    </p>
    <table cellpadding="0" cellspacing="0"><tr><td style="background:linear-gradient(135deg,#635bff,#00d4ff);border-radius:100px">
      <a href="${opts.signerUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:14px;font-weight:700;text-decoration:none">
        Lire et signer le document →
      </a>
    </td></tr></table>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">Lien valable jusqu'au ${opts.expiresAt}. Une fois les deux signatures recueillies, vous recevrez le PDF signé par email.</p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8">Signature électronique simple conforme au Règlement eIDAS (UE) n°910/2014. Émis par lokt.fr.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.error || "Non autorisé." });

  const {
    document_type,
    document_label,
    lease_contract_id,
    inventory_report_id,
    lease_id,
    property_id,
    landlord_name,
    tenant_email,
    tenant_name,
  } = req.body as Record<string, string>;

  if (!document_type || !tenant_email) {
    return res.status(400).json({ error: "Paramètres manquants." });
  }

  // Vérification d'appartenance côté serveur : on ne fait jamais confiance à
  // original_pdf_url / landlord_email fournis par le client. On les dérive
  // de la ressource elle-même, après avoir vérifié qu'elle appartient à
  // l'utilisateur authentifié (évite tout accès cross-utilisateur).
  let original_pdf_url: string;
  if (document_type === "bail") {
    if (!lease_contract_id) return res.status(400).json({ error: "lease_contract_id manquant." });
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("lease_contract_documents")
      .select("id, user_id, pdf_url")
      .eq("id", lease_contract_id)
      .maybeSingle();
    if (docErr || !doc) return res.status(404).json({ error: "Document introuvable." });
    if (doc.user_id !== auth.userId) return res.status(403).json({ error: "Accès refusé." });
    if (!doc.pdf_url) return res.status(400).json({ error: "Aucun PDF généré pour ce bail." });
    original_pdf_url = doc.pdf_url;
  } else if (document_type === "edl") {
    if (!inventory_report_id) return res.status(400).json({ error: "inventory_report_id manquant." });
    const { data: report, error: reportErr } = await supabaseAdmin
      .from("inventory_reports")
      .select("id, user_id, pdf_url")
      .eq("id", inventory_report_id)
      .maybeSingle();
    if (reportErr || !report) return res.status(404).json({ error: "État des lieux introuvable." });
    if (report.user_id !== auth.userId) return res.status(403).json({ error: "Accès refusé." });
    if (!report.pdf_url) return res.status(400).json({ error: "Aucun PDF généré pour cet état des lieux." });
    original_pdf_url = report.pdf_url;
  } else {
    return res.status(400).json({ error: "document_type invalide." });
  }

  const landlord_email = auth.email;
  if (!landlord_email) return res.status(400).json({ error: "Email bailleur introuvable sur le compte." });

  // Dedup — éviter plusieurs demandes actives pour le même document
  const dedupField = document_type === "bail" ? "lease_contract_id" : "inventory_report_id";
  const dedupValue = document_type === "bail" ? lease_contract_id : inventory_report_id;
  if (dedupValue) {
    const { data: existing } = await supabaseAdmin
      .from("signature_requests")
      .select("id, status")
      .eq(dedupField, dedupValue)
      .in("status", ["pending", "partially_signed"])
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: "Une demande de signature est déjà en cours pour ce document. Vérifiez vos emails ou attendez qu'elle expire." });
    }
  }

  // Calculer le hash du PDF original
  const [bucket, ...pathParts] = original_pdf_url.split(":");
  const storagePath = pathParts.join(":");
  const { data: pdfData, error: downloadErr } = await supabaseAdmin.storage.from(bucket).download(storagePath);
  if (downloadErr || !pdfData) {
    return res.status(500).json({ error: "Impossible de récupérer le PDF source." });
  }
  const pdfBuffer = Buffer.from(await pdfData.arrayBuffer());
  const documentHash = hashPdfBuffer(pdfBuffer);

  const { data: sigReq, error: insertErr } = await supabaseAdmin
    .from("signature_requests")
    .insert({
      document_type,
      document_label: document_label || document_type,
      lease_contract_id: lease_contract_id || null,
      inventory_report_id: inventory_report_id || null,
      lease_id: lease_id || null,
      property_id: property_id || null,
      landlord_id: auth.userId,
      original_pdf_url,
      document_hash: documentHash,
      landlord_email,
      landlord_name: landlord_name || landlord_email,
      tenant_email,
      tenant_name: tenant_name || tenant_email,
    })
    .select()
    .single();

  if (insertErr || !sigReq) {
    return res.status(500).json({ error: "Impossible de créer la demande de signature." });
  }

  const expiresLabel = new Date(sigReq.expires_at).toLocaleDateString("fr-FR");
  const landlordUrl = `${SITE_URL}/signer/${sigReq.landlord_token}`;
  const tenantUrl = `${SITE_URL}/signer/${sigReq.tenant_token}`;

  // Bug 4 fix: detect email failures instead of silently swallowing them.
  const emailResults = await Promise.allSettled([
    sendEmail(landlord_email, `À signer : ${sigReq.document_label}`, signerEmailHtml({
      role: "bailleur",
      recipientName: landlord_name || "Bailleur",
      otherName: tenant_name || tenant_email,
      documentLabel: sigReq.document_label,
      signerUrl: landlordUrl,
      expiresAt: expiresLabel,
    })),
    sendEmail(tenant_email, `À signer : ${sigReq.document_label}`, signerEmailHtml({
      role: "locataire",
      recipientName: tenant_name || "Locataire",
      otherName: landlord_name || landlord_email,
      documentLabel: sigReq.document_label,
      signerUrl: tenantUrl,
      expiresAt: expiresLabel,
    })),
  ]);
  const emailErrors = emailResults.filter((r) => r.status === "rejected");
  emailErrors.forEach((r) => console.error("[signatures/create] Email failed:", (r as PromiseRejectedResult).reason));
  if (emailErrors.length === 2) {
    return res.status(500).json({ error: "La demande a été créée mais l'envoi des emails a échoué. Vérifiez la configuration Resend." });
  }

  return res.status(200).json({ id: sigReq.id, status: sigReq.status });
}
