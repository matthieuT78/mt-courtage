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
  status?: string | null;
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

const DEPOSIT_TRANSIT_CATEGORIES = ["deposit_collected", "deposit_returned"];

function isReceivedIncome(row: Transaction) {
  const status = String(row.status || "").toLowerCase();
  return (
    row.direction === "in" &&
    (status === "received" || status === "paid") &&
    !DEPOSIT_TRANSIT_CATEGORIES.includes(row.category)
  );
}

function labelForProperty(property: Property | undefined, fallback = "Bien") {
  return property?.label || property?.address_line1 || fallback;
}

type FriendlyAction = {
  title: string;
  detail: string;
  tone: "red" | "amber" | "emerald" | "slate";
};

function actionsFor(row: PropertyRow): FriendlyAction[] {
  const actions: FriendlyAction[] = [];

  // ── 1. PAS DE BAIL ───────────────────────────────────────────────────────
  if (row.activeLeaseCount === 0) {
    if (row.recurring > 0) {
      actions.push({
        tone: "red",
        title: "Aucun locataire — charges à découvert",
        detail: `${money(row.recurring)}/mois sortent sans revenu en face. Chaque mois vide coûte ${money(row.recurring)}. Rattachez le bail ou remettez le bien en location.`,
      });
    } else {
      actions.push({
        tone: "slate",
        title: "Créer ou rattacher le bail actif",
        detail: "Sans bail, ce bien est à 0 € dans tous vos indicateurs et sort du suivi des quittances.",
      });
    }
    actions.push({
      tone: "slate",
      title: "Archiver si le bien est sorti du parc",
      detail: "Un bien sans bail sans suivi alourdit vos tableaux. Archivez-le pour ne tracker que l’actif réel.",
    });
    return actions.slice(0, 3);
  }

  // ── 2. URGENCES FINANCIÈRES ───────────────────────────────────────────────
  const confirmedIncome = Math.max(row.received, row.ledgerIncome);
  if (row.expected > 0 && confirmedIncome < row.expected * 0.8) {
    actions.push({
      tone: "amber",
      title: "Loyer non confirmé en banque",
      detail: `${money(row.expected - confirmedIncome)} restent à pointer. Dès le virement visible, validez-le dans Quittances pour que Finance le prenne en compte.`,
    });
  }

  if (row.cashflow < -300) {
    const pctSorties = row.expected > 0 ? Math.round(((row.recurring + row.expense) / row.expected) * 100) : 0;
    const culprit =
      row.loanMonthly > row.expected * 0.5
        ? `le crédit (${money(row.loanMonthly)}/mois = ${Math.round((row.loanMonthly / Math.max(row.expected, 1)) * 100)} % du loyer)`
        : row.expense > row.recurring * 0.6 && row.expense > 200
        ? `les dépenses ponctuelles de la période (${money(row.expense)})`
        : `les charges récurrentes (${money(row.recurring)}/mois)`;
    actions.push({
      tone: "red",
      title: `−${money(Math.abs(row.cashflow))}/mois — trop négatif pour durer`,
      detail: `Charges à ${pctSorties} % du loyer. Levier immédiat : ${culprit}. Évaluer hausse de loyer, renégociation de crédit, ou arbitrage de vente.`,
    });
  } else if (row.cashflow < -80) {
    const culprit =
      row.loanMonthly > row.expected * 0.45
        ? `le crédit (${money(row.loanMonthly)}/mois)`
        : row.recurring > row.expected * 0.55
        ? `les charges récurrentes (${money(row.recurring)}/mois)`
        : `les dépenses ponctuelles (${money(row.expense)})`;
    actions.push({
      tone: "amber",
      title: "Cashflow négatif — identifier le premier levier",
      detail: `${money(row.expected)} de loyers, ${money(row.recurring + row.expense)} de sorties. Poste le plus lourd : ${culprit}.`,
    });
  }

  // ── 3. OPTIMISATIONS (visibles même si cashflow positif) ────────────────
  if ((row.loanRate ?? 0) >= 3.5 && row.loanMonthly > 0 && (row.loanRemainingMonths ?? 0) > 24) {
    const gain = Math.round(row.loanMonthly * 0.08);
    actions.push({
      tone: row.cashflow < 0 ? "amber" : "slate",
      title: `Crédit à ${row.loanRate} % — renégociation à évaluer`,
      detail: `Une baisse de 0,5 point peut libérer ~${money(gain)}/mois (${money(gain * 12)}/an) sur ${row.loanRemainingMonths} mois restants. À comparer au coût du rachat de crédit.`,
    });
  }

  if ((row.loanRemainingMonths ?? 999) <= 36 && (row.loanRemainingMonths ?? 0) > 0 && row.loanMonthly > 0) {
    actions.push({
      tone: "emerald",
      title: `Crédit terminé dans ${row.loanRemainingMonths} mois — ${money(row.loanMonthly)} libérés`,
      detail: `Soit ${money(row.loanMonthly * 12)}/an en plus dans votre trésorerie. Anticipez dès maintenant : épargne, remboursement d’un autre prêt, ou capacité pour un nouvel achat.`,
    });
  }

  if (row.vacancyDays12m >= 30) {
    const cost = Math.round((row.expected / 30) * row.vacancyDays12m);
    const vsRecurring = row.recurring > 0 ? ` = ${Math.round(cost / row.recurring)} mois de charges` : "";
    actions.push({
      tone: row.vacancyDays12m >= 60 ? "red" : "amber",
      title: `Vacance : ${row.vacancyDays12m} jours → ${money(cost)} perdus`,
      detail: `${money(cost)} de loyers non perçus sur 12 mois${vsRecurring}. Axes : loyer de marché, délai de remise en état, qualité de sélection des candidats.`,
    });
  }

  if (row.turnover12m >= 2) {
    actions.push({
      tone: "amber",
      title: `${row.turnover12m} changements de locataire en 12 mois`,
      detail: "Chaque rotation coûte en vacance et remise en état. À analyser : loyer inadapté, logement trop petit, mauvaise sélection, ou marché local très concurrentiel.",
    });
  }

  if (row.expected > 0 && row.cashflow >= -300) {
    const ratio = row.expected > 0 ? (row.recurring + row.expense) / row.expected : 0;
    if (ratio > 0.72 && row.recurring > 0) {
      const heaviest = row.loanMonthly > row.recurring * 0.5 ? "le crédit" : "les charges fixes";
      actions.push({
        tone: "amber",
        title: `${Math.round(ratio * 100)} % du loyer part en charges`,
        detail: `Marge serrée. Levier prioritaire : ${heaviest}. Cible à viser : passer sous 65 % pour dégager un cashflow positif durable. Tester aussi la révision IRL annuelle du loyer.`,
      });
    }
  }

  if (row.taxRegime === "lmnp_micro" && row.recurring > 0 && row.expected > 0) {
    const microAbat = row.expected * 0.5;
    if (row.recurring > microAbat) {
      actions.push({
        tone: "amber",
        title: "LMNP micro-BIC : le réel serait plus avantageux",
        detail: `Abattement micro : ${money(microAbat)}/mois. Vos charges réelles estimées : ${money(row.recurring)}/mois. Le régime réel pourrait réduire votre assiette imposable de ${money(row.recurring - microAbat)}/mois.`,
      });
    } else {
      actions.push({
        tone: "slate",
        title: "LMNP micro-BIC : simuler le passage au réel",
        detail: `Abattement forfaitaire de 50 %. Si vos travaux ou votre crédit augmentent, le réel devient vite plus favorable. À simuler chaque année avec un comptable.`,
      });
    }
  }

  if (row.taxRegime === "nu_micro" && row.recurring > row.expected * 0.3 && row.expected > 0) {
    actions.push({
      tone: "slate",
      title: "Micro-foncier : vérifier l’intérêt du réel",
      detail: `Abattement fixe à 30 %. Avec un crédit et des charges réelles supérieures à ${money(row.expected * 0.3)}/mois, le régime réel peut être plus favorable. À simuler si vous avez un emprunt.`,
    });
  }

  // ── 4. DONNÉES MANQUANTES (en dernier, seulement si pas encore 3 conseils) ──
  if (row.recurring <= 0 && row.expected > 0) {
    actions.push({
      tone: "slate",
      title: "Charges récurrentes non renseignées",
      detail: "Sans crédit, copro et assurance, le rendement est surestimé. Ajoutez-les via Finance > Nouvelle écriture > Charge récurrente.",
    });
  }

  if (row.investment <= 0) {
    actions.push({
      tone: "slate",
      title: "Coût d’acquisition à compléter",
      detail: "Prix d’achat + frais notaire + travaux = base du rendement net. Sans ça, impossible de comparer ce bien à d’autres placements.",
    });
  }

  if (row.taxRegime == null) {
    actions.push({
      tone: "slate",
      title: "Régime fiscal non renseigné",
      detail: "LMNP réel, micro-foncier, Pinel… chaque régime change les charges déductibles et la lecture de la rentabilité.",
    });
  }

  if (row.loanRate == null && row.loanMonthly > 0) {
    actions.push({
      tone: "slate",
      title: "Taux du crédit à renseigner",
      detail: "Sans taux, impossible de savoir si une renégociation peut changer l’équilibre de ce bien. À ajouter dans Finance > Paramètres du bien.",
    });
  }

  // ── 5. BIENS PERFORMANTS — que faire ensuite ? ───────────────────────────
  if (row.cashflow >= 250) {
    actions.push({
      tone: "emerald",
      title: `+${money(row.cashflow)}/mois d’excédent — à faire fructifier`,
      detail: `${money(row.cashflow * 12)}/an de trésorerie libre. Options : remboursement anticipé du crédit, épargne de précaution, ou apport pour un prochain investissement avec effet de levier.`,
    });
  } else if (row.cashflow >= 80) {
    actions.push({
      tone: "emerald",
      title: "Cashflow positif — maintenir le cap",
      detail: "L’essentiel est là. Pensez à la révision IRL annuelle du loyer et surveillez l’évolution des charges de copropriété pour tenir ce résultat dans la durée.",
    });
  } else if (row.cashflow >= -80) {
    actions.push({
      tone: "slate",
      title: "À l’équilibre — chercher le 1er levier",
      detail: `Cashflow quasi nul. Une hausse de loyer de 3 % (IRL) ou ${money(Math.max(row.recurring * 0.05, 30))}/mois de charges en moins suffisent à basculer en positif.`,
    });
  }

  if ((row.netYield ?? 0) >= 5) {
    actions.push({
      tone: "emerald",
      title: `Rendement net ${pct(row.netYield!)} — au-dessus de la moyenne`,
      detail: "Performance solide. Documentez la fiscalité et les charges pour reproduire ce modèle sur un prochain investissement, ou le valoriser en cas de revente.",
    });
  } else if ((row.netYield ?? 0) >= 3) {
    actions.push({
      tone: "slate",
      title: `Rendement net ${pct(row.netYield!)} — dans la moyenne`,
      detail: `Correct, mais améliorable. Révision IRL du loyer, renégociation d’assurance, ou déduction fiscale plus poussée peuvent gagner 0,5 à 1 point.`,
    });
  } else if (row.netYield != null && row.netYield < 3 && row.investment > 0) {
    actions.push({
      tone: "amber",
      title: `Rendement net ${pct(row.netYield)} — en dessous du marché`,
      detail: "En dessous de 3 %, le bien peine à justifier son risque. Trois leviers : hausse de loyer, baisse de charges, ou étude de revente si une plus-value est constituée.",
    });
  }

  return actions.slice(0, 3);
}

