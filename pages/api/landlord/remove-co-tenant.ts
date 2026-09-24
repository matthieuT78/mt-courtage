import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";

// Le colocataire quitte seul le bail, qui continue sous le même id avec le
// même locataire principal (pas de résiliation, pas de promotion — voir
// promote-co-tenant.ts pour le cas symétrique où c'est le principal qui
// part). Traité côté serveur pour l'email de trace, comme promote-co-tenant.
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
    if (!lease.co_tenant_id) return res.status(400).json({ error: "Ce bail n'a pas de colocataire à retirer." });

    const [{ data: remainingTenant }, { data: leavingTenant }, { data: property }] = await Promise.all([
      supabaseAdmin.from("tenants").select("id,full_name").eq("id", lease.tenant_id).maybeSingle(),
      supabaseAdmin.from("tenants").select("id,full_name").eq("id", lease.co_tenant_id).maybeSingle(),
      supabaseAdmin.from("properties").select("label,address_line1,city").eq("id", lease.property_id).maybeSingle(),
    ]);
    const remainingName = remainingTenant?.full_name || "Le locataire principal";
    const leavingName = leavingTenant?.full_name || "Le colocataire";
    const propertyLabel = (property as any)?.label || [(property as any)?.address_line1, (property as any)?.city].filter(Boolean).join(", ") || "ce logement";

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("leases")
      .update({
        co_tenant_id: null,
        co_tenant_name: null,
        co_tenant_email: null,
        updated_at: now,
      })
      .eq("id", leaseId)
      .eq("user_id", userId);
    if (updateError) throw updateError;

    // Best-effort : coupe l'accès portail du colocataire parti sur ce bail
    // (même logique que promote-co-tenant.ts pour l'ancien principal).
    try {
      await supabaseAdmin
        .from("tenant_portal_access")
        .update({ access_until: now, messaging_enabled: false, updated_at: now })
        .eq("tenant_id", lease.co_tenant_id)
        .eq("lease_id", leaseId)
        .in("status", ["invited", "active"]);
    } catch {
      // Non bloquant.
    }

    // Archive la fiche du colocataire parti — best-effort, ne bloque jamais
    // le retrait lui-même.
    try {
      await supabaseAdmin
        .from("tenants")
        .update({ archived_at: now, archived_reason: `A quitté le bail — ${remainingName} reste locataire principal` })
        .eq("id", lease.co_tenant_id)
        .eq("user_id", userId);
    } catch (archiveError) {
      console.error("[remove-co-tenant] archive error:", archiveError);
    }

    if (auth.email) {
      try {
        const subject = `${propertyLabel} — ${leavingName} a quitté le bail`;
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
      <strong>${leavingName}</strong> a quitté le bail. Il continue sous le même contrat avec <strong>${remainingName}</strong> comme seul locataire (même date de début, même historique de paiements/quittances).
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
      La fiche de ${leavingName} a été archivée automatiquement — si son départ n'est pas définitif, tu peux la restaurer à tout moment depuis la section Locataires.
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
        await sendEmailViaResend({ to: auth.email, subject, html, text: `${leavingName} a quitté le bail (${propertyLabel}), qui continue avec ${remainingName} (fiche de ${leavingName} archivée automatiquement, restaurable depuis Locataires si besoin). Pense à régénérer et faire signer un avenant depuis "Bail".` });
      } catch (emailError) {
        console.error("[remove-co-tenant] email error:", emailError);
      }
    }

    return res.status(200).json({ ok: true, remainingName, leavingName });
  } catch (e: any) {
    console.error("[remove-co-tenant] error:", e);
    return res.status(500).json({ error: e?.message || "Retrait impossible." });
  }
}
