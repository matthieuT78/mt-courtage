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

// 🔎 Aligné avec la réponse de /api/market-benchmarks
type MarketBenchmarks = {
  inseeCode: string;
  cityName: string;
  postalCode: string;
  referencePriceM2Sale: number | null; // €/m² à l'achat
  referenceRentM2: number | null; // €/m² / mois
  source?: string | null;
};

type CitySuggestion = {
  name: string;
  postalCode: string;
  inseeCode: string;
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
  // Onglets
  const [onglet, setOnglet] = useState<Onglet>("couts");

  // Prix / coûts
  const [prixBien, setPrixBien] = useState(200000);
  const [fraisNotaire, setFraisNotaire] = useState(Math.round(200000 * 0.075));
  const [notaireCustom, setNotaireCustom] = useState(false);

  const [fraisAgence, setFraisAgence] = useState(Math.round(200000 * 0.04));
  const [agenceCustom, setAgenceCustom] = useState(false);

  const [travaux, setTravaux] = useState(10000);

  // 🔗 Lien d'annonce (Leboncoin, SeLoger…)
  const [listingUrl, setListingUrl] = useState("");

  // 📍 Surface (pour analyse marché)
  const [surfaceM2, setSurfaceM2] = useState<number>(0);

  // Auto-complétion ville / CP
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

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

  // 🧮 Score d'opportunité & axes d'amélioration
  const [opportunityScore, setOpportunityScore] = useState<number | null>(null);
  const [opportunityComment, setOpportunityComment] = useState<string>("");
  const [opportunityImprovements, setOpportunityImprovements] = useState<
    string[]
  >([]);

  // 🔎 Données marché (prix / m² & loyer / m²)
  const [marketPriceM2, setMarketPriceM2] = useState<number | null>(null);
  const [marketRentM2, setMarketRentM2] = useState<number | null>(null);
  const [marketSource, setMarketSource] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);

  // Sauvegarde projet
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Référence pour scroller vers les résultats
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  // --- Helpers d'affichage ---

  const selectedCityLabel =
    selectedCity != null
      ? `${selectedCity.name} (${selectedCity.postalCode})`
      : cityQuery.trim().length > 0
      ? cityQuery.trim()
      : "";

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

  // --- Auto-complétion ville / code postal ---

  const fetchCitySuggestions = async (q: string) => {
    const query = q.trim();
    if (query.length < 2) {
      setCitySuggestions([]);
      setCityError(null);
      return;
    }

    try {
      setCityLoading(true);
      setCityError(null);
      const res = await fetch(
        `/api/cities-search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) {
        throw new Error("Impossible de récupérer les communes pour cette saisie.");
      }
      const data = (await res.json()) as CitySuggestion[];
      setCitySuggestions(data || []);
      setShowCitySuggestions(true);
    } catch (err: any) {
      console.error("Erreur auto-complétion ville:", err);
      setCityError(
        err?.message ||
          "Erreur lors de la récupération des communes, réessayez plus tard."
      );
      setCitySuggestions([]);
      setShowCitySuggestions(false);
    } finally {
      setCityLoading(false);
    }
  };

  const handleCityInputChange = (value: string) => {
    setCityQuery(value);
    setSelectedCity(null); // on invalide la ville sélectionnée précédente
    setShowCitySuggestions(true);
    void fetchCitySuggestions(value);
  };

  const handleSelectCity = (city: CitySuggestion) => {
    setSelectedCity(city);
    setCityQuery(`${city.name} (${city.postalCode})`);
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    setCityError(null);
  };

  // --- Récupération des benchmarks marché via API interne ---

  const fetchMarketBenchmarks = async (
    city: CitySuggestion,
    surface: number
  ): Promise<MarketBenchmarks | null> => {
    try {
      setMarketLoading(true);
      setMarketError(null);

      const params = new URLSearchParams({
        inseeCode: city.inseeCode,
        postalCode: city.postalCode,
        cityName: city.name,
      });
      if (surface > 0) {
        params.set("surface", surface.toString());
      }

      const res = await fetch(`/api/market-benchmarks?${params.toString()}`);
      const raw = await res.json();

      // 🔍 Log pour voir exactement ce que renvoie l’API
      console.log("[market-benchmarks] raw response", raw);

      if (!res.ok) {
        const msg =
          (raw && raw.error) ||
          "Impossible de récupérer les données marché pour cette localité.";
        throw new Error(msg);
      }

      // 🔄 Supporte plusieurs formats possibles:
      //  - { inseeCode, cityName, ... }
      //  - { data: { inseeCode, cityName, ... }, error?: string }
      const payload: any =
        raw && raw.data && !("referencePriceM2Sale" in raw)
          ? raw.data
          : raw;

      // Si l’API renvoie { error: "..." } en 200
      if (payload && payload.error && !payload.referencePriceM2Sale) {
        throw new Error(payload.error);
      }

      const data = payload as MarketBenchmarks;

      setMarketPriceM2(
        typeof data.referencePriceM2Sale === "number"
          ? data.referencePriceM2Sale
          : null
      );
      setMarketRentM2(
        typeof data.referenceRentM2 === "number"
          ? data.referenceRentM2
          : null
      );
      setMarketSource(data.source ?? null);

      return data;
    } catch (err: any) {
      console.error("Market benchmarks error:", err);
      setMarketError(
        err?.message ||
          "Erreur lors de la récupération des données marché pour cette zone."
      );
      setMarketPriceM2(null);
      setMarketRentM2(null);
      setMarketSource(null);
      return null;
    } finally {
      setMarketLoading(false);
    }
  };

  // --- Calcul principal ---

  const handleCalculRendement = async () => {
    setSaveMessage(null); // reset message sauvegarde
    // reset du score & des axes d'amélioration à chaque calcul
    setOpportunityScore(null);
    setOpportunityComment("");
    setOpportunityImprovements([]);
    setMarketError(null);

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

    // 📊 Option : récupération des données marché si ville sélectionnée + surface renseignée
    let market: MarketBenchmarks | null = null;
    if (selectedCity && surfaceM2 > 0) {
      market = await fetchMarketBenchmarks(selectedCity, surfaceM2);
    }

    // 🔢 Score de rentabilité (1 à 10) + axes d'amélioration
    let score = 5;
    if (rendementNetAvantCredit >= 8) score = 9;
    else if (rendementNetAvantCredit >= 6) score = 8;
    else if (rendementNetAvantCredit >= 4) score = 7;
    else if (rendementNetAvantCredit >= 3) score = 6;
    else if (rendementNetAvantCredit >= 2) score = 5;
    else score = 3;

    if (cashflowMensuel < 0) score -= 1;
    if (cashflowMensuel > 200) score += 1;
    if (cashflowMensuel > 400) score += 1;

    const improvements: string[] = [];

    // Analyse marché : prix au m² & loyer au m²
    let prixM2Annonce: number | null = null;
    let ecartPrixPourcent: number | null = null;
    let loyerM2Annonce: number | null = null;
    let ecartLoyerPourcent: number | null = null;

    if (surfaceM2 > 0) {
      prixM2Annonce = prixBien / surfaceM2;

      if (market?.referencePriceM2Sale) {
        ecartPrixPourcent =
          ((prixM2Annonce - market.referencePriceM2Sale) /
            market.referencePriceM2Sale) *
          100;
      }

      if (market?.referenceRentM2) {
        loyerM2Annonce = loyerTotalMensuel / surfaceM2;
        ecartLoyerPourcent =
          ((loyerM2Annonce - market.referenceRentM2) /
            market.referenceRentM2) *
          100;
      }
    }

    // Ajustement du score en fonction du prix au m² marché
    if (ecartPrixPourcent !== null) {
      if (ecartPrixPourcent > 20) {
        score -= 2;
      } else if (ecartPrixPourcent > 10) {
        score -= 1;
      } else if (ecartPrixPourcent < -5) {
        score += 1; // sous le marché : intéressant
      }
    }

    // Ajustement du score en fonction du loyer au m²
    if (ecartLoyerPourcent !== null && market?.referenceRentM2) {
      if (ecartLoyerPourcent > 25) {
        // loyer trop optimiste
        score -= 1;
      } else if (ecartLoyerPourcent < -10) {
        // loyer sous le marché -> potentiel d'upside
        improvements.push(
          `Votre loyer envisagé semble en dessous du loyer médian local. Le marché suggère un loyer autour de ${formatEuro(
            market.referenceRentM2 * surfaceM2
          )} par mois pour cette surface, ce qui offre une marge potentielle de revalorisation.`
        );
      }
    }

    score = Math.max(1, Math.min(10, score));

    let comment: string;
    if (score >= 9) {
      comment = "Opportunité très rentable et bien positionnée sur son marché.";
    } else if (score >= 7) {
      comment =
        "Projet globalement intéressant, avec quelques paramètres à affiner (prix, loyer ou financement).";
    } else if (score >= 5) {
      comment =
        "Projet correct mais tendu : une optimisation est recommandée avant de signer.";
    } else {
      comment =
        "Projet fragile : à retravailler en profondeur (prix, loyer, durée de crédit ou travaux).";
    }

    // Loyer cible pour cash-flow neutre
    const neutralLoyersAnnuels = chargesTotales + annuiteTotale;
    const neutralLoyerMensuel = neutralLoyersAnnuels / 12;
    const deltaLoyerMensuel = neutralLoyerMensuel - loyerTotalMensuel;

    if (deltaLoyerMensuel > 20) {
      improvements.push(
        `Pour atteindre un cash-flow neutre, le loyer global devrait se situer autour de ${formatEuro(
          neutralLoyerMensuel
        )} par mois (soit environ ${formatEuro(
          deltaLoyerMensuel
        )} de plus que vos loyers actuels).`
      );
    }

    // Marge de négociation sur le coût global pour viser un net "cible"
    const cibleNet = 5; // 5 % net avant crédit
    if (rendementNetAvantCredit < cibleNet && revenuNetAvantCredit > 0.01) {
      const coutCible = revenuNetAvantCredit / (cibleNet / 100);
      if (coutCible < coutTotal) {
        const margeNegociation = coutTotal - coutCible;
        if (margeNegociation > 1000) {
          improvements.push(
            `Pour viser un rendement net avant crédit d'environ ${formatPct(
              cibleNet
            )}, il faudrait réduire le coût global du projet d'environ ${formatEuro(
              margeNegociation
            )} (négociation du prix, optimisation des travaux ou des frais).`
          );
        }
      }
    }

    if (cashflowMensuel < 0) {
      improvements.push(
        "Vous pouvez réduire l'effort d'épargne en allongeant la durée du crédit, en ajustant le montant de l'apport ou en mixant une partie du projet en location saisonnière (si le marché local le permet)."
      );
    }

    // Recommandation spécifique sur le prix au m²
    if (
      ecartPrixPourcent !== null &&
      market?.referencePriceM2Sale &&
      surfaceM2 > 0
    ) {
      if (ecartPrixPourcent > 10) {
        const prixCibleM2 = market.referencePriceM2Sale * 1.05; // marché +5%
        const prixCible = prixCibleM2 * surfaceM2;
        const margePrix = prixBien - prixCible;
        if (margePrix > 1000) {
          improvements.push(
            `Le prix au m² de l'annonce semble supérieur au marché local d'environ ${ecartPrixPourcent.toFixed(
              1
            )} %. Une cible de prix autour de ${formatEuro(
              prixCible
            )} (soit ~${formatEuro(
              margePrix
            )} de moins) permettrait de repositionner ce bien dans une zone plus cohérente avec les ventes observées.`
          );
        }
      } else if (ecartPrixPourcent < -5) {
        improvements.push(
          `Le prix au m² de l'annonce apparaît inférieur au marché local d'environ ${Math.abs(
            ecartPrixPourcent
          ).toFixed(
            1
          )} %, ce qui renforce l'intérêt de cette opportunité (sous réserve de la qualité du bien et de son état réel).`
        );
      }
    }

    if (improvements.length === 0) {
      improvements.push(
        "Le projet est déjà bien équilibré. Les principaux leviers restent la négociation fine du prix, la qualité du locataire et la maîtrise des charges dans le temps."
      );
    }

    setOpportunityScore(score);
    setOpportunityComment(comment);
    setOpportunityImprovements(improvements);

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
          )}. Présenté correctement, cet effort peut être perçu comme une contribution maîtrisée à un actif patrimonial, surtout si l’emplacement et le potentiel de revalorisation à long terme sont solides.`,
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

  const handleGoToResults = async () => {
    await handleCalculRendement();
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
      listingUrl
        ? `Lien de l'annonce analysée : ${listingUrl}`
        : "(Aucun lien d'annonce n'a été renseigné dans la simulation.)",
      selectedCityLabel
        ? `Localité du bien : ${selectedCityLabel}`
        : "(Localité non renseignée dans la simulation.)",
      surfaceM2 > 0
        ? `Surface : ${surfaceM2.toLocaleString("fr-FR", {
            maximumFractionDigits: 0,
          })} m²`
        : "(Surface non renseignée dans la simulation.)",
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
            listingUrl,
            localite: selectedCityLabel,
            surfaceM2,
            city: selectedCity
              ? {
                  name: selectedCity.name,
                  postalCode: selectedCity.postalCode,
                  inseeCode: selectedCity.inseeCode,
                }
              : null,
          },
          resume: resumeRendement,
          graphData,
          analyse: resultRendementTexte,
          market: {
            referencePriceM2Sale: marketPriceM2,
            referenceRentM2: marketRentM2,
            source: marketSource,
          },
          opportunity: {
            score: opportunityScore,
            comment: opportunityComment,
            improvements: opportunityImprovements,
          },
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

              {/* 📍 Localité & surface (optionnels) */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="relative space-y-1 sm:col-span-2">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Localité du bien (optionnel)
                    <InfoBadge text="Tapez un code postal ou le nom de la commune, puis sélectionnez dans la liste. Cela permet de comparer le prix et les loyers à des données publiques (via votre API marché)." />
                  </label>
                  <input
                    type="text"
                    value={cityQuery}
                    onChange={(e) => handleCityInputChange(e.target.value)}
                    onFocus={() => {
                      if (citySuggestions.length > 0) {
                        setShowCitySuggestions(true);
                      }
                    }}
                    placeholder="Ex. 75015, Paris, Lyon, Cargèse…"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {cityLoading && (
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Recherche des communes…
                    </p>
                  )}
                  {cityError && (
                    <p className="mt-1 text-[0.7rem] text-red-600">
                      {cityError}
                    </p>
                  )}

                  {showCitySuggestions && citySuggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {citySuggestions.map((city) => (
                        <button
                          key={`${city.inseeCode}-${city.postalCode}`}
                          type="button"
                          onClick={() => handleSelectCity(city)}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                        >
                          <span>
                            {city.name}{" "}
                            <span className="text-slate-500">
                              ({city.postalCode})
                            </span>
                          </span>
                          <span className="text-[0.65rem] text-slate-400">
                            INSEE {city.inseeCode}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Surface habitable (m²)
                    <InfoBadge text="Permet de calculer le prix au m² de l'annonce et de le comparer au marché, ainsi que le loyer au m²." />
                  </label>
                  <input
                    type="number"
                    value={surfaceM2 || ""}
                    onChange={(e) =>
                      setSurfaceM2(parseFloat(e.target.value) || 0)
                    }
                    placeholder="Ex. 55"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* 🔗 Lien annonce (optionnel) */}
              <div className="space-y-1">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Lien de l&apos;annonce (optionnel)
                  <InfoBadge text="Collez ici le lien Leboncoin, SeLoger, PAP… Il sert de référence dans vos rapports et dans le bloc d’analyse, mais n’est pas aspiré automatiquement." />
                </label>
                <input
                  type="url"
                  value={listingUrl}
                  onChange={(e) => setListingUrl(e.target.value)}
                  placeholder="https://www.leboncoin.fr/... ou https://www.seloger.com/..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[0.7rem] text-slate-500">
                  Optionnel, mais très pratique pour rattacher cette simulation à
                  une annonce précise.
                </p>
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
                    onChange={(e) =>
                      setTaxeFonc(parseFloat(e.target.value))
                    }
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
                    onChange={(e) =>
                      setAssurance(parseFloat(e.target.value))
                    }
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
                  onChange={(e) =>
                    setTauxGestion(parseFloat(e.target.value))
                  }
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
              {marketError && (
                <p className="mt-1 text-[0.7rem] text-red-600">
                  {marketError}
                </p>
              )}
              {marketLoading && (
                <p className="mt-1 text-[0.7rem] text-slate-500">
                  Récupération des données marché en cours…
                </p>
              )}
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
              onClick={() => void handleCalculRendement()}
              className={primaryNavButtonClass}
            >
              Calculer / Mettre à jour la rentabilité
            </button>
            <p className="text-xs text-slate-500">
              Assurez-vous que les onglets Coûts, Revenus, Charges et Crédit sont
              correctement renseignés. La localité + surface permettent une
              analyse marché plus fine, mais restent optionnelles.
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
                        {formatPct(
                          resumeRendement!.rendementNetAvantCredit
                        )}
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

              {/* 🔍 Encadré dédié à l'annonce / analyse marché */}
              {(listingUrl || opportunityScore !== null || selectedCityLabel) && (
                <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-indigo-700">
                        Analyse de l&apos;annonce
                      </p>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                        Plan de financement & rentabilité du bien analysé
                      </h3>
                      {listingUrl && (
                        <a
                          href={listingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center text-[0.75rem] text-indigo-700 underline break-all"
                        >
                          Voir l&apos;annonce associée
                        </a>
                      )}
                      {selectedCityLabel && (
                        <p className="mt-1 text-[0.75rem] text-slate-700">
                          Localité :{" "}
                          <span className="font-medium">
                            {selectedCityLabel}
                          </span>
                          {surfaceM2 > 0 && (
                            <>
                              {" "}
                              – Surface :{" "}
                              <span className="font-medium">
                                {surfaceM2.toLocaleString("fr-FR", {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                m²
                              </span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    {opportunityScore !== null && (
                      <div className="shrink-0 text-right">
                        <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                          Score de rentabilité
                        </p>
                        <p className="text-xl font-semibold text-slate-900">
                          {opportunityScore} / 10
                        </p>
                        <p className="text-[0.7rem] text-slate-600">
                          {opportunityComment}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Comparaison marché : prix / m² & loyer / m² */}
                  {surfaceM2 > 0 && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 text-[0.75rem] text-slate-800">
                      <div className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2">
                        <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                          Prix au m² (annonce vs marché)
                        </p>
                        <p className="mt-1">
                          Prix au m² de l&apos;annonce :{" "}
                          <span className="font-semibold">
                            {formatEuro(prixBien / surfaceM2)}
                          </span>
                        </p>
                        {marketPriceM2 ? (
                          <p className="mt-1">
                            Prix au m² estimé marché :{" "}
                            <span className="font-semibold">
                              {formatEuro(marketPriceM2)}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-1 text-[0.7rem] text-slate-500">
                            Données marché non disponibles pour cette localité
                            (vérifiez votre API interne).
                          </p>
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2">
                        <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                          Loyer mensuel au m² (annonce vs marché)
                        </p>
                        <p className="mt-1">
                          Loyer au m² envisagé :{" "}
                          <span className="font-semibold">
                            {graphData!.loyersAnnuels > 0
                              ? formatEuro(
                                  (graphData!.loyersAnnuels / 12) / surfaceM2
                                )
                              : "-"}
                            {" /m²"}
                          </span>
                        </p>
                        {marketRentM2 ? (
                          <p className="mt-1">
                            Loyer mensuel au m² estimé marché :{" "}
                            <span className="font-semibold">
                              {formatEuro(marketRentM2)}
                              {" /m²"}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-1 text-[0.7rem] text-slate-500">
                            Loyer médian non disponible pour cette localité (via
                            votre API interne).
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {marketSource && (
                    <p className="mt-1 text-[0.65rem] text-slate-500">
                      Sources indicatives : {marketSource}.
                    </p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-3 text-[0.75rem] text-slate-800 mt-3">
                    <div>
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Coût global (tout compris)
                      </p>
                      <p className="mt-1 font-semibold">
                        {formatEuro(graphData!.coutTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Cash-flow mensuel estimé
                      </p>
                      <p
                        className={
                          "mt-1 font-semibold " +
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
                        Rendement net avant crédit
                      </p>
                      <p className="mt-1 font-semibold">
                        {formatPct(
                          resumeRendement!.rendementNetAvantCredit
                        )}
                      </p>
                    </div>
                  </div>

                  {opportunityImprovements.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                        Axes d&apos;amélioration possibles
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-[0.75rem] text-slate-700">
                        {opportunityImprovements.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

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
                    Transformez cette simulation en plan d&apos;action concret :
                    choix du régime fiscal, stratégie d&apos;arbitrage, scénarios de
                    loyers et présentation prête à l&apos;emploi pour votre banquier.
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[0.75rem] text-slate-700">
                    <li>• Audit détaillé de votre projet à partir de ces chiffres</li>
                    <li>
                      • Meilleur scénario d&apos;optimisation (fiscalité, durée,
                      loyers…)
                    </li>
                    <li>• Recommandations écrites et priorisées</li>
                    <li>• Synthèse claire à envoyer à la banque / au conseiller</li>
                  </ul>
                </div>
                <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
                  <div className="text-right">
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
                    cette simulation (et la localité / le lien si renseignés) pour
                    que je puisse commencer à travailler.
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
              Complétez les onglets Coûts, Revenus, Charges et Crédit (vous
              pouvez aussi renseigner la localité et la surface pour une analyse
              marché plus fine), puis cliquez sur “Calculer / Mettre à jour la
              rentabilité” ou sur “Aller aux résultats” pour afficher le dashboard
              détaillé et accéder à l&apos;offre d&apos;optimisation.
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
