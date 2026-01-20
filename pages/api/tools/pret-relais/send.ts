import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmailViaResend } from "@/lib/mailer/resend";
import { buildPretRelaisEmail } from "@/lib/emails/pret-relais"; // à créer

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
    const subject = String(req.body?.subject || "Votre simulation prêt relais — lokt.fr").trim();
    const computed = req.body?.computed; // objet résultat calculé (ou payload)

    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "Email invalide" });
    if (!computed) return res.status(400).json({ ok: false, error: "Payload manquant" });

    const html = buildPretRelaisEmail(computed);
    const text = "Votre simulation prêt relais — lokt.fr"; // optionnel

    const result = await sendEmailViaResend({
      to: email,
      subject,
      html,
      text,
      replyTo: "contact@lokt.fr",
    });

    if (!result.ok) return res.status(500).json({ ok: false, error: result.error });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "unknown_error" });
  }
}
