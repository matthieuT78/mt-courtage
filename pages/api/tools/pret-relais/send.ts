// pages/api/tools/pret-relais/send.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "../../../../lib/mailer/resend";
import { buildPretRelaisEmail } from "../../../../lib/emails/pret-relais";

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

    // buildPretRelaisEmail retourne { subject, html, text }
    const built = buildPretRelaisEmail({
      email,
      computed,
      subject: "Votre simulation de prêt relais — lokt.fr",
    });

    const result = await sendEmailViaResend({
      to: email,
      subject: built.subject || "Votre simulation de prêt relais — lokt.fr",
      html: built.html,
      text: built.text,
    });

    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "unknown_error",
    });
  }
}
