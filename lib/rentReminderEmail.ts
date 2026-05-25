type RentReminderEmailParams = {
  baseUrl: string;
  period: string;
  propertyLabel?: string | null;
  tenantName?: string | null;
  expectedRent?: number | null;
  expectedCharges?: number | null;
  fullUrl: string;
  partialUrl: string;
  unpaidUrl: string;
  isTest?: boolean;
};

function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function euro(v: unknown) {
  const n = Number(v || 0);
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function monthLabel(yyyymm: string) {
  const [year, month] = String(yyyymm).split("-").map(Number);
  if (!year || !month) return yyyymm;
  return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function buildRentReminderOwnerEmail(params: RentReminderEmailParams) {
  const baseUrl = params.baseUrl.replace(/\/$/, "");
  const logoUrl = `${baseUrl}/lokt-logo.jpg`;
  const expectedRent = Number(params.expectedRent || 0);
  const expectedCharges = Number(params.expectedCharges || 0);
  const expectedTotal = expectedRent + expectedCharges;
  const periodLabel = monthLabel(params.period);
  const propertyLabel = params.propertyLabel || "Logement";
  const tenantName = params.tenantName || "Locataire";

  const subject = `${params.isTest ? "[TEST] " : ""}Validation du paiement du loyer - ${periodLabel} | lokt.fr`;

  const text = `
Bonjour,

Le paiement du loyer de ${periodLabel} doit être validé avant de générer une quittance.

Logement : ${propertyLabel}
Locataire : ${tenantName}
Montant attendu : ${euro(expectedTotal)}

Choix disponibles :
- Loyer reçu complet : ${params.fullUrl}
- Paiement incomplet : ${params.partialUrl}
- Non reçu : ${params.unpaidUrl}

Une quittance ne doit être générée que si le paiement complet du loyer et des charges est confirmé.

lokt.fr
  `.trim();

  const html = `
<div style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:680px;margin:0 auto;padding:24px 14px;">
    <div style="overflow:hidden;border:1px solid #e2e8f0;border-radius:22px;background:#ffffff;">
      <div style="padding:22px 24px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
        <img src="${logoUrl}" alt="lokt.fr" width="116" style="display:block;max-width:116px;height:auto;margin:0 0 14px;" />
        <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;font-weight:700;">
          Validation paiement
        </p>
        <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;color:#0f172a;">
          Le loyer de ${esc(periodLabel)} a-t-il été reçu ?
        </h1>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.55;color:#475569;">
          Confirmez le statut du paiement avant toute génération de quittance. Une quittance vaut reçu : elle ne doit être créée qu'après paiement complet.
        </p>
      </div>

      <div style="padding:22px 24px;">
        ${params.isTest ? `
          <div style="margin:0 0 16px;padding:12px 14px;border:1px solid #bae6fd;border-radius:14px;background:#f0f9ff;color:#075985;font-size:13px;line-height:1.45;">
            Email de test : les liens ci-dessous utilisent un vrai token et peuvent modifier la période sélectionnée.
          </div>
        ` : ""}

        <div style="border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;padding:14px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:5px 0;color:#64748b;">Logement</td>
              <td style="padding:5px 0;text-align:right;font-weight:700;color:#0f172a;">${esc(propertyLabel)}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;color:#64748b;">Locataire</td>
              <td style="padding:5px 0;text-align:right;font-weight:700;color:#0f172a;">${esc(tenantName)}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;color:#64748b;">Période</td>
              <td style="padding:5px 0;text-align:right;font-weight:700;color:#0f172a;">${esc(periodLabel)}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;color:#64748b;">Montant attendu</td>
              <td style="padding:5px 0;text-align:right;font-weight:800;color:#0f172a;">${euro(expectedTotal)}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top:18px;">
          <a href="${params.fullUrl}" style="display:block;text-align:center;margin:0 0 10px;padding:14px 18px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;">
            Loyer reçu complet
          </a>
          <a href="${params.partialUrl}" style="display:block;text-align:center;margin:0 0 10px;padding:13px 18px;border-radius:999px;border:1px solid #fdba74;background:#fff7ed;color:#9a3412;text-decoration:none;font-weight:800;font-size:15px;">
            Paiement incomplet
          </a>
          <a href="${params.unpaidUrl}" style="display:block;text-align:center;padding:13px 18px;border-radius:999px;border:1px solid #fecaca;background:#fff1f2;color:#991b1b;text-decoration:none;font-weight:800;font-size:15px;">
            Non reçu
          </a>
        </div>

        <div style="margin-top:18px;padding:13px 14px;border-radius:14px;background:#fffbeb;border:1px solid #fde68a;color:#78350f;font-size:13px;line-height:1.5;">
          En cas de paiement incomplet, lokt.fr bloque la quittance, alimente le suivi Finance et proposera une relance au locataire.
        </div>
      </div>

      <div style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
        <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
          Lien valable 7 jours. Si vous avez déjà traité ce paiement dans lokt.fr, vous pouvez ignorer cet email.
        </p>
      </div>
    </div>
  </div>
</div>
  `.trim();

  return { subject, html, text };
}
