// components/landlord/sections/SectionQuittances.tsx
import React, { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle, fmtDate } from "../UiBits";
import type { RentReceipt, Lease, Property, Tenant, LandlordSettings } from "../../../lib/landlord/types";
import { usePermissions } from "../../PermissionProvider";

type AnyPayment = Record<string, any>;

type Props = {
  userId: string;
  userEmail?: string | null;
  landlord?: LandlordSettings | null;

  receipts?: RentReceipt[];
  leases?: Lease[];
  payments?: AnyPayment[]; // ✅ AJOUT (depuis DashboardShell)
  propertyById?: Map<string, Property>;
  tenantById?: Map<string, Tenant>;

  onRefresh: () => Promise<void>;
};

const LOOKBACK_MONTHS = 24;
const pad2 = (n: number) => String(n).padStart(2, "0");
const toMonthISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function parsePdfUrl(pdfUrl?: string | null) {
  // expected: rent-receipts-pdfs:<path>
  if (!pdfUrl) return null;
  const [bucket, path] = String(pdfUrl).split(":");
  if (bucket !== "rent-receipts-pdfs" || !path) return null;
  return { bucket, path };
}

function yyyymmFromReceipt(r: any) {
  const ps = String(r?.period_start || "");
  return ps ? ps.slice(0, 7) : "";
}

function safeDate(val?: string | null) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDateTimeFR(val?: string | null) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString("fr-FR");
}

async function safeJson(resp: Response) {
  const raw = await resp.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {}
  return { raw, json };
}

function apiErrorMessage(resp: Response, raw: string, json: any, fallback: string) {
  const message = json?.error || json?.message;
  if (message) return String(message);

  const cleanRaw = String(raw || "").trim();
  const isHtmlError = cleanRaw.startsWith("<!DOCTYPE") || cleanRaw.startsWith("<html");
  if (isHtmlError) {
    return `${fallback} Erreur serveur ${resp.status}. Regarde la console du serveur Next pour le détail technique.`;
  }

  return cleanRaw || `${fallback} Erreur ${resp.status}.`;
}

function throwApiError(resp: Response, raw: string, json: any, fallback: string) {
  if (!resp.ok) throw new Error(apiErrorMessage(resp, raw, json, fallback));
}

async function authJsonHeaders() {
  if (!supabase) throw new Error("Supabase n’est pas configuré.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/* ======================================================
   CALENDRIER (terme à échoir / terme échu) + J+2
====================================================== */

// ⚠️ ISO “calendaire” en local (pas UTC drift)
const toISODateLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const lastDayOfMonth = (yyyy: number, month0: number) => new Date(yyyy, month0 + 1, 0).getDate();
const clampDayInMonth = (yyyy: number, month0: number, day1to31: number) => {
  const last = lastDayOfMonth(yyyy, month0);
  return Math.min(Math.max(1, day1to31), last);
};

function monthStartEnd(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start, end };
}

function recentMonths(count = LOOKBACK_MONTHS, base = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(base.getFullYear(), base.getMonth() - index, 1);
    return toMonthISO(d);
  });
}

function periodKey(leaseId: string, yyyymm: string) {
  return `${leaseId}__${yyyymm}`;
}

function dateOnlyTime(v?: string | null) {
  if (!v) return 0;
  const d = new Date(v.slice(0, 10));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function isLeaseExpectedForMonth(lease: Lease, yyyymm: string) {
  const { start, end } = monthStartEnd(yyyymm);
  const status = String((lease as any).status || "").toLowerCase();
  if (status === "draft") return false;
  if (status === "ended" && !lease.end_date) return false;
  if (lease.start_date && dateOnlyTime(lease.start_date) > end.getTime()) return false;
  if (lease.end_date && dateOnlyTime(lease.end_date) < start.getTime()) return false;
  return status === "active" || status === "ended" || (!status && !!lease.start_date);
}

/**
 * Calcul “échéance” + “date génération (J+2)” pour la période yyyymm,
 * selon payment_type :
 * - terme_a_echoir  => échéance dans le mois de la période
 * - terme_echu      => échéance dans le mois suivant la période
 */
function scheduleForPeriod(yyyymmPeriod: string, lease: any) {
  const paymentDayRaw = Number(lease?.payment_day || 1);
  const paymentType = String(lease?.payment_type || "terme_a_echoir").toLowerCase();

  const [y, m1] = yyyymmPeriod.split("-").map(Number);
  const month0 = m1 - 1;

  const periodStart = new Date(y, month0, 1);
  const periodEnd = new Date(y, month0 + 1, 0);

  let dueYear = y;
  let dueMonth0 = month0;

  if (paymentType === "terme_echu") {
    // échéance dans le mois suivant la période
    const next = new Date(y, month0 + 1, 1);
    dueYear = next.getFullYear();
    dueMonth0 = next.getMonth();
  }

  const dueDay = clampDayInMonth(dueYear, dueMonth0, paymentDayRaw);
  const dueDate = new Date(dueYear, dueMonth0, dueDay);

  const generateAt = new Date(dueDate);
  generateAt.setDate(generateAt.getDate() + 2);

  return { periodStart, periodEnd, dueDate, generateAt, paymentType };
}

function pillToneReceipt(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "sent") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (s === "generated") return "bg-amber-100 text-amber-900 border-amber-200";
  if (s === "draft") return "bg-slate-100 text-slate-800 border-slate-200";
  if (s === "error") return "bg-red-100 text-red-900 border-red-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function statusLabelReceipt(status?: string | null) {
  const s = String(status || "").toLowerCase();
  if (s === "sent") return "Envoyée";
  if (s === "generated") return "PDF prêt";
  if (s === "draft") return "Brouillon";
  if (s === "error") return "Erreur";
  if (!s) return "—";
  return status!;
}

