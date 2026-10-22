// components/calculators/CapaciteWidgetMedium.tsx
//
// Version "medium" du widget capacité d'emprunt : un seul écran compact
// (revenus, charges, apport, durée), résultat condensé avec le Score
// lokt.fr. Utilise le même moteur de calcul que la version complète
// (CapaciteWizard), pas de duplication — juste moins de champs exposés.
import { useState } from "react";
import { computeCapacite, formatEuro } from "../../lib/calculators/capaciteEngine";

const SCORE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  "Très solide": { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  Solide: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  "À optimiser": { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  "Sous tension": { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  "Refus probable": { text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
};

export default function CapaciteWidgetMedium() {
  const [revenus, setRevenus] = useState("");
  const [charges, setCharges] = useState("");
  const [apport, setApport] = useState("");
  const [duree, setDuree] = useState("25");
  const [result, setResult] = useState<ReturnType<typeof computeCapacite> | null>(null);

  const canCalculate = Number(revenus) > 0;

  const onCalculate = () => {
    if (!canCalculate) return;
    setResult(
      computeCapacite({
        revenusNetMensuels: revenus,
        autresRevenusMensuels: "",
        chargesMensuellesHorsCredits: charges,
        apportPersonnel: apport,
        ageEmprunteur: "0",
        ageCoEmprunteur: "0",
        nbAdultes: "1",
        nbEnfants: "0",
        tauxEndettementCible: "35",
        tauxCreditCible: "3.5",
        tauxAssuranceCible: "0.30",
        dureeCreditCible: duree,
        nbCredits: 0,
        typesCredits: [],
        mensualitesCredits: [],
        resteAnneesCredits: [],
        tauxCredits: [],
        revenusLocatifs: [],
        projectType: "ancien",
        proStatus: "cdi",
        propertyKind: "appartement",
        projectUsageUI: "rp",
        projectTimelineUI: "juste_info",
        projectDepartment: "",
      })
    );
  };

  const colors = result ? SCORE_COLORS[result.assessment.label] || SCORE_COLORS["À optimiser"] : null;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacité d'emprunt</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-950">Estimez votre budget</h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Revenus nets / mois</span>
          <input
            inputMode="numeric"
            value={revenus}
            onChange={(e) => setRevenus(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="2500"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Charges / mois</span>
          <input
            inputMode="numeric"
            value={charges}
            onChange={(e) => setCharges(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Apport personnel</span>
          <input
            inputMode="numeric"
            value={apport}
            onChange={(e) => setApport(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="20000"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Durée</span>
          <select
            value={duree}
            onChange={(e) => setDuree(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none"
          >
            <option value="15">15 ans</option>
            <option value="20">20 ans</option>
            <option value="25">25 ans</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={onCalculate}
        disabled={!canCalculate}
        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Calculer
      </button>

      {result && colors && (
        <div className="mt-4 space-y-3">
          <div className={`rounded-xl border p-3 ${colors.bg} ${colors.border}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score lokt.fr</span>
              <span className={`text-xs font-bold ${colors.text}`}>{result.assessment.label}</span>
            </div>
            <p className={`mt-1 text-2xl font-bold ${colors.text}`}>{result.assessment.score}/100</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Capital max</p>
              <p className="mt-1 text-base font-bold text-slate-950">{formatEuro(result.resume.montantMax)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Budget total</p>
              <p className="mt-1 text-base font-bold text-slate-950">{formatEuro(result.resume.budgetTotalMax)}</p>
            </div>
          </div>

          <a
            href="https://lokt.fr/capacite"
            target="_blank"
            rel="noopener"
            className="block text-center text-xs font-semibold text-[#635bff] hover:underline"
          >
            Voir l'analyse complète sur lokt.fr →
          </a>
        </div>
      )}

      <p className="mt-4 text-center text-[0.68rem] text-slate-400">
        Propulsé par <a href="https://lokt.fr" target="_blank" rel="noopener" className="font-semibold">lokt.fr</a>
      </p>
    </div>
  );
}
