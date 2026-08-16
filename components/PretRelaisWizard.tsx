// components/PretRelaisWizard.tsx
import { useEffect, useMemo, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  BanknotesIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  LightBulbIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import { supabase } from "../lib/supabaseClient";
import LeadGate from "./LeadGate";
import { useAgenceMode } from "../lib/useAgenceMode";
import CalculatorWizardShell from "./calculators/CalculatorWizardShell";

const PRET_RELAIS_STORAGE_KEY = "pret_relais_simulation_v2";

// ✅ persistance du déblocage (pour ne pas re-gater après un recalcul / reload)
const PRET_RELAIS_UNLOCK_KEY = "pret_relais_unlock_v1";

// ✅ NEW: persistance de l'email du lead (pour ne pas le redemander après navigation)
const PRET_RELAIS_EMAIL_KEY = "pret_relais_email_v1";

// ✅ même principe que la page Capacité : on ne score PAS sur une mensualité "max" pleine
const LOKT_MENSUALITE_BUFFER = 0.9;

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
  return val.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %";
}

// ✅ AJOUTE ÇA ICI
function onlyDigits(s: string) {
  return (s || "").replace(/[^\d]/g, "");
}

function toInt(v: string, fallback = 0) {
  const x = parseInt(v, 10);
  return Number.isFinite(x) ? x : fallback;
}

/** autorise chiffres + un seul séparateur "." (on remplace "," par ".") —
 * garde la valeur en texte pour ne pas perdre le "." ou "," en cours de
 * frappe (un number ne peut pas représenter "3," en attente du chiffre
 * suivant, donc le champ se réinitialisait à chaque frappe). */
function onlyNumberLike(s: string) {
  const cleaned = s.replace(",", ".").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return parts[0] + "." + parts.slice(1).join("");
}

function toFloat(v: string, fallback = 0) {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : fallback;
}

