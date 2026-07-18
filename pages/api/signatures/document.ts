import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const { token } = req.query as { token: string };
  if (!token) return res.status(400).json({ error: "Token manquant." });

  const { data, error } = await supabaseAdmin
    .from("signature_requests")
    .select("original_pdf_url, signed_pdf_url, expires_at, status")
    .or(`landlord_token.eq.${token},tenant_token.eq.${token}`)
    .single();

  if (error || !data) return res.status(404).json({ error: "Demande introuvable." });
  if (data.status === "cancelled" || data.status === "expired") return res.status(410).json({ error: "Ce lien n'est plus valide." });
  if (new Date(data.expires_at) < new Date()) return res.status(410).json({ error: "Lien expiré." });

  const sourceUrl = data.status === "completed" && data.signed_pdf_url ? data.signed_pdf_url : data.original_pdf_url;
  const [bucket, ...pathParts] = sourceUrl.split(":");
  const storagePath = pathParts.join(":");

  const { data: signedUrlData, error: urlErr } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 30); // 30 min

  if (urlErr || !signedUrlData?.signedUrl) {
    return res.status(500).json({ error: "Impossible de générer l'URL du document." });
  }

  return res.status(200).json({ url: signedUrlData.signedUrl });
}
