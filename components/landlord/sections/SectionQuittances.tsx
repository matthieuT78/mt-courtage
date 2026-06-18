// components/landlord/sections/SectionQuittances.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle, WorkflowIntro, fmtDate } from "../UiBits";
import type { RentReceipt, Lease, Property, Tenant, LandlordSettings } from "../../../lib/landlord/types";
import { getLeaseRentPeriod } from "../../../lib/rentPeriod";
import { usePermissions } from "../../PermissionProvider";
import { isSelectableLeaseLike } from "../../../lib/landlord/archiveFilters";

type AnyPayment = Record<string, any>;
type ReminderChannelSetting = "email" | "messaging" | "both";
type ReminderSetting = { lease_id: string; auto_enabled: boolean; default_channel: ReminderChannelSetting };
type ReminderDraft = {
  row: any;
  body: string;
  channels: Array<"email" | "messaging">;
  emailAvailable: boolean;
  messagingAvailable: boolean;
  history: any[];
};

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
const RECEIPT_SNOOZE_STORAGE_PREFIX = "lokt.receiptSnoozes";
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

function openBlankPdfWindow() {
  const opened = window.open("about:blank", "_blank");
  if (!opened) return null;
  opened.document.write("<p style=\"font-family:system-ui,sans-serif;padding:24px\">Ouverture du PDF...</p>");
  return opened;
}

