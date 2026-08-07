import { emailLayout } from "./layout";

export type CompteSupprimeInactivitePayload = {
  fullName?: string;
};

export function buildCompteSupprimeInactiviteEmailHtml(p: CompteSupprimeInactivitePayload): string {
  const greeting = p.fullName ? `Bonjour ${esc(p.fullName)},` : "Bonjour,";

  const contentHtml = `
<p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">${greeting}</p>
<p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">
  Votre compte lokt.fr n'ayant jamais été confirmé malgré nos relances, il vient d'être <strong>définitivement supprimé</strong>,
  ainsi que les données associées.
</p>
<p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">
  Aucune donnée n'est conservée. Vous pouvez recréer un compte à tout moment sur lokt.fr.
</p>
<p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
  Si vous pensez qu'il s'agit d'une erreur, contactez-nous à contact@lokt.fr.
</p>
`;

  return emailLayout({
    title: "Votre compte lokt.fr a été supprimé",
    preheader: "Compte jamais confirmé : suppression automatique après relances restées sans réponse.",
    contentHtml,
    footerText: "Cette suppression est définitive et ne peut pas être annulée.",
  });
}

export function buildCompteSupprimeInactiviteEmailText(p: CompteSupprimeInactivitePayload): string {
  const greeting = p.fullName ? `Bonjour ${p.fullName},` : "Bonjour,";
  return [
    greeting,
    "",
    "Votre compte lokt.fr n'ayant jamais été confirmé malgré nos relances, il vient d'être définitivement supprimé, ainsi que les données associées.",
    "",
    "Aucune donnée n'est conservée. Vous pouvez recréer un compte à tout moment sur lokt.fr.",
    "",
    "Si vous pensez qu'il s'agit d'une erreur, contactez-nous à contact@lokt.fr.",
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
