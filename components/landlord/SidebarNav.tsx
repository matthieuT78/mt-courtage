import React from "react";
import { ChevronLeftIcon, ChevronRightIcon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
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
  collapsed = false,
  onToggleCollapse,
  className = "",
}: {
  active: LandlordSectionKey;
  onChange: (k: LandlordSectionKey) => void;
  healthScore: number;
  overLimit: boolean;
  navOrder?: LandlordSectionKey[];
  isDark?: boolean;
  onToggleDark?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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

  /* ── Sidebar réduite (icônes seules) ─────────────────────── */
  if (collapsed) {
    return (
      <aside className={`h-full w-full ${className}`}>
        <div className="flex h-full flex-col items-center rounded-[2rem] border border-slate-200 bg-white/95 py-3 shadow-sm backdrop-blur overflow-hidden">
          {/* Logo */}
          <div className="shrink-0 pb-3">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${brandBg} text-xs font-semibold text-white shadow-sm`}>
              L
            </span>
          </div>

          {/* Nav — icônes uniquement */}
          <div className="min-h-0 flex-1 w-full space-y-1 overflow-y-auto px-1.5">
            {items.map((it) => {
              const isActive = it.key === active;
              const Icon = it.icon;
              return (
                <div
                  key={it.key}
                  role="button"
                  tabIndex={0}
                  title={it.label}
                  onClick={(e) => go(e, it.key)}
                  onKeyDown={(e) => onKey(e, it.key)}
                  className={
                    "select-none cursor-pointer flex h-10 w-full items-center justify-center rounded-2xl transition " +
                    (isActive
                      ? `${brandBg} shadow-sm`
                      : "hover:bg-slate-100")
                  }
                >
                  <Icon className={"h-5 w-5 " + (isActive ? "text-white" : "text-slate-500")} aria-hidden="true" />
                </div>
              );
            })}
          </div>

          {/* Bas : dark toggle + expand */}
          <div className="mt-2 shrink-0 w-full space-y-1 px-1.5">
            {onToggleDark && (
              <button
                type="button"
                onClick={onToggleDark}
                title={isDark ? "Mode clair" : "Mode sombre"}
                className="flex h-10 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {isDark ? <SunIcon className="h-4 w-4" aria-hidden="true" /> : <MoonIcon className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Agrandir le menu"
              className="flex h-10 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  /* ── Sidebar étendue ──────────────────────────────────────── */
  return (
    <aside className={`h-full w-full ${className}`}>
      <div className="flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-2 pb-3 pt-1">
          <div className="flex items-center justify-between">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${brandBg} text-sm font-bold text-white shadow-sm`}>
              L
            </span>
            {/* Bouton réduire */}
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Réduire le menu"
              className="group flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition hover:bg-slate-700 active:scale-95"
            >
              <ChevronLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
            </button>
          </div>

          {onToggleDark && (
            <button
              type="button"
              onClick={onToggleDark}
              className={`mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                isDark
                  ? "border-[#635bff]/25 bg-[#635bff]/8 text-[#4f46e5] hover:bg-[#635bff]/12"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
              aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              <span className="flex items-center gap-2">
                {isDark ? <SunIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <MoonIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                {isDark ? "Mode clair" : "Mode sombre"}
              </span>
              <span className={`relative h-4 w-7 rounded-full transition-colors ${isDark ? "bg-[#635bff]" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${isDark ? "left-3.5" : "left-0.5"}`} />
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
                    : "bg-white text-slate-800 border-slate-200 hover:border-[#635bff]/25 hover:bg-[#f6f9fc]")
                }
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-xl " + (isActive ? "bg-white/15 text-white" : "bg-slate-50 text-slate-500")}>
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
