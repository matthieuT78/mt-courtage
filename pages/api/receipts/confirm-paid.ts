// pages/api/receipts/confirm-paid.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.status(400).send("Token manquant.");
    if (!supabaseAdmin) return res.status(500).send("Supabase admin manquant.");

    const tok = await supabaseAdmin
      .from("receipt_confirm_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (tok.error || !tok.data) return res.status(404).send("Lien invalide.");
    if (tok.data.used_at) return res.status(410).send("Lien déjà utilisé.");
    if (new Date(tok.data.expires_at).getTime() < Date.now()) return res.status(410).send("Lien expiré.");

    // marque used
    await supabaseAdmin
      .from("receipt_confirm_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tok.data.id);

    // appelle ton endpoint existant /api/receipts/send
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
    const r = await fetch(`${baseUrl}/api/receipts/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: tok.data.user_id,
        leaseId: tok.data.lease_id,
        periodStart: tok.data.period_start,
        periodEnd: tok.data.period_end,
        contentText: "", // tu peux laisser vide, ou regénérer côté UI si tu veux
      }),
    });

    const raw = await r.text();
    if (!r.ok) return res.status(500).send(raw || "Erreur génération quittance.");

    // UX simple : page confirmation
    return res.status(200).send(`
      <div style="font-family: ui-sans-serif, system-ui; padding: 24px;">
        <h2>✅ Quittance générée et envoyée</h2>
        <p>Le locataire a reçu la quittance et elle a été archivée.</p>
        <p style="color:#666;font-size:12px">Vous pouvez fermer cette page.</p>
      </div>
    `);
  } catch (e: any) {
    return res.status(500).send(e?.message || "Erreur");
  }
}
