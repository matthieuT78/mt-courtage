// components/landlord/UiBits.tsx
import React from "react";

export const formatEuro = (val: number | null | undefined) => {
  if (val == null || Number.isNaN(val)) return "—";
  return Number(val).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "2-digit" });
};

export function Pill({
  tone = "slate",
  children,
}: {
  tone?: "slate" | "emerald" | "amber" | "red" | "indigo";
  children: React.ReactNode;
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "indigo"
      ? "border-indigo-200 bg-indigo-50 text-indigo-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={"inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold " + cls}>
      {children}
    </span>
  );
}

export function KpiCard({
  title,
  value,
  hint,
  tone = "slate",
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "slate" | "emerald" | "amber" | "red" | "indigo";
}) {
  const base =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : tone === "red"
      ? "border-red-200 bg-red-50"
      : tone === "indigo"
      ? "border-indigo-200 bg-indigo-50"
      : "border-slate-200 bg-white";

  return (
    <div className={"rounded-2xl border p-4 shadow-sm " + base}>
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-[0.7rem] text-slate-600">{hint}</p> : null}
    </div>
  );
}

export function SectionTitle({
  kicker,
  title,
  desc,
  right,
}: {
  kicker?: string;
  title: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        {kicker ? <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{kicker}</p> : null}
        <h2 className="mt-1 text-base sm:text-lg font-semibold text-slate-900">{title}</h2>
        {desc ? <p className="mt-1 text-xs text-slate-600">{desc}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
