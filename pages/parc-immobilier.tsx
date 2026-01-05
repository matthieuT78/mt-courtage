// pages/parc-immobilier.tsx
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import AppHeader from "../components/AppHeader";

import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
} from "chart.js";

ChartJS.register(
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement
);

const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), {
  ssr: false,
});
const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), {
  ssr: false,
});

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

type Bien = {
  nom: string;
  valeurBien: number;
  capitalRestantDu: number;
  loyerMensuel: number;
  chargesAnnuelles: number;
  mensualiteCredit: number;
  assuranceEmprunteurAnnuelle: number;

  // Calculs "simples" (brut)
  resultatNetAnnuel: number;
  cashflowMensuel: number;
  rendementNet: number;

  // Paramètres par bien (avancé)
  vacancePct: number; // %
  gestionPct: number; // %
  impotsPct: number; // % (simplifié)
  fraisVentePct: number; // %

  // Calculs avancés (ajusté)
  resultatNetAnnuelAjuste: number;
  cashflowMensuelAjuste: number;
  rendementNetAjuste: number;

  // Indicateurs avancés
  dscr: number;
  ltv: number;
  breakevenVente: number;
};

type ResumeGlobal = {
  valeurParc: number;
  encoursCredit: number;
  cashflowMensuelGlobal: number;
  rendementNetMoyen: number;

  // Avancé
  cashflowMensuelGlobalAjuste: number;
  rendementNetMoyenAjuste: number;
  ltvGlobal: number;
  dscrGlobal: number;
};

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
    valeurBien: idx === 0 ? 250000 : 0,
    capitalRestantDu: idx === 0 ? 150000 : 0,
    loyerMensuel: idx === 0 ? 900 : 0,
    chargesAnnuelles: idx === 0 ? 3000 : 0,
    mensualiteCredit: idx === 0 ? 650 : 0,
    assuranceEmprunteurAnnuelle: idx === 0 ? 400 : 0,

    resultatNetAnnuel: 0,
    cashflowMensuel: 0,
    rendementNet: 0,

    // Paramètres par bien (avancé) - valeurs "raisonnables" par défaut
    vacancePct: 5,
    gestionPct: 7,
    impotsPct: 0,
    fraisVentePct: 7,

    resultatNetAnnuelAjuste: 0,
    cashflowMensuelAjuste: 0,
    rendementNetAjuste: 0,

    dscr: 0,
    ltv: 0,
    breakevenVente: 0,
  };
}

