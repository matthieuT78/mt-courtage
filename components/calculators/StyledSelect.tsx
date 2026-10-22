// components/calculators/StyledSelect.tsx
//
// Remplace le <select> HTML natif : son état fermé peut être restylé en
// CSS, mais la liste déroulante OUVERTE est dessinée par le navigateur
// (police et couleurs système) — impossible à harmoniser avec le reste
// de l'interface en CSS seul. Ce composant redessine aussi la liste
// ouverte pour rester cohérent partout.
import { useEffect, useRef, useState } from "react";

export type SelectOption<T extends string> = { value: T; label: string };

export default function StyledSelect<T extends string>({
  value,
  onChange,
  options,
  size = "base",
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  size?: "base" | "small";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (open) setHighlight(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, value, options]);

  const commit = (opt: SelectOption<T>) => {
    onChange(opt.value);
    setOpen(false);
  };

  const triggerClass =
    "flex w-full min-w-0 items-center justify-between gap-2 cursor-pointer rounded-xl border bg-white text-left text-sm text-slate-900 shadow-sm transition " +
    "focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 " +
    (size === "small" ? "rounded-lg px-3 py-2" : "px-3.5 py-2.5") +
    " " +
    (open ? "border-cyan-400 ring-4 ring-cyan-100" : "border-slate-200");

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setOpen(true);
            else setHighlight((h) => Math.min(options.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (open) setHighlight((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (open) commit(options[highlight]);
            else setOpen(true);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerClass}
      >
        <span className="truncate">{current?.label}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          className="absolute z-30 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1.5 text-sm shadow-lg shadow-slate-900/10"
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => commit(opt)}
              onMouseEnter={() => setHighlight(i)}
              className={
                "cursor-pointer px-3.5 py-2 transition " +
                (opt.value === value ? "font-semibold text-slate-950" : "text-slate-700") +
                (i === highlight ? " bg-cyan-50" : "")
              }
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
