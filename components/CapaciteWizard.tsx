// components/CapaciteWizard.tsx
import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
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

const CAPACITE_STORAGE_KEY = "capacite_simulation_v19_simple_only_no_advanced";

/* ------------------------ Format helpers ------------------------ */
function formatEuro(val: number) {
  if (!Number.isFinite(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (!Number.isFinite(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

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

function toInt(v: string, fallback = 0) {
  const x = parseInt(v, 10);
  return Number.isFinite(x) ? x : fallback;
}

function toFloat(v: string, fallback = 0) {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : fallback;
}

/* ------------------------ Types ------------------------ */
type TypeCredit = "immo" | "perso" | "auto" | "conso";

type ProjectType = "ancien" | "neuf" | "terrain";
type ProStatus = "cdi" | "fonctionnaire" | "independant" | "retraite" | "autre";

// (payload only)
type PropertyKind = "appartement" | "maison" | "terrain" | "autre";

// UI keys
type ProjectUsageUI = "rp" | "rs" | "invest";
type ProjectTimelineUI = "0_3m" | "3_6m" | "6_12m" | "12m_plus" | "juste_info";

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

type ResumeCapacite = {
  revenusPrisEnCompte: number;
  mensualitesExistantes: number;
  chargesHorsCredits: number;

  tauxEndettementActuel: number;
  tauxEndettementAvecProjet: number;

  mensualiteMax: number;
  montantMax: number;
  mensualiteCreditHorsAssurance: number;
  assuranceMensuelle: number;
  tauxAssurance: number;
  mensualiteProjet: number;

  apport: number;
  budgetTotalMax: number;
  apportMinRecommande: number;
  apportCouvreFrais: boolean;

  prixBienMax: number;
  fraisNotaireEstimes: number;
  fraisAgenceEstimes: number;
  coutTotalProjetMax: number;
};

type ScenarioCapacite = {
  duree: number;
  montantMax: number;
  mensualiteCreditHorsAssurance: number;
  assuranceMensuelle: number;
  mensualiteProjet: number;
  budgetTotalMax: number;
  prixBienMax: number;
};

type BankabilityAssessment = {
  score: number;
  label: string;
  comment: string;
  details: {
    dtiRatio: number;
    resteAVivreParUC: number;
    resteApresProjet: number;
    hardCapsApplied: {
      ravNegative: boolean;
      ravLow: boolean;
      dtiHigh: boolean;
      apportLow: boolean;
    };
    subScores: {
      dti: number;
      rav: number;
      stability: number;
      age: number;
      conso: number;
      apport: number;
    };
  };
};

type ActionPlanItemType = "blocking" | "warning" | "positive" | "tip";
type ActionPlanItem = { type: ActionPlanItemType; title: string; body: string };

const ACTION_ITEM_CONFIG: Record<
  ActionPlanItemType,
  { Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; badge: string; bg: string; border: string; iconBg: string; iconText: string; titleText: string; badgeCls: string }
> = {
  blocking: { Icon: ExclamationTriangleIcon, badge: "Bloquant", bg: "bg-red-50", border: "border-red-200", iconBg: "bg-red-100", iconText: "text-red-600", titleText: "text-red-900", badgeCls: "bg-red-100 text-red-700" },
  warning:  { Icon: ExclamationCircleIcon,  badge: "À surveiller", bg: "bg-amber-50", border: "border-amber-200", iconBg: "bg-amber-100", iconText: "text-amber-600", titleText: "text-amber-900", badgeCls: "bg-amber-100 text-amber-700" },
  positive: { Icon: CheckCircleIcon,        badge: "Atout", bg: "bg-emerald-50", border: "border-emerald-200", iconBg: "bg-emerald-100", iconText: "text-emerald-600", titleText: "text-emerald-900", badgeCls: "bg-emerald-100 text-emerald-700" },
  tip:      { Icon: LightBulbIcon,          badge: "Conseil", bg: "bg-indigo-50", border: "border-indigo-200", iconBg: "bg-indigo-100", iconText: "text-indigo-600", titleText: "text-indigo-900", badgeCls: "bg-indigo-100 text-indigo-700" },
};

function actionItemsToString(items: ActionPlanItem[]): string {
  return items.map((it) => `### [${it.type.toUpperCase()}] ${it.title}\n${it.body}`).join("\n\n");
}

type ComputedAll = {
  resume: ResumeCapacite;
  scenarios: ScenarioCapacite[];
  texte: string;
  assessment: BankabilityAssessment;
  actionPlan: string;
  actionItems: ActionPlanItem[];
  parsed: {
    revenusNet: number;
    autresRev: number;
    chargesHors: number;
    apport: number;

    age1: number;
    age2: number;

    adultes: number;
    enfants: number;

    tauxEndettement: number;
    tauxCredit: number;
    tauxAssurance: number;
    dureeCredit: number;

    mensualitesNums: number[];
    resteAnneesNums: number[];
    tauxCreditsNums: number[];
    loyersNums: number[];
  };
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

/* ------------------------ lokt.fr Score helpers ------------------------ */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function round0(n: number) {
  return Math.round(n);
}

/* ------------------------ Loan helpers (monthly) ------------------------ */
function monthlyPayment(principal: number, annualRatePct: number, years: number) {
  const P = Math.max(0, principal || 0);
  const n = Math.max(0, Math.round((years || 0) * 12));
  const r = Math.max(0, (annualRatePct || 0) / 100) / 12;

  if (P <= 0 || n <= 0) return 0;
  if (r === 0) return P / n;

  return (P * r) / (1 - Math.pow(1 + r, -n));
}

function monthlyInsurance(principal: number, annualInsurancePct: number) {
  const P = Math.max(0, principal || 0);
  const assurance = Math.max(0, annualInsurancePct || 0) / 100;
  return (P * assurance) / 12;
}

function monthlyPaymentWithInsurance(
  principal: number,
  annualRatePct: number,
  years: number,
  annualInsurancePct: number
) {
  return monthlyPayment(principal, annualRatePct, years) + monthlyInsurance(principal, annualInsurancePct);
}

function principalFromPaymentWithInsurance(
  payment: number,
  annualRatePct: number,
  years: number,
  annualInsurancePct: number
) {
  const M = Math.max(0, payment || 0);
  const n = Math.max(0, Math.round((years || 0) * 12));
  const r = Math.max(0, (annualRatePct || 0) / 100) / 12;
  const insuranceMonthlyRate = Math.max(0, annualInsurancePct || 0) / 100 / 12;

  if (M <= 0 || n <= 0) return 0;

  const creditMonthlyRate =
    r === 0 ? 1 / n : r / (1 - Math.pow(1 + r, -n));
  const totalMonthlyRate = creditMonthlyRate + insuranceMonthlyRate;

  if (totalMonthlyRate <= 0) return 0;
  return M / totalMonthlyRate;
}

function computeUC(nbAdultes: number, nbEnfants: number) {
  const a = Math.max(1, nbAdultes || 1);
  const e = Math.max(0, nbEnfants || 0);
  return 1 + 0.5 * Math.max(0, a - 1) + 0.3 * e;
}

function proStabilityFactor(proStatus: ProStatus) {
  switch (proStatus) {
    case "fonctionnaire":
      return 1.0;
    case "cdi":
      return 0.9;
    case "retraite":
      return 0.85;
    case "independant":
      return 0.75;
    default:
      return 0.7;
  }
}

/* ------------------------ Score lokt.fr ------------------------ */
function computeLoktScore(params: {
  resume: ResumeCapacite;
  tauxEndettementCible: number;
  proStatus: ProStatus;
  ageEmprunteur: number;
  ageCoEmprunteur: number;
  nbAdultes: number;
  nbEnfants: number;
  dureeCreditCible: number;
  nbCredits: number;
  typesCredits: TypeCredit[];
  mensualitesCredits: number[];
}): BankabilityAssessment {
  const {
    resume,
    tauxEndettementCible,
    proStatus,
    ageEmprunteur,
    ageCoEmprunteur,
    nbAdultes,
    nbEnfants,
    dureeCreditCible,
    nbCredits,
    typesCredits,
    mensualitesCredits,
  } = params;

  if (!Number.isFinite(resume.revenusPrisEnCompte) || resume.revenusPrisEnCompte <= 0) {
    return {
      score: 0,
      label: "Refus probable",
      comment: "Revenus pris en compte nuls : le score est quasi nul.",
      details: {
        dtiRatio: 1,
        resteAVivreParUC: 0,
        resteApresProjet: 0,
        hardCapsApplied: {
          ravNegative: true,
          ravLow: false,
          dtiHigh: false,
          apportLow: false,
        },
        subScores: { dti: 0, rav: 0, stability: 0, age: 0, conso: 0, apport: 0 },
      },
    };
  }

  const cible = tauxEndettementCible > 0 ? tauxEndettementCible : 35;
  const dtiRatio = cible > 0 ? resume.tauxEndettementAvecProjet / cible : 1;

  const chargesActuelles = resume.mensualitesExistantes + resume.chargesHorsCredits;
  const mensualiteScore = resume.mensualiteProjet || 0;

  const resteApresProjet = (resume.revenusPrisEnCompte || 0) - (chargesActuelles + (mensualiteScore || 0));
  const uc = computeUC(nbAdultes, nbEnfants);
  const resteAVivreParUC = uc > 0 ? resteApresProjet / uc : resteApresProjet;

  let s_dti = 60;
  if (!Number.isFinite(dtiRatio)) s_dti = 50;
  else if (dtiRatio <= 0.7) s_dti = 100;
  else if (dtiRatio <= 0.9) s_dti = 100 - ((dtiRatio - 0.7) / 0.2) * 15;
  else if (dtiRatio <= 1.0) s_dti = 85 - ((dtiRatio - 0.9) / 0.1) * 15;
  else if (dtiRatio <= 1.15) s_dti = 70 - ((dtiRatio - 1.0) / 0.15) * 25;
  else s_dti = 15;

  let s_rav = 55;
  if (!Number.isFinite(resteAVivreParUC)) s_rav = 30;
  else if (resteAVivreParUC < 0) {
    const deficit = Math.abs(resteAVivreParUC);
    s_rav = clamp(18 - (deficit / 250) * 4, 0, 18);
  } else if (resteAVivreParUC >= 1800) s_rav = 100;
  else if (resteAVivreParUC >= 1400) s_rav = 85;
  else if (resteAVivreParUC >= 1100) s_rav = 70;
  else if (resteAVivreParUC >= 900) s_rav = 55;
  else if (resteAVivreParUC >= 700) s_rav = 40;
  else s_rav = 20;

  const s_stability = proStabilityFactor(proStatus) * 100;

  const a1 = Math.max(0, ageEmprunteur || 0);
  const a2 = Math.max(0, ageCoEmprunteur || 0);
  const ageMax = Math.max(a1, a2);
  const ageFin = ageMax > 0 ? ageMax + Math.max(0, dureeCreditCible || 0) : 0;

  let s_age = 80;
  if (ageFin > 0 && ageFin <= 70) s_age = 100;
  else if (ageFin <= 75) s_age = 90;
  else if (ageFin <= 80) s_age = 75;
  else if (ageFin <= 85) s_age = 55;
  else if (ageFin > 85) s_age = 35;

  const consoIdx: number[] = [];
  for (let i = 0; i < Math.max(0, nbCredits || 0); i++) {
    const t = typesCredits[i];
    if (t === "perso" || t === "auto" || t === "conso") consoIdx.push(i);
  }
  const consoCount = consoIdx.length;
  const totalMensuConso = consoIdx.reduce((s, idx) => s + (mensualitesCredits[idx] || 0), 0);

  const penMontant = clamp((totalMensuConso / 100) * 8, 0, 40);
  const penCount = clamp(consoCount * 6, 0, 20);
  const s_conso = clamp(100 - (penMontant + penCount), 25, 100);

  let s_apport = 65;
  if (resume.apportMinRecommande <= 0) s_apport = 65;
  else if (resume.apport >= resume.apportMinRecommande) s_apport = 100;
  else {
    const ratio = clamp(resume.apport / resume.apportMinRecommande, 0, 1);
    s_apport = 10 + 90 * Math.pow(ratio, 1.3);
  }

  const rawScore =
    0.42 * s_dti +
    0.24 * s_rav +
    0.13 * s_stability +
    0.08 * s_age +
    0.05 * s_conso +
    0.08 * s_apport;

  let scoreR = clamp(round0(rawScore), 0, 100);

  const hardCaps = { ravNegative: false, ravLow: false, dtiHigh: false, apportLow: false };
  const NEAR_ZERO_RAV = 200;

  if (resteApresProjet <= 0) {
    hardCaps.ravNegative = true;
    scoreR = 0;
  } else if (resteApresProjet < NEAR_ZERO_RAV) {
    hardCaps.ravLow = true;
    scoreR = Math.min(scoreR, 10);
  }

  const dti = resume.tauxEndettementAvecProjet || 0;
  if (Number.isFinite(dti) && Number.isFinite(cible) && cible > 0) {
    const delta = dti - cible;
    if (delta > 10) {
      hardCaps.dtiHigh = true;
      scoreR = Math.min(scoreR, 40);
    } else if (delta > 5) {
      hardCaps.dtiHigh = true;
      scoreR = Math.min(scoreR, 55);
    }
  }

  if (resume.apportMinRecommande > 0 && resume.apport < resume.apportMinRecommande) {
    hardCaps.apportLow = true;
    scoreR = Math.min(scoreR, 55);
    if (hardCaps.ravNegative || hardCaps.dtiHigh) scoreR = Math.min(scoreR, 40);
  }

  let label = "À optimiser";
  if (hardCaps.ravNegative || (hardCaps.dtiHigh && dti - cible > 10)) label = "Refus probable";
  else if (scoreR >= 85) label = "Très solide";
  else if (scoreR >= 70) label = "Solide";
  else if (scoreR >= 55) label = "À optimiser";
  else label = "Sous tension";

  const subs = {
    dti: s_dti,
    rav: s_rav,
    stability: s_stability,
    age: s_age,
    conso: s_conso,
    apport: s_apport,
  };
  const weakest = (Object.keys(subs) as (keyof typeof subs)[]).sort((a, b) => subs[a] - subs[b])[0];

  let comment = "Votre dossier est globalement cohérent, avec quelques optimisations possibles.";

  if (hardCaps.ravNegative) {
    comment =
      "Signal rouge : votre reste à vivre après projet est négatif. Dans cette configuration, une banque refusera très probablement.";
  } else if (hardCaps.dtiHigh) {
    comment =
      "Point bloquant : votre endettement projeté dépasse nettement la cible. Le levier principal est de réduire la mensualité (durée / budget) ou de diminuer certaines charges, ou d'augmenter l'apport.";
  } else if (hardCaps.apportLow) {
    comment =
      "Point d'attention : votre apport ne couvre pas les frais estimés (notaire + garantie). Beaucoup de banques demandent au minimum ces frais en apport.";
  } else {
    if (weakest === "apport") {
      comment =
        "Votre score est surtout pénalisé par un apport un peu faible par rapport aux frais. Couvrir au minimum les frais en apport améliore nettement la lecture bancaire.";
    } else if (weakest === "dti") {
      comment =
        "Votre score est surtout lié à un endettement proche (ou au-dessus) de la cible. Le levier principal : réduire la mensualité (durée / budget) ou renforcer l'apport.";
    } else if (weakest === "rav") {
      comment =
        "Votre score est surtout lié au reste à vivre. À situation égale, cela se joue via la maîtrise des charges fixes et le calibrage de la mensualité.";
    } else if (weakest === "stability") {
      comment =
        "Selon votre statut, la banque peut être plus prudente. Il faut soigner la présentation : régularité des revenus, ancienneté, justificatifs, cohérence globale.";
    } else if (weakest === "age") {
      comment =
        "La durée et l'âge en fin de prêt pèsent dans la décision. Selon les banques, il faudra peut-être ajuster la durée ou renforcer le dossier.";
    } else if (weakest === "conso") {
      comment =
        "Les crédits conso/auto pèsent sur la décision. Une réduction ciblée (remboursement / regroupement) peut améliorer le score rapidement.";
    }
  }

  if (resteApresProjet <= 0) {
    label = "Refus probable";
  }

  return {
    score: scoreR,
    label,
    comment,
    details: {
      dtiRatio: Number.isFinite(dtiRatio) ? dtiRatio : 1,
      resteAVivreParUC: round0(resteAVivreParUC),
      resteApresProjet: round0(resteApresProjet),
      hardCapsApplied: hardCaps,
      subScores: {
        dti: round0(s_dti),
        rav: round0(s_rav),
        stability: round0(s_stability),
        age: round0(s_age),
        conso: round0(s_conso),
        apport: round0(s_apport),
      },
    },
  };
}

/* ------------------------ Action plan ------------------------ */
function buildActionPlan(
  resume: ResumeCapacite,
  assessment: BankabilityAssessment,
  tauxEndettementCible: number,
  context: {
    nbCredits: number;
    typesCredits: TypeCredit[];
    mensualitesCredits: number[];
    resteAnneesCredits: number[];
    tauxCredits: number[];
    tauxCreditCible: number;
    dureeCreditCible: number;
    proStatus: string;
    ageEmprunteur: number;
    ageCoEmprunteur: number;
    nbAdultes: number;
    projectTimelineUI: string;
  }
): ActionPlanItem[] {
  const margeSousCible = tauxEndettementCible - resume.tauxEndettementAvecProjet;
  const depassementCible = resume.tauxEndettementAvecProjet - tauxEndettementCible;
  const { nbCredits, typesCredits, mensualitesCredits, dureeCreditCible, proStatus, ageEmprunteur, ageCoEmprunteur, nbAdultes, projectTimelineUI } = context;

  const consoIdxs: number[] = [];
  for (let i = 0; i < nbCredits; i++) {
    const t = typesCredits[i];
    if (t === "perso" || t === "auto" || t === "conso") consoIdxs.push(i);
  }
  const totalMensuConso = consoIdxs.reduce((s, idx) => s + (mensualitesCredits[idx] || 0), 0);
  const ageFin = ageEmprunteur > 0 ? ageEmprunteur + dureeCreditCible : 0;
  const apportPct = resume.budgetTotalMax > 0 ? resume.apport / resume.budgetTotalMax : 0;

  const items: ActionPlanItem[] = [];

  // ── BLOCKING ─────────────────────────────────────────────────────────
  if (assessment.details.hardCapsApplied.ravNegative) {
    items.push({
      type: "blocking",
      title: "Reste à vivre négatif — risque de refus",
      body: `Après projet, votre reste à vivre estimé est négatif (${formatEuro(assessment.details.resteApresProjet)}). Une banque refusera très probablement dans cette configuration. Leviers prioritaires : réduire le budget du bien, allonger la durée, ou rembourser certains crédits avant le projet.`,
    });
  }

  // ── WARNINGS ─────────────────────────────────────────────────────────
  if (depassementCible > 0.02) {
    items.push({
      type: "warning",
      title: "Endettement au-dessus de la cible bancaire",
      body: `Votre taux projeté (~${formatPct(resume.tauxEndettementAvecProjet)}) dépasse la cible à ${formatPct(tauxEndettementCible)}. Pour y revenir : allonger légèrement la durée, réduire le budget du bien, ou renforcer l'apport pour diminuer le capital emprunté.`,
    });
  } else if (margeSousCible < 0.03) {
    items.push({
      type: "warning",
      title: "Vous êtes à la limite — les détails comptent",
      body: `Votre taux projeté (~${formatPct(resume.tauxEndettementAvecProjet)}) est très proche de la cible (${formatPct(tauxEndettementCible)}). Ici c'est la qualité du dossier qui fait la différence : tenue des comptes irréprochable, justificatifs clairs, apport couvrant les frais.`,
    });
  }

  if (!resume.apportCouvreFrais && resume.apportMinRecommande > 0) {
    items.push({
      type: "warning",
      title: "Apport inférieur aux frais estimés",
      body: `Votre apport (${formatEuro(resume.apport)}) est en dessous des frais estimés (~${formatEuro(resume.apportMinRecommande)}). Couvrir au moins le notaire et la garantie est souvent requis par les banques — sans quoi elles peuvent demander une caution renforcée ou refuser.`,
    });
  }

  if (resume.tauxEndettementActuel > 0.20 && nbCredits > 0) {
    items.push({
      type: "warning",
      title: "Endettement de base déjà élevé",
      body: `Même sans ce projet, vos charges existantes représentent déjà ~${formatPct(resume.tauxEndettementActuel)} de vos revenus. Les banques regardent ce ratio avant projet. Réduire certaines mensualités avant de déposer le dossier peut améliorer significativement la lecture bancaire.`,
    });
  }

  if (consoIdxs.length > 0) {
    items.push({
      type: "warning",
      title: "Crédits conso/auto — un frein courant",
      body: `Vous avez ${consoIdxs.length} crédit(s) conso pour ~${formatEuro(totalMensuConso)}/mois. Rembourser en priorité le plus chargé avant de déposer votre dossier est le levier le plus rapide. Autre option : regrouper vos crédits pour réduire la mensualité globale avant le projet.`,
    });
  }

  if (proStatus === "independant") {
    items.push({
      type: "warning",
      title: "Statut indépendant — anticipez le dossier",
      body: `Les banques exigent en général les 3 derniers bilans comptables + avis d'imposition. Plus vos revenus sont stables et en progression, plus le dossier est solide. Commencez à rassembler ces pièces maintenant, même si le projet n'est pas immédiat.`,
    });
  }

  if (ageFin > 0 && ageFin > 80) {
    items.push({
      type: "warning",
      title: "Âge en fin de prêt à surveiller",
      body: `À ${dureeCreditCible} ans de durée, vous auriez ~${ageFin} ans à l'échéance. Certaines banques plafonnent à 75-80 ans ou majorent l'assurance emprunteur significativement. Une durée légèrement plus courte peut être plus réaliste et moins coûteuse en assurance.`,
    });
  }

  // ── POSITIFS ─────────────────────────────────────────────────────────
  if (margeSousCible >= 0.05) {
    items.push({
      type: "positive",
      title: "Bon niveau d'endettement",
      body: `Votre taux projeté (~${formatPct(resume.tauxEndettementAvecProjet)}) laisse une marge confortable de ${formatPct(margeSousCible)} sous la cible. Votre dossier présente un bon équilibre — concentrez-vous sur la qualité de présentation.`,
    });
  }

  if (apportPct >= 0.20 && resume.budgetTotalMax > 0) {
    items.push({
      type: "positive",
      title: "Apport solide — un vrai atout",
      body: `Votre apport représente ${Math.round(apportPct * 100)}% du projet. C'est un signal fort pour les banques : risque perçu plus faible, parfois accès à de meilleures conditions de taux. Mettez-le en avant dans votre présentation de dossier.`,
    });
  }

  if (consoIdxs.length === 0) {
    items.push({
      type: "positive",
      title: "Pas de crédits conso",
      body: `Votre dossier n'est pas alourdi par des mensualités conso ou auto. On peut se concentrer sur la solidité du projet, la présentation et les conditions de financement.`,
    });
  }

  // ── CONSEILS ─────────────────────────────────────────────────────────
  if (projectTimelineUI === "0_3m" || projectTimelineUI === "3_6m") {
    items.push({
      type: "tip",
      title: "Votre projet est imminent — pré-validez maintenant",
      body: `Avec un horizon aussi court, le moment est venu de contacter un courtier pour une pré-validation. Avoir une capacité confirmée avant de visiter évite les déceptions et renforce votre position en négociation.`,
    });
  }

  if (ageCoEmprunteur === 0 && nbAdultes <= 1 && assessment.score < 80) {
    items.push({
      type: "tip",
      title: "Un co-emprunteur pourrait changer la donne",
      body: `Vous simulez seul. Avec un co-emprunteur, les revenus se cumulent et la banque perçoit un risque partagé. Si votre situation le permet, cela peut augmenter significativement votre capacité d'emprunt et améliorer la lecture bancaire.`,
    });
  }

  if (depassementCible > 0 || margeSousCible < 0.04) {
    items.push({
      type: "tip",
      title: "La présentation du dossier fait la différence",
      body: `Quand un dossier est serré, les banques regardent aussi la tenue des comptes : pas de découverts récurrents sur 3 mois, épargne résiduelle visible, justificatifs complets et bien ordonnés. Un courtier peut optimiser la mise en forme pour maximiser vos chances.`,
    });
  }

  return items;
}

export type CapaciteWizardProps = {
  showSaveButton?: boolean;
};

export default function CapaciteWizard({ showSaveButton = true }: CapaciteWizardProps) {
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
  const TOTAL_STEPS = 4;
  const [maxStepReached, setMaxStepReached] = useState<number>(1);
  useEffect(() => setMaxStepReached((m) => Math.max(m, step)), [step]);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));
  const goToStep = (target: number) => {
    const t = Math.min(Math.max(target, 1), TOTAL_STEPS);
    if (t <= maxStepReached) setStep(t);
  };

  const wizardSteps = useMemo<
    Array<{
      label: string;
      shortLabel: string;
      description: string;
      icon: ComponentType<SVGProps<SVGSVGElement>>;
    }>
  >(
    () => [
          {
            label: "Votre projet",
            shortLabel: "Projet",
            description: "Quel bien, où et dans quel délai ?",
            icon: HomeModernIcon,
          },
          {
            label: "Profil & Revenus",
            shortLabel: "Profil",
            description: "Votre situation professionnelle et les revenus du foyer.",
            icon: UserGroupIcon,
          },
          {
            label: "Charges & Crédits",
            shortLabel: "Charges",
            description: "Ce qui pèse déjà sur votre budget chaque mois.",
            icon: CreditCardIcon,
          },
          {
            label: "Paramètres du prêt",
            shortLabel: "Prêt",
            description: "Ajustez les hypothèses pour obtenir votre estimation.",
            icon: AdjustmentsHorizontalIcon,
          },
        ],
    []
  );
  const activeStepMeta = wizardSteps[step - 1];
  const ActiveStepIcon = activeStepMeta.icon;

  /* ======================== Common input styles ======================== */
  const inputBase =
    "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition " +
    "placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-100";
  const inputSmall =
    "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition " +
    "placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-100";
  const selectBase =
    "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition " +
    "focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-100";
  const labelBase = "flex min-h-[1.5rem] items-center gap-1 text-sm font-semibold leading-tight text-slate-700";

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
  const [resultCapaciteTexte, setResultCapaciteTexte] = useState<string>("");
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
  const computeAll = (): ComputedAll => {
    const revenusNet = toInt(revenusNetMensuels, 0);
    const autresRev = toInt(autresRevenusMensuels, 0);
    const chargesHors = toInt(chargesMensuellesHorsCredits, 0);
    const apport = toInt(apportPersonnel, 0);

    const age1 = toInt(ageEmprunteur, 0);
    const age2 = toInt(ageCoEmprunteur, 0);

    const adultes = Math.max(1, toInt(nbAdultes, 1));
    const enfants = Math.max(0, toInt(nbEnfants, 0));

    const tauxEndettement = toFloat(tauxEndettementCible, 35);
    const tauxCredit = toFloat(tauxCreditCible, 3.5);
    const tauxAssurance = toFloat(tauxAssuranceCible, 0.3);
    const dureeCredit = toInt(dureeCreditCible, 25);

    const mensualitesNums = mensualitesCredits.map((v) => toInt(v, 0));
    const resteAnneesNums = resteAnneesCredits.map((v) => toInt(v, 0));
    const tauxCreditsNums = tauxCredits.map((v) => toFloat(v, 0));
    const loyersNums = revenusLocatifs.map((v) => toInt(v, 0));

    const revenusBase = revenusNet + autresRev;

    let revenuLocatifPrisEnCompte = 0;
    for (let i = 0; i < nbCredits; i++) {
      if (typesCredits[i] === "immo") {
        const loyer = loyersNums[i] || 0;
        revenuLocatifPrisEnCompte += loyer * 0.7;
      }
    }

    const revenusPrisEnCompte = revenusBase + revenuLocatifPrisEnCompte;
    const mensualitesExistantes = mensualitesNums.slice(0, nbCredits).reduce((sum, v) => sum + (v || 0), 0);

    const enveloppeMax = revenusPrisEnCompte * ((tauxEndettement || 0) / 100);
    const chargesActuelles = mensualitesExistantes + chargesHors;
    const capaciteMensuelle = Math.max(enveloppeMax - chargesActuelles, 0);

    const tauxActuel = revenusPrisEnCompte > 0 ? (chargesActuelles / revenusPrisEnCompte) * 100 : 0;

    const tauxNotaire = projectType === "neuf" ? 0.025 : projectType === "terrain" ? 0.07 : 0.075;
    const tauxAgence = projectType === "neuf" ? 0.0 : 0.04;
    const denom = 1 + tauxNotaire + tauxAgence;

    const buildScenario = (duration: number): ScenarioCapacite => {
      const capital = principalFromPaymentWithInsurance(capaciteMensuelle, tauxCredit, duration, tauxAssurance);
      const mensualiteCredit = monthlyPayment(capital, tauxCredit, duration);
      const assurance = monthlyInsurance(capital, tauxAssurance);
      const mensualiteTotale = monthlyPaymentWithInsurance(capital, tauxCredit, duration, tauxAssurance);
      const budget = Math.max(0, capital + apport);
      const prixBien = budget > 0 && denom > 0 ? budget / denom : 0;

      return {
        duree: duration,
        montantMax: capital,
        mensualiteCreditHorsAssurance: mensualiteCredit,
        assuranceMensuelle: assurance,
        mensualiteProjet: mensualiteTotale,
        budgetTotalMax: budget,
        prixBienMax: prixBien,
      };
    };

    const scenarioDurations = Array.from(new Set([15, 20, dureeCredit, 25]))
      .filter((duration) => duration > 0)
      .sort((a, b) => a - b);
    const scenarios = scenarioDurations.map(buildScenario);
    const selectedScenario = buildScenario(dureeCredit);

    const montantMax = selectedScenario.montantMax;
    const mensualiteCreditHorsAssurance = selectedScenario.mensualiteCreditHorsAssurance;
    const assuranceMensuelle = selectedScenario.assuranceMensuelle;
    const mensualiteProjet = selectedScenario.mensualiteProjet;
    const budgetTotalMax = Math.max(0, (montantMax || 0) + apport);

    let prixBienMax = 0;
    let fraisNotaireEstimes = 0;
    let fraisAgenceEstimes = 0;
    let coutTotalProjetMax = 0;

    if (budgetTotalMax > 0 && denom > 0) {
      prixBienMax = budgetTotalMax / denom;
      fraisNotaireEstimes = prixBienMax * tauxNotaire;
      fraisAgenceEstimes = prixBienMax * tauxAgence;
      coutTotalProjetMax = prixBienMax + fraisNotaireEstimes + fraisAgenceEstimes;
    }

    const coussinGarantie = prixBienMax > 0 ? Math.min(Math.max(prixBienMax * 0.012, 0) + 1500, 6000) : 0;
    const apportMinRecommande = Math.max(0, fraisNotaireEstimes + coussinGarantie);
    const apportCouvreFrais = apport >= apportMinRecommande && apportMinRecommande > 0;

    const tauxAvecProjet =
      revenusPrisEnCompte > 0 ? ((chargesActuelles + (mensualiteProjet || 0)) / revenusPrisEnCompte) * 100 : 0;

    const resume: ResumeCapacite = {
      revenusPrisEnCompte,
      mensualitesExistantes,
      chargesHorsCredits: chargesHors,
      tauxEndettementActuel: tauxActuel,
      tauxEndettementAvecProjet: tauxAvecProjet,
      mensualiteMax: capaciteMensuelle,
      montantMax,
      mensualiteCreditHorsAssurance,
      assuranceMensuelle,
      tauxAssurance,
      mensualiteProjet,
      apport,
      budgetTotalMax,
      apportMinRecommande,
      apportCouvreFrais,
      prixBienMax,
      fraisNotaireEstimes,
      fraisAgenceEstimes,
      coutTotalProjetMax,
    };

    const ageMax = Math.max(age1, age2);
    const ageFin = ageMax + (dureeCredit || 0);
    const ageWarn = ageMax > 0 && (dureeCredit || 0) > 0 && ageFin >= 85;

    const lignes: string[] = [
      `Projet : ${propertyKindLabel} — ${projectTypeLabel} — ${projectUsageLabel} — horizon ${projectTimelineLabel}.`,
      projectDepartment?.trim()
        ? `Département (zone de recherche) : ${projectDepartment.trim()}.`
        : `Département (zone de recherche) : non renseigné.`,
      `Statut : ${proStatusLabel}. Foyer : ${adultes} adulte(s)${enfants > 0 ? `, ${enfants} enfant(s)` : ""}.`,
      age1 > 0
        ? `Âge(s) déclaré(s) : emprunteur ${age1} an(s)${age2 > 0 ? `, co-emprunteur ${age2} an(s)` : ""}.`
        : `Âge(s) déclaré(s) : non renseigné.`,
      ageWarn
        ? `⚠️ Attention : à ${dureeCredit} ans de durée, l'âge à la fin du prêt serait ~${ageFin} ans (variable selon banques/profil).`
        : `Âge fin de prêt estimé : ~${ageFin > 0 ? ageFin : "-"} ans.`,
      `Vos revenus mensuels pris en compte (salaires, autres revenus et 70 % des loyers locatifs) s'élèvent à ${formatEuro(
        revenusPrisEnCompte
      )}.`,
      `Vos charges récurrentes (crédits et autres charges) représentent ${formatEuro(
        chargesActuelles
      )} par mois, soit un taux d'endettement actuel d'environ ${formatPct(tauxActuel)}.`,
      capaciteMensuelle > 0
        ? `Votre capacité mensuelle "max" (cible ${formatPct(tauxEndettement)}) est ${formatEuro(
            capaciteMensuelle
          )}. Sur ${dureeCredit} ans à ~${tauxCredit.toLocaleString(
            "fr-FR",
            { maximumFractionDigits: 2 }
          )} % avec une assurance estimée à ${formatPct(tauxAssurance)}, cela donne ~${formatEuro(
            montantMax
          )} de capital.`
        : `Avec les paramètres actuels, aucune capacité mensuelle n'apparaît si l'on reste sur un taux d'endettement cible de ${formatPct(
            tauxEndettement
          )}.`,
      montantMax > 0
        ? `La mensualité projetée ressort à ~${formatEuro(mensualiteProjet)} assurance incluse (${formatEuro(
            mensualiteCreditHorsAssurance
          )} de crédit + ${formatEuro(assuranceMensuelle)} d'assurance).`
        : `La mensualité projetée n'est pas calculable sans capital.`,
      `Hypothèses frais (${projectTypeLabel}) : notaire ~${(tauxNotaire * 100).toLocaleString("fr-FR", {
        maximumFractionDigits: 1,
      })}%${
        tauxAgence > 0
          ? `, agence ~${(tauxAgence * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`
          : ""
      }.`,
      `Apport déclaré : ${formatEuro(apport)}. Apport minimum recommandé (≈ notaire + garantie/dossier) : ${formatEuro(
        apportMinRecommande
      )}. ${
        apportMinRecommande > 0 ? (apportCouvreFrais ? "✅ Apport ≥ frais." : "⚠️ Apport < frais : souvent bloquant.") : ""
      }`,
      prixBienMax > 0
        ? `Budget max estimatif (apport inclus) : ${formatEuro(budgetTotalMax)}. Prix de bien "envisageable" ~${formatEuro(
            prixBienMax
          )} (coût total projet ~${formatEuro(coutTotalProjetMax)}).`
        : `La projection d'un budget max n'est pas pertinente avec ces paramètres : retravaillez durée, taux ou charges.`,
      `Comparaison de durées : les scénarios 15 / 20 / 25 ans recalculent le capital avec assurance incluse, pour éviter une lecture artificiellement optimiste.`,
    ];

    const texte = lignes.join("\n");

    const assessment = computeLoktScore({
      resume,
      tauxEndettementCible: tauxEndettement,
      proStatus,
      ageEmprunteur: age1,
      ageCoEmprunteur: age2,
      nbAdultes: adultes,
      nbEnfants: enfants,
      dureeCreditCible: dureeCredit,
      nbCredits,
      typesCredits,
      mensualitesCredits: mensualitesNums,
    });

    const actionItems = buildActionPlan(resume, assessment, tauxEndettement, {
      nbCredits,
      typesCredits,
      mensualitesCredits: mensualitesNums,
      resteAnneesCredits: resteAnneesNums,
      tauxCredits: tauxCreditsNums,
      tauxCreditCible: tauxCredit,
      dureeCreditCible: dureeCredit,
      proStatus,
      ageEmprunteur: age1,
      ageCoEmprunteur: age2,
      nbAdultes: adultes,
      projectTimelineUI,
    });

    return {
      resume,
      scenarios,
      texte,
      assessment,
      actionPlan: actionItemsToString(actionItems),
      actionItems,
      parsed: {
        revenusNet,
        autresRev,
        chargesHors,
        apport,
        age1,
        age2,
        adultes,
        enfants,
        tauxEndettement,
        tauxCredit,
        tauxAssurance,
        dureeCredit,
        mensualitesNums,
        resteAnneesNums,
        tauxCreditsNums,
        loyersNums,
      },
    };
  };

  const handleCalculCapacite = async () => {
    setSendEmailMsg(null);
    setUnlockMsg(null);

    const rn = toInt(revenusNetMensuels, 0);
    if (!revenusNetMensuels || rn <= 0) {
      setRevenusError("Revenus obligatoires (montant > 0).");
      setStep(3);
      return;
    }
    setRevenusError(null);

    const computed = computeAll();

    // ✅ FIX: stocker computedAll (sinon la synthèse ne s'affiche jamais)
    setComputedAll(computed);

    setResumeCapacite(computed.resume);
    setResultCapaciteTexte(computed.texte);
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
      await captureLeadViaRpc({ email, computed });

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

    /* ======================== Render helpers ======================== */
  const renderRichText = (text: string) => {
    const parts = text
      .split("\n\n")
      .map((s) => s.trim())
      .filter(Boolean);

    return (
      <div className="space-y-3">
        {parts.map((block, idx) => {
          if (block.startsWith("### ")) {
            const title = block.replace(/^###\s+/, "");
            return (
              <h4 key={idx} className="text-[0.8rem] font-semibold text-slate-900">
                {title}
              </h4>
            );
          }

          const lines = block.split("\n");
          const hasBullets = lines.some((l) => l.trim().startsWith("- "));
          if (hasBullets) {
            const before = lines
              .filter((l) => !l.trim().startsWith("- "))
              .join(" ")
              .trim();
            const bullets = lines
              .filter((l) => l.trim().startsWith("- "))
              .map((l) => l.replace(/^\-\s+/, "").trim());

            return (
              <div key={idx} className="space-y-2">
                {before ? (
                  <p className="text-[0.75rem] text-slate-700 leading-relaxed">{before}</p>
                ) : null}
                <ul className="list-disc pl-5 space-y-1">
                  {bullets.map((b, i) => (
                    <li key={i} className="text-[0.75rem] text-slate-700 leading-relaxed">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          }

          return (
            <p key={idx} className="text-[0.75rem] text-slate-700 leading-relaxed">
              {block}
            </p>
          );
        })}
      </div>
    );
  };

  const scoreColor =
    !bankability
      ? "text-slate-900"
      : bankability.label === "Refus probable"
      ? "text-red-200"
      : bankability.score >= 80
      ? "text-emerald-300"
      : bankability.score >= 60
      ? "text-amber-200"
      : "text-red-200";

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
          <aside className="relative overflow-hidden bg-slate-950 px-5 py-5 text-white sm:px-6 lg:min-h-[39rem] lg:py-7">
            <div className="absolute inset-0 bg-gradient-to-br from-[#635bff] via-[#007ba7] to-[#00a97b] opacity-95" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.2),transparent_38%,rgba(255,184,0,.22))]" />
            <div className="relative">
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
            </div>
          </aside>

          <div className="flex min-h-[39rem] flex-col bg-white p-5 sm:p-8">
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

            {/* Contenu */}
            <div className="flex-1 space-y-5 py-6">

          {step === 1 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className={labelBase}>
                    Usage du futur bien
                    <InfoBadge text="Résidence principale, secondaire ou investissement : la banque ne lit pas toujours le dossier de la même façon." />
                  </label>
                  <select value={projectUsageUI} onChange={(e) => setProjectUsageUI(e.target.value as ProjectUsageUI)} className={selectBase}>
                    <option value="rp">Résidence principale</option>
                    <option value="rs">Résidence secondaire</option>
                    <option value="invest">Investissement locatif</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>
                    Type de bien
                    <InfoBadge text="Permet de qualifier le projet et de contextualiser l'analyse." />
                  </label>
                  <select value={propertyKind} onChange={(e) => setPropertyKind(e.target.value as PropertyKind)} className={selectBase}>
                    <option value="appartement">Appartement</option>
                    <option value="maison">Maison</option>
                    <option value="terrain">Terrain</option>
                    <option value="autre">Autre</option>
                  </select>
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
                  <select value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)} className={selectBase}>
                    <option value="ancien">Ancien</option>
                    <option value="neuf">Neuf / VEFA</option>
                    <option value="terrain">Terrain + construction</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Horizon d'achat</label>
                  <select value={projectTimelineUI} onChange={(e) => setProjectTimelineUI(e.target.value as ProjectTimelineUI)} className={selectBase}>
                    <option value="0_3m">0-3 mois</option>
                    <option value="3_6m">3-6 mois</option>
                    <option value="6_12m">6-12 mois</option>
                    <option value="12m_plus">12+ mois</option>
                    <option value="juste_info">Je me renseigne</option>
                  </select>
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

          {step === 2 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className={labelBase}>
                    Statut professionnel
                    <InfoBadge text="CDI, fonctionnaire, indépendant ou retraité : la stabilité perçue change selon les banques." />
                  </label>
                  <select value={proStatus} onChange={(e) => setProStatus(e.target.value as ProStatus)} className={selectBase}>
                    <option value="cdi">CDI</option>
                    <option value="fonctionnaire">Fonctionnaire</option>
                    <option value="independant">Indépendant / société</option>
                    <option value="retraite">Retraité</option>
                    <option value="autre">Autre</option>
                  </select>
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

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className={labelBase}>Adultes dans le foyer</label>
                  <input inputMode="numeric" value={nbAdultes} onChange={(e) => setNbAdultes(onlyDigits(e.target.value))} className={inputBase} />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Enfants à charge</label>
                  <input inputMode="numeric" value={nbEnfants} onChange={(e) => setNbEnfants(onlyDigits(e.target.value))} className={inputBase} />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className={labelBase}>Revenus nets mensuels (€) *</label>
                  <input
                    required
                    inputMode="numeric"
                    value={revenusNetMensuels}
                    onChange={(e) => { setRevenusNetMensuels(onlyDigits(e.target.value)); setRevenusError(null); }}
                    className={"w-full min-w-0 rounded-xl border bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:outline-none focus:ring-4 " + (revenusError ? "border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-cyan-400 focus:ring-cyan-100")}
                    aria-invalid={!!revenusError}
                  />
                  {revenusError ? <p className="text-[0.7rem] text-red-600">{revenusError}</p> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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

          {step === 3 ? (
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
                  <select value={nbCredits} onChange={(e) => handleNbCreditsChange(Number(e.target.value))} className={selectBase}>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
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
                          <select value={typesCredits[index] || "immo"} onChange={(e) => handleTypeCreditChange(index, e.target.value as TypeCredit)} className={selectBase}>
                            <option value="immo">Immobilier</option>
                            <option value="perso">Personnel</option>
                            <option value="auto">Auto</option>
                            <option value="conso">Conso</option>
                          </select>
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

          {step === 4 ? (
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
                if (step === 2) {
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
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00a97b] to-[#008db8] px-6 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:shadow-xl active:scale-[0.99]"
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
