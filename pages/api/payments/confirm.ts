// pages/api/payments/confirm.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type Json = Record<string, any>;

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const { userId, leaseId, periodStart, periodEnd, paidAt } = (req.body || {}) as {
      userId?: string;
      leaseId?: string;
      periodStart?: string;
      periodEnd?: string;
      paidAt?: string; // ISO datetime
    };

    if (!userId) return res.status(400).json({ error: "userId requis." });
    if (!leaseId || !periodStart || !periodEnd) return res.status(400).json({ error: "leaseId + periodStart + periodEnd requis." });

    // lease
    const leaseRes = await supabaseAdmin.from("leases").select("*").eq("id", leaseId).single();
    if (leaseRes.error || !leaseRes.data) return res.status(404).json({ error: "Bail introuvable." });
    const lease: any = leaseRes.data;
    if (lease.user_id !== userId) return res.status(403).json({ error: "Accès refusé." });

    const rent = Number(lease.rent_amount || 0);
    const charges = Number(lease.charges_amount || 0);
    const total = rent + charges;

    // upsert payment by (lease_id, period_start, period_end)
    const existing = await supabaseAdmin
      .from("rent_payments")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
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
      return res.status(200).json({ ok: true, payment_id: existing.data.id });
    }

    const ins = await supabaseAdmin
      .from("rent_payments")
      .insert({
        lease_id: leaseId,
        period_start: periodStart,
        period_end: periodEnd,
        rent_amount: rent,
        charges_amount: charges,
        total_amount: total,
        due_date: periodStart,
        paid_at: now,
        payment_method: lease.payment_method || null,
        source: "manual_confirm",
      })
      .select("id")
      .single();

    if (ins.error || !ins.data) return res.status(500).json({ error: ins.error?.message || "Insert rent_payments échoué" });
    return res.status(200).json({ ok: true, payment_id: ins.data.id });
  } catch (e: any) {
    console.error("[api/payments/confirm] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
