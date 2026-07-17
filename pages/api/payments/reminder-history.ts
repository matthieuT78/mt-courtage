import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { userCanUseReceiptAutomation } from "../../../lib/serverPermissions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const userId = String(req.query.userId || "");
    const userCheck = requireMatchingUser(auth, userId);
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!(await userCanUseReceiptAutomation(userId))) {
      return res.status(200).json({ ok: true, sends: [] });
    }

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 24);

    const { data, error } = await supabaseAdmin
      .from("tenant_payment_reminder_sends")
      .select("id,lease_id,period_start,period_end,sent_at,channels,trigger_type,status")
      .eq("user_id", userId)
      .gte("sent_at", cutoff.toISOString())
      .order("sent_at", { ascending: false });
    if (error) throw error;

    return res.status(200).json({ ok: true, sends: data || [] });
  } catch (error: any) {
    console.error("[api/payments/reminder-history] error:", error);
    return res.status(500).json({ error: error?.message || "Erreur interne" });
  }
}
