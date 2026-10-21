// pages/api/tools/send-teom-recovery-email.ts
//
// Envoie au locataire actuel d'un bail la demande de régularisation TEOM
// calculée dans l'outil "TEOM récupérable" (Boîte à outils) — crée aussi
// l'écriture Finance "charges_recovered" correspondante si elle n'existe pas
// déjà, pour que le contrôle de restitution de caution (pending-charges-
// summary.ts) la retrouve si jamais elle n'est pas réglée avant le départ.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { buildTeomRecoveryRequestEmail } from "../../../lib/emails/teomRecoveryRequest";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, leaseId, periodStart, periodEnd, occupancyStart, occupancyEnd, occupiedDays, periodDays, teomAmount, lotSharePercent, recoverableAmount, preview } =
      (req.body || {}) as Record<string, any>;
    const userCheck = requireMatchingUser(auth, String(userId || ""));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!leaseId) return res.status(400).json({ error: "leaseId requis." });

    const { data: lease } = await supabaseAdmin.from("leases").select("id,property_id,tenant_id").eq("id", leaseId).eq("user_id", userId).maybeSingle();
    if (!lease) return res.status(404).json({ error: "Bail introuvable." });

    const [{ data: tenant }, { data: property }] = await Promise.all([
      supabaseAdmin.from("tenants").select("full_name,email").eq("id", lease.tenant_id).maybeSingle(),
      supabaseAdmin.from("properties").select("label,address_line1").eq("id", lease.property_id).maybeSingle(),
    ]);
    if (!tenant?.email) return res.status(409).json({ error: "Ce locataire n'a pas d'adresse email enregistrée." });

    const propertyLabel = property?.label || property?.address_line1 || "votre logement";
    const tenantFirstName = String(tenant.full_name || "").split(" ")[0] || "";
    const amount = Number(recoverableAmount || 0);
    if (!(amount > 0)) return res.status(400).json({ error: "Montant récupérable invalide." });

    const built = buildTeomRecoveryRequestEmail({
      tenantFirstName,
      propertyLabel,
      periodStart: String(periodStart || ""),
      periodEnd: String(periodEnd || ""),
      occupancyStart: String(occupancyStart || periodStart || ""),
      occupancyEnd: String(occupancyEnd || periodEnd || ""),
      occupiedDays: Number(occupiedDays || 0),
      periodDays: Number(periodDays || 0),
      teomAmount: Number(teomAmount || 0),
      lotSharePercent: Number(lotSharePercent ?? 100),
      recoverableAmount: amount,
    });

    if (preview) {
      return res.status(200).json({ ok: true, preview: true, subject: built.subject, html: built.html, to: tenant.email });
    }

    const mail = await sendEmailViaResend({ to: tenant.email, subject: built.subject, html: built.html });
    if (!mail.ok) return res.status(500).json({ error: mail.error || "Envoi impossible." });

    // Crée l'écriture Finance correspondante si elle n'existe pas déjà pour ce
    // bail/cette période, pour que la demande envoyée reste traçable et que
    // le contrôle de restitution de caution puisse la retrouver si besoin.
    const year = String(periodStart || "").slice(0, 4);
    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("lease_id", leaseId)
      .eq("category", "charges_recovered")
      .gte("occurred_at", `${year}-01-01`)
      .lte("occurred_at", `${year}-12-31`)
      .maybeSingle();

    if (!existing) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("transactions")
        .insert({
          user_id: userId,
          property_id: lease.property_id,
          lease_id: leaseId,
          direction: "in",
          status: "expected",
          category: "charges_recovered",
          label: `TEOM récupérable ${year} — ${propertyLabel}`,
          amount,
          occurred_at: String(periodEnd || new Date().toISOString().slice(0, 10)),
          notes: "[lokt:teom] Demande envoyée au locataire par email.",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      // Garde-fou : mémorise la date d'occupation supposée pour ce calcul,
      // pour détecter plus tard un départ anticipé qui rendrait ce montant
      // trop élevé (cf. cron de vérification TEOM).
      await supabaseAdmin.from("teom_recovery_charges").insert({
        user_id: userId,
        transaction_id: inserted.id,
        lease_id: leaseId,
        occupancy_start: String(occupancyStart || periodStart || ""),
        assumed_occupancy_end: String(occupancyEnd || periodEnd || ""),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[api/tools/send-teom-recovery-email] error:", error);
    return res.status(500).json({ error: error?.message || "Envoi impossible." });
  }
}
