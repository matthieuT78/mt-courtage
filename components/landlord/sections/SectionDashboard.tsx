// components/landlord/sections/SectionDashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowTopRightOnSquareIcon, ArrowTrendingUpIcon, BellIcon, CalendarDaysIcon, CheckCircleIcon, ChevronDownIcon, HomeModernIcon, NoSymbolIcon } from "@heroicons/react/24/outline";
import { KpiCard, SectionTitle, formatEuro, fmtDate, Pill } from "../UiBits";
import type { Lease, Property, PropertyFinance, RentPayment, RentReceipt, Tenant } from "../../../lib/landlord/types";
import type { LandlordSectionKey } from "../SidebarNav";
import { supabase } from "../../../lib/supabaseClient";
import { getLeaseRentPeriod } from "../../../lib/rentPeriod";
import { getLeasePaymentDueDate } from "../../../lib/rentSchedule";
import { isActivePropertyLike } from "../../../lib/landlord/archiveFilters";

type DashboardAlert = {
  tone: "emerald" | "amber" | "red";
  title: string;
  desc: string;
  action?: string;
};

type AlertSnoozeState = Record<string, { ignored?: boolean; until?: string }>;

type TransactionRow = {
  id: string;
  occurred_at: string;
  direction: "in" | "out";
  amount: number;
  property_id?: string | null;
  status?: string | null;
  category?: string | null;
};

const pad2 = (value: number) => String(value).padStart(2, "0");
const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const addMonths = (d: Date, delta: number) => new Date(d.getFullYear(), d.getMonth() + delta, 1);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const daysBetween = (start: Date, end: Date) => Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));
const normalizeDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(String(value).slice(0, 10) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
};
const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
};
const clampPct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const hasPositiveAmount = (value?: number | null) => Number(value || 0) > 0;
const DEPOSIT_CATEGORIES = new Set(["deposit_collected", "deposit_returned"]);
const isReceivedIncomeTransaction = (tx: TransactionRow) => {
  const status = String(tx.status || "").toLowerCase();
  if (DEPOSIT_CATEGORIES.has(tx.category || "")) return false;
  return tx.direction === "in" && (status === "received" || status === "paid");
};

function hasFinanceSetup(finance?: PropertyFinance | null) {
  if (!finance) return false;
  return hasPositiveAmount(finance.purchase_price) && hasPositiveAmount(finance.loan_rate_percent);
}

function isLeaseUsable(lease: Lease) {
  const status = String(lease?.status || "").toLowerCase();
  return status !== "draft" && status !== "archived";
}

function isLeaseCurrent(lease: Lease, now: Date) {
  if (String(lease?.status || "").toLowerCase() !== "active") return false;
  const start = normalizeDate(lease?.start_date);
  const end = normalizeDate(lease?.end_date);
  if (!start || start.getTime() > now.getTime()) return false;
  return !end || end.getTime() >= now.getTime();
}

function occupancyDaysForWindow(leases: Lease[], windowStart: Date, windowEnd: Date) {
  const intervals = leases
    .filter(isLeaseUsable)
    .map((lease) => {
      const start = normalizeDate(lease?.start_date);
      const rawEnd = normalizeDate(lease?.end_date);
      if (!start) return null;
      const end = rawEnd ? addDays(rawEnd, 1) : windowEnd;
      const clippedStart = new Date(Math.max(start.getTime(), windowStart.getTime()));
      const clippedEnd = new Date(Math.min(end.getTime(), windowEnd.getTime()));
      return clippedEnd.getTime() > clippedStart.getTime() ? { start: clippedStart, end: clippedEnd } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.start.getTime() - b.start.getTime()) as Array<{ start: Date; end: Date }>;

  const merged: Array<{ start: Date; end: Date }> = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval.start.getTime() > last.end.getTime()) {
      merged.push({ ...interval });
    } else if (interval.end.getTime() > last.end.getTime()) {
      last.end = interval.end;
    }
  }
  return merged.reduce((total, interval) => total + daysBetween(interval.start, interval.end), 0);
}

function paymentStatusForLease(lease: Lease, yyyymm: string, payment?: RentPayment | null) {
  const rentPeriod = getLeaseRentPeriod(lease, yyyymm);
  const expectedTotal = Number(rentPeriod?.total || 0);
  const paidTotal = Number(payment?.total_amount || 0);

  if (!payment?.paid_at) return { label: "À suivre", missing: expectedTotal, incomplete: false };
  if (paidTotal + 0.01 < expectedTotal) {
    return { label: "Paiement incomplet", missing: Math.max(0, expectedTotal - paidTotal), incomplete: true };
  }
  return { label: "Encaissé", missing: 0, incomplete: false };
}

function actionTarget(action?: string): LandlordSectionKey | null {
  const a = (action || "").toLowerCase();
  if (a.includes("bien")) return "biens";
  if (a.includes("locataire")) return "locataires";
  if (a.includes("bail")) return "baux";
  if (a.includes("quittance") || a.includes("retard") || a.includes("paiement")) return "quittances";
  if (a.includes("déclaration") || a.includes("declaration")) return "finance";
  if (a.includes("inventaire")) return "inventaire";
  if (a.includes("état") || a.includes("etat")) return "etat_des_lieux";
  if (a.includes("finance")) return "finance";
  return null;
}

