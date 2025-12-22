import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import PDFDocument from "pdfkit";

/* ------------------------------------------------------------------ */
/* Utils                                                              */
/* ------------------------------------------------------------------ */

function nowParis() {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  return {
    date: d,
    hh: d.getHours(),
    yyyyMM: d.toISOString().slice(0, 7),
  };
}

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

function buildPdfBuffer(text: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(14).text("QUITTANCE DE LOYER", { align: "center" });
    doc.moveDown(1);
    doc.fontSize(10).text(text || "—");

    doc.end();
  });
}

/* ------------------------------------------------------------------ */
/* Handler                                                            */
/* ------------------------------------------------------------------ */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase admin non configuré" });
    }

    const { date, hh, yyyyMM } = nowParis();

    /* ---------------- Security & force mode ---------------- */

    const force = String(req.query.force || "") === "1";

    if (force) {
      const secret = process.env.CRON_SECRET;
      const header = req.headers["x-cron-secret"];

      if (secret && header !== secret) {
        return res.status(401).json({ error: "Unauthorized (cron secret)" });
      }
    }

    if (!force && hh !== 9) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "not_9am_paris",
      });
    }

    /* ---------------- Load eligible leases ---------------- */

    const { data: leases, error: leasesErr } = await supabaseAdmin
      .from("leases")
      .select("*")
      .eq("status", "active")
      .eq("auto_quittance_enabled", true);

    if (leasesErr) throw leasesErr;

    let generated = 0;
    let skipped = 0;

    for (const lease of leases || []) {
      const paymentDay = Number(lease.payment_day || 1);

      // date théorique du paiement pour le mois courant
      const dueDate = new Date(date.getFullYear(), date.getMonth(), paymentDay);
      const generateAt = new Date(dueDate);
      generateAt.setDate(generateAt.getDate() + 2);

      if (!force && date < generateAt) {
        skipped++;
        continue;
      }

      const periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      /* ---- déjà générée ? ---- */
      const existing = await supabaseAdmin
        .from("rent_receipts")
        .select("id")
        .eq("lease_id", lease.id)
        .eq("period_start", toISODate(periodStart))
        .eq("period_end", toISODate(periodEnd))
        .maybeSingle();

      if (existing.data) {
        skipped++;
        continue;
      }

      /* ---- generate receipt ---- */
      const rent = Number(lease.rent_amount || 0);
      const charges = Number(lease.charges_amount || 0);
      const total = rent + charges;

      const contentText = `
Quittance de loyer – ${yyyyMM}

Loyer hors charges : ${rent} €
Charges : ${charges} €
Total : ${total} €

Période : ${toISODate(periodStart)} → ${toISODate(periodEnd)}
      `.trim();

      const { data: receipt, error: insErr } = await supabaseAdmin
        .from("rent_receipts")
        .insert({
          lease_id: lease.id,
          period_start: toISODate(periodStart),
          period_end: toISODate(periodEnd),
          rent_amount: rent,
          charges_amount: charges,
          total_amount: total,
          issue_date: toISODate(date),
          issued_at: new Date().toISOString(),
          content_text: contentText,
          status: "generated",
        })
        .select("*")
        .single();

      if (insErr || !receipt) throw insErr;

      /* ---- PDF ---- */
      const pdf = await buildPdfBuffer(contentText);

      const storagePath = `${lease.user_id}/${lease.id}/${receipt.id}/quittance-${yyyyMM}.pdf`;

      const up = await supabaseAdmin.storage
        .from("rent-receipts-pdfs")
        .upload(storagePath, pdf, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (up.error) throw up.error;

      await supabaseAdmin
        .from("rent_receipts")
        .update({
          pdf_url: `rent-receipts-pdfs:${storagePath}`,
          archived_at: new Date().toISOString(),
        })
        .eq("id", receipt.id);

      generated++;
    }

    return res.status(200).json({
      ok: true,
      mode: force ? "force" : "cron",
      generated,
      skipped,
    });
  } catch (e: any) {
    console.error("[cron/receipts-generate]", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
