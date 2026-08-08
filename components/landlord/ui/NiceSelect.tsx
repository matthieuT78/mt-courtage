import React, { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { cx } from "./uiHelpers";

export type NiceSelectOption = {
  value: string;
  label: string;
  subtitle?: string;
  // Icône spécifique à cette option (ex. un type de bail) — remplace la
  // pastille d'initiales, qui n'a de sens que pour une entité nommée
  // (personne, bien), pas pour une catégorie générique.
  icon?: React.ComponentType<{ className?: string }>;
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = parts.length > 1 ? parts[1][0] : "";
  return (a + b).toUpperCase();
}

// Remplace un <select> natif (liste d'options non stylable par CSS, rendue par
// l'OS) par un menu personnalisé au style Lokt : icône/avatar + libellé +
// sous-titre par option, cohérent avec le reste de l'interface.
export function NiceSelect({
  value,
  onChange,
  options,
  placeholder = "— Sélectionner —",
  icon: Icon,
  disabled,
  allowClear = true,
}: {
  value: string;
  onChange: (value: string) => void;
  options: NiceSelectOption[];
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) || null;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm transition",
          disabled ? "cursor-not-allowed opacity-60" : "hover:border-slate-400 focus:border-[#635bff] focus:outline-none focus:ring-2 focus:ring-[#635bff]/10"
        )}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-slate-400" /> : null}
        <span className={cx("min-w-0 flex-1 truncate", selected ? "text-slate-900" : "text-slate-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon className={cx("h-4 w-4 shrink-0 text-slate-400 transition-transform", open ? "rotate-180" : "")} />
      </button>

      {open && !disabled ? (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {allowClear ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">—</span>
              {placeholder}
            </button>
          ) : null}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cx(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition",
                opt.value === value ? "bg-[#635bff]/5" : "hover:bg-slate-50"
              )}
            >
              {opt.icon ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <opt.icon className="h-4 w-4" />
                </span>
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#635bff] to-[#00d4ff] text-[0.65rem] font-bold text-white">
                  {initialsOf(opt.label)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{opt.label}</span>
                {opt.subtitle ? <span className="block truncate text-xs text-slate-500">{opt.subtitle}</span> : null}
              </span>
              {opt.value === value ? <CheckIcon className="h-4 w-4 shrink-0 text-[#635bff]" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
