import type { ReactNode } from "react";
import type { ComponentType, SVGProps } from "react";
import { CheckIcon, SparklesIcon } from "@heroicons/react/24/outline";

type CalculatorProgressStep = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type CalculatorWizardShellProps = {
  steps: CalculatorProgressStep[];
  currentIndex: number;
  children: ReactNode;
  onStepClick?: (index: number) => void;
  canAccessStep?: (index: number) => boolean;
  title?: string;
};

export default function CalculatorWizardShell({
  steps,
  currentIndex,
  children,
  onStepClick,
  canAccessStep = () => true,
  title = "Votre simulation en quelques étapes.",
}: CalculatorWizardShellProps) {
  return (
    <section className="relative z-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
      <div className="grid lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="relative overflow-hidden bg-slate-950 px-5 py-5 text-white sm:px-6 lg:min-h-[39rem] lg:py-7">
          <div className="absolute inset-0 bg-gradient-to-br from-[#635bff] via-[#007ba7] to-[#00a97b] opacity-95" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.2),transparent_38%,rgba(255,184,0,.22))]" />
          <div className="relative">
            <div className="flex items-center justify-between gap-4 lg:block">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/70">Simulation guidée</p>
                <p className="mt-2 text-xl font-semibold leading-tight text-white">{title}</p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 lg:mt-5">
                <SparklesIcon className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-white/75">Étape {currentIndex + 1} sur {steps.length}</p>
            <div className="-mx-1 mt-5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:overflow-visible lg:px-0">
              <div className="flex min-w-max gap-2 lg:min-w-0 lg:flex-col">
                {steps.map(({ label, icon: Icon }, index) => {
                  const active = currentIndex === index;
                  const done = index < currentIndex;
                  const accessible = canAccessStep(index);
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={!accessible}
                      onClick={() => accessible && onStepClick?.(index)}
                      className={
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition lg:w-full " +
                        (active
                          ? "border-white/70 bg-white text-slate-950 shadow-lg"
                          : done
                          ? "border-white/25 bg-white/15 text-white hover:bg-white/20"
                          : "border-white/10 bg-white/5 text-white/65") +
                        (accessible ? "" : " cursor-not-allowed opacity-60")
                      }
                    >
                      <span className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " + (active ? "bg-slate-950 text-white" : "bg-white/15")}>
                        {done ? <CheckIcon className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <span>
                        <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.14em] opacity-70">0{index + 1}</span>
                        <span className="block text-sm font-semibold">{label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-6 hidden text-xs leading-5 text-white/70 lg:block">
              Vos hypothèses restent modifiables jusqu&apos;au résultat final.
            </p>
          </div>
        </aside>
        <div className="min-w-0 bg-white p-5 sm:p-8">{children}</div>
      </div>
    </section>
  );
}
