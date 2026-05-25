// pages/api/receipts/confirm.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { confirmLeasePaymentAndSendReceipt } from "../../../lib/receiptWorkflow";

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
    const redirectBase = `${baseUrl(req)}/espace-bailleur?tab=quittances`;

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

    // 5) Action = YES : confirmer paiement -> générer PDF -> envoyer si possible
    const result = await confirmLeasePaymentAndSendReceipt({
      userId: row.user_id,
      leaseId: row.lease_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    });

    const receiptId = result.receiptId || "";
    const month = String(row.period_start).slice(0, 7);

    const actionUpdate: any = {
      status: "consumed",
    };

    await supabaseAdmin.from("receipt_actions").update(actionUpdate).eq("id", row.id);

    return res.redirect(
      302,
      `${redirectBase}&result=ok&paid=yes&receipt=${enc(receiptId)}&month=${enc(month)}${result.email.ok ? "" : `&email=not_sent`}`
    );
  } catch (e: any) {
    console.error("[api/receipts/confirm] error:", e);
    const fallback = `${(process.env.APP_BASE_URL || "").replace(
      /\/$/,
      ""
    )}/espace-bailleur?tab=quittances&result=error&reason=internal`;
    return res.redirect(302, fallback);
  }
}