function parseEditableNumber(value: string) {
  if (value === "") return Number.NaN;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function editableNumberValue(value: number) {
  return Number.isNaN(value) ? "" : value;
}

function InfoBadge({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1 align-middle">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[0.6rem] font-semibold text-slate-500 cursor-help">
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[125%] z-20 hidden w-72 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-[0.7rem] text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

type ProStatus = "cdi" | "fonctionnaire" | "independant" | "retraite" | "autre";
type ProjectType = "ancien" | "neuf" | "terrain";

// ✅ DB constraints
type ProjectUsageDB = "residence_principale" | "residence_secondaire" | "investissement";
type ProjectTimelineDB = "0_3_mois" | "3_6_mois" | "6_12_mois" | "12_plus" | "juste_info";

type ResumeRelais = {
  montantRelais: number;
  mensualiteNouveauMax: number;
  capitalNouveau: number;
  budgetMax: number;

  // ✅ pour le Score lokt.fr™
  revenusPrisEnCompte: number;
  mensualitesExistantes: number;
  chargesHorsCredits: number;
  tauxEndettementActuel: number;
  tauxEndettementAvecProjet: number;
};

type BankabilityAssessment = {
  score: number;
  label: string;
  comment: string;
};

type ActionPlanItemType = "blocking" | "warning" | "positive" | "tip";
type ActionPlanItem = { type: ActionPlanItemType; title: string; body: string };

const ACTION_ITEM_CONFIG: Record<
  ActionPlanItemType,
  { Icon: ComponentType<SVGProps<SVGSVGElement>>; badge: string; bg: string; border: string; iconBg: string; iconText: string; titleText: string; badgeCls: string }
> = {
  blocking: { Icon: ExclamationTriangleIcon, badge: "Bloquant",     bg: "bg-red-50",     border: "border-red-200",     iconBg: "bg-red-100",     iconText: "text-red-600",     titleText: "text-red-900",     badgeCls: "bg-red-100 text-red-700" },
  warning:  { Icon: ExclamationCircleIcon,  badge: "A surveiller",  bg: "bg-amber-50",   border: "border-amber-200",   iconBg: "bg-amber-100",   iconText: "text-amber-600",   titleText: "text-amber-900",   badgeCls: "bg-amber-100 text-amber-700" },
  positive: { Icon: CheckCircleIcon,        badge: "Atout",         bg: "bg-emerald-50", border: "border-emerald-200", iconBg: "bg-emerald-100", iconText: "text-emerald-600", titleText: "text-emerald-900", badgeCls: "bg-emerald-100 text-emerald-700" },
  tip:      { Icon: LightBulbIcon,          badge: "Conseil",       bg: "bg-indigo-50",  border: "border-indigo-200",  iconBg: "bg-indigo-100",  iconText: "text-indigo-600",  titleText: "text-indigo-900",  badgeCls: "bg-indigo-100 text-indigo-700" },
};

function buildRelaisActionPlan(
  resume: ResumeRelais,
  assessment: BankabilityAssessment,
  tauxEndettementCible: number,
  ctx: {
    pctRetenu: number; tauxRelais: number; prixCible: number;
    timelineDb: ProjectTimelineDB; proStatus: ProStatus;
    ageEmprunteur: number; ageCoEmprunteur: number; nbAdultes: number; dureeNouveau: number;
    mensCreditLocatif: number; loyerLocatifPondere: number;
  }
): ActionPlanItem[] {
  const { pctRetenu, tauxRelais, prixCible, timelineDb, proStatus, ageEmprunteur, ageCoEmprunteur, nbAdultes, dureeNouveau, mensCreditLocatif, loyerLocatifPondere } = ctx;
  const items: ActionPlanItem[] = [];

  const depassement = resume.tauxEndettementAvecProjet - tauxEndettementCible;
  const marge = tauxEndettementCible - resume.tauxEndettementAvecProjet;
  const ageFin = ageEmprunteur > 0 ? ageEmprunteur + dureeNouveau : 0;
  const interetsRelaisMensuels = resume.montantRelais * (tauxRelais / 100) / 12;
  const margeVsPrixCible = prixCible > 0 ? resume.budgetMax - prixCible : null;

  // ── BLOCKING ───────────────────────────────────────────────────────
  if (resume.montantRelais === 0) {
    items.push({ type: "blocking", title: "Aucun relais disponible",
      body: `Le capital restant dû est supérieur ou égal à la valeur retenue par la banque (${pctRetenu}% de l'estimation). Il ne reste rien pour financer le relais. Leviers : réévaluer le bien à la hausse, réduire le CRD, ou augmenter le % retenu si la banque l'accepte.` });
  }
  if (margeVsPrixCible !== null && margeVsPrixCible < 0) {
    items.push({ type: "blocking", title: "Budget max insuffisant pour le prix visé",
      body: `Votre budget max est de ${formatEuro(resume.budgetMax)}, soit ${formatEuro(Math.abs(margeVsPrixCible))} en dessous du prix cible (${formatEuro(prixCible)}). Ce montage ne permet pas d'atteindre ce bien. Leviers : allonger la durée, augmenter l'apport, revoir le prix visé ou négocier le % retenu avec la banque.` });
  }

  // ── WARNINGS ───────────────────────────────────────────────────────
  if (pctRetenu > 85) {
    items.push({ type: "warning", title: "% retenu supérieur aux pratiques bancaires courantes",
      body: `Vous avez saisi ${pctRetenu}% de valeur retenue. La plupart des banques plafonnent entre 60 et 80% (rarement plus de 85%). Le montant du relais estimé ici est probablement optimiste — vérifiez ce taux avec votre banque avant de vous fier au budget max affiché.` });
  }
  if (tauxEndettementCible > 40) {
    items.push({ type: "warning", title: "Endettement cible au-dessus des standards HCSF",
      body: `Vous avez fixé une cible d'endettement à ${tauxEndettementCible}%, au-dessus des ~35% généralement admis (recommandation HCSF, dérogations possibles au cas par cas). Le budget affiché suppose que votre banque accepte ce dépassement — à confirmer avant de vous engager.` });
  }
  if (depassement > 2) {
    items.push({ type: "warning", title: "Endettement au-dessus de la cible bancaire",
      body: `Avec le projet, votre taux d'endettement atteint ~${formatPct(resume.tauxEndettementAvecProjet)}, soit ${formatPct(depassement)} au-dessus de la cible à ${tauxEndettementCible}%. Pour revenir dans les clous : allonger la durée du nouveau prêt, revoir le prix visé à la baisse, ou renforcer l'apport personnel.` });
  } else if (marge < 3 && marge >= 0) {
    items.push({ type: "warning", title: "Vous êtes à la limite — les détails comptent",
      body: `Votre taux projeté (~${formatPct(resume.tauxEndettementAvecProjet)}) frôle la cible de ${tauxEndettementCible}%. Dans cette configuration, la qualité du dossier est décisive : tenue de compte irréprochable, épargne résiduelle après projet, stabilité des revenus démontrée.` });
  }

  if (margeVsPrixCible !== null && margeVsPrixCible >= 0 && margeVsPrixCible < prixCible * 0.05) {
    items.push({ type: "warning", title: "Peu de marge entre budget max et prix visé",
      body: `Votre budget max dépasse le prix cible de seulement ${formatEuro(margeVsPrixCible)}. Si les frais de notaire, travaux ou une négociation vendeur s'ajoutent, le montage peut se fragiliser. Prévoyez une réserve ou revoyez légèrement le prix cible.` });
  }

  if (resume.montantRelais > 0 && resume.tauxEndettementActuel > 20) {
    items.push({ type: "warning", title: "Endettement actuel déjà élevé avant projet",
      body: `Avant même le projet, vos charges représentent ~${formatPct(resume.tauxEndettementActuel)} de vos revenus. Les banques analysent ce ratio de base pour juger votre gestion habituelle — un endettement pré-projet élevé peut alerter l'analyste crédit.` });
  }

  if (proStatus === "independant") {
    items.push({ type: "warning", title: "Statut indépendant — anticipez le dossier",
      body: `Les banques exigent les 3 derniers bilans ou déclarations + avis d'imposition. Des revenus en progression régulière sur 3 ans sont le signal le plus fort. Rassemblez ces pièces maintenant et faites valider votre dossier par un courtier avant de prospecter.` });
  }

  if (ageFin > 0 && ageFin > 80) {
    items.push({ type: "warning", title: "Âge en fin de prêt à surveiller",
      body: `Avec une durée de ${dureeNouveau} ans, vous auriez ~${ageFin} ans à l'échéance. Certaines banques ou assureurs plafonnent à 75-80 ans ou appliquent une surprime. Une durée plus courte peut être plus bankable, même si la mensualité augmente.` });
  }

  // ── POSITIFS ───────────────────────────────────────────────────────
  if (marge >= 5) {
    items.push({ type: "positive", title: "Bonne marge d'endettement",
      body: `Votre taux projeté (~${formatPct(resume.tauxEndettementAvecProjet)}) reste ${formatPct(marge)} sous la cible. La banque dispose d'une marge de sécurité confortable. Concentrez-vous sur la qualité de présentation du dossier plutôt que sur les chiffres.` });
  }

  if (resume.montantRelais > 0 && resume.budgetMax > 0 && resume.montantRelais / resume.budgetMax >= 0.35) {
    const pctRelais = Math.round((resume.montantRelais / resume.budgetMax) * 100);
    items.push({ type: "positive", title: "Le relais couvre une bonne part du financement",
      body: `Le prêt relais (${formatEuro(resume.montantRelais)}) représente ${pctRelais}% de votre budget total. Cela réduit significativement le capital du nouveau prêt et donc la pression sur votre taux d'endettement à long terme.` });
  }

  if (margeVsPrixCible !== null && margeVsPrixCible >= prixCible * 0.10) {
    items.push({ type: "positive", title: "Budget max largement au-dessus du prix visé",
      body: `Vous disposez de ${formatEuro(margeVsPrixCible)} de marge au-dessus du prix cible. Vous pouvez négocier sereinement, intégrer des travaux ou viser un bien légèrement plus grand sans compromettre le montage.` });
  }

  // ── CONSEILS ───────────────────────────────────────────────────────
  if (timelineDb === "0_3_mois" || timelineDb === "3_6_mois") {
    items.push({ type: "tip", title: "Projet imminent — sécurisez le montage avant de signer",
      body: `Avec un horizon aussi court, ne signez pas de compromis sans confirmation bancaire sur le relais. Consultez un courtier pour une pré-validation : durée du relais, % retenu accepté par la banque, et conditions de sortie du crédit-relais à la vente.` });
  }

  if (interetsRelaisMensuels > 100) {
    const interetsAnnuels = Math.round(interetsRelaisMensuels * 12);
    items.push({ type: "tip", title: "Anticipez les intérêts intercalaires du relais",
      body: `Pendant la période entre l'achat et la vente, le relais génère ~${formatEuro(Math.round(interetsRelaisMensuels))}/mois d'intérêts, soit ${formatEuro(interetsAnnuels)}/an (taux ${formatPct(tauxRelais)}). Ce coût n'est pas inclus dans la mensualité simulée — intégrez-le dans votre budget de trésorerie.` });
  }

  if (pctRetenu < 75 && resume.montantRelais > 0 && resume.montantRelais < resume.budgetMax * 0.30) {
    items.push({ type: "tip", title: "Négocier un % retenu plus élevé augmenterait le relais",
      body: `Vous avez saisi ${pctRetenu}% de valeur retenue. Certains établissements acceptent jusqu'à 75-80%. Chaque point supplémentaire augmente le montant du relais et donc votre budget d'achat — demandez à votre banquier sa marge de manœuvre.` });
  }

  if (ageCoEmprunteur === 0 && nbAdultes <= 1 && assessment.score < 75) {
    items.push({ type: "tip", title: "Un co-emprunteur pourrait changer la donne",
      body: `Vous simulez seul. Intégrer un co-emprunteur cumule les revenus, réduit le taux d'endettement projeté, et rassure la banque sur le risque global. C'est l'un des leviers les plus puissants pour améliorer la solidité du dossier.` });
  }

  if (mensCreditLocatif > 0 && loyerLocatifPondere === 0) {
    items.push({ type: "tip", title: "Renseignez le loyer perçu sur votre bien locatif",
      body: `Vous avez indiqué ${formatEuro(mensCreditLocatif)}/mois de crédit immobilier locatif en cours, sans loyer perçu associé. Si ce bien est loué, ajoutez le loyer : 70% en seront intégrés à vos revenus (pratique bancaire courante), ce qui améliore votre taux d'endettement projeté.` });
  } else if (mensCreditLocatif > 0 && loyerLocatifPondere > 0) {
    items.push({ type: "positive", title: "Le loyer locatif compense une partie de ce crédit",
      body: `${formatEuro(loyerLocatifPondere)}/mois de revenu locatif (70% du loyer déclaré) sont intégrés à vos revenus pris en compte, ce qui allège d'autant le poids de votre crédit immobilier locatif existant dans le calcul.` });
  }

  return items;
}

/**
 * ⚠️ NE PAS MODIFIER : logique de score IA conservée telle quelle
 */
function computeBankabilityScore(
  resume: Pick<ResumeRelais, "tauxEndettementAvecProjet">,
  tauxEndettementCible: number
): BankabilityAssessment {
  const ratio = tauxEndettementCible > 0 ? resume.tauxEndettementAvecProjet / tauxEndettementCible : 1;

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

export type PretRelaisWizardProps = {
  showSaveButton?: boolean;
};

function safeEmail(v: string) {
  return (v || "").trim().toLowerCase();
}

export default function PretRelaisWizard(_props: PretRelaisWizardProps) {
  // ---------------------------
  // Session
  // ---------------------------
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

  // ---------------------------
  // Étapes (cliquables)
  // ---------------------------
  const [step, setStep] = useState<number>(1);
  const TOTAL_STEPS = 4;

  const goToStep = (n: number) => setStep(Math.min(Math.max(n, 1), TOTAL_STEPS));
  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

  const progressSteps = [
    { label: "Votre projet",        icon: HomeModernIcon },
    { label: "Profil & Revenus",    icon: UserGroupIcon },
    { label: "Bien actuel & Apport", icon: CreditCardIcon },
    { label: "Nouveau pret",        icon: AdjustmentsHorizontalIcon },
  ];

  // ---------------------------
  // Inputs — Projet
  // ---------------------------
  const [projectUsageDb, setProjectUsageDb] = useState<ProjectUsageDB>("residence_principale");
  const [timelineDb, setTimelineDb] = useState<ProjectTimelineDB>("3_6_mois");
  const [department, setDepartment] = useState<string>("");
  const [projectType, setProjectType] = useState<ProjectType>("ancien");

  // ---------------------------
  // Inputs — Profil
  // ---------------------------
  const [ageEmprunteur, setAgeEmprunteur] = useState<number>(35);
  const [ageCoEmprunteur, setAgeCoEmprunteur] = useState<number>(0);
  const [proStatus, setProStatus] = useState<ProStatus>("cdi");
  const [nbAdultes, setNbAdultes] = useState<number>(2);
  const [nbEnfants, setNbEnfants] = useState<number>(0);

  // ---------------------------
  // Inputs — Revenus
  // ---------------------------
  const [revMensuels, setRevMensuels] = useState<string>("4500");
  const [revError, setRevError] = useState<string | null>(null);

  // ---------------------------
  // Inputs — Charges & crédits (hors projet)
  // ---------------------------
  const [autresMensualites, setAutresMensualites] = useState(0);
  const [mensualiteCreditLocatif, setMensualiteCreditLocatif] = useState(0);
  const [loyerPercuLocatif, setLoyerPercuLocatif] = useState(0);
  // ✅ texte, pas number : permet de taper un "." ou "," sans que le champ
  // se réinitialise en cours de frappe (voir onlyNumberLike/toFloat).
  const [tauxEndettement, setTauxEndettement] = useState<string>("35");

  // ---------------------------
  // Inputs — Bien actuel à vendre
  // ---------------------------
  const [valeurBienActuel, setValeurBienActuel] = useState(400000);
  const [crdActuel, setCrdActuel] = useState(200000);
  const [pctRetenu, setPctRetenu] = useState<string>("70");
  const [tauxRelais, setTauxRelais] = useState<string>("4");

  // ---------------------------
  // Inputs — Nouveau projet
  // ---------------------------
  const [apportPerso, setApportPerso] = useState(30000);
  const [tauxNouveau, setTauxNouveau] = useState<string>("3.5");
  const [dureeNouveau, setDureeNouveau] = useState(25);
  const [prixCible, setPrixCible] = useState(450000);

  // ---------------------------
  // Résultats
  // ---------------------------
  const [resume, setResume] = useState<ResumeRelais | null>(null);
  const [texteDetail, setTexteDetail] = useState<string>("");
  const [actionItems, setActionItems] = useState<ActionPlanItem[]>([]);

  // ✅ Score lokt.fr™
  const [bankabilityScore, setBankabilityScore] = useState<number | null>(null);
  const [bankabilityLabel, setBankabilityLabel] = useState<string>("");
  const [bankabilityComment, setBankabilityComment] = useState<string>("");

  const hasResult = !!resume;

  useEffect(() => {
    if (!resume) return;
    const t = setTimeout(() => {
      document.getElementById("resultats-pret-relais")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(t);
  }, [resume]);

  // ---------------------------
  // Gate / lead
  // ---------------------------
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [leadPhone, setLeadPhone] = useState<string>("");
  const [consentLokt, setConsentLokt] = useState<boolean>(false);
  const [consentContact, setConsentContact] = useState<boolean>(false);
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);
  // ✅ Email (optionnel)
  const [sendByEmail, setSendByEmail] = useState<boolean>(true);
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [sendEmailMsg, setSendEmailMsg] = useState<string | null>(null);

  /**
   * ✅ NEW: restore leadEmail depuis
   * 1) sessionEmail (si connecté)
   * 2) localStorage (si déjà saisi auparavant)
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const fromSession = safeEmail(sessionEmail ?? "");
    const fromStorage = safeEmail(window.localStorage.getItem(PRET_RELAIS_EMAIL_KEY) ?? "");

    const nextEmail = fromSession || fromStorage;

    if (nextEmail && safeEmail(leadEmail) !== nextEmail) {
      setLeadEmail(nextEmail);
    }
  }, [sessionEmail]); // volontairement pas leadEmail en deps (évite loop)

  /**
   * ✅ NEW: persiste l'email dès qu'il est saisi/modifié (utile si user revient plus tard)
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const email = safeEmail(leadEmail);
    if (!email) return;
    window.localStorage.setItem(PRET_RELAIS_EMAIL_KEY, email);
  }, [leadEmail]);

  /**
   * ✅ Restore unlock si déjà unlocké pour cet email.
   * + invalide l'unlock si l'email change.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    // si user est loggé, pas besoin de gate
    if (isLoggedIn) {
      setUnlocked(true);
      return;
    }

    const currentEmail = safeEmail(leadEmail || sessionEmail || "");
    if (!currentEmail) {
      setUnlocked(false);
      return;
    }

    try {
      const raw = window.localStorage.getItem(PRET_RELAIS_UNLOCK_KEY);
      if (!raw) {
        setUnlocked(false);
        return;
      }

      const u = JSON.parse(raw);
      const savedEmail = safeEmail(u?.email || "");

      if (savedEmail && savedEmail === currentEmail) {
        setUnlocked(true);
        setConsentLokt(true);
      } else {
        setUnlocked(false);
      }
    } catch {
      setUnlocked(false);
    }
  }, [leadEmail, sessionEmail, isLoggedIn]);

  // ---------------------------
  // Helpers labels
  // ---------------------------
  const proStatusLabel = useMemo(() => {
    if (proStatus === "fonctionnaire") return "Fonctionnaire";
    if (proStatus === "independant") return "Indépendant / société";
    if (proStatus === "retraite") return "Retraité";
    if (proStatus === "autre") return "Autre";
    return "CDI";
  }, [proStatus]);

  const usageLabel = useMemo(() => {
    if (projectUsageDb === "residence_secondaire") return "Résidence secondaire";
    if (projectUsageDb === "investissement") return "Investissement locatif";
    return "Résidence principale";
  }, [projectUsageDb]);

  const timelineLabel = useMemo(() => {
    switch (timelineDb) {
      case "0_3_mois":
        return "0–3 mois";
      case "3_6_mois":
        return "3–6 mois";
      case "6_12_mois":
        return "6–12 mois";
      case "12_plus":
        return "12+ mois";
      default:
        return "Juste pour info";
    }
  }, [timelineDb]);

  const projectTypeLabel = useMemo(() => {
    if (projectType === "neuf") return "Neuf";
    if (projectType === "terrain") return "Terrain + construction";
    return "Ancien";
  }, [projectType]);

  const scoreColor =
    bankabilityScore === null
      ? "text-slate-900"
      : bankabilityScore >= 80
      ? "text-emerald-300"
      : bankabilityScore >= 60
      ? "text-amber-300"
      : "text-red-300";

  const loktScoreLabel = useMemo(() => {
    if (bankabilityScore === null) return "Score lokt.fr";
    if (bankabilityScore >= 85) return "Score lokt.fr — Très solide";
    // ✅ score=70 correspond à "Limite acceptable" (voir computeBankabilityScore) :
    // un seuil strict évite d'afficher "Solide" au-dessus d'un commentaire d'alerte.
    if (bankabilityScore > 70) return "Score lokt.fr — Solide";
    if (bankabilityScore >= 55) return "Score lokt.fr — À optimiser";
    return "Score lokt.fr — Sous tension";
  }, [bankabilityScore]);

  // ---------------------------
  // Calcul
  // ---------------------------
  const computeAll = () => {
    const revenusBase = toInt(revMensuels, 0);
    const mensCreditLocatif = mensualiteCreditLocatif || 0;
    // ✅ règle des 70% : le loyer perçu sur un bien déjà loué compense en partie
    // sa mensualité de crédit, comme en pratique bancaire (même logique que
    // la calculette Capacité d'emprunt).
    const loyerLocatifPondere = (loyerPercuLocatif || 0) * 0.7;
    const revenus = revenusBase + loyerLocatifPondere;
    const autresMens = (autresMensualites || 0) + mensCreditLocatif;
    // ✅ garde-fous : des valeurs saisies incohérentes (ex : % retenu à 500,
    // CRD négatif) ne doivent pas produire un relais/budget max silencieusement
    // absurde.
    const tauxEndettementNum = toFloat(tauxEndettement, 35);
    const pctRetenuNum = toFloat(pctRetenu, 70);
    const tauxRelaisNum = toFloat(tauxRelais, 4);
    const tauxNouveauNum = toFloat(tauxNouveau, 3.5);
    const endettementMax = Math.min(Math.max(tauxEndettementNum || 35, 1), 100) / 100;

    const valeur = valeurBienActuel || 0;
    const crd = Math.max(crdActuel || 0, 0);
    const pct = Math.min(Math.max(pctRetenuNum || 70, 0), 100) / 100;

    const apport = apportPerso || 0;
    const tNouveauAnnuel = (tauxNouveauNum || 0) / 100;
    const tNouveauMensuel = tNouveauAnnuel / 12;
    const nMois = (dureeNouveau || 0) * 12;

    if (revenus <= 0 || valeur <= 0 || nMois <= 0) {
  const msg =
    revenus <= 0
      ? "Revenus nets mensuels obligatoires (montant > 0). Avec 0€, la faisabilité bancaire est quasi nulle."
      : "Merci de renseigner des valeurs cohérentes (bien actuel, durée du nouveau crédit, etc.).";

  const resumeFail: ResumeRelais = {
    montantRelais: 0,
    mensualiteNouveauMax: 0,
    capitalNouveau: 0,
    budgetMax: (apportPerso || 0),
    revenusPrisEnCompte: revenus,
    mensualitesExistantes: autresMens,
    chargesHorsCredits: 0,
    tauxEndettementActuel: 0,
    tauxEndettementAvecProjet: 999, // volontairement "catastrophique"
  };

  const assessmentFail: BankabilityAssessment = revenus <= 0
    ? { score: 1, label: "Score quasi nul", comment: "Revenus = 0 : aucun financement bancaire viable." }
    : { score: 20, label: "Données incomplètes", comment: "Complétez les champs manquants pour une estimation fiable." };

  return { ok: false as const, resume: resumeFail, texte: msg, assessment: assessmentFail };
}

    const relaisBrut = valeur * pct;
    const montantRelais = Math.max(relaisBrut - crd, 0);

    const plafondEndettement = revenus * endettementMax;
    const mensualiteNouveauMax = plafondEndettement - autresMens;

    const mensualiteLokt = Math.max(mensualiteNouveauMax, 0) * LOKT_MENSUALITE_BUFFER;

    const tauxActuel = revenus > 0 ? (autresMens / revenus) * 100 : 0;
    const tauxAvecProjet = revenus > 0 ? ((autresMens + mensualiteLokt) / revenus) * 100 : 0;

    const header = `Projet : ${projectTypeLabel} — ${usageLabel} — horizon ${timelineLabel}.`;
    const depLine = department?.trim()
      ? `Département (zone de recherche) : ${department.trim()}.`
      : `Département (zone de recherche) : non renseigné.`;

    const profileLine = `Statut : ${proStatusLabel}. Foyer : ${nbAdultes} adulte(s)${
      nbEnfants > 0 ? `, ${nbEnfants} enfant(s)` : ""
    }.`;
    const age1 = Math.max(ageEmprunteur || 0, 0);
    const age2 = Math.max(ageCoEmprunteur || 0, 0);
    const ageLine =
      age1 > 0
        ? `Âge(s) déclaré(s) : emprunteur ${age1} an(s)${age2 > 0 ? `, co-emprunteur ${age2} an(s)` : ""}.`
        : `Âge(s) déclaré(s) : non renseigné.`;

    if (mensualiteNouveauMax <= 0) {
      const msg = [
        header,
        depLine,
        profileLine,
        ageLine,
        "",
        [
          "1) Revenus et endettement",
          `Revenus nets mensuels : ${formatEuro(revenusBase)}.`,
          ...(loyerLocatifPondere > 0
            ? [`Revenus pris en compte (dont 70 % du loyer locatif existant, ${formatEuro(loyerLocatifPondere)}) : ${formatEuro(revenus)}.`]
            : []),
          `Crédits à la consommation (auto, conso, etc.) : ${formatEuro(autresMensualites || 0)}.`,
          ...(mensCreditLocatif > 0
            ? [`Crédit immobilier locatif en cours : ${formatEuro(mensCreditLocatif)}/mois.`]
            : []),
          `Endettement cible : ${tauxEndettementNum.toFixed(0)} % → plafond ≈ ${formatEuro(plafondEndettement)}/mois.`,
          `Endettement actuel : ~${formatPct(tauxActuel)}.`,
        ].join("\n"),
        "",
        [
          "2) Capacité insuffisante pour un nouveau prêt",
          "En tenant compte de vos autres crédits, il ne reste aucune marge de mensualité disponible pour un nouveau prêt immobilier.",
          "Dans cette configuration, le montage doit être retravaillé (prix, durée, apport, crédits en cours…).",
        ].join("\n"),
        "",
        [
          "3) Pistes d'action",
          "• Réduire temporairement le projet (prix cible).",
          "• Augmenter l'apport si possible.",
          "• Ajuster la durée (dans la limite des pratiques bancaires).",
          "• Revoir les crédits existants (conso/auto) avant de relancer.",
          ...(mensCreditLocatif > 0
            ? [`• Vérifier le crédit immobilier locatif en cours (${formatEuro(mensCreditLocatif)}/mois) — un loyer perçu renseigné peut en compenser une partie (70% pris en compte).`]
            : []),
        ].join("\n"),
      ].join("\n");

      const resumeFail: ResumeRelais = {
        montantRelais,
        mensualiteNouveauMax: Math.max(mensualiteNouveauMax, 0),
        capitalNouveau: 0,
        budgetMax: montantRelais + apport,
        revenusPrisEnCompte: revenus,
        mensualitesExistantes: autresMens,
        chargesHorsCredits: 0,
        tauxEndettementActuel: tauxActuel,
        tauxEndettementAvecProjet: tauxAvecProjet,
      };

      const assessmentFail = computeBankabilityScore(resumeFail, tauxEndettementNum);

      return { ok: false as const, resume: resumeFail, texte: msg, assessment: assessmentFail };
    }

    // ✅ on calcule le capital empruntable sur la mensualité prudente (buffer
    // lokt.fr à 90%), pas sur le plafond théorique — sinon le budget max
    // affiché contredit le score/les conseils, qui eux supposent ce buffer.
    let capitalNouveau = 0;
    if (tNouveauMensuel === 0) {
      capitalNouveau = mensualiteLokt * nMois;
    } else {
      const facteur = Math.pow(1 + tNouveauMensuel, nMois);
      capitalNouveau = mensualiteLokt * ((facteur - 1) / (tNouveauMensuel * facteur));
    }

    const budgetMax = montantRelais + capitalNouveau + apport;

    const message = [
      header,
      depLine,
      profileLine,
      ageLine,
      "",
      [
        "1) Revenus et endettement",
        `Revenus nets mensuels : ${formatEuro(revenusBase)}.`,
        ...(loyerLocatifPondere > 0
          ? [`Revenus pris en compte (dont 70 % du loyer locatif existant, ${formatEuro(loyerLocatifPondere)}) : ${formatEuro(revenus)}.`]
          : []),
        `Crédits à la consommation (auto, conso, etc.) : ${formatEuro(autresMensualites || 0)}.`,
        ...(mensCreditLocatif > 0
          ? [`Crédit immobilier locatif en cours : ${formatEuro(mensCreditLocatif)}/mois.`]
          : []),
        `Endettement cible : ${tauxEndettementNum.toFixed(0)} % → plafond ≈ ${formatEuro(plafondEndettement)}/mois.`,
        `Mensualité disponible (plafond théorique) : ${formatEuro(mensualiteNouveauMax)}.`,
        `Lecture lokt.fr (prudente) : on ne retient que ~${Math.round(LOKT_MENSUALITE_BUFFER * 100)}% de cette mensualité (${formatEuro(mensualiteLokt)}) pour estimer le capital empruntable et l'endettement projeté — une marge de sécurité pour le passage en banque.`,
        `Endettement actuel : ~${formatPct(tauxActuel)} ; endettement projeté (lokt.fr) : ~${formatPct(tauxAvecProjet)}.`,
      ].join("\n"),
      "",
      [
        "2) Estimation du prêt relais",
        `Valeur estimée du bien actuel : ${formatEuro(valeur)}.`,
        `Capital restant dû : ${formatEuro(crd)}.`,
        `Part retenue par la banque : ${pctRetenuNum.toFixed(0)} %.`,
        `Montant théorique du prêt relais : ${formatEuro(montantRelais)}.`,
        `Taux indicatif relais : ${formatPct(tauxRelaisNum)} (coût non intégré dans la capacité).`,
      ].join("\n"),
      "",
      [
        "3) Nouveau prêt immobilier",
        `Sur ${dureeNouveau.toFixed(0)} ans à ${formatPct(tauxNouveauNum)}, sur la base de la mensualité prudente lokt.fr, capital empruntable ≈ ${formatEuro(capitalNouveau)}.`,
      ].join("\n"),
      "",
      [
        "4) Budget d'achat total estimé",
        `Apport (${formatEuro(apport)}) + relais (${formatEuro(montantRelais)}) + nouveau prêt (${formatEuro(
          capitalNouveau
        )}) ⇒ budget max ≈ ${formatEuro(budgetMax)}.`,
        prixCible > 0 ? `Comparaison : bien visé à ${formatEuro(prixCible)}.` : "Prix cible non renseigné.",
      ].join("\n"),
      "",
      [
        "5) À garder en tête",
        "Calcul indicatif : chaque banque applique ses propres règles (assurance, franchise, durée du relais, intérêts intercalaires, etc.).",
      ].join("\n"),
    ].join("\n");

    const resumeOk: ResumeRelais = {
      montantRelais,
      mensualiteNouveauMax,
      capitalNouveau,
      budgetMax,
      revenusPrisEnCompte: revenus,
      mensualitesExistantes: autresMens,
      chargesHorsCredits: 0,
      tauxEndettementActuel: tauxActuel,
      tauxEndettementAvecProjet: tauxAvecProjet,
    };

    const assessment = computeBankabilityScore(resumeOk, tauxEndettementNum);

    return { ok: true as const, resume: resumeOk, texte: message, assessment };
  };

  const handleCalculRelais = () => {
    setUnlockMsg(null);

    const computed = computeAll();
    setResume(computed.resume);
    setTexteDetail(computed.texte);

    setBankabilityScore(computed.assessment?.score ?? null);
    setBankabilityLabel(computed.assessment?.label ?? "");
    setBankabilityComment(computed.assessment?.comment ?? "");

    const items = buildRelaisActionPlan(computed.resume, computed.assessment, toFloat(tauxEndettement, 35), {
      pctRetenu: toFloat(pctRetenu, 70), tauxRelais: toFloat(tauxRelais, 4), prixCible, timelineDb, proStatus,
      ageEmprunteur, ageCoEmprunteur, nbAdultes, dureeNouveau,
      mensCreditLocatif: mensualiteCreditLocatif || 0,
      loyerLocatifPondere: (loyerPercuLocatif || 0) * 0.7,
    });
    setActionItems(items);

    if (typeof window !== "undefined") {
      const payload = {
        projectUsageDb,
        timelineDb,
        department,
        projectType,
        ageEmprunteur,
        ageCoEmprunteur,
        proStatus,
        nbAdultes,
        nbEnfants,
        revMensuels,
        autresMensualites,
        mensualiteCreditLocatif,
        loyerPercuLocatif,
        tauxEndettement,
        valeurBienActuel,
        crdActuel,
        pctRetenu,
        tauxRelais,
        apportPerso,
        tauxNouveau,
        dureeNouveau,
        prixCible,
      };
      window.localStorage.setItem(PRET_RELAIS_STORAGE_KEY, JSON.stringify(payload));
    }

    // ✅ ne pas relocker ici
  };

  // ---------------------------
  // Restore inputs
  // ---------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PRET_RELAIS_STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);

      setProjectUsageDb(saved.projectUsageDb ?? "residence_principale");
      setTimelineDb(saved.timelineDb ?? "3_6_mois");
      setDepartment(saved.department ?? "");
      setProjectType(saved.projectType ?? "ancien");

      setAgeEmprunteur(saved.ageEmprunteur ?? 35);
      setAgeCoEmprunteur(saved.ageCoEmprunteur ?? 0);
      setProStatus(saved.proStatus ?? "cdi");
      setNbAdultes(saved.nbAdultes ?? 2);
      setNbEnfants(saved.nbEnfants ?? 0);

      setRevMensuels(saved.revMensuels !== undefined ? String(saved.revMensuels) : "4500");
      setAutresMensualites(saved.autresMensualites ?? 0);
      setMensualiteCreditLocatif(saved.mensualiteCreditLocatif ?? 0);
      setLoyerPercuLocatif(saved.loyerPercuLocatif ?? 0);
      setTauxEndettement(saved.tauxEndettement !== undefined ? String(saved.tauxEndettement) : "35");

      setValeurBienActuel(saved.valeurBienActuel ?? 400000);
      setCrdActuel(saved.crdActuel ?? 200000);
      setPctRetenu(saved.pctRetenu !== undefined ? String(saved.pctRetenu) : "70");
      setTauxRelais(saved.tauxRelais !== undefined ? String(saved.tauxRelais) : "4");

      setApportPerso(saved.apportPerso ?? 30000);
      setTauxNouveau(saved.tauxNouveau !== undefined ? String(saved.tauxNouveau) : "3.5");
      setDureeNouveau(saved.dureeNouveau ?? 25);
      setPrixCible(saved.prixCible ?? 450000);

      setUnlockMsg(null);
      setBankabilityScore(null);
      setBankabilityLabel("");
      setBankabilityComment("");
    } catch {
      // silence
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------
  // Capture lead via RPC (RLS-safe)
  // ---------------------------
  const capturePretRelaisViaRpc = async () => {
    if (!supabase) throw new Error("Supabase non configuré.");

    const email = safeEmail(leadEmail);
    if (!email || !email.includes("@")) throw new Error("Email invalide.");
    if (!resume || !texteDetail) throw new Error("Aucun résultat à enregistrer.");

    const budgetTarget = Math.round(resume.budgetMax || 0) || null;

    const tracking =
      typeof window !== "undefined"
        ? {
            utm: null,
            path: window.location?.pathname ?? null,
            source: "internal",
            referrer: document?.referrer ?? null,
            createdAtClient: new Date().toISOString(),
          }
        : {
            utm: null,
            path: null,
            source: "internal",
            referrer: null,
            createdAtClient: new Date().toISOString(),
          };

    const payload = {
      meta: { tool: "pret-relais", version: "v2_score_lokt_fix_buffer_unlock_email_persist" },
      user: { email: sessionEmail ?? null, user_id: sessionUserId ?? null },
      project: {
        usage_db: projectUsageDb,
        timeline_db: timelineDb,
        department: (department || "").trim() || null,
        projectType,
      },
      profile: {
        proStatus,
        nbAdultes,
        nbEnfants,
        ageEmprunteur,
        ageCoEmprunteur: ageCoEmprunteur || null,
      },
      input: {
        revMensuels,
        autresMensualites,
        mensualiteCreditLocatif,
        loyerPercuLocatif,
        tauxEndettement,
        valeurBienActuel,
        crdActuel,
        pctRetenu,
        tauxRelais,
        apportPerso,
        tauxNouveau,
        dureeNouveau,
        prixCible,
      },
      output: {
        resume,
        texte: texteDetail,
        bankability:
          bankabilityScore !== null ? { score: bankabilityScore, label: bankabilityLabel, comment: bankabilityComment } : null,
      },
      consent: { consent_analysis: true, consent_contact: consentContact },
      tracking,
    };

    const { error } = await supabase.rpc("upsert_lead_v1", {
      p_tool: "pret-relais",
      p_email: email,
      p_payload: payload,

      p_postal_code: null,
      p_city: null,
      p_phone: leadPhone.trim() || null,

      p_source: "pret_relais_wizard",
      p_utm: null,

      p_lead_age: ageEmprunteur || null,
      p_project_property_kind: projectType || null,
      p_project_usage: projectUsageDb || null,
      p_project_timeline: timelineDb || null,
      p_project_budget_target: budgetTarget,
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[rpc upsert_lead_v1] error:", error);
      throw new Error(error.message || "Erreur RPC");
    }
  };
function buildEmailComputed() {
  return {
    meta: { tool: "pret-relais", version: "v2_email" },
    inputs: {
      projectUsageDb,
      timelineDb,
      department,
      projectType,
      ageEmprunteur,
      ageCoEmprunteur,
      proStatus,
      nbAdultes,
      nbEnfants,
      revMensuels,
      autresMensualites,
      mensualiteCreditLocatif,
      loyerPercuLocatif,
      tauxEndettement,
      valeurBienActuel,
      crdActuel,
      pctRetenu,
      tauxRelais,
      apportPerso,
      tauxNouveau,
      dureeNouveau,
      prixCible,
    },
    output: {
      resume,
      texteDetail,
      bankability:
        bankabilityScore !== null
          ? { score: bankabilityScore, label: bankabilityLabel, comment: bankabilityComment }
          : null,
    },
  };
}

async function sendPretRelaisEmail(email: string) {
  setSendEmailMsg(null);
  setSendingEmail(true);

  try {
    if (!resume || !texteDetail) throw new Error("result_missing");

    const computed = buildEmailComputed();

    const r = await fetch("/api/tools/pret-relais/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        computed,
      }),
    });

    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.ok) {
      throw new Error(data?.error || "email_failed");
    }

    setSendEmailMsg("✅ Email envoyé (pensez à vérifier les spams).");
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

    if (!resume || !texteDetail) {
      setUnlockMsg("Calculez d'abord votre simulation avant de débloquer l'analyse.");
      return;
    }

    const email = safeEmail(leadEmail);
    if (!email || !email.includes("@")) {
      setUnlockMsg("Merci de renseigner une adresse e-mail valide.");
      return;
    }

    setUnlocking(true);
    try {
      await capturePretRelaisViaRpc();
      setUnlocked(true);
      setUnlockMsg("✅ Rapport prêt. Votre simulation est bien enregistrée.");
if (sendByEmail) {
  await sendPretRelaisEmail(email);
}

      // ✅ persiste unlock + email (pour navigation/reload)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PRET_RELAIS_EMAIL_KEY, email);
        const unlockPayload = { email, unlockedAt: new Date().toISOString() };
        window.localStorage.setItem(PRET_RELAIS_UNLOCK_KEY, JSON.stringify(unlockPayload));
      }
    } catch (e: any) {
      setUnlockMsg("❌ Impossible d'enregistrer la simulation : " + (e?.message || "erreur inconnue"));
    } finally {
      setUnlocking(false);
    }
  };

  const isAgence = useAgenceMode();
  const canShowFullAnalysis = useMemo(() => isLoggedIn || unlocked || isAgence, [isLoggedIn, unlocked, isAgence]);

  const labelBase = "text-xs text-slate-700 leading-tight min-h-[2.25rem] flex items-center gap-1";

const renderAnalysisBlocks = (text: string) => {
  if (!text) return null;

  const sections = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return (
    <div className="space-y-3">
      {sections.map((section, idx) => {
        const lines = section
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (!lines.length) return null;

        const title = lines[0];
        const body = lines.slice(1);

        return (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3">
            <p className="text-[0.75rem] font-semibold text-slate-900 mb-1">{title}</p>
            {body.map((line, i) => (
              <p key={i} className="text-[0.8rem] text-slate-700 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
};


  // ---------------------------
  // UI
  // ---------------------------

  return (
    <div className="space-y-6">
      {/* Wizard */}
      <CalculatorWizardShell
        steps={progressSteps}
        currentIndex={step - 1}
        onStepClick={(index) => goToStep(index + 1)}
        title="Préparez votre achat avant la vente."
      >
        <div className="calculator-premium-form space-y-5">
        {/* Contenu */}
        <div className="space-y-3 rounded-[1.1rem] border border-slate-100 bg-slate-50/70 p-3 sm:rounded-xl sm:p-4">
          {/* --- (identique à ton UI : steps 1..5) --- */}
          {/* ✅ IMPORTANT : je n'ai pas modifié le contenu des steps pour éviter les régressions */}
          {/* Tu peux garder ton JSX tel quel ici (copie/colle depuis ton fichier actuel) */}
          {/* START: steps */}
          {step === 1 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Votre projet</h2>
              <p className="text-[0.75rem] text-slate-600">
                Quelques infos simples : elles permettent de qualifier votre besoin (et de produire une analyse utile).
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Usage du futur bien
                    <InfoBadge text="Cela aide à adapter l'analyse et les conseils (résidence principale, secondaire ou investissement)." />
                  </label>
                  <select
                    value={projectUsageDb}
                    onChange={(e) => setProjectUsageDb(e.target.value as ProjectUsageDB)}
                    className="calc-select w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="residence_principale">Résidence principale</option>
                    <option value="residence_secondaire">Résidence secondaire</option>
                    <option value="investissement">Investissement locatif</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Horizon d'achat
                    <InfoBadge text="Pour savoir si votre projet est imminent ou plutôt à moyen terme (cela change parfois l'approche)." />
                  </label>
                  <select
                    value={timelineDb}
                    onChange={(e) => setTimelineDb(e.target.value as ProjectTimelineDB)}
                    className="calc-select w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="0_3_mois">0–3 mois</option>
                    <option value="3_6_mois">3–6 mois</option>
                    <option value="6_12_mois">6–12 mois</option>
                    <option value="12_plus">12+ mois</option>
                    <option value="juste_info">Juste pour info</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Département (zone)
                    <InfoBadge text="Juste pour situer la zone de recherche (ex : 75, 78, 13). Pas besoin d'une adresse précise." />
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value.replace(/\s+/g, ""))}
                    placeholder="ex: 78"
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Nature du projet (frais)
                    <InfoBadge text="Les frais et le financement peuvent varier selon ancien / neuf / terrain + construction." />
                  </label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value as ProjectType)}
                    className="calc-select w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="ancien">Ancien</option>
                    <option value="neuf">Neuf</option>
                    <option value="terrain">Terrain + construction</option>
                  </select>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Résumé</p>
                  <p className="mt-1 text-[0.8rem] text-slate-800">
                    {usageLabel} — {projectTypeLabel} — horizon {timelineLabel}
                    {department?.trim() ? ` — dep. ${department.trim()}` : ""}
                  </p>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className={labelBase}>
                    Statut professionnel
                    <InfoBadge text="Le statut aide à interpréter la stabilité des revenus (ex : CDI, fonctionnaire, indépendant…)." />
                  </label>
                  <select value={proStatus} onChange={(e) => setProStatus(e.target.value as ProStatus)} className="calc-select w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500">
                    <option value="cdi">CDI</option>
                    <option value="fonctionnaire">Fonctionnaire</option>
                    <option value="independant">Indépendant / société</option>
                    <option value="retraite">Retraité</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelBase}>Âge emprunteur</label>
                  <input inputMode="decimal" min={18} max={95} value={editableNumberValue(ageEmprunteur)} onChange={(e) => setAgeEmprunteur(parseEditableNumber(e.target.value))} placeholder="ex: 38" className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                </div>
                <div className="space-y-1">
                  <label className={labelBase}>Âge co-emprunteur <span className="text-slate-400 font-normal">optionnel</span></label>
                  <input inputMode="decimal" min={0} max={95} value={editableNumberValue(ageCoEmprunteur)} onChange={(e) => setAgeCoEmprunteur(parseEditableNumber(e.target.value))} placeholder="si concerné" className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                </div>
              </div>

              <div className="grid items-end gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className={labelBase}>Revenus nets mensuels (€) *</label>
                  <input required inputMode="numeric" value={revMensuels} onChange={(e) => { setRevMensuels(onlyDigits(e.target.value)); setRevError(null); }} className={"w-full min-w-0 rounded-xl border bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 " + (revError ? "border-red-400 focus:ring-red-500" : "border-slate-300 focus:ring-amber-500")} aria-invalid={!!revError} />
                  {revError && <p className="text-[0.7rem] text-red-600">{revError}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Endettement cible (%)
                    <InfoBadge text="La part maximale de vos revenus que la banque accepte en mensualités (souvent 35%)." />
                  </label>
                  <input inputMode="decimal" value={tauxEndettement} onChange={(e) => setTauxEndettement(onlyNumberLike(e.target.value))} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Adultes dans le foyer</label>
                  <input inputMode="decimal" min={1} max={10} value={editableNumberValue(nbAdultes)} onChange={(e) => setNbAdultes(parseEditableNumber(e.target.value))} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Enfants à charge</label>
                  <input inputMode="decimal" min={0} max={10} value={editableNumberValue(nbEnfants)} onChange={(e) => setNbEnfants(parseEditableNumber(e.target.value))} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Crédits à la consommation (€ / mois)
                    <InfoBadge text="Crédits conso, auto, etc. — hors crédit immobilier locatif (renseigné séparément ci-dessous). Cela réduit la mensualité disponible pour le nouveau projet." />
                  </label>
                  <input
                    inputMode="decimal"
                    value={editableNumberValue(autresMensualites)}
                    onChange={(e) => setAutresMensualites(parseEditableNumber(e.target.value))}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Astuce</p>
                  <p className="mt-1 text-[0.8rem] text-slate-700">
                    Si la mensualité disponible est faible, le relais ne suffit pas : il faudra ajuster prix/durée/apport.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Crédit immobilier locatif en cours (€ / mois)
                    <InfoBadge text="Mensualité d'un crédit immobilier déjà en cours sur un bien loué (autre que celui mis en vente ci-dessous, le cas échéant)." />
                  </label>
                  <input
                    inputMode="decimal"
                    value={editableNumberValue(mensualiteCreditLocatif)}
                    onChange={(e) => setMensualiteCreditLocatif(parseEditableNumber(e.target.value))}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Loyer perçu sur ce bien (€ / mois)
                    <InfoBadge text="70 % de ce loyer sera intégré à vos revenus pour le calcul, comme le font la plupart des banques." />
                  </label>
                  <input
                    inputMode="decimal"
                    value={editableNumberValue(loyerPercuLocatif)}
                    onChange={(e) => setLoyerPercuLocatif(parseEditableNumber(e.target.value))}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 space-y-2">
                <p className="text-[0.75rem] font-semibold text-slate-900">Bien actuel à vendre</p>

                <div className="grid gap-3 sm:grid-cols-3 items-start">
                  <div className="space-y-1">
                    <label className={labelBase}>
                      Valeur estimée (€)
                      <InfoBadge text="Estimation du prix de vente de votre bien (approximation suffisante)." />
                    </label>
                    <input
                      inputMode="decimal"
                      value={editableNumberValue(valeurBienActuel)}
                      onChange={(e) => setValeurBienActuel(parseEditableNumber(e.target.value))}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>
                      Capital restant dû (€)
                      <InfoBadge text="Le montant qu'il vous reste à rembourser sur le prêt actuel (visible sur votre tableau d'amortissement)." />
                    </label>
                    <input
                      inputMode="decimal"
                      value={editableNumberValue(crdActuel)}
                      onChange={(e) => setCrdActuel(parseEditableNumber(e.target.value))}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>
                      % retenu par la banque
                      <InfoBadge text="La banque ne finance généralement qu'une partie de la valeur du bien (souvent 60 à 80%)." />
                    </label>
                    <input
                      inputMode="decimal"
                      value={pctRetenu}
                      onChange={(e) => setPctRetenu(onlyNumberLike(e.target.value))}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 items-start">
                  <div className="space-y-1">
                    <label className={labelBase}>
                      Taux relais (annuel, %)
                      <InfoBadge text="Taux indicatif du prêt relais. Il sert surtout à donner un ordre d'idée du coût." />
                    </label>
                    <input
                      inputMode="decimal"
                      value={tauxRelais}
                      onChange={(e) => setTauxRelais(onlyNumberLike(e.target.value))}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>
                      Apport personnel prévu (€)
                      <InfoBadge text="L'argent que vous apportez de votre poche (épargne, donation, revente, etc.)." />
                    </label>
                    <input
                      inputMode="decimal"
                      value={editableNumberValue(apportPerso)}
                      onChange={(e) => setApportPerso(parseEditableNumber(e.target.value))}
                      className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className={labelBase}>Taux du nouveau crédit (annuel, %)</label>
                  <input
                    inputMode="decimal"
                    value={tauxNouveau}
                    onChange={(e) => setTauxNouveau(onlyNumberLike(e.target.value))}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Durée du nouveau crédit (années)</label>
                  <input
                    inputMode="decimal"
                    value={editableNumberValue(dureeNouveau)}
                    onChange={(e) => setDureeNouveau(parseEditableNumber(e.target.value))}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>
                    Prix du bien visé (optionnel)
                    <InfoBadge text="Si vous avez un prix en tête, on le compare à votre budget max pour voir si c'est cohérent." />
                  </label>
                  <input
                    inputMode="decimal"
                    value={editableNumberValue(prixCible)}
                    onChange={(e) => setPrixCible(parseEditableNumber(e.target.value))}
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </>
          )}
          {/* END: steps */}
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 1}
            className="min-h-11 rounded-full border border-slate-200 bg-white px-4 text-[0.8rem] font-semibold text-slate-600 hover:text-slate-900 disabled:cursor-default disabled:opacity-40 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:text-[0.75rem]"
          >
            ← Précédent
          </button>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
                onClick={() => {
                  if (step === 2) {
                    const rn = toInt(revMensuels, 0);
                    if (!revMensuels || rn <= 0) {
                      setRevError("Revenus obligatoires (montant > 0).");
                      return;
                    }
                  }
                  setRevError(null);
                  goNext();
                }}
              className="min-h-11 rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCalculRelais}
              className="min-h-11 rounded-full bg-gradient-to-r from-amber-500 to-sky-500 px-4 py-2 text-[0.8rem] font-semibold text-white shadow-lg shadow-amber-300/40 hover:shadow-2xl hover:shadow-amber-300/60 active:scale-[0.99]"
            >
              Calculer mon budget avec prêt relais
            </button>
          )}
        </div>
        </div>
      </CalculatorWizardShell>

      {/* Résultats */}
      {hasResult && <section id="resultats-pret-relais" className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-700 mb-1">Résultats</p>
            <h2 className="text-sm font-semibold text-slate-900">Votre simulation prêt relais est calculée</h2>
            <p className="text-[0.75rem] text-slate-600">Entrez votre email pour débloquer les résultats et recevoir votre rapport complet.</p>
          </div>
        </div>

        {!hasResult ? (
          <p className="text-[0.8rem] text-slate-600">Complétez les étapes puis cliquez sur « Calculer ».</p>
        ) : (
          <>
            {/* Gate — affiché avant tout résultat */}
            {!canShowFullAnalysis ? (
              <LeadGate
                theme="cyan-amber"
                title="Débloquer votre simulation prêt relais"
                subtitle="Montant du relais, mensualité max, capital nouveau prêt, budget maximal, score de finançabilité et plan d'action — envoyés par email."
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

            {/* Résultats débloqués */}
            {canShowFullAnalysis ? (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Montant du relais</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(resume!.montantRelais)}</p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">Valeur × % − CRD.</p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Mensualité max</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(resume!.mensualiteNouveauMax)}</p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">Selon endettement cible.</p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Capital nouveau prêt</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(resume!.capitalNouveau)}</p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      {dureeNouveau} ans à ~{formatPct(toFloat(tauxNouveau, 3.5))}.
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Budget max</p>
                    <p className="mt-1 text-sm font-semibold text-amber-700">{formatEuro(resume!.budgetMax)}</p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">Relais + nouveau prêt + apport.</p>
                  </div>
                </div>

                {/* Score lokt.fr™ */}
                {bankabilityScore !== null ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-900 text-white px-3 py-2.5 sm:col-span-2">
                      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-cyan-200">{loktScoreLabel}</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <p className={`text-2xl font-semibold ${scoreColor}`}>{bankabilityScore}/100</p>
                        <p className="text-[0.85rem] font-medium text-white">{bankabilityLabel}</p>
                      </div>
                      <p className="mt-1 text-[0.75rem] text-slate-100">{bankabilityComment}</p>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 sm:col-span-2">
                      <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Comment c'est calculé</p>
                      <p className="mt-1 text-[0.75rem] text-slate-700">
                        Le score se base sur l'endettement projeté <span className="font-semibold">avec une marge de prudence</span>{" "}
                        (on retient ~{Math.round(LOKT_MENSUALITE_BUFFER * 100)}% de la mensualité disponible), pour éviter un score
                        "bloqué" au seuil cible.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Plan d'action lokt */}
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
          </>
        )}

        <p className="mt-3 text-[0.7rem] text-slate-500">Simulation indicative. Chaque banque applique ses propres règles.</p>
      </section>}
    </div>
  );
}
