// components/landlord/sections/SectionFinance.tsx
import React, { useMemo, useState } from "react";
import { SectionTitle, formatEuro } from "../UiBits";
import type { Lease, Property, RentPayment } from "../../../lib/landlord/types";

type Props = {
  leases?: Lease[];
  payments?: RentPayment[];
  propertyById?: Map<string, Property>;
};

const toMonthISO = (d: Date) => d.toISOString().slice(0, 7); // YYYY-MM

const monthStartEnd = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start, end };
};

const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

const normalizeDate = (val?: string | null) => {
  if (!val) return null;
  const d = new Date(val + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
};

const sum = (arr: number[]) => arr.reduce((acc, x) => acc + (Number.isFinite(x) ? x : 0), 0);

const fmtMonthFR = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

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

function Sparkline({ values }: { values: number[] }) {
  const w = 180;
  const h = 40;
  const pad = 4;

  const clean = values.map((v) => (Number.isFinite(v) ? v : 0));
  const min = Math.min(...clean, 0);
  const max = Math.max(...clean, 1);

  const xStep = clean.length <= 1 ? 0 : (w - pad * 2) / (clean.length - 1);
  const y = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return pad + (h - pad * 2) * (1 - t);
  };

  const points = clean.map((v, i) => `${pad + i * xStep},${y(v)}`).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-900" />
    </svg>
  );
}

