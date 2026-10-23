// components/CapaciteWizard.tsx
import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/router";
import {
  AdjustmentsHorizontalIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BanknotesIcon,
  CheckCircleIcon,
  CheckIcon,
  CreditCardIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  LightBulbIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabaseClient";
import InfoBadge from "./calculators/InfoBadge";
import StyledSelect from "./calculators/StyledSelect";
import {
  buildCapaciteEmailHtml,
  buildCapaciteEmailText,
} from "../lib/emails/capaciteEmail";
import LeadGate from "./LeadGate";
import { useAgenceMode } from "../lib/useAgenceMode";
import {
  safeEmail,
  loadLeadEmail,
  persistLeadEmail,
  isUnlockedForEmail,
  persistUnlock,
} from "../lib/leads";
import {
  computeCapacite,
  formatEuro,
  formatPct,
  toInt,
  toFloat,
  type ComputedAll,
  type ResumeCapacite,
  type ScenarioCapacite,
  type BankabilityAssessment,
  type ActionPlanItemType,
  type ActionPlanItem,
  type TypeCredit,
  type ProjectType,
  type ProStatus,
  type PropertyKind,
  type ProjectUsageUI,
  type ProjectTimelineUI,
} from "../lib/calculators/capaciteEngine";

const CAPACITE_STORAGE_KEY = "capacite_simulation_v19_simple_only_no_advanced";

/** conserve uniquement les chiffres, mais autorise la chaîne vide */
function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, "");
}

/** autorise chiffres + un seul séparateur "." (on remplace "," par ".") */
function onlyNumberLike(s: string) {
  const cleaned = s.replace(",", ".").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return parts[0] + "." + parts.slice(1).join("");
}

/* ------------------------ Types ------------------------ */
// DB values (CHECK)
type ProjectUsageDB =
  | "residence_principale"
  | "residence_secondaire"
  | "investissement";
type ProjectTimelineDB =
  | "0_3_mois"
  | "3_6_mois"
  | "6_12_mois"
  | "12_plus"
  | "juste_info";

const ACTION_ITEM_CONFIG: Record<
  ActionPlanItemType,
  { Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; badge: string; bg: string; border: string; iconBg: string; iconText: string; titleText: string; badgeCls: string }
> = {
  blocking: { Icon: ExclamationTriangleIcon, badge: "Bloquant", bg: "bg-red-50", border: "border-red-200", iconBg: "bg-red-100", iconText: "text-red-600", titleText: "text-red-900", badgeCls: "bg-red-100 text-red-700" },
  warning:  { Icon: ExclamationCircleIcon,  badge: "À surveiller", bg: "bg-amber-50", border: "border-amber-200", iconBg: "bg-amber-100", iconText: "text-amber-600", titleText: "text-amber-900", badgeCls: "bg-amber-100 text-amber-700" },
  positive: { Icon: CheckCircleIcon,        badge: "Atout", bg: "bg-emerald-50", border: "border-emerald-200", iconBg: "bg-emerald-100", iconText: "text-emerald-600", titleText: "text-emerald-900", badgeCls: "bg-emerald-100 text-emerald-700" },
  tip:      { Icon: LightBulbIcon,          badge: "Conseil", bg: "bg-indigo-50", border: "border-indigo-200", iconBg: "bg-indigo-100", iconText: "text-indigo-600", titleText: "text-indigo-900", badgeCls: "bg-indigo-100 text-indigo-700" },
};

/* ------------------------ Tracking helpers ------------------------ */
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
  if (typeof window === "undefined") return "capacite_wizard";
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

/* ------------------------ DB mapping (CHECK-safe) ------------------------ */
const TIMELINE_UI_TO_DB: Record<ProjectTimelineUI, ProjectTimelineDB> = {
  "0_3m": "0_3_mois",
  "3_6m": "3_6_mois",
  "6_12m": "6_12_mois",
  "12m_plus": "12_plus",
  "juste_info": "juste_info",
};

const USAGE_UI_TO_DB: Record<ProjectUsageUI, ProjectUsageDB> = {
  rp: "residence_principale",
  rs: "residence_secondaire",
  invest: "investissement",
};

export type CapaciteWizardProps = {
  showSaveButton?: boolean;
  // Présent uniquement dans le contexte du widget embarqué sur le site d'une
  // agence (voir pages/embed/capacite.tsx) : si renseigné, le lead ne part
  // jamais dans la base de leads lokt.fr (pas d'appel à upsert_lead_v1) —
  // il part uniquement vers l'agence par email, et seulement si le visiteur
  // a coché la case de consentement (le texte de cette case reflète alors
  // explicitement que c'est l'agence, pas "un conseiller partenaire" lokt,
  // qui recevra ses coordonnées). `token` est un identifiant opaque (jamais
  // l'email de l'agence en clair, résolu côté serveur dans l'API
  // notify-agency) — voir pages/api/tools/capacite/widget-token.ts.
  agencyLead?: { token: string; siteLabel?: string };

  // Format "petit" du widget agence (cf. pages/embed/capacite.tsx) : répartit
  // les mêmes questions sur une étape de plus pour rester léger dans un
  // format étroit. false partout ailleurs (dont /capacite), comportement
  // inchangé par défaut.
  compactSteps?: boolean;

  // Formats "petit" et "moyen" du widget agence : remplace le bandeau de
  // progression (titre, icône décorative, pastilles d'étape avec icône)
  // par une barre fine — même navigation, juste moins de place prise par
  // la décoration. false partout ailleurs (dont /capacite et "grand").
  compactHeader?: boolean;
};

