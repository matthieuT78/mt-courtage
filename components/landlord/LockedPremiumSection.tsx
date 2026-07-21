import type { ReactNode } from "react";
import { ArrowUpRightIcon, CheckCircleIcon, LockClosedIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useCheckout } from "../../lib/useCheckout";
import { PAID_BILLING_PLANS } from "../../lib/billingPlans";

export type LockedSectionConfig = {
  eyebrow: string;
  title: string;
  desc: string;
  requiredPlan: "lokt·one" | "lokt·plus";
  planId: string;
  cta: string;
  features: string[];
  preview?: ReactNode;
};

function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div aria-hidden="true" className="pointer-events-none blur-[3px] opacity-90">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
          <LockClosedIcon className="h-3.5 w-3.5 text-[#4f46e5]" aria-hidden="true" />
          Aperçu — débloqué avec l’abonnement
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "indigo" }) {
  const toneClass = tone === "emerald" ? "text-emerald-600" : tone === "indigo" ? "text-[#4f46e5]" : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export function LockedPremiumSection({ config }: { config: LockedSectionConfig }) {
  const { startCheckout, loading, error } = useCheckout();
  const priceLabel = PAID_BILLING_PLANS.find((p) => p.id === config.planId)?.priceLabel || "";

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />

      <div className="mx-auto max-w-3xl px-6 py-10 text-center sm:px-10 sm:py-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#635bff]/20 bg-[#635bff]/5 px-3 py-1 text-xs font-semibold text-[#4f46e5]">
          <LockClosedIcon className="h-4 w-4" aria-hidden="true" />
          {config.eyebrow}
        </div>

        <h2 className="mx-auto mt-5 max-w-xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">{config.title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">{config.desc}</p>
      </div>

      {config.preview ? (
        <div className="mx-auto max-w-4xl px-6 pb-8 sm:px-10">
          <PreviewFrame>{config.preview}</PreviewFrame>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-4xl gap-3 px-6 pb-8 sm:grid-cols-2 sm:px-10">
        {config.features.map((feature) => (
          <div key={feature} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <p className="text-sm leading-6 text-slate-700">{feature}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 bg-[#f6f9fc] px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <SparklesIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Plan requis</p>
              <p className="text-lg font-semibold text-slate-950">
                {config.requiredPlan} {priceLabel ? <span className="font-normal text-slate-500">— {priceLabel}</span> : null}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => startCheckout(config.planId)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Redirection…" : config.cta}
              {!loading && <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />}
            </button>
            <p className="text-xs text-slate-500">Sans engagement · résiliable à tout moment</p>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>
        <p className="mx-auto mt-5 max-w-4xl text-center text-xs text-slate-500 sm:text-left">
          Votre compte gratuit reste disponible pour le tableau de bord, biens, locataires, baux, quittances manuelles et finance de base.
        </p>
      </div>
    </section>
  );
}

export { StatCard };
