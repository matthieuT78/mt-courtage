import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const FIELD_TO_PATH_COLUMN: Record<string, string> = {
  docs_identity: "docs_identity_path",
  docs_tax: "docs_tax_path",
  docs_address: "docs_address_path",
  docs_payslip_1: "docs_payslip_1_path",
  docs_payslip_2: "docs_payslip_2_path",
  docs_payslip_3: "docs_payslip_3_path",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { candidatureId, field } = req.body || {};
  if (!candidatureId || !field || !FIELD_TO_PATH_COLUMN[field]) {
    return res.status(400).json({ error: "Paramètres invalides." });
  }

  const { data: candidature, error: candidatureError } = await supabaseAdmin
    .from("candidatures")
    .select(`id, listing_id, ${FIELD_TO_PATH_COLUMN[field]}`)
    .eq("id", candidatureId)
    .maybeSingle();
  if (candidatureError) return res.status(500).json({ error: candidatureError.message });
  if (!candidature) return res.status(404).json({ error: "Dossier introuvable." });

  const storagePath = (candidature as any)[FIELD_TO_PATH_COLUMN[field]];
  if (!storagePath) return res.status(404).json({ error: "Document non fourni par le candidat." });

  // La location du fichier commence toujours par le user_id du propriétaire de
  // l'annonce (voir upload-document.ts) — vérifier que l'appelant est bien ce
  // propriétaire avant d'émettre l'URL signée, sans avoir besoin de recharger
  // l'annonce séparément.
  if (!storagePath.startsWith(`${auth.userId}/`)) {
    return res.status(403).json({ error: "Accès refusé." });
  }

  const { data, error: signedError } = await supabaseAdmin.storage
    .from("candidature-documents")
    .createSignedUrl(storagePath, 60 * 10);
  if (signedError || !data?.signedUrl) {
    return res.status(500).json({ error: signedError?.message || "Ouverture du document impossible." });
  }

  return res.status(200).json({ signedUrl: data.signedUrl });
}
