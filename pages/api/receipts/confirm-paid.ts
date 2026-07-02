import type { NextApiRequest, NextApiResponse } from "next";
import { confirmLeasePaymentAndSendReceipt } from "../../../lib/receiptWorkflow";
import { removeTrackedPartialPaymentTransactions } from "../../../lib/rentPaymentFinance";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getLeaseRentPeriodFromDate } from "../../../lib/rentPeriod";

type OwnerAction = "full" | "partial" | "unpaid";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function euro(v: unknown) {
  const n = Number(v || 0);
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function parseMoney(v: unknown) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "");
}

function appBaseUrl(req: NextApiRequest) {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  return host ? `${proto}://${host}` : "";
}

function redirectToBailleur(req: NextApiRequest, params: Record<string, string | number | null | undefined>) {
  const base = appBaseUrl(req);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") query.set(key, String(value));
  }
  const path = `/espace-bailleur?${query.toString()}`;
  return base ? `${base}${path}` : path;
}

async function loadToken(token: string) {
  if (!supabaseAdmin) throw new Error("Supabase admin manquant.");
  const tok = await supabaseAdmin.from("receipt_confirm_tokens").select("*").eq("token", token).maybeSingle();
  if (tok.error || !tok.data) return { error: "Lien invalide.", row: null as any };
  if (tok.data.used_at) return { error: "Lien déjà utilisé.", row: null as any };
  if (new Date(tok.data.expires_at).getTime() < Date.now()) return { error: "Lien expiré.", row: null as any };
  return { error: null, row: tok.data as any };
}

async function loadLease(row: any) {
  if (!supabaseAdmin) throw new Error("Supabase admin manquant.");
  const leaseRes = await supabaseAdmin.from("leases").select("*").eq("id", row.lease_id).single();
  if (leaseRes.error || !leaseRes.data) throw new Error("Bail introuvable.");
  const lease: any = leaseRes.data;
  if (String(lease.user_id) !== String(row.user_id)) throw new Error("Accès refusé.");
  return lease;
}

async function upsertPaymentAndFinance(params: {
  row: any;
  lease: any;
  rentReceived: number;
  chargesReceived: number;
  source: string;
  label: string;
  notes: string;
}) {
  if (!supabaseAdmin) throw new Error("Supabase admin manquant.");
  const totalReceived = params.rentReceived + params.chargesReceived;
  const now = new Date().toISOString();

  const existing = await supabaseAdmin
    .from("rent_payments")
    .select("id")
    .eq("lease_id", params.row.lease_id)
    .eq("period_start", params.row.period_start)
    .eq("period_end", params.row.period_end)
    .maybeSingle();

  const paymentPayload = {
    lease_id: params.row.lease_id,
    period_start: params.row.period_start,
    period_end: params.row.period_end,
    rent_amount: params.rentReceived,
    charges_amount: params.chargesReceived,
    total_amount: totalReceived,
    due_date: params.row.period_start,
    paid_at: totalReceived > 0 ? now : null,
    payment_method: params.lease.payment_method || null,
    source: params.source,
    updated_at: now,
  };

  if (existing.data?.id) {
    const upd = await supabaseAdmin.from("rent_payments").update(paymentPayload).eq("id", existing.data.id);
    if (upd.error) throw upd.error;
  } else {
    const ins = await supabaseAdmin.from("rent_payments").insert(paymentPayload).select("id").single();
    if (ins.error || !ins.data) throw new Error(ins.error?.message || "Création paiement échouée.");
  }

  await removeTrackedPartialPaymentTransactions({
    leaseId: params.row.lease_id,
    periodStart: params.row.period_start,
    periodEnd: params.row.period_end,
  });

  if (totalReceived > 0) {
    const tx = await supabaseAdmin.from("transactions").insert({
      user_id: params.row.user_id,
      property_id: params.lease.property_id ?? null,
      lease_id: params.row.lease_id,
      receipt_id: null,
      occurred_at: params.row.period_end || params.row.period_start,
      direction: "in",
      status: "received",
      category: "rent",
      label: params.label,
      amount: totalReceived,
      notes: `[lokt:partial-payment:${params.row.period_start}:${params.row.period_end}] ${params.notes}`,
      updated_at: now,
    } as any);
    if (tx.error) throw tx.error;
  }
}

