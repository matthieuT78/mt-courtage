export function emailLayout(params: {
  title: string;
  preheader?: string;
  contentHtml: string;
  footerText?: string;
}) {
  const preheader = params.preheader || "";
  const footerText = params.footerText || "Calculs indicatifs — ne constitue pas une offre de prêt.";
  return `
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:92vw;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:18px 20px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
              <img src="https://lokt.fr/lokt-logo.jpg" alt="lokt.fr" height="40" style="display:block;height:40px;width:auto;" />
            </td>
          </tr>

          <tr>
            <td style="padding:20px 20px 8px 20px;">
              <h1 style="margin:0;font-family:Arial,sans-serif;font-size:18px;line-height:1.3;color:#0f172a;">
                ${escapeHtml(params.title)}
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:0 20px 20px 20px;font-family:Arial,sans-serif;color:#0f172a;">
              ${params.contentHtml}
            </td>
          </tr>

          <tr>
            <td style="padding:14px 20px;border-top:1px solid #e2e8f0;background:#f8fafc;font-family:Arial,sans-serif;">
              <p style="margin:0;font-size:12px;line-height:1.4;color:#64748b;">
                ${escapeHtml(footerText)}
              </p>
              <p style="margin:6px 0 0 0;font-size:12px;color:#64748b;">© lokt.fr</p>
            </td>
          </tr>
        </table>

        <div style="height:18px"></div>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
