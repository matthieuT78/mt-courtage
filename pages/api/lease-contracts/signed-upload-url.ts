import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { contractPdfPath, LEASE_CONTRACT_BUCKET } from "../../../lib/leaseContract";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { userId, documentId } = req.body || {};
    const userCheck = requireMatchingUser(auth, String(userId || ""));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    const { data: document } = await supabaseAdmin.from("lease_contract_documents").select("id,user_id,lease_id").eq("id", documentId).eq("user_id", userId).maybeSingle();
    if (!document) return res.status(404).json({ error: "Contrat introuvable." });
    const path = contractPdfPath(String(userId), document.lease_id, document.id, true);
    const { data, error } = await supabaseAdmin.storage.from(LEASE_CONTRACT_BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error || !data) throw error || new Error("Import impossible.");
    return res.status(200).json({ bucket: LEASE_CONTRACT_BUCKET, path, token: data.token });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Import impossible." });
  }
}
