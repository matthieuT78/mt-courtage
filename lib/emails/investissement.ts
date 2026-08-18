// lib/emails/investissement.ts
// Email investissement — même template que capaciteEmail.ts (même wrapper / mêmes styles)
// Objectif :
// 1) Design identique à capacité (mêmes blocs) + GROS LOGO en header
// 2) Mapping robuste car `computed` varie selon versions du wizard
// 3) Signature attendue par /pages/api/tools/investissement/send.ts :
//    buildInvestissementEmailHtml(computed) et buildInvestissementEmailText(computed)
import { renderActionPlanHtml, renderActionPlanTextLines } from "./actionPlanFormat";

type AnyObj = Record<string, any>;

/* ======================== Format helpers ======================== */
function formatEuro(val: any) {
  const n = Number(val);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: any) {
  const n = Number(val);
  if (!Number.isFinite(n)) return "-";
  return (
    n.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

function escapeHtml(s: any) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ======================== Safe getters ======================== */
function getPath(obj: any, path: string) {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function firstDefined(obj: any, paths: string[]) {
  for (const p of paths) {
    const v = getPath(obj, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function asNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function asString(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : undefined;
}

function toBullets(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  const s = String(v || "").trim();
  if (!s) return [];
  const lines = s
    .split(/\n+/)
    .map((x) => x.replace(/^[•\-\*\s]+/, "").trim())
    .filter(Boolean);
  return lines.length ? lines : [s];
}

/* ======================== Normalisation computed ======================== */
/**
 * Le wizard V2 envoie souvent:
 * computed = { inputs: {...}, output: { resume, graphData, analyse, opportunity, market }, meta, tracking }
 *
 * Mais on garde des fallbacks si ça évolue.
 */
function normalizeComputed(computed: AnyObj) {
  const c = (computed || {}) as AnyObj;

  const inputs =
    (c.inputs ||
      c.input ||
      c.params ||
      c.payload?.inputs ||
      c.data?.inputs ||
      c.output?.inputs ||
      {}) as AnyObj;

  const output =
    (c.output ||
      c.result ||
      c.kpis ||
      c.payload?.output ||
      c.data?.output ||
      {}) as AnyObj;

  const resume =
    (output.resume ||
      c.resume ||
      output.displayResult?.resume ||
      output.result?.resume ||
      output.displayResult ||
      output.result ||
      {}) as AnyObj;

  const graphData = (output.graphData || output.graph || output.kpis || c.graphData || {}) as AnyObj;

  const opportunity =
    (output.opportunity || c.opportunity || output.assessment || c.assessment || null) as AnyObj | null;

  const market = (output.market || c.market || null) as AnyObj | null;

  const analyse =
    (output.analyse ||
      output.analysis ||
      c.analyse ||
      c.analysis ||
      output.analysisText ||
      c.analysisText ||
      "") as string;

  return { c, inputs, output, resume, graphData, opportunity, market, analyse };
}

function detectStatusFromCashflow(cf: number | undefined) {
  if (cf === undefined) return "Votre analyse est prête ✅";
  if (cf > 0) return "Cash-flow positif ✅";
  if (cf === 0) return "Cash-flow neutre ✅";
  return "Cash-flow négatif";
}

/* ======================== Extraction KPI (robuste) ======================== */
function extractKpis(computed: AnyObj) {
  const { c, inputs, output, resume, graphData, opportunity, market, analyse } =
    normalizeComputed(computed);

  // Wizard V2 (vu dans ton code):
  // resume: { cashflowMensuel, resultatNetAnnuel, rendementNetAvantCredit }
  // graphData: { coutTotal, mensualiteCredit, loyersAnnuels, chargesTotales, rendementBrut, ... }

  const cashflowMensuel =
    asNumber(
      firstDefined(c, [
        "cashflowMensuel",
        "cashflow_mensuel",
        "resume.cashflowMensuel",
        "output.resume.cashflowMensuel",
        "output.resume.cashflow_mensuel",
        "output.graphData.cashflowMensuel",
        "output.displayResult.cashflowMensuel",
      ])
    ) ??
    asNumber(firstDefined(output, ["resume.cashflowMensuel"])) ??
    asNumber(firstDefined(resume, ["cashflowMensuel", "cashflow_mensuel"]));

  const resultatNetAnnuel =
    asNumber(
      firstDefined(c, [
        "resultatNetAnnuel",
        "resultat_net_annuel",
        "resume.resultatNetAnnuel",
        "output.resume.resultatNetAnnuel",
        "output.displayResult.resultatNetAnnuel",
      ])
    ) ?? asNumber(firstDefined(resume, ["resultatNetAnnuel", "resultat_net_annuel"]));

  const coutTotal =
    asNumber(
      firstDefined(c, [
        "coutTotal",
        "cout_total",
        "totalCost",
        "output.graphData.coutTotal",
        "output.graphData.totalCost",
        "graphData.coutTotal",
        "graphData.totalCost",
        "resume.coutTotal",
        "output.resume.coutTotal",
      ])
    ) ??
    asNumber(firstDefined(graphData, ["coutTotal", "totalCost", "cout_total", "total_cost"])) ??
    asNumber(firstDefined(resume, ["coutTotal", "totalCost"]));

  // Mensualité crédit + assurance (wizard V2: graphData.mensualiteCredit)
  const mensualiteCreditAssurance =
    asNumber(
      firstDefined(c, [
        "mensualiteCredit",
        "mensualite_credit",
        "mensualiteCreditAssurance",
        "mensualite_credit_assurance",
        "output.graphData.mensualiteCredit",
        "graphData.mensualiteCredit",
        "output.resume.mensualiteCredit",
      ])
    ) ??
    asNumber(firstDefined(graphData, ["mensualiteCredit", "mensualiteCreditAssurance"])) ??
    asNumber(firstDefined(resume, ["mensualiteCredit", "mensualiteCreditAssurance"]));

  const loyersAnnuelsBruts =
    asNumber(
      firstDefined(c, [
        "loyersAnnuels",
        "loyers_annuels",
        "loyersAnnuelsBruts",
        "loyers_annuels_bruts",
        "output.graphData.loyersAnnuels",
        "graphData.loyersAnnuels",
      ])
    ) ?? asNumber(firstDefined(graphData, ["loyersAnnuels", "loyersAnnuelsBruts"]));

  const chargesTotales =
    asNumber(
      firstDefined(c, [
        "chargesTotales",
        "charges_totales",
        "output.graphData.chargesTotales",
        "graphData.chargesTotales",
      ])
    ) ?? asNumber(firstDefined(graphData, ["chargesTotales", "charges_totales"]));

  const rendementBrut =
    asNumber(
      firstDefined(c, [
        "rendementBrut",
        "rendement_brut",
        "output.graphData.rendementBrut",
        "graphData.rendementBrut",
      ])
    ) ?? asNumber(firstDefined(graphData, ["rendementBrut", "rendement_brut"]));

  const rendementNetAvantCredit =
    asNumber(
      firstDefined(c, [
        "rendementNetAvantCredit",
        "rendement_net_avant_credit",
        "resume.rendementNetAvantCredit",
        "output.resume.rendementNetAvantCredit",
        "output.graphData.rendementNetAvantCredit",
        "graphData.rendementNetAvantCredit",
      ])
    ) ??
    asNumber(firstDefined(resume, ["rendementNetAvantCredit", "rendement_net_avant_credit"])) ??
    asNumber(firstDefined(graphData, ["rendementNetAvantCredit", "rendement_net_avant_credit"]));

  // Fallback : rendement brut si manquant
  const computedGrossYield =
    rendementBrut !== undefined
      ? rendementBrut
      : coutTotal && coutTotal > 0 && loyersAnnuelsBruts !== undefined
      ? (loyersAnnuelsBruts / coutTotal) * 100
      : undefined;

  // Localité / surface (wizard V2: inputs.localite, inputs.surfaceM2)
  const localite =
    asString(
      firstDefined(c, [
        "localite",
        "inputs.localite",
        "input.localite",
        "params.localite",
        "output.inputs.localite",
        "output.input.localite",
      ])
    ) ??
    asString(firstDefined(inputs, ["localite"])) ??
    "-";

  const surfaceM2 =
    asNumber(
      firstDefined(c, [
        "surfaceM2",
        "surface_m2",
        "inputs.surfaceM2",
        "inputs.surface",
        "input.surfaceM2",
        "params.surfaceM2",
      ])
    ) ?? asNumber(firstDefined(inputs, ["surfaceM2", "surface", "surface_m2"]));

  // Opportunity (wizard V2: output.opportunity.score/comment/improvements)
  const scoreOpp =
    asNumber(
      firstDefined(c, [
        "opportunityScore",
        "scoreOpportunite",
        "score_opportunite",
        "output.opportunity.score",
        "opportunity.score",
      ])
    ) ??
    asNumber(firstDefined(opportunity, ["score", "scoreOpportunite", "opportunityScore", "score_opportunite"]));

  const scoreLabel =
    asString(
      firstDefined(c, [
        "opportunityLabel",
        "scoreLabel",
        "output.opportunity.label",
        "opportunity.label",
      ])
    ) ?? asString(firstDefined(opportunity, ["label", "scoreLabel", "opportunityLabel"]));

  const scoreComment =
    asString(
      firstDefined(c, [
        "opportunityComment",
        "scoreComment",
        "comment",
        "output.opportunity.comment",
        "opportunity.comment",
        "output.opportunity.commentaire",
      ])
    ) ?? asString(firstDefined(opportunity, ["comment", "commentaire", "scoreComment", "opportunityComment"]));

  const improvements = toBullets(
    firstDefined(c, [
      "opportunityImprovements",
      "improvements",
      "recommendations",
      "recommandations",
      "output.opportunity.improvements",
      "opportunity.improvements",
      "output.opportunity.recommendations",
    ]) ?? firstDefined(opportunity, ["improvements", "recommendations"])
  );

  // Analyse narrative (wizard V2: output.analyse string)
  const analysisText =
    asString(
      firstDefined(c, [
        "analyse",
        "analysis",
        "output.analyse",
        "output.analysis",
        "output.analyseText",
        "output.analysisText",
      ])
    ) ?? asString(analyse);

  // Marché (facultatif)
  const marketPriceM2 = asNumber(firstDefined(market, ["referencePriceM2Sale", "priceM2", "salePriceM2"]));
  const marketRentM2 = asNumber(firstDefined(market, ["referenceRentM2", "rentM2"]));
  const marketSource = asString(firstDefined(market, ["source"]));

  // Plan d'action typé (badges warning/positive/tip) — voir actionItemsToString
  // dans InvestissementWizard.tsx, distinct des "improvements" (simple liste
  // à puces déjà gérée ci-dessus).
  const actionPlan = asString(
    firstDefined(c, ["actionPlan", "output.actionPlan", "output.opportunity.actionPlan"])
  );

  return {
    cashflowMensuel,
    resultatNetAnnuel,
    coutTotal,
    mensualiteCreditAssurance,
    loyersAnnuelsBruts,
    chargesTotales,
    rendementBrut: computedGrossYield,
    rendementNetAvantCredit,
    localite,
    surfaceM2,
    scoreOpp,
    scoreLabel,
    scoreComment,
    improvements,
    analysisText,
    marketPriceM2,
    marketRentM2,
    marketSource,
    actionPlan,
  };
}

/* ======================== TEXT ======================== */
export function buildInvestissementEmailText(computed: any) {
  const k = extractKpis(computed || {});
  const parts: string[] = [];

  parts.push("VOTRE RAPPORT D’INVESTISSEMENT LOCATIF — lokt.fr");
  parts.push("");
  parts.push("Bonjour,");
  parts.push("Voici votre rapport personnalisé : rentabilité, cash-flow, score d’opportunité et recommandations.");
  parts.push("");
  parts.push(detectStatusFromCashflow(k.cashflowMensuel));
  parts.push("");

  parts.push("Récapitulatif :");
  parts.push(`- Coût total : ${formatEuro(k.coutTotal)}`);
  parts.push(`- Rendement brut : ${k.rendementBrut !== undefined ? formatPct(k.rendementBrut) : "-"}`);
  parts.push(
    `- Rendement net (avant crédit) : ${
      k.rendementNetAvantCredit !== undefined ? formatPct(k.rendementNetAvantCredit) : "-"
    }`
  );
  parts.push(`- Cash-flow mensuel : ${formatEuro(k.cashflowMensuel)}`);
  parts.push(`- Résultat net annuel : ${formatEuro(k.resultatNetAnnuel)}`);
  parts.push(`- Mensualité crédit + assurance : ${formatEuro(k.mensualiteCreditAssurance)}`);
  parts.push("");

  parts.push("Paramètres clés :");
  parts.push(`- Localité : ${k.localite || "-"}`);
  parts.push(`- Surface : ${k.surfaceM2 !== undefined ? `${k.surfaceM2} m²` : "-"}`);
  parts.push("");

  if (k.scoreOpp !== undefined) {
    parts.push(`Score d’opportunité : ${k.scoreOpp}/10`);
    if (k.scoreLabel) parts.push(k.scoreLabel);
    if (k.scoreComment) parts.push(k.scoreComment);
    parts.push("");
  }

  if (k.improvements.length) {
    parts.push("Recommandations :");
    for (const r of k.improvements.slice(0, 10)) parts.push(`- ${r}`);
    parts.push("");
  }

  if (k.analysisText) {
    parts.push("Analyse :");
    const lines = k.analysisText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 30);
    for (const l of lines) parts.push(`- ${l.replace(/^[-•\s]+/, "")}`);
    parts.push("");
  }

  if (k.actionPlan) {
    parts.push("Plan d’action :");
    parts.push(...renderActionPlanTextLines(k.actionPlan));
  }

  parts.push("Relire / refaire la simulation : https://lokt.fr/investissement");
  parts.push("");
  parts.push("Calculs indicatifs. Ne constitue pas une offre de prêt.");
  parts.push("Vos données servent uniquement à vous transmettre ce rapport, retrouver votre simulation et améliorer lokt.fr. Aucune revente de données.");
  parts.push("— lokt.fr");

  return parts.join("\n");
}

/* ======================== HTML (template identique capacité) ======================== */
export function buildInvestissementEmailHtml(computed: any) {
  const k = extractKpis(computed || {});

  const siteUrl = "https://lokt.fr";
  const logoUrl = `${siteUrl}/lokt-logo-small.jpg`;
  const ctaUrl = `${siteUrl}/investissement`;

  // EXACTEMENT le même "bloc KPI" que capacité
  const fmtSmall = (label: string, value: string) => `
    <td style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(
        label
      )}</div>
      <div style="margin-top:4px;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(
        value
      )}</div>
    </td>
  `;

  const status = detectStatusFromCashflow(k.cashflowMensuel);

  const recoBlocks = k.improvements.length
    ? k.improvements
        .slice(0, 10)
        .map(
          (r) =>
            `<p style="margin:0 0 10px;color:#0f172a;line-height:1.55;font-size:13px;">• ${escapeHtml(
              r
            )}</p>`
        )
        .join("")
    : "";

  const actionPlanBlocks = k.actionPlan ? renderActionPlanHtml(k.actionPlan) : "";

  const analysisBlocks = k.analysisText
    ? k.analysisText
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 30)
        .map(
          (line) =>
            `<p style="margin:0 0 10px;color:#0f172a;line-height:1.55;font-size:13px;">• ${escapeHtml(
              line
            )}</p>`
        )
        .join("")
    : "";

  const marketLine =
    k.marketPriceM2 !== undefined || k.marketRentM2 !== undefined
      ? `<p style="margin:10px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
          ${
            k.marketPriceM2 !== undefined
              ? `Référence prix/m² : <strong style="color:#0f172a;">${escapeHtml(
                  formatEuro(k.marketPriceM2)
                )}</strong>`
              : ""
          }
          ${
            k.marketRentM2 !== undefined
              ? `${k.marketPriceM2 !== undefined ? " — " : ""}Référence loyer/m² : <strong style="color:#0f172a;">${escapeHtml(
                  formatEuro(k.marketRentM2)
                )}</strong>`
              : ""
          }
          ${k.marketSource ? ` — Source : ${escapeHtml(k.marketSource)}` : ""}
        </p>`
      : "";

  // ✅ GROS LOGO : c’est ici que tu standardises partout.
  // (Même wrapper que capacité, juste le logo plus grand + un peu plus d’air)
  return `
<div style="background:#f1f5f9;padding:18px 0;">
  <div style="max-width:640px;margin:0 auto;padding:0 14px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:22px 18px 12px 18px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
        <img src="${logoUrl}" alt="lokt.fr" width="190" style="display:block;max-width:190px;height:auto;margin:0 auto 10px;" />
        <h1 style="margin:0;text-align:center;font-size:18px;color:#0f172a;">Votre rapport d’investissement locatif</h1>
        <p style="margin:6px 0 0;text-align:center;color:#64748b;font-size:13px;line-height:1.5;">
          Rentabilité, cash-flow, score d’opportunité et recommandations.
        </p>
      </div>

      <div style="padding:16px 18px;">
        <p style="margin:0 0 14px;color:#334155;font-size:13px;line-height:1.55;">
          Bonjour,<br/>
          voici une synthèse de votre projet locatif. Le rapport met en avant les chiffres clés et les leviers à travailler pour améliorer la rentabilité.
        </p>

        <p style="margin:0 0 12px;text-align:center;color:#0f172a;font-size:13px;font-weight:700;">
          ${escapeHtml(status)}
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:10px;">
          <tr>
            ${fmtSmall("Coût total", formatEuro(k.coutTotal))}
            ${fmtSmall("Rendement brut", k.rendementBrut !== undefined ? formatPct(k.rendementBrut) : "-")}
          </tr>
          <tr>
            ${fmtSmall(
              "Rendement net (avant crédit)",
              k.rendementNetAvantCredit !== undefined ? formatPct(k.rendementNetAvantCredit) : "-"
            )}
            ${fmtSmall("Cash-flow mensuel", formatEuro(k.cashflowMensuel))}
          </tr>
          <tr>
            ${fmtSmall("Résultat net annuel", formatEuro(k.resultatNetAnnuel))}
            ${fmtSmall("Mensualité crédit + assurance", formatEuro(k.mensualiteCreditAssurance))}
          </tr>
          <tr>
            ${fmtSmall("Localité", k.localite || "-")}
            ${fmtSmall("Surface", k.surfaceM2 !== undefined ? `${k.surfaceM2} m²` : "-")}
          </tr>
        </table>

        ${marketLine}

        ${
          k.scoreOpp !== undefined
            ? `
          <div style="margin-top:10px;padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#0f172a;color:#ffffff;">
            <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#a5f3fc;">Score lokt.fr™</div>
            <div style="margin-top:6px;font-size:22px;font-weight:800;color:#ffffff;">${escapeHtml(
              k.scoreOpp
            )}/10 ${
                k.scoreLabel
                  ? `<span style="font-size:14px;font-weight:700;color:#e2e8f0;">— ${escapeHtml(
                      k.scoreLabel
                    )}</span>`
                  : ""
              }</div>
            ${
              k.scoreComment
                ? `<p style="margin:8px 0 0;color:#e2e8f0;font-size:13px;line-height:1.55;">${escapeHtml(
                    k.scoreComment
                  )}</p>`
                : ""
            }
          </div>
        `
            : ``
        }

        <div style="margin-top:14px;text-align:center;">
          <a href="${ctaUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700;font-size:13px;">
            Relire / refaire la simulation
          </a>
        </div>

        ${
          actionPlanBlocks
            ? `
          <div style="margin-top:18px;padding-top:4px;">
            <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Plan d’action</h2>
            ${actionPlanBlocks}
          </div>
        `
            : ``
        }

        ${
          recoBlocks
            ? `
          <div style="margin-top:18px;padding-top:4px;">
            <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Recommandations</h2>
            ${recoBlocks}
          </div>
        `
            : ``
        }

        ${
          analysisBlocks
            ? `
          <div style="margin-top:14px;">
            <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Analyse</h2>
            ${analysisBlocks}
          </div>
        `
            : ``
        }

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
        <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
          Calculs indicatifs. Ne constitue pas une offre de prêt.
        </p>
        <p style="margin:6px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
          Vos données servent à vous transmettre ce rapport, retrouver votre simulation et améliorer lokt.fr. Aucune revente de données.
        </p>
        <p style="margin:6px 0 0;color:#64748b;font-size:12px;">— lokt.fr</p>
      </div>
    </div>
  </div>
</div>
`.trim();
}

/* (Optionnel) Builder standard si tu veux l'utiliser ailleurs */
export function buildInvestissementEmail(params: { email: string; computed: any }) {
  const subject = "Votre rapport d’investissement locatif — lokt.fr";
  const html = buildInvestissementEmailHtml(params.computed);
  const text = buildInvestissementEmailText(params.computed);
  return { subject, html, text };
}
