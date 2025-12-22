import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseAdmin) return res.status(500).send("supabaseAdmin non configuré");

    const action = String(req.query.action || "");
    const token = String(req.query.token || "");
    if (!token) return res.status(400).send("token requis");

    const rr = await supabaseAdmin.from("rent_receipts").select("*").eq("confirm_token", token).maybeSingle();
    if (rr.error || !rr.data) return res.status(404).send("Quittance introuvable");

    const receipt: any = rr.data;
    const exp = receipt.confirm_token_expires_at ? new Date(receipt.confirm_token_expires_at).getTime() : 0;
    if (!exp || Date.now() > exp) return res.status(410).send("Lien expiré");

    // PDF obligatoire pour download/confirm (V1)
    if (!receipt.pdf_url) return res.status(409).send("PDF non disponible");

    // pdf_url = "rent-receipts-pdfs:<path>"
    const [bucketTag, storagePath] = String(receipt.pdf_url).split(":");
    if (bucketTag !== "rent-receipts-pdfs" || !storagePath) return res.status(500).send("pdf_url invalide");

    if (action === "download") {
      const signed = await supabaseAdmin.storage.from("rent-receipts-pdfs").createSignedUrl(storagePath, 60 * 10);
      if (signed.error || !signed.data?.signedUrl) return res.status(500).send("Signed URL échouée");
      return res.redirect(signed.data.signedUrl);
    }

    if (action !== "confirm") return res.status(400).send("action invalide");

    // CONFIRM: créer entrée Finance + envoyer locataire + CC bailleur
    const leaseRes = await supabaseAdmin.from("leases").select("*").eq("id", receipt.lease_id).single();
    if (leaseRes.error || !leaseRes.data) return res.status(404).send("Bail introuvable");

    const lease: any = leaseRes.data;

    const tenantRes = await supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).single();
    const tenant: any = tenantRes.data || null;

    const tenantEmail = tenant?.email || null;
    const ccOwner = lease.reminder_email || null;

    // 1) Upsert transaction rent (Finance) — uniquement ici
    const payload = {
      user_id: lease.user_id,
      property_id: lease.property_id,
      lease_id: lease.id,
      receipt_id: receipt.id,
      occurred_at: receipt.period_end,
      direction: "in",
      status: "received",
      category: "rent",
      label: "Loyer (quittance confirmée)",
      amount: Number(receipt.total_amount || 0),
      notes: null,
      updated_at: new Date().toISOString(),
    };

    const upTx = await supabaseAdmin.from("transactions").upsert([payload], { onConflict: "user_id,receipt_id" });
    if (upTx.error) return res.status(500).send(`Finance: ${upTx.error.message}`);

    // 2) Envoyer locataire (si email dispo)
    // (si Resend non configuré, on ne bloque pas la finance : V1)
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    let emailError: string | null = null;

    if (tenantEmail && apiKey && from) {
      const signed = await supabaseAdmin.storage.from("rent-receipts-pdfs").createSignedUrl(storagePath, 60 * 60);
      const link = signed.data?.signedUrl || `${SITE_URL}/api/receipts/public?action=download&token=${token}`;

      const subject = `Quittance de loyer – ${String(receipt.period_start).slice(0, 7)}`;
      const html = `
        <div style="font-family:ui-sans-serif,system-ui;line-height:1.5">
          <p>Bonjour,</p>
          <p>Voici votre quittance de loyer :</p>
          <p><a href="${link}">Télécharger la quittance (PDF)</a></p>
          <p>Cordialement.</p>
        </div>
      `;

      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: tenantEmail, cc: ccOwner || undefined, subject, html }),
      });

      if (!r.ok) emailError = await r.text();
    }

    // 3) MAJ receipt : sent_at si email ok, sinon on garde generated mais on log
    const now = new Date().toISOString();
    const upd: any = {
      updated_at: now,
      send_error: emailError,
    };

    if (!emailError && tenantEmail) {
      upd.sent_at = now;
      upd.sent_to_tenant_email = tenantEmail;
      upd.status = "sent";
    } else {
      upd.status = "generated"; // finance confirmée mais pas envoyée (email absent ou non configuré)
    }

    await supabaseAdmin.from("rent_receipts").update(upd).eq("id", receipt.id);

    // Page “OK” simple
    return res.status(200).send(`
      <html><body style="font-family:system-ui;padding:24px">
        <h2>✅ Paiement confirmé</h2>
        <p>La Finance a été mise à jour.</p>
        <p>${emailError ? "⚠️ Email locataire non envoyé : " + emailError : "📧 Quittance envoyée au locataire (CC bailleur si configuré)."}</p>
        <p><a href="${SITE_URL}/api/receipts/public?action=download&token=${token}">Télécharger la quittance</a></p>
      </body></html>
    `);
  } catch (e: any) {
    console.error("[receipts/public]", e);
    return res.status(500).send(e?.message || "Erreur interne");
  }
}
