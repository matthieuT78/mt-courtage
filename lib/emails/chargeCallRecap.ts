import { emailLayout } from "./layout";

function euro(n: number) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function buildChargeCallRecapEmail(params: {
  tenantFirstName: string;
  propertyLabel: string;
  lotLabel: string;
  periodLabel: string;
  tantiemes: number;
  baseTantiemes: number;
  sharePercent: number;
  grossAmount: number;
  recoverablePercent: number;
  recoverableAmount: number;
}) {
  const {
    tenantFirstName,
    propertyLabel,
    lotLabel,
    periodLabel,
    tantiemes,
    baseTantiemes,
    sharePercent,
    grossAmount,
    recoverablePercent,
    recoverableAmount,
  } = params;

  const contentHtml = `
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">Bonjour ${tenantFirstName || ""},</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">
      Voici l'appel de charges locatives pour la période ${periodLabel}, concernant votre lot (${lotLabel}) à ${propertyLabel}.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13.5px;margin:4px 0 16px;">
      <tr><td style="padding:4px 0;color:#64748b;">Tantièmes de votre lot</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${tantiemes.toLocaleString("fr-FR")} / ${baseTantiemes.toLocaleString("fr-FR")}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Quote-part</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${sharePercent.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Montant total de votre quote-part</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${euro(grossAmount)}</td></tr>
      ${recoverablePercent < 100 ? `<tr><td style="padding:4px 0;color:#64748b;">Part récupérable auprès de vous</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${recoverablePercent.toLocaleString("fr-FR")} %</td></tr>` : ""}
    </table>
    <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#f5f3ff;border:1px solid #ddd6fe;">
      <p style="margin:0;font-size:13px;color:#5b21b6;">Montant à régler</p>
      <p style="margin:2px 0 0;font-size:22px;font-weight:800;color:#5b21b6;">${euro(recoverableAmount)}</p>
    </div>
    <p style="margin:0 0 14px;font-size:13.5px;line-height:1.6;color:#475569;">
      Ce montant correspond uniquement à votre lot, au prorata de ses tantièmes dans l'immeuble. N'hésitez pas à nous contacter pour toute question.
    </p>
  `;

  return {
    subject: `Appel de charges ${periodLabel} — ${propertyLabel}`,
    html: emailLayout({
      title: `Appel de charges ${periodLabel} — ${propertyLabel}`,
      preheader: `Montant à régler : ${euro(recoverableAmount)}`,
      contentHtml,
      footerText: "Document envoyé via lokt.fr, l'outil de gestion locative de votre bailleur.",
    }),
  };
}
