// components/forms/DatePicker.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseISO(value?: string | null) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatFR(value?: string | null) {
  const d = parseISO(value);
  if (!d) return "";
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
}

// Grille du mois, du lundi au dimanche, avec les jours des mois voisins pour compléter la grille.
function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = lundi
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ date: new Date(year, month, 1 - (startOffset - i)), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }
  return cells;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "jj/mm/aaaa",
  className,
  minYear,
  maxYear,
}: {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  minYear?: number;
  maxYear?: number;
}) {
  const selected = parseISO(value);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear() - 30);
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  const lastYear = maxYear ?? today.getFullYear();
  const firstYear = minYear ?? today.getFullYear() - 110;
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = lastYear; y >= firstYear; y--) list.push(y);
    return list;
  }, [firstYear, lastYear]);

  useEffect(() => {
    if (!open) return;
    setViewYear(selected?.getFullYear() ?? viewYear);
    setViewMonth(selected?.getMonth() ?? viewMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1);
  };

  const pick = (date: Date) => {
    onChange(toISO(date.getFullYear(), date.getMonth(), date.getDate()));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          className ||
          "flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors"
        }
      >
        <span className={selected ? "text-slate-900" : "text-slate-400"}>{selected ? formatFR(value) : placeholder}</span>
        <CalendarDaysIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={goPrevMonth}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="Mois précédent"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <div className="flex flex-1 items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="min-w-0 flex-1 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={i}>{label}</option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="w-24 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={goNextMonth}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="Mois suivant"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
            {DAY_LABELS.map((d, i) => (
              <span key={`${d}-${i}`} className="text-[0.65rem] font-semibold uppercase text-slate-400">{d}</span>
            ))}
            {grid.map(({ date, inMonth }, i) => {
              const isSelected = selected && date.toDateString() === selected.toDateString();
              const isToday = date.toDateString() === today.toDateString();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(date)}
                  className={
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors " +
                    (isSelected
                      ? "bg-slate-900 font-semibold text-white"
                      : inMonth
                      ? "text-slate-700 hover:bg-slate-100"
                      : "text-slate-300 hover:bg-slate-50") +
                    (isToday && !isSelected ? " ring-1 ring-inset ring-slate-300" : "")
                  }
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {selected && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="mt-2 w-full rounded-lg px-2 py-1.5 text-center text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Effacer la date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