async function markTokenUsed(id: string) {
  if (!supabaseAdmin) throw new Error("Supabase admin manquant.");
  await supabaseAdmin.from("receipt_confirm_tokens").update({ used_at: new Date().toISOString() }).eq("id", id);
}

function partialForm(params: { token: string; rent: number; charges: number; period: string }) {
  return `
    <div style="font-family:ui-sans-serif,system-ui;padding:24px;max-width:680px;margin:0 auto;color:#0f172a">
      <div style="border:1px solid #e2e8f0;border-radius:18px;padding:22px;background:#fff">
        <p style="margin:0 0 8px;color:#92400e;font-weight:800">Paiement incomplet</p>
        <h2 style="margin:0 0 10px">Indiquez le montant réellement reçu</h2>
        <p style="color:#475569;line-height:1.5">Cette saisie alimente Finance, bloque la quittance et affichera le solde à traiter dans le cockpit.</p>
        <form method="post" action="/api/receipts/confirm-paid" style="display:grid;gap:12px;margin-top:18px">
          <input type="hidden" name="token" value="${escapeHtml(params.token)}" />
          <input type="hidden" name="action" value="partial" />
          <label style="display:grid;gap:6px;font-weight:700">
            Loyer reçu
            <input name="rentReceived" inputmode="decimal" value="${params.rent}" style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;font-size:16px" />
          </label>
          <label style="display:grid;gap:6px;font-weight:700">
            Charges reçues
            <input name="chargesReceived" inputmode="decimal" value="0" style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;font-size:16px" />
          </label>
          <p style="margin:0;color:#64748b;font-size:13px">Attendu sur ${escapeHtml(params.period)} : loyer ${euro(params.rent)} + charges ${euro(params.charges)}.</p>
          <button type="submit" style="border:0;border-radius:999px;background:#111827;color:white;padding:12px 16px;font-weight:800">Enregistrer le paiement partiel</button>
        </form>
      </div>
    </div>
  `;
}

