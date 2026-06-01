import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { contractPdfPath, externalContractPdfPath, LEASE_CONTRACT_BUCKET } from "../../../lib/leaseContract";
import { getUserStorageUsage } from "../../../lib/storageQuota";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { userId, documentId, uploadType = "signed", sizeBytes } = req.body || {};
    const userCheck = requireMatchingUser(auth, String(userId || ""));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    const { data: document } = await supabaseAdmin.from("lease_contract_documents").select("id,user_id,lease_id").eq("id", documentId).eq("user_id", userId).maybeSingle();
    if (!document) return res.status(404).json({ error: "Contrat introuvable." });
    if (!["signed", "external"].includes(String(uploadType))) return res.status(400).json({ error: "Type d’import invalide." });
    const bytes = Number(sizeBytes || 0);
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "Le bail doit être un PDF de 10 Mo maximum." });
    }
    const usage = await getUserStorageUsage(String(userId));
    if (usage.usedBytes + bytes > usage.quotaBytes) {
      return res.status(409).json({ error: "Espace de stockage insuffisant. Supprime un document ou augmente ton offre." });
    }
    const path =
      uploadType === "external"
        ? externalContractPdfPath(String(userId), document.lease_id, document.id)
        : contractPdfPath(String(userId), document.lease_id, document.id, true);
    const { data, error } = await supabaseAdmin.storage.from(LEASE_CONTRACT_BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error || !data) throw error || new Error("Import impossible.");
    return res.status(200).json({ bucket: LEASE_CONTRACT_BUCKET, path, token: data.token });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Import impossible." });
  }
}
