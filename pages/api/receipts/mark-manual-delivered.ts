// pages/api/receipts/mark-manual-delivered.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, receiptId } = (req.body || {}) as { userId?: string; receiptId?: string };
    if (!userId) return res.status(400).json({ error: "userId requis." });
    if (!receiptId) return res.status(400).json({ error: "receiptId requis." });

    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

    const receiptRes = await supabaseAdmin.from("rent_receipts").select("*").eq("id", receiptId).single();
    if (receiptRes.error || !receiptRes.data) return res.status(404).json({ error: "Quittance introuvable." });
    const receipt: any = receiptRes.data;

    const leaseRes = await supabaseAdmin.from("leases").select("id,user_id").eq("id", receipt.lease_id).single();
    if (leaseRes.error || !leaseRes.data) return res.status(404).json({ error: "Bail introuvable." });
    if ((leaseRes.data as any).user_id !== userId) return res.status(403).json({ error: "Accès refusé." });

    if (!receipt.pdf_url) {
      return res.status(400).json({ error: "Génère d’abord le PDF avant de clôturer la quittance manuellement." });
    }

    const now = new Date().toISOString();
    const upd = await supabaseAdmin
      .from("rent_receipts")
      .update({
        sent_at: now,
        status: "sent",
        send_error: null,
      })
      .eq("id", receipt.id)
      .select("id,status,sent_at")
      .single();

    if (upd.error || !upd.data) return res.status(500).json({ error: upd.error?.message || "Update quittance échoué." });

    return res.status(200).json({ ok: true, receipt_id: receipt.id, status: "sent", sent_at: now });
  } catch (e: any) {
    console.error("[api/receipts/mark-manual-delivered] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
