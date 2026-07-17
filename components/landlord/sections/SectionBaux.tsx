// components/landlord/sections/SectionBaux.tsx
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownTrayIcon,
  ArrowUpRightIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  HandRaisedIcon,
  PencilSquareIcon,
  PlusIcon,
  PowerIcon,
  ShieldCheckIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle, WorkflowIntro } from "../UiBits";
import { ExpandableSection } from "../ui/ExpandableSection";
import { ExpandableRow } from "../ui/ExpandableRow";
import { badge, cx, pluralFR } from "../ui/uiHelpers";
import { usePermissions } from "../../PermissionProvider";
import { LeaseContractWizard } from "../LeaseContractWizard";
import { IrlRevisionPanel } from "./SectionRevision";
import type { RentPayment, RentReceipt } from "../../../lib/landlord/types";
import { includeSelected, isActivePropertyLike, isActiveTenantLike } from "../../../lib/landlord/archiveFilters";

/* ======================================================
   TYPES
====================================================== */

export type Lease = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  rent_amount: number | null;
  charges_amount: number | null;
  deposit_amount: number | null;
  deposit_paid_at?: string | null;
  deposit_paid_amount?: number | null;
  deposit_returned_at?: string | null;
  deposit_returned_amount?: number | null;
  deposit_retained_amount?: number | null;
  deposit_retained_reason?: string | null;
  deposit_collection_tx_id?: string | null;
  deposit_return_tx_id?: string | null;
  deposit_retain_tx_id?: string | null;
  payment_day: number | null;
  payment_method: string | null;
  lease_kind?: LeaseKind | string | null;
  auto_renewal_enabled?: boolean | null;

  payment_type?: string | null; // "terme_a_echoir" | "terme_echu"

  status: string | null;
  auto_reminder_enabled: boolean | null;
  auto_quittance_enabled: boolean | null;
  receipts_disabled?: boolean | null;
  reminder_day_of_month: number | null;
  reminder_email: string | null;
  tenant_receipt_email: string | null;
  timezone: string | null;
  tracking_from_date?: string | null;
  created_at?: string;
  updated_at?: string;
  irl_sent_at?: string | null;
  irl_sent_ref_quarter?: string | null;
  irl_sent_new_quarter?: string | null;
  irl_sent_new_rent?: number | null;
  irl_apply_on?: string | null;
  irl_applied_at?: string | null;
  irl_previous_rent?: number | null;
};

export type PropertyLite = {
  id: string;
  label: string | null;
  city?: string | null;
  status?: string | null;
  delegated_services?: string[];
  delegation_agency_name?: string | null;
};

export type TenantLite = {
  id: string;
  full_name: string | null;
  email: string | null;
  status?: string | null;
  archived_at?: string | null;
};

type Props = {
  userId: string;
  userEmail?: string | null;
  leases?: Lease[];
  properties?: PropertyLite[];
  tenants?: TenantLite[];
  payments?: RentPayment[];
  receipts?: RentReceipt[];
  onRefresh: () => Promise<void>;
  onPrepareDeparture?: (tenantId: string) => void;
  deepLink?: { key: number; leaseId?: string; openPanel?: "irl" | "deposit"; depositAction?: "collect" | "return"; openCreate?: boolean; prefillTenantId?: string; prefillPropertyId?: string } | null;
};

/* ======================================================
   HELPERS
====================================================== */

const CREATE_ID = "__create__";
type LeaseKind = "furnished_primary" | "furnished_student" | "mobility" | "empty_primary" | "other";

const LEASE_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  ended: "Terminé",
  draft: "Brouillon",
  archived: "Archivé",
  pending: "En attente",
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const isNew = (createdAt?: string | null) =>
  !!createdAt && Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;

