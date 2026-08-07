import { emailLayout } from "./layout";

export type CompteSuppressionProgrammeePayload = {
  fullName?: string;
  deletionDateLabel: string;
  loginUrl: string;
};

export function buildCompteSuppressionProgrammeeEmailHtml(p: CompteSuppressionProgrammeePayload): string {
  const greeting = p.fullName ? `Bonjour ${esc(p.fullName)},` : "Bonjour,";

  const contentHtml = `
<p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">${greeting}</p>
<p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">
  Votre compte lokt.fr a été créé mais votre adresse email n'a jamais été confirmée. Sans confirmation,
  votre compte et les données associées seront <strong>définitivement supprimés le ${esc(p.deletionDateLabel)}</strong>.
</p>
<p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">
  Un nouveau lien de confirmation vient de vous être envoyé par email séparément. Cliquez dessus avant cette date pour
  conserver votre compte. Si vous ne le trouvez pas, vous pouvez en redemander un depuis la page de connexion :
</p>
<p style="margin:22px 0 0 0;">
  <a href="${esc(p.loginUrl)}" style="display:inline-block;border-radius:999px;background:#0f172a;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
    Aller sur lokt.fr
  </a>
</p>
<p style="margin:20px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">
  Passé ce délai, la suppression est définitive et ne pourra pas être annulée.
</p>
`;

  return emailLayout({
    title: "Votre compte lokt.fr sera supprimé prochainement",
    preheader: `Confirmez votre compte avant le ${p.deletionDateLabel} pour éviter sa suppression.`,
    contentHtml,
    footerText: "Cet email concerne la conservation de votre compte lokt.fr.",
  });
}

export function buildCompteSuppressionProgrammeeEmailText(p: CompteSuppressionProgrammeePayload): string {
  const greeting = p.fullName ? `Bonjour ${p.fullName},` : "Bonjour,";
  return [
    greeting,
    "",
    "Votre compte lokt.fr a été créé mais votre adresse email n'a jamais été confirmée. Sans confirmation, votre compte et les données associées seront définitivement supprimés le " +
      p.deletionDateLabel +
      ".",
    "",
    "Un nouveau lien de confirmation vient de vous être envoyé par email séparément. Cliquez dessus avant cette date pour conserver votre compte. Si vous ne le trouvez pas, vous pouvez en redemander un ici :",
    p.loginUrl,
    "",
    "Passé ce délai, la suppression est définitive et ne pourra pas être annulée.",
    "",
    "— lokt.fr",
  ].join("\n");
}

function esc(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
