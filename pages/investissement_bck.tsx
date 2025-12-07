// pages/investissement.tsx
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

const Bar = dynamic(
  () => import("react-chartjs-2").then((m) => m.Bar),
  { ssr: false }
);

const Line = dynamic(
  () => import("react-chartjs-2").then((m) => m.Line),
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

type ResumeRendement = {
  cashflowMensuel: number;
  resultatNetAnnuel: number;
  rendementNetAvantCredit: number;
};

type LocationType = "longue" | "airbnb";

type GraphData = {
  loyersAnnuels: number;
  chargesTotales: number;
  annuiteCredit: number;
  resultatNetAnnuel: number;
  coutTotal: number;
  mensualiteCredit: number;
  rendementBrut: number;
  rendementNetAvantCredit: number;
  dureeCredLoc: number;
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

export default function InvestissementPage() {
  // Prix / coûts
  const [prixBien, setPrixBien] = useState(200000);
  const [fraisNotaire, setFraisNotaire] = useState(Math.round(200000 * 0.075));
  const [notaireCustom, setNotaireCustom] = useState(false);
  const [travaux, setTravaux] = useState(10000);

  // Configuration des lots
  const [nbApparts, setNbApparts] = useState(1);
  const [loyersApparts, setLoyersApparts] = useState<number[]>([900]);
  const [locationTypes, setLocationTypes] = useState<LocationType[]>(["longue"]);
  const [airbnbNuitees, setAirbnbNuitees] = useState<number[]>([80]);
  const [airbnbOccupation, setAirbnbOccupation] = useState<number[]>([65]);

  // Charges
  const [chargesCopro, setChargesCopro] = useState(1200);
  const [taxeFonc, setTaxeFonc] = useState(900);
  const [assurance, setAssurance] = useState(200);
  const [tauxGestion, setTauxGestion] = useState(10);

  // Crédit
  const [apport, setApport] = useState(20000);
  const [tauxCredLoc, setTauxCredLoc] = useState(3.5);
  const [dureeCredLoc, setDureeCredLoc] = useState(25);

  // Résultats
  const [resultRendementTexte, setResultRendementTexte] = useState<string>("");
  const [resumeRendement, setResumeRendement] = useState<ResumeRendement | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  // --- Gestion des champs ---

  const handleNbAppartsChange = (value: number) => {
    const n = Math.min(Math.max(value, 1), 10);
    setNbApparts(n);

    setLoyersApparts((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(0);
      return arr.slice(0, n);
    });

    setLocationTypes((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push("longue");
      return arr.slice(0, n);
    });

    setAirbnbNuitees((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(80);
      return arr.slice(0, n);
    });

    setAirbnbOccupation((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(65);
      return arr.slice(0, n);
    });
  };

  const handleLoyerAppartChange = (index: number, value: number) => {
    setLoyersApparts((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleLocationTypeChange = (index: number, value: LocationType) => {
    setLocationTypes((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleAirbnbNuiteeChange = (index: number, value: number) => {
    setAirbnbNuitees((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleAirbnbOccupationChange = (index: number, value: number) => {
    setAirbnbOccupation((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handlePrixBienChange = (value: number) => {
    const newPrix = value || 0;
    setPrixBien(newPrix);
    if (!notaireCustom) {
      setFraisNotaire(Math.round(newPrix * 0.075));
    }
  };

  const hasAirbnb =
    nbApparts > 0 &&
    locationTypes.slice(0, nbApparts).some((t) => t === "airbnb");

  // --- Calcul principal ---

  const handleCalculRendement = () => {
    const prix = prixBien || 0;
    const notaire = fraisNotaire || 0;
    const trvx = travaux || 0;
    const copro = chargesCopro || 0;
    const tax = taxeFonc || 0;
    const assur = assurance || 0;
    const gestionPct = (tauxGestion || 0) / 100;

    const coutTotal = prix + notaire + trvx;

    let loyersMensuelsArray: number[] = [];
    for (let i = 0; i < nbApparts; i++) {
      const type = locationTypes[i] || "longue";
      if (type === "longue") {
        const loyerMensuel = loyersApparts[i] || 0;
        loyersMensuelsArray.push(loyerMensuel);
      } else {
        const prixNuit = airbnbNuitees[i] || 0;
        const tauxOcc = (airbnbOccupation[i] || 0) / 100;
        const revenuAnnuelAirbnb = prixNuit * tauxOcc * 365;
        const revenuMensuelAirbnb = revenuAnnuelAirbnb / 12;
        loyersMensuelsArray.push(revenuMensuelAirbnb);
      }
    }

    const loyerTotalMensuel = loyersMensuelsArray.reduce(
      (sum, v) => sum + (v || 0),
      0
    );
    const loyersAnnuels = loyerTotalMensuel * 12;

    if (coutTotal <= 0 || loyersAnnuels <= 0) {
      setResultRendementTexte(
        "Merci de renseigner un prix, des frais et des loyers cohérents pour au moins un appartement."
      );
      setGraphData(null);
      setResumeRendement(null);
      return;
    }

    // Rendement brut
    const rendementBrut = (loyersAnnuels / coutTotal) * 100;

    // Charges
    const fraisGestion = loyersAnnuels * gestionPct;
    const chargesTotales = copro + tax + assur + fraisGestion;

    const revenuNetAvantCredit = loyersAnnuels - chargesTotales;
    const rendementNetAvantCredit = (revenuNetAvantCredit / coutTotal) * 100;

    // Crédit
    const apportVal = apport || 0;
    const montantEmprunte = Math.max(coutTotal - apportVal, 0);
    const tAnnuelCred = (tauxCredLoc || 0) / 100;
    const nMensualites = (dureeCredLoc || 0) * 12;
    const tMensuel = tAnnuelCred / 12;

    let mensualiteCredit = 0;
    if (montantEmprunte > 0 && nMensualites > 0) {
      if (tMensuel === 0) {
        mensualiteCredit = montantEmprunte / nMensualites;
      } else {
        const facteur = Math.pow(1 + tMensuel, nMensualites);
        mensualiteCredit =
          montantEmprunte * ((tMensuel * facteur) / (facteur - 1));
      }
    }
    const annuiteCredit = mensualiteCredit * 12;
    const resultatNetAnnuel = revenuNetAvantCredit - annuiteCredit;
    const cashflowMensuel = resultatNetAnnuel / 12;

    const texte = [
      `Projet locatif avec ${nbApparts} lot(s), combinant éventuellement location longue durée et location saisonnière (type Airbnb).`,
      `Loyers mensuels cumulés (équivalents) : ${formatEuro(loyerTotalMensuel)}.`,
      `Coût total du projet (bien + notaire + travaux) : ${formatEuro(coutTotal)}.`,
      `Loyers annuels bruts : ${formatEuro(loyersAnnuels)}.`,
      `Rendement brut : ${formatPct(rendementBrut)}.`,
      `Charges annuelles (copropriété, taxe foncière, assurance, gestion / conciergerie) : ${formatEuro(
        chargesTotales
      )}.`,
      `Rendement net avant crédit : ${formatPct(rendementNetAvantCredit)}.`,
      `Montant emprunté : ${formatEuro(
        montantEmprunte
      )} pour un apport de ${formatEuro(apportVal)}.`,
      `Mensualité de crédit estimée : ${formatEuro(
        mensualiteCredit
      )} (soit ${formatEuro(annuiteCredit)} par an).`,
      `Résultat net après charges et crédit : ${formatEuro(
        resultatNetAnnuel
      )} / an, soit ${formatEuro(cashflowMensuel)} / mois.`,
      resultatNetAnnuel >= 0
        ? `Le projet génère un cash-flow positif : il s’autofinance et dégage un excédent mensuel, ce qui constitue un argument fort lors d’un rendez-vous bancaire.`
        : `Le projet nécessite un effort d’épargne mensuel d’environ ${formatEuro(
            -cashflowMensuel
          )}. Ce point pourra être présenté comme votre capacité d’effort supplémentaire dans le cadre de la demande de financement.`,
    ].join("\n");

    setResultRendementTexte(texte);
    setResumeRendement({
      cashflowMensuel,
      resultatNetAnnuel,
      rendementNetAvantCredit,
    });
    setGraphData({
      loyersAnnuels,
      chargesTotales,
      annuiteCredit,
      resultatNetAnnuel,
      coutTotal,
      mensualiteCredit,
      rendementBrut,
      rendementNetAvantCredit,
      dureeCredLoc,
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

  // --- Préparation des graphiques ---

  let barData;
  let lineData;
  if (graphData) {
    const {
      loyersAnnuels,
      chargesTotales,
      annuiteCredit,
      resultatNetAnnuel,
      dureeCredLoc,
    } = graphData;

    barData = {
      labels: ["Loyers bruts", "Charges", "Crédit", "Résultat net"],
      datasets: [
        {
          label: "Montants annuels (€)",
          data: [
            loyersAnnuels,
            chargesTotales,
            annuiteCredit,
            resultatNetAnnuel,
          ],
          backgroundColor: ["#22c55e", "#fb923c", "#38bdf8", "#0f172a"],
        },
      ],
    };

    const horizon = Math.min(Math.max(dureeCredLoc, 5), 30);
    const annualCF = resultatNetAnnuel;
    const labels = [];
    const data = [];
    let cumul = 0;
    for (let year = 1; year <= horizon; year++) {
      cumul += annualCF;
      labels.push(`Année ${year}`);
      data.push(cumul);
    }

    lineData = {
      labels,
      datasets: [
        {
          label: "Cash-flow cumulé (€)",
          data,
          borderColor: "#0f172a",
          backgroundColor: "rgba(15, 23, 42, 0.08)",
          tension: 0.25,
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
              Simulateur d&apos;investissement locatif.
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

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* FORMULAIRE */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5">
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
            Investissement locatif
          </p>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Rentabilité & business plan de votre projet
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Montant du projet, nombre d&apos;appartements et mode de location pour une vision globale du rendement et du cash-flow.
          </p>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-700">
                Prix du bien (€)
              </label>
              <input
                type="number"
                value={prixBien}
                onChange={(e) =>
                  handlePrixBienChange(parseFloat(e.target.value) || 0)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Frais de notaire (€)
                </label>
                <input
                  type="number"
                  value={fraisNotaire}
                  onChange={(e) => {
                    setNotaireCustom(true);
                    setFraisNotaire(parseFloat(e.target.value) || 0);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[0.7rem] text-slate-500">
                  Pré-rempli à ~7,5 % du prix, modifiable.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Travaux (€)
                </label>
                <input
                  type="number"
                  value={travaux}
                  onChange={(e) => setTravaux(parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700">
                Nombre d&apos;appartements dans ce projet
              </label>
              <input
                type="number"
                value={nbApparts}
                min={1}
                max={10}
                onChange={(e) =>
                  handleNbAppartsChange(parseInt(e.target.value, 10) || 1)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600 flex items-center">
                Paramétrage des loyers / revenus par appartement
                <InfoBadge text="Choisissez, pour chaque lot, entre location longue durée (loyer mensuel) et saisonnière (type Airbnb) calculée à partir d’un prix par nuit et d’un taux d’occupation." />
              </p>
              {Array.from({ length: nbApparts }).map((_, idx) => {
                const type = locationTypes[idx] || "longue";
                return (
                  <div
                    key={idx}
                    className="border-t border-slate-200 pt-3 mt-2 first:border-none first:mt-0 first:pt-0"
                  >
                    <div className="grid gap-2 sm:grid-cols-2 items-center">
                      <p className="text-[0.7rem] text-slate-700 font-medium">
                        Appartement #{idx + 1}
                      </p>
                      <select
                        value={type}
                        onChange={(e) =>
                          handleLocationTypeChange(
                            idx,
                            e.target.value as LocationType
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="longue">
                          Location longue durée (loyer mensuel)
                        </option>
                        <option value="airbnb">
                          Location saisonnière (type Airbnb)
                        </option>
                      </select>
                    </div>

                    {type === "longue" ? (
                      <div className="mt-2 space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Loyer mensuel envisagé (€)
                        </label>
                        <input
                          type="number"
                          value={loyersApparts[idx] || 0}
                          onChange={(e) =>
                            handleLoyerAppartChange(
                              idx,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          placeholder="Loyer mensuel (€)"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700">
                              Prix moyen par nuit (€)
                            </label>
                            <input
                              type="number"
                              value={airbnbNuitees[idx] || 0}
                              onChange={(e) =>
                                handleAirbnbNuiteeChange(
                                  idx,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="Ex. 90 €"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700">
                              Taux d&apos;occupation (% de l&apos;année)
                            </label>
                            <input
                              type="number"
                              value={airbnbOccupation[idx] || 0}
                              onChange={(e) =>
                                handleAirbnbOccupationChange(
                                  idx,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="Ex. 60 %"
                            />
                          </div>
                        </div>
                        <p className="text-[0.65rem] text-slate-500">
                          Converti automatiquement en équivalent loyer mensuel (nuit × taux d&apos;occupation × 365 / 12).
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Charges de copro (€/an)
                </label>
                <input
                  type="number"
                  value={chargesCopro}
                  onChange={(e) =>
                    setChargesCopro(parseFloat(e.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Taxe foncière (€/an)
                </label>
                <input
                  type="number"
                  value={taxeFonc}
                  onChange={(e) => setTaxeFonc(parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Assurance PNO / habitation (€/an)
                </label>
                <input
                  type="number"
                  value={assurance}
                  onChange={(e) => setAssurance(parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Frais de gestion / conciergerie (% des loyers)
                  {hasAirbnb && (
                    <InfoBadge text="Pour la saisonnière, ce champ représente les frais de conciergerie (10–25 %). Pour la longue durée, il peut couvrir des frais de gestion locative." />
                  )}
                </label>
                <input
                  type="number"
                  value={tauxGestion}
                  onChange={(e) =>
                    setTauxGestion(parseFloat(e.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Apport personnel (€)
                </label>
                <input
                  type="number"
                  value={apport}
                  onChange={(e) => setApport(parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Taux crédit (annuel, en %)
                </label>
                <input
                  type="number"
                  value={tauxCredLoc}
                  onChange={(e) =>
                    setTauxCredLoc(parseFloat(e.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Durée du crédit (années)
                </label>
                <input
                  type="number"
                  value={dureeCredLoc}
                  onChange={(e) =>
                    setDureeCredLoc(parseFloat(e.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={handleCalculRendement}
              className="mt-2 w-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-400/40 hover:shadow-2xl hover:shadow-sky-400/60 transition-transform active:scale-[0.99]"
            >
              Calculer la rentabilité
            </button>
          </div>
        </section>

        {/* RESULTATS HYPER DETAILLES */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Résultat détaillé de la simulation
              </h2>
              <p className="text-xs text-slate-500">
                Synthèse chiffrée, graphiques et analyse narrative de votre projet.
              </p>
            </div>

            {resumeRendement && (
              <button
                onClick={handlePrintPDF}
                className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300 transition-colors"
              >
                PDF
              </button>
            )}
          </div>

          {resumeRendement && graphData ? (
            <>
              {/* Cartes de synthèse */}
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Coût total projet
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(graphData.coutTotal)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Rendement brut
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(graphData.rendementBrut)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Rendement net avant crédit
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(graphData.rendementNetAvantCredit)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Mensualité de crédit
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(graphData.mensualiteCredit)}
                  </p>
                </div>
              </div>

              {/* Cash-flow & résultat */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 sm:col-span-2 flex flex-col justify-center">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-700 mb-1">
                    Cash-flow & rentabilité
                  </p>
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Cash-flow mensuel
                      </p>
                      <p
                        className={
                          "mt-1 text-lg font-semibold " +
                          (resumeRendement.cashflowMensuel >= 0
                            ? "text-emerald-700"
                            : "text-red-600")
                        }
                      >
                        {formatEuro(resumeRendement.cashflowMensuel)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Résultat net annuel
                      </p>
                      <p
                        className={
                          "mt-1 text-lg font-semibold " +
                          (resumeRendement.resultatNetAnnuel >= 0
                            ? "text-emerald-700"
                            : "text-red-600")
                        }
                      >
                        {formatEuro(resumeRendement.resultatNetAnnuel)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Rendement net
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatPct(resumeRendement.rendementNetAvantCredit)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Durée du crédit
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {graphData.dureeCredLoc} ans
                  </p>
                  <p className="mt-2 text-[0.7rem] text-slate-500">
                    Projection du cash-flow cumulé sur la durée du prêt dans le graphique ci-dessous.
                  </p>
                </div>
              </div>

              {/* Graphiques */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-600 mb-2">
                    Flux annuels : loyers bruts, charges, crédit et résultat net.
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

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-600 mb-2">
                    Cash-flow cumulé année par année, en supposant des paramètres constants (hors revalorisation).
                  </p>
                  {lineData && (
                    <Line
                      data={lineData}
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
                  )}
                </div>
              </div>

              {/* Analyse narrative */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                  Analyse détaillée
                </p>
                {renderMultiline(resultRendementTexte)}
              </div>

              <p className="mt-1 text-[0.7rem] text-slate-500">
                Ces calculs sont fournis à titre indicatif, hors fiscalité et évolution future des loyers, taux et charges.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Renseignez votre projet puis cliquez sur “Calculer la rentabilité” pour afficher une analyse détaillée, des graphiques et une synthèse imprimable.
            </p>
          )}
        </section>
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
