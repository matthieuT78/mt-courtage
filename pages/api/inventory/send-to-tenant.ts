import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { buildEdlLocataireEmailHtml, buildEdlLocataireEmailText } from "../../../lib/emails/edl-locataire";
import { rateLimitEmailSendOrThrow } from "../../../lib/emailRateLimit";

function safeStr(v: any) {
  return String(v || "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    rateLimitEmailSendOrThrow(req);

    const { to, reportType, occupantLabel, propertyLabel, propertyAddress, performedAt, pdfUrl } = req.body || {};

    const email = safeStr(to).toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Email destinataire invalide" });
    }

    if (!pdfUrl || !safeStr(pdfUrl).startsWith("http")) {
      return res.status(400).json({ ok: false, error: "URL PDF manquante ou invalide" });
    }

    if (reportType !== "entry" && reportType !== "exit") {
      return res.status(400).json({ ok: false, error: "Type d'EDL invalide" });
    }

    const typeLabel = reportType === "entry" ? "d'entrée" : "de sortie";
    const html = buildEdlLocataireEmailHtml({ reportType, occupantLabel: safeStr(occupantLabel), propertyLabel: safeStr(propertyLabel), propertyAddress: safeStr(propertyAddress), performedAt: performedAt || null, pdfUrl: safeStr(pdfUrl) });
    const text = buildEdlLocataireEmailText({ reportType, occupantLabel: safeStr(occupantLabel), propertyLabel: safeStr(propertyLabel), propertyAddress: safeStr(propertyAddress), performedAt: performedAt || null, pdfUrl: safeStr(pdfUrl) });

    const result = await sendEmailViaResend({
      to: email,
      subject: `État des lieux ${typeLabel} — ${safeStr(propertyLabel)} | lokt.fr`,
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
