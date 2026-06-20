import { emailLayout } from "./layout";

export type EdlLocatairePayload = {
  reportType: "entry" | "exit";
  occupantLabel: string;
  propertyLabel: string;
  propertyAddress: string;
  performedAt: string | null;
  pdfUrl: string;
};

function reportTypeLabel(t: "entry" | "exit") {
  return t === "entry" ? "d'entrée" : "de sortie";
}

export function buildEdlLocataireEmailHtml(p: EdlLocatairePayload): string {
  const typeLabel = reportTypeLabel(p.reportType);
  const dateStr = p.performedAt
    ? new Date(p.performedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const contentHtml = `
<p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">
  Bonjour ${escHtml(p.occupantLabel)},
</p>
<p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#334155;">
  Votre bailleur vous transmet l'état des lieux <strong>${typeLabel}</strong>
  ${dateStr ? `du <strong>${escHtml(dateStr)}</strong>` : ""}
  concernant le bien suivant :
</p>

<div style="margin:18px 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#0f172a;">${escHtml(p.propertyLabel)}</p>
  <p style="margin:4px 0 0 0;font-size:13px;color:#64748b;">${escHtml(p.propertyAddress)}</p>
</div>

<p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#475569;">
  Vous pouvez consulter et télécharger le document en cliquant sur le bouton ci-dessous.
  Conservez ce PDF : il constitue votre référence légale.
</p>

<div style="text-align:center;margin:24px 0;">
  <a href="${escHtml(p.pdfUrl)}" target="_blank"
     style="display:inline-block;padding:14px 28px;background:#0f172a;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;border-radius:10px;text-decoration:none;">
    Consulter l'état des lieux ${typeLabel}
  </a>
</div>

<p style="margin:24px 0 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
  Ce document vous a été transmis via lokt.fr. Si vous avez des questions,
  contactez directement votre bailleur.
</p>
`;

  return emailLayout({
    title: `État des lieux ${typeLabel} — ${p.propertyLabel}`,
    preheader: `Document à consulter : état des lieux ${typeLabel}${dateStr ? ` du ${dateStr}` : ""}.`,
    contentHtml,
  });
}

export function buildEdlLocataireEmailText(p: EdlLocatairePayload): string {
  const typeLabel = reportTypeLabel(p.reportType);
  const dateStr = p.performedAt
    ? new Date(p.performedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return [
    `Bonjour ${p.occupantLabel},`,
    "",
    `Votre bailleur vous transmet l'état des lieux ${typeLabel}${dateStr ? ` du ${dateStr}` : ""}.`,
    "",
    `Bien : ${p.propertyLabel}`,
    `Adresse : ${p.propertyAddress}`,
    "",
    `Lien PDF : ${p.pdfUrl}`,
    "",
    "Conservez ce document : il constitue votre référence légale.",
    "",
    "— lokt.fr",
  ].join("\n");
}

function escHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
