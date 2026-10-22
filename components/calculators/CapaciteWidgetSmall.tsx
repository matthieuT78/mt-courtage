// components/calculators/CapaciteWidgetSmall.tsx
//
// Version "small" du widget capacité d'emprunt : un teaser minimal (2
// champs), un seul chiffre affiché, puis renvoi vers lokt.fr pour le
// détail. Même moteur de calcul que les autres tailles.
import { useState } from "react";
import { computeCapacite, formatEuro } from "../../lib/calculators/capaciteEngine";

export default function CapaciteWidgetSmall() {
  const [revenus, setRevenus] = useState("");
  const [apport, setApport] = useState("");
  const [budget, setBudget] = useState<number | null>(null);

  const canCalculate = Number(revenus) > 0;

  const onCalculate = () => {
    if (!canCalculate) return;
    const result = computeCapacite({
      revenusNetMensuels: revenus,
      autresRevenusMensuels: "",
      chargesMensuellesHorsCredits: "",
      apportPersonnel: apport,
      ageEmprunteur: "0",
      ageCoEmprunteur: "0",
      nbAdultes: "1",
      nbEnfants: "0",
      tauxEndettementCible: "35",
      tauxCreditCible: "3.5",
      tauxAssuranceCible: "0.30",
      dureeCreditCible: "25",
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
    });
    setBudget(result.resume.budgetTotalMax);
  };

  return (
    <div className="mx-auto max-w-xs rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacité d'emprunt</p>

      {budget === null ? (
        <>
          <div className="mt-3 space-y-2">
            <input
              inputMode="numeric"
              value={revenus}
              onChange={(e) => setRevenus(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Revenus nets / mois"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-sm focus:border-[#635bff] focus:outline-none"
            />
            <input
              inputMode="numeric"
              value={apport}
              onChange={(e) => setApport(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Apport (optionnel)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-sm focus:border-[#635bff] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onCalculate}
            disabled={!canCalculate}
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Calculer mon budget
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-500">Budget immobilier estimé</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{formatEuro(budget)}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setBudget(null)}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Recalculer
            </button>
            <a
              href="https://lokt.fr/capacite"
              target="_blank"
              rel="noopener"
              className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-[#635bff] text-xs font-semibold text-white hover:opacity-90"
            >
              Voir le détail
            </a>
          </div>
        </>
      )}

      <p className="mt-3 text-[0.65rem] text-slate-400">
        Propulsé par <a href="https://lokt.fr" target="_blank" rel="noopener" className="font-semibold">lokt.fr</a>
      </p>
    </div>
  );
}
