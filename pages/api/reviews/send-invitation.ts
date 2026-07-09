import type { NextApiRequest, NextApiResponse } from "next";
import { hasValidCronSecret } from "../../../lib/cronAuth";

const RESEND_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lokt.fr";
const LOGO_URL = `${SITE_URL}/lokt-logo-small.jpg`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!RESEND_KEY) return res.status(500).json({ error: "RESEND_API_KEY manquant" });

  const { email, name, source } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "Email requis" });

  const avisUrl = `${SITE_URL}/avis?email=${encodeURIComponent(email)}${name ? `&name=${encodeURIComponent(name)}` : ""}&source=${encodeURIComponent(source ?? "invitation")}`;
  const greeting = name ? `Bonjour ${name},` : "Bonjour,";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "lokt.fr <contact@lokt.fr>",
      to: email,
      subject: "Votre avis nous aide à améliorer lokt.fr",
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#635bff,#00d4ff);padding:24px 32px;text-align:center">
          <img src="${LOGO_URL}" alt="lokt.fr" height="36" style="height:36px;display:inline-block">
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 32px">
          <p style="margin:0 0 12px;font-size:16px;color:#1f2937">${greeting}</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6">
            Vous avez récemment utilisé un simulateur lokt.fr.<br>
            Votre retour nous aide à améliorer l'outil pour tous les utilisateurs.
          </p>
          <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6">
            Cela prend <strong>moins de 30 secondes</strong> — note + quelques mots suffisent.
          </p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius:10px;background:#0891b2">
                <a href="${avisUrl}"
                   style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px">
                  Laisser un avis →
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:28px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
            Merci d'avance,<br>
            <strong style="color:#0f172a">L'équipe lokt.fr</strong>
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
          <p style="margin:0;font-size:11px;color:#9ca3af">
            lokt.fr · Gestion locative & simulateurs immobiliers gratuits<br>
            Vous recevez cet email car vous avez utilisé un simulateur sur lokt.fr.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
    }),
  });

  const json = await response.json();
  if (!response.ok) return res.status(500).json({ error: json });
  return res.status(200).json({ ok: true, id: json.id, to: email });
}
