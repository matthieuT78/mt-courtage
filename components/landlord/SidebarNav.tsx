import React from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { Pill } from "./UiBits";
import { getLandlordNavItems, type LandlordSectionKey } from "./navigation";

export type { LandlordSectionKey } from "./navigation";

type Item = {
  key: LandlordSectionKey;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: React.ReactNode;
};

export function SidebarNav({
  active,
  onChange,
  healthScore,
  navOrder,
  isDark,
  onToggleDark,
  className = "",
}: {
  active: LandlordSectionKey;
  onChange: (k: LandlordSectionKey) => void;
  healthScore: number;
  overLimit: boolean;
  navOrder?: LandlordSectionKey[];
  isDark?: boolean;
  onToggleDark?: () => void;
  className?: string;
}) {
  // 🎨 Brand lokt.fr
  const brandBg = "bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]";
  const brandText = "text-white";
  const items: Item[] = getLandlordNavItems(navOrder).map((item) => ({
    ...item,
    badge:
      item.key === "dashboard" ? (
        <Pill tone={healthScore >= 80 ? "emerald" : healthScore >= 60 ? "amber" : "red"}>
          Santé {healthScore}
        </Pill>
      ) : undefined,
  }));

  const go = (e: React.SyntheticEvent, key: LandlordSectionKey) => {
    (e as any).preventDefault?.();
    (e as any).stopPropagation?.();
    onChange(key);
  };

  const onKey = (e: React.KeyboardEvent, key: LandlordSectionKey) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onChange(key);
    }
  };

  return (
    <aside className={`h-full w-full ${className}`}>
      <div className="flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur overflow-hidden">
        {/* Header sidebar */}
        <div className="shrink-0 px-2 pb-3 pt-1">
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${brandBg} text-xs font-semibold text-white shadow-sm`}>
              L
            </span>
            <p className="text-[0.7rem] lowercase tracking-[0.18em] text-slate-600">lokt.fr</p>
          </div>

          <p className="mt-1 text-sm font-semibold text-slate-900">Espace bailleur</p>
          <p className="mt-1 text-[0.75rem] leading-5 text-slate-600">Pilotez vos logements, loyers et documents.</p>

          {onToggleDark && (
            <button
              type="button"
              onClick={onToggleDark}
              className={`mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                isDark
                  ? "border-[#635bff]/25 bg-[#635bff]/10 text-[#9b96ff] hover:bg-[#635bff]/15"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
              aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              <span className="flex items-center gap-2">
                {isDark ? (
                  <SunIcon className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <MoonIcon className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {isDark ? "Mode clair" : "Mode sombre"}
              </span>
              {/* Toggle switch */}
              <span className={`relative h-4 w-7 rounded-full transition-colors ${isDark ? "bg-[#635bff]" : "bg-slate-300"}`}>
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${
                    isDark ? "left-3.5" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          )}
        </div>

        {/* Nav items */}
        <div className="mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {items.map((it) => {
            const isActive = it.key === active;
            const Icon = it.icon;

            return (
              <div
                key={it.key}
                role="button"
                tabIndex={0}
                onClick={(e) => go(e, it.key)}
                onKeyDown={(e) => onKey(e, it.key)}
                className={
                  "select-none cursor-pointer w-full text-left rounded-2xl px-3 py-2 border transition flex items-center justify-between gap-2 " +
                  (isActive
                    ? `${brandBg} ${brandText} border-transparent shadow-sm`
                    : "bg-white text-slate-800 border-slate-200 hover:border-[#635bff]/30 hover:bg-[#f6f9fc]")
                }
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl " +
                      (isActive ? "bg-white/15 text-white" : "bg-slate-50 text-slate-500")
                    }
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className={"text-[0.85rem] font-semibold truncate " + (isActive ? "text-white" : "text-slate-900")}>
                    {it.label}
                  </span>
                </span>

                {it.badge ? <span className={isActive ? "opacity-95" : ""}>{it.badge}</span> : <span />}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
