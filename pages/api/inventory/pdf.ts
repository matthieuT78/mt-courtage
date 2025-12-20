import type { NextApiRequest, NextApiResponse } from "next";
import PDFDocument from "pdfkit";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type Json = Record<string, any>;

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const fmtDateTimeFR = (iso?: string | null) => {
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
};

const safeText = (s: any) => (s == null ? "" : String(s));

function conditionLabel(c: string) {
  switch (c) {
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

function ynIcon(v: any) {
  if (v === true) return "✅";
  if (v === false) return "❌";
  return "—";
}

function collectDefects(item: any) {
  const tags = Array.isArray(item?.defect_tags) ? item.defect_tags : [];
  return tags.length ? tags.join(", ") : "";
}

function buildPdfBuffer(build: (doc: PDFKit.PDFDocument) => Promise<void>) {
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 46,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      await build(doc);

      // Pagination footer
      const range = doc.bufferedPageRange(); // { start, count }
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        const pageNumber = i - range.start + 1;
        const total = range.count;

        doc.font("Helvetica").fontSize(9).fillColor("#6b7280");
        doc.text(
          `Page ${pageNumber} / ${total}`,
          doc.page.margins.left,
          doc.page.height - doc.page.margins.bottom + 16,
          {
            align: "center",
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          }
        );
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 120) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 20) doc.addPage();
}

function drawHeaderBand(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  const x = doc.page.margins.left;
  const y = doc.page.margins.top - 20;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.save();
  doc.rect(x, y, w, 60).fill("#0f172a"); // slate-900
  doc.restore();

  doc.fillColor("#ffffff");
  doc.font("Helvetica-Bold").fontSize(18).text(title, x + 16, y + 12, { width: w - 32 });
  doc.font("Helvetica").fontSize(10).text(subtitle, x + 16, y + 38, { width: w - 32 });

  doc.moveDown(2);
  doc.fillColor("#111111");
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 60);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111").text(title);
  doc.moveDown(0.2);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#e5e7eb")
    .stroke();
  doc.moveDown(0.7);
}

function drawKeyValueRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111").text(label, x, doc.y, { width: 120 });
  doc.font("Helvetica").fontSize(10).fillColor("#111").text(value || "—", x + 125, doc.y, { width: w - 125 });
  doc.moveDown(0.25);
}

// Table (par catégorie)
function drawCategoryBand(doc: PDFKit.PDFDocument, category: string) {
  ensureSpace(doc, 40);
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.save();
  doc.rect(x, doc.y, w, 18).fill("#f1f5f9"); // slate-100
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111");
  doc.text(category || "—", x + 8, doc.y + 4, { width: w - 16 });

  doc.moveDown(1.2);
}

function drawTableHeader(doc: PDFKit.PDFDocument) {
  const x = doc.page.margins.left;
  const y = doc.y;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.save();
  doc.rect(x, y, w, 18).fill("#ffffff");
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111");
  doc.text("Élément", x + 6, y + 5, { width: 170 });
  doc.text("État", x + 182, y + 5, { width: 70 });
  doc.text("Propre", x + 258, y + 5, { width: 50 });
  doc.text("Fonct.", x + 312, y + 5, { width: 50 });
  doc.text("Observations", x + 366, y + 5, { width: w - 366 });

  doc.moveDown(1.0);
  doc.moveTo(x, doc.y).lineTo(x + w, doc.y).strokeColor("#e5e7eb").stroke();
  doc.moveDown(0.2);
}

