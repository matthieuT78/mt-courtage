// components/landlord/ui/uiHelpers.ts
export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export function pluralFR(n: number, singular: string, plural?: string) {
  const p = plural ?? `${singular}s`;
  return `${n} ${n > 1 ? p : singular}`;
}

export function badge(tone: "slate" | "sky" | "emerald" | "amber" | "red", label: string) {
  const cls =
    tone === "sky"
      ? "border-sky-200 bg-sky-50 text-sky-900"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold " + cls}>
      {label}
    </span>
  );
}
