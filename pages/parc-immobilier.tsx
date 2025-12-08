// pages/parc-immobilier.tsx
import { useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabaseClient";
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
  chargesAnnuelles: number; // copro + TF + PNO, etc.
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

  const updateBienField = (
    index: number,
    field: keyof Bien,
    value: string
  ) => {
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

    const labels = updatedBiens.map(
      (b, idx) => b.nom || `Bien #${idx + 1}`
    );
    const cashFlows = updatedBiens.map((b) => b.resultatNetAnnuel || 0);
    const rendements = updatedBiens.map((b) => b.rendementNet || 0);

    const bar = {
      labels,
      datasets: [
        {
          label: "Cash-flow annuel (€)",
          data: cashFlows,
          backgroundColor: cashFlows.map((v) =>
            v >= 0 ? "#22c55e" : "#ef4444"
          ),
        },
      ],
    };
    setBarData(bar);

    const line = {
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
    };
    setLineData(line);

    // Analyse textuelle
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
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleSaveProject = async () => {
    if (!resumeGlobal || !biens.length) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      if (!supabase) {
        throw new Error(
          "Le service de sauvegarde n'est pas disponible (configuration Supabase manquante)."
        );
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const session = sessionData?.session;
      if (!session) {
        if (typeof window !== "undefined") {
          window.location.href = "/mon-compte?redirect=/projets";
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

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, idx) => (
      <p key={idx} className="text-sm text-slate-800 leading-relaxed">
        {line}
      </p>
    ));

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* ✅ Nouveau header global */}
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

                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                    Analyse globale
                  </p>
                  {renderMultiline(analyseTexte)}
                  <p className="mt-2 text-[0.7rem] text-slate-500">
                    Cette analyse est fournie hors fiscalité détaillée (régimes
                    micro, réel, LMNP, etc.) et hors revalorisation future des
                    loyers et des prix de marché.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Renseignez vos biens et cliquez sur “Calculer la rentabilité du
                parc” pour obtenir une vue d&apos;ensemble complète à présenter à
                votre banque ou à votre conseiller.
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Simulations
          indicatives.
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
