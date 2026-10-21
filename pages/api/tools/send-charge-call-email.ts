// pages/api/tools/send-charge-call-email.ts
//
// Envoie à UN locataire l'appel de charges calculé dans l'outil "Répartition
// des charges" (Boîte à outils) — jamais groupé avec les autres lots du même
// immeuble (même principe que la correction appliquée à l'outil eau : chaque
// locataire ne voit que sa propre quote-part, jamais celle des autres lots).
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { buildChargeCallRecapEmail } from "../../../lib/emails/chargeCallRecap";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const {
      userId,
      leaseId,
      lotLabel,
      periodLabel,
      tantiemes,
      baseTantiemes,
      sharePercent,
      grossAmount,
      recoverablePercent,
      recoverableAmount,
      preview,
    } = (req.body || {}) as Record<string, any>;
    const userCheck = requireMatchingUser(auth, String(userId || ""));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!leaseId) return res.status(400).json({ error: "leaseId requis." });

    const { data: lease } = await supabaseAdmin.from("leases").select("id,property_id,tenant_id").eq("id", leaseId).eq("user_id", userId).maybeSingle();
    if (!lease) return res.status(404).json({ error: "Bail introuvable." });

    const [{ data: tenant }, { data: property }] = await Promise.all([
      supabaseAdmin.from("tenants").select("full_name,email").eq("id", lease.tenant_id).maybeSingle(),
      supabaseAdmin.from("properties").select("label,address_line1,city").eq("id", lease.property_id).maybeSingle(),
    ]);
    if (!tenant?.email) return res.status(409).json({ error: "Ce locataire n'a pas d'adresse email enregistrée." });

    const propertyLabel = property?.label || [property?.address_line1, property?.city].filter(Boolean).join(", ") || "votre immeuble";
    const tenantFirstName = String(tenant.full_name || "").split(" ")[0] || "";
    const amount = Number(recoverableAmount || 0);
    if (!(amount > 0)) return res.status(400).json({ error: "Montant récupérable invalide." });

    const built = buildChargeCallRecapEmail({
      tenantFirstName,
      propertyLabel,
      lotLabel: String(lotLabel || ""),
      periodLabel: String(periodLabel || ""),
      tantiemes: Number(tantiemes || 0),
      baseTantiemes: Number(baseTantiemes || 0),
      sharePercent: Number(sharePercent || 0),
      grossAmount: Number(grossAmount || 0),
      recoverablePercent: Number(recoverablePercent ?? 100),
      recoverableAmount: amount,
    });

    if (preview) {
      return res.status(200).json({ ok: true, preview: true, subject: built.subject, html: built.html, to: tenant.email });
    }

    const mail = await sendEmailViaResend({ to: tenant.email, subject: built.subject, html: built.html });
    if (!mail.ok) return res.status(500).json({ error: mail.error || "Envoi impossible." });

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[api/tools/send-charge-call-email] error:", error);
    return res.status(500).json({ error: error?.message || "Envoi impossible." });
  }
}
