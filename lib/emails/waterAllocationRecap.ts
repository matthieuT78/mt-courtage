import { emailLayout } from "./layout";

function euro(n: number, minimumFractionDigits = 2) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits });
}

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function buildWaterAllocationRecapEmail(params: {
  tenantFirstName: string;
  propertyLabel: string;
  unitLabel: string;
  periodStart: string;
  periodEnd: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  globalConsumption: number;
  unitPrice: number;
  variableAmountDue: number;
  fixedAmountDue: number;
  amountDue: number;
}) {
  const {
    tenantFirstName,
    propertyLabel,
    periodStart,
    periodEnd,
    previousReading,
    currentReading,
    consumption,
    globalConsumption,
    unitPrice,
    variableAmountDue,
    fixedAmountDue,
    amountDue,
  } = params;

  const contentHtml = `
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">Bonjour ${tenantFirstName || ""},</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155;">
      Voici la répartition de la facture d'eau pour la période du ${fmtDate(periodStart)} au ${fmtDate(periodEnd)}, concernant votre logement (${propertyLabel}).
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13.5px;margin:4px 0 16px;">
      <tr><td style="padding:4px 0;color:#64748b;">Relevé précédent</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${previousReading.toLocaleString("fr-FR")} m³</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Relevé actuel</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${currentReading.toLocaleString("fr-FR")} m³</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Votre consommation</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${consumption.toLocaleString("fr-FR")} m³</td></tr>
      ${unitPrice > 0 ? `<tr><td style="padding:4px 0;color:#64748b;">Prix appliqué</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${euro(unitPrice, 4)} / m³</td></tr>` : ""}
      <tr><td style="padding:4px 0;color:#64748b;">Compteur général (immeuble)</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${globalConsumption.toLocaleString("fr-FR")} m³</td></tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13.5px;margin:4px 0 16px;background:#f8fafc;border-radius:10px;">
      <tr><td style="padding:8px 10px;color:#64748b;">Part consommation</td><td style="padding:8px 10px;text-align:right;font-weight:700;color:#0f172a;">${euro(variableAmountDue)}</td></tr>
      <tr><td style="padding:8px 10px;color:#64748b;">Part fixe (abonnement)</td><td style="padding:8px 10px;text-align:right;font-weight:700;color:#0f172a;">${euro(fixedAmountDue)}</td></tr>
    </table>
    <div style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#ecfeff;border:1px solid #a5f3fc;">
      <p style="margin:0;font-size:13px;color:#0e7490;">Montant à régler</p>
      <p style="margin:2px 0 0;font-size:22px;font-weight:800;color:#0e7490;">${euro(amountDue)}</p>
    </div>
    <p style="margin:0 0 14px;font-size:13.5px;line-height:1.6;color:#475569;">
      Ce montant correspond uniquement à votre lot, calculé au prorata de votre consommation individuelle. Vous pouvez vérifier les relevés ci-dessus sur votre propre compteur. N'hésitez pas à nous contacter pour toute question.
    </p>
  `;

  return {
    subject: `Répartition facture d'eau — ${propertyLabel}`,
    html: emailLayout({
      title: `Répartition d'eau — ${propertyLabel}`,
      preheader: `Montant à régler : ${euro(amountDue)}`,
      contentHtml,
      footerText: "Document envoyé via lokt.fr, l'outil de gestion locative de votre bailleur.",
    }),
  };
}
