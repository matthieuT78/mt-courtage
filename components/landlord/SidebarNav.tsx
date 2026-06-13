import React from "react";
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
  className = "",
}: {
  active: LandlordSectionKey;
  onChange: (k: LandlordSectionKey) => void;
  healthScore: number;
  overLimit: boolean;
  navOrder?: LandlordSectionKey[];
  className?: string;
}) {
  // 🎨 Brand lokt.fr
  const brandBg = "bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

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
    <aside className={`h-max w-full lg:w-[280px] lg:sticky lg:top-4 ${className}`}>
      <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        {/* Header sidebar */}
        <div className="px-2 pt-1 pb-3">
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${brandBg} text-xs font-semibold text-white shadow-sm`}>
              L
            </span>
            <p className="text-[0.7rem] lowercase tracking-[0.18em] text-slate-600">lokt.fr</p>
          </div>

          <p className="mt-1 text-sm font-semibold text-slate-900">Espace bailleur</p>
          <p className="mt-1 text-[0.75rem] leading-5 text-slate-600">Pilotez vos logements, loyers et documents.</p>
        </div>

        {/* Nav items */}
        <div className="mt-1 space-y-1">
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

        {/* Shortcuts */}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-[#f6f9fc] px-3 py-3">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Raccourcis</p>

          <div className="mt-2 flex flex-wrap gap-2">
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => go(e, "biens")}
              onKeyDown={(e) => onKey(e, "biens")}
              className={`cursor-pointer select-none rounded-full px-3 py-1.5 text-[0.75rem] font-semibold ${brandBg} ${brandText} ${brandHover}`}
            >
              + Bien
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={(e) => go(e, "locataires")}
              onKeyDown={(e) => onKey(e, "locataires")}
              className="cursor-pointer select-none rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
            >
              + Locataire
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={(e) => go(e, "baux")}
              onKeyDown={(e) => onKey(e, "baux")}
              className="cursor-pointer select-none rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
            >
              + Bail
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
