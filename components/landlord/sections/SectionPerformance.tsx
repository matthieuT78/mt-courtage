import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BanknotesIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { supabase } from "../../../lib/supabaseClient";
import { getLeaseRentPeriod } from "../../../lib/rentPeriod";
import type { Lease, Property, RentPayment } from "../../../lib/landlord/types";
import { SectionTitle, formatEuro } from "../UiBits";
import { isActivePropertyLike, isSelectableLeaseLike } from "../../../lib/landlord/archiveFilters";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const Chart = dynamic(() => import("react-chartjs-2").then((m) => m.Chart), {
  ssr: false,
});

type TxDirection = "in" | "out";

type Transaction = {
  id: string;
  property_id: string | null;
  lease_id: string | null;
  occurred_at: string;
  direction: TxDirection;
  category: string;
  amount: number;
};

type PropertyFinance = {
  property_id: string;
  purchase_price: number | null;
  notary_fees: number | null;
  agency_fees: number | null;
  works: number | null;
  loan_monthly: number | null;
  loan_insurance_monthly: number | null;
  loan_rate_percent?: number | null;
  loan_remaining_months?: number | null;
  loan_end_year?: number | null;
  tax_regime?: string | null;
  fixed_charges_monthly: number | null;
  fixed_charges_frequency?: "monthly" | "quarterly" | "yearly" | null;
  property_tax_yearly: number | null;
  pno_insurance_monthly?: number | null;
  copro_charges_monthly?: number | null;
  cfe_yearly?: number | null;
  loan_interest_monthly?: number | null;
  bank_fees_monthly?: number | null;
  maintenance_monthly?: number | null;
  rental_tax_monthly?: number | null;
};

type Props = {
  userId: string;
  leases?: Lease[];
  payments?: RentPayment[];
  propertyById?: Map<string, Property>;
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const addMonths = (date: Date, delta: number) => new Date(date.getFullYear(), date.getMonth() + delta, 1);

const normalizeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(String(value).slice(0, 10) + "T00:00:00");
  return Number.isNaN(date.getTime()) ? null : date;
};

const sum = (values: number[]) => values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
const money = (value: number) => formatEuro(value).replace(",00", "");
const daysBetween = (start: Date, end: Date) => Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));

const CATEGORY_LABELS: Record<string, string> = {
  rent: "Loyers",
  fees: "Frais",
  management: "Gestion",
  repairs: "Entretien",
  copro: "Copropriété",
  insurance: "Assurance",
  tax: "Fiscalité",
  utilities: "Fluides",
  loan: "Crédit",
  other: "Autres",
};

