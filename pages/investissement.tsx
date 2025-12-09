// pages/investissement.tsx
import { useState, useRef } from "react";
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

type ResumeRendement = {
  cashflowMensuel: number;
  resultatNetAnnuel: number;
  rendementNetAvantCredit: number;
};

type LocationType = "longue" | "airbnb";

type GraphData = {
  loyersAnnuels: number;
  chargesTotales: number;
  annuiteCredit: number; // crédit + assurance
  resultatNetAnnuel: number;
  coutTotal: number;
  mensualiteCredit: number; // crédit + assurance
  rendementBrut: number;
  rendementNetAvantCredit: number;
  dureeCredLoc: number;
};

type Onglet = "couts" | "revenus" | "charges" | "credit";

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
  // Onglets
  const [onglet, setOnglet] = useState<Onglet>("couts");

  // Prix / coûts
  const [prixBien, setPrixBien] = useState(200000);
  const [fraisNotaire, setFraisNotaire] = useState(Math.round(200000 * 0.075));
  const [notaireCustom, setNotaireCustom] = useState(false);

  const [fraisAgence, setFraisAgence] = useState(Math.round(200000 * 0.04));
  const [agenceCustom, setAgenceCustom] = useState(false);

  const [travaux, setTravaux] = useState(10000);

  // Configuration des lots
  const [nbApparts, setNbApparts] = useState(1);
  const [loyersApparts, setLoyersApparts] = useState<number[]>([900]);
  const [locationTypes, setLocationTypes] = useState<LocationType[]>(["longue"]);
  const [airbnbNuitees, setAirbnbNuitees] = useState<number[]>([90]);
  const [airbnbOccupation, setAirbnbOccupation] = useState<number[]>([65]);

  // Charges
  const [chargesCopro, setChargesCopro] = useState(1200);
  const [taxeFonc, setTaxeFonc] = useState(900);
  const [assurance, setAssurance] = useState(200); // PNO / habitation
  const [tauxGestion, setTauxGestion] = useState(10);

  // Crédit
  const [apport, setApport] = useState(20000);
  const [tauxCredLoc, setTauxCredLoc] = useState(3.5);
  const [dureeCredLoc, setDureeCredLoc] = useState(25);
  const [tauxAssuranceEmp, setTauxAssuranceEmp] = useState(0.25); // % annuel

  // Résultats
  const [resultRendementTexte, setResultRendementTexte] = useState<string>("");
  const [resumeRendement, setResumeRendement] =
    useState<ResumeRendement | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  // Sauvegarde projet
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Référence pour scroller vers les résultats
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  // --- Gestion des champs ---

  const handlePrixBienChange = (value: number) => {
    const newPrix = value || 0;
    setPrixBien(newPrix);

    if (!notaireCustom) {
      setFraisNotaire(Math.round(newPrix * 0.075));
    }
    if (!agenceCustom) {
      setFraisAgence(Math.round(newPrix * 0.04));
    }
  };

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
      while (arr.length < n) arr.push(90);
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

  const hasAirbnb =
    nbApparts > 0 &&
    locationTypes.slice(0, nbApparts).some((t) => t === "airbnb");

  // --- Navigation onglets (précédent / suivant) ---

  const ordreOnglets: Onglet[] = ["couts", "revenus", "charges", "credit"];

  const handleNext = () => {
    const idx = ordreOnglets.indexOf(onglet);
    if (idx < ordreOnglets.length - 1) {
      setOnglet(ordreOnglets[idx + 1]);
    }
  };

  const handlePrev = () => {
    const idx = ordreOnglets.indexOf(onglet);
    if (idx > 0) {
      setOnglet(ordreOnglets[idx - 1]);
    }
  };

  // --- Calcul principal ---

  const handleCalculRendement = () => {
    setSaveMessage(null); // reset message sauvegarde

    const prix = prixBien || 0;
    const notaire = fraisNotaire || 0;
    const trvx = travaux || 0;
    const agence = fraisAgence || 0;
    const copro = chargesCopro || 0;
    const tax = taxeFonc || 0;
    const assurPNO = assurance || 0;
    const gestionPct = (tauxGestion || 0) / 100;

    const coutTotal = prix + notaire + trvx + agence;

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

    const rendementBrut = (loyersAnnuels / coutTotal) * 100;

    const fraisGestion = loyersAnnuels * gestionPct;
    const chargesTotales = copro + tax + assurPNO + fraisGestion;

    const revenuNetAvantCredit = loyersAnnuels - chargesTotales;
    const rendementNetAvantCredit = (revenuNetAvantCredit / coutTotal) * 100;

    const apportVal = apport || 0;
    const montantEmprunte = Math.max(coutTotal - apportVal, 0);
    const tAnnuelCred = (tauxCredLoc || 0) / 100;
    const nMensualites = (dureeCredLoc || 0) * 12;
    const tMensuel = tAnnuelCred / 12;

    let mensualiteCreditNue = 0;
    if (montantEmprunte > 0 && nMensualites > 0) {
      if (tMensuel === 0) {
        mensualiteCreditNue = montantEmprunte / nMensualites;
      } else {
        const facteur = Math.pow(1 + tMensuel, nMensualites);
        mensualiteCreditNue =
          montantEmprunte * ((tMensuel * facteur) / (facteur - 1));
      }
    }
    const annuiteCreditNue = mensualiteCreditNue * 12;

    // Assurance emprunteur (approximation sur capital initial)
    const tAssEmp = (tauxAssuranceEmp || 0) / 100;
    const annuiteAssuranceEmp = montantEmprunte * tAssEmp;
    const mensualiteAssuranceEmp = annuiteAssuranceEmp / 12;

    const mensualiteTotale = mensualiteCreditNue + mensualiteAssuranceEmp;
    const annuiteTotale = annuiteCreditNue + annuiteAssuranceEmp;

    const resultatNetAnnuel = revenuNetAvantCredit - annuiteTotale;
    const cashflowMensuel = resultatNetAnnuel / 12;

    const texte = [
      `Structure du projet : ${nbApparts} lot(s) combinant vos choix de location (longue durée ou saisonnière). Le coût total du projet (prix d’acquisition, frais de notaire, frais d’agence et travaux) ressort à ${formatEuro(
        coutTotal
      )}.`,
      `Les loyers annuels bruts atteignent environ ${formatEuro(
        loyersAnnuels
      )}, soit un rendement brut de ${formatPct(
        rendementBrut
      )} par rapport au coût complet du projet.`,
      `Une fois intégrées les charges récurrentes (copropriété, taxe foncière, assurance, frais de gestion ou conciergerie), le revenu net avant crédit ressort à ${formatEuro(
        revenuNetAvantCredit
      )} par an, soit un rendement net avant remboursement du prêt de ${formatPct(
        rendementNetAvantCredit
      )}.`,
      `Avec un apport personnel de ${formatEuro(
        apportVal
      )}, le montant emprunté est d’environ ${formatEuro(
        montantEmprunte
      )}. À un taux de ${tauxCredLoc.toLocaleString("fr-FR", {
        maximumFractionDigits: 2,
      })} % sur ${dureeCredLoc} ans, la mensualité de crédit (hors assurance emprunteur) est de l’ordre de ${formatEuro(
        mensualiteCreditNue
      )}.`,
      `En ajoutant une estimation d’assurance emprunteur de ${tauxAssuranceEmp.toLocaleString(
        "fr-FR",
        { maximumFractionDigits: 2 }
      )} % par an sur le capital emprunté, la mensualité totale crédit + assurance ressort autour de ${formatEuro(
        mensualiteTotale
      )}, soit ${formatEuro(annuiteTotale)} par an.`,
      `Au global, une fois les charges, le crédit et l’assurance intégrés, le projet dégage un résultat net annuel de ${formatEuro(
        resultatNetAnnuel
      )}, correspondant à un cash-flow mensuel de ${formatEuro(
        cashflowMensuel
      )}.`,
      resultatNetAnnuel >= 0
        ? `Le cash-flow positif indique que le bien s’autofinance et génère un excédent, ce qui constitue un argument fort auprès d’un banquier : le projet ne vient pas dégrader votre budget mensuel, il le renforce.`
        : `Le cash-flow légèrement négatif signifie que le projet nécessite un effort d’épargne mensuel d’environ ${formatEuro(
            -cashflowMensuel
          )}. Présenté correctement, cet effort peut être perçu comme une contribution maîtrisée à un actif patrimonial, surtout si l’emplacement et le potentiel de valorisation à long terme sont solides.`,
      `Cette simulation reste indicative : elle ne tient pas compte de la fiscalité, de l’éventuelle revalorisation des loyers, ni de futures évolutions réglementaires. Elle vous donne toutefois une base structurée pour discuter avec votre banque ou votre courtier et affiner votre montage (durée, apport, type de location, etc.).`,
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
      annuiteCredit: annuiteTotale,
      resultatNetAnnuel,
      coutTotal,
      mensualiteCredit: mensualiteTotale,
      rendementBrut,
      rendementNetAvantCredit,
      dureeCredLoc,
    });
  };

  const handleGoToResults = () => {
    handleCalculRendement();
    setTimeout(() => {
      if (resultSectionRef.current) {
        resultSectionRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);
  };

  // Analyse détaillée en blocs / bullets
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
            <span className="mt-1 text-xs text-emerald-600">●</span>
            <p className="text-[0.8rem] text-slate-800 leading-relaxed">
              {line}
            </p>
          </div>
        ))}
      </div>
    );
  };

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // 🔹 Demande d'analyse premium (optimisation locative)
  const handleRequestPremiumAnalysis = () => {
    if (typeof window === "undefined") return;

    const subject = encodeURIComponent(
      "Demande d’optimisation de mon investissement locatif"
    );

    const bodyLines: string[] = [
      "Bonjour,",
      "",
      "Je souhaite une analyse approfondie et une optimisation de mon projet d’investissement locatif réalisé sur l’outil MT Courtage & Investissement.",
      "",
      "Résumé de ma simulation actuelle :",
      "",
      resultRendementTexte && resultRendementTexte.trim().length > 0
        ? resultRendementTexte
        : "(Les résultats ne sont pas joints automatiquement, n’hésitez pas à me recontacter pour les détails.)",
      "",
      "Merci de revenir vers moi avec :",
      "- Vos premières recommandations,",
      "- Le fonctionnement de la prestation,",
      "- Et le tarif détaillé.",
      "",
      "Cordialement,",
      "",
    ];

    const body = encodeURIComponent(bodyLines.join("\n"));
    window.location.href = `mailto:mtcourtage@gmail.com?subject=${subject}&body=${body}`;
  };

  // --- Sauvegarde du projet investissement ---

  const handleSaveProject = async () => {
    if (!resumeRendement || !graphData) return;
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
          window.location.href =
            "/mon-compte?mode=login&redirect=/investissement";
        }
        return;
      }

      const { error } = await supabase.from("projects").insert({
        user_id: session.user.id,
        type: "investissement",
        title: "Simulation investissement locatif",
        data: {
          inputs: {
            prixBien,
            fraisNotaire,
            fraisAgence,
            travaux,
            nbApparts,
            loyersApparts,
            locationTypes,
            airbnbNuitees,
            airbnbOccupation,
            chargesCopro,
            taxeFonc,
            assurance,
            tauxGestion,
            apport,
            tauxCredLoc,
            dureeCredLoc,
            tauxAssuranceEmp,
          },
          resume: resumeRendement,
          graphData,
          analyse: resultRendementTexte,
        },
      });

      if (error) throw error;
      setSaveMessage("✅ Projet sauvegardé dans votre espace.");
    } catch (err: any) {
      setSaveMessage(
        "❌ Erreur lors de la sauvegarde du projet : " +
          (err?.message || "erreur inconnue")
      );
    } finally {
      setSaving(false);
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
      labels: ["Loyers bruts", "Charges", "Crédit + assurance", "Résultat net"],
      datasets: [
        {
          label: "Montants annuels (€)",
          data: [loyersAnnuels, chargesTotales, annuiteCredit, resultatNetAnnuel],
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

  const hasSimulation = !!resumeRendement && !!graphData;

  const ongletClasses = (key: Onglet) =>
    [
      "px-3 py-1.5 text-xs font-medium rounded-full border",
      onglet === key
        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
    ].join(" ");

  const primaryNavButtonClass =
    "rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-sky-400/40 hover:shadow-2xl hover:shadow-sky-400/60 transition-transform active:scale-[0.99]";
  const secondaryNavButtonClass =
    "rounded-full border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-50";

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header global */}
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Onglets */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-4">
          <div className="flex flex-wrap gap-2">
            <button
              className={ongletClasses("couts")}
              onClick={() => setOnglet("couts")}
            >
              Coûts du projet
            </button>
            <button
              className={ongletClasses("revenus")}
              onClick={() => setOnglet("revenus")}
            >
              Revenus locatifs
            </button>
            <button
              className={ongletClasses("charges")}
              onClick={() => setOnglet("charges")}
            >
              Charges & gestion
            </button>
            <button
              className={ongletClasses("credit")}
              onClick={() => setOnglet("credit")}
            >
              Crédit & financement
            </button>
          </div>
        </section>

        {/* Onglet Coûts */}
        {onglet === "couts" && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Étape 1
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Coût global du projet
                </h2>
                <p className="text-xs text-slate-500">
                  Prix du bien, frais de notaire, frais d&apos;agence et travaux.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleNext} className={primaryNavButtonClass}>
                  Suivant
                </button>
              </div>
            </div>

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

              <div className="grid gap-3 sm:grid-cols-3">
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
                    Frais d&apos;agence (€)
                  </label>
                  <input
                    type="number"
                    value={fraisAgence}
                    onChange={(e) => {
                      setAgenceCustom(true);
                      setFraisAgence(parseFloat(e.target.value) || 0);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[0.7rem] text-slate-500">
                    Pré-rempli à ~4 % du prix, modifiable.
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

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800">
                Coût total actuel du projet (bien + notaire + agence + travaux) :{" "}
                <span className="font-semibold">
                  {formatEuro(prixBien + fraisNotaire + fraisAgence + travaux)}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Onglet Revenus */}
        {onglet === "revenus" && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Étape 2
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Revenus locatifs : longue durée & saisonnière
                </h2>
                <p className="text-xs text-slate-500">
                  Configurez le nombre d&apos;appartements et le mode de location
                  pour chacun.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  className={secondaryNavButtonClass}
                >
                  Précédent
                </button>
                <button onClick={handleNext} className={primaryNavButtonClass}>
                  Suivant
                </button>
              </div>
            </div>

            <div className="space-y-3">
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
                  <InfoBadge text="Pour chaque lot, choisissez entre location longue durée (loyer mensuel) et location saisonnière (type Airbnb), convertie automatiquement en revenu mensuel équivalent." />
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
                            Converti automatiquement en revenu locatif mensuel
                            (nuit × taux d&apos;occupation × 365 / 12).
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Onglet Charges */}
        {onglet === "charges" && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Étape 3
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Charges récurrentes & gestion
                </h2>
                <p className="text-xs text-slate-500">
                  Copropriété, taxe foncière, assurance, gestion locative ou
                  conciergerie.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  className={secondaryNavButtonClass}
                >
                  Précédent
                </button>
                <button onClick={handleNext} className={primaryNavButtonClass}>
                  Suivant
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
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
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Frais de gestion / conciergerie (% des loyers)
                  {hasAirbnb && (
                    <InfoBadge text="Pour la saisonnière, ce champ représente les frais de conciergerie (10–25 %). Pour la longue durée, il couvre les frais de gestion locative si vous déléguez." />
                  )}
                </label>
                <input
                  type="number"
                  value={tauxGestion}
                  onChange={(e) => setTauxGestion(parseFloat(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </section>
        )}

        {/* Onglet Crédit */}
        {onglet === "credit" && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Étape 4
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Paramètres du financement
                </h2>
                <p className="text-xs text-slate-500">
                  Apport personnel, taux, durée du crédit et assurance emprunteur.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  className={secondaryNavButtonClass}
                >
                  Précédent
                </button>
                <button
                  onClick={handleGoToResults}
                  className={primaryNavButtonClass}
                >
                  Aller aux résultats
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4 mt-2">
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
                  onChange={(e) => setTauxCredLoc(parseFloat(e.target.value))}
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
              <div className="space-y-1">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Taux assurance emprunteur (annuel, en %)
                  <InfoBadge text="Taux annuel appliqué au capital emprunté (contrat groupe ~0,20–0,40 % en moyenne). Approche simplifiée pour estimer la mensualité totale crédit + assurance." />
                </label>
                <input
                  type="number"
                  value={tauxAssuranceEmp}
                  onChange={(e) =>
                    setTauxAssuranceEmp(parseFloat(e.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </section>
        )}

        {/* RÉSULTATS & DASHBOARD */}
        <section
          ref={resultSectionRef}
          className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                Synthèse
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Résultats & dashboard de rentabilité
              </h2>
              <p className="text-xs text-slate-500">
                Lancez le calcul puis analysez en détail vos chiffres.
              </p>
            </div>

            {hasSimulation && (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handleSaveProject}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-full border border-emerald-500/80 bg-emerald-500 px-3 py-1.5 text-[0.7rem] font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:opacity-60"
                >
                  {saving ? "Sauvegarde..." : "Sauvegarder le projet"}
                </button>
                <button
                  onClick={handlePrintPDF}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Export PDF (impression)
                </button>
                <button
                  type="button"
                  onClick={handleRequestPremiumAnalysis}
                  className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300"
                >
                  Demander une optimisation (service payant)
                </button>
                {saveMessage && (
                  <p className="text-[0.65rem] text-slate-500 text-right max-w-[240px]">
                    {saveMessage}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <button
              onClick={handleCalculRendement}
              className={primaryNavButtonClass}
            >
              Calculer / Mettre à jour la rentabilité
            </button>
            <p className="text-xs text-slate-500">
              Assurez-vous que les onglets Coûts, Revenus, Charges et Crédit sont
              correctement renseignés pour une analyse cohérente.
            </p>
          </div>

          {hasSimulation ? (
            <>
              {/* Cartes de synthèse */}
              <div className="grid gap-4 sm:grid-cols-4 mt-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Coût total projet
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(graphData!.coutTotal)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Rendement brut
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(graphData!.rendementBrut)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Rendement net avant crédit
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(graphData!.rendementNetAvantCredit)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Mensualité totale crédit + assurance
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(graphData!.mensualiteCredit)}
                  </p>
                </div>
              </div>

              {/* Cash-flow & résultat */}
              <div className="grid gap-4 sm:grid-cols-3 mt-4">
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
                          (resumeRendement!.cashflowMensuel >= 0
                            ? "text-emerald-700"
                            : "text-red-600")
                        }
                      >
                        {formatEuro(resumeRendement!.cashflowMensuel)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Résultat net annuel
                      </p>
                      <p
                        className={
                          "mt-1 text-lg font-semibold " +
                          (resumeRendement!.resultatNetAnnuel >= 0
                            ? "text-emerald-700"
                            : "text-red-600")
                        }
                      >
                        {formatEuro(resumeRendement!.resultatNetAnnuel)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Rendement net
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatPct(resumeRendement!.rendementNetAvantCredit)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Durée du crédit
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {graphData!.dureeCredLoc} ans
                  </p>
                  <p className="mt-2 text-[0.7rem] text-slate-500">
                    Le graphique de droite illustre l&apos;accumulation théorique
                    du cash-flow sur la durée du prêt (hors revalorisation et
                    fiscalité).
                  </p>
                </div>
              </div>

              {/* Graphiques */}
              <div className="grid gap-4 lg:grid-cols-2 mt-4">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-600 mb-2">
                    Flux annuels : loyers bruts, charges, crédit + assurance et
                    résultat net.
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
                    Cash-flow cumulé année par année (hypothèse de paramètres
                    constants).
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

              {/* Analyse narrative aérée */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mt-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                  Analyse détaillée
                </p>
                {renderAnalysisBlocks(resultRendementTexte)}
              </div>

              {/* 🔥 Bloc Analyse Premium & optimisation locative */}
              <div className="mt-5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-amber-50 to-emerald-50 px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-700">
                    Service d&apos;accompagnement
                  </p>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                    Analyse Premium & optimisation de votre investissement locatif
                  </h3>
                  <p className="text-[0.8rem] text-slate-700">
                    Transformez cette simulation en plan d&apos;action concret : choix
                    du régime fiscal, stratégie d&apos;arbitrage, scénarios de loyers
                    et présentation prête à l&apos;emploi pour votre banquier.
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[0.75rem] text-slate-700">
                    <li>• Audit détaillé de votre projet à partir de ces chiffres</li>
                    <li>• 2–3 scénarios d&apos;optimisation (fiscalité, durée, loyers…)</li>
                    <li>• Recommandations écrites et priorisées</li>
                    <li>• Synthèse claire à envoyer à la banque / au conseiller</li>
                  </ul>
                </div>
                <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
                  <div className="text-right">
                    {/* 💬 adapte librement le tarif ici */}
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.18em]">
                      Prestation sur mesure
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      Tarif sur devis
                    </p>
                    <p className="text-[0.7rem] text-slate-500">
                      Facturation distincte de l&apos;abonnement.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestPremiumAnalysis}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white shadow-md hover:bg-slate-800"
                  >
                    Demander une optimisation personnalisée
                  </button>
                  <p className="text-[0.65rem] text-slate-500 max-w-[220px] text-right">
                    Votre mail prérempli inclura automatiquement les chiffres de
                    cette simulation pour que je puisse commencer à travailler.
                  </p>
                </div>
              </div>

              <p className="mt-2 text-[0.7rem] text-slate-500">
                Ces calculs sont fournis à titre indicatif, hors fiscalité et
                évolution future des loyers, taux, charges et réglementation.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Complétez les onglets Coûts, Revenus, Charges et Crédit, puis
              cliquez sur “Calculer / Mettre à jour la rentabilité” ou sur
              “Aller aux résultats” pour afficher le dashboard détaillé et accéder
              à l&apos;offre d&apos;optimisation.
            </p>
          )}
        </section>
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
