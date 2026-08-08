import { sendEmailViaResend } from "./mailer/resend";
import { sendTelegramMessage } from "./telegram";

const ALERT_EMAIL = "matthieu.turbier@gmail.com";

// Alerte best-effort (email + Telegram) quand un cron d'emails échoue pour au
// moins un destinataire — ce type d'échec ne fait planter aucune requête
// (chaque utilisateur est traité indépendamment), donc rien ne le remonte
// nulle part par défaut. C'est exactement ce qui a permis au rate limit
// Supabase de bloquer signup-confirmation-reminder pendant plusieurs
// semaines sans que personne ne le remarque.
export async function alertCronFailures(cronName: string, failures: Array<{ email?: string | null; error: string }>) {
  if (!failures.length) return;

  const lines = failures.map((f) => `• ${f.email ?? "?"} — ${f.error}`).join("\n");

  await sendTelegramMessage(
    `🚨 <b>lokt.fr — ${escHtml(cronName)}</b>\n${failures.length} échec(s)\n\n${escHtml(lines)}`
  );

  const rows = failures
    .map(
      (f) =>
        `<tr><td style="padding:6px 10px;font-size:13px;border-bottom:1px solid #f1f5f9;">${escHtml(f.email ?? "?")}</td><td style="padding:6px 10px;font-size:13px;color:#dc2626;border-bottom:1px solid #f1f5f9;">${escHtml(f.error)}</td></tr>`
    )
    .join("");

  await sendEmailViaResend({
    to: ALERT_EMAIL,
    subject: `⚠️ lokt.fr — ${cronName} : ${failures.length} échec${failures.length > 1 ? "s" : ""}`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
  <p style="font-size:14px;">
    <strong>${failures.length} échec${failures.length > 1 ? "s" : ""}</strong> dans le cron <code>${escHtml(cronName)}</code>.
  </p>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <thead>
      <tr style="background:#f8fafc;text-align:left;">
        <th style="padding:6px 10px;font-size:12px;color:#64748b;">Email</th>
        <th style="padding:6px 10px;font-size:12px;color:#64748b;">Erreur</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`,
    text: `${failures.length} échec(s) dans ${cronName} :\n${lines}`,
  });
}

function escHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
