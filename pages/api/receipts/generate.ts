// pages/api/receipts/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { getLeaseRentPeriodFromDate } from "../../../lib/rentPeriod";

type Json = Record<string, any>;

const pad2 = (n: number) => String(n).padStart(2, "0");
const toISODateLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function euro(n: any) {
  const x = Number(n || 0);
  try {
    return x.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  } catch {
    return `${x.toFixed(2)} €`;
  }
}

function formatDateFR(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function yyyymmFrom(periodStart?: string | null) {
  const s = safeStr(periodStart);
  return s ? s.slice(0, 7) : toISODateLocal(new Date()).slice(0, 7);
}

function slugFilePart(input: string) {
  const s = safeStr(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return s || "locataire";
}

function safeFileDatePart(isoDate: string) {
  const s = safeStr(isoDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s.slice(0, 10).replace(/[^0-9-]/g, "") || "date";
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


function requireServerModule(moduleName: string): any {
  return (eval("require") as NodeRequire)(moduleName);
}

function buildDefaultQuittanceText(params: {
  landlordFullName: string;
  landlordAddressLine: string;
  tenantName: string;
  tenantAddressLine: string;
  propertyAddressLine: string;

  periodStart: string;
  periodEnd: string;

  totalAmount: number;
  rentAmount: number;
  chargesAmount: number;

  paymentMethod?: string | null;
  issuePlace?: string | null;
  issueDateISO: string;
}) {
  const {
    landlordFullName,
    tenantName,
    propertyAddressLine,
    periodStart,
    periodEnd,
    totalAmount,
    rentAmount,
    chargesAmount,
    paymentMethod,
    issuePlace,
    issueDateISO,
  } = params;

  const lines: string[] = [];

  lines.push(
    `Je soussigné(e), ${safeStr(landlordFullName) || "le bailleur"}, reconnais avoir reçu de ${
      safeStr(tenantName) || "le locataire"
    } la somme de ${euro(totalAmount)} (dont ${euro(rentAmount)} de loyer hors charges et ${euro(
      chargesAmount
    )} de provisions sur charges), au titre du paiement du loyer et des charges pour le logement situé :`
  );
  lines.push(safeStr(propertyAddressLine) || "—");
  lines.push("");
  lines.push(`Cette somme couvre la période du ${formatDateFR(periodStart)} au ${formatDateFR(periodEnd)}.`);
  if (safeStr(paymentMethod)) lines.push(`Mode de paiement : ${safeStr(paymentMethod)}.`);
  lines.push("");
  lines.push("La présente quittance vaut reçu pour solde de toute dette locative pour la période indiquée.");
  lines.push("");

  const place = safeStr(issuePlace) || "";
  const dateFr = formatDateFR(issueDateISO);
  lines.push(place ? `${place}, le ${dateFr}` : `Le ${dateFr}`);

  return lines.join("\n");
}

function htmlTemplatePremium(params: {
  periodLabel: string;
  issueDateLabel: string;

  landlordName: string;
  landlordAddress: string;

  tenantName: string;
  tenantAddress: string;

  propertyAddress: string;

  rent: string;
  charges: string;
  total: string;

  textBlock: string;

  signatureName: string;
}) {
  const {
    periodLabel,
    issueDateLabel,
    landlordName,
    landlordAddress,
    tenantName,
    tenantAddress,
    propertyAddress,
    rent,
    charges,
    total,
    textBlock,
    signatureName,
  } = params;

  const textHtml = escapeHtml(textBlock).replace(/\n/g, "<br/>");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 14mm; }
  :root{ --ink:#0f172a; --muted:#475569; --line:#e2e8f0; --soft:#f8fafc; }
  *{ box-sizing:border-box; }
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,"Noto Sans","Helvetica Neue",sans-serif;
    color:var(--ink);
    margin:0;
    background:white;
  }
  .header{
    display:flex; justify-content:space-between; align-items:flex-end; gap:16px;
    padding-bottom:12px; border-bottom:2px solid var(--ink);
  }
  .docTitle{ font-size:20px; font-weight:900; letter-spacing:-0.02em; line-height:1; }
  .meta{ text-align:right; font-size:10.5px; color:var(--muted); line-height:1.5; }
  .meta strong{ color:var(--ink); font-weight:700; }

  .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px; }
  .card{ border:1px solid var(--line); border-radius:12px; padding:10px 12px; background:#fff; }
  .cardTitle{ font-size:9.5px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted); margin-bottom:5px; }
  .kv{ font-size:11px; line-height:1.45; word-break:break-word; }
  .kvMain{ font-size:12px; font-weight:700; }
  .muted{ color:var(--muted); }
  .property{ margin-top:10px; }

  .amounts{ margin-top:10px; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .amountsHeader{ background:var(--soft); padding:7px 12px; font-size:9.5px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted); border-bottom:1px solid var(--line); }
  table{ width:100%; border-collapse:collapse; font-size:11px; }
  td{ padding:7px 12px; border-top:1px solid var(--line); color:var(--ink); }
  td:last-child{ text-align:right; font-variant-numeric:tabular-nums; }
  .totalRow td{ font-weight:800; font-size:12px; background:var(--soft); }

  .textBlock{ margin-top:10px; border:1px solid var(--line); border-radius:12px; padding:12px; background:var(--soft); }
  .textBlockBody{ font-size:11px; line-height:1.6; color:var(--ink); }

  .signature{
    margin-top:10px; border:1px solid var(--line); border-radius:12px; padding:10px 12px;
    background:#fff; display:flex; justify-content:space-between; align-items:flex-end; min-height:52px;
  }
  .sigLeft{ display:flex; flex-direction:column; gap:2px; }
  .sigLabel{ font-size:9.5px; color:var(--muted); font-weight:600; letter-spacing:0.04em; }
  .sigName{ font-size:11.5px; font-weight:800; margin-top:2px; }
  .sigRight{ font-size:9.5px; color:var(--muted); text-align:right; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="docTitle">Quittance de loyer</div>
      <div class="meta">
        <div><strong>${escapeHtml(periodLabel)}</strong></div>
        <div>${escapeHtml(issueDateLabel)}</div>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <div class="cardTitle">Bailleur</div>
        <div class="kv kvMain">${escapeHtml(landlordName || "—")}</div>
        <div class="kv muted">${escapeHtml(landlordAddress || "—")}</div>
      </div>

      <div class="card">
        <div class="cardTitle">Locataire</div>
        <div class="kv kvMain">${escapeHtml(tenantName || "—")}</div>
        <div class="kv muted">${escapeHtml(tenantAddress || "—")}</div>
      </div>
    </div>

    <div class="card property">
      <div class="cardTitle">Logement</div>
      <div class="kv">${escapeHtml(propertyAddress || "—")}</div>
    </div>

    <div class="amounts">
      <div class="amountsHeader">Montants perçus</div>
      <table><tbody>
        <tr><td>Loyer hors charges</td><td>${escapeHtml(rent)}</td></tr>
        <tr><td>Provisions sur charges</td><td>${escapeHtml(charges)}</td></tr>
        <tr class="totalRow"><td>Total perçu</td><td>${escapeHtml(total)}</td></tr>
      </tbody></table>
    </div>

    <div class="textBlock">
      <div class="textBlockBody">${textHtml}</div>
    </div>

    <div class="signature">
      <div class="sigLeft">
        <div class="sigLabel">Signature du bailleur</div>
        <div class="sigName">${escapeHtml(signatureName || "—")}</div>
      </div>
      <div class="sigRight">Cachet / tampon (optionnel)</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * ✅ Render HTML -> PDF
 * Règle OR : sur mac/windows => puppeteer full (pas de sparticuz)
 */
async function renderPdfFromHtml(html: string) {
  if (String(process.env.NEXT_RUNTIME || "").toLowerCase() === "edge") {
    throw new Error("Runtime Edge incompatible avec Chromium. Utilise runtime Node.js pour /api/receipts/generate.");
  }

  const forceFull = process.env.FORCE_PUPPETEER_FULL === "1";
  const isLinux = process.platform === "linux";

  // ✅ LOCAL macOS/windows (ou si force) => puppeteer full
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
        pageRanges: "1",
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // ✅ Linux serverless => puppeteer-core + @sparticuz/chromium
  const executablePath = await chromium.executablePath();

  const browser = await puppeteerCore.launch({
    args: puppeteerCore.defaultArgs({ args: chromium.args, headless: "shell" }),
    defaultViewport: {
      deviceScaleFactor: 1,
      hasTouch: false,
      height: 1080,
      isLandscape: false,
      isMobile: false,
      width: 794,
    },
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
      pageRanges: "1",
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req, { allowInternal: true });
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, leaseId, periodStart: requestedPeriodStart, periodEnd: requestedPeriodEnd, contentText } = (req.body || {}) as {
      userId?: string;
      leaseId?: string;
      periodStart?: string;
      periodEnd?: string;
      contentText?: string;
    };

    if (!userId) return res.status(400).json({ error: "userId requis." });
    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!leaseId || !requestedPeriodStart || !requestedPeriodEnd) {
      return res.status(400).json({ error: "leaseId + periodStart + periodEnd requis." });
    }

    const leaseRes = await supabaseAdmin.from("leases").select("*").eq("id", leaseId).single();
    if (leaseRes.error || !leaseRes.data) return res.status(404).json({ error: "Bail introuvable." });
    const lease: any = leaseRes.data;
    if (String(lease.user_id) !== String(userId)) return res.status(403).json({ error: "Accès refusé." });

    let property: any = null;
    if (lease.property_id) {
      const pr = await supabaseAdmin.from("properties").select("*").eq("id", lease.property_id).maybeSingle();
      if (pr.data) property = pr.data;
    }

    let tenant: any = null;
    if (lease.tenant_id) {
      const tr = await supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).maybeSingle();
      if (tr.data) tenant = tr.data;
    }

    const lr = await supabaseAdmin.from("landlords").select("*").eq("user_id", userId).maybeSingle();
    const landlord: any = lr.data || null;

    const prf = await supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle();
    const profile: any = prf.data || null;

    const rentPeriod = getLeaseRentPeriodFromDate(lease, requestedPeriodStart);
    if (!rentPeriod) return res.status(400).json({ error: "Cette période est en dehors des dates du bail." });
    const periodStart = rentPeriod.periodStart;
    const periodEnd = rentPeriod.periodEnd;
    const rentAmount = rentPeriod.rent;
    const chargesAmount = rentPeriod.charges;
    const totalAmount = rentPeriod.total;

    // Accept payment if it covers at least up to periodEnd (handles end_date set after payment)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("rent_payments")
      .select("paid_at,total_amount")
      .eq("lease_id", leaseId)
      .eq("period_start", periodStart)
      .gte("period_end", periodEnd)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (paymentError) return res.status(500).json({ error: paymentError.message });
    if (!payment?.paid_at || Number(payment.total_amount || 0) + 0.01 < totalAmount) {
      return res.status(409).json({
        error: "Quittance indisponible : confirme d’abord le paiement complet du loyer et des charges.",
      });
    }

    // Find existing receipt for same period_start in same month (period_end may differ if end_date changed)
    const yyyymm = periodStart.slice(0, 7);

    // Clean up stale draft receipts for the same month/period_start but a different period_end.
    // These accumulate when end_date changes after a receipt was created, and cause a unique
    // constraint conflict when UPDATE tries to write the new period_end.
    await supabaseAdmin
      .from("rent_receipts")
      .delete()
      .eq("lease_id", leaseId)
      .eq("period_start", periodStart)
      .eq("status", "draft")
      .neq("period_end", periodEnd);

    let receipt: any = null;
    const existing = await supabaseAdmin
      .from("rent_receipts")
      .select("*")
      .eq("lease_id", leaseId)
      .eq("period_start", periodStart)
      .gte("period_end", `${yyyymm}-01`)
      .lte("period_end", `${yyyymm}-31`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const issueDateISO = toISODateLocal(new Date());

    if (existing.data) {
      const upd = await supabaseAdmin
        .from("rent_receipts")
        .update({
          period_end: periodEnd,
          rent_amount: rentAmount,
          charges_amount: chargesAmount,
          total_amount: totalAmount,
          content_text: typeof contentText === "string" ? contentText : existing.data.content_text,
          edited_at: typeof contentText === "string" ? new Date().toISOString() : existing.data.edited_at,
          issue_date: issueDateISO,
          status: existing.data.status || "generated",
        })
        .eq("id", existing.data.id)
        .select("*")
        .single();

      if (upd.error || !upd.data) return res.status(500).json({ error: upd.error?.message || "Update quittance échoué." });
      receipt = upd.data;
    } else {
      // Upsert instead of insert: handles any residual race condition on the unique constraint.
      const ins = await supabaseAdmin
        .from("rent_receipts")
        .upsert({
          lease_id: leaseId,
          period_start: periodStart,
          period_end: periodEnd,
          rent_amount: rentAmount,
          charges_amount: chargesAmount,
          total_amount: totalAmount,
          issue_date: issueDateISO,
          issued_at: new Date().toISOString(),
          content_text: typeof contentText === "string" ? contentText : "",
          status: "generated",
          created_at: new Date().toISOString(),
        }, { onConflict: "lease_id,period_start,period_end" })
        .select("*")
        .single();

      if (ins.error || !ins.data) return res.status(500).json({ error: ins.error?.message || "Création quittance échouée." });
      receipt = ins.data;
    }

    const landlordName =
      safeStr(landlord?.display_name) ||
      safeStr(profile?.full_name) ||
      [safeStr(profile?.first_name), safeStr(profile?.last_name)].filter(Boolean).join(" ") ||
      safeStr(landlord?.user_id) ||
      safeStr(userId);

    const landlordAddressLine1 =
      safeStr(landlord?.address_line1) || safeStr(profile?.address_line1) || safeStr(landlord?.address) || "";
    const landlordAddressLine2 = safeStr(landlord?.address_line2) || safeStr(profile?.address_line2) || "";
    const landlordPostal = safeStr(landlord?.postal_code) || safeStr(profile?.postal_code) || "";
    const landlordCity = safeStr(landlord?.city) || safeStr(profile?.city) || "";
    const landlordCountry = safeStr(landlord?.country) || safeStr(profile?.country) || "FR";

    const landlordAddress = [
      [landlordAddressLine1, landlordAddressLine2].filter(Boolean).join(" "),
      [landlordPostal, landlordCity].filter(Boolean).join(" "),
      landlordCountry,
    ]
      .filter(Boolean)
      .join(" • ");

    const issuePlace =
      safeStr(landlord?.default_issue_place) ||
      safeStr(landlord?.default_city) ||
      safeStr(landlord?.city) ||
      safeStr(profile?.city) ||
      "";

    const tenantName = safeStr(tenant?.full_name) || safeStr(lease?.tenant_name) || "Locataire";
    const tenantEmail = safeStr(tenant?.email) || "";

    const propertyLabel = safeStr(property?.label) || safeStr(lease?.property_label) || "Bien";
    const propertyAddressLine =
      [
        safeStr(property?.address_line1),
        safeStr(property?.address_line2),
        [safeStr(property?.postal_code), safeStr(property?.city)].filter(Boolean).join(" "),
        safeStr(property?.country || "FR"),
      ]
        .filter(Boolean)
        .join(", ") || "—";

    // ✅ adresse “locataire” = adresse du bien loué
    const tenantAddress = propertyAddressLine;

    const paymentMethod = safeStr(landlord?.default_payment_method) || safeStr(lease?.payment_method) || "";

    const defaultText = buildDefaultQuittanceText({
      landlordFullName: landlordName,
      landlordAddressLine: landlordAddress.replace(/ • /g, " "),
      tenantName,
      tenantAddressLine: tenantAddress,
      propertyAddressLine: propertyAddressLine,
      periodStart,
      periodEnd,
      totalAmount,
      rentAmount,
      chargesAmount,
      paymentMethod: paymentMethod || null,
      issuePlace: issuePlace || null,
      issueDateISO,
    });

    const finalText =
      typeof contentText === "string" && safeStr(contentText)
        ? safeStr(contentText)
        : defaultText;

    const periodLabel = `Période du ${formatDateFR(periodStart)} au ${formatDateFR(periodEnd)}`;
    const issueDateLabel = issuePlace ? `Émise le ${formatDateFR(issueDateISO)} · ${issuePlace}` : `Émise le ${formatDateFR(issueDateISO)}`;

    const html = htmlTemplatePremium({
      periodLabel,
      issueDateLabel,

      landlordName,
      landlordAddress: landlordAddress || "—",

      tenantName,
      tenantAddress,

      propertyAddress: propertyAddressLine,

      rent: euro(rentAmount),
      charges: euro(chargesAmount),
      total: euro(totalAmount),

      textBlock: finalText,

      signatureName: landlordName,
    });

    const pdfBuf = await renderPdfFromHtml(html);

    const tenantSlug = slugFilePart(tenantName);
    const pStart = safeFileDatePart(periodStart);
    const pEnd = safeFileDatePart(periodEnd);
    const filename = `quittance-${tenantSlug}-${pStart}_au_${pEnd}.pdf`;

    const storagePath = `${userId}/${receipt.lease_id}/${receipt.id}/${filename}`;

    const up = await supabaseAdmin.storage.from("rent-receipts-pdfs").upload(storagePath, pdfBuf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) return res.status(500).json({ error: `Upload PDF échoué: ${up.error.message}` });

    const pdfUrl = `rent-receipts-pdfs:${storagePath}`;

    // --- update receipt (pas de finance)
    const upd2 = await supabaseAdmin
      .from("rent_receipts")
      .update({
        pdf_url: pdfUrl,
        content_text: finalText,
        status: receipt.status || "generated",
      })
      .eq("id", receipt.id);

    if (upd2.error) {
      return res.status(500).json({ error: `Update quittance échoué: ${upd2.error.message}` });
    }

    const signed = await supabaseAdmin.storage.from("rent-receipts-pdfs").createSignedUrl(storagePath, 60 * 10);
    if (signed.error) return res.status(500).json({ error: `Signed URL échoué: ${signed.error.message}` });

    return res.status(200).json({
      ok: true,
      receipt_id: receipt.id,
      pdf_url: pdfUrl,
      storage_path: storagePath,
      filename,
      signedUrl: signed.data?.signedUrl || null,
      yyyymm: yyyymmFrom(periodStart),
    });
  } catch (e: any) {
    console.error("[api/receipts/generate] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
