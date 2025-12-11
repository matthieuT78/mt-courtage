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

/**
 * Nouveau plan d'action : concret & exploitable
 */
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
  const lignes: string[] = [];
  const chargesActuelles =
    resume.mensualitesExistantes + resume.chargesHorsCredits;
  const margeSousCible =
    tauxEndettementCible - resume.tauxEndettementAvecProjet;
  const depassementCible =
    resume.tauxEndettementAvecProjet - tauxEndettementCible;

  const {
    nbCredits,
    typesCredits,
    mensualitesCredits,
    resteAnneesCredits,
    tauxCredits,
    tauxCreditCible,
    dureeCreditCible,
  } = context;

  // Analyse des crédits conso (perso, auto, conso)
  const consoIndexes: number[] = [];
  for (let i = 0; i < nbCredits; i++) {
    const t = typesCredits[i];
    if (t === "perso" || t === "auto" || t === "conso") {
      consoIndexes.push(i);
    }
  }

  const totalMensuConso = consoIndexes.reduce(
    (sum, idx) => sum + (mensualitesCredits[idx] || 0),
    0
  );

  let maxConsoMensu = 0;
  let maxConsoIdx: number | null = null;

  consoIndexes.forEach((idx) => {
    const m = mensualitesCredits[idx] || 0;
    if (m > maxConsoMensu) {
      maxConsoMensu = m;
      maxConsoIdx = idx;
    }
  });

  // Étapes numérotées dynamiques
  let step = 1;
  const addStep = (text: string) => {
    lignes.push(`${step}. ${text}`);
    step++;
  };

  // 1. Vérification des chiffres
  addStep(
    `Valider vos chiffres : revenus pris en compte à ${formatEuro(
      resume.revenusPrisEnCompte
    )}, charges et mensualités actuelles à ${formatEuro(
      chargesActuelles
    )}. Assurez-vous que ces montants correspondent à vos justificatifs (fiches de paie, avis d’imposition, tableaux d’amortissement, etc.).`
  );

  // 2. Action sur le taux / le projet
  const tauxNegocieCible = Math.max(tauxCreditCible - 0.3, 0.5);
  if (depassementCible > 0.2) {
    addStep(
      `Ajuster le projet pour revenir sous la cible d’endettement : votre taux d’endettement projeté est d’environ ${formatPct(
        resume.tauxEndettementAvecProjet
      )} pour une cible à ${formatPct(
        tauxEndettementCible
      )}. En pratique, cela signifie qu’il faut réduire la mensualité cible d’environ ${formatEuro(
        resume.mensualiteMax * (depassementCible / tauxEndettementCible)
      )} ou bien viser un prix de bien plus bas / un apport plus élevé.`
    );
  } else if (margeSousCible > 0) {
    addStep(
      `Confirmer que le projet reste dans une zone acceptable : avec un taux d’endettement projeté de ${formatPct(
        resume.tauxEndettementAvecProjet
      )} pour une cible à ${formatPct(
        tauxEndettementCible
      )}, vous disposez d’une marge d’environ ${formatPct(
        margeSousCible
      )}. Cela vous permet de discuter plus sereinement des conditions avec la banque.`
    );
  } else {
    addStep(
      `Maintenir un projet raisonnable : votre taux d’endettement projeté est très proche de la cible. Évitez d’augmenter la mensualité ou le prix du bien pour garder un dossier défendable.`
    );
  }

  // 3. Négociation du taux du futur prêt
  addStep(
    `Préparer une négociation du taux sur le nouveau prêt : vous partez sur une hypothèse de ${tauxCreditCible.toLocaleString(
      "fr-FR",
      { maximumFractionDigits: 2 }
    )} % sur ${dureeCreditCible} ans. Visez au moins ${tauxNegocieCible.toLocaleString(
      "fr-FR",
      { maximumFractionDigits: 2 }
    )} % en mettant en avant votre stabilité de revenus et votre gestion de comptes. Même une baisse de 0,20 à 0,30 point de taux améliore mécaniquement votre taux d’endettement et votre score de bancabilité.`
  );

  // 4. Plan spécifique sur les crédits conso si présents
  if (consoIndexes.length > 0) {
    const nbConso = consoIndexes.length;
    addStep(
      `Travailler vos crédits à la consommation : vous avez actuellement ${nbConso} crédit(s) conso (perso/auto/conso) pour une mensualité totale d’environ ${formatEuro(
        totalMensuConso
      )}. Réduire ces mensualités est l’un des leviers les plus efficaces pour améliorer votre bancabilité.`
    );

    if (maxConsoIdx !== null && maxConsoMensu > 0) {
      const reste = resteAnneesCredits[maxConsoIdx] || 0;
      const taux = tauxCredits[maxConsoIdx] || 0;

      lignes.push(
        `   • Option A – Rembourser en priorité le plus gros crédit conso : ciblez le crédit d’environ ${formatEuro(
          maxConsoMensu
        )}/mois (reste ~${reste} an(s), taux ~${taux.toLocaleString("fr-FR", {
          maximumFractionDigits: 2,
        })} %). En vous fixant un plan de remboursement agressif sur 6–12 mois (en affectant par exemple 200–300 € d’effort d’épargne par mois), vous supprimez cette mensualité et améliorez nettement votre taux d’endettement.`
      );
    }

    lignes.push(
      `   • Option B – Regroupement de crédits : si le remboursement anticipé est difficile, étudiez un regroupement de vos crédits conso pour allonger légèrement la durée et réduire la mensualité globale. L’objectif n’est pas d’emprunter plus, mais de diminuer la charge mensuelle en vue du projet immo.`
    );

    lignes.push(
      `   • Suivi de l’impact : chaque ${formatEuro(
        50
      )} à ${formatEuro(
        100
      )} de mensualités conso en moins se traduit par une amélioration de votre taux d’endettement projeté et donc de votre score de bancabilité.`
    );
  }

  // 5. Plan d’épargne / apport
  if (assessment.score <= 60) {
    addStep(
      `Mettre en place un plan d’épargne dédié à l’apport : en mettant de côté par exemple 200–300 € par mois sur 6–12 mois, vous pouvez constituer un apport supplémentaire de quelques milliers d’euros. Cela permet soit de réduire le montant à financer, soit de compenser un dossier un peu juste sur le taux d’endettement.`
    );
  } else {
    addStep(
      `Optimiser votre apport : si vous pouvez augmenter légèrement l’apport (vente d’un véhicule secondaire, épargne disponible, aide familiale), cela réduit le capital à financer et améliore la perception de votre dossier par la banque.`
    );
  }

  // 6. Préparation du dossier & choix des banques
  addStep(
    `Préparer un dossier irréprochable : imprimez vos trois derniers relevés de comptes, vos bulletins de salaire et avis d’imposition, ainsi qu’un récapitulatif clair de vos crédits (montant restant dû, mensualités, durées). L’objectif est de montrer une gestion de comptes propre (pas de découverts récurrents, pas de rejets de prélèvements).`
  );

  addStep(
    `Faire le tour des banques / d’un courtier : une fois ces actions engagées (ou au moins planifiées noir sur blanc), présentez votre dossier à plusieurs établissements ou à un courtier. Mettez en avant : 1) les actions déjà réalisées (remboursement/optimisation de crédits conso, épargne, négociation de taux), 2) la trajectoire de votre taux d’endettement vers ou sous la cible, 3) la stabilité de vos revenus.`
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

    const texte = lignes.join("\n");

    // 🔢 IA : score + plan d'action (logique de score conservée)
    const assessment = computeBankabilityScore(resume, tauxEndettementCible);
    const actionPlan = buildActionPlan(
      resume,
      assessment,
      tauxEndettementCible,
      {
        nbCredits,
        typesCredits,
        mensualitesCredits,
        resteAnneesCredits,
        tauxCredits,
        tauxCreditCible,
        dureeCreditCible,
      }
    );

    setResumeCapacite(resume);
    setResultCapaciteTexte(texte);
    setBankabilityScore(assessment.score);
    setBankabilityLabel(assessment.label);
    setBankabilityComment(assessment.comment);
    setActionPlanText(actionPlan);

    // 💾 Sauvegarde dans localStorage pour retrouver la simulation après connexion
    if (typeof window !== "undefined") {
      const payload = {
        revenusNetMensuels,
        autresRevenusMensuels,
        chargesMensuellesHorsCredits,
        tauxEndettementCible,
        nbCredits,
        typesCredits,
        mensualitesCredits,
        resteAnneesCredits,
        tauxCredits,
        revenusLocatifs,
        tauxCreditCible,
        dureeCreditCible,
        resumeCapacite: resume,
        resultCapaciteTexte: texte,
        bankabilityScore: assessment.score,
        bankabilityLabel: assessment.label,
        bankabilityComment: assessment.comment,
        actionPlanText: actionPlan,
      };
      window.localStorage.setItem(
        CAPACITE_STORAGE_KEY,
        JSON.stringify(payload)
      );
    }

    const el = document.getElementById("resultats-capacite");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // --------- Restauration de la simulation depuis localStorage ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(CAPACITE_STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);

      // 👉 On restaure UNIQUEMENT les entrées, PAS les résultats,
      // pour éviter d'afficher une synthèse au chargement de la page
      setRevenusNetMensuels(saved.revenusNetMensuels ?? 4000);
      setAutresRevenusMensuels(saved.autresRevenusMensuels ?? 0);
      setChargesMensuellesHorsCredits(
        saved.chargesMensuellesHorsCredits ?? 0
      );
      setTauxEndettementCible(saved.tauxEndettementCible ?? 35);

      setNbCredits(saved.nbCredits ?? 0);
      setTypesCredits(saved.typesCredits ?? []);
      setMensualitesCredits(saved.mensualitesCredits ?? []);
      setResteAnneesCredits(saved.resteAnneesCredits ?? []);
      setTauxCredits(saved.tauxCredits ?? []);
      setRevenusLocatifs(saved.revenusLocatifs ?? []);

      setTauxCreditCible(saved.tauxCreditCible ?? 3.5);
      setDureeCreditCible(saved.dureeCreditCible ?? 25);

      // ❌ NE PAS restaurer :
      // resumeCapacite, resultCapaciteTexte, bankability*, actionPlanText
    } catch (e) {
      console.error("Erreur de restauration de la simulation capacité :", e);
    }
  }, []);

  const handleSaveProject = async () => {
    if (!showSaveButton) return;
    if (!resumeCapacite) return;
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
          window.location.href = "/mon-compte?redirect=/projets";
        }
        return;
      }

      const { error } = await supabase.from("projects").insert({
        user_id: session.user.id,
        type: "capacite",
        title: "Simulation capacité d'emprunt",
        data: {
          resume: resumeCapacite,
          texte: resultCapaciteTexte,
          bankability: bankabilityScore
            ? {
                score: bankabilityScore,
                label: bankabilityLabel,
                comment: bankabilityComment,
              }
            : null,
          actionPlan: actionPlanText || null,
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

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, idx) => (
      <p key={idx} className="text-[0.75rem] text-slate-700 leading-relaxed">
        {line}
      </p>
    ));

  const scoreColor =
    bankabilityScore === null
      ? "text-slate-900"
      : bankabilityScore >= 80
      ? "text-emerald-700"
      : bankabilityScore >= 60
      ? "text-amber-600"
      : "text-red-600";

  // --------- UI du wizard + résultats ----------
  return (
    <div className="space-y-6">
      {/* Wizard */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 sm:p-6 space-y-5">
        {/* Stepper */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            {[
              "Revenus",
              "Charges & crédits",
              "Détail des crédits",
              "Paramètres du prêt",
            ].map((label, index) => {
              const num = index + 1;
              const active = step === num;
              const done = step > num;
              return (
                <div key={num} className="flex items-center gap-2">
                  <div
                    className={
                      "flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-semibold " +
                      (active
                        ? "bg-slate-900 text-white"
                        : done
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 text-slate-700")
                    }
                  >
                    {num}
                  </div>
                  <span
                    className={
                      "hidden sm:inline text-[0.7rem] " +
                      (active
                        ? "text-slate-900 font-semibold"
                        : "text-slate-500")
                    }
                  >
                    {label}
                  </span>
                  {num < TOTAL_STEPS && (
                    <span className="hidden sm:inline h-px w-6 bg-slate-200" />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[0.7rem] text-slate-500">
            Étape {step} / {TOTAL_STEPS}
          </p>
        </div>

        {/* Contenu de l’étape */}
        <div className="border border-slate-100 rounded-xl bg-slate-50/70 p-4 space-y-3">
          {step === 1 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">
                Revenus du foyer
              </h2>
              <p className="text-[0.75rem] text-slate-600">
                Indiquez vos revenus réguliers. Les éventuels revenus locatifs
                seront pris en compte via vos prêts immobiliers locatifs
                (70&nbsp;% du loyer).
              </p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Revenus nets du foyer (€/mois)
                  </label>
                  <input
                    type="number"
                    value={revenusNetMensuels}
                    onChange={(e) =>
                      setRevenusNetMensuels(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Autres revenus (pensions, primes récurrentes, etc.) (€/mois)
                  </label>
                  <input
                    type="number"
                    value={autresRevenusMensuels}
                    onChange={(e) =>
                      setAutresRevenusMensuels(
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">
                Charges courantes & crédits en cours
              </h2>
              <p className="text-[0.75rem] text-slate-600">
                On recense vos charges fixes hors crédits puis le nombre de
                crédits en cours (immo, conso, auto…).
              </p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Autres charges mensuelles hors crédits (pensions, aide a
                    domicile, etc.) (€/mois)
                  </label>
                  <input
                    type="number"
                    value={chargesMensuellesHorsCredits}
                    onChange={(e) =>
                      setChargesMensuellesHorsCredits(
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Nombre de crédits en cours
                    <InfoBadge text="Incluez prêts immo, auto, conso… Les prêts immo locatifs permettent d'intégrer 70 % du loyer en face." />
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={nbCredits}
                    onChange={(e) =>
                      handleNbCreditsChange(
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">
                Détail de vos crédits
              </h2>
              <p className="text-[0.75rem] text-slate-600">
                Pour chaque crédit, indiquez la mensualité, la durée restante et
                le taux. Pour les prêts locatifs, ajoutez le loyer : 70&nbsp;%
                seront intégrés à vos revenus, comme en banque.
              </p>
              {nbCredits === 0 ? (
                <p className="text-[0.75rem] text-slate-500">
                  Vous n&apos;avez déclaré aucun crédit en cours à l&apos;étape
                  précédente. Vous pouvez passer à l&apos;étape suivante.
                </p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {Array.from({ length: nbCredits }).map((_, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 space-y-2"
                    >
                      <p className="text-[0.7rem] font-semibold text-slate-700">
                        Crédit #{index + 1}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700">
                            Type de crédit
                          </label>
                          <select
                            value={typesCredits[index] || "immo"}
                            onChange={(e) =>
                              handleTypeCreditChange(
                                index,
                                e.target.value as TypeCredit
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="immo">Crédit immobilier</option>
                            <option value="perso">Crédit personnel</option>
                            <option value="auto">Crédit auto</option>
                            <option value="conso">Crédit consommation</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700">
                            Mensualité (€/mois)
                          </label>
                          <input
                            type="number"
                            value={mensualitesCredits[index] || 0}
                            onChange={(e) =>
                              handleMensualiteChange(
                                index,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700">
                            Durée restante (années)
                          </label>
                          <input
                            type="number"
                            value={resteAnneesCredits[index] || 0}
                            onChange={(e) =>
                              handleResteAnneesChange(
                                index,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700">
                            Taux du crédit (%)
                          </label>
                          <input
                            type="number"
                            value={tauxCredits[index] || 0}
                            onChange={(e) =>
                              handleTauxCreditChange(
                                index,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        {typesCredits[index] === "immo" && (
                          <div className="space-y-1">
                            <label className="text-[0.7rem] text-slate-700">
                              Loyer associé (€/mois)
                            </label>
                            <input
                              type="number"
                              value={revenusLocatifs[index] || 0}
                              onChange={(e) =>
                                handleRevenuLocatifChange(
                                  index,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <p className="text-[0.65rem] text-slate-500">
                              70 % de ce loyer sera intégré à vos revenus.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">
                Paramètres du futur prêt
              </h2>
              <p className="text-[0.75rem] text-slate-600">
                Ajustez la durée, le taux et le taux d&apos;endettement cible pour
                estimer votre mensualité, le capital empruntable et un prix de
                bien.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[0.7rem] text-slate-700">
                    Taux du crédit (annuel, en %)
                  </label>
                  <input
                    type="number"
                    value={tauxCreditCible}
                    onChange={(e) =>
                      setTauxCreditCible(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[0.7rem] text-slate-700">
                    Durée du crédit (années)
                  </label>
                  <input
                    type="number"
                    value={dureeCreditCible}
                    onChange={(e) =>
                      setDureeCreditCible(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                    Taux d&apos;endettement cible (%)
                    <InfoBadge text="Les banques travaillent souvent autour de 33–35 %, parfois plus selon le profil et le patrimoine." />
                  </label>
                  <input
                    type="number"
                    value={tauxEndettementCible}
                    onChange={(e) =>
                      setTauxEndettementCible(
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Boutons navigation wizard */}
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
              onClick={goNext}
              className="rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCalculCapacite}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-[0.8rem] font-semibold text-white shadow-lg hover:shadow-2xl active:scale-[0.99]"
            >
              Calculer ma capacité d&apos;emprunt
            </button>
          )}
        </div>
      </section>

      {/* Résultats épurés */}
      <section
        id="resultats-capacite"
        className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600 mb-1">
              Résultats de votre simulation
            </p>
            <h2 className="text-sm font-semibold text-slate-900">
              Votre capacité d&apos;emprunt et votre budget indicatif
            </h2>
            <p className="text-[0.75rem] text-slate-600">
              Quelques indicateurs clés pour vous positionner sur votre projet.
            </p>
          </div>
          {hasResult && showSaveButton && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleSaveProject}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-full border border-emerald-500/80 bg-emerald-500 px-3 py-1.5 text-[0.7rem] font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? "Sauvegarde..." : "Sauvegarder dans mon espace"}
              </button>
              {saveMessage && (
                <p className="text-[0.65rem] text-slate-500 text-right max-w-[220px]">
                  {saveMessage}
                </p>
              )}
            </div>
          )}
        </div>

        {hasResult ? (
          <>
            {/* Cartes de synthèse + Score IA */}
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                  Mensualité max
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatEuro(resumeCapacite!.mensualiteMax)}
                </p>
                <p className="mt-1 text-[0.7rem] text-slate-500">
                  Capacité théorique sans dépasser le taux cible.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                  Capital empruntable
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatEuro(resumeCapacite!.montantMax)}
                </p>
                <p className="mt-1 text-[0.7rem] text-slate-500">
                  Sur {dureeCreditCible} ans à ~
                  {tauxCreditCible.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })}
                  %.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                  Prix de bien indicatif
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatEuro(resumeCapacite!.prixBienMax)}
                </p>
                <p className="mt-1 text-[0.7rem] text-slate-500">
                  Frais de notaire et agence inclus dans le financement.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                  Taux d&apos;endettement
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatPct(resumeCapacite!.tauxEndettementAvecProjet)}
                </p>
                <p className="mt-1 text-[0.7rem] text-slate-500">
                  Actuel : {formatPct(resumeCapacite!.tauxEndettementActuel)}
                </p>
              </div>

              {/* 🧠 Score de bancabilité IA */}
              {bankabilityScore !== null && (
                <div className="rounded-xl bg-slate-900 text-white px-3 py-2.5 sm:col-span-2">
                  <p className="text-[0.65rem] uppercase tracking-[0.14em] text-emerald-200">
                    Score de bancabilité (IA)
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className={`text-xl font-semibold ${scoreColor}`}>
                      {bankabilityScore}/100
                    </p>
                    <p className="text-[0.8rem] font-medium">
                      {bankabilityLabel}
                    </p>
                  </div>
                  <p className="mt-1 text-[0.7rem] text-slate-100">
                    {bankabilityComment}
                  </p>
                </div>
              )}
            </div>

            {/* 🧭 Plan d'action vers le financement (flouté si non connecté) */}
            {actionPlanText && (
              blurAnalysis ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-3 relative overflow-hidden">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                    Option 5 – Plan d&apos;action vers le financement
                  </p>
                  <div className="opacity-30 pointer-events-none">
                    {renderMultiline(actionPlanText)}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/70 to-white/90 pointer-events-none" />
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                    Option 5 – Plan d&apos;action vers le financement
                  </p>
                  {renderMultiline(actionPlanText)}
                </div>
              )
            )}

            {/* Analyse détaillée : floutée ou non selon blurAnalysis */}
            {blurAnalysis ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-3 relative overflow-hidden">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                  Analyse détaillée de votre dossier
                </p>
                <div className="opacity-30 pointer-events-none">
                  {renderMultiline(resultCapaciteTexte)}
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/70 to-white/90 pointer-events-none" />
              </div>
            ) : (
              <div className="mt-4 rounded- xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                  Analyse détaillée de votre dossier
                </p>
                {renderMultiline(resultCapaciteTexte)}
                <p className="mt-2 text-[0.65rem] text-slate-500">
                  Ces calculs sont fournis à titre indicatif et ne remplacent
                  pas une étude personnalisée par votre banque ou votre
                  courtier.
                </p>
              </div>
            )}

            {/* CTA unique quand flouté */}
            {blurAnalysis && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-[0.7rem] text-slate-700 max-w-xs">
                  Débloquez le plan d&apos;action complet et l&apos;analyse détaillée
                  de votre dossier dans votre espace personnel.
                </p>
                <a
                  href="/mon-compte?mode=register&redirect=/capacite"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[0.75rem] font-semibold text-white hover:bg-slate-800"
                >
                  Créer mon espace &amp; débloquer les analyses détaillées
                </a>
              </div>
            )}

            <p className="mt-2 text-[0.65rem] text-slate-500">
              Ces résultats sont indicatifs et ne constituent pas une offre de
              prêt. Seule une étude approfondie par un établissement bancaire ou
              un courtier permet d&apos;obtenir un accord ferme.
            </p>
          </>
        ) : (
          <p className="text-[0.8rem] text-slate-600">
            Complétez les 4 étapes de la calculette puis cliquez sur
            «&nbsp;Calculer ma capacité d&apos;emprunt&nbsp;» pour afficher ici
            votre mensualité maximale, le capital empruntable, un prix de bien
            indicatif, votre score de bancabilité IA et un plan d&apos;action
            vers le financement.
          </p>
        )}
      </section>
    </div>
  );
}
