// components/landlord/sections/SectionFinance.tsx
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownCircleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpCircleIcon,
  BanknotesIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
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

  created_at: string;
  updated_at: string;
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
  tax_regime?: string | null;

  fixed_charges_monthly: number | null;
  property_tax_yearly: number | null;
  pno_insurance_monthly?: number | null;
  copro_charges_monthly?: number | null;
  cfe_yearly?: number | null;
  loan_interest_monthly?: number | null;
  bank_fees_monthly?: number | null;
  maintenance_monthly?: number | null;

  created_at?: string;
  updated_at?: string;
};

type Props = {
  userId: string;
  leases?: Lease[];
  payments?: RentPayment[];
  receipts?: Receipt[];
  propertyById?: Map<string, Property>;
  onRefresh?: () => Promise<void> | void;
};

const toMonthISO = (d: Date) => d.toISOString().slice(0, 7); // YYYY-MM
const toISODate = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

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
    const year = anchorStart.getFullYear();
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
  }
  if (mode === "last6") {
    return { start: addMonths(anchorStart, -5), end: anchorEnd };
  }
  return { start: anchorStart, end: anchorEnd };
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
  if (mode === "year") return String(start.getFullYear());
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
  { value: "loan", label: "Crédit (mensualité)", dir: "out" },
  { value: "other", label: "Autre", dir: undefined },
];

const categoryLabel = (value: string) => CATEGORIES.find((c) => c.value === value)?.label || value;
const statusLabel = (value: TxStatus) =>
  value === "expected" ? "Prévu" : value === "received" ? "Encaissé" : "Payé";
const directionLabel = (value: TxDirection) => (value === "in" ? "Recette" : "Dépense");
const sourceLabel = (tx: Transaction) => (tx.receipt_id ? "Quittance auto" : "Manuel");

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

