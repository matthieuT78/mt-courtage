// lib/calculators/capaciteEngine.ts
//
// Moteur de calcul du simulateur de capacité d'emprunt — extrait de
// components/CapaciteWizard.tsx (computeAll + computeLoktScore +
// buildActionPlan) pour être réutilisable par les versions compactes du
// widget (/embed/capacite en taille medium/small), sans dupliquer la
// logique. CapaciteWizard.tsx (taille large) utilise ce même moteur.
//
// Extraction fidèle : même formules, mêmes seuils, même comportement que
// l'original — seule différence, les entrées sont passées explicitement
// en paramètres plutôt que lues depuis le state React du composant.

export type TypeCredit = "immo" | "perso" | "auto" | "conso";
export type ProjectType = "ancien" | "neuf" | "terrain";
export type ProStatus = "cdi" | "fonctionnaire" | "independant" | "retraite" | "autre";
export type PropertyKind = "appartement" | "maison" | "terrain" | "autre";
export type ProjectUsageUI = "rp" | "rs" | "invest";
export type ProjectTimelineUI = "0_3m" | "3_6m" | "6_12m" | "12m_plus" | "juste_info";

export type ResumeCapacite = {
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

export type ScenarioCapacite = {
  duree: number;
  montantMax: number;
  mensualiteCreditHorsAssurance: number;
  assuranceMensuelle: number;
  mensualiteProjet: number;
  budgetTotalMax: number;
  prixBienMax: number;
};

export type BankabilityAssessment = {
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

export type ActionPlanItemType = "blocking" | "warning" | "positive" | "tip";
export type ActionPlanItem = { type: ActionPlanItemType; title: string; body: string };

export function actionItemsToString(items: ActionPlanItem[]): string {
  return items.map((it) => `### [${it.type.toUpperCase()}] ${it.title}\n${it.body}`).join("\n\n");
}

export type ComputedAll = {
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

/* ------------------------ Format helpers ------------------------ */
export function formatEuro(val: number) {
  if (!Number.isFinite(val)) return "-";
  return val.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export function formatPct(val: number) {
  if (!Number.isFinite(val)) return "-";
  return val.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %";
}

export function toInt(v: string, fallback = 0) {
  const x = parseInt(v, 10);
  return Number.isFinite(x) ? x : fallback;
}

export function toFloat(v: string, fallback = 0) {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : fallback;
}

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

function monthlyPaymentWithInsurance(principal: number, annualRatePct: number, years: number, annualInsurancePct: number) {
  return monthlyPayment(principal, annualRatePct, years) + monthlyInsurance(principal, annualInsurancePct);
}

function principalFromPaymentWithInsurance(payment: number, annualRatePct: number, years: number, annualInsurancePct: number) {
  const M = Math.max(0, payment || 0);
  const n = Math.max(0, Math.round((years || 0) * 12));
  const r = Math.max(0, (annualRatePct || 0) / 100) / 12;
  const insuranceMonthlyRate = Math.max(0, annualInsurancePct || 0) / 100 / 12;
  if (M <= 0 || n <= 0) return 0;
  const creditMonthlyRate = r === 0 ? 1 / n : r / (1 - Math.pow(1 + r, -n));
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

/* ------------------------ Labels ------------------------ */
function projectTypeLabelOf(projectType: ProjectType) {
  if (projectType === "neuf") return "Neuf / VEFA";
  if (projectType === "terrain") return "Terrain + construction";
  return "Ancien";
}
function proStatusLabelOf(proStatus: ProStatus) {
  if (proStatus === "fonctionnaire") return "Fonctionnaire";
  if (proStatus === "independant") return "Indépendant / société";
  if (proStatus === "retraite") return "Retraité";
  if (proStatus === "autre") return "Autre";
  return "CDI";
}
function propertyKindLabelOf(propertyKind: PropertyKind) {
  if (propertyKind === "maison") return "Maison";
  if (propertyKind === "terrain") return "Terrain";
  if (propertyKind === "autre") return "Autre";
  return "Appartement";
}
function projectUsageLabelOf(projectUsageUI: ProjectUsageUI) {
  if (projectUsageUI === "rs") return "Résidence secondaire";
  if (projectUsageUI === "invest") return "Investissement";
  return "Résidence principale";
}
function projectTimelineLabelOf(projectTimelineUI: ProjectTimelineUI) {
  if (projectTimelineUI === "0_3m") return "0–3 mois";
  if (projectTimelineUI === "3_6m") return "3–6 mois";
  if (projectTimelineUI === "6_12m") return "6–12 mois";
  if (projectTimelineUI === "12m_plus") return "12+ mois";
  return "Je me renseigne";
}

/* ------------------------ Score lokt.fr ------------------------ */
export function computeLoktScore(params: {
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
        hardCapsApplied: { ravNegative: true, ravLow: false, dtiHigh: false, apportLow: false },
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
  else if (dtiRatio <= 1.4) s_dti = 45 - ((dtiRatio - 1.15) / 0.25) * 30;
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

  const rawScore = 0.42 * s_dti + 0.24 * s_rav + 0.13 * s_stability + 0.08 * s_age + 0.05 * s_conso + 0.08 * s_apport;

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

  const subs = { dti: s_dti, rav: s_rav, stability: s_stability, age: s_age, conso: s_conso, apport: s_apport };
  const weakest = (Object.keys(subs) as (keyof typeof subs)[]).sort((a, b) => subs[a] - subs[b])[0];

  let comment = "Votre dossier est globalement cohérent, avec quelques optimisations possibles.";

  if (hardCaps.ravNegative) {
    comment = "Signal rouge : votre reste à vivre après projet est négatif. Dans cette configuration, une banque refusera très probablement.";
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
      comment = "La durée et l'âge en fin de prêt pèsent dans la décision. Selon les banques, il faudra peut-être ajuster la durée ou renforcer le dossier.";
    } else if (weakest === "conso") {
      comment = "Les crédits conso/auto pèsent sur la décision. Une réduction ciblée (remboursement / regroupement) peut améliorer le score rapidement.";
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
export function buildActionPlan(
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

  if (assessment.details.hardCapsApplied.ravNegative) {
    items.push({
      type: "blocking",
      title: "Reste à vivre négatif — risque de refus",
      body: `Après projet, votre reste à vivre estimé est négatif (${formatEuro(assessment.details.resteApresProjet)}). Une banque refusera très probablement dans cette configuration. Leviers prioritaires : réduire le budget du bien, allonger la durée, ou rembourser certains crédits avant le projet.`,
    });
  }

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

  if (tauxEndettementCible > 40) {
    items.push({
      type: "warning",
      title: "Endettement cible au-dessus des standards HCSF",
      body: `Vous avez fixé une cible d'endettement à ${formatPct(tauxEndettementCible)}, au-dessus des ~35% généralement admis (recommandation HCSF, dérogations possibles au cas par cas). Les montants affichés supposent que votre banque accepte ce dépassement — à confirmer avant de vous engager.`,
    });
  }

  if (!resume.apportCouvreFrais && resume.apportMinRecommande > 0) {
    items.push({
      type: "warning",
      title: "Apport inférieur aux frais estimés",
      body: `Votre apport (${formatEuro(resume.apport)}) est en dessous des frais estimés (~${formatEuro(resume.apportMinRecommande)}). Couvrir au moins le notaire et la garantie est souvent requis par les banques — sans quoi elles peuvent demander une caution renforcée ou refuser.`,
    });
  }

  if (resume.tauxEndettementActuel > 0.2 && nbCredits > 0) {
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

  if (margeSousCible >= 0.05) {
    items.push({
      type: "positive",
      title: "Bon niveau d'endettement",
      body: `Votre taux projeté (~${formatPct(resume.tauxEndettementAvecProjet)}) laisse une marge confortable de ${formatPct(margeSousCible)} sous la cible. Votre dossier présente un bon équilibre — concentrez-vous sur la qualité de présentation.`,
    });
  }

  if (apportPct >= 0.2 && resume.budgetTotalMax > 0) {
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

/* ------------------------ Entrée principale ------------------------ */
export type CapaciteInputs = {
  revenusNetMensuels: string;
  autresRevenusMensuels: string;
  chargesMensuellesHorsCredits: string;
  apportPersonnel: string;
  ageEmprunteur: string;
  ageCoEmprunteur: string;
  nbAdultes: string;
  nbEnfants: string;
  tauxEndettementCible: string;
  tauxCreditCible: string;
  tauxAssuranceCible: string;
  dureeCreditCible: string;
  nbCredits: number;
  typesCredits: TypeCredit[];
  mensualitesCredits: string[];
  resteAnneesCredits: string[];
  tauxCredits: string[];
  revenusLocatifs: string[];
  projectType: ProjectType;
  proStatus: ProStatus;
  propertyKind: PropertyKind;
  projectUsageUI: ProjectUsageUI;
  projectTimelineUI: ProjectTimelineUI;
  projectDepartment: string;
};

export function computeCapacite(inputs: CapaciteInputs): ComputedAll {
  const {
    revenusNetMensuels,
    autresRevenusMensuels,
    chargesMensuellesHorsCredits,
    apportPersonnel,
    ageEmprunteur,
    ageCoEmprunteur,
    nbAdultes: nbAdultesStr,
    nbEnfants: nbEnfantsStr,
    tauxEndettementCible: tauxEndettementCibleStr,
    tauxCreditCible: tauxCreditCibleStr,
    tauxAssuranceCible: tauxAssuranceCibleStr,
    dureeCreditCible: dureeCreditCibleStr,
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
  } = inputs;

  const revenusNet = toInt(revenusNetMensuels, 0);
  const autresRev = toInt(autresRevenusMensuels, 0);
  const chargesHors = toInt(chargesMensuellesHorsCredits, 0);
  const apport = toInt(apportPersonnel, 0);

  const age1 = toInt(ageEmprunteur, 0);
  const age2 = toInt(ageCoEmprunteur, 0);

  const adultes = Math.max(1, toInt(nbAdultesStr, 1));
  const enfants = Math.max(0, toInt(nbEnfantsStr, 0));

  const tauxEndettement = Math.min(Math.max(toFloat(tauxEndettementCibleStr, 35), 1), 100);
  const tauxCredit = Math.min(Math.max(toFloat(tauxCreditCibleStr, 3.5), 0), 20);
  const tauxAssurance = Math.min(Math.max(toFloat(tauxAssuranceCibleStr, 0.3), 0), 5);
  const dureeCredit = Math.min(Math.max(toInt(dureeCreditCibleStr, 25), 1), 35);

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

  const tauxAvecProjet = revenusPrisEnCompte > 0 ? ((chargesActuelles + (mensualiteProjet || 0)) / revenusPrisEnCompte) * 100 : 0;

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

  const projectTypeLabel = projectTypeLabelOf(projectType);
  const proStatusLabel = proStatusLabelOf(proStatus);
  const propertyKindLabel = propertyKindLabelOf(propertyKind);
  const projectUsageLabel = projectUsageLabelOf(projectUsageUI);
  const projectTimelineLabel = projectTimelineLabelOf(projectTimelineUI);

  const lignes: string[] = [
    `Projet : ${propertyKindLabel} — ${projectTypeLabel} — ${projectUsageLabel} — horizon ${projectTimelineLabel}.`,
    projectDepartment?.trim() ? `Département (zone de recherche) : ${projectDepartment.trim()}.` : `Département (zone de recherche) : non renseigné.`,
    `Statut : ${proStatusLabel}. Foyer : ${adultes} adulte(s)${enfants > 0 ? `, ${enfants} enfant(s)` : ""}.`,
    age1 > 0 ? `Âge(s) déclaré(s) : emprunteur ${age1} an(s)${age2 > 0 ? `, co-emprunteur ${age2} an(s)` : ""}.` : `Âge(s) déclaré(s) : non renseigné.`,
    ageWarn
      ? `⚠️ Attention : à ${dureeCredit} ans de durée, l'âge à la fin du prêt serait ~${ageFin} ans (variable selon banques/profil).`
      : `Âge fin de prêt estimé : ~${ageFin > 0 ? ageFin : "-"} ans.`,
    `Vos revenus mensuels pris en compte (salaires, autres revenus et 70 % des loyers locatifs) s'élèvent à ${formatEuro(revenusPrisEnCompte)}.`,
    `Vos charges récurrentes (crédits et autres charges) représentent ${formatEuro(chargesActuelles)} par mois, soit un taux d'endettement actuel d'environ ${formatPct(tauxActuel)}.`,
    capaciteMensuelle > 0
      ? `Votre capacité mensuelle "max" (cible ${formatPct(tauxEndettement)}) est ${formatEuro(capaciteMensuelle)}. Sur ${dureeCredit} ans à ~${tauxCredit.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % avec une assurance estimée à ${formatPct(tauxAssurance)}, cela donne ~${formatEuro(montantMax)} de capital.`
      : `Avec les paramètres actuels, aucune capacité mensuelle n'apparaît si l'on reste sur un taux d'endettement cible de ${formatPct(tauxEndettement)}.`,
    montantMax > 0
      ? `La mensualité projetée ressort à ~${formatEuro(mensualiteProjet)} assurance incluse (${formatEuro(mensualiteCreditHorsAssurance)} de crédit + ${formatEuro(assuranceMensuelle)} d'assurance).`
      : `La mensualité projetée n'est pas calculable sans capital.`,
    `Hypothèses frais (${projectTypeLabel}) : notaire ~${(tauxNotaire * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%${tauxAgence > 0 ? `, agence ~${(tauxAgence * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%` : ""}.`,
    `Apport déclaré : ${formatEuro(apport)}. Apport minimum recommandé (≈ notaire + garantie/dossier) : ${formatEuro(apportMinRecommande)}. ${apportMinRecommande > 0 ? (apportCouvreFrais ? "✅ Apport ≥ frais." : "⚠️ Apport < frais : souvent bloquant.") : ""}`,
    prixBienMax > 0
      ? `Budget max estimatif (apport inclus) : ${formatEuro(budgetTotalMax)}. Prix de bien "envisageable" ~${formatEuro(prixBienMax)} (coût total projet ~${formatEuro(coutTotalProjetMax)}).`
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
}
