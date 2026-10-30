import type { ComponentType, SVGProps } from "react";

type StepHeaderProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  stepNumber: number;
  label: string;
  description?: string;
  // Format "petit" des widgets agence (cf. compactSteps dans les pages/embed/*)
  // : icône + titre sur une ligne, sans l'étiquette "Étape 0X" déjà redondante
  // avec le bandeau fin de CalculatorWizardShell en mode compactHeader.
  compact?: boolean;
};

// Header de contenu d'étape partagé par les 3 wizards (capacité, prêt relais,
// rentabilité locative) — avant son extraction ici, chacun avait sa propre
// version qui avait fini par diverger (icône manquante, étiquette "ÉTAPE"
// différente ou absente), repéré lors d'un audit du widget agence.
export default function StepHeader({ icon: Icon, stepNumber, label, description, compact = false }: StepHeaderProps) {
  if (compact) {
    return (
      <header className="flex items-start gap-2.5 border-b border-slate-100 pb-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 via-cyan-50 to-emerald-50 text-[#3f37c9]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight text-slate-950">{label}</h2>
          {description ? <p className="mt-0.5 text-xs leading-5 text-slate-600">{description}</p> : null}
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-slate-100 pb-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 via-cyan-50 to-emerald-50 text-[#3f37c9]">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">
        Étape 0{stepNumber}
      </p>
      <h2 className="mt-1 text-2xl font-semibold leading-tight text-slate-950">{label}</h2>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
    </header>
  );
}
