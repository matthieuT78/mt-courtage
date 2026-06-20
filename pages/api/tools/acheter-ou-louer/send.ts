// pages/api/tools/acheter-ou-louer/send.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "../../../../lib/mailer/resend";
import { buildAcheterOuLouerEmailHtml, buildAcheterOuLouerEmailText } from "../../../../lib/emails/acheter-ou-louer";
import { rateLimitEmailSendOrThrow } from "../../../../lib/emailRateLimit";

function safeEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    rateLimitEmailSendOrThrow(req);

    const email = safeEmail(req.body?.email);
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Email invalide" });
    }

    const payload = req.body?.payload;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ ok: false, error: "Payload manquant" });
    }

    const html = buildAcheterOuLouerEmailHtml(payload);
    const text = buildAcheterOuLouerEmailText(payload);

    const result = await sendEmailViaResend({
      to: email,
      subject: "Votre analyse immobilière — Acheter ou louer ? | lokt.fr",
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
