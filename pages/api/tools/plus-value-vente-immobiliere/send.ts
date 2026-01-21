// pages/api/tools/plus-value-vente-immobiliere/send.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "../../../../lib/mailer/resend";
import { buildPlusValueEmailHtml, buildPlusValueEmailText } from "../../../../lib/emails/plus-value-vente-immobiliere";

function safeEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const email = safeEmail(req.body?.email);
    const computed = req.body?.computed;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Email invalide" });
    }
    if (!computed || typeof computed !== "object") {
      return res.status(400).json({ ok: false, error: "Payload computed manquant" });
    }

    const html = buildPlusValueEmailHtml(computed);
    const text = buildPlusValueEmailText(computed);

    const result = await sendEmailViaResend({
      to: email,
      subject: "Votre simulation de plus-value immobilière — lokt.fr",
      html,
      text,
      replyTo: "contact@lokt.fr",
    });

    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "unknown_error" });
  }
}
