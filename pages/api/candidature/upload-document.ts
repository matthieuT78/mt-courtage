import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: {
    bodyParser: { sizeLimit: "15mb" },
  },
};

const FIELD_TO_PATH_COLUMN: Record<string, string> = {
  docs_identity: "docs_identity_path",
  docs_tax: "docs_tax_path",
  docs_address: "docs_address_path",
  docs_payslip_1: "docs_payslip_1_path",
  docs_payslip_2: "docs_payslip_2_path",
  docs_payslip_3: "docs_payslip_3_path",
  guarantor_docs_identity: "guarantor_docs_identity_path",
  guarantor_docs_tax: "guarantor_docs_tax_path",
  guarantor_docs_payslip_1: "guarantor_docs_payslip_1_path",
  guarantor_docs_payslip_2: "guarantor_docs_payslip_2_path",
  guarantor_docs_payslip_3: "guarantor_docs_payslip_3_path",
};

const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_BYTES = 10 * 1024 * 1024;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const { candidature_token, field, filename, contentType, fileBase64 } = req.body || {};

  if (!candidature_token || typeof candidature_token !== "string") {
    return res.status(400).json({ error: "candidature_token requis." });
  }
  if (!field || !FIELD_TO_PATH_COLUMN[field]) {
    return res.status(400).json({ error: "Type de document invalide." });
  }
  if (!fileBase64 || typeof fileBase64 !== "string") {
    return res.status(400).json({ error: "Fichier requis." });
  }
  const ext = ALLOWED_MIME[String(contentType || "")];
  if (!ext) {
    return res.status(400).json({ error: "Format non accepté (PDF, JPEG, PNG ou WEBP uniquement)." });
  }

  const { data: candidature, error: candidatureError } = await supabaseAdmin
    .from("candidatures")
    .select("id, listing_id, status")
    .eq("token", candidature_token)
    .maybeSingle();
  if (candidatureError) return res.status(500).json({ error: candidatureError.message });
  if (!candidature) return res.status(404).json({ error: "Dossier introuvable." });
  if (candidature.status !== "draft") {
    return res.status(409).json({ error: "Ce dossier a déjà été soumis, impossible de modifier les pièces jointes." });
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from("rental_listings")
    .select("id, user_id")
    .eq("id", candidature.listing_id)
    .maybeSingle();
  if (listingError) return res.status(500).json({ error: listingError.message });
  if (!listing) return res.status(404).json({ error: "Annonce introuvable." });

  let buffer: Buffer;
  try {
    buffer = Buffer.from(fileBase64, "base64");
  } catch {
    return res.status(400).json({ error: "Fichier invalide." });
  }
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return res.status(400).json({ error: "Le fichier doit faire moins de 10 Mo." });
  }

  const storagePath = `${listing.user_id}/${listing.id}/${candidature.id}/${field}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("candidature-documents")
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const pathColumn = FIELD_TO_PATH_COLUMN[field];
  const updatePayload: Record<string, any> = {
    [pathColumn]: storagePath,
    [field]: true,
    updated_at: new Date().toISOString(),
  };
  if (field.startsWith("docs_payslip_")) {
    updatePayload.docs_payslips = true;
  }
  if (field.startsWith("guarantor_docs_payslip_")) {
    updatePayload.guarantor_docs_payslips = true;
  }

  const { error: updateError } = await supabaseAdmin
    .from("candidatures")
    .update(updatePayload)
    .eq("id", candidature.id);
  if (updateError) return res.status(500).json({ error: updateError.message });

  return res.status(200).json({ ok: true, path: storagePath });
}
