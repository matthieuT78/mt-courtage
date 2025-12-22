// pages/api/receipts/confirm.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function isExpired(createdAt: string, days = 7) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return now - created > days * 24 * 60 * 60 * 1000;
}

function baseUrl(req: NextApiRequest) {
  const env = process.env.APP_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  return `${proto}://${host}`;
}

function enc(v: any) {
  return encodeURIComponent(String(v ?? ""));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseAdmin) return res.status(500).send("Supabase admin non configuré.");

    const token = String(req.query.token || "").trim();
    const action = String(req.query.action || "yes").toLowerCase(); // yes | no
    const redirectBase = `${baseUrl(req)}/landlord?tab=quittances`;

    if (!token) return res.redirect(302, `${redirectBase}&result=error&reason=missing_token`);
    if (action !== "yes" && action !== "no") {
      return res.redirect(302, `${redirectBase}&result=error&reason=bad_action`);
    }

    // 1) Charger l’action
    const a = await supabaseAdmin
      .from("receipt_actions")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (a.error || !a.data) {
      return res.redirect(302, `${redirectBase}&result=error&reason=invalid_token`);
    }

    const row: any = a.data;

    // 2) Expiration / statut
    if (row.status !== "pending") {
      // pending uniquement: sinon déjà utilisé / processing / consumed / error / expired...
      return res.redirect(302, `${redirectBase}&result=error&reason=already_used`);
    }

    if (isExpired(row.created_at, 7)) {
      await supabaseAdmin.from("receipt_actions").update({ status: "expired" }).eq("id", row.id);
      return res.redirect(302, `${redirectBase}&result=error&reason=expired`);
    }

    // 3) Lock anti double-clic: pending -> processing
    const lock = await supabaseAdmin
      .from("receipt_actions")
      .update({
        status: "processing",
        consumed_at: new Date().toISOString(), // on garde l’info de clic
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("*")
      .single();

    if (lock.error || !lock.data) {
      return res.redirect(302, `${redirectBase}&result=error&reason=lock_failed`);
    }

    // 4) Action = NO : on clôture
    if (action === "no") {
      await supabaseAdmin
        .from("receipt_actions")
        .update({ status: "consumed" })
        .eq("id", row.id);

      return res.redirect(
        302,
        `${redirectBase}&result=ok&paid=no&lease=${enc(row.lease_id)}&month=${enc(String(row.period_start).slice(0, 7))}`
      );
    }

    // 5) Action = YES : appeler send (interne)
    const sendUrl = `${baseUrl(req)}/api/receipts/send`;
    const internalSecret = process.env.INTERNAL_API_SECRET || "";

    const r = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({
        userId: row.user_id,
        leaseId: row.lease_id,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        // IMPORTANT: V1 = confirmation -> MAJ finance + envoi locataire (si possible)
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

    // ✅ Cas particulier: ton send.ts actuel renvoie 400 si Resend non configuré.
    // Pour une V1 propre, l’idéal est que send.ts renvoie ok:true avec email_disabled:true
    // MAIS tant que ce n’est pas fait, on reconnaît le message et on traite comme "ok partiel".
    const msg = String(json?.error || raw || "").toLowerCase();
    const isEmailNotConfigured =
      msg.includes("email non configuré") ||
      msg.includes("resend_api_key") ||
      msg.includes("resend_from");

    if (!r.ok && !isEmailNotConfigured) {
      // => on met l’action en error (pour visibilité + debug)
      await supabaseAdmin
        .from("receipt_actions")
        .update({ status: "error", error_message: json?.error || raw || `HTTP ${r.status}` })
        .eq("id", row.id);

      return res.redirect(
        302,
        `${redirectBase}&result=error&reason=send_failed&msg=${enc(json?.error || raw || `HTTP ${r.status}`)}`
      );
    }

    // Si email non configuré => "ok partiel" (mais attention: il faut que send.ts ait bien MAJ finance)
    const receiptId = json?.receipt_id || "";
    const month = String(row.period_start).slice(0, 7);

    await supabaseAdmin
      .from("receipt_actions")
      .update({
        status: "consumed",
        result_receipt_id: receiptId || null,
        result_payment: "yes",
        error_message: isEmailNotConfigured ? (json?.error || raw || "email_not_configured") : null,
      })
      .eq("id", row.id);

    return res.redirect(
      302,
      `${redirectBase}&result=ok&paid=yes&receipt=${enc(receiptId)}&month=${enc(month)}${
        isEmailNotConfigured ? `&email=disabled` : ""
      }`
    );
  } catch (e: any) {
    console.error("[api/receipts/confirm] error:", e);
    const fallback = `${(process.env.APP_BASE_URL || "").replace(
      /\/$/,
      ""
    )}/landlord?tab=quittances&result=error&reason=internal`;
    return res.redirect(302, fallback);
  }
}
