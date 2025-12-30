// components/landlord/ui/ExpandableRow.tsx
import React from "react";
import { cx } from "./uiHelpers";

export function ExpandableRow({
  id,
  expandedId,
  setExpandedId,
  tone = "slate",
  left,
  right,
  children,
  hideToggleLabel = false,
  hideRight = false,
  toggleLabelClosed = "Détails",
  toggleLabelOpen = "Réduire",
}: {
  id: string;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  tone?: "slate" | "sky";
  left: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;

  /** ✅ cache le badge "Détails / Réduire" */
  hideToggleLabel?: boolean;

  /** ✅ cache toute la colonne de droite (right + badge) */
  hideRight?: boolean;

  /** (optionnel) libellés personnalisés */
  toggleLabelClosed?: string;
  toggleLabelOpen?: string;
}) {
  const open = expandedId === id;

  const ring = tone === "sky" ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white";
  const openRing = tone === "sky" ? "border-sky-300 bg-sky-50" : "border-emerald-300 bg-emerald-50";

  return (
    <div className={cx("rounded-2xl border overflow-hidden", open ? openRing : ring)}>
      <button
        type="button"
        onClick={() => setExpandedId(open ? null : id)}
        className="w-full text-left px-3 py-3 flex items-start justify-between gap-3"
      >
        <div className="min-w-0 flex-1">{left}</div>

        {!hideRight ? (
          <div className="shrink-0 flex items-center gap-2">
            {right}

            {!hideToggleLabel ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800">
                {open ? toggleLabelOpen : toggleLabelClosed}
              </span>
            ) : null}
          </div>
        ) : null}
      </button>

      {open ? (
        <div className="px-3 pb-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
