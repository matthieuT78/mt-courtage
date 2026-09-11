// pages/api/landlord/assistant/document-upload-url.ts
//
// URL d'upload signée pour un document que l'utilisateur importe depuis la
// fenêtre de chat de Loky (ex. un bail déjà rédigé par une agence), en vue
// d'une extraction par l'outil extract_lease_document. Contrairement à
// /api/lease-contracts/signed-upload-url (qui suppose un lease_id déjà
// existant), ce document n'est rattaché à aucun bail pour l'instant : il est
// stocké dans un emplacement de transit ({userId}/loky-imports/{uuid}.pdf,
// même bucket que les contrats de bail) tant que Loky n'a pas créé le bail
// correspondant.
import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { requireApiUser } from "../../../../lib/apiAuth";
import { LEASE_CONTRACT_BUCKET } from "../../../../lib/leaseContract";
import { getUserStorageUsage } from "../../../../lib/storageQuota";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { sizeBytes } = (req.body || {}) as { sizeBytes?: number };
    const bytes = Number(sizeBytes || 0);
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "Le document doit être un PDF de 10 Mo maximum." });
    }
    const usage = await getUserStorageUsage(auth.userId);
    if (usage.usedBytes + bytes > usage.quotaBytes) {
      return res.status(409).json({ error: "Espace de stockage insuffisant. Supprime un document ou augmente ton offre." });
    }

    const documentId = randomUUID();
    const path = `${auth.userId}/loky-imports/${documentId}.pdf`;
    const { data, error } = await supabaseAdmin.storage.from(LEASE_CONTRACT_BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error || !data) throw error || new Error("Import impossible.");
    return res.status(200).json({ bucket: LEASE_CONTRACT_BUCKET, path, signedUrl: data.signedUrl });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Import impossible." });
  }
}
