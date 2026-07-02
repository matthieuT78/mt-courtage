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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseAdmin) return res.status(500).send("Supabase admin manquant.");

    const token = safeStr(req.method === "POST" ? req.body?.token : req.query.token);
    const rawAction = safeStr(req.method === "POST" ? req.body?.action : req.query.action).toLowerCase();
    const action: OwnerAction =
      rawAction === "partial" || rawAction === "unpaid" || rawAction === "full"
        ? rawAction
        : "full";

    if (!token) return res.status(400).send("Token manquant.");

    const { error, row } = await loadToken(token);
    if (error) return res.redirect(302, redirectToBailleur(req, { tab: "quittances", rentResult: "error", reason: error }));

    const lease = await loadLease(row);
    const rentPeriod = getLeaseRentPeriodFromDate(lease, row.period_start);
    if (!rentPeriod) throw new Error("Cette période est en dehors des dates du bail.");
    const rent = rentPeriod.rent;
    const charges = rentPeriod.charges;
    const period = String(row.period_start).slice(0, 7);

    if (action === "partial" && req.method !== "POST") {
      return res.status(200).send(partialForm({ token, rent, charges, period }));
    }

    if (action === "full") {
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
      return res.redirect(
        302,
        redirectToBailleur(req, {
          tab: "quittances",
          rentResult: "paid_full",
          month: period,
          receipt: result.receiptId,
          email: result.email.ok ? "sent" : "not_sent",
        })
      );
    }

    if (action === "partial") {
      const rentReceived = parseMoney(req.body?.rentReceived);
      const chargesReceived = parseMoney(req.body?.chargesReceived);
      await upsertPaymentAndFinance({
        row,
        lease,
        rentReceived,
        chargesReceived,
        source: "owner_partial_email",
        label: "Paiement partiel loyer",
        notes: `Paiement partiel pour ${period}. Quittance bloquée jusqu'au règlement complet.`,
      });
      await markTokenUsed(row.id);
      return res.redirect(
        302,
        redirectToBailleur(req, {
          tab: "quittances",
          rentResult: "partial",
          month: period,
          amount: rentReceived + chargesReceived,
        })
      );
    }

    await upsertPaymentAndFinance({
      row,
      lease,
      rentReceived: 0,
      chargesReceived: 0,
      source: "owner_unpaid_email",
      label: "Paiement partiel loyer",
      notes: `Paiement déclaré non reçu pour ${period}.`,
    });
    await markTokenUsed(row.id);
    return res.redirect(302, redirectToBailleur(req, { tab: "quittances", rentResult: "unpaid", month: period }));
  } catch (e: any) {
    console.error("[api/receipts/confirm-paid] error:", e);
    return res.redirect(302, redirectToBailleur(req, { tab: "quittances", rentResult: "error", reason: e?.message || "Erreur" }));
  }
}
