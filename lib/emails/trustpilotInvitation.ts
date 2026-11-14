import { emailLayout } from "./layout";
import { TRUSTPILOT_URL } from "../trustpilot";

const RESEND_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lokt.fr";
const SIGNATURE_URL = `${SITE_URL}/signature-lokt.png`;
const LOGO_URL = `${SITE_URL}/lokt-logo-small.jpg`;

// Envoyé 60 jours après l'email de demande d'avis interne (review-invitations.ts),
// à tout le monde à cette échéance — qu'ils aient répondu au premier email ou
// non. Jamais conditionné à une note ou à une réponse précédente ("review
// gating" interdit par les guidelines Trustpilot). Décision du 2026-11-14.
export async function sendTrustpilotInvitationEmail(params: { email: string; name?: string | null }) {
  if (!RESEND_KEY) return { ok: false as const, error: "RESEND_API_KEY manquant" };
  const { email, name } = params;

  const greeting = name ? `Bonjour ${name},` : "Bonjour,";

  const contentHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#0f172a;">${greeting}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
      Cela fait maintenant quelques mois que vous utilisez lokt.fr. Un avis sur Trustpilot nous aide à être trouvés par d'autres propriétaires — et comme c'est une plateforme indépendante, chaque avis compte beaucoup à ce stade.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
      Cela prend <strong>moins d'une minute</strong>, et ça nous aide énormément.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <a href="${TRUSTPILOT_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:14px;">
            Laisser un avis sur Trustpilot →
          </a>
        </td>
      </tr>
    </table>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;">
      <p style="margin:0 0 10px;font-size:14px;color:#374151;">Merci encore,</p>
      <img src="${SIGNATURE_URL}" alt="lokt.fr" height="80" style="display:block;height:80px;width:auto;" />
    </div>
  `;

  const html = emailLayout({
    title: "Un avis Trustpilot nous aiderait beaucoup",
    preheader: "Moins d'une minute, et ça nous aide énormément.",
    contentHtml,
    footerText: "Vous recevez cet email car vous êtes utilisateur de lokt.fr.",
    logoUrl: LOGO_URL,
    logoHeight: 48,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "lokt.fr <contact@lokt.fr>",
      to: email,
      subject: "Un avis Trustpilot nous aiderait beaucoup",
      html,
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) return { ok: false as const, error: json };
  return { ok: true as const, id: json?.id };
}
