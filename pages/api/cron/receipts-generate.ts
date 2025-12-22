// pages/api/cron/receipts-generate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import PDFDocument from "pdfkit";

/* ------------------------------------------------------------------ */
/* Utils                                                              */
/* ------------------------------------------------------------------ */

// Construit une Date "Paris" stable, et des helpers calendaires sans UTC drift.
function nowParis() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return {
    date: d,
    hh: d.getHours(),
    yyyy: d.getFullYear(),
    mm: d.getMonth() + 1, // 1..12
    month0: d.getMonth(), // 0..11
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// IMPORTANT: date "calendaire" (YYYY-MM-DD) en LOCAL (pas toISOString)
const toISODateLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toYYYYMMFromDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

// Dernier jour du mois (mois 0..11)
const lastDayOfMonth = (yyyy: number, month0: number) => new Date(yyyy, month0 + 1, 0).getDate();

// Clamp un jour (1..31) au dernier jour réel du mois
const clampDayInMonth = (yyyy: number, month0: number, day1to31: number) => {
  const last = lastDayOfMonth(yyyy, month0);
  return Math.min(Math.max(1, day1to31), last);
};

// Début / fin de mois (calendaire local)
const monthStart = (yyyy: number, month0: number) => new Date(yyyy, month0, 1);
const monthEnd = (yyyy: number, month0: number) => new Date(yyyy, month0 + 1, 0);

// Détermine la période de quittance à traiter au moment du cron, selon payment_type
function periodForCron(nowParisDate: Date, paymentType: string | null | undefined) {
  const y = nowParisDate.getFullYear();
  const m0 = nowParisDate.getMonth();

  // terme_a_echoir => quittance du mois courant
  if ((paymentType || "").toLowerCase() === "terme_a_echoir") {
    return { start: monthStart(y, m0), end: monthEnd(y, m0) };
  }

  // terme_echu (ou null) => quittance du mois précédent
  const prev = new Date(y, m0 - 1, 1);
  return { start: monthStart(prev.getFullYear(), prev.getMonth()), end: monthEnd(prev.getFullYear(), prev.getMonth()) };
}

// Date d'exigibilité du paiement pour une période donnée
function dueDateForPeriod(periodStart: Date, paymentDayRaw: number, paymentType: string | null | undefined) {
  const y = periodStart.getFullYear();
  const m0 = periodStart.getMonth();

  // Clamp sur le mois qui contient la due date
  if ((paymentType || "").toLowerCase() === "terme_a_echoir") {
    const day = clampDayInMonth(y, m0, paymentDayRaw);
    return new Date(y, m0, day);
  }

  // terme_echu => paiement le mois suivant la période
  const next = new Date(y, m0 + 1, 1);
  const day = clampDayInMonth(next.getFullYear(), next.getMonth(), paymentDayRaw);
  return new Date(next.getFullYear(), next.getMonth(), day);
}

function buildPdfBuffer(text: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(14).text("QUITTANCE DE LOYER", { align: "center" });
    doc.moveDown(0.8);
    doc.fontSize(10).text((text || "—").trim());

    doc.moveDown(2);
    doc.fontSize(8).fillColor("#666").text("Document généré par ImmoPilot", { align: "center" });

    doc.end();
  });
}

