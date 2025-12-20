// lib/landlord/useLandlordDashboard.ts
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "../supabaseClient";
import type {
  SimpleUser,
  LandlordSettings,
  Property,
  Tenant,
  Lease,
  RentPayment,
  RentReceipt,
} from "./types";

const fmtISO = (d: Date) => d.toISOString().slice(0, 10);
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
      setProperties(((pData as any) ?? []) as Property[]);
      setTenants(((tData as any) ?? []) as Tenant[]);
      setLeases(leasesArr);

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
        (sum, l) =>
          sum + Number(l.rent_amount || 0) + Number(l.charges_amount || 0),
        0
      ),
    [activeLeases]
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
    const now = new Date();
    return paymentsThisMonth.filter(
      (p) => !p.paid_at && p.due_date && new Date(p.due_date) < now
    ).length;
  }, [paymentsThisMonth]);

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
    // simple score “pro” : encaissement + retards + quittances
    let score = 100;
    if (monthlyExpected > 0) {
      const ratio = monthlyPaid / monthlyExpected;
      score -= Math.round((1 - Math.min(Math.max(ratio, 0), 1)) * 40);
    }
    score -= Math.min(lateCount * 10, 30);
    if (activeLeases.length > 0 && receiptsThisMonth.length === 0) score -= 10;
    return Math.max(0, Math.min(100, score));
  }, [
    monthlyExpected,
    monthlyPaid,
    lateCount,
    activeLeases.length,
    receiptsThisMonth.length,
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
        title: "Ajoutez votre premier bien",
        desc: "Créez un bien pour démarrer la gestion (adresse, libellé…)",
        action: "Créer un bien",
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
        action: "Voir les loyers",
      });

    if (activeLeases.length > 0 && receiptsThisMonth.length === 0)
      a.push({
        tone: "amber",
        title: "Quittances non générées ce mois-ci",
        desc: "Générez les quittances et envoyez-les au locataire.",
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
