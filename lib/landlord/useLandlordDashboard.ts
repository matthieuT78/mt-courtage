// lib/landlord/useLandlordDashboard.ts
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "../supabaseClient";
import type {
  SimpleUser,
  LandlordSettings,
  Property,
  PropertyFinance,
  Tenant,
  Lease,
  RentPayment,
  RentReceipt,
} from "./types";
import { getLeaseRentPeriod } from "../rentPeriod";
import { getLeasePaymentDueDate } from "../rentSchedule";
import { isActivePropertyLike } from "./archiveFilters";

const pad2 = (value: number) => String(value).padStart(2, "0");
const fmtISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const RECEIPT_SNOOZE_STORAGE_PREFIX = "lokt.receiptSnoozes";
const getMonthRange = (base = new Date()) => {
  const y = base.getFullYear();
  const m = base.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { startISO: fmtISO(start), endISO: fmtISO(end) };
};
const toMonthISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const periodKey = (leaseId: string, yyyymm: string) => `${leaseId}__${yyyymm}`;
const dateOnlyTime = (value?: string | null) => {
  if (!value) return 0;
  const d = new Date(String(value).slice(0, 10));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};
const monthStartEnd = (yyyymm: string) => {
  const [year, month] = yyyymm.split("-").map(Number);
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0),
  };
};
const recentMonthKeys = (count: number, base = new Date()) =>
  Array.from({ length: count }, (_, index) => toMonthISO(new Date(base.getFullYear(), base.getMonth() - index, 1)));
const yyyymmFromPayment = (payment: RentPayment | any) => {
  const period = String(payment?.period || "");
  if (/^\d{4}-\d{2}$/.test(period)) return period;
  const periodStart = String(payment?.period_start || "");
  if (periodStart.length >= 7) return periodStart.slice(0, 7);
  const paidForMonth = String(payment?.paid_for_month || "");
  if (/^\d{4}-\d{2}$/.test(paidForMonth)) return paidForMonth;
  const createdAt = String(payment?.created_at || "");
  return createdAt.length >= 7 ? createdAt.slice(0, 7) : "";
};
const yyyymmFromReceipt = (receipt: RentReceipt | any) => String(receipt?.period_start || "").slice(0, 7);
const isPaymentPaid = (payment?: RentPayment | any | null) => {
  if (!payment) return false;
  const status = String(payment?.status || "").toLowerCase();
  return status === "paid" || status === "ok" || status === "confirmed" || !!payment?.paid_at || !!payment?.confirmed_at;
};
const isLeaseExpectedForMonth = (lease: Lease, yyyymm: string) => {
  const { start, end } = monthStartEnd(yyyymm);
  const status = String((lease as any).status || "").toLowerCase();
  if (status === "draft") return false;
  // archived/ended: only show for months within their active period (never future alerts)
  if ((status === "archived" || status === "ended") && !lease.end_date) return false;
  if (lease.start_date && dateOnlyTime(lease.start_date) > end.getTime()) return false;
  if (lease.end_date && dateOnlyTime(lease.end_date) < start.getTime()) return false;
  return status === "active" || status === "ended" || status === "archived" || (!status && !!lease.start_date);
};

