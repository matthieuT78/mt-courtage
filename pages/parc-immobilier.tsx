// pages/parc-immobilier.tsx
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabaseClient";
import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";

ChartJS.register(Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), {
  ssr: false,
});

function formatEuro(val: number) {
  if (Number.isNaN(val) || val === undefined || val === null) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (Number.isNaN(val) || val === undefined || val === null) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

type BienInput = {
  nom: string;
  valeurBien: number;
  loyersAnnuels: number;
  chargesAnnuelles: number;
  mensualiteCredit: number;
  resteAnneesCredit: number;
};

type BienResume = BienInput & {
  resultatNetAnnuel: number;
  cashflowMensuel: number;
  rendementBrut: number;
};

type ResumeGlobal = {
  valeurTotale: number;
  loyersAnnuelsTotaux: number;
  resultatNetAnnuelGlobal: number;
  cashflowAnnuelGlobal: number;
  cashflowMensuelGlobal: number;
  rendementBrutMoyen: number;
};

type GraphDataParc = {
  labels: string[];
  cashflows: number[];
};

export default function ParcImmobilierPage() {
  const [nbBiens, setNbBiens] = useState(2);
  const [biens, setBiens] = useState<BienInput[]>([
    {
      nom: "Appartement 1",
      valeurBien: 200000,
      loyersAnnuels: 12000,
      chargesAnnuelles: 3000,
      mensualiteCredit: 700,
      resteAnneesCredit: 18,
    },
    {
      nom: "Appartement 2",
      valeurBien: 150000,
      loyersAnnuels: 9000,
      chargesAnnuelles: 2500,
      mensualiteCredit: 550,
      resteAnneesCredit: 15,
    },
  ]);

  const [resumeGlobal, setResumeGlobal] = useState<ResumeGlobal | null>(null);
  const [biensResumes, setBiensResumes] = useState<BienResume[]>([]);
  const [resultTexte, setResultTexte] = useState<string>("");
  const [graphData, setGraphData] = useState<GraphDataParc | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hasSimulation = !!resumeGlobal && biensResumes.length > 0;

  const handleNbBiensChange = (value: number) => {
    const n = Math.min(Math.max(value, 1), 20);
    setNbBiens(n);
    setBiens((prev) => {
      const arr = [...prev];
      while (arr.length < n) {
        arr.push({
          nom: `Bien ${arr.length + 1}`,
          valeurBien: 0,
          loyersAnnuels: 0,
          chargesAnnuelles: 0,
          mensualiteCredit: 0,
          resteAnneesCredit: 15,
        });
      }
      return arr.slice(0, n);
    });
  };

  const updateBien = (index: number, patch: Partial<BienInput>) => {
    setBiens((prev) => {
      const arr = [...prev];
      arr[index] = { ...arr[index], ...patch };
      return arr;
    });
  };

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, idx) => (
      <p key={idx} className="text-sm text-slate-800 leading-relaxed">
        {line}
      </p>
    ));

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCalculParc = () => {
    setSaveMessage(null);

    const resumes: BienResume[] = biens.slice(0, nbBiens).map((b) => {
      const resultatNetAnnuel =
        (b.loyersAnnuels || 0) -
        (b.chargesAnnuelles || 0) -
        (b.mensualiteCredit || 0) * 12;

      const cashflowMensuel = resultatNetAnnuel / 12;
      const rendementBrut =
        b.valeurBien > 0 ? ((b.loyersAnnuels || 0) / b.valeurBien) * 100 : 0;

      return {
        ...b,
        resultatNetAnnuel,
        cashflowMensuel,
        rendementBrut,
      };
    });

    const valeurTotale = resumes.reduce(
      (sum, b) => sum + (b.valeurBien || 0),
      0
    );
    const loyersAnnuelsTotaux = resumes.reduce(
      (sum, b) => sum + (b.loyersAnnuels || 0),
      0
    );
    const resultatNetAnnuelGlobal = resumes.reduce(
      (sum, b) => sum + (b.resultatNetAnnuel || 0),
      0
    );
    const cashflowAnnuelGlobal = resultatNetAnnuelGlobal;
    const cashflowMensuelGlobal = cashflowAnnuelGlobal / 12;

    const rendementBrutMoyen =
      valeurTotale > 0
        ? (loyersAnnuelsTotaux / valeurTotale) * 100
        : 0;

    const resume: ResumeGlobal = {
      valeurTotale,
      loyersAnnuelsTotaux,
      resultatNetAnnuelGlobal,
      cashflowAnnuelGlobal,
      cashflowMensuelGlobal,
      rendementBrutMoyen,
    };

    setBiensResumes(resumes);
    setResumeGlobal(resume);

    const labels = resumes.map((b) => b.nom || "Bien");
    const cashflows = resumes.map((b) => b.resultatNetAnnuel || 0);

    setGraphData({
      labels,
      cashflows,
    });

    const meilleur = [...resumes].sort(
      (a, b) => b.resultatNetAnnuel - a.resultatNetAnnuel
    )[0];
    const pire = [...resumes].sort(
      (a, b) => a.resultatNetAnnuel - b.resultatNetAnnuel
    )[0];

    const texte = [
      `Votre parc immobilier analysé comprend ${resumes.length} bien(s), pour une valeur totale estimée de ${formatEuro(
        valeurTotale
      )}. Les loyers bruts annuels cumulés atteignent ${formatEuro(
        loyersAnnuelsTotaux
      )}.`,
      `En retranchant les charges (copropriété, taxe foncière, assurance, entretien, etc.) et les mensualités de crédit, le résultat net annuel global ressort à ${formatEuro(
        resultatNetAnnuelGlobal
      )}, soit un cash-flow mensuel d'environ ${formatEuro(
        cashflowMensuelGlobal
      )}.`,
      `Sur cette base, le rendement brut moyen de l'ensemble du parc se situe autour de ${formatPct(
        rendementBrutMoyen
      )}. Certains biens sont au-dessus de cette moyenne, d'autres en dessous, ce que met en évidence le graphique des cash-flows par bien.`,
      meilleur
        ? `Le bien le plus performant actuellement est "${meilleur.nom}", avec un résultat net annuel d'environ ${formatEuro(
            meilleur.resultatNetAnnuel
          )} et un rendement brut proche de ${formatPct(
            meilleur.rendementBrut
          )}. C'est typiquement un actif à préserver, voire à optimiser encore (revalorisation progressive du loyer, amélioration de la fiscalité, etc.).`
        : "",
      pire
        ? `Le bien le plus fragile est "${pire.nom}", avec un résultat net annuel de ${formatEuro(
            pire.resultatNetAnnuel
          )} et un rendement brut de ${formatPct(
            pire.rendementBrut
          )}. Ce contraste peut guider vos arbitrages : renégociation de crédit, travaux ciblés pour repositionner le bien, révision du loyer ou, à terme, arbitrage de vente si le potentiel reste limité.`
        : "",
      `Lecture stratégique : si le cash-flow global est positif, votre parc contribue à dégager un revenu complémentaire tout en se remboursant au fil du temps. Si le cash-flow est légèrement négatif, cela peut rester acceptable dans une logique patrimoniale, à condition que la localisation, la qualité des biens et la perspective de valorisation justifient cet effort d'épargne.`,
    ]
      .filter(Boolean)
      .join("\n");

    setResultTexte(texte);
  };

  const handleSaveProject = async () => {
    if (!hasSimulation || !resumeGlobal || !graphData) return;

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

      const titre = `Parc immobilier - ${biensResumes.length} bien(s)`;

      const { error } = await supabase.from("projects").insert({
        user_id: session.user.id,
        type: "parc",
        title: titre,
        data: {
          resumeGlobal,
          biens: biensResumes,
          graphData,
          texte: resultTexte,
        },
      });

      if (error) throw error;
      setSaveMessage("✅ Analyse du parc sauvegardée dans votre espace.");
    } catch (err: any) {
      setSaveMessage(
        "❌ Erreur lors de la sauvegarde : " + (err?.message || "erreur inconnue")
      );
    } finally {
      setSaving(false);
    }
  };

  let barData: any = null;
  if (graphData) {
    barData = {
      labels: graphData.labels,
      datasets: [
        {
          label: "Cash-flow annuel par bien (€)",
          data: graphData.cashflows,
          backgroundColor: "#0f172a",
        },
      ],
    };
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Analyse de la rentabilité de votre parc existant.
            </p>
          </div>
          <div className="text-xs text-slate-500 sm:text-right">
            <p>Outil indicatif, ne remplace pas une étude personnalisée.</p>
            <Link href="/" className="underline">
              &larr; Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
          <div>
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-indigo-600 mb-1">
              Calculette
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              Décrivez vos biens immobiliers
            </h2>
            <p className="text-xs text-slate-500">
              Indiquez les principales caractéristiques de chaque bien pour
              mesurer la performance globale et individuelle de votre parc.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-700">
                Nombre de biens à analyser
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

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {Array.from({ length: nbBiens }).map((_, idx) => {
                const b = biens[idx] || biens[0];
                return (
                  <div
                    key={idx}
                    className="border-t border-slate-200 pt-3 mt-3 first:border-none first:pt-0 first:mt-0"
                  >
                    <p className="text-[0.7rem] text-slate-700 font-medium mb-2">
                      Bien #{idx + 1}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">
                          Nom / Référence
                        </label>
                        <input
                          type="text"
                          value={b.nom}
                          onChange={(e) =>
                            updateBien(idx, { nom: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Ex. T2 centre-ville"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">
                          Valeur du bien (€)
                        </label>
                        <input
                          type="number"
                          value={b.valeurBien}
                          onChange={(e) =>
                            updateBien(idx, {
                              valeurBien: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">
                          Loyers bruts (€/an)
                        </label>
                        <input
                          type="number"
                          value={b.loyersAnnuels}
                          onChange={(e) =>
                            updateBien(idx, {
                              loyersAnnuels: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 mt-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">
                          Charges (€/an)
                        </label>
                        <input
                          type="number"
                          value={b.chargesAnnuelles}
                          onChange={(e) =>
                            updateBien(idx, {
                              chargesAnnuelles:
                                parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Copro, taxe foncière, assurance..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">
                          Mensualité de crédit actuelle (€)
                        </label>
                        <input
                          type="number"
                          value={b.mensualiteCredit}
                          onChange={(e) =>
                            updateBien(idx, {
                              mensualiteCredit:
                                parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">
                          Années restantes de crédit
                        </label>
                        <input
                          type="number"
                          value={b.resteAnneesCredit}
                          onChange={(e) =>
                            updateBien(idx, {
                              resteAnneesCredit:
                                parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end mt-3">
              <button
                onClick={handleCalculParc}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-400/40 hover:shadow-2xl hover:shadow-indigo-400/60 transition-transform active:scale-[0.99]"
              >
                Calculer / Mettre à jour l&apos;analyse
              </button>
            </div>
          </div>
        </section>

        {/* Résultats */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-indigo-600 mb-1">
                Synthèse
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Vue d&apos;ensemble de votre parc
              </h2>
              <p className="text-xs text-slate-500">
                Rentabilité globale, cash-flows par bien et analyse narrative.
              </p>
            </div>

            {hasSimulation && (
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={handlePrintPDF}
                    className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300 transition-colors"
                  >
                    PDF
                  </button>
                  <button
                    onClick={handleSaveProject}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full border border-indigo-500/80 bg-indigo-500 px-3 py-1.5 text-[0.7rem] font-semibold text-white shadow-sm hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving
                      ? "Enregistrement..."
                      : "Sauvegarder dans mon espace"}
                  </button>
                </div>
                {saveMessage && (
                  <p className="text-[0.65rem] text-slate-500">{saveMessage}</p>
                )}
              </div>
            )}
          </div>

          {hasSimulation ? (
            <>
              {/* Cartes globales */}
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Valeur totale du parc
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(resumeGlobal!.valeurTotale)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Loyers bruts annuels
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(resumeGlobal!.loyersAnnuelsTotaux)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Rendement brut moyen
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(resumeGlobal!.rendementBrutMoyen)}
                  </p>
                </div>
              </div>

              {/* Graphique par bien */}
              {barData && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-600 mb-2">
                    Comparaison des cash-flows annuels par bien : repérez en un
                    coup d&apos;œil les actifs les plus contributeurs et ceux
                    qui tirent la performance vers le bas.
                  </p>
                  <Bar
                    data={barData}
                    options={{
                      plugins: {
                        legend: {
                          labels: {
                            color: "#0f172a",
                            font: { size: 11 },
                          },
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
                </div>
              )}

              {/* Tableau par bien */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-x-auto">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                  Détail par bien
                </p>
                <table className="min-w-full text-[0.75rem] text-slate-800">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-1 pr-3 text-left font-medium">Bien</th>
                      <th className="py-1 px-3 text-right font-medium">
                        Valeur
                      </th>
                      <th className="py-1 px-3 text-right font-medium">
                        Loyers bruts
                      </th>
                      <th className="py-1 px-3 text-right font-medium">
                        Charges
                      </th>
                      <th className="py-1 px-3 text-right font-medium">
                        Crédit mensuel
                      </th>
                      <th className="py-1 px-3 text-right font-medium">
                        Résultat net annuel
                      </th>
                      <th className="py-1 pl-3 text-right font-medium">
                        Rendement brut
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {biensResumes.map((b, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-100 last:border-none"
                      >
                        <td className="py-1 pr-3">
                          {b.nom || `Bien ${idx + 1}`}
                        </td>
                        <td className="py-1 px-3 text-right">
                          {formatEuro(b.valeurBien)}
                        </td>
                        <td className="py-1 px-3 text-right">
                          {formatEuro(b.loyersAnnuels)}
                        </td>
                        <td className="py-1 px-3 text-right">
                          {formatEuro(b.chargesAnnuelles)}
                        </td>
                        <td className="py-1 px-3 text-right">
                          {formatEuro(b.mensualiteCredit)}
                        </td>
                        <td
                          className={
                            "py-1 px-3 text-right " +
                            (b.resultatNetAnnuel >= 0
                              ? "text-emerald-700"
                              : "text-red-600")
                          }
                        >
                          {formatEuro(b.resultatNetAnnuel)}
                        </td>
                        <td className="py-1 pl-3 text-right">
                          {formatPct(b.rendementBrut)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Analyse narrative */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                  Analyse détaillée
                </p>
                {renderMultiline(resultTexte)}
              </div>

              <p className="mt-1 text-[0.7rem] text-slate-500">
                Cette analyse est fournie à titre indicatif, sans prise en compte
                de la fiscalité détaillée ni de la revalorisation future des loyers,
                des charges ou des valeurs de marché.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Renseignez vos biens dans la section ci-dessus puis lancez le
              calcul pour obtenir une vue consolidée et des graphiques
              détaillés.
            </p>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Analyses
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
