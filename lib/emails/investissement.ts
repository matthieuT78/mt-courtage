// lib/emails/investissement.ts

function esc(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %";
}

function safeLines(text: any) {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30);
}

/**
 * computed attendu (depuis ton Wizard):
 * {
 *   inputs: {...},
 *   output: { resume, graphData, analyse, market, opportunity },
 *   meta: {...},
 *   tracking: {...}
 * }
 */
export function buildInvestissementEmail(computed: any): string {
  const baseUrl =
    (process.env.NEXT_PUBLIC_SITE_URL && String(process.env.NEXT_PUBLIC_SITE_URL)) ||
    "https://lokt.fr";

  const logoUrl = `${baseUrl.replace(/\/$/, "")}/minilogo.png`;

  const inputs = computed?.inputs || {};
  const output = computed?.output || {};
  const resume = output?.resume || null;
  const graph = output?.graphData || null;
  const analyse = output?.analyse || "";
  const opportunity = output?.opportunity || null;
  const market = output?.market || null;

  const localite = inputs?.localite ? esc(inputs.localite) : "-";
  const surface = inputs?.surfaceM2 ? esc(inputs.surfaceM2) : "-";
  const listingUrl = inputs?.listingUrl ? String(inputs.listingUrl) : "";

  const coutTotal = graph?.coutTotal;
  const rendementBrut = graph?.rendementBrut;
  const rendementNetAvantCredit = graph?.rendementNetAvantCredit;
  const mensualiteCredit = graph?.mensualiteCredit;

  const cashflowMensuel = resume?.cashflowMensuel;
  const resultatNetAnnuel = resume?.resultatNetAnnuel;

  const score = opportunity?.score;
  const scoreText = Number.isFinite(Number(score)) ? `${Number(score)}/10` : "-";
  const oppComment = opportunity?.comment ? esc(opportunity.comment) : "";

  const improvements: string[] = Array.isArray(opportunity?.improvements)
    ? opportunity.improvements.map((x: any) => String(x)).filter(Boolean).slice(0, 6)
    : [];

  const analyseLines = safeLines(analyse);

  const marketPriceM2Sale = market?.referencePriceM2Sale;
  const marketRentM2 = market?.referenceRentM2;
  const marketSource = market?.source ? esc(market.source) : "";

  const pill =
    Number(cashflowMensuel) >= 0
      ? { bg: "#E8F7EE", fg: "#0B6B2F", label: "Cash-flow positif" }
      : { bg: "#FDECEC", fg: "#9B1C1C", label: "Cash-flow négatif" };

  const cardStyle =
    "background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;";

  const h1Style = "margin:0;font-size:18px;line-height:1.3;color:#0f172a;";
  const smallStyle = "margin:0;color:#475569;font-size:12px;line-height:1.4;";
  const labelStyle = "color:#64748b;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:0;";
  const valueStyle = "color:#0f172a;font-size:14px;margin:4px 0 0 0;font-weight:700;";

  const rowCell = "vertical-align:top;padding:10px 8px;";
  const statBox =
    "border:1px solid #e5e7eb;border-radius:14px;padding:12px;background:#f8fafc;";

  const btnStyle =
    "display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:999px;font-weight:700;font-size:13px;";

  const listingCta = listingUrl
    ? `<a href="${esc(listingUrl)}" style="${btnStyle}" target="_blank" rel="noreferrer">Ouvrir l’annonce</a>`
    : "";

  const improvementsHtml =
    improvements.length > 0
      ? improvements
          .map(
            (t) =>
              `<li style="margin:0 0 8px 0;color:#0f172a;font-size:13px;line-height:1.45;">${esc(
                t
              )}</li>`
          )
          .join("")
      : `<li style="margin:0;color:#0f172a;font-size:13px;line-height:1.45;">Aucune recommandation spécifique détectée.</li>`;

  const analyseHtml =
    analyseLines.length > 0
      ? analyseLines
          .map(
            (l) =>
              `<div style="margin:0 0 10px 0;padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;color:#0f172a;font-size:13px;line-height:1.45;">
                 • ${esc(l)}
               </div>`
          )
          .join("")
      : `<p style="margin:0;color:#0f172a;font-size:13px;line-height:1.45;">Analyse indisponible.</p>`;

  const marketHtml =
    marketPriceM2Sale || marketRentM2
      ? `
      <div style="${statBox}">
        <p style="${labelStyle}">Benchmarks marché</p>
        <p style="${smallStyle};margin-top:8px;">
          Prix médian vente (€/m²) : <strong>${formatEuro(marketPriceM2Sale).replace("€", "€")}</strong><br/>
          Loyer médian (€/m²) : <strong>${formatEuro(marketRentM2).replace("€", "€")}</strong>
          ${marketSource ? `<br/><span style="color:#64748b;font-size:11px;">Source : ${marketSource}</span>` : ""}
        </p>
      </div>`
      : `<div style="${statBox}"><p style="${labelStyle}">Benchmarks marché</p><p style="${smallStyle};margin-top:8px;">Non disponible (localité/surface manquantes).</p></div>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width"/>
    <title>Votre simulation d’investissement — lokt.fr</title>
  </head>
  <body style="margin:0;background:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
    <div style="max-width:720px;margin:0 auto;padding:18px;">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin:10px 0 14px 0;">
        <img src="${logoUrl}" alt="Lokt" width="34" height="34" style="display:block;border-radius:8px;" />
        <div>
          <p style="margin:0;color:#0f172a;font-weight:800;font-size:14px;">Lokt.fr</p>
          <p style="margin:0;color:#64748b;font-size:12px;">Votre simulation d’investissement locatif</p>
        </div>
      </div>

      <!-- Main card -->
      <div style="${cardStyle}">
        <h1 style="${h1Style}">Votre analyse est prête ✅</h1>
        <p style="margin:8px 0 0 0;color:#334155;font-size:13px;line-height:1.55;">
          Voici un récapitulatif lisible de votre simulation. Gardez cet email pour relire vos chiffres plus tard.
        </p>

        <div style="margin-top:12px;">
          <span style="display:inline-block;background:${pill.bg};color:${pill.fg};padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;">
            ${pill.label}
          </span>
        </div>

        <!-- Key stats -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:separate;border-spacing:0;">
          <tr>
            <td style="${rowCell}">
              <div style="${statBox}">
                <p style="${labelStyle}">Coût total</p>
                <p style="${valueStyle}">${formatEuro(coutTotal)}</p>
              </div>
            </td>
            <td style="${rowCell}">
              <div style="${statBox}">
                <p style="${labelStyle}">Rendement brut</p>
                <p style="${valueStyle}">${formatPct(rendementBrut)}</p>
              </div>
            </td>
            <td style="${rowCell}">
              <div style="${statBox}">
                <p style="${labelStyle}">Rendement net (avant crédit)</p>
                <p style="${valueStyle}">${formatPct(rendementNetAvantCredit)}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="${rowCell}">
              <div style="${statBox}">
                <p style="${labelStyle}">Cash-flow mensuel</p>
                <p style="${valueStyle}">${formatEuro(cashflowMensuel)}</p>
              </div>
            </td>
            <td style="${rowCell}">
              <div style="${statBox}">
                <p style="${labelStyle}">Résultat net annuel</p>
                <p style="${valueStyle}">${formatEuro(resultatNetAnnuel)}</p>
              </div>
            </td>
            <td style="${rowCell}">
              <div style="${statBox}">
                <p style="${labelStyle}">Mensualité crédit + assurance</p>
                <p style="${valueStyle}">${formatEuro(mensualiteCredit)}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Project info -->
        <div style="margin-top:10px;${statBox}">
          <p style="${labelStyle}">Paramètres clés</p>
          <p style="${smallStyle};margin-top:8px;">
            Localité : <strong style="color:#0f172a;">${localite}</strong><br/>
            Surface : <strong style="color:#0f172a;">${surface}</strong> m²
          </p>
          ${listingCta ? `<div style="margin-top:10px;">${listingCta}</div>` : ""}
        </div>

        <!-- Market -->
        <div style="margin-top:10px;">
          ${marketHtml}
        </div>

        <!-- Opportunity -->
        <div style="margin-top:14px;${statBox}">
          <p style="${labelStyle}">Score d’opportunité</p>
          <p style="margin:6px 0 0 0;color:#0f172a;font-weight:800;font-size:16px;">${esc(scoreText)}</p>
          ${oppComment ? `<p style="margin:8px 0 0 0;color:#334155;font-size:13px;line-height:1.55;">${oppComment}</p>` : ""}
        </div>

        <!-- Improvements -->
        <div style="margin-top:10px;${statBox}">
          <p style="${labelStyle}">Recommandations</p>
          <ul style="margin:10px 0 0 18px;padding:0;">
            ${improvementsHtml}
          </ul>
        </div>

        <!-- Analysis -->
        <div style="margin-top:14px;">
          <p style="${labelStyle}">Analyse</p>
          <div style="margin-top:10px;">
            ${analyseHtml}
          </div>
        </div>

        <!-- Footer -->
        <p style="margin:14px 0 0 0;color:#64748b;font-size:11px;line-height:1.5;">
          Simulation indicative (hors fiscalité). Les résultats peuvent varier selon les hypothèses, le marché et le financement.
        </p>
      </div>

      <p style="margin:12px 0 0 0;color:#94a3b8;font-size:11px;line-height:1.4;text-align:center;">
        Lokt.fr — analyses immobilières simples et rapides •
        <a href="${baseUrl}" style="color:#64748b;text-decoration:underline;">${baseUrl.replace(/^https?:\/\//, "")}</a>
      </p>
    </div>
  </body>
</html>`;
}
