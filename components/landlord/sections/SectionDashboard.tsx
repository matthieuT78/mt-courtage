// components/landlord/sections/SectionDashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { KpiCard, SectionTitle, formatEuro, fmtDate, Pill } from "../UiBits";
import type { Lease, Property, PropertyFinance, RentPayment, RentReceipt, Tenant } from "../../../lib/landlord/types";
import type { LandlordSectionKey } from "../SidebarNav";
import { supabase } from "../../../lib/supabaseClient";

type DashboardAlert = {
  tone: "emerald" | "amber" | "red";
  title: string;
  desc: string;
  action?: string;
};

type TransactionRow = {
  id: string;
  occurred_at: string;
  direction: "in" | "out";
  amount: number;
  property_id?: string | null;
};

const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const addMonths = (d: Date, delta: number) => new Date(d.getFullYear(), d.getMonth() + delta, 1);
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

function hasFinanceSetup(finance?: PropertyFinance | null) {
  if (!finance) return false;
  return hasPositiveAmount(finance.purchase_price) && hasPositiveAmount(finance.loan_rate_percent);
}

function paymentStatusForLease(lease: Lease, payment?: RentPayment | null) {
  const expectedRent = Number(lease.rent_amount || 0);
  const expectedCharges = Number(lease.charges_amount || 0);
  const expectedTotal = expectedRent + expectedCharges;
  const paidTotal = Number(payment?.total_amount || 0);
  const paidCharges = Number(payment?.charges_amount || 0);

  if (!payment?.paid_at) return { label: "À suivre", missing: expectedTotal, incomplete: false };
  if (expectedCharges > 0 && paidTotal >= expectedRent && paidCharges < expectedCharges) {
    return { label: "Charges manquantes", missing: Math.max(0, expectedCharges - paidCharges), incomplete: true };
  }
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
  if (a.includes("déclaration") || a.includes("declaration")) return "declaration";
  if (a.includes("inventaire")) return "inventaire";
  if (a.includes("état") || a.includes("etat")) return "etat_des_lieux";
  if (a.includes("finance")) return "finance";
  return null;
}

