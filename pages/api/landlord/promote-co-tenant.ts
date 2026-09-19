import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";

// Le colocataire devient le locataire principal du même bail (continuité :
// même date de début, même historique de paiements/quittances) — pas un
// nouveau bail. Traité côté serveur (pas côté client comme au départ) pour
// pouvoir envoyer l'email de trace avec le client admin, sans exposer la clé
// Resend au navigateur.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, leaseId } = (req.body || {}) as { userId?: string; leaseId?: string };
    if (!userId || !leaseId) return res.status(400).json({ error: "userId et leaseId requis." });
    const userCheck = requireMatchingUser(auth, String(userId));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

    const { data: lease, error: leaseError } = await supabaseAdmin
      .from("leases")
      .select("id,property_id,tenant_id,co_tenant_id")
      .eq("id", leaseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (leaseError) throw leaseError;
    if (!lease) return res.status(404).json({ error: "Bail introuvable." });
    if (!lease.co_tenant_id) return res.status(400).json({ error: "Ce bail n'a pas de colocataire à promouvoir." });

    const [{ data: oldTenant }, { data: newTenant }, { data: property }] = await Promise.all([
      supabaseAdmin.from("tenants").select("id,full_name").eq("id", lease.tenant_id).maybeSingle(),
      supabaseAdmin.from("tenants").select("id,full_name").eq("id", lease.co_tenant_id).maybeSingle(),
      supabaseAdmin.from("properties").select("label,address_line1,city").eq("id", lease.property_id).maybeSingle(),
    ]);
    const oldName = oldTenant?.full_name || "L'ancien locataire";
    const newName = newTenant?.full_name || "Le colocataire";
    const propertyLabel = (property as any)?.label || [(property as any)?.address_line1, (property as any)?.city].filter(Boolean).join(", ") || "ce logement";

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("leases")
      .update({
        tenant_id: lease.co_tenant_id,
        co_tenant_id: null,
        co_tenant_name: null,
        co_tenant_email: null,
        tenant_receipt_email: null,
        co_tenant_promoted_at: now,
        updated_at: now,
      })
      .eq("id", leaseId)
      .eq("user_id", userId);
    if (updateError) throw updateError;

    // Best-effort : coupe la messagerie de l'ancien locataire sur ce bail (le
    // bail continue sous le même id, sans ce plafond il verrait la messagerie
    // d'un éventuel remplaçant) — ne bloque jamais la promotion elle-même.
    try {
      await supabaseAdmin
        .from("tenant_portal_access")
        .update({ access_until: now, messaging_enabled: false, updated_at: now })
        .eq("tenant_id", lease.tenant_id)
        .eq("lease_id", leaseId)
        .in("status", ["invited", "active"]);
    } catch {
      // Non bloquant.
    }

    // Archive automatiquement l'ancien locataire — pas d'action manuelle en
    // plus pour ce cas courant : il n'est plus rattaché à ce bail, et la
    // restauration (section Locataires) reste disponible si son départ n'était
    // pas définitif. Best-effort, ne bloque jamais la promotion elle-même.
    try {
      await supabaseAdmin
        .from("tenants")
        .update({ archived_at: now, archived_reason: `${newName} devient locataire principal du bail` })
        .eq("id", lease.tenant_id)
        .eq("user_id", userId);
    } catch (archiveError) {
      console.error("[promote-co-tenant] archive error:", archiveError);
    }

    // Email de trace immédiate — indépendant de la session du bailleur, pour
    // qu'il n'y ait pas besoin de se souvenir de ce toast pour se rappeler des
    // 2 actions restantes (avenant, archivage).
    if (auth.email) {
      try {
        const subject = `${propertyLabel} — ${newName} devient locataire principal`;
        const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <tr><td style="background:linear-gradient(135deg,#635bff,#00d4ff);padding:28px 32px">
    <img src="https://lokt.fr/lokt-logo-small.jpg" alt="lokt.fr" height="32" style="display:block;border-radius:6px">
  </td></tr>
  <tr><td style="padding:32px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;font-weight:700">${propertyLabel}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
      <strong>${newName}</strong> est maintenant locataire principal de ce bail, à la place de <strong>${oldName}</strong> qui a quitté le logement. Le bail continue sous le même contrat (même date de début, même historique de paiements/quittances).
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
      La fiche de ${oldName} a été archivée automatiquement — si son départ n'est pas définitif, tu peux la restaurer à tout moment depuis la section Locataires.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#0f172a;font-weight:700">Une chose à faire toi-même :</p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#475569;line-height:1.8">
      <li>Régénère le bail et fais-le signer par toutes les parties (un avenant, les parties ont changé) — depuis "Bail" sur cette location.</li>
    </ul>
    <a href="https://lokt.fr/espace-bailleur?tab=baux" style="display:inline-block;border-radius:999px;background:#0f172a;color:#fff;padding:12px 24px;font-size:14px;font-weight:700;text-decoration:none">Ouvrir la location →</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
        await sendEmailViaResend({ to: auth.email, subject, html, text: `${newName} est maintenant locataire principal de ce bail (${propertyLabel}), à la place de ${oldName} (fiche archivée automatiquement, restaurable depuis Locataires si besoin). Pense à régénérer et faire signer un avenant depuis "Bail".` });
      } catch (emailError) {
        console.error("[promote-co-tenant] email error:", emailError);
      }
    }

    return res.status(200).json({ ok: true, oldName, newName });
  } catch (e: any) {
    console.error("[promote-co-tenant] error:", e);
    return res.status(500).json({ error: e?.message || "Promotion impossible." });
  }
}
