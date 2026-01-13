// components/CapaciteWizard.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import LeadGate from "./LeadGate";
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

/* ------------------------ Lokt Score helpers ------------------------ */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function round0(n: number) {
  return Math.round(n);
}

/* ------------------------ Loan helpers (monthly) ------------------------ */
function monthlyPayment(
  principal: number,
  annualRatePct: number,
  years: number
) {
  const P = Math.max(0, principal || 0);
  const n = Math.max(0, Math.round((years || 0) * 12));
  const r = Math.max(0, (annualRatePct || 0) / 100) / 12;

  if (P <= 0 || n <= 0) return 0;
  if (r === 0) return P / n;

  return (P * r) / (1 - Math.pow(1 + r, -n));
}

function principalFromPayment(
  payment: number,
  annualRatePct: number,
  years: number
) {
  const M = Math.max(0, payment || 0);
  const n = Math.max(0, Math.round((years || 0) * 12));
  const r = Math.max(0, (annualRatePct || 0) / 100) / 12;

  if (M <= 0 || n <= 0) return 0;
  if (r === 0) return M * n;

  const f = Math.pow(1 + r, n);
  return M * ((f - 1) / (r * f));
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

/* ------------------------ Score Lokt ------------------------ */
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

  const cible = tauxEndettementCible > 0 ? tauxEndettementCible : 35;
  const dtiRatio = cible > 0 ? resume.tauxEndettementAvecProjet / cible : 1;

  const chargesActuelles =
    resume.mensualitesExistantes + resume.chargesHorsCredits;
  const mensualiteScore = resume.mensualiteProjet || 0;

  const resteApresProjet =
    (resume.revenusPrisEnCompte || 0) -
    (chargesActuelles + (mensualiteScore || 0));
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
  const ageFin =
    ageMax > 0 ? ageMax + Math.max(0, dureeCreditCible || 0) : 0;

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
  const totalMensuConso = consoIdx.reduce(
    (s, idx) => s + (mensualitesCredits[idx] || 0),
    0
  );

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

  const hardCaps = { ravNegative: false, dtiHigh: false, apportLow: false };

  if (resteApresProjet < 0) {
    hardCaps.ravNegative = true;
    scoreR = Math.min(scoreR, 40);
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
  const weakest = (Object.keys(subs) as (keyof typeof subs)[]).sort(
    (a, b) => subs[a] - subs[b]
  )[0];

  let comment = "Votre dossier est globalement cohérent, avec quelques optimisations possibles.";

  if (hardCaps.ravNegative) {
    comment =
      "Signal rouge : votre reste-à-vivre après projet est négatif (déficit). Dans cette configuration, une banque refusera très probablement.";
  } else if (hardCaps.dtiHigh) {
    comment =
      "Point bloquant : votre taux d’endettement projeté dépasse nettement la cible. Le levier principal est de réduire la mensualité (durée/taux) ou les charges/crédits, ou d’augmenter l’apport.";
  } else if (hardCaps.apportLow) {
    comment =
      "Point d’attention : votre apport ne couvre pas les frais estimés (notaire/garantie/dossier). Beaucoup de banques demandent au minimum ces frais en apport.";
  } else {
    if (weakest === "apport") {
      comment =
        "Votre score est surtout pénalisé par un apport jugé faible vs frais (notaire/garantie). Couvrir au minimum les frais en apport améliore la lecture bancaire.";
    } else if (weakest === "dti") {
      comment =
        "Votre score est surtout tiré par la proximité (ou le dépassement) du taux d’endettement cible. Le levier principal est d’améliorer la marge : apport, durée, taux, ou réduction de charges/crédits.";
    } else if (weakest === "rav") {
      comment =
        "Votre score est surtout lié au reste-à-vivre estimé. À situation égale, cela se travaille via la maîtrise des charges fixes et le calibrage de la mensualité.";
    } else if (weakest === "stability") {
      comment =
        "Votre statut est plus “exigeant” côté banques (lecture prudente). Il faut soigner la présentation : régularité de revenus, ancienneté, justificatifs, cohérence globale.";
    } else if (weakest === "age") {
      comment =
        "La durée et l’âge fin de prêt pèsent dans la lecture bancaire. Selon les banques, il faudra peut-être ajuster la durée, ou renforcer le dossier (apport/assurance).";
    } else if (weakest === "conso") {
      comment =
        "Les crédits conso/auto pèsent sur la lecture bancaire. Une réduction ciblée (remboursement, regroupement) peut faire monter le score rapidement.";
    }
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
  }
): string {
  const chargesActuelles = resume.mensualitesExistantes + resume.chargesHorsCredits;
  const margeSousCible = tauxEndettementCible - resume.tauxEndettementAvecProjet;
  const depassementCible = resume.tauxEndettementAvecProjet - tauxEndettementCible;

  const {
    nbCredits,
    typesCredits,
    mensualitesCredits,
    resteAnneesCredits,
    tauxCredits,
    tauxCreditCible,
    dureeCreditCible,
  } = context;

  const consoIdxs: number[] = [];
  for (let i = 0; i < nbCredits; i++) {
    const t = typesCredits[i];
    if (t === "perso" || t === "auto" || t === "conso") consoIdxs.push(i);
  }
  const totalMensuConso = consoIdxs.reduce((s, idx) => s + (mensualitesCredits[idx] || 0), 0);

  let biggestIdx: number | null = null;
  let biggestMensu = 0;
  for (const idx of consoIdxs) {
    const m = mensualitesCredits[idx] || 0;
    if (m > biggestMensu) {
      biggestMensu = m;
      biggestIdx = idx;
    }
  }

  const tauxNegocieCible = Math.max(tauxCreditCible - 0.3, 0.5);
  const blocks: string[] = [];

  blocks.push(
    `### 1) Le point de départ (ce que la banque “voit”)\n` +
      `Avec ${formatEuro(resume.revenusPrisEnCompte)} de revenus mensuels pris en compte, vos charges récurrentes tournent autour de ${formatEuro(
        chargesActuelles
      )}. Aujourd’hui, votre endettement est à ~${formatPct(resume.tauxEndettementActuel)}.`
  );

  if (assessment.details.hardCapsApplied.ravNegative) {
    blocks.push(
      `### 2) Signal rouge : reste-à-vivre négatif\n` +
        `Après projet, votre reste-à-vivre estimé est **négatif** (${formatEuro(
          assessment.details.resteApresProjet
        )}). Dans cette configuration, la banque refusera très probablement.\n` +
        `Le levier prioritaire : baisser la mensualité (durée/taux), réduire les charges/crédits, ou augmenter fortement l’apport.`
    );
  }

  if (!resume.apportCouvreFrais && resume.apportMinRecommande > 0) {
    blocks.push(
      `### 3) L’apport (point d’attention)\n` +
        `Votre apport (${formatEuro(resume.apport)}) est inférieur aux frais estimés (~${formatEuro(
          resume.apportMinRecommande
        )}). Beaucoup de banques préfèrent que l’apport couvre au moins les frais (notaire, garantie, dossier).`
    );
  }

  if (depassementCible > 0.2) {
    blocks.push(
      `### 4) Le cap à tenir (revenir dans la zone “OK banque”)\n` +
        `Votre endettement projeté ressort à ~${formatPct(resume.tauxEndettementAvecProjet)} pour une cible à ${formatPct(
          tauxEndettementCible
        )}. C’est au-dessus du seuil : il faut alléger la mensualité visée ou renforcer le dossier (apport, durée, crédits…).`
    );
  } else if (margeSousCible > 0.01) {
    blocks.push(
      `### 4) La zone de sécurité (où vous avez de la marge)\n` +
        `Votre endettement projeté ressort à ~${formatPct(resume.tauxEndettementAvecProjet)} pour une cible à ${formatPct(
          tauxEndettementCible
        )}. Vous gardez une marge d’environ ${formatPct(margeSousCible)}.`
    );
  } else {
    blocks.push(
      `### 4) La limite (ça passe, mais il faut cadrer)\n` +
        `Vous êtes très proche de la cible : ~${formatPct(resume.tauxEndettementAvecProjet)} pour ${formatPct(
          tauxEndettementCible
        )}. Ici, le détail du dossier fait la différence (stabilité, reste à vivre, gestion des comptes, apport).`
    );
  }

  blocks.push(
    `### 5) Le levier le plus “rentable” : négocier le taux\n` +
      `Vous partez sur ${tauxCreditCible.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}% sur ${dureeCreditCible} ans. Viser ${tauxNegocieCible.toLocaleString(
        "fr-FR",
        { maximumFractionDigits: 2 }
      )}% (même -0,20 / -0,30) améliore mécaniquement la lecture bancaire.`
  );

  if (consoIdxs.length > 0) {
    const nbConso = consoIdxs.length;
    let detailGros = "";
    if (biggestIdx !== null && biggestMensu > 0) {
      const reste = resteAnneesCredits[biggestIdx] || 0;
      const taux = tauxCredits[biggestIdx] || 0;
      detailGros =
        `Le crédit conso le plus “lourd” pèse environ ${formatEuro(biggestMensu)}/mois (reste ~${reste} an(s), taux ~${taux.toLocaleString(
          "fr-FR",
          { maximumFractionDigits: 2 }
        )}%). ` + `Si tu ne devais en attaquer qu’un en priorité, c’est celui-là.`;
    }

    blocks.push(
      `### 6) Les crédits conso : le frein classique\n` +
        `Vous avez ${nbConso} crédit(s) conso (perso/auto/conso) pour une mensualité totale d’environ ${formatEuro(totalMensuConso)}. ` +
        `C’est souvent le levier n°1 pour “débloquer” un dossier.\n\n` +
        (detailGros ? `${detailGros}\n\n` : "") +
        `Deux options simples :\n` +
        `- **Remboursement ciblé** (sur 6–12 mois)\n` +
        `- **Regroupement** (réduire la mensualité globale avant de relancer le projet immo)`
    );
  } else {
    blocks.push(
      `### 6) Bonne nouvelle : pas de crédits conso “bloquants”\n` +
        `Votre dossier n’est pas pénalisé par des mensualités conso. On peut se concentrer sur le projet et la qualité de présentation du dossier.`
    );
  }

  blocks.push(
    `### 7) La “forme” qui fait gagner du temps (et des points)\n` +
      `Avant même de parler chiffres, la banque juge la clarté et la cohérence : relevés propres, pas de découverts récurrents, justificatifs alignés, et une présentation nette.`
  );

  return blocks.join("\n\n");
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
  const TOTAL_STEPS = 5;
  const [maxStepReached, setMaxStepReached] = useState<number>(1);
  useEffect(() => setMaxStepReached((m) => Math.max(m, step)), [step]);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));
  const goToStep = (target: number) => {
    const t = Math.min(Math.max(target, 1), TOTAL_STEPS);
    if (t <= maxStepReached) setStep(t);
  };

  const stepLabels = useMemo(
    () => ["Votre projet", "Votre profil", "Vos revenus", "Charges & crédits", "Paramètres du prêt"],
    []
  );

  /* ======================== Common input styles ======================== */
  const inputBase =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const inputSmall =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const selectBase =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const labelBase = "text-xs text-slate-700 leading-tight min-h-[2.25rem] flex items-center gap-1";

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
  const [dureeCreditCible, setDureeCreditCible] = useState<string>("25");

  /* ======================== Résultats ======================== */
  const [resumeCapacite, setResumeCapacite] = useState<ResumeCapacite | null>(null);
  const [resultCapaciteTexte, setResultCapaciteTexte] = useState<string>("");
  const [bankability, setBankability] = useState<BankabilityAssessment | null>(null);
  const [actionPlanText, setActionPlanText] = useState<string>("");

  const hasResult = !!resumeCapacite;

  /* ======================== Gate (par calculette) ======================== */
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [consentLokt, setConsentLokt] = useState<boolean>(false);
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);

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

  // 2) Persist email au fil de l’eau (tool-specific)
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
  const computeAll = () => {
    // conversions (permet de garder UI en string)
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
    const mensualitesExistantes = mensualitesNums
      .slice(0, nbCredits)
      .reduce((sum, v) => sum + (v || 0), 0);

    const enveloppeMax = revenusPrisEnCompte * ((tauxEndettement || 0) / 100);
    const chargesActuelles = mensualitesExistantes + chargesHors;
    const capaciteMensuelle = Math.max(enveloppeMax - chargesActuelles, 0);

    const tauxActuel =
      revenusPrisEnCompte > 0 ? (chargesActuelles / revenusPrisEnCompte) * 100 : 0;

    const DUREE_REFERENCE = 25;

    const montantMax = principalFromPayment(capaciteMensuelle, tauxCredit, DUREE_REFERENCE);
    const mensualiteProjet = monthlyPayment(montantMax, tauxCredit, dureeCredit);

    const tauxNotaire =
      projectType === "neuf" ? 0.025 : projectType === "terrain" ? 0.07 : 0.075;
    const tauxAgence = projectType === "neuf" ? 0.0 : 0.04;
    const denom = 1 + tauxNotaire + tauxAgence;

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

    const coussinGarantie =
      prixBienMax > 0
        ? Math.min(Math.max(prixBienMax * 0.012, 0) + 1500, 6000)
        : 0;
    const apportMinRecommande = Math.max(0, fraisNotaireEstimes + coussinGarantie);
    const apportCouvreFrais = apport >= apportMinRecommande && apportMinRecommande > 0;

    const tauxAvecProjet =
      revenusPrisEnCompte > 0
        ? ((chargesActuelles + (mensualiteProjet || 0)) / revenusPrisEnCompte) * 100
        : 0;

    const resume: ResumeCapacite = {
      revenusPrisEnCompte,
      mensualitesExistantes,
      chargesHorsCredits: chargesHors,
      tauxEndettementActuel: tauxActuel,
      tauxEndettementAvecProjet: tauxAvecProjet,
      mensualiteMax: capaciteMensuelle,
      montantMax,
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
        ? `⚠️ Attention : à ${dureeCredit} ans de durée, l’âge à la fin du prêt serait ~${ageFin} ans (variable selon banques/profil).`
        : `Âge fin de prêt estimé : ~${ageFin > 0 ? ageFin : "-"} ans.`,
      `Vos revenus mensuels pris en compte (salaires, autres revenus et 70 % des loyers locatifs) s’élèvent à ${formatEuro(revenusPrisEnCompte)}.`,
      `Vos charges récurrentes (crédits et autres charges) représentent ${formatEuro(chargesActuelles)} par mois, soit un taux d’endettement actuel d’environ ${formatPct(
        tauxActuel
      )}.`,
      capaciteMensuelle > 0
        ? `Votre capacité mensuelle “max” (cible ${formatPct(tauxEndettement)}) est ${formatEuro(
            capaciteMensuelle
          )}. Référence : cela donne ~${formatEuro(montantMax)} de capital sur 25 ans à ~${tauxCredit.toLocaleString(
            "fr-FR",
            { maximumFractionDigits: 2 }
          )} %.`
        : `Avec les paramètres actuels, aucune capacité mensuelle n’apparaît si l’on reste sur un taux d’endettement cible de ${formatPct(
            tauxEndettement
          )}.`,
      montantMax > 0
        ? `Si vous gardez ce capital (~${formatEuro(montantMax)}) et changez la durée à ${dureeCredit} ans, la mensualité nécessaire serait ~${formatEuro(
            mensualiteProjet
          )} (ce qui fait varier l’endettement et le score).`
        : `La mensualité projetée n’est pas calculable sans capital.`,
      `Hypothèses frais (${projectTypeLabel}) : notaire ~${(tauxNotaire * 100).toLocaleString("fr-FR", {
        maximumFractionDigits: 1,
      })}%${tauxAgence > 0 ? `, agence ~${(tauxAgence * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%` : ""}.`,
      `Apport déclaré : ${formatEuro(apport)}. Apport minimum recommandé (≈ notaire + garantie/dossier) : ${formatEuro(
        apportMinRecommande
      )}. ${
        apportMinRecommande > 0 ? (apportCouvreFrais ? "✅ Apport ≥ frais." : "⚠️ Apport < frais : souvent bloquant.") : ""
      }`,
      prixBienMax > 0
        ? `Budget max estimatif (apport inclus) : ${formatEuro(budgetTotalMax)}. Prix de bien “envisageable” ~${formatEuro(
            prixBienMax
          )} (coût total projet ~${formatEuro(coutTotalProjetMax)}).`
        : `La projection d’un budget max n’est pas pertinente avec ces paramètres : retravaillez durée, taux ou charges.`,
      `Mode “what-if durée” : le capital max est calculé sur 25 ans, puis la durée change la mensualité et donc le score.`,
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

    const actionPlan = buildActionPlan(resume, assessment, tauxEndettement, {
      nbCredits,
      typesCredits,
      mensualitesCredits: mensualitesNums,
      resteAnneesCredits: resteAnneesNums,
      tauxCredits: tauxCreditsNums,
      tauxCreditCible: tauxCredit,
      dureeCreditCible: dureeCredit,
    });

    return {
      resume,
      texte,
      assessment,
      actionPlan,
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
        dureeCredit,
        mensualitesNums,
        resteAnneesNums,
        tauxCreditsNums,
        loyersNums,
      },
    };
  };

  const handleCalculCapacite = async () => {
    setUnlockMsg(null);

    const computed = computeAll();

    setResumeCapacite(computed.resume);
    setResultCapaciteTexte(computed.texte);
    setBankability(computed.assessment);
    setActionPlanText(computed.actionPlan);

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
        dureeCreditCible,
        tauxEndettementCible,
      };
      window.localStorage.setItem(CAPACITE_STORAGE_KEY, JSON.stringify(payload));
    }

    const el = document.getElementById("resultats-capacite");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

      setChargesMensuellesHorsCredits(
        saved.chargesMensuellesHorsCredits ? String(saved.chargesMensuellesHorsCredits) : ""
      );

      setNbCredits(saved.nbCredits ?? 0);
      setTypesCredits(saved.typesCredits ?? []);
      setMensualitesCredits((saved.mensualitesCredits ?? []).map((x: any) => (x ? String(x) : "")));
      setResteAnneesCredits((saved.resteAnneesCredits ?? []).map((x: any) => (x ? String(x) : "10")));
      setTauxCredits((saved.tauxCredits ?? []).map((x: any) => (x ? String(x) : "1.5")));
      setRevenusLocatifs((saved.revenusLocatifs ?? []).map((x: any) => (x ? String(x) : "")));

      setTauxCreditCible(saved.tauxCreditCible ? String(saved.tauxCreditCible) : "3.5");
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
  const captureLeadViaRpc = async (params: {
    email: string;
    computed: ReturnType<typeof computeAll>;
  }) => {
    if (!supabase) throw new Error("Supabase non configuré.");

    const email = safeEmail(params.email);
    if (!email) throw new Error("Email manquant.");

    const { resume, texte, assessment, actionPlan, parsed } = params.computed;

    const utm = (typeof window !== "undefined" ? getUtmFromUrl() : null) ?? null;
    const source = getSourceLabel();

    const lead_age = parsed.age1 > 0 ? Math.round(parsed.age1) : null;
    const project_budget_target =
      resume?.prixBienMax && resume.prixBienMax > 0 ? Math.round(resume.prixBienMax) : null;

    const timelineDb: ProjectTimelineDB = TIMELINE_UI_TO_DB[projectTimelineUI];
    const usageDb: ProjectUsageDB = USAGE_UI_TO_DB[projectUsageUI];

    // payload "propre" (numérisé)
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
        dureeCreditCible: parsed.dureeCredit,
        apportPersonnel: parsed.apport,
      },
      output: {
        resume,
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
        consent_contact: false,
      },
      user: { user_id: sessionUserId || null, email: sessionEmail || null },
    };

    const { error } = await supabase.rpc("upsert_lead_v1", {
      p_tool: "capacite",
      p_email: email,
      p_payload: payload,
      p_postal_code: null,
      p_city: null,
      p_phone: null,
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

  const handleUnlock = async () => {
    setUnlockMsg(null);

    if (!hasResult) {
      setUnlockMsg("Calculez d’abord votre capacité pour débloquer l’analyse.");
      return;
    }

    const email = safeEmail(leadEmail);
    if (!email || !email.includes("@")) {
      setUnlockMsg("Merci de renseigner une adresse e-mail valide.");
      return;
    }

    if (!consentLokt) {
      setUnlockMsg("Pour débloquer l’analyse, merci d’accepter l’utilisation de vos données (Lokt.fr).");
      return;
    }

    const computed = computeAll();

    setUnlocking(true);
    try {
      await captureLeadViaRpc({ email, computed });

      persistLeadEmail("capacite", email);
      persistUnlock("capacite", email);

      setUnlocked(true);
      setUnlockMsg("✅ Analyse débloquée. (Votre simulation est bien enregistrée.)");
    } catch (e: any) {
      setUnlockMsg("❌ Impossible d’enregistrer le dossier : " + (e?.message || "erreur inconnue"));
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
            const before = lines.filter((l) => !l.trim().startsWith("- ")).join(" ").trim();
            const bullets = lines
              .filter((l) => l.trim().startsWith("- "))
              .map((l) => l.replace(/^\-\s+/, "").trim());

            return (
              <div key={idx} className="space-y-2">
                {before ? <p className="text-[0.75rem] text-slate-700 leading-relaxed">{before}</p> : null}
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
    if (!bankability) return "Score Lokt.fr";
    if (bankability.label === "Refus probable") return "Score Lokt.fr — Refus probable";
    if (bankability.score >= 85) return "Score Lokt.fr — Très solide";
    if (bankability.score >= 70) return "Score Lokt.fr — Solide";
    if (bankability.score >= 55) return "Score Lokt.fr — À optimiser";
    return "Score Lokt.fr — Sous tension";
  }, [bankability]);

  const canShowFullAnalysis = useMemo(() => isLoggedIn || unlocked, [isLoggedIn, unlocked]);

  const tauxCreditNum = toFloat(tauxCreditCible, 0);
  const dureeCreditNum = toInt(dureeCreditCible, 0);
  const tauxEndettementNum = toFloat(tauxEndettementCible, 0);

  /* ======================== UI ======================== */
  return (
    <div className="space-y-6">
      {/* Wizard */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 sm:p-6 space-y-5">
        {/* Stepper */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 overflow-x-auto">
            <div className="flex items-center gap-2 whitespace-nowrap pr-2">
              {stepLabels.map((label, index) => {
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
                      "inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 transition border " +
                      (active
                        ? "bg-slate-900 text-white border-slate-900"
                        : done
                        ? "bg-emerald-50 text-slate-900 border-emerald-200 hover:bg-emerald-100"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50") +
                      (clickable ? "" : " opacity-60 cursor-not-allowed")
                    }
                    aria-label={`Aller à l’étape ${num} : ${label}`}
                    title={label}
                  >
                    <span
                      className={
                        "flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-semibold " +
                        (active
                          ? "bg-white text-slate-900"
                          : done
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 text-slate-700")
                      }
                    >
                      {num}
                    </span>
                    <span className={"text-[0.72rem] " + (active ? "font-semibold" : "")}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[0.7rem] text-slate-500 shrink-0">
            Étape {step} / {TOTAL_STEPS}
          </p>
        </div>

        {/* Contenu */}
        <div className="border border-slate-100 rounded-xl bg-slate-50/70 p-4 space-y-3">
          {/* === Step 1 === */}
          {step === 1 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Votre projet</h2>
              <p className="text-[0.75rem] text-slate-600">
                On vous positionne avec une capacité de financement + un prix de bien “envisageable”.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Type de bien
                    <InfoBadge text="Aide à qualifier le projet (sans être trop intrusif)." />
                  </label>
                  <select
                    value={propertyKind}
                    onChange={(e) => setPropertyKind(e.target.value as PropertyKind)}
                    className={selectBase}
                  >
                    <option value="appartement">Appartement</option>
                    <option value="maison">Maison</option>
                    <option value="terrain">Terrain</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Nature du projet
                    <InfoBadge text="Impacte les frais (notaire/agence). Ancien et Neuf n'ont pas les mêmes frais de notaire." />
                  </label>
                  <select value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)} className={selectBase}>
                    <option value="ancien">Ancien</option>
                    <option value="neuf">Neuf / VEFA</option>
                    <option value="terrain">Terrain + construction</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Usage
                    <InfoBadge text="Conforme DB : résidence principale / secondaire / investissement." />
                  </label>
                  <select value={projectUsageUI} onChange={(e) => setProjectUsageUI(e.target.value as ProjectUsageUI)} className={selectBase}>
                    <option value="rp">Résidence principale</option>
                    <option value="rs">Résidence secondaire</option>
                    <option value="invest">Investissement</option>
                  </select>
                </div>

                <div className="space-y-1 lg:col-span-2">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Département (optionnel)
                    <InfoBadge text="Ex: 75, 92, 33… Ça aide à qualifier la demande sans demander une adresse précise." />
                  </label>
                  <input
                    type="text"
                    value={projectDepartment}
                    onChange={(e) => setProjectDepartment(e.target.value)}
                    placeholder="Ex: 75, 92, 33…"
                    className={inputBase}
                  />
                  <p className="text-[0.7rem] text-slate-500">Tu peux laisser vide si tu ne sais pas encore.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Horizon
                    <InfoBadge text="Conforme DB : 0–3 mois / 3–6 / 6–12 / 12+ / juste info." />
                  </label>
                  <select value={projectTimelineUI} onChange={(e) => setProjectTimelineUI(e.target.value as ProjectTimelineUI)} className={selectBase}>
                    <option value="0_3m">0–3 mois</option>
                    <option value="3_6m">3–6 mois</option>
                    <option value="6_12m">6–12 mois</option>
                    <option value="12m_plus">12+ mois</option>
                    <option value="juste_info">Je me renseigne</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Apport personnel (€)
                    <InfoBadge text="Clé : beaucoup de banques attendent au moins les frais (notaire + garantie/dossier) en apport (minimum) sauf profils très premium." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={apportPersonnel}
                    onChange={(e) => setApportPersonnel(onlyDigits(e.target.value))}
                    placeholder="Ex: 20000"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[0.75rem] text-slate-700">
                  Résumé : <span className="font-semibold">{propertyKindLabel}</span>,{" "}
                  <span className="font-semibold">{projectTypeLabel}</span>,{" "}
                  <span className="font-semibold">{projectUsageLabel}</span>, horizon{" "}
                  <span className="font-semibold">{projectTimelineLabel}</span>
                  {projectDepartment?.trim() ? (
                    <>
                      {" "}
                      — département <span className="font-semibold">{projectDepartment.trim()}</span>
                    </>
                  ) : null}
                  . Apport <span className="font-semibold">{formatEuro(toInt(apportPersonnel, 0))}</span>.
                </p>
              </div>
            </>
          )}

          {/* === Step 2 === */}
          {step === 2 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Votre profil</h2>
              <p className="text-[0.75rem] text-slate-600">
                Ces infos servent à “mimer” la lecture banque : âge, composition du foyer et statut pro.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Statut principal
                    <InfoBadge text="Les banques n’évaluent pas un revenu de la même façon selon le statut." />
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
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Âge emprunteur (ans)
                    <InfoBadge text="Impacte la durée possible : la banque raisonne en âge à la fin du prêt." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={ageEmprunteur}
                    onChange={(e) => setAgeEmprunteur(onlyDigits(e.target.value))}
                    className={inputBase}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Âge co-emprunteur (optionnel)
                    <InfoBadge text="S’il y a 2 emprunteurs, la banque retient souvent l’âge le plus élevé." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={ageCoEmprunteur}
                    onChange={(e) => setAgeCoEmprunteur(onlyDigits(e.target.value))}
                    className={inputBase}
                    placeholder="Laisser vide si non"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Adultes dans le foyer
                    <InfoBadge text="Aide à estimer le reste-à-vivre par personne." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={nbAdultes}
                    onChange={(e) => setNbAdultes(onlyDigits(e.target.value))}
                    className={inputBase}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Enfants à charge
                    <InfoBadge text="Le reste-à-vivre attendu augmente avec le nombre d’enfants." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={nbEnfants}
                    onChange={(e) => setNbEnfants(onlyDigits(e.target.value))}
                    className={inputBase}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2 lg:col-span-3">
                  <p className="text-[0.75rem] text-slate-700">
                    Lecture banque : <span className="font-semibold">{proStatusLabel}</span> — foyer{" "}
                    <span className="font-semibold">
                      {toInt(nbAdultes, 1)} adulte(s)
                      {toInt(nbEnfants, 0) > 0 ? `, ${toInt(nbEnfants, 0)} enfant(s)` : ""}
                    </span>
                    — âge emprunteur <span className="font-semibold">{ageEmprunteur || "-"}</span>
                    {ageCoEmprunteur ? (
                      <>
                        {" "}
                        / co-emprunteur <span className="font-semibold">{ageCoEmprunteur}</span>
                      </>
                    ) : null}
                    .
                  </p>
                </div>
              </div>
            </>
          )}

          {/* === Step 3 === */}
          {step === 3 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Vos revenus</h2>
              <p className="text-[0.75rem] text-slate-600">
                On renseigne les revenus mensuels. Les loyers (si crédits immo locatifs) seront ajoutés à l’étape suivante.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Revenus nets du foyer (€/mois)</label>
                  <input
                    inputMode="numeric"
                    value={revenusNetMensuels}
                    onChange={(e) => setRevenusNetMensuels(onlyDigits(e.target.value))}
                    className={inputBase}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Autres revenus (pensions, primes récurrentes, etc.) (€/mois)
                  </label>
                  <input
                    inputMode="numeric"
                    value={autresRevenusMensuels}
                    onChange={(e) => setAutresRevenusMensuels(onlyDigits(e.target.value))}
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[0.75rem] text-slate-700">
                  Revenus déclarés :{" "}
                  <span className="font-semibold">
                    {formatEuro(toInt(revenusNetMensuels, 0) + toInt(autresRevenusMensuels, 0))}
                  </span>{" "}
                  / mois (hors loyers).
                </p>
              </div>
            </>
          )}

          {/* === Step 4 === */}
          {step === 4 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Charges & crédits</h2>
              <p className="text-[0.75rem] text-slate-600">
                On recense vos charges fixes hors crédits, puis vos crédits en cours (immo / conso / auto…).
              </p>

              <div className="grid gap-3 sm:grid-cols-2 items-end">
                <div className="space-y-1">
                  <label className={labelBase}>Autres charges mensuelles hors crédits (€/mois)</label>
                  <input
                    inputMode="numeric"
                    value={chargesMensuellesHorsCredits}
                    onChange={(e) => setChargesMensuellesHorsCredits(onlyDigits(e.target.value))}
                    className={inputSmall}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>
                    Nombre de crédits en cours
                    <InfoBadge text="Incluez prêts immo, auto, conso… Les prêts immo locatifs permettent d'intégrer 70 % du loyer." />
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={nbCredits}
                    onChange={(e) => handleNbCreditsChange(parseInt(e.target.value, 10) || 0)}
                    className={inputSmall}
                  />
                </div>
              </div>

              {nbCredits === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[0.75rem] text-slate-600">Aucun crédit déclaré. Vous pouvez passer à l’étape suivante.</p>
                </div>
              ) : (
                <div className="mt-2 space-y-3 max-h-80 overflow-y-auto pr-1">
                  {Array.from({ length: nbCredits }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-white px-3 py-2 space-y-2">
                      <p className="text-[0.7rem] font-semibold text-slate-700">Crédit #{index + 1}</p>

                      <div className="grid gap-2 sm:grid-cols-2 items-start">
                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700">Type de crédit</label>
                          <select
                            value={typesCredits[index] || "immo"}
                            onChange={(e) => handleTypeCreditChange(index, e.target.value as TypeCredit)}
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="immo">Crédit immobilier</option>
                            <option value="perso">Crédit personnel</option>
                            <option value="auto">Crédit auto</option>
                            <option value="conso">Crédit consommation</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700">Mensualité (€/mois)</label>
                          <input
                            inputMode="numeric"
                            value={mensualitesCredits[index] ?? ""}
                            onChange={(e) => handleMensualiteChange(index, onlyDigits(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3 items-start">
                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700">Durée restante (années)</label>
                          <input
                            inputMode="numeric"
                            value={resteAnneesCredits[index] ?? ""}
                            onChange={(e) => handleResteAnneesChange(index, onlyDigits(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700">Taux du crédit (%)</label>
                          <input
                            inputMode="decimal"
                            value={tauxCredits[index] ?? ""}
                            onChange={(e) => handleTauxCreditChange(index, onlyNumberLike(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        {typesCredits[index] === "immo" ? (
                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700">Loyer associé (€/mois)</label>
                            <input
                              inputMode="numeric"
                              value={revenusLocatifs[index] ?? ""}
                              onChange={(e) => handleRevenuLocatifChange(index, onlyDigits(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <p className="text-[0.65rem] text-slate-500">70 % de ce loyer sera intégré à vos revenus.</p>
                          </div>
                        ) : (
                          <div className="space-y-1 opacity-0 pointer-events-none select-none">
                            <label className="text-[0.7rem] text-slate-700">—</label>
                            <input
                              type="text"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              value=""
                              readOnly
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* === Step 5 === */}
          {step === 5 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Paramètres du prêt</h2>
              <p className="text-[0.75rem] text-slate-600">
                Ajustez durée, taux et cible d’endettement pour estimer capital, budget max (avec apport) et score.
              </p>

              <div className="grid gap-3 sm:grid-cols-3 items-end">
                <div className="space-y-1">
                  <label className={labelBase}>Taux du crédit (annuel, %)</label>
                  <input
                    inputMode="decimal"
                    value={tauxCreditCible}
                    onChange={(e) => setTauxCreditCible(onlyNumberLike(e.target.value))}
                    className={inputSmall}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>
                    Durée du crédit (années)
                    <InfoBadge text="La faisabilité dépend aussi de l’âge (âge fin de prêt selon banques/profil)." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={dureeCreditCible}
                    onChange={(e) => setDureeCreditCible(onlyDigits(e.target.value))}
                    className={inputSmall}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>
                    Taux d&apos;endettement cible (%)
                    <InfoBadge text="Souvent autour de 33–35 %, parfois plus selon profil/patrimoine." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={tauxEndettementCible}
                    onChange={(e) => setTauxEndettementCible(onlyDigits(e.target.value))}
                    className={inputSmall}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[0.75rem] text-slate-700">
                  Hypothèse : {dureeCreditNum} ans à ~{tauxCreditNum.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%,
                  cible endettement {tauxEndettementNum}%.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 1}
            className="text-[0.75rem] text-slate-600 disabled:opacity-40 disabled:cursor-default hover:text-slate-900"
          >
            ← Précédent
          </button>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => {
                setMaxStepReached((m) => Math.max(m, Math.min(step + 1, TOTAL_STEPS)));
                goNext();
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                setMaxStepReached(TOTAL_STEPS);
                await handleCalculCapacite();
              }}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-[0.8rem] font-semibold text-white shadow-lg hover:shadow-2xl active:scale-[0.99]"
            >
              Calculer ma capacité d&apos;emprunt
            </button>
          )}
        </div>
      </section>

      {/* Résultats */}
      <section id="resultats-capacite" className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600 mb-1">Résultats de votre simulation</p>
            <h2 className="text-sm font-semibold text-slate-900">Votre capacité d&apos;emprunt et votre budget indicatif</h2>
            <p className="text-[0.75rem] text-slate-600">
              Chiffres “bruts” pour vous positionner. Le Score Lokt.fr™ et le plan d’action sont débloqués ensuite.
            </p>
          </div>
        </div>

        {!hasResult ? (
          <p className="text-[0.8rem] text-slate-600">
            Complétez les 5 étapes puis cliquez sur « Calculer ma capacité » pour afficher vos résultats.
          </p>
        ) : (
          <>
            {/* Cartes visibles (gratuites) */}
            <div className="grid gap-3 sm:grid-cols-4 items-stretch">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Mensualité max</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(resumeCapacite!.mensualiteMax)}</p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">Capacité théorique sans dépasser la cible.</p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Capital empruntable</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(resumeCapacite!.montantMax)}</p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">
                  Référence : 25 ans à ~{tauxCreditNum.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Budget max (avec apport)</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(resumeCapacite!.budgetTotalMax)}</p>
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
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(resumeCapacite!.tauxEndettementAvecProjet)}</p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">
                  Actuel : {formatPct(resumeCapacite!.tauxEndettementActuel)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4 items-stretch mt-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 sm:col-span-2 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                  Mensualité estimée (pour garder le capital)
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(resumeCapacite!.mensualiteProjet)}</p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">
                  Sur {dureeCreditNum} ans à ~{tauxCreditNum.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%,
                  pour emprunter {formatEuro(resumeCapacite!.montantMax)}.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 sm:col-span-2 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Lecture</p>
                <p className="mt-1 text-[0.75rem] text-slate-700 leading-relaxed">
                  La durée ne change pas votre “capacité” (mensualité max), mais change la mensualité nécessaire si vous gardez le même capital — et donc l’endettement & le score.
                </p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">C’est exactement l’effet “25 ans → 2 ans”.</p>
              </div>
            </div>

            {/* 🔒 Gate */}
            {!canShowFullAnalysis ? (
              <LeadGate
                theme="cyan-emerald"
                title="Débloquer le Score Lokt.fr™"
                subtitle="Débloquez votre score et un plan d’action concret. Pas de démarchage : on enregistre uniquement la simulation et des stats agrégées."
                email={leadEmail}
                setEmail={setLeadEmail}
                consent={consentLokt}
                setConsent={setConsentLokt}
                unlocking={unlocking}
                unlockMsg={unlockMsg}
                onUnlock={handleUnlock}
              />
            ) : null}

            {/* ✅ Partie débloquée */}
            {canShowFullAnalysis && bankability && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-4 items-stretch">
                  <div className="rounded-xl bg-slate-900 text-white px-3 py-2.5 sm:col-span-2 h-full flex flex-col">
                    <p className="text-[0.65rem] uppercase tracking-[0.14em] text-emerald-200">{loktScoreLabel}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className={`text-2xl font-semibold ${scoreColor}`}>{bankability.score}/100</p>
                      <p className="text-[0.85rem] font-medium text-white">{bankability.label}</p>
                    </div>
                    <p className="mt-1 text-[0.75rem] text-slate-100">{bankability.comment}</p>
                    <p className="mt-auto pt-2 text-[0.7rem] text-slate-200">
                      Indice explicable + règles “banque-like” (restes négatifs, dépassement d’endettement, apport insuffisant).
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 sm:col-span-2 h-full flex flex-col">
                    <div>
                      <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Détails (pour comprendre)</p>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                          <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Ratio endettement</p>
                          <p className="text-[0.8rem] text-slate-900 mt-0.5">
                            {(bankability.details.dtiRatio * 100).toFixed(0)}% de la cible
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                          <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">RAV / UC</p>
                          <p className="text-[0.8rem] text-slate-900 mt-0.5">~{formatEuro(bankability.details.resteAVivreParUC)}</p>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 sm:col-span-2">
                          <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Reste à vivre total après projet</p>
                          <p
                            className={`text-[0.8rem] mt-0.5 ${
                              bankability.details.resteApresProjet < 0 ? "text-red-700 font-semibold" : "text-slate-900"
                            }`}
                          >
                            {formatEuro(bankability.details.resteApresProjet)}
                          </p>
                          {bankability.details.resteApresProjet < 0 ? (
                            <p className="text-[0.7rem] text-red-700 mt-1">Déficit : red flag banque (cap de score appliqué).</p>
                          ) : null}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 sm:col-span-2">
                          <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Sous-scores</p>
                          <p className="text-[0.75rem] text-slate-700 mt-1">
                            DTI {bankability.details.subScores.dti} · RAV {bankability.details.subScores.rav} · Stabilité{" "}
                            {bankability.details.subScores.stability} · Âge {bankability.details.subScores.age} · Conso{" "}
                            {bankability.details.subScores.conso} · Apport {bankability.details.subScores.apport}
                          </p>
                        </div>
                      </div>

                      {(bankability.details.hardCapsApplied.ravNegative ||
                        bankability.details.hardCapsApplied.dtiHigh ||
                        bankability.details.hardCapsApplied.apportLow) && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
                          <p className="text-[0.7rem] text-amber-800 font-semibold">Règles “red flags” déclenchées :</p>
                          <ul className="mt-1 list-disc pl-5 space-y-0.5">
                            {bankability.details.hardCapsApplied.ravNegative && (
                              <li className="text-[0.7rem] text-amber-800">Reste-à-vivre négatif</li>
                            )}
                            {bankability.details.hardCapsApplied.dtiHigh && (
                              <li className="text-[0.7rem] text-amber-800">Endettement au-dessus de la cible</li>
                            )}
                            {bankability.details.hardCapsApplied.apportLow && (
                              <li className="text-[0.7rem] text-amber-800">Apport inférieur aux frais estimés</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>

                    <p className="mt-auto pt-2 text-[0.7rem] text-slate-600">
                      Les banques peuvent appliquer des règles différentes. Ici, un reste-à-vivre négatif ou un gros dépassement d’endettement entraîne un cap de score.
                    </p>
                  </div>
                </div>

                {actionPlanText && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">Plan d&apos;action Lokt.fr™</p>
                    {renderRichText(actionPlanText)}
                  </div>
                )}

                {resultCapaciteTexte && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">Analyse détaillée</p>
                    {resultCapaciteTexte.split("\n").map((line, idx) => (
                      <p key={idx} className="text-[0.75rem] text-slate-700 leading-relaxed">
                        {line}
                      </p>
                    ))}
                    <p className="mt-2 text-[0.65rem] text-slate-500">Calculs indicatifs. Ne constitue pas une offre de prêt.</p>
                  </div>
                )}
              </>
            )}

            <p className="mt-2 text-[0.65rem] text-slate-500">Résultats indicatifs. Ils ne constituent pas une offre de prêt.</p>
          </>
        )}
      </section>
    </div>
  );
}