export function useLandlordDashboard() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<SimpleUser | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [landlord, setLandlord] = useState<LandlordSettings | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyFinance, setPropertyFinance] = useState<PropertyFinance[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [receipts, setReceipts] = useState<RentReceipt[]>([]);
  const [receiptSnoozeKeys, setReceiptSnoozeKeys] = useState<Set<string>>(new Set());

  // --- Auth (client side)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!supabase) {
          if (mounted) {
            setError(
              "Supabase n’est pas configuré (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes)."
            );
          }
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const u = data.session?.user;
        if (!u?.id) {
          const redirect = encodeURIComponent("/espace-bailleur");
          router.replace(`/mon-compte?mode=login&redirect=${redirect}`);
          return;
        }

        if (!mounted) return;
        setUser({ id: u.id, email: u.email ?? undefined });
      } catch (e: any) {
        console.error(e);
        if (mounted) setError(e?.message || "Erreur d’authentification.");
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    })();

    const { data: sub } =
      supabase?.auth.onAuthStateChange((_evt, session) => {
        const u = session?.user;
        if (!u?.id) {
          const redirect = encodeURIComponent("/espace-bailleur");
          router.replace(`/mon-compte?mode=login&redirect=${redirect}`);
          return;
        }
        setUser({ id: u.id, email: u.email ?? undefined });
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [router]);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError(
        "Supabase n’est pas configuré (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes)."
      );
      return;
    }
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const { data: landlordData, error: landlordError } = await supabase
        .from("landlords")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (landlordError) throw landlordError;
      setLandlord((landlordData as any) ?? null);

      const [
        { data: pData, error: pErr },
        { data: tData, error: tErr },
        { data: lData, error: lErr },
      ] = await Promise.all([
        supabase
          .from("properties")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("tenants")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("leases")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (pErr) throw pErr;
      if (tErr) throw tErr;
      if (lErr) throw lErr;

      const leasesArr: Lease[] = ((lData as any) ?? []) as Lease[];
      const propertiesArr: Property[] = ((pData as any) ?? []) as Property[];
      setProperties(propertiesArr);
      setTenants(((tData as any) ?? []) as Tenant[]);
      setLeases(leasesArr);

      if (propertiesArr.length === 0) {
        setPropertyFinance([]);
      } else {
        const { data: financeData, error: financeErr } = await supabase
          .from("property_finance")
          .select("*")
          .eq("user_id", user.id);

        if (financeErr) {
          console.warn("Impossible de charger la configuration financière des biens.", financeErr);
          setPropertyFinance([]);
        } else {
          setPropertyFinance(((financeData as any) ?? []) as PropertyFinance[]);
        }
      }

      const leaseIds = leasesArr.map((x) => x.id);

      if (leaseIds.length === 0) {
        setPayments([]);
        setReceipts([]);
        return;
      }

      const [
        { data: payData, error: payErr },
        { data: rData, error: rErr },
      ] = await Promise.all([
        supabase
          .from("rent_payments")
          .select("*")
          .in("lease_id", leaseIds)
          .order("created_at", { ascending: false })
          .limit(90),
        supabase
          .from("rent_receipts")
          .select("*")
          .in("lease_id", leaseIds)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (payErr) throw payErr;
      if (rErr) throw rErr;

      setPayments(((payData as any) ?? []) as RentPayment[]);
      setReceipts(((rData as any) ?? []) as RentReceipt[]);
    } catch (e: any) {
      setError(
        e?.message ||
          "Impossible de charger votre espace bailleur pour le moment."
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    // déclenche quand user.id est disponible
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") {
      setReceiptSnoozeKeys(new Set());
      return;
    }

    const storageKey = `${RECEIPT_SNOOZE_STORAGE_PREFIX}:${user.id}`;
    const readSnoozes = () => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        const values = raw ? JSON.parse(raw) : [];
        setReceiptSnoozeKeys(new Set(Array.isArray(values) ? values.map(String) : []));
      } catch {
        setReceiptSnoozeKeys(new Set());
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) readSnoozes();
    };

    readSnoozes();
    window.addEventListener("storage", onStorage);
    window.addEventListener("lokt:receipt-snoozes", readSnoozes);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("lokt:receipt-snoozes", readSnoozes);
    };
  }, [user?.id]);

  // --- derived maps
  const propertyById = useMemo(
    () => new Map((properties || []).map((p) => [p.id, p])),
    [properties]
  );
  const tenantById = useMemo(
    () => new Map((tenants || []).map((t) => [t.id, t])),
    [tenants]
  );

  // --- active leases
  const activeLeases = useMemo(() => {
    const now = new Date();
    return (leases || []).filter((l) => {
      const status = String(l.status || "").toLowerCase();
      const startOk = l.start_date ? new Date(l.start_date) <= now : false;
      const notEnded = !l.end_date || new Date(l.end_date) >= now;
      if (status === "ended" || status === "archived" || status === "draft") return false;
      return startOk && notEnded;
    });
  }, [leases]);

  // --- KPIs
  const monthRange = useMemo(() => getMonthRange(new Date()), []);
  const paymentsThisMonth = useMemo(
    () =>
      (payments || []).filter(
        (p) =>
          p.period_start >= monthRange.startISO &&
          p.period_start <= monthRange.endISO
      ),
    [payments, monthRange]
  );
  const receiptsThisMonth = useMemo(
    () =>
      (receipts || []).filter(
        (r) =>
          r.period_start >= monthRange.startISO &&
          r.period_start <= monthRange.endISO
      ),
    [receipts, monthRange]
  );

  const monthlyExpected = useMemo(
    () =>
      activeLeases.reduce(
        (sum, l) => sum + Number(getLeaseRentPeriod(l, monthRange.startISO.slice(0, 7))?.total || 0),
        0
      ),
    [activeLeases, monthRange.startISO]
  );

  const monthlyPaid = useMemo(
    () =>
      paymentsThisMonth.reduce(
        (sum, p) => sum + (p.paid_at ? Number(p.total_amount || 0) : 0),
        0
      ),
    [paymentsThisMonth]
  );

  const lateCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = monthRange.startISO.slice(0, 7);
    const activeLeaseIds = new Set(activeLeases.map((l) => l.id));

    // Mois passés : paiements non payés sur baux actifs uniquement (baux archivés/clôturés exclus)
    const pastOverdueLeaseIds = new Set(
      (payments || [])
        .filter((p) => {
          if (!activeLeaseIds.has(String(p.lease_id || ""))) return false;
          const period = String(p.period_start || "").slice(0, 7);
          return period < currentMonth && !p.paid_at;
        })
        .map((p) => p.lease_id)
    );

    // Mois courant : échéance dépassée et non payé (en excluant les bails déjà comptés)
    const currentMonthLate = activeLeases.filter((lease) => {
      if (pastOverdueLeaseIds.has(lease.id)) return false;
      const dueDate = getLeasePaymentDueDate(lease, currentMonth);
      if (!dueDate || dueDate >= today) return false;
      const expected = Number(getLeaseRentPeriod(lease, currentMonth)?.total || 0);
      const payment = paymentsThisMonth.find((row) => row.lease_id === lease.id);
      return !payment?.paid_at || Number(payment.total_amount || 0) + 0.01 < expected;
    }).length;

    return pastOverdueLeaseIds.size + currentMonthLate;
  }, [activeLeases, monthRange.startISO, payments, paymentsThisMonth]);

  const monthlyDueExpected = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = monthRange.startISO.slice(0, 7);
    return activeLeases.reduce((sum, lease) => {
      const dueDate = getLeasePaymentDueDate(lease, currentMonth);
      return dueDate && dueDate <= today ? sum + Number(getLeaseRentPeriod(lease, currentMonth)?.total || 0) : sum;
    }, 0);
  }, [activeLeases, monthRange.startISO]);

  const monthlyDuePaid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = monthRange.startISO.slice(0, 7);
    return activeLeases.reduce((sum, lease) => {
      const dueDate = getLeasePaymentDueDate(lease, currentMonth);
      if (!dueDate || dueDate > today) return sum;
      const payment = paymentsThisMonth.find((row) => row.lease_id === lease.id);
      return sum + (payment?.paid_at ? Number(payment.total_amount || 0) : 0);
    }, 0);
  }, [activeLeases, monthRange.startISO, paymentsThisMonth]);

  const receiptExpectedCount = useMemo(() => {
    const currentMonth = monthRange.startISO.slice(0, 7);
    return activeLeases.filter((lease) => {
      const expected = Number(getLeaseRentPeriod(lease, currentMonth)?.total || 0);
      const payment = paymentsThisMonth.find((row) => row.lease_id === lease.id);
      return !!payment?.paid_at && Number(payment.total_amount || 0) + 0.01 >= expected;
    }).length;
  }, [activeLeases, monthRange.startISO, paymentsThisMonth]);

  const missingReceiptsAfterPaymentCount = useMemo(() => {
    const receiptLeaseIds = new Set(receiptsThisMonth.map((receipt) => receipt.lease_id));
    return activeLeases.filter((lease) => {
      if (receiptLeaseIds.has(lease.id)) return false;
      const payment = paymentsThisMonth.find((row) => row.lease_id === lease.id);
      const expected = Number(getLeaseRentPeriod(lease, monthRange.startISO.slice(0, 7))?.total || 0);
      return !!payment?.paid_at && Number(payment.total_amount || 0) + 0.01 >= expected;
    }).length;
  }, [activeLeases, monthRange.startISO, paymentsThisMonth, receiptsThisMonth]);

  const receiptWorkflowIssueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paymentByPeriod = new Map<string, RentPayment>();
    for (const payment of payments || []) {
      const leaseId = String(payment?.lease_id || "");
      const yyyymm = yyyymmFromPayment(payment);
      if (!leaseId || !yyyymm) continue;
      const key = periodKey(leaseId, yyyymm);
      const existing = paymentByPeriod.get(key);
      const paymentDate = String((payment as any)?.updated_at || payment?.created_at || "");
      const existingDate = String((existing as any)?.updated_at || existing?.created_at || "");
      if (!existing || paymentDate.localeCompare(existingDate) > 0) paymentByPeriod.set(key, payment);
    }

    const receiptByPeriod = new Map<string, RentReceipt>();
    for (const receipt of receipts || []) {
      const leaseId = String(receipt?.lease_id || "");
      const yyyymm = yyyymmFromReceipt(receipt);
      if (leaseId && yyyymm) receiptByPeriod.set(periodKey(leaseId, yyyymm), receipt);
    }

    let count = 0;
    for (const lease of activeLeases) {
      // Même fenêtre que l'onglet "Actions" de Quittances (SectionQuittances.tsx,
      // LOOKBACK_MONTHS) pour que ce chiffre corresponde à ce qu'on trouve en cliquant.
      for (const yyyymm of recentMonthKeys(24)) {
        if (!isLeaseExpectedForMonth(lease, yyyymm)) continue;

        const expected = Number(getLeaseRentPeriod(lease, yyyymm)?.total || 0);
        if (expected <= 0) continue;

        const key = periodKey(lease.id, yyyymm);
        const payment = paymentByPeriod.get(key) || null;
        const receipt = receiptByPeriod.get(key) || null;
        const paid = isPaymentPaid(payment);
        const received = Number(payment?.total_amount || 0);
        const ownerConfirmedUnpaid = String(payment?.source || "") === "owner_unpaid_email";
        const partial = paid && received + 0.01 < expected;

        const dueDate = getLeasePaymentDueDate(lease, yyyymm);
        const controlDate = dueDate ? new Date(dueDate) : null;
        if (controlDate) controlDate.setDate(controlDate.getDate() + 2);
        const late = !paid && !!controlDate && today.getTime() > controlDate.getTime();

        const receiptStatus = String((receipt as any)?.status || "").toLowerCase();
        const receiptSent = receiptStatus === "sent" || !!(receipt as any)?.sent_at;
        const receiptReady = !!receipt?.pdf_url && (receiptStatus === "generated" || receiptStatus === "sent");
        const receiptsDisabled = !!(lease as any).receipts_disabled;
        const paidReceiptTask = !receiptsDisabled && paid && received + 0.01 >= expected && !receiptSent && !receiptReady;
        const readyNotSentTask = !receiptsDisabled && paid && received + 0.01 >= expected && receiptReady && !receiptSent;

        if (receiptSnoozeKeys.has(key) && (paidReceiptTask || readyNotSentTask)) continue;
        if (partial || ownerConfirmedUnpaid || late || paidReceiptTask || readyNotSentTask) count += 1;
      }
    }

    return count;
  }, [activeLeases, payments, receipts, receiptSnoozeKeys]);

  const depositTotal = useMemo(
    () =>
      activeLeases.reduce(
        (sum, l) => sum + Number(l.deposit_amount || 0),
        0
      ),
    [activeLeases]
  );

  const activeProperties = useMemo(() => (properties || []).filter(isActivePropertyLike), [properties]);

  const occupiedPropertyIds = useMemo(() => new Set(activeLeases.map((l) => l.property_id).filter(Boolean)), [activeLeases]);

  const occupancyRate = useMemo(() => {
    const totalProps = activeProperties.length;
    if (totalProps === 0) return 0;
    return Math.round((occupiedPropertyIds.size / totalProps) * 100);
  }, [activeProperties.length, occupiedPropertyIds]);

  const activePropertyCoverage = useMemo(() => {
    if (activeProperties.length === 0) return 0;
    return Math.min(Math.max(occupiedPropertyIds.size / activeProperties.length, 0), 1);
  }, [activeProperties.length, occupiedPropertyIds]);

  const vacantActivePropertyCount = useMemo(
    () => activeProperties.filter((property) => !occupiedPropertyIds.has(property.id)).length,
    [activeProperties, occupiedPropertyIds]
  );

  const healthScore = useMemo(() => {
    // Score de gestion mensuelle : un parc partiellement loué doit peser fortement, même si les encaissements restants sont propres.
    let score = 0;
    const activeLeaseCount = activeLeases.length;

    if (activeProperties.length > 0) score += 6;
    if (tenants.length > 0) score += 5;

    score += Math.round(activePropertyCoverage * 20);

    // 0 bails actifs = rien configuré → pas de points (≠ "collecte parfaite")
    const collectionRatio = monthlyDueExpected > 0
      ? Math.min(Math.max(monthlyDuePaid / monthlyDueExpected, 0), 1)
      : activeLeaseCount > 0 ? 1 : 0;
    score += Math.round(collectionRatio * 40);

    if (activeLeaseCount > 0) {
      score += Math.max(0, 5 - Math.min(lateCount * 5, 5));
      const receiptRatio = receiptExpectedCount > 0 ? Math.min(receiptsThisMonth.length / receiptExpectedCount, 1) : 1;
      score += Math.round(receiptRatio * 24);
    }

    score -= Math.min(24, vacantActivePropertyCount * 10);

    return Math.max(0, Math.min(100, score));
  }, [
    activeProperties.length,
    tenants.length,
    monthlyDueExpected,
    monthlyDuePaid,
    lateCount,
    activePropertyCoverage,
    activeLeases.length,
    receiptsThisMonth.length,
    receiptExpectedCount,
    vacantActivePropertyCount,
  ]);

  // --- Alerts
  const leaseLimit = 5;
  const overLimit = activeLeases.length > leaseLimit;

  const alerts = useMemo(() => {
    const a: {
      tone: "emerald" | "amber" | "red";
      title: string;
      desc: string;
      action?: string;
    }[] = [];

    if (properties.length === 0)
      a.push({
        tone: "amber",
        title: "Ajoutez votre premier logement",
        desc: "Créez un logement pour démarrer la gestion (adresse, libellé…)",
        action: "Créer un logement",
      });

    if (tenants.length === 0)
      a.push({
        tone: "amber",
        title: "Ajoutez un locataire",
        desc: "Un locataire est nécessaire pour créer un bail.",
        action: "Créer un locataire",
      });

    if (activeLeases.length === 0)
      a.push({
        tone: "amber",
        title: "Aucun bail actif",
        desc: "Créez un bail pour générer loyers, quittances et suivi.",
        action: "Créer un bail",
      });

    if (receiptWorkflowIssueCount > 0) {
      a.push({
        tone: lateCount > 0 ? "red" : "amber",
        title: "Quittances à vérifier",
        desc:
          receiptWorkflowIssueCount === 1
            ? "Une ligne de quittance demande un contrôle : paiement manquant, incomplet ou quittance non finalisée."
            : `${receiptWorkflowIssueCount} lignes de quittance demandent un contrôle : paiements manquants, incomplets ou quittances non finalisées.`,
        action: "Ouvrir Quittances",
      });
    }

    if (receiptWorkflowIssueCount === 0 && missingReceiptsAfterPaymentCount > 0)
      a.push({
        tone: "amber",
        title: "Quittances non générées ce mois-ci",
        desc: "Le paiement est confirmé : générez maintenant la quittance et transmettez-la au locataire.",
        action: "Gérer les quittances",
      });

    if (overLimit)
      a.push({
        tone: "amber",
        title: "Seuil Pro dépassé",
        desc: `Vous avez ${activeLeases.length} baux actifs (seuil: ${leaseLimit}).`,
        action: "Voir l’offre Pro",
      });

    if (a.length === 0)
      a.push({
        tone: "emerald",
        title: "Tout est en ordre ✅",
        desc: "Rien d’urgent pour le moment.",
      });

    return a.slice(0, 5);
  }, [
    properties.length,
    tenants.length,
    activeLeases.length,
    lateCount,
    missingReceiptsAfterPaymentCount,
    receiptWorkflowIssueCount,
    receiptsThisMonth.length,
    overLimit,
  ]);

  return {
    checkingAuth,

    // ✅ important : userId exposé pour Sections/DashboardShell
    userId: user?.id ?? null,

    user,
    loading,
    error,
    refresh,

    landlord,
    properties,
    propertyFinance,
    tenants,
    leases,
    payments,
    receipts,

    propertyById,
    tenantById,
    activeLeases,

    monthRange,
    monthlyExpected,
    monthlyPaid,
    lateCount,
    depositTotal,
    occupancyRate,
    healthScore,
    alerts,

    leaseLimit,
    overLimit,
  };
}
