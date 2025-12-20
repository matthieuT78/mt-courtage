// pages/parc-immobilier.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

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
  if (Number.isNaN(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (Number.isNaN(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

type Bien = {
  nom: string;
  valeurBien: number;
  capitalRestantDu: number;
  loyerMensuel: number;
  chargesAnnuelles: number;
  mensualiteCredit: number;
  assuranceEmprunteurAnnuelle: number;
  resultatNetAnnuel: number;
  cashflowMensuel: number;
  rendementNet: number;
};

type ResumeGlobal = {
  valeurParc: number;
  encoursCredit: number;
  cashflowMensuelGlobal: number;
  rendementNetMoyen: number;
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

export default function ParcImmobilierPage() {
  /* ============================
     AUTH (comme investissement)
  ============================ */
  const [user, setUser] = useState<any>(null);
  const [checkingUser, setCheckingUser] = useState(true);
  const isLoggedIn = !!user?.id;

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setCheckingUser(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setCheckingUser(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* ============================
     STATE CALCULETTE
  ============================ */
  const [nbBiens, setNbBiens] = useState(1);
  const [biens, setBiens] = useState<Bien[]>([
    {
      nom: "Appartement #1",
      valeurBien: 250000,
      capitalRestantDu: 150000,
      loyerMensuel: 900,
      chargesAnnuelles: 3000,
      mensualiteCredit: 650,
      assuranceEmprunteurAnnuelle: 400,
      resultatNetAnnuel: 0,
      cashflowMensuel: 0,
      rendementNet: 0,
    },
  ]);

  const [resumeGlobal, setResumeGlobal] = useState<ResumeGlobal | null>(null);
  const [analyseTexte, setAnalyseTexte] = useState<string>("");
  const [barData, setBarData] = useState<any | null>(null);
  const [lineData, setLineData] = useState<any | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hasSimulation = !!resumeGlobal && !!barData && !!lineData;

  const shouldBlurAnalysis = hasSimulation && !isLoggedIn;

  const handleNbBiensChange = (value: number) => {
    const n = Math.min(Math.max(value, 1), 20);
    setNbBiens(n);
    setBiens((prev) => {
      const arr = [...prev];
      while (arr.length < n) {
        arr.push({
          nom: `Bien #${arr.length + 1}`,
          valeurBien: 0,
          capitalRestantDu: 0,
          loyerMensuel: 0,
          chargesAnnuelles: 0,
          mensualiteCredit: 0,
          assuranceEmprunteurAnnuelle: 0,
          resultatNetAnnuel: 0,
          cashflowMensuel: 0,
          rendementNet: 0,
        });
      }
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

  const handleCalculParc = () => {
    setSaveMessage(null);

    const updatedBiens: Bien[] = biens.slice(0, nbBiens).map((b) => {
      const loyersAnnuels = (b.loyerMensuel || 0) * 12;
      const chargesAnnuelles = b.chargesAnnuelles || 0;
      const annuiteCredit = (b.mensualiteCredit || 0) * 12;
      const annuiteAssurance = b.assuranceEmprunteurAnnuelle || 0;

      const revenuNetAvantCredit = loyersAnnuels - chargesAnnuelles;
      const resultatNetAnnuel =
        revenuNetAvantCredit - annuiteCredit - annuiteAssurance;
      const cashflowMensuel = resultatNetAnnuel / 12;

      const rendementNet =
        b.valeurBien > 0 ? (revenuNetAvantCredit / b.valeurBien) * 100 : 0;

      return {
        ...b,
        resultatNetAnnuel,
        cashflowMensuel,
        rendementNet,
      };
    });

    setBiens(updatedBiens);

    const valeurParc = updatedBiens.reduce(
      (sum, b) => sum + (b.valeurBien || 0),
      0
    );
    const encoursCredit = updatedBiens.reduce(
      (sum, b) => sum + (b.capitalRestantDu || 0),
      0
    );
    const cashflowMensuelGlobal = updatedBiens.reduce(
      (sum, b) => sum + (b.cashflowMensuel || 0),
      0
    );

    const rendementNetMoyen =
      updatedBiens.length > 0
        ? updatedBiens.reduce((sum, b) => sum + (b.rendementNet || 0), 0) /
          updatedBiens.length
        : 0;

    const resume: ResumeGlobal = {
      valeurParc,
      encoursCredit,
      cashflowMensuelGlobal,
      rendementNetMoyen,
    };
    setResumeGlobal(resume);

    const labels = updatedBiens.map((b, idx) => b.nom || `Bien #${idx + 1}`);
    const cashFlows = updatedBiens.map((b) => b.resultatNetAnnuel || 0);
    const rendements = updatedBiens.map((b) => b.rendementNet || 0);

    setBarData({
      labels,
      datasets: [
        {
          label: "Cash-flow annuel (€)",
          data: cashFlows,
          backgroundColor: cashFlows.map((v) => (v >= 0 ? "#22c55e" : "#ef4444")),
        },
      ],
    });

    setLineData({
      labels,
      datasets: [
        {
          label: "Rendement net (%)",
          data: rendements,
          borderColor: "#0f172a",
          backgroundColor: "rgba(15,23,42,0.08)",
          tension: 0.25,
        },
      ],
    });

    let bienTop = updatedBiens[0];
    let bienWorst = updatedBiens[0];
    updatedBiens.forEach((b) => {
      if (b.rendementNet > bienTop.rendementNet) bienTop = b;
      if (b.rendementNet < bienWorst.rendementNet) bienWorst = b;
    });

    const lignes: string[] = [
      `Votre parc se compose de ${updatedBiens.length} bien(s) pour une valeur totale estimée de ${formatEuro(
        valeurParc
      )} et un encours de crédit d’environ ${formatEuro(encoursCredit)}.`,
      `En agrégé, le cash-flow mensuel ressort à ${formatEuro(
        cashflowMensuelGlobal
      )}. Un cash-flow positif signifie que vos loyers couvrent les charges et crédits, tout en laissant un excédent. Un cash-flow légèrement négatif peut rester acceptable si la localisation et le potentiel de revalorisation sont forts.`,
      `Le rendement net moyen (avant impôts) sur l’ensemble des biens est d’environ ${formatPct(
        rendementNetMoyen
      )}.`,
      `Le bien le plus performant est ${
        bienTop.nom
      } avec un rendement net d’environ ${formatPct(
        bienTop.rendementNet
      )} et un cash-flow annuel de ${formatEuro(
        bienTop.resultatNetAnnuel
      )}. À l’inverse, le bien le moins performant est ${
        bienWorst.nom
      } avec un rendement net d’environ ${formatPct(
        bienWorst.rendementNet
      )} et un cash-flow annuel de ${formatEuro(
        bienWorst.resultatNetAnnuel
      )}.`,
      `Cette photographie vous permet d’identifier les biens qui tirent votre parc vers le haut (candidats à d’éventuels travaux de valorisation ou de maintien) et ceux qui le pénalisent (candidats à renégociation de crédit, optimisation du loyer ou arbitrage de vente).`,
    ];

    setAnalyseTexte(lignes.join("\n"));
  };

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleSaveProject = async () => {
    if (!resumeGlobal || !biens.length) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const session = sessionData?.session;
      if (!session) {
        if (typeof window !== "undefined") {
          window.location.href =
            "/mon-compte?mode=login&redirect=/parc-immobilier";
        }
        return;
      }

      const { error } = await supabase.from("projects").insert({
        user_id: session.user.id,
        type: "parc",
        title: "Analyse parc immobilier",
        data: {
          biens,
          resumeGlobal,
          texte: analyseTexte,
        },
      });

      if (error) throw error;
      setSaveMessage("✅ Analyse du parc sauvegardée dans votre espace.");
    } catch (err: any) {
      setSaveMessage(
        "❌ Erreur lors de la sauvegarde du projet : " +
          (err?.message || "erreur inconnue")
      );
    } finally {
      setSaving(false);
    }
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
            <p className="text-[0.8rem] text-slate-800 leading-relaxed">
              {line}
            </p>
          </div>
        ))}
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
    let totalRevenuNetAvantCredit = 0;

    dataBiens.forEach((b) => {
      const loyersAnnuels = (b.loyerMensuel || 0) * 12;
      const charges = b.chargesAnnuelles || 0;
      const annuiteCredit = (b.mensualiteCredit || 0) * 12;
      const annuiteAssurance = b.assuranceEmprunteurAnnuelle || 0;
      const revenuNetAvantCredit = loyersAnnuels - charges;

      totalValeur += b.valeurBien || 0;
      totalCRD += b.capitalRestantDu || 0;
      totalLoyersAnnuels += loyersAnnuels;
      totalChargesAnnuelles += charges;
      totalCreditAssuranceAnnuel += annuiteCredit + annuiteAssurance;
      totalResultatNetAnnuel += b.resultatNetAnnuel || 0;
      totalCashflowMensuel += b.cashflowMensuel || 0;
      totalRevenuNetAvantCredit += revenuNetAvantCredit;
    });

    const rendementGlobal =
      totalValeur > 0 ? (totalRevenuNetAvantCredit / totalValeur) * 100 : 0;

    return (
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-md p-4 space-y-4 relative">
        <div
          className={
            shouldBlurAnalysis ? "blur-sm select-none pointer-events-none" : ""
          }
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
              Synthèse globale du parc
            </p>
            <table className="w-full text-[0.75rem] text-slate-800">
              <tbody>
                <tr>
                  <td className="py-1 pr-2">Valeur totale du parc</td>
                  <td className="py-1 text-right font-semibold">
                    {formatEuro(totalValeur)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-2">Encours de crédit total</td>
                  <td className="py-1 text-right font-semibold">
                    {formatEuro(totalCRD)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-2">Loyers annuels totaux</td>
                  <td className="py-1 text-right font-semibold">
                    {formatEuro(totalLoyersAnnuels)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-2">Charges annuelles totales</td>
                  <td className="py-1 text-right font-semibold">
                    {formatEuro(totalChargesAnnuelles)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-2">Crédit + assurance (annuels)</td>
                  <td className="py-1 text-right font-semibold">
                    {formatEuro(totalCreditAssuranceAnnuel)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-2">Résultat net annuel global</td>
                  <td className="py-1 text-right font-semibold">
                    {formatEuro(totalResultatNetAnnuel)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-2">Cash-flow mensuel global</td>
                  <td className="py-1 text-right font-semibold">
                    {formatEuro(totalCashflowMensuel)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-2">Rendement net global</td>
                  <td className="py-1 text-right font-semibold">
                    {formatPct(rendementGlobal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {!checkingUser && shouldBlurAnalysis && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="max-w-md rounded-2xl border border-slate-200 bg-white/90 backdrop-blur px-5 py-4 shadow-lg">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-indigo-700 mb-1">
                Analyse réservée aux inscrits
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Débloquez l’analyse complète
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Créez un compte gratuit pour accéder à l’analyse détaillée, au
                tableau récapitulatif et sauvegarder vos projets.
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/mon-compte?mode=register&redirect=${encodeURIComponent(
                    "/parc-immobilier"
                  )}`}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  Créer un compte gratuit
                </Link>
                <Link
                  href={`/mon-compte?mode=login&redirect=${encodeURIComponent(
                    "/parc-immobilier"
                  )}`}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800"
                >
                  J’ai déjà un compte
                </Link>
              </div>
            </div>
          </div>
        )}
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
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-indigo-600 mb-1">
                Calculette
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Décrivez vos biens locatifs
              </h2>
              <p className="text-xs text-slate-500">
                Valeur actuelle, loyer, charges, capital restant dû et crédit.
              </p>
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
                  onChange={(e) =>
                    handleNbBiensChange(parseInt(e.target.value, 10) || 1)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {Array.from({ length: nbBiens }).map((_, idx) => {
                const b = biens[idx];
                return (
                  <div
                    key={idx}
                    className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2"
                  >
                    <p className="text-[0.7rem] font-semibold text-slate-700">
                      Bien #{idx + 1}
                    </p>

                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">
                        Nom du bien (libellé)
                      </label>
                      <input
                        type="text"
                        value={b.nom}
                        onChange={(e) =>
                          updateBienField(idx, "nom", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Valeur actuelle estimée (€)
                        </label>
                        <input
                          type="number"
                          value={b.valeurBien}
                          onChange={(e) =>
                            updateBienField(idx, "valeurBien", e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Capital restant dû (€)
                        </label>
                        <input
                          type="number"
                          value={b.capitalRestantDu}
                          onChange={(e) =>
                            updateBienField(
                              idx,
                              "capitalRestantDu",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Loyer mensuel hors charges (€)
                        </label>
                        <input
                          type="number"
                          value={b.loyerMensuel}
                          onChange={(e) =>
                            updateBienField(
                              idx,
                              "loyerMensuel",
                              e.target.value
                            )
                          }
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
                          onChange={(e) =>
                            updateBienField(
                              idx,
                              "chargesAnnuelles",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Mensualité de crédit (€ / mois)
                        </label>
                        <input
                          type="number"
                          value={b.mensualiteCredit}
                          onChange={(e) =>
                            updateBienField(
                              idx,
                              "mensualiteCredit",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Assurance emprunteur (€/an)
                        </label>
                        <input
                          type="number"
                          value={b.assuranceEmprunteurAnnuelle}
                          onChange={(e) =>
                            updateBienField(
                              idx,
                              "assuranceEmprunteurAnnuelle",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
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
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-indigo-600 mb-1">
                  Résultats
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Vue d&apos;ensemble de votre parc
                </h2>
                <p className="text-xs text-slate-500">
                  Cash-flow global, encours, rendements et biens à surveiller.
                </p>
              </div>

              {hasSimulation && (
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={handlePrintPDF}
                    className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300"
                  >
                    PDF
                  </button>
                  <button
                    onClick={handleSaveProject}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full border border-emerald-500/80 bg-emerald-500 px-3 py-1.5 text-[0.7rem] font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {saving ? "Sauvegarde..." : "Sauvegarder ce projet"}
                  </button>
                  {saveMessage && (
                    <p className="text-[0.65rem] text-slate-500 max-w-[220px] text-right">
                      {saveMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            {hasSimulation ? (
              <>
                {/* Cartes de synthèse */}
                <div className="grid gap-3 sm:grid-cols-4 mt-1">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Valeur du parc
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeGlobal!.valeurParc)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Encours de crédit
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeGlobal!.encoursCredit)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Cash-flow mensuel global
                    </p>
                    <p
                      className={
                        "mt-1 text-sm font-semibold " +
                        (resumeGlobal!.cashflowMensuelGlobal >= 0
                          ? "text-emerald-700"
                          : "text-red-600")
                      }
                    >
                      {formatEuro(resumeGlobal!.cashflowMensuelGlobal)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Rendement net moyen
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatPct(resumeGlobal!.rendementNetMoyen)}
                    </p>
                  </div>
                </div>

                {/* Graphiques (laissés visibles même en visiteur) */}
                <div className="grid gap-4 lg:grid-cols-2 mt-3">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <p className="text-xs text-slate-600 mb-2">
                      Cash-flow annuel par bien.
                    </p>
                    {barData && (
                      <Bar
                        data={barData}
                        options={{
                          plugins: { legend: { display: false } },
                          scales: {
                            x: {
                              ticks: { color: "#0f172a", font: { size: 9 } },
                              grid: { color: "#e5e7eb" },
                            },
                            y: {
                              ticks: { color: "#0f172a", font: { size: 10 } },
                              grid: { color: "#e5e7eb" },
                            },
                          },
                        }}
                      />
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <p className="text-xs text-slate-600 mb-2">
                      Rendement net par bien (avant impôts).
                    </p>
                    {lineData && (
                      <Line
                        data={lineData}
                        options={{
                          plugins: {
                            legend: {
                              labels: { color: "#0f172a", font: { size: 11 } },
                            },
                          },
                          scales: {
                            x: {
                              ticks: { color: "#0f172a", font: { size: 9 } },
                              grid: { color: "#e5e7eb" },
                            },
                            y: {
                              ticks: { color: "#0f172a", font: { size: 10 } },
                              grid: { color: "#e5e7eb" },
                            },
                          },
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Analyse globale (floutée si visiteur) */}
                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 relative">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                    Analyse globale
                  </p>

                  <div
                    className={
                      shouldBlurAnalysis
                        ? "blur-sm select-none pointer-events-none"
                        : ""
                    }
                  >
                    {renderAnalysisBlocks(analyseTexte)}
                    <p className="mt-2 text-[0.7rem] text-slate-500">
                      Cette analyse est fournie hors fiscalité détaillée (régimes
                      micro, réel, LMNP, etc.) et hors revalorisation future des
                      loyers et des prix de marché.
                    </p>
                  </div>

                  {!checkingUser && shouldBlurAnalysis && (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <div className="max-w-md rounded-2xl border border-slate-200 bg-white/90 backdrop-blur px-5 py-4 shadow-lg">
                        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-indigo-700 mb-1">
                          Analyse réservée aux inscrits
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          Débloquez l’analyse complète
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          Créez un compte gratuit pour accéder à l’analyse
                          complète, sauvegarder vos projets et comparer vos
                          simulations.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Link
                            href={`/mon-compte?mode=register&redirect=${encodeURIComponent(
                              "/parc-immobilier"
                            )}`}
                            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                          >
                            Créer un compte gratuit
                          </Link>
                          <Link
                            href={`/mon-compte?mode=login&redirect=${encodeURIComponent(
                              "/parc-immobilier"
                            )}`}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800"
                          >
                            J’ai déjà un compte
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Renseignez vos biens et cliquez sur “Calculer la rentabilité du
                parc” pour obtenir une vue d&apos;ensemble complète.
              </p>
            )}
          </div>
        </section>

        {/* Récap table (floutée si visiteur) */}
        {renderRecapTable()}
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement –
          Simulations indicatives.
        </p>
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
