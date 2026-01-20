type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

function isResendDisabled(data: any) {
  // optionnel : tu peux garder ta logique si tu l’avais déjà
  return false;
}

export async function sendEmailViaResend(params: SendEmailParams) {
  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.RESEND_FROM || "lokt.fr <contact@lokt.fr>";
  const replyTo = params.replyTo || process.env.RESEND_REPLY_TO || "contact@lokt.fr";

  if (!apiKey) return { ok: false as const, error: "RESEND_API_KEY manquante" };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: replyTo, // Resend accepte reply_to
    }),
  });

  const data = await r.json().catch(() => null);

  if (!r.ok) return { ok: false as const, error: data?.message || "resend_error", raw: data };
  if (isResendDisabled(data)) return { ok: false as const, error: "resend_disabled", raw: data };

  return { ok: true as const, data };
}
