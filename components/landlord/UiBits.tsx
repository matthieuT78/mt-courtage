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
    <span className={"inline-flex min-w-0 max-w-full items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold " + cls}>
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
    <div className={"min-w-0 rounded-2xl border p-4 shadow-sm " + base}>
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-1 break-words text-lg font-semibold text-slate-900">{value}</p>
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
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {kicker ? <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{kicker}</p> : null}
        <h2 className="mt-1 text-base sm:text-lg font-semibold text-slate-900">{title}</h2>
        {desc ? <p className="mt-1 text-xs text-slate-600">{desc}</p> : null}
      </div>
      {right ? <div className="min-w-0 sm:shrink-0">{right}</div> : null}
    </div>
  );
}

export function WorkflowIntro({
  title,
  description,
  steps,
  note,
}: {
  title: string;
  description: string;
  steps: Array<{ title: string; text: string }>;
  note?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#635bff] via-[#27b7ff] to-[#00d4a4]" aria-hidden="true" />
      <div className="relative p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00d4a4] shadow-[0_0_0_4px_rgba(0,212,164,0.12)]" aria-hidden="true" />
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Parcours conseillé</p>
            </div>
            <p className="mt-2 text-base font-semibold tracking-tight text-slate-950">{title}</p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <span className="inline-flex w-fit shrink-0 rounded-full border border-[#635bff]/15 bg-[#635bff]/5 px-3 py-1 text-[0.7rem] font-semibold text-[#4f46e5]">
            3 actions
          </span>
        </div>

        <div className="mt-5 grid gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] sm:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={`${step.title}-${index}`}
              className="min-w-0 border-b border-slate-200 p-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#4f46e5] shadow-sm ring-1 ring-slate-200">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{step.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {note ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs leading-5 text-slate-500">{note}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
