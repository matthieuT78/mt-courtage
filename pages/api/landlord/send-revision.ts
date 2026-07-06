import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { userCanUseReceiptAutomation } from "../../../lib/serverPermissions";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { irlByQuarterAsync } from "../../../lib/irlService";

function euro(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}
function signedPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + " %";
}
function nextAnniversary(startISO: string): string {
  const start = new Date(startISO);
  const sm = start.getMonth(), sd = start.getDate();
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const clampDay = (y: number, m: number, d: number) => {
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(d, last));
  };
  const thisYear = clampDay(today.getFullYear(), sm, sd);
  const d = thisYear >= todayMidnight ? thisYear : clampDay(today.getFullYear() + 1, sm, sd);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function escHtml(s: string) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "DB indisponible." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { userId, leaseId, refQuarter, newQuarter } = req.body as {
    userId?: string;
    leaseId?: string;
    refQuarter?: string;
    newQuarter?: string;
  };

  if (!userId) return res.status(400).json({ error: "userId requis." });
  const userCheck = requireMatchingUser(auth, userId);
  if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

  if (!leaseId) return res.status(400).json({ error: "leaseId requis." });
  if (!refQuarter || !newQuarter) return res.status(400).json({ error: "Trimestres IRL requis." });

  const canSend = await userCanUseReceiptAutomation(auth.userId);
  if (!canSend) {
    return res.status(402).json({ error: "L'envoi par email est réservé aux abonnements payants." });
  }

  // Fetch lease
  const { data: lease, error: leaseErr } = await supabaseAdmin
    .from("leases").select("*").eq("id", leaseId).single();
  if (leaseErr || !lease) return res.status(404).json({ error: "Bail introuvable." });
  if (lease.user_id !== auth.userId) return res.status(403).json({ error: "Accès refusé." });

  // Fetch tenant + property in parallel
  const [tenantRes, propertyRes] = await Promise.all([
    supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).single(),
    lease.property_id
      ? supabaseAdmin.from("properties").select("label, address_line1, postal_code, city").eq("id", lease.property_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const tenant = tenantRes.data as any;
  const property = (propertyRes as any).data as any;

  const toEmail = String(tenant?.email || "").trim();
  if (!toEmail) return res.status(400).json({ error: "Le locataire n'a pas d'adresse email enregistrée." });

  // Compute IRL revision (lecture DB avec fallback statique)
  const [refEntry, newEntry] = await Promise.all([
    irlByQuarterAsync(refQuarter),
    irlByQuarterAsync(newQuarter),
  ]);
  const currentRent = Number(lease.rent_amount || 0);

  if (!refEntry || !newEntry) return res.status(400).json({ error: "Trimestre IRL introuvable." });
  if (currentRent <= 0) return res.status(400).json({ error: "Loyer du bail invalide." });
  if (refEntry.value <= 0) return res.status(400).json({ error: "IRL de référence invalide." });

  const newRent = Math.round((currentRent * (newEntry.value / refEntry.value)) * 100) / 100;
  const delta = newRent - currentRent;
  const change = ((newEntry.value - refEntry.value) / refEntry.value) * 100;

  const tenantName = String(tenant?.full_name || "le locataire");
  const propAddr = [
    property?.address_line1,
    [property?.postal_code, property?.city].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ") || property?.label || "le logement";

  const today = new Date().toLocaleDateString("fr-FR");

  const subject = `Révision annuelle de loyer – ${propAddr || tenantName}`;

  const html = `
<!doctype html><html lang="fr"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0"
  style="width:600px;max-width:92vw;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">

  <tr>
    <td style="padding:16px 24px;border-bottom:1px solid #e2e8f0;">
      <img src="https://lokt.fr/lokt-logo.jpg" alt="lokt.fr" height="36" style="display:block;height:36px;width:auto;"/>
    </td>
  </tr>

  <tr>
    <td style="padding:28px 24px 8px;">
      <h1 style="margin:0;font-size:18px;color:#0f172a;line-height:1.3;">
        Révision annuelle de votre loyer
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">
        Conformément à l'article 17-1 de la loi n° 89-462 du 6 juillet 1989
      </p>
    </td>
  </tr>

  <tr>
    <td style="padding:20px 24px;">
      <p style="margin:0 0 16px;font-size:14px;color:#0f172a;line-height:1.6;">
        ${escHtml(today)}<br/><br/>
        Madame/Monsieur ${escHtml(tenantName)},<br/><br/>
        Conformément à la clause de révision annuelle stipulée dans votre contrat de location
        du ${escHtml(fmtDate(lease.start_date))}, relatif au logement situé
        <strong>${escHtml(propAddr)}</strong>, je vous informe de la révision du montant de votre loyer mensuel hors charges.
      </p>

      <!-- Tableau récapitulatif -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-size:13px;">
        <tr style="background:#f8fafc;">
          <td style="padding:10px 16px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Loyer actuel HC</td>
          <td style="padding:10px 16px;text-align:right;color:#0f172a;font-weight:700;border-bottom:1px solid #e2e8f0;">${escHtml(euro(currentRent))}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;color:#64748b;border-bottom:1px solid #e2e8f0;">IRL de référence (${escHtml(refEntry.label)})</td>
          <td style="padding:10px 16px;text-align:right;color:#0f172a;border-bottom:1px solid #e2e8f0;">${refEntry.value}</td>
        </tr>
        <tr style="background:#f8fafc;">
          <td style="padding:10px 16px;color:#64748b;border-bottom:1px solid #e2e8f0;">Nouvel IRL applicable (${escHtml(newEntry.label)})</td>
          <td style="padding:10px 16px;text-align:right;color:#0f172a;border-bottom:1px solid #e2e8f0;">${newEntry.value}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;color:#64748b;border-bottom:1px solid #e2e8f0;">Variation</td>
          <td style="padding:10px 16px;text-align:right;color:${delta >= 0 ? "#15803d" : "#dc2626"};font-weight:600;border-bottom:1px solid #e2e8f0;">${escHtml(signedPct(change))} (${escHtml(delta >= 0 ? "+" : "")}${escHtml(euro(delta))}/mois)</td>
        </tr>
        <tr style="background:#eff6ff;">
          <td style="padding:12px 16px;color:#1e40af;font-weight:700;">Nouveau loyer HC</td>
          <td style="padding:12px 16px;text-align:right;color:#1e40af;font-size:16px;font-weight:700;">${escHtml(euro(newRent))}</td>
        </tr>
      </table>

      <p style="margin:20px 0 0;font-size:14px;color:#0f172a;line-height:1.6;">
        Le nouveau loyer mensuel hors charges s'établit à <strong>${escHtml(euro(newRent))}</strong>,
        applicable à compter de la prochaine date anniversaire du bail.
      </p>
      <p style="margin:12px 0 0;font-size:14px;color:#0f172a;line-height:1.6;">
        Conformément à la réglementation en vigueur, cette révision ne peut avoir d'effet rétroactif
        que dans la limite des 12 mois précédant la présente notification.
      </p>
      <p style="margin:20px 0 0;font-size:14px;color:#0f172a;line-height:1.6;">
        Cordialement,
      </p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">
        Envoyé via lokt.fr
      </p>
    </td>
  </tr>

  <tr>
    <td style="padding:14px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
        Révision calculée selon l'IRL INSEE (art. 17-1 loi 89-462) · lokt.fr · contact@lokt.fr
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>`;

  const result = await sendEmailViaResend({ to: toEmail, subject, html });

  // Sauvegarder l'état IRL sur le bail (non-bloquant)
  const applyOn = lease.start_date ? nextAnniversary(lease.start_date) : null;
  try {
    await supabaseAdmin.from("leases").update({
      irl_sent_at: new Date().toISOString(),
      irl_sent_ref_quarter: refQuarter,
      irl_sent_new_quarter: newQuarter,
      irl_sent_new_rent: newRent,
      irl_apply_on: applyOn,
      irl_applied_at: null,
    }).eq("id", leaseId);
  } catch {}

  // Log non-bloquant
  try {
    await supabaseAdmin.from("email_logs").insert({
      user_id: auth.userId,
      lease_id: leaseId,
      to_email: toEmail,
      subject,
      body_preview: `Révision IRL ${refEntry.label} → ${newEntry.label} · ${euro(currentRent)} → ${euro(newRent)}`,
      status: result.ok ? "sent" : "error",
      error_message: result.ok ? null : (result as any).error,
      sent_at: new Date().toISOString(),
    });
  } catch {}

  if (!result.ok) {
    return res.status(400).json({ error: (result as any).error || "Erreur d'envoi." });
  }

  return res.status(200).json({
    ok: true,
    to: toEmail,
    newRent,
    change,
    applyOn,
  });
}
