// pages/api/receipts/confirm-paid.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { confirmLeasePaymentAndSendReceipt } from "../../../lib/receiptWorkflow";

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

    const result = await confirmLeasePaymentAndSendReceipt({
      userId: tok.data.user_id,
      leaseId: tok.data.lease_id,
      periodStart: tok.data.period_start,
      periodEnd: tok.data.period_end,
    });

    await supabaseAdmin
      .from("receipt_confirm_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tok.data.id);

    // UX simple : page confirmation
    return res.status(200).send(`
      <div style="font-family: ui-sans-serif, system-ui; padding: 24px;">
        <h2>✅ Paiement confirmé</h2>
        <p>La quittance a été générée et le paiement a été enregistré.</p>
        <p>${
          result.email.ok
            ? "La quittance a été envoyée au locataire."
            : `La quittance est prête, mais l’email n’a pas été envoyé : ${result.email.error || "raison inconnue"}.`
        }</p>
        ${result.signedUrl ? `<p><a href="${result.signedUrl}">Ouvrir la quittance PDF</a></p>` : ""}
        <p style="color:#666;font-size:12px">Vous pouvez fermer cette page.</p>
      </div>
    `);
  } catch (e: any) {
    return res.status(500).send(e?.message || "Erreur");
  }
}
