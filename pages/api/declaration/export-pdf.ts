// pages/api/declaration/export-pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import { requireApiUser } from "../../../lib/apiAuth";

function escapeHtml(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function requireServerModule(moduleName: string): any {
  return (eval("require") as NodeRequire)(moduleName);
}

// Même stratégie de rendu que pages/api/receipts/generate.ts et pages/api/inventory/pdf.ts :
// puppeteer complet en local (Mac/Windows), puppeteer-core + @sparticuz/chromium en serverless Linux.
async function renderPdfFromHtml(html: string) {
  const forceFull = process.env.FORCE_PUPPETEER_FULL === "1";
  const isLinux = process.platform === "linux";

  if (!isLinux || forceFull) {
    const puppeteerFullRaw: any = requireServerModule("puppeteer");
    const puppeteerFull = puppeteerFullRaw.default || puppeteerFullRaw;
    const browser = await puppeteerFull.launch({ headless: "new" });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "14mm", right: "14mm", bottom: "18mm", left: "14mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  const executablePath = await chromium.executablePath();
  const browser = await puppeteerCore.launch({
    args: puppeteerCore.defaultArgs({ args: chromium.args, headless: "shell" }),
    defaultViewport: { deviceScaleFactor: 1, hasTouch: false, height: 1080, isLandscape: false, isMobile: false, width: 794 },
    executablePath,
    headless: "shell",
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "14mm", right: "14mm", bottom: "18mm", left: "14mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function buildHtml(params: {
  year: number;
  categoryLabel: string;
  regimeLabel: string;
  rows: Array<[string, string]>;
  guide: {
    montantLabel: string;
    montant: number;
    montantNote: string;
    formulaire: string;
    caseHint: string;
    isDeficit: boolean;
    accountantNote: string | null;
  } | null;
}) {
  const { year, categoryLabel, regimeLabel, rows, guide } = params;
  const eur = (n: number) =>
    Number.isFinite(n) ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : "0 €";
  const generatedAt = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const rowsHtml = rows
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td class="val">${escapeHtml(value)}</td></tr>`)
    .join("");

  const guideHtml = guide
    ? `
    <div class="guide">
      <p class="guide-eyebrow">Ce que vous déclarez aux impôts</p>
      <div class="guide-row">
        <div>
          <p class="guide-label">${escapeHtml(guide.montantLabel)}</p>
          <p class="guide-amount">${guide.isDeficit ? "&minus;" : ""}${escapeHtml(eur(guide.montant))}</p>
          <p class="guide-note">${escapeHtml(guide.montantNote)}</p>
        </div>
        <div class="guide-form">
          <p class="guide-form-label">Formulaire</p>
          <p class="guide-form-value">${escapeHtml(guide.formulaire)}</p>
          <p class="guide-form-hint">${escapeHtml(guide.caseHint)}</p>
        </div>
      </div>
      ${guide.accountantNote ? `<p class="guide-accountant">${escapeHtml(guide.accountantNote)}</p>` : ""}
    </div>`
    : "";

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.5; }
  .accent-bar { background: #4f46e5; padding: 20px 28px; color: white; }
  .doc-title { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; }
  .doc-sub { margin-top: 4px; font-size: 11px; color: rgba(255,255,255,0.75); }
  .body { padding: 20px 28px; }
  .meta { display: flex; gap: 24px; margin-bottom: 16px; }
  .meta div { flex: 1; }
  .meta p:first-child { font-size: 8.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #94a3b8; }
  .meta p:last-child { margin-top: 2px; font-size: 13px; font-weight: 700; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  td { padding: 7px 4px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
  td.val { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; color: #0f172a; }
  .guide { border: 2px solid #e0e7ff; border-radius: 14px; padding: 16px; background: #f5f5ff; margin-bottom: 16px; }
  .guide-eyebrow { font-size: 8.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #4f46e5; }
  .guide-row { display: flex; justify-content: space-between; gap: 16px; margin-top: 8px; }
  .guide-label { font-size: 10px; color: #64748b; }
  .guide-amount { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 2px; }
  .guide-note { margin-top: 6px; font-size: 10px; color: #475569; max-width: 320px; line-height: 1.5; }
  .guide-form { text-align: right; }
  .guide-form-label { font-size: 8.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; }
  .guide-form-value { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; }
  .guide-form-hint { margin-top: 4px; font-size: 9.5px; color: #64748b; max-width: 220px; }
  .guide-accountant { margin-top: 10px; padding: 8px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 9.5px; color: #92400e; }
  .footer { border-top: 1px solid #f1f5f9; padding-top: 10px; font-size: 8px; color: #94a3b8; line-height: 1.6; }
</style>
</head>
<body>
  <div class="accent-bar">
    <div class="doc-title">Récapitulatif déclaration ${year}</div>
    <div class="doc-sub">Généré le ${generatedAt} · lokt.fr</div>
  </div>
  <div class="body">
    <div class="meta">
      <div><p>Catégorie</p><p>${escapeHtml(categoryLabel)}</p></div>
      <div><p>Régime retenu</p><p>${escapeHtml(regimeLabel)}</p></div>
    </div>
    <table><tbody>${rowsHtml}</tbody></table>
    ${guideHtml}
    <div class="footer">
      Document généré via lokt.fr à titre d'aide à la préparation — ce n'est pas un logiciel de déclaration officiel.
      Les cases et numéros de formulaires sont indicatifs et peuvent changer chaque année : vérifiez sur impots.gouv.fr avant de déclarer.
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { year, categoryLabel, regimeLabel, rows, guide } = (req.body || {}) as {
      year?: number;
      categoryLabel?: string;
      regimeLabel?: string;
      rows?: Array<[string, string]>;
      guide?: any;
    };

    if (!year || !Array.isArray(rows)) return res.status(400).json({ error: "Données de déclaration invalides." });

    const html = buildHtml({
      year,
      categoryLabel: String(categoryLabel || ""),
      regimeLabel: String(regimeLabel || ""),
      rows,
      guide: guide || null,
    });

    const pdfBuf = await renderPdfFromHtml(html);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="declaration-${year}.pdf"`);
    return res.status(200).send(pdfBuf);
  } catch (e: any) {
    console.error("[api/declaration/export-pdf] error:", e);
    return res.status(500).json({ error: e?.message || "Export PDF impossible." });
  }
}
