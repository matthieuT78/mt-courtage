import { emailLayout } from "./layout";

function euro(n: number) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function buildTeomRecoveryRequestEmail(params: {
  tenantFirstName: string;
  propertyLabel: string;
  periodStart: string;
  periodEnd: string;
  occupancyStart: string;
  occupancyEnd: string;
  occupiedDays: number;
  periodDays: number;
  teomAmount: number;
  lotSharePercent: number;
  recoverableAmount: number;
}) {
  const {
    tenantFirstName,
    propertyLabel,
    periodStart,
    periodEnd,
    occupancyStart,
    occupancyEnd,
    occupiedDays,
    periodDays,
    teomAmount,
    lotSharePercent,
    recoverableAmount,
  } = params;

  const year = String(periodStart).slice(0, 4);
  const lotShareLine = lotSharePercent < 100
    ? `<tr><td style="padding:4px 0;color:#64748b;">Quote-part du lot</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${lotSharePercent} %</td></tr>`
    : "";

  const contentHtml = `
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">Bonjour ${tenantFirstName || ""},</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">
      La taxe d'enlèvement des ordures ménagères (TEOM) ${year} de votre logement (${propertyLabel}) fait partie des charges locatives récupérables (décret n°87-713 du 26 août 1987). Voici le détail du calcul pour votre période d'occupation :
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13.5px;margin:4px 0 16px;">
      <tr><td style="padding:4px 0;color:#64748b;">TEOM totale ${year}</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${euro(teomAmount)}</td></tr>
      ${lotShareLine}
      <tr><td style="padding:4px 0;color:#64748b;">Votre période d'occupation</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${fmtDate(occupancyStart)} au ${fmtDate(occupancyEnd)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Prorata</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${occupiedDays} / ${periodDays} jours</td></tr>
    </table>
    <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;">
      <p style="margin:0;font-size:13px;color:#166534;">Montant à votre charge</p>
      <p style="margin:2px 0 0;font-size:22px;font-weight:800;color:#166534;">${euro(recoverableAmount)}</p>
    </div>
    <p style="margin:0 0 14px;font-size:13.5px;line-height:1.6;color:#475569;">
      L'avis de taxe foncière dont est extraite cette ligne TEOM est consultable sur demande. N'hésitez pas à nous contacter pour toute question.
    </p>
  `;

  return {
    subject: `TEOM ${year} à régulariser — ${propertyLabel}`,
    html: emailLayout({
      title: `TEOM ${year} — ${propertyLabel}`,
      preheader: `Montant à régulariser : ${euro(recoverableAmount)}`,
      contentHtml,
      footerText: "Document envoyé via lokt.fr, l'outil de gestion locative de votre bailleur.",
    }),
  };
}
