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
} from "chart.js";

ChartJS.register(Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const Bar = dynamic(
  () => import("react-chartjs-2").then((m) => m.Bar),
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

type BienResult = {
  index: number;
  valeurRef: number;
  revenuBrutAnnuel: number;
  chargesAnnuelles: number;
  creditAnnuel: number;
  rendementBrut: number;
  rendementNetAvant: number;
  rendementNetApres: number;
  cashflowAnnuel: number;
  cashflowMensuel: number;
};

type ResultParc = {
  parBien: BienResult[];
  totalValeur: number;
  totalLoyers: number;
  totalCharges: number;
  totalCredit: number;
  totalCashflowAnnuel: number;
  totalCashflowMensuel: number;
  rendementBrutGlobal: number;
  rendementNetAvantGlobal: number;
  rendementNetApresGlobal: number;
};

export default function ParcImmobilierPage() {
  const [nbBiens, setNbBiens] = useState(2);

  const [valeursRef, setValeursRef] = useState<number[]>([200000, 150000]);
  const [loyersMensuels, setLoyersMensuels] = useState<number[]>([900, 750]);
  const [chargesAnnuelles, setChargesAnnuelles] = useState<number[]>([3500, 2800]); // copro+taxe+PNO+gestion
  const [mensualitesCredit, setMensualitesCredit] = useState<number[]>([650, 520]);

  const [resultParc, setResultParc] = useState<ResultParc | null>(null);
  const [texteAnalyse, setTexteAnalyse] = useState<string>("");

  const hasResult = resultParc !== null;

  const handleNbBiensChange = (value: number) => {
    const n = Math.min(Math.max(value, 1), 20);
    setNbBiens(n);

    const resize = (arr: number[], def: number) => {
      const copy = [...arr];
      while (copy.length < n) copy.push(def);
      return copy.slice(0, n);
    };

    setValeursRef((prev) => resize(prev, 0));
    setLoyersMensuels((prev) => resize(prev, 0));
    setChargesAnnuelles((prev) => resize(prev, 0));
    setMensualitesCredit((prev) => resize(prev, 0));
  };

  const handleValeurChange = (index: number, value: number) => {
    setValeursRef((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleLoyerChange = (index: number, value: number) => {
    setLoyersMensuels((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleChargesAnnChange = (index: number, value: number) => {
    setChargesAnnuelles((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleMensualiteCreditChange = (index: number, value: number) => {
    setMensualitesCredit((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCalculParc = () => {
    const parBien: BienResult[] = [];

    for (let i = 0; i < nbBiens; i++) {
      const valeur = valeursRef[i] || 0;
      const loyerMensuel = loyersMensuels[i] || 0;
      const chAnn = chargesAnnuelles[i] || 0;
      const mensCred = mensualitesCredit[i] || 0;

      const revenuBrutAnnuel = loyerMensuel * 12;
      const creditAnnuel = mensCred * 12;

      let rendementBrut = 0;
      let rendementNetAvant = 0;
      let rendementNetApres = 0;
      let cashflowAnnuel = 0;
      let cashflowMensuel = 0;

      if (valeur > 0) {
        rendementBrut = (revenuBrutAnnuel / valeur) * 100;
        rendementNetAvant = ((revenuBrutAnnuel - chAnn) / valeur) * 100;
        cashflowAnnuel = revenuBrutAnnuel - chAnn - creditAnnuel;
        rendementNetApres = (cashflowAnnuel / valeur) * 100;
        cashflowMensuel = cashflowAnnuel / 12;
      }

      parBien.push({
        index: i + 1,
        valeurRef: valeur,
        revenuBrutAnnuel,
        chargesAnnuelles: chAnn,
        creditAnnuel,
        rendementBrut,
        rendementNetAvant,
        rendementNetApres,
        cashflowAnnuel,
        cashflowMensuel,
      });
    }

    if (parBien.length === 0) {
      setResultParc(null);
      setTexteAnalyse(
        "Veuillez renseigner au moins un bien pour calculer la rentabilité de votre parc."
      );
      return;
    }

    const totalValeur = parBien.reduce((s, b) => s + b.valeurRef, 0);
    const totalLoyers = parBien.reduce((s, b) => s + b.revenuBrutAnnuel, 0);
    const totalCharges = parBien.reduce((s, b) => s + b.chargesAnnuelles, 0);
    const totalCredit = parBien.reduce((s, b) => s + b.creditAnnuel, 0);
    const totalCashflowAnnuel = parBien.reduce(
      (s, b) => s + b.cashflowAnnuel,
      0
    );
    const totalCashflowMensuel = totalCashflowAnnuel / 12;

    let rendementBrutGlobal = 0;
    let rendementNetAvantGlobal = 0;
    let rendementNetApresGlobal = 0;

    if (totalValeur > 0) {
      rendementBrutGlobal = (totalLoyers / totalValeur) * 100;
      rendementNetAvantGlobal =
        ((totalLoyers - totalCharges) / totalValeur) * 100;
      rendementNetApresGlobal =
        (totalCashflowAnnuel / totalValeur) * 100;
    }

    const res: ResultParc = {
      parBien,
      totalValeur,
      totalLoyers,
      totalCharges,
      totalCredit,
      totalCashflowAnnuel,
      totalCashflowMensuel,
      rendementBrutGlobal,
      rendementNetAvantGlobal,
      rendementNetApresGlobal,
    };

    setResultParc(res);

    const texte = [
      `Votre parc immobilier comprend actuellement ${parBien.length} bien(s), pour une valeur de référence totale (prix d'achat ou valeur actuelle estimée) d'environ ${formatEuro(
        totalValeur
      )}.`,
      `Les loyers bruts cumulés représentent environ ${formatEuro(
        totalLoyers
      )} par an, soit un rendement brut global de l'ordre de ${formatPct(
        rendementBrutGlobal
      )}.`,
      `Après prise en compte des charges récurrentes (copropriété, taxe foncière, assurance, gestion, etc.) pour un montant annuel d'environ ${formatEuro(
        totalCharges
      )}, votre rendement net avant crédit se situe autour de ${formatPct(
        rendementNetAvantGlobal
      )}.`,
      `Les mensualités de crédits associées à ces biens représentent environ ${formatEuro(
        totalCredit
      )} par an. En intégrant ces remboursements, le cash-flow global de votre parc est de ${formatEuro(
        totalCashflowAnnuel
      )} par an, soit ${formatEuro(
        totalCashflowMensuel
      )} par mois. Cela correspond à une rentabilité nette après crédit de ${formatPct(
        rendementNetApresGlobal
      )} rapportée à la valeur de référence de votre parc.`,
      totalCashflowMensuel >= 0
        ? `Votre parc est donc globalement générateur de trésorerie positive, ce qui constitue un signal rassurant pour la poursuite de vos investissements ou la préparation d'un nouveau projet locatif.`
        : `Votre parc nécessite aujourd'hui un effort de trésorerie mensuel d'environ ${formatEuro(
            -totalCashflowMensuel
          )}. Ce n'est pas forcément négatif si ces actifs se valorisent dans le temps, mais c'est un point clé à présenter et à surveiller dans votre stratégie globale (révision des loyers, renégociation de crédits, arbitrages éventuels).`,
    ].join("\n");

    setTexteAnalyse(texte);
  };

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, idx) => (
      <p key={idx} className="text-sm text-slate-800 leading-relaxed">
        {line}
      </p>
    ));

  // Graphique cashflow par bien
  let barData;
  if (resultParc) {
    barData = {
      labels: resultParc.parBien.map(
        (b) => `Bien #${b.index}`
      ),
      datasets: [
        {
          label: "Cash-flow net annuel (€)",
          data: resultParc.parBien.map((b) => b.cashflowAnnuel),
          backgroundColor: resultParc.parBien.map((b) =>
            b.cashflowAnnuel >= 0 ? "#22c55e" : "#ef4444"
          ),
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
              Calculette de rentabilité de votre parc immobilier existant.
            </p>
          </div>
          <div className="text-xs text-slate-500 sm:text-right">
            <p>Outil indicatif, basé sur les données que vous saisissez.</p>
            <Link href="/" className="underline">
              &larr; Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-4">
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Saisie Parc */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                Étape 1
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Déclarez votre parc immobilier
              </h2>
              <p className="text-xs text-slate-500">
                Indiquez, pour chaque bien, une valeur de référence, les loyers
                mensuels, les charges annuelles et la mensualité de crédit.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.75rem] font-medium text-slate-800">
                  Nombre de biens locatifs
                </p>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={nbBiens}
                  onChange={(e) =>
                    handleNbBiensChange(parseInt(e.target.value || "1", 10))
                  }
                  className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right"
                />
              </div>

              <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                {Array.from({ length: nbBiens }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2"
                  >
                    <p className="text-[0.75rem] font-medium text-slate-800">
                      Bien #{idx + 1}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                          Valeur de référence (€)
                          <InfoBadge text="Prix d'achat ou valeur actuelle estimée. L'indicateur de rentabilité sera rapporté à cette valeur." />
                        </label>
                        <input
                          type="number"
                          value={valeursRef[idx] || 0}
                          onChange={(e) =>
                            handleValeurChange(
                              idx,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Loyer mensuel actuel (€)
                        </label>
                        <input
                          type="number"
                          value={loyersMensuels[idx] || 0}
                          onChange={(e) =>
                            handleLoyerChange(
                              idx,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                          Charges annuelles (€)
                          <InfoBadge text="Copropriété, taxe foncière, assurance, gestion locative, etc. hors crédit." />
                        </label>
                        <input
                          type="number"
                          value={chargesAnnuelles[idx] || 0}
                          onChange={(e) =>
                            handleChargesAnnChange(
                              idx,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Mensualité de crédit (€)
                        </label>
                        <input
                          type="number"
                          value={mensualitesCredit[idx] || 0}
                          onChange={(e) =>
                            handleMensualiteCreditChange(
                              idx,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCalculParc}
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-400/40 hover:shadow-2xl hover:shadow-sky-400/60 transition-transform active:scale-[0.99]"
                >
                  Calculer la rentabilité de mon parc
                </button>
              </div>
            </div>
          </div>

          {/* Résultats */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Résultats
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Vue d&apos;ensemble de votre parc
                </h2>
                <p className="text-xs text-slate-500">
                  Rentabilité brute, nette et cash-flow global.
                </p>
              </div>

              {hasResult && (
                <button
                  onClick={handlePrintPDF}
                  className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300 transition-colors"
                >
                  PDF
                </button>
              )}
            </div>

            {resultParc ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3 mt-1">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Valeur totale du parc
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resultParc.totalValeur)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Loyers bruts annuels
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resultParc.totalLoyers)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Cash-flow mensuel global
                    </p>
                    <p
                      className={
                        "mt-1 text-sm font-semibold " +
                        (resultParc.totalCashflowMensuel >= 0
                          ? "text-emerald-700"
                          : "text-red-600")
                      }
                    >
                      {formatEuro(resultParc.totalCashflowMensuel)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Rendement brut global
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatPct(resultParc.rendementBrutGlobal)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Rendement net avant crédit
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatPct(resultParc.rendementNetAvantGlobal)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Rendement net après crédit
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatPct(resultParc.rendementNetApresGlobal)}
                    </p>
                  </div>
                </div>

                {/* Graph */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mt-2">
                  <p className="text-xs text-slate-600 mb-2">
                    Cash-flow net annuel par bien : identifiez les biens qui
                    tirent le parc vers le haut… ou vers le bas.
                  </p>
                  {barData && (
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
                            ticks: { color: "#0f172a", font: { size: 10 } },
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

                {/* Tableau synthétique par bien */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mt-2 overflow-x-auto">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                    Détail par bien
                  </p>
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200">
                        <th className="py-1 pr-3">Bien</th>
                        <th className="py-1 pr-3">Valeur réf.</th>
                        <th className="py-1 pr-3">Loyers annuels</th>
                        <th className="py-1 pr-3">Charges annuelles</th>
                        <th className="py-1 pr-3">Crédit annuel</th>
                        <th className="py-1 pr-3">Rdt brut</th>
                        <th className="py-1 pr-3">Net avant</th>
                        <th className="py-1 pr-3">Net après</th>
                        <th className="py-1 pr-3">CF mensuel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultParc.parBien.map((b) => (
                        <tr
                          key={b.index}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-1 pr-3 text-slate-700">
                            #{b.index}
                          </td>
                          <td className="py-1 pr-3 text-slate-800">
                            {formatEuro(b.valeurRef)}
                          </td>
                          <td className="py-1 pr-3 text-slate-800">
                            {formatEuro(b.revenuBrutAnnuel)}
                          </td>
                          <td className="py-1 pr-3 text-slate-800">
                            {formatEuro(b.chargesAnnuelles)}
                          </td>
                          <td className="py-1 pr-3 text-slate-800">
                            {formatEuro(b.creditAnnuel)}
                          </td>
                          <td className="py-1 pr-3 text-slate-800">
                            {formatPct(b.rendementBrut)}
                          </td>
                          <td className="py-1 pr-3 text-slate-800">
                            {formatPct(b.rendementNetAvant)}
                          </td>
                          <td className="py-1 pr-3 text-slate-800">
                            {formatPct(b.rendementNetApres)}
                          </td>
                          <td
                            className={
                              "py-1 pr-3 " +
                              (b.cashflowMensuel >= 0
                                ? "text-emerald-700"
                                : "text-red-600")
                            }
                          >
                            {formatEuro(b.cashflowMensuel)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Analyse narrative */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mt-2">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                    Analyse globale
                  </p>
                  {renderMultiline(texteAnalyse)}
                </div>

                <p className="mt-1 text-[0.7rem] text-slate-500">
                  Ces résultats sont indicatifs et ne tiennent pas compte de la
                  fiscalité, de la revalorisation potentielle des biens, ni
                  d&apos;éventuelles renégociations de crédits ou arbitrages de
                  patrimoine.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Renseignez votre parc à gauche puis cliquez sur
                &nbsp;
                <span className="font-semibold">
                  “Calculer la rentabilité de mon parc”
                </span>{" "}
                pour obtenir une vue consolidée de vos investissements
                immobiliers.
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