export default function ParcImmobilierPage() {
  /* ============================
     MODE SIMPLE vs AVANCÉ
  ============================ */
  const [advancedMode, setAdvancedMode] = useState<boolean>(false);

  /* ============================
     STATE CALCULETTE
  ============================ */
  const [nbBiens, setNbBiens] = useState(1);
  const [biens, setBiens] = useState<Bien[]>([defaultBien(0)]);

  const [resumeGlobal, setResumeGlobal] = useState<ResumeGlobal | null>(null);
  const [analyseTexte, setAnalyseTexte] = useState<string>("");

  const [barData, setBarData] = useState<any | null>(null);
  const [lineData, setLineData] = useState<any | null>(null);

  const hasSimulation = !!resumeGlobal && !!barData && !!lineData;

  const handleNbBiensChange = (value: number) => {
    const n = Math.min(Math.max(value, 1), 20);
    setNbBiens(n);

    setBiens((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(defaultBien(arr.length));
      return arr.slice(0, n);
    });
  };

  const updateBienField = (index: number, field: keyof Bien, value: string) => {
    setBiens((prev) => {
      const arr = [...prev];
      const bien = { ...arr[index] };

      if (field === "nom") {
        bien.nom = value;
      } else {
        (bien as any)[field] = parseFloat(value) || 0;
      }

      arr[index] = bien;
      return arr;
    });
  };

  const computeAdjusted = (b: Bien) => {
    const loyersAnnuels = (b.loyerMensuel || 0) * 12;
    const chargesAnnuelles = b.chargesAnnuelles || 0;

    const vacance = loyersAnnuels * clamp((b.vacancePct || 0) / 100, 0, 1);
    const gestion = loyersAnnuels * clamp((b.gestionPct || 0) / 100, 0, 1);

    const revenuAvantImpots = loyersAnnuels - chargesAnnuelles - vacance - gestion;
    const impots = Math.max(0, revenuAvantImpots * clamp((b.impotsPct || 0) / 100, 0, 1));

    return {
      loyersAnnuels,
      chargesAnnuelles,
      revenuNetAvantCredit: loyersAnnuels - chargesAnnuelles, // "brut"
      revenuAvantImpots,
      impots,
      revenuApresImpots: revenuAvantImpots - impots,
    };
  };

  const handleCalculParc = () => {
    const updatedBiens: Bien[] = biens.slice(0, nbBiens).map((b) => {
      const loyersAnnuels = (b.loyerMensuel || 0) * 12;
      const chargesAnnuelles = b.chargesAnnuelles || 0;
      const annuiteCredit = (b.mensualiteCredit || 0) * 12;
      const annuiteAssurance = b.assuranceEmprunteurAnnuelle || 0;
      const serviceDette = annuiteCredit + annuiteAssurance;

      // SIMPLE (identique à ta version précédente)
      const revenuNetAvantCredit = loyersAnnuels - chargesAnnuelles;
      const resultatNetAnnuel = revenuNetAvantCredit - serviceDette;
      const cashflowMensuel = resultatNetAnnuel / 12;
      const rendementNet = b.valeurBien > 0 ? (revenuNetAvantCredit / b.valeurBien) * 100 : 0;

      // AVANCÉ (ajusté) — uniquement utilisé si advancedMode=true mais on calcule quand même
      const adj = computeAdjusted(b);
      const resultatNetAnnuelAjuste = adj.revenuApresImpots - serviceDette;
      const cashflowMensuelAjuste = resultatNetAnnuelAjuste / 12;
      const rendementNetAjuste = b.valeurBien > 0 ? (adj.revenuAvantImpots / b.valeurBien) * 100 : 0;

      // Indicateurs avancés
      const dscr = serviceDette > 0 ? revenuNetAvantCredit / serviceDette : 0;
      const ltv = b.valeurBien > 0 ? (b.capitalRestantDu / b.valeurBien) * 100 : 0;

      const fraisV = clamp((b.fraisVentePct || 0) / 100, 0, 0.3);
      const breakevenVente =
        (b.capitalRestantDu || 0) > 0 && (1 - fraisV) > 0 ? (b.capitalRestantDu || 0) / (1 - fraisV) : 0;

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

    const valeurParc = updatedBiens.reduce((sum, b) => sum + (b.valeurBien || 0), 0);
    const encoursCredit = updatedBiens.reduce((sum, b) => sum + (b.capitalRestantDu || 0), 0);

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

    // Global LTV & DSCR (brut)
    const totalRevenuNetAvantCredit = updatedBiens.reduce((sum, b) => {
      const loyersAnnuels = (b.loyerMensuel || 0) * 12;
      const charges = b.chargesAnnuelles || 0;
      return sum + (loyersAnnuels - charges);
    }, 0);

    const totalServiceDette = updatedBiens.reduce((sum, b) => {
      const annuiteCredit = (b.mensualiteCredit || 0) * 12;
      const annuiteAssurance = b.assuranceEmprunteurAnnuelle || 0;
      return sum + (annuiteCredit + annuiteAssurance);
    }, 0);

    const ltvGlobal = valeurParc > 0 ? (encoursCredit / valeurParc) * 100 : 0;
    const dscrGlobal = totalServiceDette > 0 ? totalRevenuNetAvantCredit / totalServiceDette : 0;

    setResumeGlobal({
      valeurParc,
      encoursCredit,
      cashflowMensuelGlobal,
      rendementNetMoyen,
      cashflowMensuelGlobalAjuste,
      rendementNetMoyenAjuste,
      ltvGlobal,
      dscrGlobal,
    });

    // Graphs: en simple = brut, en avancé = ajusté
    const labels = updatedBiens.map((b, idx) => b.nom || `Bien #${idx + 1}`);
    const cashFlows = updatedBiens.map((b) => (advancedMode ? b.resultatNetAnnuelAjuste : b.resultatNetAnnuel) || 0);
    const rendements = updatedBiens.map((b) => (advancedMode ? b.rendementNetAjuste : b.rendementNet) || 0);

    setBarData({
      labels,
      datasets: [
        {
          label: advancedMode ? "Cash-flow annuel ajusté (€)" : "Cash-flow annuel (€)",
          data: cashFlows,
          backgroundColor: cashFlows.map((v) => (v >= 0 ? "#22c55e" : "#ef4444")),
        },
      ],
    });

    setLineData({
      labels,
      datasets: [
        {
          label: advancedMode ? "Rendement net ajusté (%)" : "Rendement net (%)",
          data: rendements,
          borderColor: "#0f172a",
          backgroundColor: "rgba(15,23,42,0.08)",
          tension: 0.25,
        },
      ],
    });

    // Analyse texte (simple vs avancé)
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
      `Votre parc se compose de ${updatedBiens.length} bien(s) pour une valeur totale estimée de ${formatEuro(valeurParc)} et un encours de crédit d’environ ${formatEuro(encoursCredit)}.`,
    ];

    if (!advancedMode) {
      lignes.push(
        `En agrégé, le cash-flow mensuel ressort à ${formatEuro(cashflowMensuelGlobal)}. Un cash-flow positif signifie que vos loyers couvrent les charges et crédits, tout en laissant un excédent. Un cash-flow légèrement négatif peut rester acceptable si la localisation et le potentiel de revalorisation sont forts.`
      );
      lignes.push(`Le rendement net moyen (avant impôts) sur l’ensemble des biens est d’environ ${formatPct(rendementNetMoyen)}.`);
      lignes.push(
        `Le bien le plus performant est ${bienTop.nom} avec un rendement net d’environ ${formatPct(bienTop.rendementNet)} et un cash-flow annuel de ${formatEuro(bienTop.resultatNetAnnuel)}. À l’inverse, le bien le moins performant est ${bienWorst.nom} avec un rendement net d’environ ${formatPct(bienWorst.rendementNet)} et un cash-flow annuel de ${formatEuro(bienWorst.resultatNetAnnuel)}.`
      );
      lignes.push(
        `Cette photographie vous permet d’identifier les biens qui tirent votre parc vers le haut (candidats à d’éventuels travaux de valorisation ou de maintien) et ceux qui le pénalisent (candidats à renégociation de crédit, optimisation du loyer ou arbitrage de vente).`
      );
    } else {
      lignes.push(
        `En version avancée (paramètres par bien : vacance/gestion/impôts), le cash-flow mensuel ajusté ressort à ${formatEuro(cashflowMensuelGlobalAjuste)}.`
      );
      lignes.push(`Le rendement moyen ajusté est d’environ ${formatPct(rendementNetMoyenAjuste)}.`);
      lignes.push(
        `Indicateurs : LTV global ~${formatPct(ltvGlobal)} et DSCR global ~${Number.isFinite(dscrGlobal) ? dscrGlobal.toFixed(2) : "-"}.`
      );
      lignes.push(
        `Le bien le plus performant (ajusté) est ${bienTop.nom} avec ~${formatPct(bienTop.rendementNetAjuste)} et un cash-flow annuel ajusté de ${formatEuro(bienTop.resultatNetAnnuelAjuste)}. À l’inverse, le bien le moins performant est ${bienWorst.nom} avec ~${formatPct(bienWorst.rendementNetAjuste)} et un cash-flow annuel ajusté de ${formatEuro(bienWorst.resultatNetAnnuelAjuste)}.`
      );
      lignes.push(
        `Astuce : si un bien a un DSCR < 1,10 ou un cash-flow ajusté négatif, c’est un bon candidat à optimiser (loyer, charges, renégociation) ou à arbitrer.`
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
          <div
            key={idx}
            className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2"
          >
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
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(resumeGlobal.rendementNetMoyenAjuste)}</p>
          <p className="mt-1 text-[0.7rem] text-slate-500">Lecture plus “terrain”.</p>
        </div>
      </div>
    );
  }, [resumeGlobal]);

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
      const loyersAnnuels = (b.loyerMensuel || 0) * 12;
      const charges = b.chargesAnnuelles || 0;
      const annuiteCredit = (b.mensualiteCredit || 0) * 12;
      const annuiteAssurance = b.assuranceEmprunteurAnnuelle || 0;
      const serviceDette = annuiteCredit + annuiteAssurance;

      const revenuNetAvantCredit = loyersAnnuels - charges;

      totalValeur += b.valeurBien || 0;
      totalCRD += b.capitalRestantDu || 0;
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
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-md p-4 space-y-4">
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

        {/* Détail par bien uniquement en avancé (sinon on reste simple) */}
        {advancedMode ? (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
              Détail par bien (avancé)
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-[0.72rem] text-slate-800">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left font-semibold py-2 pr-3">Bien</th>
                    <th className="text-right font-semibold py-2 pr-3">LTV</th>
                    <th className="text-right font-semibold py-2 pr-3">DSCR</th>
                    <th className="text-right font-semibold py-2 pr-3">CF mensuel ajusté</th>
                    <th className="text-right font-semibold py-2 pr-3">Rendement ajusté</th>
                    <th className="text-right font-semibold py-2 pr-3">Vacance</th>
                    <th className="text-right font-semibold py-2 pr-3">Gestion</th>
                    <th className="text-right font-semibold py-2 pr-3">Impôts</th>
                    <th className="text-right font-semibold py-2">Break-even vente</th>
                  </tr>
                </thead>
                <tbody>
                  {dataBiens.map((b, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="py-2 pr-3">{b.nom || `Bien #${idx + 1}`}</td>
                      <td className="py-2 pr-3 text-right">{formatPct(b.ltv || 0)}</td>
                      <td className="py-2 pr-3 text-right">{Number.isFinite(b.dscr || 0) ? (b.dscr || 0).toFixed(2) : "-"}</td>
                      <td
                        className={
                          "py-2 pr-3 text-right font-semibold " +
                          ((b.cashflowMensuelAjuste || 0) >= 0 ? "text-emerald-700" : "text-red-600")
                        }
                      >
                        {formatEuro(b.cashflowMensuelAjuste || 0)}
                      </td>
                      <td className="py-2 pr-3 text-right">{formatPct(b.rendementNetAjuste || 0)}</td>
                      <td className="py-2 pr-3 text-right">{formatPct(b.vacancePct || 0)}</td>
                      <td className="py-2 pr-3 text-right">{formatPct(b.gestionPct || 0)}</td>
                      <td className="py-2 pr-3 text-right">{formatPct(b.impotsPct || 0)}</td>
                      <td className="py-2 text-right">{formatEuro(b.breakevenVente || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-[0.68rem] text-slate-500">
              Break-even vente = prix minimum estimé pour solder le capital restant dû (avec frais de vente du bien).
            </p>
          </div>
        ) : null}
      </section>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-4">
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Formulaire biens */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-indigo-600 mb-1">Calculette</p>
                <h2 className="text-lg font-semibold text-slate-900">Décrivez vos biens locatifs</h2>
                <p className="text-xs text-slate-500">Valeur actuelle, loyer, charges, capital restant dû et crédit.</p>
              </div>

              {/* Toggle avancé */}
              <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={advancedMode}
                    onChange={(e) => setAdvancedMode(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-[0.75rem] font-semibold text-slate-700">Version avancée</span>
                </label>
                <p className="text-[0.65rem] text-slate-500 mt-1 max-w-[180px]">
                  Paramètres par bien + indicateurs (DSCR/LTV).
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
                  type="number"
                  min={1}
                  max={20}
                  value={nbBiens}
                  onChange={(e) => handleNbBiensChange(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Valeur actuelle estimée (€)</label>
                        <input
                          type="number"
                          value={b.valeurBien}
                          onChange={(e) => updateBienField(idx, "valeurBien", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Capital restant dû (€)</label>
                        <input
                          type="number"
                          value={b.capitalRestantDu}
                          onChange={(e) => updateBienField(idx, "capitalRestantDu", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Loyer mensuel hors charges (€)</label>
                        <input
                          type="number"
                          value={b.loyerMensuel}
                          onChange={(e) => updateBienField(idx, "loyerMensuel", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                          Charges annuelles (€)
                          <InfoBadge text="Copropriété, taxe foncière, assurance PNO/habitation, petits entretiens… hors crédit." />
                        </label>
                        <input
                          type="number"
                          value={b.chargesAnnuelles}
                          onChange={(e) => updateBienField(idx, "chargesAnnuelles", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Mensualité de crédit (€ / mois)</label>
                        <input
                          type="number"
                          value={b.mensualiteCredit}
                          onChange={(e) => updateBienField(idx, "mensualiteCredit", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Assurance emprunteur (€/an)</label>
                        <input
                          type="number"
                          value={b.assuranceEmprunteurAnnuelle}
                          onChange={(e) => updateBienField(idx, "assuranceEmprunteurAnnuelle", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Paramètres par bien — uniquement si avancé */}
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
                              type="number"
                              value={b.vacancePct}
                              onChange={(e) => updateBienField(idx, "vacancePct", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                              Gestion (%)
                              <InfoBadge text="Gestion locative (agence) ou coût implicite si vous gérez." />
                            </label>
                            <input
                              type="number"
                              value={b.gestionPct}
                              onChange={(e) => updateBienField(idx, "gestionPct", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                              Impôts (%)
                              <InfoBadge text="Approximation simplifiée. Mets 0 si tu ne veux pas l’intégrer." />
                            </label>
                            <input
                              type="number"
                              value={b.impotsPct}
                              onChange={(e) => updateBienField(idx, "impotsPct", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                              Frais vente (%)
                              <InfoBadge text="Pour le break-even vente (agent + divers). Sert à estimer le prix mini pour solder le CRD." />
                            </label>
                            <input
                              type="number"
                              value={b.fraisVentePct}
                              onChange={(e) => updateBienField(idx, "fraisVentePct", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                <button
                  onClick={handleCalculParc}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-2xl active:scale-[0.99]"
                >
                  Calculer la rentabilité du parc
                </button>
              </div>
            </div>
          </div>

          {/* Résultats */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-indigo-600 mb-1">Résultats</p>
                <h2 className="text-lg font-semibold text-slate-900">Vue d&apos;ensemble de votre parc</h2>
                <p className="text-xs text-slate-500">
                  Cash-flow global, encours, rendements et biens à surveiller.
                </p>
              </div>
              {/* ✅ PDF + sauvegarde supprimés */}
            </div>

            {hasSimulation ? (
              <>
                {/* Cartes de synthèse */}
                <div className="grid gap-3 sm:grid-cols-4 mt-1">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Valeur du parc</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeGlobal!.valeurParc)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Encours de crédit</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeGlobal!.encoursCredit)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      {advancedMode ? "Cash-flow mensuel ajusté" : "Cash-flow mensuel global"}
                    </p>
                    <p
                      className={
                        "mt-1 text-sm font-semibold " +
                        ((advancedMode ? resumeGlobal!.cashflowMensuelGlobalAjuste : resumeGlobal!.cashflowMensuelGlobal) >= 0
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

                {/* Cartes avancées */}
                {advancedMode ? advancedCards : null}

                {/* Graphiques */}
                <div className="grid gap-4 lg:grid-cols-2 mt-3">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <p className="text-xs text-slate-600 mb-2">
                      {advancedMode ? "Cash-flow annuel ajusté par bien." : "Cash-flow annuel par bien."}
                    </p>
                    {barData && (
                      <Bar
                        data={barData}
                        options={{
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { ticks: { color: "#0f172a", font: { size: 9 } }, grid: { color: "#e5e7eb" } },
                            y: { ticks: { color: "#0f172a", font: { size: 10 } }, grid: { color: "#e5e7eb" } },
                          },
                        }}
                      />
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <p className="text-xs text-slate-600 mb-2">
                      {advancedMode ? "Rendement net ajusté par bien." : "Rendement net par bien (avant impôts)."}
                    </p>
                    {lineData && (
                      <Line
                        data={lineData}
                        options={{
                          plugins: {
                            legend: { labels: { color: "#0f172a", font: { size: 11 } } },
                          },
                          scales: {
                            x: { ticks: { color: "#0f172a", font: { size: 9 } }, grid: { color: "#e5e7eb" } },
                            y: { ticks: { color: "#0f172a", font: { size: 10 } }, grid: { color: "#e5e7eb" } },
                          },
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Analyse globale */}
                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">Analyse globale</p>
                  {renderAnalysisBlocks(analyseTexte)}
                  <p className="mt-2 text-[0.7rem] text-slate-500">
                    Analyse indicative. En avancé : vacance/gestion/impôts sont des approximations.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Renseignez vos biens et cliquez sur “Calculer la rentabilité du parc” pour obtenir une vue d&apos;ensemble complète.
              </p>
            )}
          </div>
        </section>

        {/* Récap table (simple + avancé) */}
        {renderRecapTable()}
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} MT Courtage &amp; Investissement – Simulations indicatives.</p>
        <p className="mt-1">
          Contact :{" "}
          <a href="mailto:mtcourtage@gmail.com" className="underline">
            mtcourtage@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
