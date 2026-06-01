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

const pad2 = (value: number) => String(value).padStart(2, "0");
const fmtISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const getMonthRange = (base = new Date()) => {
  const y = base.getFullYear();
  const m = base.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { startISO: fmtISO(start), endISO: fmtISO(end) };
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
          .select(
            "property_id,user_id,purchase_price,notary_fees,agency_fees,works,down_payment,loan_monthly,loan_insurance_monthly,loan_rate_percent,loan_remaining_months,tax_regime,fixed_charges_monthly,property_tax_yearly,pno_insurance_monthly,copro_charges_monthly,cfe_yearly,loan_interest_monthly,bank_fees_monthly,maintenance_monthly,created_at,updated_at"
          )
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
          .limit(90),
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
      const startOk = l.start_date ? new Date(l.start_date) <= now : false;
      const notEnded = !l.end_date || new Date(l.end_date) >= now;
      if ((l.status || "").toLowerCase() === "active") return true;
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
    return activeLeases.filter((lease) => {
      const dueDate = getLeasePaymentDueDate(lease, currentMonth);
      if (!dueDate || dueDate >= today) return false;
      const expected = Number(getLeaseRentPeriod(lease, currentMonth)?.total || 0);
      const payment = paymentsThisMonth.find((row) => row.lease_id === lease.id);
      return !payment?.paid_at || Number(payment.total_amount || 0) + 0.01 < expected;
    }).length;
  }, [activeLeases, monthRange.startISO, paymentsThisMonth]);

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

  const depositTotal = useMemo(
    () =>
      activeLeases.reduce(
        (sum, l) => sum + Number(l.deposit_amount || 0),
        0
      ),
    [activeLeases]
  );

  const occupancyRate = useMemo(() => {
    const totalProps = (properties || []).length;
    if (totalProps === 0) return 0;
    const occupiedPropertyIds = new Set(activeLeases.map((l) => l.property_id));
    return Math.round((occupiedPropertyIds.size / totalProps) * 100);
  }, [properties.length, activeLeases]);

  const healthScore = useMemo(() => {
    // Score de gestion mensuelle : le dossier donne un socle, mais les actions du mois portent l'essentiel.
    let score = 0;
    const activeLeaseCount = activeLeases.length;

    if (properties.length > 0) score += 6;
    if (tenants.length > 0) score += 5;
    if (activeLeaseCount > 0) score += 9;

    score += Math.round((occupancyRate / 100) * 10);

    const collectionRatio = monthlyDueExpected > 0 ? Math.min(Math.max(monthlyDuePaid / monthlyDueExpected, 0), 1) : 1;
    score += Math.round(collectionRatio * 40);

    if (activeLeaseCount > 0) {
      score += Math.max(0, 5 - Math.min(lateCount * 5, 5));
      const receiptRatio = receiptExpectedCount > 0 ? Math.min(receiptsThisMonth.length / receiptExpectedCount, 1) : 1;
      score += Math.round(receiptRatio * 25);
    }

    return Math.max(0, Math.min(100, score));
  }, [
    properties.length,
    tenants.length,
    monthlyDueExpected,
    monthlyDuePaid,
    lateCount,
    occupancyRate,
    activeLeases.length,
    receiptsThisMonth.length,
    receiptExpectedCount,
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

    if (lateCount > 0)
      a.push({
        tone: "red",
        title: `${lateCount} retard(s) de paiement`,
        desc: "Certains loyers sont échus et non marqués payés.",
        action: "Voir les quittances",
      });

    if (missingReceiptsAfterPaymentCount > 0)
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
