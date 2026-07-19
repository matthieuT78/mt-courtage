import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ExclamationTriangleIcon,
  SparklesIcon,
  XMarkIcon,
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
import type { Lease, Property, RentPayment } from "../../../lib/landlord/types";
import { SectionTitle, formatEuro } from "../UiBits";
import { isActivePropertyLike, isSelectableLeaseLike } from "../../../lib/landlord/archiveFilters";
import { cx } from "../ui/uiHelpers";
import type { LandlordSectionKey } from "../navigation";

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
  label?: string | null;
  amount: number;
  status?: string | null;
  is_recurring?: boolean | null;
  recurrence_frequency?: "monthly" | "quarterly" | "yearly" | null;
  recurrence_parent_id?: string | null;
  recurrence_since?: string | null;
  recurrence_end_date?: string | null;
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

type NavigateLink = {
  leaseId?: string;
  openPanel?: "irl" | "deposit";
  depositAction?: "collect" | "return";
  openCreate?: boolean;
  prefillPropertyId?: string;
};

type Props = {
  userId: string;
  leases?: Lease[];
  payments?: RentPayment[];
  propertyById?: Map<string, Property>;
  onNavigateDeep?: (section: LandlordSectionKey, link?: NavigateLink) => void;
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
const fmtDateFR = (iso?: string | null) => {
  const date = normalizeDate(iso);
  return date ? date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
};

// Dernière date anniversaire du bail déjà passée (null si le bail a moins d'un an).
function lastLeaseAnniversary(startDate: Date, today: Date): Date | null {
  const first = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
  if (first > today) return null;
  let anniversary = first;
  while (true) {
    const next = new Date(anniversary.getFullYear() + 1, anniversary.getMonth(), anniversary.getDate());
    if (next > today) break;
    anniversary = next;
  }
  return anniversary;
}

// Une révision IRL est considérée en retard si la dernière date anniversaire du bail
// est passée sans qu'aucun envoi (irl_sent_at) ni application (irl_applied_at) ne l'ait suivie.
function irlLateness(lease: Lease | undefined, today = new Date()): { leaseId: string; monthsLate: number } | null {
  if (!lease) return null;
  const start = normalizeDate(lease.start_date);
  if (!start) return null;
  const anniversary = lastLeaseAnniversary(start, today);
  if (!anniversary) return null;
  const sentAt = normalizeDate(lease.irl_sent_at);
  const appliedAt = normalizeDate(lease.irl_applied_at);
  const handled = (sentAt != null && sentAt >= anniversary) || (appliedAt != null && appliedAt >= anniversary);
  if (handled) return null;
  const monthsLate = Math.floor((today.getTime() - anniversary.getTime()) / (30.44 * 86400_000));
  return monthsLate >= 1 ? { leaseId: lease.id, monthsLate } : null;
}

// Régularité de paiement sur les derniers loyers échus (retard = paiement après due_date).
function paymentDelayStats(
  payments: RentPayment[],
  leaseId: string,
  sampleSize = 6
): { avgDelayDays: number; lateCount: number; totalCount: number } | null {
  const relevant = payments
    .filter((p) => p.lease_id === leaseId && p.paid_at && p.due_date)
    .sort((a, b) => new Date(b.due_date as string).getTime() - new Date(a.due_date as string).getTime())
    .slice(0, sampleSize);
  if (relevant.length < 3) return null;

  let totalDelay = 0;
  let lateCount = 0;
  for (const p of relevant) {
    const due = normalizeDate(p.due_date);
    const paid = normalizeDate(p.paid_at);
    if (!due || !paid) continue;
    const delayDays = Math.round((paid.getTime() - due.getTime()) / 86400_000);
    totalDelay += delayDays;
    if (delayDays > 3) lateCount += 1;
  }
  return { avgDelayDays: totalDelay / relevant.length, lateCount, totalCount: relevant.length };
}

type PeriodMode = "month" | "last6" | "year" | "custom";

function monthStartEnd(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
}

function periodRange(mode: PeriodMode, anchorMonth: string, customStart?: string, customEnd?: string) {
  if (mode === "custom" && customStart && customEnd) {
    const { start } = monthStartEnd(customStart);
    const { end } = monthStartEnd(customEnd);
    return start <= end ? { start, end } : { start: monthStartEnd(customEnd).start, end: monthStartEnd(customStart).end };
  }
  const { start: anchorStart, end: anchorEnd } = monthStartEnd(anchorMonth);
  if (mode === "year") {
    return { start: addMonths(anchorStart, -11), end: anchorEnd };
  }
  if (mode === "last6") return { start: addMonths(anchorStart, -5), end: anchorEnd };
  return { start: anchorStart, end: anchorEnd };
}

function fmtMonthFR(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function fmtPeriodFR(mode: PeriodMode, anchorMonth: string, customStart?: string, customEnd?: string) {
  const { start, end } = periodRange(mode, anchorMonth, customStart, customEnd);
  if (mode === "month") return fmtMonthFR(anchorMonth);
  if (mode === "year") return `${fmtMonthFR(monthKey(start))} → ${fmtMonthFR(monthKey(end))}`;
  return `${fmtMonthFR(monthKey(start))} → ${fmtMonthFR(monthKey(end))}`;
}
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

// Capital restant dû estimé à partir de la mensualité (hors assurance), du taux et de la durée restante.
function estimateRemainingPrincipal(monthlyPI: number, annualRatePct: number, remainingMonths: number): number | null {
  if (monthlyPI <= 0 || remainingMonths <= 0) return null;
  const r = annualRatePct / 100 / 12;
  const principal = r > 0 ? (monthlyPI * (1 - Math.pow(1 + r, -remainingMonths))) / r : monthlyPI * remainingMonths;
  return Number.isFinite(principal) && principal > 0 ? principal : null;
}

// Mensualité (hors assurance) nécessaire pour rembourser `principal` sur `termMonths` au taux `annualRatePct`.
function estimatePaymentForTerm(principal: number, annualRatePct: number, termMonths: number): number | null {
  if (principal <= 0 || termMonths <= 0) return null;
  const r = annualRatePct / 100 / 12;
  const payment = r > 0 ? (principal * r) / (1 - Math.pow(1 + r, -termMonths)) : principal / termMonths;
  return Number.isFinite(payment) && payment > 0 ? payment : null;
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

// Lignes déjà comptées dans les charges récurrentes : à exclure des sommes ponctuelles
// (dépenses/recettes) pour éviter un double comptage avec le total récurrent.
function isRecurringFlow(row: Transaction) {
  return Boolean(row.is_recurring || row.recurrence_parent_id);
}

function labelForProperty(property: Property | undefined, fallback = "Bien") {
  return property?.label || property?.address_line1 || fallback;
}

type RateBucket = { duree_ans: number; taux_moyen: number; taux_bas: number; taux_haut: number };

type LoanScenario = {
  kind: "renegotiate" | "extend";
  propertyLabel: string;
  currentRate: number;
  currentMonthlyPI: number;
  currentInsurance: number;
  currentRemainingMonths: number;
  principalRemaining: number;
  newRate: number;
  newMonthlyPI: number;
  newRemainingMonths: number;
  monthlyGain: number;
  totalInterestOld: number;
  totalInterestNew: number;
  totalInterestDelta: number; // négatif = économie, positif = surcoût
};

type FriendlyAction = {
  title: string;
  detail: string;
  tone: "red" | "amber" | "emerald" | "slate";
  cta?: { label: string; section: LandlordSectionKey; link?: NavigateLink };
  loanScenario?: LoanScenario;
};

// Trouve la durée de référence (15/20/25 ans) la plus proche de la durée restante du crédit.
function closestRateBucket(rates: RateBucket[], remainingMonths: number): RateBucket | null {
  if (!rates.length) return null;
  const remainingYears = remainingMonths / 12;
  return rates.reduce((best, bucket) =>
    Math.abs(bucket.duree_ans - remainingYears) < Math.abs(best.duree_ans - remainingYears) ? bucket : best
  );
}

function buildLoanScenario(
  kind: "renegotiate" | "extend",
  row: PropertyRow,
  newRate: number,
  newRemainingMonths: number
): LoanScenario | null {
  if (row.loanPrincipalRemaining == null || row.loanRate == null || row.loanRemainingMonths == null) return null;
  const newMonthlyPI = estimatePaymentForTerm(row.loanPrincipalRemaining, newRate, newRemainingMonths);
  if (newMonthlyPI == null) return null;
  const totalInterestOld = row.loanMonthlyPI * row.loanRemainingMonths - row.loanPrincipalRemaining;
  const totalInterestNew = newMonthlyPI * newRemainingMonths - row.loanPrincipalRemaining;
  return {
    kind,
    propertyLabel: row.label,
    currentRate: row.loanRate,
    currentMonthlyPI: row.loanMonthlyPI,
    currentInsurance: row.loanInsuranceMonthly,
    currentRemainingMonths: row.loanRemainingMonths,
    principalRemaining: row.loanPrincipalRemaining,
    newRate,
    newMonthlyPI,
    newRemainingMonths,
    monthlyGain: row.loanMonthlyPI - newMonthlyPI,
    totalInterestOld,
    totalInterestNew,
    totalInterestDelta: totalInterestNew - totalInterestOld,
  };
}

function actionsFor(row: PropertyRow, referenceRates: RateBucket[] | null): FriendlyAction[] {
  const actions: FriendlyAction[] = [];
  // Pas de CTA vers Finance pour un bien archivé : sa fiche n'apparaît pas dans la liste
  // "Paramètres financiers" (réservée aux biens actifs), le lien mènerait dans le vide.
  const financeCta = row.archived ? undefined : { label: "Ouvrir Finance", section: "finance" as const, link: { prefillPropertyId: row.propertyId } };

  // ── 1. PAS DE BAIL ───────────────────────────────────────────────────────
  if (row.activeLeaseCount === 0) {
    if (row.recurring > 0) {
      actions.push({
        tone: "red",
        title: "Aucun locataire — charges à découvert",
        detail: `${money(row.recurring)}/mois sortent sans revenu en face. Chaque mois vide coûte ${money(row.recurring)}. Rattachez le bail ou remettez le bien en location.`,
        cta: { label: "Créer le bail", section: "baux", link: { openCreate: true, prefillPropertyId: row.propertyId } },
      });
    } else {
      actions.push({
        tone: "slate",
        title: "Créer ou rattacher le bail actif",
        detail: "Sans bail, ce bien est à 0 € dans tous vos indicateurs et sort du suivi des quittances.",
        cta: { label: "Créer le bail", section: "baux", link: { openCreate: true, prefillPropertyId: row.propertyId } },
      });
    }
    actions.push({
      tone: "slate",
      title: "Archiver si le bien est sorti du parc",
      detail: "Un bien sans bail sans suivi alourdit vos tableaux. Archivez-le pour ne tracker que l’actif réel.",
      cta: { label: "Voir le bien", section: "biens" },
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
      cta: { label: "Ouvrir Quittances", section: "quittances" },
    });
  }

  if (row.paymentDelay && (row.paymentDelay.avgDelayDays >= 5 || row.paymentDelay.lateCount / row.paymentDelay.totalCount >= 0.5)) {
    actions.push({
      tone: row.paymentDelay.avgDelayDays >= 10 ? "amber" : "slate",
      title: `Retards de paiement récurrents — ${Math.round(row.paymentDelay.avgDelayDays)} j en moyenne`,
      detail: `${row.paymentDelay.lateCount} paiement(s) en retard sur les ${row.paymentDelay.totalCount} derniers échus. Un rappel plus tôt dans le mois ou un passage au prélèvement automatique peut limiter la récurrence.`,
      cta: { label: "Ouvrir Quittances", section: "quittances" },
    });
  }

  if (row.depositUncollected) {
    actions.push({
      tone: "amber",
      title: `Dépôt de garantie non encaissé — ${money(row.depositUncollected.amount)}`,
      detail: `Le bail est actif mais la caution n’est pas enregistrée comme encaissée. Sans elle, vous n’êtes pas couvert en cas de dégradations ou d’impayés en fin de bail.`,
      cta: { label: "Ouvrir la location", section: "baux", link: { leaseId: row.depositUncollected.leaseId, openPanel: "deposit", depositAction: "collect" } },
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
  if (row.irlLate) {
    const gainMonthly = row.expected * 0.03;
    actions.push({
      tone: row.irlLate.monthsLate >= 6 ? "amber" : "slate",
      title: `Révision IRL en retard de ${row.irlLate.monthsLate} mois`,
      detail: `Une révision au rythme habituel (~3 %/an) rapporterait ~${money(gainMonthly)}/mois, soit environ ${money(gainMonthly * row.irlLate.monthsLate)} déjà manqués depuis l’échéance.`,
      cta: { label: "Réviser l’IRL", section: "baux", link: { leaseId: row.irlLate.leaseId, openPanel: "irl" } },
    });
  }

  if (referenceRates) {
    // Taux de référence chargés : comparaison au marché réel. Si l'écart est trop faible
    // (ou que le scénario ne peut pas être calculé), on ne montre volontairement rien —
    // pas de repli sur l'heuristique générique, qui contredirait la donnée réelle.
    const rateBucket =
      row.loanRate != null && row.loanRemainingMonths ? closestRateBucket(referenceRates, row.loanRemainingMonths) : null;
    if (
      rateBucket &&
      row.loanRate != null &&
      row.loanRate - rateBucket.taux_moyen >= 0.3 &&
      row.loanRemainingMonths &&
      row.loanMonthlyPI > 0
    ) {
      const scenario = buildLoanScenario("renegotiate", row, rateBucket.taux_moyen, row.loanRemainingMonths);
      if (scenario) {
        actions.push({
          tone: row.cashflow < 0 ? "amber" : "slate",
          title: `Crédit à ${row.loanRate} % — marché actuel ${rateBucket.taux_moyen} % (${rateBucket.duree_ans} ans)`,
          detail: `À durée restante égale, une renégociation au taux de marché ferait gagner ~${money(scenario.monthlyGain)}/mois, soit ${money(Math.abs(scenario.totalInterestDelta))} d’intérêts économisés sur la durée restante.`,
          cta: financeCta,
          loanScenario: scenario,
        });
      }
    }
  } else if ((row.loanRate ?? 0) >= 3.5 && row.loanMonthly > 0 && (row.loanRemainingMonths ?? 0) > 24) {
    // Repli sur l'heuristique générique tant que les taux de référence ne sont pas chargés.
    const gain = Math.round(row.loanMonthly * 0.08);
    actions.push({
      tone: row.cashflow < 0 ? "amber" : "slate",
      title: `Crédit à ${row.loanRate} % — renégociation à évaluer`,
      detail: `Une baisse de 0,5 point peut libérer ~${money(gain)}/mois (${money(gain * 12)}/an) sur ${row.loanRemainingMonths} mois restants. À comparer au coût du rachat de crédit.`,
      cta: financeCta,
    });
  }

  if (
    row.loanRate != null &&
    row.loanRemainingMonths != null &&
    row.loanRemainingMonths > 24 &&
    row.loanPrincipalRemaining != null &&
    row.loanMonthlyPI > 0
  ) {
    const extendedMonths = row.loanRemainingMonths + 60;
    const scenario = buildLoanScenario("extend", row, row.loanRate, extendedMonths);
    if (scenario && scenario.monthlyGain >= 20) {
      actions.push({
        tone: row.cashflow < 80 ? "amber" : "slate",
        title: `Rallonger le crédit de 5 ans — ~${money(scenario.monthlyGain)}/mois de plus`,
        detail: `Mensualité ramenée à ${money(scenario.newMonthlyPI + scenario.currentInsurance)} au lieu de ${money(scenario.currentMonthlyPI + scenario.currentInsurance)}, sur ${Math.round(scenario.newRemainingMonths / 12)} ans au lieu de ${Math.round(scenario.currentRemainingMonths / 12)}. Coût : ${money(scenario.totalInterestDelta)} d’intérêts en plus sur la durée — à réserver aux cas où le cashflow immédiat est prioritaire.`,
        cta: financeCta,
        loanScenario: scenario,
      });
    }
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
      cta: financeCta,
    });
  }

  if (row.investment <= 0) {
    actions.push({
      tone: "slate",
      title: "Coût d’acquisition à compléter",
      detail: "Prix d’achat + frais notaire + travaux = base du rendement net. Sans ça, impossible de comparer ce bien à d’autres placements.",
      cta: financeCta,
    });
  }

  if (row.taxRegime == null) {
    actions.push({
      tone: "slate",
      title: "Régime fiscal non renseigné",
      detail: "LMNP réel, micro-foncier, Pinel… chaque régime change les charges déductibles et la lecture de la rentabilité.",
      cta: financeCta,
    });
  }

  if (row.loanRate == null && row.loanMonthly > 0) {
    actions.push({
      tone: "slate",
      title: "Taux du crédit à renseigner",
      detail: "Sans taux, impossible de savoir si une renégociation peut changer l’équilibre de ce bien. À ajouter dans Finance > Paramètres du bien.",
      cta: financeCta,
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

function bisectionIRR(
  investment: number,
  annualCashflow: number,
  terminalValue: number,
  holdingYears: number
): number | null {
  if (investment <= 0 || holdingYears < 1) return null;
  const npv = (r: number): number => {
    if (Math.abs(r) < 1e-9) return -investment + annualCashflow * holdingYears + terminalValue;
    return (
      -investment +
      (annualCashflow * (1 - Math.pow(1 + r, -holdingYears))) / r +
      terminalValue / Math.pow(1 + r, holdingYears)
    );
  };
  let lo = -0.5, hi = 10.0;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (hi - lo < 1e-8) break;
    if (npv(mid) * npv(lo) <= 0) hi = mid;
    else lo = mid;
  }
  const result = (lo + hi) / 2;
  return Number.isFinite(result) ? result : null;
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
  grossYield: number | null;
  estimatedValue: number | null;
  latentGain: number | null;
  holdingYears: number | null;
  irr: number | null;
  activeLeaseId: string | null;
  irlLate: { leaseId: string; monthsLate: number } | null;
  loanMonthlyPI: number;
  loanInsuranceMonthly: number;
  loanPrincipalRemaining: number | null;
  paymentDelay: { avgDelayDays: number; lateCount: number; totalCount: number } | null;
  depositUncollected: { amount: number; leaseId: string } | null;
  archived: boolean;
};

export function SectionPerformance({ userId, leases, payments, propertyById, onNavigateDeep }: Props) {
  const propsById = propertyById instanceof Map ? propertyById : new Map<string, Property>();
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const [propertyId, setPropertyId] = useState("");
  const [includeArchivedProperties, setIncludeArchivedProperties] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("last6");
  const [customStartMonth, setCustomStartMonth] = useState("");
  const [customEndMonth, setCustomEndMonth] = useState("");
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [tx, setTx] = useState<Transaction[]>([]);
  const [finance, setFinance] = useState<Map<string, PropertyFinance>>(new Map());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [referenceRates, setReferenceRates] = useState<RateBucket[] | null>(null);
  const [loanScenario, setLoanScenario] = useState<LoanScenario | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/donnees?section=taux_credit_immobilier")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (active && Array.isArray(json?.donnees)) setReferenceRates(json.donnees);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [currentMonth, setCurrentMonth] = useState(() => monthKey(new Date()));
  const [chartDrillKey, setChartDrillKey] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const m = monthKey(new Date());
      setCurrentMonth((prev) => (prev !== m ? m : prev));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const selectedPeriod = useMemo(() => {
    const { start, end } = periodRange(periodMode, currentMonth, customStartMonth || undefined, customEndMonth || undefined);
    const months: Date[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      months.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { start, end, months, monthCount: months.length, label: fmtPeriodFR(periodMode, currentMonth, customStartMonth || undefined, customEndMonth || undefined) };
  }, [periodMode, currentMonth, customStartMonth, customEndMonth]);
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
          .select("id,property_id,lease_id,occurred_at,direction,category,label,amount,status,is_recurring,recurrence_frequency,recurrence_parent_id,recurrence_since,recurrence_end_date")
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

  const earliestDateByProperty = useMemo(() => {
    const map = new Map<string, number>();
    for (const lease of (Array.isArray(leases) ? leases : [])) {
      if (!lease.property_id || !lease.start_date) continue;
      const d = normalizeDate(lease.start_date);
      if (!d) continue;
      const prev = map.get(lease.property_id);
      if (!prev || d.getTime() < prev) map.set(lease.property_id, d.getTime());
    }
    for (const t of tx) {
      if (!t.property_id || !t.occurred_at) continue;
      const d = normalizeDate(t.occurred_at);
      if (!d) continue;
      const prev = map.get(t.property_id);
      if (!prev || d.getTime() < prev) map.set(t.property_id, d.getTime());
    }
    return map;
  }, [leases, tx]);

  // Charges récurrentes enregistrées comme transactions (même logique que SectionFinance)
  const recurringParentTxByProperty = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of tx) {
      if (!t.is_recurring) continue;
      const pid = t.property_id || "";
      const list = map.get(pid) || [];
      list.push(t);
      map.set(pid, list);
    }
    return map;
  }, [tx]);

  const propertyRows = useMemo<PropertyRow[]>(() => {
    const ids = new Set<string>();
    for (const option of propertyOptions) ids.add(option.id);
    for (const lease of activeLeases) if (lease.property_id) ids.add(lease.property_id);
    // N'ajouter que les property_id de transactions connus dans propsById (évite les lignes fantômes pour biens supprimés)
    for (const row of tx) if (row.property_id && propsById.has(row.property_id)) ids.add(row.property_id);

    return Array.from(ids)
      .filter((id) => {
        const property = propsById.get(id);
        return !property || includeArchivedProperties || isActivePropertyLike(property);
      })
      .filter((id) => !propertyId || id === propertyId)
      .map((id) => {
        const archived = !isActivePropertyLike(propsById.get(id));
        const propertyLeases = activeLeases.filter((lease) => lease.property_id === id);
        const expected = sum(propertyLeases.map((lease) => monthlyLeaseAmount(lease)));
        const primaryLease = propertyLeases[0] || null;
        const { start: pStart, end: pEnd, monthCount } = selectedPeriod;
        const received = sum(
          safePayments
            .filter((payment) => {
              const lease = leaseById.get(payment.lease_id);
              if (!lease || lease.property_id !== id || !payment.paid_at) return false;
              const d = normalizeDate(payment.period_start);
              return d != null && d >= pStart && d <= pEnd;
            })
            .map((payment) => Number(payment.total_amount || 0))
        );
        const periodTx = tx.filter((row) => {
          if (row.property_id !== id) return false;
          const d = normalizeDate(row.occurred_at);
          return d != null && d >= pStart && d <= pEnd;
        });
        const ledgerIncome = sum(periodTx.filter((row) => !isRecurringFlow(row) && isReceivedIncome(row)).map((row) => Number(row.amount || 0)));
        const expense = sum(
          periodTx
            .filter((row) => !isRecurringFlow(row) && row.direction === "out" && !DEPOSIT_TRANSIT_CATEGORIES.includes(row.category))
            .map((row) => Number(row.amount || 0))
        );
        const fin = finance.get(id) || null;
        // Ne garder que les charges récurrentes dont la fenêtre (recurrence_since/end_date)
        // recoupe la période sélectionnée, sinon une charge terminée (crédit soldé…) fausse
        // encore le cashflow alors qu'elle est déjà exclue du graphique de tendance.
        const recurringTxs = (recurringParentTxByProperty.get(id) || []).filter((t) => {
          const since = t.recurrence_since ? normalizeDate(t.recurrence_since) : null;
          const end = t.recurrence_end_date ? normalizeDate(t.recurrence_end_date) : null;
          if (since && since > pEnd) return false;
          if (end && end < pStart) return false;
          return true;
        });
        // "loan", "tax", "insurance" et "copro" remplacent leur équivalent property_finance
        // si une transaction récurrente de même catégorie existe (évite le double-comptage).
        let loanTx = 0, otherTx = 0;
        let hasLoanTx = false, hasTaxTx = false, hasInsuranceTx = false, hasCoproTx = false;
        for (const t of recurringTxs) {
          const divisor = t.recurrence_frequency === "quarterly" ? 3 : t.recurrence_frequency === "yearly" ? 12 : 1;
          const monthlyAmt = (t.amount / divisor) * (t.direction === "out" ? 1 : -1);
          if (t.category === "loan") { loanTx += monthlyAmt; hasLoanTx = true; }
          else if (t.category === "tax") { otherTx += monthlyAmt; hasTaxTx = true; }
          else if (t.category === "insurance") { otherTx += monthlyAmt; hasInsuranceTx = true; }
          else if (t.category === "copro") { otherTx += monthlyAmt; hasCoproTx = true; }
          else otherTx += monthlyAmt;
        }
        const loanMonthly = hasLoanTx ? loanTx : Number(fin?.loan_monthly || 0) + Number(fin?.loan_insurance_monthly || 0);
        // Part hors-assurance de la mensualité (approximative si le crédit vient d'une écriture récurrente
        // unique, car elle ne distingue pas assurance et capital+intérêts) — sert au calcul d'amortissement.
        const loanMonthlyPI = hasLoanTx ? loanTx : Number(fin?.loan_monthly || 0);
        const loanInsuranceMonthly = hasLoanTx ? 0 : Number(fin?.loan_insurance_monthly || 0);
        const finOtherMonthly =
          (hasTaxTx ? 0 : Number(fin?.property_tax_yearly || 0) / 12 + Number(fin?.cfe_yearly || 0) / 12) +
          Number(fin?.fixed_charges_monthly || 0) +
          (hasInsuranceTx ? 0 : Number(fin?.pno_insurance_monthly || 0)) +
          (hasCoproTx ? 0 : Number(fin?.copro_charges_monthly || 0)) +
          Number(fin?.bank_fees_monthly || 0) +
          Number(fin?.maintenance_monthly || 0) +
          Number(fin?.rental_tax_monthly || 0);
        const recurring = loanMonthly + finOtherMonthly + otherTx;
        const incomeBase = Math.max(received, ledgerIncome);
        const incomeMonthly = monthCount > 1 ? incomeBase / monthCount : incomeBase;
        const expenseMonthly = monthCount > 1 ? expense / monthCount : expense;
        const cashflow = incomeMonthly - expenseMonthly - recurring;
        const investment = investmentAmount(fin);
        const netYield = investment > 0 ? ((incomeMonthly - recurring) * 12 * 100) / investment : null;
        const occupancy = computeOccupancySignals(safeLeases, id);
        const loanRemainingMonths = remainingLoanMonths(fin);
        const loanRatePct = fin?.loan_rate_percent == null ? null : Number(fin.loan_rate_percent);
        const loanPrincipalRemaining =
          loanRatePct != null && loanRemainingMonths != null
            ? estimateRemainingPrincipal(loanMonthlyPI, loanRatePct, loanRemainingMonths)
            : null;

        const grossYield = investment > 0 ? (incomeMonthly * 12 * 100) / investment : null;
        const earliestMs = earliestDateByProperty.get(id);
        const holdingYears = earliestMs != null ? (Date.now() - earliestMs) / (365.25 * 86400_000) : null;
        const purchasePrice = Number(fin?.purchase_price || 0);
        const estimatedValue =
          holdingYears != null && holdingYears >= 0.5 && purchasePrice > 0
            ? Math.round(purchasePrice * Math.pow(1.02, holdingYears))
            : null;
        const latentGain = estimatedValue != null ? estimatedValue - investment : null;
        const loanBalanceApprox =
          loanRemainingMonths != null && loanRemainingMonths > 0 ? loanMonthly * loanRemainingMonths * 0.65 : 0;
        const terminalValue = estimatedValue != null ? Math.max(0, estimatedValue - loanBalanceApprox) : null;
        const allPropertyTx = tx.filter((t) => t.property_id === id);
        const allIncome = sum(
          allPropertyTx.filter((t) => !isRecurringFlow(t) && isReceivedIncome(t)).map((t) => Number(t.amount))
        );
        const allExpense = sum(
          allPropertyTx
            .filter((t) => !isRecurringFlow(t) && t.direction === "out" && !DEPOSIT_TRANSIT_CATEGORIES.includes(t.category))
            .map((t) => Number(t.amount))
        );
        const totalHistoricalRecurring = holdingYears != null ? recurring * 12 * holdingYears : 0;
        const avgAnnualCashflow =
          holdingYears != null && holdingYears > 0
            ? (allIncome - allExpense - totalHistoricalRecurring) / holdingYears
            : cashflow * 12;
        const irr =
          holdingYears != null &&
          holdingYears >= 1 &&
          investment > 0 &&
          terminalValue != null &&
          Number.isFinite(avgAnnualCashflow)
            ? bisectionIRR(investment, avgAnnualCashflow, terminalValue, holdingYears)
            : null;
        const irlLate = irlLateness(primaryLease || undefined);
        const paymentDelay = primaryLease ? paymentDelayStats(safePayments, primaryLease.id) : null;
        const leaseStart = primaryLease ? normalizeDate(primaryLease.start_date) : null;
        const leaseAgeDays = leaseStart ? (Date.now() - leaseStart.getTime()) / 86400_000 : 0;
        const depositUncollected =
          primaryLease && Number(primaryLease.deposit_amount || 0) > 0 && !primaryLease.deposit_paid_at && leaseAgeDays >= 30
            ? { amount: Number(primaryLease.deposit_amount), leaseId: primaryLease.id }
            : null;

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
          loanRemainingMonths,
          loanEndYear: fin?.loan_end_year == null ? null : Number(fin.loan_end_year),
          taxRegime: fin?.tax_regime || null,
          vacancyDays12m: occupancy.vacancyDays12m,
          turnover12m: occupancy.turnover12m,
          activeLeaseCount: occupancy.activeLeaseCount,
          grossYield,
          estimatedValue,
          latentGain,
          holdingYears,
          irr,
          activeLeaseId: primaryLease?.id || null,
          irlLate,
          loanMonthlyPI,
          loanInsuranceMonthly,
          loanPrincipalRemaining,
          paymentDelay,
          depositUncollected,
          archived,
        };
      })
      .sort((a, b) => b.cashflow - a.cashflow);
  }, [activeLeases, earliestDateByProperty, selectedPeriod, finance, includeArchivedProperties, leaseById, propertyId, propertyOptions, propsById, recurringParentTxByProperty, safeLeases, safePayments, tx]);

  const portfolioSummary = useMemo(() => {
    const negativeRows = propertyRows.filter((row) => row.cashflow < 0);
    const totalDeficit = sum(negativeRows.map((row) => row.cashflow));

    let renegotiableCount = 0;
    let renegotiableGain = 0;
    for (const row of propertyRows) {
      if (row.loanRate == null || !row.loanRemainingMonths || row.loanMonthlyPI <= 0) continue;
      const bucket = referenceRates ? closestRateBucket(referenceRates, row.loanRemainingMonths) : null;
      const targetRate = bucket && row.loanRate - bucket.taux_moyen >= 0.3 ? bucket.taux_moyen : null;
      if (targetRate == null) {
        if (!referenceRates && row.loanRate >= 3.5 && row.loanRemainingMonths > 24) {
          renegotiableCount += 1;
          renegotiableGain += Math.round(row.loanMonthly * 0.08);
        }
        continue;
      }
      const scenario = buildLoanScenario("renegotiate", row, targetRate, row.loanRemainingMonths);
      if (scenario) {
        renegotiableCount += 1;
        renegotiableGain += Math.round(scenario.monthlyGain);
      }
    }

    const irlLateRows = propertyRows.filter((row) => row.irlLate);
    return {
      negativeCount: negativeRows.length,
      totalDeficit,
      renegotiableCount,
      renegotiableGain,
      irlLateCount: irlLateRows.length,
    };
  }, [propertyRows, referenceRates]);

  const series = useMemo(() => {
    const propertyIds = propertyRows.map((row) => row.propertyId);

    // Charges récurrentes du mois donné, fenêtre par fenêtre (recurrence_since/end_date),
    // avec le même fallback property_finance par catégorie que dans Finance.
    const recurringForMonth = (monthStart: Date) => {
      let total = 0;
      for (const id of propertyIds) {
        const fin = finance.get(id) || null;
        const recurringTxs = recurringParentTxByProperty.get(id) || [];
        const activeTxs = recurringTxs.filter((t) => {
          const since = t.recurrence_since ? normalizeDate(t.recurrence_since) : null;
          const end = t.recurrence_end_date ? normalizeDate(t.recurrence_end_date) : null;
          if (since && monthStart < new Date(since.getFullYear(), since.getMonth(), 1)) return false;
          if (end && monthStart > new Date(end.getFullYear(), end.getMonth(), 1)) return false;
          return true;
        });

        let hasLoanTx = false, hasTaxTx = false, hasInsuranceTx = false, hasCoproTx = false;
        for (const t of activeTxs) {
          const divisor = t.recurrence_frequency === "quarterly" ? 3 : t.recurrence_frequency === "yearly" ? 12 : 1;
          total += (t.amount / divisor) * (t.direction === "out" ? 1 : -1);
          if (t.category === "loan") hasLoanTx = true;
          else if (t.category === "tax") hasTaxTx = true;
          else if (t.category === "insurance") hasInsuranceTx = true;
          else if (t.category === "copro") hasCoproTx = true;
        }

        if (!hasLoanTx) total += Number(fin?.loan_monthly || 0) + Number(fin?.loan_insurance_monthly || 0);
        total +=
          (hasTaxTx ? 0 : Number(fin?.property_tax_yearly || 0) / 12 + Number(fin?.cfe_yearly || 0) / 12) +
          Number(fin?.fixed_charges_monthly || 0) +
          (hasInsuranceTx ? 0 : Number(fin?.pno_insurance_monthly || 0)) +
          (hasCoproTx ? 0 : Number(fin?.copro_charges_monthly || 0)) +
          Number(fin?.bank_fees_monthly || 0) +
          Number(fin?.maintenance_monthly || 0) +
          Number(fin?.rental_tax_monthly || 0);
      }
      return total;
    };

    return selectedPeriod.months.map((date) => {
      const key = monthKey(date);
      const rows = tx.filter((row) => {
        if (propertyId && row.property_id !== propertyId) return false;
        const rowDate = normalizeDate(row.occurred_at);
        return rowDate ? monthKey(rowDate) === key : false;
      });
      const ledgerIncome = sum(rows.filter((row) => !isRecurringFlow(row) && isReceivedIncome(row)).map((row) => Number(row.amount || 0)));
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
      const expense = sum(
        rows
          .filter((row) => !isRecurringFlow(row) && row.direction === "out" && !DEPOSIT_TRANSIT_CATEGORIES.includes(row.category))
          .map((row) => Number(row.amount || 0))
      );
      const recurring = recurringForMonth(date);
      return {
        key,
        label: date.toLocaleDateString("fr-FR", { month: "short", year: selectedPeriod.monthCount > 12 ? "2-digit" : undefined }).replace(".", ""),
        income,
        expense,
        recurring,
        net: income - expense - recurring,
      };
    });
  }, [finance, leaseById, recurringParentTxByProperty, selectedPeriod, propertyId, propertyRows, safePayments, tx]);

  const projectionSeries = useMemo(() => {
    const rows = propertyRows.filter((row) => row.estimatedValue != null && row.investment > 0);
    if (rows.length === 0) return [];
    return Array.from({ length: 21 }, (_, t) => {
      let equity = 0;
      let cumulCashflow = 0;
      for (const row of rows) {
        const futureValue = row.estimatedValue! * Math.pow(1.02, t);
        const remMonths = Math.max(0, (row.loanRemainingMonths ?? 0) - t * 12);
        const debt = remMonths > 0 ? row.loanMonthly * remMonths * 0.65 : 0;
        equity += Math.max(0, futureValue - debt);
        cumulCashflow += row.cashflow * 12 * t;
      }
      return { t, equity: Math.round(equity), cumulCashflow: Math.round(cumulCashflow) };
    });
  }, [propertyRows]);

  const projectionChartData = useMemo(
    () => ({
      labels: projectionSeries.map((s) => (s.t % 5 === 0 ? `+${s.t} ans` : "")),
      datasets: [
        {
          type: "line" as const,
          label: "Capital net estimé",
          data: projectionSeries.map((s) => s.equity),
          borderColor: "#635bff",
          backgroundColor: "rgba(99, 91, 255, 0.06)",
          pointRadius: projectionSeries.map((s) => (s.t % 5 === 0 ? 4 : 2)),
          tension: 0.4,
        },
        {
          type: "line" as const,
          label: "Cashflow cumulé",
          data: projectionSeries.map((s) => s.cumulCashflow),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.06)",
          pointRadius: projectionSeries.map((s) => (s.t % 5 === 0 ? 4 : 2)),
          tension: 0.4,
        },
      ],
    }),
    [projectionSeries]
  );

  const projectionOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: { usePointStyle: true, boxWidth: 8, color: "#475569", font: { size: 12, weight: "600" as const } },
        },
        tooltip: {
          callbacks: {
            title: (items: any[]) => `Dans ${items[0]?.label?.replace("+", "") || ""} ans`,
            label: (ctx: any) => `${ctx.dataset.label} : ${money(Number(ctx.raw || 0))}`,
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

  const chartDrillRows = useMemo(
    () =>
      chartDrillKey
        ? tx.filter((r) => {
            if (isRecurringFlow(r)) return false;
            if (propertyId && r.property_id !== propertyId) return false;
            const d = normalizeDate(r.occurred_at);
            return d ? monthKey(d) === chartDrillKey : false;
          })
        : [],
    [chartDrillKey, tx, propertyId]
  );

  const chartDrillStructuralRows = useMemo(() => {
    if (!chartDrillKey) return [];
    const monthStart = new Date(chartDrillKey + "-01");
    const rows: Array<{ id: string; label: string; category: string; amount: number; direction: "in" | "out"; property_id: string }> = [];
    const pidList = propertyRows.map((r) => r.propertyId);

    for (const pid of pidList) {
      const recurringTxs = recurringParentTxByProperty.get(pid) || [];
      let hasLoanTx = false, hasTaxTx = false;

      const activeTxs = recurringTxs.filter((t) => {
        const since = t.recurrence_since ? new Date(t.recurrence_since) : null;
        const end = t.recurrence_end_date ? new Date(t.recurrence_end_date) : null;
        if (since && monthStart < new Date(since.getFullYear(), since.getMonth(), 1)) return false;
        if (end && monthStart > new Date(end.getFullYear(), end.getMonth(), 1)) return false;
        return true;
      });

      for (const t of activeTxs) {
        const divisor = t.recurrence_frequency === "quarterly" ? 3 : t.recurrence_frequency === "yearly" ? 12 : 1;
        rows.push({ id: t.id, label: CATEGORY_LABELS[t.category] || t.category, category: t.category, amount: t.amount / divisor, direction: t.direction, property_id: pid });
        if (t.category === "loan") hasLoanTx = true;
        else if (t.category === "tax") hasTaxTx = true;
      }

      const fin = finance.get(pid);
      if (fin) {
        if (!hasLoanTx) {
          const amt = Number(fin.loan_monthly || 0) + Number(fin.loan_insurance_monthly || 0);
          if (amt > 0) rows.push({ id: `pf-loan-${pid}`, label: "Crédit + assurance", category: "loan", amount: amt, direction: "out", property_id: pid });
        }
        if (!hasTaxTx) {
          const amt = Number(fin.property_tax_yearly || 0) / 12 + Number(fin.cfe_yearly || 0) / 12;
          if (amt > 0) rows.push({ id: `pf-tax-${pid}`, label: "Taxes (foncière/CFE)", category: "tax", amount: amt, direction: "out", property_id: pid });
        }
        const fixed =
          Number(fin.fixed_charges_monthly || 0) +
          Number(fin.pno_insurance_monthly || 0) +
          Number(fin.copro_charges_monthly || 0) +
          Number(fin.bank_fees_monthly || 0) +
          Number(fin.maintenance_monthly || 0) +
          Number(fin.rental_tax_monthly || 0);
        if (fixed > 0) rows.push({ id: `pf-fixed-${pid}`, label: "Charges fixes", category: "fees", amount: fixed, direction: "out", property_id: pid });
      }
    }

    return rows;
  }, [chartDrillKey, propertyRows, recurringParentTxByProperty, finance]);

  const totals = useMemo(() => {
    const recurring = sum(propertyRows.map((row) => row.recurring));
    return { recurring };
  }, [propertyRows]);

  const { monthCount } = selectedPeriod;
  const priorityRows = propertyRows
    .filter((row) => row.cashflow < 150 || (row.expected * monthCount > Math.max(row.received, row.ledgerIncome) * 0.95) || row.recurring <= 0)
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
      onClick: (_event: any, elements: any[]) => {
        const idx = elements[0]?.index;
        if (idx !== undefined) setChartDrillKey(series[idx]?.key ?? null);
      },
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
    [series]
  );

  const expenseBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const row of tx) {
      if (propertyId && row.property_id !== propertyId) continue;
      if (row.direction !== "out") continue;
      if (DEPOSIT_TRANSIT_CATEGORIES.includes(row.category)) continue;
      const rowDate = normalizeDate(row.occurred_at);
      if (!rowDate || rowDate < selectedPeriod.start || rowDate > selectedPeriod.end) continue;
      byCategory.set(row.category || "other", (byCategory.get(row.category || "other") || 0) + Number(row.amount || 0));
    }
    const recurring = totals.recurring * selectedPeriod.monthCount;
    if (recurring > 0) byCategory.set("Charges récurrentes", (byCategory.get("Charges récurrentes") || 0) + recurring);
    return Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, label: CATEGORY_LABELS[category] || category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [selectedPeriod, propertyId, totals.recurring, tx]);

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
          desc="Analysez vos revenus, charges et rentabilité sur la période de votre choix."
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

      {priorityRows.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <SparklesIcon className="h-5 w-5 shrink-0 text-amber-500" />
          <span><span className="font-semibold">{priorityRows.length} bien{priorityRows.length > 1 ? "s" : ""} à regarder</span> — des actions peuvent améliorer la performance.</span>
        </div>
      )}

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

      {propertyRows.some((r) => r.grossYield != null || r.irr != null || r.estimatedValue != null) && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Patrimoine</p>
            <h3 className="text-lg font-semibold text-slate-950">Rentabilité réelle & capital constitué</h3>
            <p className="text-sm text-slate-600">TRI sur données réelles, rendement brut et estimation de la valeur actuelle de votre parc.</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">Rendement brut moyen</p>
              {(() => {
                const wrows = propertyRows.filter((r) => r.grossYield != null && r.investment > 0);
                if (wrows.length === 0) return <><p className="mt-2 text-xl font-semibold text-slate-400">À compléter</p><p className="mt-1 text-xs text-slate-400">prix d'achat manquant</p></>;
                const avg = sum(wrows.map((r) => r.grossYield!)) / wrows.length;
                return <><p className={`mt-2 text-2xl font-semibold ${avg >= 6 ? "text-emerald-700" : avg >= 4 ? "text-amber-700" : "text-rose-700"}`}>{pct(avg)}</p><p className="mt-1 text-xs text-slate-500">loyers bruts annuels / coût d'acquisition</p></>;
              })()}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">TRI estimé (réel)</p>
              {(() => {
                const wrows = propertyRows.filter((r) => r.irr != null);
                if (wrows.length === 0) return <><p className="mt-2 text-xl font-semibold text-slate-400">À calculer</p><p className="mt-1 text-xs text-slate-400">prix d'achat et historique requis</p></>;
                const avg = sum(wrows.map((r) => r.irr!)) / wrows.length;
                return <><p className={`mt-2 text-2xl font-semibold ${avg >= 0.07 ? "text-emerald-700" : avg >= 0.04 ? "text-amber-700" : "text-rose-700"}`}>{pct(avg * 100)}</p><p className="mt-1 text-xs text-slate-500">rendement annualisé cashflows + plus-value</p></>;
              })()}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">Valeur estimée totale</p>
              {(() => {
                const total = sum(propertyRows.filter((r) => r.estimatedValue != null).map((r) => r.estimatedValue!));
                if (total === 0) return <><p className="mt-2 text-xl font-semibold text-slate-400">À compléter</p><p className="mt-1 text-xs text-slate-400">prix d'achat manquant</p></>;
                return <><p className="mt-2 text-2xl font-semibold text-slate-900">{money(total)}</p><p className="mt-1 text-xs text-slate-500">prix achat × (1 + 2 %/an)^durée · indicatif</p></>;
              })()}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">Plus-value latente</p>
              {(() => {
                const wrows = propertyRows.filter((r) => r.latentGain != null);
                if (wrows.length === 0) return <><p className="mt-2 text-xl font-semibold text-slate-400">À compléter</p><p className="mt-1 text-xs text-slate-400">prix d'achat manquant</p></>;
                const total = sum(wrows.map((r) => r.latentGain!));
                return <><p className={`mt-2 text-2xl font-semibold ${total >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{total >= 0 ? "+" : ""}{money(total)}</p><p className="mt-1 text-xs text-slate-500">avant impôts et remboursement crédit</p></>;
              })()}
            </div>
          </div>

          {projectionSeries.length > 0 && (
            <div className="mt-5">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-slate-900">Projection patrimoniale — 20 ans</p>
                <p className="text-xs text-slate-500">Capital net (valeur estimée − crédit restant) et cashflows cumulés projetés, à taux d'appréciation et de loyer constants.</p>
              </div>
              <div className="mt-3 h-[260px] rounded-3xl border border-slate-100 bg-slate-50 p-3">
                <Chart type="line" data={projectionChartData as any} options={projectionOptions as any} />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Tendance</p>
            <h3 className="text-lg font-semibold text-slate-950">Encaissements, dépenses et résultat net</h3>
          </div>
          <p className="text-xs text-slate-500">Chaque barre est rattachée au mois concerné. Les charges récurrentes sont ajoutées automatiquement.</p>
        </div>

        {/* Period selector */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-0.5 gap-px">
            {([
              { key: "month" as const, label: "Ce mois" },
              { key: "last6" as const, label: "6 mois" },
              { key: "year" as const, label: "Année" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriodMode(opt.key)}
                className={cx(
                  "rounded-[0.6rem] px-3 py-1.5 text-xs font-semibold transition",
                  periodMode === opt.key ? "bg-white shadow-sm text-slate-900" : "text-slate-600 hover:text-slate-800"
                )}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPeriodPickerOpen(true)}
              className={cx(
                "rounded-[0.6rem] px-3 py-1.5 text-xs font-semibold transition",
                periodMode === "custom" ? "bg-white shadow-sm text-slate-900" : "text-slate-600 hover:text-slate-800"
              )}
            >
              {periodMode === "custom" ? selectedPeriod.label : "Personnalisé"}
            </button>
          </div>
          <span className="text-xs text-slate-500">{selectedPeriod.label}</span>
        </div>

        <div className="mt-4 h-[320px] cursor-pointer rounded-3xl border border-slate-100 bg-slate-50 p-3" title="Cliquer une barre pour voir le détail du mois">
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

      <section className="space-y-4">
        {/* Section headers */}
        <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-indigo-700">Décision</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">Matrice par bien</h3>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <ExclamationTriangleIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-amber-700">Conseils simples</p>
                <h3 className="text-lg font-semibold text-slate-950">À faire maintenant</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio summary */}
        {propertyRows.length > 1 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Portefeuille</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-lg font-semibold text-slate-950">
                {portfolioSummary.negativeCount > 0
                  ? `${portfolioSummary.negativeCount} bien${portfolioSummary.negativeCount > 1 ? "s" : ""} en cashflow négatif`
                  : "Tous les biens sont à l’équilibre ou positifs"}
              </p>
              {portfolioSummary.negativeCount > 0 ? (
                <span className="text-sm font-semibold text-rose-700">{money(portfolioSummary.totalDeficit)}/mois au total</span>
              ) : null}
            </div>
            {portfolioSummary.renegotiableGain > 0 ? (
              <p className="mt-1 text-sm text-slate-600">
                Premier levier : {portfolioSummary.renegotiableCount} crédit{portfolioSummary.renegotiableCount > 1 ? "s" : ""} à ≥ 3,5 % renégociable{portfolioSummary.renegotiableCount > 1 ? "s" : ""}, soit ~{money(portfolioSummary.renegotiableGain)}/mois potentiels.
              </p>
            ) : portfolioSummary.irlLateCount > 0 ? (
              <p className="mt-1 text-sm text-slate-600">
                Premier levier : {portfolioSummary.irlLateCount} révision{portfolioSummary.irlLateCount > 1 ? "s" : ""} IRL en retard — voir le détail bien par bien ci-dessous.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Per-property paired rows */}
        {propertyRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            Aucun bien exploitable pour l’instant.
          </div>
        ) : (
          propertyRows.map((row) => {
            const decision = decisionFor(row);
            const actions = actionsFor(row, referenceRates);
            return (
              <div key={row.propertyId} className="grid gap-4 xl:grid-cols-[1fr,1fr] xl:items-start">
                {/* Left: matrix card */}
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-950">{row.label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Loyers mensuels {money(row.expected)} · charges mensuelles {money(row.recurring)}
                      </p>
                    </div>
                    <span className={`self-start rounded-full border px-3 py-1 text-xs font-semibold ${decision.tone}`}>{decision.label}</span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <Stat
                      label={selectedPeriod.monthCount === 1 ? "Encaissé ce mois" : "Encaissé / mois"}
                      value={money(Math.max(row.received, row.ledgerIncome) / selectedPeriod.monthCount)}
                    />
                    <Stat
                      label={selectedPeriod.monthCount === 1 ? "Dépenses ce mois" : "Dépenses / mois"}
                      value={money(row.expense / selectedPeriod.monthCount)}
                    />
                    <Stat label="Cashflow mensuel" value={money(row.cashflow)} strong={row.cashflow >= 0 ? "good" : "bad"} />
                    <Stat label="Rendement net" value={row.netYield == null ? "À compléter" : pct(row.netYield)} />
                    <Stat label="Taux crédit" value={row.loanRate == null ? "À renseigner" : `${row.loanRate.toLocaleString("fr-FR")} %`} />
                    <Stat label="Fin crédit" value={row.loanEndYear == null ? "—" : String(row.loanEndYear)} />
                    <Stat label="Vacance 12 mois" value={`${row.vacancyDays12m} j`} strong={row.vacancyDays12m >= 30 ? "bad" : undefined} />
                    <Stat label="Turnover 12 mois" value={String(row.turnover12m)} strong={row.turnover12m >= 2 ? "bad" : undefined} />
                  </div>

                  {(row.grossYield != null || row.irr != null || row.estimatedValue != null) && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      <Stat label="Rendement brut" value={row.grossYield != null ? pct(row.grossYield) : "—"} />
                      <Stat
                        label="TRI estimé"
                        value={row.irr != null ? pct(row.irr * 100) : "—"}
                        strong={row.irr != null ? (row.irr >= 0.07 ? "good" : row.irr < 0 ? "bad" : undefined) : undefined}
                      />
                      <Stat label="Valeur estimée" value={row.estimatedValue != null ? money(row.estimatedValue) : "—"} />
                      <Stat
                        label="Plus-value latente"
                        value={row.latentGain != null ? `${row.latentGain >= 0 ? "+" : ""}${money(row.latentGain)}` : "—"}
                        strong={row.latentGain != null ? (row.latentGain >= 0 ? "good" : "bad") : undefined}
                      />
                    </div>
                  )}

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900">{decision.signal}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{decision.action}</p>
                  </div>
                </div>

                {/* Right: advice card */}
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-slate-950">{row.label}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[0.68rem] font-semibold text-slate-600">
                      {money(row.cashflow)} / mois
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {actions.map((action) => {
                      const bg = action.tone === "red" ? "border-red-100 bg-red-50" : action.tone === "amber" ? "border-amber-100 bg-amber-50" : action.tone === "emerald" ? "border-emerald-100 bg-emerald-50" : "border-slate-100 bg-slate-50";
                      const dot = action.tone === "red" ? "bg-red-400" : action.tone === "amber" ? "bg-amber-400" : action.tone === "emerald" ? "bg-emerald-400" : "bg-slate-300";
                      return (
                        <div key={action.title} className={`rounded-2xl border px-3 py-2.5 ${bg}`}>
                          <div className="flex items-start gap-2">
                            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-950">{action.title}</p>
                              <p className="mt-0.5 text-sm leading-6 text-slate-600">{action.detail}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                {action.loanScenario ? (
                                  <button
                                    type="button"
                                    onClick={() => setLoanScenario(action.loanScenario!)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-700"
                                  >
                                    Voir le détail du calcul
                                  </button>
                                ) : null}
                                {action.cta && onNavigateDeep ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateDeep(action.cta!.section, action.cta!.link)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-700"
                                  >
                                    {action.cta.label} →
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <a
          href="/espace-bailleur?tab=finance"
          className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Compléter les charges dans Finance
        </a>
      </section>

      {loading ? <p className="text-xs text-slate-500">Chargement de la performance…</p> : null}

      {/* Loan scenario detail modal */}
      {loanScenario ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-sm sm:items-center">
          <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={() => setLoanScenario(null)} />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {loanScenario.kind === "renegotiate" ? "Renégocier le taux du crédit" : "Rallonger la durée du crédit"}
                </p>
                <p className="mt-1 text-sm text-slate-600">{loanScenario.propertyLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setLoanScenario(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                aria-label="Fermer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Situation actuelle</p>
                <p className="mt-1 text-sm text-slate-900">Taux {loanScenario.currentRate.toLocaleString("fr-FR")} %</p>
                <p className="text-sm text-slate-900">
                  Mensualité {money(loanScenario.currentMonthlyPI + loanScenario.currentInsurance)}
                  {loanScenario.currentInsurance > 0 ? ` (${money(loanScenario.currentMonthlyPI)} + ${money(loanScenario.currentInsurance)} assurance)` : ""}
                </p>
                <p className="text-sm text-slate-900">
                  {loanScenario.currentRemainingMonths} mois restants (~{Math.round(loanScenario.currentRemainingMonths / 12)} ans)
                </p>
                <p className="mt-1 text-xs text-slate-500">Capital restant dû estimé : {money(loanScenario.principalRemaining)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  {loanScenario.kind === "renegotiate" ? "Après renégociation" : "Après allongement"}
                </p>
                <p className="mt-1 text-sm text-slate-900">Taux {loanScenario.newRate.toLocaleString("fr-FR")} %</p>
                <p className="text-sm text-slate-900">Mensualité {money(loanScenario.newMonthlyPI + loanScenario.currentInsurance)}</p>
                <p className="text-sm text-slate-900">
                  {loanScenario.newRemainingMonths} mois (~{Math.round(loanScenario.newRemainingMonths / 12)} ans)
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">Gain : {money(loanScenario.monthlyGain)}/mois</p>
              </div>
            </div>

            <div className={cx("mt-3 rounded-2xl border p-3", loanScenario.totalInterestDelta > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50")}>
              <p className={cx("text-sm font-semibold", loanScenario.totalInterestDelta > 0 ? "text-amber-800" : "text-emerald-800")}>
                {loanScenario.totalInterestDelta > 0
                  ? `Coût total : ${money(loanScenario.totalInterestDelta)} d’intérêts en plus sur la durée restante.`
                  : `Économie totale : ${money(Math.abs(loanScenario.totalInterestDelta))} d’intérêts sur la durée restante.`}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Intérêts restant à payer : {money(loanScenario.totalInterestOld)} aujourd’hui → {money(loanScenario.totalInterestNew)} avec ce scénario.
              </p>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Estimation basée sur le capital restant dû recalculé à partir de votre mensualité, taux et durée restante actuels (hors frais de dossier et éventuelles indemnités de remboursement anticipé). Si votre crédit est suivi via une écriture récurrente unique plutôt que via les champs dédiés de Finance, l’assurance emprunteur peut être incluse dans ce calcul plutôt qu’isolée. À affiner avec votre banque ou un courtier avant toute décision.
            </p>
          </div>
        </div>
      ) : null}

      {/* Period picker modal */}
      {periodPickerOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-sm sm:items-center">
          <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={() => setPeriodPickerOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Choisir une période</p>
                <p className="mt-1 text-sm text-slate-600">Sélectionnez un mois de début et un mois de fin.</p>
              </div>
              <button
                type="button"
                onClick={() => setPeriodPickerOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                aria-label="Fermer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Début</label>
                <input
                  type="month"
                  value={customStartMonth}
                  onChange={(e) => setCustomStartMonth(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Fin</label>
                <input
                  type="month"
                  value={customEndMonth}
                  onChange={(e) => setCustomEndMonth(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Période sélectionnée : <span className="font-semibold text-slate-900">{fmtPeriodFR("custom", currentMonth, customStartMonth || undefined, customEndMonth || undefined)}</span>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPeriodPickerOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!customStartMonth || !customEndMonth}
                onClick={() => { setPeriodMode("custom"); setPeriodPickerOpen(false); }}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Chart drill-down modal */}
      {chartDrillKey && (() => {
        const drillSeries = series.find((s) => s.key === chartDrillKey);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setChartDrillKey(null)}
          >
            <div
              className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Détail mensuel</p>
                  <h3 className="capitalize text-lg font-bold text-slate-900">
                    {drillSeries?.label ?? chartDrillKey}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setChartDrillKey(null)}
                  className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {chartDrillRows.length === 0 && chartDrillStructuralRows.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-500">Aucune écriture sur ce mois.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                        <th className="px-4 pb-2 pt-3 font-semibold">Date</th>
                        <th className="px-3 pb-2 pt-3 font-semibold">Libellé</th>
                        <th className="px-4 pb-2 pt-3 text-right font-semibold">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartDrillRows.map((r) => {
                        const propLabel = r.property_id ? (propsById.get(r.property_id)?.label || null) : null;
                        return (
                          <tr key={r.id} className="border-b border-slate-100 last:border-0">
                            <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{fmtDateFR(r.occurred_at)}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-slate-900">{r.label || CATEGORY_LABELS[r.category] || r.category}</p>
                              {propLabel && <p className="text-xs text-indigo-500">{propLabel}</p>}
                            </td>
                            <td className={cx("whitespace-nowrap px-4 py-2.5 text-right font-semibold", r.direction === "out" ? "text-rose-600" : "text-emerald-600")}>
                              {r.direction === "out" ? "−" : "+"}{formatEuro(Number(r.amount || 0))}
                            </td>
                          </tr>
                        );
                      })}
                      {chartDrillStructuralRows.length > 0 && (
                        <>
                          <tr>
                            <td colSpan={3} className="bg-amber-50 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-widest text-amber-700">
                              Charges structurelles (au prorata mois)
                            </td>
                          </tr>
                          {chartDrillStructuralRows.map((r) => {
                            const propLabel = propsById.get(r.property_id)?.label || null;
                            return (
                              <tr key={r.id} className="border-b border-amber-100 bg-amber-50/50 last:border-0">
                                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-400">—</td>
                                <td className="px-3 py-2">
                                  <p className="font-medium text-slate-700">{r.label}</p>
                                  <p className="text-xs text-slate-400">
                                    {CATEGORY_LABELS[r.category] || r.category}{propLabel ? <> · <span className="text-indigo-500">{propLabel}</span></> : null}
                                  </p>
                                </td>
                                <td className="whitespace-nowrap px-4 py-2 text-right font-semibold text-amber-700">
                                  −{formatEuro(r.amount)}
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              {drillSeries && (
                <div className="flex flex-wrap gap-3 border-t border-slate-100 px-5 py-3 text-xs">
                  <span className="font-semibold text-emerald-700">Revenus {money(drillSeries.income)}</span>
                  <span className="font-semibold text-rose-600">Dépenses {money(drillSeries.expense + drillSeries.recurring)}</span>
                  <span className={cx("ml-auto font-bold", drillSeries.net >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    Net {money(drillSeries.net)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
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
