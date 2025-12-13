// pages/cautions-loyers.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type PaymentMethod = "virement" | "prelevement" | "cheque" | "especes" | string;

type PropertyRow = {
  id: string;
  label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
};

type TenantRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type LeaseRow = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string; // date
  end_date: string | null; // date
  rent_amount: number | null; // numeric
  charges_amount: number | null; // numeric
  deposit_amount: number | null; // numeric
  payment_day: number | null; // smallint
  payment_method: PaymentMethod | null;
  status: string | null;
  auto_reminder_enabled: boolean | null;
  auto_quittance_enabled: boolean | null;
  reminder_day_of_month: number | null;
  reminder_email: string | null;
  tenant_receipt_email: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
  properties?: PropertyRow | null;
  tenants?: TenantRow | null;
};

type RentPaymentRow = {
  id: string;
  lease_id: string;
  period_start: string; // date
  period_end: string; // date
  rent_amount: number | null;
  charges_amount: number | null;
  total_amount: number | null;
  due_date: string | null; // date
  paid_at: string | null; // timestamptz
  payment_method: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

type DepositEvent = {
  id: string;
  lease_id: string;
  event_type: "received" | "returned";
  amount: number;
  occurred_at: string; // date or timestamptz
  notes: string | null;
  created_at: string;
};

type Tab = "depots" | "loyers" | "alertes";

const formatEuro = (val: number | null | undefined) => {
  if (val == null || Number.isNaN(val)) return "—";
  return Number(val).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateFR = (val?: string | null) => {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "2-digit" });
};

