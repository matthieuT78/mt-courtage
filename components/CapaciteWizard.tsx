// components/CapaciteWizard.tsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const CAPACITE_STORAGE_KEY = "capacite_simulation_v1";

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

type TypeCredit = "immo" | "perso" | "auto" | "conso";

type ResumeCapacite = {
  revenusPrisEnCompte: number;
  mensualitesExistantes: number;
  chargesHorsCredits: number;
  tauxEndettementActuel: number;
  tauxEndettementAvecProjet: number;
  mensualiteMax: number;
  montantMax: number;
  prixBienMax: number;
  fraisNotaireEstimes: number;
  fraisAgenceEstimes: number;
  coutTotalProjetMax: number;
};

type BankabilityAssessment = {
  score: number; // 0–100
  label: string;
  comment: string;
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

/**
 * ⚠️ NE PAS MODIFIER : logique de score IA conservée telle quelle
 */
function computeBankabilityScore(
  resume: ResumeCapacite,
  tauxEndettementCible: number
): BankabilityAssessment {
  const ratio =
    tauxEndettementCible > 0
      ? resume.tauxEndettementAvecProjet / tauxEndettementCible
      : 1;

  let score = 60;
  let label = "Dossier moyen";
  let comment =
    "Votre taux d'endettement projeté reste dans une zone exploitable, mais avec peu de marge. Il faudra soigner le dossier.";

  if (!Number.isFinite(ratio)) {
    return {
      score: 50,
      label: "Profil à affiner",
      comment:
        "Les données sont incomplètes ou atypiques. Il est utile de vérifier les montants de revenus et de charges avant de présenter le dossier.",
    };
  }

  if (ratio <= 0.7) {
    score = 90;
    label = "Très confortable";
    comment =
      "Votre taux d'endettement projeté laisse une marge de sécurité importante : les banques devraient regarder ce dossier très favorablement, sous réserve du reste du profil.";
  } else if (ratio <= 0.9) {
    score = 80;
    label = "Confortable";
    comment =
      "Votre projet reste dans les standards habituels des banques, avec une marge raisonnable sous le taux cible d'endettement.";
  } else if (ratio <= 1.02) {
    score = 70;
    label = "Limite acceptable";
    comment =
      "Votre taux d'endettement projeté flirte avec la limite. Le dossier est finançable mais demandera une présentation rigoureuse (stabilité des revenus, situation patrimoniale, etc.).";
  } else if (ratio <= 1.2) {
    score = 50;
    label = "Sous tension";
    comment =
      "Le taux d'endettement envisagé dépasse le seuil cible : il faudra retravailler le projet (durée, apport, crédits en cours) pour maximiser les chances d'accord.";
  } else {
    score = 35;
    label = "Profil fragile";
    comment =
      "Le taux d'endettement ressort nettement au-dessus des standards usuels. Sans ajustement, le projet risque d'être refusé par la plupart des banques.";
  }

  return { score, label, comment };
}

function buildActionPlan(
  resume: ResumeCapacite,
  assessment: BankabilityAssessment,
  tauxEndettementCible: number
): string {
  const lignes: string[] = [];

  // 👉 Étape 1 moins redondante : on ne répète plus tous les montants détaillés ici
  lignes.push(
    `1. Valider vos chiffres : vérifier que les revenus pris en compte (salaires, autres revenus et 70 % des loyers locatifs) et l’ensemble de vos charges correspondent bien à ce que vous présenterez à la banque (fiches de paie, avis d’imposition, relevés de comptes).`
  );

  if (assessment.score >= 80) {
    lignes.push(
      `2. Consolider un dossier "propre" : bulletins de salaire, derniers avis d’imposition, relevés de comptes sur 3 mois et éventuels actes de propriété pour montrer la solidité de votre profil.`
    );
    lignes.push(
      `3. Mettre en avant la marge de sécurité : votre taux d'endettement reste sous la cible, ce qui donne un argument fort pour négocier conditions de taux et d’assurance.`
    );
  } else if (assessment.score >= 60) {
    lignes.push(
      `2. Sécuriser le projet : étudier une durée de crédit légèrement plus longue ou un apport un peu plus élevé pour ramener le taux d'endettement sous la cible.`
    );
    lignes.push(
      `3. Soigner la présentation : insister sur la stabilité des revenus (CDI, ancienneté, secteur d’activité) et sur une gestion de comptes saine pour rassurer le banquier.`
    );
  } else {
    lignes.push(
      `2. Réduire les charges avant de déposer le dossier : solder ou regrouper certains crédits à la consommation, ou revoir certains abonnements / dépenses récurrentes.`
    );
    lignes.push(
      `3. Adapter le projet : viser un prix de bien inférieur à ${formatEuro(
        resume.prixBienMax
      )}, augmenter l’apport si possible ou allonger la durée dans la limite du raisonnable.`
    );
    lignes.push(
      `4. Construire un plan sur 6–12 mois : le temps de réduire l’endettement, d’épargner un peu plus et de revenir avec un taux d’endettement plus proche de la cible.`
    );
  }

  lignes.push(
    `5. Faire le tour des banques / d’un courtier : une fois ces actions engagées, présenter le dossier à plusieurs établissements permet de comparer les réponses et les conditions (taux, assurance, frais).`
  );

  return lignes.join("\n");
}

export type CapaciteWizardProps = {
  /** Afficher ou non le bouton de sauvegarde */
  showSaveButton?: boolean;
  /** Flouter ou non l'analyse textuelle détaillée + plan d'action */
  blurAnalysis?: boolean;
};

export default function CapaciteWizard({
  showSaveButton = true,
  blurAnalysis = false,
}: CapaciteWizardProps) {
  // --------- États calculette capacité ----------
  // Situation financière
  const [revenusNetMensuels, setRevenusNetMensuels] = useState(4000);
  const [autresRevenusMensuels, setAutresRevenusMensuels] = useState(0);
  const [chargesMensuellesHorsCredits, setChargesMensuellesHorsCredits] =
    useState(0);
  const [tauxEndettementCible, setTauxEndettementCible] = useState(35);

  // Crédits en cours
  const [nbCredits, setNbCredits] = useState(0);
  const [typesCredits, setTypesCredits] = useState<TypeCredit[]>([]);
  const [mensualitesCredits, setMensualitesCredits] = useState<number[]>([]);
  const [resteAnneesCredits, setResteAnneesCredits] = useState<number[]>([]);
  const [tauxCredits, setTauxCredits] = useState<number[]>([]);
  const [revenusLocatifs, setRevenusLocatifs] = useState<number[]>([]);

  // Nouveau projet (taux/durée)
  const [tauxCreditCible, setTauxCreditCible] = useState(3.5);
  const [dureeCreditCible, setDureeCreditCible] = useState(25);

  // Résultats
  const [resumeCapacite, setResumeCapacite] =
    useState<ResumeCapacite | null>(null);
  const [resultCapaciteTexte, setResultCapaciteTexte] = useState<string>("");

  // IA : score de bancabilité + plan d'action
  const [bankabilityScore, setBankabilityScore] = useState<number | null>(null);
  const [bankabilityLabel, setBankabilityLabel] = useState<string>("");
  const [bankabilityComment, setBankabilityComment] = useState<string>("");
  const [actionPlanText, setActionPlanText] = useState<string>("");

  const hasResult = !!resumeCapacite;

  // Sauvegarde
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // --------- Wizard / étapes ----------
  const [step, setStep] = useState<number>(1);
  const TOTAL_STEPS = 4;

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

  // --------- Gestion dynamique des crédits ----------
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
      while (arr.length < n) arr.push(0);
      return arr.slice(0, n);
    });
    setResteAnneesCredits((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(10);
      return arr.slice(0, n);
    });
    setTauxCredits((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(1.5);
      return arr.slice(0, n);
    });
    setRevenusLocatifs((prev) => {
      const arr = [...prev];
      while (arr.length < n) arr.push(0);
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

  const handleMensualiteChange = (index: number, value: number) => {
    setMensualitesCredits((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleResteAnneesChange = (index: number, value: number) => {
    setResteAnneesCredits((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleTauxCreditChange = (index: number, value: number) => {
    setTauxCredits((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handleRevenuLocatifChange = (index: number, value: number) => {
    setRevenusLocatifs((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  // --------- Calcul capacité + IA ----------
  const handleCalculCapacite = () => {
    setSaveMessage(null);

    const revenusBase =
      (revenusNetMensuels || 0) + (autresRevenusMensuels || 0);

    // 70 % des loyers pour les crédits immo
    let revenuLocatifPrisEnCompte = 0;
    for (let i = 0; i < nbCredits; i++) {
      if (typesCredits[i] === "immo") {
        const loyer = revenusLocatifs[i] || 0;
        revenuLocatifPrisEnCompte += loyer * 0.7;
      }
    }

    const revenusPrisEnCompte = revenusBase + revenuLocatifPrisEnCompte;

    const mensualitesExistantes = mensualitesCredits
      .slice(0, nbCredits)
      .reduce((sum, v) => sum + (v || 0), 0);

    const chargesHors = chargesMensuellesHorsCredits || 0;

    const enveloppeMax =
      revenusPrisEnCompte * ((tauxEndettementCible || 0) / 100);

    const chargesActuelles = mensualitesExistantes + chargesHors;

    const capaciteMensuelle = Math.max(enveloppeMax - chargesActuelles, 0);

    const tauxActuel =
      revenusPrisEnCompte > 0
        ? (chargesActuelles / revenusPrisEnCompte) * 100
        : 0;

    const tauxAvecProjet =
      revenusPrisEnCompte > 0
        ? ((chargesActuelles + capaciteMensuelle) / revenusPrisEnCompte) *
          100
        : 0;

    const tAnnuel = (tauxCreditCible || 0) / 100;
    const i = tAnnuel / 12;
    const n = (dureeCreditCible || 0) * 12;
    let montantMax = 0;

    if (capaciteMensuelle > 0 && n > 0) {
      if (i === 0) {
        montantMax = capaciteMensuelle * n;
      } else {
        const facteur = Math.pow(1 + i, n);
        montantMax =
          capaciteMensuelle * ((facteur - 1) / (i * facteur));
      }
    }

    const tauxNotaire = 0.075;
    const tauxAgence = 0.04;
    const denom = 1 + tauxNotaire + tauxAgence;

    let prixBienMax = 0;
    let fraisNotaireEstimes = 0;
    let fraisAgenceEstimes = 0;
    let coutTotalProjetMax = 0;

    if (montantMax > 0 && denom > 0) {
      prixBienMax = montantMax / denom;
      fraisNotaireEstimes = prixBienMax * tauxNotaire;
      fraisAgenceEstimes = prixBienMax * tauxAgence;
      coutTotalProjetMax =
        prixBienMax + fraisNotaireEstimes + fraisAgenceEstimes;
    }

    const resume: ResumeCapacite = {
      revenusPrisEnCompte,
      mensualitesExistantes,
      chargesHorsCredits: chargesHors,
      tauxEndettementActuel: tauxActuel,
      tauxEndettementAvecProjet: tauxAvecProjet,
      mensualiteMax: capaciteMensuelle,
      montantMax,
      prixBienMax,
      fraisNotaireEstimes,
      fraisAgenceEstimes,
      coutTotalProjetMax,
    };

    // 🧠 IA : score + plan d'action (fonction inchangée)
    const assessment = computeBankabilityScore(resume, tauxEndettementCible);
    const actionPlan = buildActionPlan(
      resume,
      assessment,
      tauxEndettementCible
    );

    // Petite analyse qualitative complémentaire (marge sous / au-dessus du taux cible)
    const margeTaux = tauxEndettementCible - tauxAvecProjet;

    const lignes: string[] = [
      `Vos revenus mensuels pris en compte (salaires, autres revenus et 70 % des loyers locatifs) s’élèvent à ${formatEuro(
        revenusPrisEnCompte
      )}.`,
      `Vos charges récurrentes (crédits et autres charges) représentent ${formatEuro(
        chargesActuelles
      )} par mois, soit un taux d’endettement actuel d’environ ${formatPct(
        tauxActuel
      )}.`,
      capaciteMensuelle > 0
        ? `La mensualité théorique disponible pour un nouveau crédit est de ${formatEuro(
            capaciteMensuelle
          )}, ce qui permet d’envisager un capital empruntable d’environ ${formatEuro(
            montantMax
          )} sur ${dureeCreditCible} ans à ${tauxCreditCible.toLocaleString(
            "fr-FR",
            { maximumFractionDigits: 2 }
          )} %.`
        : `Avec les paramètres actuels, aucune capacité mensuelle n’apparaît pour un nouveau crédit si l’on reste sur un taux d’endettement cible de ${formatPct(
            tauxEndettementCible
          )}.`,
      prixBienMax > 0
        ? `En intégrant les frais de notaire (~7,5 %) et d’agence (~4 %), cela correspond à un prix de bien d’environ ${formatEuro(
            prixBienMax
          )} pour un budget global financé proche de ${formatEuro(
            coutTotalProjetMax
          )}.`
        : `La projection d’un prix de bien n’est pas pertinente avec ces paramètres : il peut être utile de retravailler la durée, l’apport ou les charges.`,
    ];

    if (revenusPrisEnCompte > 0) {
      if (margeTaux > 0.5) {
        lignes.push(
          `Avec le projet simulé, votre taux d’endettement resterait environ ${formatPct(
            margeTaux
          )} en dessous de la cible, ce qui laisse une petite marge de sécurité dans votre budget.`
        );
      } else if (margeTaux < -0.5) {
        lignes.push(
          `Avec le projet simulé, votre taux d’endettement dépasserait la cible d’environ ${formatPct(
            -margeTaux
          )}. Il sera nécessaire d’ajuster le prix du bien, la durée ou l’apport pour revenir dans les grilles habituelles des banques.`
        );
      } else {
        lignes.push(
          `Votre projet se situe très proche du taux d’endettement cible : le dossier reste jouable, mais la présentation et la qualité de gestion de vos comptes seront déterminantes.`
        );
      }
    }

    const texte = lignes.join("\n");

    setResumeCapacite(resume);
    setResultCapaciteTexte(texte);
    setBankabilityScore(assessment.score);
    setBankabilityLabel(assessment.label);
    setBankabilityComment(assessment.comment);
    setActionPlanText(actionPlan);

    // 💾 Sauvegarde dans localStorage pour retrouver la simulation après connexion