function pct(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function remainingLoanMonths(finance: PropertyFinance | null) {
  const endYear = Number(finance?.loan_end_year || 0);
  if (Number.isFinite(endYear) && endYear > 0) {
    const now = new Date();
    return Math.max(0, (endYear - now.getFullYear()) * 12 + (12 - now.getMonth()));
  }
  const legacy = Number(finance?.loan_remaining_months || 0);
  return Number.isFinite(legacy) && legacy > 0 ? legacy : null;
}

function recurringMonthly(finance: PropertyFinance | null) {
  if (!finance) return 0;
  return (
    Number(finance.loan_monthly || 0) +
    Number(finance.loan_insurance_monthly || 0) +
    Number(finance.fixed_charges_monthly || 0) +
    Number(finance.pno_insurance_monthly || 0) +
    Number(finance.copro_charges_monthly || 0) +
    Number(finance.loan_interest_monthly || 0) +
    Number(finance.bank_fees_monthly || 0) +
    Number(finance.maintenance_monthly || 0) +
    Number(finance.rental_tax_monthly || 0) +
    Number(finance.property_tax_yearly || 0) / 12 +
    Number(finance.cfe_yearly || 0) / 12
  );
}

function investmentAmount(finance: PropertyFinance | null) {
  if (!finance) return 0;
  return (
    Number(finance.purchase_price || 0) +
    Number(finance.notary_fees || 0) +
    Number(finance.agency_fees || 0) +
    Number(finance.works || 0)
  );
}

function monthlyLeaseAmount(lease: Lease) {
  return Number((lease as any).rent_amount || 0) + Number((lease as any).charges_amount || 0);
}

function labelForProperty(property: Property | undefined, fallback = "Bien") {
  return property?.label || property?.address_line1 || fallback;
}

function actionsFor(row: PropertyRow) {
  const actions: string[] = [];
  if (row.loanRate == null && row.loanMonthly > 0) {
    actions.push("Renseigner le taux du crédit pour détecter une opportunité de renégociation ou de rachat.");
  }
  if (row.loanRate != null && row.loanRate >= 3.5 && row.loanMonthly > 0) {
    actions.push(`Comparer une renégociation de taux : à mensualité ${money(row.loanMonthly)}, une baisse de 0,5 à 1 point peut libérer du cashflow.`);
  }
  if (row.loanRemainingMonths != null && row.loanRemainingMonths > 84 && row.cashflow < 0 && row.loanMonthly > 0) {
    actions.push("Étudier une modulation/allongement de mensualité pour réduire l’effort mensuel, en vérifiant le coût total du crédit.");
  }
  if (row.taxRegime == null) {
    actions.push("Renseigner le régime fiscal suivi pour détecter si le micro ou le réel est le plus cohérent.");
  }
  if (row.taxRegime === "lmnp_micro" && row.recurring + row.expense > row.expected * 0.35 && row.expected > 0) {
    actions.push("Tester le LMNP réel : vos charges semblent assez élevées pour justifier une comparaison avec le micro-BIC.");
  }
  if (row.vacancyDays12m >= 30) {
    actions.push(`Vacance détectée : ${row.vacancyDays12m} jours estimés sur 12 mois. Revoir prix, annonce, délai de relocation ou état du logement.`);
  }
  if (row.turnover12m >= 2) {
    actions.push(`Turnover élevé : ${row.turnover12m} entrées locataires sur 12 mois. Vérifier loyer, qualité du logement et profil locataire.`);
  }
  if (row.received < row.expected && row.expected > 0) {
    actions.push(`Sécuriser l’encaissement : ${money(row.expected - row.received)} restent à confirmer sur le mois.`);
  }
  if (row.recurring <= 0) {
    actions.push("Renseigner les charges récurrentes dans Finance pour fiabiliser le cashflow.");
  }
  if (row.investment <= 0) {
    actions.push("Ajouter le prix d’achat, les frais et travaux pour obtenir une rentabilité nette exploitable.");
  }
  if (row.cashflow < -80) {
    actions.push("Isoler les charges lourdes, vérifier le loyer de marché et prioriser un plan de réduction des coûts.");
  }
  if (row.cashflow >= -80 && row.cashflow < 150) {
    actions.push("Le bien est proche de l’équilibre : surveiller la vacance, les charges de copropriété et les travaux à venir.");
  }
  if (row.cashflow >= 150) {
    actions.push("Bien solide : documenter les charges et conserver le niveau de suivi pour la déclaration.");
  }
  return actions.slice(0, 3);
}

function decisionFor(row: PropertyRow) {
  if (row.recurring <= 0 || row.investment <= 0) {
    return {
      label: "Fiabiliser",
      tone: "border-slate-200 bg-white text-slate-800",
      signal: "Les données financières ne sont pas encore complètes.",
      action: "Compléter prix d’achat, crédit, taxe foncière et charges récurrentes avant toute décision.",
    };
  }
  if (row.cashflow >= 150 && (row.netYield || 0) >= 3.5) {
    return {
      label: "Conserver",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      signal: "Le bien contribue positivement au parc et garde une rentabilité nette correcte.",
      action: "Maintenir le suivi, documenter les charges et surveiller la vacance.",
    };
  }
  if (row.cashflow >= -80) {
    return {
      label: "Optimiser",
      tone: "border-cyan-200 bg-cyan-50 text-cyan-800",
      signal: "Le bien est proche de l’équilibre : quelques leviers peuvent changer la lecture.",
      action: "Tester révision de loyer, baisse de charges récurrentes ou renégociation assurance/crédit.",
    };
  }
  return {
    label: "Arbitrer",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    signal: "Le cashflow demande une action structurelle, pas seulement une correction ponctuelle.",
    action: "Comparer hausse de loyer, travaux rentables, renégociation ou vente si l’effort reste durable.",
  };
}

function computeOccupancySignals(leases: Lease[], propertyId: string) {
  const now = new Date();
  const since = addMonths(now, -12);
  const rows = leases
    .filter((lease) => lease.property_id === propertyId)
    .map((lease) => ({
      start: normalizeDate(lease.start_date),
      end: normalizeDate(lease.end_date),
      status: String((lease as any).status || "active").toLowerCase(),
    }))
    .filter((lease) => lease.start)
    .sort((a, b) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0));

  let vacancyDays12m = 0;
  let lastEnd: Date | null = null;
  for (const lease of rows) {
    if (lastEnd && lease.start && lease.start > since) {
      const gapStart = lastEnd > since ? lastEnd : since;
      if (lease.start > gapStart) vacancyDays12m += daysBetween(gapStart, lease.start);
    }
    if (lease.end && (!lastEnd || lease.end > lastEnd)) lastEnd = lease.end;
  }

  const hasActiveLease = rows.some((lease) => lease.status !== "archived" && lease.status !== "terminated" && (!lease.end || lease.end >= now));
  if (!hasActiveLease && lastEnd && lastEnd > since && lastEnd < now) vacancyDays12m += daysBetween(lastEnd, now);

  const turnover12m = rows.filter((lease) => lease.start && lease.start >= since).length;
  const activeLeaseCount = rows.filter((lease) => lease.status !== "draft" && lease.status !== "archived" && lease.status !== "terminated").length;
  return { vacancyDays12m, turnover12m, activeLeaseCount };
}

