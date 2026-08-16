// components/InvestissementWizard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import dynamic from "next/dynamic";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ReceiptPercentIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabaseClient";
import { usePermissions } from "./PermissionProvider";
import { useAgenceMode } from "../lib/useAgenceMode";
import ListingAnalysisSection from "./investissement/ListingAnalysisSection";
import CalculatorWizardShell from "./calculators/CalculatorWizardShell";

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

/* ======================== Helpers format ======================== */
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

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function onlyNumberInput(s: string) {
  // autorise vide, chiffres, point, virgule (on stocke en string)
  return (s || "").replace(/[^\d.,]/g, "");
}

function toFloat(v: string, fallback = 0) {
  const norm = (v || "").replace(",", ".").trim();
  if (!norm) return fallback;
  const x = parseFloat(norm);
  return Number.isFinite(x) ? x : fallback;
}

/* ======================== Types ======================== */
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
  // projection patrimoniale
  montantEmprunte: number;
  tauxAnnuelCred: number;
  mensualiteCreditNue: number;
  prixBienSeul: number;
  apportVal: number;
};

type StepKey = "couts" | "revenus" | "charges" | "credit";

type MarketBenchmarks = {
  inseeCode: string;
  cityName: string;
  postalCode: string;
  referencePriceM2Sale: number | null;
  referenceRentM2: number | null;
  source?: string | null;
};

type CitySuggestion = {
  name: string;
  postalCode: string;
  inseeCode: string;
};

/* ======================== Plan d'action ======================== */
type ActionPlanItemType = "blocking" | "warning" | "positive" | "tip";
type ActionPlanItem = { type: ActionPlanItemType; title: string; body: string };

const ACTION_ITEM_CONFIG: Record<
  ActionPlanItemType,
  { Icon: ComponentType<SVGProps<SVGSVGElement>>; badge: string; bg: string; border: string; iconBg: string; iconText: string; titleText: string; badgeCls: string }
> = {
  blocking: { Icon: ExclamationTriangleIcon, badge: "Bloquant",    bg: "bg-red-50",     border: "border-red-200",     iconBg: "bg-red-100",     iconText: "text-red-600",     titleText: "text-red-900",     badgeCls: "bg-red-100 text-red-700" },
  warning:  { Icon: ExclamationCircleIcon,  badge: "A surveiller", bg: "bg-amber-50",   border: "border-amber-200",   iconBg: "bg-amber-100",   iconText: "text-amber-600",   titleText: "text-amber-900",   badgeCls: "bg-amber-100 text-amber-700" },
  positive: { Icon: CheckCircleIcon,        badge: "Atout",        bg: "bg-emerald-50", border: "border-emerald-200", iconBg: "bg-emerald-100", iconText: "text-emerald-600", titleText: "text-emerald-900", badgeCls: "bg-emerald-100 text-emerald-700" },
  tip:      { Icon: LightBulbIcon,          badge: "Conseil",      bg: "bg-indigo-50",  border: "border-indigo-200",  iconBg: "bg-indigo-100",  iconText: "text-indigo-600",  titleText: "text-indigo-900",  badgeCls: "bg-indigo-100 text-indigo-700" },
};

/* ======================== Small UI ======================== */
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

/* ======================== Gate / lead (même UX) ======================== */
const LOKT_INVEST_CONSENT_STORAGE_KEY = "lokt_invest_consent_v1"; // { email: string, consent: true, ts: string }

function getUtmFromUrl(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const sp = new URLSearchParams(window.location.search);
    const keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "msclkid",
    ];
    const utm: Record<string, string> = {};
    for (const k of keys) {
      const v = sp.get(k);
      if (v) utm[k] = v;
    }
    return Object.keys(utm).length ? utm : null;
  } catch {
    return null;
  }
}

function getSourceLabel(): string {
  if (typeof window === "undefined") return "investissement";
  try {
    const ref = document.referrer || "";
    if (!ref) return "direct";
    const refHost = new URL(ref).host;
    const curHost = window.location.host;
    if (refHost && curHost && refHost === curHost) return "internal";
    return `ref:${refHost || "unknown"}`;
  } catch {
    return "direct";
  }
}

