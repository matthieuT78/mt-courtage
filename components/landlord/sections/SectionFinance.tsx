// components/landlord/sections/SectionFinance.tsx
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownCircleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpCircleIcon,
  BanknotesIcon,
  DocumentArrowUpIcon,
  DocumentMagnifyingGlassIcon,
  PaperClipIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { SectionDeclaration } from "./SectionDeclaration";

type FinanceTab = "finance" | "declaration";
import {
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
import { SectionTitle, formatEuro } from "../UiBits";
import type { Lease, Property, RentPayment } from "../../../lib/landlord/types";
import { includeSelected, isActivePropertyLike } from "../../../lib/landlord/archiveFilters";
import { xhrUploadDirect } from "../../../lib/uploadWithProgress";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const Chart = dynamic(() => import("react-chartjs-2").then((m) => m.Chart), {
  ssr: false,
});

type Receipt = {
  id: string;
  user_id: string;
  lease_id: string;
  period_start?: string | null;
  period_end?: string | null;
  total_amount?: number | null;
  status?: string | null;
  created_at: string;
};

type TxDirection = "in" | "out";
type TxStatus = "expected" | "received" | "paid";
type PeriodMode = "month" | "last6" | "year" | "custom";

type Transaction = {
  id: string;
  user_id: string;
  property_id: string | null;
  lease_id: string | null;
  receipt_id: string | null;

  occurred_at: string; // YYYY-MM-DD
  direction: TxDirection;
  status: TxStatus;
  category: string;
  label: string | null;
  amount: number;
  notes: string | null;

  // Charges récurrentes
  is_recurring?: boolean;
  recurrence_frequency?: "monthly" | "quarterly" | "yearly" | null;
  recurrence_since?: string | null;
  recurrence_end_date?: string | null;
  recurrence_parent_id?: string | null;

  created_at: string;
  updated_at: string;
};

type TransactionDocument = {
  id: string;
  user_id: string;
  transaction_id: string;
  property_id: string | null;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  document_kind: "invoice" | "receipt" | "quote" | "other";
  created_at: string;
  updated_at?: string | null;
};

type PropertyFinance = {
  property_id: string;
  user_id: string;

  purchase_price: number | null;
  notary_fees: number | null;
  agency_fees: number | null;
  works: number | null;
  down_payment: number | null;

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

  recurring_since?: string | null;

  created_at?: string;
  updated_at?: string;
};

type Props = {
  userId: string;
  leases?: Lease[];
  payments?: RentPayment[];
  receipts?: Receipt[];
  propertyById?: Map<string, Property>;
  properties?: Property[];
  onRefresh?: () => Promise<void> | void;
  deepLink?: { key: number; openCreate?: boolean; prefillPropertyId?: string } | null;
};

const toMonthISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const toISODate = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
const isNew = (createdAt?: string | null) =>
  !!createdAt && Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;

const monthStartEnd = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start, end };
};

const addMonths = (d: Date, delta: number) => new Date(d.getFullYear(), d.getMonth() + delta, 1);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const periodRange = (mode: PeriodMode, anchorMonth: string, customStart?: string, customEnd?: string) => {
  if (mode === "custom" && customStart && customEnd) {
    const { start } = monthStartEnd(customStart);
    const { end } = monthStartEnd(customEnd);
    return start <= end ? { start, end } : { start: monthStartEnd(customEnd).start, end: monthStartEnd(customStart).end };
  }

  const { start: anchorStart, end: anchorEnd } = monthStartEnd(anchorMonth);
  if (mode === "year") {
    return { start: addMonths(anchorStart, -11), end: anchorEnd };
  }
  if (mode === "last6") {
    return { start: addMonths(anchorStart, -5), end: anchorEnd };
  }
  return { start: anchorStart, end: anchorEnd };
};

const fmtDateFR = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
};