export function SectionDashboard({
  monthRange,
  monthlyExpected,
  monthlyPaid,
  lateCount,
  depositTotal,
  occupancyRate,
  healthScore,
  alerts,
  activeLeases,
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
  userId,
}: {
  monthRange: { startISO: string; endISO: string };
  monthlyExpected: number;
  monthlyPaid: number;
  lateCount: number;
  depositTotal: number;
  occupancyRate: number;
  healthScore: number;
  alerts: DashboardAlert[];
  activeLeases: Lease[];
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
  userId?: string;
}) {
  const ratio = monthlyExpected > 0 ? clampPct((monthlyPaid / monthlyExpected) * 100) : 0;
  const remainingToCollect = Math.max(0, monthlyExpected - monthlyPaid);
  const currentMonthPayments = useMemo(
    () =>
      (Array.isArray(payments) ? payments : []).filter(
        (p) => String(p.period_start || "") >= monthRange.startISO && String(p.period_start || "") <= monthRange.endISO
      ),
    [payments, monthRange]
  );
  const currentMonthReceipts = Array.isArray(receipts) ? receipts : [];
  const receiptCoverage = activeLeases.length > 0 ? clampPct((currentMonthReceipts.length / activeLeases.length) * 100) : 0;

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [accountingPropertyId, setAccountingPropertyId] = useState<string>("");

  const propertyOptions = useMemo(
    () =>
      Array.from(propertyById.values()).sort((a, b) =>
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
  const prevPercentRef = useRef<number>(-1);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(storageKey);
      if (value) setDoneAtISO(value);
    } catch {
      // localStorage indisponible : l'onboarding reste purement visuel.
    }
  }, [storageKey]);

  const onboarding = useMemo(() => {
    const hasProperty = propertiesCount > 0;
    const hasTenant = tenantsCount > 0;
    const hasLease = leasesCount > 0;
    const financeByProperty = new Map((propertyFinance || []).map((row) => [row.property_id, row]));
    const financeConfigured =
      hasProperty && (properties || []).every((property) => hasFinanceSetup(financeByProperty.get(property.id)));

    const steps = [
      { key: "biens" as LandlordSectionKey, label: "Créer un bien", done: hasProperty },
      { key: "locataires" as LandlordSectionKey, label: "Créer un locataire", done: hasTenant },
      { key: "baux" as LandlordSectionKey, label: "Créer un bail", done: hasLease },
      { key: "finance" as LandlordSectionKey, label: "Configurer la finance", done: financeConfigured },
    ];

    const doneCount = steps.filter((step) => step.done).length;
    const percent = Math.round((doneCount / steps.length) * 100);
    const next = !hasProperty ? steps[0] : !hasTenant ? steps[1] : !hasLease ? steps[2] : !financeConfigured ? steps[3] : null;

    const headline =
      percent === 100
        ? "Mise en route terminée"
        : next?.key === "finance"
        ? "Dernière étape : fiabiliser les calculs"
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
        ? "Créez le bail : il relie le bien, le locataire, le loyer et les quittances."
        : "Complétez le socle Finance du bien : prix d’achat et taux du crédit. Les autres charges pourront être ajoutées ensuite.";

    const cta = next ? { key: next.key, label: next.label } : null;
    return { steps, doneCount, percent, next, headline, sub, cta };
  }, [properties, propertiesCount, propertyFinance, tenantsCount, leasesCount]);

  const shouldHideOnboarding = useMemo(() => {
    if (!doneAtISO) return false;
    const t = new Date(doneAtISO).getTime();
    if (!Number.isFinite(t)) return false;
    const days = (Date.now() - t) / (1000 * 60 * 60 * 24);
    return days >= HIDE_AFTER_DAYS;
  }, [doneAtISO]);

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
          .select("id, occurred_at, direction, amount, property_id")
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
    return Array.from({ length: 6 }, (_, index) => monthKey(addMonths(base, index - 5)));
  }, []);

  const accountingSeries = useMemo(() => {
    const byMonth = new Map(accountingMonths.map((key) => [key, { key, income: 0, expense: 0 }]));

    for (const tx of transactions) {
      if (accountingPropertyId && (tx.property_id || "") !== accountingPropertyId) continue;
      const d = normalizeDate(tx.occurred_at);
      if (!d) continue;
      const key = monthKey(d);
      const row = byMonth.get(key);
      if (!row) continue;
      if (tx.direction === "in") row.income += Number(tx.amount || 0);
      else row.expense += Number(tx.amount || 0);
    }

    if (transactions.length === 0) {
      for (const payment of currentMonthPayments) {
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
  }, [accountingMonths, accountingPropertyId, activeLeases, currentMonthPayments, transactions]);

  const accountingTotals = useMemo(() => {
    const income = accountingSeries.reduce((sum, row) => sum + row.income, 0);
    const expense = accountingSeries.reduce((sum, row) => sum + row.expense, 0);
    return { income, expense, net: income - expense };
  }, [accountingSeries]);

  const maxChartValue = Math.max(1, ...accountingSeries.flatMap((row) => [row.income, row.expense]));

  const leaseCards = useMemo(() => {
    const now = new Date();
    const in90Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90);

    return activeLeases.map((lease) => {
      const property = propertyById.get(lease.property_id);
      const tenant = tenantById.get(lease.tenant_id);
      const payment = currentMonthPayments.find((p) => p.lease_id === lease.id);
      const receipt = currentMonthReceipts.find((r) => r.lease_id === lease.id);
      const total = Number(lease.rent_amount || 0) + Number(lease.charges_amount || 0);
      const endDate = normalizeDate(lease.end_date);
      const leaseEndingSoon = !!endDate && endDate <= in90Days;
      const paymentState = paymentStatusForLease(lease, payment);
      const paymentStatus =
        paymentState.label !== "À suivre"
          ? paymentState.label
          : payment?.due_date && normalizeDate(payment.due_date)! < now
          ? "En retard"
          : "À suivre";

      return {
        lease,
        propertyLabel: property?.label || "Bien",
        tenantName: tenant?.full_name || "Locataire",
        total,
        paymentStatus,
        missingAmount: paymentState.missing,
        incompletePayment: paymentState.incomplete,
        hasReceipt: !!receipt,
        leaseEndingSoon,
        endDate,
      };
    });
  }, [activeLeases, currentMonthPayments, currentMonthReceipts, propertyById, tenantById]);

  const rentsToCollect = useMemo(
    () =>
      leaseCards
        .filter((card) => card.paymentStatus !== "Encaissé")
        .sort((a, b) => {
          if (a.paymentStatus === "En retard" && b.paymentStatus !== "En retard") return -1;
          if (a.paymentStatus !== "En retard" && b.paymentStatus === "En retard") return 1;
          return a.propertyLabel.localeCompare(b.propertyLabel);
        }),
    [leaseCards]
  );

  const incompletePayments = useMemo(
    () => leaseCards.filter((card) => card.paymentStatus === "Paiement incomplet" || card.paymentStatus === "Charges manquantes"),
    [leaseCards]
  );

  const priorityActions = useMemo(() => {
    const actions: Array<{
      tone: "red" | "amber" | "emerald" | "indigo";
      title: string;
      desc: string;
      details?: string[];
      target?: LandlordSectionKey;
      cta?: string;
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

    if (monthlyExpected > 0 && remainingToCollect > 0 && lateCount === 0) {
      const pendingDetails = rentsToCollect
        .slice(0, 3)
        .map((card) => `${card.propertyLabel} · ${card.tenantName} · ${formatEuro(card.total)} à confirmer`);

      actions.push({
        tone: ratio >= 70 ? "amber" : "red",
        title: `${formatEuro(remainingToCollect)} reste à encaisser`,
        desc: `Encaissement à ${ratio}%. Vérifiez les loyers du mois non confirmés avant de considérer le mois comme complet.`,
        details: pendingDetails.length ? pendingDetails : ["Contrôlez les paiements du mois et marquez les loyers reçus."],
        target: "quittances",
        cta: "Confirmer les loyers",
      });
    }

    if (activeLeases.length > 0 && currentMonthReceipts.length < activeLeases.length) {
      const missingReceiptDetails = leaseCards
        .filter((card) => !card.hasReceipt)
        .slice(0, 3)
        .map((card) => `${card.propertyLabel} · ${card.tenantName}`);

      actions.push({
        tone: "amber",
        title: "Quittances du mois à finaliser",
        desc: `${currentMonthReceipts.length}/${activeLeases.length} quittance${activeLeases.length > 1 ? "s" : ""} générée${currentMonthReceipts.length > 1 ? "s" : ""}.`,
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
        target: "baux",
        cta: "Ouvrir les baux",
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

    if (actions.length === 0) {
      actions.push({
        tone: "emerald",
        title: "Rien d’urgent aujourd’hui",
        desc: "Le mois est propre. Surveillez simplement les encaissements et les charges.",
        target: "finance",
        cta: "Voir la finance",
      });
    }

    return actions.slice(0, 5);
  }, [
    activeLeases.length,
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
        value: monthlyExpected > 0 ? `${ratio}%` : "À configurer",
        tone: monthlyExpected === 0 ? "amber" : ratio >= 95 ? "emerald" : ratio >= 70 ? "amber" : "red",
        desc:
          monthlyExpected === 0
            ? "Créez un bail actif pour générer les loyers attendus."
            : remainingToCollect > 0
            ? `${formatEuro(remainingToCollect)} reste à confirmer dans Quittances.`
            : "Tous les loyers attendus sont confirmés.",
        target: monthlyExpected === 0 ? ("baux" as LandlordSectionKey) : remainingToCollect > 0 ? ("quittances" as LandlordSectionKey) : null,
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
        value: activeLeases.length > 0 ? `${receiptCoverage}%` : "À créer",
        tone: activeLeases.length === 0 ? "amber" : receiptCoverage >= 100 ? "emerald" : receiptCoverage >= 50 ? "amber" : "red",
        desc:
          activeLeases.length === 0
            ? "Créez un bail actif pour démarrer le workflow."
            : receiptCoverage < 100
            ? "Certaines quittances du mois ne sont pas encore prêtes."
            : "Les quittances du mois sont prêtes.",
        target: activeLeases.length === 0 ? ("baux" as LandlordSectionKey) : receiptCoverage < 100 ? ("quittances" as LandlordSectionKey) : null,
      },
      {
        label: "Occupation",
        value: `${occupancyRate}%`,
        tone: occupancyRate >= 80 ? "emerald" : occupancyRate >= 60 ? "amber" : "red",
        desc: occupancyRate >= 100 ? "Tous les biens ont un bail actif." : "Vérifiez les biens sans bail actif.",
        target: occupancyRate < 100 ? ("biens" as LandlordSectionKey) : null,
      },
    ] as const;
    return rows;
  }, [activeLeases.length, lateCount, monthlyExpected, occupancyRate, ratio, receiptCoverage, remainingToCollect]);

  const toneFromPercent = (percent: number) =>
    (percent >= 100 ? "emerald" : percent >= 66 ? "indigo" : percent >= 33 ? "amber" : "slate");

  return (
    <div className="space-y-5">
      {!shouldHideOnboarding ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Mise en route</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{onboarding.headline}</p>
              <p className="mt-1 text-[0.85rem] text-slate-600">{onboarding.sub}</p>
              {doneAtISO && onboarding.percent === 100 ? (
                <p className="mt-1 text-xs text-slate-500">
                  Terminé le {new Date(doneAtISO).toLocaleDateString("fr-FR")} · Masqué automatiquement après {HIDE_AFTER_DAYS} jours
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className={justCompleted ? "animate-pulse" : ""}>
                <Pill tone={toneFromPercent(onboarding.percent) as any}>{onboarding.percent}%</Pill>
              </span>

              {onboarding.cta ? (
                <button
                  type="button"
                  onClick={() => onGo(onboarding.cta!.key)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {onboarding.cta.label}
                </button>
              ) : (
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">Prêt</span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${onboarding.percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">{onboarding.doneCount}/{onboarding.steps.length} étapes terminées</p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {onboarding.steps.map((step) => (
              <button
                key={step.key}
                type="button"
                onClick={() => onGo(step.key)}
                className={
                  "rounded-xl border px-3 py-3 text-left transition " +
                  (step.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                }
                >
                <p className="text-sm font-semibold text-slate-900">{step.done ? "Fait" : "À faire"} · {step.label}</p>
                <p className="mt-0.5 text-[0.8rem] text-slate-600">
                  {step.key === "biens"
                    ? "Adresse, infos, statut"
                    : step.key === "locataires"
                    ? "Nom, email, contact"
                    : step.key === "baux"
                    ? "Bien, locataire et loyer"
                    : "Prix et taux crédit"}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-white px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Cockpit bailleur</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Ce qui mérite votre attention aujourd’hui</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Période : {fmtDate(monthRange.startISO)} → {fmtDate(monthRange.endISO)} · loyers, quittances, retards et performance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[#635bff]/20 bg-[#635bff]/5 px-3 py-1 text-xs font-semibold text-[#4f46e5]">Score {healthScore}/100</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Occupation {occupancyRate}%</span>
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]"
              style={{ width: `${healthScore > 0 ? Math.max(8, Math.min(100, healthScore)) : 0}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4 bg-[#f6f9fc] p-5 lg:grid-cols-[1fr,0.85fr]">
          <div className="space-y-3">
            {priorityActions.map((action, index) => (
              <div
                key={`${action.title}-${index}`}
                className={
                  "rounded-2xl border px-4 py-3 " +
                  (action.tone === "red"
                    ? "border-red-200 bg-red-50"
                    : action.tone === "amber"
                    ? "border-amber-200 bg-amber-50"
                    : action.tone === "indigo"
                    ? "border-indigo-200 bg-indigo-50"
                    : "border-emerald-200 bg-emerald-50")
                }
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{action.title}</p>
                    <p className="mt-1 text-sm text-slate-700">{action.desc}</p>
                    {action.details?.length ? (
                      <div className="mt-3 space-y-1">
                        {action.details.map((detail) => (
                          <p key={detail} className="rounded-xl border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-800">
                            {detail}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {action.target ? (
                    <button
                      type="button"
                      onClick={() => onGo(action.target!)}
                      className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      {action.cta || "Ouvrir"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Score de gestion</p>
                <p className="mt-1 text-xs text-slate-600">Pourquoi le score monte ou descend.</p>
              </div>
              <p className="text-2xl font-semibold text-slate-950">{healthScore}</p>
            </div>
            <div className="mt-4 space-y-2">
              {healthDetails.map((detail) => (
                <button
                  key={detail.label}
                  type="button"
                  onClick={() => detail.target && onGo(detail.target)}
                  disabled={!detail.target}
                  className={
                    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left " +
                    (detail.target ? "hover:bg-slate-50" : "cursor-default")
                  }
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-800">{detail.label}</span>
                    <Pill tone={detail.tone as any}>{detail.value}</Pill>
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">{detail.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle
          kicker="Mois en cours"
          title="Encaissement et quittances"
          desc="La lecture opérationnelle du mois : ce qui est prévu, reçu, restant et documenté."
          right={
            <div className="flex flex-wrap gap-2">
              <Pill tone={ratio >= 95 ? "emerald" : ratio >= 70 ? "amber" : "red"}>Encaissement {ratio}%</Pill>
              <Pill tone={receiptCoverage >= 100 ? "emerald" : receiptCoverage >= 50 ? "amber" : "red"}>Quittances {receiptCoverage}%</Pill>
            </div>
          }
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Attendu" value={formatEuro(monthlyExpected)} hint="Loyers + charges des baux actifs" />
          <KpiCard title="Encaissé" value={formatEuro(monthlyPaid)} hint={`${ratio}% du mois`} tone={ratio >= 95 ? "emerald" : "slate"} />
          <KpiCard title="Reste à encaisser" value={formatEuro(remainingToCollect)} hint={remainingToCollect > 0 ? "À suivre" : "Tout est encaissé"} tone={remainingToCollect > 0 ? "amber" : "emerald"} />
          <KpiCard title="Retards" value={String(lateCount)} hint={lateCount > 0 ? "Action requise" : "Aucun retard"} tone={lateCount > 0 ? "red" : "emerald"} />
          <KpiCard title="Dépôts" value={formatEuro(depositTotal)} hint="Baux actifs" tone="indigo" />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
              Tous les loyers attendus du mois sont confirmés.
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

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle
          kicker="Comptabilité"
          title="Revenus et dépenses sur 6 mois"
          desc="Graphique basé sur les écritures Finance. Si aucune écriture n’existe encore, les loyers encaissés servent de repère."
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

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr,280px]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-64 items-end gap-3 overflow-x-auto border-b border-slate-200 pb-3">
              {accountingSeries.map((row) => {
                const incomeHeight = Math.max(4, (row.income / maxChartValue) * 190);
                const expenseHeight = Math.max(4, (row.expense / maxChartValue) * 190);
                return (
                  <div key={row.key} className="flex min-w-[72px] flex-1 flex-col items-center justify-end gap-2">
                    <div className="flex h-52 items-end gap-1">
                      <div className="w-5 rounded-t-lg bg-emerald-500" style={{ height: `${incomeHeight}px` }} title={`Revenus ${formatEuro(row.income)}`} />
                      <div className="w-5 rounded-t-lg bg-rose-500" style={{ height: `${expenseHeight}px` }} title={`Dépenses ${formatEuro(row.expense)}`} />
                    </div>
                    <p className="text-xs font-semibold text-slate-600">{monthLabel(row.key)}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Revenus</span>
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" /> Dépenses</span>
              {transactionsLoading ? <span>Chargement des écritures...</span> : null}
              {transactionsError ? <span className="text-red-700">{transactionsError}</span> : null}
            </div>
          </div>

          <div className="grid gap-3">
            <KpiCard title="Revenus 6 mois" value={formatEuro(accountingTotals.income)} hint="Écritures entrantes" tone="emerald" />
            <KpiCard title="Dépenses 6 mois" value={formatEuro(accountingTotals.expense)} hint="Écritures sortantes" tone={accountingTotals.expense > 0 ? "red" : "slate"} />
            <KpiCard title="Résultat net" value={formatEuro(accountingTotals.net)} hint="Revenus - dépenses" tone={accountingTotals.net >= 0 ? "emerald" : "red"} />
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
            <div className="grid grid-cols-[1.3fr,0.8fr,0.8fr,0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
              <span>Bien / locataire</span>
              <span>Paiement</span>
              <span>Quittance</span>
              <span className="text-right">Mensuel</span>
            </div>
            <div className="divide-y divide-slate-100 bg-white">
              {leaseCards.slice(0, 8).map((card) => (
                <div key={card.lease.id} className="grid grid-cols-[1.3fr,0.8fr,0.8fr,0.8fr] gap-3 px-4 py-3 text-sm">
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
                    <Pill tone={card.hasReceipt ? "emerald" : "amber"}>{card.hasReceipt ? "Prête" : "À générer"}</Pill>
                  </div>
                  <p className="text-right font-semibold text-slate-900">{formatEuro(card.total)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