type PropertyRow = {
  propertyId: string;
  label: string;
  expected: number;
  received: number;
  ledgerIncome: number;
  expense: number;
  recurring: number;
  cashflow: number;
  investment: number;
  netYield: number | null;
  loanMonthly: number;
  loanRate: number | null;
  loanRemainingMonths: number | null;
  loanEndYear: number | null;
  taxRegime: string | null;
  vacancyDays12m: number;
  turnover12m: number;
  activeLeaseCount: number;
};

export function SectionPerformance({ userId, leases, payments, propertyById }: Props) {
  const propsById = propertyById instanceof Map ? propertyById : new Map<string, Property>();
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const [propertyId, setPropertyId] = useState("");
  const [includeArchivedProperties, setIncludeArchivedProperties] = useState(false);
  const [tx, setTx] = useState<Transaction[]>([]);
  const [finance, setFinance] = useState<Map<string, PropertyFinance>>(new Map());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const months = useMemo(() => {
    const start = addMonths(new Date(), -5);
    return Array.from({ length: 6 }, (_, index) => addMonths(start, index));
  }, []);

  const currentMonth = monthKey(new Date());
  const activeLeases = useMemo(
    () => safeLeases.filter(isSelectableLeaseLike),
    [safeLeases]
  );

  const propertyOptions = useMemo(() => {
    const fromProperties = Array.from(propsById.entries())
      .filter(([, property]) => includeArchivedProperties || isActivePropertyLike(property))
      .map(([id, property]) => ({
        id,
        label: labelForProperty(property, "Bien"),
        archived: !isActivePropertyLike(property),
      }));
    const fromLeases = activeLeases
      .filter((lease) => lease.property_id && !propsById.has(lease.property_id))
      .map((lease) => ({ id: lease.property_id, label: "Bien", archived: false }));
    return [...fromProperties, ...fromLeases].sort((a, b) => a.label.localeCompare(b.label));
  }, [activeLeases, includeArchivedProperties, propsById]);

  useEffect(() => {
    if (propertyId && !propertyOptions.some((property) => property.id === propertyId)) {
      setPropertyId("");
    }
  }, [propertyId, propertyOptions]);

  useEffect(() => {
    if (!supabase || !userId) return;

    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: txData, error: txError } = await supabase
          .from("transactions")
          .select("id,property_id,lease_id,occurred_at,direction,category,amount")
          .eq("user_id", userId)
          .order("occurred_at", { ascending: false })
          .limit(2000);
        if (txError) throw txError;

        const { data: financeData, error: financeError } = await supabase.from("property_finance").select("*").eq("user_id", userId);
        if (financeError) throw financeError;

        setTx((txData || []) as Transaction[]);
        const map = new Map<string, PropertyFinance>();
        for (const row of (financeData || []) as PropertyFinance[]) map.set(row.property_id, row);
        setFinance(map);
      } catch (e: any) {
        setErr(e?.message || "Impossible de charger la performance.");
      } finally {
        setLoading(false);
      }
    };

    load();

    const channel = (supabase as any)
      .channel(`performance-live-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "property_finance", filter: `user_id=eq.${userId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, load)
      .subscribe();

    const handleFocus = () => load();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const leaseById = useMemo(() => {
    const map = new Map<string, Lease>();
    for (const lease of activeLeases) map.set(lease.id, lease);
    return map;
  }, [activeLeases]);

  const propertyRows = useMemo<PropertyRow[]>(() => {
    const ids = new Set<string>();
    for (const option of propertyOptions) ids.add(option.id);
    for (const lease of activeLeases) if (lease.property_id) ids.add(lease.property_id);
    for (const row of tx) if (row.property_id) ids.add(row.property_id);

    return Array.from(ids)
      .filter((id) => {
        const property = propsById.get(id);
        return !property || includeArchivedProperties || isActivePropertyLike(property);
      })
      .filter((id) => !propertyId || id === propertyId)
      .map((id) => {
        const expected = sum(
          activeLeases
            .filter((lease) => lease.property_id === id)
            .map((lease) => monthlyLeaseAmount(lease))
        );
        const received = sum(
          safePayments
            .filter((payment) => {
              const lease = leaseById.get(payment.lease_id);
              return lease?.property_id === id && !!payment.paid_at && monthKey(normalizeDate(payment.period_start) || new Date()) === currentMonth;
            })
            .map((payment) => Number(payment.total_amount || 0))
        );
        const monthTx = tx.filter((row) => row.property_id === id && monthKey(normalizeDate(row.occurred_at) || new Date()) === currentMonth);
        const ledgerIncome = sum(monthTx.filter((row) => row.direction === "in").map((row) => Number(row.amount || 0)));
        const expense = sum(monthTx.filter((row) => row.direction === "out").map((row) => Number(row.amount || 0)));
        const fin = finance.get(id) || null;
        const recurring = recurringMonthly(fin);
        const loanMonthly = Number(fin?.loan_monthly || 0) + Number(fin?.loan_insurance_monthly || 0);
        const incomeBase = Math.max(received, ledgerIncome, expected);
        const cashflow = incomeBase - expense - recurring;
        const investment = investmentAmount(fin);
        const netYield = investment > 0 ? ((incomeBase - recurring) * 12 * 100) / investment : null;
        const occupancy = computeOccupancySignals(safeLeases, id);

        return {
          propertyId: id,
          label: labelForProperty(propsById.get(id), "Bien"),
          expected,
          received,
          ledgerIncome,
          expense,
          recurring,
          cashflow,
          investment,
          netYield,
          loanMonthly,
          loanRate: fin?.loan_rate_percent == null ? null : Number(fin.loan_rate_percent),
          loanRemainingMonths: remainingLoanMonths(fin),
          loanEndYear: fin?.loan_end_year == null ? null : Number(fin.loan_end_year),
          taxRegime: fin?.tax_regime || null,
          vacancyDays12m: occupancy.vacancyDays12m,
          turnover12m: occupancy.turnover12m,
          activeLeaseCount: occupancy.activeLeaseCount,
        };
      })
      .sort((a, b) => b.cashflow - a.cashflow);
  }, [activeLeases, currentMonth, finance, includeArchivedProperties, leaseById, propertyId, propertyOptions, propsById, safeLeases, safePayments, tx]);

  const series = useMemo(() => {
    return months.map((date) => {
      const key = monthKey(date);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const rows = tx.filter((row) => {
        if (propertyId && row.property_id !== propertyId) return false;
        const rowDate = normalizeDate(row.occurred_at);
        return rowDate ? monthKey(rowDate) === key : false;
      });
      const expectedIncome = sum(
        activeLeases
          .filter((lease) => {
            if (propertyId && lease.property_id !== propertyId) return false;
            const leaseStart = normalizeDate((lease as any).start_date);
            const leaseEnd = normalizeDate((lease as any).end_date);
            if (!leaseStart) return false;
            return leaseStart <= monthEnd && (!leaseEnd || leaseEnd >= monthStart);
          })
          .map((lease) => monthlyLeaseAmount(lease))
      );
      const ledgerIncome = sum(rows.filter((row) => row.direction === "in").map((row) => Number(row.amount || 0)));
      const income = Math.max(expectedIncome, ledgerIncome);
      const expense = sum(rows.filter((row) => row.direction === "out").map((row) => Number(row.amount || 0)));
      const recurring = sum(propertyRows.map((row) => row.recurring));
      return {
        key,
        label: date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
        income,
        expense,
        recurring,
        net: income - expense - recurring,
      };
    });
  }, [activeLeases, months, propertyId, propertyRows, tx]);

  const totals = useMemo(() => {
    const expected = sum(propertyRows.map((row) => row.expected));
    const received = sum(propertyRows.map((row) => Math.max(row.received, row.ledgerIncome)));
    const expense = sum(propertyRows.map((row) => row.expense));
    const recurring = sum(propertyRows.map((row) => row.recurring));
    const cashflow = sum(propertyRows.map((row) => row.cashflow));
    return { expected, received, expense, recurring, cashflow };
  }, [propertyRows]);

  const priorityRows = propertyRows.filter((row) => row.cashflow < 150 || row.expected > row.received || row.recurring <= 0).slice(0, 4);

  const scenarios = useMemo(() => {
    const renegociationPotential = sum(
      propertyRows.map((row) => (row.loanRate != null && row.loanRate >= 3.5 ? row.loanMonthly * 0.06 : 0))
    );
    const rowsWithLoanRate = propertyRows.filter((row) => row.loanRate != null);
    const rowsMissingLoanRate = propertyRows.filter((row) => row.loanRate == null && row.loanMonthly > 0);
    const rowsWithHighLoanRate = propertyRows.filter((row) => row.loanRate != null && row.loanRate >= 3.5);
    const rowsWithRateButNoMonthly = propertyRows.filter((row) => row.loanRate != null && row.loanMonthly <= 0);
    const renegociationLabel =
      renegociationPotential > 0
        ? `+${money(renegociationPotential)}`
        : rowsWithLoanRate.length > 0
        ? `${rowsWithLoanRate.length}/${propertyRows.length} taux renseigné${rowsWithLoanRate.length > 1 ? "s" : ""}`
        : "À renseigner";
    const renegociationSub =
      renegociationPotential > 0
        ? "gain mensuel indicatif à étudier"
        : rowsMissingLoanRate.length > 0
        ? "taux crédit à compléter sur les biens financés"
        : rowsWithRateButNoMonthly.length > 0
        ? "mensualité crédit à compléter pour estimer le gain"
        : rowsWithHighLoanRate.length > 0
        ? "taux renseigné, gain estimé à préciser"
        : rowsWithLoanRate.length > 0
        ? "taux renseigné, pas d’alerte de renégociation"
        : "taux crédit à renseigner";
    const monthlyModulationPotential = sum(propertyRows.map((row) => (row.cashflow < 0 && row.loanRemainingMonths && row.loanRemainingMonths > 84 ? row.loanMonthly * 0.08 : 0)));
    const vacancyCostMonthly = sum(propertyRows.map((row) => (row.expected > 0 ? (row.expected / 30) * row.vacancyDays12m : 0))) / 12;
    const fiscalCandidates = propertyRows.filter((row) => row.taxRegime === "lmnp_micro" && row.recurring + row.expense > row.expected * 0.35 && row.expected > 0).length;
    return [
      {
        label: "Renégociation de taux",
        valueLabel: renegociationLabel,
        sub: renegociationSub,
        tone: rowsMissingLoanRate.length > 0 ? "text-amber-700" : "text-emerald-700",
      },
      {
        label: "Moduler les mensualités",
        valueLabel: monthlyModulationPotential > 0 ? `+${money(monthlyModulationPotential)}` : "À étudier",
        sub: monthlyModulationPotential > 0 ? "cashflow libérable, coût total à vérifier" : "à activer si cashflow négatif",
        tone: "text-emerald-700",
      },
      {
        label: "Vacance locative",
        valueLabel: vacancyCostMonthly > 0 ? `-${money(vacancyCostMonthly)}` : "0 €",
        sub: "perte moyenne estimée sur 12 mois",
        tone: "text-rose-700",
      },
      {
        label: "Fiscalité à optimiser",
        valueLabel: `${fiscalCandidates}`,
        sub: fiscalCandidates > 0 ? "bien(s) à comparer au réel" : "régime cohérent ou à renseigner",
        tone: fiscalCandidates > 0 ? "text-amber-700" : "text-emerald-700",
      },
    ];
  }, [propertyRows]);

  const trendChartData = useMemo(
    () => ({
      labels: series.map((row) => row.label),
      datasets: [
        {
          type: "bar" as const,
          label: "Revenus",
          data: series.map((row) => row.income),
          backgroundColor: "rgba(16, 185, 129, 0.82)",
          borderColor: "rgb(5, 150, 105)",
          borderWidth: 1,
          borderRadius: 10,
          barPercentage: 0.66,
          categoryPercentage: 0.68,
        },
        {
          type: "bar" as const,
          label: "Dépenses + récurrent",
          data: series.map((row) => row.expense + row.recurring),
          backgroundColor: "rgba(244, 63, 94, 0.72)",
          borderColor: "rgb(225, 29, 72)",
          borderWidth: 1,
          borderRadius: 10,
          barPercentage: 0.66,
          categoryPercentage: 0.68,
        },
        {
          type: "line" as const,
          label: "Résultat net",
          data: series.map((row) => row.net),
          borderColor: "rgb(15, 23, 42)",
          backgroundColor: "rgba(15, 23, 42, 0.08)",
          pointBackgroundColor: "rgb(15, 23, 42)",
          pointBorderColor: "white",
          pointBorderWidth: 2,
          pointRadius: 4,
          tension: 0.35,
        },
      ],
    }),
    [series]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: { usePointStyle: true, boxWidth: 8, color: "#475569", font: { size: 12, weight: "600" as const } },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${money(Number(ctx.raw || 0))}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11, weight: "600" as const } } },
        y: {
          grid: { color: "rgba(148, 163, 184, 0.2)" },
          ticks: { color: "#64748b", callback: (value: any) => money(Number(value)) },
        },
      },
    }),
    []
  );

  const expenseBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const row of tx) {
      if (propertyId && row.property_id !== propertyId) continue;
      if (row.direction !== "out") continue;
      const rowDate = normalizeDate(row.occurred_at);
      if (!rowDate || monthKey(rowDate) !== currentMonth) continue;
      byCategory.set(row.category || "other", (byCategory.get(row.category || "other") || 0) + Number(row.amount || 0));
    }
    const recurring = totals.recurring;
    if (recurring > 0) byCategory.set("Charges récurrentes", (byCategory.get("Charges récurrentes") || 0) + recurring);
    return Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, label: CATEGORY_LABELS[category] || category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [currentMonth, propertyId, totals.recurring, tx]);

  const expenseChartData = useMemo(
    () => ({
      labels: expenseBreakdown.map((row) => row.label),
      datasets: [
        {
          data: expenseBreakdown.map((row) => row.amount),
          backgroundColor: ["#0f172a", "#635bff", "#00a6ff", "#10b981", "#f59e0b", "#f43f5e"],
          borderColor: "#ffffff",
          borderWidth: 3,
          hoverOffset: 6,
        },
      ],
    }),
    [expenseBreakdown]
  );

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: { usePointStyle: true, boxWidth: 8, color: "#475569", font: { size: 11, weight: "600" as const } },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.label}: ${money(Number(ctx.raw || 0))}`,
          },
        },
      },
    }),
    []
  );

  const cashflowChartData = useMemo(
    () => ({
      labels: propertyRows.map((row) => row.label),
      datasets: [
        {
          label: "Cashflow",
          data: propertyRows.map((row) => row.cashflow),
          backgroundColor: propertyRows.map((row) => (row.cashflow >= 0 ? "rgba(16, 185, 129, 0.82)" : "rgba(244, 63, 94, 0.72)")),
          borderColor: propertyRows.map((row) => (row.cashflow >= 0 ? "rgb(5, 150, 105)" : "rgb(225, 29, 72)")),
          borderWidth: 1,
          borderRadius: 10,
          barPercentage: 0.6,
        },
      ],
    }),
    [propertyRows]
  );

  const cashflowOptions = useMemo(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `Cashflow: ${money(Number(ctx.raw || 0))}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(148, 163, 184, 0.18)" },
          ticks: { color: "#64748b", callback: (value: any) => money(Number(value)) },
        },
        y: { grid: { display: false }, ticks: { color: "#334155", font: { size: 11, weight: "600" as const } } },
      },
    }),
    []
  );

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-[#f6f9fc] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <SectionTitle
          kicker="Performance"
          title="Cashflow & rentabilité"
          desc="Une lecture financière directe : tendance, postes de charges, biens contributeurs et actions prioritaires."
        />

        <div className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-3 lg:w-[320px]">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-semibold text-slate-600">Bien analysé</label>
            <label className="inline-flex items-center gap-2 text-[0.68rem] font-semibold text-slate-500">
              <input
                type="checkbox"
                checked={includeArchivedProperties}
                onChange={(e) => setIncludeArchivedProperties(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Inclure archivés
            </label>
          </div>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tous les biens</option>
            {propertyOptions.map((property) => (
              <option key={property.id} value={property.id}>
                {property.label}{property.archived ? " · archivé" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<BanknotesIcon className="h-5 w-5" />} label="Cashflow estimé" value={money(totals.cashflow)} sub="après dépenses et charges récurrentes" />
        <Metric icon={<HomeModernIcon className="h-5 w-5" />} label="Loyers attendus" value={money(totals.expected)} sub="baux actifs du mois" />
        <Metric icon={<ChartBarIcon className="h-5 w-5" />} label="Charges récurrentes" value={money(totals.recurring)} sub="crédit, PNO, copro, fiscalité, frais" />
        <Metric icon={<SparklesIcon className="h-5 w-5" />} label="À optimiser" value={String(priorityRows.length)} sub="points d’action détectés" />
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Scénarios</p>
          <h3 className="text-lg font-semibold text-slate-950">Ce qui peut vraiment changer le résultat</h3>
          <p className="text-sm text-slate-600">Des ordres de grandeur simples pour prioriser une action plutôt qu’une autre.</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {scenarios.map((scenario) => (
            <div key={scenario.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{scenario.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${scenario.tone}`}>
                {scenario.valueLabel}
              </p>
              <p className="mt-1 text-xs text-slate-500">{scenario.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Tendance 6 mois</p>
            <h3 className="text-lg font-semibold text-slate-950">Revenus, dépenses et résultat net</h3>
          </div>
          <p className="text-xs text-slate-500">Les charges récurrentes sont appliquées automatiquement.</p>
        </div>

        <div className="mt-5 h-[320px] rounded-3xl border border-slate-100 bg-slate-50 p-3">
          <Chart type="bar" data={trendChartData as any} options={chartOptions as any} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-rose-700">Dépenses</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Ce qui pèse sur le mois</h3>

          {expenseBreakdown.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
              Aucune dépense affectée sur le mois.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-[220px,1fr] lg:items-center">
              <div className="h-[220px]">
                <Chart type="doughnut" data={expenseChartData as any} options={doughnutOptions as any} />
              </div>
              <div className="space-y-2">
                {expenseBreakdown.map((row) => (
                  <div key={row.category} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="truncate text-sm font-semibold text-slate-700">{row.label}</span>
                    <span className="text-sm font-semibold text-slate-950">{money(row.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">Comparaison</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Cashflow par bien</h3>
          <div className="mt-4 h-[280px] rounded-3xl border border-slate-100 bg-slate-50 p-3">
            {propertyRows.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Aucun bien à comparer.</div>
            ) : (
              <Chart type="bar" data={cashflowChartData as any} options={cashflowOptions as any} />
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-indigo-700">Décision</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Matrice par bien</h3>

          <div className="mt-4 space-y-3">
            {propertyRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                Aucun bien exploitable pour l’instant.
              </div>
            ) : (
              propertyRows.map((row) => {
                const decision = decisionFor(row);
                return (
                  <div key={row.propertyId} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-950">{row.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Loyers {money(row.expected)} · charges récurrentes {money(row.recurring)}
                        </p>
                      </div>
                      <span className={`self-start rounded-full border px-3 py-1 text-xs font-semibold ${decision.tone}`}>{decision.label}</span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <Stat label="Encaissé" value={money(Math.max(row.received, row.ledgerIncome))} />
                      <Stat label="Dépenses" value={money(row.expense)} />
                      <Stat label="Cashflow" value={money(row.cashflow)} strong={row.cashflow >= 0 ? "good" : "bad"} />
                      <Stat label="Rendement net" value={row.netYield == null ? "À compléter" : pct(row.netYield)} />
                      <Stat label="Taux crédit" value={row.loanRate == null ? "À renseigner" : `${row.loanRate.toLocaleString("fr-FR")} %`} />
                      <Stat label="Fin crédit" value={row.loanEndYear == null ? "—" : String(row.loanEndYear)} />
                      <Stat label="Vacance 12 mois" value={`${row.vacancyDays12m} j`} strong={row.vacancyDays12m >= 30 ? "bad" : undefined} />
                      <Stat label="Turnover 12 mois" value={String(row.turnover12m)} strong={row.turnover12m >= 2 ? "bad" : undefined} />
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-sm font-semibold text-slate-900">{decision.signal}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{decision.action}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-amber-700">Priorités</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">Actions à fort impact</h3>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {(priorityRows.length ? priorityRows : propertyRows.slice(0, 2)).map((row) => (
              <div key={row.propertyId} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">{row.label}</p>
                <div className="mt-2 space-y-2">
                  {actionsFor(row).map((action, index) => (
                    <p key={action} className="flex gap-2 text-sm leading-6 text-slate-700">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[0.65rem] font-semibold text-white">
                        {index + 1}
                      </span>
                      <span>{action}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <a
            href="/espace-bailleur?tab=finance"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Compléter les charges dans Finance
          </a>
        </div>
      </section>

      {loading ? <p className="text-xs text-slate-500">Chargement de la performance…</p> : null}
    </div>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">{icon}</span>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{sub}</p>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={strong === "good" ? "text-sm font-semibold text-emerald-700" : strong === "bad" ? "text-sm font-semibold text-rose-700" : "text-sm font-semibold text-slate-950"}>
        {value}
      </p>
    </div>
  );
}