/* ======================== Component ======================== */
export default function InvestissementWizard() {
  const { canSeeCalcDetails, isLoggedIn } = usePermissions();

  /* ======================== Session (pré-remplir email) ======================== */
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        const s = data.session;
        if (!mounted) return;
        setSessionEmail(s?.user?.email ?? null);
        setSessionUserId(s?.user?.id ?? null);
      } catch {
        // silence
      }
    };
    run();

    const sub =
      supabase?.auth.onAuthStateChange((_e, s) => {
        setSessionEmail(s?.user?.email ?? null);
        setSessionUserId(s?.user?.id ?? null);
      }) ?? null;

    return () => {
      mounted = false;
      sub?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  const DEFAULT_AIRBNB_OCCUPATION = 60; // % si champ vide

  /* ======================== Steps ======================== */
  const steps: StepKey[] = ["couts", "revenus", "charges", "credit"];
  const [step, setStep] = useState<StepKey>("couts");
  const stepIndex = steps.indexOf(step);
  const progressSteps = [
    { label: "Projet",      icon: BuildingOffice2Icon },
    { label: "Revenus",     icon: BanknotesIcon },
    { label: "Charges",     icon: ReceiptPercentIcon },
    { label: "Financement", icon: CreditCardIcon },
  ];

  const goNext = () => setStep(steps[clamp(stepIndex + 1, 0, steps.length - 1)]);
  const goPrev = () => setStep(steps[clamp(stepIndex - 1, 0, steps.length - 1)]);

  /* ======================== Inputs ======================== */
  // Prix / coûts

  const [prixBien, setPrixBien] = useState<string>("200000");
  const [prixBienError, setPrixBienError] = useState<string | null>(null);
  // ✅ affiché près du bouton "Calculer ma rentabilité" — contrairement à
  // resultRendementTexte, qui n'est jamais rendu dans le JSX (utilisé
  // uniquement pour le payload email/lead).
  const [calculError, setCalculError] = useState<string | null>(null);

  const [fraisNotaire, setFraisNotaire] = useState<string>(String(Math.round(200000 * 0.075)));
  const [notaireCustom, setNotaireCustom] = useState(false);

  const [fraisAgence, setFraisAgence] = useState<string>(String(Math.round(200000 * 0.04)));
  const [agenceCustom, setAgenceCustom] = useState(false);

  const [travaux, setTravaux] = useState<string>("10000");

  // Surface optionnelle (mais plus de 0 forcé)
  const [surfaceM2, setSurfaceM2] = useState<string>("");

  // 🔗 Lien annonce
  const [listingUrl, setListingUrl] = useState("");


  // Auto-complétion ville / CP
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  // Lots
  const [nbApparts, setNbApparts] = useState(1);
  const [nbAppartsInput, setNbAppartsInput] = useState("1");
  const [loyersApparts, setLoyersApparts] = useState<string[]>(["900"]);
  const [airbnbNuitees, setAirbnbNuitees] = useState<string[]>(["90"]);
  const [airbnbOccupation, setAirbnbOccupation] = useState<string[]>(["65"]);
  const [locationTypes, setLocationTypes] = useState<LocationType[]>(["longue"]);

  // Charges
  const [chargesCopro, setChargesCopro] = useState<string>("1200");
  const [taxeFonc, setTaxeFonc] = useState<string>("900");
  const [assurance, setAssurance] = useState<string>("200");
  const [tauxGestion, setTauxGestion] = useState<string>("10");

  // Crédit
  const [apport, setApport] = useState<string>("20000");
  const [tauxCredLoc, setTauxCredLoc] = useState<string>("3.5");
  const [dureeCredLoc, setDureeCredLoc] = useState<string>("25");
  const [tauxAssuranceEmp, setTauxAssuranceEmp] = useState<string>("0.25");

  /* ======================== Results ======================== */
  const [resultRendementTexte, setResultRendementTexte] = useState<string>("");
  const [resumeRendement, setResumeRendement] = useState<ResumeRendement | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  const [opportunityScore, setOpportunityScore] = useState<number | null>(null);
  const [opportunityComment, setOpportunityComment] = useState<string>("");
  const [opportunityImprovements, setOpportunityImprovements] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<ActionPlanItem[]>([]);

  const [revaloToggle, setRevaloToggle] = useState<boolean>(false);

  const [marketPriceM2, setMarketPriceM2] = useState<number | null>(null);
  const [marketRentM2, setMarketRentM2] = useState<number | null>(null);
  const [marketSource, setMarketSource] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);

  /* ======================== Gate states ======================== */
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [leadPhone, setLeadPhone] = useState<string>("");
  const [consentContact, setConsentContact] = useState<boolean>(false);
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);
  const [sendByEmail] = useState<boolean>(true);
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [sendEmailMsg, setSendEmailMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LOKT_INVEST_CONSENT_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const email = (data?.email || "").toString().trim().toLowerCase();
      const ok = !!data?.consent;
      if (email && ok) {
        setLeadEmail((prev) => (prev ? prev : email));
        setUnlocked(true);
      }
    } catch {
      // silence
    }
  }, []);

  useEffect(() => {
    if (sessionEmail && !leadEmail) setLeadEmail(sessionEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail]);

  const normalizedLeadEmail = (leadEmail || "").trim().toLowerCase();
  const leadEmailValid =
    normalizedLeadEmail.length > 3 && normalizedLeadEmail.includes("@");

  /* ======================== Derived ======================== */
  const selectedCityLabel =
    selectedCity != null
      ? `${selectedCity.name} (${selectedCity.postalCode})`
      : cityQuery.trim().length > 0
      ? cityQuery.trim()
      : "";

  const hasAirbnb =
    nbApparts > 0 && locationTypes.slice(0, nbApparts).some((t) => t === "airbnb");

  const hasSimulation = !!resumeRendement && !!graphData;

  const surfaceNum = useMemo(() => toFloat(surfaceM2, 0), [surfaceM2]);
  const prixNum = useMemo(() => toFloat(prixBien, 0), [prixBien]);

  const canShowAnalysis =
  hasSimulation && surfaceNum > 0 && (selectedCity !== null || cityQuery.trim().length > 0);
  const isAgence = useAgenceMode();
  const canShowFullDetails = (canSeeCalcDetails && isLoggedIn) || unlocked || isAgence;

  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!graphData) return;
    const t = setTimeout(() => {
      resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(t);
  }, [graphData]);

  /* ======================== Handlers ======================== */
  const handlePrixBienChange = (raw: string) => {
    setPrixBienError(null);
    const v = onlyNumberInput(raw);
    setPrixBien(v);

    const newPrix = toFloat(v, 0);
    if (!notaireCustom && v.trim() !== "") setFraisNotaire(String(Math.round(newPrix * 0.075)));
    if (!agenceCustom && v.trim() !== "") setFraisAgence(String(Math.round(newPrix * 0.04)));
  };

  const handleNbAppartsChange = (raw: string) => {
    setNbAppartsInput(raw);

    if (raw.trim() === "") return;

    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;

    const n = clamp(parsed, 1, 10);
    setNbAppartsInput(String(n));
    setNbApparts(n);

    setLoyersApparts((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push("");
      return arr.slice(0, n);
    });

    setLocationTypes((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push("longue");
      return arr.slice(0, n);
    });

    setAirbnbNuitees((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push("90");
      return arr.slice(0, n);
    });

    setAirbnbOccupation((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push("65");
      return arr.slice(0, n);
    });
  };

    const handleLoyerAppartChange = (index: number, value: string) => {
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

  const handleAirbnbNuiteeChange = (index: number, value: string) => {
    setAirbnbNuitees((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleAirbnbOccupationChange = (index: number, value: string) => {
    setAirbnbOccupation((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

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
      const res = await fetch(`/api/cities-search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Impossible de récupérer les communes pour cette saisie.");
      const data = (await res.json()) as CitySuggestion[];
      setCitySuggestions(data || []);
      setShowCitySuggestions(true);
      if (!data?.length && query.length >= 3) {
        setCityError("Aucune commune trouvée. Essayez avec le code postal seul ou le nom de la ville sans le quartier.");
      }
    } catch (err: any) {
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
    setSelectedCity(null);
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
      if (surface > 0) params.set("surface", surface.toString());

      const res = await fetch(`/api/market-benchmarks?${params.toString()}`);
      const raw = await res.json();

      if (!res.ok) {
        const msg =
          (raw && raw.error) ||
          "Impossible de récupérer les données marché pour cette localité.";
        throw new Error(msg);
      }

      const payload: any =
        raw && raw.data && !("referencePriceM2Sale" in raw) ? raw.data : raw;

      if (payload && payload.error && !payload.referencePriceM2Sale) {
        throw new Error(payload.error);
      }

      const data = payload as MarketBenchmarks;

      setMarketPriceM2(
        typeof data.referencePriceM2Sale === "number" ? data.referencePriceM2Sale : null
      );
      setMarketRentM2(
        typeof data.referenceRentM2 === "number" ? data.referenceRentM2 : null
      );
      setMarketSource(data.source ?? null);

      return data;
    } catch (err: any) {
      setMarketError(
        err?.message || "Erreur lors de la récupération des données marché pour cette zone."
      );
      setMarketPriceM2(null);
      setMarketRentM2(null);
      setMarketSource(null);
      return null;
    } finally {
      setMarketLoading(false);
    }
  };

  /* ======================== Lead payload + RPC ======================== */
  const buildLeadPayload = () => {
    return {
      meta: { tool: "investissement", version: "v2_wizard" },
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
          ? { name: selectedCity.name, postalCode: selectedCity.postalCode, inseeCode: selectedCity.inseeCode }
          : null,
      },
      output: {
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
      tracking: {
        source: getSourceLabel(),
        utm: (typeof window !== "undefined" ? getUtmFromUrl() : null) ?? null,
        referrer: typeof window !== "undefined" ? document.referrer || null : null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        createdAtClient: new Date().toISOString(),
      },
      user: { user_id: sessionUserId || null, email: sessionEmail || null },
        consent: {
        consent_contact: consentContact,
        consent_analysis: true,
      },
        
    };
  };

  const buildEmailComputed = () => {
    const lead = buildLeadPayload();
    return {
      inputs: lead.inputs,
      output: lead.output,
      meta: lead.meta,
      tracking: lead.tracking,
    };
  };

    const captureLeadViaRpc = async (params: {
      email: string;
      payload: any;
    }) => {
    if (!supabase) throw new Error("Supabase non configuré.");

    const email = params.email.trim().toLowerCase();
    if (!email) throw new Error("Email manquant.");

    const utm = (typeof window !== "undefined" ? getUtmFromUrl() : null) ?? null;
    const source = getSourceLabel();

    const { error } = await supabase.rpc("upsert_lead_v1", {
      p_tool: "investissement",
      p_email: email,
      p_payload: params.payload,
      p_postal_code: selectedCity?.postalCode ?? null,
      p_city: selectedCity?.name ?? null,
      p_phone: leadPhone.trim() || null,
      p_source: source,
      p_utm: utm,
      p_lead_age: null,
      p_project_property_kind: null,
      p_project_usage: null,
      p_project_timeline: null,
      // ✅ prixBien est un texte (accepte la virgule) — envoyer la chaîne
      // brute à un paramètre numérique Postgres fait planter le RPC dès
      // qu'un prix contient une virgule décimale (ex : "250000,50").
      p_project_budget_target: Math.round(toFloat(prixBien, 0)) || null,
    });

    if (error) throw new Error(error.message || "Erreur RPC");
  };

  /* ======================== Calcul principal ======================== */
  const handleCalculRendement = async () => {
    setCalculError(null);
    setOpportunityScore(null);
    setOpportunityComment("");
    setOpportunityImprovements([]);
    setMarketError(null);

    const prix = toFloat(prixBien, 0);
    const notaire = toFloat(fraisNotaire, 0);
    const trvx = toFloat(travaux, 0);
    const agence = toFloat(fraisAgence, 0);

    const copro = toFloat(chargesCopro, 0);
    const tax = toFloat(taxeFonc, 0);
    const assurPNO = toFloat(assurance, 0);
    // ✅ garde-fous : un taux saisi de façon incohérente (ex : 500% de
    // frais de gestion) ne doit pas produire un résultat silencieusement
    // absurde.
    const gestionPct = clamp(toFloat(tauxGestion, 0), 0, 100) / 100;

    const apportVal = toFloat(apport, 0);
    const tAnnuelCred = clamp(toFloat(tauxCredLoc, 0), 0, 20) / 100;
    const nMensualites = Math.round(toFloat(dureeCredLoc, 0) * 12);
    const tAssEmp = clamp(toFloat(tauxAssuranceEmp, 0), 0, 10) / 100;

    const coutTotal = prix + notaire + trvx + agence;

   // loyers
    const loyersMensuelsArray: number[] = [];
    for (let i = 0; i < nbApparts; i++) {
      const type = locationTypes[i] || "longue";

      if (type === "longue") {
        loyersMensuelsArray.push(toFloat(loyersApparts[i] ?? "", 0));
      } else {
        const prixNuit = toFloat(airbnbNuitees[i] ?? "", 0);
        const occRaw = (airbnbOccupation[i] ?? "").trim();
        const occ = clamp(
          occRaw ? toFloat(occRaw, DEFAULT_AIRBNB_OCCUPATION) : DEFAULT_AIRBNB_OCCUPATION,
          0,
          100
        );

        const tauxOcc = occ / 100;
        const revenuAnnuelAirbnb = prixNuit * tauxOcc * 365;
        loyersMensuelsArray.push(revenuAnnuelAirbnb / 12);
      }
    }

    const loyerTotalMensuel = loyersMensuelsArray.reduce((sum, v) => sum + (v || 0), 0);
    const loyersAnnuels = loyerTotalMensuel * 12;

    if (coutTotal <= 0 || loyersAnnuels <= 0) {
      const msg = "Merci de renseigner un prix, des frais et des loyers cohérents pour au moins un appartement.";
      setResultRendementTexte(msg);
      setCalculError(msg);
      setGraphData(null);
      setResumeRendement(null);
      return;
    }

    // ✅ si un crédit est nécessaire (apport < coût total) mais la durée est
    // vide/à 0, le remboursement du capital serait silencieusement annulé
    // (mensualité = 0) tout en gardant l'assurance emprunteur active — cash-
    // flow artificiellement optimiste et capital restant dû qui augmente au
    // lieu de diminuer dans la projection. On bloque plutôt qu'on ne laisse
    // passer un résultat incohérent.
    if (coutTotal - (apportVal || 0) > 0 && nMensualites <= 0) {
      const msg = "Merci de renseigner une durée de crédit (en années) pour financer le montant emprunté, ou augmentez l'apport pour couvrir tout le projet sans crédit.";
      setResultRendementTexte(msg);
      setCalculError(msg);
      setGraphData(null);
      setResumeRendement(null);
      return;
    }

    const rendementBrut = (loyersAnnuels / coutTotal) * 100;

    const fraisGestion = loyersAnnuels * gestionPct;
    const chargesTotales = copro + tax + assurPNO + fraisGestion;

    const revenuNetAvantCredit = loyersAnnuels - chargesTotales;
    const rendementNetAvantCredit = (revenuNetAvantCredit / coutTotal) * 100;

    const montantEmprunte = Math.max(coutTotal - (apportVal || 0), 0);
    const tMensuel = (tAnnuelCred || 0) / 12;

    let mensualiteCreditNue = 0;
    if (montantEmprunte > 0 && nMensualites > 0) {
      if (tMensuel === 0) {
        mensualiteCreditNue = montantEmprunte / nMensualites;
      } else {
        const facteur = Math.pow(1 + tMensuel, nMensualites);
        mensualiteCreditNue = montantEmprunte * ((tMensuel * facteur) / (facteur - 1));
      }
    }
    const annuiteCreditNue = mensualiteCreditNue * 12;

    const annuiteAssuranceEmp = montantEmprunte * (tAssEmp || 0);
    const mensualiteAssuranceEmp = annuiteAssuranceEmp / 12;

    const mensualiteTotale = mensualiteCreditNue + mensualiteAssuranceEmp;
    const annuiteTotale = annuiteCreditNue + annuiteAssuranceEmp;

    const resultatNetAnnuel = revenuNetAvantCredit - annuiteTotale;
    const cashflowMensuel = resultatNetAnnuel / 12;

    let market: MarketBenchmarks | null = null;
    if (selectedCity && surfaceNum > 0) {
    market = await fetchMarketBenchmarks(selectedCity, surfaceNum);
    }

    // score
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

    let ecartPrixPourcent: number | null = null;
    let ecartLoyerPourcent: number | null = null;

    if (surfaceNum > 0) {
      const prixM2Annonce = prix / surfaceNum;

      if (market?.referencePriceM2Sale) {
        ecartPrixPourcent = ((prixM2Annonce - market.referencePriceM2Sale) / market.referencePriceM2Sale) * 100;
      }

      if (market?.referenceRentM2) {
        const loyerM2Annonce = loyerTotalMensuel / surfaceNum;
        ecartLoyerPourcent = ((loyerM2Annonce - market.referenceRentM2) / market.referenceRentM2) * 100;
      }
    }

    if (ecartPrixPourcent !== null) {
      if (ecartPrixPourcent > 20) score -= 2;
      else if (ecartPrixPourcent > 10) score -= 1;
      else if (ecartPrixPourcent < -5) score += 1;
    }

    if (ecartLoyerPourcent !== null && market?.referenceRentM2) {
      if (ecartLoyerPourcent > 25) {
        score -= 1;
      } else if (ecartLoyerPourcent < -10) {
        improvements.push(
          `Votre loyer envisagé semble en dessous du loyer médian local. Le marché suggère un loyer autour de ${formatEuro(
            market.referenceRentM2 * surfaceNum
          )} par mois pour cette surface, ce qui offre une marge potentielle de revalorisation.`
        );
      }
    }

    score = clamp(score, 1, 10);

    let comment: string;
    if (score >= 9) comment = "Opportunité très rentable et bien positionnée sur son marché.";
    else if (score >= 7)
      comment =
        "Projet globalement intéressant, avec quelques paramètres à affiner (prix, loyer ou financement).";
    else if (score >= 5)
      comment = "Projet correct mais tendu : une optimisation est recommandée avant de signer.";
    else comment = "Projet fragile : à retravailler en profondeur (prix, loyer, durée de crédit ou travaux).";

    const neutralLoyersAnnuels = chargesTotales + annuiteTotale;
    const neutralLoyerMensuel = neutralLoyersAnnuels / 12;
    const deltaLoyerMensuel = neutralLoyerMensuel - loyerTotalMensuel;

    if (deltaLoyerMensuel > 20) {
      improvements.push(
        `Pour atteindre un cash-flow neutre, le loyer global devrait se situer autour de ${formatEuro(
          neutralLoyerMensuel
        )} par mois (soit environ ${formatEuro(deltaLoyerMensuel)} de plus que vos loyers actuels).`
      );
    }

    const cibleNet = 5;
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

    if (improvements.length === 0) {
      improvements.push(
        "Le projet est déjà bien équilibré. Les principaux leviers restent la négociation fine du prix, la qualité du locataire et la maîtrise des charges dans le temps."
      );
    }

    setOpportunityScore(score);
    setOpportunityComment(comment);
    setOpportunityImprovements(improvements);

    // Plan d'action lokt
    const planItems: ActionPlanItem[] = [];

    // BLOCKING
    if (rendementBrut < 1.5) {
      planItems.push({ type: "blocking", title: "Rendement brut anormalement bas",
        body: `Avec ${formatPct(rendementBrut)} brut, le projet ne dégage quasiment pas de revenu par rapport à son coût (${formatEuro(coutTotal)}). Vérifiez le loyer saisi ou le prix d'acquisition — ce niveau rend le financement très difficile à justifier auprès d'une banque.` });
    }
    if (ecartPrixPourcent !== null && ecartPrixPourcent > 30) {
      planItems.push({ type: "blocking", title: "Prix d'acquisition très au-dessus du marché",
        body: `Le prix au m² de cette annonce dépasse d'environ ${Math.round(ecartPrixPourcent)}% le prix médian local. À ce niveau, la valorisation future du bien et la sortie de crédit deviennent risquées. Négociez fortement ou ciblez un autre bien.` });
    }

    // WARNING
    if (cashflowMensuel < -500) {
      planItems.push({ type: "warning", title: "Effort d'épargne mensuel élevé",
        body: `Le projet génère un cash-flow de ${formatEuro(cashflowMensuel)}/mois. C'est un effort d'épargne significatif à supporter chaque mois pendant ${toFloat(dureeCredLoc, 0)} ans. Assurez-vous que votre trésorerie personnelle l'absorbe sans fragilité.` });
    } else if (cashflowMensuel < 0) {
      planItems.push({ type: "warning", title: "Cash-flow légèrement négatif",
        body: `Le projet vous coûte ~${formatEuro(Math.abs(cashflowMensuel))}/mois après charges et crédit. Ce n'est pas bloquant si votre capacité d'épargne le permet, mais cela laisse peu de marge en cas de vacance locative ou de travaux imprévus.` });
    }

    if (rendementNetAvantCredit < 3 && rendementBrut >= 1.5) {
      planItems.push({ type: "warning", title: "Rendement net avant crédit faible",
        body: `Votre rendement net avant crédit est de ${formatPct(rendementNetAvantCredit)}. En dessous de 3%, les charges et frais grignotent une trop grande part des loyers. Leviers : négocier les charges de copropriété, optimiser les frais de gestion, ou revoir le prix d'achat.` });
    }

    if (ecartPrixPourcent !== null && ecartPrixPourcent > 10 && ecartPrixPourcent <= 30) {
      planItems.push({ type: "warning", title: "Prix au-dessus du marché local",
        body: `Le prix au m² de ce bien dépasse d'environ ${Math.round(ecartPrixPourcent)}% le prix médian local. Cela réduit le rendement et le potentiel de plus-value à la revente. Tentez une négociation sur le prix ou les conditions.` });
    }

    if (toFloat(tauxGestion, 0) === 0 && nbApparts > 0) {
      planItems.push({ type: "warning", title: "Frais de gestion non pris en compte",
        body: `Vous avez saisi 0% de frais de gestion. Si vous faites appel à un gestionnaire (agence, conciergerie), comptez 7-10% des loyers. Ne pas l'intégrer peut conduire à surestimer votre cash-flow réel.` });
    }

    // POSITIF
    if (cashflowMensuel >= 0) {
      planItems.push({ type: "positive", title: "Cash-flow neutre ou positif",
        body: `Le bien génère ${cashflowMensuel > 0 ? formatEuro(cashflowMensuel) + "/mois d'excédent" : "un cash-flow neutre"} après toutes les charges et le remboursement du crédit. Il s'autofinance — votre épargne personnelle n'est pas sollicitée.` });
    }

    if (rendementNetAvantCredit >= 5) {
      planItems.push({ type: "positive", title: "Bon rendement net avant crédit",
        body: `${formatPct(rendementNetAvantCredit)} net avant crédit, c'est un bon niveau. Cela signifie que les loyers couvrent largement les charges avant même de rembourser l'emprunt — le projet est robuste aux aléas (vacance, travaux imprévus).` });
    }

    if (ecartPrixPourcent !== null && ecartPrixPourcent < -5) {
      planItems.push({ type: "positive", title: "Prix en dessous du marché local",
        body: `Le prix au m² est ${Math.abs(Math.round(ecartPrixPourcent))}% sous le prix médian local. C'est un signal positif : marge de négociation réelle, potentiel de plus-value à la revente, et meilleur rapport rendement/risque.` });
    }

    // CONSEIL
    if (ecartLoyerPourcent !== null && ecartLoyerPourcent < -10 && market?.referenceRentM2) {
      const loyerMarche = Math.round(market.referenceRentM2 * surfaceNum);
      planItems.push({ type: "tip", title: "Loyer en dessous du marché — potentiel de revalorisation",
        body: `Votre loyer est ~${Math.abs(Math.round(ecartLoyerPourcent))}% sous le loyer médian local. Le marché suggère un loyer autour de ${formatEuro(loyerMarche)}/mois. En vous alignant progressivement, vous améliorerez le rendement et le cash-flow.` });
    }

    if (cashflowMensuel < 0 && toFloat(dureeCredLoc, 0) < 25) {
      planItems.push({ type: "tip", title: "Allonger la durée réduirait l'effort mensuel",
        body: `En passant de ${toFloat(dureeCredLoc, 0)} à ${toFloat(dureeCredLoc, 0) + 5} ans, la mensualité crédit baisserait et le cash-flow s'améliorerait. Le coût total des intérêts augmenterait, mais la pression mensuelle serait moins forte. À simuler selon votre situation.` });
    }

    if (nbApparts === 1 && locationTypes[0] === "longue" && rendementNetAvantCredit < 5) {
      planItems.push({ type: "tip", title: "La location courte durée pourrait booster le rendement",
        body: `Pour ce bien, envisagez une simulation en mode saisonnier (Airbnb). Si le marché local le permet, les revenus peuvent être significativement plus élevés — parfois 2 à 3× la location longue durée. Testez l'onglet Airbnb dans l'étape Revenus.` });
    }

    setActionItems(planItems);

    const texte = [
      `Structure du projet : ${nbApparts} lot(s) combinant vos choix de location (longue durée ou saisonnière). Le coût total du projet (prix d'acquisition, frais de notaire, frais d'agence et travaux) ressort à ${formatEuro(
        coutTotal
      )}.`,
      `Les loyers annuels bruts atteignent environ ${formatEuro(
        loyersAnnuels
      )}, soit un rendement brut de ${formatPct(rendementBrut)} par rapport au coût complet du projet.`,
      `Une fois intégrées les charges récurrentes (copropriété, taxe foncière, assurance, frais de gestion ou conciergerie), le revenu net avant crédit ressort à ${formatEuro(
        revenuNetAvantCredit
      )} par an, soit un rendement net avant remboursement du prêt de ${formatPct(
        rendementNetAvantCredit
      )}.`,
      `Avec un apport personnel de ${formatEuro(apportVal)}, le montant emprunté est d'environ ${formatEuro(
        montantEmprunte
      )}. À un taux de ${toFloat(tauxCredLoc, 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % sur ${toFloat(dureeCredLoc, 0)} ans
       la mensualité de crédit (hors assurance emprunteur) est de l'ordre de ${formatEuro(
        mensualiteCreditNue
      )}.`,
      `En ajoutant une estimation d'assurance emprunteur de ${toFloat(tauxAssuranceEmp, 0).toLocaleString(
  "fr-FR",
  { maximumFractionDigits: 2 }
)} % par an sur le capital emprunté, la mensualité totale crédit + assurance ressort autour de ${formatEuro(
  mensualiteTotale
)}, soit ${formatEuro(annuiteTotale)} par an.`,
      `Au global, une fois les charges, le crédit et l'assurance intégrés, le projet dégage un résultat net annuel de ${formatEuro(
        resultatNetAnnuel
      )}, correspondant à un cash-flow mensuel de ${formatEuro(cashflowMensuel)}.`,
      resultatNetAnnuel >= 0
        ? `Le cash-flow positif indique que le bien s'autofinance et génère un excédent.`
        : `Le cash-flow légèrement négatif signifie que le projet nécessite un effort d'épargne mensuel d'environ ${formatEuro(
            -cashflowMensuel
          )}.`,
      `Cette simulation reste indicative : elle ne tient pas compte de la fiscalité, ni de futures évolutions réglementaires.`,
    ].join("\n");

    setResultRendementTexte(texte);
    setResumeRendement({ cashflowMensuel, resultatNetAnnuel, rendementNetAvantCredit });
    setGraphData({
      loyersAnnuels,
      chargesTotales,
      annuiteCredit: annuiteTotale,
      resultatNetAnnuel,
      coutTotal,
      mensualiteCredit: mensualiteTotale,
      rendementBrut,
      rendementNetAvantCredit,
      dureeCredLoc: toFloat(dureeCredLoc, 0),
      montantEmprunte,
      tauxAnnuelCred: tAnnuelCred,
      mensualiteCreditNue,
      prixBienSeul: prix,
      apportVal,
    });

    // auto-capture si déjà consenti
    const email = (leadEmail || "").trim().toLowerCase();
    const hasValidEmail = email && email.includes("@");
    if (!isLoggedIn && unlocked && hasValidEmail) {
      try {
        await captureLeadViaRpc({
          email,
          payload: buildLeadPayload(),
        });
      } catch (e) {
        // ne bloque pas l'UX, mais on garde une trace pour le débogage
        // eslint-disable-next-line no-console
        console.warn("[rpc upsert_lead_v1] auto-capture error:", e);
      }
    }
  };

  const handleGoToResults = () => void handleCalculRendement();

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleRequestPremiumAnalysis = () => {
    if (typeof window === "undefined") return;

    const subject = encodeURIComponent("Demande d'optimisation de mon investissement locatif");
    const bodyLines: string[] = [
      "Bonjour,",
      "",
      "Je souhaite une analyse approfondie et une optimisation de mon projet d'investissement locatif réalisé sur l'outil MT Courtage & Investissement.",
      "",
      listingUrl
        ? `Lien de l'annonce analysée : ${listingUrl}`
        : "(Aucun lien d'annonce n'a été renseigné dans la simulation.)",
      selectedCityLabel ? `Localité du bien : ${selectedCityLabel}` : "(Localité non renseignée dans la simulation.)",
      surfaceNum > 0
      ? `Surface : ${surfaceNum.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} m²`
      : "(Surface non renseignée dans la simulation.)",
      "",
      "Résumé de ma simulation actuelle :",
      "",
      resultRendementTexte && resultRendementTexte.trim().length > 0
        ? resultRendementTexte
        : "(Les résultats ne sont pas joints automatiquement.)",
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
    window.location.href = `mailto:contact@lokt.fr?subject=${subject}&body=${body}`;
  };


    const handleUnlock = async () => {
      setUnlockMsg(null);
      setSendEmailMsg(null); // ✅ reset message email

    if (!hasSimulation) {
      setUnlockMsg("Calculez d'abord votre rentabilité pour débloquer l'analyse.");
      return;
    }

    const email = (leadEmail || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setUnlockMsg("Merci de renseigner une adresse e-mail valide.");
      return;
    }

    setUnlocking(true);
    try {
      try {
        await captureLeadViaRpc({
          email,
          payload: buildLeadPayload(),
        });
      } catch (e) {
        // on ne bloque pas l'UX si RPC indispo, mais on garde une trace
        // eslint-disable-next-line no-console
        console.warn("[rpc upsert_lead_v1] unlock capture error:", e);
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          LOKT_INVEST_CONSENT_STORAGE_KEY,
          JSON.stringify({ email, consent: true, ts: new Date().toISOString() })
        );
      }

      setUnlocked(true);
      setUnlockMsg("✅ Rapport prêt. Votre simulation est bien enregistrée.");
            if (sendByEmail) {
        await sendInvestEmail(email);
      }
    } catch (e: any) {
      setUnlockMsg("❌ Impossible d'enregistrer le dossier : " + (e?.message || "erreur inconnue"));
    } finally {
      setUnlocking(false);
    }
  };

  async function sendInvestEmail(email: string) {
    setSendEmailMsg(null);
    setSendingEmail(true);
    try {
      const computed = buildEmailComputed();
      const r = await fetch("/api/tools/investissement/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          subject: "Votre rapport d'investissement locatif — lokt.fr",
          computed,
        }),
      });

      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "email_failed");

      setSendEmailMsg("✅ Email envoyé (pensez à vérifier les spams).");
      return true;
    } catch (e: any) {
      setSendEmailMsg("❌ Envoi email impossible : " + (e?.message || "erreur"));
      return false;
    } finally {
      setSendingEmail(false);
    }
  }

const canClickUnlock =
  hasSimulation && leadEmailValid && !unlocking && !sendingEmail;
  
  /* ======================== UI helpers ======================== */
  const primaryNavButtonClass =
    "min-h-11 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-400/40 transition-transform hover:shadow-2xl hover:shadow-sky-400/60 active:scale-[0.99] sm:text-sm";
  const secondaryNavButtonClass =
    "min-h-11 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:text-sm";

  

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
            <p className="text-[0.8rem] text-slate-800 leading-relaxed">{line}</p>
          </div>
        ))}
      </div>
    );
  };

  /* ======================== Charts data ======================== */
  const charts = useMemo(() => {
    if (!graphData) return { barData: null as any, lineData: null as any, triPct: null as number | null };

    const {
      loyersAnnuels, chargesTotales, annuiteCredit, resultatNetAnnuel, dureeCredLoc,
      montantEmprunte, tauxAnnuelCred, mensualiteCreditNue, prixBienSeul, apportVal,
    } = graphData;

    const barData = {
      labels: ["Loyers bruts", "Charges", "Crédit + assurance", "Résultat net"],
      datasets: [
        {
          label: "Montants annuels (€)",
          data: [loyersAnnuels, chargesTotales, annuiteCredit, resultatNetAnnuel],
          backgroundColor: ["#22c55e", "#fb923c", "#38bdf8", "#0f172a"],
        },
      ],
    };

    const horizon = clamp(Math.round(dureeCredLoc), 5, 30);
    const revalorisation = revaloToggle ? 0.01 : 0;
    const tMensuel = tauxAnnuelCred / 12;

    const labels: string[] = [];
    const cashflowCumulData: number[] = [];
    const patrimoineData: number[] = [];

    let cumul = 0;
    let crd = montantEmprunte;
    const irrFlows: number[] = [-apportVal];

    for (let year = 1; year <= horizon; year++) {
      for (let m = 0; m < 12; m++) {
        const interet = crd * tMensuel;
        const principal = tMensuel === 0 ? mensualiteCreditNue : mensualiteCreditNue - interet;
        crd = Math.max(crd - principal, 0);
      }

      cumul += resultatNetAnnuel;
      const valeurBien = prixBienSeul * Math.pow(1 + revalorisation, year);
      const equity = valeurBien - crd;

      labels.push(`A.${year}`);
      cashflowCumulData.push(Math.round(cumul));
      patrimoineData.push(Math.round(equity));

      irrFlows.push(year < horizon ? resultatNetAnnuel : resultatNetAnnuel + equity);
    }

    // TRI via bisection
    let triPct: number | null = null;
    try {
      if (apportVal > 0 && irrFlows.some((f) => f > 0)) {
        let lo = -0.99, hi = 20.0;
        for (let iter = 0; iter < 300; iter++) {
          const mid = (lo + hi) / 2;
          const npv = irrFlows.reduce((s, cf, t) => s + cf / Math.pow(1 + mid, t), 0);
          if (Math.abs(hi - lo) < 0.00005) { triPct = mid * 100; break; }
          if (npv > 0) lo = mid; else hi = mid;
        }
      }
    } catch { /* ignore */ }

    const lineData = {
      labels,
      datasets: [
        {
          label: "Patrimoine constitué (€)",
          data: patrimoineData,
          borderColor: "#635bff",
          backgroundColor: "rgba(99, 91, 255, 0.06)",
          tension: 0.25,
          pointRadius: 2,
        },
        {
          label: "Cash-flow cumulé (€)",
          data: cashflowCumulData,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.06)",
          borderDash: [5, 4],
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    };

    return { barData, lineData, triPct };
  }, [graphData, revaloToggle]);

  /* ======================== Render ======================== */
  return (
    <div className="space-y-6">
      <CalculatorWizardShell
        steps={progressSteps}
        currentIndex={stepIndex}
        onStepClick={(index) => setStep(steps[index])}
        title="Analysez votre investissement sans angle mort."
      >

      {/* STEP: Coûts */}
      {step === "couts" && (
        <section className="calculator-premium-form space-y-5">
          <div>
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Étape 1</p>
            <h2 className="text-lg font-semibold text-slate-900">Coût global du projet</h2>
            <p className="text-xs text-slate-500">Prix, notaire, agence, travaux (+ localité & surface optionnelles).</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-700">Prix du bien (€)</label>
                <input
                type="text"
                inputMode="numeric"
                required
                value={prixBien}
                onChange={(e) => handlePrixBienChange(e.target.value)}
                className={
                  "w-full min-w-0 rounded-xl border bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 " +
                  (prixBienError ? "border-red-400 focus:ring-red-500" : "border-slate-300 focus:ring-emerald-500")
                }
                aria-invalid={!!prixBienError}
              />
            {prixBienError && <p className="text-[0.7rem] text-red-600">{prixBienError}</p>}
            </div>

            {/* Localité & surface */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative space-y-1 sm:col-span-2">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Localité du bien (optionnel)
                  <InfoBadge text="Tapez un code postal, une commune, ou une localité copiée depuis une annonce. Exemples : 75011 Paris, Lyon 3e, Cargèse." />
                </label>
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => handleCityInputChange(e.target.value)}
                  onFocus={() => {
                    if (citySuggestions.length > 0) setShowCitySuggestions(true);
                  }}
                  placeholder="Ex. 75011 Paris, Lyon 3e, Cargèse…"
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {cityLoading && <p className="mt-1 text-[0.7rem] text-slate-500">Recherche des communes…</p>}
                {cityError && <p className="mt-1 text-[0.7rem] text-red-600">{cityError}</p>}

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
                          {city.name} <span className="text-slate-500">({city.postalCode})</span>
                        </span>
                        <span className="text-[0.65rem] text-slate-400">INSEE {city.inseeCode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Surface habitable (m²)
                  <InfoBadge text="Permet de comparer prix/m² et loyer/m² au marché." />
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={surfaceM2}
                  onChange={(e) => setSurfaceM2(onlyNumberInput(e.target.value))}
                  placeholder="Ex. 55"
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Lien annonce */}
            <div className="space-y-1">
              <label className="text-xs text-slate-700 flex items-center gap-1">
                Lien de l&apos;annonce (optionnel)
                <InfoBadge text="Collez ici le lien Leboncoin, SeLoger, PAP… (pas aspiré automatiquement)." />
              </label>
              <input
                type="url"
                value={listingUrl}
                onChange={(e) => setListingUrl(e.target.value)}
                placeholder="https://www.leboncoin.fr/... ou https://www.seloger.com/..."
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[0.7rem] text-slate-500">Optionnel, mais pratique pour rattacher la simulation à une annonce.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Frais de notaire (€)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={fraisNotaire}
                  onChange={(e) => {
                    setNotaireCustom(true);
                    setFraisNotaire(onlyNumberInput(e.target.value));
                  }}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[0.7rem] text-slate-500">Pré-rempli à ~7,5 %, modifiable.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">Frais d&apos;agence (€)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={fraisAgence}
                  onChange={(e) => {
                    setAgenceCustom(true);
                    setFraisAgence(onlyNumberInput(e.target.value));
                  }}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[0.7rem] text-slate-500">Pré-rempli à ~4 %, modifiable.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">Travaux (€)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={travaux}
                  onChange={(e) => setTravaux(onlyNumberInput(e.target.value))}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-800">
              Coût total actuel (bien + notaire + agence + travaux) :{" "}
              <span className="font-semibold">{formatEuro(
                toFloat(prixBien, 0) +
                  toFloat(fraisNotaire, 0) +
                  toFloat(fraisAgence, 0) +
                  toFloat(travaux, 0)
              )}</span>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="button" onClick={() => {
              const prix = toFloat(prixBien, 0);
              if (!prixBien.trim() || prix <= 0) { setPrixBienError("Prix du bien obligatoire (montant > 0)."); return; }
              setPrixBienError(null);
              goNext();
            }} className={primaryNavButtonClass}>Suivant →</button>
          </div>
        </section>
      )}

      {/* STEP: Revenus */}
      {step === "revenus" && (
        <section className="calculator-premium-form space-y-5">
          <div>
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Étape 2</p>
            <h2 className="text-lg font-semibold text-slate-900">Revenus locatifs : longue durée & saisonnière</h2>
            <p className="text-xs text-slate-500">Configurez le nombre de lots et le mode de location.</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-700">Nombre d&apos;appartements dans ce projet</label>
              <input
                inputMode="numeric"
                value={nbAppartsInput}
                min={1}
                max={10}
                onChange={(e) => handleNbAppartsChange(e.target.value)}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600 flex items-center">
                Paramétrage des loyers / revenus par appartement
                <InfoBadge text="Pour chaque lot, choisissez entre longue durée (loyer mensuel) et saisonnière (Airbnb), convertie en revenu mensuel équivalent." />
              </p>

              {Array.from({ length: nbApparts }).map((_, idx) => {
                const type = locationTypes[idx] || "longue";
                return (
                  <div
                    key={idx}
                    className="border-t border-slate-200 pt-3 mt-2 first:border-none first:mt-0 first:pt-0"
                  >
                    <div className="grid gap-2 sm:grid-cols-2 items-center">
                      <p className="text-[0.7rem] text-slate-700 font-medium">Appartement #{idx + 1}</p>
                      <select
                        value={type}
                        onChange={(e) => handleLocationTypeChange(idx, e.target.value as LocationType)}
                        className="calc-select w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="longue">Location longue durée (loyer mensuel)</option>
                        <option value="airbnb">Location saisonnière (type Airbnb)</option>
                      </select>
                    </div>

                    {type === "longue" ? (
                      <div className="mt-2 space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Loyer mensuel envisagé (€)</label>
                        <input
                          inputMode="decimal"
                          value={loyersApparts[idx] ?? ""}
                          onChange={(e) => handleLoyerAppartChange(idx, onlyNumberInput(e.target.value))}
                          required
                          className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-1.5 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          placeholder="Loyer mensuel (€)"
                        />
                        {marketRentM2 !== null && surfaceNum > 0 && (
                          <p className="text-[0.7rem] text-slate-500">
                            Loyer médian local estimé :{" "}
                            <button
                              type="button"
                              onClick={() => handleLoyerAppartChange(idx, String(Math.round(marketRentM2! * surfaceNum)))}
                              className="font-semibold text-emerald-600 underline underline-offset-2 hover:text-emerald-800"
                            >
                              {formatEuro(Math.round(marketRentM2! * surfaceNum))}/mois
                            </button>
                            {" "}· Utiliser
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700">Prix moyen par nuit (€)</label>
                            <input
                              inputMode="decimal"
                              value={airbnbNuitees[idx] ?? ""}
                              onChange={(e) => handleAirbnbNuiteeChange(idx, onlyNumberInput(e.target.value))}
                              required
                              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-1.5 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="Ex. 90 €"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700">Taux d&apos;occupation (% de l&apos;année)</label>
                            <input
                              inputMode="decimal"
                              value={airbnbOccupation[idx] ?? ""}
                              onChange={(e) => handleAirbnbOccupationChange(idx, onlyNumberInput(e.target.value))}
                              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-1.5 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder={`Ex. ${DEFAULT_AIRBNB_OCCUPATION} %`}
                            />
                          </div>
                        </div>
                        <p className="text-[0.65rem] text-slate-500">Converti en revenu mensuel (nuit × occ × 365 / 12).</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <button type="button" onClick={goPrev} className={secondaryNavButtonClass}>← Retour</button>
            <button type="button" onClick={goNext} className={primaryNavButtonClass}>Suivant →</button>
          </div>
        </section>
      )}

      {/* STEP: Charges */}
      {step === "charges" && (
        <section className="calculator-premium-form space-y-5">
          <div>
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Étape 3</p>
            <h2 className="text-lg font-semibold text-slate-900">Charges récurrentes & gestion</h2>
            <p className="text-xs text-slate-500">Copro, taxe foncière, assurance, gestion / conciergerie.</p>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Charges de copro (€/an)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={chargesCopro}
                  onChange={(e) => setChargesCopro(onlyNumberInput(e.target.value))}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Taxe foncière (€/an)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={taxeFonc}
                  onChange={(e) => setTaxeFonc(onlyNumberInput(e.target.value))}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Assurance PNO / habitation (€/an)</label>
                <input
                   type="text"
                  inputMode="numeric"
                  value={assurance}
                  onChange={(e) => setAssurance(onlyNumberInput(e.target.value))}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700 flex items-center gap-1">
                Frais de gestion / conciergerie (% des loyers)
                {hasAirbnb && <InfoBadge text="Pour la saisonnière, ce champ représente les frais de conciergerie." />}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={tauxGestion}
                onChange={(e) => setTauxGestion(onlyNumberInput(e.target.value))}
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <button type="button" onClick={goPrev} className={secondaryNavButtonClass}>← Retour</button>
            <button type="button" onClick={goNext} className={primaryNavButtonClass}>Suivant →</button>
          </div>
        </section>
      )}

      {/* STEP: Crédit */}
      {step === "credit" && (
        <section className="calculator-premium-form space-y-5">
          <div>
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Étape 4</p>
            <h2 className="text-lg font-semibold text-slate-900">Paramètres du financement</h2>
            <p className="text-xs text-slate-500">Apport, taux, durée du crédit et assurance.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4 mt-2">
  <div className="space-y-1">
    <label className="min-h-[2.25rem] flex items-start text-xs text-slate-700">
      Apport personnel (€)
    </label>
    <input
      type="text"
      inputMode="numeric"
      value={apport}
      onChange={(e) => setApport(onlyNumberInput(e.target.value))}
      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
    />
  </div>

  <div className="space-y-1">
    <label className="min-h-[2.25rem] flex items-start text-xs text-slate-700">
      Taux crédit (annuel, en %)
    </label>
    <input
      type="text"
      inputMode="decimal"
      value={tauxCredLoc}
      onChange={(e) => setTauxCredLoc(onlyNumberInput(e.target.value))}
      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
      placeholder="Ex. 3,5"
    />
  </div>

  <div className="space-y-1">
    <label className="min-h-[2.25rem] flex items-start text-xs text-slate-700">
      Durée du crédit (années)
    </label>
    <input
      type="text"
      inputMode="numeric"
      value={dureeCredLoc}
      onChange={(e) => setDureeCredLoc(onlyNumberInput(e.target.value))}
      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
      placeholder="Ex. 25"
    />
  </div>

  <div className="space-y-1">
    <label className="min-h-[2.25rem] flex items-start gap-1 text-xs text-slate-700">
      <span>Taux assurance emprunteur (annuel, en %)</span>
      <InfoBadge text="La mensualité est calculée sur la base d'un taux annuel appliqué au montant total emprunté, hors assurance." />
    </label>
    <input
      type="text"
      inputMode="decimal"
      value={tauxAssuranceEmp}
      onChange={(e) => setTauxAssuranceEmp(onlyNumberInput(e.target.value))}
      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
      placeholder="Ex. 0,25"
    />
  </div>
</div>
          {calculError && <p className="text-[0.75rem] text-red-600">{calculError}</p>}
          <div className="flex justify-between pt-2">
            <button type="button" onClick={goPrev} className={secondaryNavButtonClass}>← Retour</button>
            <button type="button" onClick={handleGoToResults} className={primaryNavButtonClass}>
              Calculer ma rentabilité →
            </button>
          </div>
        </section>
      )}

      {/* Résultats */}
      {hasSimulation && (
        <section
          ref={resultSectionRef}
          className="calculator-premium-form space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Synthèse</p>
              <h2 className="text-lg font-semibold text-slate-900">Votre analyse de rentabilité est calculée</h2>
              <p className="text-xs text-slate-500">Entrez votre email pour débloquer les résultats et recevoir votre rapport.</p>
              {marketError && <p className="mt-1 text-[0.7rem] text-red-600">{marketError}</p>}
              {marketLoading && <p className="mt-1 text-[0.7rem] text-slate-500">Récupération des données marché…</p>}
            </div>

          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            
            <div className="flex gap-2">
              
            </div>
          </div>

          {hasSimulation ? (
            <>
              {/* Gate — affiché avant tout résultat */}
              {!canShowFullDetails ? (
                <div className="w-full rounded-2xl border border-slate-200 bg-slate-900 text-white p-5 relative overflow-hidden shadow-lg">
                  <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-30 blur-3xl bg-cyan-500" />
                  <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl bg-emerald-400" />
                  <div className="relative space-y-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">DÉBLOQUER L'ANALYSE</p>
                    <h3 className="text-lg font-semibold">Débloquer votre analyse de rentabilité</h3>
                    <p className="text-sm text-slate-200">Coût total projet, rendements, cash-flow, analyse marché et plan d'action personnalisé — envoyés par email.</p>
                    <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-100 font-semibold">Votre e-mail (obligatoire)</label>
                        <input type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder="ex: prenom.nom@gmail.com" className="w-full min-w-0 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-base text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300" />
                        <p className="text-[0.7rem] text-slate-300">Utilisé pour vous envoyer le rapport et retrouver votre simulation.{" "}<a href="/confidentialite" className="underline hover:text-white">En savoir plus</a>.</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-100 font-semibold">Téléphone <span className="font-normal text-slate-400">(optionnel)</span></label>
                        <input type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="ex: 06 12 34 56 78" className="w-full min-w-0 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-base text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300" />
                        <p className="text-[0.7rem] text-slate-300">Pour être rappelé(e) rapidement par un conseiller partenaire.</p>
                      </div>
                      <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="checkbox" checked={consentContact} onChange={(e) => setConsentContact(e.target.checked)} className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10" />
                          <span className="text-[0.75rem] text-slate-200 leading-relaxed"><span className="font-semibold">Optionnel :</span> j'accepte d'être mis en relation avec un conseiller partenaire pour aller plus loin sur mon projet.<span className="block text-[0.7rem] text-slate-300 mt-1">Cette case n'est pas obligatoire pour recevoir le rapport.</span></span>
                        </label>
                      </div>
                      <button type="button" onClick={handleUnlock} disabled={!canClickUnlock} className="w-full inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:opacity-95 disabled:opacity-60">
                        {unlocking ? "Préparation..." : "Recevoir mon rapport"}
                      </button>
                      {unlockMsg && <p className="text-[0.75rem] text-slate-200">{unlockMsg}</p>}
                      {sendingEmail ? <p className="text-[0.7rem] text-slate-300">Envoi de l'email…</p> : null}
                      {sendEmailMsg ? <p className="text-[0.7rem] text-slate-200">{sendEmailMsg}</p> : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Résultats débloqués */}
              {canShowFullDetails ? (
              <>
              {/* Cartes de synthèse */}
              <div className="grid gap-4 sm:grid-cols-4 mt-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Coût total projet</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(graphData!.coutTotal)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Rendement brut</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(graphData!.rendementBrut)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Rendement net avant crédit</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(graphData!.rendementNetAvantCredit)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Mensualité crédit + assurance</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(graphData!.mensualiteCredit)}
                  </p>
                </div>
              </div>

              {/* Cash-flow & résultat */}
              <div className="grid gap-4 sm:grid-cols-3 mt-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 sm:col-span-2 flex flex-col justify-center">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-700 mb-1">Cash-flow & rentabilité</p>
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Cash-flow mensuel</p>
                      <p
                        className={
                          "mt-1 text-lg font-semibold " +
                          (resumeRendement!.cashflowMensuel >= 0 ? "text-emerald-700" : "text-red-600")
                        }
                      >
                        {formatEuro(resumeRendement!.cashflowMensuel)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Résultat net annuel</p>
                      <p
                        className={
                          "mt-1 text-lg font-semibold " +
                          (resumeRendement!.resultatNetAnnuel >= 0 ? "text-emerald-700" : "text-red-600")
                        }
                      >
                        {formatEuro(resumeRendement!.resultatNetAnnuel)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Rendement net</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatPct(resumeRendement!.rendementNetAvantCredit)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">Durée du crédit</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{graphData!.dureeCredLoc} ans</p>
                  <p className="mt-2 text-[0.7rem] text-slate-500">
                    Le graphique illustre le cash-flow cumulé (hypothèse paramètres constants).
                  </p>
                </div>
              </div>

              {/* Graphiques */}
              <div className="grid gap-4 lg:grid-cols-2 mt-4">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-600 mb-2">
                    Flux annuels : loyers, charges, crédit + assurance et résultat net.
                  </p>
                  {charts.barData && (
                    <Bar
                      data={charts.barData}
                      options={{
                        plugins: { legend: { labels: { color: "#0f172a", font: { size: 11 } } } },
                        scales: {
                          x: { ticks: { color: "#0f172a", font: { size: 10 } }, grid: { color: "#e5e7eb" } },
                          y: { ticks: { color: "#0f172a", font: { size: 10 } }, grid: { color: "#e5e7eb" } },
                        },
                      }}
                    />
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs font-medium text-slate-700">Projection patrimoniale sur {graphData!.dureeCredLoc} ans</p>
                      {charts.triPct !== null && (
                        <p className="text-[0.7rem] text-slate-500 mt-0.5">
                          TRI estimé :{" "}
                          <span className="font-semibold text-slate-800">{formatPct(charts.triPct)}/an</span>
                          <span className="ml-1 text-[0.65rem] text-slate-400">(apport + revente fin de crédit)</span>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRevaloToggle((t) => !t)}
                      className={
                        "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold border transition-colors " +
                        (revaloToggle
                          ? "bg-violet-100 border-violet-300 text-violet-700"
                          : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200")
                      }
                    >
                      {revaloToggle ? "Revalorisation +1%/an" : "Prix stable"}
                    </button>
                  </div>
                  {charts.lineData && (
                    <Line
                      data={charts.lineData}
                      options={{
                        plugins: { legend: { labels: { color: "#0f172a", font: { size: 11 } } } },
                        scales: {
                          x: { ticks: { color: "#0f172a", font: { size: 9 } }, grid: { color: "#e5e7eb" } },
                          y: { ticks: { color: "#0f172a", font: { size: 10 } }, grid: { color: "#e5e7eb" } },
                        },
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Analyse marché / annonce */}
              {hasSimulation && (
                <>
                  {!canShowAnalysis && (
                    <p className="mt-2 text-[0.7rem] text-slate-500">
                      Pour afficher l'analyse détaillée du bien, merci de renseigner :<br />
                      • la localité du bien<br />
                      • la surface en m²
                    </p>
                  )}

                  {canShowAnalysis && (
                    <div className="relative">
                      <div className={canShowFullDetails ? "" : "blur-sm select-none pointer-events-none"}>
                        <ListingAnalysisSection
                          hasSimulation={hasSimulation}
                          canShowAnalysis={canShowAnalysis}
                          listingUrl={listingUrl}
                          selectedCityLabel={selectedCityLabel}
                          surfaceM2={surfaceNum}
                          prixBien={prixNum}
                          graphData={graphData}
                          resumeRendement={resumeRendement}
                          opportunityScore={opportunityScore}
                          opportunityComment={opportunityComment}
                          opportunityImprovements={opportunityImprovements}
                          marketPriceM2={marketPriceM2}
                          marketRentM2={marketRentM2}
                          marketSource={marketSource}
                        />
                      </div>

                      {!canShowFullDetails && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/55 backdrop-blur-[2px]">
                          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                            Rapport complet disponible juste en dessous
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Plan d'action lokt */}
              {canShowFullDetails && actionItems.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Plan d&apos;action lokt
                  </p>
                  {actionItems.map((item, i) => {
                    const cfg = ACTION_ITEM_CONFIG[item.type];
                    return (
                      <div key={i} className={`flex gap-3 rounded-xl border p-3.5 ${cfg.bg} ${cfg.border}`}>
                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg} ${cfg.iconText}`}>
                          <cfg.Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-[0.8rem] font-semibold leading-tight ${cfg.titleText}`}>{item.title}</p>
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${cfg.badgeCls}`}>{cfg.badge}</span>
                          </div>
                          <p className="mt-1 text-[0.75rem] leading-5 text-slate-600">{item.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              </>
              ) : null}

              <p className="mt-2 text-[0.7rem] text-slate-500">
                Ces calculs sont fournis à titre indicatif, hors fiscalité et évolution future des loyers, taux, charges et réglementation.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Cliquez sur "Calculer / Mettre à jour la rentabilité" pour générer les résultats.
            </p>
          )}
        </section>
      )}
      </CalculatorWizardShell>
    </div>
  );
}