function decisionFor(row: PropertyRow) {
  if (row.activeLeaseCount === 0) {
    return {
      label: "À relouer",
      tone: "border-rose-200 bg-rose-50 text-rose-800",
      signal: "Aucun bail actif : le bien ne produit aucun loyer dans la lecture actuelle.",
      action:
        row.recurring > 0
          ? `Priorité à la remise en location ou au rattachement du bail : ${money(row.recurring)} de charges continuent chaque mois.`
          : "Créer ou rattacher le bail actif pour réintégrer ce bien dans le suivi des revenus.",
    };
  }
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
          .select("id,property_id,lease_id,occurred_at,direction,category,amount,status")
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
        const ledgerIncome = sum(monthTx.filter(isReceivedIncome).map((row) => Number(row.amount || 0)));
        const expense = sum(monthTx.filter((row) => row.direction === "out" && !DEPOSIT_TRANSIT_CATEGORIES.includes(row.category)).map((row) => Number(row.amount || 0)));
        const fin = finance.get(id) || null;
        const recurring = recurringMonthly(fin);
        const loanMonthly = Number(fin?.loan_monthly || 0) + Number(fin?.loan_insurance_monthly || 0);
        const incomeBase = Math.max(received, ledgerIncome);
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
      const rows = tx.filter((row) => {
        if (propertyId && row.property_id !== propertyId) return false;
        const rowDate = normalizeDate(row.occurred_at);
        return rowDate ? monthKey(rowDate) === key : false;
      });
      const ledgerIncome = sum(rows.filter(isReceivedIncome).map((row) => Number(row.amount || 0)));
      const paymentIncome = sum(
        safePayments
          .filter((payment) => {
            const lease = leaseById.get(payment.lease_id);
            if (!lease) return false;
            if (propertyId && lease.property_id !== propertyId) return false;
            const paidAt = normalizeDate((payment as any).paid_at);
            const periodStart = normalizeDate((payment as any).period_start);
            return !!paidAt && !!periodStart && monthKey(periodStart) === key;
          })
          .map((payment) => Number(payment.total_amount || 0))
      );
      const income = Math.max(paymentIncome, ledgerIncome);
      const expense = sum(rows.filter((row) => row.direction === "out" && !DEPOSIT_TRANSIT_CATEGORIES.includes(row.category)).map((row) => Number(row.amount || 0)));
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
  }, [leaseById, months, propertyId, propertyRows, safePayments, tx]);

  const totals = useMemo(() => {
    const expected = sum(propertyRows.map((row) => row.expected));
    const received = sum(propertyRows.map((row) => Math.max(row.received, row.ledgerIncome)));
    const expense = sum(propertyRows.map((row) => row.expense));
    const recurring = sum(propertyRows.map((row) => row.recurring));
    const cashflow = sum(propertyRows.map((row) => row.cashflow));
    return { expected, received, expense, recurring, cashflow };
  }, [propertyRows]);

  const priorityRows = propertyRows
    .filter((row) => row.cashflow < 150 || row.expected > Math.max(row.received, row.ledgerIncome) || row.recurring <= 0)
    .slice(0, 4);

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
          label: "Revenus encaissés",
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
      if (DEPOSIT_TRANSIT_CATEGORIES.includes(row.category)) continue;
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
          desc="Les cartes affichent la lecture mensuelle du mois en cours. Le graphique garde le recul sur 6 mois pour voir la tendance."
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
        <Metric icon={<BanknotesIcon className="h-5 w-5" />} label="Cashflow mensuel" value={money(totals.cashflow)} sub="loyers encaissés moins sorties du mois" />
        <Metric icon={<HomeModernIcon className="h-5 w-5" />} label="Loyers mensuels" value={money(totals.expected)} sub="montant attendu sur les baux actifs" />
        <Metric icon={<ChartBarIcon className="h-5 w-5" />} label="Charges mensuelles" value={money(totals.recurring)} sub="crédit, PNO, copro, fiscalité, frais" />
        <Metric icon={<SparklesIcon className="h-5 w-5" />} label="À regarder" value={String(priorityRows.length)} sub="biens qui méritent une action" />
      </div>

      <div className="rounded-3xl border border-cyan-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600 shadow-sm">
        <span className="font-semibold text-slate-950">Lecture simple :</span> la mensualité reste la base. Les chiffres du haut parlent du mois en cours, puis les graphiques montrent comment ce mois se compare aux 5 précédents.
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
            <h3 className="text-lg font-semibold text-slate-950">Encaissements, dépenses et résultat net</h3>
          </div>
          <p className="text-xs text-slate-500">Chaque barre est rattachée au mois concerné. Les charges récurrentes sont ajoutées automatiquement.</p>
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
                          Loyers mensuels {money(row.expected)} · charges mensuelles {money(row.recurring)}
                        </p>
                      </div>
                      <span className={`self-start rounded-full border px-3 py-1 text-xs font-semibold ${decision.tone}`}>{decision.label}</span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <Stat label="Encaissé ce mois" value={money(Math.max(row.received, row.ledgerIncome))} />
                      <Stat label="Dépenses ce mois" value={money(row.expense)} />
                      <Stat label="Cashflow mensuel" value={money(row.cashflow)} strong={row.cashflow >= 0 ? "good" : "bad"} />
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
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-amber-700">Conseils simples</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">À faire maintenant</h3>
              <p className="mt-1 text-sm text-slate-600">Les chiffres sont traduits en prochaines actions concrètes.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {(priorityRows.length ? priorityRows : propertyRows.slice(0, 2)).map((row) => (
              <div key={row.propertyId} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">{row.label}</p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.68rem] font-semibold text-slate-600">
                    {money(row.cashflow)} / mois
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {actionsFor(row).map((action) => {
                    const bg = action.tone === "red" ? "border-red-100 bg-red-50" : action.tone === "amber" ? "border-amber-100 bg-amber-50" : action.tone === "emerald" ? "border-emerald-100 bg-emerald-50" : "border-slate-100 bg-slate-50";
                    const dot = action.tone === "red" ? "bg-red-400" : action.tone === "amber" ? "bg-amber-400" : action.tone === "emerald" ? "bg-emerald-400" : "bg-slate-300";
                    return (
                      <div key={action.title} className={`rounded-2xl border px-3 py-2.5 ${bg}`}>
                        <div className="flex items-start gap-2">
                          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{action.title}</p>
                            <p className="mt-0.5 text-sm leading-6 text-slate-600">{action.detail}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
