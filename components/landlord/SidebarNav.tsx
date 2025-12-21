// components/landlord/SidebarNav.tsx
import React from "react";
import { Pill } from "./UiBits";

export type LandlordSectionKey =
  | "dashboard"
  | "locataires"
  | "biens"
  | "baux"
  | "etat_des_lieux"
  | "quittances"
  | "loyers"
  | "finance"
  | "revision"
  | "compteurs"
  | "inventaire"
  | "parametres";

type Item = {
  key: LandlordSectionKey;
  label: string;
  icon: string;
  badge?: React.ReactNode;
};

export function SidebarNav({
  active,
  onChange,
  healthScore,
  overLimit,
}: {
  active: LandlordSectionKey;
  onChange: (k: LandlordSectionKey) => void;
  healthScore: number;
  overLimit: boolean;
}) {
  // 🎨 Brand Izimo
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  const items: Item[] = [
    {
      key: "dashboard",
      label: "Tableau de bord",
      icon: "🏁",
      badge: (
        <Pill tone={healthScore >= 80 ? "emerald" : healthScore >= 60 ? "amber" : "red"}>
          Score {healthScore}
        </Pill>
      ),
    },

    { key: "locataires", label: "Locataires", icon: "👤" },
    { key: "biens", label: "Biens", icon: "🏠" },
    { key: "baux", label: "Baux", icon: "📄" },
    { key: "etat_des_lieux", label: "État des lieux", icon: "📝", badge: <Pill tone="indigo">Nouveau</Pill> },
    { key: "quittances", label: "Quittances", icon: "🧾" },

    { key: "loyers", label: "Loyers", icon: "💶" },
    { key: "finance", label: "Finance", icon: "📊" },
    { key: "revision", label: "Révision loyer", icon: "📈", badge: <Pill tone="indigo">Nouveau</Pill> },
    { key: "compteurs", label: "Compteurs", icon: "⚡", badge: <Pill tone="indigo">Nouveau</Pill> },
    { key: "inventaire", label: "Inventaire", icon: "📦", badge: <Pill tone="indigo">Nouveau</Pill> },

    { key: "parametres", label: "Paramètres", icon: "⚙️", badge: overLimit ? <Pill tone="amber">Pro</Pill> : null },
  ];

  const go = (e: React.SyntheticEvent, key: LandlordSectionKey) => {
    (e as any).preventDefault?.();
    (e as any).stopPropagation?.();
    console.log("[SidebarNav] click ->", key);
    onChange(key);
  };

  const onKey = (e: React.KeyboardEvent, key: LandlordSectionKey) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      console.log("[SidebarNav] key ->", key);
      onChange(key);
    }
  };

  return (
    <aside className="w-full lg:w-[280px] lg:sticky lg:top-4 h-max">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-3">
        {/* Header sidebar */}
        <div className="px-2 pt-1 pb-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${brandBg}`} />
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600">Izimo</p>
          </div>

          <p className="mt-1 text-sm font-semibold text-slate-900">Espace bailleur</p>
          <p className="mt-1 text-[0.75rem] text-slate-600">
            Tout sur une page. Navigation à gauche.
          </p>
        </div>

        {/* Nav items */}
        <div className="mt-1 space-y-1">
          {items.map((it) => {
            const isActive = it.key === active;

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
                    : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50")
                }
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{it.icon}</span>
                  <span
                    className={
                      "text-[0.85rem] font-semibold truncate " +
                      (isActive ? "text-white" : "text-slate-900")
                    }
                  >
                    {it.label}
                  </span>
                </span>

                {it.badge ? (
                  <span className={isActive ? "opacity-95" : ""}>{it.badge}</span>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>

        {/* Shortcuts */}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
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
