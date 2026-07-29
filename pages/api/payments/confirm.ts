// pages/api/payments/confirm.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { getLeaseRentPeriodFromDate } from "../../../lib/rentPeriod";
import { removeTrackedPartialPaymentTransactions, syncDelegatedRentTransaction } from "../../../lib/rentPaymentFinance";
import { getLeasePaymentDueDate } from "../../../lib/rentSchedule";

type Json = Record<string, any>;

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, leaseId, periodStart, periodEnd, paidAt, overrideRent, overrideCharges, paymentMethodOverride } = (req.body || {}) as {
      userId?: string;
      leaseId?: string;
      periodStart?: string;
      periodEnd?: string;
      paidAt?: string;
      overrideRent?: number;
      overrideCharges?: number;
      paymentMethodOverride?: string;
    };

    if (!userId) return res.status(400).json({ error: "userId requis." });
    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!leaseId || !periodStart || !periodEnd) return res.status(400).json({ error: "leaseId + periodStart + periodEnd requis." });

    // lease
    const leaseRes = await supabaseAdmin.from("leases").select("*").eq("id", leaseId).single();
    if (leaseRes.error || !leaseRes.data) return res.status(404).json({ error: "Bail introuvable." });
    const lease: any = leaseRes.data;
    if (lease.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });

    const rentPeriod = getLeaseRentPeriodFromDate(lease, periodStart);
    if (!rentPeriod) return res.status(400).json({ error: "Cette période est en dehors des dates du bail." });
    const rent = overrideRent !== undefined ? Number(overrideRent) : rentPeriod.rent;
    const charges = overrideCharges !== undefined ? Number(overrideCharges) : rentPeriod.charges;
    const total = rent + charges;
    const normalizedPeriodStart = rentPeriod.periodStart;
    const normalizedPeriodEnd = rentPeriod.periodEnd;
    const periodKey = normalizedPeriodStart.slice(0, 7);
    const dueDate = getLeasePaymentDueDate(lease, periodKey)?.toISOString().slice(0, 10) || normalizedPeriodStart;

    // upsert payment by (lease_id, period_start, period_end)
    const existing = await supabaseAdmin
      .from("rent_payments")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("period_start", normalizedPeriodStart)
      .eq("period_end", normalizedPeriodEnd)
      .maybeSingle();

    const now = paidAt || new Date().toISOString();
    let paymentId: string;

    if (existing.data?.id) {
      const upd = await supabaseAdmin
        .from("rent_payments")
        .update({
          paid_at: now,
          payment_method: paymentMethodOverride || lease.payment_method || null,
          source: "manual_confirm",
          rent_amount: rent,
          charges_amount: charges,
          total_amount: total,
          due_date: dueDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id);

      if (upd.error) return res.status(500).json({ error: upd.error.message });
      paymentId = existing.data.id;
    } else {
      const ins = await supabaseAdmin
        .from("rent_payments")
        .insert({
          lease_id: leaseId,
          period_start: normalizedPeriodStart,
          period_end: normalizedPeriodEnd,
          rent_amount: rent,
          charges_amount: charges,
          total_amount: total,
          due_date: dueDate,
          paid_at: now,
          payment_method: lease.payment_method || null,
          source: "manual_confirm",
        })
        .select("id")
        .single();

      if (ins.error || !ins.data) return res.status(500).json({ error: ins.error?.message || "Insert rent_payments échoué" });
      paymentId = ins.data.id;
    }

    await removeTrackedPartialPaymentTransactions({
      leaseId,
      periodStart: normalizedPeriodStart,
      periodEnd: normalizedPeriodEnd,
    });

    // Quittances déléguées à une agence : aucune quittance/PDF lokt n'est générée,
    // donc pas de sync Finance possible via rent_receipts. On écrit directement
    // la ligne Finance ici pour que le paiement reste visible dans la section Finance.
    if (lease.receipts_disabled) {
      await syncDelegatedRentTransaction({
        userId,
        propertyId: lease.property_id ?? null,
        leaseId,
        periodStart: normalizedPeriodStart,
        periodEnd: normalizedPeriodEnd,
        amount: total,
      });
    }

    return res.status(200).json({ ok: true, payment_id: paymentId });
  } catch (e: any) {
    console.error("[api/payments/confirm] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