function drawRow(
  doc: PDFKit.PDFDocument,
  row: { label: string; cond: string; clean: string; func: string; desc: string; defects: string },
  stripe: boolean
) {
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const startY = doc.y;

  const obsText =
    row.defects && row.desc
      ? `${row.desc}\nDéfauts : ${row.defects}`
      : row.defects
      ? `Défauts : ${row.defects}`
      : row.desc || "—";

  const obsHeight = doc.heightOfString(obsText, { width: w - 366 });
  const rowH = Math.max(18, Math.min(140, obsHeight + 10));

  ensureSpace(doc, rowH + 18);

  if (stripe) {
    doc.save();
    doc.rect(x, startY, w, rowH).fill("#fcfcfd");
    doc.restore();
  }

  doc.font("Helvetica").fontSize(9).fillColor("#111");
  doc.text(row.label || "—", x + 6, startY + 4, { width: 170 });
  doc.text(row.cond || "—", x + 182, startY + 4, { width: 70 });
  doc.text(row.clean || "—", x + 258, startY + 4, { width: 50 });
  doc.text(row.func || "—", x + 312, startY + 4, { width: 50 });

  // Observations avec "Défauts" mis en valeur
  if (row.defects) {
    const main = row.desc ? `${row.desc}\n` : "";
    doc.fillColor("#111").text(main, x + 366, startY + 4, { width: w - 366 });

    doc.fillColor("#b91c1c"); // red-700
    doc.text(`Défauts : ${row.defects}`, x + 366, startY + 4 + doc.heightOfString(main || "", { width: w - 366 }), {
      width: w - 366,
    });
    doc.fillColor("#111");
  } else {
    doc.fillColor("#111").text(obsText, x + 366, startY + 4, { width: w - 366 });
  }

  doc.y = startY + rowH;
  doc.moveTo(x, doc.y).lineTo(x + w, doc.y).strokeColor("#f1f5f9").stroke();
  doc.moveDown(0.2);
}

