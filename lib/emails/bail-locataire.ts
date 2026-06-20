import { emailLayout } from "./layout";

export type BailLocatairePayload = {
  tenantName: string;
  propertyLabel: string;
  propertyAddress: string;
  documentKind: string;
  portalUrl: string;
};

export function buildBailLocataireEmailHtml(p: BailLocatairePayload): string {
  const greeting = p.tenantName ? `Bonjour ${esc(p.tenantName)},` : "Bonjour,";

  const contentHtml = `
<p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">${greeting}</p>
<p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">
  Votre bailleur vient de mettre à disposition votre <strong>contrat de location</strong> dans votre espace locataire lokt.fr.
</p>

<div style="margin:18px 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#0f172a;">${esc(p.propertyLabel)}</p>
  <p style="margin:4px 0 0 0;font-size:13px;color:#64748b;">${esc(p.propertyAddress)}</p>
  ${p.documentKind ? `<p style="margin:6px 0 0 0;font-size:12px;color:#64748b;">${esc(p.documentKind)}</p>` : ""}
</div>

<p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#475569;">
  Consultez et téléchargez ce document depuis votre espace. Vous pouvez également y accuser réception pour confirmer la bonne remise.
</p>

<div style="text-align:center;margin:24px 0;">
  <a href="${esc(p.portalUrl)}" target="_blank"
     style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;border-radius:10px;text-decoration:none;">
    Consulter mon contrat de location
  </a>
</div>

<p style="margin:24px 0 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
  Si vous n'arrivez pas à vous connecter, rendez-vous sur lokt.fr → Espace locataire.
  Pour toute question, contactez directement votre bailleur.
</p>
`;

  return emailLayout({
    title: `Votre contrat de location est disponible — ${p.propertyLabel}`,
    preheader: `Votre bailleur vient de partager votre contrat de location sur lokt.fr.`,
    contentHtml,
  });
}

export function buildBailLocataireEmailText(p: BailLocatairePayload): string {
  const greeting = p.tenantName ? `Bonjour ${p.tenantName},` : "Bonjour,";
  return [
    greeting,
    "",
    "Votre bailleur vient de mettre à disposition votre contrat de location.",
    "",
    `Bien : ${p.propertyLabel}`,
    `Adresse : ${p.propertyAddress}`,
    "",
    `Consulter mon espace locataire : ${p.portalUrl}`,
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
