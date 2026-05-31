type MessageNotificationEmailParams = {
  recipientName?: string | null;
  senderName: string;
  messagePreview: string;
  messageUrl: string;
};

function escapeHtml(value?: string | null) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function shortenMessagePreview(body: string, maxLength = 180) {
  const normalized = String(body || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildMessageNotificationEmail(params: MessageNotificationEmailParams) {
  const recipientName = String(params.recipientName || "").trim();
  const greeting = recipientName ? `Bonjour ${recipientName},` : "Bonjour,";
  const preview = shortenMessagePreview(params.messagePreview);
  const subject = `Nouveau message de ${params.senderName} sur lokt.fr`;

  const html = `
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:92vw;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:18px 20px;border-bottom:1px solid #e2e8f0;">
              <img src="https://lokt.fr/lokt-logo.jpg" alt="lokt.fr" height="40" style="display:block;height:40px;width:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:20px;font-family:Arial,sans-serif;color:#0f172a;">
              <p style="margin:0 0 14px;font-size:15px;line-height:1.5;">${escapeHtml(greeting)}</p>
              <h1 style="margin:0;font-size:20px;line-height:1.35;">Vous avez reçu un nouveau message</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#475569;">
                ${escapeHtml(params.senderName)} vous a écrit dans votre messagerie lokt.fr.
              </p>
              <div style="margin:18px 0;padding:14px 16px;border-left:4px solid #6366f1;background:#f8fafc;color:#334155;font-size:14px;line-height:1.55;">
                ${escapeHtml(preview)}
              </div>
              <a href="${escapeHtml(params.messageUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                Consulter le message
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 20px;border-top:1px solid #e2e8f0;background:#f8fafc;font-family:Arial,sans-serif;">
              <p style="margin:0;font-size:12px;line-height:1.4;color:#64748b;">
                Cet email vous informe d’un nouvel échange dans votre espace lokt.fr.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
${greeting}

Vous avez reçu un nouveau message de ${params.senderName} dans votre messagerie lokt.fr.

${preview}

Consulter le message : ${params.messageUrl}
  `.trim();

  return { subject, html, text, preview };
}
