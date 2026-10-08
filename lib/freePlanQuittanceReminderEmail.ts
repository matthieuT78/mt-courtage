// lib/freePlanQuittanceReminderEmail.ts
// Email de relance pour les bailleurs en plan gratuit qui n'ont pas confirmé
// le loyer du mois — sert aussi de funnel vers lokt·one. Contrairement à
// rentReminderEmail.ts (plan payant), ce mail ne contient AUCUN lien d'action
// "un clic" : il ramène vers l'app (section Quittances), jamais d'exécution
// serveur directe pour un compte gratuit, pour ne pas avoir à dupliquer la
// logique de confirmation/envoi hors de l'app.

type FreePlanReminderEmailParams = {
  baseUrl: string;
  period: string; // yyyy-mm
  propertyLabel?: string | null;
  tenantName?: string | null;
  expectedRent?: number | null;
  expectedCharges?: number | null;
  leaseId: string;
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

export function buildFreePlanQuittanceReminderEmail(params: FreePlanReminderEmailParams) {
  const baseUrl = params.baseUrl.replace(/\/$/, "");
  const logoUrl = `${baseUrl}/lokt-logo-small.jpg`;
  const tarifsUrl = `${baseUrl}/tarifs?ref=free_plan_quittance_reminder`;
  const quittancesUrl = `${baseUrl}/espace-bailleur?tab=quittances`;

  const expectedRent = Number(params.expectedRent || 0);
  const expectedCharges = Number(params.expectedCharges || 0);
  const expectedTotal = expectedRent + expectedCharges;
  const periodLabel = monthLabel(params.period);
  const propertyLabel = params.propertyLabel || "Logement";
  const tenantName = params.tenantName || "Locataire";
  const tenantFirstName = tenantName.split(" ")[0];

  const subject = `Le loyer de ${periodLabel} n'a pas été confirmé | lokt.fr`;

  const steps: Array<{ label: string; action: string; rest: string }> = [
    { label: "Ouvrez la section", action: "« Quittances »", rest: "depuis le menu de votre espace bailleur." },
    { label: "Cliquez sur", action: "« Confirmer payé »", rest: "(ou « Solde reçu » si le paiement est partiel) en face de ce locataire." },
    { label: "Vérifiez le montant, et laissez cochée", action: "« Envoyer la quittance au locataire par email une fois générée »", rest: "." },
    { label: "Validez", action: "— paiement confirmé, PDF généré et quittance envoyée à votre locataire", rest: "en un seul clic." },
  ];

  const stepsHtml = steps
    .map(
      (s, i) => `
  <tr>
    <td style="padding:7px 10px 7px 0;vertical-align:top;width:26px;">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:#0f172a;color:#ffffff;font-size:12px;font-weight:800;">${i + 1}</span>
    </td>
    <td style="padding:7px 0;font-size:13px;line-height:1.5;color:#334155;">
      ${s.label} <b style="color:#0f172a;">${s.action}</b> ${s.rest}
    </td>
  </tr>`
    )
    .join("");

  const text = `
Bonjour,

Le loyer de ${periodLabel} n'a pas été confirmé dans lokt.fr.

Ce que lokt fait : valider le paiement, générer la quittance et l'envoyer à votre locataire, en un clic depuis l'interface. Sur le plan gratuit, c'est à vous de le faire chaque mois. Avec lokt·one, tout se fait automatiquement.

Logement : ${propertyLabel}
Locataire : ${tenantName}
Montant attendu : ${euro(expectedTotal)}

Automatiser avec lokt·one : ${tarifsUrl}
Ou continuer manuellement : ${quittancesUrl}

lokt.fr
  `.trim();

  const html = `
<div style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:680px;margin:0 auto;padding:24px 14px;">
    <div style="overflow:hidden;border:1px solid #e2e8f0;border-radius:22px;background:#ffffff;">

      <div style="padding:20px 24px 16px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td valign="middle">
              <img src="${logoUrl}" alt="lokt.fr" height="44" style="display:block;height:44px;width:auto;" />
            </td>
            <td valign="middle" align="right">
              <span style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;font-weight:700;">Rappel quittance</span>
            </td>
          </tr>
        </table>
        <h1 style="margin:16px 0 0;font-size:24px;line-height:1.25;color:#0f172a;">
          Le loyer de ${esc(periodLabel)} n'a pas été confirmé
        </h1>

        <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;font-weight:700;">Ce que lokt fait</p>
          <p style="margin:6px 0 0;font-size:13px;line-height:1.55;color:#334155;">
            lokt vous permet de valider le paiement du loyer, de générer la quittance et de l'envoyer à votre locataire — en un clic depuis l'interface. Sur le plan gratuit, c'est à vous de le faire chaque mois. Avec <b>lokt·one</b>, tout se fait automatiquement, sans que vous ayez besoin de vous reconnecter.
          </p>
        </div>

        <p style="margin:14px 0 0;font-size:14px;line-height:1.55;color:#475569;">
          On n'a aucune trace que ce loyer ait été validé dans lokt.fr. Tant que ce n'est pas fait, aucune quittance n'existe — ni pour vous, ni pour votre locataire.
        </p>
      </div>

      <div style="padding:22px 24px;">
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

        <div style="margin-top:22px;padding:18px;border-radius:18px;background:#0f172a;">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;font-weight:700;">
            La solution simple
          </p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#e2e8f0;">
            Avec <b style="color:#ffffff;">lokt·one</b>, plus besoin de vous reconnecter chaque mois : la confirmation du paiement, la quittance et l'envoi à ${esc(tenantFirstName)} se font automatiquement.
          </p>
          <a href="${tarifsUrl}" style="display:block;text-align:center;padding:14px 18px;border-radius:999px;background:#ffffff;color:#0f172a;text-decoration:none;font-weight:800;font-size:15px;">
            Automatiser mes quittances — 6,90&nbsp;€/mois
          </a>
        </div>

        <p style="margin:18px 0 8px;text-align:center;font-size:13px;color:#64748b;">
          Ou faites-le vous-même maintenant, en 4 étapes :
        </p>
        <div style="border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;padding:10px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${stepsHtml}
          </table>
        </div>
        <a href="${quittancesUrl}" style="display:block;text-align:center;margin-top:12px;padding:12px 18px;border-radius:999px;border:1px solid #cbd5e1;color:#0f172a;text-decoration:none;font-weight:700;font-size:14px;">
          Aller dans la section Quittances
        </a>
      </div>

      <div style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
        <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
          Si vous avez déjà traité ce paiement dans lokt.fr, vous pouvez ignorer cet email.
        </p>
      </div>
    </div>
  </div>
</div>
  `.trim();

  return { subject, html, text };
}