async function drawPhotos(
  doc: PDFKit.PDFDocument,
  supabase: NonNullable<typeof supabaseAdmin>,
  photos: any[],
  mode: "hero" | "thumbs"
) {
  if (!photos.length) return;

  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (mode === "hero") {
    // 1 photo large (max 1)
    const p = photos[0];
    const bucket = p.storage_bucket || "inventory-photos";
    const path = p.storage_path;
    if (!path) return;

    ensureSpace(doc, 260);

    try {
      const { data: imgData } = await supabase.storage.from(bucket).download(path);
      if (!imgData) return;

      const buf = Buffer.from(await imgData.arrayBuffer());

      const top = doc.y + 6;
      const h = 220;

      doc.save();
      doc.rect(x, top, w, h).strokeColor("#e5e7eb").stroke();
      doc.image(buf, x + 6, top + 6, { fit: [w - 12, h - 12] });
      doc.restore();

      doc.y = top + h + 10;
    } catch {
      // ignore
    }
    return;
  }

  // thumbs (max 3)
  const list = photos.slice(0, 3);
  ensureSpace(doc, 120);

  const startY = doc.y + 6;
  let cx = x;

  for (const p of list) {
    const bucket = p.storage_bucket || "inventory-photos";
    const path = p.storage_path;
    if (!path) continue;

    try {
      const { data: imgData } = await supabase.storage.from(bucket).download(path);
      if (!imgData) continue;
      const buf = Buffer.from(await imgData.arrayBuffer());

      doc.save();
      doc.rect(cx, startY, 120, 86).strokeColor("#e5e7eb").stroke();
      doc.image(buf, cx + 4, startY + 4, { fit: [112, 78] });
      doc.restore();

      cx += 130;
    } catch {
      // ignore
    }
  }

  doc.y = startY + 96;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré (env manquantes)." });

    const { reportId, userId } = (req.body || {}) as { reportId?: string; userId?: string };
    if (!reportId || !userId) return res.status(400).json({ error: "reportId et userId requis." });

    // Report + ownership
    const { data: report, error: repErr } = await supabaseAdmin
      .from("inventory_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (repErr || !report) return res.status(404).json({ error: "Report introuvable." });
    if (report.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });

    // Rooms/items/photos + bail/property/tenant/landlord
    const [{ data: rooms, error: roomsErr }, { data: items, error: itemsErr }, { data: photos, error: photosErr }] =
      await Promise.all([
        supabaseAdmin.from("inventory_rooms").select("*").eq("report_id", reportId).order("sort_order", { ascending: true }),
        supabaseAdmin.from("inventory_items").select("*").eq("report_id", reportId).order("created_at", { ascending: true }),
        supabaseAdmin.from("inventory_photos").select("*").eq("report_id", reportId).order("created_at", { ascending: true }),
      ]);

    if (roomsErr) return res.status(500).json({ error: `rooms: ${roomsErr.message}` });
    if (itemsErr) return res.status(500).json({ error: `items: ${itemsErr.message}` });

    const safePhotos = photosErr ? [] : (photos || []);

    const { data: lease } = await supabaseAdmin.from("leases").select("*").eq("id", report.lease_id).single();

    let property: any = null;
    let tenant: any = null;
    let landlord: any = null;

    if (lease?.property_id) {
      const r = await supabaseAdmin.from("properties").select("*").eq("id", lease.property_id).single();
      property = r.data || null;
    }
    if (lease?.tenant_id) {
      const r = await supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).single();
      tenant = r.data || null;
    }
    const rLand = await supabaseAdmin.from("landlords").select("*").eq("user_id", userId).single();
    landlord = rLand.data || null;

    // Photos by item
    const photosByItem = new Map<string, any[]>();
    for (const p of safePhotos as any[]) {
      if (!p?.item_id) continue;
      const arr = photosByItem.get(p.item_id) || [];
      arr.push(p);
      photosByItem.set(p.item_id, arr);
    }

    const title = report.report_type === "entry" ? "ÉTAT DES LIEUX D’ENTRÉE" : "ÉTAT DES LIEUX DE SORTIE";

    const landlordName = landlord?.display_name || "Bailleur";
    const tenantName = tenant?.full_name || "Locataire";
    const propLabel = property?.label || "Bien";
    const propAddr = [
      property?.address_line1,
      property?.address_line2,
      [property?.postal_code, property?.city].filter(Boolean).join(" "),
      property?.country,
    ]
      .filter(Boolean)
      .join(", ");

    // Stats + regroupements
    const roomList = (rooms || []) as any[];
    const itemList = (items || []) as any[];

    const itemsByRoom = new Map<string, any[]>();
    for (const it of itemList) {
      const rid = it.room_id || "__no_room__";
      const arr = itemsByRoom.get(rid) || [];
      arr.push(it);
      itemsByRoom.set(rid, arr);
    }

    const roomsOk = roomList.filter((r) => (itemsByRoom.get(r.id) || []).length > 0).length;
    const completeness = roomList.length ? Math.round((roomsOk / roomList.length) * 100) : 0;

    // Sommaire (page calculée au moment du rendu)
    type TocEntry = { name: string; count: number; page: number };
    const toc: TocEntry[] = [];

    const pdf = await buildPdfBuffer(async (doc) => {
      let pageNum = 1;

      const addPage = () => {
        doc.addPage();
        pageNum += 1;
      };

      // ==============
      // PAGE DE GARDE
      // ==============
      drawHeaderBand(doc, title, `ImmoPilot — Document généré le ${new Date().toLocaleDateString("fr-FR")}`);

      drawSectionTitle(doc, "Résumé");
      drawKeyValueRow(doc, "Bailleur", landlordName);
      drawKeyValueRow(doc, "Locataire", tenantName);
      drawKeyValueRow(doc, "Bien", `${propLabel}${propAddr ? " — " + propAddr : ""}`);
      drawKeyValueRow(doc, "Date & heure", fmtDateTimeFR(report.performed_at));
      drawKeyValueRow(doc, "Lieu", safeText(report.performed_place) || "—");

      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#111").text("Indicateurs");
      doc.font("Helvetica").fontSize(10).fillColor("#111");
      doc.text(`• Nombre de pièces : ${roomList.length}`);
      doc.text(`• Nombre d’éléments : ${itemList.length}`);
      doc.text(`• Complétude : ${completeness}%`);

      if (report.general_notes) {
        doc.moveDown(0.5);
        doc.font("Helvetica-Bold").fontSize(11).text("Notes générales");
        doc.font("Helvetica").fontSize(10).fillColor("#111").text(safeText(report.general_notes));
      }

      // =========
      // SOMMAIRE
      // =========
      addPage();

      drawHeaderBand(doc, "SOMMAIRE", "Pièces & pagination");

      // (On remplit après avoir calculé toc entries lors du rendu des pièces)
      const tocPageIndex = pageNum;
      drawSectionTitle(doc, "Pièces");

      doc.font("Helvetica").fontSize(10).fillColor("#111");
      doc.text("Le détail commence à la page suivante.", { align: "left" });
      doc.moveDown(0.8);

      // placeholder bloc
      const tocStartY = doc.y;

      // ==================
      // DÉTAIL PAR PIÈCES
      // ==================
      addPage();

      // Une page par pièce → sommaire fiable + rendu “pro”
      for (let i = 0; i < roomList.length; i++) {
        const room = roomList[i];
        if (i > 0) addPage();

        const rItems = itemsByRoom.get(room.id) || [];
        toc.push({ name: `${room.name}${room.floor_level ? " — " + room.floor_level : ""}`, count: rItems.length, page: pageNum });

        drawHeaderBand(doc, "DÉTAIL", `${room.name}${room.floor_level ? " — " + room.floor_level : ""}`);

        if (room.notes) {
          doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`Notes : ${room.notes}`);
          doc.moveDown(0.4);
        }

        if (!rItems.length) {
          doc.font("Helvetica").fontSize(11).fillColor("#6b7280").text("Aucun élément renseigné pour cette pièce.");
          continue;
        }

        // Group by category
        const byCat = new Map<string, any[]>();
        for (const it of rItems) {
          const cat = safeText(it.category || "Autre");
          const arr = byCat.get(cat) || [];
          arr.push(it);
          byCat.set(cat, arr);
        }

        // tri catégories (alpha)
        const cats = Array.from(byCat.keys()).sort((a, b) => a.localeCompare(b, "fr"));

        for (const cat of cats) {
          ensureSpace(doc, 120);
          drawCategoryBand(doc, cat);
          drawTableHeader(doc);

          const list = byCat.get(cat) || [];
          // tri léger (label)
          list.sort((a, b) => safeText(a.label).localeCompare(safeText(b.label), "fr"));

          let stripe = false;
          for (const it of list) {
            const defects = collectDefects(it);
            const desc = safeText(it.description);
            const important =
              (typeof it.severity === "number" && it.severity >= 3) ||
              it.condition === "mauvais" ||
              Boolean(defects);

            drawRow(
              doc,
              {
                label: safeText(it.label),
                cond: conditionLabel(it.condition),
                clean: ynIcon(it.is_clean),
                func: ynIcon(it.is_functional),
                desc,
                defects,
              },
              stripe
            );
            stripe = !stripe;

            // Photos : “hero” si important, sinon thumbs
            const pList = (photosByItem.get(it.id) || []).slice(0, important ? 1 : 3);
            if (pList.length) {
              await drawPhotos(doc, supabaseAdmin, pList, important ? "hero" : "thumbs");
              doc.moveDown(0.2);
            }
          }

          doc.moveDown(0.6);
        }
      }

      // ==================
      // HORS PIÈCE (option)
      // ==================
      const noRoomItems = itemsByRoom.get("__no_room__") || [];
      if (noRoomItems.length) {
        addPage();
        drawHeaderBand(doc, "DÉTAIL", "Éléments hors pièce");
        toc.push({ name: "Éléments hors pièce", count: noRoomItems.length, page: pageNum });

        // group by category
        const byCat = new Map<string, any[]>();
        for (const it of noRoomItems) {
          const cat = safeText(it.category || "Autre");
          const arr = byCat.get(cat) || [];
          arr.push(it);
          byCat.set(cat, arr);
        }
        const cats = Array.from(byCat.keys()).sort((a, b) => a.localeCompare(b, "fr"));

        for (const cat of cats) {
          drawCategoryBand(doc, cat);
          drawTableHeader(doc);

          const list = byCat.get(cat) || [];
          list.sort((a, b) => safeText(a.label).localeCompare(safeText(b.label), "fr"));

          let stripe = false;
          for (const it of list) {
            const defects = collectDefects(it);
            const desc = safeText(it.description);
            const important =
              (typeof it.severity === "number" && it.severity >= 3) ||
              it.condition === "mauvais" ||
              Boolean(defects);

            drawRow(
              doc,
              {
                label: safeText(it.label),
                cond: conditionLabel(it.condition),
                clean: ynIcon(it.is_clean),
                func: ynIcon(it.is_functional),
                desc,
                defects,
              },
              stripe
            );
            stripe = !stripe;

            const pList = (photosByItem.get(it.id) || []).slice(0, important ? 1 : 3);
            if (pList.length) {
              await drawPhotos(doc, supabaseAdmin, pList, important ? "hero" : "thumbs");
              doc.moveDown(0.2);
            }
          }

          doc.moveDown(0.6);
        }
      }

      // ==========
      // SIGNATURES
      // ==========
      addPage();
      drawHeaderBand(doc, "SIGNATURES", "À signer par les parties");

      drawSectionTitle(doc, "Bailleur");
      doc.font("Helvetica").fontSize(10).fillColor("#111").text("Nom : " + landlordName);
      doc.moveDown(0.4);
      doc.rect(doc.page.margins.left, doc.y, 240, 90).strokeColor("#e5e7eb").stroke();
      doc.moveDown(6);

      drawSectionTitle(doc, "Locataire");
      doc.font("Helvetica").fontSize(10).fillColor("#111").text("Nom : " + tenantName);
      doc.moveDown(0.4);
      doc.rect(doc.page.margins.left, doc.y, 240, 90).strokeColor("#e5e7eb").stroke();

      // ==========
      // REMPLIR LE SOMMAIRE (on revient à la page sommaire)
      // ==========
      // bufferPages = true → on peut ré-écrire sur page sommaire
      // On repasse sur la page 2 (sommaire)
      const range = doc.bufferedPageRange();
      // tocPageIndex est un numéro “humain”, on le convertit en index buffer
      const tocBufferIndex = range.start + (tocPageIndex - 1);

      doc.switchToPage(tocBufferIndex);
      // reposition au bon endroit
      doc.y = tocStartY;

      // rendu sommaire
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111").text("Pièce", doc.page.margins.left, doc.y, { width: 360 });
      doc.text("Éléments", doc.page.margins.left + 370, doc.y, { width: 70, align: "right" });
      doc.text("Page", doc.page.margins.left + 450, doc.y, { width: 80, align: "right" });
      doc.moveDown(0.3);
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor("#e5e7eb")
        .stroke();
      doc.moveDown(0.4);

      doc.font("Helvetica").fontSize(10).fillColor("#111");
      for (const entry of toc) {
        ensureSpace(doc, 22);
        doc.text(entry.name, doc.page.margins.left, doc.y, { width: 360 });
        doc.text(String(entry.count), doc.page.margins.left + 370, doc.y, { width: 70, align: "right" });
        doc.text(String(entry.page), doc.page.margins.left + 450, doc.y, { width: 80, align: "right" });
        doc.moveDown(0.25);
      }
    });

    // Upload to Storage
    const filename = `etat-des-lieux-${report.report_type}-${toISODate(new Date())}.pdf`;
    const storagePath = `${userId}/${report.lease_id}/${reportId}/${filename}`;

    const { error: upErr } = await supabaseAdmin.storage.from("inventory-pdfs").upload(storagePath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (upErr) return res.status(500).json({ error: `Upload PDF échoué: ${upErr.message}` });

    // Update report
    const pdfUrl = `inventory-pdfs:${storagePath}`;
    const { error: updErr } = await supabaseAdmin
      .from("inventory_reports")
      .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
      .eq("id", reportId);

    if (updErr) return res.status(500).json({ error: `Update report échoué: ${updErr.message}` });

    return res.status(200).json({ ok: true, pdf_url: pdfUrl, storage_path: storagePath });
  } catch (e: any) {
    console.error("[api/inventory/pdf] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