export default function CapaciteWizard({
  showSaveButton = true,
  agencyLead,
  compactSteps = false,
  compactHeader = false,
}: CapaciteWizardProps) {
  const router = useRouter();

  /* ======================== Session ======================== */
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

  const isLoggedIn = !!sessionUserId;

  /* ======================== Wizard steps ======================== */
  const [step, setStep] = useState<number>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);
  useEffect(() => setMaxStepReached((m) => Math.max(m, step)), [step]);

  // compactSteps (format "petit" du widget agence, cf. pages/embed/capacite.tsx)
  // répartit exactement le même contenu — mêmes questions, même profondeur
  // d'analyse — sur une étape de plus (Profil et Revenus séparés), pour que
  // chaque écran reste léger dans un format étroit. Rien n'est retiré, juste
  // repaginé différemment.
  type StepSection = "projet" | "profil" | "revenus" | "charges" | "pret";
  const wizardSteps = useMemo<
    Array<{
      label: string;
      shortLabel: string;
      description: string;
      icon: ComponentType<SVGProps<SVGSVGElement>>;
      sections: StepSection[];
    }>
  >(
    () =>
      compactSteps
        ? [
            { label: "Votre projet", shortLabel: "Projet", description: "Quel bien, où et dans quel délai ?", icon: HomeModernIcon, sections: ["projet"] },
            { label: "Profil", shortLabel: "Profil", description: "Votre situation professionnelle et votre foyer.", icon: UserGroupIcon, sections: ["profil"] },
            { label: "Revenus", shortLabel: "Revenus", description: "Vos revenus mensuels nets.", icon: BanknotesIcon, sections: ["revenus"] },
            { label: "Charges & Crédits", shortLabel: "Charges", description: "Ce qui pèse déjà sur votre budget chaque mois.", icon: CreditCardIcon, sections: ["charges"] },
            { label: "Paramètres du prêt", shortLabel: "Prêt", description: "Ajustez les hypothèses pour obtenir votre estimation.", icon: AdjustmentsHorizontalIcon, sections: ["pret"] },
          ]
        : [
            { label: "Votre projet", shortLabel: "Projet", description: "Quel bien, où et dans quel délai ?", icon: HomeModernIcon, sections: ["projet"] },
            { label: "Profil & Revenus", shortLabel: "Profil", description: "Votre situation professionnelle et les revenus du foyer.", icon: UserGroupIcon, sections: ["profil", "revenus"] },
            { label: "Charges & Crédits", shortLabel: "Charges", description: "Ce qui pèse déjà sur votre budget chaque mois.", icon: CreditCardIcon, sections: ["charges"] },
            { label: "Paramètres du prêt", shortLabel: "Prêt", description: "Ajustez les hypothèses pour obtenir votre estimation.", icon: AdjustmentsHorizontalIcon, sections: ["pret"] },
          ],
    [compactSteps]
  );
  const TOTAL_STEPS = wizardSteps.length;

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));
  const goToStep = (target: number) => {
    const t = Math.min(Math.max(target, 1), TOTAL_STEPS);
    if (t <= maxStepReached) setStep(t);
  };

  const activeStepMeta = wizardSteps[step - 1];
  const ActiveStepIcon = activeStepMeta.icon;
  const activeSections = activeStepMeta.sections;
  const revenusStepIndex = wizardSteps.findIndex((s) => s.sections.includes("revenus")) + 1;

  /* ======================== Common input styles ======================== */
  const inputBase =
    "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition " +
    "placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-100";
  const inputSmall =
    "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition " +
    "placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-100";
  const labelBase = "flex min-h-[1.25rem] items-center gap-1 text-xs font-semibold leading-tight text-slate-700";

  /* ======================== Step 1: Votre projet ======================== */
  const [projectDepartment, setProjectDepartment] = useState<string>("");
  const [propertyKind, setPropertyKind] = useState<PropertyKind>("appartement");
  const [projectType, setProjectType] = useState<ProjectType>("ancien");
  const [projectUsageUI, setProjectUsageUI] = useState<ProjectUsageUI>("rp");
  const [projectTimelineUI, setProjectTimelineUI] = useState<ProjectTimelineUI>("3_6m");
  const [apportPersonnel, setApportPersonnel] = useState<string>("");

  /* ======================== Step 2: Votre profil ======================== */
  const [ageEmprunteur, setAgeEmprunteur] = useState<string>("35");
  const [ageCoEmprunteur, setAgeCoEmprunteur] = useState<string>("");
  const [proStatus, setProStatus] = useState<ProStatus>("cdi");
  const [nbAdultes, setNbAdultes] = useState<string>("2");
  const [nbEnfants, setNbEnfants] = useState<string>("0");

  /* ======================== Step 3: Vos revenus ======================== */
  const [revenusNetMensuels, setRevenusNetMensuels] = useState<string>("4000");
  const [autresRevenusMensuels, setAutresRevenusMensuels] = useState<string>("");
  const [revenusError, setRevenusError] = useState<string | null>(null);

  /* ======================== Step 4: Charges & crédits ======================== */
  const [chargesMensuellesHorsCredits, setChargesMensuellesHorsCredits] = useState<string>("");

  const [nbCredits, setNbCredits] = useState<number>(0);
  const [typesCredits, setTypesCredits] = useState<TypeCredit[]>([]);
  const [mensualitesCredits, setMensualitesCredits] = useState<string[]>([]);
  const [resteAnneesCredits, setResteAnneesCredits] = useState<string[]>([]);
  const [tauxCredits, setTauxCredits] = useState<string[]>([]);
  const [revenusLocatifs, setRevenusLocatifs] = useState<string[]>([]);

  /* ======================== Step 5: Paramètres du prêt ======================== */
  const [tauxEndettementCible, setTauxEndettementCible] = useState<string>("35");
  const [tauxCreditCible, setTauxCreditCible] = useState<string>("3.5");
  const [tauxAssuranceCible, setTauxAssuranceCible] = useState<string>("0.30");
  const [dureeCreditCible, setDureeCreditCible] = useState<string>("25");

  /* ======================== Résultats ======================== */
  const [resumeCapacite, setResumeCapacite] = useState<ResumeCapacite | null>(null);
  const [bankability, setBankability] = useState<BankabilityAssessment | null>(null);
  const [actionItems, setActionItems] = useState<ActionPlanItem[]>([]);

  // ✅ FIX: on stocke le computeAll (sinon computedAll restait null → synthèse jamais visible)
  const [computedAll, setComputedAll] = useState<ComputedAll | null>(null);

  const hasResult = !!resumeCapacite;

  /* ======================== Gate (par calculette) ======================== */
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [leadPhone, setLeadPhone] = useState<string>("");
  const [consentLokt, setConsentLokt] = useState<boolean>(false);
  const [consentContact, setConsentContact] = useState<boolean>(false);
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);

  const [sendByEmail, setSendByEmail] = useState<boolean>(true);
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [sendEmailMsg, setSendEmailMsg] = useState<string | null>(null);

  // 1) Restore email depuis session OU localStorage tool-specific
  useEffect(() => {
    if (typeof window === "undefined") return;

    // si loggé -> pas de gate
    if (isLoggedIn) {
      setUnlocked(true);
      setConsentLokt(true);
      if (sessionEmail && !leadEmail) setLeadEmail(sessionEmail);
      return;
    }

    const fromSession = safeEmail(sessionEmail ?? "");
    const fromStorage = loadLeadEmail("capacite");
    const next = fromSession || fromStorage;

    if (next && safeEmail(leadEmail) !== next) {
      setLeadEmail(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail, isLoggedIn]);

  // 2) Persist email au fil de l'eau (tool-specific)
  useEffect(() => {
    const e = safeEmail(leadEmail);
    if (!e) return;
    persistLeadEmail("capacite", e);
  }, [leadEmail]);

  // 3) Restore unlock tool-specific (et invalide si email change)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isLoggedIn) {
      setUnlocked(true);
      setConsentLokt(true);
      return;
    }

    const e = safeEmail(leadEmail);
    if (!e) {
      setUnlocked(false);
      return;
    }

    const ok = isUnlockedForEmail("capacite", e);
    setUnlocked(ok);
    if (ok) setConsentLokt(true);
  }, [leadEmail, isLoggedIn]);

  /* ======================== Labels ======================== */
  const projectTypeLabel = useMemo(() => {
    if (projectType === "neuf") return "Neuf / VEFA";
    if (projectType === "terrain") return "Terrain + construction";
    return "Ancien";
  }, [projectType]);

  const proStatusLabel = useMemo(() => {
    if (proStatus === "fonctionnaire") return "Fonctionnaire";
    if (proStatus === "independant") return "Indépendant / société";
    if (proStatus === "retraite") return "Retraité";
    if (proStatus === "autre") return "Autre";
    return "CDI";
  }, [proStatus]);

  const propertyKindLabel = useMemo(() => {
    if (propertyKind === "maison") return "Maison";
    if (propertyKind === "terrain") return "Terrain";
    if (propertyKind === "autre") return "Autre";
    return "Appartement";
  }, [propertyKind]);

  const projectUsageLabel = useMemo(() => {
    if (projectUsageUI === "rs") return "Résidence secondaire";
    if (projectUsageUI === "invest") return "Investissement";
    return "Résidence principale";
  }, [projectUsageUI]);

  const projectTimelineLabel = useMemo(() => {
    if (projectTimelineUI === "0_3m") return "0–3 mois";
    if (projectTimelineUI === "3_6m") return "3–6 mois";
    if (projectTimelineUI === "6_12m") return "6–12 mois";
    if (projectTimelineUI === "12m_plus") return "12+ mois";
    return "Je me renseigne";
  }, [projectTimelineUI]);

  /* ======================== Crédits: gestion dynamique ======================== */
  const handleNbCreditsChange = (value: number) => {
    const n = Math.min(Math.max(value, 0), 5);
    setNbCredits(n);

    setTypesCredits((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push("immo");
      return arr.slice(0, n);
    });

    setMensualitesCredits((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push("");
      return arr.slice(0, n);
    });

    setResteAnneesCredits((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push("10");
      return arr.slice(0, n);
    });

    setTauxCredits((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push("1.5");
      return arr.slice(0, n);
    });

    setRevenusLocatifs((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push("");
      return arr.slice(0, n);
    });
  };

  const handleTypeCreditChange = (index: number, value: TypeCredit) => {
    setTypesCredits((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleMensualiteChange = (index: number, value: string) => {
    setMensualitesCredits((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleResteAnneesChange = (index: number, value: string) => {
    setResteAnneesCredits((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleTauxCreditChange = (index: number, value: string) => {
    setTauxCredits((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleRevenuLocatifChange = (index: number, value: string) => {
    setRevenusLocatifs((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  /* ======================== Calcul global ======================== */

  const computeAll = (): ComputedAll =>
    computeCapacite({
      revenusNetMensuels,
      autresRevenusMensuels,
      chargesMensuellesHorsCredits,
      apportPersonnel,
      ageEmprunteur,
      ageCoEmprunteur,
      nbAdultes,
      nbEnfants,
      tauxEndettementCible,
      tauxCreditCible,
      tauxAssuranceCible,
      dureeCreditCible,
      nbCredits,
      typesCredits,
      mensualitesCredits,
      resteAnneesCredits,
      tauxCredits,
      revenusLocatifs,
      projectType,
      proStatus,
      propertyKind,
      projectUsageUI,
      projectTimelineUI,
      projectDepartment,
    });

  const handleCalculCapacite = async () => {
    setSendEmailMsg(null);
    setUnlockMsg(null);

    const rn = toInt(revenusNetMensuels, 0);
    if (!revenusNetMensuels || rn <= 0) {
      setRevenusError("Revenus obligatoires (montant > 0).");
      setStep(revenusStepIndex);
      return;
    }
    setRevenusError(null);

    const computed = computeAll();

    // ✅ FIX: stocker computedAll (sinon la synthèse ne s'affiche jamais)
    setComputedAll(computed);

    setResumeCapacite(computed.resume);
    setBankability(computed.assessment);
    setActionItems(computed.actionItems);

    if (typeof window !== "undefined") {
      const payload = {
        projectDepartment,
        propertyKind,
        projectType,
        projectUsageUI,
        projectTimelineUI,
        apportPersonnel,
        ageEmprunteur,
        ageCoEmprunteur,
        proStatus,
        nbAdultes,
        nbEnfants,
        revenusNetMensuels,
        autresRevenusMensuels,
        chargesMensuellesHorsCredits,
        nbCredits,
        typesCredits,
        mensualitesCredits,
        resteAnneesCredits,
        tauxCredits,
        revenusLocatifs,
        tauxCreditCible,
        tauxAssuranceCible,
        dureeCreditCible,
        tauxEndettementCible,
      };
      window.localStorage.setItem(CAPACITE_STORAGE_KEY, JSON.stringify(payload));
    }

  };

  useEffect(() => {
    if (!resumeCapacite) return;
    const t = setTimeout(() => {
      document.getElementById("resultats-capacite")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(t);
  }, [resumeCapacite]);

  /* ======================== Restore inputs ======================== */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(CAPACITE_STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);

      setProjectDepartment(saved.projectDepartment ?? "");
      setPropertyKind(saved.propertyKind ?? "appartement");
      setProjectType(saved.projectType ?? "ancien");
      setProjectUsageUI(saved.projectUsageUI ?? "rp");
      setProjectTimelineUI(saved.projectTimelineUI ?? "3_6m");
      setApportPersonnel(saved.apportPersonnel ? String(saved.apportPersonnel) : "");

      setAgeEmprunteur(saved.ageEmprunteur ? String(saved.ageEmprunteur) : "35");
      setAgeCoEmprunteur(saved.ageCoEmprunteur ? String(saved.ageCoEmprunteur) : "");
      setNbAdultes(saved.nbAdultes ? String(saved.nbAdultes) : "2");
      setNbEnfants(saved.nbEnfants !== undefined ? String(saved.nbEnfants) : "0");
      setProStatus(saved.proStatus ?? "cdi");

      setRevenusNetMensuels(saved.revenusNetMensuels ? String(saved.revenusNetMensuels) : "4000");
      setAutresRevenusMensuels(saved.autresRevenusMensuels ? String(saved.autresRevenusMensuels) : "");

      setChargesMensuellesHorsCredits(saved.chargesMensuellesHorsCredits ? String(saved.chargesMensuellesHorsCredits) : "");

      setNbCredits(saved.nbCredits ?? 0);
      setTypesCredits(saved.typesCredits ?? []);
      setMensualitesCredits((saved.mensualitesCredits ?? []).map((x: any) => (x ? String(x) : "")));
      setResteAnneesCredits((saved.resteAnneesCredits ?? []).map((x: any) => (x ? String(x) : "10")));
      setTauxCredits((saved.tauxCredits ?? []).map((x: any) => (x ? String(x) : "1.5")));
      setRevenusLocatifs((saved.revenusLocatifs ?? []).map((x: any) => (x ? String(x) : "")));

      setTauxCreditCible(saved.tauxCreditCible ? String(saved.tauxCreditCible) : "3.5");
      setTauxAssuranceCible(saved.tauxAssuranceCible ? String(saved.tauxAssuranceCible) : "0.30");
      setDureeCreditCible(saved.dureeCreditCible ? String(saved.dureeCreditCible) : "25");
      setTauxEndettementCible(saved.tauxEndettementCible ? String(saved.tauxEndettementCible) : "35");

      setUnlockMsg(null);
      setMaxStepReached(1);
      setStep(1);
    } catch (e) {
      console.error("Erreur de restauration de la simulation capacité :", e);
    }
  }, []);

  // Pré-remplissage depuis un lien /prix-m2/[ville] (?departement=...) : la
  // simulation restaurée depuis le localStorage (effet ci-dessus) reste la
  // valeur par défaut, mais une arrivée explicite depuis une page ville doit
  // primer sur une ancienne simulation enregistrée.
  useEffect(() => {
    if (!router.isReady) return;
    const { departement } = router.query;
    if (typeof departement === "string" && departement.trim()) {
      setProjectDepartment(departement);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  /* ======================== RPC lead capture ======================== */
  const captureLeadViaRpc = async (params: { email: string; computed: ComputedAll }) => {
    if (!supabase) throw new Error("Supabase non configuré.");

    const email = safeEmail(params.email);
    if (!email) throw new Error("Email manquant.");

    const { resume, texte, assessment, actionPlan, parsed } = params.computed;

    const utm = (typeof window !== "undefined" ? getUtmFromUrl() : null) ?? null;
    const source = getSourceLabel();

    const lead_age = parsed.age1 > 0 ? Math.round(parsed.age1) : null;
    const project_budget_target = resume?.prixBienMax && resume.prixBienMax > 0 ? Math.round(resume.prixBienMax) : null;

    const timelineDb: ProjectTimelineDB = TIMELINE_UI_TO_DB[projectTimelineUI];
    const usageDb: ProjectUsageDB = USAGE_UI_TO_DB[projectUsageUI];

    const payload = {
      meta: { tool: "capacite", version: "v19_simple_only_no_advanced" },
      project: {
        department: projectDepartment?.trim() || null,
        propertyKind,
        projectType,
        usage_ui: projectUsageUI,
        usage_db: usageDb,
        timeline_ui: projectTimelineUI,
        timeline_db: timelineDb,
      },
      profile: {
        ageEmprunteur: parsed.age1,
        ageCoEmprunteur: parsed.age2 > 0 ? parsed.age2 : null,
        proStatus,
        nbAdultes: parsed.adultes,
        nbEnfants: parsed.enfants,
      },
      input: {
        revenusNetMensuels: parsed.revenusNet,
        autresRevenusMensuels: parsed.autresRev,
        chargesMensuellesHorsCredits: parsed.chargesHors,
        tauxEndettementCible: parsed.tauxEndettement,
        nbCredits,
        typesCredits,
        mensualitesCredits: parsed.mensualitesNums,
        resteAnneesCredits: parsed.resteAnneesNums,
        tauxCredits: parsed.tauxCreditsNums,
        revenusLocatifs: parsed.loyersNums,
        tauxCreditCible: parsed.tauxCredit,
        tauxAssuranceCible: parsed.tauxAssurance,
        dureeCreditCible: parsed.dureeCredit,
        apportPersonnel: parsed.apport,
      },
      output: {
        resume,
        scenarios: params.computed.scenarios,
        texte,
        bankability: {
          score: assessment.score,
          label: assessment.label,
          comment: assessment.comment,
          details: assessment.details,
        },
        actionPlan,
      },
      tracking: {
        source,
        utm,
        referrer: typeof window !== "undefined" ? document.referrer || null : null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        createdAtClient: new Date().toISOString(),
      },
      consent: {
        consent_analysis: true,
        consent_contact: consentContact,
      },
      user: { user_id: sessionUserId || null, email: sessionEmail || null },
    };

    const { error } = await supabase.rpc("upsert_lead_v1", {
      p_tool: "capacite",
      p_email: email,
      p_payload: payload,
      p_postal_code: null,
      p_city: null,
      p_phone: leadPhone.trim() || null,
      p_source: source,
      p_utm: utm,
      p_lead_age: lead_age,
      p_project_property_kind: projectType || null,
      p_project_usage: usageDb,
      p_project_timeline: timelineDb,
      p_project_budget_target: project_budget_target,
    });

    if (error) {
      console.warn("[rpc upsert_lead_v1] error:", error);
      throw new Error(error.message || "Erreur RPC");
    }
  };

  async function sendAnalysisEmail(email: string, computed: ComputedAll) {
    setSendEmailMsg(null);

    const html = buildCapaciteEmailHtml({
      resume: computed.resume,
      assessment: computed.assessment,
      actionPlan: computed.actionPlan,
    });

    const text = buildCapaciteEmailText({
      resume: computed.resume,
      assessment: computed.assessment,
      actionPlan: computed.actionPlan,
    });

    const subject = "Votre rapport de capacité d'emprunt — lokt.fr";

    setSendingEmail(true);
    try {
      const r = await fetch("/api/tools/capacite/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, html, text }),
      });

      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "email_failed");

      setSendEmailMsg("✅ Email envoyé (pensez à vérifier les spams si besoin).");
      return true;
    } catch (e: any) {
      setSendEmailMsg("❌ Envoi email impossible : " + (e?.message || "erreur"));
      return false;
    } finally {
      setSendingEmail(false);
    }
  }

  const notifyAgencyOfLead = async (params: { email: string; computed: ComputedAll }) => {
    if (!agencyLead) return;
    const referrerUrl = typeof document !== "undefined" ? document.referrer || null : null;
    const r = await fetch("/api/tools/capacite/notify-agency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencyToken: agencyLead.token,
        visitorEmail: params.email,
        visitorPhone: leadPhone.trim() || null,
        referrerUrl,
        budgetTotalMax: params.computed.resume.budgetTotalMax,
        montantMax: params.computed.resume.montantMax,
        scoreLabel: params.computed.assessment.label,
        score: params.computed.assessment.score,
      }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => null);
      throw new Error(data?.error || "notify_agency_failed");
    }
  };

  const handleUnlock = async () => {
    setUnlockMsg(null);

    if (!hasResult) {
      setUnlockMsg("Calculez d'abord votre capacité pour débloquer l'analyse.");
      return;
    }

    const email = safeEmail(leadEmail);
    if (!email || !email.includes("@")) {
      setUnlockMsg("Merci de renseigner une adresse e-mail valide.");
      return;
    }

    // ✅ FIX: réutilise computedAll si dispo, sinon recalcule
    const computed = computedAll ?? computeAll();
    if (!computedAll) setComputedAll(computed);

    setUnlocking(true);
    try {
      // Widget embarqué sur le site d'une agence : jamais d'écriture dans la
      // base de leads lokt.fr, le lead ne part que vers l'agence, et
      // seulement si le visiteur a explicitement coché le consentement.
      if (agencyLead) {
        if (consentContact) {
          await notifyAgencyOfLead({ email, computed });
        }
      } else {
        await captureLeadViaRpc({ email, computed });
      }

      persistLeadEmail("capacite", email);
      persistUnlock("capacite", email);

      setUnlocked(true);
      setUnlockMsg("✅ Rapport prêt. Votre simulation est bien enregistrée.");

      if (sendByEmail) {
        await sendAnalysisEmail(email, computed);
      }
    } catch (e: any) {
      setUnlockMsg("❌ Impossible d'enregistrer le dossier : " + (e?.message || "erreur inconnue"));
    } finally {
      setUnlocking(false);
    }
  };

  // ✅ la couleur suit le libellé (pas un seuil de score dupliqué) pour
  // éviter tout risque de désaccord entre les deux, comme "Solide" affiché
  // en ambre ou "À optimiser" affiché en rouge.
  const scoreColor =
    !bankability
      ? "text-slate-900"
      : bankability.label === "Refus probable" || bankability.label === "Sous tension"
      ? "text-red-200"
      : bankability.label === "À optimiser"
      ? "text-amber-200"
      : "text-emerald-300";

  const loktScoreLabel = useMemo(() => {
    if (!bankability) return "Score lokt.fr";
    if (bankability.label === "Refus probable") return "Score lokt.fr — Refus probable";
    if (bankability.score >= 85) return "Score lokt.fr — Très solide";
    if (bankability.score >= 70) return "Score lokt.fr — Solide";
    if (bankability.score >= 55) return "Score lokt.fr — À optimiser";
    return "Score lokt.fr — Sous tension";
  }, [bankability]);

  const isAgence = useAgenceMode();
  const canShowFullAnalysis = useMemo(() => isLoggedIn || unlocked || isAgence, [isLoggedIn, unlocked, isAgence]);

  const tauxCreditNum = toFloat(tauxCreditCible, 0);
  const tauxAssuranceNum = toFloat(tauxAssuranceCible, 0);
  const dureeCreditNum = toInt(dureeCreditCible, 0);
  const tauxEndettementNum = toFloat(tauxEndettementCible, 0);

  /* ======================== UI ======================== */
  return (
    <div className="space-y-6">
      {/* Wizard */}
      <section className="relative z-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="grid lg:grid-cols-[19rem_minmax(0,1fr)]">
          {/* Progression */}
          <aside
            className={
              "relative overflow-hidden bg-slate-950 text-white " +
              (compactHeader ? "px-4 py-3" : "px-5 py-5 sm:px-6 lg:min-h-[39rem] lg:py-7")
            }
          >
            <div
              className="absolute inset-0 opacity-95"
              style={{
                background:
                  "linear-gradient(to bottom right, var(--lokt-accent-1, #635bff), var(--lokt-accent-2, #007ba7), var(--lokt-accent-3, #00a97b))",
              }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.2),transparent_38%,rgba(255,184,0,.22))]" />
            <div className="relative">
              {compactHeader ? (
                <>
                  {/* Bandeau fin : même navigation (pastilles cliquables pour
                      revenir à une étape déjà vue) mais sans titre ni icône
                      décorative, pour un format petit/moyen peu gourmand en
                      hauteur. */}
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-white">
                      Étape {step}/{TOTAL_STEPS} · {activeStepMeta.shortLabel}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {wizardSteps.map(({ label }, index) => {
                        const num = index + 1;
                        const active = step === num;
                        const done = step > num;
                        const clickable = num <= maxStepReached;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => goToStep(num)}
                            disabled={!clickable}
                            aria-label={`Aller à l'étape ${num} : ${label}`}
                            title={label}
                            className={
                              "h-2 rounded-full transition " +
                              (active ? "w-5 bg-white" : done ? "w-2 bg-white/70" : "w-2 bg-white/30") +
                              (clickable ? "" : " cursor-not-allowed")
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4 lg:block">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/70">
                        Simulation guidée
                      </p>
                      <p className="mt-2 text-xl font-semibold leading-tight text-white">
                        Votre capacité en quelques étapes.
                      </p>
                    </div>
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur lg:mt-5">
                      <SparklesIcon className="h-6 w-6" />
                    </span>
                  </div>

                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-medium text-white/75">
                    Étape {step} sur {TOTAL_STEPS}
                  </p>

                  <div className="-mx-1 mt-5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:overflow-visible lg:px-0">
                    <div className="flex min-w-max gap-2 lg:min-w-0 lg:flex-col">
                      {wizardSteps.map(({ label, shortLabel, icon: StepIcon }, index) => {
                    const num = index + 1;
                    const active = step === num;
                    const done = step > num;
                    const clickable = num <= maxStepReached;

                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => goToStep(num)}
                        disabled={!clickable}
                        className={
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition lg:w-full " +
                          (active
                            ? "border-white/70 bg-white text-slate-950 shadow-lg"
                            : done
                            ? "border-white/25 bg-white/15 text-white hover:bg-white/20"
                            : "border-white/10 bg-white/5 text-white/60") +
                          (clickable ? "" : " cursor-not-allowed opacity-70")
                        }
                        aria-label={`Aller à l'étape ${num} : ${label}`}
                        title={label}
                      >
                        <span
                          className={
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " +
                            (active
                              ? "bg-slate-950 text-white"
                              : done
                              ? "bg-white/20 text-white"
                              : "bg-white/10 text-white/70")
                          }
                        >
                          {done ? <CheckIcon className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[0.66rem] font-semibold uppercase tracking-[0.14em] opacity-70">
                            0{num}
                          </span>
                          <span className={"block text-sm " + (active ? "font-semibold" : "font-medium")}>
                            <span className="lg:hidden">{shortLabel}</span>
                            <span className="hidden lg:inline">{label}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                    </div>
                  </div>

                  <p className="mt-6 hidden text-xs leading-5 text-white/70 lg:block">
                    Les hypothèses restent ajustables jusqu&apos;au calcul final.
                  </p>
                </>
              )}
            </div>
          </aside>

          <div className={"flex flex-col bg-white p-5 sm:p-8" + (compactSteps ? "" : " min-h-[39rem]")}>
            {compactSteps ? (
              // Étape (icône + titre) sur une seule ligne plutôt qu'empilée
              // sur 4 blocs distincts — l'étiquette "Étape 0X" est déjà
              // redondante avec le bandeau fin au-dessus (compactHeader),
              // donc retirée ici pour ce format.
              <header className="flex items-start gap-2.5 border-b border-slate-100 pb-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 via-cyan-50 to-emerald-50 text-[#3f37c9]">
                  <ActiveStepIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-tight text-slate-950">{activeStepMeta.label}</h2>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">{activeStepMeta.description}</p>
                </div>
              </header>
            ) : (
              <header className="border-b border-slate-100 pb-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 via-cyan-50 to-emerald-50 text-[#3f37c9]">
                  <ActiveStepIcon className="h-6 w-6" />
                </span>
                <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">
                  Étape 0{step}
                </p>
                <h2 className="mt-1 text-2xl font-semibold leading-tight text-slate-950">
                  {activeStepMeta.label}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {activeStepMeta.description}
                </p>
              </header>
            )}

            {/* Contenu */}
            <div className="flex-1 space-y-5 py-6">

          {activeSections.includes("projet") ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className={labelBase}>
                    Usage du futur bien
                    <InfoBadge text="Résidence principale, secondaire ou investissement : la banque ne lit pas toujours le dossier de la même façon." />
                  </label>
                  <StyledSelect
                    value={projectUsageUI}
                    onChange={(v) => setProjectUsageUI(v)}
                    options={[
                      { value: "rp", label: "Résidence principale" },
                      { value: "rs", label: "Résidence secondaire" },
                      { value: "invest", label: "Investissement locatif" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>
                    Type de bien
                    <InfoBadge text="Permet de qualifier le projet et de contextualiser l'analyse." />
                  </label>
                  <StyledSelect
                    value={propertyKind}
                    onChange={(v) => setPropertyKind(v)}
                    options={[
                      { value: "appartement", label: "Appartement" },
                      { value: "maison", label: "Maison" },
                      { value: "terrain", label: "Terrain" },
                      { value: "autre", label: "Autre" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>
                    Département
                    <InfoBadge text="Zone de recherche indicative, par exemple 75, 78 ou 13." />
                  </label>
                  <input
                    value={projectDepartment}
                    onChange={(e) => setProjectDepartment(e.target.value.replace(/\s+/g, ""))}
                    placeholder="ex: 78"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className={labelBase}>
                    Nature du projet
                    <InfoBadge text="Les frais d'acquisition varient fortement entre ancien, neuf et terrain + construction." />
                  </label>
                  <StyledSelect
                    value={projectType}
                    onChange={(v) => setProjectType(v)}
                    options={[
                      { value: "ancien", label: "Ancien" },
                      { value: "neuf", label: "Neuf / VEFA" },
                      { value: "terrain", label: "Terrain + construction" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Horizon d'achat</label>
                  <StyledSelect
                    value={projectTimelineUI}
                    onChange={(v) => setProjectTimelineUI(v)}
                    options={[
                      { value: "0_3m", label: "0-3 mois" },
                      { value: "3_6m", label: "3-6 mois" },
                      { value: "6_12m", label: "6-12 mois" },
                      { value: "12m_plus", label: "12+ mois" },
                      { value: "juste_info", label: "Je me renseigne" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Apport personnel (€)</label>
                  <input
                    inputMode="numeric"
                    value={apportPersonnel}
                    onChange={(e) => setApportPersonnel(onlyDigits(e.target.value))}
                    placeholder="ex: 30000"
                    className={inputBase}
                  />
                </div>
              </div>
            </>
          ) : null}

          {activeSections.includes("profil") ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className={labelBase}>
                    Statut professionnel
                    <InfoBadge text="CDI, fonctionnaire, indépendant ou retraité : la stabilité perçue change selon les banques." />
                  </label>
                  <StyledSelect
                    value={proStatus}
                    onChange={(v) => setProStatus(v)}
                    options={[
                      { value: "cdi", label: "CDI" },
                      { value: "fonctionnaire", label: "Fonctionnaire" },
                      { value: "independant", label: "Indépendant / société" },
                      { value: "retraite", label: "Retraité" },
                      { value: "autre", label: "Autre" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Âge emprunteur</label>
                  <input inputMode="numeric" value={ageEmprunteur} onChange={(e) => setAgeEmprunteur(onlyDigits(e.target.value))} placeholder="ex: 35" className={inputBase} />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Âge co-emprunteur <span className="text-slate-400 font-normal text-xs">optionnel</span></label>
                  <input inputMode="numeric" value={ageCoEmprunteur} onChange={(e) => setAgeCoEmprunteur(onlyDigits(e.target.value))} placeholder="si concerné" className={inputBase} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={labelBase}>Adultes dans le foyer</label>
                  <input inputMode="numeric" value={nbAdultes} onChange={(e) => setNbAdultes(onlyDigits(e.target.value))} className={inputBase} />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Enfants à charge</label>
                  <input inputMode="numeric" value={nbEnfants} onChange={(e) => setNbEnfants(onlyDigits(e.target.value))} className={inputBase} />
                </div>
              </div>
            </>
          ) : null}

          {activeSections.includes("revenus") ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={labelBase}>Revenus nets mensuels (€) *</label>
                  <input
                    required
                    inputMode="numeric"
                    value={revenusNetMensuels}
                    onChange={(e) => { setRevenusNetMensuels(onlyDigits(e.target.value)); setRevenusError(null); }}
                    className={"w-full min-w-0 rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:outline-none focus:ring-4 " + (revenusError ? "border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-cyan-400 focus:ring-cyan-100")}
                    aria-invalid={!!revenusError}
                  />
                  {revenusError ? <p className="text-[0.7rem] text-red-600">{revenusError}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>
                    Autres revenus mensuels (€)
                    <InfoBadge text="Pensions, revenus réguliers ou primes mensualisées. Restez prudent." />
                  </label>
                  <input inputMode="numeric" value={autresRevenusMensuels} onChange={(e) => setAutresRevenusMensuels(onlyDigits(e.target.value))} placeholder="optionnel" className={inputBase} />
                </div>
              </div>
            </>
          ) : null}

          {activeSections.includes("charges") ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={labelBase}>Charges fixes hors crédits (€)</label>
                  <input
                    inputMode="numeric"
                    value={chargesMensuellesHorsCredits}
                    onChange={(e) => setChargesMensuellesHorsCredits(onlyDigits(e.target.value))}
                    placeholder="pension alimentaire, garde d'enfant…"
                    className={inputBase}
                  />
                  <p className="text-[0.7rem] leading-4 text-slate-500">
                    Ne pas inclure votre loyer actuel — il disparaît avec l'achat.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Nombre de crédits en cours</label>
                  <StyledSelect
                    value={String(nbCredits)}
                    onChange={(v) => handleNbCreditsChange(Number(v))}
                    options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
                  />
                </div>
              </div>

              {nbCredits > 0 ? (
                <div className="space-y-3">
                  {Array.from({ length: nbCredits }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                      <p className="text-xs font-semibold text-slate-900">Crédit {index + 1}</p>
                      <div className="grid gap-3 sm:grid-cols-5">
                        <div className="space-y-1 sm:col-span-1">
                          <label className="text-xs text-slate-700">Type</label>
                          <StyledSelect
                            size="small"
                            value={typesCredits[index] || "immo"}
                            onChange={(v) => handleTypeCreditChange(index, v)}
                            options={[
                              { value: "immo", label: "Immobilier" },
                              { value: "perso", label: "Personnel" },
                              { value: "auto", label: "Auto" },
                              { value: "conso", label: "Conso" },
                            ]}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Mensualité (€)</label>
                          <input inputMode="numeric" value={mensualitesCredits[index] || ""} onChange={(e) => handleMensualiteChange(index, onlyDigits(e.target.value))} className={inputSmall} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Reste (années)</label>
                          <input inputMode="numeric" value={resteAnneesCredits[index] || ""} onChange={(e) => handleResteAnneesChange(index, onlyDigits(e.target.value))} className={inputSmall} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Taux (%)</label>
                          <input inputMode="decimal" value={tauxCredits[index] || ""} onChange={(e) => handleTauxCreditChange(index, onlyNumberLike(e.target.value))} className={inputSmall} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Loyer mensuel (€)</label>
                          <input
                            inputMode="numeric"
                            value={revenusLocatifs[index] || ""}
                            onChange={(e) => handleRevenuLocatifChange(index, onlyDigits(e.target.value))}
                            disabled={(typesCredits[index] || "immo") !== "immo"}
                            placeholder={(typesCredits[index] || "immo") === "immo" ? "si locatif" : "—"}
                            className={inputSmall + " disabled:bg-slate-100 disabled:text-slate-400"}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-[0.75rem] text-slate-600">
                  Aucun crédit en cours déclaré.
                </div>
              )}
            </>
          ) : null}

          {activeSections.includes("pret") ? (
            <>
              <div className="grid items-end gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className={labelBase}>Endettement cible (%)</label>
                  <input inputMode="decimal" value={tauxEndettementCible} onChange={(e) => setTauxEndettementCible(onlyNumberLike(e.target.value))} className={inputBase} />
                </div>
                <div className="space-y-1">
                  <label className={labelBase}>Taux crédit (%)</label>
                  <input inputMode="decimal" value={tauxCreditCible} onChange={(e) => setTauxCreditCible(onlyNumberLike(e.target.value))} className={inputBase} />
                </div>
                <div className="space-y-1">
                  <label className={labelBase}>
                    Assurance (%/an)
                    <InfoBadge text="Hypothèse annuelle appliquée au capital emprunté. Elle est intégrée dans la mensualité, comme dans la lecture bancaire." />
                  </label>
                  <input inputMode="decimal" value={tauxAssuranceCible} onChange={(e) => setTauxAssuranceCible(onlyNumberLike(e.target.value))} className={inputBase} />
                </div>
                <div className="space-y-1">
                  <label className={labelBase}>Durée (années)</label>
                  <input inputMode="numeric" value={dureeCreditCible} onChange={(e) => setDureeCreditCible(onlyDigits(e.target.value))} className={inputBase} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-[0.75rem] text-slate-700">
                <p className="font-semibold text-slate-900">Résumé avant calcul</p>
                <p className="mt-1">
                  {propertyKindLabel} — {projectTypeLabel} — {projectUsageLabel} — horizon {projectTimelineLabel}.
                </p>
                <p className="mt-1">
                  Revenus déclarés : {formatEuro(toInt(revenusNetMensuels, 0) + toInt(autresRevenusMensuels, 0))} · Charges hors crédits :{" "}
                  {formatEuro(toInt(chargesMensuellesHorsCredits, 0))} · Apport : {formatEuro(toInt(apportPersonnel, 0))}.
                </p>
                <p className="mt-1">
                  Hypothèses : cible {formatPct(tauxEndettementNum)}, taux {formatPct(tauxCreditNum)}, assurance{" "}
                  {formatPct(tauxAssuranceNum)}, durée {dureeCreditNum || "-"} ans.
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Navigation */}
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:flex sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 1}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-default disabled:opacity-0"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Précédent
          </button>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => {
                if (activeSections.includes("revenus")) {
                  const rn = toInt(revenusNetMensuels, 0);
                  if (!revenusNetMensuels || rn <= 0) {
                    setRevenusError("Revenus obligatoires (montant > 0).");
                    return;
                  }
                }
                setRevenusError(null);
                setMaxStepReached((m) => Math.max(m, Math.min(step + 1, TOTAL_STEPS)));
                goNext();
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800"
            >
              Continuer
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                setMaxStepReached(TOTAL_STEPS);
                await handleCalculCapacite();
              }}
              style={{
                background: "linear-gradient(to right, var(--lokt-accent-3, #00a97b), var(--lokt-accent-4, #008db8))",
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:shadow-xl active:scale-[0.99]"
            >
              Calculer ma capacité d&apos;emprunt
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          )}
            </div>
          </div>
        </div>
      </section>

      {/* Résultats */}
      {hasResult && <section
        id="resultats-capacite"
        className="space-y-4 rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600 mb-1">
              Résultats de votre simulation
            </p>
            <h2 className="text-sm font-semibold text-slate-900">
              Votre capacité d&apos;emprunt est calculée
            </h2>
            <p className="text-[0.75rem] text-slate-600">
              Entrez votre email pour débloquer les résultats et recevoir votre simulation complète.
            </p>
          </div>
        </div>

        {/* 🔒 Gate — affiché avant tout résultat */}
        {!canShowFullAnalysis ? (
          <LeadGate
            theme="cyan-emerald"
            title="Débloquer votre simulation"
            subtitle="Mensualité max, capital empruntable, budget total, taux d'endettement, score bancaire et plan d'action personnalisé — envoyés par email."
            email={leadEmail}
            setEmail={setLeadEmail}
            phone={leadPhone}
            setPhone={setLeadPhone}
            consent={consentLokt}
            setConsent={setConsentLokt}
            contactConsent={consentContact}
            setContactConsent={setConsentContact}
            contactConsentLabel={
              agencyLead
                ? `j’accepte que mes coordonnées soient transmises par email à ${agencyLead.siteLabel || "ce site"} pour être recontacté(e) au sujet de mon projet — cette transmission relève de la responsabilité de ${agencyLead.siteLabel || "ce site"}, et non de la politique de confidentialité de lokt.fr.`
                : undefined
            }
            unlocking={unlocking || sendingEmail}
            unlockMsg={unlockMsg}
            onUnlock={handleUnlock}
            sendByEmail={sendByEmail}
            setSendByEmail={setSendByEmail}
            sendingEmail={sendingEmail}
            sendEmailMsg={sendEmailMsg}
          />
        ) : null}

        {/* ✅ Résultats débloqués */}
        {canShowFullAnalysis ? (
          <>
            {/* Cartes résumé */}
            <div className="grid gap-3 sm:grid-cols-4 items-stretch">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Mensualité max</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatEuro(resumeCapacite!.mensualiteMax)}
                </p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">
                  Capacité théorique sans dépasser la cible.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Capital empruntable</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatEuro(resumeCapacite!.montantMax)}
                </p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">
                  {dureeCreditNum || "-"} ans · taux {formatPct(tauxCreditNum)} · assurance {formatPct(tauxAssuranceNum)}.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                  Budget max (avec apport)
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatEuro(resumeCapacite!.budgetTotalMax)}
                </p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">
                  Apport : {formatEuro(resumeCapacite!.apport)}{" "}
                  {resumeCapacite!.apportMinRecommande > 0 ? (
                    resumeCapacite!.apportCouvreFrais ? (
                      <span className="text-emerald-700 font-semibold">— OK frais</span>
                    ) : (
                      <span className="text-amber-700 font-semibold">— apport &lt; frais</span>
                    )
                  ) : null}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Endettement</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatPct(resumeCapacite!.tauxEndettementAvecProjet)}
                </p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">
                  Mensualité projet : {formatEuro(resumeCapacite!.mensualiteProjet)} assurance incluse.
                </p>
              </div>
            </div>

            {/* Analyse détaillée (bankability) */}
            {bankability ? (
              <>
                {computedAll?.scenarios?.length ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Comparer les durées</p>
                        <p className="text-[0.75rem] text-slate-600">Même cible d'endettement, même taux, assurance incluse.</p>
                      </div>
                      <p className="text-[0.7rem] text-slate-500">Durée sélectionnée : {dureeCreditNum || "-"} ans</p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      {computedAll.scenarios.map((scenario) => (
                        <div
                          key={scenario.duree}
                          className={"rounded-lg border px-3 py-2 " + (scenario.duree === dureeCreditNum ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[0.75rem] font-semibold text-slate-900">{scenario.duree} ans</p>
                            {scenario.duree === dureeCreditNum ? (
                              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[0.6rem] font-semibold text-white">choisi</span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(scenario.montantMax)}</p>
                          <p className="text-[0.68rem] text-slate-600">
                            {formatEuro(scenario.mensualiteCreditHorsAssurance)} + {formatEuro(scenario.assuranceMensuelle)} ass.
                          </p>
                          <p className="mt-1 text-[0.68rem] text-slate-500">Prix bien env. {formatEuro(scenario.prixBienMax)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-4 items-stretch">
                  <div className="rounded-xl bg-slate-900 text-white px-3 py-2.5 sm:col-span-2 h-full flex flex-col">
                    <p className="text-[0.65rem] uppercase tracking-[0.14em] text-emerald-200">{loktScoreLabel}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className={`text-2xl font-semibold ${scoreColor}`}>{bankability.score}/100</p>
                      <p className="text-[0.85rem] font-medium text-white">{bankability.label}</p>
                    </div>
                    <p className="mt-1 text-[0.75rem] text-slate-100">{bankability.comment}</p>
                    <p className="mt-auto pt-2 text-[0.7rem] text-slate-200">
                      Indice indicatif : il reflète surtout endettement, reste à vivre, apport et situation.
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 sm:col-span-2 h-full flex flex-col">
                    <div>
                      <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                        Détails (pour comprendre)
                      </p>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                          <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                            Endettement vs cible
                          </p>
                          <p className="text-[0.8rem] text-slate-900 mt-0.5">
                            {(bankability.details.dtiRatio * 100).toFixed(0)}% de la cible
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                          <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                            Reste à vivre (par "part")
                          </p>
                          <p className="text-[0.8rem] text-slate-900 mt-0.5">
                            ~{formatEuro(bankability.details.resteAVivreParUC)}
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 sm:col-span-2">
                          <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                            Reste à vivre total après projet
                          </p>
                          <p
                            className={`text-[0.8rem] mt-0.5 ${
                              bankability.details.resteApresProjet < 0
                                ? "text-red-700 font-semibold"
                                : "text-slate-900"
                            }`}
                          >
                            {formatEuro(bankability.details.resteApresProjet)}
                          </p>
                          {bankability.details.resteApresProjet < 0 ? (
                            <p className="text-[0.7rem] text-red-700 mt-1">
                              Un reste à vivre négatif est généralement un "non" bancaire.
                            </p>
                          ) : null}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 sm:col-span-2">
                          <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                            Sous-scores
                          </p>
                          <p className="text-[0.75rem] text-slate-700 mt-1">
                            Endettement {bankability.details.subScores.dti} · Reste à vivre{" "}
                            {bankability.details.subScores.rav} · Stabilité{" "}
                            {bankability.details.subScores.stability} · Âge{" "}
                            {bankability.details.subScores.age} · Conso{" "}
                            {bankability.details.subScores.conso} · Apport{" "}
                            {bankability.details.subScores.apport}
                          </p>
                        </div>
                      </div>

                      {(bankability.details.hardCapsApplied.ravNegative ||
                        bankability.details.hardCapsApplied.ravLow ||
                        bankability.details.hardCapsApplied.dtiHigh ||
                        bankability.details.hardCapsApplied.apportLow) ? (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
                          <p className="text-[0.7rem] text-amber-800 font-semibold">
                            Points d'attention détectés :
                          </p>
                          <ul className="mt-1 list-disc pl-5 space-y-0.5">
                            {bankability.details.hardCapsApplied.ravNegative && (
                              <li className="text-[0.7rem] text-amber-800">Reste à vivre négatif</li>
                            )}
                            {bankability.details.hardCapsApplied.ravLow && (
                              <li className="text-[0.7rem] text-amber-800">Reste à vivre très faible</li>
                            )}
                            {bankability.details.hardCapsApplied.dtiHigh && (
                              <li className="text-[0.7rem] text-amber-800">Endettement au-dessus de la cible</li>
                            )}
                            {bankability.details.hardCapsApplied.apportLow && (
                              <li className="text-[0.7rem] text-amber-800">Apport inférieur aux frais estimés</li>
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    <p className="mt-auto pt-2 text-[0.7rem] text-slate-600">
                      Indicateur indicatif : chaque banque a ses propres règles.
                    </p>
                  </div>
                </div>

                {actionItems.length > 0 ? (
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

            <p className="mt-2 text-[0.65rem] text-slate-500">
              Résultats indicatifs. Ils ne constituent pas une offre de prêt.
            </p>
          </>
        ) : null}
      </section>}
    </div>
  );
}