const daysBetween = (a: Date, b: Date) => {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

function buildPropertyLabel(p?: PropertyRow | null) {
  if (!p) return "Bien";
  const parts = [
    p.label,
    p.address_line1,
    p.address_line2,
    [p.postal_code, p.city].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.length ? String(parts[0]) : "Bien";
}

function buildPropertyAddress(p?: PropertyRow | null) {
  if (!p) return "";
  const lines = [
    p.address_line1,
    p.address_line2,
    [p.postal_code, p.city].filter(Boolean).join(" "),
    p.country,
  ].filter(Boolean);
  return lines.join(", ");
}

// --- OPTIONAL TABLE (si absente, on affiche le SQL)
// Table attendue: deposit_events
// columns: id uuid pk default gen_random_uuid()
// lease_id uuid references leases(id)
// event_type text check in ('received','returned')
// amount numeric not null
// occurred_at date not null default current_date
// notes text
// created_at timestamptz default now()
const DEPOSIT_TABLE_NAME = "deposit_events";

export default function CautionsLoyersPage() {
  const [tab, setTab] = useState<Tab>("loyers");

  const [checkingUser, setCheckingUser] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [leasesLoading, setLeasesLoading] = useState(false);
  const [leasesError, setLeasesError] = useState<string | null>(null);

  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const selectedLease = useMemo(
    () => leases.find((l) => l.id === selectedLeaseId) || null,
    [leases, selectedLeaseId]
  );

  const [payments, setPayments] = useState<RentPaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const [depositEvents, setDepositEvents] = useState<DepositEvent[]>([]);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositTableMissing, setDepositTableMissing] = useState(false);

  // create deposit event form
  const [depType, setDepType] = useState<"received" | "returned">("received");
  const [depAmount, setDepAmount] = useState<string>("");
  const [depDate, setDepDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [depNotes, setDepNotes] = useState<string>("");
  const [depSaving, setDepSaving] = useState(false);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  const isLoggedIn = !!user?.id;

  // --- Session
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const u = data.session?.user ?? null;
        setUser(u ? { id: u.id, email: u.email ?? undefined } : null);
      })
      .catch(() => setUser(null))
      .finally(() => {
        if (mounted) setCheckingUser(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email ?? undefined } : null);
      setCheckingUser(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // --- Load leases
  useEffect(() => {
    const run = async () => {
      if (!isLoggedIn) return;
      try {
        setLeasesLoading(true);
        setLeasesError(null);

        // joins via FK: leases.property_id -> properties.id ; leases.tenant_id -> tenants.id
        const { data, error } = await supabase
          .from("leases")
          .select(
            `
            *,
            properties:properties (*),
            tenants:tenants (*)
          `
          )
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = (data || []) as LeaseRow[];
        setLeases(rows);

        // pick first by default
        if (!selectedLeaseId && rows.length) setSelectedLeaseId(rows[0].id);
      } catch (e: any) {
        setLeasesError(e?.message || "Impossible de charger vos baux.");
      } finally {
        setLeasesLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // --- Load payments for selected lease (12 derniers mois)
  useEffect(() => {
    const run = async () => {
      if (!isLoggedIn || !selectedLeaseId) return;
      try {
        setPaymentsLoading(true);
        setPaymentsError(null);

        // last 12 months range
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const fromISO = from.toISOString().slice(0, 10);

        const { data, error } = await supabase
          .from("rent_payments")
          .select("*")
          .eq("lease_id", selectedLeaseId)
          .gte("period_start", fromISO)
          .order("period_start", { ascending: false });

        if (error) throw error;
        setPayments((data || []) as RentPaymentRow[]);
      } catch (e: any) {
        setPaymentsError(e?.message || "Impossible de charger l’historique des loyers.");
      } finally {
        setPaymentsLoading(false);
      }
    };
    run();
  }, [isLoggedIn, selectedLeaseId]);

  // --- Load deposit events (optional table)
  useEffect(() => {
    const run = async () => {
      if (!isLoggedIn || !selectedLeaseId) return;

      setDepositTableMissing(false);
      setDepositError(null);
      setDepositLoading(true);

      try {
        const { data, error } = await supabase
          .from(DEPOSIT_TABLE_NAME)
          .select("*")
          .eq("lease_id", selectedLeaseId)
          .order("occurred_at", { ascending: false });

        if (error) throw error;
        setDepositEvents((data || []) as DepositEvent[]);
      } catch (e: any) {
        const msg = String(e?.message || "");
        // Postgres relation missing often includes: relation "public.deposit_events" does not exist
        if (msg.toLowerCase().includes("does not exist") && msg.toLowerCase().includes(DEPOSIT_TABLE_NAME)) {
          setDepositTableMissing(true);
          setDepositEvents([]);
        } else {
          setDepositError(msg || "Impossible de charger les mouvements de dépôt.");
        }
      } finally {
        setDepositLoading(false);
      }
    };

    // ne charge que si on est sur l’onglet dépôts (pour éviter bruit)
    if (tab === "depots") run();
  }, [isLoggedIn, selectedLeaseId, tab]);

  const kpis = useMemo(() => {
    const totalDue = payments.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
    const paid = payments.filter((p) => !!p.paid_at);
    const totalPaid = paid.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

    const latePaid = paid.filter((p) => {
      if (!p.due_date || !p.paid_at) return false;
      const due = new Date(p.due_date);
      const paidAt = new Date(p.paid_at);
      return paidAt.getTime() > due.getTime();
    });

    const avgDelay =
      latePaid.length === 0
        ? 0
        : Math.round(
            latePaid.reduce((sum, p) => {
              const due = new Date(p.due_date!);
              const paidAt = new Date(p.paid_at!);
              return sum + Math.max(0, daysBetween(due, paidAt));
            }, 0) / latePaid.length
          );

    const unpaid = payments.filter((p) => !p.paid_at);
    const unpaidCount = unpaid.length;

    // “score risque” simple (0 = top, 100 = risqué)
    const score = Math.min(
      100,
      Math.round(unpaidCount * 25 + latePaid.length * 10 + Math.min(avgDelay, 20) * 2)
    );

    // streak (mois payés à l’heure consécutifs sur les derniers paiements)
    const sorted = [...payments].sort((a, b) => (a.period_start > b.period_start ? -1 : 1));
    let streak = 0;
    for (const p of sorted) {
      if (!p.paid_at || !p.due_date) break;
      const due = new Date(p.due_date);
      const paidAt = new Date(p.paid_at);
      if (paidAt.getTime() <= due.getTime()) streak += 1;
      else break;
    }

    return { totalDue, totalPaid, unpaidCount, lateCount: latePaid.length, avgDelay, score, streak };
  }, [payments]);

  const endOfLeaseAlerts = useMemo(() => {
    const now = new Date();
    const soon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90); // 90 jours
    return leases
      .filter((l) => l.end_date)
      .map((l) => ({ lease: l, end: new Date(l.end_date as string) }))
      .filter(({ end }) => end.getTime() >= now.getTime() && end.getTime() <= soon.getTime())
      .sort((a, b) => a.end.getTime() - b.end.getTime());
  }, [leases]);

  const handleAddDepositEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLeaseId) return;
    setGlobalErr(null);
    setGlobalMsg(null);

    const amountNum = Number(depAmount);
    if (!amountNum || amountNum <= 0) {
      setGlobalErr("Montant invalide.");
      return;
    }

    setDepSaving(true);
    try {
      const { error } = await supabase.from(DEPOSIT_TABLE_NAME).insert({
        lease_id: selectedLeaseId,
        event_type: depType,
        amount: amountNum,
        occurred_at: depDate,
        notes: depNotes || null,
      });

      if (error) throw error;

      setGlobalMsg("Mouvement de dépôt enregistré ✅");
      setDepAmount("");
      setDepNotes("");

      // refresh
      const { data } = await supabase
        .from(DEPOSIT_TABLE_NAME)
        .select("*")
        .eq("lease_id", selectedLeaseId)
        .order("occurred_at", { ascending: false });
      setDepositEvents((data || []) as DepositEvent[]);
    } catch (err: any) {
      setGlobalErr(err?.message || "Erreur lors de l’enregistrement du dépôt.");
    } finally {
      setDepSaving(false);
    }
  };

  // --------- UI (not logged)
  if (!checkingUser && !user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 px-4 py-6">
          <div className="max-w-xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600">Cautions & loyers</p>
            <h1 className="text-lg font-semibold text-slate-900">Connectez-vous pour gérer vos baux</h1>
            <p className="text-sm text-slate-600">
              Cette section est réservée aux comptes connectés (suivi des dépôts, loyers, retards et alertes).
            </p>
            <div className="flex gap-2">
              <Link
                href="/mon-compte?mode=login&redirect=/cautions-loyers"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Me connecter
              </Link>
              <Link
                href="/mon-compte?mode=register&redirect=/cautions-loyers"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Créer un compte
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --------- UI (main)
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* HEADER */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600">
              Cautions & loyers
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Suivi des dépôts, historique des loyers, retards & alertes.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Vision “gérant locatif” : un bail = un bien + un locataire. Analyse des retards, score de risque,
              alertes de fin de bail et suivi dépôt entrée/sortie.
            </p>

            {(globalErr || globalMsg) && (
              <div
                className={
                  "rounded-lg border px-3 py-2 text-xs " +
                  (globalErr ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")
                }
              >
                {globalErr || globalMsg}
              </div>
            )}
          </section>

          {/* LAYOUT */}
          <div className="grid gap-5 lg:grid-cols-[320px,1fr]">
            {/* LEFT: leases */}
            <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3 h-fit">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Mes baux</p>
                  <p className="text-xs text-slate-600">Sélectionnez un bail pour voir dépôt & loyers.</p>
                </div>
              </div>

              {leasesLoading && <p className="text-xs text-slate-500">Chargement…</p>}
              {leasesError && <p className="text-xs text-red-600">{leasesError}</p>}

              {!leasesLoading && !leasesError && leases.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Aucun bail trouvé.
                  <div className="mt-2">
                    <Link href="/mon-compte?tab=bailleur" className="underline">
                      Aller dans l’espace bailleur
                    </Link>{" "}
                    pour créer un bien, un locataire, puis un bail.
                  </div>
                </div>
              )}

              {!leasesLoading && leases.length > 0 && (
                <div className="space-y-2">
                  {leases.map((l) => {
                    const active = l.id === selectedLeaseId;
                    const pLabel = buildPropertyLabel(l.properties);
                    const tName = l.tenants?.full_name || "Locataire";
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setSelectedLeaseId(l.id)}
                        className={
                          "w-full text-left rounded-xl border px-3 py-2.5 text-xs transition " +
                          (active ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                        }
                      >
                        <p className="font-semibold text-slate-900">{pLabel}</p>
                        <p className="text-[0.7rem] text-slate-600 mt-0.5">
                          {tName} • {formatEuro(l.rent_amount)} + {formatEuro(l.charges_amount)}
                        </p>
                        <p className="text-[0.65rem] text-slate-500 mt-1">
                          Début : {formatDateFR(l.start_date)}{" "}
                          {l.end_date ? `• Fin : ${formatDateFR(l.end_date)}` : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* RIGHT */}
            <section className="space-y-4">
              {/* Tabs */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
                <div className="flex flex-wrap gap-2">
                  {([
                    ["loyers", "Loyers & retards"],
                    ["depots", "Dépôt de garantie"],
                    ["alertes", "Alertes"],
                  ] as const).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTab(k)}
                      className={
                        "rounded-full px-4 py-2 text-xs font-semibold border " +
                        (tab === k
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              {!selectedLease ? (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 text-sm text-slate-600">
                  Sélectionnez un bail à gauche.
                </div>
              ) : tab === "loyers" ? (
                <>
                  {/* KPIs */}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Payé (12m)</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatEuro(kpis.totalPaid)}</p>
                      <p className="text-[0.7rem] text-slate-500">sur {formatEuro(kpis.totalDue)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Impayés</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{kpis.unpaidCount}</p>
                      <p className="text-[0.7rem] text-slate-500">périodes non réglées</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Retards payés</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{kpis.lateCount}</p>
                      <p className="text-[0.7rem] text-slate-500">délai moyen: {kpis.avgDelay} j</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Score risque</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{kpis.score}/100</p>
                      <p className="text-[0.7rem] text-slate-500">streak à l’heure: {kpis.streak}</p>
                    </div>
                  </div>

                  {/* Payments table */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Historique loyers</p>
                        <p className="text-xs text-slate-600">12 derniers mois (par périodes).</p>
                      </div>
                      <div className="text-[0.7rem] text-slate-500">
                        Bien: <span className="font-semibold text-slate-900">{buildPropertyLabel(selectedLease.properties)}</span>
                      </div>
                    </div>

                    {paymentsLoading && <p className="mt-3 text-xs text-slate-500">Chargement…</p>}
                    {!paymentsLoading && paymentsError && <p className="mt-3 text-xs text-red-600">{paymentsError}</p>}

                    {!paymentsLoading && !paymentsError && payments.length === 0 && (
                      <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        Aucun paiement enregistré pour ce bail.
                        <div className="mt-1 text-[0.7rem] text-slate-500">
                          (Tu peux générer les échéances via ton flux “loyers” plus tard, ou les créer depuis une UI dédiée.)
                        </div>
                      </div>
                    )}

                    {!paymentsLoading && !paymentsError && payments.length > 0 && (
                      <div className="mt-3 overflow-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="py-2 pr-3">Période</th>
                              <th className="py-2 pr-3">Dû le</th>
                              <th className="py-2 pr-3">Total</th>
                              <th className="py-2 pr-3">Statut</th>
                              <th className="py-2 pr-3">Payé le</th>
                              <th className="py-2 pr-3">Retard</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((p) => {
                              const due = p.due_date ? new Date(p.due_date) : null;
                              const paidAt = p.paid_at ? new Date(p.paid_at) : null;
                              const isPaid = !!paidAt;
                              const isLate = !!due && !!paidAt && paidAt.getTime() > due.getTime();
                              const delay = isLate ? Math.max(0, daysBetween(due!, paidAt!)) : 0;

                              return (
                                <tr key={p.id} className="border-t border-slate-100">
                                  <td className="py-2 pr-3 text-slate-900">
                                    {formatDateFR(p.period_start)} → {formatDateFR(p.period_end)}
                                  </td>
                                  <td className="py-2 pr-3 text-slate-700">{formatDateFR(p.due_date)}</td>
                                  <td className="py-2 pr-3 font-semibold text-slate-900">{formatEuro(p.total_amount)}</td>
                                  <td className="py-2 pr-3">
                                    <span
                                      className={
                                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold " +
                                        (isPaid
                                          ? isLate
                                            ? "border-amber-300 bg-amber-50 text-amber-800"
                                            : "border-emerald-300 bg-emerald-50 text-emerald-700"
                                          : "border-red-300 bg-red-50 text-red-700")
                                      }
                                    >
                                      {isPaid ? (isLate ? "Payé en retard" : "Payé") : "Non payé"}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-3 text-slate-700">{p.paid_at ? formatDateFR(p.paid_at) : "—"}</td>
                                  <td className="py-2 pr-3 text-slate-700">{isLate ? `${delay} j` : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : tab === "depots" ? (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Dépôt de garantie</p>
                      <p className="text-xs text-slate-600">
                        Suivi entrée/sortie (un dépôt par bail). Attendu:{" "}
                        <span className="font-semibold text-slate-900">{formatEuro(selectedLease.deposit_amount)}</span>
                      </p>
                    </div>
                    <div className="text-right text-[0.7rem] text-slate-500">
                      Locataire:{" "}
                      <span className="font-semibold text-slate-900">{selectedLease.tenants?.full_name || "—"}</span>
                    </div>
                  </div>

                  {depositTableMissing && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-semibold">⚠️ Suivi dépôt non activé côté base</p>
                      <p className="mt-1 text-amber-900/80">
                        Ta base n’a pas encore la table <code className="font-mono">deposit_events</code>. Copie-colle ce SQL
                        dans Supabase pour activer le suivi “reçu/rendu” :
                      </p>
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white border border-amber-200 p-2 text-[0.7rem] text-slate-800 overflow-auto">
{`create table if not exists public.deposit_events (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  event_type text not null check (event_type in ('received','returned')),
  amount numeric not null,
  occurred_at date not null default current_date,
  notes text,
  created_at timestamp with time zone not null default now()
);

-- (optionnel mais recommandé) RLS :
alter table public.deposit_events enable row level security;

create policy "deposit_events_select_own"
on public.deposit_events for select
using (exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid()));

create policy "deposit_events_insert_own"
on public.deposit_events for insert
with check (exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid()));

create policy "deposit_events_update_own"
on public.deposit_events for update
using (exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid()))
with check (exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid()));

create policy "deposit_events_delete_own"
on public.deposit_events for delete
using (exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid()));`}
                      </pre>
                    </div>
                  )}

                  {!depositTableMissing && (
                    <>
                      {depositError && <p className="text-xs text-red-600">{depositError}</p>}
                      {depositLoading && <p className="text-xs text-slate-500">Chargement…</p>}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Adresse</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{buildPropertyLabel(selectedLease.properties)}</p>
                          <p className="text-xs text-slate-600 mt-1">{buildPropertyAddress(selectedLease.properties)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Timeline dépôt</p>
                          {depositEvents.length === 0 ? (
                            <p className="mt-2 text-xs text-slate-600">Aucun mouvement enregistré.</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {depositEvents.map((ev) => (
                                <div key={ev.id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span
                                      className={
                                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold " +
                                        (ev.event_type === "received"
                                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                          : "border-indigo-300 bg-indigo-50 text-indigo-700")
                                      }
                                    >
                                      {ev.event_type === "received" ? "Dépôt reçu" : "Dépôt rendu"}
                                    </span>
                                    <span className="text-slate-500">{formatDateFR(ev.occurred_at)}</span>
                                  </div>
                                  <p className="mt-1 font-semibold text-slate-900">{formatEuro(Number(ev.amount))}</p>
                                  {ev.notes && <p className="mt-1 text-slate-600">{ev.notes}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <form onSubmit={handleAddDepositEvent} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                        <p className="text-[0.75rem] font-semibold text-slate-900">Ajouter un mouvement</p>
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[0.7rem] text-slate-700">Type</label>
                            <select
                              value={depType}
                              onChange={(e) => setDepType(e.target.value as any)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            >
                              <option value="received">Dépôt reçu</option>
                              <option value="returned">Dépôt rendu</option>
                            </select>
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[0.7rem] text-slate-700">Montant (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={depAmount}
                              onChange={(e) => setDepAmount(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[0.7rem] text-slate-700">Date</label>
                            <input
                              type="date"
                              value={depDate}
                              onChange={(e) => setDepDate(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[0.7rem] text-slate-700">Note</label>
                            <input
                              type="text"
                              value={depNotes}
                              onChange={(e) => setDepNotes(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              placeholder="Ex: retenue pour dégâts…"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={depSaving}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {depSaving ? "Enregistrement…" : "Enregistrer le mouvement"}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Alertes</p>
                    <p className="text-xs text-slate-600">
                      Fin de bail (J-90) + points d’attention.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[0.75rem] font-semibold text-slate-900">Fin de bail à venir</p>
                    {endOfLeaseAlerts.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-600">Aucune fin de bail dans les 90 prochains jours.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {endOfLeaseAlerts.map(({ lease, end }) => {
                          const d = daysBetween(new Date(), end);
                          return (
                            <div key={lease.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-slate-900">{buildPropertyLabel(lease.properties)}</p>
                                  <p className="text-[0.7rem] text-slate-600">
                                    Locataire: {lease.tenants?.full_name || "—"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-slate-900">{formatDateFR(lease.end_date)}</p>
                                  <p className="text-[0.7rem] text-slate-500">dans {d} jours</p>
                                </div>
                              </div>
                              <div className="mt-2 text-[0.7rem] text-slate-600">
                                Checklist suggérée : préavis, état des lieux, dépôt, remise clés.
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[0.75rem] font-semibold text-slate-900">Régularisation charges (idée “pro”)</p>
                    <p className="mt-1 text-xs text-slate-600">
                      À ajouter ensuite : une alerte annuelle configurable (ex: chaque 1er octobre) par bail, avec modèle email.
                    </p>
                  </div>

                  <div className="text-right">
                    <Link href="/outils-proprietaire" className="text-xs text-slate-500 underline">
                      ← Retour aux outils propriétaire
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>

          <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white rounded-2xl">
            <p>© {new Date().getFullYear()} MT Courtage &amp; Investissement</p>
            <p className="mt-1">
              <a href="mailto:mtcourtage@gmail.com" className="underline">
                mtcourtage@gmail.com
              </a>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