function paymentTypeLabel(v?: string | null) {
  const t = String(v || "terme_a_echoir").toLowerCase();
  return t === "terme_echu" ? "Fin de période (terme échu)" : "Début de période (terme à échoir)";
}

type PaymentStatus = "paid" | "partial" | "charges_missing" | "pending" | "unknown";

function pillTonePay(status: PaymentStatus) {
  if (status === "paid") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (status === "partial" || status === "charges_missing") return "bg-orange-100 text-orange-900 border-orange-200";
  if (status === "pending") return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function payLabel(status: PaymentStatus) {
  if (status === "paid") return "Payé";
  if (status === "partial") return "Paiement incomplet";
  if (status === "charges_missing") return "Charges manquantes";
  if (status === "pending") return "À payer";
  return "Inconnu";
}

function paymentAnalysis(lease: Lease, payment: AnyPayment | null): {
  status: PaymentStatus;
  expectedRent: number;
  expectedCharges: number;
  expectedTotal: number;
  receivedRent: number;
  receivedCharges: number;
  receivedTotal: number;
  missingAmount: number;
  reminderReason: "unpaid" | "partial" | "charges_missing" | null;
} {
  const expectedRent = Number((lease as any)?.rent_amount || 0);
  const expectedCharges = Number((lease as any)?.charges_amount || 0);
  const expectedTotal = expectedRent + expectedCharges;
  const receivedRent = Number(payment?.rent_amount || 0);
  const receivedCharges = Number(payment?.charges_amount || 0);
  const receivedTotal = Number(payment?.total_amount || 0);
  const paid = payment ? isPaymentPaid(payment) : false;

  if (!payment || !paid) {
    return { status: "pending", expectedRent, expectedCharges, expectedTotal, receivedRent, receivedCharges, receivedTotal, missingAmount: expectedTotal, reminderReason: "unpaid" };
  }

  const missingAmount = Math.max(0, expectedTotal - receivedTotal);
  if (expectedCharges > 0 && receivedTotal >= expectedRent && receivedCharges < expectedCharges) {
    return { status: "charges_missing", expectedRent, expectedCharges, expectedTotal, receivedRent, receivedCharges, receivedTotal, missingAmount: Math.max(0, expectedCharges - receivedCharges), reminderReason: "charges_missing" };
  }
  if (receivedTotal + 0.01 < expectedTotal) {
    return { status: "partial", expectedRent, expectedCharges, expectedTotal, receivedRent, receivedCharges, receivedTotal, missingAmount, reminderReason: "partial" };
  }

  return { status: "paid", expectedRent, expectedCharges, expectedTotal, receivedRent, receivedCharges, receivedTotal, missingAmount: 0, reminderReason: null };
}

function Card({
  title,
  children,
  right,
  tone = "white",
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
  tone?: "white" | "muted";
}) {
  return (
    <div className={cx("rounded-3xl border border-slate-200 shadow-sm", tone === "muted" ? "bg-slate-50" : "bg-white")}>
      <div className="p-4 md:p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-4 md:px-5 pb-4 md:pb-5">{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-600">{sub}</p> : null}
    </div>
  );
}

/* ======================================================
   PAIEMENTS : mapping “période payée ?”
   (robuste aux champs exacts)
====================================================== */

function yyyymmFromPayment(p: AnyPayment): string {
  // priorités: p.period (YYYY-MM) > p.period_start > paid_for_month > created_at (fallback)
  const period = String(p?.period || "");
  if (/^\d{4}-\d{2}$/.test(period)) return period;

  const ps = String(p?.period_start || "");
  if (ps && ps.length >= 7) return ps.slice(0, 7);

  const pfm = String(p?.paid_for_month || "");
  if (/^\d{4}-\d{2}$/.test(pfm)) return pfm;

  const ca = String(p?.created_at || "");
  if (ca && ca.length >= 7) return ca.slice(0, 7);

  return "";
}

function isPaymentPaid(p: AnyPayment): boolean {
  const st = String(p?.status || "").toLowerCase();
  if (st === "paid" || st === "ok" || st === "confirmed") return true;
  if (p?.paid_at) return true;
  if (p?.confirmed_at) return true;
  return false;
}

export function SectionQuittances({
  userId,
  userEmail,
  landlord,
  receipts,
  leases,
  payments,
  propertyById,
  tenantById,
  onRefresh,
}: Props) {
  const { canUseLandlord } = usePermissions();
  const canUseReceiptAutomation = canUseLandlord;
  const safeReceipts = Array.isArray(receipts) ? receipts : [];
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const propsById = propertyById instanceof Map ? propertyById : new Map<string, Property>();
  const tenantsById = tenantById instanceof Map ? tenantById : new Map<string, Tenant>();

  const [view, setView] = useState<"todo" | "month">("todo");
  const [month, setMonth] = useState<string>(toMonthISO(new Date()));
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selectedReceipt = useMemo(
    () => safeReceipts.find((r: any) => r.id === selectedReceiptId) || null,
    [safeReceipts, selectedReceiptId]
  );

  const leaseLabel = (lease: Lease) => {
    const p = propsById.get((lease as any).property_id);
    const t = tenantsById.get((lease as any).tenant_id);
    return `${p?.label || "Bien"} — ${t?.full_name || "Locataire"}`;
  };

  const paymentByPeriod = useMemo(() => {
    const map = new Map<string, AnyPayment>();
    for (const p of safePayments) {
      const leaseId = String(p?.lease_id || "");
      const yyyymm = yyyymmFromPayment(p);
      if (!leaseId || !yyyymm) continue;
      const key = periodKey(leaseId, yyyymm);
      const existing = map.get(key);
      if (!existing || String(p?.updated_at || p?.created_at || "").localeCompare(String(existing?.updated_at || existing?.created_at || "")) > 0) {
        map.set(key, p);
      }
    }
    return map;
  }, [safePayments]);

  const receiptByPeriod = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of safeReceipts as any[]) {
      const leaseId = String(r?.lease_id || "");
      const yyyymm = yyyymmFromReceipt(r);
      if (!leaseId || !yyyymm) continue;
      map.set(periodKey(leaseId, yyyymm), r);
    }
    return map;
  }, [safeReceipts]);

  // ---------- Receipts du mois sélectionné
  const monthReceipts = useMemo(() => {
    return safeReceipts
      .filter((r: any) => yyyymmFromReceipt(r) === month)
      .sort((a: any, b: any) => String(b.period_start).localeCompare(String(a.period_start)));
  }, [safeReceipts, month]);

  const buildRowsForMonth = (yyyymm: string) => {
    const { start, end } = monthStartEnd(yyyymm);
    return safeLeases
      .filter((lease) => isLeaseExpectedForMonth(lease, yyyymm))
      .map((lease) => {
        const key = periodKey(lease.id, yyyymm);
        const receipt = receiptByPeriod.get(key) || null;
        const payment = paymentByPeriod.get(key) || null;
        const pay = paymentAnalysis(lease, payment);
        const payStatus = pay.status;
        const receiptStatus = String(receipt?.status || "").toLowerCase();
        const pdfReady = !!receipt?.pdf_url && (receiptStatus === "generated" || receiptStatus === "sent");
        const sent = receiptStatus === "sent" || !!receipt?.sent_at;
        const sched = scheduleForPeriod(yyyymm, lease);
        const isLate = payStatus !== "paid" && Date.now() > sched.generateAt.getTime();

        return {
          key,
          month: yyyymm,
          lease,
          receipt,
          payment,
          payStatus: payStatus as PaymentStatus,
          pay,
          receiptStatus,
          pdfReady,
          sent,
          sched,
          isLate,
          periodStart: toISODateLocal(start),
          periodEnd: toISODateLocal(end),
        };
      })
      .sort((a, b) => {
        if (a.isLate !== b.isLate) return a.isLate ? -1 : 1;
        if (a.sent !== b.sent) return a.sent ? 1 : -1;
        if (a.payStatus !== b.payStatus) return a.payStatus === "paid" ? 1 : -1;
        if (a.month !== b.month) return b.month.localeCompare(a.month);
        return leaseLabel(a.lease).localeCompare(leaseLabel(b.lease));
      });
  };

  const expectedRows = useMemo(() => {
    return buildRowsForMonth(month);
  }, [safeLeases, month, receiptByPeriod, paymentByPeriod]);

  const todoRows = useMemo(() => {
    return recentMonths()
      .flatMap((yyyymm) => buildRowsForMonth(yyyymm))
      .filter((row) => !row.sent)
      .sort((a, b) => {
        if (a.isLate !== b.isLate) return a.isLate ? -1 : 1;
        if (a.payStatus !== b.payStatus) return a.payStatus === "pending" ? -1 : 1;
        if (a.pdfReady !== b.pdfReady) return a.pdfReady ? -1 : 1;
        if (a.month !== b.month) return a.month.localeCompare(b.month);
        return leaseLabel(a.lease).localeCompare(leaseLabel(b.lease));
      });
  }, [safeLeases, receiptByPeriod, paymentByPeriod, propsById, tenantsById]);

  const visibleRows = view === "todo" ? todoRows : expectedRows;

  // ✅ “PDF prêts” = generated (après paiement)
  // ✅ “Envoyées” = sent
  const sentThisMonth = useMemo(() => {
    return monthReceipts.filter((r: any) => String(r.status || "").toLowerCase() === "sent");
  }, [monthReceipts]);

  // ---------- Dashboard
  const dashboard = useMemo(() => {
    const total = visibleRows.length;
    const paidCount = visibleRows.filter((row) => row.payStatus === "paid").length;
    const pdfReady = visibleRows.filter((row) => row.pdfReady && !row.sent).length;
    const sent = visibleRows.filter((row) => row.sent).length;
    const late = visibleRows.filter((row) => row.isLate).length;

    const lastSent = safeReceipts
      .filter((r: any) => (r.sent_at ? true : false))
      .map((r: any) => safeDate(r.sent_at))
      .filter(Boolean) as Date[];

    const lastSentAt = lastSent.length ? new Date(Math.max(...lastSent.map((d) => d.getTime()))) : null;

    return { total, paidCount, pdfReady, sent, late, lastSentAt };
  }, [visibleRows, safeReceipts]);

  // ---------- Archives groupées (Biens -> Année -> Mois)
  const archives = useMemo(() => {
    const byProperty = new Map<
      string,
      {
        propertyId: string;
        label: string;
        years: Map<string, any[]>;
      }
    >();

    for (const r of safeReceipts as any[]) {
      const lease = safeLeases.find((l: any) => l.id === r.lease_id) as any;
      const propertyId = String(lease?.property_id || "—");
      const p = propertyId !== "—" ? propsById.get(propertyId) : null;
      const propLabel = p?.label || "Non affecté";

      const yyyymm = yyyymmFromReceipt(r);
      const year = yyyymm ? yyyymm.slice(0, 4) : "—";

      const bucket = byProperty.get(propertyId) || {
        propertyId,
        label: propLabel,
        years: new Map<string, any[]>(),
      };

      const arr = bucket.years.get(year) || [];
      arr.push(r);
      bucket.years.set(year, arr);
      byProperty.set(propertyId, bucket);
    }

    const propsArr = Array.from(byProperty.values()).sort((a, b) => a.label.localeCompare(b.label));

    for (const p of propsArr) {
      for (const [y, arr] of Array.from(p.years.entries())) {
        arr.sort((a: any, b: any) => String(b.period_start).localeCompare(String(a.period_start)));
        p.years.set(y, arr);
      }
    }

    return propsArr;
  }, [safeReceipts, safeLeases, propsById]);

  // ---------- Actions
  const openPdf = async (r: any) => {
    setErr(null);
    setOk(null);

    const parsed = parsePdfUrl(r?.pdf_url);
    if (!parsed) {
      setErr("PDF manquant ou pdf_url invalide. (Attendu rent-receipts-pdfs:<path>)");
      return;
    }

    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/receipts/signed-url", {
        method: "POST",
        headers,
        body: JSON.stringify({ receiptId: r.id, pdf_url: r.pdf_url }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Impossible d’ouvrir le PDF.");

      if (json?.signedUrl) window.open(json.signedUrl, "_blank", "noopener,noreferrer");
      else setErr("SignedUrl manquant.");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’ouvrir le PDF.");
    } finally {
      setLoading(false);
    }
  };

  const confirmPaymentForRow = async (row: any) => {
    setErr(null);
    setOk(null);

    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/payments/confirm", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          leaseId: row.lease.id,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
        }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur confirmation paiement.");

      const genResp = await fetch("/api/receipts/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          leaseId: row.lease.id,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
        }),
      });

      const generated = await safeJson(genResp);
      throwApiError(genResp, generated.raw, generated.json, "Paiement confirmé, mais la génération de la quittance a échoué.");

      setOk("Paiement confirmé ✅ Quittance générée automatiquement.");
      await onRefresh();
      if (generated.json?.receipt_id) setSelectedReceiptId(generated.json.receipt_id);
    } catch (e: any) {
      setErr(e?.message || "Erreur confirmation paiement.");
    } finally {
      setLoading(false);
    }
  };

  const generatePdfForRow = async (row: any) => {
    setErr(null);
    setOk(null);

    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/receipts/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          leaseId: row.lease.id,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
        }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur génération PDF.");

      setOk("PDF généré ✅");
      await onRefresh();
      if (json?.receipt_id) setSelectedReceiptId(json.receipt_id);
      if (json?.signedUrl) window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message || "Erreur génération PDF.");
    } finally {
      setLoading(false);
    }
  };

  const sendReceiptForRow = async (row: any) => {
    const receipt = row.receipt;
    if (!receipt?.id) {
      setErr("Génère d’abord le PDF avant l’envoi.");
      return;
    }
    if (!canUseReceiptAutomation) {
      setErr("L’envoi par email est réservé aux abonnements payants. En gratuit, tu peux générer le PDF et le remettre manuellement au locataire.");
      setOk(null);
      return;
    }

    setErr(null);
    setOk(null);

    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/receipts/send", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, receiptId: receipt.id, resendOnly: true }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur envoi quittance.");

      setOk("Quittance envoyée ✅");
      await onRefresh();
      if (json?.signedUrl) window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message || "Erreur envoi quittance.");
    } finally {
      setLoading(false);
    }
  };

  const sendPaymentReminderForRow = async (row: any) => {
    const reason = row?.pay?.reminderReason;
    if (!reason) {
      setErr("Aucune relance à envoyer : le paiement semble complet.");
      setOk(null);
      return;
    }
    if (!canUseReceiptAutomation) {
      setErr("L’envoi de relance par email est réservé aux abonnements payants. Tu peux tout de même suivre les retards dans cette vue.");
      setOk(null);
      return;
    }

    const missing = Number(row?.pay?.missingAmount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
    const label =
      reason === "charges_missing"
        ? `charges manquantes (${missing})`
        : reason === "partial"
        ? `paiement incomplet (${missing} restant)`
        : `loyer non reçu (${missing})`;

    if (!confirm(`Envoyer une relance au locataire pour ${label} ?`)) return;

    setErr(null);
    setOk(null);

    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/payments/reminder", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          leaseId: row.lease.id,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          reason,
        }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur envoi relance.");

      setOk("Relance envoyée au locataire ✅");
      await onRefresh();
    } catch (e: any) {
      setErr(e?.message || "Erreur envoi relance.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ “Marquer payé” (source de vérité paiement)
  const confirmPaidFromApp = async (receipt: any) => {
    setErr(null);
    setOk(null);
    if (!receipt?.id) return;
    if (!canUseReceiptAutomation) {
      setErr(
        "Cette action confirme puis envoie automatiquement la quittance : elle est réservée aux abonnements payants. Utilise le workflow manuel : confirmer payé, générer PDF, puis remettre le PDF."
      );
      return;
    }

    const landlordEmail = (userEmail || "").trim() || null;

    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/receipts/confirm-manual", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          receiptId: receipt.id,
          landlordEmail,
        }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur confirmation paiement.");

      setOk("Paiement confirmé ✅ (Finance mise à jour. La quittance pourra être générée/envoyée selon config).");
      await onRefresh();
    } catch (e: any) {
      setErr(e?.message || "Erreur confirmation paiement.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Renvoyer sans toucher Finance
  const resendArchivedNoFinance = async (receipt: any) => {
    setErr(null);
    setOk(null);
    if (!canUseReceiptAutomation) {
      setErr("Le renvoi par email est réservé aux abonnements payants. Le PDF reste consultable et régénérable en gratuit.");
      return;
    }

    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/receipts/send", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, receiptId: receipt.id, resendOnly: true }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur renvoi quittance.");

      setOk("Quittance renvoyée ✅ (sans impact Finance).");
      await onRefresh();

      if (json?.signedUrl) window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message || "Erreur renvoi quittance.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Régénérer PDF (sans finance)
  const regeneratePdfNoFinance = async (receipt: any) => {
    setErr(null);
    setOk(null);

    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/receipts/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          leaseId: receipt.lease_id,
          periodStart: receipt.period_start,
          periodEnd: receipt.period_end,
        }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur régénération PDF.");

      setOk("PDF régénéré ✅");
      await onRefresh();

      if (json?.signedUrl) window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message || "Erreur régénération PDF.");
    } finally {
      setLoading(false);
    }
  };

  const monthLabel = useMemo(() => {
    const { start } = monthStartEnd(month);
    return start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }, [month]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Quittances"
        title="Quittance = reçu (après paiement)"
        desc="En gratuit : suivi manuel, génération PDF et archive. En abonnement : rappels, emails et envoi automatique au locataire."
      />

      {/* Notice */}
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Règle (importante)</p>
            <ol className="mt-2 space-y-1 text-sm text-slate-700 list-decimal pl-5">
              <li>Une quittance atteste que le loyer/charges ont été payés.</li>
              <li>Tant que le mois n’est pas marqué “Payé”, on ne génère pas de quittance.</li>
              <li>Après “Payé”, tu peux générer et ouvrir le PDF. L’envoi email est réservé aux abonnements payants.</li>
            </ol>
          </div>
        </div>
      </div>

      {!canUseReceiptAutomation ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Mode gratuit : quittances manuelles incluses</p>
          <p className="mt-1 text-amber-950/85">
            Tu peux confirmer le paiement, générer le PDF, le consulter et conserver l’historique. Les boutons d’envoi email, renvoi, rappels
            bailleur et automatisations sont disponibles avec un abonnement payant.
          </p>
        </div>
      ) : null}

      {/* Messages */}
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}

      {/* Workflow selector + KPI */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Vue</label>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {[
                ["todo", `À traiter (${todoRows.length})`],
                ["month", "Mois choisi"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setView(value as "todo" | "month")}
                  className={cx(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    view === value ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={cx("space-y-1", view === "todo" && "opacity-60")}>
            <label className="text-[0.7rem] text-slate-700">Mois (période)</label>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setSelectedReceiptId(null);
                setMonth(e.target.value);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="max-w-md text-[0.75rem] text-slate-500">
            {view === "todo" ? (
              <>
                Tous les workflows ouverts sur les <span className="font-semibold text-slate-900">{LOOKBACK_MONTHS} derniers mois</span>.
              </>
            ) : (
              <>
                Vue : <span className="font-semibold text-slate-900">{monthLabel}</span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setErr(null);
            setOk(null);
            setLoading(true);
            try {
              await onRefresh();
              setOk("Données rafraîchies ✅");
            } catch (e: any) {
              setErr(e?.message || "Erreur rafraîchissement.");
            } finally {
              setLoading(false);
            }
          }}
          className={cx("rounded-full px-4 py-2 text-sm font-semibold text-white", "bg-slate-900 hover:bg-slate-800", loading && "opacity-60")}
        >
          {loading ? "…" : "Rafraîchir"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Kpi label={view === "todo" ? "À traiter" : "Reçus (période)"} value={dashboard.total} sub={view === "todo" ? "workflows ouverts" : "toutes lignes du mois"} />
        <Kpi label="Payés" value={dashboard.paidCount} sub="source de vérité paiement" />
        <Kpi label="PDF prêts" value={dashboard.pdfReady} sub="après paiement" />
        <Kpi label="Envoyées" value={dashboard.sent} sub={canUseReceiptAutomation ? "email envoyé" : "premium"} />
        <Kpi
          label="Retards"
          value={<span className={dashboard.late > 0 ? "text-red-700" : ""}>{dashboard.late}</span>}
          sub="après J+2, toujours pas payé"
        />
      </div>

      {/* Bloc principal */}
      <div className="grid gap-5 lg:grid-cols-[1fr,420px]">
        <Card
          title={
            <span>
              {view === "todo" ? "À traiter" : "Workflow du mois"} <span className="text-slate-500">({visibleRows.length})</span>
            </span>
          }
          right={
            dashboard.late ? (
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                {dashboard.late} retards
              </span>
            ) : (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">OK</span>
            )
          }
          tone="muted"
        >
          {visibleRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-700">
              {view === "todo" ? "Rien à traiter : aucun workflow ouvert sur les derniers mois." : "Aucun bail actif à traiter pour cette période."}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleRows.map((row) => {
                const lease = row.lease;
                const receipt = row.receipt;
                const label = leaseLabel(lease);
                const t = tenantsById.get(String((lease as any).tenant_id));
                const receiptStatus = row.receiptStatus;
                const pdfReady = row.pdfReady;

                return (
                  <div
                    key={row.key}
                    className={cx("rounded-2xl border p-3 bg-white flex flex-col gap-2", row.isLate ? "border-red-200" : "border-slate-200")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
                        <p className="text-xs text-slate-600">
                          Période : {fmtDate(row.periodStart)} → {fmtDate(row.periodEnd)}
                          {view === "todo" ? <span className="font-semibold text-slate-900"> ({row.month})</span> : null}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Échéance : <span className="font-semibold">{toISODateLocal(row.sched.dueDate)}</span>{" "}
                          <span className="text-slate-400">•</span>{" "}
                          <span className="text-slate-600">{paymentTypeLabel((lease as any).payment_type)}</span>{" "}
                          <span className="text-slate-400">•</span> Contrôle J+2 :{" "}
                          <span className="font-semibold">{toISODateLocal(row.sched.generateAt)}</span>
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", pillTonePay(row.payStatus))}>
                            {payLabel(row.payStatus)}
                          </span>

                          <span
                            className={cx(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold",
                              pillToneReceipt(receiptStatus)
                            )}
                          >
                            {receipt ? statusLabelReceipt(receiptStatus) : "Quittance à créer"}
                          </span>

                          {t?.email ? (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.7rem] font-semibold text-slate-700">
                              Email OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-800">
                              Email locataire manquant
                            </span>
                          )}

                          {row.payStatus === "partial" || row.payStatus === "charges_missing" ? (
                            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[0.7rem] font-semibold text-orange-900">
                              Reste {Number(row.pay.missingAmount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex min-w-[142px] flex-col gap-2">
                        {row.payStatus !== "paid" ? (
                          <>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => confirmPaymentForRow(row)}
                              className={cx("rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800", loading && "opacity-60")}
                              title="Confirme le paiement complet reçu pour cette période."
                            >
                              {row.payStatus === "partial" || row.payStatus === "charges_missing" ? "Solde reçu" : "Confirmer payé"}
                            </button>
                            <button
                              type="button"
                              disabled={loading || !canUseReceiptAutomation}
                              onClick={() => sendPaymentReminderForRow(row)}
                              className={cx(
                                "rounded-full border px-4 py-2 text-xs font-semibold",
                                canUseReceiptAutomation
                                  ? "border-orange-200 bg-orange-50 text-orange-900 hover:bg-orange-100"
                                  : "border-slate-200 bg-slate-100 text-slate-500",
                                (loading || !canUseReceiptAutomation) && "opacity-60"
                              )}
                              title={canUseReceiptAutomation ? "Envoie une relance au locataire après validation." : "Relance email réservée aux abonnements payants."}
                            >
                              {canUseReceiptAutomation ? "Relancer" : "Relance premium"}
                            </button>
                          </>
                        ) : !pdfReady ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => generatePdfForRow(row)}
                            className={cx("rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600", loading && "opacity-60")}
                            title="Génère la quittance PDF après paiement confirmé."
                          >
                            Générer PDF
                          </button>
                        ) : !row.sent ? (
                          <button
                            type="button"
                            disabled={loading || !canUseReceiptAutomation}
                            onClick={() => sendReceiptForRow(row)}
                            className={cx(
                              "rounded-full px-4 py-2 text-xs font-semibold text-white",
                              canUseReceiptAutomation ? "bg-sky-700 hover:bg-sky-600" : "bg-slate-400",
                              (loading || !canUseReceiptAutomation) && "opacity-60"
                            )}
                            title={canUseReceiptAutomation ? "Envoie la quittance au locataire." : "Envoi email réservé aux abonnements payants."}
                          >
                            {canUseReceiptAutomation ? "Envoyer" : "Envoi premium"}
                          </button>
                        ) : (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-semibold text-emerald-800">
                            Terminé
                          </span>
                        )}

                        <button
                          type="button"
                          disabled={loading || !pdfReady}
                          onClick={() => receipt && openPdf(receipt)}
                          className={cx(
                            "rounded-full px-4 py-2 text-xs font-semibold",
                            "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
                            (!pdfReady || loading) && "opacity-60"
                          )}
                          title={pdfReady ? "Ouvrir le PDF de quittance" : "PDF indisponible tant que la quittance n’est pas générée"}
                        >
                          Voir PDF
                        </button>
                      </div>
                    </div>

                    {row.isLate ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        Retard : après <span className="font-semibold">{toISODateLocal(row.sched.generateAt)}</span>, le mois n’est toujours pas réglé complètement.
                      </div>
                    ) : null}

                    {row.payStatus !== "paid" ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {row.payStatus === "charges_missing"
                          ? "Charges manquantes : la quittance attend le règlement complet loyer + charges."
                          : row.payStatus === "partial"
                          ? "Paiement incomplet : la quittance attend le solde avant génération."
                          : "Quittance non générable avant paiement confirmé."}
                      </div>
                    ) : row.payStatus === "paid" && !pdfReady ? (
                      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                        Paiement confirmé : tu peux générer la quittance PDF.
                      </div>
                    ) : pdfReady && !row.sent ? (
                      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                        PDF prêt : vérifie puis envoie au locataire.
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Envoyées (période)" right={<span className="text-sm text-slate-500">{sentThisMonth.length}</span>}>
          {sentThisMonth.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucune quittance envoyée sur cette période.
            </div>
          ) : (
            <div className="space-y-2">
              {sentThisMonth.slice(0, 8).map((r: any) => {
                const lease = safeLeases.find((l: any) => l.id === r.lease_id) as any;
                const label = lease ? leaseLabel(lease) : `Bail ${r.lease_id}`;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReceiptId(r.id)}
                    className={cx(
                      "w-full text-left rounded-2xl border px-3 py-2",
                      selectedReceiptId === r.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
                      <span className={cx("rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", pillToneReceipt(r.status))}>
                        {statusLabelReceipt(r.status)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Last sent : <span className="font-semibold">{r.sent_at ? fmtDateTimeFR(r.sent_at) : "—"}</span>
                    </p>
                  </button>
                );
              })}
              {sentThisMonth.length > 8 ? <p className="text-xs text-slate-500">+ {sentThisMonth.length - 8} autres (voir archives)</p> : null}
            </div>
          )}

          {selectedReceipt ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-slate-900">Actions rapides</p>
              <p className="text-xs text-slate-600">
                Sélection : <span className="font-semibold">{fmtDate((selectedReceipt as any).period_start)}</span> →{" "}
                <span className="font-semibold">{fmtDate((selectedReceipt as any).period_end)}</span>
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => openPdf(selectedReceipt)}
                  className={cx("rounded-full px-4 py-2 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50", loading && "opacity-60")}
                >
                  👁️ Ouvrir PDF
                </button>

                <button
                  type="button"
                  disabled={loading || !canUseReceiptAutomation}
                  onClick={() => resendArchivedNoFinance(selectedReceipt)}
                  className={cx(
                    "rounded-full px-4 py-2 text-xs font-semibold border",
                    canUseReceiptAutomation
                      ? "border-slate-300 bg-white hover:bg-slate-50"
                      : "border-slate-200 bg-slate-100 text-slate-500",
                    (loading || !canUseReceiptAutomation) && "opacity-60"
                  )}
                  title={canUseReceiptAutomation ? "Renvoyer sans toucher la Finance" : "Renvoi email réservé aux abonnements payants"}
                >
                  {canUseReceiptAutomation ? "🔁 Renvoyer (sans Finance)" : "Envoi premium"}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => regeneratePdfNoFinance(selectedReceipt)}
                  className={cx("rounded-full px-4 py-2 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50", loading && "opacity-60")}
                  title="Régénère le PDF (sans toucher la Finance)"
                >
                  ♻️ Régénérer PDF
                </button>
              </div>

              <p className="text-xs text-slate-500">
                “Régénérer PDF” met à jour le PDF dans le bucket. Le renvoi email est une fonctionnalité payante.
              </p>
            </div>
          ) : null}
        </Card>
      </div>

      {/* ARCHIVES */}
      <div className="pt-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Archives</p>
            <p className="text-[0.8rem] text-slate-600">Toutes les quittances, regroupées par bien puis année.</p>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {archives.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-sm text-slate-700">
              Aucune archive pour le moment.
            </div>
          ) : (
            archives.map((p) => (
              <details key={p.propertyId} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">🏠</span>
                    <span className="text-sm font-semibold text-slate-900 truncate">{p.label}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {Array.from(p.years.values()).reduce((acc, arr) => acc + arr.length, 0)} quittances
                  </span>
                </summary>

                <div className="px-4 pb-4 space-y-3">
                  {Array.from(p.years.entries())
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([year, arr]) => (
                      <div key={year} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900">{year}</p>

                        <div className="mt-2 overflow-auto rounded-2xl border border-slate-200 bg-white">
                          <table className="min-w-[900px] w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr className="text-left">
                                <th className="px-3 py-2 text-xs text-slate-600">Période</th>
                                <th className="px-3 py-2 text-xs                                text-slate-600">Locataire</th>
                                <th className="px-3 py-2 text-xs text-slate-600">Statut</th>
                                <th className="px-3 py-2 text-xs text-slate-600 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {arr.map((r: any) => {
                                const lease = safeLeases.find((l: any) => l.id === r.lease_id) as any;
                                const t = lease ? tenantsById.get(String(lease.tenant_id)) : null;

                                const receiptStatus = String(r.status || "").toLowerCase();
                                const sentAtTip = r.sent_at ? `Dernier envoi : ${fmtDateTimeFR(r.sent_at)}` : "Jamais envoyé";

                                return (
                                  <tr key={r.id} className="border-b border-slate-100">
                                    <td className="px-3 py-2 text-slate-700">
                                      {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
                                    </td>

                                    <td className="px-3 py-2 text-slate-700">{(t as any)?.full_name || "—"}</td>

                                    {/* ✅ Statut : tooltip "last sent" AU SURVOL (title) */}
                                    <td className="px-3 py-2">
                                      <span
                                        title={receiptStatus === "sent" ? sentAtTip : undefined}
                                        className={cx(
                                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold",
                                          pillToneReceipt(receiptStatus)
                                        )}
                                      >
                                        {statusLabelReceipt(receiptStatus)}
                                      </span>
                                    </td>

                                    {/* ✅ Plus de colonne "Last sent" -> libère de la place */}
                                    <td className="px-3 py-2 text-right">
                                      <div className="inline-flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => openPdf(r)}
                                          disabled={loading}
                                          className={cx(
                                            "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50",
                                            loading && "opacity-60"
                                          )}
                                        >
                                          👁️ PDF
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => resendArchivedNoFinance(r)}
                                          disabled={loading || !canUseReceiptAutomation}
                                          className={cx(
                                            "rounded-full border px-3 py-1.5 text-xs font-semibold",
                                            canUseReceiptAutomation
                                              ? "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                                              : "border-slate-200 bg-slate-100 text-slate-500",
                                            (loading || !canUseReceiptAutomation) && "opacity-60"
                                          )}
                                          title={canUseReceiptAutomation ? "Renvoyer sans toucher la Finance" : "Renvoi email réservé aux abonnements payants"}
                                        >
                                          {canUseReceiptAutomation ? "🔁 Renvoyer" : "Premium"}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => regeneratePdfNoFinance(r)}
                                          disabled={loading}
                                          className={cx(
                                            "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50",
                                            loading && "opacity-60"
                                          )}
                                          title="Régénérer le PDF (sans toucher la Finance)"
                                        >
                                          ♻️ Régénérer
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
