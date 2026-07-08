// pages/api/inventory/pdf.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { invalidateStorageCache } from "../../../lib/storageQuota";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";

type Json = Record<string, any>;

const pad2 = (n: number) => String(n).padStart(2, "0");
const toISODateLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function conditionLabel(c: string) {
  switch (String(c || "").toLowerCase()) {
    case "neuf":
      return "Neuf";
    case "tres_bon":
      return "Très bon";
    case "bon":
      return "Bon";
    case "moyen":
      return "Moyen";
    case "mauvais":
      return "Mauvais";
    default:
      return c || "—";
  }
}

function conditionClass(c: string) {
  switch (String(c || "").toLowerCase()) {
    case "neuf":
    case "tres_bon":
    case "bon":
      return "ok";
    case "moyen":
      return "warn";
    case "mauvais":
      return "bad";
    default:
      return "neutral";
  }
}

function yn(v: any) {
  if (v === true) return "Oui";
  if (v === false) return "Non";
  return "—";
}

function fmtDateTimeFR(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readLogoDataUrlIfExists() {
  const candidates = [
    path.join(process.cwd(), "public", "minilogo.png"),
    path.join(process.cwd(), "public", "LOKT_LOGO.jpg"),
    path.join(process.cwd(), "public", "logo-transparent-Lokt.jpg"),
    path.join(process.cwd(), "public", "lokt-logo.jpg"),
    path.join(process.cwd(), "public", "brand", "LOKT_LOGO.jpg"),
    path.join(process.cwd(), "public", "lokt-logo.png"),
  ];
  const p = candidates.find((x) => fs.existsSync(x));
  if (!p) return null;

  try {
    const buf = fs.readFileSync(p);
    const ext = p.toLowerCase().endsWith(".png") ? "png" : "jpeg";
    return `data:image/${ext};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function safeFilePart(input: string) {
  const s = safeStr(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return s || "edl";
}

function collectDefects(item: any) {
  const tags = Array.isArray(item?.defect_tags) ? item.defect_tags : [];
  return tags.length ? tags.join(", ") : "";
}

function requireServerModule(moduleName: string): any {
  return (eval("require") as NodeRequire)(moduleName);
}

async function optimizeObservationImagesForPdf(page: any) {
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".photos img"));
    await Promise.all(
      images.map(async (image) => {
        try {
          if (!image.complete) {
            await new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            });
          }
          if (!image.naturalWidth || !image.naturalHeight) return;

          const maxSide = 1100;
          const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(image, 0, 0, width, height);
          image.src = canvas.toDataURL("image/jpeg", 0.62);
        } catch {
          // Le fichier compressé à l'upload reste utilisable si le navigateur ne peut pas le retraiter.
        }
      })
    );
  });
}

/**
 * ✅ Render HTML -> PDF
 * même logique que quittance (full puppeteer en local, sparticuz en linux)
 */
async function renderPdfFromHtml(html: string) {
  if (String(process.env.NEXT_RUNTIME || "").toLowerCase() === "edge") {
    throw new Error("Runtime Edge incompatible avec Chromium. Utilise runtime Node.js pour /api/inventory/pdf.");
  }

  const forceFull = process.env.FORCE_PUPPETEER_FULL === "1";
  const isLinux = process.platform === "linux";

  // Local mac/windows (ou force) => puppeteer full
  if (!isLinux || forceFull) {
    const puppeteerFullRaw: any = requireServerModule("puppeteer");
    const puppeteerFull = puppeteerFullRaw.default || puppeteerFullRaw;
    const browser = await puppeteerFull.launch({ headless: "new" });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      await optimizeObservationImagesForPdf(page);

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

  // Linux serverless => puppeteer-core + @sparticuz/chromium
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
    await optimizeObservationImagesForPdf(page);

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

function buildHtmlPremiumEDL(params: {
  logoDataUrl: string | null;
  title: string;
  subtitleRightTop: string;
  subtitleRightBottom: string;

  landlordName: string;
  tenantName: string;
  propertyLabel: string;
  propertyAddress: string;

  performedAt: string;
  performedPlace: string;
  generalNotes: string;
  counters: Array<{ label: string; value: string }>;

  rooms: Array<{
    id: string;
    name: string;
    floor_level: string | null;
    notes: string | null;
    categories: Array<{
      name: string;
      items: Array<{
        label: string;
        condition: string;
        is_clean: any;
        is_functional: any;
        wear_level: any;
        severity: any;
        description: string;
        defects: string;
        photos: Array<{ signedUrl: string; important: boolean }>;
      }>;
    }>;
  }>;

  noRoom: Array<{
    categories: Array<{
      name: string;
      items: Array<{
        label: string;
        condition: string;
        is_clean: any;
        is_functional: any;
        wear_level: any;
        severity: any;
        description: string;
        defects: string;
        photos: Array<{ signedUrl: string; important: boolean }>;
      }>;
    }>;
  }>;
}) {
  const {
    logoDataUrl,
    title,
    subtitleRightTop,
    subtitleRightBottom,
    landlordName,
    tenantName,
    propertyLabel,
    propertyAddress,
    performedAt,
    performedPlace,
    generalNotes,
    counters,
    rooms,
  noRoom,
  } = params;

  const totalRooms = rooms.length;
  const totalItems =
    rooms.reduce((acc, r) => acc + r.categories.reduce((sum, c) => sum + c.items.length, 0), 0) +
    (noRoom || []).reduce((acc, r) => acc + r.categories.reduce((sum, c) => sum + c.items.length, 0), 0);
  const totalDefects =
    rooms.reduce(
      (acc, r) =>
        acc +
        r.categories.reduce(
          (sum, c) =>
            sum +
            c.items.filter(
              (it) => !!it.defects || String(it.condition).toLowerCase() === "mauvais" || (typeof it.severity === "number" && it.severity >= 3)
            ).length,
          0
        ),
      0
    ) +
    (noRoom || []).reduce(
      (acc, r) =>
        acc +
        r.categories.reduce(
          (sum, c) =>
            sum +
            c.items.filter(
              (it) => !!it.defects || String(it.condition).toLowerCase() === "mauvais" || (typeof it.severity === "number" && it.severity >= 3)
            ).length,
          0
        ),
      0
    );
  const completedRooms = rooms.filter((r) => r.categories.reduce((sum, c) => sum + c.items.length, 0) > 0).length;

  const headerLogo = logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="lokt.fr" />` : `<div class="brandText">lokt<span>.fr</span></div>`;
  const footerLogo = logoDataUrl ? `<img class="footerLogo" src="${logoDataUrl}" alt="lokt.fr" />` : ``;
  const followTone = totalDefects > 0 ? "warn" : "ok";
  const followLabel = totalDefects > 0 ? `${totalDefects} point${totalDefects > 1 ? "s" : ""} à suivre` : "Aucun point critique";

  const notesHtml = generalNotes ? escapeHtml(generalNotes).replace(/\n/g, "<br/>") : "";
  const countersHtml = counters.length
    ? `<div class="infoBlock">
        <div class="infoTitle">Compteurs et clés</div>
        <div class="infoGrid">
          ${counters
            .map(
              (row) => `<div class="infoCell">
                <div class="infoLabel">${escapeHtml(row.label)}</div>
                <div class="infoValue">${escapeHtml(row.value || "—")}</div>
              </div>`
            )
            .join("")}
        </div>
      </div>`
    : "";

  // Sommaire (CSS counters + anchors)
  const tocItems = rooms
    .map((r, idx) => {
      const label = `${r.name}${r.floor_level ? ` — ${r.floor_level}` : ""}`;
      const count = r.categories.reduce((acc, c) => acc + c.items.length, 0);
      return `<div class="tocRow">
        <div class="tocLeft"><span class="tocNum">${idx + 1}.</span> <a href="#room-${escapeHtml(r.id)}">${escapeHtml(label)}</a></div>
        <div class="tocRight">${count}</div>
      </div>`;
    })
    .join("");

  const roomBlocks = rooms
    .map((r, idx) => {
      const roomTitle = `${r.name}${r.floor_level ? ` — ${r.floor_level}` : ""}`;
      const roomNotes = r.notes ? `<div class="muted small" style="margin-top:6px;">Notes : ${escapeHtml(r.notes)}</div>` : "";

      const catBlocks = r.categories
        .map((cat) => {
          const rows = cat.items
            .map((it) => {
              const obs =
                it.defects && it.description
                  ? `${it.description}\nDéfauts : ${it.defects}`
                  : it.defects
                  ? `Défauts : ${it.defects}`
                  : it.description || "—";

              const obsHtml = escapeHtml(obs).replace(/\n/g, "<br/>");

              const hasDefects = !!it.defects;
              const important = (typeof it.severity === "number" && it.severity >= 3) || String(it.condition) === "mauvais" || hasDefects;

              const photosHtml = (it.photos || [])
                .slice(0, 3)
                .map(
                  (p) =>
                    `<div class="${p.important ? "photoHero" : "photoThumb"}">
                      <img src="${p.signedUrl}" crossorigin="anonymous" alt="photo" />
                    </div>`
                )
                .join("");

              const photoWrap = photosHtml ? `<div class="photos">${photosHtml}</div>` : "";

              return `<article class="itemCard ${important ? "important" : ""}">
                <div class="itemTop">
                  <div class="itemMain">
                    <div class="elTitle">${escapeHtml(it.label || "—")}</div>
                    <div class="muted small">Usure : ${escapeHtml(String(it.wear_level ?? "—"))}/5 • Gravité : ${escapeHtml(
                String(it.severity ?? 0)
              )}/5</div>
                  </div>
                  <div class="itemBadges">
                    <span class="statePill ${conditionClass(it.condition)}">${escapeHtml(conditionLabel(it.condition))}</span>
                    <span class="miniBadge">Propre ${escapeHtml(yn(it.is_clean))}</span>
                    <span class="miniBadge">Fonct. ${escapeHtml(yn(it.is_functional))}</span>
                  </div>
                </div>
                <div class="colObs ${hasDefects ? "hasDefects" : ""}">${obsHtml}</div>
                ${photoWrap}
              </article>`;
            })
            .join("");

          if (!rows) {
            return `<div class="cat">
              <div class="catTitle">${escapeHtml(cat.name || "Autre")}</div>
              <div class="muted">Aucun élément.</div>
            </div>`;
          }

          return `<div class="cat">
            <div class="catTitle">${escapeHtml(cat.name || "Autre")}</div>
            <div class="itemList">${rows}</div>
          </div>`;
        })
        .join("");

      const itemCount = r.categories.reduce((acc, c) => acc + c.items.length, 0);
      return `<section class="room" id="room-${escapeHtml(r.id)}">
        <div class="roomHeader">
          <div>
            <div class="roomKicker">Pièce ${idx + 1}/${rooms.length}</div>
            <div class="roomTitle">${escapeHtml(roomTitle)}</div>
            ${roomNotes}
          </div>
          <div class="roomCount">${itemCount} relevé${itemCount > 1 ? "s" : ""}</div>
        </div>
        ${catBlocks || `<div class="emptyBox">Aucun élément relevé pour cette pièce.</div>`}
      </section>`;
    })
    .join("");

  const emptyDocumentBlock =
    !rooms.length && !noRoom?.length
      ? `<section class="emptyDocument">
          <div class="emptyTitle">Aucun relevé pièce par pièce</div>
          <p>Le document a été généré, mais aucune pièce ni aucun élément n’a été enregistré dans l’état des lieux.</p>
          <p>Pour un document exploitable, ajoute au minimum les pièces principales, les compteurs, les clés et les observations importantes avant signature.</p>
        </section>`
      : "";

  const noRoomBlock = noRoom?.length
    ? `<section class="room" id="room-no-room">
        <div class="roomHeader">
          <div>
            <div class="roomKicker">Annexe</div>
            <div class="roomTitle">Éléments hors pièce</div>
          </div>
        </div>
        ${
          noRoom[0].categories
            .map((cat) => {
              const rows = cat.items
                .map((it) => {
                  const obs =
                    it.defects && it.description
                      ? `${it.description}\nDéfauts : ${it.defects}`
                      : it.defects
                      ? `Défauts : ${it.defects}`
                      : it.description || "—";
                  const obsHtml = escapeHtml(obs).replace(/\n/g, "<br/>");
                  const hasDefects = !!it.defects;
                  const important = (typeof it.severity === "number" && it.severity >= 3) || String(it.condition) === "mauvais" || hasDefects;

                  const photosHtml = (it.photos || [])
                    .slice(0, 3)
                    .map(
                      (p) =>
                        `<div class="${p.important ? "photoHero" : "photoThumb"}">
                          <img src="${p.signedUrl}" crossorigin="anonymous" alt="photo" />
                        </div>`
                    )
                    .join("");

                  const photoWrap = photosHtml ? `<div class="photos">${photosHtml}</div>` : "";

                  return `<article class="itemCard ${important ? "important" : ""}">
                    <div class="itemTop">
                      <div class="itemMain">
                        <div class="elTitle">${escapeHtml(it.label || "—")}</div>
                        <div class="muted small">Usure : ${escapeHtml(String(it.wear_level ?? "—"))}/5 • Gravité : ${escapeHtml(
                    String(it.severity ?? 0)
                  )}/5</div>
                      </div>
                      <div class="itemBadges">
                        <span class="statePill ${conditionClass(it.condition)}">${escapeHtml(conditionLabel(it.condition))}</span>
                        <span class="miniBadge">Propre ${escapeHtml(yn(it.is_clean))}</span>
                        <span class="miniBadge">Fonct. ${escapeHtml(yn(it.is_functional))}</span>
                      </div>
                    </div>
                    <div class="colObs ${hasDefects ? "hasDefects" : ""}">${obsHtml}</div>
                    ${photoWrap}
                  </article>`;
                })
                .join("");

              return `<div class="cat">
                <div class="catTitle">${escapeHtml(cat.name || "Autre")}</div>
                <div class="itemList">${rows || `<div class="emptyBox">Aucun élément.</div>`}</div>
              </div>`;
            })
            .join("") || ""
        }
      </section>`
    : "";

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 14mm; }
  :root{
    --ink:#0f172a; --muted:#64748b; --line:#dbe4ee; --soft:#f8fafc;
    --brand:#2563eb; --brand2:#06b6d4; --green:#047857; --brandSoft:#eff6ff; --danger:#b91c1c; --warn:#b45309;
  }
  *{ box-sizing:border-box; }
  html,body{ margin:0; padding:0; }
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,"Noto Sans","Helvetica Neue",sans-serif;
    color:var(--ink);
    background:white;
  }

  .header{
    display:flex; justify-content:space-between; gap:16px;
    padding-bottom:10px; border-bottom:1px solid #e2e8f0;
    align-items:flex-start;
  }
  .logo{ height:38px; width:auto; object-fit:contain; }
  .brandText{ font-weight:950; font-size:22px; letter-spacing:-0.03em; }
  .brandText span{ color:var(--brand); }

  .meta{
    text-align:right; font-size:10.5px; color:var(--muted); line-height:1.35; max-width:55%;
  }
  .meta strong{ color:var(--ink); }

  .hero{
    margin-top:14px;
    border-radius:24px;
    padding:20px;
    color:white;
    background:
      radial-gradient(circle at 86% 18%, rgba(6,182,212,.62), transparent 30%),
      linear-gradient(135deg,#111827 0%,#1e3a8a 54%,#0891b2 100%);
    box-shadow:0 18px 44px rgba(15,23,42,.16);
  }
  .docKicker{ font-size:10px; font-weight:900; letter-spacing:0.16em; text-transform:uppercase; color:#bae6fd; }
  .title{ margin-top:6px; max-width:82%; font-size:31px; line-height:1.02; font-weight:950; letter-spacing:-0.04em; }
  .legalNote{ margin-top:10px; max-width:86%; font-size:11px; line-height:1.55; color:rgba(255,255,255,.84); }
  .stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:13px; }
  .stat{ border:1px solid rgba(255,255,255,.28); border-radius:15px; padding:10px; background:rgba(255,255,255,0.13); backdrop-filter:blur(4px); }
  .statLabel{ font-size:8px; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,.72); }
  .statValue{ margin-top:4px; font-size:17px; font-weight:950; color:white; }
  .followPill{
    display:inline-flex; align-items:center; margin-top:12px; border-radius:999px; padding:7px 10px;
    font-size:10px; font-weight:900; background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.24);
  }
  .followPill.ok{ color:#bbf7d0; }
  .followPill.warn{ color:#fde68a; }

  .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
  .card{ border:1px solid var(--line); border-radius:16px; padding:12px; background:#fff; box-shadow:0 8px 20px rgba(15,23,42,.035); }
  .cardTitle{ font-size:10px; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:6px; }
  .kv{ font-size:11px; line-height:1.35; word-break:break-word; }
  .muted{ color:var(--muted); }
  .small{ font-size:10px; }
  .property{ margin-top:10px; }

  .notes{
    margin-top:10px; border:1px solid var(--line); border-radius:14px;
    padding:10px; background:var(--soft);
  }
  .notesTitle{ font-size:10px; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:8px; }
  .notesBody{ font-size:11px; line-height:1.5; }

  .infoBlock{
    margin-top:10px; border:1px solid var(--line); border-radius:14px;
    padding:10px; background:#fff;
  }
  .infoTitle{ font-size:10px; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:8px; }
  .infoGrid{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .infoCell{ border:1px solid var(--line); border-radius:10px; padding:8px; background:var(--soft); }
  .infoLabel{ font-size:9px; color:var(--muted); font-weight:800; text-transform:uppercase; letter-spacing:0.08em; }
  .infoValue{ margin-top:3px; font-size:11px; font-weight:800; color:var(--ink); word-break:break-word; }

  .toc{
    margin-top:10px; border:1px solid var(--line); border-radius:16px; padding:12px; background:#fff;
  }
  .tocTitle{ font-size:10px; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:8px; }
  .tocRow{ display:flex; justify-content:space-between; gap:10px; border-top:1px solid var(--line); padding-top:6px; margin-top:6px; }
  .tocRow:first-of-type{ border-top:none; padding-top:0; margin-top:0; }
  .tocLeft{ font-size:11px; }
  .tocLeft a{ color:var(--ink); text-decoration:none; }
  .tocNum{ color:var(--muted); margin-right:6px; }
  .tocRight{ font-size:11px; color:var(--muted); }

  .room{
    margin-top:10px;
    break-inside:auto;
  }
  .room:first-of-type{ margin-top:14px; }
  .roomHeader{
    display:flex; justify-content:space-between; gap:14px; align-items:flex-start;
    border:1px solid #bfdbfe; border-radius:18px; padding:13px; background:linear-gradient(135deg, #eff6ff, #ffffff 58%, #ecfeff);
    margin-top:10px;
    break-after:avoid;
  }
  .roomKicker{ font-size:9px; font-weight:900; letter-spacing:0.14em; text-transform:uppercase; color:var(--brand); }
  .roomTitle{ font-size:19px; font-weight:950; margin-top:4px; letter-spacing:-0.02em; }
  .roomCount{
    white-space:nowrap;
    border:1px solid #bfdbfe;
    border-radius:999px;
    background:white;
    color:#1d4ed8;
    padding:6px 10px;
    font-size:10px;
    font-weight:900;
  }

  .cat{ margin-top:10px; }
  .catTitle{
    font-size:10px; font-weight:900; letter-spacing:0.12em; text-transform:uppercase;
    background:#0f172a; border:1px solid #0f172a; color:white; border-radius:14px;
    padding:9px 11px;
    break-after:avoid;
  }

  .itemList{ margin-top:8px; display:grid; gap:8px; }
  .itemCard{
    border:1px solid var(--line); border-radius:16px; padding:10px;
    background:#fff; break-inside:avoid; box-shadow:0 6px 16px rgba(15,23,42,.035);
  }
  .itemCard.important{ border-color:#fecaca; background:linear-gradient(180deg,#fff,#fff7f7); }
  .itemTop{ display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
  .itemMain{ min-width:0; }
  .itemBadges{ display:flex; flex-wrap:wrap; justify-content:flex-end; gap:5px; max-width:46%; }
  .elTitle{ font-weight:900; font-size:12px; }
  .statePill{
    display:inline-flex;
    border-radius:999px;
    padding:4px 7px;
    font-size:9.5px;
    font-weight:900;
    border:1px solid var(--line);
    background:#f8fafc;
    color:#334155;
  }
  .statePill.ok{ border-color:#bbf7d0; background:#ecfdf5; color:var(--green); }
  .statePill.warn{ border-color:#fed7aa; background:#fff7ed; color:var(--warn); }
  .statePill.bad{ border-color:#fecaca; background:#fef2f2; color:var(--danger); }
  .miniBadge{
    display:inline-flex; border-radius:999px; padding:4px 7px; font-size:9.5px; font-weight:800;
    border:1px solid #e2e8f0; background:#f8fafc; color:#475569;
  }
  .colObs{ margin-top:8px; border-top:1px solid #eef2f7; padding-top:8px; font-size:11px; line-height:1.45; color:#334155; }
  .hasDefects{ color:var(--ink); }
  .hasDefects b, .hasDefects strong{ color:var(--danger); }

  .photos{
    margin-top:8px;
    display:flex; gap:8px; flex-wrap:wrap;
  }
  .photoThumb{
    width:140px; height:100px;
    border:1px solid var(--line); border-radius:12px; overflow:hidden;
    background:#fff;
  }
  .photoHero{
    width:100%; max-width:100%;
    border:1px solid var(--line); border-radius:12px; overflow:hidden;
    background:#fff;
  }
  .photoThumb img{ width:100%; height:100%; object-fit:cover; display:block; }
  .photoHero img{ width:100%; height:220px; object-fit:contain; display:block; background:#fff; }

  .signatures{
    break-before:page;
    margin-top:10px;
  }
  .emptyBox,.emptyDocument{
    margin-top:10px;
    border:1px dashed var(--line);
    border-radius:14px;
    background:#f8fafc;
    padding:12px;
    color:#475569;
    font-size:11px;
    line-height:1.5;
  }
  .emptyDocument{ break-before:page; padding:18px; }
  .emptyTitle{ font-size:16px; font-weight:950; color:var(--ink); margin-bottom:6px; }
  .sigGrid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
  .sigBox{ border:1px solid var(--line); border-radius:14px; padding:10px; min-height:140px; background:#fff; }
  .sigLabel{ font-size:10px; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted); }
  .sigName{ margin-top:6px; font-size:12px; font-weight:800; }

  .footer{
    position:fixed; left:14mm; right:14mm; bottom:9mm;
    display:flex; justify-content:space-between; align-items:center;
    height:12px; pointer-events:none;
    color:var(--muted);
    font-size:9.5px;
  }
  .footerLogo{
    height:10px; width:auto;
    opacity:0.28; filter:grayscale(100%);
  }
</style>
</head>
<body>
  <div class="header">
    <div>${headerLogo}</div>
    <div class="meta">
      <div><strong>${escapeHtml(subtitleRightTop)}</strong></div>
      <div>${escapeHtml(subtitleRightBottom)}</div>
    </div>
  </div>

  <section class="hero">
    <div class="docKicker">Document d'état des lieux</div>
    <div class="title">${escapeHtml(title)}</div>
    <div class="legalNote">
      Document destiné à constater contradictoirement l'état du logement, de ses équipements, des compteurs et des clés au moment de la remise ou de la restitution des lieux.
    </div>
    <div class="stats">
      <div class="stat"><div class="statLabel">Pièces</div><div class="statValue">${totalRooms}</div></div>
      <div class="stat"><div class="statLabel">Relevés</div><div class="statValue">${totalItems}</div></div>
      <div class="stat"><div class="statLabel">Pièces complétées</div><div class="statValue">${completedRooms}/${totalRooms || 0}</div></div>
      <div class="stat"><div class="statLabel">Points à suivre</div><div class="statValue">${totalDefects}</div></div>
    </div>
    <div class="followPill ${followTone}">${escapeHtml(followLabel)}</div>
  </section>

  <div class="grid2">
    <div class="card">
      <div class="cardTitle">Bailleur</div>
      <div class="kv"><strong>${escapeHtml(landlordName || "—")}</strong></div>
    </div>

    <div class="card">
      <div class="cardTitle">Locataire</div>
      <div class="kv"><strong>${escapeHtml(tenantName || "—")}</strong></div>
    </div>
  </div>

  <div class="card property">
    <div class="cardTitle">Bien loué</div>
    <div class="kv"><strong>${escapeHtml(propertyLabel || "—")}</strong></div>
    <div class="kv muted">${escapeHtml(propertyAddress || "—")}</div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="cardTitle">Date & heure</div>
      <div class="kv">${escapeHtml(performedAt || "—")}</div>
    </div>
    <div class="card">
      <div class="cardTitle">Lieu</div>
      <div class="kv">${escapeHtml(performedPlace || "—")}</div>
    </div>
  </div>

  ${
    notesHtml
      ? `<div class="notes">
          <div class="notesTitle">Notes générales</div>
          <div class="notesBody">${notesHtml}</div>
        </div>`
      : ``
  }
  ${countersHtml}

  <div class="toc">
    <div class="tocTitle">Sommaire</div>
    <div class="muted small">Clique sur une pièce pour accéder directement à sa section (PDF interactif).</div>
    <div style="margin-top:8px;">
      ${tocItems || `<div class="muted">Aucune pièce.</div>`}
    </div>
  </div>

  ${roomBlocks}

  ${noRoomBlock}

  ${emptyDocumentBlock}

  <section class="signatures">
    <div class="roomHeader">
      <div class="roomKicker">Clôture</div>
      <div class="roomTitle">Signatures</div>
      <div class="muted small" style="margin-top:6px;">Document établi pour signature des parties.</div>
    </div>

    <div class="sigGrid">
      <div class="sigBox">
        <div class="sigLabel">Bailleur</div>
        <div class="sigName">${escapeHtml(landlordName || "—")}</div>
        <div class="muted small" style="margin-top:10px;">Signature :</div>
      </div>

      <div class="sigBox">
        <div class="sigLabel">Locataire</div>
        <div class="sigName">${escapeHtml(tenantName || "—")}</div>
        <div class="muted small" style="margin-top:10px;">Signature :</div>
      </div>
    </div>
  </section>

  <div class="footer">
    <div>lokt.fr • État des lieux</div>
    <div>${footerLogo}</div>
  </div>
</body>
</html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré (env manquantes)." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { reportId, userId } = (req.body || {}) as { reportId?: string; userId?: string };
    if (!reportId || !userId) return res.status(400).json({ error: "reportId et userId requis." });
    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

    // --- report
    const { data: report, error: repErr } = await supabaseAdmin.from("inventory_reports").select("*").eq("id", reportId).single();
    if (repErr || !report) return res.status(404).json({ error: "Report introuvable." });
    if (String(report.user_id) !== String(userId)) return res.status(403).json({ error: "Accès refusé." });

    // ✅ génération uniquement sur ready
    const status = String(report.status || "").toLowerCase();
    if (status !== "ready") {
      return res.status(409).json({ error: "Génération PDF autorisée uniquement lorsque le statut est “Prêt”." });
    }

    // --- rooms/items/photos
    const [{ data: rooms, error: roomsErr }, { data: items, error: itemsErr }, { data: photos, error: photosErr }] = await Promise.all([
      supabaseAdmin.from("inventory_rooms").select("*").eq("report_id", reportId).order("sort_order", { ascending: true }),
      supabaseAdmin.from("inventory_items").select("*").eq("report_id", reportId).order("created_at", { ascending: true }),
      supabaseAdmin.from("inventory_photos").select("*").eq("report_id", reportId).order("created_at", { ascending: true }),
    ]);

    if (roomsErr) return res.status(500).json({ error: `rooms: ${roomsErr.message}` });
    if (itemsErr) return res.status(500).json({ error: `items: ${itemsErr.message}` });

    const safeRooms = (rooms || []) as any[];
    const safeItems = (items || []) as any[];
    const safePhotos = photosErr ? [] : ((photos || []) as any[]);

    // --- lease + property + tenant + landlord
    let lease: any = null;
    let property: any = null;
    let tenant: any = null;
    let landlord: any = null;

    if (report.lease_id) {
      const { data: leaseData, error: leaseErr } = await supabaseAdmin.from("leases").select("*").eq("id", report.lease_id).single();
      if (leaseErr) return res.status(500).json({ error: `lease: ${leaseErr.message}` });
      lease = leaseData;

      if (lease?.property_id) {
        const r = await supabaseAdmin.from("properties").select("*").eq("id", lease.property_id).maybeSingle();
        property = r.data || null;
      }
      if (lease?.tenant_id) {
        const r = await supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).maybeSingle();
        tenant = r.data || null;
      }
    }
    const rLand = await supabaseAdmin.from("landlords").select("*").eq("user_id", userId).maybeSingle();
    landlord = rLand.data || null;

    const landlordName = safeStr(landlord?.display_name) || "Bailleur";
    const tenantName = safeStr(tenant?.full_name) || safeStr(report.occupant_label) || "Occupant";
    const propertyLabel = safeStr(property?.label) || safeStr(report.property_label) || "Logement";
    const propertyAddress =
      [
        safeStr(property?.address_line1) || safeStr(report.property_address_line1),
        safeStr(property?.address_line2) || safeStr(report.property_address_line2),
        [safeStr(property?.postal_code) || safeStr(report.property_postal_code), safeStr(property?.city) || safeStr(report.property_city)].filter(Boolean).join(" "),
        safeStr(property?.country || "FR"),
      ]
        .filter(Boolean)
        .join(", ") || "—";

    const title = String(report.report_type) === "entry" ? "État des lieux d’entrée" : "État des lieux de sortie";
    const subtitleRightTop = `${propertyLabel}`;
    const subtitleRightBottom = `Établi le ${fmtDateTimeFR(report.performed_at)}${safeStr(report.performed_place) ? ` • Lieu : ${safeStr(report.performed_place)}` : ""}`;
    const countersJson = report.counters_json && typeof report.counters_json === "object" ? (report.counters_json as Record<string, any>) : {};
    const counters = [
      ["Compteur électricité", countersJson.electricity],
      ["Compteur eau", countersJson.water],
      ["Compteur gaz", countersJson.gas],
      ["Clés", countersJson.keys],
      ["Badges", countersJson.badges],
      ["Télécommandes", countersJson.remotes],
    ]
      .map(([label, value]) => ({ label: String(label), value: safeStr(value) }))
      .filter((row) => row.value);

    // --- photos map by item_id
    const photosByItem = new Map<string, any[]>();
    for (const p of safePhotos) {
      if (!p?.item_id) continue;
      const arr = photosByItem.get(String(p.item_id)) || [];
      arr.push(p);
      photosByItem.set(String(p.item_id), arr);
    }

    // helper: signed urls for photos
    // (Puppeteer charge mieux via URL que via buffer)
    async function signedPhotoUrl(bucket: string, storagePath: string) {
      try {
        const signed = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, 60 * 10);
        if (signed.error) return null;
        return signed.data?.signedUrl || null;
      } catch {
        return null;
      }
    }

    // --- items by room + categories
    const itemsByRoom = new Map<string, any[]>();
    for (const it of safeItems) {
      const rid = it.room_id ? String(it.room_id) : "__no_room__";
      const arr = itemsByRoom.get(rid) || [];
      arr.push(it);
      itemsByRoom.set(rid, arr);
    }

    function groupByCategory(list: any[]) {
      const byCat = new Map<string, any[]>();
      for (const it of list) {
        const cat = safeStr(it.category || "Autre");
        const arr = byCat.get(cat) || [];
        arr.push(it);
        byCat.set(cat, arr);
      }
      const cats = Array.from(byCat.keys()).sort((a, b) => a.localeCompare(b, "fr"));
      return cats.map((name) => {
        const its = (byCat.get(name) || []).slice().sort((a, b) => safeStr(a.label).localeCompare(safeStr(b.label), "fr"));
        return { name, items: its };
      });
    }

    const enrichedRooms = await Promise.all(
      safeRooms.map(async (r: any) => {
        const rItems = itemsByRoom.get(String(r.id)) || [];
        const categoriesRaw = groupByCategory(rItems);

        const categories = await Promise.all(
          categoriesRaw.map(async (cat) => {
            const items = await Promise.all(
              cat.items.map(async (it: any) => {
                const defects = collectDefects(it);
                const description = safeStr(it.description || "");
                const important =
                  (typeof it.severity === "number" && it.severity >= 3) || String(it.condition) === "mauvais" || Boolean(defects);

                const photos = (photosByItem.get(String(it.id)) || []).slice(0, 3);

                const signedPhotos: Array<{ signedUrl: string; important: boolean }> = [];
                for (const p of photos) {
                  const bucket = safeStr(p.storage_bucket) || "inventory-photos";
                  const storagePath = safeStr(p.storage_path);
                  if (!storagePath) continue;
                  const url = await signedPhotoUrl(bucket, storagePath);
                  if (url) signedPhotos.push({ signedUrl: url, important: important && signedPhotos.length === 0 });
                }

                return {
                  label: safeStr(it.label),
                  condition: safeStr(it.condition),
                  is_clean: it.is_clean,
                  is_functional: it.is_functional,
                  wear_level: it.wear_level,
                  severity: it.severity ?? 0,
                  description,
                  defects,
                  photos: signedPhotos,
                };
              })
            );

            return { name: cat.name, items };
          })
        );

        return {
          id: String(r.id),
          name: safeStr(r.name),
          floor_level: r.floor_level ? safeStr(r.floor_level) : null,
          notes: r.notes ? safeStr(r.notes) : null,
          categories,
        };
      })
    );

    // hors pièce
    const noRoomItems = itemsByRoom.get("__no_room__") || [];
    const noRoomCategoriesRaw = groupByCategory(noRoomItems);
    const noRoomCategories = await Promise.all(
      noRoomCategoriesRaw.map(async (cat) => {
        const items = await Promise.all(
          cat.items.map(async (it: any) => {
            const defects = collectDefects(it);
            const description = safeStr(it.description || "");
            const important =
              (typeof it.severity === "number" && it.severity >= 3) || String(it.condition) === "mauvais" || Boolean(defects);

            const photos = (photosByItem.get(String(it.id)) || []).slice(0, 3);

            const signedPhotos: Array<{ signedUrl: string; important: boolean }> = [];
            for (const p of photos) {
              const bucket = safeStr(p.storage_bucket) || "inventory-photos";
              const storagePath = safeStr(p.storage_path);
              if (!storagePath) continue;
              const url = await signedPhotoUrl(bucket, storagePath);
              if (url) signedPhotos.push({ signedUrl: url, important: important && signedPhotos.length === 0 });
            }

            return {
              label: safeStr(it.label),
              condition: safeStr(it.condition),
              is_clean: it.is_clean,
              is_functional: it.is_functional,
              wear_level: it.wear_level,
              severity: it.severity ?? 0,
              description,
              defects,
              photos: signedPhotos,
            };
          })
        );

        return { name: cat.name, items };
      })
    );

    const logoDataUrl = readLogoDataUrlIfExists();

    const html = buildHtmlPremiumEDL({
      logoDataUrl,
      title,
      subtitleRightTop,
      subtitleRightBottom,

      landlordName,
      tenantName,
      propertyLabel,
      propertyAddress,

      performedAt: fmtDateTimeFR(report.performed_at),
      performedPlace: safeStr(report.performed_place) || "—",
      generalNotes: safeStr(report.general_notes || ""),
      counters,

      rooms: enrichedRooms,
      noRoom: noRoomCategories.length ? [{ categories: noRoomCategories }] : [],
    });

    const pdfBuf = await renderPdfFromHtml(html);

    const datePart = toISODateLocal(new Date());
    const tenantSlug = safeFilePart(tenantName);
    const filename = `etat-des-lieux-${String(report.report_type || "entry")}-${tenantSlug}-${datePart}.pdf`;
    const storagePath = `${userId}/${report.lease_id || "standalone"}/${reportId}/${filename}`;

    const up = await supabaseAdmin.storage.from("inventory-pdfs").upload(storagePath, pdfBuf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) return res.status(500).json({ error: `Upload PDF échoué: ${up.error.message}` });
    invalidateStorageCache(String(userId));

    const pdfUrl = `inventory-pdfs:${storagePath}`;

    const upd = await supabaseAdmin
      .from("inventory_reports")
      .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
      .eq("id", reportId);

    if (upd.error) return res.status(500).json({ error: `Update report échoué: ${upd.error.message}` });

    return res.status(200).json({
      ok: true,
      pdf_url: pdfUrl,
      storage_path: storagePath,
      filename,
    });
  } catch (e: any) {
    console.error("[api/inventory/pdf] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
