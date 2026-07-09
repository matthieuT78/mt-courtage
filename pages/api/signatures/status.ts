import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const { token } = req.query as { token: string };
  if (!token) return res.status(400).json({ error: "Token manquant." });

  const { data, error } = await supabaseAdmin
    .from("signature_requests")
    .select("id, document_type, document_label, status, landlord_email, landlord_name, landlord_signed_at, tenant_email, tenant_name, tenant_signed_at, expires_at, landlord_token, tenant_token")
    .or(`landlord_token.eq.${token},tenant_token.eq.${token}`)
    .single();

  if (error || !data) return res.status(404).json({ error: "Demande introuvable." });

  const isLandlord = data.landlord_token === token;
  const role = isLandlord ? "bailleur" : "locataire";
  const alreadySigned = isLandlord ? !!data.landlord_signed_at : !!data.tenant_signed_at;
  const expired = new Date(data.expires_at) < new Date();

  return res.status(200).json({
    id: data.id,
    document_label: data.document_label,
    document_type: data.document_type,
    status: data.status,
    role,
    alreadySigned,
    expired,
    landlord_name: data.landlord_name,
    landlord_email: data.landlord_email,
    landlord_signed: !!data.landlord_signed_at,
    tenant_name: data.tenant_name,
    tenant_email: data.tenant_email,
    tenant_signed: !!data.tenant_signed_at,
    expires_at: data.expires_at,
  });
}