const csvCell = (value: string | number | null | undefined) => {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

export function SectionFinance({ userId, leases, payments, receipts, propertyById, onRefresh }: Props) {
  // 🎨 lokt.fr
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  const safeLeases = Array.isArray(leases) ? leases : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeReceipts = Array.isArray(receipts) ? receipts : [];
  const propsById = propertyById instanceof Map ? propertyById : new Map<string, Property>();

  const currentMonth = useMemo(() => toMonthISO(new Date()), []);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [customStartMonth, setCustomStartMonth] = useState<string>(toMonthISO(addMonths(new Date(), -2)));
  const [customEndMonth, setCustomEndMonth] = useState<string>(toMonthISO(new Date()));
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [analysisPropertyId, setAnalysisPropertyId] = useState<string>("");

  // Ledger
  const [tx, setTx] = useState<Transaction[]>([]);
  const [pf, setPf] = useState<Map<string, PropertyFinance>>(new Map());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filtres liste
  const [filterPropertyId, setFilterPropertyId] = useState<string>("");
  const [filterDirection, setFilterDirection] = useState<TxDirection | "">("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<TxStatus | "">("");
  const [filterSource, setFilterSource] = useState<"auto" | "manual" | "">("");
  const [filterAmountMin, setFilterAmountMin] = useState<string>("");
  const [filterAmountMax, setFilterAmountMax] = useState<string>("");
  const [filterText, setFilterText] = useState<string>("");

  // Sélection pour suppression
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [txWizardOpen, setTxWizardOpen] = useState(false);

  const propertyOptions = useMemo(
    () =>
      Array.from(propsById.values()).sort((a, b) =>
        String(a.label || a.address_line1 || "").localeCompare(String(b.label || b.address_line1 || ""))
      ),
    [propsById]
  );

  const leasePropertyById = useMemo(() => {
    const map = new Map<string, string>();
    for (const lease of safeLeases) {
      if ((lease as any)?.id && (lease as any)?.property_id) map.set(String((lease as any).id), String((lease as any).property_id));
    }
    return map;
  }, [safeLeases]);

  const analysisPropertyIds = useMemo(
    () => (analysisPropertyId ? [analysisPropertyId] : propertyOptions.map((property) => property.id)),
    [analysisPropertyId, propertyOptions]
  );

  const monthlyRecurringByProperty = useMemo(() => {
    const map = new Map<string, { loan: number; fixed: number; taxM: number; total: number }>();
    for (const propertyId of analysisPropertyIds) {
      const fin = pf.get(propertyId) || null;
      const loan = Number(fin?.loan_monthly || 0) + Number(fin?.loan_insurance_monthly || 0);
      const fixed =
        Number(fin?.fixed_charges_monthly || 0) +
        Number(fin?.pno_insurance_monthly || 0) +
        Number(fin?.copro_charges_monthly || 0) +
        Number(fin?.bank_fees_monthly || 0) +
        Number(fin?.maintenance_monthly || 0);
      const taxM = Number(fin?.property_tax_yearly || 0) / 12;
      const cfeM = Number(fin?.cfe_yearly || 0) / 12;
      map.set(propertyId, { loan, fixed, taxM: taxM + cfeM, total: loan + fixed + taxM + cfeM });
    }
    return map;
  }, [analysisPropertyIds, pf]);

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
  });

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

    const paymentsByPeriod = new Map(
      safePayments.map((payment) => [
        `${payment.lease_id}:${payment.period_start}:${payment.period_end}`,
        payment,
      ])
    );

    const payload = uniqueReceipts.map((r) => {
      const lease = safeLeases.find((l) => (l as any).id === r.lease_id);
      const payment = paymentsByPeriod.get(`${r.lease_id}:${r.period_start}:${r.period_end}`);
      const fullyPaid = !!payment?.paid_at && Number(payment.total_amount || 0) + 0.01 >= Number(r.total_amount || 0);
      const occurred_at =
        (r.period_end ? String(r.period_end).slice(0, 10) : String(r.created_at).slice(0, 10)) ||
        new Date().toISOString().slice(0, 10);

      return {
        user_id: userId,
        property_id: (lease as any)?.property_id ?? null,
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
  }, [safeLeases, safePayments, safeReceipts, userId]);

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
        .limit(2000);

      if (tErr) throw tErr;
      setTx((tData || []) as any);

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

  // ========= Period view (attendu vs encaissé) =========
  const periodInfo = useMemo(() => {
    const { start, end } = selectedPeriod;

    const months: Date[] = [];
    for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor = addMonths(cursor, 1)) {
      months.push(cursor);
    }

    const activeLeases = safeLeases.filter((l) => {
      const s = normalizeDate((l as any).start_date);
      const e = normalizeDate((l as any).end_date);
      if (analysisPropertyId && String((l as any).property_id || "") !== analysisPropertyId) return false;
      if (!s) return false;
      const startsBeforeEnd = s.getTime() <= end.getTime();
      const notEnded = !e || e.getTime() >= start.getTime();
      const statusOk = ((l as any).status || "active").toLowerCase() !== "draft";
      return startsBeforeEnd && notEnded && statusOk;
    });

    const expected = sum(
      months.map((mStart) => {
        const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0);
        return sum(
          activeLeases
            .filter((l) => {
              const s = normalizeDate((l as any).start_date);
              const e = normalizeDate((l as any).end_date);
              return !!s && s <= mEnd && (!e || e >= mStart);
            })
            .map((l) => Number(getLeaseRentPeriod(l, monthKey(mStart))?.total || 0))
        );
      })
    );

    const periodPayments = safePayments.filter((p) => {
      if (analysisPropertyId && (leasePropertyById.get(String((p as any).lease_id || "")) || "") !== analysisPropertyId) return false;
      const ps = normalizeDate((p as any).period_start);
      const pe = normalizeDate((p as any).period_end);
      if (!ps || !pe) return false;
      return !(pe.getTime() < start.getTime() || ps.getTime() > end.getTime());
    });

    const received = sum(
      periodPayments.filter((p) => !!(p as any).paid_at).map((p) => Number((p as any).total_amount || 0))
    );

    const pending = Math.max(0, expected - received);
    return { expected, received, pending, activeLeases };
  }, [analysisPropertyId, leasePropertyById, selectedPeriod, safeLeases, safePayments]);

  // ========= Ledger: rows for period =========
  const periodLedger = useMemo(() => {
    const { start, end } = selectedPeriod;
    const s = start.getTime();
    const e = end.getTime();

    const rows = tx.filter((t) => {
      if (analysisPropertyId && (t.property_id || "") !== analysisPropertyId) return false;
      const d = normalizeDate(t.occurred_at);
      if (!d) return false;
      const ms = d.getTime();
      return ms >= s && ms <= e;
    });

    const income = sum(rows.filter((r) => r.direction === "in").map((r) => Number(r.amount || 0)));
    const expense = sum(rows.filter((r) => r.direction === "out").map((r) => Number(r.amount || 0)));
    return { rows, income, expense, net: income - expense };
  }, [analysisPropertyId, tx, selectedPeriod]);

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
    const income = sum(filteredMonthLedger.filter((r) => r.direction === "in").map((r) => Number(r.amount || 0)));
    const expense = sum(filteredMonthLedger.filter((r) => r.direction === "out").map((r) => Number(r.amount || 0)));
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
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
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

  // reset selection when list changes / filters change
  useEffect(() => {
    setSelected({});
  }, [
    periodMode,
    selectedPeriod.start,
    selectedPeriod.end,
    filterPropertyId,
    filterDirection,
    filterCategory,
    filterStatus,
    filterSource,
    filterAmountMin,
    filterAmountMax,
    filterText,
    analysisPropertyId,
    tx.length,
  ]);

  const allVisibleSelected = useMemo(() => {
    if (filteredMonthLedger.length === 0) return false;
    return filteredMonthLedger.every((r) => !!selected[r.id]);
  }, [filteredMonthLedger, selected]);

  const toggleSelectAllVisible = () => {
    if (filteredMonthLedger.length === 0) return;
    setSelected((prev) => {
      const next = { ...prev };
      const target = !allVisibleSelected;
      for (const r of filteredMonthLedger) next[r.id] = target;
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ========= Delete selected (only manual entries) =========
  const deleteSelected = async () => {
    if (!supabase || !userId) return;
    const ids = selectedIds;
    if (ids.length === 0) return;

    // Sécurité: on ne supprime pas les écritures générées depuis quittances (receipt_id != null)
    const selectedRows = filteredMonthLedger.filter((r) => ids.includes(r.id));
    const protectedRows = selectedRows.filter((r) => !!r.receipt_id);
    const deletableRows = selectedRows.filter((r) => !r.receipt_id);

    if (deletableRows.length === 0) {
      setErr("Aucune ligne supprimable dans la sélection (les loyers issus de quittances sont protégés).");
      return;
    }

    const msg =
      protectedRows.length > 0
        ? `Tu as sélectionné ${protectedRows.length} ligne(s) "quittance" (protégées) + ${deletableRows.length} ligne(s) supprimables.\n\nSupprimer seulement les lignes supprimables ?`
        : `Supprimer ${deletableRows.length} ligne(s) du grand livre ?`;

    if (!confirm(msg)) return;

    setDeleteBusy(true);
    setErr(null);
    setOk(null);

    try {
      const idsToDelete = deletableRows.map((r) => r.id);
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId)
        .in("id", idsToDelete);

      if (error) throw error;

      setOk(`Supprimé ✅ (${idsToDelete.length} ligne${idsToDelete.length > 1 ? "s" : ""})`);
      setSelected({});
      await loadFinance();
      await onRefresh?.();
    } catch (e: any) {
      setErr(e?.message || "Erreur suppression.");
    } finally {
      setDeleteBusy(false);
    }
  };

  // ========= Per property: cashflow & rendement =========
  const perProperty = useMemo(() => {
    const by = new Map<string, { income: number; expense: number; net: number }>();

    for (const propertyId of analysisPropertyIds) {
      by.set(propertyId, { income: 0, expense: 0, net: 0 });
    }

    for (const r of periodLedger.rows) {
      const pid = r.property_id || "—";
      const cur = by.get(pid) || { income: 0, expense: 0, net: 0 };
      if (r.direction === "in") cur.income += Number(r.amount || 0);
      else cur.expense += Number(r.amount || 0);
      cur.net = cur.income - cur.expense;
      by.set(pid, cur);
    }

    const rows = Array.from(by.entries()).map(([propertyId, v]) => {
      const p = propertyId === "—" ? null : propsById.get(propertyId);
      const fin = propertyId === "—" ? null : pf.get(propertyId) || null;

      const recurring = propertyId === "—" ? { loan: 0, fixed: 0, taxM: 0, total: 0 } : monthlyRecurringByProperty.get(propertyId) || { loan: 0, fixed: 0, taxM: 0, total: 0 };
      const loan = recurring.loan;
      const fixed = recurring.fixed;
      const taxM = recurring.taxM;
      const lmnpRecurring =
        Number(fin?.pno_insurance_monthly || 0) +
        Number(fin?.copro_charges_monthly || 0) +
        Number(fin?.bank_fees_monthly || 0) +
        Number(fin?.maintenance_monthly || 0) +
        Number(fin?.property_tax_yearly || 0) / 12 +
        Number(fin?.cfe_yearly || 0) / 12;

      const cashflow = v.net - recurring.total * selectedPeriod.monthCount;

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
        income: v.income,
        expense: v.expense,
        net: v.net,
        loan,
        fixed,
        taxM,
        lmnpRecurring,
        cashflow,
        invest,
        yieldNet,
      };
    });

    return rows.sort((a, b) => b.cashflow - a.cashflow);
  }, [analysisPropertyIds, monthlyRecurringByProperty, periodLedger.rows, propsById, pf, selectedPeriod.monthCount]);

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

      const payload = {
        user_id: userId,
        property_id: form.property_id || null,
        lease_id: form.lease_id || null,
        receipt_id: null,
        occurred_at: form.occurred_at,
        direction: form.direction,
        status: form.status,
        category: form.category,
        label: form.label?.trim() || null,
        amount,
        notes: form.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("transactions").insert(payload);
      if (error) throw error;

      setOk("Écriture ajoutée ✅");
      setTxWizardOpen(false);
      setForm((s) => ({ ...s, amount: "", label: "", notes: "" }));

      await loadFinance();
      await onRefresh?.();
    } catch (e: any) {
      setErr(e?.message || "Erreur ajout écriture.");
    } finally {
      setLoading(false);
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

  const globalActionPlan = useMemo(() => {
    const actions: string[] = [];

    if (periodInfo.pending > 0) {
      actions.push(`Relancer ou confirmer les paiements restants : ${formatEuro(periodInfo.pending)} à encaisser sur ${periodLabel}.`);
    }
    if (weakProperties.length > 0) {
      actions.push(`${weakProperties.length} bien(s) en cashflow négatif : traiter d'abord ${weakProperties[0].label}.`);
    }
    if (perProperty.some((p) => p.invest <= 0)) {
      actions.push("Compléter les prix d'achat et frais par bien pour fiabiliser les rendements.");
    }
    if (periodLedger.expense === 0 && periodLedger.income > 0) {
      actions.push("Ajouter les charges de la période pour préparer une synthèse utile à la déclaration.");
    }
    if (actions.length === 0) {
      actions.push("La période semble propre : garder le rythme de saisie et vérifier les charges récurrentes.");
    }

    return actions.slice(0, 4);
  }, [periodInfo.pending, periodLabel, weakProperties, perProperty, periodLedger.expense, periodLedger.income]);

  const accountingChartRows = useMemo(() => {
    const { start, end } = selectedPeriod;
    const monthlyRecurring = sum(Array.from(monthlyRecurringByProperty.values()).map((row) => row.total));
    const months: Array<{ key: string; label: string; income: number; expense: number; recurring: number; net: number }> = [];

    for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor = addMonths(cursor, 1)) {
      const key = monthKey(cursor);
      months.push({ key, label: fmtMonthFR(key).replace(/^\w/, (c) => c.toUpperCase()), income: 0, expense: 0, recurring: monthlyRecurring, net: -monthlyRecurring });
    }

    const byKey = new Map(months.map((row) => [row.key, row]));
    for (const row of periodLedger.rows) {
      const d = normalizeDate(row.occurred_at);
      if (!d) continue;
      const bucket = byKey.get(monthKey(d));
      if (!bucket) continue;
      if (row.direction === "in") bucket.income += Number(row.amount || 0);
      else bucket.expense += Number(row.amount || 0);
      bucket.net = bucket.income - bucket.expense - bucket.recurring;
    }

    return months;
  }, [monthlyRecurringByProperty, periodLedger.rows, selectedPeriod]);

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
          label: "Revenus",
          data: accountingChartRows.map((row) => row.income),
          backgroundColor: "rgba(16, 185, 129, 0.82)",
          borderColor: "rgb(5, 150, 105)",
          borderWidth: 1,
          borderRadius: 8,
          barPercentage: 0.72,
          categoryPercentage: 0.72,
        },
        {
          type: "bar" as const,
          label: "Dépenses saisies",
          data: accountingChartRows.map((row) => row.expense),
          backgroundColor: "rgba(244, 63, 94, 0.78)",
          borderColor: "rgb(225, 29, 72)",
          borderWidth: 1,
          borderRadius: 8,
          barPercentage: 0.72,
          categoryPercentage: 0.72,
        },
        {
          type: "bar" as const,
          label: "Charges récurrentes",
          data: accountingChartRows.map((row) => row.recurring),
          backgroundColor: "rgba(245, 158, 11, 0.7)",
          borderColor: "rgb(217, 119, 6)",
          borderWidth: 1,
          borderRadius: 8,
          barPercentage: 0.72,
          categoryPercentage: 0.72,
        },
        {
          type: "line" as const,
          label: "Résultat après récurrent",
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
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: { usePointStyle: true, boxWidth: 8, color: "#475569", font: { size: 12, weight: "600" as const } },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${formatEuro(Number(ctx.raw || 0))}`,
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
    [chartMax]
  );

  const expenseBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const row of periodLedger.rows) {
      if (row.direction !== "out") continue;
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
    { href: "#finance-ecritures", number: "01", label: "Écritures", sub: `${filteredLedgerSummary.count} ligne${filteredLedgerSummary.count > 1 ? "s" : ""}` },
    { href: "#finance-charges", number: "02", label: "Charges", sub: "Récupérables" },
    { href: "#finance-periode", number: "03", label: "Période", sub: periodLabel },
    { href: "#finance-pilotage", number: "04", label: "Synthèse", sub: "Lecture rapide" },
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5 space-y-5">
      <SectionTitle
        kicker="Finance"
        title="Écritures & suivi financier"
        desc="La priorité ici : saisir, retrouver et exporter les recettes et dépenses. La période et la synthèse servent de filtres de lecture."
      />

      {!userId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Chargement utilisateur… (userId manquant)
        </div>
      ) : null}

      <nav className="sticky top-3 z-20 -mx-1 overflow-x-auto rounded-[1.75rem] border border-indigo-100 bg-white/95 p-2 shadow-md backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-3 px-2">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-indigo-700">Navigation Finance</p>
          <p className="hidden text-xs font-medium text-slate-500 sm:block">Cliquez pour aller directement à une partie</p>
        </div>
        <div className="grid min-w-[760px] grid-cols-4 gap-1">
          {chapters.map((chapter) => (
            <a
              key={chapter.href}
              href={chapter.href}
              className="group relative overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-3 text-left shadow-sm transition hover:border-indigo-200 hover:bg-white hover:shadow-md"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-indigo-500 transition group-hover:text-[#635bff]">
                  {chapter.number}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-slate-500 group-hover:border-indigo-200 group-hover:text-indigo-700">
                  Aller à
                </span>
              </span>
              <span className="mt-1.5 block text-sm font-extrabold text-slate-950">{chapter.label}</span>
              <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">{chapter.sub}</span>
              <span className="absolute inset-x-4 bottom-1 h-0.5 origin-left scale-x-100 rounded-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />
            </a>
          ))}
        </div>
      </nav>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <BanknotesIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-indigo-700">Action principale</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">Ajouter une recette ou une dépense</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Les loyers viennent des quittances. Les autres mouvements, taxe foncière, assurance, copropriété, travaux ou frais,
                se saisissent ici pour alimenter les exports et la performance.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => setTxWizardOpen(true)}
              className={cx("inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold", brandBg, brandText, brandHover)}
            >
              <PlusIcon className="h-4 w-4" />
              Nouvelle écriture
            </button>
            <a
              href="#finance-ecritures"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Voir le grand livre
            </a>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <Stat label="Lignes filtrées" value={String(filteredLedgerSummary.count)} />
          <Stat label="Recettes" value={formatEuro(filteredLedgerSummary.income)} />
          <Stat label="Dépenses" value={formatEuro(filteredLedgerSummary.expense)} />
          <Stat label="Résultat" value={formatEuro(filteredLedgerSummary.net)} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Paramètres financiers</p>
            <h3 className="text-lg font-semibold text-slate-950">Charges récurrentes et crédit par bien</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Pour terminer la mise en route, renseignez seulement le prix d’achat et le taux du crédit. Les autres champs affinent ensuite Finance
              et Performance : mensualité, durée restante, assurance PNO, copropriété, CFE, taxe foncière, frais bancaires et entretien.
            </p>
          </div>
          <a
            href="#finance-pilotage"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Voir l’impact
          </a>
        </div>

        <div className="mt-4 space-y-2">
          {propertyOptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600 lg:col-span-2">
              Créez d’abord un bien pour renseigner ses paramètres financiers.
            </div>
          ) : (
            propertyOptions.map((property) => {
              const existing = pf.get(property.id) || null;
              const loanMonthly = Number(existing?.loan_monthly || 0) + Number(existing?.loan_insurance_monthly || 0);
              const taxesMonthly = Number(existing?.property_tax_yearly || 0) / 12 + Number(existing?.cfe_yearly || 0) / 12;
              const operatingMonthly =
                Number(existing?.fixed_charges_monthly || 0) +
                Number(existing?.pno_insurance_monthly || 0) +
                Number(existing?.copro_charges_monthly || 0) +
                Number(existing?.bank_fees_monthly || 0) +
                Number(existing?.maintenance_monthly || 0);
              const monthlyTotal =
                loanMonthly + taxesMonthly + operatingMonthly;
              const missing = [
                !existing?.purchase_price ? "prix d’achat" : "",
                !existing?.loan_rate_percent ? "taux crédit" : "",
              ].filter(Boolean);
              const optionalMissing = [
                !existing?.loan_monthly ? "crédit" : "",
                !existing?.tax_regime ? "régime" : "",
              ].filter(Boolean);

              return (
                <details key={property.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm open:bg-white">
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <div className="grid items-center gap-3 lg:grid-cols-[minmax(180px,1fr)_110px_110px_110px_150px_150px_96px]">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-slate-900 ring-1 ring-slate-200">
                          {(property.label || property.address_line1 || "B").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{property.label || property.address_line1 || "Bien"}</p>
                          <p className="truncate text-xs text-slate-500">
                            {missing.length
                              ? `Mise en route : ${missing.join(", ")}`
                              : optionalMissing.length
                              ? `À affiner : ${optionalMissing.join(", ")}`
                              : "Paramètres prêts pour Performance"}
                          </p>
                        </div>
                      </div>

                      <LineMetric label="Total" value={formatEuro(monthlyTotal)} strong />
                      <LineMetric label="Crédit" value={formatEuro(loanMonthly)} />
                      <LineMetric label="Taxes" value={formatEuro(taxesMonthly)} />
                      <LineMetric
                        label="Taux"
                        value={existing?.loan_rate_percent ? `${Number(existing.loan_rate_percent).toLocaleString("fr-FR")} %` : "—"}
                      />
                      <LineMetric label="Régime" value={existing?.tax_regime ? taxRegimeLabel(existing.tax_regime) : "—"} />

                      <span className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 group-open:hidden">
                        Modifier
                      </span>
                    </div>
                  </summary>

                  <div className="border-t border-slate-200 bg-white px-4 pb-4">
                    <PropertyFinanceForm propertyId={property.id} existing={existing} onSave={upsertPropertyFinance} />
                  </div>
                </details>
              );
            })
          )}
        </div>
      </section>

      {/* Period selector */}
      <section id="finance-periode" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <ChapterHeader
              eyebrow="03 · Période"
              title="Filtrer la lecture"
              desc="La période ne pilote pas le workflow : elle sert à lire les écritures et les synthèses sous le bon angle."
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {[
                { key: "month" as const, label: "Mois", sub: "Vue précise" },
                { key: "last6" as const, label: "6 derniers mois", sub: "Tendance" },
                { key: "year" as const, label: "Année", sub: "Déclaration" },
                { key: "custom" as const, label: "Choisir période", sub: "Sur mesure" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    if (option.key === "custom") setPeriodPickerOpen(true);
                    else setPeriodMode(option.key);
                  }}
                  className={cx(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    periodMode === option.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className={cx("mt-0.5 block text-xs", periodMode === option.key ? "text-slate-200" : "text-slate-500")}>{option.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Bien analysé
              </label>
              <select
                value={analysisPropertyId}
                onChange={(e) => {
                  setAnalysisPropertyId(e.target.value);
                  setFilterPropertyId("");
                }}
                className="w-full min-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="">Tous les biens</option>
                {propertyOptions.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.label || property.address_line1 || "Bien"}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              Période : <span className="font-semibold text-slate-900">{periodLabel}</span>
            </div>
            <div
              className={cx(
                "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs",
                syncState === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : syncState === "syncing"
                  ? "border-cyan-200 bg-cyan-50 text-cyan-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              )}
              title="Les données se mettent à jour automatiquement à l'ouverture, au retour sur l'onglet et lorsqu'une écriture change."
            >
              <span
                className={cx(
                  "h-2 w-2 rounded-full",
                  syncState === "error" ? "bg-red-500" : syncState === "syncing" ? "animate-pulse bg-cyan-500" : "bg-emerald-500"
                )}
              />
              <span className="font-semibold">
                {syncState === "error" ? "Synchronisation à vérifier" : syncState === "syncing" ? "Synchronisation..." : "Données à jour"}
              </span>
              {lastSyncedAt ? (
                <span className="text-slate-500">
                  {lastSyncedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

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
              Période sélectionnée : <span className="font-semibold text-slate-900">{fmtPeriodFR("custom", currentMonth, customStartMonth, customEndMonth)}</span>
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

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>
      ) : null}

      <section id="finance-pilotage" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <ChapterHeader
          eyebrow="04 · Synthèse"
          title="Cockpit de lecture"
          desc="Une synthèse de contrôle, utile après la saisie ou pour comprendre une période."
        />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Kpi title="Loyers attendus" value={formatEuro(periodInfo.expected)} sub="Selon les baux actifs" />
          <Kpi title="Loyers encaissés" value={formatEuro(periodInfo.received)} sub="Paiements confirmés" />
          <Kpi title="Cashflow estimé" value={formatEuro(totalCashflow)} sub="Après crédit, charges fixes et TF" />
          <Kpi title="Charges récurrentes" value={formatEuro(recurringPeriodTotal)} sub="Appliquées automatiquement" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr,320px]">
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Graphique comptable</p>
                <p className="mt-1 text-[0.8rem] text-slate-600">
                  Revenus, dépenses et résultat net sur la période analysée
                  {analysisPropertyId ? ` · ${propsById.get(analysisPropertyId)?.label || "bien sélectionné"}` : " · tous les biens"}.
                  Les charges récurrentes paramétrées par bien sont ajoutées automatiquement.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[0.7rem] font-semibold">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                  Revenus {formatEuro(periodLedger.income)}
                </span>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-800">
                  Dépenses saisies {formatEuro(periodLedger.expense)}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
                  Récurrent {formatEuro(recurringPeriodTotal)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-800">
                  Net {formatEuro(periodLedger.net - recurringPeriodTotal)}
                </span>
              </div>
            </div>

            <div className="mt-4 h-[320px] rounded-2xl border border-slate-200 bg-white p-3">
              <Chart type="bar" data={accountingChartData as any} options={accountingChartOptions as any} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Postes de dépenses</p>
            <p className="mt-1 text-[0.8rem] text-slate-600">Les catégories qui pèsent le plus sur la période.</p>

            {expenseBreakdown.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                Aucune dépense saisie sur cette période.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {expenseBreakdown.map((item) => {
                  const pct = periodLedger.expense > 0 ? Math.round((item.amount / periodLedger.expense) * 100) : 0;
                  return (
                    <div key={item.category} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-800">{item.label}</span>
                        <span className="text-slate-600">{formatEuro(item.amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[0.68rem] text-slate-500">{pct}% des dépenses</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Lecture propriétaire</p>
              <p className="text-[0.8rem] text-slate-600">
                Ce tableau résume ce que la période raconte vraiment : encaissement, charges et performance.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {periodLabel}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Stat label="Recettes période" value={formatEuro(periodLedger.income)} />
            <Stat label="Dépenses saisies" value={formatEuro(periodLedger.expense)} />
            <Stat label="Résultat après récurrent" value={formatEuro(periodLedger.net - recurringPeriodTotal)} />
          </div>

          <div className="mt-4">
            <MiniBar value={periodInfo.received} max={periodInfo.expected} label="Taux d'encaissement de la période" />
          </div>

          {bestProperty ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Meilleur contributeur</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{bestProperty.label}</p>
              <p className="mt-1 text-sm text-slate-700">
                Cashflow estimé : <span className="font-semibold">{formatEuro(bestProperty.cashflow)}</span>
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Plan d'action performance</p>
          <p className="mt-1 text-[0.8rem] text-slate-600">Les priorités à traiter pour fiabiliser ou améliorer vos résultats.</p>
          <div className="mt-4 space-y-2">
            {globalActionPlan.map((action, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Action {idx + 1}</p>
                <p className="mt-1 text-sm text-slate-800">{action}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      </section>

      <RecoverableChargesGuide />

      {/* Ajouter une écriture */}
      <section id="finance-ecritures" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 space-y-4">
      <ChapterHeader
        eyebrow="01 · Écritures"
        title="Saisir, filtrer et exporter"
        desc="Les loyers viennent des quittances. Les écritures manuelles servent aux charges, travaux et recettes exceptionnelles."
      />

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <BanknotesIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Recettes & dépenses</p>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Les loyers remontent automatiquement depuis les quittances. Pour le reste, ajoutez une écriture guidée en quelques étapes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTxWizardOpen(true)}
            className={cx("inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold", brandBg, brandText, brandHover)}
          >
            <PlusIcon className="h-4 w-4" />
            Nouvelle écriture
          </button>
        </div>
      </div>

      {txWizardOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-sm sm:items-center">
          <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={() => setTxWizardOpen(false)} />
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

            <button type="button" onClick={() => setTxWizardOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label="Fermer">
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
                  <label className="text-xs font-semibold text-slate-700">Bien concerné</label>
                  <select
                    value={form.property_id}
                    onChange={(e) => setForm((s) => ({ ...s, property_id: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Non affecté</option>
                    {Array.from(propsById.entries()).map(([id, p]) => (
                      <option key={id} value={id}>
                        {p.label || "Bien"}
                      </option>
                    ))}
                  </select>
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

      {/* Grand livre + suppression sélection */}
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Recettes & dépenses ({periodLabel})</p>
            <p className="text-[0.8rem] text-slate-600">Détail comptable de la période, utile pour contrôler et préparer la déclaration.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={deleteBusy || selectedIds.length === 0}
              onClick={deleteSelected}
              className={cx(
                "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold",
                selectedIds.length === 0 ? "bg-slate-200 text-slate-600" : "bg-red-600 text-white hover:bg-red-500",
                deleteBusy && "opacity-60"
              )}
              title="Supprime uniquement les lignes manuelles (les quittances sont protégées)."
            >
              {deleteBusy ? "…" : selectedIds.length ? `Supprimer sélection (${selectedIds.length})` : "Supprimer sélection"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Rechercher une écriture</p>
              <p className="mt-1 text-xs text-slate-600">Commencez par les filtres principaux. Les filtres avancés restent disponibles si besoin.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              {periodLabel}
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr,0.8fr]">
            <div>
              <label className="text-xs font-semibold text-slate-600">Recherche</label>
              <input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                placeholder="Libellé, note, bien, statut..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Bien</label>
              <select
                value={filterPropertyId}
                onChange={(e) => setFilterPropertyId(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Tous les biens</option>
                {Array.from(propsById.entries()).map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.label || "Bien"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "Tout", value: "" },
              { label: "Recettes", value: "in" },
              { label: "Dépenses", value: "out" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setFilterDirection(option.value as TxDirection | "")}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  filterDirection === option.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Filtres avancés</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Catégorie</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Toutes</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Statut</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as TxStatus | "")}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Tous</option>
                  <option value="expected">Prévu</option>
                  <option value="received">Encaissé</option>
                  <option value="paid">Payé</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Source</label>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as "auto" | "manual" | "")}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Toutes</option>
                  <option value="auto">Quittance auto</option>
                  <option value="manual">Manuel</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Min.</label>
                  <input
                    inputMode="decimal"
                    value={filterAmountMin}
                    onChange={(e) => setFilterAmountMin(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Max.</label>
                  <input
                    inputMode="decimal"
                    value={filterAmountMax}
                    onChange={(e) => setFilterAmountMax(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="1200"
                  />
                </div>
              </div>
            </div>
          </details>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[560px]">
              <Stat label="Lignes" value={String(filteredLedgerSummary.count)} />
              <Stat label="Recettes" value={formatEuro(filteredLedgerSummary.income)} />
              <Stat label="Dépenses" value={formatEuro(filteredLedgerSummary.expense)} />
              <Stat label="Résultat" value={formatEuro(filteredLedgerSummary.net)} />
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={resetLedgerFilters}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={exportFilteredLedger}
                disabled={filteredMonthLedger.length === 0}
                className={cx(
                  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
                  filteredMonthLedger.length === 0 ? "bg-slate-200 text-slate-600" : `${brandBg} ${brandText} ${brandHover}`
                )}
                title="Export CSV compatible Excel des lignes affichées."
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Exporter le résultat
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left">
                <th className="px-3 py-2 text-xs text-slate-600 w-[44px]">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4"
                    title="Tout sélectionner (lignes visibles)"
                  />
                </th>
                <th className="w-[110px] px-3 py-2 text-xs text-slate-600">Date</th>
                <th className="w-[22%] px-3 py-2 text-xs text-slate-600">Bien</th>
                <th className="px-3 py-2 text-xs text-slate-600">Écriture</th>
                <th className="w-[120px] px-3 py-2 text-xs text-slate-600">Statut</th>
                <th className="w-[130px] px-3 py-2 text-xs text-slate-600 text-right">Montant</th>
              </tr>
            </thead>

            <tbody>
              {filteredMonthLedger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-slate-500">
                    Aucune écriture (ou filtres trop restrictifs).
                  </td>
                </tr>
              ) : (
                filteredMonthLedger.map((r) => {
                  const p = r.property_id ? propsById.get(r.property_id) : null;
                  const isChecked = !!selected[r.id];

                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(r.id)}
                          className="h-4 w-4"
                        />
                      </td>

                      <td className="px-3 py-2 text-slate-700">{r.occurred_at}</td>
                      <td className="truncate px-3 py-2 text-slate-700">{p?.label || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{r.label || categoryLabel(r.category)}</p>
                          <p className="truncate text-xs text-slate-500">
                            {directionLabel(r.direction)} · {categoryLabel(r.category)} · {sourceLabel(r)}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{statusLabel(r.status)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        {r.direction === "out" ? "− " : ""}
                        {formatEuro(Number(r.amount || 0))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[0.75rem] text-slate-600">
          Suppression : tu peux supprimer des lignes <span className="font-semibold">manuelles</span>. Les lignes{" "}
          <span className="font-semibold">Quittance (auto)</span> sont protégées (sinon elles reviendraient au prochain sync).
        </p>
      </div>
      </section>

      {/* Attendu vs encaissé */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Encaissement (baux/paiements)</p>
        <div className="mt-3">
          <MiniBar value={periodInfo.received} max={periodInfo.expected} label="Taux d’encaissement" />
        </div>
        <p className="mt-2 text-[0.75rem] text-slate-600">
          Remarque : les quittances alimentent le ledger en “expected”. Les paiements (si tu les utilises) donnent la réalité “encaissé”.
        </p>
      </div>
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
    <div className="min-w-0">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={cx("mt-0.5 truncate text-sm font-semibold", strong ? "text-slate-950" : "text-slate-700")}>{value}</p>
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [s, setS] = useState<PropertyFinance>({
    property_id: propertyId,
    user_id: "",
    purchase_price: existing?.purchase_price ?? null,
    notary_fees: existing?.notary_fees ?? null,
    agency_fees: existing?.agency_fees ?? null,
    works: existing?.works ?? null,
    down_payment: existing?.down_payment ?? null,
    loan_monthly: existing?.loan_monthly ?? null,
    loan_insurance_monthly: existing?.loan_insurance_monthly ?? null,
    loan_rate_percent: existing?.loan_rate_percent ?? null,
    loan_remaining_months: existing?.loan_remaining_months ?? null,
    tax_regime: existing?.tax_regime ?? null,
    fixed_charges_monthly: existing?.fixed_charges_monthly ?? null,
    property_tax_yearly: existing?.property_tax_yearly ?? null,
    pno_insurance_monthly: existing?.pno_insurance_monthly ?? null,
    copro_charges_monthly: existing?.copro_charges_monthly ?? null,
    cfe_yearly: existing?.cfe_yearly ?? null,
    loan_interest_monthly: existing?.loan_interest_monthly ?? null,
    bank_fees_monthly: existing?.bank_fees_monthly ?? null,
    maintenance_monthly: existing?.maintenance_monthly ?? null,
  });

  useEffect(() => {
    setS((prev) => ({
      ...prev,
      purchase_price: existing?.purchase_price ?? null,
      notary_fees: existing?.notary_fees ?? null,
      agency_fees: existing?.agency_fees ?? null,
      works: existing?.works ?? null,
      down_payment: existing?.down_payment ?? null,
      loan_monthly: existing?.loan_monthly ?? null,
      loan_insurance_monthly: existing?.loan_insurance_monthly ?? null,
      loan_rate_percent: existing?.loan_rate_percent ?? null,
      loan_remaining_months: existing?.loan_remaining_months ?? null,
      tax_regime: existing?.tax_regime ?? null,
      fixed_charges_monthly: existing?.fixed_charges_monthly ?? null,
      property_tax_yearly: existing?.property_tax_yearly ?? null,
      pno_insurance_monthly: existing?.pno_insurance_monthly ?? null,
      copro_charges_monthly: existing?.copro_charges_monthly ?? null,
      cfe_yearly: existing?.cfe_yearly ?? null,
      loan_interest_monthly: existing?.loan_interest_monthly ?? null,
      bank_fees_monthly: existing?.bank_fees_monthly ?? null,
      maintenance_monthly: existing?.maintenance_monthly ?? null,
    }));
  }, [existing]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
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
        loan_remaining_months: s.loan_remaining_months,
        tax_regime: s.tax_regime,
        fixed_charges_monthly: s.fixed_charges_monthly,
        property_tax_yearly: s.property_tax_yearly,
        pno_insurance_monthly: s.pno_insurance_monthly,
        copro_charges_monthly: s.copro_charges_monthly,
        cfe_yearly: s.cfe_yearly,
        loan_interest_monthly: s.loan_interest_monthly,
        bank_fees_monthly: s.bank_fees_monthly,
        maintenance_monthly: s.maintenance_monthly,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm text-cyan-900">
        <p className="font-semibold">Charges récurrentes automatiques du bien</p>
        <p className="mt-1 text-xs leading-5">
          À remplir une seule fois. lokt.fr les applique automatiquement aux périodes analysées : taxe foncière, CFE, assurance, copropriété,
          frais bancaires, entretien et crédit. Les intérêts sont isolés pour le dossier comptable LMNP.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Prix d’achat" value={s.purchase_price} onChange={(v) => setS((p) => ({ ...p, purchase_price: v }))} />
        <Field label="Frais notaire" value={s.notary_fees} onChange={(v) => setS((p) => ({ ...p, notary_fees: v }))} />
        <Field label="Frais agence" value={s.agency_fees} onChange={(v) => setS((p) => ({ ...p, agency_fees: v }))} />
        <Field label="Travaux" value={s.works} onChange={(v) => setS((p) => ({ ...p, works: v }))} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Crédit mensuel récurrent" value={s.loan_monthly} onChange={(v) => setS((p) => ({ ...p, loan_monthly: v }))} />
        <Field
          label="Assurance crédit mensuelle"
          value={s.loan_insurance_monthly}
          onChange={(v) => setS((p) => ({ ...p, loan_insurance_monthly: v }))}
        />
        <Field label="Taux crédit (%)" value={s.loan_rate_percent ?? null} onChange={(v) => setS((p) => ({ ...p, loan_rate_percent: v }))} />
        <Field
          label="Durée restante (mois)"
          value={s.loan_remaining_months ?? null}
          onChange={(v) => setS((p) => ({ ...p, loan_remaining_months: v == null ? null : Math.round(v) }))}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label="Autres charges fixes"
          value={s.fixed_charges_monthly}
          onChange={(v) => setS((p) => ({ ...p, fixed_charges_monthly: v }))}
        />
        <Field
          label="Taxe foncière annuelle"
          value={s.property_tax_yearly}
          onChange={(v) => setS((p) => ({ ...p, property_tax_yearly: v }))}
        />
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">Régime fiscal suivi</label>
          <select
            value={s.tax_regime || ""}
            onChange={(e) => setS((p) => ({ ...p, tax_regime: e.target.value || null }))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Non renseigné</option>
            <option value="lmnp_micro">LMNP micro-BIC</option>
            <option value="lmnp_real">LMNP réel</option>
            <option value="nu_micro">Location nue micro-foncier</option>
            <option value="nu_real">Location nue réel</option>
            <option value="pinel">Pinel</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Assurance PNO / GLI mensuelle" value={s.pno_insurance_monthly ?? null} onChange={(v) => setS((p) => ({ ...p, pno_insurance_monthly: v }))} />
        <Field label="Copropriété mensuelle" value={s.copro_charges_monthly ?? null} onChange={(v) => setS((p) => ({ ...p, copro_charges_monthly: v }))} />
        <Field label="CFE annuelle" value={s.cfe_yearly ?? null} onChange={(v) => setS((p) => ({ ...p, cfe_yearly: v }))} />
        <Field label="Intérêts d’emprunt mensuels" value={s.loan_interest_monthly ?? null} onChange={(v) => setS((p) => ({ ...p, loan_interest_monthly: v }))} />
        <Field label="Frais bancaires mensuels" value={s.bank_fees_monthly ?? null} onChange={(v) => setS((p) => ({ ...p, bank_fees_monthly: v }))} />
        <Field label="Entretien provisionné mensuel" value={s.maintenance_monthly ?? null} onChange={(v) => setS((p) => ({ ...p, maintenance_monthly: v }))} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className={cx(
            "inline-flex min-h-[42px] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70",
            saved ? "bg-emerald-700 hover:bg-emerald-700" : "bg-slate-900 hover:bg-slate-800"
          )}
        >
          {saving ? "Enregistrement..." : saved ? "Enregistré ✓" : "Enregistrer"}
        </button>
        {saved ? <span className="text-sm font-semibold text-emerald-700">Configuration prise en compte.</span> : null}
      </div>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-slate-600">{label}</label>
      <input
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) onChange(null);
          else onChange(num(v));
        }}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        placeholder="—"
      />
    </div>
  );
}
