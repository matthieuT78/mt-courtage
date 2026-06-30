import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { getLeaseRentPeriod } from "../../../lib/rentPeriod";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const userId = String(req.query.userId || "");
  const leaseId = String(req.query.leaseId || "");

  const userCheck = requireMatchingUser(auth, userId);
  if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
  if (!leaseId) return res.status(400).json({ error: "leaseId requis." });

  const { data: lease, error: leaseErr } = await supabaseAdmin
    .from("leases")
    .select("*")
    .eq("id", leaseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (leaseErr || !lease) return res.status(404).json({ error: "Bail introuvable." });

  const startDate = String(lease.start_date || "").slice(0, 10);
  const endDate = String(lease.end_date || "").slice(0, 10);
  if (!startDate) return res.status(200).json({ months: [] });

  const [payments, receipts] = await Promise.all([
    supabaseAdmin.from("rent_payments").select("*").eq("lease_id", leaseId),
    supabaseAdmin.from("rent_receipts").select("id, period_start, period_end, status").eq("lease_id", leaseId),
  ]);

  // Index by yyyymm (most recent payment wins for partial cases)
  const payByMonth = new Map<string, any>();
  for (const p of payments.data || []) {
    const yyyymm = String(p.period_start || "").slice(0, 7);
    if (!yyyymm) continue;
    const cur = payByMonth.get(yyyymm);
    if (!cur || String(p.updated_at || p.created_at || "") > String(cur.updated_at || cur.created_at || "")) {
      payByMonth.set(yyyymm, p);
    }
  }

  const receiptByMonth = new Map<string, any>();
  for (const r of receipts.data || []) {
    const yyyymm = String(r.period_start || "").slice(0, 7);
    if (!yyyymm) continue;
    const existing = receiptByMonth.get(yyyymm);
    // closed_by_deposit always wins — a single receipt with this status skips the whole month
    const rStatus = String(r?.status || "").toLowerCase();
    const existingStatus = String(existing?.status || "").toLowerCase();
    if (!existing || (rStatus === "closed_by_deposit" && existingStatus !== "closed_by_deposit")) {
      receiptByMonth.set(yyyymm, r);
    }
  }

  // Iterate all months in the lease period
  const start = new Date(startDate + "T00:00:00");
  const end = endDate ? new Date(endDate + "T00:00:00") : new Date();
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  const months: any[] = [];

  while (cur <= endMonth) {
    const yyyymm = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    const period = getLeaseRentPeriod(lease, yyyymm);
    if (!period) { cur.setMonth(cur.getMonth() + 1); continue; }

    const expectedTotal = Number(period.total || 0);
    if (expectedTotal <= 0) { cur.setMonth(cur.getMonth() + 1); continue; }

    const receipt = receiptByMonth.get(yyyymm);
    // Skip months already resolved via deposit compensation
    if (receipt && String(receipt.status || "") === "closed_by_deposit") {
      cur.setMonth(cur.getMonth() + 1);
      continue;
    }

    const payment = payByMonth.get(yyyymm);
    const isPaid = payment && (String(payment.status || "") === "paid" || payment.confirmed_at || payment.paid_at);
    const receivedTotal = isPaid ? Number(payment?.total_amount || 0) : 0;
    const missingAmount = Math.max(0, expectedTotal - receivedTotal);

    if (missingAmount > 0.01) {
      const label = cur.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      months.push({
        yyyymm,
        period_start: period.periodStart,
        period_end: period.periodEnd,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        expected_rent: Number(period.rent || 0),
        expected_charges: Number(period.charges || 0),
        expected_total: expectedTotal,
        received_total: receivedTotal,
        missing_amount: missingAmount,
        receipt_id: receipt?.id || null,
      });
    }

    cur.setMonth(cur.getMonth() + 1);
  }

  return res.status(200).json({ months });
}