function openPdfUrl(url: string, opened?: Window | null) {
  if (opened) {
    opened.location.href = url;
    return;
  }

  const next = window.open(url, "_blank", "noopener,noreferrer");
  if (!next) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
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

// ⚠️ ISO "calendaire" en local (pas UTC drift)
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

function canSnoozeReceiptTask(row: any) {
  return row?.payStatus === "paid" && !row?.sent;
}

function dateOnlyTime(v?: string | null) {
  if (!v) return 0;
  const d = new Date(v.slice(0, 10));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function isLeaseExpectedForMonth(lease: Lease, yyyymm: string) {
  const { start, end } = monthStartEnd(yyyymm);
  const status = String((lease as any).status || "").toLowerCase();
  if (["draft", "archived", "inactive", "deleted", "ended"].includes(status)) return false;
  if (lease.start_date && dateOnlyTime(lease.start_date) > end.getTime()) return false;
  if (lease.end_date && dateOnlyTime(lease.end_date) < start.getTime()) return false;
  return status === "active" || (!status && !!lease.start_date);
}

/**
 * Calcul "échéance" + "date génération (J+2)" pour la période yyyymm,
 * selon payment_type :
 * - terme_a_echoir  => échéance dans le mois de la période
 * - terme_echu      => échéance en fin de mois de la période
 */
function scheduleForPeriod(yyyymmPeriod: string, lease: any) {
  const paymentDayRaw = Number(lease?.payment_day || 1);
  const paymentType = String(lease?.payment_type || "terme_a_echoir").toLowerCase();

  const [y, m1] = yyyymmPeriod.split("-").map(Number);
  const month0 = m1 - 1;

  const periodStart = new Date(y, month0, 1);
  const periodEnd = new Date(y, month0 + 1, 0);

  const dueDay = clampDayInMonth(y, month0, paymentDayRaw);
  const dueDate = new Date(y, month0, dueDay);

  const controlAt = new Date(dueDate);
  controlAt.setDate(controlAt.getDate() + 2);

  return { periodStart, periodEnd, dueDate, controlAt, paymentType };
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

function isWorkflowReceipt(receipt: any) {
  const status = String(receipt?.status || "").toLowerCase();
  return status === "generated" || status === "sent";
}

function paymentTypeLabel(v?: string | null) {
  const t = String(v || "terme_a_echoir").toLowerCase();
  return t === "terme_echu" ? "Fin de période (terme échu)" : "Début de période (terme à échoir)";
}

function fmtMonthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  if (!y || !m) return yyyymm;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function fmtDateShort(d: Date) {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function fmtEur(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

type PaymentStatus = "paid" | "partial" | "pending" | "unknown";

function pillTonePay(status: PaymentStatus) {
  if (status === "paid") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (status === "partial") return "bg-orange-100 text-orange-900 border-orange-200";
  if (status === "pending") return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function payLabel(status: PaymentStatus) {
  if (status === "paid") return "Payé";
  if (status === "partial") return "Paiement incomplet";
  if (status === "pending") return "À payer";
  return "Inconnu";
}

function paymentAnalysis(lease: Lease, payment: AnyPayment | null, yyyymm: string): {
  status: PaymentStatus;
  expectedRent: number;
  expectedCharges: number;
  expectedTotal: number;
  receivedRent: number;
  receivedCharges: number;
  receivedTotal: number;
  missingAmount: number;
  reminderReason: "unpaid" | "partial" | null;
  ownerConfirmedUnpaid: boolean;
} {
  const period = getLeaseRentPeriod(lease, yyyymm);
  const expectedRent = Number(period?.rent || 0);
  const expectedCharges = Number(period?.charges || 0);
  const expectedTotal = Number(period?.total || 0);
  const receivedRent = Number(payment?.rent_amount || 0);
  const receivedCharges = Number(payment?.charges_amount || 0);
  const receivedTotal = Number(payment?.total_amount || 0);
  const paid = payment ? isPaymentPaid(payment) : false;
  const ownerConfirmedUnpaid = String(payment?.source || "") === "owner_unpaid_email";

  if (!payment || !paid) {
    return { status: "pending", expectedRent, expectedCharges, expectedTotal, receivedRent, receivedCharges, receivedTotal, missingAmount: expectedTotal, reminderReason: "unpaid", ownerConfirmedUnpaid };
  }

  const missingAmount = Math.max(0, expectedTotal - receivedTotal);
  if (receivedTotal + 0.01 < expectedTotal) {
    return { status: "partial", expectedRent, expectedCharges, expectedTotal, receivedRent, receivedCharges, receivedTotal, missingAmount, reminderReason: "partial", ownerConfirmedUnpaid };
  }

  return { status: "paid", expectedRent, expectedCharges, expectedTotal, receivedRent, receivedCharges, receivedTotal, missingAmount: 0, reminderReason: null, ownerConfirmedUnpaid };
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
   PAIEMENTS : mapping "période payée ?"
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
  const activeLeases = useMemo(() => safeLeases.filter(isSelectableLeaseLike), [safeLeases]);

  const propsById = propertyById instanceof Map ? propertyById : new Map<string, Property>();
  const tenantsById = tenantById instanceof Map ? tenantById : new Map<string, Tenant>();

  const [view, setView] = useState<"todo" | "month">("todo");
  const [month, setMonth] = useState<string>(toMonthISO(new Date()));
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [reminderSettings, setReminderSettings] = useState<Map<string, ReminderSetting>>(new Map());
  const [reminderDraft, setReminderDraft] = useState<ReminderDraft | null>(null);
  const [snoozedReceiptKeys, setSnoozedReceiptKeys] = useState<Set<string>>(new Set());

  const selectedReceipt = useMemo(
    () => safeReceipts.find((r: any) => r.id === selectedReceiptId) || null,
    [safeReceipts, selectedReceiptId]
  );
  const receiptSnoozeStorageKey = useMemo(() => `${RECEIPT_SNOOZE_STORAGE_PREFIX}:${userId}`, [userId]);

  const leaseLabel = (lease: Lease) => {
    const p = propsById.get((lease as any).property_id);
    const t = tenantsById.get((lease as any).tenant_id);
    return `${p?.label || "Bien"} — ${t?.full_name || "Locataire"}`;
  };

  const loadReminderSettings = async () => {
    if (!canUseReceiptAutomation) return;
    const headers = await authJsonHeaders();
    const resp = await fetch(`/api/payments/reminder-settings?userId=${encodeURIComponent(userId)}`, { headers });
    const { raw, json } = await safeJson(resp);
    throwApiError(resp, raw, json, "Erreur chargement paramètres de relance.");
    setReminderSettings(new Map((json?.settings || []).map((setting: ReminderSetting) => [String(setting.lease_id), setting])));
  };

  useEffect(() => {
    loadReminderSettings().catch((error) => setErr(error?.message || "Erreur chargement paramètres de relance."));
  }, [userId, canUseReceiptAutomation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(receiptSnoozeStorageKey);
      const values = raw ? JSON.parse(raw) : [];
      setSnoozedReceiptKeys(new Set(Array.isArray(values) ? values.map(String) : []));
    } catch {
      setSnoozedReceiptKeys(new Set());
    }
  }, [receiptSnoozeStorageKey]);

  const persistReceiptSnoozes = (next: Set<string>) => {
    setSnoozedReceiptKeys(next);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(receiptSnoozeStorageKey, JSON.stringify(Array.from(next)));
    window.dispatchEvent(new Event("lokt:receipt-snoozes"));
  };

  const snoozeReceiptTask = (row: any) => {
    if (!canSnoozeReceiptTask(row)) return;
    const next = new Set(snoozedReceiptKeys);
    next.add(String(row.key));
    persistReceiptSnoozes(next);
    setErr(null);
    setOk("Quittance masquée de la vue À traiter. Elle reste disponible dans le mois choisi.");
  };

  const restoreReceiptTask = (row: any) => {
    const next = new Set(snoozedReceiptKeys);
    next.delete(String(row.key));
    persistReceiptSnoozes(next);
    setErr(null);
    setOk("Quittance réactivée dans la vue À traiter.");
  };

  const saveReminderSetting = async (leaseId: string, patch: Partial<ReminderSetting>) => {
    const current = reminderSettings.get(leaseId);
    setErr(null);
    setOk(null);
    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/payments/reminder-settings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          leaseId,
          autoEnabled: patch.auto_enabled ?? current?.auto_enabled ?? false,
          defaultChannel: patch.default_channel ?? current?.default_channel ?? "both",
        }),
      });
      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur sauvegarde paramètres de relance.");
      const setting = json.setting as ReminderSetting;
      setReminderSettings((previous) => new Map(previous).set(leaseId, setting));
      setOk("Paramètres de relance enregistrés ✅");
    } catch (error: any) {
      setErr(error?.message || "Erreur sauvegarde paramètres de relance.");
    } finally {
      setLoading(false);
    }
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
      if (!isWorkflowReceipt(r)) continue;
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
      .filter(isWorkflowReceipt)
      .filter((r: any) => yyyymmFromReceipt(r) === month)
      .sort((a: any, b: any) => String(b.period_start).localeCompare(String(a.period_start)));
  }, [safeReceipts, month]);

  const buildRowsForMonth = (yyyymm: string) => {
    return activeLeases
      .filter((lease) => isLeaseExpectedForMonth(lease, yyyymm))
      .map((lease) => {
        const period = getLeaseRentPeriod(lease, yyyymm);
        if (!period) return null;
        const key = periodKey(lease.id, yyyymm);
        const receipt = receiptByPeriod.get(key) || null;
        const payment = paymentByPeriod.get(key) || null;
        const pay = paymentAnalysis(lease, payment, yyyymm);
        const payStatus = pay.status;
        const receiptStatus = String(receipt?.status || "").toLowerCase();
        const pdfReady = !!receipt?.pdf_url && (receiptStatus === "generated" || receiptStatus === "sent");
        const sent = receiptStatus === "sent" || !!receipt?.sent_at;
        const sched = scheduleForPeriod(yyyymm, lease);
        const isLate = payStatus !== "paid" && Date.now() > sched.controlAt.getTime();

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
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          prorated: period.prorated,
          billedDays: period.billedDays,
          daysInMonth: period.daysInMonth,
        };
      })
      .filter(Boolean)
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
  }, [activeLeases, month, receiptByPeriod, paymentByPeriod]);

  const todoRows = useMemo(() => {
    const rowRequiresActionNow = (row: any) => {
      if (row.sent) return false;
      if ((row.lease as any).receipts_disabled && row.payStatus === "paid") return false;
      if (canSnoozeReceiptTask(row) && snoozedReceiptKeys.has(String(row.key))) return false;
      if (row.payStatus === "paid") return true;
      if (row.payStatus === "partial") return true;
      if (row.payStatus === "pending") return true;
      if (row.pay?.ownerConfirmedUnpaid) return true;
      return row.isLate;
    };

    return recentMonths()
      .flatMap((yyyymm) => buildRowsForMonth(yyyymm))
      .filter(rowRequiresActionNow)
      .sort((a, b) => {
        if (a.isLate !== b.isLate) return a.isLate ? -1 : 1;
        if (a.payStatus !== b.payStatus) return a.payStatus === "pending" ? -1 : 1;
        if (a.pdfReady !== b.pdfReady) return a.pdfReady ? -1 : 1;
        if (a.month !== b.month) return a.month.localeCompare(b.month);
        return leaseLabel(a.lease).localeCompare(leaseLabel(b.lease));
      });
  }, [activeLeases, receiptByPeriod, paymentByPeriod, propsById, tenantsById, snoozedReceiptKeys]);

  const visibleRows = view === "todo" ? todoRows : expectedRows;

  // ✅ "PDF prêts" = generated (après paiement)
  // ✅ "Envoyées" = sent
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

    for (const r of safeReceipts.filter(isWorkflowReceipt) as any[]) {
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

    const pdfWindow = openBlankPdfWindow();

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

      if (json?.signedUrl) openPdfUrl(json.signedUrl, pdfWindow);
      else setErr("SignedUrl manquant.");
    } catch (e: any) {
      pdfWindow?.close();
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

  const cancelPaymentForRow = async (row: any) => {
    const receipt = row.receipt;
    const payment = row.payment;
    if (!receipt?.id && !payment?.id) {
      setErr("Aucun paiement confirmé à annuler pour cette ligne.");
      return;
    }

    const ok = confirm(
      "Annuler ce paiement confirmé ?\n\nLe paiement repassera en attente, la quittance PDF sera supprimée si elle existe, et l’écriture Finance automatique sera retirée."
    );
    if (!ok) return;

    setErr(null);
    setOk(null);

    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/receipts/cancel-payment", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          receiptId: receipt?.id || undefined,
          paymentId: payment?.id || undefined,
          leaseId: row.lease?.id,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
        }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur annulation paiement.");

      setOk("Paiement annulé ✅ Quittance et Finance remises à jour.");
      setSelectedReceiptId(null);
      await onRefresh();
    } catch (e: any) {
      setErr(e?.message || "Erreur annulation paiement.");
    } finally {
      setLoading(false);
    }
  };

  const generatePdfForRow = async (row: any) => {
    setErr(null);
    setOk(null);
    const pdfWindow = openBlankPdfWindow();

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
      if (json?.signedUrl) openPdfUrl(json.signedUrl, pdfWindow);
      else pdfWindow?.close();
    } catch (e: any) {
      pdfWindow?.close();
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
    const pdfWindow = openBlankPdfWindow();

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
      if (json?.signedUrl) openPdfUrl(json.signedUrl, pdfWindow);
      else pdfWindow?.close();
    } catch (e: any) {
      pdfWindow?.close();
      setErr(e?.message || "Erreur envoi quittance.");
    } finally {
      setLoading(false);
    }
  };

  const markManualDeliveredForRow = async (row: any) => {
    const receipt = row.receipt;
    if (!receipt?.id) {
      setErr("Génère d’abord le PDF avant de clôturer cette quittance.");
      return;
    }
    if (!row.pdfReady) {
      setErr("Le PDF doit être généré avant de marquer la quittance comme remise.");
      return;
    }
    if (!confirm("Confirmer que tu as remis ou envoyé cette quittance au locataire manuellement ?")) return;

    setErr(null);
    setOk(null);

    try {
      setLoading(true);
      const headers = await authJsonHeaders();
      const resp = await fetch("/api/receipts/mark-manual-delivered", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, receiptId: receipt.id }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur clôture manuelle quittance.");

      setOk("Quittance clôturée ✅ Remise manuelle confirmée.");
      await onRefresh();
    } catch (e: any) {
      setErr(e?.message || "Erreur clôture manuelle quittance.");
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
          action: "preview",
        }),
      });

      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur préparation relance.");
      const setting = reminderSettings.get(String(row.lease.id));
      const preferred = setting?.default_channel || "both";
      const channels = [
        ...(preferred !== "messaging" && json.emailAvailable ? ["email" as const] : []),
        ...(preferred !== "email" && json.messagingAvailable ? ["messaging" as const] : []),
      ];
      setReminderDraft({
        row,
        body: String(json.body || ""),
        channels: channels.length ? channels : json.emailAvailable ? ["email"] : json.messagingAvailable ? ["messaging"] : [],
        emailAvailable: !!json.emailAvailable,
        messagingAvailable: !!json.messagingAvailable,
        history: json.history || [],
      });
    } catch (e: any) {
      setErr(e?.message || "Erreur préparation relance.");
    } finally {
      setLoading(false);
    }
  };

  const submitPaymentReminder = async () => {
    if (!reminderDraft) return;
    if (!reminderDraft.channels.length) {
      setErr("Choisis au moins un canal disponible.");
      return;
    }
    try {
      setLoading(true);
      setErr(null);
      setOk(null);
      const headers = await authJsonHeaders();
      const row = reminderDraft.row;
      const resp = await fetch("/api/payments/reminder", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          leaseId: row.lease.id,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          reason: row.pay.reminderReason,
          channels: reminderDraft.channels,
          body: reminderDraft.body,
        }),
      });
      const { raw, json } = await safeJson(resp);
      throwApiError(resp, raw, json, "Erreur envoi relance.");
      setReminderDraft(null);
      setOk(json?.status === "partial" ? "Relance envoyée sur le canal disponible. Vérifie le canal en erreur." : "Relance amiable envoyée au locataire ✅");
      await onRefresh();
    } catch (error: any) {
      setErr(error?.message || "Erreur envoi relance.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ "Marquer payé" (source de vérité paiement)
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
    const pdfWindow = openBlankPdfWindow();

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

      if (json?.signedUrl) openPdfUrl(json.signedUrl, pdfWindow);
      else pdfWindow?.close();
    } catch (e: any) {
      pdfWindow?.close();
      setErr(e?.message || "Erreur renvoi quittance.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Régénérer PDF (sans finance)
  const regeneratePdfNoFinance = async (receipt: any) => {
    setErr(null);
    setOk(null);
    const pdfWindow = openBlankPdfWindow();

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

      if (json?.signedUrl) openPdfUrl(json.signedUrl, pdfWindow);
      else pdfWindow?.close();
    } catch (e: any) {
      pdfWindow?.close();
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
        title="Encaisser, générer, remettre"
        desc="La quittance est le reçu du locataire : elle se prépare uniquement quand le paiement du mois est confirmé."
      />

      <WorkflowIntro
        title="Le bon ordre pour traiter un mois"
        description="Chaque ligne correspond à un mois de loyer. Vous confirmez d’abord l’encaissement, puis lokt.fr prépare le PDF de quittance et garde l’historique."
        steps={[
          { title: "Vérifier le mois", text: "Contrôlez le bien, le locataire, la période et le montant attendu." },
          { title: "Confirmer le paiement", text: "Marquez le mois payé uniquement quand le loyer et les charges sont réellement encaissés." },
          { title: "Remettre la quittance", text: "Générez le PDF, envoyez-le avec l’abonnement adapté ou indiquez qu’il a été remis manuellement." },
        ]}
        note="En gratuit, la gestion manuelle reste incluse. Les relances, emails et envois automatiques sont réservés aux abonnements payants."
      />

      {!canUseReceiptAutomation ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Mode gratuit : quittances manuelles incluses</p>
          <p className="mt-1 text-amber-950/85">
            Tu peux confirmer le paiement, générer le PDF, le consulter et conserver l’historique. Les boutons d’envoi email, renvoi, rappels
            bailleur et automatisations sont disponibles avec un abonnement payant.
          </p>
        </div>
      ) : null}

      {canUseReceiptAutomation && activeLeases.length > 0 ? (
        <details className="rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Relances amiables locataire</p>
            <p className="mt-1 text-xs text-slate-600">Choisis le canal par défaut et active, bail par bail, une relance automatique unique à J+3.</p>
          </summary>
          <div className="border-t border-slate-200 px-4 py-3 space-y-3">
            <p className="text-xs text-slate-600">
              La relance automatique est désactivée par défaut. Elle reste factuelle et ne remplace jamais une mise en demeure.
            </p>
            {activeLeases.map((lease: any) => {
              const setting = reminderSettings.get(String(lease.id));
              return (
                <div key={lease.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{leaseLabel(lease)}</p>
                    <p className="text-xs text-slate-600">Une seule relance automatique par période si le paiement reste incomplet à J+3.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={setting?.default_channel || "both"}
                      disabled={loading}
                      onChange={(event) => saveReminderSetting(String(lease.id), { default_channel: event.target.value as ReminderChannelSetting })}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                      aria-label={`Canal de relance pour ${leaseLabel(lease)}`}
                    >
                      <option value="both">Email + messagerie</option>
                      <option value="email">Email</option>
                      <option value="messaging">Messagerie lokt</option>
                    </select>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={!!setting?.auto_enabled}
                        disabled={loading}
                        onChange={(event) => saveReminderSetting(String(lease.id), { auto_enabled: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Auto J+3
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
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
        <Kpi label="Clôturées" value={dashboard.sent} sub={canUseReceiptAutomation ? "email envoyé" : "remise manuelle"} />
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
                const canSnooze = canSnoozeReceiptTask(row);
                const isSnoozed = snoozedReceiptKeys.has(String(row.key));

                return (
                  <div
                    key={row.key}
                    className={cx("rounded-2xl border p-3 bg-white flex flex-col gap-2", row.isLate ? "border-red-200" : "border-slate-200")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>

                        <p className="text-xs text-slate-500">
                          {fmtMonthLabel(row.month)}
                          {row.prorated ? <span className="ml-1 text-indigo-700">· Prorata {row.billedDays}/{row.daysInMonth}j</span> : null}
                          {" · "}Échéance <span className="font-semibold text-slate-700">{fmtDateShort(row.sched.dueDate)}</span>
                        </p>

                        <p className="mt-1.5 text-base font-bold text-slate-900">
                          {fmtEur(row.payStatus === "partial" ? row.pay.receivedTotal : row.pay.expectedTotal)}
                          <span className="ml-1.5 text-xs font-normal text-slate-500">
                            loyer {fmtEur(row.pay.expectedRent)}
                            {row.pay.expectedCharges > 0 ? ` + charges ${fmtEur(row.pay.expectedCharges)}` : ""}
                          </span>
                        </p>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", pillTonePay(row.payStatus))}>
                            {payLabel(row.payStatus)}
                          </span>

                          {row.isLate ? (
                            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[0.7rem] font-semibold text-red-800">
                              Retard
                            </span>
                          ) : row.payStatus === "pending" ? (
                            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[0.7rem] font-semibold text-sky-800">
                              À venir
                            </span>
                          ) : null}

                          {row.payStatus === "partial" ? (
                            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[0.7rem] font-semibold text-orange-900">
                              Reste {fmtEur(Number(row.pay.missingAmount || 0))}
                            </span>
                          ) : null}

                          {row.pay.ownerConfirmedUnpaid ? (
                            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[0.7rem] font-semibold text-red-800">
                              Non reçu déclaré
                            </span>
                          ) : null}

                          {(lease as any).receipts_disabled ? (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.7rem] font-semibold text-slate-600">
                              Quittances agence
                            </span>
                          ) : !t?.email && row.payStatus !== "paid" ? (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-800">
                              Email manquant
                            </span>
                          ) : null}

                          {isSnoozed ? (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[0.7rem] font-semibold text-slate-700">
                              Masquée
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
                              {row.payStatus === "partial" ? "Solde reçu" : "Confirmer payé"}
                            </button>
                            {!(lease as any).receipts_disabled ? (
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
                            ) : null}
                          </>
                        ) : (lease as any).receipts_disabled ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-semibold text-emerald-800">
                            Paiement enregistré
                          </span>
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
                            disabled={loading}
                            onClick={() => (canUseReceiptAutomation ? sendReceiptForRow(row) : markManualDeliveredForRow(row))}
                            className={cx(
                              "rounded-full px-4 py-2 text-xs font-semibold text-white",
                              canUseReceiptAutomation ? "bg-sky-700 hover:bg-sky-600" : "bg-emerald-700 hover:bg-emerald-600",
                              loading && "opacity-60"
                            )}
                            title={
                              canUseReceiptAutomation
                                ? "Envoie la quittance au locataire par email."
                                : "Confirme que tu as remis ou envoyé le PDF au locataire manuellement."
                            }
                          >
                            {canUseReceiptAutomation ? "Envoyer" : "Quittance remise"}
                          </button>
                        ) : (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-semibold text-emerald-800">
                            Terminé
                          </span>
                        )}

                        {!(lease as any).receipts_disabled ? (
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
                        ) : null}

                        {row.payStatus === "paid" ? (
                          <button
                            type="button"
                            disabled={loading || (!receipt && !row.payment)}
                            onClick={() => cancelPaymentForRow(row)}
                            className={cx(
                              "rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50",
                              (loading || (!receipt && !row.payment)) && "opacity-60"
                            )}
                            title="Annule la confirmation de paiement, supprime le PDF de quittance et retire l’écriture Finance automatique."
                          >
                            Annuler paiement
                          </button>
                        ) : null}

                        {canSnooze ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => (isSnoozed ? restoreReceiptTask(row) : snoozeReceiptTask(row))}
                            className={cx(
                              "rounded-full border px-4 py-2 text-xs font-semibold transition",
                              isSnoozed
                                ? "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white"
                                : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                              loading && "opacity-60"
                            )}
                            title={
                              isSnoozed
                                ? "Réaffiche cette quittance dans les tâches à traiter."
                                : "Masque cette quittance si tu ne souhaites pas l’envoyer au locataire."
                            }
                          >
                            {isSnoozed ? "Réactiver" : "Masquer"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {isSnoozed ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        Cette quittance est masquée de la vue À traiter. Elle reste consultable ici et peut être réactivée à tout moment.
                      </div>
                    ) : null}

                    {row.isLate && !row.pay.ownerConfirmedUnpaid ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        Paiement en retard · confirme dès réception du virement.
                      </div>
                    ) : row.payStatus === "partial" ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Paiement incomplet · il manque <span className="font-semibold">{fmtEur(Number(row.pay.missingAmount || 0))}</span>. Confirme le solde dès réception.
                      </div>
                    ) : row.pay.ownerConfirmedUnpaid ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Non reçu déclaré · si le virement arrive, clique sur &laquo;&nbsp;Confirmer payé&nbsp;&raquo;.
                      </div>
                    ) : row.payStatus === "pending" && !row.isLate ? (
                      <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                        En attente · loyer dû le <span className="font-semibold">{fmtDateShort(row.sched.dueDate)}</span>.
                      </div>
                    ) : row.payStatus === "paid" && !pdfReady && !(row.lease as any).receipts_disabled ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        Paiement confirmé · génère la quittance PDF.
                      </div>
                    ) : pdfReady && !row.sent ? (
                      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                        {canUseReceiptAutomation ? "PDF prêt · envoie la quittance au locataire." : <>PDF prêt · remets-le au locataire puis clique sur &laquo;&nbsp;Quittance remise&nbsp;&raquo;.</>}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Clôturées (période)" right={<span className="text-sm text-slate-500">{sentThisMonth.length}</span>}>
          {sentThisMonth.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucune quittance clôturée sur cette période.
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
                "Régénérer PDF" met à jour le PDF dans le bucket. Le renvoi email est une fonctionnalité payante.
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

      {reminderDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Préparer la relance locataire">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-base font-semibold text-slate-900">Préparer une relance amiable</p>
              <p className="mt-1 text-xs text-slate-600">Relis le texte et choisis les canaux. Aucun envoi ne part avant ta validation.</p>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-3">
                {[
                  ["email", "Email", reminderDraft.emailAvailable],
                  ["messaging", "Messagerie lokt", reminderDraft.messagingAvailable],
                ].map(([value, label, available]) => (
                  <label key={String(value)} className={cx("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold", available ? "border-slate-300 bg-white text-slate-800" : "border-slate-200 bg-slate-100 text-slate-400")}>
                    <input
                      type="checkbox"
                      disabled={!available || loading}
                      checked={reminderDraft.channels.includes(value as "email" | "messaging")}
                      onChange={(event) =>
                        setReminderDraft((draft) =>
                          draft
                            ? {
                                ...draft,
                                channels: event.target.checked
                                  ? [...draft.channels, value as "email" | "messaging"]
                                  : draft.channels.filter((channel) => channel !== value),
                              }
                            : draft
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {!reminderDraft.messagingAvailable ? <p className="text-xs text-amber-700">La messagerie lokt sera disponible après activation de l’espace locataire.</p> : null}
              <div>
                <label className="text-xs font-semibold text-slate-700" htmlFor="payment-reminder-body">Message envoyé</label>
                <textarea
                  id="payment-reminder-body"
                  value={reminderDraft.body}
                  disabled={loading}
                  onChange={(event) => setReminderDraft((draft) => (draft ? { ...draft, body: event.target.value } : draft))}
                  rows={14}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-800"
                />
              </div>
              {reminderDraft.history.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-900">Historique de cette période</p>
                  <div className="mt-2 space-y-1">
                    {reminderDraft.history.map((entry) => (
                      <p key={entry.id} className="text-xs text-slate-600">
                        {fmtDateTimeFR(entry.sent_at)} · {(entry.channels || []).join(" + ")} · {Number(entry.missing_amount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} · {entry.trigger_type === "automatic" ? "automatique" : "manuelle"}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" disabled={loading} onClick={() => setReminderDraft(null)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                Annuler
              </button>
              <button type="button" disabled={loading || !reminderDraft.channels.length} onClick={submitPaymentReminder} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                {loading ? "Envoi…" : "Envoyer la relance"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
