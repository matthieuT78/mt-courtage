// pages/api/receipts/signed-url.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type Json = { ok: boolean; signedUrl?: string; error?: string };

function parsePdfUrl(pdf_url?: string | null) {
  // attendu: "rent-receipts-pdfs:<path>"
  if (!pdf_url) return null;
  const s = String(pdf_url);
  const idx = s.indexOf(":");
  if (idx <= 0) return null;

  const bucket = s.slice(0, idx);
  const path = s.slice(idx + 1);
  if (!bucket || !path) return null;

  return { bucket, path };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

    const { pdf_url, expiresIn } = (req.body || {}) as { pdf_url?: string; expiresIn?: number };
    const parsed = parsePdfUrl(pdf_url);
    if (!parsed) return res.status(400).json({ ok: false, error: "pdf_url invalide." });

    const exp = Number.isFinite(expiresIn) ? Math.max(60, Math.min(60 * 60, Number(expiresIn))) : 60 * 10;

    const signed = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, exp);
    if (signed.error) return res.status(500).json({ ok: false, error: signed.error.message });

    return res.status(200).json({ ok: true, signedUrl: signed.data.signedUrl });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Erreur interne" });
  }
}