const clampInt = (v: string, min: number, max: number, fallback: number) => {
  const n = parseInt(v || "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const toNumberOrNull = (v: string) => {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const formatEuro = (val: number | null | undefined) => {
  if (val == null || Number.isNaN(val as any)) return "—";
  return Number(val).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const withTimeout = async <T,>(p: Promise<T>, ms = 4000): Promise<T> => {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout réseau (${ms}ms)`)), ms)),
  ]);
};

const stop = (e: React.SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

function paymentTypeLabel(v?: string | null) {
  return (v || "").toLowerCase() === "terme_echu" ? "Fin de période (terme échu)" : "Début de période (terme à échoir)";
}
function paymentTypeShort(v?: string | null) {
  return (v || "").toLowerCase() === "terme_echu" ? "échu" : "à échoir";
}

function isEmailLike(v?: string | null) {
  const s = String(v || "").trim();
  return !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function daysUntil(d: Date, now = parisNow()) {
  const ms = d.getTime() - now.getTime();
  return Math.ceil(ms / (24 * 3600 * 1000));
}

function relativeDateLabel(d: Date) {
  const n = daysUntil(d);
  if (n === 0) return "aujourd’hui";
  if (n === 1) return "demain";
  if (n > 1) return `dans ${n} jours`;
  if (n === -1) return "hier";
  return `il y a ${Math.abs(n)} jours`;
}

function emailOrDash(v?: string | null) {
  return String(v || "").trim() || "—";
}

function getTenantEmail(tenant?: TenantLite | null) {
  return String(tenant?.email || "").trim();
}

const leaseKindOptions: Array<{
  value: LeaseKind;
  label: string;
  short: string;
  durationMonths: number | null;
  tacitRenewal: boolean;
  renewalLabel: string;
  note: string;
}> = [
  {
    value: "furnished_primary",
    label: "Meublé résidence principale",
    short: "Meublé 1 an",
    durationMonths: 12,
    tacitRenewal: true,
    renewalLabel: "Reconduction tacite annuelle",
    note: "Cas LMNP classique : bail d’un an, reconduit si aucun congé n’est donné.",
  },
  {
    value: "furnished_student",
    label: "Meublé étudiant 9 mois",
    short: "Étudiant 9 mois",
    durationMonths: 9,
    tacitRenewal: false,
    renewalLabel: "Fin au terme",
    note: "Pas de tacite reconduction : si l’étudiant reste, il faut signer un nouveau bail.",
  },
  {
    value: "mobility",
    label: "Bail mobilité",
    short: "Mobilité",
    durationMonths: null,
    tacitRenewal: false,
    renewalLabel: "Non renouvelable",
    note: "Durée de 1 à 10 mois : pas de renouvellement ni reconduction.",
  },
  {
    value: "empty_primary",
    label: "Nu résidence principale",
    short: "Nu 3 ans",
    durationMonths: 36,
    tacitRenewal: true,
    renewalLabel: "Reconduction tacite",
    note: "Bail nu classique : durée minimale de 3 ans pour un bailleur particulier.",
  },
  {
    value: "other",
    label: "Autre / suivi libre",
    short: "Libre",
    durationMonths: null,
    tacitRenewal: false,
    renewalLabel: "À définir",
    note: "Lokt.fr ne déduit pas automatiquement la règle juridique.",
  },
];

function getLeaseKindRule(kind?: string | null) {
  return leaseKindOptions.find((x) => x.value === kind) || leaseKindOptions[0];
}

function addMonthsLocal(d: Date, months: number) {
  const next = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  if (next.getDate() !== d.getDate()) return new Date(next.getFullYear(), next.getMonth(), 0);
  return next;
}

function dateMinusOneDay(d: Date) {
  const next = new Date(d);
  next.setDate(next.getDate() - 1);
  return next;
}

function parseISODateLocal(v?: string | null) {
  if (!v) return null;
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function dateToISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function expectedEndDate(startDate?: string | null, kind?: string | null) {
  const start = parseISODateLocal(startDate);
  const rule = getLeaseKindRule(kind);
  if (!start || !rule.durationMonths) return "";
  return dateToISO(dateMinusOneDay(addMonthsLocal(start, rule.durationMonths)));
}

function leaseRenewalInfo(lease: Partial<Lease>, now = parisNow()) {
  const rule = getLeaseKindRule(lease.lease_kind);
  const start = parseISODateLocal(lease.start_date);
  const contractualEnd = parseISODateLocal(lease.end_date) || parseISODateLocal(expectedEndDate(lease.start_date, rule.value));
  const renewalEnabled = rule.tacitRenewal && lease.auto_renewal_enabled !== false;

  if (!start || !contractualEnd) {
    return {
      rule,
      renewalEnabled,
      title: rule.short,
      status: "Date de fin à compléter",
      detail: rule.note,
      tone: "amber" as const,
      currentEnd: null as Date | null,
      nextAction: "Complète la date de début et la date de fin contractuelle.",
    };
  }

  if (!renewalEnabled) {
    const days = daysUntil(contractualEnd, now);
    const isPast = days < 0;
    return {
      rule,
      renewalEnabled,
      title: rule.short,
      status: isPast ? "Bail arrivé à terme" : `Fin prévue ${fmtFR(contractualEnd)}`,
      detail: rule.renewalLabel,
      tone: isPast ? ("red" as const) : days <= 60 ? ("amber" as const) : ("slate" as const),
      currentEnd: contractualEnd,
      nextAction: isPast ? "Clôture le bail ou signe un nouveau bail si le locataire reste." : "Prépare la sortie ou le nouveau bail avant l’échéance.",
    };
  }

  const durationMonths = rule.durationMonths || 12;
  let cycleStart = new Date(start);
  let cycleEnd = new Date(contractualEnd);
  let renewalCount = 0;

  while (cycleEnd.getTime() < now.getTime() && renewalCount < 30) {
    cycleStart = new Date(cycleEnd);
    cycleStart.setDate(cycleStart.getDate() + 1);
    cycleEnd = dateMinusOneDay(addMonthsLocal(cycleStart, durationMonths));
    renewalCount += 1;
  }

  const days = daysUntil(cycleEnd, now);
  return {
    rule,
    renewalEnabled,
    title: rule.short,
    status: renewalCount > 0 ? `Reconduit jusqu’au ${fmtFR(cycleEnd)}` : `Fin de période ${fmtFR(cycleEnd)}`,
    detail: renewalCount > 0 ? `${renewalCount} reconduction${renewalCount > 1 ? "s" : ""} suivie${renewalCount > 1 ? "s" : ""}` : rule.renewalLabel,
    tone: days <= 60 ? ("amber" as const) : ("emerald" as const),
    currentEnd: cycleEnd,
    nextAction:
      days <= 60
        ? "Décide si tu laisses reconduire, si tu proposes un avenant ou si tu prépares un congé conforme."
        : "Aucune action immédiate : le bail reste suivi comme reconduit tacitement.",
  };
}

const isActiveLease = (l: Lease) => (l.status || "").toLowerCase() === "active";
const isDraftLease = (l: Lease) => (l.status || "").toLowerCase() === "draft";
const isEndedLease = (l: Lease) => (l.status || "").toLowerCase() === "ended";

const statusTone = (s?: string | null) => {
  const v = (s || "").toLowerCase();
  if (v === "active") return "emerald" as const;
  if (v === "ended") return "amber" as const;
  if (v === "draft") return "slate" as const;
  return "slate" as const;
};

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

function ActionButton({
  children,
  icon: Icon,
  tone = "secondary",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  icon: IconComponent;
  tone?: "primary" | "secondary" | "success" | "warning" | "danger";
  disabled?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const cls =
    tone === "primary"
      ? "border-slate-900 bg-slate-900 text-white shadow-sm hover:bg-slate-800"
      : tone === "success"
      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
      : tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
      : tone === "danger"
      ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1",
        cls,
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}

function StarterUpgradeLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/mon-compte/abonnement?source=quittance-auto"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800",
        className
      )}
    >
      Upgrade vers lokt·one
      <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function InfoPill({ tone, children }: { tone: "slate" | "sky" | "emerald" | "amber" | "red"; children: React.ReactNode }) {
  const cls =
    tone === "sky"
      ? "border-sky-200 bg-sky-50 text-sky-900"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return <span className={cx("inline-flex items-center rounded-md border px-2 py-1 text-[0.68rem] font-medium", cls)}>{children}</span>;
}

function WorkflowChoice({
  title,
  description,
  icon: Icon,
  selected,
  tone,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  icon: IconComponent;
  selected: boolean;
  tone: "emerald" | "amber" | "slate";
  disabled?: boolean;
  onClick: () => void;
}) {
  const selectedCls =
    tone === "emerald"
      ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100"
      : tone === "amber"
      ? "border-amber-400 bg-amber-50 ring-2 ring-amber-100"
      : "border-slate-400 bg-slate-100 ring-2 ring-slate-200";

  const iconCls = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-slate-700";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        "group relative min-h-[118px] rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1",
        selected ? selectedCls : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
        disabled && "cursor-not-allowed opacity-55 hover:border-slate-200 hover:bg-white"
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cx("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white", selected ? iconCls : "text-slate-500")}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-950">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span>
        </span>
      </div>
      {selected ? (
        <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white">
          <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
    </button>
  );
}

function workflowNoticeClass(tone: string) {
  if (tone === "red") return "border-red-200 bg-red-50 text-red-900";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

/* ======================================================
   QUITTANCES: TIMELINE HELPERS
====================================================== */

// ⚠️ Note: parsing via locale string peut être fragile, mais suffisant pour V1
const parisNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));

const fmtFR = (d: Date) =>
  d.toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "2-digit", timeZone: "Europe/Paris" });

const fmtDateShortFR = (iso?: string | null) => {
  if (!iso) return null;
  const d = parseISODateLocal(iso);
  if (!d) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
};

type LeaseHistoryEvent = {
  id: string;
  date: Date;
  tone: "emerald" | "amber" | "red" | "sky" | "slate";
  title: string;
  detail: string;
};

function csvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function slugPart(value: unknown) {
  return String(value || "bail")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "bail";
}

function exportLeaseHistoryCsv(params: {
  lease: Lease;
  property?: PropertyLite | null;
  tenant?: TenantLite | null;
  history: LeaseHistoryEvent[];
}) {
  const { lease, property, tenant, history } = params;
  const headers = ["Date", "Date ISO", "Type", "Détail", "Statut", "Bien", "Ville", "Locataire", "Email locataire", "Bail ID"];
  const rows = history.map((event) => [
    fmtFR(event.date),
    event.date.toISOString().slice(0, 10),
    event.title,
    event.detail,
    event.tone,
    property?.label || "",
    property?.city || "",
    tenant?.full_name || "",
    tenant?.email || "",
    lease.id,
  ]);
  const csv = ["sep=;", headers.map(csvCell).join(";"), ...rows.map((row) => row.map(csvCell).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historique-bail-${slugPart(property?.label || tenant?.full_name || lease.id)}-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function amountLabel(value?: number | null) {
  return value == null ? "" : ` • ${formatEuro(value)}`;
}

function buildLeaseHistory(lease: Lease, payments: RentPayment[], receipts: RentReceipt[], now = parisNow()) {
  const events: LeaseHistoryEvent[] = [];
  const createdAt = parseISODateLocal(lease.created_at);
  const startAt = parseISODateLocal(lease.start_date);
  const endAt = parseISODateLocal(lease.end_date);

  if (createdAt) {
    events.push({
      id: `${lease.id}:created`,
      date: createdAt,
      tone: "sky",
      title: "Bail enregistré",
      detail: "La fiche bail a été créée dans lokt.fr.",
    });
  }
  if (startAt) {
    events.push({
      id: `${lease.id}:start`,
      date: startAt,
      tone: "emerald",
      title: "Début de bail",
      detail: "Entrée du locataire et démarrage du suivi locatif.",
    });
  }
  if (endAt) {
    const ended = isEndedLease(lease) || endAt.getTime() <= now.getTime();
    events.push({
      id: `${lease.id}:end`,
      date: endAt,
      tone: ended ? "amber" : "slate",
      title: ended ? "Fin de bail" : "Fin de bail prévue",
      detail: ended ? "Le bail est clôturé ou arrivé à son terme." : "Échéance à anticiper pour préparer la sortie ou le renouvellement.",
    });
  }

  const depositPaidAt = parseISODateLocal(lease.deposit_paid_at);
  const depositReturnedAt = parseISODateLocal(lease.deposit_returned_at);
  if (depositPaidAt) {
    events.push({
      id: `${lease.id}:deposit:collected`,
      date: depositPaidAt,
      tone: "emerald",
      title: "Caution encaissée",
      detail: `${formatEuro(lease.deposit_paid_amount ?? lease.deposit_amount)} encaissés.`,
    });
  }
  if (depositReturnedAt) {
    const retAmt = Number(lease.deposit_returned_amount ?? 0);
    const retainAmt = Number(lease.deposit_retained_amount ?? 0);
    if (retAmt > 0) {
      events.push({
        id: `${lease.id}:deposit:returned`,
        date: depositReturnedAt,
        tone: "emerald",
        title: "Caution restituée",
        detail: `${formatEuro(retAmt)} restitués au locataire.`,
      });
    }
    if (retainAmt > 0) {
      const reason = String(lease.deposit_retained_reason || "");
      events.push({
        id: `${lease.id}:deposit:retained`,
        date: depositReturnedAt,
        tone: "amber",
        title: "Retenue sur caution",
        detail: `${formatEuro(retainAmt)} retenus${reason ? ` — ${reason}` : ""}.`,
      });
    }
  }

  const irlSentAt = parseISODateLocal(lease.irl_sent_at);
  if (irlSentAt) {
    const refQ = lease.irl_sent_ref_quarter || "";
    const newQ = lease.irl_sent_new_quarter || "";
    const newRent = lease.irl_sent_new_rent;
    events.push({
      id: `${lease.id}:irl:sent`,
      date: irlSentAt,
      tone: "sky",
      title: "Courrier de révision IRL envoyé",
      detail: `Révision ${refQ} → ${newQ}${newRent ? ` · Nouveau loyer : ${formatEuro(newRent)}` : ""}`,
    });
  }
  const irlAppliedAt = parseISODateLocal(lease.irl_applied_at);
  if (irlAppliedAt) {
    const prev = lease.irl_previous_rent;
    const next = Number(lease.rent_amount || 0);
    events.push({
      id: `${lease.id}:irl:applied`,
      date: irlAppliedAt,
      tone: "emerald",
      title: "Loyer révisé (IRL)",
      detail: `${prev ? formatEuro(prev) + " → " : ""}${formatEuro(next)} HC/mois`,
    });
  }

  for (const payment of payments.filter((payment) => payment.lease_id === lease.id)) {
    const due = parseISODateLocal(payment.due_date || payment.period_end);
    const paid = parseISODateLocal(payment.paid_at);
    const period = [payment.period_start, payment.period_end].filter(Boolean).join(" → ");
    if (paid) {
      const dueEnd = due ? new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59) : null;
      const late = !!dueEnd && paid.getTime() > dueEnd.getTime();
      events.push({
        id: `${payment.id}:paid`,
        date: paid,
        tone: late ? "amber" : "emerald",
        title: late ? "Paiement en retard" : "Paiement à l’heure",
        detail: `${period || "Période inconnue"}${amountLabel(payment.total_amount)}${due ? ` • Échéance ${fmtFR(due)}` : ""}`,
      });
    } else if (due) {
      const late = due.getTime() < now.getTime();
      events.push({
        id: `${payment.id}:due`,
        date: due,
        tone: late ? "red" : "slate",
        title: late ? "Paiement à relancer" : "Paiement attendu",
        detail: `${period || "Période inconnue"}${amountLabel(payment.total_amount)}`,
      });
    }
  }

  for (const receipt of receipts.filter((receipt) => receipt.lease_id === lease.id)) {
    const issued = parseISODateLocal(receipt.issued_at || receipt.issue_date || receipt.created_at);
    const sent = parseISODateLocal(receipt.sent_at);
    const period = [receipt.period_start, receipt.period_end].filter(Boolean).join(" → ");
    if (issued) {
      events.push({
        id: `${receipt.id}:issued`,
        date: issued,
        tone: receipt.pdf_url ? "emerald" : "slate",
        title: receipt.pdf_url ? "Quittance générée" : "Quittance préparée",
        detail: `${period || "Période inconnue"}${amountLabel(receipt.total_amount)}`,
      });
    }
    if (sent) {
      events.push({
        id: `${receipt.id}:sent`,
        date: sent,
        tone: "emerald",
        title: "Quittance envoyée",
        detail: receipt.sent_to_tenant_email ? `Envoyée à ${receipt.sent_to_tenant_email}` : "Envoi au locataire enregistré.",
      });
    }
  }

  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/* ======================================================
   COMPONENT
====================================================== */

type Mode = "idle" | "create" | "edit";

export function SectionBaux({ userId, userEmail, leases, properties, tenants, payments, receipts, onRefresh, onPrepareDeparture, deepLink }: Props) {
  const { canUseLandlord } = usePermissions();
  const canUseReceiptAutomation = canUseLandlord;
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeProps = Array.isArray(properties) ? properties : [];
  const safeTenants = Array.isArray(tenants) ? tenants : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeReceipts = Array.isArray(receipts) ? receipts : [];

  const propertyById = useMemo(() => {
    const m = new Map<string, PropertyLite>();
    for (const p of safeProps) m.set(p.id, p);
    return m;
  }, [safeProps]);

  const tenantById = useMemo(() => {
    const m = new Map<string, TenantLite>();
    for (const t of safeTenants) m.set(t.id, t);
    return m;
  }, [safeTenants]);

  const activeProps = useMemo(() => safeProps.filter(isActivePropertyLike), [safeProps]);
  const activeTenants = useMemo(() => safeTenants.filter(isActiveTenantLike), [safeTenants]);

  const defaultFormValues = () => ({
    property_id: "",
    tenant_id: "",
    start_date: todayISO(),
    end_date: "",
    rent_amount: "",
    charges_amount: "",
    deposit_amount: "",
    lease_kind: "furnished_primary" as LeaseKind,
    auto_renewal_enabled: true,
    payment_day: "1",
    payment_method: "virement",
    payment_type: "terme_a_echoir",
    status: "active",
    auto_quittance_enabled: canUseReceiptAutomation,
    auto_reminder_enabled: canUseReceiptAutomation,
    receipts_disabled: false,
    reminder_day_of_month: "1",
    reminder_email: userEmail || "",
    tenant_receipt_email: "",
    timezone: "Europe/Paris",
    tracking_from: "now" as "now" | "start",
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [highlightCreate, setHighlightCreate] = useState(false);
  const [highlightDepositLeaseId, setHighlightDepositLeaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!deepLink?.leaseId) return;
    setExpandedId(deepLink.leaseId);
    if (deepLink.openPanel === "deposit") {
      const leaseId = deepLink.leaseId;
      const lease = leases?.find((l) => l.id === leaseId);
      if (lease) {
        setTimeout(() => {
          openDepositForm(leaseId, deepLink.depositAction ?? "return", lease);
          document.getElementById(`deposit-${leaseId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightDepositLeaseId(leaseId);
          setTimeout(() => setHighlightDepositLeaseId(null), 2500);
        }, 180);
      }
    } else {
      setTimeout(() => {
        document.getElementById(`lease-${deepLink.leaseId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [deepLink]);

  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [contractLeaseId, setContractLeaseId] = useState<string | null>(null);
  const [historyOpenByLease, setHistoryOpenByLease] = useState<Record<string, boolean>>({});
  const [renewalOpenByLease, setRenewalOpenByLease] = useState<Record<string, boolean>>({});
  const [quittanceOpenByLease, setQuittanceOpenByLease] = useState<Record<string, boolean>>({});
  const [confirmDeleteLeaseId, setConfirmDeleteLeaseId] = useState<string | null>(null);
  const [confirmCancelDepositByLease, setConfirmCancelDepositByLease] = useState<Record<string, "cancel_collect" | "cancel_return" | null>>({});

  // Deposit state
  type DepositAction = "collect" | "return" | null;
  type DepositForm = { paid_at: string; paid_amount: string; returned_at: string; returned_amount: string; retained_amount: string; retained_reason: string };
  type ImputedMonthRow = { yyyymm: string; period_start: string; period_end: string; label: string; missing_amount: number; checked: boolean; amount: string };
  type DamageItem = { id: string; label: string; amount: string };
  const [depositActionByLease, setDepositActionByLease] = useState<Record<string, DepositAction>>({});
  const [depositFormByLease, setDepositFormByLease] = useState<Record<string, DepositForm>>({});
  const [depositLoadingByLease, setDepositLoadingByLease] = useState<Record<string, boolean>>({});
  const [depositErrByLease, setDepositErrByLease] = useState<Record<string, string | null>>({});
  const [imputedMonthsByLease, setImputedMonthsByLease] = useState<Record<string, ImputedMonthRow[]>>({});
  const [damageItemsByLease, setDamageItemsByLease] = useState<Record<string, DamageItem[]>>({});
  const [unpaidLoadingByLease, setUnpaidLoadingByLease] = useState<Record<string, boolean>>({});
  const [unpaidAfterReturnByLease, setUnpaidAfterReturnByLease] = useState<Record<string, any[] | null>>({});

  const openDepositForm = async (leaseId: string, action: DepositAction, lease: Lease) => {
    const today = todayISO();
    setDepositActionByLease((p) => ({ ...p, [leaseId]: action }));
    setDepositErrByLease((p) => ({ ...p, [leaseId]: null }));
    setDepositFormByLease((p) => ({
      ...p,
      [leaseId]: {
        paid_at: action === "collect" ? today : (lease.deposit_paid_at || today),
        paid_amount: action === "collect" ? String(lease.deposit_amount ?? "") : String(lease.deposit_paid_amount ?? lease.deposit_amount ?? ""),
        returned_at: today,
        returned_amount: "",
        retained_amount: "",
        retained_reason: "",
      },
    }));

    if (action === "return") {
      setImputedMonthsByLease((p) => ({ ...p, [leaseId]: [] }));
      setDamageItemsByLease((p) => ({ ...p, [leaseId]: [] }));
      setUnpaidLoadingByLease((p) => ({ ...p, [leaseId]: true }));
      try {
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(`/api/deposits/unpaid-summary?userId=${encodeURIComponent(userId)}&leaseId=${encodeURIComponent(leaseId)}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        });
        const json = await resp.json().catch(() => ({}));
        const months: any[] = json.months || [];
        setImputedMonthsByLease((p) => ({
          ...p,
          [leaseId]: months.map((m: any) => ({
            yyyymm: m.yyyymm,
            period_start: m.period_start,
            period_end: m.period_end,
            label: m.label,
            missing_amount: Number(m.missing_amount || 0),
            checked: true,
            amount: String(Math.round(Number(m.missing_amount || 0) * 100) / 100),
          })),
        }));
      } catch {
        // ignore — user can still enter amounts manually
      } finally {
        setUnpaidLoadingByLease((p) => ({ ...p, [leaseId]: false }));
      }
    }
  };

  const closeDepositForm = (leaseId: string) =>
    setDepositActionByLease((p) => ({ ...p, [leaseId]: null }));

  const submitDepositAction = async (leaseId: string, action: "collect" | "return") => {
    const form = depositFormByLease[leaseId];
    if (!form || !supabase) return;
    setDepositLoadingByLease((p) => ({ ...p, [leaseId]: true }));
    setDepositErrByLease((p) => ({ ...p, [leaseId]: null }));
    try {
      const { data: { session } } = await supabase.auth.getSession();

      let body: Record<string, any> = { action, userId, leaseId, ...form };

      if (action === "return") {
        const imputed = (imputedMonthsByLease[leaseId] || [])
          .filter((m) => m.checked && Number(m.amount) > 0)
          .map((m) => ({ period_start: m.period_start, period_end: m.period_end, amount: Math.round(Number(m.amount) * 100) / 100 }));

        const damages = (damageItemsByLease[leaseId] || [])
          .filter((d) => d.label.trim() && Number(d.amount) > 0)
          .map((d) => ({ label: d.label.trim(), amount: Math.round(Number(d.amount) * 100) / 100 }));

        const totalRetained = [...imputed, ...damages].reduce((s, i) => s + i.amount, 0);
        const paidAmount = Number(form.paid_amount || 0);
        const totalReturned = Math.max(0, Math.round((paidAmount - totalRetained) * 100) / 100);

        body = { ...body, imputed_months: imputed, damage_items: damages, retained_amount: totalRetained, returned_amount: totalReturned };
      }

      const resp = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Erreur serveur.");
      closeDepositForm(leaseId);
      await onRefresh();
    } catch (e: any) {
      setDepositErrByLease((p) => ({ ...p, [leaseId]: e?.message || "Erreur." }));
    } finally {
      setDepositLoadingByLease((p) => ({ ...p, [leaseId]: false }));
    }
  };

  const cancelDepositAction = async (leaseId: string, type: "cancel_collect" | "cancel_return") => {
    if (!supabase) return;
    setDepositLoadingByLease((p) => ({ ...p, [leaseId]: true }));
    setDepositErrByLease((p) => ({ ...p, [leaseId]: null }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: type, userId, leaseId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Erreur serveur.");
      await onRefresh();
    } catch (e: any) {
      setDepositErrByLease((p) => ({ ...p, [leaseId]: e?.message || "Erreur." }));
    } finally {
      setDepositLoadingByLease((p) => ({ ...p, [leaseId]: false }));
    }
  };

  const loadUnpaidAfterReturn = async (leaseId: string) => {
    if (!supabase) return;
    setUnpaidLoadingByLease((p) => ({ ...p, [leaseId]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`/api/deposits/unpaid-summary?userId=${encodeURIComponent(userId)}&leaseId=${encodeURIComponent(leaseId)}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const json = await resp.json().catch(() => ({}));
      setUnpaidAfterReturnByLease((p) => ({ ...p, [leaseId]: json.months || [] }));
    } finally {
      setUnpaidLoadingByLease((p) => ({ ...p, [leaseId]: false }));
    }
  };

  const markMonthCompensated = async (leaseId: string, month: { receipt_id?: string | null; period_start: string; period_end: string; label: string }) => {
    if (!supabase) return;
    setDepositLoadingByLease((p) => ({ ...p, [leaseId]: true }));
    setDepositErrByLease((p) => ({ ...p, [leaseId]: null }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "mark_month_compensated", userId, leaseId, month }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || "Erreur serveur.");
      // Reload unpaid months for this lease
      await loadUnpaidAfterReturn(leaseId);
      await onRefresh();
    } catch (e: any) {
      setDepositErrByLease((p) => ({ ...p, [leaseId]: e?.message || "Erreur." }));
    } finally {
      setDepositLoadingByLease((p) => ({ ...p, [leaseId]: false }));
    }
  };

  // Search
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = safeLeases.filter((l) => {
      if (!query) return true;
      const p = propertyById.get(l.property_id);
      const t = tenantById.get(l.tenant_id);

      const hay = [
        p?.label,
        p?.city,
        t?.full_name,
        t?.email,
        l.start_date,
        l.end_date || "",
        String(l.rent_amount ?? ""),
        String(l.charges_amount ?? ""),
        String(l.payment_day ?? ""),
        String(l.payment_method ?? ""),
        String(l.payment_type ?? ""), // ✅ NEW
        String(l.status ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });

    const actifs = base.filter((l) => isActiveLease(l));
    const archives = base.filter((l) => !isActiveLease(l)); // ended + draft

    // tri simple : récents d’abord
    const sortRecent = (a: Lease, b: Lease) => {
      const da = new Date(a.updated_at || a.created_at || 0).getTime();
      const db = new Date(b.updated_at || b.created_at || 0).getTime();
      return db - da;
    };

    return {
      actifs: actifs.sort(sortRecent),
      archives: archives.sort(sortRecent),
    };
  }, [safeLeases, q, propertyById, tenantById]);

  const getLeasePaymentStatus = (leaseId: string): "paid" | "overdue" | "pending" => {
    const now = parisNow();
    const thisYYYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const leasePayments = safePayments.filter((p) => p.lease_id === leaseId);
    const pastUnpaid = leasePayments.some((p) => {
      const pm = (p.period_start || "").slice(0, 7);
      return pm < thisYYYYMM && !p.paid_at;
    });
    if (pastUnpaid) return "overdue";
    const currentPaid = leasePayments.some((p) => {
      const pm = (p.period_start || "").slice(0, 7);
      return pm === thisYYYYMM && p.paid_at;
    });
    if (currentPaid) return "paid";
    const currentDue = leasePayments.some((p) => {
      const pm = (p.period_start || "").slice(0, 7);
      return pm === thisYYYYMM && !p.paid_at;
    });
    if (currentDue) {
      const due = leasePayments.find((p) => (p.period_start || "").slice(0, 7) === thisYYYYMM && !p.paid_at);
      if (due?.due_date) {
        const dueDate = parseISODateLocal(due.due_date);
        if (dueDate && dueDate < now) return "overdue";
      }
      return "pending";
    }
    return "pending";
  };

  const leaseLine = (l: Lease) => {
    const p = propertyById.get(l.property_id);
    const t = tenantById.get(l.tenant_id);
    const total = Number(l.rent_amount || 0) + Number(l.charges_amount || 0);
    const renewal = leaseRenewalInfo(l);
    const startDateFR = fmtDateShortFR(l.start_date);
    const endDateFR = fmtDateShortFR(l.end_date);

    const delegatedServices: string[] = Array.isArray(p?.delegated_services) ? p!.delegated_services! : [];
    const agencyName = p?.delegation_agency_name || null;
    return {
      propertyLabel: p?.label || "Bien",
      tenantName: t?.full_name || "Locataire",
      tenantEmail: t?.email || null,
      city: p?.city || null,
      total,
      status: LEASE_STATUS_LABELS[(l.status || "").toLowerCase()] || (l.status || "—"),
      startDateFR,
      endDateFR,
      quittance: l.receipts_disabled ? "Agence" : canUseReceiptAutomation && l.auto_quittance_enabled ? "Auto" : "Manuel",
      pay: `J${l.payment_day ?? "—"} • ${l.payment_method || "—"} • ${paymentTypeShort(l.payment_type)}`,
      renewal,
      isBailEdlDelegated: delegatedServices.includes("bail_edl"),
      isGestionDelegated: delegatedServices.includes("gestion_courante"),
      agencyName,
    };
  };

  const workflowInfo = (lease: Partial<Lease>, tenant?: TenantLite | null) => {
    const receiptEmail = String(lease.tenant_receipt_email || "").trim() || getTenantEmail(tenant);
    const ownerEmail = String(lease.reminder_email || "").trim() || String(userEmail || "").trim();
    const auto = canUseReceiptAutomation && !!lease.auto_quittance_enabled;
    const autoConfirm = canUseReceiptAutomation && auto;
    const manualMode = !auto;

    const blockers: string[] = [];
    const warnings: string[] = [];

    if (manualMode) warnings.push("Mode manuel : le paiement, le PDF et l’envoi se traitent depuis l’onglet Quittances.");
    if (auto && !receiptEmail) blockers.push("Email locataire manquant pour envoyer la quittance.");
    if (auto && !ownerEmail) blockers.push("Email bailleur manquant pour confirmer le paiement.");
    if (receiptEmail && !isEmailLike(receiptEmail)) blockers.push("Email locataire invalide.");
    if (ownerEmail && !isEmailLike(ownerEmail)) blockers.push("Email bailleur invalide.");

    const tone = blockers.length ? "red" : manualMode ? "slate" : "emerald";
    const label = blockers.length
      ? "À compléter"
      : manualMode
      ? "Mode manuel"
      : "Workflow prêt";
    const noticeTitle = blockers.length
      ? "Configuration incomplète"
      : manualMode
      ? "Mode manuel sélectionné"
      : "";
    const noticeAdvice = blockers.length
      ? "Complète ces informations avant d’automatiser les quittances."
      : manualMode
      ? "C’est correct en gratuit ou si tu veux garder la main : tu confirmeras le paiement et généreras le PDF dans Quittances."
      : "";

    return {
      receiptEmail,
      ownerEmail,
      auto,
      autoConfirm,
      blockers,
      warnings,
      tone,
      label,
      noticeTitle,
      noticeAdvice,
      modeLabel: !auto ? "Manuel" : "Automatique avec validation paiement",
    };
  };

  const guardReceiptEmailForAutomation = (receiptEmail: string | null | undefined, context = "activer le workflow automatique") => {
    const email = String(receiptEmail || "").trim();
    setOk(null);
    if (!email) {
      setErr(`Impossible de ${context} : renseigne d’abord l’email du locataire destinataire de la quittance.`);
      return false;
    }
    if (!isEmailLike(email)) {
      setErr(`Impossible de ${context} : l’email du locataire est invalide.`);
      return false;
    }
    return true;
  };

  const safeRefresh = async () => {
    try {
      await withTimeout(onRefresh(), 4000);
    } catch (e: any) {
      console.warn("[SectionBaux] refresh skipped:", e?.message || e);
    }
  };

  const isMissingRenewalSchema = (error: any) => {
    const message = String(error?.message || error?.details || error || "").toLowerCase();
    return message.includes("auto_renewal_enabled") || message.includes("lease_kind");
  };

  const withoutRenewalColumns = (payload: Record<string, any>) => {
    const { lease_kind, auto_renewal_enabled, ...rest } = payload;
    return rest;
  };

  const isMissingTrackingSchema = (error: any) => {
    const message = String(error?.message || error?.details || error || "").toLowerCase();
    return message.includes("tracking_from_date");
  };

  const withoutTrackingColumns = (payload: Record<string, any>) => {
    const { tracking_from_date, ...rest } = payload;
    return rest;
  };

  const authJsonHeaders = async () => {
    if (!supabase) throw new Error("Supabase non initialisé.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) throw new Error("Session expirée. Reconnecte-toi.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const readApiResponse = async (resp: Response) => {
    const raw = await resp.text();
    let json: any = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }
    if (!resp.ok) throw new Error(json?.error || raw || `Erreur serveur ${resp.status}.`);
    return json || {};
  };

  /* ======================================================
     FORM (CREATE / EDIT)
  ====================================================== */

  const [form, setForm] = useState({
    property_id: "",
    tenant_id: "",
    start_date: todayISO(),
    end_date: "",
    rent_amount: "",
    charges_amount: "",
    deposit_amount: "",
    lease_kind: "furnished_primary" as LeaseKind,
    auto_renewal_enabled: true,
    payment_day: "1",
    payment_method: "virement",
    payment_type: "terme_a_echoir",
    status: "active",
    auto_quittance_enabled: canUseReceiptAutomation,
    auto_reminder_enabled: canUseReceiptAutomation,
    receipts_disabled: false,
    reminder_day_of_month: "1",
    reminder_email: userEmail || "",
    tenant_receipt_email: "",
    timezone: "Europe/Paris",
    tracking_from: "now" as "now" | "start",
  });

  const selectableProps = useMemo(
    () => includeSelected(activeProps, safeProps, form.property_id),
    [activeProps, safeProps, form.property_id]
  );
  const selectableTenants = useMemo(
    () => includeSelected(activeTenants, safeTenants, form.tenant_id),
    [activeTenants, safeTenants, form.tenant_id]
  );

  const resetForm = () => {
    setForm(defaultFormValues());
  };

  const openCreate = () => {
    setErr(null);
    setOk(null);
    setMode("create");
    setEditingId(null);
    resetForm();
  };

  useEffect(() => {
    if (!deepLink?.openCreate) return;
    setErr(null);
    setOk(null);
    setMode("create");
    setEditingId(null);
    const prefillTenantId = deepLink.prefillTenantId ?? "";
    const prefillPropertyId = deepLink.prefillPropertyId ?? "";
    const prefillProp = prefillPropertyId ? propertyById.get(prefillPropertyId) : null;
    const prefillGestionDelegated = (prefillProp?.delegated_services || []).includes("gestion_courante");
    setForm({
      ...defaultFormValues(),
      property_id: prefillPropertyId,
      tenant_id: prefillTenantId,
      ...(prefillGestionDelegated ? { receipts_disabled: true, auto_quittance_enabled: false, auto_reminder_enabled: false } : {}),
    });
    // Si le locataire vient d'être créé et n'est pas encore dans la liste, on rafraîchit
    if (prefillTenantId && !tenants?.some((t) => t.id === prefillTenantId)) {
      onRefresh();
    }
    setHighlightCreate(true);
    setTimeout(() => {
      document.getElementById("baux-create-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    setTimeout(() => setHighlightCreate(false), 2500);
  }, [deepLink]);

  const openEdit = async (lease: Lease) => {
    setErr(null);
    setOk(null);
    setMode("edit");
    setEditingId(lease.id);

    setForm({
      property_id: lease.property_id || "",
      tenant_id: lease.tenant_id || "",
      start_date: lease.start_date || todayISO(),
      end_date: lease.end_date || "",
      rent_amount: lease.rent_amount != null ? String(lease.rent_amount) : "",
      charges_amount: lease.charges_amount != null ? String(lease.charges_amount) : "",
      deposit_amount: lease.deposit_amount != null ? String(lease.deposit_amount) : "",
      lease_kind: (lease.lease_kind as LeaseKind) || "furnished_primary",
      auto_renewal_enabled: lease.auto_renewal_enabled !== false,
      payment_day: lease.payment_day != null ? String(lease.payment_day) : "1",
      payment_method: lease.payment_method || "virement",
      payment_type: (lease.payment_type as any) || "terme_a_echoir",
      status: lease.status || "active",
      auto_quittance_enabled: canUseReceiptAutomation && !!lease.auto_quittance_enabled,
      auto_reminder_enabled: canUseReceiptAutomation && !!lease.auto_reminder_enabled,
      receipts_disabled: !!lease.receipts_disabled,
      reminder_day_of_month: lease.reminder_day_of_month != null ? String(lease.reminder_day_of_month) : "1",
      reminder_email: lease.reminder_email || "",
      tenant_receipt_email: lease.tenant_receipt_email || "",
      timezone: lease.timezone || "Europe/Paris",
      tracking_from: lease.tracking_from_date ? "now" : "start",
    });
  };

  const cancelEdit = () => {
    setMode("idle");
    setEditingId(null);
    resetForm();
  };

  /* ======================================================
     CRUD
  ====================================================== */

  const patchLease = async (leaseId: string, patch: Partial<Lease>) => {
    if (!userId) throw new Error("userId manquant.");
    if (!supabase) throw new Error("Supabase non initialisé.");

    const payload: any = { ...patch, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("leases").update(payload).eq("id", leaseId).eq("user_id", userId);
    if (!error) return;
    if (isMissingTrackingSchema(error)) {
      const noTracking = withoutTrackingColumns(payload);
      const { error: e2 } = await supabase.from("leases").update(noTracking).eq("id", leaseId).eq("user_id", userId);
      if (!e2) return;
      if (!isMissingRenewalSchema(e2)) throw e2;
      const { error: e3 } = await supabase.from("leases").update(withoutRenewalColumns(noTracking)).eq("id", leaseId).eq("user_id", userId);
      if (e3) throw e3;
      return;
    }
    if (!isMissingRenewalSchema(error)) throw error;

    const { error: fallbackError } = await supabase.from("leases").update(withoutRenewalColumns(payload)).eq("id", leaseId).eq("user_id", userId);
    if (fallbackError) throw fallbackError;
  };

  const quickToggleQuittance = async (lease: Lease) => {
    if (!userId) return;
    const nextEnabled = !lease.auto_quittance_enabled;
    if (nextEnabled && !canUseReceiptAutomation) {
      setErr("Le workflow automatique des quittances est réservé aux abonnements payants. La gestion manuelle reste disponible dans Quittances.");
      setOk(null);
      return;
    }
    if (nextEnabled) {
      const tenant = tenantById.get(lease.tenant_id) || null;
      const receiptEmail = String(lease.tenant_receipt_email || "").trim() || getTenantEmail(tenant);
      if (!guardReceiptEmailForAutomation(receiptEmail)) return;
    }
    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      await patchLease(lease.id, { auto_quittance_enabled: nextEnabled, auto_reminder_enabled: nextEnabled });
      setOk(`Quittance auto ${nextEnabled ? "activée" : "désactivée"} ✅`);
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible de modifier l’option quittance.");
    } finally {
      setLoading(false);
    }
  };

  const saveLease = async () => {
    if (!userId) {
      setErr("userId manquant.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      if (!form.property_id) throw new Error("Veuillez sélectionner un bien.");
      if (!form.tenant_id) throw new Error("Veuillez sélectionner un locataire.");
      if (!form.start_date) throw new Error("La date de début est obligatoire.");
      if (form.end_date && form.end_date < form.start_date) throw new Error("La date de fin doit être postérieure au début du bail.");
      const leaseRule = getLeaseKindRule(form.lease_kind);
      const startDateObj = parseISODateLocal(form.start_date);
      const endDateObj = parseISODateLocal(form.end_date);
      if (form.lease_kind === "mobility") {
        if (!endDateObj || !startDateObj) throw new Error("Le bail mobilité doit avoir une date de fin.");
        const maxEnd = dateMinusOneDay(addMonthsLocal(startDateObj, 10));
        if (endDateObj.getTime() > maxEnd.getTime()) throw new Error("Un bail mobilité ne doit pas dépasser 10 mois.");
      }

      const paymentDayNum = clampInt(form.payment_day, 1, 31, 1);
      const reminderDayNum = clampInt(form.reminder_day_of_month, 1, 31, 1);
      const selectedTenant = tenantById.get(form.tenant_id) || null;
      const receiptEmail = (form.tenant_receipt_email || "").trim() || getTenantEmail(selectedTenant);
      const ownerEmail = (form.reminder_email || "").trim() || String(userEmail || "").trim();
      const wantsAutomation = !!form.auto_quittance_enabled || !!form.auto_reminder_enabled;

      if (wantsAutomation && !canUseReceiptAutomation) {
        throw new Error("Le gratuit inclut les quittances manuelles. Les rappels, emails et générations automatiques nécessitent un abonnement payant.");
      }

      if (form.auto_quittance_enabled && !receiptEmail) {
        throw new Error("Pour activer le workflow automatique, renseigne l’email du locataire destinataire.");
      }
      if (form.auto_quittance_enabled && !isEmailLike(receiptEmail)) {
        throw new Error("Email quittance locataire invalide.");
      }
      if (form.auto_quittance_enabled && !ownerEmail) {
        throw new Error("Pour la validation paiement, renseigne l’email bailleur de notification.");
      }
      if (ownerEmail && !isEmailLike(ownerEmail)) {
        throw new Error("Email bailleur de notification invalide.");
      }

      const rent = toNumberOrNull(form.rent_amount) ?? 0;
      const charges = toNumberOrNull(form.charges_amount) ?? 0;
      const deposit = toNumberOrNull(form.deposit_amount);
      if (rent <= 0) throw new Error("Le loyer doit être supérieur à 0 €.");
      if (charges < 0) throw new Error("Les charges ne peuvent pas être négatives.");

      const startDaysAgo = form.start_date
        ? Math.floor((Date.now() - new Date(form.start_date + "T00:00:00").getTime()) / 86400000)
        : 0;
      const now = new Date();
      const trackingFromDate =
        mode === "create" && startDaysAgo > 30 && form.tracking_from === "now"
          ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
          : null;

      const payload: any = {
        user_id: userId,
        property_id: form.property_id,
        tenant_id: form.tenant_id,
        start_date: form.start_date,
        end_date: form.end_date ? form.end_date : null,
        rent_amount: rent,
        charges_amount: charges,
        deposit_amount: deposit,
        lease_kind: leaseRule.value,
        auto_renewal_enabled: leaseRule.tacitRenewal ? !!form.auto_renewal_enabled : false,
        payment_day: paymentDayNum,
        payment_method: form.payment_method || null,
        payment_type: form.payment_type || null,
        status: form.status || "active",
        auto_quittance_enabled: canUseReceiptAutomation ? !!form.auto_quittance_enabled : false,
        auto_reminder_enabled: canUseReceiptAutomation ? !!form.auto_quittance_enabled : false,
        receipts_disabled: !!form.receipts_disabled,
        reminder_day_of_month: reminderDayNum,
        reminder_email: ownerEmail || null,
        tenant_receipt_email: receiptEmail || null,
        timezone: form.timezone || "Europe/Paris",
        tracking_from_date: trackingFromDate,
        updated_at: new Date().toISOString(),
      };

      let renewalSchemaSkipped = false;

      if (mode === "edit") {
        if (!editingId) throw new Error("Aucun bail en cours d’édition.");
        const { error } = await supabase.from("leases").update(payload).eq("id", editingId).eq("user_id", userId);
        if (error) {
          if (isMissingTrackingSchema(error)) {
            const noTracking = withoutTrackingColumns(payload);
            const { error: e2 } = await supabase.from("leases").update(noTracking).eq("id", editingId).eq("user_id", userId);
            if (e2) {
              if (!isMissingRenewalSchema(e2)) throw e2;
              const { error: e3 } = await supabase.from("leases").update(withoutRenewalColumns(noTracking)).eq("id", editingId).eq("user_id", userId);
              if (e3) throw e3;
              renewalSchemaSkipped = true;
            }
          } else {
            if (!isMissingRenewalSchema(error)) throw error;
            const { error: fallbackError } = await supabase.from("leases").update(withoutRenewalColumns(payload)).eq("id", editingId).eq("user_id", userId);
            if (fallbackError) throw fallbackError;
            renewalSchemaSkipped = true;
          }
        }
        setOk(
          renewalSchemaSkipped
            ? "Bail mis à jour ✅ Applique la migration Supabase pour enregistrer le type de bail et la reconduction tacite."
            : "Bail mis à jour ✅"
        );
        setExpandedId(editingId);
      } else {
        const resp = await fetch("/api/landlord/leases", {
          method: "POST",
          headers: await authJsonHeaders(),
          body: JSON.stringify({ userId, payload }),
        });
        const created = await readApiResponse(resp);
        const leaseId = created?.id;
        renewalSchemaSkipped = !!created?.renewalSchemaSkipped;
        setOk(
          renewalSchemaSkipped
            ? "Bail créé ✅ Applique la migration Supabase pour enregistrer le type de bail et la reconduction tacite."
            : "Bail créé ✅"
        );
        if (leaseId) setExpandedId(leaseId);
      }

      setMode("idle");
      setEditingId(null);
      resetForm();

      await safeRefresh();
    } catch (e: any) {
      console.error("[saveLease] error:", e);
      setErr(e?.message || "Erreur lors de l’enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (leaseId: string) => {
    if (!userId) return;

    const hasPayments = safePayments.some((p) => p.lease_id === leaseId);
    const hasReceipts = safeReceipts.some((r) => r.lease_id === leaseId);
    if (hasPayments || hasReceipts) {
      setErr("Suppression impossible : ce bail a des loyers ou quittances enregistrés. Archivez-le via 'Gérer le départ' pour préserver la comptabilité.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");

      const { error } = await supabase.from("leases").delete().eq("id", leaseId).eq("user_id", userId);
      if (error) throw error;

      setOk("Bail supprimé ✅");

      if (expandedId === leaseId) setExpandedId(null);
      if (editingId === leaseId) cancelEdit();

      await safeRefresh();
    } catch (e: any) {
      console.error("[SectionBaux] delete error:", e);
      setErr(e?.message || "Suppression impossible (quittances/loyers existants ?).");
    } finally {
      setLoading(false);
    }
  };

  /* ======================================================
     UI (DETAILS + FORM)
  ====================================================== */

  const renderLeaseDetails = (l: Lease) => {
    const p = propertyById.get(l.property_id);
    const t = tenantById.get(l.tenant_id);
    const flow = workflowInfo(l, t);
    const renewal = leaseRenewalInfo(l);
    const history = buildLeaseHistory(l, safePayments, safeReceipts);
    const historyOpen = !!historyOpenByLease[l.id];
    const renewalOpen = renewalOpenByLease[l.id] ?? (renewal.tone === "amber" || renewal.tone === "red");
    const quittanceOpen = quittanceOpenByLease[l.id] ?? (flow.blockers.length > 0 || flow.warnings.length > 0);

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  icon={PencilSquareIcon}
                  tone="primary"
                  disabled={loading}
                  onClick={(e) => {
                    stop(e);
                    openEdit(l);
                  }}
                >
                  Modifier
                </ActionButton>

                <ActionButton
                  icon={DocumentTextIcon}
                  disabled={loading}
                  onClick={(e) => {
                    stop(e);
                    setContractLeaseId(l.id);
                  }}
                >
                  Contrat
                </ActionButton>

                {isActiveLease(l) ? (
                  <ActionButton
                    icon={CheckCircleIcon}
                    tone="warning"
                    disabled={loading}
                    onClick={(e) => {
                      stop(e);
                      onPrepareDeparture?.(l.tenant_id);
                    }}
                  >
                    Gérer le départ
                  </ActionButton>
                ) : null}

                {confirmDeleteLeaseId === l.id ? (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5">
                    <span className="text-xs font-medium text-red-700">
                      {isActiveLease(l) ? "Bail actif — supprimer quand même ?" : "Confirmer la suppression ?"}
                    </span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => { stop(e); void onDelete(l.id); setConfirmDeleteLeaseId(null); }}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                    >
                      Supprimer
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { stop(e); setConfirmDeleteLeaseId(null); }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={(e) => { stop(e); setConfirmDeleteLeaseId(l.id); }}
                    className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Supprimer
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Bien</p>
              <span className={cx("h-2 w-2 rounded-full", p?.label ? "bg-emerald-400" : "bg-amber-400")} />
            </div>
            <p className="mt-1 font-semibold text-slate-900 break-words">{p?.label || "—"}</p>
            {p?.city ? <p className="break-words text-xs text-slate-600">{p.city}</p> : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Locataire</p>
              <span className={cx("h-2 w-2 rounded-full", t?.full_name ? "bg-emerald-400" : "bg-amber-400")} />
            </div>
            <p className="mt-1 font-semibold text-slate-900 break-words">{t?.full_name || "—"}</p>
            {t?.email ? <p className="break-words text-xs text-slate-600">{t.email}</p> : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Dates</p>
              <span className={cx("h-2 w-2 rounded-full", l.start_date ? "bg-emerald-400" : "bg-amber-400")} />
            </div>
            <p className="mt-1 text-slate-900">
              <span className="font-semibold">Début</span> {fmtDateShortFR(l.start_date) ?? l.start_date}
            </p>
            <p className="text-slate-700">
              <span className="font-semibold">Fin</span>{" "}
              {fmtDateShortFR(l.end_date) ?? (l.end_date || "—")}
            </p>
            <p className="mt-1 text-xs text-slate-600">{renewal.rule.label}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Paiement</p>
              <span className={cx("h-2 w-2 rounded-full", l.payment_day ? "bg-emerald-400" : "bg-amber-400")} />
            </div>
            <p className="mt-1 text-slate-900">
              Jour <span className="font-semibold">{l.payment_day ?? "—"}</span> • {l.payment_method || "—"}
            </p>
            <p className="text-xs text-slate-600">
              {paymentTypeLabel(l.payment_type)}
            </p>
          </div>

          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Montants</p>
              <span className={cx("h-2 w-2 rounded-full", Number(l.rent_amount || 0) > 0 ? "bg-emerald-400" : "bg-amber-400")} />
            </div>
            <p className="mt-1 text-slate-900">
              <span className="font-semibold">Total</span> :{" "}
              {formatEuro(Number(l.rent_amount || 0) + Number(l.charges_amount || 0))}
            </p>
            <p className="text-xs text-slate-600">
              Loyer {formatEuro(l.rent_amount)} • Charges {formatEuro(l.charges_amount)} • Dépôt {formatEuro(l.deposit_amount)}
            </p>
          </div>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setRenewalOpenByLease((prev) => ({ ...prev, [l.id]: !prev[l.id] }));
            }}
            aria-expanded={renewalOpen}
            className="flex w-full flex-col gap-3 text-left md:flex-row md:items-start md:justify-between"
          >
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Renouvellement du bail</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{renewal.status}</p>
              <p className="mt-1 text-xs text-slate-600">{renewal.rule.note}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {badge(renewal.tone, renewal.detail)}
              <ChevronDownIcon className={cx("h-4 w-4 text-slate-400 transition-transform", renewalOpen && "rotate-180")} aria-hidden="true" />
            </div>
          </button>

          {renewalOpen ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[0.7rem] font-semibold text-slate-500">Nature</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{renewal.rule.short}</p>
                <p className="text-xs text-slate-600">{renewal.rule.renewalLabel}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[0.7rem] font-semibold text-slate-500">Suivi lokt.fr</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {renewal.renewalEnabled ? "Reconduction suivie" : "Fin contractuelle suivie"}
                </p>
                <p className="text-xs text-slate-600">
                  {renewal.currentEnd ? `Échéance courante : ${fmtFR(renewal.currentEnd)}` : "Date à compléter"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[0.7rem] font-semibold text-slate-500">Action recommandée</p>
                <p className="mt-1 text-sm leading-5 text-slate-800">{renewal.nextAction}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setQuittanceOpenByLease((prev) => ({ ...prev, [l.id]: !prev[l.id] }));
            }}
            aria-expanded={quittanceOpen}
            className="flex w-full flex-col gap-3 text-left md:flex-row md:items-start md:justify-between"
          >
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Workflow quittance</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{flow.modeLabel}</p>
              <p className="mt-1 text-xs text-slate-600">
                Destinataire quittance : <span className="font-semibold">{emailOrDash(flow.receiptEmail)}</span>
                {" • "}Validation bailleur : <span className="font-semibold">{emailOrDash(flow.ownerEmail)}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {badge(flow.tone as any, flow.label)}
              <ChevronDownIcon className={cx("h-4 w-4 text-slate-400 transition-transform", quittanceOpen && "rotate-180")} aria-hidden="true" />
            </div>
          </button>

          {quittanceOpen ? (
            <>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                {flow.auto
                  ? "Après confirmation du paiement par le bailleur, la quittance PDF est générée, archivée puis envoyée au locataire."
                  : "Le paiement et la quittance sont traités manuellement depuis l’onglet Quittances."}
              </p>

              {flow.blockers.length || flow.warnings.length ? (
                <div className={cx("mt-3 rounded-xl border px-3 py-2 text-xs", workflowNoticeClass(flow.tone))}>
                  {flow.noticeTitle ? <p className="mb-1 font-semibold">{flow.noticeTitle}</p> : null}
                  {[...flow.blockers, ...flow.warnings].map((m) => (
                    <p key={m}>• {m}</p>
                  ))}
                  {flow.noticeAdvice ? <p className="mt-2 font-medium">{flow.noticeAdvice}</p> : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {/* ===== Dépôt de garantie ===== */}
        {(() => {
          const depositAmount = Number(l.deposit_amount ?? 0);
          if (depositAmount <= 0) return null;
          const depositAction = depositActionByLease[l.id] ?? null;
          const depositForm = depositFormByLease[l.id] ?? { paid_at: "", paid_amount: "", returned_at: "", returned_amount: "", retained_amount: "", retained_reason: "" };
          const depositLoading = !!depositLoadingByLease[l.id];
          const depositErr = depositErrByLease[l.id] ?? null;
          const isPaid = !!l.deposit_paid_at;
          const isReturned = !!l.deposit_returned_at;
          const paidAmt = Number(l.deposit_paid_amount ?? depositAmount);
          const returnedAmt = Number(l.deposit_returned_amount ?? 0);
          const retainedAmt = Number(l.deposit_retained_amount ?? 0);

          const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
          const labelCls = "block space-y-1 text-xs font-semibold text-slate-700";

          return (
            <div
              id={`deposit-${l.id}`}
              className={`rounded-2xl border p-4 space-y-3 transition-all duration-300 ${highlightDepositLeaseId === l.id ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300 ring-offset-1" : "border-slate-200 bg-white"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Dépôt de garantie</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(depositAmount)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isPaid && !depositAction ? (
                    <button type="button" onClick={() => openDepositForm(l.id, "collect", l)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                      Encaisser
                    </button>
                  ) : null}
                  {isPaid && !isReturned && !depositAction ? (
                    <>
                      <button type="button" onClick={() => openDepositForm(l.id, "return", l)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                        Restituer
                      </button>
                      {confirmCancelDepositByLease[l.id] === "cancel_collect" ? (
                        <span className="inline-flex items-center gap-2 text-xs">
                          <span className="text-slate-600">Annuler l&apos;encaissement ?</span>
                          <button type="button" disabled={depositLoading} onClick={() => { setConfirmCancelDepositByLease((p) => ({ ...p, [l.id]: null })); cancelDepositAction(l.id, "cancel_collect"); }} className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-40">Confirmer</button>
                          <button type="button" onClick={() => setConfirmCancelDepositByLease((p) => ({ ...p, [l.id]: null }))} className="text-slate-500 hover:text-slate-700">Annuler</button>
                        </span>
                      ) : (
                        <button type="button" disabled={depositLoading} onClick={() => setConfirmCancelDepositByLease((p) => ({ ...p, [l.id]: "cancel_collect" }))} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                          Annuler encaissement
                        </button>
                      )}
                    </>
                  ) : null}
                  {isReturned && !depositAction ? (
                    confirmCancelDepositByLease[l.id] === "cancel_return" ? (
                      <span className="inline-flex items-center gap-2 text-xs">
                        <span className="text-slate-600">Annuler la restitution ?</span>
                        <button type="button" disabled={depositLoading} onClick={() => { setConfirmCancelDepositByLease((p) => ({ ...p, [l.id]: null })); cancelDepositAction(l.id, "cancel_return"); }} className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-40">Confirmer</button>
                        <button type="button" onClick={() => setConfirmCancelDepositByLease((p) => ({ ...p, [l.id]: null }))} className="text-slate-500 hover:text-slate-700">Annuler</button>
                      </span>
                    ) : (
                      <button type="button" disabled={depositLoading} onClick={() => setConfirmCancelDepositByLease((p) => ({ ...p, [l.id]: "cancel_return" }))} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                        Annuler restitution
                      </button>
                    )
                  ) : null}
                  {depositAction ? (
                    <button type="button" onClick={() => closeDepositForm(l.id)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold">
                      Annuler
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Status summary */}
              {!depositAction ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {!isPaid ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">En attente d&apos;encaissement</span>
                  ) : !isReturned ? (
                    <>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">Encaissé le {fmtDateShortFR(l.deposit_paid_at ?? undefined)}</span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">{formatEuro(paidAmt)}</span>
                    </>
                  ) : (
                    <>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">Clôturé le {fmtDateShortFR(l.deposit_returned_at ?? undefined)}</span>
                      {returnedAmt > 0 ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">Rendu : {formatEuro(returnedAmt)}</span> : null}
                      {retainedAmt > 0 ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">Retenu : {formatEuro(retainedAmt)}</span> : null}
                      {l.deposit_retained_reason ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">{l.deposit_retained_reason}</span> : null}
                    </>
                  )}
                </div>
              ) : null}

              {/* Unpaid months after return */}
              {isReturned && !depositAction ? (
                <div className="mt-1">
                  {unpaidAfterReturnByLease[l.id] == null ? (
                    <button
                      type="button"
                      disabled={!!unpaidLoadingByLease[l.id]}
                      onClick={() => loadUnpaidAfterReturn(l.id)}
                      className="text-xs text-slate-500 underline hover:text-slate-700 disabled:opacity-60"
                    >
                      {unpaidLoadingByLease[l.id] ? "Chargement…" : "Vérifier les loyers non compensés"}
                    </button>
                  ) : unpaidAfterReturnByLease[l.id]!.length === 0 ? (
                    <p className="text-xs text-emerald-600">Tous les loyers sont compensés.</p>
                  ) : (
                    <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-800">Loyers non encore compensés par la caution :</p>
                      {unpaidAfterReturnByLease[l.id]!.map((m: any) => (
                        <div key={m.yyyymm} className="flex items-center justify-between gap-3">
                          <span className="text-xs text-amber-900">{m.label} — <span className="font-semibold">{formatEuro(m.missing_amount)}</span></span>
                          <button
                            type="button"
                            disabled={depositLoading}
                            onClick={() => markMonthCompensated(l.id, { receipt_id: m.receipt_id ?? null, period_start: m.period_start, period_end: m.period_end, label: m.label })}
                            className="inline-flex items-center rounded-lg bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                          >
                            Compenser via caution
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Form: collect */}
              {depositAction === "collect" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-slate-900">Encaissement de la caution</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={labelCls}>
                      Date d&apos;encaissement
                      <input type="date" value={depositForm.paid_at} onChange={(e) => setDepositFormByLease((p) => ({ ...p, [l.id]: { ...p[l.id], paid_at: e.target.value } }))} className={inputCls} />
                    </label>
                    <label className={labelCls}>
                      Montant encaissé (€)
                      <input type="number" min="0" step="0.01" value={depositForm.paid_amount} onChange={(e) => setDepositFormByLease((p) => ({ ...p, [l.id]: { ...p[l.id], paid_amount: e.target.value } }))} className={inputCls} />
                    </label>
                  </div>
                  {depositErr ? <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{depositErr}</p> : null}
                  <button type="button" disabled={depositLoading} onClick={() => submitDepositAction(l.id, "collect")} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                    {depositLoading ? "Enregistrement..." : "Confirmer l'encaissement"}
                  </button>
                </div>
              ) : null}

              {/* Form: return — Décompte de sortie */}
              {depositAction === "return" ? (() => {
                const imputedMonths = imputedMonthsByLease[l.id] || [];
                const damageItems = damageItemsByLease[l.id] || [];
                const unpaidLoading = unpaidLoadingByLease[l.id] || false;
                const paidAmt = Number(depositForm?.paid_amount || l.deposit_paid_amount || l.deposit_amount || 0);

                const checkedImputedTotal = imputedMonths
                  .filter((m) => m.checked)
                  .reduce((s, m) => s + (Number(m.amount) || 0), 0);
                const damageTotal = damageItems
                  .filter((d) => d.label.trim() && Number(d.amount) > 0)
                  .reduce((s, d) => s + (Number(d.amount) || 0), 0);
                const totalRetained = Math.round((checkedImputedTotal + damageTotal) * 100) / 100;
                const totalReturned = Math.max(0, Math.round((paidAmt - totalRetained) * 100) / 100);
                const overRetained = totalRetained > paidAmt + 0.01;

                const setImputed = (fn: (prev: (typeof imputedMonths)) => (typeof imputedMonths)) =>
                  setImputedMonthsByLease((p) => ({ ...p, [l.id]: fn(p[l.id] || []) }));
                const setDamages = (fn: (prev: (typeof damageItems)) => (typeof damageItems)) =>
                  setDamageItemsByLease((p) => ({ ...p, [l.id]: fn(p[l.id] || []) }));

                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <p className="text-xs font-semibold text-slate-900">Décompte de sortie — restitution de la caution</p>

                    <label className={labelCls}>
                      Date de restitution
                      <input type="date" value={depositForm.returned_at} onChange={(e) => setDepositFormByLease((p) => ({ ...p, [l.id]: { ...p[l.id], returned_at: e.target.value } }))} className={inputCls} />
                    </label>

                    {/* Bloc 1 : Loyers/charges impayés */}
                    <div className="space-y-2">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-slate-500">Loyers et charges impayés</p>
                      {unpaidLoading ? (
                        <p className="text-xs text-slate-400 italic">Chargement des impayés…</p>
                      ) : imputedMonths.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Aucun impayé détecté sur ce bail.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {imputedMonths.map((m, i) => (
                            <div key={m.yyyymm} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={m.checked}
                                onChange={(e) => setImputed((prev) => prev.map((x, j) => j === i ? { ...x, checked: e.target.checked } : x))}
                                className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                              />
                              <span className="flex-1 text-xs text-slate-700">{m.label}</span>
                              <span className="text-xs text-slate-400">manque {formatEuro(m.missing_amount)}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={m.amount}
                                onChange={(e) => setImputed((prev) => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                                className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                                disabled={!m.checked}
                              />
                              <span className="text-xs text-slate-500">€</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bloc 2 : Dégradations matérielles */}
                    <div className="space-y-2">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-slate-500">Dégradations matérielles</p>
                      {damageItems.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Aucune dégradation ajoutée.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {damageItems.map((d) => (
                            <div key={d.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Description (ex : remplacement miroir)"
                                value={d.label}
                                onChange={(e) => setDamages((prev) => prev.map((x) => x.id === d.id ? { ...x, label: e.target.value } : x))}
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={d.amount}
                                onChange={(e) => setDamages((prev) => prev.map((x) => x.id === d.id ? { ...x, amount: e.target.value } : x))}
                                className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                              />
                              <span className="text-xs text-slate-500">€</span>
                              <button
                                type="button"
                                onClick={() => setDamages((prev) => prev.filter((x) => x.id !== d.id))}
                                className="text-slate-400 hover:text-red-600 text-sm font-bold leading-none"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setDamages((prev) => [...prev, { id: String(Date.now()), label: "", amount: "" }])}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        + Ajouter une dégradation
                      </button>
                    </div>

                    {/* Bloc 3 : Résumé calculé */}
                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Caution encaissée</span>
                        <span className="font-semibold text-slate-900">{formatEuro(paidAmt)}</span>
                      </div>
                      {checkedImputedTotal > 0 ? (
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>Loyers/charges retenus</span>
                          <span className="font-semibold">− {formatEuro(checkedImputedTotal)}</span>
                        </div>
                      ) : null}
                      {damageTotal > 0 ? (
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>Dégradations retenues</span>
                          <span className="font-semibold">− {formatEuro(damageTotal)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-1.5 mt-1">
                        <span className="text-slate-900">À restituer au locataire</span>
                        <span className={overRetained ? "text-red-700" : "text-emerald-700"}>{formatEuro(totalReturned)}</span>
                      </div>
                      {totalRetained > 0 ? (
                        <div className="flex justify-between text-xs text-amber-700">
                          <span>Total retenu sur caution</span>
                          <span className="font-semibold">{formatEuro(totalRetained)}</span>
                        </div>
                      ) : null}
                      {overRetained ? (
                        <p className="text-xs text-red-700 font-medium">Le total retenu dépasse la caution de {formatEuro(totalRetained - paidAmt)}.</p>
                      ) : null}
                    </div>

                    {/* Notes */}
                    <label className={labelCls}>
                      Notes (facultatif)
                      <input type="text" placeholder="Ex : accord signé avec le locataire, remarques état des lieux…" value={depositForm.retained_reason} onChange={(e) => setDepositFormByLease((p) => ({ ...p, [l.id]: { ...p[l.id], retained_reason: e.target.value } }))} className={inputCls} />
                    </label>

                    {depositErr ? <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{depositErr}</p> : null}
                    <button
                      type="button"
                      disabled={depositLoading || (totalRetained === 0 && totalReturned === 0)}
                      onClick={() => submitDepositAction(l.id, "return")}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {depositLoading ? "Enregistrement..." : "Confirmer et clôturer la caution"}
                    </button>
                  </div>
                );
              })() : null}

              {depositErr && !depositAction ? <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{depositErr}</p> : null}
            </div>
          );
        })()}

        <IrlRevisionPanel
          lease={l}
          property={p || null}
          tenant={t || null}
          openTrigger={deepLink?.leaseId === l.id && deepLink?.openPanel === "irl" ? deepLink.key : undefined}
          onRefresh={onRefresh}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Historique de la location</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Paiements, quittances et jalons du bail</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {badge("slate", pluralFR(history.length, "événement"))}
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  exportLeaseHistoryCsv({ lease: l, property: p, tenant: t, history });
                }}
                disabled={!history.length}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Exporter tout l’historique de la location au format CSV compatible Excel"
              >
                <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                Export Excel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setHistoryOpenByLease((prev) => ({ ...prev, [l.id]: !prev[l.id] }));
                }}
                aria-expanded={historyOpen}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                {historyOpen ? "Masquer" : "Afficher"}
                <ChevronDownIcon className={cx("h-4 w-4 transition-transform", historyOpen && "rotate-180")} aria-hidden="true" />
              </button>
            </div>
          </div>

          {historyOpen ? (
            <>
              <p className="mt-3 text-xs text-slate-600">
                Les demandes de travaux et relances détaillées pourront rejoindre ce journal dès qu’elles seront enregistrées comme événements.
              </p>

              {history.length ? (
                <div className="mt-4 space-y-2">
                  {history.slice(0, 12).map((event) => (
                    <div key={event.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-[8rem_1fr]">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{fmtFR(event.date)}</p>
                        <div className="mt-1">{badge(event.tone, event.title)}</div>
                      </div>
                      <p className="text-sm leading-5 text-slate-700">{event.detail}</p>
                    </div>
                  ))}
                  {history.length > 12 ? <p className="text-xs text-slate-500">+ {history.length - 12} événement(s) plus ancien(s).</p> : null}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                  Aucun paiement ou quittance rattaché à ce bail pour le moment.
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    );
  };

  const renderLeaseForm = () => {
    const selectedTenant = tenantById.get(form.tenant_id) || null;
    const receiptEmail = form.tenant_receipt_email || getTenantEmail(selectedTenant);
    const ownerEmail = form.reminder_email || String(userEmail || "");
    const fakeLease = {
      start_date: form.start_date,
      end_date: form.end_date,
      lease_kind: form.lease_kind,
      auto_renewal_enabled: form.auto_renewal_enabled,
      payment_day: Number(form.payment_day || 1),
      payment_type: form.payment_type,
      auto_quittance_enabled: form.auto_quittance_enabled,
      auto_reminder_enabled: form.auto_reminder_enabled,
      tenant_receipt_email: receiptEmail,
      reminder_email: ownerEmail,
    };
    const flow = workflowInfo(fakeLease as any, selectedTenant);
    const renewal = leaseRenewalInfo(fakeLease as any);
    const leaseRule = getLeaseKindRule(form.lease_kind);
    const enableAutoWorkflow = () => {
      if (!canUseReceiptAutomation) {
        setOk(null);
        setErr("Le gratuit inclut les quittances manuelles. Les rappels, emails et générations automatiques nécessitent un abonnement payant.");
        return;
      }
      if (!guardReceiptEmailForAutomation(receiptEmail)) return;
      setErr(null);
      setForm((s) => ({ ...s, auto_quittance_enabled: true, auto_reminder_enabled: true }));
    };

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{mode === "edit" ? "Modifier le bail" : "Assistant bail"}</p>
            <p className="text-xs text-slate-500">4 étapes : bail, loyer, quittances, suivi. Les options techniques sont rangées en avancé.</p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          {[
            ["1", "Le bail", "Bien, locataire, dates"],
            ["2", "Le loyer", "Montants et échéance"],
            ["3", "Quittances", "Manuel ou auto validé"],
            ["4", "Suivi", "Renouvellement et clôture"],
          ].map(([num, title, desc]) => (
            <div key={num} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs font-semibold text-slate-500">{num}</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{title}</p>
              <p className="text-xs text-slate-600">{desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">1 · Le bail</p>
          <p className="mt-1 text-sm text-slate-600">Rattachez le logement, le locataire et la nature juridique du suivi.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Bien *</label>
            <select
              value={form.property_id}
              onChange={(e) => {
                const pid = e.target.value;
                const p = propertyById.get(pid);
                const isGestionDelegated = (p?.delegated_services || []).includes("gestion_courante");
                setForm((s) => ({
                  ...s,
                  property_id: pid,
                  ...(isGestionDelegated ? { receipts_disabled: true, auto_quittance_enabled: false, auto_reminder_enabled: false } : {}),
                }));
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— Sélectionner —</option>
              {selectableProps.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label || "Bien"}
                </option>
              ))}
            </select>
            {activeProps.length === 0 ? <p className="text-[0.7rem] text-amber-700">Ajoute d’abord un bien actif.</p> : null}
            {form.property_id && (propertyById.get(form.property_id)?.delegated_services || []).includes("gestion_courante") ? (
              <p className="text-[0.7rem] text-sky-700">
                Gestion déléguée — quittances passées en "Géré par agence" automatiquement.
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Locataire *</label>
            <select
              value={form.tenant_id}
              onChange={(e) => {
                const tenantId = e.target.value;
                const nextTenant = tenantById.get(tenantId);
                setForm((s) => ({
                  ...s,
                  tenant_id: tenantId,
                  tenant_receipt_email: s.tenant_receipt_email || getTenantEmail(nextTenant),
                }));
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— Sélectionner —</option>
              {selectableTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || "Locataire"}
                </option>
              ))}
            </select>
            {activeTenants.length === 0 ? <p className="text-[0.7rem] text-amber-700">Ajoute d’abord un locataire actif.</p> : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Début de bail *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => {
                const nextStart = e.target.value;
                setForm((s) => {
                  const previousExpected = expectedEndDate(s.start_date, s.lease_kind);
                  const nextExpected = expectedEndDate(nextStart, s.lease_kind);
                  return {
                    ...s,
                    start_date: nextStart,
                    end_date: nextExpected && (!s.end_date || s.end_date === previousExpected) ? nextExpected : s.end_date,
                  };
                });
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Fin (optionnel)</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Prompt suivi historique — bail existant importé */}
        {mode === "create" && form.start_date && (() => {
          const daysAgo = Math.floor((Date.now() - new Date(form.start_date + "T00:00:00").getTime()) / 86400000);
          if (daysAgo <= 30) return null;
          const monthsAgo = Math.round(daysAgo / 30);
          return (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-indigo-900">Bail existant — depuis quand suivre les paiements ?</p>
                <p className="text-xs text-indigo-700 mt-1">
                  Ce bail a démarré il y a {monthsAgo} mois. Si vous l&apos;importez dans lokt.fr, vous n&apos;avez probablement pas besoin de confirmer les paiements passés un par un.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, tracking_from: "now" }))}
                  className={`rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                    form.tracking_from === "now"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "border border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-100"
                  }`}
                >
                  <div className="font-bold">À partir d&apos;aujourd&apos;hui</div>
                  <div className={`mt-0.5 font-normal ${form.tracking_from === "now" ? "text-white/75" : "text-indigo-500"}`}>
                    Recommandé — pas de backlog
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, tracking_from: "start" }))}
                  className={`rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                    form.tracking_from === "start"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "border border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-100"
                  }`}
                >
                  <div className="font-bold">Depuis le début du bail</div>
                  <div className={`mt-0.5 font-normal ${form.tracking_from === "start" ? "text-white/75" : "text-indigo-500"}`}>
                    Importer l&apos;historique complet
                  </div>
                </button>
              </div>
            </div>
          );
        })()}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Type de bail</label>
              <select
                value={form.lease_kind}
                onChange={(e) => {
                  const nextKind = e.target.value as LeaseKind;
                  const nextRule = getLeaseKindRule(nextKind);
                  setForm((s) => {
                    const expected = expectedEndDate(s.start_date, nextKind);
                    return {
                      ...s,
                      lease_kind: nextKind,
                      auto_renewal_enabled: nextRule.tacitRenewal,
                      end_date: expected && (!s.end_date || s.end_date === expectedEndDate(s.start_date, s.lease_kind)) ? expected : s.end_date,
                    };
                  });
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {leaseKindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-[0.7rem] text-slate-500">{leaseRule.note}</p>
            </div>

            <div className="rounded-xl border border-white bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                {badge(renewal.tone, renewal.status)}
                {badge(leaseRule.tacitRenewal ? "emerald" : "slate", leaseRule.renewalLabel)}
              </div>
              <p className="mt-2 text-xs text-slate-600">{renewal.nextAction}</p>
              {leaseRule.tacitRenewal ? (
                <label className="mt-3 flex items-start gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.auto_renewal_enabled}
                    onChange={(e) => setForm((s) => ({ ...s, auto_renewal_enabled: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>Suivre ce bail comme reconduit tacitement tant qu’il n’est pas clôturé.</span>
                </label>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">2 · Le loyer</p>
          <p className="mt-1 text-sm text-slate-600">Ces montants alimentent le suivi des loyers, les quittances et les alertes d’encaissement.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Loyer (€)</label>
            <input
              type="number"
              step="0.01"
              value={form.rent_amount}
              onChange={(e) => setForm((s) => ({ ...s, rent_amount: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Charges (€)</label>
            <input
              type="number"
              step="0.01"
              value={form.charges_amount}
              onChange={(e) => setForm((s) => ({ ...s, charges_amount: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Dépôt (€)</label>
            <input
              type="number"
              step="0.01"
              value={form.deposit_amount}
              onChange={(e) => setForm((s) => ({ ...s, deposit_amount: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Jour paiement (1–31)</label>
            <input
              type="number"
              min={1}
              max={31}
              value={form.payment_day}
              onChange={(e) => setForm((s) => ({ ...s, payment_day: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Mode paiement</label>
            <select
              value={form.payment_method}
              onChange={(e) => setForm((s) => ({ ...s, payment_method: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="virement">Virement</option>
              <option value="prelevement">Prélèvement</option>
              <option value="cheque">Chèque</option>
              <option value="especes">Espèces</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Échéance</label>
            <select
              value={form.payment_type}
              onChange={(e) => setForm((s) => ({ ...s, payment_type: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="terme_a_echoir">Début de période</option>
              <option value="terme_echu">Fin de période</option>
            </select>
            <p className="text-[0.7rem] text-slate-500">Début = à échoir • Fin = à échu</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">3 · Quittances</p>
          <p className="mt-1 text-sm text-slate-600">
            Le mode recommandé est simple : le bailleur confirme que le paiement est reçu, puis la quittance est générée et envoyée.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Aperçu métier</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{flow.modeLabel}</p>
              <p className="mt-1 text-xs text-slate-600">
                {flow.auto
                  ? "Après validation du paiement, le PDF est généré, archivé et envoyé au locataire."
                  : "Le paiement et la quittance restent traités manuellement."}
              </p>
            </div>
            {badge(flow.tone as any, flow.label)}
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {[
              ["Échéance", `Jour ${form.payment_day}`, paymentTypeShort(form.payment_type)],
              [
                "Paiement",
                form.auto_quittance_enabled ? "Validation bailleur" : "Manuel",
                form.auto_quittance_enabled ? "avant PDF/envoi" : "dans Quittances",
              ],
              ["PDF", form.auto_quittance_enabled ? "Automatique" : "Manuel", "après paiement"],
              ["Envoi", form.auto_quittance_enabled ? receiptEmail || "Email manquant" : "Manuel", form.auto_quittance_enabled ? "locataire" : "depuis Quittances"],
            ].map(([title, value, sub]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[0.7rem] font-semibold text-slate-500">{title}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 truncate">{value}</p>
                <p className="text-xs text-slate-600">{sub}</p>
              </div>
            ))}
          </div>

          {flow.blockers.length || flow.warnings.length ? (
            <div className={cx("mt-3 rounded-xl border px-3 py-2 text-xs", workflowNoticeClass(flow.tone))}>
              {flow.noticeTitle ? <p className="mb-1 font-semibold">{flow.noticeTitle}</p> : null}
              {[...flow.blockers, ...flow.warnings].map((m) => (
                <p key={m}>• {m}</p>
              ))}
              {flow.noticeAdvice ? <p className="mt-2 font-medium">{flow.noticeAdvice}</p> : null}
            </div>
          ) : null}
        </div>

        {!canUseReceiptAutomation ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold">Quittances auto disponibles avec lokt·one</p>
                <p className="mt-1 text-amber-950/85">
                  En gratuit, vous gardez le mode manuel : confirmer le paiement, générer le PDF et consulter l’archive. Le plan lokt·one débloque
                  les emails bailleur, relances, génération automatique et envoi au locataire.
                </p>
              </div>
              <StarterUpgradeLink className="shrink-0 self-start lg:self-center" />
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-900">Workflow quittance</p>
              <p className="mt-0.5 text-[0.75rem] text-slate-600">
                Configuration recommandée : le bailleur confirme le paiement avant génération du PDF et envoi au locataire.
              </p>
            </div>
            {badge(flow.tone as any, flow.label)}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <WorkflowChoice
              title="Automatique validé"
              description={
                canUseReceiptAutomation
                  ? "Email bailleur, puis PDF et envoi après confirmation du paiement."
                  : "Disponible avec lokt·one ou lokt·plus."
              }
              icon={ShieldCheckIcon}
              tone="emerald"
              selected={form.auto_quittance_enabled && form.auto_reminder_enabled}
              disabled={!canUseReceiptAutomation}
              onClick={() => enableAutoWorkflow()}
            />

            <WorkflowChoice
              title="Manuel"
              description="Génération et envoi depuis Quittances."
              icon={HandRaisedIcon}
              tone="slate"
              selected={!form.auto_quittance_enabled && !form.receipts_disabled}
              onClick={() => setForm((s) => ({ ...s, auto_quittance_enabled: false, auto_reminder_enabled: false, receipts_disabled: false }))}
            />

            <WorkflowChoice
              title="Géré par agence"
              description="L'agence émet ses propres quittances. Seul le paiement est à confirmer chaque mois pour la Finance."
              icon={BuildingOfficeIcon}
              tone="slate"
              selected={!!form.receipts_disabled}
              onClick={() => setForm((s) => ({ ...s, auto_quittance_enabled: false, auto_reminder_enabled: false, receipts_disabled: true }))}
            />
          </div>

          {!canUseReceiptAutomation ? (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-600">
                  Le plan lokt·one suffit pour activer les quittances automatiques. Le plan lokt·plus les inclut aussi, avec Performance et Déclaration.
                </p>
                <StarterUpgradeLink className="shrink-0" />
              </div>
            </div>
          ) : null}

          <p className="text-[0.7rem] text-slate-500">
            La quittance est un reçu : le workflow recommandé garde une validation de paiement avant l’envoi au locataire.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">4 · Suivi du bail</p>
          <p className="mt-1 text-sm text-slate-600">Vérifiez la reconduction et gardez les réglages rarement modifiés en options avancées.</p>
        </div>

        <details className="rounded-xl border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Options avancées</summary>
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[0.7rem] text-slate-700">Statut</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="active">Actif</option>
                  <option value="ended">Terminé</option>
                  <option value="draft">Brouillon</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[0.7rem] text-slate-700">Fuseau horaire</label>
                <select
                  value={form.timezone}
                  onChange={(e) => setForm((s) => ({ ...s, timezone: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </div>
        </details>

        <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-600">
                {mode === "edit" ? "Enregistrez les modifications du bail." : "Une fois les informations renseignées, créez le bail ici."}
              </p>
              {mode === "edit" && editingId ? (
                confirmDeleteLeaseId === editingId ? (
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className="text-slate-600">Supprimer ce bail ?</span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => { stop(e); setConfirmDeleteLeaseId(null); onDelete(editingId); }}
                      className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-40"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { stop(e); setConfirmDeleteLeaseId(null); }}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={(e) => { stop(e); setConfirmDeleteLeaseId(editingId); }}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                  >
                    Supprimer ce bail
                  </button>
                )
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton
                icon={CheckCircleIcon}
                tone="success"
                disabled={loading}
                onClick={(e) => {
                  stop(e);
                  saveLease();
                }}
              >
                {loading ? "Enregistrement…" : mode === "edit" ? "Mettre à jour" : "Créer"}
              </ActionButton>

              <ActionButton
                icon={XMarkIcon}
                onClick={(e) => {
                  stop(e);
                  cancelEdit();
                  setExpandedId(null);
                }}
              >
                Annuler
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ======================================================
     EXPAND LOGIC
  ====================================================== */

  const openRow = async (id: string | null) => {
    setErr(null);
    setOk(null);

    // fermeture -> stop édition
    if (!id) {
      setExpandedId(null);
      cancelEdit();
      return;
    }

    setExpandedId(id);

    if (id === CREATE_ID) {
      openCreate();
      return;
    }
  };

  /* ======================================================
     UI
  ====================================================== */

  return (
    <>
    {contractLeaseId ? <LeaseContractWizard userId={userId} leaseId={contractLeaseId} onClose={() => setContractLeaseId(null)} /> : null}
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Locations"
        title="Créer et suivre une location"
        desc="Chaque location relie un logement, un locataire et un loyer — c'est ce qui pilote le suivi mensuel, les quittances et les alertes."
      />

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un bail, locataire, bien…"
            className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900"
          />
        </div>

        {/* CTA Créer bail */}
        <button
          type="button"
          onClick={() => {
            openRow(expandedId === CREATE_ID ? null : CREATE_ID);
          }}
          className={cx(
            "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200",
            expandedId === CREATE_ID
              ? "bg-slate-700 shadow-slate-200 hover:bg-slate-600"
              : "bg-gradient-to-r from-[#635bff] to-[#00d4ff] shadow-indigo-200 hover:shadow-indigo-300 hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          <DocumentTextIcon className="h-4 w-4" />
          Créer une location
        </button>
      </div>

      {/* Carte création bail */}
      {expandedId === CREATE_ID && (
        <div
          id="baux-create-form"
          className={cx(
            "overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-xl shadow-indigo-50",
            highlightCreate ? "ring-2 ring-[#635bff] ring-offset-2" : ""
          )}
        >
          {/* Barre gradient */}
          <div className="h-1 bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />

          {/* En-tête */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50">
                <DocumentTextIcon className="h-5 w-5 text-[#635bff]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Nouvelle location</p>
                <p className="text-xs text-slate-500">Choisis un bien + un locataire, puis configure les options.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openRow(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Formulaire */}
          <div className="p-5">
            {renderLeaseForm()}
          </div>
        </div>
      )}

      <div className="grid gap-4">

        {/* ✅ ACTIFS */}
        <ExpandableSection
          title="Actifs"
          subtitle="Clique une ligne pour voir / modifier."
          right={badge("emerald", pluralFR(filtered.actifs.length, "bail"))}
          defaultOpen={true}
        >
          {filtered.actifs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun bail actif.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.actifs.map((l) => {
                const meta = leaseLine(l);
                const open = expandedId === l.id;
                const payStatus = getLeasePaymentStatus(l.id);
                const payBadge = open
                  ? badge("slate", "Ouvert")
                  : payStatus === "paid"
                  ? badge("emerald", "Payé ✓")
                  : payStatus === "overdue"
                  ? badge("red", "En retard")
                  : null;

                return (
                  <div key={l.id} id={`lease-${l.id}`}>
                    <ExpandableRow
                      id={l.id}
                      expandedId={expandedId}
                      setExpandedId={(id) => openRow(id)}
                      left={
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate min-w-0">
                              {meta.propertyLabel}{" "}
                              <span className="text-slate-500 font-normal">— {meta.tenantName}</span>
                            </p>
                            {isNew(l.created_at) && <em className="shrink-0 text-[0.65rem] font-medium text-indigo-400">new</em>}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 truncate">
                            {meta.startDateFR ? `depuis le ${meta.startDateFR}` : ""}
                            {meta.endDateFR ? ` → ${meta.endDateFR}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {badge("emerald", "Actif")}
                            {meta.total > 0 ? badge("slate", `${formatEuro(meta.total)}/mois`) : null}
                            {(meta.isBailEdlDelegated || meta.isGestionDelegated) && badge("sky", `Délégué${meta.agencyName ? ` · ${meta.agencyName}` : ""}`)}
                          </div>
                        </div>
                      }
                      right={payBadge}
                    >
                      {mode === "edit" && editingId === l.id ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">{renderLeaseForm()}</div>
                      ) : (
                        renderLeaseDetails(l)
                      )}
                    </ExpandableRow>
                  </div>
                );
              })}
            </div>
          )}
        </ExpandableSection>

        {/* ✅ ARCHIVÉS */}
        <ExpandableSection
          title="Archivés"
          subtitle="Terminés et brouillons."
          right={badge("amber", pluralFR(filtered.archives.length, "bail"))}
          defaultOpen={false}
        >
          {filtered.archives.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun bail archivé.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.archives.map((l) => {
                const meta = leaseLine(l);
                const open = expandedId === l.id;
                const archiveLabel = isEndedLease(l) ? "Terminé" : isDraftLease(l) ? "Brouillon" : meta.status;
                const archiveTone = isEndedLease(l) ? ("amber" as const) : ("slate" as const);

                return (
                  <ExpandableRow
                    key={l.id}
                    id={l.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => openRow(id)}
                    left={
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {meta.propertyLabel}{" "}
                          <span className="text-slate-500 font-normal">— {meta.tenantName}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 truncate">
                          {meta.startDateFR ? `du ${meta.startDateFR}` : ""}
                          {meta.endDateFR ? ` au ${meta.endDateFR}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {badge(archiveTone, archiveLabel)}
                          {meta.total > 0 ? badge("slate", `${formatEuro(meta.total)}/mois`) : null}
                          {(meta.isBailEdlDelegated || meta.isGestionDelegated) && badge("sky", `Délégué${meta.agencyName ? ` · ${meta.agencyName}` : ""}`)}
                        </div>
                      </div>
                    }
                    right={open ? badge("slate", "Ouvert") : null}
                  >
                    {mode === "edit" && editingId === l.id ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">{renderLeaseForm()}</div>
                    ) : (
                      renderLeaseDetails(l)
                    )}
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>
      </div>
    </div>
    </>
  );
}
