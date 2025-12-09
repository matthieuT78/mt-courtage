// pages/capacite.tsx
import { useState } from "react";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

function formatEuro(val: number) {
  if (val === undefined || val === null || Number.isNaN(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (val === undefined || val === null || Number.isNaN(val)) return "-";
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

type Step = 1 | 2 | 3;

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

export default function CapaciteEmpruntPage() {
  // Étape active
  const [step, setStep] = useState<Step>(1);

  // Situation financière
  const [revenusNetMensuels, setRevenusNetMensuels] = useState(4000);
  const [revenusLocatifsMensuels, setRevenusLocatifsMensuels] = useState(0);
  const [autresRevenusMensuels, setAutresRevenusMensuels] = useState(0);
  const [chargesMensuellesHorsCredits, setChargesMensuellesHorsCredits] =
    useState(0);
  const [tauxEndettementCible, setTauxEndettementCible] = useState(35);

  // Crédits en cours (détaillés)
  const [nbCredits, setNbCredits] = useState(0);
  const [typesCredits, setTypesCredits] = useState<TypeCredit[]>([]);
  const [mensualitesCredits, setMensualitesCredits] = useState<number[]>([]);
  const [resteAnneesCredits, setResteAnneesCredits] = useState<number[]>([]);
  const [tauxCredits, setTauxCredits] = useState<number[]>([]);
  const [revenusLocatifsParCredit, setRevenusLocatifsParCredit] = useState<
    number[]
  >([]);

  // Nouveau projet (taux / durée)
  const [tauxCreditCible, setTauxCreditCible] = useState(3.5);
  const [dureeCreditCible, setDureeCreditCible] = useState(25);

  // Résultats
  const [resumeCapacite, setResumeCapacite] =
    useState<ResumeCapacite | null>(null);
  const [resultCapaciteTexte, setResultCapaciteTexte] = useState<string>("");

  // Sauvegarde
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hasResult = !!resumeCapacite;

  // --- Gestion des crédits dynamiques ---

  const handleNbCreditsChange = (value: number) => {
    const n = Math.min(Math.max(value, 0), 10);
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
    setRevenusLocatifsParCredit((prev) => {
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
    setRevenusLocatifsParCredit((prev) => {
      const arr = [...prev];
      arr[index] = value;
      return arr;
    });
  };

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const goToStep = (target: Step) => setStep(target);
  const handleNextStep = () => setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  const handlePrevStep = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  // --- Calcul principal ---

  const handleCalculCapacite = () => {
    setSaveMessage(null);

    const revenusBase =
      (revenusNetMensuels || 0) +
      (autresRevenusMensuels || 0) +
      (revenusLocatifsMensuels || 0) * 0.7;

    // Loyers à 70 % associés aux crédits immo
    let revenuLocatifPrisEnCompteCredits = 0;
    for (let i = 0; i < nbCredits; i++) {
      if (typesCredits[i] === "immo") {
        const loyer = revenusLocatifsParCredit[i] || 0;
        revenuLocatifPrisEnCompteCredits += loyer * 0.7;
      }
    }

    const revenusPrisEnCompte = revenusBase + revenuLocatifPrisEnCompteCredits;

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

    setResumeCapacite(resume);

    const lignes: string[] = [];

    lignes.push(
      `Vos revenus mensuels pris en compte (salaires, autres revenus et 70 % des loyers) s’élèvent à ${formatEuro(
        revenusPrisEnCompte
      )}.`,
      `À ${formatPct(
        tauxEndettementCible
      )} de taux d’endettement cible, l’enveloppe maximale théorique consacrée à vos charges (crédits + charges récurrentes) est d’environ ${formatEuro(
        enveloppeMax
      )}.`,
      `Aujourd’hui, vos charges récurrentes hors nouveau projet représentent ${formatEuro(
        chargesActuelles
      )} par mois, dont ${formatEuro(
        mensualitesExistantes
      )} de mensualités de crédits et ${formatEuro(
        chargesHors
      )} d’autres charges (loyer, pensions, etc.).`
    );

    if (capaciteMensuelle > 0) {
      lignes.push(
        `La mensualité théorique disponible pour un nouveau crédit est de l’ordre de ${formatEuro(
          capaciteMensuelle
        )} par mois.`,
        `Sur ${dureeCreditCible} ans à ${tauxCreditCible.toLocaleString(
          "fr-FR",
          { maximumFractionDigits: 2 }
        )} % (hors assurance), cela correspond à un capital empruntable d’environ ${formatEuro(
          montantMax
        )}.`
      );

      if (prixBienMax > 0) {
        lignes.push(
          `En supposant que le crédit finance le prix du bien, les frais de notaire (≈ 7,5 %) et les frais d’agence (≈ 4 %), vous pouvez viser un bien autour de ${formatEuro(
            prixBienMax
          )}, pour un budget global financé proche de ${formatEuro(
            coutTotalProjetMax
          )}.`
        );
      }
    } else {
      lignes.push(
        `Avec vos paramètres actuels, la capacité mensuelle disponible pour un nouveau crédit est nulle : l’enveloppe de ${formatPct(
          tauxEndettementCible
        )} est déjà utilisée par vos charges.`
      );
    }

    lignes.push(
      `En utilisant pleinement cette capacité, votre taux d’endettement théorique après projet serait d’environ ${formatPct(
        tauxAvecProjet
      )} (contre ${formatPct(
        tauxActuel
      )} actuellement), à comparer aux pratiques de votre banque et à votre profil global (stabilité de revenus, épargne, patrimoine…).`
    );

    setResultCapaciteTexte(lignes.join("\n"));
  };

  const handleSaveProject = async () => {
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
          window.location.href = "/mon-compte?mode=login&redirect=/capacite";
        }
        return;
      }

      const { error } = await supabase.from("projects").insert({
        user_id: session.user.id,
        type: "capacite",
        title: "Simulation capacité d'emprunt détaillée",
        data: {
          resume: resumeCapacite,
          texte: resultCapaciteTexte,
          params: {
            revenusNetMensuels,
            revenusLocatifsMensuels,
            autresRevenusMensuels,
            chargesMensuellesHorsCredits,
            tauxEndettementCible,
            nbCredits,
            typesCredits,
            mensualitesCredits,
            resteAnneesCredits,
            tauxCredits,
            revenusLocatifsParCredit,
            tauxCreditCible,
            dureeCreditCible,
          },
        },
      });

      if (error) throw error;
      setSaveMessage("✅ Simulation sauvegardée dans votre espace.");
    } catch (err: any) {
      setSaveMessage(
        "❌ Erreur lors de la sauvegarde : " +
          (err?.message || "erreur inconnue")
      );
    } finally {
      setSaving(false);
    }
  };

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, idx) => (
      <p key={idx} className="text-sm text-slate-800 leading-relaxed">
        {line}
      </p>
    ));

  const getDebtBarWidth = (taux: number) => {
    const capped = Math.max(0, Math.min(taux, 50));
    return `${(capped / 50) * 100}%`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Intro */}
        <section className="space-y-2">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600">
            Calculette avancée – accès gratuit
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            Calculez précisément votre capacité d&apos;emprunt immobilier
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Cette calculette reproduit une logique proche de celle des banques :
            revenus, charges, crédits en cours détaillés, loyers locatifs
            pondérés à 70&nbsp;%, taux d&apos;endettement cible, paramètres du prêt…
            En quelques minutes, vous obtenez une estimation structurée, prête à
            être discutée avec votre banque ou votre courtier.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          {/* Colonne gauche : stepper + formulaire */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 sm:p-6 space-y-5">
            {/* Stepper */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                {[
                  { id: 1, label: "Revenus & charges" },
                  { id: 2, label: "Crédits en cours" },
                  { id: 3, label: "Nouveau crédit" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToStep(s.id as Step)}
                    className="flex-1 flex flex-col items-center gap-1 group"
                  >
                    <div
                      className={[
                        "flex h-7 w-7 items-center justify-center rounded-full text-[0.75rem] font-semibold border",
                        step === s.id
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-300 group-hover:border-slate-500",
                      ].join(" ")}
                    >
                      {s.id}
                    </div>
                    <span
                      className={
                        "text-[0.7rem] " +
                        (step === s.id
                          ? "text-slate-900 font-semibold"
                          : "text-slate-500")
                      }
                    >
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all"
                  style={{
                    width:
                      step === 1 ? "33%" : step === 2 ? "66%" : "100%",
                  }}
                />
              </div>
            </div>

            {/* Formulaire selon l'étape */}
            <div className="space-y-4">
              {step === 1 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    1. Revenus & charges du foyer
                  </h2>
                  <p className="text-xs text-slate-500">
                    Commencez par décrire vos revenus mensuels récurrents et
                    vos principales charges hors crédits (loyer, pensions, etc.).
                  </p>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">
                      Revenus nets du foyer (€/mois)*
                    </label>
                    <input
                      type="number"
                      value={revenusNetMensuels}
                      onChange={(e) =>
                        setRevenusNetMensuels(
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700 flex items-center gap-1">
                      Revenus locatifs bruts (€/mois)
                      <InfoBadge text="Nous retiendrons automatiquement 70 % de ces loyers dans les revenus pris en compte." />
                    </label>
                    <input
                      type="number"
                      value={revenusLocatifsMensuels}
                      onChange={(e) =>
                        setRevenusLocatifsMensuels(
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">
                      Autres revenus stables (pensions reçues, primes récurrentes, etc.) (€/mois)
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

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">
                      Autres charges mensuelles hors crédits (loyer, pensions versées, etc.) (€/mois)
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
                      Taux d&apos;endettement cible (%)
                      <InfoBadge text="En France, la référence est autour de 35 % d’endettement. Certains profils peuvent aller légèrement au-delà." />
                    </label>
                    <input
                      type="number"
                      value={tauxEndettementCible}
                      onChange={(e) =>
                        setTauxEndettementCible(
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    2. Crédits en cours
                  </h2>
                  <p className="text-xs text-slate-500">
                    Détaillez les crédits qui resteront en place après votre
                    nouveau projet : ils seront pris en compte dans le calcul de
                    votre capacité.
                  </p>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700 flex items-center gap-1">
                      Nombre de crédits en cours
                      <InfoBadge text="Incluez vos crédits immobiliers locatifs ou résidence principale, crédits conso, auto, etc." />
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={nbCredits}
                      onChange={(e) =>
                        handleNbCreditsChange(
                          parseInt(e.target.value, 10) || 0
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {Array.from({ length: nbCredits }).map((_, index) => (
                    <div
                      key={index}
                      className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2"
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
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="immo">Crédit immobilier</option>
                            <option value="perso">Crédit personnel</option>
                            <option value="auto">Crédit auto</option>
                            <option value="conso">Crédit conso</option>
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
                              value={revenusLocatifsParCredit[index] || 0}
                              onChange={(e) =>
                                handleRevenuLocatifChange(
                                  index,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <p className="text-[0.65rem] text-slate-500">
                              70 % de ce loyer est ajouté à vos revenus, comme
                              dans les analyses bancaires.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    3. Paramètres du nouveau crédit
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ajustez le taux et la durée pour voir leur impact sur votre
                    enveloppe d&apos;emprunt.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">
                        Taux du crédit (annuel, hors assurance, en %)
                      </label>
                      <input
                        type="number"
                        value={tauxCreditCible}
                        onChange={(e) =>
                          setTauxCreditCible(
                            parseFloat(e.target.value) || 0
                          )
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
                        value={dureeCreditCible}
                        onChange={(e) =>
                          setDureeCreditCible(
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <p className="text-[0.7rem] text-slate-500">
                    La simulation se base sur un taux d&apos;endettement cible de{" "}
                    <span className="font-semibold">
                      {formatPct(tauxEndettementCible)}
                    </span>
                    . Vous pouvez l&apos;adapter à votre profil et aux pratiques
                    de votre banque.
                  </p>
                </div>
              )}
            </div>

            {/* Navigation étapes + bouton calcul */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100 mt-2">
              <div className="flex gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Étape précédente
                  </button>
                )}
                {step < 3 && (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Étape suivante
                  </button>
                )}
                {step === 3 && (
                  <button
                    type="button"
                    onClick={handleCalculCapacite}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg active:scale-[0.99]"
                  >
                    Calculer ma capacité d&apos;emprunt
                  </button>
                )}
              </div>

              <p className="text-[0.7rem] text-slate-400">
                Simulation indicative, non contractuelle.
              </p>
            </div>
          </div>

          {/* Colonne droite : résultats */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 sm:p-6 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Résultats
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Capacité d&apos;emprunt & budget estimé
                </h2>
                <p className="text-xs text-slate-500">
                  Mensualité maximale, montant empruntable, prix de bien visé et
                  taux d&apos;endettement après projet.
                </p>
              </div>
              {hasResult && (
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={handlePrintPDF}
                    className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300"
                  >
                    PDF
                  </button>
                  <button
                    onClick={handleSaveProject}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full border border-emerald-500/80 bg-emerald-500 px-3 py-1.5 text-[0.7rem] font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {saving ? "Sauvegarde..." : "Sauvegarder ce projet"}
                  </button>
                  {saveMessage && (
                    <p className="text-[0.65rem] text-slate-500 max-w-[220px] text-right">
                      {saveMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            {hasResult ? (
              <>
                {/* KPI principaux */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Capacité mensuelle disponible
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeCapacite!.mensualiteMax)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Capital empruntable estimé
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeCapacite!.montantMax)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Prix de bien estimé
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeCapacite!.prixBienMax)}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Incluant frais de notaire (~7,5&nbsp;%) et d&apos;agence
                      (~4&nbsp;%) dans le financement.
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Taux d&apos;endettement après projet
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatPct(
                        resumeCapacite!.tauxEndettementAvecProjet
                      )}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Taux actuel :{" "}
                      {formatPct(
                        resumeCapacite!.tauxEndettementActuel
                      )}
                    </p>

                    {/* Mini jauge */}
                    <div className="mt-2">
                      <div className="flex justify-between text-[0.6rem] text-slate-400 mb-1">
                        <span>0 %</span>
                        <span>35 %</span>
                        <span>50 %</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={
                            "h-full rounded-full " +
                            (resumeCapacite!.tauxEndettementAvecProjet <=
                            tauxEndettementCible
                              ? "bg-emerald-500"
                              : "bg-amber-500")
                          }
                          style={{
                            width: getDebtBarWidth(
                              resumeCapacite!
                                .tauxEndettementAvecProjet
                            ),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analyse synthétique */}
                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                    Analyse synthétique
                  </p>
                  {renderMultiline(resultCapaciteTexte)}
                  <p className="mt-2 text-[0.7rem] text-slate-500">
                    Ces calculs sont indicatifs et ne tiennent pas compte de la
                    fiscalité, ni de l&apos;analyse qualitative complète (stabilité
                    professionnelle, épargne, comportement de compte…).
                  </p>
                </div>

                {/* Teasing version payante / espace perso */}
                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-3 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.75rem] font-semibold text-slate-900">
                      Enregistrer, comparer et aller plus loin
                    </p>
                    <p className="text-[0.7rem] text-slate-500">
                      En créant votre espace, vous pourrez sauvegarder vos
                      simulations, préparer vos RDV bancaires et accéder aux
                      autres calculettes (investissement locatif, prêt relais,
                      parc immobilier…).
                    </p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <a
                      href="/mon-compte?mode=register"
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-[0.75rem] font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      Créer mon espace gratuit
                    </a>
                    <a
                      href="/mon-compte?mode=login"
                      className="text-[0.7rem] text-slate-600 underline decoration-dotted underline-offset-2"
                    >
                      J&apos;ai déjà un compte
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Complétez les étapes à gauche puis cliquez sur{" "}
                <span className="font-semibold">
                  “Calculer ma capacité d&apos;emprunt”
                </span>{" "}
                pour afficher une estimation détaillée de votre budget.
              </p>
            )}
          </div>
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
