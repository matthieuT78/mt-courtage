// lib/emails/plus-value-vente-immobiliere.ts
type PVResult = {
  grossGain: number;
  totalTax: number;
  netCashSeller: number;

  netSalePriceForPV?: number;

  taxableIR?: number;
  taxablePS?: number;
  taxIR?: number;
  taxPS?: number;
  surtax?: number;

  yearsHeld?: number;
  abIR?: number;
  abPS?: number;
  isExempt?: boolean;

  crd?: number;
  ira?: number;
  loanPayoff?: number;

  totalPurchaseCost?: number;
  saleCosts?: number;
  breakevenSalePrice?: number;

  salePrice?: number;
};

type PlusValueComputed = {
  input?: any;
  output?: {
    result?: PVResult | null;
    displayResult?: PVResult | null;
  } | null;
};

function formatEuro(val: number) {
  if (!Number.isFinite(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (!Number.isFinite(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pickPVResult(computed: any): PVResult | null {
  const c = (computed || {}) as PlusValueComputed;
  return (c?.output?.displayResult || c?.output?.result || null) as PVResult | null;
}

export function buildPlusValueEmailText(computed: any) {
  const out = pickPVResult(computed);

  const parts: string[] = [];
  parts.push("VOTRE SIMULATION DE PLUS-VALUE IMMOBILIÈRE — lokt.fr");
  parts.push("");

  if (!out) {
    parts.push("Récapitulatif :");
    parts.push("- Données manquantes : impossible de générer le récapitulatif.");
    parts.push("");
    parts.push("Relire / refaire la simulation : https://lokt.fr/plus-value-vente-immobiliere");
    parts.push("");
    parts.push("Calculs indicatifs. Ne constitue pas un conseil fiscal.");
    parts.push("— lokt.fr");
    return parts.join("\n");
  }

  parts.push("Récapitulatif :");
  parts.push(`- Plus-value brute : ${formatEuro(out.grossGain)}`);
  parts.push(`- Impôts estimés : ${formatEuro(out.totalTax)}`);
  parts.push(`- Cash net vendeur : ${formatEuro(out.netCashSeller)}`);
  parts.push("");

  // “Plan d’action” façon capacité : texte structuré en blocs
  const actionPlanBlocks: string[] = [];

  actionPlanBlocks.push(
    [
      "### 1) Ce que vous récupérez réellement",
      `Prix net vendeur retenu : ${formatEuro(Number(out.netSalePriceForPV ?? NaN))}.`,
      `Impôts estimés : ${formatEuro(out.totalTax)}.`,
      `Prêt à solder (CRD + IRA) : ${formatEuro(Number(out.loanPayoff ?? NaN))}.`,
      `➡️ Cash net vendeur : ${formatEuro(out.netCashSeller)}.`,
    ].join("\n")
  );

  if (out.isExempt) {
    actionPlanBlocks.push(
      [
        "### 2) Fiscalité",
        "Résidence principale : le simulateur considère la plus-value exonérée (0 €).",
        "Si vous avez un doute sur l’exonération, refaites un calcul en “résidence secondaire” pour une estimation prudente.",
      ].join("\n")
    );
  } else {
    actionPlanBlocks.push(
      [
        "### 2) Fiscalité (estimation France)",
        `Durée de détention : ${Number(out.yearsHeld ?? 0)} an(s).`,
        `Abattements : IR ${formatPct(Number(out.abIR ?? NaN))} / PS ${formatPct(Number(out.abPS ?? NaN))}.`,
        `IR (19%) ≈ ${formatEuro(Number(out.taxIR ?? NaN))}.`,
        `PS (17,2%) ≈ ${formatEuro(Number(out.taxPS ?? NaN))}.`,
        `Surtaxe (si applicable) ≈ ${formatEuro(Number(out.surtax ?? NaN))}.`,
        `Total impôts ≈ ${formatEuro(out.totalTax)}.`,
      ].join("\n")
    );
  }

  actionPlanBlocks.push(
    [
      "### 3) Crédit à solder",
      `CRD : ${formatEuro(Number(out.crd ?? NaN))}.`,
      `IRA : ${formatEuro(Number(out.ira ?? NaN))}.`,
      `Total à solder : ${formatEuro(Number(out.loanPayoff ?? NaN))}.`,
      "Astuce : demandez l’attestation de remboursement anticipé à date (le CRD exact peut bouger).",
    ].join("\n")
  );

  actionPlanBlocks.push(
    [
      "### 4) Point de repère",
      `Prix de vente “à l’équilibre” (coût + frais + prêt) ≈ ${formatEuro(Number(out.breakevenSalePrice ?? NaN))}.`,
      "C’est un repère pour savoir à partir de quel prix votre cash net vendeur devient proche de 0 € (dans ce modèle).",
    ].join("\n")
  );

  parts.push("Plan d’action :");
  for (const block of actionPlanBlocks) {
    parts.push(block.replace(/^###\s*/gm, "").replace(/\n/g, " "));
    parts.push("");
  }

  parts.push("Relire / refaire la simulation : https://lokt.fr/plus-value-vente-immobiliere");
  parts.push("");
  parts.push("Calculs indicatifs. Ne constitue pas un conseil fiscal.");
  parts.push("— lokt.fr");

  return parts.join("\n");
}

export function buildPlusValueEmailHtml(computed: any) {
  const out = pickPVResult(computed);

  const siteUrl = "https://lokt.fr";
  const logoUrl = `${siteUrl}/LOKT_LOGO.jpg`;
  const ctaUrl = `${siteUrl}/plus-value-vente-immobiliere`;

  const fmtSmall = (label: string, value: string) => `
    <td style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(label)}</div>
      <div style="margin-top:4px;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(value)}</div>
    </td>
  `;

  // Plan d’action : exactement même logique que capacité (blocs markdown -> h3/p)
  const buildActionPlan = (r: PVResult | null) => {
    if (!r) return "";

    const blocks: string[] = [];

    blocks.push(
      [
        "### 1) Résumé (ce que vous récupérez)",
        `Cash net vendeur : ${formatEuro(r.netCashSeller)}.`,
        `Prix net vendeur (après frais vendeur) : ${formatEuro(Number(r.netSalePriceForPV ?? NaN))}.`,
        `Prêt à solder (CRD + IRA) : ${formatEuro(Number(r.loanPayoff ?? NaN))}.`,
        `Impôts estimés sur plus-value : ${formatEuro(r.totalTax)}.`,
      ].join("\n")
    );

    blocks.push(
      [
        "### 2) Plus-value (base de calcul)",
        `Plus-value brute : ${formatEuro(r.grossGain)}.`,
        `Coût total d’acquisition : ${formatEuro(Number(r.totalPurchaseCost ?? NaN))} (achat + frais + travaux).`,
        `Prix net vendeur retenu : ${formatEuro(Number(r.netSalePriceForPV ?? NaN))}.`,
        r.isExempt
          ? "Résidence principale : présumé exonéré dans ce simulateur."
          : `Durée de détention : ${Number(r.yearsHeld ?? 0)} an(s) → abattements : IR ${formatPct(
              Number(r.abIR ?? NaN)
            )} / PS ${formatPct(Number(r.abPS ?? NaN))}.`,
      ].join("\n")
    );

    blocks.push(
      [
        "### 3) Fiscalité (estimation France)",
        r.isExempt
          ? "Impôt = 0 € (exonération présumée)."
          : [
              `Base taxable IR : ${formatEuro(Number(r.taxableIR ?? NaN))} → IR (19%) ≈ ${formatEuro(
                Number(r.taxIR ?? NaN)
              )}.`,
              `Base taxable PS : ${formatEuro(Number(r.taxablePS ?? NaN))} → PS (17,2%) ≈ ${formatEuro(
                Number(r.taxPS ?? NaN)
              )}.`,
              `Surtaxe (modèle simplifié) ≈ ${formatEuro(Number(r.surtax ?? NaN))}.`,
              `Total impôts ≈ ${formatEuro(r.totalTax)}.`,
            ].join("\n"),
      ].join("\n")
    );

    blocks.push(
      [
        "### 4) Crédit / remboursement anticipé",
        `CRD : ${formatEuro(Number(r.crd ?? NaN))}.`,
        `IRA : ${formatEuro(Number(r.ira ?? NaN))}.`,
        `Total à solder : ${formatEuro(Number(r.loanPayoff ?? NaN))}.`,
        "À vérifier : attestation banque (le CRD exact peut changer la conclusion).",
      ].join("\n")
    );

    blocks.push(
      [
        "### 5) Point de repère",
        `Prix de vente “à l’équilibre” (coût + frais + prêt) ≈ ${formatEuro(Number(r.breakevenSalePrice ?? NaN))}.`,
        "Repère : c’est le prix auquel le cash net vendeur serait proche de 0 € (dans ce modèle).",
      ].join("\n")
    );

    const actionBlocks = blocks
      .map((block) => {
        if (block.startsWith("###")) {
          return `<h3 style="margin:14px 0 6px;font-size:14px;color:#0f172a;">${escapeHtml(
            block.replace(/^###\s*/, "")
          )}</h3>`;
        }
        const safe = escapeHtml(block).replace(/\n/g, "<br/>");
        return `<p style="margin:0 0 10px;color:#0f172a;line-height:1.55;font-size:13px;">${safe}</p>`;
      })
      .join("");

    return actionBlocks;
  };

  const actionBlocks = buildActionPlan(out);

  // Score : plus-value n’a pas de score, donc on ne met PAS le bloc dark.
  // On garde la même structure : header + table + CTA + plan d’action + footer.

  const recapCells = out
    ? `
      <tr>
        ${fmtSmall("Plus-value brute", formatEuro(out.grossGain))}
        ${fmtSmall("Impôts estimés", formatEuro(out.totalTax))}
      </tr>
      <tr>
        ${fmtSmall("Cash net vendeur", formatEuro(out.netCashSeller))}
        ${fmtSmall("Prix net vendeur", formatEuro(Number(out.netSalePriceForPV ?? NaN)))}
      </tr>
    `
    : `
      <tr>
        ${fmtSmall("Simulation", "Données manquantes")}
        ${fmtSmall("Action", "Relancer le calcul")}
      </tr>
    `;

  return `
<div style="background:#f1f5f9;padding:18px 0;">
  <div style="max-width:640px;margin:0 auto;padding:0 14px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:18px 18px 10px 18px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
        <img src="${logoUrl}" alt="lokt.fr" width="130" style="display:block;max-width:130px;height:auto;margin:0 auto 8px;" />
        <h1 style="margin:0;text-align:center;font-size:18px;color:#0f172a;">Votre simulation de plus-value immobilière</h1>
        <p style="margin:6px 0 0;text-align:center;color:#64748b;font-size:13px;line-height:1.5;">
          Récapitulatif de votre simulation (calculs indicatifs).
        </p>
      </div>

      <div style="padding:16px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:10px;">
          ${recapCells}
        </table>

        <div style="margin-top:14px;text-align:center;">
          <a href="${ctaUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700;font-size:13px;">
            Relire / refaire la simulation
          </a>
        </div>

        ${
          actionBlocks
            ? `
          <div style="margin-top:18px;padding-top:4px;">
            <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Détails du calcul</h2>
            ${actionBlocks}
          </div>
        `
            : ``
        }

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
        <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
          Calculs indicatifs. Ne constitue pas un conseil fiscal.
        </p>
        <p style="margin:6px 0 0;color:#64748b;font-size:12px;">— lokt.fr</p>
      </div>
    </div>
  </div>
</div>
`.trim();
}
