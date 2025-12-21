// components/landlord/sections/SectionFinance.tsx
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle, formatEuro } from "../UiBits";
import type { Lease, Property, RentPayment } from "../../../lib/landlord/types";

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

  fixed_charges_monthly: number | null;
  property_tax_yearly: number | null;

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

function num(v: any) {
  const n = typeof v === "number" ? v : parseFloat(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function SectionFinance({ userId, leases, payments, receipts, propertyById, onRefresh }: Props) {
  // 🎨 Izimo
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  const safeLeases = Array.isArray(leases) ? leases : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeReceipts = Array.isArray(receipts) ? receipts : [];
  const propsById = propertyById instanceof Map ? propertyById : new Map<string, Property>();

  const [month, setMonth] = useState<string>(toMonthISO(new Date()));

  // Ledger
  const [tx, setTx] = useState<Transaction[]>([]);
  const [pf, setPf] = useState<Map<string, PropertyFinance>>(new Map());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Filtres liste
  const [filterPropertyId, setFilterPropertyId] = useState<string>("");
  const [filterDirection, setFilterDirection] = useState<TxDirection | "">("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterText, setFilterText] = useState<string>("");

  // Sélection pour suppression
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
  const syncReceiptsToTransactions = async () => {
    if (!supabase || !userId) return;
    if (safeReceipts.length === 0) return;

    // ✅ dédoublonnage des quittances (sinon 2 lignes identiques dans le même upsert => violation unique)
    const byId = new Map<string, Receipt>();
    for (const r of safeReceipts) {
      if (r?.id) byId.set(r.id, r);
    }
    const uniqueReceipts = Array.from(byId.values());
    if (uniqueReceipts.length === 0) return;

    const payload = uniqueReceipts.map((r) => {
      const lease = safeLeases.find((l) => (l as any).id === r.lease_id);
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
        status: "expected" as const,
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
  };

  const loadFinance = async () => {
    if (!supabase || !userId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

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

      setOk("Finance chargée ✅");
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger Finance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    loadFinance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ========= Month view (attendu vs encaissé) =========
  const monthInfo = useMemo(() => {
    const { start, end } = monthStartEnd(month);

    const activeLeases = safeLeases.filter((l) => {
      const s = normalizeDate((l as any).start_date);
      const e = normalizeDate((l as any).end_date);
      if (!s) return false;
      const startsBeforeEnd = s.getTime() <= end.getTime();
      const notEnded = !e || e.getTime() >= start.getTime();
      const statusOk = ((l as any).status || "active").toLowerCase() !== "draft";
      return startsBeforeEnd && notEnded && statusOk;
    });

    const expected = sum(
      activeLeases.map((l) => Number((l as any).rent_amount || 0) + Number((l as any).charges_amount || 0))
    );

    const monthPayments = safePayments.filter((p) => {
      const ps = normalizeDate((p as any).period_start);
      const pe = normalizeDate((p as any).period_end);
      if (!ps || !pe) return false;
      return !(pe.getTime() < start.getTime() || ps.getTime() > end.getTime());
    });

    const received = sum(
      monthPayments.filter((p) => !!(p as any).paid_at).map((p) => Number((p as any).total_amount || 0))
    );

    const pending = Math.max(0, expected - received);
    return { expected, received, pending, activeLeases };
  }, [month, safeLeases, safePayments]);

  // ========= Ledger: rows for month =========
  const monthLedger = useMemo(() => {
    const { start, end } = monthStartEnd(month);
    const s = start.getTime();
    const e = end.getTime();

    const rows = tx.filter((t) => {
      const d = normalizeDate(t.occurred_at);
      if (!d) return false;
      const ms = d.getTime();
      return ms >= s && ms <= e;
    });

    const income = sum(rows.filter((r) => r.direction === "in").map((r) => Number(r.amount || 0)));
    const expense = sum(rows.filter((r) => r.direction === "out").map((r) => Number(r.amount || 0)));
    return { rows, income, expense, net: income - expense };
  }, [tx, month]);

  // ========= Month ledger filtered (UI filters) =========
  const filteredMonthLedger = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    return monthLedger.rows.filter((r) => {
      if (filterPropertyId && (r.property_id || "") !== filterPropertyId) return false;
      if (filterDirection && r.direction !== filterDirection) return false;
      if (filterCategory && r.category !== filterCategory) return false;

      if (!text) return true;
      const hay = [r.category, r.status, r.label || "", r.notes || "", r.occurred_at, r.direction].join(" ").toLowerCase();
      return hay.includes(text);
    });
  }, [monthLedger.rows, filterPropertyId, filterDirection, filterCategory, filterText]);

  // reset selection when list changes / filters change
  useEffect(() => {
    setSelected({});
  }, [month, filterPropertyId, filterDirection, filterCategory, filterText, tx.length]);

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

    for (const r of monthLedger.rows) {
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

      const loan = Number(fin?.loan_monthly || 0) + Number(fin?.loan_insurance_monthly || 0);
      const fixed = Number(fin?.fixed_charges_monthly || 0);
      const taxM = Number(fin?.property_tax_yearly || 0) / 12;

      const cashflow = v.net - loan - fixed - taxM;

      const invest =
        Number(fin?.purchase_price || 0) +
        Number(fin?.notary_fees || 0) +
        Number(fin?.agency_fees || 0) +
        Number(fin?.works || 0);

      const annualNet = cashflow * 12;
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
        cashflow,
        invest,
        yieldNet,
      };
    });

    return rows.sort((a, b) => b.cashflow - a.cashflow);
  }, [monthLedger.rows, propsById, pf]);

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

    const payload = {
      property_id: propertyId,
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("property_finance").upsert(payload, { onConflict: "property_id" });
    if (error) throw error;

    await loadFinance();
  };

  const monthLabel = fmtMonthFR(month);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Finance"
        title="Comptabilité & pilotage"
        desc="Quittances → écritures automatiques, saisie dépenses/recettes, cashflow & rendement par bien."
      />

      {!userId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Chargement utilisateur… (userId manquant)
        </div>
      ) : null}

      {/* Top actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Mois analysé</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={loadFinance}
            disabled={loading || !userId}
            className={cx(
              "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold",
              brandBg,
              brandText,
              brandHover,
              (loading || !userId) && "opacity-60"
            )}
          >
            {loading ? "…" : "Sync quittances + rafraîchir"}
          </button>

          <div className="text-[0.75rem] text-slate-500">
            Période : <span className="font-semibold text-slate-900">{monthLabel}</span>
          </div>
        </div>
      </div>

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>
      ) : null}

      {/* KPI */}
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi title="Attendu (baux)" value={formatEuro(monthInfo.expected)} sub="Selon baux actifs" />
        <Kpi title="Encaissé (paiements)" value={formatEuro(monthInfo.received)} sub="Selon paiements saisis" />
        <Kpi title="Net (ledger)" value={formatEuro(monthLedger.net)} sub="Entrées − sorties (mois)" />
        <Kpi title="À encaisser" value={formatEuro(monthInfo.pending)} sub="Attendu − encaissé" />
      </div>

      {/* ✅ Interversion demandée : Ajouter une écriture AVANT le grand livre */}
      <form onSubmit={addTx} className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Ajouter une écriture</p>
            <p className="text-[0.8rem] text-slate-600">
              Dépenses (travaux, assurance, TF…) et recettes diverses. Les loyers quittances sont ajoutés automatiquement.
            </p>
          </div>
          <button
            type="submit"
            disabled={loading || !userId}
            className={cx(
              "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold",
              brandBg,
              brandText,
              brandHover,
              (loading || !userId) && "opacity-60"
            )}
          >
            {loading ? "…" : "Ajouter"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-1">
            <label className="text-xs text-slate-600">Date</label>
            <input
              type="date"
              value={form.occurred_at}
              onChange={(e) => setForm((s) => ({ ...s, occurred_at: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-slate-600">Sens</label>
            <select
              value={form.direction}
              onChange={(e) => setForm((s) => ({ ...s, direction: e.target.value as TxDirection }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="in">Entrée</option>
              <option value="out">Sortie</option>
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-slate-600">Statut</label>
            <select
              value={form.status}
              onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as TxStatus }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="expected">Attendu</option>
              <option value="received">Encaissé</option>
              <option value="paid">Payé</option>
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-slate-600">Catégorie</label>
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
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-slate-600">Bien</label>
            <select
              value={form.property_id}
              onChange={(e) => setForm((s) => ({ ...s, property_id: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {Array.from(propsById.entries()).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label || "Bien"}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-slate-600">Montant (€)</label>
            <input
              value={form.amount}
              onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-3">
            <label className="text-xs text-slate-600">Libellé</label>
            <input
              value={form.label}
              onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Ex: Assurance PNO, frais Airbnb, ..."
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-xs text-slate-600">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Optionnel"
            />
          </div>
        </div>

        <p className="mt-3 text-[0.75rem] text-slate-500">
          Astuce : pour les écritures “Crédit/TF/charges fixes”, tu peux aussi les saisir une fois par mois (ou automatiser plus tard).
        </p>
      </form>

      {/* Grand livre + suppression sélection */}
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Grand livre ({monthLabel})</p>
            <p className="text-[0.8rem] text-slate-600">Toutes tes entrées/sorties catégorisées (utile LMNP).</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-3 text-sm mr-2">
              <span className="text-slate-600">Entrées</span>
              <span className="font-semibold text-slate-900">{formatEuro(monthLedger.income)}</span>
              <span className="text-slate-600">Sorties</span>
              <span className="font-semibold text-slate-900">{formatEuro(monthLedger.expense)}</span>
            </div>

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
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs text-slate-600">Bien</label>
            <select
              value={filterPropertyId}
              onChange={(e) => setFilterPropertyId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Tous</option>
              {Array.from(propsById.entries()).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label || "Bien"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600">Sens</label>
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value as any)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Tous</option>
              <option value="in">Entrées</option>
              <option value="out">Sorties</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600">Catégorie</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
            <label className="text-xs text-slate-600">Recherche</label>
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="libellé, notes, statut…"
            />
          </div>
        </div>

        <div className="mt-3 overflow-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-[1100px] w-full text-sm">
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
                <th className="px-3 py-2 text-xs text-slate-600">Date</th>
                <th className="px-3 py-2 text-xs text-slate-600">Bien</th>
                <th className="px-3 py-2 text-xs text-slate-600">Sens</th>
                <th className="px-3 py-2 text-xs text-slate-600">Catégorie</th>
                <th className="px-3 py-2 text-xs text-slate-600">Statut</th>
                <th className="px-3 py-2 text-xs text-slate-600">Libellé</th>
                <th className="px-3 py-2 text-xs text-slate-600 text-right">Montant</th>
                <th className="px-3 py-2 text-xs text-slate-600">Source</th>
              </tr>
            </thead>

            <tbody>
              {filteredMonthLedger.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-slate-500">
                    Aucune écriture (ou filtres trop restrictifs).
                  </td>
                </tr>
              ) : (
                filteredMonthLedger.map((r) => {
                  const p = r.property_id ? propsById.get(r.property_id) : null;
                  const isChecked = !!selected[r.id];
                  const isAuto = !!r.receipt_id;

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
                      <td className="px-3 py-2 text-slate-700">{p?.label || "—"}</td>
                      <td className="px-3 py-2 text-slate-700">{r.direction === "in" ? "Entrée" : "Sortie"}</td>
                      <td className="px-3 py-2 text-slate-700">{r.category}</td>
                      <td className="px-3 py-2 text-slate-700">{r.status}</td>
                      <td className="px-3 py-2 text-slate-700">{r.label || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        {r.direction === "out" ? "− " : ""}
                        {formatEuro(Number(r.amount || 0))}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {isAuto ? (
                          <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[0.7rem] font-semibold text-cyan-700">
                            Quittance (auto)
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.7rem] font-semibold text-slate-700">
                            Manuel
                          </span>
                        )}
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

      {/* Cashflow & rendement par bien */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-900">Cashflow & rentabilité par bien</p>
        <p className="text-[0.8rem] text-slate-600">
          Pour un résultat fiable : renseigne (optionnel) le prix, le crédit, charges fixes, taxe foncière.
        </p>

        {perProperty.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
            Pas d’écritures affectées à des biens ce mois-ci.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {perProperty.map((r) => (
              <div key={r.propertyId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                    <p className="text-xs text-slate-600">
                      Entrées {formatEuro(r.income)} • Sorties {formatEuro(r.expense)} • Net {formatEuro(r.net)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-600">Cashflow (avec crédit/fixes si saisis)</p>
                    <p className="text-lg font-semibold text-slate-900">{formatEuro(r.cashflow)}</p>
                    <p className="text-xs text-slate-500">
                      Rendement net approx : <span className="font-semibold">{(r.yieldNet * 100).toFixed(2)}%</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <Stat label="Crédit (mensuel)" value={formatEuro(r.loan)} />
                  <Stat label="Charges fixes (mensuel)" value={formatEuro(r.fixed)} />
                  <Stat label="TF (mensuel)" value={formatEuro(r.taxM)} />
                  <Stat label="Investissement" value={formatEuro(r.invest)} />
                </div>

                {r.propertyId !== "—" ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                      Paramétrer ce bien (prix, crédit, charges)
                    </summary>

                    <PropertyFinanceForm propertyId={r.propertyId} existing={pf.get(r.propertyId) || null} onSave={upsertPropertyFinance} />
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attendu vs encaissé */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Encaissement (baux/paiements)</p>
        <div className="mt-3">
          <MiniBar value={monthInfo.received} max={monthInfo.expected} label="Taux d’encaissement" />
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{sub}</p>
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

function PropertyFinanceForm({
  propertyId,
  existing,
  onSave,
}: {
  propertyId: string;
  existing: PropertyFinance | null;
  onSave: (propertyId: string, patch: Partial<PropertyFinance>) => Promise<void>;
}) {
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
    fixed_charges_monthly: existing?.fixed_charges_monthly ?? null,
    property_tax_yearly: existing?.property_tax_yearly ?? null,
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
      fixed_charges_monthly: existing?.fixed_charges_monthly ?? null,
      property_tax_yearly: existing?.property_tax_yearly ?? null,
    }));
  }, [existing]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    await onSave(propertyId, {
      purchase_price: s.purchase_price,
      notary_fees: s.notary_fees,
      agency_fees: s.agency_fees,
      works: s.works,
      down_payment: s.down_payment,
      loan_monthly: s.loan_monthly,
      loan_insurance_monthly: s.loan_insurance_monthly,
      fixed_charges_monthly: s.fixed_charges_monthly,
      property_tax_yearly: s.property_tax_yearly,
    });
  };

  return (
    <form onSubmit={save} className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Prix d’achat" value={s.purchase_price} onChange={(v) => setS((p) => ({ ...p, purchase_price: v }))} />
        <Field label="Frais notaire" value={s.notary_fees} onChange={(v) => setS((p) => ({ ...p, notary_fees: v }))} />
        <Field label="Frais agence" value={s.agency_fees} onChange={(v) => setS((p) => ({ ...p, agency_fees: v }))} />
        <Field label="Travaux" value={s.works} onChange={(v) => setS((p) => ({ ...p, works: v }))} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Mensualité crédit" value={s.loan_monthly} onChange={(v) => setS((p) => ({ ...p, loan_monthly: v }))} />
        <Field
          label="Assurance crédit (mensuel)"
          value={s.loan_insurance_monthly}
          onChange={(v) => setS((p) => ({ ...p, loan_insurance_monthly: v }))}
        />
        <Field
          label="Charges fixes (mensuel)"
          value={s.fixed_charges_monthly}
          onChange={(v) => setS((p) => ({ ...p, fixed_charges_monthly: v }))}
        />
        <Field
          label="Taxe foncière (annuel)"
          value={s.property_tax_yearly}
          onChange={(v) => setS((p) => ({ ...p, property_tax_yearly: v }))}
        />
      </div>

      <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
        Enregistrer
      </button>
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
