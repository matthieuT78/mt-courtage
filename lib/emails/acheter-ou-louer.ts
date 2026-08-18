// lib/emails/acheter-ou-louer.ts
import { renderActionPlanHtml, renderActionPlanTextLines } from "./actionPlanFormat";

type Verdict = "rp" | "locatif" | "attendre";

type AcheterOuLouerPayload = {
  verdict: Verdict;
  villeNom?: string;
  villePostal?: string;
  objectif?: string;
  revenus?: number;
  apport?: number;
  loyer_actuel?: number;
  // RP
  prix_rp?: number;
  loyer_marche_rp?: number;
  mensualite_rp?: number;
  extra_rp?: number;
  score_rp?: number;
  // Locatif
  prix_locatif?: number;
  loyer_locatif?: number;
  mensualite_locatif?: number;
  cashflow_net?: number;
  cout_net_locatif?: number;
  rendement_brut?: number;
  score_locatif?: number;
  actionPlan?: string;
};

function fmtEuro(n: number | undefined) {
  if (!n && n !== 0) return "-";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
function fmtPct(n: number | undefined) {
  if (!n && n !== 0) return "-";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
}

const VERDICT_LABELS: Record<Verdict, string> = {
  rp: "Acheter votre résidence principale",
  locatif: "Investir dans le locatif en restant locataire",
  attendre: "Attendre et renforcer votre épargne",
};

const VERDICT_COLORS: Record<Verdict, string> = {
  rp: "#059669",
  locatif: "#635bff",
  attendre: "#d97706",
};

export function buildAcheterOuLouerEmailHtml(p: AcheterOuLouerPayload): string {
  const verdictLabel = VERDICT_LABELS[p.verdict];
  const verdictColor = VERDICT_COLORS[p.verdict];
  const hasMonthly = (p.mensualite_rp ?? 0) > 0;
  const hasLocatif = (p.mensualite_locatif ?? 0) > 0;

  const extraRpSign = (p.extra_rp ?? 0) >= 0 ? "+" : "";
  const coutLocSign = (p.cout_net_locatif ?? 0) - (p.loyer_actuel ?? 0) >= 0 ? "+" : "";
  const coutLocDelta = hasLocatif && p.loyer_actuel
    ? (p.cout_net_locatif ?? 0) - p.loyer_actuel
    : null;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#635bff,#00a8d4);border-radius:16px;padding:24px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.16em;color:rgba(255,255,255,0.75);text-transform:uppercase;">Votre analyse — lokt.fr</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;line-height:1.3;">Acheter ou louer ?</h1>
      ${p.villeNom ? `<p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">${p.villeNom}${p.villePostal ? ` (${p.villePostal})` : ""}</p>` : ""}
    </div>

    <!-- Verdict -->
    <div style="background:#fff;border-radius:12px;border:2px solid ${verdictColor}30;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.16em;color:#64748b;text-transform:uppercase;">Notre recommandation</p>
      <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${verdictColor};">${verdictLabel}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#475569;line-height:1.6;">
        ${p.verdict === "rp"
          ? `Votre profil, votre horizon et le marché de ${p.villeNom || "votre ville"} sont favorables à l'achat de votre résidence principale. La mensualité remplace progressivement votre loyer et vous construisez votre patrimoine.`
          : p.verdict === "locatif"
          ? `Rester locataire et acheter un bien pour le louer est la stratégie la plus efficace dans votre situation. Le cashflow locatif compense partiellement votre loyer, et vous constituez un patrimoine immobilier.`
          : `Les conditions ne sont pas encore optimales pour un achat. Renforcez votre apport et attendez une situation professionnelle plus stable avant de vous engager.`
        }
      </p>
    </div>

    ${hasMonthly ? `
    <!-- Comparaison mensuelle -->
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.16em;color:#64748b;text-transform:uppercase;">Comparaison mensuelle vs louer seul</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 0;font-size:13px;font-weight:600;color:#1e293b;">Résidence principale</td>
          <td style="padding:10px 0;text-align:right;font-size:14px;font-weight:700;color:${(p.extra_rp ?? 0) <= 0 ? "#059669" : "#1e293b"};">${extraRpSign}${fmtEuro(p.extra_rp)}/mois</td>
        </tr>
        ${hasLocatif && coutLocDelta !== null ? `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:10px 0;font-size:13px;font-weight:600;color:#1e293b;">Locatif + rester locataire</td>
          <td style="padding:10px 0;text-align:right;font-size:14px;font-weight:700;color:${coutLocDelta <= 0 ? "#059669" : "#1e293b"};">${coutLocSign}${fmtEuro(coutLocDelta)}/mois</td>
        </tr>
        ` : ""}
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#94a3b8;">Rester locataire</td>
          <td style="padding:10px 0;text-align:right;font-size:13px;color:#94a3b8;">Référence — 0 €</td>
        </tr>
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">Les montants positifs signifient un surcoût mensuel vs louer seul, mais avec constitution de patrimoine.</p>
    </div>
    ` : ""}

    ${(p.score_rp !== undefined || p.score_locatif !== undefined) ? `
    <!-- Scores -->
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.16em;color:#64748b;text-transform:uppercase;">Scores de votre profil</p>
      ${p.score_rp !== undefined ? `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:13px;font-weight:600;color:#1e293b;">Résidence principale</span>
          <span style="font-size:13px;font-weight:700;color:#059669;background:#ecfdf5;border-radius:20px;padding:2px 10px;">${p.score_rp}/100</span>
        </div>
        <div style="background:#f1f5f9;border-radius:4px;height:6px;overflow:hidden;">
          <div style="height:100%;width:${p.score_rp}%;background:linear-gradient(90deg,#34d399,#059669);border-radius:4px;"></div>
        </div>
      </div>
      ` : ""}
      ${p.score_locatif !== undefined ? `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:13px;font-weight:600;color:#1e293b;">Investissement locatif</span>
          <span style="font-size:13px;font-weight:700;color:#635bff;background:#eef2ff;border-radius:20px;padding:2px 10px;">${p.score_locatif}/100</span>
        </div>
        <div style="background:#f1f5f9;border-radius:4px;height:6px;overflow:hidden;">
          <div style="height:100%;width:${p.score_locatif}%;background:linear-gradient(90deg,#818cf8,#635bff);border-radius:4px;"></div>
        </div>
      </div>
      ` : ""}
    </div>
    ` : ""}

    ${hasLocatif && p.rendement_brut ? `
    <!-- Rendement -->
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.16em;color:#64748b;text-transform:uppercase;">Rendement locatif estimé</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:${p.rendement_brut >= 6 ? "#059669" : p.rendement_brut >= 4.5 ? "#d97706" : "#ef4444"};">${fmtPct(p.rendement_brut)} brut <span style="font-size:13px;font-weight:400;color:#64748b;">— ${fmtPct(p.rendement_brut * 0.65)} net estimé</span></p>
    </div>
    ` : ""}

    ${p.actionPlan ? `
    <!-- Plan d'action -->
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.16em;color:#64748b;text-transform:uppercase;">Plan d'action</p>
      ${renderActionPlanHtml(p.actionPlan)}
    </div>
    ` : ""}

    <!-- CTA -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px;margin-bottom:16px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#e2e8f0;">Vous voulez aller plus loin ?</p>
      <p style="margin:0 0 16px;font-size:12px;color:#94a3b8;">Un expert lokt peut étudier votre dossier gratuitement.</p>
      <a href="https://lokt.fr/acheter-ou-louer" style="display:inline-block;background:linear-gradient(90deg,#635bff,#00a8d4);border-radius:50px;padding:12px 28px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">Relancer ma simulation →</a>
    </div>

    <!-- Footer -->
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;">
      Résultats indicatifs — ne constituent pas un conseil en investissement.<br>
      <a href="https://lokt.fr" style="color:#635bff;">lokt.fr</a> · <a href="https://lokt.fr/confidentialite" style="color:#94a3b8;">Données personnelles</a>
    </p>
  </div>
</body>
</html>`;
}

export function buildAcheterOuLouerEmailText(p: AcheterOuLouerPayload): string {
  const verdictLabel = VERDICT_LABELS[p.verdict];
  const hasMonthly = (p.mensualite_rp ?? 0) > 0;
  const hasLocatif = (p.mensualite_locatif ?? 0) > 0;

  let text = `VOTRE ANALYSE ACHETER OU LOUER — lokt.fr\n`;
  if (p.villeNom) text += `Ville : ${p.villeNom}\n`;
  text += `\n--- RECOMMANDATION ---\n${verdictLabel}\n`;
  if (hasMonthly) {
    text += `\n--- COMPARAISON MENSUELLE (vs louer seul) ---\n`;
    text += `Résidence principale : ${(p.extra_rp ?? 0) >= 0 ? "+" : ""}${fmtEuro(p.extra_rp)}/mois\n`;
    if (hasLocatif && p.loyer_actuel) {
      const delta = (p.cout_net_locatif ?? 0) - p.loyer_actuel;
      text += `Locatif + rester locataire : ${delta >= 0 ? "+" : ""}${fmtEuro(delta)}/mois\n`;
    }
    text += `Rester locataire : référence 0 €\n`;
  }
  if (p.score_rp !== undefined) text += `\n--- SCORES ---\nRésidence principale : ${p.score_rp}/100\n`;
  if (p.score_locatif !== undefined) text += `Investissement locatif : ${p.score_locatif}/100\n`;
  if (p.rendement_brut) text += `\nRendement locatif brut : ${fmtPct(p.rendement_brut)}\n`;
  if (p.actionPlan) {
    text += `\n--- PLAN D'ACTION ---\n`;
    text += renderActionPlanTextLines(p.actionPlan).join("\n");
    text += "\n";
  }
  text += `\nRelancez votre simulation : https://lokt.fr/acheter-ou-louer\n`;
  text += `\nRésultats indicatifs. lokt.fr\n`;
  return text;
}