const normalizeDate = (val?: string | null) => {
  if (!val) return null;
  // supports "YYYY-MM-DD" or already ISO-ish strings
  const d = new Date(String(val).slice(0, 10) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
};

const sum = (arr: number[]) => arr.reduce((acc, x) => acc + (Number.isFinite(x) ? x : 0), 0);

const fmtMonthFR = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

const fmtPeriodFR = (mode: PeriodMode, anchorMonth: string, customStart?: string, customEnd?: string) => {
  const { start, end } = periodRange(mode, anchorMonth, customStart, customEnd);
  if (mode === "month") return fmtMonthFR(anchorMonth);
  if (mode === "year") return `${fmtMonthFR(monthKey(start))} -> ${fmtMonthFR(monthKey(end))}`;
  return `${fmtMonthFR(monthKey(start))} -> ${fmtMonthFR(monthKey(end))}`;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[0.75rem] text-slate-600">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const RECOVERABLE_CHARGES = [
  {
    title: "Ascenseur",
    items: ["électricité", "visites et entretien courant", "menues réparations et petit matériel"],
  },
  {
    title: "Eau & chauffage collectif",
    items: ["eau froide / chaude", "énergie", "exploitation, entretien courant et menues réparations"],
  },
  {
    title: "Installations individuelles",
    items: ["entretien chauffage / eau chaude", "réglages", "petites réparations de robinetterie et chasse d’eau"],
  },
  {
    title: "Parties communes",
    items: ["électricité", "produits d’entretien", "minuterie, tapis, propreté et petit matériel"],
  },
  {
    title: "Extérieurs & hygiène",
    items: ["espaces verts et abords", "aires de jeux", "sacs, désinsectisation, élimination des rejets"],
  },
  {
    title: "Taxes récupérables",
    items: ["taxe ou redevance d’enlèvement des ordures ménagères", "taxe de balayage"],
  },
];

function RecoverableChargesGuide() {
  return (
    <section id="finance-charges" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <ChapterHeader
        eyebrow="02 · Charges récupérables"
        title="Savoir ce qui peut être refacturé au locataire"
        desc="Un mémo pratique pour classer les charges sans confondre dépense propriétaire, charge récupérable et fiscalité."
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr,360px]">
        <div className="grid gap-3 md:grid-cols-2">
          {RECOVERABLE_CHARGES.map((group) => (
            <div key={group.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">{group.title}</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-950">Règle de pilotage lokt.fr</p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Quand vous saisissez une dépense, classez-la d’abord comme dépense propriétaire. Ne la marquez récupérable que
            si elle correspond à la liste du décret ou au décompte de copropriété.
          </p>
          <div className="mt-4 space-y-2 text-xs leading-5 text-amber-900">
            <p>
              <span className="font-semibold">À ne pas mélanger :</span> taxe foncière, assurance PNO, intérêts d’emprunt,
              gros travaux et vétusté restent en principe des charges propriétaire.
            </p>
            <p>
              <span className="font-semibold">À conserver :</span> justificatif, décompte de copropriété, facture et période concernée.
            </p>
          </div>
          <a
            href="https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000333863"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-amber-950 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-900"
          >
            Voir le décret 87-713
          </a>
        </aside>
      </div>
    </section>
  );
}

const CATEGORIES: Array<{ value: string; label: string; dir?: TxDirection }> = [
  { value: "rent", label: "Loyer (quittance)", dir: "in" },
  { value: "fees", label: "Frais plateforme / conciergerie", dir: "out" },
  { value: "management", label: "Gestion / agence", dir: "out" },
  { value: "repairs", label: "Entretien / travaux", dir: "out" },
  { value: "copro", label: "Copropriété (non récup.)", dir: "out" },
  { value: "insurance", label: "Assurance (PNO/GLI…)", dir: "out" },
  { value: "tax", label: "Taxe foncière", dir: "out" },
  { value: "utilities", label: "Eau/élec/internet (si à ta charge)", dir: "out" },
  { value: "charges_recovered", label: "Charges récupérées / refacturées", dir: "in" },
  { value: "regularization", label: "Régularisation de charges", dir: undefined },
  { value: "loan", label: "Crédit (mensualité)", dir: "out" },
  { value: "deposit_collected", label: "Caution reçue", dir: "in" as TxDirection },
  { value: "deposit_returned", label: "Caution restituée", dir: "out" as TxDirection },
  { value: "deposit_retained", label: "Retenue sur caution", dir: "in" as TxDirection },
  { value: "other", label: "Autre", dir: undefined },
];

const categoryLabel = (value: string) => CATEGORIES.find((c) => c.value === value)?.label || value;
const statusLabel = (value: TxStatus) =>
  value === "expected" ? "Prévu" : value === "received" ? "Encaissé" : "Payé";
const directionLabel = (value: TxDirection) => (value === "in" ? "Recette" : "Dépense");
const sourceLabel = (tx: Transaction) => (tx.receipt_id ? "Quittance auto" : "Manuel");
const DEPOSIT_TRANSIT_CATEGORIES = ["deposit_collected", "deposit_returned"];
const DEPOSIT_CATS = ["deposit_collected", "deposit_returned", "deposit_retained"];

const isIncomeReceived = (row: Pick<Transaction, "direction" | "status" | "category">) =>
  row.direction === "in" &&
  (row.status === "received" || row.status === "paid") &&
  !DEPOSIT_TRANSIT_CATEGORIES.includes(row.category);

// Lignes déjà comptées dans les charges structurelles (récurrentes) : à exclure des sommes
// "ponctuelles" (dépenses/recettes) pour éviter un double comptage avec le total récurrent.
const isRecurringFlow = (row: Pick<Transaction, "is_recurring" | "recurrence_parent_id">) =>
  Boolean(row.is_recurring || row.recurrence_parent_id);

type FinancePropertyRow = {
  propertyId: string;
  label: string;
  income: number;
  ledgerIncome: number;
  expectedRent: number;
  expense: number;
  net: number;
  loan: number;
  fixed: number;
  taxM: number;
  lmnpRecurring: number;
  cashflow: number;
  invest: number;
  yieldNet: number;
  activeLeaseCount: number;
  taxRegime: string | null;
};

type FinanceAction = {
  propertyId: string;
  label: string;
  title: string;
  desc: string;
  impact: string;
  tone: "red" | "amber" | "emerald" | "slate";
};

const actionToneClass: Record<FinanceAction["tone"], string> = {
  red: "border-red-200 bg-red-50 text-red-950",
  amber: "border-amber-200 bg-amber-50 text-amber-950",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  slate: "border-slate-200 bg-slate-50 text-slate-900",
};

const QUICK_EXPENSES = [
  { label: "Taxe foncière", category: "tax", direction: "out" as TxDirection, status: "paid" as TxStatus },
  { label: "Assurance PNO / GLI", category: "insurance", direction: "out" as TxDirection, status: "paid" as TxStatus },
  { label: "Travaux / entretien", category: "repairs", direction: "out" as TxDirection, status: "paid" as TxStatus },
  { label: "Charges copropriété", category: "copro", direction: "out" as TxDirection, status: "paid" as TxStatus },
  { label: "Mensualité crédit", category: "loan", direction: "out" as TxDirection, status: "paid" as TxStatus },
  { label: "Frais gestion", category: "management", direction: "out" as TxDirection, status: "paid" as TxStatus },
];

function num(v: any) {
  const n = typeof v === "number" ? v : parseFloat(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(v: any) {
  if (v == null || String(v).trim() === "") return null;
  const n = num(v);
  return Number.isFinite(n) ? n : null;
}

function hasValidDecimalDraft(value: string) {
  return /^-?\d*(?:[,.]\d*)?$/.test(value.trim());
}

function formatInputNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return String(value).replace(".", ",");
}

function normalizeMonthlyAmount(value: number | null, frequency?: PropertyFinance["fixed_charges_frequency"]) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return null;
  if (frequency === "quarterly") return Math.round((n / 3) * 100) / 100;
  if (frequency === "yearly") return Math.round((n / 12) * 100) / 100;
  return Math.round(n * 100) / 100;
}

function displayAmountFromMonthly(value: number | null | undefined, frequency?: PropertyFinance["fixed_charges_frequency"]) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return null;
  if (frequency === "quarterly") return Math.round(n * 3 * 100) / 100;
  if (frequency === "yearly") return Math.round(n * 12 * 100) / 100;
  return Math.round(n * 100) / 100;
}

function estimatedLoanEndYear(remainingMonths?: number | null) {
  const months = Number(remainingMonths || 0);
  if (!Number.isFinite(months) || months <= 0) return null;
  return new Date().getFullYear() + Math.ceil(months / 12);
}

const csvCell = (value: string | number | null | undefined) => {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function buildRecurringInstances(
  parentId: string,
  template: Record<string, unknown>,
  frequency: "monthly" | "quarterly" | "yearly",
  since: string,
  endDate: string | null
): Record<string, unknown>[] {
  const sinceDate = new Date(since);
  const today = new Date();
  const endLimit = endDate ? new Date(endDate) : today;
  const cap = endLimit < today ? endLimit : today;

  const advance = (d: Date) => {
    if (frequency === "monthly") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    if (frequency === "quarterly") return new Date(d.getFullYear(), d.getMonth() + 3, 1);
    return new Date(d.getFullYear() + 1, d.getMonth(), 1);
  };

  const instances: Record<string, unknown>[] = [];
  // Le parent est la première occurrence — on génère à partir de la suivante
  let cursor = advance(new Date(sinceDate.getFullYear(), sinceDate.getMonth(), 1));
  while (cursor <= cap) {
    instances.push({
      ...template,
      occurred_at: cursor.toISOString().slice(0, 10),
      recurrence_parent_id: parentId,
      is_recurring: false,
      recurrence_frequency: null,
      recurrence_since: null,
      recurrence_end_date: null,
      updated_at: new Date().toISOString(),
    });
    cursor = advance(cursor);
  }
  return instances;
}

export function SectionFinance({ userId, leases, payments, receipts, propertyById, properties, onRefresh, deepLink }: Props) {
  const [tab, setTab] = useState<FinanceTab>("finance");

  // 🎨 lokt.fr
  const brandBg = "bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  const safeLeases = Array.isArray(leases) ? leases : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeReceipts = Array.isArray(receipts) ? receipts : [];
  const propsById = propertyById instanceof Map ? propertyById : new Map<string, Property>();

  const [currentMonth, setCurrentMonth] = useState(() => toMonthISO(new Date()));
  useEffect(() => {
    const timer = setInterval(() => {
      const m = toMonthISO(new Date());
      setCurrentMonth((prev) => (prev !== m ? m : prev));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [customStartMonth, setCustomStartMonth] = useState<string>(toMonthISO(addMonths(new Date(), -2)));
  const [customEndMonth, setCustomEndMonth] = useState<string>(toMonthISO(new Date()));
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [analysisPropertyId, setAnalysisPropertyId] = useState<string>("");

  // Ledger
  const [tx, setTx] = useState<Transaction[]>([]);
  const [txDocuments, setTxDocuments] = useState<TransactionDocument[]>([]);
  const [pf, setPf] = useState<Map<string, PropertyFinance>>(new Map());
  const [openFinanceProps, setOpenFinanceProps] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [highlightFinanceConfig, setHighlightFinanceConfig] = useState(false);
  const [chartDrillKey, setChartDrillKey] = useState<string | null>(null);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!deepLink?.openCreate) return;
    setTab("finance");
    setHighlightFinanceConfig(true);
    setTimeout(() => {
      document.getElementById("finance-pilotage")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    setTimeout(() => setHighlightFinanceConfig(false), 2500);
  }, [deepLink]);

  useEffect(() => {
    const propertyId = deepLink?.prefillPropertyId;
    if (!propertyId) return;
    setTab("finance");
    setAnalysisPropertyId(propertyId);
    setOpenFinanceProps((prev) => (prev.has(propertyId) ? prev : new Set(prev).add(propertyId)));
    setTimeout(() => {
      document.getElementById(`finance-property-${propertyId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [deepLink]);

  // Filtres liste
  const [filterPropertyId, setFilterPropertyId] = useState<string>("");
  const [filterDirection, setFilterDirection] = useState<TxDirection | "">("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<TxStatus | "">("");
  const [filterSource, setFilterSource] = useState<"auto" | "manual" | "">("");
  const [filterAmountMin, setFilterAmountMin] = useState<string>("");
  const [filterAmountMax, setFilterAmountMax] = useState<string>("");
  const [filterText, setFilterText] = useState<string>("");

  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);
  const [confirmStopRecurId, setConfirmStopRecurId] = useState<string | null>(null);
  const [stopBusy, setStopBusy] = useState(false);
  const [txWizardOpen, setTxWizardOpen] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadDocProgress, setUploadDocProgress] = useState<number | null>(null);

  // Edit recurring transaction
  const [editRecurTx, setEditRecurTx] = useState<Transaction | null>(null);
  const [editRecurForm, setEditRecurForm] = useState({ amount: "", label: "" });
  const [editRecurScope, setEditRecurScope] = useState<"all" | "future">("future");
  const [editRecurBusy, setEditRecurBusy] = useState(false);

  // Edit transaction
  const [editTxOpen, setEditTxOpen] = useState(false);
  const [editTxId, setEditTxId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    property_id: "",
    occurred_at: toISODate(new Date()),
    direction: "out" as TxDirection,
    status: "paid" as TxStatus,
    category: "fees",
    label: "",
    amount: "",
    notes: "",
  });

  const propertyOptions = useMemo(
    () =>
      Array.from(propsById.values()).sort((a, b) =>
        String(a.label || a.address_line1 || "").localeCompare(String(b.label || b.address_line1 || ""))
      ),
    [propsById]
  );
  const activePropertyOptions = useMemo(() => propertyOptions.filter(isActivePropertyLike), [propertyOptions]);
  const activePropertyIdSet = useMemo(() => new Set(activePropertyOptions.map((property) => property.id)), [activePropertyOptions]);

  const leasePropertyById = useMemo(() => {
    const map = new Map<string, string>();
    for (const lease of safeLeases) {
      if (lease.id && lease.property_id) map.set(lease.id, lease.property_id);
    }
    return map;
  }, [safeLeases]);

  const analysisPropertyIds = useMemo(
    () => (analysisPropertyId ? [analysisPropertyId] : activePropertyOptions.map((property) => property.id)),
    [analysisPropertyId, activePropertyOptions]
  );

  // Transactions récurrentes (parents uniquement, is_recurring=true), groupées par bien
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

  // Récurrentes actives : parents dont la date de fin est absente ou future
  const activeRecurringTx = useMemo(() => {
    const today = toISODate(new Date());
    return tx
      .filter((t) => t.is_recurring && (!t.recurrence_end_date || t.recurrence_end_date > today))
      .sort((a, b) => (a.property_id || "").localeCompare(b.property_id || "") || (a.recurrence_since || a.occurred_at).localeCompare(b.recurrence_since || b.occurred_at));
  }, [tx]);

  const monthlyRecurringByProperty = useMemo(() => {
    const map = new Map<string, { loan: number; fixed: number; taxM: number; total: number }>();
    for (const propertyId of analysisPropertyIds) {
      const recurringTxs = recurringParentTxByProperty.get(propertyId) || [];
      const fin = pf.get(propertyId) || null;

      // Charges récurrentes du grand livre, regroupées par catégorie.
      // "loan", "tax", "insurance" et "copro" remplacent leur équivalent property_finance
      // si une transaction récurrente de cette catégorie existe (évite le double-comptage).
      let loanTx = 0, taxTx = 0, fixedTx = 0;
      let hasLoanTx = false, hasTaxTx = false, hasInsuranceTx = false, hasCoproTx = false;
      for (const tx of recurringTxs) {
        const divisor = tx.recurrence_frequency === "quarterly" ? 3 : tx.recurrence_frequency === "yearly" ? 12 : 1;
        const monthlyAmt = (tx.amount / divisor) * (tx.direction === "out" ? 1 : -1);
        if (tx.category === "loan") { loanTx += monthlyAmt; hasLoanTx = true; }
        else if (tx.category === "tax") { taxTx += monthlyAmt; hasTaxTx = true; }
        else if (tx.category === "insurance") { fixedTx += monthlyAmt; hasInsuranceTx = true; }
        else if (tx.category === "copro") { fixedTx += monthlyAmt; hasCoproTx = true; }
        else fixedTx += monthlyAmt;
      }

      const loan = hasLoanTx ? loanTx : Number(fin?.loan_monthly || 0) + Number(fin?.loan_insurance_monthly || 0);
      const taxM = hasTaxTx
        ? taxTx
        : Number(fin?.property_tax_yearly || 0) / 12 + Number(fin?.cfe_yearly || 0) / 12;
      const fixed =
        fixedTx +
        Number(fin?.fixed_charges_monthly || 0) +
        (hasInsuranceTx ? 0 : Number(fin?.pno_insurance_monthly || 0)) +
        (hasCoproTx ? 0 : Number(fin?.copro_charges_monthly || 0)) +
        Number(fin?.bank_fees_monthly || 0) +
        Number(fin?.maintenance_monthly || 0) +
        Number(fin?.rental_tax_monthly || 0);

      map.set(propertyId, { loan, fixed, taxM, total: loan + fixed + taxM });
    }
    return map;
  }, [analysisPropertyIds, pf, recurringParentTxByProperty]);

  // Form ajout manuel
  const [form, setForm] = useState({
    property_id: "",
    lease_id: "",
    occurred_at: toISODate(new Date()),
    direction: "out" as TxDirection,
    status: "paid" as TxStatus,
    category: "fees",
    label: "",
    amount: "",
    notes: "",
    // Charge récurrente
    is_recurring: false,
    recurrence_frequency: "monthly" as "monthly" | "quarterly" | "yearly",
    recurrence_since: toISODate(new Date()),
    recurrence_end_date: "",
  });
  const selectableFormPropertyOptions = useMemo(
    () => includeSelected(activePropertyOptions, propertyOptions, form.property_id),
    [activePropertyOptions, propertyOptions, form.property_id]
  );

  const selectableEditPropertyOptions = useMemo(
    () => includeSelected(activePropertyOptions, propertyOptions, editForm.property_id),
    [activePropertyOptions, propertyOptions, editForm.property_id]
  );
  const txDocsByTransactionId = useMemo(() => {
    const map = new Map<string, TransactionDocument[]>();
    for (const doc of txDocuments) {
      const list = map.get(doc.transaction_id) || [];
      list.push(doc);
      map.set(doc.transaction_id, list);
    }
    return map;
  }, [txDocuments]);

  // ========== Sync quittances -> transactions (idempotent + dedupe payload) ==========
  const syncReceiptsToTransactions = useCallback(async () => {
    if (!supabase || !userId) return;
    if (safeReceipts.length === 0) return;

    // ✅ dédoublonnage des quittances (sinon 2 lignes identiques dans le même upsert => violation unique)
    const byId = new Map<string, Receipt>();
    for (const r of safeReceipts) {
      if (r?.id) byId.set(r.id, r);
    }
    const uniqueReceipts = Array.from(byId.values());
    if (uniqueReceipts.length === 0) return;

    const syncableReceipts = uniqueReceipts.filter((r) => {
      const status = String(r.status || "").toLowerCase();
      return status === "generated" || status === "sent";
    });
    if (syncableReceipts.length === 0) return;

    // ⚠️ Toujours fetcher les paiements frais depuis Supabase — les props peuvent être périmées
    // (ex: confirm-manual écrit status="received" côté serveur, puis le client écrase avec "expected"
    // si safePayments ne contient pas encore le paid_at). Une seule requête ciblée sur les baux concernés.
    const leaseIds = [...new Set(syncableReceipts.map((r) => r.lease_id).filter(Boolean))];
    const { data: freshPayments } = await supabase
      .from("rent_payments")
      .select("lease_id,period_start,period_end,paid_at,total_amount")
      .in("lease_id", leaseIds);

    const paymentsByPeriod = new Map(
      (freshPayments || []).map((payment) => [
        `${payment.lease_id}:${payment.period_start}:${payment.period_end}`,
        payment,
      ])
    );

    const payload = syncableReceipts.map((r) => {
      const lease = safeLeases.find((l) => l.id === r.lease_id);
      const payment = paymentsByPeriod.get(`${r.lease_id}:${r.period_start}:${r.period_end}`);
      const fullyPaid = !!payment?.paid_at && Number(payment.total_amount || 0) + 0.01 >= Number(r.total_amount || 0);
      const occurred_at =
        (r.period_end ? String(r.period_end).slice(0, 10) : String(r.created_at).slice(0, 10)) ||
        new Date().toISOString().slice(0, 10);

      return {
        user_id: userId,
        property_id: lease?.property_id ?? null,
        lease_id: r.lease_id,
        receipt_id: r.id,
        occurred_at,
        direction: "in" as const,
        status: fullyPaid ? ("received" as const) : ("expected" as const),
        category: "rent",
        label: "Loyer (quittance)",
        amount: Number(r.total_amount || 0),
        notes: null,
        updated_at: new Date().toISOString(),
      };
    });

    // ⚠️ utilise l'index unique existant (user_id, receipt_id) WHERE receipt_id IS NOT NULL
    const { error } = await supabase.from("transactions").upsert(payload, { onConflict: "user_id,receipt_id" });
    if (error) throw error;
  }, [safeLeases, safeReceipts, userId]);

  const loadFinance = useCallback(async (options?: { silent?: boolean }) => {
    if (!supabase || !userId) return;
    const silent = options?.silent ?? false;

    setSyncState("syncing");
    setLoading(true);
    setErr(null);
    if (!silent) setOk(null);

    try {
      await syncReceiptsToTransactions();

      const { data: tData, error: tErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(10000);

      if (tErr) throw tErr;
      setTx((tData || []) as any);

      const { data: docData, error: docErr } = await supabase
        .from("transaction_documents")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (docErr) {
        const message = String(docErr.message || "").toLowerCase();
        if (message.includes("transaction_documents") || message.includes("schema cache")) {
          console.warn("[finance] transaction_documents indisponible:", docErr.message);
          setTxDocuments([]);
        } else {
          throw docErr;
        }
      } else {
        setTxDocuments((docData || []) as any);
      }

      const { data: pData, error: pErr } = await supabase
        .from("property_finance")
        .select("*")
        .eq("user_id", userId);

      if (pErr) throw pErr;

      const map = new Map<string, PropertyFinance>();
      for (const row of (pData || []) as any[]) map.set(row.property_id, row);
      setPf(map);

      setLastSyncedAt(new Date());
      setSyncState("idle");
      if (!silent) setOk("Finance chargée ✅");
    } catch (e: any) {
      setSyncState("error");
      setErr(e?.message || "Impossible de charger Finance.");
    } finally {
      setLoading(false);
    }
  }, [syncReceiptsToTransactions, userId]);

  const scheduleAutoRefresh = useCallback(() => {
    if (autoRefreshTimerRef.current) clearTimeout(autoRefreshTimerRef.current);
    autoRefreshTimerRef.current = setTimeout(() => {
      loadFinance({ silent: true });
    }, 350);
  }, [loadFinance]);

  useEffect(() => {
    if (!userId) return;
    loadFinance({ silent: true });

    return () => {
      if (autoRefreshTimerRef.current) clearTimeout(autoRefreshTimerRef.current);
    };
  }, [loadFinance, userId]);

  useEffect(() => {
    if (!userId) return;

    const handleFocus = () => loadFinance({ silent: true });
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadFinance({ silent: true });
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadFinance, userId]);

  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = (supabase as any)
      .channel(`finance-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        scheduleAutoRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "property_finance", filter: `user_id=eq.${userId}` },
        scheduleAutoRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rent_receipts", filter: `user_id=eq.${userId}` },
        scheduleAutoRefresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scheduleAutoRefresh, userId]);

  const selectedPeriod = useMemo(() => {
    const { start, end } = periodRange(periodMode, currentMonth, customStartMonth, customEndMonth);
    return {
      start,
      end,
      label: fmtPeriodFR(periodMode, currentMonth, customStartMonth, customEndMonth),
      monthCount: (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1,
    };
  }, [periodMode, currentMonth, customStartMonth, customEndMonth]);

  const expectedRentByPropertyMonth = useMemo(() => {
    const map = new Map<string, number>();
    const { start, end } = selectedPeriod;
    const statusBlocked = new Set(["draft", "archived", "ended"]);

    for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor = addMonths(cursor, 1)) {
      const key = monthKey(cursor);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

      for (const lease of safeLeases) {
        const propertyId = lease.property_id || "";
        if (!propertyId || !analysisPropertyIds.includes(propertyId)) continue;

        const leaseStart = normalizeDate(lease.start_date);
        const leaseEnd = normalizeDate(lease.end_date);
        if (!leaseStart) continue;
        if (statusBlocked.has((lease.status || "").toLowerCase())) continue;
        if (leaseStart > monthEnd || (leaseEnd && leaseEnd < cursor)) continue;

        const amount = Number(getLeaseRentPeriod(lease, key)?.total || 0);
        map.set(`${propertyId}:${key}`, (map.get(`${propertyId}:${key}`) || 0) + amount);
      }
    }

    return map;
  }, [analysisPropertyIds, safeLeases, selectedPeriod]);

  // ========= Period view (attendu vs encaissé) =========
  const periodInfo = useMemo(() => {
    const { start, end } = selectedPeriod;

    const months: Date[] = [];
    for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor = addMonths(cursor, 1)) {
      months.push(cursor);
    }

    const activeLeases = safeLeases.filter((l) => {
      const s = normalizeDate(l.start_date);
      const e = normalizeDate(l.end_date);
      const leasePropertyId = l.property_id || "";
      if (analysisPropertyId && leasePropertyId !== analysisPropertyId) return false;
      if (!analysisPropertyId && leasePropertyId && !activePropertyIdSet.has(leasePropertyId)) return false;
      if (!s) return false;
      const startsBeforeEnd = s.getTime() <= end.getTime();
      const notEnded = !e || e.getTime() >= start.getTime();
      const statusOk = (l.status || "active").toLowerCase() !== "draft";
      return startsBeforeEnd && notEnded && statusOk;
    });

    const expected = sum(
      months.map((mStart) => {
        const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0);
        return sum(
          activeLeases
            .filter((l) => {
              const s = normalizeDate(l.start_date);
              const e = normalizeDate(l.end_date);
              return !!s && s <= mEnd && (!e || e >= mStart);
            })
            .map((l) => Number(getLeaseRentPeriod(l, monthKey(mStart))?.total || 0))
        );
      })
    );

    const periodPayments = safePayments.filter((p) => {
      const paymentPropertyId = leasePropertyById.get(p.lease_id || "") || "";
      if (analysisPropertyId && paymentPropertyId !== analysisPropertyId) return false;
      if (!analysisPropertyId && paymentPropertyId && !activePropertyIdSet.has(paymentPropertyId)) return false;
      const ps = normalizeDate(p.period_start);
      const pe = normalizeDate(p.period_end);
      if (!ps || !pe) return false;
      return !(pe.getTime() < start.getTime() || ps.getTime() > end.getTime());
    });

    const received = sum(
      periodPayments.filter((p) => !!p.paid_at).map((p) => Number(p.total_amount || 0))
    );

    const pending = Math.max(0, expected - received);
    return { expected, received, pending, activeLeases };
  }, [activePropertyIdSet, analysisPropertyId, leasePropertyById, selectedPeriod, safeLeases, safePayments]);

  // ========= Ledger: rows for period =========
  const periodLedger = useMemo(() => {
    const { start, end } = selectedPeriod;
    const s = start.getTime();
    const e = end.getTime();

    const rows = tx.filter((t) => {
      if (analysisPropertyId && (t.property_id || "") !== analysisPropertyId) return false;
      if (!analysisPropertyId && t.property_id && !activePropertyIdSet.has(t.property_id)) return false;
      const d = normalizeDate(t.occurred_at);
      if (!d) return false;
      const ms = d.getTime();
      return ms >= s && ms <= e;
    });

    const income = sum(rows.filter((r) => !isRecurringFlow(r) && isIncomeReceived(r)).map((r) => Number(r.amount || 0)));
    const expense = sum(rows.filter((r) => !isRecurringFlow(r) && r.direction === "out" && !DEPOSIT_TRANSIT_CATEGORIES.includes(r.category)).map((r) => Number(r.amount || 0)));
    return { rows, income, expense, net: income - expense };
  }, [activePropertyIdSet, analysisPropertyId, tx, selectedPeriod]);

  // ========= Month ledger filtered (UI filters) =========
  const filteredMonthLedger = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    const amountMin = filterAmountMin.trim() ? num(filterAmountMin) : null;
    const amountMax = filterAmountMax.trim() ? num(filterAmountMax) : null;

    return periodLedger.rows.filter((r) => {
      if (filterPropertyId && (r.property_id || "") !== filterPropertyId) return false;
      if (filterDirection && r.direction !== filterDirection) return false;
      if (filterCategory && r.category !== filterCategory) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterSource === "auto" && !r.receipt_id) return false;
      if (filterSource === "manual" && r.receipt_id) return false;
      if (amountMin !== null && Number(r.amount || 0) < amountMin) return false;
      if (amountMax !== null && Number(r.amount || 0) > amountMax) return false;

      if (!text) return true;
      const propertyName = r.property_id ? propsById.get(r.property_id)?.label || "" : "";
      const hay = [
        propertyName,
        categoryLabel(r.category),
        statusLabel(r.status),
        sourceLabel(r),
        r.label || "",
        r.notes || "",
        r.occurred_at,
        directionLabel(r.direction),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(text);
    });
  }, [
    periodLedger.rows,
    filterPropertyId,
    filterDirection,
    filterCategory,
    filterStatus,
    filterSource,
    filterAmountMin,
    filterAmountMax,
    filterText,
    propsById,
  ]);

  const filteredLedgerSummary = useMemo(() => {
    const income = sum(filteredMonthLedger.filter((r) => !isRecurringFlow(r) && isIncomeReceived(r)).map((r) => Number(r.amount || 0)));
    const expense = sum(filteredMonthLedger.filter((r) => !isRecurringFlow(r) && r.direction === "out" && !DEPOSIT_TRANSIT_CATEGORIES.includes(r.category)).map((r) => Number(r.amount || 0)));
    return { income, expense, net: income - expense, count: filteredMonthLedger.length };
  }, [filteredMonthLedger]);

  const resetLedgerFilters = () => {
    setFilterPropertyId("");
    setFilterDirection("");
    setFilterCategory("");
    setFilterStatus("");
    setFilterSource("");
    setFilterAmountMin("");
    setFilterAmountMax("");
    setFilterText("");
  };

  const exportFilteredLedger = () => {
    if (filteredMonthLedger.length === 0) {
      setErr("Aucune écriture à exporter avec les filtres actuels.");
      return;
    }

    const headers = ["Date", "Bien", "Sens", "Catégorie", "Statut", "Libellé", "Montant", "Source", "Notes", "ID"];
    const rows = filteredMonthLedger.map((r) => {
      const propertyName = r.property_id ? propsById.get(r.property_id)?.label || "Bien" : "Non affecté";
      return [
        r.occurred_at,
        propertyName,
        directionLabel(r.direction),
        categoryLabel(r.category),
        statusLabel(r.status),
        r.label || "",
        Number(r.amount || 0).toFixed(2).replace(".", ","),
        sourceLabel(r),
        r.notes || "",
        r.id,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slugPeriod = periodLabel.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `finance-${slugPeriod || "periode"}-${toISODate(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setOk(`Export Excel prêt ✅ (${filteredMonthLedger.length} ligne${filteredMonthLedger.length > 1 ? "s" : ""})`);
  };


  // ========= Per property: cashflow & rendement =========
  const perProperty = useMemo<FinancePropertyRow[]>(() => {
    const by = new Map<string, { income: number; expense: number; net: number }>();

    for (const propertyId of analysisPropertyIds) {
      by.set(propertyId, { income: 0, expense: 0, net: 0 });
    }

    for (const r of periodLedger.rows) {
      if (isRecurringFlow(r)) continue; // déjà compté dans les charges récurrentes (loan/fixed/taxM)
      const pid = r.property_id || "—";
      const cur = by.get(pid) || { income: 0, expense: 0, net: 0 };
      if (isIncomeReceived(r)) cur.income += Number(r.amount || 0);
      else if (r.direction === "out") cur.expense += Number(r.amount || 0);
      cur.net = cur.income - cur.expense;
      by.set(pid, cur);
    }

    const rows = Array.from(by.entries()).map(([propertyId, v]) => {
      const p = propertyId === "—" ? null : propsById.get(propertyId);
      const fin = propertyId === "—" ? null : pf.get(propertyId) || null;
      const expectedRent = propertyId === "—"
        ? 0
        : sum(
            Array.from(expectedRentByPropertyMonth.entries())
              .filter(([key]) => key.startsWith(`${propertyId}:`))
              .map(([, amount]) => amount)
          );
      const activeLeaseCount = propertyId === "—"
        ? 0
        : safeLeases.filter((lease) => {
            if ((lease.property_id || "") !== propertyId) return false;
            const status = (lease.status || "").toLowerCase();
            if (["draft", "archived", "ended"].includes(status)) return false;
            const leaseStart = normalizeDate(lease.start_date);
            const leaseEnd = normalizeDate(lease.end_date);
            if (!leaseStart) return false;
            return leaseStart <= selectedPeriod.end && (!leaseEnd || leaseEnd >= selectedPeriod.start);
          }).length;
      const incomeBase = v.income;

      const recurring = propertyId === "—" ? { loan: 0, fixed: 0, taxM: 0, total: 0 } : monthlyRecurringByProperty.get(propertyId) || { loan: 0, fixed: 0, taxM: 0, total: 0 };
      const loan = recurring.loan;
      const fixed = recurring.fixed;
      const taxM = recurring.taxM;
      // fixed et taxM viennent de monthlyRecurringByProperty qui applique déjà les guards
      // insurance/copro/tax — plus fiable que de re-lire property_finance brut
      const lmnpRecurring = recurring.fixed + recurring.taxM;

      const cashflow = incomeBase - v.expense - recurring.total * selectedPeriod.monthCount;

      const invest =
        Number(fin?.purchase_price || 0) +
        Number(fin?.notary_fees || 0) +
        Number(fin?.agency_fees || 0) +
        Number(fin?.works || 0);

      const annualNet = selectedPeriod.monthCount > 0 ? (cashflow / selectedPeriod.monthCount) * 12 : 0;
      const yieldNet = invest > 0 ? annualNet / invest : 0;

      return {
        propertyId,
        label: p?.label || (propertyId === "—" ? "Non affecté" : "Bien"),
        income: incomeBase,
        ledgerIncome: v.income,
        expectedRent,
        expense: v.expense,
        net: incomeBase - v.expense,
        loan,
        fixed,
        taxM,
        lmnpRecurring,
        cashflow,
        invest,
        yieldNet,
        activeLeaseCount,
        taxRegime: fin?.tax_regime || null,
      };
    });

    return rows.sort((a, b) => b.cashflow - a.cashflow);
  }, [analysisPropertyIds, expectedRentByPropertyMonth, monthlyRecurringByProperty, periodLedger.rows, propsById, pf, safeLeases, selectedPeriod]);

  const attachDocumentToTransaction = async (transaction: Pick<Transaction, "id" | "property_id">, file: File) => {
    if (!supabase || !userId) return;
    if (!file) return;
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error("Le fichier doit faire moins de 10 Mo.");

    const accepted = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (file.type && !accepted.includes(file.type)) throw new Error("Format accepté : PDF, JPG, PNG ou WebP.");

    const filename = safeFileName(file.name || "facture");
    const path = `${userId}/${transaction.id}/${Date.now()}-${filename}`;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Session expirée.");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    setUploadDocProgress(0);
    await xhrUploadDirect(supabaseUrl, "finance-documents", path, accessToken, anonKey, file, (pct) => setUploadDocProgress(pct), false);
    setUploadDocProgress(null);

    const { error: insertError } = await supabase.from("transaction_documents").insert({
      user_id: userId,
      transaction_id: transaction.id,
      property_id: transaction.property_id || null,
      storage_bucket: "finance-documents",
      storage_path: path,
      file_name: file.name || filename,
      mime_type: file.type || null,
      size_bytes: file.size,
      document_kind: "invoice",
      updated_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;
  };

  // ========= CRUD: Add manual transaction =========
  const addTx = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !userId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const amount = Number(String(form.amount || "0").replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide.");
      if (!form.property_id) throw new Error("Le champ Bien est obligatoire.");

      const isRecurring = form.is_recurring && !!form.recurrence_since;

      const basePayload = {
        user_id: userId,
        property_id: form.property_id || null,
        lease_id: form.lease_id || null,
        receipt_id: null,
        direction: form.direction,
        status: form.status,
        category: form.category,
        label: form.label?.trim() || null,
        amount,
        notes: form.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const payload = isRecurring
        ? {
            ...basePayload,
            occurred_at: form.recurrence_since,
            is_recurring: true,
            recurrence_frequency: form.recurrence_frequency,
            recurrence_since: form.recurrence_since,
            recurrence_end_date: form.recurrence_end_date || null,
          }
        : { ...basePayload, occurred_at: form.occurred_at };

      const { data: inserted, error } = await supabase.from("transactions").insert(payload).select("id,property_id").single();
      if (error) throw error;

      // Générer les instances passées si récurrent
      let instanceCount = 0;
      if (isRecurring && inserted?.id) {
        const instances = buildRecurringInstances(
          inserted.id,
          { ...basePayload, recurrence_parent_id: inserted.id, is_recurring: false },
          form.recurrence_frequency,
          form.recurrence_since,
          form.recurrence_end_date || null
        );
        instanceCount = instances.length;
        if (instances.length > 0) {
          const { error: instancesError } = await supabase.from("transactions").insert(instances);
          if (instancesError) throw instancesError;
        }
      }

      if (invoiceFile && inserted?.id) {
        await attachDocumentToTransaction({ id: inserted.id, property_id: inserted.property_id || null }, invoiceFile);
      }
      setOk(
        isRecurring
          ? `Charge récurrente créée + ${instanceCount} écriture${instanceCount > 1 ? "s" : ""} passée${instanceCount > 1 ? "s" : ""} ✅`
          : invoiceFile
          ? "Écriture ajoutée avec facture ✅"
          : "Écriture ajoutée ✅"
      );
      setTxWizardOpen(false);
      setForm((s) => ({ ...s, amount: "", label: "", notes: "", is_recurring: false }));
      setInvoiceFile(null);

      await loadFinance();
      await onRefresh?.();
    } catch (e: any) {
      setErr(e?.message || "Erreur ajout écriture.");
    } finally {
      setLoading(false);
    }
  };

  const attachDocumentFromLedger = async (transaction: Transaction, file?: File | null) => {
    if (!file) return;
    setUploadingDocId(transaction.id);
    setErr(null);
    setOk(null);
    try {
      await attachDocumentToTransaction(transaction, file);
      setOk("Facture jointe à l’écriture ✅");
      await loadFinance();
    } catch (e: any) {
      setErr(e?.message || "Impossible de joindre la facture.");
      setUploadDocProgress(null);
    } finally {
      setUploadingDocId(null);
    }
  };

  // ========= Edit manual transaction =========
  const openEditTx = (r: Transaction) => {
    setEditTxId(r.id);
    setEditForm({
      property_id: r.property_id || "",
      occurred_at: r.occurred_at,
      direction: r.direction,
      status: r.status,
      category: r.category,
      label: r.label || "",
      amount: String(r.amount || ""),
      notes: r.notes || "",
    });
    setEditTxOpen(true);
  };

  const updateTx = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !userId || !editTxId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const amount = Number(String(editForm.amount || "0").replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide.");
      if (!editForm.property_id) throw new Error("Le champ Bien est obligatoire.");

      const { error } = await supabase
        .from("transactions")
        .update({
          property_id: editForm.property_id || null,
          occurred_at: editForm.occurred_at,
          direction: editForm.direction,
          status: editForm.status,
          category: editForm.category,
          label: editForm.label?.trim() || null,
          amount,
          notes: editForm.notes?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editTxId)
        .eq("user_id", userId);

      if (error) throw error;

      setOk("Écriture modifiée ✅");
      setEditTxOpen(false);
      setEditTxId(null);
      await loadFinance();
      await onRefresh?.();
    } catch (e: any) {
      setErr(e?.message || "Erreur modification écriture.");
    } finally {
      setLoading(false);
    }
  };

  const deleteOneTx = async (r: Transaction) => {
    if (!supabase || !userId) return;
    if (r.receipt_id || DEPOSIT_CATS.includes(r.category)) {
      setErr("Cette écriture est protégée (quittance auto ou caution).");
      return;
    }

    setDeleteBusy(true);
    setErr(null);
    setOk(null);
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", r.id).eq("user_id", userId);
      if (error) throw error;
      setOk("Écriture supprimée ✅");
      await loadFinance();
      await onRefresh?.();
    } catch (e: any) {
      setErr(e?.message || "Erreur suppression.");
    } finally {
      setDeleteBusy(false);
    }
  };

  // ========= Stopper une charge récurrente =========
  const stopRecurring = async (parentTx: Transaction) => {
    if (!supabase || !userId) return;
    setStopBusy(true);
    setErr(null);
    setOk(null);
    try {
      const today = toISODate(new Date());
      const { error: upErr } = await supabase
        .from("transactions")
        .update({ recurrence_end_date: today, updated_at: new Date().toISOString() })
        .eq("id", parentTx.id)
        .eq("user_id", userId);
      if (upErr) throw upErr;
      // Supprimer les instances futures non encore échues
      const { error: delErr } = await supabase
        .from("transactions")
        .delete()
        .eq("recurrence_parent_id", parentTx.id)
        .eq("user_id", userId)
        .gt("occurred_at", today);
      if (delErr) throw delErr;
      setOk("Récurrente arrêtée ✅");
      await loadFinance();
      await onRefresh?.();
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de l'arrêt de la récurrente.");
    } finally {
      setStopBusy(false);
    }
  };

  // ========= Modifier une charge récurrente =========
  const saveEditRecurring = async () => {
    if (!supabase || !userId || !editRecurTx) return;
    const amount = Number(String(editRecurForm.amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) { setErr("Montant invalide."); return; }
    setEditRecurBusy(true);
    setErr(null);
    setOk(null);
    try {
      const today = toISODate(new Date());
      const patch: Record<string, unknown> = { amount, updated_at: new Date().toISOString() };
      if (editRecurForm.label.trim()) patch.label = editRecurForm.label.trim();

      // Mettre à jour le parent
      const { error: pErr } = await supabase.from("transactions").update(patch).eq("id", editRecurTx.id).eq("user_id", userId);
      if (pErr) throw pErr;

      // Mettre à jour les instances enfants selon le scope
      let childQ = supabase.from("transactions").update(patch).eq("recurrence_parent_id", editRecurTx.id).eq("user_id", userId);
      if (editRecurScope === "future") childQ = childQ.gt("occurred_at", today);
      const { error: cErr } = await childQ;
      if (cErr) throw cErr;

      setOk(editRecurScope === "all" ? "Toutes les occurrences mises à jour ✅" : "Prochaines occurrences mises à jour ✅");
      setEditRecurTx(null);
      await loadFinance();
      await onRefresh?.();
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de la modification.");
    } finally {
      setEditRecurBusy(false);
    }
  };

  // ========= Upsert property finance =========
  const upsertPropertyFinance = async (propertyId: string, patch: Partial<PropertyFinance>) => {
    if (!supabase || !userId || !propertyId) return;
    setErr(null);
    setOk(null);

    const payload = {
      property_id: propertyId,
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("property_finance").upsert(payload, { onConflict: "property_id" });
    if (error) throw error;

    await loadFinance();
    await onRefresh?.();
    setOk("Configuration financière enregistrée ✅ Mise en route mise à jour.");
  };

  const periodLabel = selectedPeriod.label;

  const totalCashflow = sum(perProperty.map((p) => p.cashflow));
  const recurringPeriodTotal = sum(perProperty.map((p) => (p.loan + p.fixed + p.taxM) * selectedPeriod.monthCount));
  const weakProperties = perProperty.filter((p) => p.cashflow < 0);
  const bestProperty = perProperty[0] || null;

  const impactActions = useMemo<FinanceAction[]>(() => {
    const actions: FinanceAction[] = [];

    for (const property of perProperty) {
      const recurringTotal = (property.loan + property.fixed + property.taxM) * selectedPeriod.monthCount;

      if (property.activeLeaseCount === 0) {
        actions.push({
          propertyId: property.propertyId,
          label: property.label,
          title: "Aucun bail actif",
          desc:
            recurringTotal > 0
              ? `Aucun revenu attendu sur ${periodLabel}, mais ${formatEuro(recurringTotal)} de charges récurrentes continuent de sortir. La priorité est de créer ou rattacher le bail, sinon la performance restera artificiellement négative.`
              : `Aucun revenu attendu sur ${periodLabel}. La priorité est de créer ou rattacher le bail pour que Finance puisse lire un loyer réel.`,
          impact: "Revenu à recréer",
          tone: "red",
        });
        continue;
      }

      const incomeToConfirm = Math.max(0, property.expectedRent - property.ledgerIncome);
      if (incomeToConfirm > 0.01) {
        actions.push({
          propertyId: property.propertyId,
          label: property.label,
          title: "Loyer attendu, encaissement à confirmer",
          desc: `${formatEuro(property.expectedRent)} est attendu via le bail actif, mais ${formatEuro(property.ledgerIncome)} seulement est confirmé encaissé sur la période. Le graphe reste volontairement prudent tant que Quittances n’est pas pointé.`,
          impact: `À confirmer : ${formatEuro(incomeToConfirm)}`,
          tone: "amber",
        });
      }

      if (property.cashflow < 0) {
        actions.push({
          propertyId: property.propertyId,
          label: property.label,
          title: "Cashflow négatif",
          desc: `Le bien sort à ${formatEuro(property.cashflow)} sur ${periodLabel}. Vérifiez d’abord les charges récurrentes, puis le crédit, l’assurance et les dépenses saisies sur la période.`,
          impact: `Écart à absorber : ${formatEuro(Math.abs(property.cashflow))}`,
          tone: "amber",
        });
      }

      if (!property.taxRegime) {
        actions.push({
          propertyId: property.propertyId,
          label: property.label,
          title: "Régime fiscal manquant",
          desc: "Le régime fiscal n’est pas renseigné. Or un bien meublé, nu, micro ou réel ne se pilote pas avec les mêmes charges ni les mêmes arbitrages.",
          impact: "Lecture fiscale à fiabiliser",
          tone: "slate",
        });
      }

      if (property.invest <= 0) {
        actions.push({
          propertyId: property.propertyId,
          label: property.label,
          title: "Prix d’achat incomplet",
          desc: "Le rendement ne peut pas être défendable sans prix d’achat, frais et travaux. Complétez ces données pour comparer ce bien aux autres.",
          impact: "Rendement non calculable",
          tone: "slate",
        });
      }
    }

    if (actions.length === 0) {
      return [
        {
          propertyId: "global",
          label: "Portefeuille",
          title: "Aucune anomalie prioritaire",
          desc: "Les baux, charges récurrentes et paramètres principaux sont cohérents sur la période. Gardez le rythme de saisie des justificatifs et paiements.",
          impact: "Suivi à jour",
          tone: "emerald",
        },
      ];
    }

    const rank: Record<FinanceAction["tone"], number> = { red: 0, amber: 1, slate: 2, emerald: 3 };
    return actions.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 6);
  }, [perProperty, periodLabel, selectedPeriod.monthCount]);

  const accountingChartRows = useMemo(() => {
    const { start, end } = selectedPeriod;

    // Calcule le récurrent pour un mois donné, en respectant les dates par transaction
    const recurringForMonth = (monthStart: Date) => {
      let total = 0;
      for (const propertyId of analysisPropertyIds) {
        const recurringTxs = recurringParentTxByProperty.get(propertyId) || [];
        const activeTxs = recurringTxs.filter((tx) => {
          const since = tx.recurrence_since ? new Date(tx.recurrence_since) : null;
          const end = tx.recurrence_end_date ? new Date(tx.recurrence_end_date) : null;
          if (since && monthStart < new Date(since.getFullYear(), since.getMonth(), 1)) return false;
          if (end && monthStart > new Date(end.getFullYear(), end.getMonth(), 1)) return false;
          return true;
        });

        let hasLoanTx = false, hasTaxTx = false, hasInsuranceTx = false, hasCoproTx = false;
        for (const tx of activeTxs) {
          const divisor = tx.recurrence_frequency === "quarterly" ? 3 : tx.recurrence_frequency === "yearly" ? 12 : 1;
          total += (tx.amount / divisor) * (tx.direction === "out" ? 1 : -1);
          if (tx.category === "loan") hasLoanTx = true;
          else if (tx.category === "tax") hasTaxTx = true;
          else if (tx.category === "insurance") hasInsuranceTx = true;
          else if (tx.category === "copro") hasCoproTx = true;
        }

        // Fallback property_finance par catégorie — remplacé si une transaction récurrente
        // de même catégorie existe (évite le double-comptage).
        const fin = pf.get(propertyId);
        const since = fin?.recurring_since ? new Date(fin.recurring_since) : null;
        const finActive = !since || monthStart >= new Date(since.getFullYear(), since.getMonth(), 1);
        if (finActive) {
          if (!hasLoanTx) total += Number(fin?.loan_monthly || 0) + Number(fin?.loan_insurance_monthly || 0);
          if (!hasTaxTx) total += Number(fin?.property_tax_yearly || 0) / 12 + Number(fin?.cfe_yearly || 0) / 12;
          total +=
            Number(fin?.fixed_charges_monthly || 0) +
            (hasInsuranceTx ? 0 : Number(fin?.pno_insurance_monthly || 0)) +
            (hasCoproTx ? 0 : Number(fin?.copro_charges_monthly || 0)) +
            Number(fin?.bank_fees_monthly || 0) +
            Number(fin?.maintenance_monthly || 0) +
            Number(fin?.rental_tax_monthly || 0);
        }
      }
      return total;
    };

    const months: Array<{ key: string; label: string; income: number; expense: number; recurring: number; net: number }> = [];

    for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor = addMonths(cursor, 1)) {
      const key = monthKey(cursor);
      const recurring = recurringForMonth(cursor);
      months.push({ key, label: fmtMonthFR(key).replace(/^\w/, (c) => c.toUpperCase()), income: 0, expense: 0, recurring, net: -recurring });
    }

    const byKey = new Map(months.map((row) => [row.key, row]));
    for (const row of periodLedger.rows) {
      if (isRecurringFlow(row)) continue; // déjà compté dans `recurring` (charges structurelles)
      const d = normalizeDate(row.occurred_at);
      if (!d) continue;
      const bucket = byKey.get(monthKey(d));
      if (!bucket) continue;
      if (isIncomeReceived(row)) {
        bucket.income += Number(row.amount || 0);
      } else if (row.direction === "out") {
        bucket.expense += Number(row.amount || 0);
      }
      bucket.net = bucket.income - bucket.expense - bucket.recurring;
    }

    return months;
  }, [analysisPropertyIds, recurringParentTxByProperty, pf, periodLedger.rows, selectedPeriod]);

  const chartDrillRows = useMemo(
    () =>
      chartDrillKey
        ? periodLedger.rows.filter((r) => {
            if (isRecurringFlow(r)) return false;
            const d = normalizeDate(r.occurred_at);
            return d ? monthKey(d) === chartDrillKey : false;
          })
        : [],
    [chartDrillKey, periodLedger.rows]
  );

  const chartDrillStructuralRows = useMemo(() => {
    if (!chartDrillKey) return [];
    const monthStart = new Date(chartDrillKey + "-01");
    const rows: Array<{ id: string; label: string; category: string; amount: number; direction: "in" | "out"; property_id: string }> = [];

    for (const pid of analysisPropertyIds) {
      const recurringTxs = recurringParentTxByProperty.get(pid) || [];
      let hasLoanTx = false, hasTaxTx = false, hasInsuranceTx = false, hasCoproTx = false;

      const activeTxs = recurringTxs.filter((t) => {
        const since = t.recurrence_since ? new Date(t.recurrence_since) : null;
        const end = t.recurrence_end_date ? new Date(t.recurrence_end_date) : null;
        if (since && monthStart < new Date(since.getFullYear(), since.getMonth(), 1)) return false;
        if (end && monthStart > new Date(end.getFullYear(), end.getMonth(), 1)) return false;
        return true;
      });

      for (const t of activeTxs) {
        const divisor = t.recurrence_frequency === "quarterly" ? 3 : t.recurrence_frequency === "yearly" ? 12 : 1;
        rows.push({ id: t.id, label: t.label || categoryLabel(t.category), category: t.category, amount: t.amount / divisor, direction: t.direction, property_id: pid });
        if (t.category === "loan") hasLoanTx = true;
        else if (t.category === "tax") hasTaxTx = true;
        else if (t.category === "insurance") hasInsuranceTx = true;
        else if (t.category === "copro") hasCoproTx = true;
      }

      const fin = pf.get(pid);
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
          (hasInsuranceTx ? 0 : Number(fin.pno_insurance_monthly || 0)) +
          (hasCoproTx ? 0 : Number(fin.copro_charges_monthly || 0)) +
          Number(fin.bank_fees_monthly || 0) +
          Number(fin.maintenance_monthly || 0) +
          Number(fin.rental_tax_monthly || 0);
        if (fixed > 0) rows.push({ id: `pf-fixed-${pid}`, label: "Charges fixes", category: "fees", amount: fixed, direction: "out", property_id: pid });
      }
    }

    return rows;
  }, [chartDrillKey, analysisPropertyIds, recurringParentTxByProperty, pf]);

  const chartMax = useMemo(
    () => Math.max(1, ...accountingChartRows.flatMap((row) => [row.income, row.expense, row.recurring, Math.abs(row.net)])),
    [accountingChartRows]
  );

  const accountingChartData = useMemo(
    () => ({
      labels: accountingChartRows.map((row) => row.label),
      datasets: [
        {
          type: "bar" as const,
          label: "Revenus encaissés",
          data: accountingChartRows.map((row) => row.income),
          backgroundColor: "rgba(16, 185, 129, 0.82)",
          borderColor: "rgb(5, 150, 105)",
          borderWidth: 1,
          borderRadius: 8,
          stack: "income",
          barPercentage: 0.72,
          categoryPercentage: 0.72,
        },
        {
          type: "bar" as const,
          label: "Dépenses ponctuelles",
          data: accountingChartRows.map((row) => row.expense),
          backgroundColor: "rgba(244, 63, 94, 0.78)",
          borderColor: "rgb(225, 29, 72)",
          borderWidth: 1,
          borderRadius: 0,
          stack: "expenses",
          barPercentage: 0.72,
          categoryPercentage: 0.72,
        },
        {
          type: "bar" as const,
          label: "Charges structurelles",
          data: accountingChartRows.map((row) => row.recurring),
          backgroundColor: "rgba(245, 158, 11, 0.7)",
          borderColor: "rgb(217, 119, 6)",
          borderWidth: 1,
          borderRadius: 8,
          stack: "expenses",
          barPercentage: 0.72,
          categoryPercentage: 0.72,
        },
        {
          type: "line" as const,
          label: "Cashflow mensuel",
          data: accountingChartRows.map((row) => row.net),
          borderColor: "rgb(15, 23, 42)",
          backgroundColor: "rgba(15, 23, 42, 0.08)",
          pointBackgroundColor: "rgb(15, 23, 42)",
          pointBorderColor: "white",
          pointBorderWidth: 2,
          pointRadius: 4,
          tension: 0.35,
          yAxisID: "y",
        },
      ],
    }),
    [accountingChartRows]
  );

  const accountingChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_event: any, elements: any[]) => {
        const idx = elements[0]?.index;
        if (idx !== undefined) setChartDrillKey(accountingChartRows[idx]?.key ?? null);
      },
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: { usePointStyle: true, boxWidth: 8, color: "#475569", font: { size: 12, weight: "600" as const } },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${formatEuro(Number(ctx.raw || 0))}`,
            footer: (items: any[]) => {
              const item = items?.[0];
              const row = accountingChartRows[item?.dataIndex ?? -1];
              if (!row) return "";
              return `Net = ${formatEuro(row.income)} − ${formatEuro(row.expense)} − ${formatEuro(row.recurring)} (struct.) = ${formatEuro(row.net)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#64748b", font: { size: 11, weight: "600" as const } },
        },
        y: {
          suggestedMax: chartMax * 1.15,
          grid: { color: "rgba(148, 163, 184, 0.22)" },
          ticks: {
            color: "#64748b",
            callback: (value: any) => formatEuro(Number(value)).replace(",00", ""),
          },
        },
      },
    }),
    [accountingChartRows, chartMax]
  );

  const accountingChartInsight = useMemo(() => {
    if (accountingChartRows.length === 0) return null;
    const worst = accountingChartRows.reduce((min, row) => (row.net < min.net ? row : min), accountingChartRows[0]);
    const best = accountingChartRows.reduce((max, row) => (row.net > max.net ? row : max), accountingChartRows[0]);
    const totalMonths = accountingChartRows.length;
    const positiveMonths = accountingChartRows.filter((row) => row.net >= 0).length;
    return { worst, best, totalMonths, positiveMonths };
  }, [accountingChartRows]);

  const expenseBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const row of periodLedger.rows) {
      if (row.direction !== "out") continue;
      if (isRecurringFlow(row)) continue; // déjà compté dans les charges structurelles du graphe
      if (DEPOSIT_TRANSIT_CATEGORIES.includes(row.category)) continue;
      byCategory.set(row.category, (byCategory.get(row.category) || 0) + Number(row.amount || 0));
    }
    return Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, label: categoryLabel(category), amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [periodLedger.rows]);

  const applyQuickExpense = (preset: (typeof QUICK_EXPENSES)[number]) => {
    setForm((s) => ({
      ...s,
      direction: preset.direction,
      status: preset.status,
      category: preset.category,
      label: preset.label,
      occurred_at: s.occurred_at || toISODate(new Date()),
    }));
  };

  const chapters = [
    { href: "#finance-ecritures", number: "01", label: "Mouvements", sub: `${filteredLedgerSummary.count} ligne${filteredLedgerSummary.count > 1 ? "s" : ""}` },
    { href: "#finance-charges", number: "02", label: "Charges locatives", sub: "Récupérables" },
    { href: "#finance-periode", number: "03", label: "Période", sub: periodLabel },
    { href: "#finance-pilotage", number: "04", label: "Synthèse", sub: "Lecture rapide" },
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5 space-y-4">

      {/* ── En-tête unifié ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Finance</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Finance & Déclaration</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {tab === "finance"
              ? "Loyers, charges, grand livre et bilan par période."
              : "Aide à la déclaration et synthèse fiscale par bien."}
          </p>
        </div>
        {tab === "finance" && (
          <button
            type="button"
            onClick={() => setTxWizardOpen(true)}
            className={cx("inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold", brandBg, brandText, brandHover)}
          >
            <PlusIcon className="h-4 w-4" />
            Nouvelle écriture
          </button>
        )}
      </div>

      {/* ── Onglets ────────────────────────────────────────────────── */}
      <div className="flex rounded-2xl bg-slate-100/80 p-1 gap-1">
        {([
          { key: "finance"     as const, label: "Livre de comptes",    icon: BanknotesIcon },
          { key: "declaration" as const, label: "Déclaration fiscale", icon: DocumentMagnifyingGlassIcon },
        ] as const).map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cx(
                "relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className={cx("h-4 w-4 transition-colors shrink-0", active ? "text-indigo-500" : "text-slate-400")} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Déclaration tab ───────────────────────────────────────── */}
      {tab === "declaration" && <SectionDeclaration userId={userId} properties={properties} propertyFinance={Array.from(pf.values()).filter((fin) => activePropertyIdSet.has(fin.property_id))} />}

      {/* ── Finance tab ───────────────────────────────────────────── */}
      {tab === "finance" && <>
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {ok && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>}

      {/* Controls: period + property + sync */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
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
            onClick={() => { setPeriodPickerOpen(true); if (periodMode !== "custom") setPeriodMode("custom"); }}
            className={cx(
              "rounded-[0.6rem] px-3 py-1.5 text-xs font-semibold transition",
              periodMode === "custom" ? "bg-white shadow-sm text-slate-900" : "text-slate-600 hover:text-slate-800"
            )}
          >
            {periodMode === "custom" ? periodLabel : "Personnalisé"}
          </button>
        </div>

        {activePropertyOptions.length > 1 && (
          <select
            value={analysisPropertyId}
            onChange={(e) => { setAnalysisPropertyId(e.target.value); setFilterPropertyId(""); }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="">Tous les biens</option>
            {activePropertyOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.label || p.address_line1 || "Bien"}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
          <span className={cx(
            "h-1.5 w-1.5 rounded-full",
            syncState === "error" ? "bg-red-400" : syncState === "syncing" ? "animate-pulse bg-cyan-400" : "bg-emerald-400"
          )} />
          <span>
            {syncState === "syncing"
              ? "Synchronisation…"
              : lastSyncedAt
              ? `Màj ${lastSyncedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { label: "Recettes", value: formatEuro(periodLedger.income), cls: "text-emerald-700" },
          { label: "Dépenses", value: formatEuro(periodLedger.expense), cls: "text-rose-700" },
          {
            label: "Cashflow",
            value: formatEuro(sum(accountingChartRows.map((r) => r.net))),
            cls: sum(accountingChartRows.map((r) => r.net)) >= 0 ? "text-emerald-700" : "text-rose-700",
          },
          { label: "Écritures", value: String(filteredLedgerSummary.count), cls: "text-slate-900" },
        ] as const).map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{kpi.label}</p>
            <p className={cx("mt-1 text-xl font-semibold tabular-nums", kpi.cls)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {accountingChartRows.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Recettes & dépenses</p>
              <p className="text-xs text-slate-500">
                {periodLabel}{analysisPropertyId ? ` · ${propsById.get(analysisPropertyId)?.label || "bien sélectionné"}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[0.7rem] font-semibold">
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" />Encaissé {formatEuro(periodLedger.income)}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-800">
                <span className="h-2 w-2 rounded-sm bg-rose-500" />Dépensé {formatEuro(periodLedger.expense)}
              </span>
              {accountingChartRows[0]?.recurring > 0 && (
                <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
                  <span className="h-2 w-2 rounded-sm bg-amber-500" />Structurel {formatEuro(accountingChartRows[0].recurring)}/mois
                </span>
              )}
              <span className={cx(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                sum(accountingChartRows.map((r) => r.net)) >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
              )}>
                Net {formatEuro(sum(accountingChartRows.map((r) => r.net)))}
              </span>
            </div>
          </div>
          <div className="h-[200px] cursor-pointer" title="Cliquer une barre pour voir le détail du mois">
            <Chart type="bar" data={accountingChartData as any} options={accountingChartOptions as any} />
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Compact filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            placeholder="Libellé, bien, catégorie…"
          />
          <div className="flex rounded-xl bg-slate-100 p-0.5 gap-px">
            {([
              { key: "", label: "Tout" },
              { key: "in", label: "↑ Recettes" },
              { key: "out", label: "↓ Dépenses" },
            ]).map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setFilterDirection(opt.key as TxDirection | "")}
                className={cx(
                  "rounded-[0.6rem] px-3 py-1.5 text-xs font-semibold transition",
                  filterDirection === opt.key
                    ? cx("bg-white shadow-sm", opt.key === "in" ? "text-emerald-700" : opt.key === "out" ? "text-rose-700" : "text-slate-900")
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <details className="group relative">
            <summary className={cx(
              "inline-flex cursor-pointer list-none items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold select-none",
              filterCategory || filterStatus || filterSource || filterAmountMin || filterAmountMax || filterPropertyId
                ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}>
              Filtres {filterCategory || filterStatus || filterSource || filterAmountMin || filterAmountMax || filterPropertyId ? "·" : "+"}
            </summary>
            <div className="absolute left-0 top-full z-10 mt-1 w-[min(680px,90vw)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Bien</label>
                  <select value={filterPropertyId} onChange={(e) => setFilterPropertyId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Tous</option>
                    {activePropertyOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.label || p.address_line1 || "Bien"}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Catégorie</label>
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Toutes</option>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Statut</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as TxStatus | "")} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Tous</option>
                    <option value="expected">Prévu</option>
                    <option value="received">Encaissé</option>
                    <option value="paid">Payé</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Source</label>
                  <select value={filterSource} onChange={(e) => setFilterSource(e.target.value as "auto" | "manual" | "")} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Toutes</option>
                    <option value="auto">Quittance auto</option>
                    <option value="manual">Manuel</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Montant min.</label>
                  <input inputMode="decimal" value={filterAmountMin} onChange={(e) => setFilterAmountMin(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Montant max.</label>
                  <input inputMode="decimal" value={filterAmountMax} onChange={(e) => setFilterAmountMax(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="9999" />
                </div>
              </div>
              <button type="button" onClick={resetLedgerFilters} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                <ArrowPathIcon className="h-3.5 w-3.5" /> Réinitialiser
              </button>
            </div>
          </details>
          <button
            type="button"
            onClick={exportFilteredLedger}
            disabled={filteredMonthLedger.length === 0}
            className={cx(
              "ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold",
              filteredMonthLedger.length === 0 ? "bg-slate-100 text-slate-500" : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            )}
            title="Export CSV compatible Excel des lignes affichées."
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          <span>{filteredLedgerSummary.count} écriture{filteredLedgerSummary.count !== 1 ? "s" : ""}</span>
          <span className="font-semibold text-emerald-700">{formatEuro(filteredLedgerSummary.income)} recettes</span>
          <span className="font-semibold text-rose-700">{formatEuro(filteredLedgerSummary.expense)} dépenses</span>
          <span className={cx("font-semibold", filteredLedgerSummary.net >= 0 ? "text-slate-900" : "text-rose-700")}>
            = {formatEuro(filteredLedgerSummary.net)} net
          </span>
        </div>

        {/* Liste compacte (mobile) — une ligne par écriture */}
        <div className="divide-y divide-slate-100 px-3 md:hidden">
          {filteredMonthLedger.length === 0 ? (
            <p className="px-1 py-4 text-sm text-slate-500">Aucune écriture sur cette période (ou filtres trop restrictifs).</p>
          ) : (
            filteredMonthLedger.map((r) => {
              const docs = txDocsByTransactionId.get(r.id) || [];
              const canEdit = !r.receipt_id && !DEPOSIT_CATS.includes(r.category);
              const shortDate = r.occurred_at
                ? new Date(r.occurred_at.slice(0, 10) + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                : "—";

              return (
                <div key={r.id} className="flex items-center gap-2 py-2">
                  <button
                    type="button"
                    disabled={!canEdit}
                    title={canEdit ? "Modifier cette écriture" : undefined}
                    onClick={() => canEdit && openEditTx(r)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="w-12 shrink-0 text-[0.7rem] text-slate-500">{shortDate}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{r.label || categoryLabel(r.category)}</span>
                  </button>

                  <span className={cx("shrink-0 text-sm font-semibold", r.direction === "out" ? "text-rose-700" : "text-emerald-700")}>
                    {r.direction === "out" ? "−" : "+"}{formatEuro(Number(r.amount || 0))}
                  </span>

                  <label
                    title={docs.length ? `${docs.length} pièce${docs.length > 1 ? "s" : ""}` : "Joindre une pièce"}
                    className={cx(
                      "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border",
                      docs.length ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500",
                      uploadingDocId === r.id && "opacity-60"
                    )}
                  >
                    <PaperClipIcon className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploadingDocId === r.id}
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        void attachDocumentFromLedger(r, file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>

                  {canEdit ? (
                    confirmDeleteTxId === r.id ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs">
                        <button type="button" disabled={deleteBusy} onClick={() => { setConfirmDeleteTxId(null); deleteOneTx(r); }} className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-40">Oui</button>
                        <button type="button" onClick={() => setConfirmDeleteTxId(null)} className="text-slate-400 hover:text-slate-600">Non</button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        title="Supprimer cette écriture"
                        disabled={deleteBusy}
                        onClick={() => setConfirmDeleteTxId(r.id)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Table (desktop) */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full table-fixed text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-left">
                <th className="w-[110px] px-3 py-2 text-xs text-slate-600">Date</th>
                <th className="w-[22%] px-3 py-2 text-xs text-slate-600">Bien</th>
                <th className="px-3 py-2 text-xs text-slate-600">Écriture</th>
                <th className="w-[110px] px-3 py-2 text-xs text-slate-600">Statut</th>
                <th className="w-[110px] px-3 py-2 text-xs text-slate-600">Pièce</th>
                <th className="w-[120px] px-3 py-2 text-xs text-slate-600 text-right">Montant</th>
                <th className="w-[88px] px-3 py-2 text-xs text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {filteredMonthLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-slate-500">
                    Aucune écriture sur cette période (ou filtres trop restrictifs).
                  </td>
                </tr>
              ) : (
                filteredMonthLedger.map((r) => {
                  const p = r.property_id ? propsById.get(r.property_id) : null;
                  const docs = txDocsByTransactionId.get(r.id) || [];

                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-700">{fmtDateFR(r.occurred_at)}</td>
                      <td className="truncate px-3 py-2 text-slate-700">{p?.label || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <p className="truncate font-medium text-slate-900 min-w-0">
                              {r.label || categoryLabel(r.category)}
                            </p>
                            {isNew(r.created_at) && <em className="shrink-0 text-[0.65rem] font-medium text-indigo-400">new</em>}
                          </div>
                          <p className="truncate text-xs text-slate-500">
                            {directionLabel(r.direction)} · {categoryLabel(r.category)} · {sourceLabel(r)}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{statusLabel(r.status)}</td>
                      <td className="px-3 py-2">
                        <label className={cx(
                          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                          docs.length ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                          uploadingDocId === r.id && "opacity-60"
                        )}>
                          <PaperClipIcon className="h-3.5 w-3.5" />
                          {uploadingDocId === r.id ? (uploadDocProgress !== null ? `${uploadDocProgress}%` : "…") : docs.length ? `${docs.length} pièce${docs.length > 1 ? "s" : ""}` : "Joindre"}
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={uploadingDocId === r.id}
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              void attachDocumentFromLedger(r, file);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        <span className={r.direction === "out" ? "text-rose-700" : "text-emerald-700"}>
                          {r.direction === "out" ? "−" : "+"}{formatEuro(Number(r.amount || 0))}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {!r.receipt_id && !DEPOSIT_CATS.includes(r.category) ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              title="Modifier cette écriture"
                              onClick={() => openEditTx(r)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              <PencilSquareIcon className="h-3.5 w-3.5" />
                            </button>
                            {confirmDeleteTxId === r.id ? (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <button type="button" disabled={deleteBusy} onClick={() => { setConfirmDeleteTxId(null); deleteOneTx(r); }} className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-40">Oui</button>
                                <button type="button" onClick={() => setConfirmDeleteTxId(null)} className="text-slate-400 hover:text-slate-600">Non</button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                title="Supprimer cette écriture"
                                disabled={deleteBusy}
                                onClick={() => setConfirmDeleteTxId(r.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="border-t border-slate-100 px-4 py-2.5 text-[0.72rem] text-slate-500">
          Les écritures sans boutons (loyers auto, cautions) sont protégées. Pour annuler un loyer confirmé par erreur : <span className="font-semibold">Quittances → sélectionner le mois → Annuler paiement</span>. Cela réinitialise le paiement et retire l'écriture ici.
        </p>
      </div>

      {/* Charges récurrentes actives */}
      {activeRecurringTx.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Abonnements &amp; charges récurrentes</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Générées automatiquement chaque période. Arrêtez-en une dès que le montant évolue.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {activeRecurringTx.length}
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {activeRecurringTx.map((t) => {
              const prop = t.property_id ? propertyById?.get(t.property_id) : null;
              const propertyLabel = prop?.label || prop?.address_line1 || (t.property_id ? "Bien" : "Tous biens");
              const freqLabel = t.recurrence_frequency === "quarterly" ? "/ trimestre" : t.recurrence_frequency === "yearly" ? "/ an" : "/ mois";
              const since = t.recurrence_since || t.occurred_at;
              const sinceFormatted = since ? new Date(since).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "—";
              const displayLabel = t.label || categoryLabel(t.category);
              const isConfirming = confirmStopRecurId === t.id;
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold tracking-wide ${t.direction === "out" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                      {t.direction === "out" ? "Dépense" : "Recette"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{displayLabel}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{formatEuro(t.amount)}{freqLabel}</span>
                        <span className="text-slate-300">·</span>
                        <span>{propertyLabel}</span>
                        <span className="text-slate-300">·</span>
                        <span>depuis {sinceFormatted}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConfirming ? (
                      <span className="inline-flex items-center gap-2 text-xs">
                        <span className="text-slate-500">Confirmer l'arrêt ?</span>
                        <button type="button" disabled={stopBusy} onClick={() => { setConfirmStopRecurId(null); stopRecurring(t); }}
                          className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-40">Oui, arrêter</button>
                        <button type="button" onClick={() => setConfirmStopRecurId(null)} className="text-slate-400 hover:text-slate-600">Annuler</button>
                      </span>
                    ) : (
                      <>
                        <button type="button" disabled={stopBusy || editRecurBusy}
                          onClick={() => { setEditRecurTx(t); setEditRecurForm({ amount: String(t.amount), label: t.label || "" }); setEditRecurScope("future"); }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40">
                          Modifier
                        </button>
                        <button type="button" disabled={stopBusy || editRecurBusy} onClick={() => setConfirmStopRecurId(t.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-40">
                          Arrêter
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="border-t border-slate-100 px-4 py-2.5 text-[0.72rem] text-slate-400">
            Pour changer le montant : arrêtez la ligne concernée, puis recréez-en une via <span className="font-semibold text-slate-500">+ Écriture</span>.
          </p>
        </div>
      )}

      {/* Paramètres financiers par bien */}
      <div id="finance-pilotage" className={`overflow-hidden rounded-2xl border bg-white transition-shadow duration-500 ${highlightFinanceConfig ? "border-red-400 ring-2 ring-red-400 ring-offset-2" : "border-slate-200"}`}>
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Paramètres financiers</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Prix d'achat, crédit, assurances, taxes — ces données alimentent Performance et les calculs de rentabilité.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {activePropertyOptions.length === 0 ? (
            <p className="px-4 py-5 text-sm text-slate-500">Créez d'abord un bien pour renseigner ses paramètres financiers.</p>
          ) : (
            activePropertyOptions.map((property) => {
              const existing = pf.get(property.id) || null;
              const recurringData = monthlyRecurringByProperty.get(property.id);
              const hasLoanRecurringTx = (recurringParentTxByProperty.get(property.id) || []).some((t) => t.category === "loan");
              const loanMonthly = recurringData?.loan || 0;
              const taxesMonthly = recurringData?.taxM || 0;
              const operatingMonthly = recurringData?.fixed || 0;
              const monthlyTotal = loanMonthly + taxesMonthly + operatingMonthly;
              const missing = [
                !existing?.purchase_price ? "prix d'achat" : "",
                !existing?.loan_rate_percent ? "taux crédit" : "",
              ].filter(Boolean);
              const optionalMissing = [
                !hasLoanRecurringTx && !existing?.loan_monthly ? "crédit" : "",
                !existing?.tax_regime ? "régime" : "",
              ].filter(Boolean);

              return (
                <div key={property.id} id={`finance-property-${property.id}`}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-slate-50"
                    onClick={() => setOpenFinanceProps((prev) => {
                      const next = new Set(prev);
                      next.has(property.id) ? next.delete(property.id) : next.add(property.id);
                      return next;
                    })}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <svg className={cx("h-3 w-3 shrink-0 text-slate-400 transition-transform", openFinanceProps.has(property.id) && "rotate-90")} viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4-4 4"/></svg>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                          {(property.label || property.address_line1 || "B").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{property.label || property.address_line1 || "Bien"}</p>
                          <p className="truncate text-xs text-slate-500">
                            {missing.length
                              ? `À renseigner : ${missing.join(", ")}`
                              : optionalMissing.length
                              ? `À affiner : ${optionalMissing.join(", ")}`
                              : "Paramètres complets"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden grid-cols-[5.5rem_5rem_4rem_3.5rem_7rem] gap-x-4 text-xs text-slate-600 sm:grid">
                          <LineMetric label="Total/mois" value={formatEuro(monthlyTotal)} strong />
                          <LineMetric label="Crédit" value={formatEuro(loanMonthly)} />
                          <LineMetric label="Taxes" value={formatEuro(taxesMonthly)} />
                          <LineMetric label="Taux" value={existing?.loan_rate_percent ? `${Number(existing.loan_rate_percent).toLocaleString("fr-FR")} %` : "—"} />
                          <LineMetric label="Régime" value={existing?.tax_regime ? taxRegimeLabel(existing.tax_regime) : "—"} />
                        </div>
                        {!openFinanceProps.has(property.id) && (
                          <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                            Modifier
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  {openFinanceProps.has(property.id) && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 pb-4">
                      <PropertyFinanceForm propertyId={property.id} existing={existing} onSave={upsertPropertyFinance} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {txWizardOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-sm sm:items-center">
          <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={() => { setTxWizardOpen(false); setInvoiceFile(null); }} />
          <form onSubmit={addTx} className="relative max-h-[92vh] w-full max-w-4xl overflow-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <BanknotesIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Nouvelle écriture</p>
                  <p className="text-[0.8rem] text-slate-600">Étape 1 : type • Étape 2 : montant • Étape 3 : qualification.</p>
                </div>
              </div>
            </div>

            <button type="button" onClick={() => { setTxWizardOpen(false); setInvoiceFile(null); }} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label="Fermer">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setForm((s) => ({ ...s, direction: "out", status: "paid", category: s.category === "rent" ? "fees" : s.category }))}
              className={cx(
                "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
                form.direction === "out" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <ArrowDownCircleIcon className={cx("mt-0.5 h-5 w-5", form.direction === "out" ? "text-red-600" : "text-slate-500")} />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Dépense</span>
                <span className="mt-0.5 block text-xs text-slate-600">Travaux, taxe foncière, assurance, copro, crédit.</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setForm((s) => ({ ...s, direction: "in", status: "received", category: s.category === "rent" ? "rent" : "other" }))}
              className={cx(
                "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
                form.direction === "in" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <ArrowUpCircleIcon className={cx("mt-0.5 h-5 w-5", form.direction === "in" ? "text-emerald-600" : "text-slate-500")} />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Recette</span>
                <span className="mt-0.5 block text-xs text-slate-600">Remboursement, revenu exceptionnel ou régularisation.</span>
              </span>
            </button>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modèles rapides</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_EXPENSES.map((preset) => (
                <button
                  key={preset.category}
                  type="button"
                  onClick={() => applyQuickExpense(preset)}
                  className={cx(
                    "flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition",
                    form.category === preset.category
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <span>{preset.label}</span>
                  <PlusIcon className="h-4 w-4 opacity-80" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Montant et affectation</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Montant</label>
                  <div className="mt-1 flex items-center rounded-2xl border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-900">
                    <input
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                      className="min-w-0 flex-1 border-0 bg-transparent text-2xl font-semibold text-slate-900 outline-none"
                      placeholder="0"
                    />
                    <span className="text-sm font-semibold text-slate-500">EUR</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Date</label>
                  <input
                    type="date"
                    value={form.occurred_at}
                    onChange={(e) => setForm((s) => ({ ...s, occurred_at: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Bien concerné *</label>
                  <select
                    value={form.property_id}
                    onChange={(e) => setForm((s) => ({ ...s, property_id: e.target.value }))}
                    className={cx(
                      "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm",
                      !form.property_id ? "border-red-300 text-slate-400" : "border-slate-300 text-slate-900"
                    )}
                  >
                    <option value="" disabled>Sélectionner un bien…</option>
                    {selectableFormPropertyOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label || "Bien"}
                      </option>
                    ))}
                  </select>
                  {!form.property_id && (
                    <p className="mt-1 text-[0.7rem] text-red-600">Champ obligatoire</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Qualification</p>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Catégorie</label>
                  <select
                    value={form.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const def = CATEGORIES.find((c) => c.value === cat);
                      setForm((s) => ({
                        ...s,
                        category: cat,
                        direction: def?.dir ? def.dir : s.direction,
                      }));
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Statut</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as TxStatus }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="expected">Prévu</option>
                    <option value="received">Encaissé</option>
                    <option value="paid">Payé</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-700">Libellé</label>
              <input
                value={form.label}
                onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex : Assurance PNO, taxe foncière, réparation plomberie"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Note interne</label>
              <input
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Optionnel : facture, période, précision comptable"
              />
            </div>
          </div>

          {/* Charge récurrente */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={() => setForm((s) => ({ ...s, is_recurring: !s.is_recurring }))}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className={cx(
                  "flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                  form.is_recurring ? "bg-indigo-600" : "bg-slate-300"
                )}>
                  <span className={cx(
                    "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                    form.is_recurring ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </span>
                <span className="text-sm font-semibold text-slate-900">Charge récurrente</span>
              </div>
              <span className="text-xs text-slate-500">
                {form.is_recurring ? "Se répète automatiquement" : "Ponctuelle"}
              </span>
            </button>

            {form.is_recurring && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Fréquence</label>
                  <select
                    value={form.recurrence_frequency}
                    onChange={(e) => setForm((s) => ({ ...s, recurrence_frequency: e.target.value as "monthly" | "quarterly" | "yearly" }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="monthly">Mensuelle</option>
                    <option value="quarterly">Trimestrielle</option>
                    <option value="yearly">Annuelle</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Depuis le</label>
                  <input
                    type="date"
                    value={form.recurrence_since}
                    onChange={(e) => setForm((s) => ({ ...s, recurrence_since: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Jusqu'au (optionnel)</label>
                  <input
                    type="date"
                    value={form.recurrence_end_date}
                    onChange={(e) => setForm((s) => ({ ...s, recurrence_end_date: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Indéfini"
                  />
                </div>
                <div className="sm:col-span-3">
                  <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs leading-5 text-indigo-800">
                    lokt.fr va créer une écriture pour chaque période passée depuis le{" "}
                    <strong>{form.recurrence_since}</strong> et projeter les prochaines dans le graphe Finance.
                    Vous pouvez joindre une pièce justificative à l'écriture de référence ci-dessous.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Facture / justificatif</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {invoiceFile ? invoiceFile.name : "Aucun fichier joint"}
                </p>
                <p className="mt-1 text-xs text-slate-500">PDF ou image, 10 Mo maximum. Le fichier apparaîtra dans Documents puis Factures.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
                <DocumentArrowUpIcon className="h-4 w-4" />
                {invoiceFile ? "Remplacer" : "Joindre"}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => setInvoiceFile(event.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-xs text-cyan-950 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Les loyers confirmés via le workflow quittance remontent automatiquement. Cette saisie sert surtout aux charges,
              frais et recettes exceptionnelles.
            </p>
            <button
              type="submit"
              disabled={loading || !userId}
              className={cx(
                "inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold",
                brandBg,
                brandText,
                brandHover,
                (loading || !userId) && "opacity-60"
              )}
            >
              <PlusIcon className="h-4 w-4" />
              {loading ? "Ajout…" : "Ajouter l'écriture"}
            </button>
          </div>
        </div>
      </form>
        </div>
      ) : null}

      {/* Modal modification charge récurrente */}
      {editRecurTx && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-sm sm:items-center">
          <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={() => setEditRecurTx(null)} />
          <div className="relative w-full max-w-lg overflow-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <PencilSquareIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Modifier la récurrente</p>
                    <p className="text-[0.8rem] text-slate-500 truncate max-w-[16rem]">{editRecurTx.label || categoryLabel(editRecurTx.category)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setEditRecurTx(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label="Fermer">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Libellé */}
              <div>
                <label className="text-xs font-semibold text-slate-700">Libellé</label>
                <input
                  type="text"
                  value={editRecurForm.label}
                  onChange={(e) => setEditRecurForm((s) => ({ ...s, label: e.target.value }))}
                  placeholder={categoryLabel(editRecurTx.category)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                />
              </div>

              {/* Montant */}
              <div>
                <label className="text-xs font-semibold text-slate-700">Nouveau montant</label>
                <div className="mt-1 flex items-center rounded-2xl border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-900">
                  <input
                    inputMode="decimal"
                    value={editRecurForm.amount}
                    onChange={(e) => setEditRecurForm((s) => ({ ...s, amount: e.target.value }))}
                    className="min-w-0 flex-1 border-0 bg-transparent text-xl font-semibold text-slate-900 outline-none"
                    placeholder="0"
                  />
                  <span className="text-sm font-semibold text-slate-500">EUR</span>
                </div>
              </div>

              {/* Scope */}
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700">Appliquer ce changement…</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditRecurScope("future")}
                    className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition ${editRecurScope === "future" ? "border-[#635bff] bg-[#635bff]/5 ring-1 ring-[#635bff]" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <span className="text-sm font-semibold text-slate-900">À partir de maintenant</span>
                    <span className="text-xs text-slate-500">Les occurrences passées restent inchangées. Seules les prochaines utilisent le nouveau montant.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditRecurScope("all")}
                    className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition ${editRecurScope === "all" ? "border-[#635bff] bg-[#635bff]/5 ring-1 ring-[#635bff]" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <span className="text-sm font-semibold text-slate-900">Depuis le début</span>
                    <span className="text-xs text-slate-500">Toutes les occurrences existantes (passées et futures) sont mises à jour avec le nouveau montant.</span>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setEditRecurTx(null)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Annuler
                </button>
                <button type="button" disabled={editRecurBusy} onClick={saveEditRecurring}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                  {editRecurBusy ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition écriture */}
      {editTxOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-sm sm:items-center">
          <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={() => setEditTxOpen(false)} />
          <form onSubmit={updateTx} className="relative max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <PencilSquareIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Modifier l'écriture</p>
                    <p className="text-[0.8rem] text-slate-600">Seules les lignes manuelles sont modifiables.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setEditTxOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label="Fermer">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Recette / Dépense */}
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setEditForm((s) => ({ ...s, direction: "out", status: "paid", category: s.category === "rent" ? "fees" : s.category }))}
                  className={cx(
                    "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    editForm.direction === "out" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <ArrowDownCircleIcon className={cx("mt-0.5 h-5 w-5", editForm.direction === "out" ? "text-red-600" : "text-slate-500")} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Dépense</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm((s) => ({ ...s, direction: "in", status: "received" }))}
                  className={cx(
                    "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    editForm.direction === "in" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <ArrowUpCircleIcon className={cx("mt-0.5 h-5 w-5", editForm.direction === "in" ? "text-emerald-600" : "text-slate-500")} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Recette</span>
                  </span>
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Montant</label>
                  <div className="mt-1 flex items-center rounded-2xl border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-900">
                    <input
                      inputMode="decimal"
                      value={editForm.amount}
                      onChange={(e) => setEditForm((s) => ({ ...s, amount: e.target.value }))}
                      className="min-w-0 flex-1 border-0 bg-transparent text-xl font-semibold text-slate-900 outline-none"
                      placeholder="0"
                    />
                    <span className="text-sm font-semibold text-slate-500">EUR</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Date</label>
                  <input
                    type="date"
                    value={editForm.occurred_at}
                    onChange={(e) => setEditForm((s) => ({ ...s, occurred_at: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Bien concerné *</label>
                  <select
                    value={editForm.property_id}
                    onChange={(e) => setEditForm((s) => ({ ...s, property_id: e.target.value }))}
                    className={cx(
                      "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm",
                      !editForm.property_id ? "border-red-300 text-slate-400" : "border-slate-300 text-slate-900"
                    )}
                  >
                    <option value="" disabled>Sélectionner un bien…</option>
                    {selectableEditPropertyOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.label || "Bien"}</option>
                    ))}
                  </select>
                  {!editForm.property_id && (
                    <p className="mt-1 text-[0.7rem] text-red-600">Champ obligatoire</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Catégorie</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const def = CATEGORIES.find((c) => c.value === cat);
                      setEditForm((s) => ({ ...s, category: cat, direction: def?.dir ? def.dir : s.direction }));
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Statut</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value as TxStatus }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="expected">Prévu</option>
                    <option value="received">Encaissé</option>
                    <option value="paid">Payé</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Libellé</label>
                  <input
                    value={editForm.label}
                    onChange={(e) => setEditForm((s) => ({ ...s, label: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Ex : Assurance PNO, taxe foncière…"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Note interne</label>
                  <input
                    value={editForm.notes}
                    onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Optionnel"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditTxOpen(false)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold",
                    `${brandBg} ${brandText} ${brandHover}`,
                    loading && "opacity-60"
                  )}
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  {loading ? "Modification…" : "Enregistrer les modifications"}
                </button>
              </div>
            </div>
          </form>
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
              Période sélectionnée : <span className="font-semibold text-slate-900">{fmtPeriodFR("custom", currentMonth, customStartMonth, customEndMonth)}</span>
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
                onClick={() => {
                  setPeriodMode("custom");
                  setPeriodPickerOpen(false);
                }}
                className={cx("rounded-full px-4 py-2 text-sm font-semibold", brandBg, brandText, brandHover)}
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Chart drill-down modal */}
      {chartDrillKey && (() => {
        const drillRow = accountingChartRows.find((r) => r.key === chartDrillKey);
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
                    {drillRow?.label ?? chartDrillKey}
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
                              <p className="font-medium text-slate-900">{r.label || categoryLabel(r.category)}</p>
                              <p className="text-xs text-slate-400">
                                {categoryLabel(r.category)}{propLabel ? <> · <span className="text-indigo-500">{propLabel}</span></> : null}
                              </p>
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
                                    {categoryLabel(r.category)}{propLabel ? <> · <span className="text-indigo-500">{propLabel}</span></> : null}
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
              {drillRow && (
                <div className="flex flex-wrap gap-3 border-t border-slate-100 px-5 py-3 text-xs">
                  <span className="font-semibold text-emerald-700">Revenus {formatEuro(drillRow.income)}</span>
                  <span className="font-semibold text-rose-600">Dépenses {formatEuro(drillRow.expense)}</span>
                  {drillRow.recurring > 0 && (
                    <span className="font-semibold text-amber-700">Structurel {formatEuro(drillRow.recurring)}</span>
                  )}
                  <span className={cx("ml-auto font-bold", drillRow.net >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    Net {formatEuro(drillRow.net)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
      </>}
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{sub}</p>
    </div>
  );
}

function ChapterHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">{eyebrow}</p>
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="max-w-3xl text-sm text-slate-600">{desc}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LineMetric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={cx("mt-0.5 text-sm font-semibold", strong ? "text-slate-950" : "text-slate-700")}>{value}</p>
    </div>
  );
}

function taxRegimeLabel(value: string) {
  const labels: Record<string, string> = {
    lmnp_micro: "LMNP micro-BIC",
    lmnp_real: "LMNP réel",
    nu_micro: "Location nue micro",
    nu_real: "Location nue réel",
    pinel: "Pinel",
  };
  return labels[value] || value;
}

function PropertyFinanceForm({
  propertyId,
  existing,
  onSave,
}: {
  propertyId: string;
  existing: PropertyFinance | null;
  onSave: (propertyId: string, patch: Partial<PropertyFinance>) => Promise<void>;
}) {
  const fromExisting = (ex: PropertyFinance | null): PropertyFinance => ({
    property_id: propertyId,
    user_id: "",
    purchase_price: ex?.purchase_price ?? null,
    notary_fees: ex?.notary_fees ?? null,
    agency_fees: ex?.agency_fees ?? null,
    works: ex?.works ?? null,
    down_payment: ex?.down_payment ?? null,
    loan_monthly: ex?.loan_monthly ?? null,
    loan_insurance_monthly: ex?.loan_insurance_monthly ?? null,
    loan_rate_percent: ex?.loan_rate_percent ?? null,
    loan_remaining_months: ex?.loan_remaining_months ?? null,
    loan_end_year: ex?.loan_end_year ?? estimatedLoanEndYear(ex?.loan_remaining_months),
    tax_regime: ex?.tax_regime ?? null,
    fixed_charges_monthly: ex?.fixed_charges_monthly ?? null,
    fixed_charges_frequency: ex?.fixed_charges_frequency || "monthly",
    property_tax_yearly: ex?.property_tax_yearly ?? null,
    pno_insurance_monthly: ex?.pno_insurance_monthly ?? null,
    copro_charges_monthly: ex?.copro_charges_monthly ?? null,
    cfe_yearly: ex?.cfe_yearly ?? null,
    loan_interest_monthly: ex?.loan_interest_monthly ?? null,
    bank_fees_monthly: ex?.bank_fees_monthly ?? null,
    maintenance_monthly: ex?.maintenance_monthly ?? null,
    rental_tax_monthly: ex?.rental_tax_monthly ?? null,
    recurring_since: ex?.recurring_since ?? null,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [s, setS] = useState<PropertyFinance>(() => fromExisting(existing));

  useEffect(() => {
    setS(fromExisting(existing));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (hasFieldErrors) return;
    setSaving(true);
    setSaved(false);
    try {
      await onSave(propertyId, {
        purchase_price: s.purchase_price,
        notary_fees: s.notary_fees,
        agency_fees: s.agency_fees,
        works: s.works,
        down_payment: s.down_payment,
        loan_monthly: s.loan_monthly,
        loan_insurance_monthly: s.loan_insurance_monthly,
        loan_rate_percent: s.loan_rate_percent,
        loan_end_year: s.loan_end_year,
        loan_remaining_months: null,
        tax_regime: s.tax_regime,
        fixed_charges_monthly: s.fixed_charges_monthly,
        fixed_charges_frequency: s.fixed_charges_frequency || "monthly",
        property_tax_yearly: s.property_tax_yearly,
        pno_insurance_monthly: s.pno_insurance_monthly,
        copro_charges_monthly: s.copro_charges_monthly,
        cfe_yearly: s.cfe_yearly,
        loan_interest_monthly: s.loan_interest_monthly,
        bank_fees_monthly: s.bank_fees_monthly,
        maintenance_monthly: s.maintenance_monthly,
        rental_tax_monthly: s.rental_tax_monthly,
        recurring_since: s.recurring_since || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const fixedChargesFrequency = s.fixed_charges_frequency || "monthly";
  const fixedChargesDisplay = displayAmountFromMonthly(s.fixed_charges_monthly, fixedChargesFrequency);

  const totalInvested =
    (s.purchase_price || 0) + (s.notary_fees || 0) + (s.agency_fees || 0) + (s.works || 0);
  const isLmnpReal = s.tax_regime === "lmnp_real";

  const currentYear = new Date().getFullYear();
  const fieldErrors: Partial<Record<keyof PropertyFinance, string>> = {};
  if (s.purchase_price != null && s.purchase_price < 0) fieldErrors.purchase_price = "Ne peut pas être négatif.";
  if (s.notary_fees != null && s.notary_fees < 0) fieldErrors.notary_fees = "Ne peut pas être négatif.";
  if (s.agency_fees != null && s.agency_fees < 0) fieldErrors.agency_fees = "Ne peut pas être négatif.";
  if (s.works != null && s.works < 0) fieldErrors.works = "Ne peut pas être négatif.";
  if (s.down_payment != null && s.down_payment < 0) {
    fieldErrors.down_payment = "Ne peut pas être négatif.";
  } else if (s.down_payment != null && totalInvested > 0 && s.down_payment > totalInvested) {
    fieldErrors.down_payment = `Ne peut pas dépasser le total investi (${totalInvested.toLocaleString("fr-FR")} €).`;
  }
  if (s.loan_rate_percent != null && (s.loan_rate_percent < 0 || s.loan_rate_percent > 20)) {
    fieldErrors.loan_rate_percent = "Taux hors plage réaliste (0 à 20 %).";
  }
  if (s.loan_end_year != null && (s.loan_end_year < currentYear - 1 || s.loan_end_year > currentYear + 40)) {
    fieldErrors.loan_end_year = `Année entre ${currentYear - 1} et ${currentYear + 40}.`;
  }
  if (s.loan_monthly != null && s.loan_monthly < 0) fieldErrors.loan_monthly = "Ne peut pas être négatif.";
  if (s.loan_interest_monthly != null && s.loan_interest_monthly < 0) {
    fieldErrors.loan_interest_monthly = "Ne peut pas être négatif.";
  }
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return (
    <form onSubmit={save} className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">

      {/* Bandeau */}
      <div className="flex items-start gap-3 border-b border-slate-100 bg-indigo-50 px-5 py-3.5">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 4.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.25 7a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0V7z"/></svg>
        </div>
        <p className="text-[0.72rem] leading-5 text-indigo-800">
          Crédit, assurance, copropriété… se saisissent via{" "}
          <strong className="font-semibold text-indigo-900">Nouvelle écriture &gt; Charge récurrente</strong>{" "}
          pour apparaître dans le grand livre et dans le graphe.
        </p>
      </div>

      <div className="divide-y divide-slate-100 px-5">

        {/* Acquisition */}
        <div className="py-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Acquisition</p>
            {totalInvested > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                Total investi : {totalInvested.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Prix d’achat" value={s.purchase_price} onChange={(v) => setS((p) => ({ ...p, purchase_price: v }))} error={fieldErrors.purchase_price} />
            <Field label="Frais de notaire" value={s.notary_fees} onChange={(v) => setS((p) => ({ ...p, notary_fees: v }))} error={fieldErrors.notary_fees} />
            <Field label="Frais d’agence" value={s.agency_fees} onChange={(v) => setS((p) => ({ ...p, agency_fees: v }))} error={fieldErrors.agency_fees} />
            <Field label="Travaux" value={s.works} onChange={(v) => setS((p) => ({ ...p, works: v }))} error={fieldErrors.works} />
          </div>
        </div>

        {/* Financement */}
        <div className="py-5">
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Financement</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Apport personnel" value={s.down_payment} onChange={(v) => setS((p) => ({ ...p, down_payment: v }))} error={fieldErrors.down_payment} />
            <Field label="Taux du crédit (%)" value={s.loan_rate_percent ?? null} onChange={(v) => setS((p) => ({ ...p, loan_rate_percent: v }))} error={fieldErrors.loan_rate_percent} />
            <Field
              label="Fin du crédit (année)"
              value={s.loan_end_year ?? null}
              integer
              placeholder="Ex. 2043"
              onChange={(v) => setS((p) => ({ ...p, loan_end_year: v == null ? null : Math.round(v) }))}
              error={fieldErrors.loan_end_year}
            />
            <Field
              label="Mensualité crédit + assurance (€)"
              value={s.loan_monthly ?? null}
              placeholder="Ex. 762.96"
              onChange={(v) => setS((p) => ({ ...p, loan_monthly: v }))}
              error={fieldErrors.loan_monthly}
            />
          </div>
          <p className="mt-2 text-[0.68rem] leading-4 text-slate-400">
            Utilisé pour le calcul de rentabilité. Pour le suivi des paiements mois par mois, créez aussi une Charge récurrente dans le grand livre.
          </p>
        </div>

        {/* Régime fiscal */}
        <div className="py-5">
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Régime fiscal</p>
          <div className={cx("grid gap-3", isLmnpReal ? "sm:grid-cols-2" : "sm:grid-cols-1 max-w-xs")}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Régime applicable</label>
              <select
                value={s.tax_regime || ""}
                onChange={(e) => setS((p) => ({ ...p, tax_regime: e.target.value || null }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Non renseigné</option>
                <option value="lmnp_micro">LMNP micro-BIC</option>
                <option value="lmnp_real">LMNP réel</option>
                <option value="nu_micro">Location nue micro-foncier</option>
                <option value="nu_real">Location nue réel</option>
                <option value="pinel">Pinel</option>
              </select>
            </div>
            {isLmnpReal && (
              <Field
                label="Intérêts d’emprunt mensuels"
                value={s.loan_interest_monthly ?? null}
                onChange={(v) => setS((p) => ({ ...p, loan_interest_monthly: v }))}
                hint="Depuis le tableau d’amortissement — pour la déclaration LMNP réel uniquement."
                error={fieldErrors.loan_interest_monthly}
              />
            )}
          </div>
        </div>

      </div>

      {/* Footer enregistrer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3.5">
        {saved ? (
          <span className="text-sm font-semibold text-emerald-700">Configuration enregistrée ✓</span>
        ) : hasFieldErrors ? (
          <span className="text-xs font-semibold text-red-600">Corrigez les champs en rouge avant d’enregistrer.</span>
        ) : (
          <span className="text-xs text-slate-400">Ces données calculent le rendement et le cashflow théorique.</span>
        )}
        <button
          type="submit"
          disabled={saving || hasFieldErrors}
          className={cx(
            "inline-flex min-h-[38px] items-center rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60",
            saving ? "cursor-wait" : hasFieldErrors ? "cursor-not-allowed" : "",
            saved ? "bg-emerald-700" : "bg-slate-900 hover:bg-slate-800"
          )}
        >
          {saving ? "Enregistrement…" : saved ? "Enregistré ✓" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  integer = false,
  placeholder = "—",
  hint,
  error,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  integer?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string | null;
}) {
  const [draft, setDraft] = useState(formatInputNumber(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatInputNumber(value));
  }, [focused, value]);

  const commit = (raw: string) => {
    const clean = raw.trim();
    if (!clean) {
      onChange(null);
      setDraft("");
      return;
    }
    const parsed = nullableNum(clean);
    if (parsed == null) return;
    const next = integer ? Math.round(parsed) : parsed;
    onChange(next);
    setDraft(formatInputNumber(next));
  };

  return (
    <div className="space-y-1">
      {label ? <label className="text-xs text-slate-600">{label}</label> : null}
      <input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        value={draft}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit(draft);
        }}
        onChange={(e) => {
          const v = e.target.value;
          if (!hasValidDecimalDraft(v)) return;
          setDraft(v);
          if (!v.trim()) {
            onChange(null);
            return;
          }
          if (/[,.]$/.test(v.trim())) return;
          const parsed = nullableNum(v);
          if (parsed != null) onChange(integer ? Math.round(parsed) : parsed);
        }}
        className={cx(
          "w-full rounded-lg border bg-white px-3 py-2 text-sm",
          error ? "border-red-300 focus:border-red-400" : "border-slate-300"
        )}
        placeholder={placeholder}
      />
      {error ? (
        <p className="text-[0.68rem] leading-4 text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[0.68rem] leading-4 text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
