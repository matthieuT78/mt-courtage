import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";

const safeStr = (v: any) => String(v ?? "").trim();
const safeNum = (v: any) => { const n = parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : null; };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { action, userId, leaseId, paid_at, paid_amount, returned_at, returned_amount, retained_amount, retained_reason } = req.body || {};

    const userCheck = requireMatchingUser(auth, safeStr(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

    if (!leaseId) return res.status(400).json({ error: "leaseId requis." });

    const { data: lease, error: leaseErr } = await supabaseAdmin
      .from("leases").select("*").eq("id", leaseId).eq("user_id", userId).maybeSingle();
    if (leaseErr || !lease) return res.status(404).json({ error: "Bail introuvable." });

    // ── collect ────────────────────────────────────────────────────────────────
    if (action === "collect") {
      const amount = safeNum(paid_amount) ?? Number(lease.deposit_amount ?? 0);
      if (!paid_at) return res.status(400).json({ error: "Date d'encaissement requise." });
      if (!(amount > 0)) return res.status(400).json({ error: "Montant d'encaissement requis." });

      const { data: tx, error: txErr } = await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        property_id: lease.property_id ?? null,
        lease_id: leaseId,
        receipt_id: null,
        occurred_at: safeStr(paid_at),
        direction: "in",
        status: "received",
        category: "deposit_collected",
        label: "Caution reçue",
        amount,
        notes: "[lokt:deposit]",
        updated_at: new Date().toISOString(),
      }).select("id").single();
      if (txErr || !tx) return res.status(500).json({ error: `Écriture Finance échouée : ${txErr?.message}` });

      const { data: updated, error: updErr } = await supabaseAdmin.from("leases").update({
        deposit_paid_at: safeStr(paid_at),
        deposit_paid_amount: amount,
        deposit_collection_tx_id: tx.id,
        updated_at: new Date().toISOString(),
      }).eq("id", leaseId).eq("user_id", userId).select("*").single();
      if (updErr) return res.status(500).json({ error: updErr.message });
      return res.status(200).json({ ok: true, lease: updated });
    }

    // ── return ─────────────────────────────────────────────────────────────────
    if (action === "return") {
      if (!returned_at) return res.status(400).json({ error: "Date de restitution requise." });

      // Structured decompte items (from new UI)
      const imputedMonths: Array<{ period_start: string; period_end: string; amount: number }> =
        Array.isArray(req.body.imputed_months) ? req.body.imputed_months : [];
      const damageItems: Array<{ label: string; amount: number }> =
        Array.isArray(req.body.damage_items) ? req.body.damage_items : [];

      // Auto-calculate retained_amount from items if provided, otherwise fall back to explicit value
      const imputedTotal = imputedMonths.reduce((s, m) => s + (safeNum(m.amount) ?? 0), 0);
      const damageTotal = damageItems.reduce((s, d) => s + (safeNum(d.amount) ?? 0), 0);
      const hasItems = imputedTotal + damageTotal > 0;
      const retainAmt = hasItems ? Math.round((imputedTotal + damageTotal) * 100) / 100 : (safeNum(retained_amount) ?? 0);
      const retAmt = safeNum(returned_amount) ?? 0;

      if (retAmt < 0 || retainAmt < 0) return res.status(400).json({ error: "Les montants ne peuvent pas être négatifs." });
      if (retAmt === 0 && retainAmt === 0) return res.status(400).json({ error: "Au moins un montant (restitué ou retenu) est requis." });

      // Build a human-readable retained_reason from items
      let reasonLabel = safeStr(retained_reason) || null;
      if (hasItems) {
        const parts: string[] = [];
        if (imputedMonths.length) parts.push(`Loyers/charges : ${imputedMonths.map((m) => `${m.period_start.slice(0, 7)} (${safeNum(m.amount) ?? 0} €)`).join(", ")}`);
        if (damageItems.length) parts.push(`Dommages : ${damageItems.map((d) => `${d.label} (${safeNum(d.amount) ?? 0} €)`).join(", ")}`);
        reasonLabel = parts.join(" — ").slice(0, 500);
      }

      const patch: Record<string, any> = {
        deposit_returned_at: safeStr(returned_at),
        deposit_returned_amount: retAmt,
        deposit_retained_amount: retainAmt,
        deposit_retained_reason: reasonLabel,
        updated_at: new Date().toISOString(),
      };

      if (retAmt > 0) {
        const { data: txRet, error: txRetErr } = await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          property_id: lease.property_id ?? null,
          lease_id: leaseId,
          receipt_id: null,
          occurred_at: safeStr(returned_at),
          direction: "out",
          status: "paid",
          category: "deposit_returned",
          label: "Caution restituée",
          amount: retAmt,
          notes: "[lokt:deposit]",
          updated_at: new Date().toISOString(),
        }).select("id").single();
        if (txRetErr || !txRet) return res.status(500).json({ error: `Écriture Finance (restitution) échouée : ${txRetErr?.message}` });
        patch.deposit_return_tx_id = txRet.id;
      }

      if (retainAmt > 0) {
        const retainLabel = reasonLabel ? `Retenue : ${reasonLabel.slice(0, 80)}` : "Retenue sur caution";
        const { data: txRetain, error: txRetainErr } = await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          property_id: lease.property_id ?? null,
          lease_id: leaseId,
          receipt_id: null,
          occurred_at: safeStr(returned_at),
          direction: "in",
          status: "received",
          category: "deposit_retained",
          label: retainLabel,
          amount: retainAmt,
          notes: "[lokt:deposit]",
          updated_at: new Date().toISOString(),
        }).select("id").single();
        if (txRetainErr || !txRetain) return res.status(500).json({ error: `Écriture Finance (retenue) échouée : ${txRetainErr?.message}` });
        patch.deposit_retain_tx_id = txRetain.id;
      }

      // Close imputed months in rent_receipts (status = "closed_by_deposit")
      for (const month of imputedMonths) {
        if (!month.period_start) continue;
        const yyyymm = String(month.period_start).slice(0, 7);
        const { data: existing } = await supabaseAdmin
          .from("rent_receipts")
          .select("id, status")
          .eq("lease_id", leaseId)
          .eq("period_start", safeStr(month.period_start))
          .gte("period_end", `${yyyymm}-01`)
          .lte("period_end", `${yyyymm}-31`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          await supabaseAdmin
            .from("rent_receipts")
            .update({ status: "closed_by_deposit", pdf_url: null, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabaseAdmin.from("rent_receipts").insert({
            lease_id: leaseId,
            owner_user_id: userId,
            period_start: safeStr(month.period_start),
            period_end: safeStr(month.period_end),
            rent_amount: 0,
            charges_amount: 0,
            total_amount: 0,
            issue_date: safeStr(returned_at),
            issued_at: new Date().toISOString(),
            content_text: "Compensé par retenue sur dépôt de garantie",
            status: "closed_by_deposit",
            created_at: new Date().toISOString(),
          });
        }
      }

      const { data: updated, error: updErr } = await supabaseAdmin.from("leases").update(patch).eq("id", leaseId).eq("user_id", userId).select("*").single();
      if (updErr) return res.status(500).json({ error: updErr.message });
      return res.status(200).json({ ok: true, lease: updated });
    }

    // ── cancel_collect ─────────────────────────────────────────────────────────
    if (action === "cancel_collect") {
      if (lease.deposit_collection_tx_id) {
        await supabaseAdmin.from("transactions").delete().eq("id", lease.deposit_collection_tx_id).eq("user_id", userId);
      }
      const { data: updated, error: updErr } = await supabaseAdmin.from("leases").update({
        deposit_paid_at: null,
        deposit_paid_amount: null,
        deposit_collection_tx_id: null,
        updated_at: new Date().toISOString(),
      }).eq("id", leaseId).eq("user_id", userId).select("*").single();
      if (updErr) return res.status(500).json({ error: updErr.message });
      return res.status(200).json({ ok: true, lease: updated });
    }

    // ── cancel_return ──────────────────────────────────────────────────────────
    if (action === "cancel_return") {
      const idsToDelete = [lease.deposit_return_tx_id, lease.deposit_retain_tx_id].filter(Boolean) as string[];
      if (idsToDelete.length) {
        await supabaseAdmin.from("transactions").delete().in("id", idsToDelete).eq("user_id", userId);
      }
      const { data: updated, error: updErr } = await supabaseAdmin.from("leases").update({
        deposit_returned_at: null,
        deposit_returned_amount: null,
        deposit_retained_amount: null,
        deposit_retained_reason: null,
        deposit_return_tx_id: null,
        deposit_retain_tx_id: null,
        updated_at: new Date().toISOString(),
      }).eq("id", leaseId).eq("user_id", userId).select("*").single();
      if (updErr) return res.status(500).json({ error: updErr.message });
      return res.status(200).json({ ok: true, lease: updated });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e: any) {
    console.error("[api/deposits] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
