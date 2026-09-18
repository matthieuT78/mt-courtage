import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { parseStoredLeaseContractUrl } from "../../../lib/leaseContract";
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
    const { data: document } = await supabaseAdmin.from("lease_contract_documents").select("*").eq("id", String(req.query.documentId || "")).eq("user_id", userId).maybeSingle();
    if (!document) return res.status(404).json({ error: "Contrat introuvable." });

    // Ouverture d'une ancienne version archivée (bail modifié puis re-signé) :
    // on ne fait confiance qu'à une URL réellement listée dans les versions
    // archivées de CE document, jamais à une URL arbitraire fournie par le client.
    const archivedUrl = req.query.archivedUrl ? String(req.query.archivedUrl) : null;
    if (archivedUrl) {
      const known = Array.isArray(document.previous_signed_versions)
        ? document.previous_signed_versions.some((v: any) => v?.url === archivedUrl)
        : false;
      if (!known) return res.status(403).json({ error: "Version archivée introuvable pour ce contrat." });
      const parsedArchived = parseStoredLeaseContractUrl(archivedUrl);
      if (!parsedArchived) return res.status(409).json({ error: "PDF indisponible." });
      const { data: signedArchived, error: archivedErr } = await supabaseAdmin.storage.from(parsedArchived.bucket).createSignedUrl(parsedArchived.path, 600);
      if (archivedErr || !signedArchived?.signedUrl) throw archivedErr || new Error("Ouverture impossible.");
      return res.status(200).json({ signedUrl: signedArchived.signedUrl, signed: true });
    }

    const parsed = parseStoredLeaseContractUrl(document.signed_pdf_url || document.external_pdf_url || document.pdf_url);
    if (!parsed) return res.status(409).json({ error: "PDF indisponible." });
    const { data, error } = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 600);
    if (error || !data?.signedUrl) throw error || new Error("Ouverture impossible.");
    return res.status(200).json({ signedUrl: data.signedUrl, signed: !!document.signed_pdf_url });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Ouverture impossible." });
  }
}
