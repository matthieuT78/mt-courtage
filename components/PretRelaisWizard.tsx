// components/PretRelaisWizard.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const PRET_RELAIS_STORAGE_KEY = "pret_relais_simulation_v2";

// ✅ persistance du déblocage (pour ne pas re-gater après un recalcul / reload)
const PRET_RELAIS_UNLOCK_KEY = "pret_relais_unlock_v1";

// ✅ NEW: persistance de l'email du lead (pour ne pas le redemander après navigation)
const PRET_RELAIS_EMAIL_KEY = "pret_relais_email_v1";

// ✅ même principe que la page Capacité : on ne score PAS sur une mensualité “max” pleine
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

  // ✅ pour le Score Lokt.fr™
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
  const TOTAL_STEPS = 5;

  const goToStep = (n: number) => setStep(Math.min(Math.max(n, 1), TOTAL_STEPS));
  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

  const STEP_LABELS = ["Votre projet", "Votre profil", "Vos revenus", "Charges & crédits", "Paramètres du prêt"];

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
  const [tauxEndettement, setTauxEndettement] = useState(35);

  // ---------------------------
  // Inputs — Bien actuel à vendre
  // ---------------------------
  const [valeurBienActuel, setValeurBienActuel] = useState(400000);
  const [crdActuel, setCrdActuel] = useState(200000);
  const [pctRetenu, setPctRetenu] = useState(70);
  const [tauxRelais, setTauxRelais] = useState(4);

  // ---------------------------
  // Inputs — Nouveau projet
  // ---------------------------
  const [apportPerso, setApportPerso] = useState(30000);
  const [tauxNouveau, setTauxNouveau] = useState(3.5);
  const [dureeNouveau, setDureeNouveau] = useState(25);
  const [prixCible, setPrixCible] = useState(450000);

  // ---------------------------
  // Résultats
  // ---------------------------
  const [resume, setResume] = useState<ResumeRelais | null>(null);
  const [texteDetail, setTexteDetail] = useState<string>("");

  // ✅ Score Lokt.fr™
  const [bankabilityScore, setBankabilityScore] = useState<number | null>(null);
  const [bankabilityLabel, setBankabilityLabel] = useState<string>("");
  const [bankabilityComment, setBankabilityComment] = useState<string>("");

  const hasResult = !!resume;

  // ---------------------------
  // Gate / lead
  // ---------------------------
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [consentLokt, setConsentLokt] = useState<boolean>(false);
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
    if (bankabilityScore === null) return "Score Lokt.fr";
    if (bankabilityScore >= 85) return "Score Lokt.fr — Très solide";
    if (bankabilityScore >= 70) return "Score Lokt.fr — Solide";
    if (bankabilityScore >= 55) return "Score Lokt.fr — À optimiser";
    return "Score Lokt.fr — Sous tension";
  }, [bankabilityScore]);

  // ---------------------------
  // Calcul
  // ---------------------------
  const computeAll = () => {
    const revenus = toInt(revMensuels, 0);
    const autresMens = autresMensualites || 0;
    const endettementMax = (tauxEndettement || 35) / 100;

    const valeur = valeurBienActuel || 0;
    const crd = crdActuel || 0;
    const pct = (pctRetenu || 70) / 100;

    const apport = apportPerso || 0;
    const tNouveauAnnuel = (tauxNouveau || 0) / 100;
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
    mensualitesExistantes: autresMensualites || 0,
    chargesHorsCredits: 0,
    tauxEndettementActuel: 0,
    tauxEndettementAvecProjet: 999, // volontairement “catastrophique”
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
          `Revenus nets mensuels : ${formatEuro(revenus)}.`,
          `Autres mensualités de crédits : ${formatEuro(autresMens)}.`,
          `Endettement cible : ${tauxEndettement.toFixed(0)} % → plafond ≈ ${formatEuro(plafondEndettement)}/mois.`,
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
          "3) Pistes d’action",
          "• Réduire temporairement le projet (prix cible).",
          "• Augmenter l’apport si possible.",
          "• Ajuster la durée (dans la limite des pratiques bancaires).",
          "• Revoir les crédits existants (conso/auto) avant de relancer.",
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

      const assessmentFail = computeBankabilityScore(resumeFail, tauxEndettement);

      return { ok: false as const, resume: resumeFail, texte: msg, assessment: assessmentFail };
    }

    let capitalNouveau = 0;
    if (tNouveauMensuel === 0) {
      capitalNouveau = mensualiteNouveauMax * nMois;
    } else {
      const facteur = Math.pow(1 + tNouveauMensuel, nMois);
      capitalNouveau = mensualiteNouveauMax * ((facteur - 1) / (tNouveauMensuel * facteur));
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
        `Revenus nets mensuels : ${formatEuro(revenus)}.`,
        `Autres mensualités de crédits : ${formatEuro(autresMens)}.`,
        `Endettement cible : ${tauxEndettement.toFixed(0)} % → plafond ≈ ${formatEuro(plafondEndettement)}/mois.`,
        `Mensualité disponible estimée : ${formatEuro(mensualiteNouveauMax)}.`,
        `Lecture Lokt (prudente) : on retient ~${Math.round(LOKT_MENSUALITE_BUFFER * 100)}% de la mensualité disponible pour estimer l’endettement projeté.`,
        `Endettement actuel : ~${formatPct(tauxActuel)} ; endettement projeté (Lokt) : ~${formatPct(tauxAvecProjet)}.`,
      ].join("\n"),
      "",
      [
        "2) Estimation du prêt relais",
        `Valeur estimée du bien actuel : ${formatEuro(valeur)}.`,
        `Capital restant dû : ${formatEuro(crd)}.`,
        `Part retenue par la banque : ${pctRetenu.toFixed(0)} %.`,
        `Montant théorique du prêt relais : ${formatEuro(montantRelais)}.`,
        `Taux indicatif relais : ${formatPct(tauxRelais)} (coût non intégré dans la capacité).`,
      ].join("\n"),
      "",
      [
        "3) Nouveau prêt immobilier",
        `Sur ${dureeNouveau.toFixed(0)} ans à ${formatPct(tauxNouveau)}, capital empruntable ≈ ${formatEuro(capitalNouveau)}.`,
      ].join("\n"),
      "",
      [
        "4) Budget d’achat total estimé",
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

    const assessment = computeBankabilityScore(resumeOk, tauxEndettement);

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

    const el = document.getElementById("resultats-pret-relais");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      setTauxEndettement(saved.tauxEndettement ?? 35);

      setValeurBienActuel(saved.valeurBienActuel ?? 400000);
      setCrdActuel(saved.crdActuel ?? 200000);
      setPctRetenu(saved.pctRetenu ?? 70);
      setTauxRelais(saved.tauxRelais ?? 4);

      setApportPerso(saved.apportPerso ?? 30000);
      setTauxNouveau(saved.tauxNouveau ?? 3.5);
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
      consent: { consent_analysis: true, consent_contact: false },
      tracking,
    };

    const { error } = await supabase.rpc("upsert_lead_v1", {
      p_tool: "pret-relais",
      p_email: email,
      p_payload: payload,

      p_postal_code: null,
      p_city: null,
      p_phone: null,

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
      setUnlockMsg("Calculez d’abord votre simulation avant de débloquer l’analyse.");
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

    setUnlocking(true);
    try {
      await capturePretRelaisViaRpc();
      setUnlocked(true);
      setUnlockMsg("✅ Analyse débloquée. (Votre simulation est bien enregistrée.)");
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
      setUnlockMsg("❌ Impossible d’enregistrer la simulation : " + (e?.message || "erreur inconnue"));
    } finally {
      setUnlocking(false);
    }
  };

  const canShowFullAnalysis = useMemo(() => isLoggedIn || unlocked, [isLoggedIn, unlocked]);

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
      <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 sm:p-6 space-y-5">
        {/* Stepper */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {STEP_LABELS.map((label, index) => {
                const num = index + 1;
                const active = step === num;
                const done = step > num;

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => goToStep(num)}
                    className={
                      "flex items-center gap-2 rounded-full px-2 py-1 transition " +
                      (active
                        ? "bg-slate-900 text-white"
                        : done
                        ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200")
                    }
                    aria-current={active ? "step" : undefined}
                  >
                    <span
                      className={
                        "flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-semibold " +
                        (active
                          ? "bg-white/15 text-white"
                          : done
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 text-slate-700")
                      }
                    >
                      {num}
                    </span>
                    <span className={"text-[0.75rem] whitespace-nowrap " + (active ? "font-semibold" : "")}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[0.7rem] text-slate-500 whitespace-nowrap">
            Étape {step} / {TOTAL_STEPS}
          </p>
        </div>

        {/* Contenu */}
        <div className="border border-slate-100 rounded-xl bg-slate-50/70 p-4 space-y-3">
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
                    <InfoBadge text="Cela aide à adapter l’analyse et les conseils (résidence principale, secondaire ou investissement)." />
                  </label>
                  <select
                    value={projectUsageDb}
                    onChange={(e) => setProjectUsageDb(e.target.value as ProjectUsageDB)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="residence_principale">Résidence principale</option>
                    <option value="residence_secondaire">Résidence secondaire</option>
                    <option value="investissement">Investissement locatif</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Horizon d’achat
                    <InfoBadge text="Pour savoir si votre projet est imminent ou plutôt à moyen terme (cela change parfois l’approche)." />
                  </label>
                  <select
                    value={timelineDb}
                    onChange={(e) => setTimelineDb(e.target.value as ProjectTimelineDB)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                    <InfoBadge text="Juste pour situer la zone de recherche (ex : 75, 78, 13). Pas besoin d’une adresse précise." />
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value.replace(/\s+/g, ""))}
                    placeholder="ex: 78"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
              <h2 className="text-sm font-semibold text-slate-900">Votre profil</h2>
              <p className="text-[0.75rem] text-slate-600">
                Ces infos aident à contextualiser (durée, stabilité, reste à vivre).
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className={labelBase}>
                    Statut principal
                    <InfoBadge text="Le statut aide à interpréter la stabilité des revenus (ex : CDI, fonctionnaire, indépendant…)." />
                  </label>
                  <select
                    value={proStatus}
                    onChange={(e) => setProStatus(e.target.value as ProStatus)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="cdi">CDI</option>
                    <option value="fonctionnaire">Fonctionnaire</option>
                    <option value="independant">Indépendant / société</option>
                    <option value="retraite">Retraité</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Âge emprunteur (ans)</label>
                  <input
                    type="number"
                    min={18}
                    max={95}
                    value={ageEmprunteur}
                    onChange={(e) => setAgeEmprunteur(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Âge co-emprunteur (optionnel)</label>
                  <input
                    type="number"
                    min={0}
                    max={95}
                    value={ageCoEmprunteur}
                    onChange={(e) => setAgeCoEmprunteur(parseFloat(e.target.value) || 0)}
                    placeholder="0 = non renseigné"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Adultes dans le foyer</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={nbAdultes}
                    onChange={(e) => setNbAdultes(parseFloat(e.target.value) || 1)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Enfants à charge</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={nbEnfants}
                    onChange={(e) => setNbEnfants(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Vos revenus</h2>
              <p className="text-[0.75rem] text-slate-600">
                On estime la mensualité disponible pour le nouveau prêt à partir de vos revenus.
              </p>

              <div className="space-y-2">
                <div className="space-y-1">
                  <label className={labelBase}>Revenus nets mensuels du foyer (€)</label>
                  <input
                    required
                    inputMode="numeric"
                    value={revMensuels}
                    onChange={(e) => {
                      setRevMensuels(onlyDigits(e.target.value));
                      setRevError(null);
                    }}
                    className={
                      "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 " +
                      (revError ? "border-red-400 focus:ring-red-500" : "border-slate-300 focus:ring-amber-500")
                    }
                    aria-invalid={!!revError}
                  />
                  {revError && <p className="text-[0.7rem] text-red-600">{revError}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Taux d’endettement cible (%)
                    <InfoBadge text="C’est la part maximale de vos revenus que la banque accepte en mensualités (souvent autour de 35%)." />
                  </label>
                  <input
                    type="number"
                    value={tauxEndettement}
                    onChange={(e) => setTauxEndettement(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Charges & crédits</h2>
              <p className="text-[0.75rem] text-slate-600">
                On recense vos autres mensualités, puis les infos du bien actuel (pour estimer le relais).
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Autres mensualités de crédits (€ / mois)
                    <InfoBadge text="Total de vos crédits actuels (auto, conso, etc.). Cela réduit la mensualité disponible pour le nouveau projet." />
                  </label>
                  <input
                    type="number"
                    value={autresMensualites}
                    onChange={(e) => setAutresMensualites(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Astuce</p>
                  <p className="mt-1 text-[0.8rem] text-slate-700">
                    Si la mensualité disponible est faible, le relais ne suffit pas : il faudra ajuster prix/durée/apport.
                  </p>
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
                      type="number"
                      value={valeurBienActuel}
                      onChange={(e) => setValeurBienActuel(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>
                      Capital restant dû (€)
                      <InfoBadge text="Le montant qu’il vous reste à rembourser sur le prêt actuel (visible sur votre tableau d’amortissement)." />
                    </label>
                    <input
                      type="number"
                      value={crdActuel}
                      onChange={(e) => setCrdActuel(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>
                      % retenu par la banque
                      <InfoBadge text="La banque ne finance généralement qu’une partie de la valeur du bien (souvent 60 à 80%)." />
                    </label>
                    <input
                      type="number"
                      value={pctRetenu}
                      onChange={(e) => setPctRetenu(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 items-start">
                  <div className="space-y-1">
                    <label className={labelBase}>
                      Taux relais (annuel, %)
                      <InfoBadge text="Taux indicatif du prêt relais. Il sert surtout à donner un ordre d’idée du coût." />
                    </label>
                    <input
                      type="number"
                      value={tauxRelais}
                      onChange={(e) => setTauxRelais(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>
                      Apport personnel prévu (€)
                      <InfoBadge text="L’argent que vous apportez de votre poche (épargne, donation, revente, etc.)." />
                    </label>
                    <input
                      type="number"
                      value={apportPerso}
                      onChange={(e) => setApportPerso(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Paramètres du prêt</h2>
              <p className="text-[0.75rem] text-slate-600">
                Ces paramètres servent à estimer le capital du nouveau prêt à partir de la mensualité disponible.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className={labelBase}>Taux du nouveau crédit (annuel, %)</label>
                  <input
                    type="number"
                    value={tauxNouveau}
                    onChange={(e) => setTauxNouveau(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>Durée du nouveau crédit (années)</label>
                  <input
                    type="number"
                    value={dureeNouveau}
                    onChange={(e) => setDureeNouveau(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelBase}>
                    Prix du bien visé (optionnel)
                    <InfoBadge text="Si vous avez un prix en tête, on le compare à votre budget max pour voir si c’est cohérent." />
                  </label>
                  <input
                    type="number"
                    value={prixCible}
                    onChange={(e) => setPrixCible(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </>
          )}
          {/* END: steps */}
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
                  if (step === 3) {
                    const rn = toInt(revMensuels, 0);
                    if (!revMensuels || rn <= 0) {
                      setRevError("Revenus obligatoires (montant > 0).");
                      return;
                    }
                  }
                  setRevError(null);
                  goNext();
                }}
              className="rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCalculRelais}
              className="rounded-full bg-gradient-to-r from-amber-500 to-sky-500 px-4 py-2 text-[0.8rem] font-semibold text-white shadow-lg shadow-amber-300/40 hover:shadow-2xl hover:shadow-amber-300/60 active:scale-[0.99]"
            >
              Calculer mon budget avec prêt relais
            </button>
          )}
        </div>
      </section>

      {/* Résultats */}
      <section id="resultats-pret-relais" className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-700 mb-1">Résultats</p>
            <h2 className="text-sm font-semibold text-slate-900">Prêt relais, nouveau prêt et budget maximal</h2>
            <p className="text-[0.75rem] text-slate-600">Synthèse claire + analyse détaillée (débloquée après).</p>
          </div>
        </div>

        {!hasResult ? (
          <p className="text-[0.8rem] text-slate-600">Complétez les étapes puis cliquez sur « Calculer ».</p>
        ) : (
          <>
            {/* Synthèse visible */}
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
                  {dureeNouveau} ans à ~{formatPct(tauxNouveau)}.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Budget max</p>
                <p className="mt-1 text-sm font-semibold text-amber-700">{formatEuro(resume!.budgetMax)}</p>
                <p className="mt-1 text-[0.7rem] text-slate-500">Relais + nouveau prêt + apport.</p>
              </div>
            </div>

            {/* Score Lokt.fr™ */}
            {canShowFullAnalysis && bankabilityScore !== null ? (
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
                  <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Comment c’est calculé</p>
                  <p className="mt-1 text-[0.75rem] text-slate-700">
                    Le score se base sur l’endettement projeté <span className="font-semibold">avec une marge de prudence</span>{" "}
                    (on retient ~{Math.round(LOKT_MENSUALITE_BUFFER * 100)}% de la mensualité disponible), pour éviter un score
                    “bloqué” au seuil cible.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Gate */}
{!canShowFullAnalysis ? (
  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-900 text-white p-5 relative overflow-hidden">
    <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-30 blur-3xl bg-cyan-500" />
    <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl bg-amber-400" />

    <div className="relative space-y-3">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">DÉBLOQUER L’ANALYSE</p>
      <h3 className="text-lg font-semibold">Conservez votre simulation et débloquez l’analyse détaillée.</h3>

      <div className="mt-2 rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
        {/* Email */}
        <div className="space-y-1">
          <label className="text-xs text-slate-100 font-semibold">Votre e-mail (obligatoire)</label>
          <input
            type="email"
            value={leadEmail}
            onChange={(e) => setLeadEmail(e.target.value)}
            placeholder="ex: prenom.nom@gmail.com"
            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300"
          />
          <p className="text-[0.7rem] text-slate-300">
            On l’utilise pour enregistrer la simulation et mesurer la demande (stats agrégées).
          </p>
        </div>

        {/* ✅ Option email */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendByEmail}
              onChange={(e) => setSendByEmail(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10"
            />
            <span className="text-[0.75rem] text-slate-200 leading-relaxed">
              <span className="font-semibold">Recevoir l’analyse complète par email</span>
              <span className="block text-[0.7rem] text-slate-300 mt-1">
                Pratique pour relire les résultats plus tard.
              </span>
            </span>
          </label>

          {sendingEmail ? <p className="mt-2 text-[0.7rem] text-slate-300">Envoi de l’email…</p> : null}
          {sendEmailMsg ? <p className="mt-2 text-[0.7rem] text-slate-200">{sendEmailMsg}</p> : null}
        </div>

        {/* ✅ Consentement */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentLokt}
              onChange={(e) => setConsentLokt(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10"
            />
            <span className="text-[0.75rem] text-slate-200 leading-relaxed">
              <span className="font-semibold">J’accepte</span> que mes données soient utilisées pour enregistrer mon analyse et
              améliorer Lokt.fr (statistiques anonymisées).
            </span>
          </label>
          <p className="mt-2 text-[0.7rem] text-slate-300">
            Pas de démarchage partenaire ici. Aucun consentement “contact partenaire” n’est demandé.
          </p>
        </div>

        {/* Bouton */}
        <button
          type="button"
          onClick={handleUnlock}
          disabled={unlocking}
          className="w-full inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:opacity-95 disabled:opacity-60"
        >
          {unlocking ? "Déblocage..." : "Débloquer l’analyse"}
        </button>

        {unlockMsg && <p className="text-[0.75rem] text-slate-200">{unlockMsg}</p>}
      </div>
    </div>
  </div>
) : null}

            {/* Analyse */}
            {texteDetail ? (
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">Analyse détaillée</p>

                <div className={canShowFullAnalysis ? "" : "blur-sm select-none"}>{renderAnalysisBlocks(texteDetail)}</div>

                {!canShowFullAnalysis ? (
                  <p className="mt-3 text-[0.75rem] text-slate-500">Débloquez l’analyse pour afficher le détail.</p>
                ) : (
                  <p className="mt-3 text-[0.65rem] text-slate-500">
                    Résultats indicatifs. Ne constitue pas une offre de prêt.
                  </p>
                )}
              </div>
            ) : null}
          </>
        )}

        <p className="mt-3 text-[0.7rem] text-slate-500">Simulation indicative. Chaque banque applique ses propres règles.</p>
      </section>
    </div>
  );
}

