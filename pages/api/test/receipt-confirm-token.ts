import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function getBaseUrl(req: NextApiRequest) {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const origin = String(req.headers.origin || "");
  if (origin) return origin.replace(/\/$/, "");

  const host = String(req.headers.host || "");
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  return host ? `${proto}://${host}` : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configure." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, leaseId, periodStart, periodEnd } = req.body || {};
    if (!userId || !leaseId || !periodStart || !periodEnd) {
      return res.status(400).json({ error: "userId, leaseId, periodStart et periodEnd sont requis." });
    }

    const match = requireMatchingUser(auth, String(userId));
    if (!match.ok) return res.status(match.status).json({ error: match.error });

    const lease = await supabaseAdmin
      .from("leases")
      .select("id,user_id")
      .eq("id", String(leaseId))
      .eq("user_id", String(userId))
      .maybeSingle();

    if (lease.error) throw lease.error;
    if (!lease.data) return res.status(404).json({ error: "Bail introuvable pour cet utilisateur." });

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const inserted = await supabaseAdmin
      .from("receipt_confirm_tokens")
      .insert({
        token,
        user_id: String(userId),
        lease_id: String(leaseId),
        period_start: String(periodStart),
        period_end: String(periodEnd),
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (inserted.error) throw inserted.error;

    const baseUrl = getBaseUrl(req);
    const confirmPath = `/api/receipts/confirm-paid?token=${encodeURIComponent(token)}`;

    return res.status(200).json({
      ok: true,
      token_id: inserted.data.id,
      token,
      confirmUrl: baseUrl ? `${baseUrl}${confirmPath}` : confirmPath,
      expires_at: expiresAt,
      lease_id: String(leaseId),
      period_start: String(periodStart),
      period_end: String(periodEnd),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Erreur creation lien de confirmation." });
  }
}
