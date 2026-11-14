import { emailLayout } from "./layout";

const RESEND_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lokt.fr";
const SIGNATURE_URL = `${SITE_URL}/signature-lokt.png`;

export async function sendReviewInvitationEmail(params: { email: string; name?: string | null; source?: string | null }) {
  if (!RESEND_KEY) return { ok: false as const, error: "RESEND_API_KEY manquant" };
  const { email, name, source } = params;

  const avisUrl = `${SITE_URL}/avis?email=${encodeURIComponent(email)}${name ? `&name=${encodeURIComponent(name)}` : ""}&source=${encodeURIComponent(source ?? "invitation")}`;
  const greeting = name ? `Bonjour ${name},` : "Bonjour,";

  const contentHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#0f172a;">${greeting}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
      Vous utilisez lokt.fr depuis quelques semaines pour gérer votre location. Votre avis nous aide à améliorer l'outil, et aide aussi d'autres propriétaires à nous trouver.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
      Cela prend <strong>moins de 30 secondes</strong> — une note et quelques mots suffisent.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <a href="${avisUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:14px;">
            Laisser un avis →
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
    title: "Votre avis nous aide à améliorer lokt.fr",
    preheader: "Moins de 30 secondes pour nous dire ce que vous en pensez.",
    contentHtml,
    footerText: "Vous recevez cet email car vous êtes utilisateur de lokt.fr.",
    logoUrl: `${SITE_URL}/lokt-logo-small.jpg`,
    logoHeight: 48,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "lokt.fr <contact@lokt.fr>",
      to: email,
      subject: "Votre avis nous aide à améliorer lokt.fr",
      html,
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) return { ok: false as const, error: json };
  return { ok: true as const, id: json?.id };
}
