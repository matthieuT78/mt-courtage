// pages/api/payments/confirm.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { getLeaseRentPeriodFromDate } from "../../../lib/rentPeriod";
import { removeTrackedPartialPaymentTransactions } from "../../../lib/rentPaymentFinance";

type Json = Record<string, any>;

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, leaseId, periodStart, periodEnd, paidAt } = (req.body || {}) as {
      userId?: string;
      leaseId?: string;
      periodStart?: string;
      periodEnd?: string;
      paidAt?: string; // ISO datetime
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
    const { rent, charges, total } = rentPeriod;
    const normalizedPeriodStart = rentPeriod.periodStart;
    const normalizedPeriodEnd = rentPeriod.periodEnd;

    // upsert payment by (lease_id, period_start, period_end)
    const existing = await supabaseAdmin
      .from("rent_payments")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("period_start", normalizedPeriodStart)
      .eq("period_end", normalizedPeriodEnd)
      .maybeSingle();

    const now = paidAt || new Date().toISOString();

    if (existing.data?.id) {
      const upd = await supabaseAdmin
        .from("rent_payments")
        .update({
          paid_at: now,
          payment_method: lease.payment_method || null,
          source: "manual_confirm",
          rent_amount: rent,
          charges_amount: charges,
          total_amount: total,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id);

      if (upd.error) return res.status(500).json({ error: upd.error.message });
      await removeTrackedPartialPaymentTransactions({
        leaseId,
        periodStart: normalizedPeriodStart,
        periodEnd: normalizedPeriodEnd,
      });
      return res.status(200).json({ ok: true, payment_id: existing.data.id });
    }

    const ins = await supabaseAdmin
      .from("rent_payments")
      .insert({
        lease_id: leaseId,
        period_start: normalizedPeriodStart,
        period_end: normalizedPeriodEnd,
        rent_amount: rent,
        charges_amount: charges,
        total_amount: total,
        due_date: normalizedPeriodStart,
        paid_at: now,
        payment_method: lease.payment_method || null,
        source: "manual_confirm",
      })
      .select("id")
      .single();

    if (ins.error || !ins.data) return res.status(500).json({ error: ins.error?.message || "Insert rent_payments échoué" });
    await removeTrackedPartialPaymentTransactions({
      leaseId,
      periodStart: normalizedPeriodStart,
      periodEnd: normalizedPeriodEnd,
    });
    return res.status(200).json({ ok: true, payment_id: ins.data.id });
  } catch (e: any) {
    console.error("[api/payments/confirm] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