/* ------------------------------------------------------------------ */
/* Handler                                                            */
/* ------------------------------------------------------------------ */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré" });

    const { date: now, hh } = nowParis();

    /* ---------------- Security & force mode ---------------- */

    const force = String(req.query.force || "") === "1";

    // Recommandé: exiger un secret en prod
    // Ici: comme tu voulais, on le requiert au moins en force
    if (force) {
      const secret = process.env.CRON_SECRET;
      const header = req.headers["x-cron-secret"];
      if (secret && header !== secret) {
        return res.status(401).json({ error: "Unauthorized (cron secret)" });
      }
    }

    // Exécute uniquement à 09:00 Paris si pas force
    if (!force && hh !== 9) {
      return res.status(200).json({ ok: true, skipped: true, reason: "not_9am_paris" });
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
    const debug: any[] = [];

    for (const lease of leases || []) {
      const paymentType = ((lease as any).payment_type as string | null) || "terme_a_echoir";
      const rawPaymentDay = Number((lease as any).payment_day || 1);

      // 1) période cible (selon payment_type)
      const { start: periodStart, end: periodEnd } = periodForCron(now, paymentType);
      const periodStartISO = toISODateLocal(periodStart);
      const periodEndISO = toISODateLocal(periodEnd);
      const yyyyMM = toYYYYMMFromDate(periodStart);

      // 2) due date pour cette période
      const dueDate = dueDateForPeriod(periodStart, rawPaymentDay, paymentType);

      // 3) génération 2 jours après due date
      const generateAt = new Date(dueDate);
      generateAt.setDate(generateAt.getDate() + 2);

      // si pas force: pas encore l'heure de générer
      if (!force && now.getTime() < generateAt.getTime()) {
        skipped++;
        continue;
      }

      /* ---- déjà générée pour la période ? ---- */
      const existing = await supabaseAdmin
        .from("rent_receipts")
        .select("id")
        .eq("lease_id", (lease as any).id)
        .eq("period_start", periodStartISO)
        .eq("period_end", periodEndISO)
        .maybeSingle();

      if (existing.data) {
        skipped++;
        continue;
      }

      /* ---- generate receipt ---- */
      const rent = Number((lease as any).rent_amount || 0);
      const charges = Number((lease as any).charges_amount || 0);
      const total = rent + charges;

      // Template V1 non éditable (simple, clair)
      const contentText = `
Quittance de loyer – ${yyyyMM}

Période : ${periodStartISO} → ${periodEndISO}
Échéance : ${toISODateLocal(dueDate)} (${paymentType === "terme_echu" ? "terme échu" : "terme à échoir"})

Loyer hors charges : ${rent} €
Charges : ${charges} €
Total : ${total} €
      `.trim();

      const { data: receipt, error: insErr } = await supabaseAdmin
        .from("rent_receipts")
        .insert({
          lease_id: (lease as any).id,
          period_start: periodStartISO,
          period_end: periodEndISO,
          rent_amount: rent,
          charges_amount: charges,
          total_amount: total,
          issue_date: toISODateLocal(now), // date Paris “calendaire”
          issued_at: new Date().toISOString(),
          content_text: contentText,
          status: "generated",
          // archived_at est mis après upload pdf
        })
        .select("*")
        .single();

      if (insErr || !receipt) throw insErr;

      /* ---- PDF ---- */
      const pdf = await buildPdfBuffer(contentText);

      const storagePath = `${(lease as any).user_id}/${(lease as any).id}/${(receipt as any).id}/quittance-${yyyyMM}.pdf`;

      const up = await supabaseAdmin.storage.from("rent-receipts-pdfs").upload(storagePath, pdf, {
        contentType: "application/pdf",
        upsert: true,
      });

      if (up.error) throw up.error;

      await supabaseAdmin
        .from("rent_receipts")
        .update({
          pdf_url: `rent-receipts-pdfs:${storagePath}`,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", (receipt as any).id);

      generated++;

      // petit debug utile (tu peux virer)
      debug.push({
        lease_id: (lease as any).id,
        payment_type: paymentType,
        period: `${periodStartISO}→${periodEndISO}`,
        due: toISODateLocal(dueDate),
        generateAt: toISODateLocal(generateAt),
        pdf: `rent-receipts-pdfs:${storagePath}`,
      });
    }

    return res.status(200).json({
      ok: true,
      mode: force ? "force" : "cron",
      generated,
      skipped,
      // utile pour vérifier pendant la mise au point
      debug: force ? debug : undefined,
    });
  } catch (e: any) {
    console.error("[cron/receipts-generate]", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
