// components/ParcImmobilierWizard.tsx
import { useMemo, useState } from "react";
import { BuildingOffice2Icon, ChartBarIcon, SparklesIcon } from "@heroicons/react/24/outline";

function formatEuro(val: number) {
  if (!Number.isFinite(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (!Number.isFinite(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function onlyNumberInput(s: string) {
  // autorise vide, chiffres, point, virgule (on stocke en string)
  return (s || "").replace(/[^\d.,]/g, "");
}

function toFloat(v: string, fallback = 0) {
  const norm = (v || "").replace(",", ".").trim();
  if (!norm) return fallback;
  const x = parseFloat(norm);
  return Number.isFinite(x) ? x : fallback;
}

type Bien = {
  nom: string;

  // ✅ Champs saisissables : strings pour ne pas forcer 0 à l’édition
  valeurBien: string;
  capitalRestantDu: string;
  loyerMensuel: string;
  chargesAnnuelles: string;
  mensualiteCredit: string;
  assuranceEmprunteurAnnuelle: string;

  // ✅ calculés
  resultatNetAnnuel: number;
  cashflowMensuel: number;
  rendementNet: number;

  // ✅ avancé (strings aussi)
  vacancePct: string;
  gestionPct: string;
  impotsPct: string;
  fraisVentePct: string;

  resultatNetAnnuelAjuste: number;
  cashflowMensuelAjuste: number;
  rendementNetAjuste: number;

  dscr: number;
  ltv: number;
  breakevenVente: number;
};

type ResumeGlobal = {
  valeurParc: number;
  encoursCredit: number;
  equityNette: number;
  loyersAnnuels: number;
  chargesAnnuelles: number;
  serviceDetteAnnuel: number;
  cashflowMensuelGlobal: number;
  rendementNetMoyen: number;

  cashflowMensuelGlobalAjuste: number;
  rendementNetMoyenAjuste: number;
  ltvGlobal: number;
  dscrGlobal: number;
};

function metricCashflow(b: Bien, advancedMode: boolean) {
  return advancedMode ? b.cashflowMensuelAjuste || 0 : b.cashflowMensuel || 0;
}

function metricRendement(b: Bien, advancedMode: boolean) {
  return advancedMode ? b.rendementNetAjuste || 0 : b.rendementNet || 0;
}

function cashflowProfile(cashflow: number) {
  if (cashflow >= 0) return "autofinancé";
  if (cashflow >= -50) return "quasi autofinancé";
  if (cashflow >= -150) return "effort maîtrisé";
  if (cashflow >= -300) return "à optimiser";
  return "sous tension";
}

function scoreParc(resume: ResumeGlobal, advancedMode: boolean) {
  const cashflow = advancedMode ? resume.cashflowMensuelGlobalAjuste : resume.cashflowMensuelGlobal;
  const rendement = advancedMode ? resume.rendementNetMoyenAjuste : resume.rendementNetMoyen;
  let score = 50;
  score +=
    cashflow >= 0
      ? 18
      : cashflow >= -50
      ? 12
      : cashflow >= -150
      ? 4
      : cashflow >= -300
      ? -6
      : Math.max(-18, cashflow / 80);
  score += clamp((rendement - 3) * 5, -12, 18);
  score += resume.ltvGlobal <= 60 ? 14 : resume.ltvGlobal <= 80 ? 4 : -12;
  score += resume.dscrGlobal >= 1.2 ? 14 : resume.dscrGlobal >= 1.05 ? 4 : -14;
  return Math.round(clamp(score, 0, 100));
}

function InfoBadge({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1 align-middle">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[0.6rem] font-semibold text-slate-500 cursor-help">
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[125%] z-20 hidden w-64 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-[0.7rem] text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

function defaultBien(idx: number): Bien {
  return {
    nom: idx === 0 ? "Appartement #1" : `Bien #${idx + 1}`,

    valeurBien: idx === 0 ? "250000" : "",
    capitalRestantDu: idx === 0 ? "150000" : "",
    loyerMensuel: idx === 0 ? "900" : "",
    chargesAnnuelles: idx === 0 ? "3000" : "",
    mensualiteCredit: idx === 0 ? "650" : "",
    assuranceEmprunteurAnnuelle: idx === 0 ? "400" : "",

    resultatNetAnnuel: 0,
    cashflowMensuel: 0,
    rendementNet: 0,

    vacancePct: "5",
    gestionPct: "7",
    impotsPct: "0",
    fraisVentePct: "7",

    resultatNetAnnuelAjuste: 0,
    cashflowMensuelAjuste: 0,
    rendementNetAjuste: 0,

    dscr: 0,
    ltv: 0,
    breakevenVente: 0,
  };
}

export default function ParcImmobilierWizard() {
  const [advancedMode, setAdvancedMode] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [nbBiens, setNbBiens] = useState(1);
  const [nbBiensInput, setNbBiensInput] = useState("1");
  const [biens, setBiens] = useState<Bien[]>([defaultBien(0)]);

  const [resumeGlobal, setResumeGlobal] = useState<ResumeGlobal | null>(null);
  const [analyseTexte, setAnalyseTexte] = useState<string>("");

  const hasSimulation = !!resumeGlobal;

  const handleNbBiensChange = (raw: string) => {
    setNbBiensInput(raw);

    if (raw.trim() === "") return;

    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;

    const n = Math.min(Math.max(parsed, 1), 20);
    setNbBiensInput(String(n));
    setNbBiens(n);

    setBiens((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(defaultBien(arr.length));
      return arr.slice(0, n);
    });
  };

  const updateBienField = (index: number, field: keyof Bien, value: string) => {
  if (formError) setFormError(null);

  setBiens((prev) => {
    const arr = [...prev];
    const bien = { ...arr[index] };

    if (field === "nom") {
      bien.nom = value;
    } else {
      (bien as any)[field] = onlyNumberInput(value);
    }

    arr[index] = bien;
    return arr;
  });
};

  const computeAdjusted = (b: Bien) => {
  const loyerMensuel = toFloat(b.loyerMensuel, 0);
  const chargesAnnuelles = toFloat(b.chargesAnnuelles, 0);

  const vacancePct = toFloat(b.vacancePct, 0);
  const gestionPct = toFloat(b.gestionPct, 0);
  const impotsPct = toFloat(b.impotsPct, 0);

  const loyersAnnuels = loyerMensuel * 12;

  const vacance = loyersAnnuels * clamp(vacancePct / 100, 0, 1);
  const gestion = loyersAnnuels * clamp(gestionPct / 100, 0, 1);

  const revenuAvantImpots = loyersAnnuels - chargesAnnuelles - vacance - gestion;
  const impots = Math.max(0, revenuAvantImpots * clamp(impotsPct / 100, 0, 1));

  return {
    loyersAnnuels,
    chargesAnnuelles,
    revenuNetAvantCredit: loyersAnnuels - chargesAnnuelles,
    revenuAvantImpots,
    impots,
    revenuApresImpots: revenuAvantImpots - impots,
  };
};

  const handleCalculParc = () => {
    setFormError(null);

for (let i = 0; i < Math.min(nbBiens, biens.length); i++) {
  const b = biens[i];

  const valeur = toFloat(b.valeurBien, 0);
  const loyerStr = (b.loyerMensuel || "").trim();

  if (!b.valeurBien.trim() || valeur <= 0) {
    setFormError(`Bien #${i + 1} : la valeur du bien est obligatoire (montant > 0).`);
    return;
  }
  if (loyerStr.length === 0) {
    setFormError(`Bien #${i + 1} : le loyer mensuel doit être renseigné (0 possible si vacant).`);
    return;
  }
}
    const updatedBiens: Bien[] = biens.slice(0, nbBiens).map((b) => {
  const valeurBien = toFloat(b.valeurBien, 0);
  const capitalRestantDu = toFloat(b.capitalRestantDu, 0);
  const loyerMensuel = toFloat(b.loyerMensuel, 0);
  const chargesAnn = toFloat(b.chargesAnnuelles, 0);
  const mensualiteCredit = toFloat(b.mensualiteCredit, 0);
  const assuranceAnnuelle = toFloat(b.assuranceEmprunteurAnnuelle, 0);
  const fraisVentePct = toFloat(b.fraisVentePct, 0);

  const loyersAnnuels = loyerMensuel * 12;
  const annuiteCredit = mensualiteCredit * 12;
  const annuiteAssurance = assuranceAnnuelle;
  const serviceDette = annuiteCredit + annuiteAssurance;

  const revenuNetAvantCredit = loyersAnnuels - chargesAnn;
  const resultatNetAnnuel = revenuNetAvantCredit - serviceDette;
  const cashflowMensuel = resultatNetAnnuel / 12;
  const rendementNet = valeurBien > 0 ? (revenuNetAvantCredit / valeurBien) * 100 : 0;

  const adj = computeAdjusted(b);
  const resultatNetAnnuelAjuste = adj.revenuApresImpots - serviceDette;
  const cashflowMensuelAjuste = resultatNetAnnuelAjuste / 12;
  const rendementNetAjuste = valeurBien > 0 ? (adj.revenuAvantImpots / valeurBien) * 100 : 0;

  const dscr = serviceDette > 0 ? revenuNetAvantCredit / serviceDette : 0;
  const ltv = valeurBien > 0 ? (capitalRestantDu / valeurBien) * 100 : 0;

  const fraisV = clamp((fraisVentePct || 0) / 100, 0, 0.3);
  const breakevenVente =
    capitalRestantDu > 0 && (1 - fraisV) > 0 ? capitalRestantDu / (1 - fraisV) : 0;

  return {
    ...b,
    resultatNetAnnuel,
    cashflowMensuel,
    rendementNet,
    resultatNetAnnuelAjuste,
    cashflowMensuelAjuste,
    rendementNetAjuste,
    dscr,
    ltv,
    breakevenVente,
  };
});

    setBiens(updatedBiens);

const valeurParc = updatedBiens.reduce((sum, b) => sum + toFloat(b.valeurBien, 0), 0);
const encoursCredit = updatedBiens.reduce((sum, b) => sum + toFloat(b.capitalRestantDu, 0), 0);

    const cashflowMensuelGlobal = updatedBiens.reduce((sum, b) => sum + (b.cashflowMensuel || 0), 0);
    const rendementNetMoyen =
      updatedBiens.length > 0
        ? updatedBiens.reduce((sum, b) => sum + (b.rendementNet || 0), 0) / updatedBiens.length
        : 0;

    const cashflowMensuelGlobalAjuste = updatedBiens.reduce((sum, b) => sum + (b.cashflowMensuelAjuste || 0), 0);
    const rendementNetMoyenAjuste =
      updatedBiens.length > 0
        ? updatedBiens.reduce((sum, b) => sum + (b.rendementNetAjuste || 0), 0) / updatedBiens.length
        : 0;

   const totalRevenuNetAvantCredit = updatedBiens.reduce((sum, b) => {
      const loyersAnnuels = toFloat(b.loyerMensuel, 0) * 12;
      const charges = toFloat(b.chargesAnnuelles, 0);
      return sum + (loyersAnnuels - charges);
    }, 0);

   const totalServiceDette = updatedBiens.reduce((sum, b) => {
  const annuiteCredit = toFloat(b.mensualiteCredit, 0) * 12;
  const annuiteAssurance = toFloat(b.assuranceEmprunteurAnnuelle, 0);
  return sum + (annuiteCredit + annuiteAssurance);
}, 0);

    const ltvGlobal = valeurParc > 0 ? (encoursCredit / valeurParc) * 100 : 0;
    const dscrGlobal = totalServiceDette > 0 ? totalRevenuNetAvantCredit / totalServiceDette : 0;

    setResumeGlobal({
      valeurParc,
      encoursCredit,
      equityNette: Math.max(0, valeurParc - encoursCredit),
      loyersAnnuels: updatedBiens.reduce((sum, b) => sum + toFloat(b.loyerMensuel, 0) * 12, 0),
      chargesAnnuelles: updatedBiens.reduce((sum, b) => sum + toFloat(b.chargesAnnuelles, 0), 0),
      serviceDetteAnnuel: totalServiceDette,
      cashflowMensuelGlobal,
      rendementNetMoyen,
      cashflowMensuelGlobalAjuste,
      rendementNetMoyenAjuste,
      ltvGlobal,
      dscrGlobal,
    });

    let bienTop = updatedBiens[0];
    let bienWorst = updatedBiens[0];

    updatedBiens.forEach((b) => {
      const r = advancedMode ? (b.rendementNetAjuste || 0) : (b.rendementNet || 0);
      const topR = advancedMode ? (bienTop.rendementNetAjuste || 0) : (bienTop.rendementNet || 0);
      const worstR = advancedMode ? (bienWorst.rendementNetAjuste || 0) : (bienWorst.rendementNet || 0);

      if (r > topR) bienTop = b;
      if (r < worstR) bienWorst = b;
    });

    const lignes: string[] = [
      `Votre parc se compose de ${updatedBiens.length} bien(s) pour une valeur totale estimée de ${formatEuro(
        valeurParc
      )} et un encours de crédit d’environ ${formatEuro(encoursCredit)}.`,
    ];

    const score = scoreParc(
      {
        valeurParc,
        encoursCredit,
        equityNette: Math.max(0, valeurParc - encoursCredit),
        loyersAnnuels: updatedBiens.reduce((sum, b) => sum + toFloat(b.loyerMensuel, 0) * 12, 0),
        chargesAnnuelles: updatedBiens.reduce((sum, b) => sum + toFloat(b.chargesAnnuelles, 0), 0),
        serviceDetteAnnuel: totalServiceDette,
        cashflowMensuelGlobal,
        rendementNetMoyen,
        cashflowMensuelGlobalAjuste,
        rendementNetMoyenAjuste,
        ltvGlobal,
        dscrGlobal,
      },
      advancedMode
    );

    const cashflowReference = advancedMode ? cashflowMensuelGlobalAjuste : cashflowMensuelGlobal;
    const profile = cashflowProfile(cashflowReference);

    lignes.push(
      profile === "autofinancé"
        ? `Score patrimoine : ${score}/100. Le parc est autofinancé : les loyers couvrent les charges et la dette.`
        : profile === "quasi autofinancé"
        ? `Score patrimoine : ${score}/100. Le parc est quasi autofinancé : le léger effort mensuel reste plutôt avantageux.`
        : profile === "effort maîtrisé"
        ? `Score patrimoine : ${score}/100. L’effort d’épargne reste maîtrisé : l’enjeu est l’optimisation, pas l’urgence.`
        : profile === "à optimiser"
        ? `Score patrimoine : ${score}/100. Le parc mérite une optimisation ciblée : loyers, charges, dette ou fiscalité.`
        : `Score patrimoine : ${score}/100. Le parc est sous tension : priorisez la dette, la vacance ou les biens déficitaires.`
    );

    if (!advancedMode) {
      lignes.push(
        `En agrégé, le cash-flow mensuel ressort à ${formatEuro(
          cashflowMensuelGlobal
        )}. Un cash-flow positif signifie que vos loyers couvrent les charges et crédits, tout en laissant un excédent.`
      );
      lignes.push(`Le rendement net moyen (avant impôts) est d’environ ${formatPct(rendementNetMoyen)}.`);
      lignes.push(
        `Le bien le plus performant est ${bienTop.nom} (${formatPct(
          bienTop.rendementNet
        )}) et le moins performant est ${bienWorst.nom} (${formatPct(bienWorst.rendementNet)}).`
      );
    } else {
      lignes.push(
        `En version avancée, le cash-flow mensuel ajusté ressort à ${formatEuro(cashflowMensuelGlobalAjuste)}.`
      );
      lignes.push(`Le rendement moyen ajusté est d’environ ${formatPct(rendementNetMoyenAjuste)}.`);
      lignes.push(
        `Indicateurs : LTV global ~${formatPct(ltvGlobal)} et DSCR global ~${Number.isFinite(dscrGlobal) ? dscrGlobal.toFixed(2) : "-"}.`
      );
      lignes.push(
        `Le meilleur bien (ajusté) est ${bienTop.nom} (~${formatPct(
          bienTop.rendementNetAjuste
        )}) et le moins performant est ${bienWorst.nom} (~${formatPct(bienWorst.rendementNetAjuste)}).`
      );
    }

    setAnalyseTexte(lignes.join("\n"));
  };

  const renderAnalysisBlocks = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n").filter((l) => l.trim().length > 0);

    return (
      <div className="space-y-2">
        {lines.map((line, idx) => (
          <div key={idx} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2">
            <span className="mt-1 text-xs text-indigo-600">●</span>
            <p className="text-[0.8rem] text-slate-800 leading-relaxed">{line}</p>
          </div>
        ))}
      </div>
    );
  };

  const advancedCards = useMemo(() => {
    if (!resumeGlobal) return null;

    const dscr = resumeGlobal.dscrGlobal;
    const ltv = resumeGlobal.ltvGlobal;

    const dscrHint =
      dscr >= 1.2 ? "Solide : le parc couvre bien sa dette."
      : dscr >= 1.05 ? "Correct : marge faible, surveiller."
      : "Sous tension : parc fragile côté dette.";

    const ltvHint =
      ltv <= 60 ? "Prudent."
      : ltv <= 80 ? "Standard."
      : "Élevé : levier important.";

    return (
      <div className="grid gap-3 sm:grid-cols-4 mt-3">
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
          <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">LTV global</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(ltv)}</p>
          <p className="mt-1 text-[0.7rem] text-slate-500">{ltvHint}</p>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
          <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">DSCR global</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {Number.isFinite(dscr) ? dscr.toFixed(2) : "-"}
          </p>
          <p className="mt-1 text-[0.7rem] text-slate-500">{dscrHint}</p>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
          <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Cash-flow ajusté</p>
          <p
            className={
              "mt-1 text-sm font-semibold " +
              (resumeGlobal.cashflowMensuelGlobalAjuste >= 0 ? "text-emerald-700" : "text-red-600")
            }
          >
            {formatEuro(resumeGlobal.cashflowMensuelGlobalAjuste)}
          </p>
          <p className="mt-1 text-[0.7rem] text-slate-500">Après vacance/gestion/impôts.</p>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
          <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Rendement ajusté</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatPct(resumeGlobal.rendementNetMoyenAjuste)}
          </p>
          <p className="mt-1 text-[0.7rem] text-slate-500">Lecture plus “terrain”.</p>
        </div>
      </div>
    );
  }, [resumeGlobal]);

  const activeBiens = useMemo(() => biens.slice(0, nbBiens), [biens, nbBiens]);

  const rankedBiens = useMemo(() => {
    return [...activeBiens].sort((a, b) => metricCashflow(b, advancedMode) - metricCashflow(a, advancedMode));
  }, [activeBiens, advancedMode]);

  const cockpit = useMemo(() => {
    if (!resumeGlobal || !activeBiens.length) return null;

    const score = scoreParc(resumeGlobal, advancedMode);
    const cashflow = advancedMode ? resumeGlobal.cashflowMensuelGlobalAjuste : resumeGlobal.cashflowMensuelGlobal;
    const profile = cashflowProfile(cashflow);
    const worst = [...activeBiens].sort((a, b) => metricCashflow(a, advancedMode) - metricCashflow(b, advancedMode))[0];
    const highestDebt = [...activeBiens].sort(
      (a, b) => toFloat(b.capitalRestantDu, 0) - toFloat(a.capitalRestantDu, 0)
    )[0];
    const biggestValue = [...activeBiens].sort((a, b) => toFloat(b.valeurBien, 0) - toFloat(a.valeurBien, 0))[0];
    const concentration =
      resumeGlobal.valeurParc > 0 ? (toFloat(biggestValue?.valeurBien || "0", 0) / resumeGlobal.valeurParc) * 100 : 0;

    const verdict =
      profile === "autofinancé"
        ? "Parc autofinancé"
        : profile === "quasi autofinancé"
        ? "Parc quasi autofinancé"
        : profile === "effort maîtrisé"
        ? "Effort maîtrisé"
        : profile === "à optimiser"
        ? "Parc à optimiser"
        : "Parc sous tension";

    const priority =
      profile === "quasi autofinancé" && worst
        ? `${worst.nom} est presque à l’équilibre (${formatEuro(
            metricCashflow(worst, advancedMode)
          )}/mois) : l’enjeu est d’optimiser, pas de traiter une urgence.`
        : profile === "effort maîtrisé" && worst
        ? `${worst.nom} demande un effort maîtrisé (${formatEuro(
            metricCashflow(worst, advancedMode)
          )}/mois) : vérifiez charges, loyer et fiscalité.`
        : cashflow < -150 && worst
        ? `Traiter ${worst.nom} : il pèse ${formatEuro(metricCashflow(worst, advancedMode))}/mois sur le parc.`
        : resumeGlobal.dscrGlobal > 0 && resumeGlobal.dscrGlobal < 1.2
        ? "Renforcer la marge bancaire : viser un DSCR global supérieur à 1,20."
        : resumeGlobal.ltvGlobal > 80 && highestDebt
        ? `Réduire le levier : ${highestDebt.nom} porte l’encours le plus élevé.`
        : concentration > 55 && biggestValue
        ? `Surveiller la concentration : ${biggestValue.nom} représente ${formatPct(concentration)} de la valeur.`
        : "Comparer un nouveau projet avec ce parc avant d’acheter.";

    return { score, verdict, priority, profile, worst, highestDebt, biggestValue, concentration };
  }, [activeBiens, advancedMode, resumeGlobal]);

  const stressScenarios = useMemo(() => {
    if (!resumeGlobal) return [];

    const currentCashflow = advancedMode ? resumeGlobal.cashflowMensuelGlobalAjuste : resumeGlobal.cashflowMensuelGlobal;
    const loyerMensuel = resumeGlobal.loyersAnnuels / 12;
    const chargesMensuelles = resumeGlobal.chargesAnnuelles / 12;

    return [
      {
        label: "Vacance +5%",
        value: currentCashflow - (resumeGlobal.loyersAnnuels * 0.05) / 12,
        hint: "un mois vide ou relocation plus lente",
      },
      {
        label: "Charges +10%",
        value: currentCashflow - chargesMensuelles * 0.1,
        hint: "copropriété, taxe foncière, entretien",
      },
      {
        label: "Loyers -5%",
        value: currentCashflow - loyerMensuel * 0.05,
        hint: "négociation, vacance ou marché plus mou",
      },
      {
        label: "Dette +100 €/bien",
        value: currentCashflow - activeBiens.length * 100,
        hint: "refinancement ou hausse de mensualité",
      },
    ];
  }, [activeBiens.length, advancedMode, resumeGlobal]);

  const renderCashflowRanking = () => {
    if (!rankedBiens.length) return null;

    const maxAbs = Math.max(1, ...rankedBiens.map((b) => Math.abs(metricCashflow(b, advancedMode))));

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Cash-flow par bien</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Du meilleur contributeur au bien à traiter</h3>
          </div>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-[0.7rem] font-semibold text-slate-600">
            {advancedMode ? "Ajusté" : "Standard"}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          {rankedBiens.map((b, idx) => {
            const cashflow = metricCashflow(b, advancedMode);
            const width = Math.max(8, Math.min(100, (Math.abs(cashflow) / maxAbs) * 100));
            return (
              <div key={`${b.nom}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-slate-900 break-words">{b.nom || `Bien #${idx + 1}`}</p>
                    <p className="mt-0.5 text-[0.7rem] text-slate-500">Rendement {formatPct(metricRendement(b, advancedMode))}</p>
                  </div>
                  <p className={(cashflow >= 0 ? "text-emerald-700" : "text-rose-700") + " text-sm font-bold sm:text-right"}>
                    {formatEuro(cashflow)}/mois
                  </p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className={(cashflow >= 0 ? "bg-emerald-500" : "bg-rose-500") + " h-full rounded-full"}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRiskMatrix = () => {
    if (!activeBiens.length) return null;
    const maxValue = Math.max(1, ...activeBiens.map((b) => toFloat(b.valeurBien, 0)));

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Matrice rendement / risque</p>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">Identifier les biens performants et risqués</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Plus un point est à droite, plus le rendement est élevé. Plus il est haut, plus la dette est faible.
        </p>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[0.7rem] font-semibold text-slate-500">
            <span>Dette faible</span>
            <span>Rendement élevé</span>
          </div>
          <div className="relative h-64 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:h-72">
            <div className="absolute left-1/2 top-0 h-full w-px bg-slate-200" />
            <div className="absolute left-0 top-1/2 h-px w-full bg-slate-200" />
            <div className="absolute left-4 top-4 rounded-full bg-white/80 px-2 py-1 text-[0.65rem] font-semibold text-slate-500">
              prudent
            </div>
            <div className="absolute bottom-4 right-4 rounded-full bg-white/80 px-2 py-1 text-[0.65rem] font-semibold text-slate-500">
              performant
            </div>

            {activeBiens.map((b, idx) => {
              const rendement = metricRendement(b, advancedMode);
              const ltv = b.ltv || 0;
              const x = clamp((rendement / 10) * 100, 12, 88);
              const y = clamp(100 - ltv, 14, 86);
              const value = toFloat(b.valeurBien, 0);
              const size = clamp(22 + (value / maxValue) * 18, 24, 40);
              const cashflow = metricCashflow(b, advancedMode);

              return (
                <div
                  key={`${b.nom}-matrix-${idx}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${b.nom} • rendement ${formatPct(rendement)} • LTV ${formatPct(ltv)}`}
                >
                  <div
                    className={
                      "flex items-center justify-center rounded-full border-4 text-xs font-bold shadow-md " +
                      (cashflow >= 0
                        ? "border-emerald-100 bg-emerald-500 text-white"
                        : "border-rose-100 bg-rose-500 text-white")
                    }
                    style={{ width: size, height: size }}
                  >
                    {idx + 1}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-[0.7rem] font-semibold text-slate-500">
            <span>Dette élevée</span>
            <span>Rendement faible</span>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {activeBiens.map((b, idx) => {
            const cashflow = metricCashflow(b, advancedMode);
            return (
              <div key={`${b.nom}-legend-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span
                    className={
                      (cashflow >= 0 ? "bg-emerald-500" : "bg-rose-500") +
                      " mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold text-white"
                    }
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-snug text-slate-900 break-words">{b.nom || `Bien #${idx + 1}`}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] leading-snug text-slate-600">
                      <span>Rendement : {formatPct(metricRendement(b, advancedMode))}</span>
                      <span>LTV : {formatPct(b.ltv || 0)}</span>
                      <span className={cashflow >= 0 ? "text-emerald-700" : "text-rose-700"}>
                        Cash-flow : {formatEuro(cashflow)}/mois
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDebtValueChart = () => {
    if (!activeBiens.length) return null;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Dette vs valeur</p>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">Voir l’equity disponible bien par bien</h3>
        <div className="mt-4 space-y-3">
          {activeBiens.map((b, idx) => {
            const value = toFloat(b.valeurBien, 0);
            const debt = toFloat(b.capitalRestantDu, 0);
            const debtPct = value > 0 ? clamp((debt / value) * 100, 0, 100) : 0;
            const equity = Math.max(0, value - debt);
            return (
              <div key={`${b.nom}-debt-${idx}`} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-slate-800">{b.nom}</span>
                  <span className="text-slate-500">Equity {formatEuro(equity)}</span>
                </div>
                <div className="flex h-4 overflow-hidden rounded-full bg-emerald-100">
                  <div className="bg-slate-900" style={{ width: `${debtPct}%` }} />
                  <div className="bg-emerald-500" style={{ width: `${100 - debtPct}%` }} />
                </div>
                <div className="flex justify-between text-[0.65rem] text-slate-500">
                  <span>Dette {formatEuro(debt)}</span>
                  <span>Valeur {formatEuro(value)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStressTest = () => {
    if (!stressScenarios.length) return null;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Stress test</p>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">Ce qui se passe si le marché bouge</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {stressScenarios.map((s) => (
            <div key={s.label} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="grid min-w-0 gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">{s.label}</p>
                  <p className="mt-1 text-[0.7rem] leading-snug text-slate-500">{s.hint}</p>
                </div>
                <p
                  className={
                    (s.value >= 0 ? "text-emerald-700" : "text-rose-700") +
                    " min-w-0 break-words rounded-lg bg-white px-2 py-1.5 text-right text-sm font-bold"
                  }
                >
                  {formatEuro(s.value)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRecapTable = () => {
    if (!hasSimulation) return null;

    const dataBiens = biens.slice(0, nbBiens);

    let totalValeur = 0;
    let totalCRD = 0;
    let totalLoyersAnnuels = 0;
    let totalChargesAnnuelles = 0;
    let totalCreditAssuranceAnnuel = 0;
    let totalResultatNetAnnuel = 0;
    let totalCashflowMensuel = 0;

    let totalResultatNetAnnuelAdj = 0;
    let totalCashflowMensuelAdj = 0;

    let totalRevenuNetAvantCredit = 0;

    dataBiens.forEach((b) => {
    const valeurBien = toFloat(b.valeurBien, 0);
    const crd = toFloat(b.capitalRestantDu, 0);
    const loyersAnnuels = toFloat(b.loyerMensuel, 0) * 12;
    const charges = toFloat(b.chargesAnnuelles, 0);
    const annuiteCredit = toFloat(b.mensualiteCredit, 0) * 12;
    const annuiteAssurance = toFloat(b.assuranceEmprunteurAnnuelle, 0);
    const serviceDette = annuiteCredit + annuiteAssurance;

    const revenuNetAvantCredit = loyersAnnuels - charges;

    totalValeur += valeurBien;
    totalCRD += crd;
    totalLoyersAnnuels += loyersAnnuels;
    totalChargesAnnuelles += charges;
    totalCreditAssuranceAnnuel += serviceDette;

    totalResultatNetAnnuel += b.resultatNetAnnuel || 0;
    totalCashflowMensuel += b.cashflowMensuel || 0;

    totalResultatNetAnnuelAdj += b.resultatNetAnnuelAjuste || 0;
    totalCashflowMensuelAdj += b.cashflowMensuelAjuste || 0;

    totalRevenuNetAvantCredit += revenuNetAvantCredit;
  });

    const rendementGlobal = totalValeur > 0 ? (totalRevenuNetAvantCredit / totalValeur) * 100 : 0;

    return (
      <section className="mt-4 space-y-4 rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-md sm:rounded-2xl">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
            Synthèse globale du parc
          </p>
          <table className="w-full text-[0.75rem] text-slate-800">
            <tbody>
              <tr>
                <td className="py-1 pr-2">Valeur totale du parc</td>
                <td className="py-1 text-right font-semibold">{formatEuro(totalValeur)}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2">Encours de crédit total</td>
                <td className="py-1 text-right font-semibold">{formatEuro(totalCRD)}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2">Loyers annuels totaux</td>
                <td className="py-1 text-right font-semibold">{formatEuro(totalLoyersAnnuels)}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2">Charges annuelles totales</td>
                <td className="py-1 text-right font-semibold">{formatEuro(totalChargesAnnuelles)}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2">Crédit + assurance (annuels)</td>
                <td className="py-1 text-right font-semibold">{formatEuro(totalCreditAssuranceAnnuel)}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2">Résultat net annuel global</td>
                <td className="py-1 text-right font-semibold">{formatEuro(totalResultatNetAnnuel)}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2">Cash-flow mensuel global</td>
                <td className="py-1 text-right font-semibold">{formatEuro(totalCashflowMensuel)}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2">Rendement net global</td>
                <td className="py-1 text-right font-semibold">{formatPct(rendementGlobal)}</td>
              </tr>

              {advancedMode ? (
                <>
                  <tr>
                    <td className="py-1 pr-2">Résultat net annuel (ajusté)</td>
                    <td className="py-1 text-right font-semibold">{formatEuro(totalResultatNetAnnuelAdj)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2">Cash-flow mensuel (ajusté)</td>
                    <td className="py-1 text-right font-semibold">{formatEuro(totalCashflowMensuelAdj)}</td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <section className="relative z-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-xl shadow-slate-900/5 sm:p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-[#635bff] via-[#007ba7] to-[#00a97b] opacity-95" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.18),transparent_42%,rgba(255,184,0,.2))]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/70">Cockpit patrimoine</p>
            <h2 className="mt-2 text-xl font-semibold">Consolidez vos biens dans une seule lecture.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
              Renseignez votre parc, puis comparez cash-flow, dette et rendement avec une grille commune.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/25 bg-white/15">
              <BuildingOffice2Icon className="h-6 w-6" />
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/25 bg-white/15">
              <ChartBarIcon className="h-6 w-6" />
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/25 bg-white/15">
              <SparklesIcon className="h-6 w-6" />
            </span>
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Formulaire biens */}
        <div className="calculator-premium-form space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-indigo-600 mb-1">Calculette</p>
              <h2 className="text-lg font-semibold text-slate-900">Décrivez vos biens locatifs</h2>
              <p className="text-xs text-slate-500">
                Saisie rapide par bien : valeur, dette, loyer, charges et mensualité. Le cockpit classe ensuite les biens.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:shrink-0">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={advancedMode}
                  onChange={(e) => setAdvancedMode(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-[0.75rem] font-semibold text-slate-700">Analyse prudente</span>
              </label>
              <p className="text-[0.65rem] text-slate-500 mt-1 max-w-[180px]">
                Vacance, gestion, impôts + DSCR/LTV.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-700 flex items-center gap-1">
                Nombre de biens locatifs
                <InfoBadge text="Incluez uniquement les biens générant des loyers (hors résidence principale)." />
              </label>
              <input
                inputMode="numeric"
                min={1}
                max={20}
                value={nbBiensInput}
                onChange={(e) => handleNbBiensChange(e.target.value)}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {Array.from({ length: nbBiens }).map((_, idx) => {
              const b = biens[idx];
              return (
                <div key={idx} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                  <p className="text-[0.7rem] font-semibold text-slate-700">Bien #{idx + 1}</p>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Nom du bien (libellé)</label>
                    <input
                      type="text"
                      value={b.nom}
                      onChange={(e) => updateBienField(idx, "nom", e.target.value)}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Valeur actuelle estimée (€)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={b.valeurBien}
                        onChange={(e) => updateBienField(idx, "valeurBien", e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                       />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Capital restant dû (€)</label>
                      <input
                      type="text"
                      inputMode="numeric"
                      value={b.capitalRestantDu}
                      onChange={(e) => updateBienField(idx, "capitalRestantDu", e.target.value)}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Loyer mensuel hors charges (€)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={b.loyerMensuel}
                        onChange={(e) => updateBienField(idx, "loyerMensuel", e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                        Charges annuelles (€)
                        <InfoBadge text="Copropriété, taxe foncière, assurance PNO/habitation, petits entretiens… hors crédit." />
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={b.chargesAnnuelles}
                        onChange={(e) => updateBienField(idx, "chargesAnnuelles", e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Mensualité de crédit (€ / mois)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={b.mensualiteCredit}
                        onChange={(e) => updateBienField(idx, "mensualiteCredit", e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Assurance emprunteur (€/an)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={b.assuranceEmprunteurAnnuelle}
                        onChange={(e) => updateBienField(idx, "assuranceEmprunteurAnnuelle", e.target.value)}
                        className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {advancedMode ? (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-500 mb-2">
                        Paramètres avancés (par bien)
                      </p>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                            Vacance (%)
                            <InfoBadge text="Périodes sans locataire. Exemple : 5% ≈ ~18 jours/an." />
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={b.vacancePct}
                            onChange={(e) => updateBienField(idx, "vacancePct", e.target.value)}
                            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                            Gestion (%)
                            <InfoBadge text="Gestion locative (agence) ou coût implicite si vous gérez." />
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={b.gestionPct}
                            onChange={(e) => updateBienField(idx, "gestionPct", e.target.value)}
                            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                            Impôts (%)
                            <InfoBadge text="Approximation simplifiée. Mets 0 si tu ne veux pas l’intégrer." />
                          </label>
                         <input
                          type="text"
                          inputMode="decimal"
                          value={b.impotsPct}
                          onChange={(e) => updateBienField(idx, "impotsPct", e.target.value)}
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                            Frais vente (%)
                            <InfoBadge text="Pour le break-even vente (agent + divers). Sert à estimer le prix mini pour solder le CRD." />
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={b.fraisVentePct}
                            onChange={(e) => updateBienField(idx, "fraisVentePct", e.target.value)}
                            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <p className="mt-2 text-[0.65rem] text-slate-500">
                        Ces paramètres ne remplacent pas une étude fiscale complète (LMNP/réel/amortissements).
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="mt-3">
              {formError && <p className="mb-2 text-[0.75rem] text-red-600">{formError}</p>}

              <button
                onClick={handleCalculParc}
                className="min-h-11 w-full rounded-full bg-gradient-to-r from-indigo-500 to-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-2xl active:scale-[0.99] sm:w-auto"
              >
                Calculer la rentabilité du parc
              </button>
            </div>
          </div>
        </div>

        {/* Résultats */}
        {hasSimulation && <div className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-md sm:rounded-2xl sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-indigo-600 mb-1">Résultats</p>
              <h2 className="text-lg font-semibold text-slate-900">Vue d&apos;ensemble de votre parc</h2>
              <p className="text-xs text-slate-500">Cash-flow global, encours, rendements et biens à surveiller.</p>
            </div>
          </div>

          {hasSimulation ? (
            <>
              {cockpit ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-950 px-4 py-4 text-white">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[0.7rem] uppercase tracking-[0.2em] text-indigo-200">Cockpit patrimonial</p>
                      <h3 className="mt-1 text-xl font-semibold">{cockpit.verdict}</h3>
                      <p className="mt-1 text-sm text-indigo-100">{cockpit.priority}</p>
                    </div>
                    <div className="shrink-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center">
                      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-indigo-200">Score</p>
                      <p className="text-3xl font-bold">{cockpit.score}/100</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-4 mt-1">
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Valeur du parc</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(resumeGlobal!.valeurParc)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Equity nette</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(resumeGlobal!.equityNette)}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-slate-500">Valeur − dette.</p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    {advancedMode ? "Cash-flow mensuel ajusté" : "Cash-flow mensuel global"}
                  </p>
                  <p
                    className={
                      "mt-1 text-sm font-semibold " +
                      ((advancedMode
                        ? resumeGlobal!.cashflowMensuelGlobalAjuste
                        : resumeGlobal!.cashflowMensuelGlobal) >= 0
                        ? "text-emerald-700"
                        : "text-red-600")
                    }
                  >
                    {formatEuro(
                      advancedMode ? resumeGlobal!.cashflowMensuelGlobalAjuste : resumeGlobal!.cashflowMensuelGlobal
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    {advancedMode ? "Rendement moyen ajusté" : "Rendement net moyen"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(advancedMode ? resumeGlobal!.rendementNetMoyenAjuste : resumeGlobal!.rendementNetMoyen)}
                  </p>
                </div>
              </div>

              {advancedMode ? advancedCards : null}

              <div className="grid gap-4 mt-3">
                {renderCashflowRanking()}
                {renderRiskMatrix()}
                {renderDebtValueChart()}
                {renderStressTest()}
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">Analyse globale</p>
                {renderAnalysisBlocks(analyseTexte)}
                <p className="mt-2 text-[0.7rem] text-slate-500">
                  Analyse indicative. En avancé : vacance/gestion/impôts sont des approximations.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
              <p className="text-sm font-semibold text-slate-900">Votre cockpit apparaîtra ici.</p>
              <p className="mt-1 text-sm text-slate-600">
                Après calcul, vous verrez le score du parc, le bien à traiter en priorité, une matrice rendement/risque,
                la dette face à la valeur et un stress test.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {["Cash-flow par bien", "Rendement vs LTV", "Dette vs valeur", "Stress test"].map((label) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>}
      </section>

      {renderRecapTable()}
    </div>
  );
}
