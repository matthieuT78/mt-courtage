import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { data: dpe } = await supabaseAdmin.from("property_dpe_documents").select("*").eq("id", String(req.query.id || "")).eq("user_id", auth.userId).maybeSingle();
    if (!dpe) return res.status(404).json({ error: "DPE introuvable." });
    const { data, error } = await supabaseAdmin.storage.from(dpe.storage_bucket).createSignedUrl(dpe.storage_path, 600);
    if (error || !data?.signedUrl) throw error || new Error("Ouverture impossible.");
    return res.status(200).json({ signedUrl: data.signedUrl });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Ouverture impossible." });
  }
}
