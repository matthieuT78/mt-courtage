import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { getUserStorageUsage } from "../../../lib/storageQuota";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const [{ data: properties, error: propertiesError }, { data: dpes, error: dpesError }, usage] = await Promise.all([
      supabaseAdmin.from("properties").select("id,label,address_line1,postal_code,city").eq("user_id", auth.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("property_dpe_documents").select("*").eq("user_id", auth.userId).order("created_at", { ascending: false }),
      getUserStorageUsage(auth.userId),
    ]);
    if (propertiesError) throw propertiesError;
    if (dpesError) throw dpesError;
    return res.status(200).json({ ...usage, properties: properties || [], dpes: dpes || [] });
  } catch (error: any) {
    console.error("[api/account/storage] error:", error);
    return res.status(500).json({ error: error?.message || "Chargement impossible." });
  }
}
