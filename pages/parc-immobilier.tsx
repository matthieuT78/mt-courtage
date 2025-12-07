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

ChartJS.register(
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement
);

const Bar = dynamic(
  () => import("react-chartjs-2").then((m) => m.Bar),
  { ssr: false }
);

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

type BienResultat = {
  nom: string;
  valeurBien: number;
  loyersAnnuels: number;
  chargesAnnuelles: number;
  fraisGestion: number;
  chargesTotales: number;
  annuiteCredit: number;
  resultatNetAnnuel: number;
  cashflowMensuel: number;
  rendementBrut: number;
  rendementNetAvantCredit: number;
  capitalRestantDu: number;
  ratioCRD: number;
};

type ParcResultatGlobal = {
  nbBiens: number;
  valeurTotale: number;
  crdTotal: number;
  loyersAnnuelsTotaux: number;
  chargesTotalesParc: number;
  annuiteCreditsParc: number;
  resultatNetAnnuelParc: number;
  cashflowMensuelParc: number;
  rendementBrutMoyen: number;
  rendementNetMoyen: number;
};

export default function ParcImmobilierPage() {
  const [nbBiens, setNbBiens] = useState(2);
  const [nomsBiens, setNomsBiens] = useState<string[]>([
    "Appartement A",
    "Appartement B",
  ]);
  const [valeursBiens, setValeursBiens] = useState<number[]>([
    220000,
    180000,
  ]);
  const [loyersMensuels, setLoyersMensuels] = useState<number[]>([950, 820]);
  const [chargesAnnuelles, setChargesAnnuelles] = useState<number[]>([
    2500,
    2200,
  ]); // copro + TF + assurance
  const [tauxGestionBiens, setTauxGestionBiens] = useState<number[]>([8, 8]);
  const [mensualitesCredits, setMensualitesCredits] = useState<number[]>([
    650,
    520,
  ]); // crédit + assurance
  const [crdBiens, setCrdBiens] = useState<number[]>([150000, 120000]);

  const [resultatsBiens, setResultatsBiens] = useState<BienResultat[] | null>(
    null
  );
  const [resultatsGlobaux, setResultatsGlobaux] =
    useState<ParcResultatGlobal | null>(null);
  const [analyseTexte, setAnalyseTexte] = useState<string>("");

  const hasSimulation = !!resultatsBiens && !!resultatsGlobaux;

  const handleNbBiensChange = (value: number) => {
    const n = Math.min(Math.max(value, 1), 10);
    setNbBiens(n);

    setNomsBiens((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(`Bien ${arr.length + 1}`);
      return arr.slice(0, n);
    });

    setValeursBiens((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(0);
      return arr.slice(0, n);
    });

    setLoyersMensuels((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(0);
      return arr.slice(0, n);
    });

    setChargesAnnuelles((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(0);
      return arr.slice(0, n);
    });

    setTauxGestionBiens((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(8);
      return arr.slice(0, n);
    });

    setMensualitesCredits((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(0);
      return arr.slice(0, n);
    });

    setCrdBiens((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(0);
      return arr.slice(0, n);
    });
  };

  const updateAt = (
    index: number,
    value: number | string,
    setter: (updater: (prev: any[]) => any[]) => void
  ) => {
    setter((prev) => {
      const arr = [...prev];
      // @ts-ignore
      arr[index] = value;
      return arr;
    });
  };

  const handleAnalyseParc = () => {
    const biens: BienResultat[] = [];

    for (let i = 0; i < nbBiens; i++) {
      const nom = (nomsBiens[i] || `Bien ${i + 1}`).trim() || `Bien ${i + 1}`;
      const valeur = valeursBiens[i] || 0;
      const loyerMensuel = loyersMensuels[i] || 0;
      const chargesAnn = chargesAnnuelles[i] || 0;
      const tauxGestion = (tauxGestionBiens[i] || 0) / 100;
      const mensualiteCredit = mensualitesCredits[i] || 0;
      const crd = crdBiens[i] || 0;

      const loyersAnnuels = loyerMensuel * 12;
      const fraisGestion = loyersAnnuels * tauxGestion;
      const chargesTotales = chargesAnn + fraisGestion;
      const annuiteCredit = mensualiteCredit * 12;
      const resultatNetAnnuel = loyersAnnuels - chargesTotales - annuiteCredit;
      const cashflowMensuel = resultatNetAnnuel / 12;

      const rendementBrut =
        valeur > 0 ? (loyersAnnuels / valeur) * 100 : NaN;
      const rendementNetAvantCredit =
        valeur > 0
          ? ((loyersAnnuels - chargesTotales) / valeur) * 100
          : NaN;
      const ratioCRD = valeur > 0 ? (crd / valeur) * 100 : NaN;

      biens.push({
        nom,
        valeurBien: valeur,
        loyersAnnuels,
        chargesAnnuelles: chargesAnn,
        fraisGestion,
        chargesTotales,
        annuiteCredit,
        resultatNetAnnuel,
        cashflowMensuel,
        rendementBrut,
        rendementNetAvantCredit,
        capitalRestantDu: crd,
        ratioCRD,
      });
    }

    if (biens.length === 0) {
      setResultatsBiens(null);
      setResultatsGlobaux(null);
      setAnalyseTexte(
        "Merci de renseigner au moins un bien avec un loyer et une valeur de marché."
      );
      return;
    }

    const valeurTotale = biens.reduce(
      (sum, b) => sum + (b.valeurBien || 0),
      0
    );
    const crdTotal = biens.reduce(
      (sum, b) => sum + (b.capitalRestantDu || 0),
      0
    );
    const loyersAnnTot = biens.reduce(
      (sum, b) => sum + (b.loyersAnnuels || 0),
      0
    );
    const chargesTotParc = biens.reduce(
      (sum, b) => sum + (b.chargesTotales || 0),
      0
    );
    const annuiteCreditsParc = biens.reduce(
      (sum, b) => sum + (b.annuiteCredit || 0),
      0
    );
    const resultatNetAnnParc = biens.reduce(
      (sum, b) => sum + (b.resultatNetAnnuel || 0),
      0
    );
    const cashflowMensuelParc = resultatNetAnnParc / 12;

    const rendBrutMoyen =
      biens.length > 0
        ? biens.reduce((sum, b) => sum + (b.rendementBrut || 0), 0) /
          biens.length
        : NaN;

    const rendNetMoyen =
      biens.length > 0
        ? biens.reduce(
            (sum, b) => sum + (b.rendementNetAvantCredit || 0),
            0
          ) / biens.length
        : NaN;

    const globaux: ParcResultatGlobal = {
      nbBiens,
      valeurTotale,
      crdTotal,
      loyersAnnuelsTotaux: loyersAnnTot,
      chargesTotalesParc: chargesTotParc,
      annuiteCreditsParc,
      resultatNetAnnuelParc: resultatNetAnnParc,
      cashflowMensuelParc,
      rendementBrutMoyen: rendBrutMoyen,
      rendementNetMoyen: rendNetMoyen,
    };

    setResultatsBiens(biens);
    setResultatsGlobaux(globaux);

    // Analyse narrative
    const bienMeilleur = biens.reduce((best, b) => {
      if (!best) return b;
      return (b.rendementNetAvantCredit || -Infinity) >
        (best.rendementNetAvantCredit || -Infinity)
        ? b
        : best;
    }, biens[0] as BienResultat | undefined);

    const bienPire = biens.reduce((worst, b) => {
      if (!worst) return b;
      return (b.rendementNetAvantCredit || Infinity) <
        (worst.rendementNetAvantCredit || Infinity)
        ? b
        : worst;
    }, biens[0] as BienResultat | undefined);

    const texte = [
      `Structure de votre parc: vous disposez de ${nbBiens} bien(s) pour une valeur de marché globale estimée à ${formatEuro(
        valeurTotale
      )}. Le capital restant dû sur l’ensemble des crédits s’élève à ${formatEuro(
        crdTotal
      )}, soit un ratio d’endettement sur valeur du parc d’environ ${formatPct(
        valeurTotale > 0 ? (crdTotal / valeurTotale) * 100 : NaN
      )}.`,
      `Revenus et charges globales: vos loyers bruts annuels atteignent ${formatEuro(
        loyersAnnTot
      )}. Après prise en compte des charges récurrentes (copropriété, taxe foncière, assurance, gestion), soit ${formatEuro(
        chargesTotParc
      )} par an, et des échéances de crédit (${formatEuro(
        annuiteCreditsParc
      )} par an), le résultat net de votre parc ressort à ${formatEuro(
        resultatNetAnnParc
      )} par an, soit un cash-flow global d’environ ${formatEuro(
        cashflowMensuelParc
      )} par mois.`,
      `Rendements moyens: le rendement brut moyen de votre parc se situe autour de ${formatPct(
        rendBrutMoyen
      )}, tandis que le rendement net avant crédit tourne autour de ${formatPct(
        rendNetMoyen
      )}. Ces ordres de grandeur donnent une vision d’ensemble de la performance de vos actifs par rapport au marché et à votre niveau de risque.`,
      bienMeilleur && bienPire
        ? `Biens à suivre de près: le bien le plus performant en termes de rendement net avant crédit est « ${
            bienMeilleur.nom
          } », avec un rendement net d’environ ${formatPct(
            bienMeilleur.rendementNetAvantCredit
          )} et un cash-flow annuel de ${formatEuro(
            bienMeilleur.resultatNetAnnuel
          )}. À l’inverse, le bien le plus fragile semble être « ${
            bienPire.nom
          } », dont le rendement net est proche de ${formatPct(
            bienPire.rendementNetAvantCredit
          )} et le cash-flow annuel de ${formatEuro(
            bienPire.resultatNetAnnuel
          )}. Ce contraste peut guider vos arbitrages: renégociation de crédit, travaux pour repositionner le bien, révision du loyer ou, à terme, arbitrage de vente.`,
      `Lecture stratégique: si le cash-flow global est positif, votre parc contribue à dégager un revenu complémentaire tout en se remboursant au fil du temps. Si le cash-flow est légèrement négatif, cela peut rester acceptable si la valorisation à long terme et la qualité des emplacements compensent cet effort d’épargne. L’objectif de cette analyse est de mettre en évidence les biens qui tirent la performance vers le haut, ceux qui la pénalisent, et de vous donner des éléments concrets à présenter à votre banquier ou à votre conseiller en gestion de patrimoine.`,
    ].join("\n");

    setAnalyseTexte(texte);
  };

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, idx) => {
      const [label, ...rest] = line.split(":");
      const hasLabel = rest.length > 0;
      const content = rest.join(":").trim();

      return (
        <div key={idx} className="mb-2">
          {hasLabel ? (
            <p className="text-sm text-slate-800 leading-relaxed">
              <span className="font-semibold text-slate-900">
                {label.trim()}
                {": "}
              </span>
              {content}
            </p>
          ) : (
            <p className="text-sm text-slate-800 leading-relaxed">{line}</p>
          )}
        </div>
      );
    });

  // Préparation des graphiques
  let cashflowBarData;
  let valeurDonutData;

  if (hasSimulation && resultatsBiens && resultatsGlobaux) {
    const labels = resultatsBiens.map((b) => b.nom);
    const cashflows = resultatsBiens.map((b) => b.resultatNetAnnuel);
    const valeurs = resultatsBiens.map((b) => b.valeurBien);

    cashflowBarData = {
      labels,
      datasets: [
        {
          label: "Cash-flow net annuel (€)",
          data: cashflows,
          backgroundColor: cashflows.map((v) =>
            v >= 0 ? "#22c55e" : "#ef4444"
          ),
        },
      ],
    };

    valeurDonutData = {
      labels,
      datasets: [
        {
          label: "Répartition de la valeur du parc",
          data: valeurs,
          backgroundColor: [
            "#0f766e",
            "#1d4ed8",
            "#f97316",
            "#22c55e",
            "#e11d48",
            "#7c3aed",
            "#0369a1",
            "#d97706",
            "#16a34a",
            "#334155",
          ],
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
              Analyse de rentabilité de votre parc immobilier existant.
            </p>
          </div>
          <div className="text-xs text-slate-500 sm:text-right">
            <p>Outil indicatif, hors fiscalité détaillée.</p>
            <Link href="/" className="underline">
              &larr; Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-4">
        <section>
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
            Outil patrimoine
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Mesurez la performance de votre parc existant
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-3xl">
            Renseignez vos biens locatifs (valeur, loyers, charges, crédits) et
            obtenez une vue d&apos;ensemble : cash-flow global, rendements moyens,
            biens les plus performants… avec des graphiques exploitables en rendez-vous
            bancaire.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 items-start">
          {/* Colonne gauche : saisie des biens */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Étape 1
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Configuration des biens
                </h3>
                <p className="text-xs text-slate-500">
                  Indiquez le nombre de biens locatifs et leurs paramètres
                  principaux.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Nombre de biens locatifs
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={nbBiens}
                  onChange={(e) =>
                    handleNbBiensChange(parseInt(e.target.value, 10) || 1)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Étape 2
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Détails par bien
                </h3>
                <p className="text-xs text-slate-500">
                  Valeur de marché, loyers, charges, crédit et capital restant dû
                  pour chaque bien.
                </p>
              </div>

              {Array.from({ length: nbBiens }).map((_, idx) => (
                <div
                  key={idx}
                  className="mt-3 border-t border-slate-200 pt-3 first:border-none first:pt-0"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <input
                      type="text"
                      value={nomsBiens[idx] || ""}
                      onChange={(e) =>
                        updateAt(idx, e.target.value, setNomsBiens)
                      }
                      placeholder={`Bien ${idx + 1} (ex. T2 centre-ville)`}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[0.7rem] text-slate-400">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700 flex items-center">
                        Valeur de marché estimée (€)
                        <InfoBadge text="Valeur actuelle approximative du bien (prix de revente probable). Sert de base au calcul des rendements." />
                      </label>
                      <input
                        type="number"
                        value={valeursBiens[idx] || 0}
                        onChange={(e) =>
                          updateAt(
                            idx,
                            parseFloat(e.target.value) || 0,
                            setValeursBiens
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">
                        Loyer mensuel hors charges (€)
                      </label>
                      <input
                        type="number"
                        value={loyersMensuels[idx] || 0}
                        onChange={(e) =>
                          updateAt(
                            idx,
                            parseFloat(e.target.value) || 0,
                            setLoyersMensuels
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 mt-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700 flex items-center">
                        Charges annuelles (€)
                        <InfoBadge text="Copropriété, taxe foncière, assurance PNO / habitation et charges non récupérables." />
                      </label>
                      <input
                        type="number"
                        value={chargesAnnuelles[idx] || 0}
                        onChange={(e) =>
                          updateAt(
                            idx,
                            parseFloat(e.target.value) || 0,
                            setChargesAnnuelles
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700 flex items-center">
                        Frais de gestion / agence (% loyers)
                        <InfoBadge text="Honoraires d’agence ou de gestion locative. Sur la location saisonnière, cela correspondrait aux frais de conciergerie." />
                      </label>
                      <input
                        type="number"
                        value={tauxGestionBiens[idx] || 0}
                        onChange={(e) =>
                          updateAt(
                            idx,
                            parseFloat(e.target.value) || 0,
                            setTauxGestionBiens
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 mt-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">
                        Mensualité crédit (crédit + assurance) (€ / mois)
                      </label>
                      <input
                        type="number"
                        value={mensualitesCredits[idx] || 0}
                        onChange={(e) =>
                          updateAt(
                            idx,
                            parseFloat(e.target.value) || 0,
                            setMensualitesCredits
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700 flex items-center">
                        Capital restant dû (€)
                        <InfoBadge text="Capital restant à rembourser sur le crédit lié à ce bien. Permet de mesurer l’effet de levier et le ratio dette / valeur." />
                      </label>
                      <input
                        type="number"
                        value={crdBiens[idx] || 0}
                        onChange={(e) =>
                          updateAt(
                            idx,
                            parseFloat(e.target.value) || 0,
                            setCrdBiens
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  onClick={handleAnalyseParc}
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-400/40 hover:shadow-2xl hover:shadow-emerald-400/60 transition-transform active:scale-[0.99]"
                >
                  Calculer l&apos;analyse de mon parc
                </button>
                <p className="text-xs text-slate-500">
                  L&apos;analyse agrège l&apos;ensemble des biens et met en
                  évidence cash-flow, rendements et répartition de la valeur.
                </p>
              </div>
            </section>
          </div>

          {/* Colonne droite : résultats & graphiques */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-600 mb-1">
                    Synthèse du parc
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Résultats globaux
                  </h3>
                  <p className="text-xs text-slate-500">
                    Vue consolidée des revenus, charges, crédits et cash-flow
                    de votre patrimoine locatif.
                  </p>
                </div>
              </div>

              {hasSimulation && resultatsGlobaux && resultatsBiens ? (
                <>
                  {/* Cartes principales */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Valeur totale du parc
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatEuro(resultatsGlobaux.valeurTotale)}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-slate-500">
                        Capital restant dû :{" "}
                        {formatEuro(resultatsGlobaux.crdTotal)}.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Cash-flow global mensuel
                      </p>
                      <p
                        className={
                          "mt-1 text-sm font-semibold " +
                          (resultatsGlobaux.cashflowMensuelParc >= 0
                            ? "text-emerald-700"
                            : "text-red-600")
                        }
                      >
                        {formatEuro(resultatsGlobaux.cashflowMensuelParc)}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-slate-500">
                        Résultat net annuel :{" "}
                        {formatEuro(resultatsGlobaux.resultatNetAnnuelParc)}.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Rendement brut moyen
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatPct(resultatsGlobaux.rendementBrutMoyen)}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-slate-500">
                        Calculé sur la valeur de marché de vos biens.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Rendement net moyen (avant crédit)
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatPct(resultatsGlobaux.rendementNetMoyen)}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-slate-500">
                        Après charges d&apos;exploitation, hors financement.
                      </p>
                    </div>
                  </div>

                  {/* Graphiques */}
                  <div className="grid gap-4 lg:grid-cols-2 mt-2">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-xs text-slate-600 mb-2">
                        Cash-flow net annuel par bien : repérez en un coup d&apos;œil
                        les biens qui tirent la performance vers le haut ou vers le bas.
                      </p>
                      {cashflowBarData && (
                        <Bar
                          data={cashflowBarData}
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
                                ticks: {
                                  color: "#0f172a",
                                  font: { size: 9 },
                                },
                                grid: { color: "#e5e7eb" },
                              },
                              y: {
                                ticks: {
                                  color: "#0f172a",
                                  font: { size: 10 },
                                },
                                grid: { color: "#e5e7eb" },
                              },
                            },
                          }}
                        />
                      )}
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-xs text-slate-600 mb-2">
                        Répartition de la valeur de votre parc entre les différents
                        biens.
                      </p>
                      {valeurDonutData && (
                        <Doughnut
                          data={valeurDonutData}
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

                  {/* Analyse détaillée */}
                  <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-3">
                      Analyse détaillée de votre parc
                    </p>
                    {renderMultiline(analyseTexte)}
                    <p className="mt-2 text-[0.7rem] text-slate-500">
                      Cette analyse ne prend pas en compte la fiscalité (régime réel,
                      micro-foncier, LMNP, etc.) ni les éventuelles revalorisations
                      futures des loyers et du marché. Elle fournit néanmoins une base
                      solide pour engager une réflexion stratégique et préparer vos
                      rendez-vous bancaires.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Renseignez vos biens (valeur, loyers, charges, crédit) puis cliquez
                  sur{" "}
                  <span className="font-semibold">
                    “Calculer l&apos;analyse de mon parc”
                  </span>{" "}
                  pour afficher les indicateurs et graphiques de performance.
                </p>
              )}
            </section>
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
