import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { userCanUseReceiptAutomation } from "../../../lib/serverPermissions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const userId = String(req.method === "GET" ? req.query.userId || "" : req.body?.userId || "");
    const userCheck = requireMatchingUser(auth, userId);
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!(await userCanUseReceiptAutomation(userId))) {
      return res.status(403).json({ error: "Les relances locataire sont réservées aux abonnements Starter et Essentiel." });
    }

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin.from("tenant_payment_reminder_settings").select("*").eq("user_id", userId);
      if (error) throw error;
      return res.status(200).json({ settings: data || [] });
    }

    const leaseId = String(req.body?.leaseId || "");
    const defaultChannel = String(req.body?.defaultChannel || "both");
    const autoEnabled = req.body?.autoEnabled === true;
    if (!leaseId) return res.status(400).json({ error: "leaseId requis." });
    if (!["email", "messaging", "both"].includes(defaultChannel)) return res.status(400).json({ error: "Canal invalide." });
    const { data: lease } = await supabaseAdmin.from("leases").select("id,user_id").eq("id", leaseId).maybeSingle();
    if (!lease || String(lease.user_id) !== userId) return res.status(403).json({ error: "Accès refusé." });

    const { data, error } = await supabaseAdmin
      .from("tenant_payment_reminder_settings")
      .upsert({
        lease_id: leaseId,
        user_id: userId,
        auto_enabled: autoEnabled,
        auto_delay_days: 3,
        default_channel: defaultChannel,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return res.status(200).json({ ok: true, setting: data });
  } catch (error: any) {
    console.error("[api/payments/reminder-settings] error:", error);
    return res.status(500).json({ error: error?.message || "Erreur interne" });
  }
}