function priorityActionId(input: { title: string; target?: LandlordSectionKey | null; cta?: string; desc?: string }) {
  return [input.target || "info", input.cta || "", input.title, input.desc || ""]
    .join("|")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function isSnoozeActive(entry?: { ignored?: boolean; until?: string } | null) {
  if (!entry) return false;
  if (entry.ignored) return true;
  if (!entry.until) return false;
  const until = new Date(entry.until).getTime();
  return Number.isFinite(until) && until > Date.now();
}

export function SectionDashboard({
  monthRange,
  monthlyExpected,
  monthlyPaid,
  lateCount,
  depositTotal,
  healthScore,
  alerts,
  activeLeases,
  leases,
  payments,
  receipts,
  propertyById,
  tenantById,
  properties,
  propertyFinance,
  propertiesCount,
  tenantsCount,
  leasesCount,
  onGo,
  onNavigateDeep,
  onPrepareDeparture,
  userId,
  planLabel,
}: {
  monthRange: { startISO: string; endISO: string };
  monthlyExpected: number;
  monthlyPaid: number;
  lateCount: number;
  depositTotal: number;
  healthScore: number;
  alerts: DashboardAlert[];
  activeLeases: Lease[];
  leases: Lease[];
  payments: RentPayment[];
  receipts: RentReceipt[];
  propertyById: Map<string, Property>;
  tenantById: Map<string, Tenant>;
  properties: Property[];
  propertyFinance: PropertyFinance[];
  propertiesCount: number;
  tenantsCount: number;
  leasesCount: number;
  onGo: (k: LandlordSectionKey) => void;
  onNavigateDeep?: (section: LandlordSectionKey, link?: { leaseId?: string; openPanel?: "irl" }) => void;
  onPrepareDeparture?: (tenantId: string) => void;
  userId?: string;
  planLabel?: string;
}) {
  const ratio = monthlyExpected > 0 ? clampPct((monthlyPaid / monthlyExpected) * 100) : 0;

  // ── Événements contextuels (anniversaires + baux expirants) ──────────────
  const contextualEvents = useMemo(() => {
    const now = new Date();
    const events: Array<{
      type: "anniversary" | "expiring";
      leaseId: string;
      tenantName: string;
      propertyLabel: string;
      days: number;
      urgency: "high" | "medium" | "low";
    }> = [];

    for (const l of activeLeases) {
      const tenant   = tenantById.get(l.tenant_id);
      const property = propertyById.get(l.property_id);
      const tenantName    = tenant?.full_name    || (l as any).tenant_name    || "Locataire";
      const propertyLabel = (property as any)?.label || (property as any)?.city || "Logement";

      // Prochain anniversaire du bail (révision IRL)
      if (l.start_date && Number(l.rent_amount || 0) > 0) {
        const start = new Date(l.start_date + "T00:00:00");
        const ann = new Date(start);
        ann.setFullYear(now.getFullYear());
        if (ann.getTime() <= now.getTime()) ann.setFullYear(now.getFullYear() + 1);
        const days = Math.ceil((ann.getTime() - now.getTime()) / 86400000);
        if (days <= 60) {
          events.push({ type: "anniversary", leaseId: l.id, tenantName, propertyLabel, days, urgency: days <= 14 ? "high" : days <= 30 ? "medium" : "low" });
        }
      }

      // Bail à durée déterminée expirant bientôt
      if (l.end_date) {
        const end  = new Date(l.end_date + "T00:00:00");
        const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
        if (days >= 0 && days <= 90) {
          events.push({ type: "expiring", leaseId: l.id, tenantName, propertyLabel, days, urgency: days <= 30 ? "high" : "medium" });
        }
      }
    }

    return events.sort((a, b) => a.days - b.days).slice(0, 6);
  }, [activeLeases, tenantById, propertyById]);
  const remainingToCollect = Math.max(0, monthlyExpected - monthlyPaid);
  const currentMonthPayments = useMemo(
    () =>
      (Array.isArray(payments) ? payments : []).filter(
        (p) => String(p.period_start || "") >= monthRange.startISO && String(p.period_start || "") <= monthRange.endISO
      ),
    [payments, monthRange]
  );
  const currentMonthReceipts = useMemo(
    () =>
      (Array.isArray(receipts) ? receipts : []).filter(
        (receipt) =>
          String(receipt.period_start || "") >= monthRange.startISO &&
          String(receipt.period_start || "") <= monthRange.endISO
      ),
    [receipts, monthRange]
  );
  const receiptCoverage = activeLeases.length > 0 ? clampPct((currentMonthReceipts.length / activeLeases.length) * 100) : 0;

  const occupancySnapshot = useMemo(() => {
    const activeProperties = (Array.isArray(properties) ? properties : []).filter(isActivePropertyLike);
    const allLeases = Array.isArray(leases) ? leases : [];
    const now = new Date();
    const windowEnd = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
    const windowStart = addDays(windowEnd, -365);

    const rows = activeProperties.map((property) => {
      const propertyLeases = allLeases.filter((lease) => lease?.property_id === property?.id);
      const usableLeases = propertyLeases.filter(isLeaseUsable);
      const firstLeaseStart =
        usableLeases
          .map((lease) => normalizeDate(lease?.start_date))
          .filter((date): date is Date => Boolean(date))
          .sort((a, b) => a.getTime() - b.getTime())[0] || null;
      const analysisStart =
        firstLeaseStart && firstLeaseStart.getTime() > windowStart.getTime() && firstLeaseStart.getTime() < windowEnd.getTime()
          ? firstLeaseStart
          : windowStart;
      const analysisDays = Math.max(1, daysBetween(analysisStart, windowEnd));
      const occupiedDays = occupancyDaysForWindow(propertyLeases, analysisStart, windowEnd);
      const currentLease = propertyLeases.some((lease) => isLeaseCurrent(lease, now));

      return {
        property,
        currentLease,
        analysisDays,
        occupiedDays,
        vacancyDays: Math.max(0, analysisDays - occupiedDays),
        historyIsShort: analysisDays < 90,
      };
    });

    const totalKnownDays = rows.reduce((sum, row) => sum + row.analysisDays, 0);
    const totalOccupiedDays = rows.reduce((sum, row) => sum + row.occupiedDays, 0);
    const rate = totalKnownDays > 0 ? Math.round((totalOccupiedDays / totalKnownDays) * 100) : 0;
    const vacantCount = rows.filter((row) => !row.currentLease).length;
    const occupiedCount = rows.length - vacantCount;
    const shortHistoryCount = rows.filter((row) => row.currentLease && row.historyIsShort).length;

    return {
      total: rows.length,
      rate,
      occupiedCount,
      vacantCount,
      shortHistoryCount,
    };
  }, [leases, properties]);

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [accountingPropertyId, setAccountingPropertyId] = useState<string>("");
  const [alertSnoozes, setAlertSnoozes] = useState<AlertSnoozeState>({});
  const [openAlertMenuId, setOpenAlertMenuId] = useState<string | null>(null);
  const [scoreHovered, setScoreHovered] = useState(false);
  const [news, setNews] = useState<{ title: string; url: string; image: string | null; source: string; publishedAt: string }[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [weatherAlerts, setWeatherAlerts] = useState<import("../../../pages/api/weather/alerts").WeatherAlert[]>([]);
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const scoreHoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScoreEnter = () => { if (scoreHoverTimeout.current) clearTimeout(scoreHoverTimeout.current); setScoreHovered(true); };
  const onScoreLeave = () => { scoreHoverTimeout.current = setTimeout(() => setScoreHovered(false), 180); };

  const alertSnoozeStorageKey = useMemo(() => {
    const u = (userId || "").trim();
    return `lokt:dashboard-alert-snoozes:${u || "anon"}`;
  }, [userId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(alertSnoozeStorageKey);
      setAlertSnoozes(raw ? JSON.parse(raw) : {});
    } catch {
      setAlertSnoozes({});
    }
  }, [alertSnoozeStorageKey]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/news/immobilier")
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setNews(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setNewsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const active = (properties || []).filter(
      (p) => p.city?.trim() && String(p.status || "").toLowerCase() !== "archived"
    );
    if (!active.length) return;
    let cancelled = false;
    fetch("/api/weather/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: active.map((p) => ({ id: p.id, label: p.label, city: p.city, postal_code: p.postal_code })),
      }),
    })
      .then((r) => r.json())
      .then((data) => { if (!cancelled && Array.isArray(data.alerts)) setWeatherAlerts(data.alerts); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setWeatherLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties?.map((p) => p.id).join(",")]);

  const saveAlertSnoozes = (next: AlertSnoozeState) => {
    setAlertSnoozes(next);
    try {
      window.localStorage.setItem(alertSnoozeStorageKey, JSON.stringify(next));
    } catch {
      // Le masquage reste en mémoire si localStorage est indisponible.
    }
  };

  useEffect(() => {
    if (!openAlertMenuId) return;

    const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-alert-snooze-menu]")) return;
      setOpenAlertMenuId(null);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
    };
  }, [openAlertMenuId]);

  const snoozePriorityAction = (id: string, mode: "tomorrow" | "forever") => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const next = {
      ...alertSnoozes,
      [id]: mode === "forever" ? { ignored: true } : { until: tomorrow.toISOString() },
    };
    saveAlertSnoozes(next);
    setOpenAlertMenuId(null);
  };

  const propertyOptions = useMemo(
    () =>
      Array.from(propertyById.values()).filter(isActivePropertyLike).sort((a, b) =>
        String(a.label || a.address_line1 || "").localeCompare(String(b.label || b.address_line1 || ""))
      ),
    [propertyById]
  );

  // -----------------------------
  // Onboarding: persistence + auto-hide
  // -----------------------------
  const HIDE_AFTER_DAYS = 7;

  const storageKey = useMemo(() => {
    const u = (userId || "").trim();
    return `imp:onboarding_done_at:${u || "anon"}`;
  }, [userId]);

  const [doneAtISO, setDoneAtISO] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [manuallyDismissed, setManuallyDismissed] = useState(false);
  const [notifExpanded, setNotifExpanded] = useState(false);
  const prevPercentRef = useRef<number>(-1);

  const dismissedKey = useMemo(() => `imp:onboarding_dismissed:${(userId || "").trim() || "anon"}`, [userId]);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(storageKey);
      if (value) setDoneAtISO(value);
      if (window.localStorage.getItem(dismissedKey) === "1") setManuallyDismissed(true);
    } catch {
      // localStorage indisponible : l'onboarding reste purement visuel.
    }
  }, [storageKey, dismissedKey]);

  const onboarding = useMemo(() => {
    const managedProperties = (properties || []).filter(
      (property) => String((property as any)?.status || "").toLowerCase() !== "archived"
    );
    const managedTenants = Array.from(tenantById.values()).filter((tenant) => !(tenant as any)?.archived_at);
    const workflowLeases = (activeLeases || []).filter(
      (lease) => String(lease.status || "active").toLowerCase() === "active"
    );
    const leasedPropertyIds = new Set(workflowLeases.map((lease) => lease.property_id));
    const leasedTenantIds = new Set(workflowLeases.map((lease) => lease.tenant_id));
    const propertiesWithoutLease = managedProperties.filter((property) => !leasedPropertyIds.has(property.id));
    const tenantsWithoutLease = managedTenants.filter((tenant) => !leasedTenantIds.has(tenant.id));

    const hasProperty = managedProperties.length > 0;
    const hasTenant = managedTenants.length > 0;
    const hasLease = workflowLeases.length > 0;
    const leaseWorkflowReady = hasLease && propertiesWithoutLease.length === 0 && tenantsWithoutLease.length === 0;
    const financeByProperty = new Map((propertyFinance || []).map((row) => [row.property_id, row]));
    const financeConfigured =
      hasProperty && managedProperties.every((property) => hasFinanceSetup(financeByProperty.get(property.id)));
    const leaseStepLabel =
      propertiesWithoutLease.length > 0 || tenantsWithoutLease.length > 0 ? "Créer le nouveau bail" : "Créer un bail";

    const steps = [
      { key: "biens" as LandlordSectionKey, label: "Créer un bien", done: hasProperty },
      { key: "locataires" as LandlordSectionKey, label: "Créer un locataire", done: hasTenant },
      { key: "baux" as LandlordSectionKey, label: leaseStepLabel, done: leaseWorkflowReady },
      { key: "finance" as LandlordSectionKey, label: "Configurer la finance", done: financeConfigured },
    ];

    const doneCount = steps.filter((step) => step.done).length;
    const percent = Math.round((doneCount / steps.length) * 100);
    const next = !hasProperty ? steps[0] : !hasTenant ? steps[1] : !leaseWorkflowReady ? steps[2] : !financeConfigured ? steps[3] : null;

    const headline =
      percent === 100
        ? "Mise en route terminée"
        : next?.key === "finance"
        ? "Dernière étape : fiabiliser les calculs"
        : next?.key === "baux" && hasLease
        ? "Nouveau dossier à rattacher"
        : percent >= 50
        ? "Plus qu’une étape avant votre premier workflow complet"
        : percent >= 25
        ? "Bien joué, on continue"
        : "Démarrons en 2 minutes";

    const sub =
      percent === 100
        ? "Vous pouvez maintenant gérer loyers, quittances, états des lieux et suivi financier."
        : next?.key === "biens"
        ? "Commencez par créer un bien : adresse, libellé et informations utiles."
        : next?.key === "locataires"
        ? "Ajoutez le locataire : nom, email, téléphone et notes utiles."
        : next?.key === "baux"
        ? propertiesWithoutLease.length > 0 && tenantsWithoutLease.length > 0
          ? `Créez un bail pour rattacher ${propertiesWithoutLease.length} bien${propertiesWithoutLease.length > 1 ? "s" : ""} et ${tenantsWithoutLease.length} locataire${tenantsWithoutLease.length > 1 ? "s" : ""} encore sans bail.`
          : propertiesWithoutLease.length > 0
          ? `Créez un bail pour ${propertiesWithoutLease.length > 1 ? "les nouveaux biens" : "le nouveau bien"} encore sans locataire.`
          : tenantsWithoutLease.length > 0
          ? `Créez un bail pour ${tenantsWithoutLease.length > 1 ? "les nouveaux locataires" : "le nouveau locataire"} encore sans logement rattaché.`
          : "Créez le bail : il relie le bien, le locataire, le loyer et les quittances."
        : "Complétez le socle Finance du bien : prix d’achat et taux du crédit. Les autres charges pourront être ajoutées ensuite.";

    const cta = next ? { key: next.key, label: next.label } : null;
    return { steps, doneCount, percent, next, headline, sub, cta };
  }, [activeLeases, properties, propertyFinance, tenantById]);

  const shouldHideOnboarding = useMemo(() => {
    if (manuallyDismissed) return true;
    if (onboarding.percent < 100) return false;
    if (!doneAtISO) return false;
    const t = new Date(doneAtISO).getTime();
    if (!Number.isFinite(t)) return false;
    const days = (Date.now() - t) / (1000 * 60 * 60 * 24);
    return days >= HIDE_AFTER_DAYS;
  }, [doneAtISO, manuallyDismissed, onboarding.percent]);

  useEffect(() => {
    const previous = prevPercentRef.current;
    const current = onboarding.percent;
    prevPercentRef.current = current;

    if (current === 100 && previous >= 0 && previous < 100) {
      setJustCompleted(true);
      const timer = setTimeout(() => setJustCompleted(false), 2200);
      const nowISO = new Date().toISOString();
      setDoneAtISO(nowISO);

      try {
        window.localStorage.setItem(storageKey, nowISO);
      } catch {
        // ignore
      }

      (async () => {
        try {
          if (!supabase || !userId) return;
          const key = `onboarding_done_at:${userId}`;
          await supabase.from("app_settings").upsert({ key, value_json: { done_at: nowISO } }, { onConflict: "key" });
        } catch {
          // On ne bloque pas le dashboard si cette table/policy n'est pas disponible.
        }
      })();

      return () => clearTimeout(timer);
    }
  }, [onboarding.percent, storageKey, userId]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let mounted = true;

    const start = addMonths(new Date(new Date().getFullYear(), new Date().getMonth(), 1), -5);

    (async () => {
      setTransactionsLoading(true);
      setTransactionsError(null);
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("id, occurred_at, direction, amount, property_id, status, category")
          .eq("user_id", userId)
          .gte("occurred_at", toISODate(start))
          .order("occurred_at", { ascending: true });

        if (error) throw error;
        if (mounted) setTransactions(((data || []) as TransactionRow[]) || []);
      } catch (e: any) {
        if (mounted) setTransactionsError(e?.message || "Impossible de charger les écritures comptables.");
      } finally {
        if (mounted) setTransactionsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const accountingMonths = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultMonths = Array.from({ length: 6 }, (_, index) => monthKey(addMonths(base, index - 5)));
    const activeMonthKeys = new Set<string>();
    const scopedTransactions = transactions.filter((tx) => !accountingPropertyId || (tx.property_id || "") === accountingPropertyId);

    if (scopedTransactions.length > 0) {
      for (const tx of scopedTransactions) {
        const d = normalizeDate(tx.occurred_at);
        if (!d) continue;
        const amount = Number(tx.amount || 0);
        if (amount > 0) activeMonthKeys.add(monthKey(d));
      }
    } else {
      for (const payment of payments) {
        if (accountingPropertyId) {
          const lease = activeLeases.find((l) => l.id === payment.lease_id);
          if ((lease?.property_id || "") !== accountingPropertyId) continue;
        }
        const d = normalizeDate(payment.period_start);
        if (!d || !payment.paid_at || Number(payment.total_amount || 0) <= 0) continue;
        activeMonthKeys.add(monthKey(d));
      }
    }

    const activeMonths = Array.from(activeMonthKeys).sort();
    if (activeMonths.length === 1) {
      const first = normalizeDate(`${activeMonths[0]}-01`);
      if (first) return Array.from({ length: 6 }, (_, index) => monthKey(addMonths(first, index)));
    }

    return defaultMonths;
  }, [accountingPropertyId, activeLeases, payments, transactions]);

  const accountingSeries = useMemo(() => {
    const byMonth = new Map(accountingMonths.map((key) => [key, { key, income: 0, expense: 0 }]));
    let scopedReceivedIncomeCount = 0;

    for (const tx of transactions) {
      if (accountingPropertyId && (tx.property_id || "") !== accountingPropertyId) continue;
      const d = normalizeDate(tx.occurred_at);
      if (!d) continue;
      const key = monthKey(d);
      const row = byMonth.get(key);
      if (!row) continue;
      if (isReceivedIncomeTransaction(tx)) {
        row.income += Number(tx.amount || 0);
        scopedReceivedIncomeCount += 1;
      } else if (tx.direction === "out") {
        row.expense += Number(tx.amount || 0);
      }
    }

    if (scopedReceivedIncomeCount === 0) {
      for (const payment of payments) {
        if (accountingPropertyId) {
          const lease = activeLeases.find((l) => l.id === payment.lease_id);
          if ((lease?.property_id || "") !== accountingPropertyId) continue;
        }
        const d = normalizeDate(payment.period_start);
        if (!d || !payment.paid_at) continue;
        const row = byMonth.get(monthKey(d));
        if (row) row.income += Number(payment.total_amount || 0);
      }
    }

    return Array.from(byMonth.values());
  }, [accountingMonths, accountingPropertyId, activeLeases, payments, transactions]);

  const accountingTotals = useMemo(() => {
    const income = accountingSeries.reduce((sum, row) => sum + row.income, 0);
    const expense = accountingSeries.reduce((sum, row) => sum + row.expense, 0);
    return { income, expense, net: income - expense };
  }, [accountingSeries]);

  const maxChartValue = Math.max(1, ...accountingSeries.flatMap((row) => [row.income, row.expense]));

  const leaseCards = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in90Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90);
    const currentMonth = monthRange.startISO.slice(0, 7);

    return activeLeases.map((lease) => {
      const property = propertyById.get(lease.property_id);
      const tenant = tenantById.get(lease.tenant_id);
      const payment = currentMonthPayments.find((p) => p.lease_id === lease.id);
      const receipt = currentMonthReceipts.find((r) => r.lease_id === lease.id);
      const rentPeriod = getLeaseRentPeriod(lease, currentMonth);
      const total = Number(rentPeriod?.total || 0);
      const endDate = normalizeDate(lease.end_date);
      const leaseEndingSoon = !!endDate && endDate <= in90Days;
      const paymentState = paymentStatusForLease(lease, currentMonth, payment);
      const dueDate = getLeasePaymentDueDate(lease, currentMonth);
      const paymentStatus =
        paymentState.label !== "À suivre"
          ? paymentState.label
          : dueDate && dueDate > today
          ? "À venir"
          : dueDate && dueDate < today
          ? "En retard"
          : "À confirmer";

      return {
        lease,
        propertyLabel: property?.label || "Bien",
        tenantName: tenant?.full_name || "Locataire",
        total,
        paymentStatus,
        missingAmount: paymentState.missing,
        incompletePayment: paymentState.incomplete,
        dueDate,
        hasReceipt: !!receipt,
        leaseEndingSoon,
        endDate,
      };
    });
  }, [activeLeases, currentMonthPayments, currentMonthReceipts, monthRange.startISO, propertyById, tenantById]);

  const rentsToCollect = useMemo(
    () =>
      leaseCards
        .filter((card) => card.paymentStatus !== "Encaissé" && card.paymentStatus !== "À venir")
        .sort((a, b) => {
          if (a.paymentStatus === "En retard" && b.paymentStatus !== "En retard") return -1;
          if (a.paymentStatus !== "En retard" && b.paymentStatus === "En retard") return 1;
          return a.propertyLabel.localeCompare(b.propertyLabel);
        }),
    [leaseCards]
  );

  const upcomingRents = useMemo(() => leaseCards.filter((card) => card.paymentStatus === "À venir"), [leaseCards]);
  const upcomingTotal = useMemo(() => upcomingRents.reduce((sum, card) => sum + card.total, 0), [upcomingRents]);
  const hasOnlyUpcomingRents = upcomingRents.length > 0 && rentsToCollect.length === 0;
  const nextDueDate = useMemo(() => {
    const timestamps = upcomingRents.map((card) => card.dueDate?.getTime()).filter((value): value is number => Number.isFinite(value));
    return timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;
  }, [upcomingRents]);

  const incompletePayments = useMemo(
    () => leaseCards.filter((card) => card.paymentStatus === "Paiement incomplet"),
    [leaseCards]
  );

  const priorityActions = useMemo(() => {
    const actions: Array<{
      id?: string;
      tone: "red" | "amber" | "emerald" | "indigo";
      title: string;
      desc: string;
      details?: string[];
      target?: LandlordSectionKey;
      cta?: string;
      snoozable?: boolean;
    }> = [];
    const onboardingIncomplete = onboarding.percent < 100;

    if (onboardingIncomplete && onboarding.next) {
      actions.push({
        tone: "indigo",
        title: "Terminer la mise en route",
        desc: onboarding.sub,
        details: [
          `${onboarding.doneCount}/${onboarding.steps.length} étapes terminées`,
          `Prochaine étape : ${onboarding.next.label}`,
        ],
        target: onboarding.next.key,
        cta: onboarding.next.label,
      });
    }

    if (lateCount > 0) {
      const lateDetails = leaseCards
        .filter((card) => card.paymentStatus === "En retard")
        .slice(0, 3)
        .map((card) => `${card.propertyLabel} · ${card.tenantName} · ${formatEuro(card.total)}`);

      actions.push({
        tone: "red",
        title: `${lateCount} paiement${lateCount > 1 ? "s" : ""} en retard`,
        desc: "Confirmez le paiement s’il est arrivé, sinon relancez le locataire.",
        details: lateDetails,
        target: "quittances",
        cta: "Voir les retards",
      });
    }

    if (incompletePayments.length > 0) {
      actions.push({
        tone: "amber",
        title: `${incompletePayments.length} paiement${incompletePayments.length > 1 ? "s" : ""} incomplet${incompletePayments.length > 1 ? "s" : ""}`,
        desc: "La quittance reste bloquée tant que le loyer et les charges ne sont pas réglés en totalité. Vous pouvez relancer le locataire.",
        details: incompletePayments
          .slice(0, 3)
          .map((card) => `${card.propertyLabel} · ${card.tenantName} · reste ${formatEuro(card.missingAmount || 0)}`),
        target: "quittances",
        cta: "Traiter le solde",
      });
    }

    if (monthlyExpected > 0 && remainingToCollect > 0 && lateCount === 0 && rentsToCollect.length > 0) {
      const pendingDetails = rentsToCollect
        .slice(0, 3)
        .map((card) => `${card.propertyLabel} · ${card.tenantName} · ${formatEuro(card.total)} à confirmer`);
      const hasAutomaticReminder = rentsToCollect.some((card) => !!card.lease.auto_reminder_enabled);

      actions.push({
        tone: ratio >= 70 ? "amber" : "red",
        title: `${formatEuro(remainingToCollect)} reste à encaisser`,
        desc: hasAutomaticReminder
          ? `Encaissement à ${ratio}%. Les rappels email activés suivent le calendrier de chaque bail. Vous pouvez aussi confirmer les loyers depuis Quittances.`
          : `Encaissement à ${ratio}%. Aucun rappel email automatique n’est activé pour ces baux : confirmez manuellement les loyers depuis Quittances.`,
        details: pendingDetails.length ? pendingDetails : ["Contrôlez les paiements du mois et marquez les loyers reçus."],
        target: "quittances",
        cta: "Confirmer les loyers",
      });
    }

    const missingReceiptCards = leaseCards.filter((card) => card.paymentStatus === "Encaissé" && !card.hasReceipt);
    if (missingReceiptCards.length > 0) {
      const missingReceiptDetails = missingReceiptCards.slice(0, 3).map((card) => `${card.propertyLabel} · ${card.tenantName}`);

      actions.push({
        tone: "amber",
        title: "Quittances du mois à finaliser",
        desc: `${missingReceiptCards.length} quittance${missingReceiptCards.length > 1 ? "s" : ""} à générer après confirmation du paiement.`,
        details: missingReceiptDetails,
        target: "quittances",
        cta: "Gérer les quittances",
      });
    }

    const endingSoonCards = leaseCards.filter((card) => card.leaseEndingSoon);
    if (endingSoonCards.length > 0) {
      actions.push({
        tone: "amber",
        title: `${endingSoonCards.length} bail${endingSoonCards.length > 1 ? "s" : ""} à surveiller`,
        desc: "Décidez si le bail continue, s’il faut un avenant, ou si vous devez préparer une sortie.",
        details: endingSoonCards
          .slice(0, 3)
          .map((card) => `${card.propertyLabel} · ${card.tenantName} · fin ${fmtDate(card.lease.end_date)}`),
        target: "locataires",
        cta: "Préparer les départs",
      });
    }

    for (const alert of alerts) {
      const target = actionTarget(alert.action);
      if (!target) continue;
      if (onboardingIncomplete && (target === "biens" || target === "locataires" || target === "baux")) continue;
      if (actions.some((action) => action.target === target && action.title === alert.title)) continue;
      actions.push({
        tone: alert.tone === "red" ? "red" : alert.tone === "amber" ? "amber" : "emerald",
        title: alert.title,
        desc: alert.desc,
        target,
        cta: alert.action,
      });
    }

    const visibleActions = actions
      .map((action) => ({ ...action, id: action.id || priorityActionId(action) }))
      .filter((action) => !isSnoozeActive(alertSnoozes[action.id]));

    if (visibleActions.length === 0) {
      actions.push({
        id: "no-urgent-action",
        tone: "emerald",
        title: actions.length > 0 ? "Alertes mises de côté" : "Rien d’urgent aujourd’hui",
        desc: actions.length > 0
          ? "Vous avez masqué les actions en cours. Elles restent accessibles dans leurs sections et reviendront après snooze si nécessaire."
          : "Le mois est propre. Surveillez simplement les encaissements et les charges.",
        target: "finance",
        cta: "Voir la finance",
        snoozable: false,
      });
      return actions.slice(-1);
    }

    return visibleActions.slice(0, 5);
  }, [
    activeLeases.length,
    alertSnoozes,
    alerts,
    currentMonthReceipts.length,
    incompletePayments,
    lateCount,
    leaseCards,
    monthlyExpected,
    onboarding.doneCount,
    onboarding.next,
    onboarding.percent,
    onboarding.steps.length,
    onboarding.sub,
    rentsToCollect,
    ratio,
    remainingToCollect,
  ]);

  const healthDetails = useMemo(() => {
    const hasActiveLease = activeLeases.length > 0;
    const rows = [
      {
        label: "Encaissement",
        value: monthlyExpected === 0 ? "À configurer" : hasOnlyUpcomingRents ? "À venir" : `${ratio}%`,
        tone: monthlyExpected === 0 ? "amber" : hasOnlyUpcomingRents ? "emerald" : ratio >= 95 ? "emerald" : ratio >= 70 ? "amber" : "red",
        desc:
          monthlyExpected === 0
            ? "Créez un bail actif pour générer les loyers attendus."
            : hasOnlyUpcomingRents
            ? `${formatEuro(upcomingTotal)} attendu${nextDueDate ? ` le ${fmtDate(toISODate(nextDueDate))}` : " prochainement"}. Aucune confirmation n’est requise aujourd’hui.`
            : remainingToCollect > 0
            ? `${formatEuro(remainingToCollect)} reste à confirmer dans Quittances.`
            : "Tous les loyers attendus sont confirmés.",
        target: monthlyExpected === 0 ? ("baux" as LandlordSectionKey) : !hasOnlyUpcomingRents && remainingToCollect > 0 ? ("quittances" as LandlordSectionKey) : null,
      },
      {
        label: "Retards",
        value: lateCount > 0 ? `${lateCount}` : "0",
        tone: !hasActiveLease ? "amber" : lateCount > 0 ? "red" : "emerald",
        desc: !hasActiveLease
          ? "Aucun bail actif à suivre pour le moment."
          : lateCount > 0
          ? "Traitez les paiements échus non confirmés."
          : "Aucun loyer échu en retard.",
        target: lateCount > 0 ? ("quittances" as LandlordSectionKey) : null,
      },
      {
        label: "Quittances",
        value: activeLeases.length === 0 ? "À créer" : hasOnlyUpcomingRents ? "À venir" : `${receiptCoverage}%`,
        tone: activeLeases.length === 0 ? "amber" : hasOnlyUpcomingRents ? "emerald" : receiptCoverage >= 100 ? "emerald" : receiptCoverage >= 50 ? "amber" : "red",
        desc:
          activeLeases.length === 0
            ? "Créez un bail actif pour démarrer le workflow."
            : hasOnlyUpcomingRents
            ? "La quittance sera à générer après confirmation du paiement."
            : receiptCoverage < 100
            ? "Certaines quittances du mois ne sont pas encore prêtes."
            : "Les quittances du mois sont prêtes.",
        target: activeLeases.length === 0 ? ("baux" as LandlordSectionKey) : !hasOnlyUpcomingRents && receiptCoverage < 100 ? ("quittances" as LandlordSectionKey) : null,
      },
      {
        label: "Occupation",
        value: `${occupancySnapshot.rate}%`,
        tone: occupancySnapshot.rate >= 80 ? "emerald" : occupancySnapshot.rate >= 60 ? "amber" : "red",
        desc: occupancySnapshot.vacantCount
          ? `${occupancySnapshot.vacantCount} logement${occupancySnapshot.vacantCount > 1 ? "s" : ""} sans bail actif.`
          : "Tous les biens connus ont un bail actif.",
        target: occupancySnapshot.vacantCount || occupancySnapshot.rate < 100 ? ("biens" as LandlordSectionKey) : null,
      },
    ] as const;
    return rows;
  }, [activeLeases.length, hasOnlyUpcomingRents, lateCount, monthlyExpected, nextDueDate, occupancySnapshot, ratio, receiptCoverage, remainingToCollect, upcomingTotal]);

  const toneFromPercent = (percent: number) =>
    (percent >= 100 ? "emerald" : percent >= 66 ? "indigo" : percent >= 33 ? "amber" : "slate");

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ═══════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════ */}
      <div className="relative">
      <section className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">

        {/* Gradient header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#4338ca] via-[#4d9cff] to-[#06b6d4] px-5 py-7 sm:px-7">
          <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/50">Cockpit bailleur</p>
              <h2 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">Bonjour, voici le point du jour</h2>
              <p className="mt-1 text-sm text-white/60">{fmtDate(monthRange.startISO)} → {fmtDate(monthRange.endISO)}</p>

              {/* Revenu mensuel */}
              {monthlyExpected > 0 ? (
                <div className="mt-5 flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">{formatEuro(monthlyExpected)}</span>
                  <span className="text-sm text-white/60">attendus ce mois</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ratio >= 95 ? "bg-emerald-400/25 text-white" : ratio >= 70 ? "bg-amber-400/25 text-white" : "bg-red-400/25 text-white"}`}>
                    {hasOnlyUpcomingRents ? "À venir" : `${ratio}% encaissé`}
                  </span>
                </div>
              ) : (
                <div className="mt-5">
                  <span className="text-sm text-white/50">Aucun loyer configuré ce mois</span>
                </div>
              )}

              {/* Plan — discret, en bas */}
              {planLabel && (
                <div className="mt-5">
                  <span className="rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[0.62rem] font-semibold text-white/50">
                    Plan {planLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Score — hover → weather popover */}
            <div
              onMouseEnter={onScoreEnter}
              onMouseLeave={onScoreLeave}
              className="flex shrink-0 cursor-default flex-col items-center gap-1.5 rounded-2xl bg-white/15 px-5 py-5 backdrop-blur transition-all duration-150 hover:bg-white/22"
            >
              <p className="text-[0.58rem] font-semibold uppercase tracking-widest text-white/55">Score</p>
              <p className="text-4xl font-extrabold leading-none text-white">{healthScore}</p>
              <p className="text-[0.6rem] text-white/45">/100</p>
              <div className="mt-2 h-1.5 w-14 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${healthScore > 0 ? Math.max(8, Math.min(100, healthScore)) : 0}%` }} />
              </div>
              <p className="mt-0.5 text-[0.62rem] font-semibold text-white/70">
                {healthScore >= 90 ? "Excellent" : healthScore >= 75 ? "Bon" : healthScore >= 50 ? "À améliorer" : "À traiter"}
              </p>
            </div>
          </div>
        </div>

        {/* ── KPI strip — tuiles individuelles avec coins arrondis ── */}
        <div className="grid grid-cols-2 gap-2 bg-[#f1f5f9] px-3 pb-3 pt-2 sm:grid-cols-4">
          <button type="button" onClick={() => onGo("quittances")}
            className="flex min-h-[108px] flex-col gap-1 rounded-2xl bg-white px-4 py-4 text-left shadow-sm transition hover:shadow-md active:scale-[0.98]">
            <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-slate-400">Encaissement</p>
            <p className={`text-2xl font-extrabold ${hasOnlyUpcomingRents ? "text-emerald-600" : ratio >= 95 ? "text-emerald-600" : ratio >= 70 ? "text-amber-600" : "text-red-600"}`}>
              {hasOnlyUpcomingRents ? "À venir" : `${ratio}%`}
            </p>
            {monthlyExpected > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all duration-700 ${ratio >= 95 ? "bg-emerald-500" : ratio >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, ratio)}%` }} />
              </div>
            )}
            <p className="text-[0.68rem] text-slate-500">{formatEuro(monthlyPaid)} / {formatEuro(monthlyExpected)}</p>
          </button>

          <button type="button" onClick={() => lateCount > 0 ? onGo("quittances") : undefined}
            className={`flex min-h-[108px] flex-col gap-1 rounded-2xl bg-white px-4 py-4 text-left shadow-sm transition ${lateCount > 0 ? "cursor-pointer hover:shadow-md active:scale-[0.98]" : "cursor-default"}`}>
            <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-slate-400">Retards</p>
            <p className={`text-2xl font-extrabold ${lateCount > 0 ? "text-red-600" : "text-emerald-600"}`}>{lateCount}</p>
            <span className={`inline-flex self-start rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${lateCount > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
              {lateCount > 0 ? `${lateCount} en retard` : "Aucun retard"}
            </span>
            <p className="text-[0.68rem] text-slate-500">{lateCount > 0 ? "Action requise →" : "Tout est à jour"}</p>
          </button>

          <button type="button" onClick={() => onGo("biens")}
            className="flex min-h-[108px] flex-col gap-1 rounded-2xl bg-white px-4 py-4 text-left shadow-sm transition hover:shadow-md active:scale-[0.98]">
            <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-slate-400">Occupation</p>
            <p className={`text-2xl font-extrabold ${occupancySnapshot.rate >= 80 ? "text-emerald-600" : occupancySnapshot.rate >= 60 ? "text-amber-600" : "text-red-600"}`}>
              {occupancySnapshot.rate}%
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${occupancySnapshot.rate >= 80 ? "bg-emerald-500" : occupancySnapshot.rate >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${occupancySnapshot.rate}%` }} />
            </div>
            <p className="text-[0.68rem] text-slate-500">
              {occupancySnapshot.occupiedCount}/{occupancySnapshot.total} logement{occupancySnapshot.total > 1 ? "s" : ""}
              {occupancySnapshot.vacantCount > 0 ? ` · ${occupancySnapshot.vacantCount} vacant` : ""}
            </p>
          </button>

          <button type="button" onClick={() => onGo("baux")}
            className="flex min-h-[108px] flex-col gap-1 rounded-2xl bg-white px-4 py-4 text-left shadow-sm transition hover:shadow-md active:scale-[0.98]">
            <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-slate-400">Dépôts en gestion</p>
            <p className="text-2xl font-extrabold text-indigo-600">{depositTotal > 0 ? formatEuro(depositTotal) : "—"}</p>
            <p className="text-[0.68rem] text-slate-500">
              {activeLeases.length} bail{activeLeases.length > 1 ? "s" : ""} actif{activeLeases.length > 1 ? "s" : ""}
              {receiptCoverage > 0 ? ` · quittances ${receiptCoverage}%` : ""}
            </p>
          </button>
        </div>
      </section>

      {/* ── Weather popover (score badge hover) ───────────────── */}
      {scoreHovered && (
        <div
          onMouseEnter={onScoreEnter}
          onMouseLeave={onScoreLeave}
          className="absolute right-0 top-[148px] z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
        >
          {/* Header météo */}
          <div className={`px-4 py-3 ${
            healthScore >= 90 ? "bg-amber-50" :
            healthScore >= 75 ? "bg-sky-50" :
            healthScore >= 50 ? "bg-slate-100" :
            "bg-slate-200"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score de gestion</p>
                <p className="text-sm font-bold text-slate-900">
                  {healthScore >= 90 ? "Temps superbe" : healthScore >= 75 ? "Beau fixe" : healthScore >= 50 ? "Ciel variable" : "Perturbé"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl leading-none">
                  {healthScore >= 90 ? "☀️" : healthScore >= 75 ? "🌤️" : healthScore >= 50 ? "⛅" : "🌧️"}
                </p>
                <p className="mt-0.5 text-xs font-bold text-slate-600">{healthScore}/100</p>
              </div>
            </div>
          </div>
          {/* Lignes par KPI */}
          <div className="divide-y divide-slate-100">
            {healthDetails.map((detail) => {
              const icon = detail.tone === "emerald" ? "☀️" : detail.tone === "amber" ? "⛅" : detail.tone === "red" ? "🌧️" : "🌤️";
              return (
                <button
                  key={detail.label}
                  type="button"
                  onClick={() => { detail.target && onGo(detail.target); setScoreHovered(false); }}
                  disabled={!detail.target}
                  className={"flex w-full items-center gap-3 px-4 py-3 text-left " + (detail.target ? "hover:bg-slate-50" : "cursor-default")}
                >
                  <span className="text-base leading-none">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800">{detail.label}</p>
                    <p className="truncate text-[0.68rem] text-slate-500">{detail.desc}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-bold ${
                    detail.tone === "emerald" ? "bg-emerald-50 text-emerald-700" :
                    detail.tone === "amber" ? "bg-amber-50 text-amber-700" :
                    detail.tone === "red" ? "bg-red-50 text-red-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>{detail.value}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      </div>{/* end relative wrapper */}

      {/* ── Alertes météo biens ──────────────────────────────── */}
      {/* Risques climatiques sur les biens — toujours visible après chargement */}
      {weatherLoaded && (
        weatherAlerts.length > 0 ? (
          /* ── État alerte ── */
          <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
            <div className="flex items-center gap-3 border-b border-amber-200/70 px-4 py-3">
              {/* Icône météo composée — nuage + éclair */}
              <span className="relative shrink-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/>
                    <polyline points="13 11 9 17 15 17 11 23"/>
                  </svg>
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-900">Risques climatiques sur vos biens</p>
                <p className="text-[0.65rem] text-amber-700">Événements pouvant affecter vos logements dans les 3 prochains jours</p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-amber-200 px-2.5 py-0.5 text-[0.65rem] font-bold text-amber-800">
                {weatherAlerts.length} risque{weatherAlerts.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="divide-y divide-amber-100">
              {weatherAlerts.map((a) => {
                const dayLabel = a.day === "today" ? "Aujourd'hui" : a.day === "tomorrow" ? "Demain" : "Après-demain";
                return (
                  <div key={a.propertyId + a.type} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="mt-0.5 text-lg leading-none">{a.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900">
                        {a.message}
                        <span className="ml-1.5 font-normal text-slate-500">· {a.propertyLabel}</span>
                      </p>
                      <p className="text-[0.68rem] text-amber-700">{a.tip}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${
                      a.severity === "high" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── État calme ── */
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            {/* Icône composée : soleil + bouclier en badge */}
            <span className="relative shrink-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4"/>
                  <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-emerald-50">
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-white" fill="currentColor" aria-hidden="true">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1.5 13.5l-3-3 1.06-1.06 1.94 1.94 4.44-4.44 1.06 1.06-5.5 5.5z"/>
                </svg>
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-emerald-900">Risques climatiques sur vos biens</p>
              <p className="text-[0.68rem] text-emerald-700">Aucun événement à risque détecté sur vos logements dans les 3 prochains jours</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.62rem] font-semibold text-emerald-700">
              Protégé ✓
            </span>
          </div>
        )
      )}

      {/* ── Agenda contextuel ─────────────────────────────────────────────── */}
      {contextualEvents.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">À faire</p>
          {contextualEvents.map((evt) => {
            const isHigh   = evt.urgency === "high";
            const isMedium = evt.urgency === "medium";
            const bgIcon   = isHigh ? "bg-red-100" : isMedium ? "bg-amber-100" : "bg-indigo-50";
            const clrIcon  = isHigh ? "text-red-600" : isMedium ? "text-amber-600" : "text-indigo-500";
            const bgBadge  = isHigh ? "bg-red-100 text-red-700" : isMedium ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
            const dayLabel = evt.days === 0 ? "Aujourd'hui" : evt.days === 1 ? "Demain" : `Dans ${evt.days}j`;
            return (
              <button
                key={`${evt.type}-${evt.leaseId}`}
                type="button"
                onClick={() => onNavigateDeep?.("baux", evt.type === "anniversary" ? { leaseId: evt.leaseId, openPanel: "irl" } : { leaseId: evt.leaseId })}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-sm active:scale-[0.99]"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bgIcon}`}>
                  {evt.type === "anniversary"
                    ? <ArrowTrendingUpIcon className={`h-4 w-4 ${clrIcon}`} aria-hidden="true" />
                    : <CalendarDaysIcon    className={`h-4 w-4 ${clrIcon}`} aria-hidden="true" />
                  }
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {evt.type === "anniversary" ? "Réviser le loyer" : "Bail se termine"} · {evt.tenantName}
                  </p>
                  <p className="text-xs text-slate-500">{evt.propertyLabel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${bgBadge}`}>{dayLabel}</span>
                  {evt.type === "anniversary" && (
                    <p className="mt-0.5 text-[0.68rem] text-indigo-500">Réviser avec IRL →</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MAIN GRID
      ═══════════════════════════════════════════════════ */}
      {/* Grid 4 cellules : les items de la même ligne CSS partagent la même hauteur */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr),minmax(0,2fr)]">

          {/* Loyers du mois — tableau par bail */}
          {leaseCards.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Loyers du mois</p>
                  <p className="text-xs text-slate-500">{fmtDate(monthRange.startISO)} — {fmtDate(monthRange.endISO)}</p>
                </div>
                <button type="button" onClick={() => onGo("quittances")}
                  className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700">
                  Gérer →
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {leaseCards.map((card) => (
                  <button key={card.lease.id} type="button" onClick={() => onGo("quittances")}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <HomeModernIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{card.propertyLabel}</p>
                      <p className="truncate text-xs text-slate-500">
                        {card.tenantName}
                        {card.leaseEndingSoon ? <span className="ml-2 font-semibold text-amber-600">· Fin bail proche</span> : null}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-slate-900">{card.total > 0 ? formatEuro(card.total) : "—"}</p>
                      {card.dueDate && <p className="text-xs text-slate-400">Éch. {fmtDate(toISODate(card.dueDate))}</p>}
                    </div>
                    <div className="flex shrink-0 min-w-[96px] flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold ${
                        card.paymentStatus === "Encaissé" ? "bg-emerald-50 text-emerald-700" :
                        card.paymentStatus === "En retard" ? "bg-red-50 text-red-700" :
                        card.paymentStatus === "À venir" ? "bg-sky-50 text-sky-700" :
                        "bg-amber-50 text-amber-700"
                      }`}>{card.paymentStatus}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold ${
                        card.hasReceipt ? "bg-emerald-50 text-emerald-600" :
                        card.paymentStatus === "Encaissé" ? "bg-amber-50 text-amber-600" :
                        "bg-slate-100 text-slate-400"
                      }`}>
                        {card.hasReceipt ? "Quittance ✓" : card.paymentStatus === "Encaissé" ? "Quittance ⚠" : "Quittance —"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Trésorerie (col 2, row 1 — même hauteur que Loyers) ── */}
          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:row-start-1 lg:col-start-2">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Trésorerie 6 mois</p>
                <p className="text-xs text-slate-500">Encaissé vs dépenses</p>
              </div>
              <button type="button" onClick={() => onGo("finance")} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                Finance →
              </button>
            </div>
            <div className="flex flex-1 items-end gap-1.5">
              {accountingSeries.map((row) => {
                const incH = maxChartValue > 0 ? Math.max(2, (row.income / maxChartValue) * 88) : 2;
                const expH = maxChartValue > 0 && row.expense > 0 ? Math.max(2, (row.expense / maxChartValue) * 88) : 0;
                return (
                  <div key={row.key} className="flex flex-1 flex-col items-center">
                    <div className="flex w-full items-end justify-center gap-0.5">
                      <div className="flex-1 rounded-t bg-emerald-400" style={{ height: `${incH}px`, minHeight: "2px" }} title={`Encaissé ${formatEuro(row.income)}`} />
                      {expH > 0 && <div className="flex-1 rounded-t bg-rose-400" style={{ height: `${expH}px` }} title={`Dépenses ${formatEuro(row.expense)}`} />}
                    </div>
                    <p className="mt-1.5 text-[0.6rem] text-slate-400">{monthLabel(row.key)}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
              {[
                { label: "Encaissé", value: formatEuro(accountingTotals.income), cls: "text-emerald-600" },
                { label: "Dépenses", value: formatEuro(accountingTotals.expense), cls: "text-rose-600" },
                { label: "Net", value: formatEuro(accountingTotals.net), cls: accountingTotals.net >= 0 ? "text-slate-900" : "text-red-600" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="text-center">
                  <p className="text-[0.6rem] text-slate-400">{label}</p>
                  <p className={`text-xs font-bold ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
            {transactionsLoading && <p className="mt-2 text-[0.65rem] text-slate-400">Chargement des écritures…</p>}
            {transactionsError && <p className="mt-2 text-[0.65rem] text-red-600">{transactionsError}</p>}
          </section>

          {/* ── Alertes (col 1, row 2) ──────────────────────────── */}
          <div className="space-y-2 lg:col-start-1 lg:row-start-2">
            {priorityActions.map((action, index) => (
              <div
                key={`${action.title}-${index}`}
                className="group relative overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <button type="button" onClick={() => action.target && onGo(action.target)} disabled={!action.target}
                  className={"block w-full rounded-2xl px-3 py-3 text-left " + (action.target ? "cursor-pointer" : "cursor-default")}>
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:pr-20 md:pr-24">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                        (action.tone === "red" ? "bg-red-50 text-red-700" : action.tone === "amber" ? "bg-amber-50 text-amber-700" : action.tone === "indigo" ? "bg-[#635bff]/10 text-[#4f46e5]" : "bg-emerald-50 text-emerald-700")
                      }>!</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-slate-500">Alerte</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <p className="text-sm font-semibold tracking-tight text-slate-950">{action.title}</p>
                        </div>
                        <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">{action.desc}</p>
                        {action.details?.length ? (
                          <p className="mt-1.5 break-words text-xs font-semibold text-slate-500 sm:truncate">{action.details.join(" · ")}</p>
                        ) : null}
                      </div>
                    </div>
                    {action.cta ? (
                      <span className="hidden shrink-0 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white md:inline-flex">{action.cta}</span>
                    ) : null}
                  </div>
                </button>
                {action.snoozable !== false && action.id ? (
                  <div className="px-3 pb-3 sm:absolute sm:right-3 sm:top-1/2 sm:z-20 sm:-translate-y-1/2 sm:px-0 sm:pb-0">
                    <div className="relative" data-alert-snooze-menu>
                      <button type="button" onClick={() => setOpenAlertMenuId(openAlertMenuId === action.id ? null : action.id)}
                        className="inline-flex min-h-8 items-center justify-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 opacity-100 shadow-sm transition hover:border-red-300 hover:bg-red-100 md:opacity-0 md:group-hover:opacity-100"
                        aria-expanded={openAlertMenuId === action.id}>
                        Masquer
                      </button>
                      {openAlertMenuId === action.id && (
                        <div className="absolute right-0 top-10 z-20 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.16)] lg:w-72">
                          <div className="px-2 pb-2 pt-1">
                            <p className="text-sm font-semibold text-slate-950">Masquer cette alerte</p>
                            <p className="mt-0.5 text-xs leading-5 text-slate-500">Choisissez si elle doit revenir demain ou disparaître de ce cockpit.</p>
                          </div>
                          <div className="grid gap-1">
                            <button type="button" onClick={() => snoozePriorityAction(action.id!, "tomorrow")}
                              className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-800 transition hover:bg-[#635bff]/5 hover:text-[#4f46e5]">
                              <BellIcon className="h-4 w-4 text-[#635bff]" aria-hidden="true" /> Me le rappeler demain
                            </button>
                            <button type="button" onClick={() => snoozePriorityAction(action.id!, "forever")}
                              className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-800 transition hover:bg-red-50 hover:text-red-700">
                              <NoSymbolIcon className="h-4 w-4 text-slate-500" aria-hidden="true" /> Ignorer définitivement
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* ── Actu Immobilier (col 2, row 2) ─────────────────── */}
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-start-2 lg:row-start-2">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-400 text-sm shadow-sm">📰</span>
                <div>
                  <p className="text-[0.72rem] font-bold text-slate-900">Actu Immobilier</p>
                  <p className="text-[0.6rem] text-slate-400 leading-tight">Mis à jour toutes les 15 min</p>
                </div>
              </div>
              <span className={`h-2 w-2 rounded-full ${newsLoading ? "bg-amber-400 animate-pulse" : news.length > 0 ? "bg-emerald-400" : "bg-slate-200"}`} title={newsLoading ? "Chargement…" : "Live"} />
            </div>

            {/* Skeleton loading */}
            {newsLoading && (
              <div className="space-y-px px-3 pb-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl px-1 py-2.5">
                    <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-3 w-3/4 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-2 w-1/3 animate-pulse rounded-full bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Articles */}
            {!newsLoading && news.length > 0 && (
              <div className="space-y-px px-3 pb-3">
                {news.slice(0, 5).map((item, i) => {
                  const ms = Date.now() - new Date(item.publishedAt).getTime();
                  const h = Math.floor(ms / 3_600_000);
                  const age = h < 1 ? "À l'instant" : h < 24 ? `${h}h` : `${Math.floor(h / 24)}j`;
                  return (
                    <a key={item.url + i} href={item.url} target="_blank" rel="noopener noreferrer"
                      className="group flex items-start gap-3 rounded-2xl px-1 py-2.5 transition hover:bg-slate-50 active:bg-slate-100">
                      {/* Thumbnail */}
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100 shadow-sm">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-100 text-xl">🏠</div>
                        )}
                      </div>
                      {/* Text */}
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="line-clamp-2 text-[0.75rem] font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">
                          {item.title}
                        </p>
                        <p className="mt-1.5 text-[0.62rem] text-slate-400">
                          <span className="font-medium text-slate-500">{item.source}</span>
                          {item.publishedAt ? <> · {age}</> : null}
                        </p>
                      </div>
                      <ArrowTopRightOnSquareIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-200 transition group-hover:text-indigo-400" aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            )}

            {/* Empty fallback */}
            {!newsLoading && news.length === 0 && (
              <p className="px-4 pb-4 text-xs text-slate-400">Aucun article disponible pour le moment.</p>
            )}
          </section>

      </div>

      {/* ── Notification mise en route ─────────────────────────── */}
      {!shouldHideOnboarding && (
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
          {/* Ligne résumé (toujours visible) */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <BellIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] font-semibold text-amber-900">
                Mise en route · {onboarding.doneCount}/{onboarding.steps.length} étapes terminées
              </p>
              {!notifExpanded && onboarding.next && (
                <p className="mt-0.5 truncate text-[0.73rem] text-amber-700">
                  À faire : {onboarding.next.label}
                </p>
              )}
            </div>
            {/* Barre de progression */}
            <div className="hidden w-16 shrink-0 sm:block">
              <div className="h-1.5 overflow-hidden rounded-full bg-amber-200">
                <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${onboarding.percent}%` }} />
              </div>
              <p className="mt-0.5 text-center text-[0.65rem] font-semibold text-amber-600">{onboarding.percent}%</p>
            </div>
            {/* Expand toggle */}
            <button
              type="button"
              onClick={() => setNotifExpanded((v) => !v)}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600 transition hover:bg-amber-200"
              aria-label={notifExpanded ? "Réduire" : "Voir les étapes"}
            >
              <ChevronDownIcon className={"h-4 w-4 transition-transform duration-200 " + (notifExpanded ? "rotate-180" : "")} aria-hidden="true" />
            </button>
            {/* Dismiss */}
            <button
              type="button"
              onClick={() => {
                setManuallyDismissed(true);
                try { window.localStorage.setItem(dismissedKey, "1"); } catch { /* ignore */ }
              }}
              className="shrink-0 rounded-lg px-1.5 py-1 text-[0.85rem] font-medium text-amber-400 transition hover:bg-amber-100 hover:text-amber-700"
              aria-label="Masquer"
            >
              ✕
            </button>
          </div>

          {/* Détail des étapes (expandable) */}
          {notifExpanded && (
            <div className="border-t border-amber-200 bg-white/60 px-4 py-3">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {onboarding.steps.map((step) => (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => onGo(step.key)}
                    className={
                      "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition " +
                      (step.done
                        ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                        : "border-amber-200 bg-amber-50 hover:bg-amber-100")
                    }
                  >
                    <span className={"mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full " + (step.done ? "bg-emerald-500" : "bg-amber-300")}>
                      {step.done
                        ? <CheckCircleIcon className="h-4 w-4 text-white" aria-hidden="true" />
                        : <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <div className="min-w-0">
                      <p className={"text-[0.78rem] font-semibold " + (step.done ? "text-emerald-800" : "text-amber-900")}>
                        {step.label}
                      </p>
                      <p className={"text-[0.7rem] " + (step.done ? "text-emerald-600" : "text-amber-700")}>
                        {step.key === "biens" ? "Adresse, infos, statut"
                          : step.key === "locataires" ? "Nom, email, contact"
                          : step.key === "baux" ? "Bien, locataire et loyer"
                          : "Prix et taux crédit"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              {onboarding.next && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onGo(onboarding.next!.key)}
                    className="rounded-full bg-amber-500 px-4 py-1.5 text-[0.73rem] font-semibold text-white transition hover:bg-amber-600"
                  >
                    Continuer : {onboarding.next.label} →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
        <SectionTitle
          kicker="Mois en cours"
          title="Encaissement et quittances"
          desc="La lecture opérationnelle du mois : ce qui est prévu, reçu, restant et documenté."
          right={
            <div className="flex flex-wrap gap-2">
              <Pill tone={hasOnlyUpcomingRents ? "emerald" : ratio >= 95 ? "emerald" : ratio >= 70 ? "amber" : "red"}>
                Encaissement {hasOnlyUpcomingRents ? "à venir" : `${ratio}%`}
              </Pill>
              <Pill tone={hasOnlyUpcomingRents ? "emerald" : receiptCoverage >= 100 ? "emerald" : receiptCoverage >= 50 ? "amber" : "red"}>
                Quittances {hasOnlyUpcomingRents ? "après paiement" : `${receiptCoverage}%`}
              </Pill>
            </div>
          }
        />

        <div className="-mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-5">
          <div className="min-w-[170px] snap-start sm:min-w-0"><KpiCard title="Attendu" value={formatEuro(monthlyExpected)} hint="Loyers + charges" /></div>
          <div className="min-w-[170px] snap-start sm:min-w-0"><KpiCard title="Encaissé" value={formatEuro(monthlyPaid)} hint={`${ratio}% du mois`} tone={ratio >= 95 ? "emerald" : "slate"} /></div>
          <div className="min-w-[170px] snap-start sm:min-w-0">
            <KpiCard
              title="À encaisser"
              value={formatEuro(remainingToCollect)}
              hint={upcomingTotal > 0 && rentsToCollect.length === 0 ? `${formatEuro(upcomingTotal)} à venir` : remainingToCollect > 0 ? "À suivre" : "OK"}
              tone={rentsToCollect.length > 0 ? "amber" : "emerald"}
            />
          </div>
          <div className="min-w-[170px] snap-start sm:min-w-0"><KpiCard title="Retards" value={String(lateCount)} hint={lateCount > 0 ? "Action requise" : "Aucun retard"} tone={lateCount > 0 ? "red" : "emerald"} /></div>
          <div className="min-w-[170px] snap-start sm:min-w-0"><KpiCard title="Dépôts" value={formatEuro(depositTotal)} hint="Baux actifs" tone="indigo" /></div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Loyers du mois à encaisser</p>
              <p className="mt-1 text-xs text-slate-600">
                Liste opérationnelle des loyers non confirmés sur la période affichée.
              </p>
            </div>
            {rentsToCollect.length > 0 ? (
              <button
                type="button"
                onClick={() => onGo("quittances")}
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Confirmer les loyers
              </button>
            ) : null}
          </div>

          {rentsToCollect.length === 0 ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              {upcomingRents.length > 0
                ? `Aucune action aujourd’hui. Prochaine échéance : ${fmtDate(toISODate(upcomingRents[0].dueDate!))}.`
                : "Tous les loyers attendus du mois sont confirmés."}
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid grid-cols-[1.2fr,0.9fr,0.7fr,0.7fr] gap-3 border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
                <span>Bien</span>
                <span>Locataire</span>
                <span>Statut</span>
                <span className="text-right">Montant</span>
              </div>
              <div className="divide-y divide-slate-100">
                {rentsToCollect.map((card) => (
                  <button
                    key={card.lease.id}
                    type="button"
                    onClick={() => onGo("quittances")}
                    className="grid w-full grid-cols-[1.2fr,0.9fr,0.7fr,0.7fr] gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="truncate font-semibold text-slate-900">{card.propertyLabel}</span>
                    <span className="truncate text-slate-700">{card.tenantName}</span>
                    <span>
                      <Pill tone={card.paymentStatus === "En retard" ? "red" : "amber"}>{card.paymentStatus}</Pill>
                    </span>
                    <span className="text-right font-semibold text-slate-900">{formatEuro(card.total)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <SectionTitle
          kicker="Comptabilité"
          title="Encaissements et dépenses sur 6 mois"
          desc="Le vert affiche uniquement les loyers confirmés encaissés. Les loyers attendus restent suivis dans Quittances tant que le paiement n’est pas pointé."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={accountingPropertyId}
                onChange={(e) => setAccountingPropertyId(e.target.value)}
                className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                aria-label="Filtrer le graphique par bien"
              >
                <option value="">Tous les biens</option>
                {propertyOptions.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.label || property.address_line1 || "Bien"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onGo("finance")}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Ouvrir Finance
              </button>
            </div>
          }
        />

        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr),280px]">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex h-64 items-end gap-3 overflow-x-auto border-b border-slate-200 pb-3">
              {accountingSeries.map((row) => {
                const incomeHeight = Math.max(4, (row.income / maxChartValue) * 190);
                const expenseHeight = Math.max(4, (row.expense / maxChartValue) * 190);
                return (
                  <div key={row.key} className="flex min-w-[72px] flex-1 flex-col items-center justify-end gap-2">
                    <div className="flex h-52 items-end gap-1">
                      <div className="w-5 rounded-t-lg bg-emerald-500" style={{ height: `${incomeHeight}px` }} title={`Encaissé ${formatEuro(row.income)}`} />
                      <div className="w-5 rounded-t-lg bg-rose-500" style={{ height: `${expenseHeight}px` }} title={`Dépenses ${formatEuro(row.expense)}`} />
                    </div>
                    <p className="text-xs font-semibold text-slate-600">{monthLabel(row.key)}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Encaissé</span>
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" /> Dépenses</span>
              {transactionsLoading ? <span>Chargement des écritures...</span> : null}
              {transactionsError ? <span className="text-red-700">{transactionsError}</span> : null}
            </div>
          </div>

          <div className="grid gap-3">
            <KpiCard title="Encaissé 6 mois" value={formatEuro(accountingTotals.income)} hint="Paiements confirmés" tone="emerald" />
            <KpiCard title="Dépenses 6 mois" value={formatEuro(accountingTotals.expense)} hint="Écritures sortantes" tone={accountingTotals.expense > 0 ? "red" : "slate"} />
            <KpiCard title="Résultat net" value={formatEuro(accountingTotals.net)} hint="Encaissé - dépenses" tone={accountingTotals.net >= 0 ? "emerald" : "red"} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle
          kicker="Par bien"
          title="Statut du parc"
          desc="Une lecture rapide par bail actif : paiement, quittance, montant et événement à surveiller."
        />

        {leaseCards.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
            Aucun bail actif. Ajoutez un bien, un locataire, puis créez un bail pour activer le suivi.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.3fr,0.8fr,0.8fr,0.8fr,auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
              <span>Bien / locataire</span>
              <span>Paiement</span>
              <span>Quittance</span>
              <span className="text-right">Mensuel</span>
              <span className="sr-only">Actions</span>
            </div>
            <div className="divide-y divide-slate-100 bg-white">
              {leaseCards.slice(0, 8).map((card) => (
                <div key={card.lease.id} className="grid grid-cols-[1.3fr,0.8fr,0.8fr,0.8fr,auto] items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{card.propertyLabel}</p>
                    <p className="truncate text-xs text-slate-600">{card.tenantName}</p>
                    {card.leaseEndingSoon ? (
                      <p className="mt-1 text-xs font-semibold text-amber-700">Fin à surveiller : {fmtDate(card.lease.end_date)}</p>
                    ) : null}
                  </div>
                  <div>
                    <Pill tone={card.paymentStatus === "Encaissé" ? "emerald" : card.paymentStatus === "En retard" ? "red" : "amber"}>
                      {card.paymentStatus}
                    </Pill>
                  </div>
                  <div>
                    <Pill tone={card.hasReceipt ? "emerald" : card.paymentStatus === "Encaissé" ? "amber" : "slate"}>
                      {card.hasReceipt ? "Prête" : card.paymentStatus === "Encaissé" ? "À générer" : "Après paiement"}
                    </Pill>
                  </div>
                  <p className="text-right font-semibold text-slate-900">{formatEuro(card.total)}</p>
                  <button
                    type="button"
                    onClick={() => onPrepareDeparture?.(card.lease.tenant_id)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Départ
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
