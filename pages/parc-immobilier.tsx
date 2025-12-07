// pages/parc-immobilier.tsx
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
} from "chart.js";

ChartJS.register(Tooltip, Legend, CategoryScale, LinearScale, BarElement, ArcElement);

const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), {
  ssr: false,
});

const Doughnut = dynamic(
  () => import("react-chartjs-2").then((m) => m.Doughnut),
  { ssr: false }
);

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
  valeur: number;
  loyersAnnuels: number;
  chargesCopro: number;
  taxeFonc: number;
  assurance: number;
  autresCharges: number;
  mensualiteCredit: number;
};

type BienResult = {
  nom: string;
  revenus: number;
  chargesHorsCredit: number;
  annuiteCredit: number;
  resultatNetAnnuel: number;
  cashflowMensuel: number;
  rendementBrut: number;
  rendementNet: number;
};

type SyntheseParc = {
  nbBiens: number;
  valeurTotale: number;
  revenusTotaux: number;
  resultatNetTotal: number;
  cashflowMensuelTotal: number;
  rendementBrutMoyen: number;
  rendementNetMoyen: number;
};

function InfoBadge({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1 align-middle">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[0.6rem] font-semibold text-slate-500 cursor-help">
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[125%] z-20 hidden w-72 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-[0.7rem] text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

export default function ParcImmobilierPage() {
  const [nbBiens, setNbBiens] = useState(2);
  const [biens, setBiens] = useState<Bien[]>([
    {
      nom: "Appartement centre-ville",
      valeur: 220000,
      loyersAnnuels: 12000,
      chargesCopro: 1200,
      taxeFonc: 900,
      assurance: 200,
      autresCharges: 300,
      mensualiteCredit: 750,
    },
    {
      nom: "Maison locative périphérie",
      valeur: 280000,
      loyersAnnuels: 15600,
      chargesCopro: 0,
      taxeFonc: 1100,
      assurance: 250,
      autresCharges: 400,
      mensualiteCredit: 920,
    },
  ]);

  const [resultats, setResultats] = useState<BienResult[] | null>(null);
  const [synthese, setSynthese] = useState<SyntheseParc | null>(null);
  const [analyseTexte, setAnalyseTexte] = useState<string>("");

  const handleNbBiensChange = (value: number) => {
    const n = Math.min(Math.max(value, 1), 15);
    setNbBiens(n);

    setBiens((prev) => {
      const arr = [...prev];
      while (arr.length < n) {
        arr.push({
          nom: `Bien ${arr.length + 1}`,
          valeur: 0,
          loyersAnnuels: 0,
          chargesCopro: 0,
          taxeFonc: 0,
          assurance: 0,
          autresCharges: 0,
          mensualiteCredit: 0,
        });
      }
      return arr.slice(0, n);
    });
  };

  const handleBienChange = (
    index: number,
    field: keyof Bien,
    value: number | string
  ) => {
    setBiens((prev) => {
      const arr = [...prev];
      const bien = { ...arr[index] };
      if (field === "nom") {
        bien.nom = String(value);
      } else {
        bien[field] = Number(value) || 0;
      }
      arr[index] = bien;
      return arr;
    });
  };

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCalculParc = () => {
    const res: BienResult[] = biens.slice(0, nbBiens).map((b, idx) => {
      const revenus = b.loyersAnnuels || 0;
      const chargesHorsCredit =
        (b.chargesCopro || 0) +
        (b.taxeFonc || 0) +
        (b.assurance || 0) +
        (b.autresCharges || 0);
      const annuiteCredit = (b.mensualiteCredit || 0) * 12;
      const resultatNetAnnuel = revenus - chargesHorsCredit - annuiteCredit;
      const cashflowMensuel = resultatNetAnnuel / 12;
      const valeur = b.valeur || 0;

      const rendementBrut =
        valeur > 0 ? (revenus / valeur) * 100 : Number.NaN;
      const rendementNet =
        valeur > 0
          ? ((revenus - chargesHorsCredit) / valeur) * 100
          : Number.NaN;

      return {
        nom: b.nom || `Bien ${idx + 1}`,
        revenus,
        chargesHorsCredit,
        annuiteCredit,
        resultatNetAnnuel,
        cashflowMensuel,
        rendementBrut,
        rendementNet,
      };
    });

    const nb = res.length;

    if (nb === 0) {
      setResultats(null);
      setSynthese(null);
      setAnalyseTexte(
        "Merci de renseigner au moins un bien avec une valeur et des loyers pour lancer l’analyse de votre parc immobilier."
      );
      return;
    }

    const valeurTotale = biens
      .slice(0, nbBiens)
      .reduce((sum, b) => sum + (b.valeur || 0), 0);
    const revenusTotaux = res.reduce((sum, b) => sum + b.revenus, 0);
    const resultatNetTotal = res.reduce(
      (sum, b) => sum + b.resultatNetAnnuel,
      0
    );
    const cashflowMensuelTotal = resultatNetTotal / 12;

    const moyenne = (arr: number[]) =>
      arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : Number.NaN;

    const rendementBrutMoyen = moyenne(
      res.map((b) => (Number.isNaN(b.rendementBrut) ? 0 : b.rendementBrut))
    );
    const rendementNetMoyen = moyenne(
      res.map((b) => (Number.isNaN(b.rendementNet) ? 0 : b.rendementNet))
    );

    const synth: SyntheseParc = {
      nbBiens: nb,
      valeurTotale,
      revenusTotaux,
      resultatNetTotal,
      cashflowMensuelTotal,
      rendementBrutMoyen,
      rendementNetMoyen,
    };

    setResultats(res);
    setSynthese(synth);

    // Analyse textuelle
    const bienTop = res.reduce((best, b) =>
      !best || b.rendementNet > best.rendementNet ? b : best
    , res[0]);

    const bienPire = res.reduce((worst, b) =>
      !worst || b.cashflowMensuel < worst.cashflowMensuel ? b : worst
    , res[0]);

    const texte = [
      `Votre parc immobilier analysé comprend ${nb} bien(s) pour une valeur totale estimée à ${formatEuro(
        valeurTotale
      )}. Les loyers bruts cumulés représentent environ ${formatEuro(
        revenusTotaux
      )} par an.`,
      `Une fois les charges d’exploitation (copropriété, taxe foncière, assurances, autres charges) et les mensualités de crédit intégrées, le résultat net global ressort à ${formatEuro(
        resultatNetTotal
      )} par an, soit un cash-flow consolidé proche de ${formatEuro(
        cashflowMensuelTotal
      )} par mois.`,
      `En moyenne, le rendement brut de votre parc se situe autour de ${formatPct(
        rendementBrutMoyen
      )}, et le rendement net avant fiscalité autour de ${formatPct(
        rendementNetMoyen
      )}. Ces ordres de grandeur permettent de vous situer par rapport à vos objectifs (sécurité patrimoniale, complément de revenu, optimisation du levier crédit).`,
      bienTop
        ? `Le bien le plus performant en rendement net est « ${
            bienTop.nom
          } » avec un rendement net estimé à ${formatPct(
            bienTop.rendementNet
          )} et un cash-flow annuel de ${formatEuro(
            bienTop.resultatNetAnnuel
          )}. Ce type de profil constitue un pilier solide de votre parc et peut servir de référence pour vos prochains investissements.`
        : "",
      bienPire
        ? `À l’inverse, le bien le plus sensible en trésorerie est « ${
            bienPire.nom
          } », avec un cash-flow annuel d’environ ${formatEuro(
            bienPire.resultatNetAnnuel
          )}. Ce résultat ne signifie pas forcément que le bien est “mauvais”, mais qu’il mérite une attention particulière. Des pistes possibles : renégocier le crédit, revoir le loyer en fonction du marché, envisager des travaux de valorisation, ou à terme arbitrer cet actif si votre stratégie globale le justifie.`
        : "",
      `La vocation de cette analyse est de faire ressortir, en un coup d’œil, les biens qui tirent la performance vers le haut et ceux qui pèsent davantage sur votre trésorerie. C’est une base de travail précieuse pour vos rendez-vous avec un banquier ou un conseiller en gestion de patrimoine.`,
    ]
      .filter(Boolean)
      .join("\n");

    setAnalyseTexte(texte);
  };

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, idx) => (
      <p key={idx} className="text-sm text-slate-800 leading-relaxed mb-1.5">
        {line}
      </p>
    ));

  // Graphiques
  let barData: any = null;
  let doughnutData: any = null;

  if (resultats && resultats.length > 0) {
    const labels = resultats.map((b, idx) => b.nom || `Bien ${idx + 1}`);

    const revenus = resultats.map((b) => b.revenus);
    const chargesTotales = resultats.map(
      (b) => b.chargesHorsCredit + b.annuiteCredit
    );
    const resultNet = resultats.map((b) => b.resultatNetAnnuel);

    barData = {
      labels,
      datasets: [
        {
          label: "Loyers annuels bruts",
          data: revenus,
          backgroundColor: "rgba(34, 197, 94, 0.8)",
        },
        {
          label: "Charges + crédit (annuels)",
          data: chargesTotales,
          backgroundColor: "rgba(56, 189, 248, 0.8)",
        },
        {
          label: "Résultat net annuel",
          data: resultNet,
          backgroundColor: "rgba(15, 23, 42, 0.9)",
        },
      ],
    };

    const baseCF = resultats.map((b) =>
      b.resultatNetAnnuel > 0 ? b.resultatNetAnnuel : 0
    );
    const allZero = baseCF.every((v) => v === 0);
    const doughnutValues = allZero ? revenus : baseCF;

    doughnutData = {
      labels,
      datasets: [
        {
          label: "Contribution au résultat global",
          data: doughnutValues,
          backgroundColor: [
            "#0f172a",
            "#1d4ed8",
            "#0369a1",
            "#16a34a",
            "#f97316",
            "#a855f7",
            "#ef4444",
            "#22c55e",
            "#14b8a6",
            "#eab308",
          ],
        },
      ],
    };
  }

  const hasSimulation = !!resultats && !!synthese;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Analyse de la rentabilité de votre parc immobilier existant.
            </p>
          </div>
          <div className="text-xs text-slate-500 sm:text-right">
            <p>Outil indicatif, hors fiscalité.</p>
            <Link href="/" className="underline">
              &larr; Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Configuration du parc */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          <div>
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-indigo-600 mb-1">
              Paramétrage
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              Décrivez vos biens locatifs existants
            </h2>
            <p className="text-xs text-slate-500">
              Saisissez, pour chaque bien, sa valeur, ses loyers, ses charges
              et sa mensualité de crédit actuelle. L’outil consolide ensuite la
              rentabilité globale de votre parc.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-700 flex items-center">
                Nombre de biens locatifs à analyser
                <InfoBadge text="Limité volontairement à 15 biens pour garder un écran lisible. Pour un patrimoine plus vaste, il est possible de travailler par sous-ensembles (ville, typologie, etc.)." />
              </label>
              <input
                type="number"
                min={1}
                max={15}
                value={nbBiens}
                onChange={(e) =>
                  handleNbBiensChange(parseInt(e.target.value, 10) || 1)
                }
                className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-3">
              {Array.from({ length: nbBiens }).map((_, idx) => {
                const b = biens[idx] || biens[0];
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.7rem] font-semibold text-slate-700 uppercase tracking-[0.16em]">
                        Bien #{idx + 1}
                      </p>
                      <input
                        type="text"
                        value={b.nom}
                        onChange={(e) =>
                          handleBienChange(idx, "nom", e.target.value)
                        }
                        placeholder="Nom du bien (facultatif)"
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Valeur estimée (€)
                        </label>
                        <input
                          type="number"
                          value={b.valeur}
                          onChange={(e) =>
                            handleBienChange(
                              idx,
                              "valeur",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Loyers annuels bruts (€)
                        </label>
                        <input
                          type="number"
                          value={b.loyersAnnuels}
                          onChange={(e) =>
                            handleBienChange(
                              idx,
                              "loyersAnnuels",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Mensualité de crédit (€)
                        </label>
                        <input
                          type="number"
                          value={b.mensualiteCredit}
                          onChange={(e) =>
                            handleBienChange(
                              idx,
                              "mensualiteCredit",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Charges copro (€/an)
                        </label>
                        <input
                          type="number"
                          value={b.chargesCopro}
                          onChange={(e) =>
                            handleBienChange(
                              idx,
                              "chargesCopro",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Taxe foncière (€/an)
                        </label>
                        <input
                          type="number"
                          value={b.taxeFonc}
                          onChange={(e) =>
                            handleBienChange(
                              idx,
                              "taxeFonc",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Assurance (€/an)
                        </label>
                        <input
                          type="number"
                          value={b.assurance}
                          onChange={(e) =>
                            handleBienChange(
                              idx,
                              "assurance",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Autres charges (€/an)
                        </label>
                        <input
                          type="number"
                          value={b.autresCharges}
                          onChange={(e) =>
                            handleBienChange(
                              idx,
                              "autresCharges",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                Renseignez des ordres de grandeur cohérents sur chaque bien,
                puis lancez le calcul global de votre parc.
              </p>
              <button
                onClick={handleCalculParc}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-400/40 hover:shadow-2xl hover:shadow-indigo-400/60 transition-transform active:scale-[0.99]"
              >
                Calculer la rentabilité du parc
              </button>
            </div>
          </div>
        </section>

        {/* Résultats & graphiques */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-indigo-600 mb-1">
                Résultats
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Synthèse & visualisation de votre parc
              </h2>
              <p className="text-xs text-slate-500">
                Vue consolidée des rendements, du cash-flow et de la contribution
                de chaque bien.
              </p>
            </div>
            {hasSimulation && (
              <button
                onClick={handlePrintPDF}
                className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300 transition-colors"
              >
                PDF
              </button>
            )}
          </div>

          {hasSimulation ? (
            <>
              {/* Cartes synthèse globale */}
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Nombre de biens
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {synthese!.nbBiens}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Valeur totale estimée
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(synthese!.valeurTotale)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Cash-flow global mensuel
                  </p>
                  <p
                    className={
                      "mt-1 text-sm font-semibold " +
                      (synthese!.cashflowMensuelTotal >= 0
                        ? "text-emerald-700"
                        : "text-red-600")
                    }
                  >
                    {formatEuro(synthese!.cashflowMensuelTotal)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Rendement net moyen
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(synthese!.rendementNetMoyen)}
                  </p>
                </div>
              </div>

              {/* Graphiques */}
              <div className="grid gap-4 lg:grid-cols-2 mt-2">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-600 mb-2">
                    Comparaison loyers / charges / résultat net par bien.
                  </p>
                  {barData && (
                    <Bar
                      data={barData}
                      options={{
                        plugins: {
                          legend: {
                            labels: {
                              color: "#0f172a",
                              font: { size: 10 },
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
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-600 mb-2">
                    Contribution de chaque bien au résultat global (ou, à
                    défaut, aux loyers bruts).
                  </p>
                  {doughnutData && (
                    <Doughnut
                      data={doughnutData}
                      options={{
                        plugins: {
                          legend: {
                            position: "bottom",
                            labels: {
                              color: "#0f172a",
                              font: { size: 10 },
                            },
                          },
                        },
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Détail par bien */}
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                  Détail par bien
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[0.7rem]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100">
                        <th className="px-2 py-1 text-left font-semibold text-slate-700">
                          Bien
                        </th>
                        <th className="px-2 py-1 text-right font-semibold text-slate-700">
                          Loyers annuels
                        </th>
                        <th className="px-2 py-1 text-right font-semibold text-slate-700">
                          Charges + crédit
                        </th>
                        <th className="px-2 py-1 text-right font-semibold text-slate-700">
                          Résultat net annuel
                        </th>
                        <th className="px-2 py-1 text-right font-semibold text-slate-700">
                          Cash-flow mensuel
                        </th>
                        <th className="px-2 py-1 text-right font-semibold text-slate-700">
                          Rendement brut
                        </th>
                        <th className="px-2 py-1 text-right font-semibold text-slate-700">
                          Rendement net
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultats!.map((b, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-2 py-1 text-slate-800">
                            {b.nom || `Bien ${idx + 1}`}
                          </td>
                          <td className="px-2 py-1 text-right text-slate-800">
                            {formatEuro(b.revenus)}
                          </td>
                          <td className="px-2 py-1 text-right text-slate-800">
                            {formatEuro(
                              b.chargesHorsCredit + b.annuiteCredit
                            )}
                          </td>
                          <td
                            className={
                              "px-2 py-1 text-right " +
                              (b.resultatNetAnnuel >= 0
                                ? "text-emerald-700"
                                : "text-red-600")
                            }
                          >
                            {formatEuro(b.resultatNetAnnuel)}
                          </td>
                          <td
                            className={
                              "px-2 py-1 text-right " +
                              (b.cashflowMensuel >= 0
                                ? "text-emerald-700"
                                : "text-red-600")
                            }
                          >
                            {formatEuro(b.cashflowMensuel)}
                          </td>
                          <td className="px-2 py-1 text-right text-slate-800">
                            {formatPct(b.rendementBrut)}
                          </td>
                          <td className="px-2 py-1 text-right text-slate-800">
                            {formatPct(b.rendementNet)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Analyse narrative */}
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                  Analyse détaillée
                </p>
                {renderMultiline(analyseTexte)}
                <p className="mt-2 text-[0.7rem] text-slate-500">
                  Ces résultats restent indicatifs et ne prennent pas en compte
                  la fiscalité, ni la revalorisation potentielle des biens, ni
                  les travaux futurs. Ils constituent néanmoins un support
                  structuré pour vos réflexions et vos échanges avec les
                  partenaires financiers.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Renseignez vos biens dans le bloc ci-dessus, puis cliquez sur
              « Calculer la rentabilité du parc » pour afficher les indicateurs
              et les graphiques.
            </p>
          )}
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
