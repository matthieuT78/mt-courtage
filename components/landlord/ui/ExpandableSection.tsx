// components/landlord/ui/ExpandableSection.tsx
import React from "react";
import { cx } from "./uiHelpers";

export function ExpandableSection({
  title,
  subtitle,
  right,
  children,
  defaultOpen = true,
  tone = "slate",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  tone?: "slate" | "sky";
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  const headerTone =
    tone === "sky"
      ? "bg-sky-50 border-sky-200"
      : "bg-slate-50 border-slate-200";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={cx(
          "w-full text-left px-4 py-3 border-b flex items-start justify-between gap-3",
          headerTone
        )}
      >
        <div className="min-w-0">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p> : null}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {right}
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800">
            {open ? "Réduire" : "Ouvrir"}
          </span>
        </div>
      </button>

      {open ? <div className="p-4">{children}</div> : null}
    </section>
  );
}