export function SectionFinance({ leases, payments, propertyById }: Props) {
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const propsById = propertyById instanceof Map ? propertyById : new Map();

  const [month, setMonth] = useState<string>(toMonthISO(new Date()));
  const [startingCash, setStartingCash] = useState<string>("0");
  const [show12m, setShow12m] = useState(true);

  const monthInfo = useMemo(() => {
    const { start, end } = monthStartEnd(month);

    const activeLeases = safeLeases.filter((l) => {
      const s = normalizeDate(l.start_date);
      const e = normalizeDate(l.end_date);
      if (!s) return false;
      const startsBeforeEnd = s.getTime() <= end.getTime();
      const notEnded = !e || e.getTime() >= start.getTime();
      const statusOk = (l.status || "active").toLowerCase() !== "draft";
      return startsBeforeEnd && notEnded && statusOk;
    });

    const expected = sum(activeLeases.map((l) => Number(l.rent_amount || 0) + Number(l.charges_amount || 0)));

    const monthPayments = safePayments.filter((p) => {
      const ps = normalizeDate(p.period_start);
      const pe = normalizeDate(p.period_end);
      if (!ps || !pe) return false;
      const overlaps = !(pe.getTime() < start.getTime() || ps.getTime() > end.getTime());
      return overlaps;
    });

    const received = sum(monthPayments.filter((p) => !!p.paid_at).map((p) => Number(p.total_amount || 0)));
    const pending = Math.max(0, expected - received);

    const paidLeaseIds = new Set(monthPayments.filter((p) => !!p.paid_at).map((p) => p.lease_id));
    const unpaidLeases = activeLeases.filter((l) => !paidLeaseIds.has(l.id));

    const byProperty = new Map<
      string,
      { expected: number; received: number; pending: number; leases: number }
    >();

    for (const l of activeLeases) {
      const key = l.property_id;
      const exp = Number(l.rent_amount || 0) + Number(l.charges_amount || 0);

      const leasePaid = sum(
        monthPayments
          .filter((p) => p.lease_id === l.id && !!p.paid_at)
          .map((p) => Number(p.total_amount || 0))
      );

      const cur = byProperty.get(key) || { expected: 0, received: 0, pending: 0, leases: 0 };
      cur.expected += exp;
      cur.received += leasePaid;
      cur.pending += Math.max(0, exp - leasePaid);
      cur.leases += 1;
      byProperty.set(key, cur);
    }

    const byPropertyRows = Array.from(byProperty.entries())
      .map(([propertyId, v]) => {
        const p = propsById.get(propertyId);
        return {
          propertyId,
          label: p?.label || "Bien",
          city: (p as any)?.city || "",
          ...v,
          rate: v.expected <= 0 ? 0 : v.received / v.expected,
        };
      })
      .sort((a, b) => b.pending - a.pending || b.expected - a.expected);

    return { expected, received, pending, activeLeases, unpaidLeases, byPropertyRows };
  }, [month, safeLeases, safePayments, propsById]);

  const series12m = useMemo(() => {
    if (!show12m) return null;

    const base = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) months.push(toMonthISO(addMonths(base, -i)));

    const expectedByMonth: number[] = [];
    const receivedByMonth: number[] = [];
    const cashflowByMonth: number[] = [];

    for (const m of months) {
      const { start, end } = monthStartEnd(m);

      const activeLeases = safeLeases.filter((l) => {
        const s = normalizeDate(l.start_date);
        const e = normalizeDate(l.end_date);
        if (!s) return false;
        const startsBeforeEnd = s.getTime() <= end.getTime();
        const notEnded = !e || e.getTime() >= start.getTime();
        const statusOk = (l.status || "active").toLowerCase() !== "draft";
        return startsBeforeEnd && notEnded && statusOk;
      });

      const expected = sum(activeLeases.map((l) => Number(l.rent_amount || 0) + Number(l.charges_amount || 0)));

      const monthPayments = safePayments.filter((p) => {
        const ps = normalizeDate(p.period_start);
        const pe = normalizeDate(p.period_end);
        if (!ps || !pe) return false;
        const overlaps = !(pe.getTime() < start.getTime() || ps.getTime() > end.getTime());
        return overlaps;
      });

      const received = sum(monthPayments.filter((p) => !!p.paid_at).map((p) => Number(p.total_amount || 0)));

      expectedByMonth.push(expected);
      receivedByMonth.push(received);
      cashflowByMonth.push(received - expected);
    }

    const startCash = Number(startingCash || 0) || 0;
    const cumul: number[] = [];
    let cur = startCash;
    for (const cf of cashflowByMonth) {
      cur += cf;
      cumul.push(cur);
    }

    return { months, expectedByMonth, receivedByMonth, cashflowByMonth, cumul };
  }, [show12m, safeLeases, safePayments, startingCash]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Finance"
        title="Analyse & pilotage"
        desc="Attendu vs encaissé, cashflow, tendances et alertes (sans fiscalité pour l’instant)."
      />

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

          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Trésorerie initiale (optionnel)</label>
            <input
              type="number"
              step="0.01"
              value={startingCash}
              onChange={(e) => setStartingCash(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-[180px]"
              placeholder="0"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700 select-none">
            <input
              type="checkbox"
              checked={show12m}
              onChange={(e) => setShow12m(e.target.checked)}
              className="h-4 w-4"
            />
            Afficher tendance 12 mois
          </label>
        </div>

        <div className="text-[0.75rem] text-slate-500">
          Période : <span className="font-semibold text-slate-900">{fmtMonthFR(month)}</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Attendu</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatEuro(monthInfo.expected)}</p>
          <p className="mt-1 text-xs text-slate-600">
            {monthInfo.activeLeases.length} bail{monthInfo.activeLeases.length > 1 ? "s" : ""} actifs
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Encaissé</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatEuro(monthInfo.received)}</p>
          <div className="mt-3">
            <MiniBar value={monthInfo.received} max={monthInfo.expected} label="Taux d’encaissement" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">À encaisser</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatEuro(monthInfo.pending)}</p>
          <p className="mt-1 text-xs text-slate-600">
            {monthInfo.unpaidLeases.length} bail{monthInfo.unpaidLeases.length > 1 ? "s" : ""} sans paiement
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Cashflow (brut)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {formatEuro(monthInfo.received - monthInfo.expected)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Brut = encaissé − attendu (charges externes / crédits à brancher ensuite)
          </p>
        </div>
      </div>

      {series12m ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Tendance 12 mois</p>
              <p className="text-[0.8rem] text-slate-600">Sparkline encaissé + trésorerie cumulée (indicatif).</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Encaissé</p>
                <Sparkline values={series12m.receivedByMonth} />
              </div>
              <div className="text-right">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Cumul</p>
                <Sparkline values={series12m.cumul} />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-600">Total attendu (12 mois)</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatEuro(sum(series12m.expectedByMonth))}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-600">Total encaissé (12 mois)</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatEuro(sum(series12m.receivedByMonth))}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-600">Trésorerie (fin période)</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatEuro(series12m.cumul[series12m.cumul.length - 1] ?? 0)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Par bien</p>
        <p className="text-[0.8rem] text-slate-600">Où ça encaisse… et où ça coince.</p>

        {monthInfo.byPropertyRows.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-700">
            Aucun bail actif sur ce mois.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {monthInfo.byPropertyRows.map((r) => (
              <div key={r.propertyId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {r.label} {r.city ? <span className="text-slate-500">• {r.city}</span> : null}
                    </p>
                    <p className="text-xs text-slate-600">
                      {r.leases} bail{r.leases > 1 ? "s" : ""} • Attendu {formatEuro(r.expected)} • Encaissé{" "}
                      {formatEuro(r.received)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-600">À encaisser</p>
                    <p className="text-base font-semibold text-slate-900">{formatEuro(r.pending)}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <MiniBar value={r.received} max={r.expected} label="Taux d’encaissement" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Alertes</p>
        <p className="text-[0.8rem] text-slate-600">Détection simple à partir des paiements enregistrés.</p>

        {monthInfo.unpaidLeases.length === 0 ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            ✅ Aucun impayé détecté sur {fmtMonthFR(month)} (selon les paiements saisis).
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 space-y-2">
            <p className="font-semibold">
              ⚠️ {monthInfo.unpaidLeases.length} bail{monthInfo.unpaidLeases.length > 1 ? "s" : ""} sans paiement
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
