// pages/api/receipts/signed-url.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser } from "../../../lib/apiAuth";

type Json = { ok: boolean; signedUrl?: string; error?: string };

const BUCKET = "rent-receipts-pdfs";

function parsePdfUrlStrict(pdf_url?: string | null): { bucket: string; path: string } | null {
  // attendu strict: "rent-receipts-pdfs:<path>"
  if (!pdf_url) return null;

  const s = String(pdf_url).trim();
  const idx = s.indexOf(":");
  if (idx <= 0) return null;

  const bucket = s.slice(0, idx).trim();
  let path = s.slice(idx + 1).trim();

  if (!bucket || !path) return null;
  if (bucket !== BUCKET) return null;

  // normalise: pas de slash au début, pas de querystring
  path = path.replace(/^\/+/, "");
  path = path.split("?")[0].split("#")[0].trim();

  if (!path) return null;

  return { bucket, path };
}

function clampExpiresIn(raw: unknown): number {
  const n = Number(raw);
  // 60s min, 1h max, défaut 10 min
  if (!Number.isFinite(n)) return 60 * 10;
  return Math.max(60, Math.min(60 * 60, Math.round(n)));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });
    }
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

    const { receiptId, pdf_url, expiresIn } = (req.body || {}) as { receiptId?: string; pdf_url?: string; expiresIn?: number };

    if (!receiptId) {
      return res.status(400).json({ ok: false, error: "receiptId requis." });
    }

    const receiptRes = await supabaseAdmin.from("rent_receipts").select("id,lease_id,pdf_url").eq("id", receiptId).single();
    if (receiptRes.error || !receiptRes.data) {
      return res.status(404).json({ ok: false, error: "Quittance introuvable." });
    }

    const leaseRes = await supabaseAdmin.from("leases").select("user_id").eq("id", receiptRes.data.lease_id).single();
    if (leaseRes.error || !leaseRes.data) {
      return res.status(404).json({ ok: false, error: "Bail introuvable." });
    }
    if (String(leaseRes.data.user_id) !== auth.userId) {
      return res.status(403).json({ ok: false, error: "Accès refusé." });
    }

    const storedPdfUrl = String(receiptRes.data.pdf_url || "");
    if (pdf_url && pdf_url !== storedPdfUrl) {
      return res.status(400).json({ ok: false, error: "pdf_url ne correspond pas à la quittance." });
    }

    const parsed = parsePdfUrlStrict(storedPdfUrl);
    if (!parsed) {
      return res.status(400).json({
        ok: false,
        error: `pdf_url invalide (attendu ${BUCKET}:<path>).`,
      });
    }

    const exp = clampExpiresIn(expiresIn);

    const signed = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, exp);
    if (signed.error || !signed.data?.signedUrl) {
      return res.status(500).json({ ok: false, error: signed.error?.message || "Signed URL échoué." });
    }

    return res.status(200).json({ ok: true, signedUrl: signed.data.signedUrl });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Erreur interne" });
  }
}
