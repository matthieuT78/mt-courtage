// pages/api/receipts/confirm.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function isExpired(createdAt: string, days = 7) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return now - created > days * 24 * 60 * 60 * 1000;
}

function baseUrl(req: NextApiRequest) {
  // priorité à env, sinon auto
  const env = process.env.APP_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseAdmin) return res.status(500).send("Supabase admin non configuré.");

    const token = String(req.query.token || "").trim();
    const action = String(req.query.action || "yes").toLowerCase(); // yes | no
    const redirectBase = `${baseUrl(req)}/landlord?tab=quittances`;

    if (!token) return res.redirect(302, `${redirectBase}&result=error&reason=missing_token`);

    // 1) charger token
    const a = await supabaseAdmin
      .from("receipt_actions")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (a.error || !a.data) {
      return res.redirect(302, `${redirectBase}&result=error&reason=invalid_token`);
    }

    const row: any = a.data;

    // 2) expiré / déjà consommé
    if (row.status !== "pending") {
      return res.redirect(302, `${redirectBase}&result=error&reason=already_used`);
    }

    if (isExpired(row.created_at, 7)) {
      await supabaseAdmin
        .from("receipt_actions")
        .update({ status: "expired" })
        .eq("id", row.id);
      return res.redirect(302, `${redirectBase}&result=error&reason=expired`);
    }

    // 3) consommer token (idempotence)
    const consume = await supabaseAdmin
      .from("receipt_actions")
      .update({ status: "consumed", consumed_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending"); // protège contre double clic

    if (consume.error) {
      return res.redirect(302, `${redirectBase}&result=error&reason=consume_failed`);
    }

    // 4) si "no" => on ne génère rien
    if (action === "no") {
      return res.redirect(
        302,
        `${redirectBase}&result=ok&paid=no&lease=${row.lease_id}&month=${String(row.period_start).slice(0, 7)}`
      );
    }

    // 5) action=yes => appeler /api/receipts/send en mode “interne”
    const sendUrl = `${baseUrl(req)}/api/receipts/send`;
    const internalSecret = process.env.INTERNAL_API_SECRET || "";

    const r = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // secret interne pour autoriser l'appel sans session
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({
        userId: row.user_id,
        leaseId: row.lease_id,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        // IMPORTANT : ici on veut que ça mette à jour paiements/finance
        affectFinance: true,
      }),
    });

    const raw = await r.text();
    let json: any = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      // ignore
    }

    if (!r.ok) {
      return res.redirect(
        302,
        `${redirectBase}&result=error&reason=send_failed&msg=${encodeURIComponent(json?.error || raw || "Erreur")}`
      );
    }

    const receiptId = json?.receipt_id || "";
    return res.redirect(
      302,
      `${redirectBase}&result=ok&paid=yes&receipt=${encodeURIComponent(receiptId)}&month=${String(row.period_start).slice(0, 7)}`
    );
  } catch (e: any) {
    console.error("[api/receipts/confirm] error:", e);
    const fallback = `${(process.env.APP_BASE_URL || "").replace(/\/$/, "")}/landlord?tab=quittances&result=error&reason=internal`;
    return res.redirect(302, fallback);
  }
}
