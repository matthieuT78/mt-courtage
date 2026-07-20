import { emailLayout } from "./layout";

export type CompteSupprimePayload = {
  fullName?: string;
  stripeCanceled: boolean;
};

export function buildCompteSupprimeEmailHtml(p: CompteSupprimePayload): string {
  const greeting = p.fullName ? `Bonjour ${esc(p.fullName)},` : "Bonjour,";

  const contentHtml = `
<p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">${greeting}</p>
<p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">
  Nous confirmons la <strong>suppression définitive</strong> de votre compte lokt.fr et de vos données associées
  (profil, logements, locataires, baux, documents).
</p>

${
  p.stripeCanceled
    ? `<p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#475569;">
  Votre abonnement en cours a été résilié immédiatement, sans frais supplémentaires.
</p>`
    : ""
}

<p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">
  Conformément à nos obligations légales, les données de facturation sont conservées 10 ans (obligation comptable).
  Aucune autre donnée n'est conservée.
</p>

<p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">
  Si vous n'êtes pas à l'origine de cette suppression, contactez-nous sans délai à contact@lokt.fr.
</p>
`;

  return emailLayout({
    title: "Votre compte lokt.fr a été supprimé",
    preheader: "Confirmation de la suppression définitive de votre compte et de vos données.",
    contentHtml,
    footerText: "Cette suppression est définitive et ne peut pas être annulée.",
  });
}

export function buildCompteSupprimeEmailText(p: CompteSupprimePayload): string {
  const greeting = p.fullName ? `Bonjour ${p.fullName},` : "Bonjour,";
  return [
    greeting,
    "",
    "Nous confirmons la suppression définitive de votre compte lokt.fr et de vos données associées (profil, logements, locataires, baux, documents).",
    "",
    ...(p.stripeCanceled ? ["Votre abonnement en cours a été résilié immédiatement, sans frais supplémentaires.", ""] : []),
    "Conformément à nos obligations légales, les données de facturation sont conservées 10 ans. Aucune autre donnée n'est conservée.",
    "",
    "Si vous n'êtes pas à l'origine de cette suppression, contactez-nous sans délai à contact@lokt.fr.",
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
