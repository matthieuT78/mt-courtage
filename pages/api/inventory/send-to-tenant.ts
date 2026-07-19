import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { buildEdlLocataireEmailHtml, buildEdlLocataireEmailText } from "../../../lib/emails/edl-locataire";
import { rateLimitEmailSendOrThrow } from "../../../lib/emailRateLimit";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getServerUserPlan } from "../../../lib/serverPermissions";
import { planAllowsDocumentSharing } from "../../../lib/permissions";

function safeStr(v: any) {
  return String(v || "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

    const { reportId, userId } = req.body || {};
    if (!reportId || !userId) {
      return res.status(400).json({ ok: false, error: "reportId et userId requis." });
    }
    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ ok: false, error: userCheck.error });

    const plan = await getServerUserPlan(String(userId));
    if (!planAllowsDocumentSharing(plan)) {
      return res.status(403).json({ ok: false, error: "Le partage de documents avec le locataire nécessite un abonnement lokt.one ou supérieur." });
    }

    rateLimitEmailSendOrThrow(req);

    const { data: report, error: reportErr } = await supabaseAdmin
      .from("inventory_reports")
      .select("id,user_id,status,pdf_url,report_type,occupant_email,occupant_label,property_label,property_address_line1,property_city,performed_at")
      .eq("id", String(reportId))
      .single();

    if (reportErr || !report) {
      return res.status(404).json({ ok: false, error: "État des lieux introuvable." });
    }
    if (report.user_id !== String(userId)) {
      return res.status(403).json({ ok: false, error: "Accès refusé." });
    }

    const status = String(report.status || "").toLowerCase();
    if (!["ready", "signed", "archived"].includes(status)) {
      return res.status(409).json({ ok: false, error: "PDF indisponible tant que l’état des lieux n’est pas finalisé." });
    }
    if (!report.pdf_url) {
      return res.status(400).json({ ok: false, error: "Aucun PDF généré pour cet état des lieux." });
    }
    if (report.report_type !== "entry" && report.report_type !== "exit") {
      return res.status(400).json({ ok: false, error: "Type d'EDL invalide." });
    }

    const email = safeStr(report.occupant_email).toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Aucun email locataire renseigné sur cet état des lieux." });
    }

    const raw = String(report.pdf_url);
    const sepIndex = raw.indexOf(":");
    if (sepIndex === -1) {
      return res.status(400).json({ ok: false, error: "pdf_url invalide." });
    }
    const bucket = raw.slice(0, sepIndex);
    const path = raw.slice(sepIndex + 1);
    const { data: signedData, error: signErr } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr || !signedData?.signedUrl) {
      return res.status(500).json({ ok: false, error: signErr?.message || "Impossible de générer le lien du PDF." });
    }

    const reportType = report.report_type as "entry" | "exit";
    const propertyLabel = safeStr(report.property_label) || safeStr(report.property_address_line1) || "le logement";
    const propertyAddress = [report.property_address_line1, report.property_city].filter(Boolean).join(", ");
    const typeLabel = reportType === "entry" ? "d'entrée" : "de sortie";
    const occupantLabel = safeStr(report.occupant_label) || email;
    const html = buildEdlLocataireEmailHtml({ reportType, occupantLabel, propertyLabel, propertyAddress, performedAt: report.performed_at || null, pdfUrl: signedData.signedUrl });
    const text = buildEdlLocataireEmailText({ reportType, occupantLabel, propertyLabel, propertyAddress, performedAt: report.performed_at || null, pdfUrl: signedData.signedUrl });

    const result = await sendEmailViaResend({
      to: email,
      subject: `État des lieux ${typeLabel} — ${propertyLabel} | lokt.fr`,
      html,
      text,
      replyTo: "contact@lokt.fr",
    });

    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    if (String(e?.message || "").startsWith("RATE_LIMIT:")) {
      return res.status(429).json({ ok: false, error: e.message });
    }
    return res.status(500).json({ ok: false, error: e?.message || "unknown_error" });
  }
}
