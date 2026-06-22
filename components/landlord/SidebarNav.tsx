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
  onContactClick,
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
  onContactClick?: () => void;
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
          {/* Header : bouton expand */}
          <div className="shrink-0 flex items-center justify-center pb-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Agrandir le menu"
              className={`group flex h-7 w-7 items-center justify-center rounded-lg ${brandBg} text-white shadow-sm transition hover:opacity-90 active:scale-95`}
            >
              <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          </div>

          {/* Nav — icônes uniquement, flex-1 adaptatif */}
          <div className="min-h-0 flex-1 w-full flex flex-col gap-px px-1.5">
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
                    "flex-1 min-h-0 max-h-10 select-none cursor-pointer flex items-center justify-center rounded-xl transition " +
                    (isActive
                      ? `${brandBg} shadow-sm`
                      : "hover:bg-slate-100")
                  }
                >
                  <Icon className={"h-4 w-4 " + (isActive ? "text-white" : "text-slate-500")} aria-hidden="true" />
                </div>
              );
            })}
          </div>

          {/* Bas : dark toggle + aide */}
          <div className="mt-2 shrink-0 w-full flex flex-col gap-1 px-1.5">
            {onToggleDark && (
              <button
                type="button"
                onClick={onToggleDark}
                title={isDark ? "Mode clair" : "Mode sombre"}
                className="flex h-8 w-full items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {isDark ? <SunIcon className="h-4 w-4" aria-hidden="true" /> : <MoonIcon className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
            {onContactClick && (
              <button
                type="button"
                onClick={onContactClick}
                title="Aide & contact"
                className="flex h-8 w-full items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            )}
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
        <div className="shrink-0 flex items-center justify-between px-2 pb-2 pt-1">
          {onToggleDark && (
            <button
              type="button"
              onClick={onToggleDark}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {isDark ? <SunIcon className="h-4 w-4" aria-hidden="true" /> : <MoonIcon className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
          {!onToggleDark && <span />}
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Réduire le menu"
            className={`group flex h-7 w-7 items-center justify-center rounded-lg ${brandBg} text-white shadow-sm transition hover:opacity-90 active:scale-95`}
          >
            <ChevronLeftIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          </button>
        </div>

        {/* Nav items — flex-1 par item pour s'adapter à la hauteur disponible */}
        <div className="mt-1 min-h-0 flex-1 flex flex-col gap-px">
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
                  "flex-1 min-h-0 max-h-10 select-none cursor-pointer rounded-xl px-2.5 transition flex items-center justify-between gap-2 " +
                  (isActive
                    ? `${brandBg} ${brandText} shadow-sm`
                    : "text-slate-700 hover:bg-slate-100")
                }
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className={"h-4 w-4 shrink-0 " + (isActive ? "text-white" : "text-slate-400")} aria-hidden="true" />
                  <span className={"text-[0.82rem] font-medium truncate " + (isActive ? "text-white" : "text-slate-800")}>
                    {it.label}
                  </span>
                </span>
                {it.badge ? <span className={isActive ? "opacity-95" : ""}>{it.badge}</span> : null}
              </div>
            );
          })}
        </div>

        {/* Bas : aide & contact */}
        {onContactClick && (
          <div className="mt-2 shrink-0">
            <button
              type="button"
              onClick={onContactClick}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[0.75rem] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Aide & contact
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