function monthLabelFR(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  if (!y || !m) return yyyymm;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function spinnerPage(params: {
  token: string;
  tenantName: string;
  city: string;
  period: string;
  baseUrl: string;
}) {
  const { token, tenantName, city, period, baseUrl } = params;
  const monthLabel = monthLabelFR(period);
  const badgeParts = [tenantName, city, monthLabel].filter(Boolean).join(" · ");

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Confirmation paiement · lokt.fr</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0f172a;
      padding: 16px;
    }
    .card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 22px;
      padding: 36px 28px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .logo {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #4f46e5;
      text-transform: uppercase;
      margin-bottom: 28px;
    }
    .spinner {
      width: 44px; height: 44px;
      border: 3px solid #e2e8f0;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
      margin: 0 auto 22px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .icon { font-size: 44px; margin-bottom: 18px; }
    .title { font-size: 19px; font-weight: 800; margin-bottom: 8px; line-height: 1.2; }
    .sub { font-size: 14px; color: #64748b; line-height: 1.55; }
    .badge {
      display: inline-block;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 14px;
      margin-top: 18px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }
    .btn {
      display: inline-block;
      margin-top: 22px;
      padding: 11px 22px;
      background: #0f172a;
      color: white;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
    }
    .err-msg { color: #b91c1c; font-size: 13px; margin-top: 10px; line-height: 1.4; }
    #s-loading { display: block; }
    #s-success { display: none; }
    #s-error   { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">lokt.fr</div>

    <div id="s-loading">
      <div class="spinner"></div>
      <div class="title">Confirmation en cours…</div>
      <div class="sub">Nous enregistrons le paiement et préparons votre quittance.</div>
      <div class="badge">${escapeHtml(badgeParts)}</div>
    </div>

    <div id="s-success">
      <div class="icon">✅</div>
      <div class="title">Paiement confirmé</div>
      <div class="sub" id="success-msg">Quittance envoyée.</div>
      <div class="badge">${escapeHtml(badgeParts)}</div>
      <a href="${escapeHtml(baseUrl)}/espace-bailleur?tab=quittances" class="btn">Voir les quittances</a>
    </div>

    <div id="s-error">
      <div class="icon">⚠️</div>
      <div class="title">Une erreur est survenue</div>
      <div class="err-msg" id="error-msg"></div>
      <a href="${escapeHtml(baseUrl)}/espace-bailleur" class="btn">Aller sur lokt.fr</a>
    </div>
  </div>

  <script>
    (async () => {
      try {
        const r = await fetch('/api/receipts/confirm-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: '${escapeJs(token)}', action: 'full' })
        });
        const json = await r.json().catch(() => ({}));
        document.getElementById('s-loading').style.display = 'none';
        if (json.ok) {
          document.getElementById('success-msg').textContent = json.emailOk
            ? 'Quittance envoyée à ${escapeJs(tenantName)}. Vous êtes en copie.'
            : 'Paiement enregistré. La quittance est disponible sur lokt.fr.';
          document.getElementById('s-success').style.display = 'block';
        } else {
          document.getElementById('error-msg').textContent = json.error || 'Erreur inconnue. Confirmez le paiement depuis lokt.fr.';
          document.getElementById('s-error').style.display = 'block';
        }
      } catch (e) {
        document.getElementById('s-loading').style.display = 'none';
        document.getElementById('error-msg').textContent = 'Erreur réseau. Confirmez le paiement depuis lokt.fr.';
        document.getElementById('s-error').style.display = 'block';
      }
    })();
  </script>
</body>
</html>`;
}

function errorPage(message: string, baseUrl: string) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Lien invalide · lokt.fr</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 22px; padding: 36px 28px; max-width: 400px; width: 100%; text-align: center; }
    .logo { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; color: #4f46e5; text-transform: uppercase; margin-bottom: 28px; }
    .icon { font-size: 44px; margin-bottom: 18px; }
    .title { font-size: 19px; font-weight: 800; margin-bottom: 8px; }
    .sub { font-size: 14px; color: #64748b; line-height: 1.55; }
    .btn { display: inline-block; margin-top: 22px; padding: 11px 22px; background: #0f172a; color: white; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">lokt.fr</div>
    <div class="icon">⚠️</div>
    <div class="title">Lien invalide</div>
    <div class="sub">${escapeHtml(message)}</div>
    <a href="${escapeHtml(baseUrl)}/espace-bailleur" class="btn">Aller sur lokt.fr</a>
  </div>
</body>
</html>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseAdmin) return res.status(500).send("Supabase admin manquant.");

    const token = safeStr(req.method === "POST" ? req.body?.token : req.query.token);
    const rawAction = safeStr(req.method === "POST" ? req.body?.action : req.query.action).toLowerCase();
    const action: OwnerAction =
      rawAction === "partial" || rawAction === "unpaid" || rawAction === "full" ? rawAction : "full";

    if (!token) return res.status(400).send("Token manquant.");

    const baseUrl = appBaseUrl(req);

    // ── GET + action=full → page HTML avec spinner (pas de traitement) ──────
    if (req.method === "GET" && action === "full") {
      const { error, row } = await loadToken(token);
      if (error) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(errorPage(error, baseUrl));
      }

      const lease = await loadLease(row);
      const [tenantRes, propertyRes] = await Promise.all([
        supabaseAdmin.from("tenants").select("full_name").eq("id", lease.tenant_id).maybeSingle(),
        lease.property_id
          ? supabaseAdmin.from("properties").select("city,label").eq("id", lease.property_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const tenantName = safeStr((tenantRes.data as any)?.full_name) || "Locataire";
      const city = safeStr((propertyRes.data as any)?.city) || safeStr((propertyRes.data as any)?.label);
      const period = String(row.period_start).slice(0, 7);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(spinnerPage({ token, tenantName, city, period, baseUrl }));
    }

    // ── POST + action=full → traitement + réponse JSON (appelé par le JS) ──
    if (req.method === "POST" && action === "full") {
      const { error, row } = await loadToken(token);
      if (error) return res.status(400).json({ ok: false, error });

      const lease = await loadLease(row);
      const rentPeriod = getLeaseRentPeriodFromDate(lease, row.period_start);
      if (!rentPeriod) throw new Error("Cette période est en dehors des dates du bail.");

      const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
      const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
      const generateEndpointUrl = host ? `${proto}://${host}/api/receipts/generate` : null;
      const internalSecret = process.env.INTERNAL_API_SECRET || null;

      const result = await confirmLeasePaymentAndSendReceipt({
        userId: row.user_id,
        leaseId: row.lease_id,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        generateEndpointUrl,
        internalSecret,
      });

      await markTokenUsed(row.id);
      return res.status(200).json({ ok: true, receiptId: result.receiptId, emailOk: result.email.ok });
    }

    // ── GET + action=partial → formulaire de saisie ──────────────────────────
    if (action === "partial" && req.method !== "POST") {
      const { error, row } = await loadToken(token);
      if (error) return res.redirect(302, redirectToBailleur(req, { tab: "quittances", rentResult: "error", reason: error }));
      const lease = await loadLease(row);
      const rentPeriod = getLeaseRentPeriodFromDate(lease, row.period_start);
      if (!rentPeriod) throw new Error("Cette période est en dehors des dates du bail.");
      return res.status(200).send(partialForm({
        token,
        rent: rentPeriod.rent,
        charges: rentPeriod.charges,
        period: String(row.period_start).slice(0, 7),
      }));
    }

    // ── POST + action=partial ─────────────────────────────────────────────────
    if (action === "partial") {
      const { error, row } = await loadToken(token);
      if (error) return res.redirect(302, redirectToBailleur(req, { tab: "quittances", rentResult: "error", reason: error }));
      const lease = await loadLease(row);
      const rentPeriod = getLeaseRentPeriodFromDate(lease, row.period_start);
      if (!rentPeriod) throw new Error("Cette période est en dehors des dates du bail.");
      const rentReceived = parseMoney(req.body?.rentReceived);
      const chargesReceived = parseMoney(req.body?.chargesReceived);
      const period = String(row.period_start).slice(0, 7);
      await upsertPaymentAndFinance({
        row, lease, rentReceived, chargesReceived,
        source: "owner_partial_email",
        label: "Paiement partiel loyer",
        notes: `Paiement partiel pour ${period}. Quittance bloquée jusqu'au règlement complet.`,
      });
      await markTokenUsed(row.id);
      return res.redirect(302, redirectToBailleur(req, { tab: "quittances", rentResult: "partial", month: period, amount: rentReceived + chargesReceived }));
    }

    // ── action=unpaid ─────────────────────────────────────────────────────────
    {
      const { error, row } = await loadToken(token);
      if (error) return res.redirect(302, redirectToBailleur(req, { tab: "quittances", rentResult: "error", reason: error }));
      const lease = await loadLease(row);
      const period = String(row.period_start).slice(0, 7);
      await upsertPaymentAndFinance({
        row, lease, rentReceived: 0, chargesReceived: 0,
        source: "owner_unpaid_email",
        label: "Paiement partiel loyer",
        notes: `Paiement déclaré non reçu pour ${period}.`,
      });
      await markTokenUsed(row.id);
      return res.redirect(302, redirectToBailleur(req, { tab: "quittances", rentResult: "unpaid", month: period }));
    }
  } catch (e: any) {
    console.error("[api/receipts/confirm-paid] error:", e);
    const baseUrl = appBaseUrl(req);
    if (req.method === "POST" && String(req.headers["content-type"] || "").includes("application/json")) {
      return res.status(500).json({ ok: false, error: e?.message || "Erreur interne" });
    }
    return res.redirect(302, redirectToBailleur(req, { tab: "quittances", rentResult: "error", reason: e?.message || "Erreur" }));
  }
}
