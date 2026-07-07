import { ArrowUpRightIcon, CheckCircleIcon, LockClosedIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useCheckout } from "../../lib/useCheckout";

export type LockedSectionConfig = {
  eyebrow: string;
  title: string;
  desc: string;
  requiredPlan: "lokt·one" | "lokt·plus";
  planId: string;
  cta: string;
  features: string[];
};

export function LockedPremiumSection({ config }: { config: LockedSectionConfig }) {
  const { startCheckout, loading, error } = useCheckout();

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />
      <div className="grid gap-0 lg:grid-cols-[1fr,340px]">
        <div className="p-6 sm:p-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#635bff]/20 bg-[#635bff]/5 px-3 py-1 text-xs font-semibold text-[#4f46e5]">
            <LockClosedIcon className="h-4 w-4" aria-hidden="true" />
            {config.eyebrow}
          </div>

          <h2 className="mt-4 max-w-2xl text-2xl font-semibold leading-tight text-slate-950">{config.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{config.desc}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {config.features.map((feature) => (
              <div key={feature} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <p className="text-sm leading-5 text-slate-700">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-slate-200 bg-[#f6f9fc] p-6 lg:border-l lg:border-t-0">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <SparklesIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Plan requis</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{config.requiredPlan}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Votre compte gratuit reste disponible pour le tableau de bord, biens, locataires, baux, quittances manuelles et finance de base.
            </p>
            <button
              type="button"
              onClick={() => startCheckout(config.planId)}
              disabled={loading}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Redirection…" : config.cta}
              {!loading && <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />}
            </button>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}
