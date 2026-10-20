// pages/api/tools/send-water-recap-email.ts
//
// Envoie à UN occupant la répartition de sa facture d'eau calculée dans
// l'outil "Facturation eau" (Boîte à outils) — jamais groupé avec les
// autres occupants du même immeuble (cf. correctif sur la fuite de
// consommation/montant entre locataires).
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { buildWaterAllocationRecapEmail } from "../../../lib/emails/waterAllocationRecap";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, allocationId, readingId, preview } = (req.body || {}) as Record<string, any>;
    const userCheck = requireMatchingUser(auth, String(userId || ""));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!allocationId || !readingId) return res.status(400).json({ error: "allocationId et readingId requis." });

    const [{ data: allocation }, { data: reading }] = await Promise.all([
      supabaseAdmin.from("water_allocations").select("*").eq("id", allocationId).eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("water_allocation_readings").select("*").eq("id", readingId).eq("user_id", userId).maybeSingle(),
    ]);
    if (!allocation) return res.status(404).json({ error: "Répartition d'eau introuvable." });
    if (!reading || reading.allocation_id !== allocationId) return res.status(404).json({ error: "Relevé introuvable." });
    if (!reading.occupant_email) return res.status(409).json({ error: "Cet occupant n'a pas d'adresse email renseignée." });

    const propertyLabel = [allocation.address_line1, allocation.city].filter(Boolean).join(", ") || allocation.scope_label || allocation.title;
    const tenantFirstName = String(reading.occupant_label || "").split(" ")[0] || "";
    const globalConsumption = Number(allocation.global_consumption || 0);
    const variableTotal = Math.max(0, Number(allocation.invoice_total_amount || 0) - Number(allocation.fixed_charge_amount || 0));
    const unitPrice = globalConsumption > 0 ? variableTotal / globalConsumption : 0;

    const built = buildWaterAllocationRecapEmail({
      tenantFirstName,
      propertyLabel,
      unitLabel: reading.unit_label,
      periodStart: String(allocation.period_start || ""),
      periodEnd: String(allocation.period_end || ""),
      previousReading: Number(reading.previous_reading || 0),
      currentReading: Number(reading.current_reading || 0),
      consumption: Number(reading.consumption || 0),
      globalConsumption,
      unitPrice,
      variableAmountDue: Number(reading.variable_amount_due || 0),
      fixedAmountDue: Number(reading.fixed_amount_due || 0),
      amountDue: Number(reading.amount_due || 0),
    });

    if (preview) {
      return res.status(200).json({ ok: true, preview: true, subject: built.subject, html: built.html, to: reading.occupant_email });
    }

    const mail = await sendEmailViaResend({ to: reading.occupant_email, subject: built.subject, html: built.html });
    if (!mail.ok) return res.status(500).json({ error: mail.error || "Envoi impossible." });

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[api/tools/send-water-recap-email] error:", error);
    return res.status(500).json({ error: error?.message || "Envoi impossible." });
  }
}
