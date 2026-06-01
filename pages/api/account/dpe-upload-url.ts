import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { requireApiUser } from "../../../lib/apiAuth";
import { getUserStorageUsage } from "../../../lib/storageQuota";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const bucket = "property-dpe-pdfs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const propertyId = String(req.body?.propertyId || "");
    const fileName = String(req.body?.fileName || "dpe.pdf").slice(0, 180);
    const sizeBytes = Number(req.body?.sizeBytes || 0);
    if (!propertyId) return res.status(400).json({ error: "Choisis un logement." });
    if (!sizeBytes || sizeBytes > 10 * 1024 * 1024) return res.status(400).json({ error: "Le PDF DPE doit peser au maximum 10 Mo." });
    const { data: property } = await supabaseAdmin.from("properties").select("id").eq("id", propertyId).eq("user_id", auth.userId).maybeSingle();
    if (!property) return res.status(403).json({ error: "Logement introuvable." });
    const usage = await getUserStorageUsage(auth.userId);
    if (usage.usedBytes + sizeBytes > usage.quotaBytes) return res.status(409).json({ error: "Espace de stockage insuffisant. Supprime un document ou augmente ton offre." });
    const path = `${auth.userId}/${propertyId}/${crypto.randomUUID()}.pdf`;
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) throw error || new Error("Import impossible.");
    return res.status(200).json({ bucket, path, token: data.token, fileName, sizeBytes });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Import impossible." });
  }
}
