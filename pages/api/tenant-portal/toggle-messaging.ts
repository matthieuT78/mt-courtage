import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const tenantId = String(req.body?.tenantId || "");
    const messagingEnabled = req.body?.messagingEnabled;
    if (!tenantId) return res.status(400).json({ error: "tenantId requis." });
    if (typeof messagingEnabled !== "boolean") return res.status(400).json({ error: "messagingEnabled (boolean) requis." });

    const { data, error } = await supabaseAdmin
      .from("tenant_portal_access")
      .update({ messaging_enabled: messagingEnabled, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("landlord_user_id", auth.userId)
      .in("status", ["invited", "active"])
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Aucun accès portail trouvé pour ce locataire." });

    return res.status(200).json({ ok: true, access: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Modification impossible." });
  }
}
