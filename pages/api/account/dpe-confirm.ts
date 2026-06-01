import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { getUserStorageUsage } from "../../../lib/storageQuota";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { propertyId, bucket, path, fileName, sizeBytes } = req.body || {};
    if (bucket !== "property-dpe-pdfs" || !String(path || "").startsWith(`${auth.userId}/${propertyId}/`)) return res.status(400).json({ error: "Référence DPE invalide." });
    const bytes = Number(sizeBytes || 0);
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 10 * 1024 * 1024) return res.status(400).json({ error: "Le DPE doit être un PDF de 10 Mo maximum." });
    const { data: property, error: propertyError } = await supabaseAdmin.from("properties").select("id").eq("id", propertyId).eq("user_id", auth.userId).maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) return res.status(403).json({ error: "Ce logement ne vous appartient pas." });
    const usage = await getUserStorageUsage(auth.userId);
    if (usage.usedBytes > usage.quotaBytes) {
      await supabaseAdmin.storage.from(bucket).remove([path]);
      return res.status(409).json({ error: "Quota dépassé : le fichier n’a pas été conservé." });
    }
    const { data, error } = await supabaseAdmin.from("property_dpe_documents").insert({
      user_id: auth.userId, property_id: propertyId, storage_bucket: bucket, storage_path: path, file_name: fileName, size_bytes: bytes,
    }).select("*").single();
    if (error) throw error;
    return res.status(200).json({ ok: true, dpe: data });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Enregistrement impossible." });
  }
}
