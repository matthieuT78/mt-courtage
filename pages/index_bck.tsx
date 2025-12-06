import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const Pie = dynamic(
  () => import("react-chartjs-2").then((m) => m.Pie),
  { ssr: false }
);
const Bar = dynamic(
  () => import("react-chartjs-2").then((m) => m.Bar),
  { ssr: false }
);

function formatEuro(val: number) {
  if (Number.isNaN(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });
}

function formatPct(val: number) {
  if (Number.isNaN(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2
    }) + " %"
  );
}

type SimuType = "capacite" | "rentabilite" | null;

type Credit = {
  type: "immo" | "auto" | "perso" | "autre";
  mensualite: number;
  resteAnnees: number;
  taux: number;
  revenuLocatif: number; // uniquement pertinent si immo
};

export default function Home() {
  // ---- Capacité d'emprunt ----
  const [revMensuels, setRevMensuels] = useState(4000);
  const [tauxAnnuel, setTauxAnnuel] = useState(3.5);
  const [dureeAnnees, setDureeAnnees] = useState(25);
  const [tauxEndettement, setTauxEndettement] = useState(35);

  const [nbCredits, setNbCredits] = useState(0);
  const [credits, setCredits] = useState<Credit[]>([
    { type: "immo", mensualite: 800, resteAnnees: 18, taux: 1.5, revenuLocatif: 900 },
    { type: "auto", mensualite: 250, resteAnnees: 3, taux: 2.9, revenuLocatif: 0 },
    { type: "perso", mensualite: 150, resteAnnees: 2, taux: 4.5, revenuLocatif: 0 },
    { type: "autre", mensualite: 0, resteAnnees: 0, taux: 0, revenuLocatif: 0 },
    { type: "autre", mensualite: 0, resteAnnees: 0, taux: 0, revenuLocatif: 0 }
  ]);

  const [resultCapaciteTexte, setResultCapaciteTexte] = useState<string>("");

  // ---- Investissement locatif / Business plan ----
  const [prixBien, setPrixBien] = useState(200000);

  // frais de notaire auto ≈ 7,5 % du prix du bien, modifiable
  const [fraisNotaire, setFraisNotaire] = useState(
    Math.round(200000 * 0.075)
  );
  const [notaireCustom, setNotaireCustom] = useState(false);

  const [travaux, setTravaux] = useState(10000);

  const [nbApparts, setNbApparts] = useState(1);
  const [loyersApparts, setLoyersApparts] = useState<number[]>([900]);

  const [chargesCopro, setChargesCopro] = useState(1200);
  const [taxeFonc, setTaxeFonc] = useState(900);
  const [assurance, setAssurance] = useState(200);
  const [tauxGestion, setTauxGestion] = useState(7);

  const [apport, setApport] = useState(20000);
  const [tauxCredLoc, setTauxCredLoc] = useState(3.5);
  const [dureeCredLoc, setDureeCredLoc] = useState(25);

  const [resultRendementTexte, setResultRendementTexte] = useState<string>("");
  const [graphData, setGraphData] = useState<{
    loyersAnnuels: number;
    chargesTotales: number;
    annuiteCredit: number;
    resultatNetAnnuel: number;
  } | null>(null);

  // ---- Simulation utilisée en dernier ----
  const [lastSimu, setLastSimu] = useState<SimuType>(null);

  // -------- Gestion des crédits existants --------
  const handleNbCreditsChange = (value: number) => {
    const n = Math.min(Math.max(value, 0), 5);
    setNbCredits(n);
    setCredits((prev) => {
      const next = [...prev];
      while (next.length < 5) {
        next.push({
          type: "autre",
          mensualite: 0,
          resteAnnees: 0,
          taux: 0,
          revenuLocatif: 0
        });
      }
      return next.slice(0, 5);
    });
  };

  const updateCreditField = <K extends keyof Credit>(
    index: number,
    field: K,
    value: Credit[K]
  ) => {
    setCredits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleNbAppartsChange = (value: number) => {
    const n = Math.min(Math.max(value, 1), 10);
    setNbApparts(n);
    setLoyersApparts((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(0);
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

  const handlePrixBienChange = (value: number) => {
    const newPrix = value || 0;
    setPrixBien(newPrix);
    if (!notaireCustom) {
      setFraisNotaire(Math.round(newPrix * 0.075)); // valeur moyenne
    }
  };

  const handleCalculCapacite = () => {
    const revenusSalaire = revMensuels || 0;
    const tAnnuel = (tauxAnnuel || 0) / 100;
    const duree = dureeAnnees || 0;
    const endettementMax = (tauxEndettement || 35) / 100;

    if (revenusSalaire <= 0 || duree <= 0) {
      setResultCapaciteTexte("Merci de renseigner des valeurs cohérentes.");
      setLastSimu("capacite");
      return;
    }

    let revenusPrisesEnCompte = revenusSalaire;
    let chargesCredits = 0;

    credits.slice(0, nbCredits).forEach((c) => {
      const mensualite = c.mensualite || 0;
      chargesCredits += mensualite;

      if (c.type === "immo" && c.revenuLocatif > 0) {
        // On ajoute 70% du revenu locatif aux revenus pris en compte
        revenusPrisesEnCompte += c.revenuLocatif * 0.7;
      }
    });

    const mensualiteMax = revenusPrisesEnCompte * endettementMax - chargesCredits;

    if (mensualiteMax <= 0) {
      setResultCapaciteTexte(
        "Avec les données saisies (revenus, crédits en cours et loyers perçus), aucune capacité d’endettement disponible n’apparaît."
      );
      setLastSimu("capacite");
      return;
    }

    const n = duree * 12;
    const t = tAnnuel / 12;

    let capital: number;
    if (t === 0) {
      capital = mensualiteMax * n;
    } else {
      const facteur = Math.pow(1 + t, n);
      capital = mensualiteMax * ((facteur - 1) / (t * facteur));
    }

    const totalLoyersImmo = credits
      .slice(0, nbCredits)
      .filter((c) => c.type === "immo")
      .reduce((sum, c) => sum + (c.revenuLocatif || 0), 0);

    const message = [
      `Revenus salariaux pris en compte : ${formatEuro(revenusSalaire)}.`,
      totalLoyersImmo > 0
        ? `Revenus locatifs existants pris en compte à 70 % : ${formatEuro(
            totalLoyersImmo * 0.7
          )}.`
        : `Aucun revenu locatif existant pris en compte.`,
      `Charges de crédits en cours : ${formatEuro(chargesCredits)} / mois.`,
      `Mensualité immobilière maximale estimée dans ces conditions : ${formatEuro(mensualiteMax)}.`,
      `Capital empruntable approximatif (sur ${duree} ans à ${formatPct(
        tAnnuel * 100
      )}) : ${formatEuro(capital)}.`,
      `Cette estimation reproduit un raisonnement bancaire standard (taux d’endettement ${(
        endettementMax * 100
      ).toFixed(
        0
      )} %, prise en compte partielle des loyers), mais ne remplace pas une étude complète de votre dossier.`
    ].join("\n");

    setResultCapaciteTexte(message);
    setLastSimu("capacite");
  };

  const handleCalculRendement = () => {
    const prix = prixBien || 0;
    const notaire = fraisNotaire || 0;
    const trvx = travaux || 0;
    const copro = chargesCopro || 0;
    const tax = taxeFonc || 0;
    const assur = assurance || 0;
    const gestionPct = (tauxGestion || 0) / 100;

    const coutTotal = prix + notaire + trvx;

    const loyerTotalMensuel = loyersApparts
      .slice(0, nbApparts)
      .reduce((sum, v) => sum + (v || 0), 0);

    const loyersAnnuels = loyerTotalMensuel * 12;

    if (coutTotal <= 0 || loyersAnnuels <= 0) {
      setResultRendementTexte(
        "Merci de renseigner un prix, des frais et des loyers cohérents pour au moins un appartement."
      );
      setGraphData(null);
      setLastSimu("rentabilite");
      return;
    }

    const rendementBrut = (loyersAnnuels / coutTotal) * 100;

    const fraisGestion = loyersAnnuels * gestionPct;
    const chargesTotales = copro + tax + assur + fraisGestion;

    const revenuNetAvantCredit = loyersAnnuels - chargesTotales;
    const rendementNetAvantCredit = (revenuNetAvantCredit / coutTotal) * 100;

    // Financement
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
      `Projet locatif avec ${nbApparts} lot(s).`,
      `Loyers mensuels cumulés : ${formatEuro(loyerTotalMensuel)} (tous appartements confondus).`,
      `Coût total du projet (bien + notaire + travaux) : ${formatEuro(coutTotal)}.`,
      `Loyers annuels bruts : ${formatEuro(loyersAnnuels)}.`,
      `Rendement brut : ${formatPct(rendementBrut)}.`,
      `Charges annuelles (copropriété, taxe foncière, assurance, frais de gestion) : ${formatEuro(chargesTotales)}.`,
      `Rendement net avant crédit : ${formatPct(rendementNetAvantCredit)}.`,
      `Montant emprunté : ${formatEuro(montantEmprunte)} pour un apport de ${formatEuro(apportVal)}.`,
      `Mensualité de crédit estimée : ${formatEuro(mensualiteCredit)} (soit ${formatEuro(annuiteCredit)} par an).`,
      `Résultat net après charges et crédit : ${formatEuro(resultatNetAnnuel)} / an, soit ${formatEuro(
        cashflowMensuel
      )} / mois.`,
      resultatNetAnnuel >= 0
        ? `Le projet génère un cash-flow positif : il s’autofinance et dégage un excédent mensuel, ce qui constitue un argument fort lors d’un rendez-vous bancaire.`
        : `Le projet nécessite un effort d’épargne mensuel d’environ ${formatEuro(
            -cashflowMensuel
          )}. Ce point pourra être présenté comme votre capacité d’effort supplémentaire dans le cadre de la demande de financement.`
    ].join("\n");

    setResultRendementTexte(texte);
    setGraphData({
      loyersAnnuels,
      chargesTotales,
      annuiteCredit,
      resultatNetAnnuel
    });
    setLastSimu("rentabilite");
  };

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, idx) => (
      <p key={idx} className="text-sm text-slate-800 leading-relaxed">
        {line}
      </p>
    ));

  // Préparation des données graphiques
  let pieData, barData;
  if (graphData) {
    const { loyersAnnuels, chargesTotales, annuiteCredit, resultatNetAnnuel } =
      graphData;

    const partCharges = Math.max(chargesTotales, 0);
    const partCredit = Math.max(annuiteCredit, 0);
    const partNet =
      resultatNetAnnuel >= 0 ? resultatNetAnnuel : 0;
    const partEffort =
      resultatNetAnnuel < 0 ? -resultatNetAnnuel : 0;

    pieData = {
      labels: [
        "Charges",
        "Crédit",
        resultatNetAnnuel >= 0 ? "Cash-flow net" : "Effort d’épargne"
      ],
      datasets: [
        {
          data: resultatNetAnnuel >= 0
            ? [partCharges, partCredit, partNet]
            : [partCharges, partCredit, partEffort],
          backgroundColor: [
            "#fb923c", // charges
            "#38bdf8", // crédit
            resultatNetAnnuel >= 0 ? "#22c55e" : "#ef4444"
          ]
        }
      ]
    };

    barData = {
      labels: ["Loyers", "Charges", "Crédit", "Résultat net"],
      datasets: [
        {
          label: "Montants annuels (€)",
          data: [
            loyersAnnuels,
            chargesTotales,
            annuiteCredit,
            resultatNetAnnuel
          ],
          backgroundColor: ["#22c55e", "#fb923c", "#38bdf8", "#0f172a"]
        }
      ]
    };
  }

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") {
      window.print(); // l’utilisateur choisit "Enregistrer en PDF"
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Bandeau premium clair */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Simulateur professionnel – capacité d&apos;emprunt &amp; business plan locatif.
            </p>
          </div>
          <div className="text-xs text-slate-500 lg:text-right">
            <p>Outil de simulation indicatif, réservé à un premier échange.</p>
            <p>Une étude personnalisée reste nécessaire avant tout engagement.</p>
          </div>
        </div>
      </header>

      {/* Contenu principal : 2 colonnes */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Capacité d'emprunt */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] p-5">
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-sky-600 mb-1">
              Capacité d&apos;emprunt
            </p>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Estimation de votre enveloppe de financement
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Renseignez vos revenus, vos crédits en cours et vos loyers existants pour obtenir une vision plus proche
              d&apos;une analyse bancaire.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Revenus nets mensuels du foyer (€)
                </label>
                <input
                  type="number"
                  value={revMensuels}
                  onChange={(e) => setRevMensuels(parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Nombre de crédits en cours
                </label>
                <select
                  value={nbCredits}
                  onChange={(e) => handleNbCreditsChange(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {nbCredits > 0 && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">
                    Détail des crédits en cours (les crédits immobiliers peuvent être compensés par des loyers perçus).
                  </p>
                  {Array.from({ length: nbCredits }).map((_, idx) => {
                    const c = credits[idx] || {
                      type: "autre",
                      mensualite: 0,
                      resteAnnees: 0,
                      taux: 0,
                      revenuLocatif: 0
                    };
                    return (
                      <div
                        key={idx}
                        className="border-t border-slate-200 pt-3 mt-2 first:mt-0 first:pt-0 first:border-none"
                      >
                        <p className="text-xs text-slate-500 mb-1 font-medium">
                          Crédit #{idx + 1}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700">
                              Type de crédit
                            </label>
                            <select
                              value={c.type}
                              onChange={(e) =>
                                updateCreditField(idx, "type", e.target.value as Credit["type"])
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            >
                              <option value="immo">Crédit immobilier</option>
                              <option value="auto">Crédit auto</option>
                              <option value="perso">Crédit perso / conso</option>
                              <option value="autre">Autre crédit</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700">
                              Mensualité (€ / mois)
                            </label>
                            <input
                              type="number"
                              value={c.mensualite}
                              onChange={(e) =>
                                updateCreditField(idx, "mensualite", parseFloat(e.target.value) || 0)
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 mt-2">
                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700">
                              Années restantes
                            </label>
                            <input
                              type="number"
                              value={c.resteAnnees}
                              onChange={(e) =>
                                updateCreditField(idx, "resteAnnees", parseFloat(e.target.value) || 0)
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700">
                              Taux du crédit (%)
                            </label>
                            <input
                              type="number"
                              value={c.taux}
                              onChange={(e) =>
                                updateCreditField(idx, "taux", parseFloat(e.target.value) || 0)
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                        </div>

                        {c.type === "immo" && (
                          <div className="mt-2 space-y-1">
                            <label className="text-[0.7rem] text-slate-700">
                              Revenu locatif associé à ce crédit (€ / mois)
                            </label>
                            <input
                              type="number"
                              value={c.revenuLocatif}
                              onChange={(e) =>
                                updateCreditField(
                                  idx,
                                  "revenuLocatif",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                            <p className="text-[0.65rem] text-slate-500">
                              Seuls 70 % de ce loyer sont retenus dans le calcul, pour refléter une approche bancaire
                              prudente (charges, imprévus…).
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Taux d’intérêt du futur crédit (annuel, en %)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tauxAnnuel}
                    onChange={(e) => setTauxAnnuel(parseFloat(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Durée du futur prêt (années)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={dureeAnnees}
                    onChange={(e) =>
                      setDureeAnnees(parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Taux d’endettement maximum souhaité (%)
                </label>
                <input
                  type="number"
                  min={10}
                  max={50}
                  value={tauxEndettement}
                  onChange={(e) =>
                    setTauxEndettement(parseFloat(e.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <button
                onClick={handleCalculCapacite}
                className="mt-2 w-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-400/40 hover:shadow-2xl hover:shadow-emerald-400/60 transition-transform active:scale-[0.99]"
              >
                Calculer ma capacité
              </button>
            </div>
          </section>

          {/* Investissement locatif + Business plan */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] p-5">
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
              Investissement locatif
            </p>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Rentabilité & business plan de votre projet
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Renseignez le montant du projet, le nombre d&apos;appartements et les loyers envisagés pour obtenir une
              vision globale du rendement et du cash-flow.
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
                <p className="text-[0.7rem] text-slate-500">
                  Les frais de notaire sont pré-remplis à ~7,5 % du prix du bien (valeur moyenne, ajustable ci-dessous).
                </p>
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
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Travaux (€)</label>
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
                <p className="text-xs text-slate-600">
                  Loyers mensuels envisagés pour chaque appartement :
                </p>
                {Array.from({ length: nbApparts }).map((_, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-2 items-center">
                    <p className="text-[0.7rem] text-slate-700">
                      Appartement #{idx + 1}
                    </p>
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
                ))}
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
                  <label className="text-xs text-slate-700">
                    Frais de gestion (% des loyers, 0 si gestion perso)
                  </label>
                  <input
                    type="number"
                    value={tauxGestion}
                    onChange={(e) => setTauxGestion(parseFloat(e.target.value))}
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
        </div>

        {/* SECTION RÉSULTATS PLEINE LARGEUR */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] p-6 print:bg-white print:text-black print:shadow-none">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 tracking-tight">
                Résultats de la simulation
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Synthèse prête à être téléchargée ou imprimée pour un rendez-vous bancaire.
              </p>
            </div>
            <button
              onClick={handlePrintPDF}
              className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-amber-300/60 hover:bg-amber-300 transition-colors"
            >
              Générer le PDF pour la banque
            </button>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4 space-y-4 print:border-t print:border-slate-300">
            {lastSimu === null && (
              <p className="text-sm text-slate-500">
                Lancez une simulation de capacité d&apos;emprunt ou de rentabilité locative pour afficher le détail ici.
              </p>
            )}

            {lastSimu === "capacite" && resultCapaciteTexte && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.16em] text-sky-600">
                  Bloc 1 — Capacité d&apos;emprunt estimée
                </p>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 print:bg-white print:border-slate-300">
                  {renderMultiline(resultCapaciteTexte)}
                </div>
              </div>
            )}

            {lastSimu === "rentabilite" && resultRendementTexte && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.16em] text-emerald-600">
                  Bloc 2 — Business plan locatif
                </p>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 print:bg-white print:border-slate-300">
                  {renderMultiline(resultRendementTexte)}
                </div>
              </div>
            )}

            {lastSimu === "rentabilite" && graphData && pieData && barData && (
              <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-2">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 print:bg-white print:border-slate-300">
                  <p className="text-xs text-slate-600 mb-2 print:text-slate-700">
                    Répartition des loyers annuels
                  </p>
                  <Pie
                    data={pieData}
                    options={{
                      plugins: {
                        legend: {
                          labels: {
                            color: "#0f172a",
                            font: { size: 11 }
                          }
                        }
                      }
                    }}
                  />
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 print:bg-white print:border-slate-300">
                  <p className="text-xs text-slate-600 mb-2 print:text-slate-700">
                    Comparaison des flux annuels
                  </p>
                  <Bar
                    data={barData}
                    options={{
                      plugins: {
                        legend: {
                          labels: {
                            color: "#0f172a",
                            font: { size: 11 }
                          }
                        }
                      },
                      scales: {
                        x: {
                          ticks: { color: "#0f172a", font: { size: 10 } },
                          grid: { color: "#e5e7eb" }
                        },
                        y: {
                          ticks: { color: "#0f172a", font: { size: 10 } },
                          grid: { color: "#e5e7eb" }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}

            <p className="mt-2 text-[0.68rem] text-slate-500 print:text-[0.7rem] print:text-slate-700">
              Ces éléments de calcul sont fournis à titre indicatif et ne constituent pas une offre de financement. Une
              analyse détaillée de votre situation personnelle sera nécessaire pour valider un montage définitif.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} MT Courtage &amp; Investissement – Simulations indicatives.</p>
        <p className="mt-1">
          Contact : <a href="mailto:mtcourtage@gmail.com" className="underline">mtcourtage@gmail.com</a>
        </p>
      </footer>
    </div>
  );
}
