// pages/capacite.tsx
import { useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

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

type ResumeCapacite = {
  revenusPrisEnCompte: number;
  tauxEndettementActuel: number;
  tauxEndettementAvecProjet: number;
  mensualiteMax: number;
  montantMax: number;
  prixBienMax: number;
  coutTotalProjetMax: number;
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

type Step = 1 | 2 | 3;

export default function CapaciteEmpruntPage() {
  // Étapes
  const [step, setStep] = useState<Step>(1);

  // Situation / revenus
  const [revenusNetMensuels, setRevenusNetMensuels] = useState(4000);
  const [revenusLocatifsMensuels, setRevenusLocatifsMensuels] = useState(0);
  const [autresRevenusMensuels, setAutresRevenusMensuels] = useState(0);

  // Charges (globales)
  const [chargesMensuelles, setChargesMensuelles] = useState(0);

  // Paramètres du crédit
  const [tauxCreditCible, setTauxCreditCible] = useState(3.5);
  const [dureeCreditCible, setDureeCreditCible] = useState(25);
  const tauxEndettementCible = 35; // fixé pour la version simple

  // Résultats
  const [resumeCapacite, setResumeCapacite] =
    useState<ResumeCapacite | null>(null);
  const [resultCapaciteTexte, setResultCapaciteTexte] = useState<string>("");

  // Sauvegarde
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hasResult = !!resumeCapacite;

  const goToStep = (target: Step) => {
    setStep(target);
  };

  const handleNextStep = () => {
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  };

  const handlePrevStep = () => {
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const handleCalculCapacite = () => {
    setSaveMessage(null);

    // Revenus pris en compte : salaires + autres + 70 % des loyers
    const revenusBase =
      (revenusNetMensuels || 0) + (autresRevenusMensuels || 0);
    const revenusLocatifsPrisEnCompte = (revenusLocatifsMensuels || 0) * 0.7;
    const revenusPrisEnCompte = revenusBase + revenusLocatifsPrisEnCompte;

    const chargesActuelles = chargesMensuelles || 0;

    // Enveloppe max à 35 % d’endettement (version simple)
    const enveloppeMax =
      revenusPrisEnCompte * (tauxEndettementCible / 100);

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

    // Calcul du capital empruntable
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

    // Prix de bien estimé (crédit finançant prix + notaire + agence)
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
      tauxEndettementActuel: tauxActuel,
      tauxEndettementAvecProjet: tauxAvecProjet,
      mensualiteMax: capaciteMensuelle,
      montantMax,
      prixBienMax,
      coutTotalProjetMax,
    };

    setResumeCapacite(resume);

    const lignes: string[] = [];

    if (capaciteMensuelle > 0) {
      lignes.push(
        `Avec vos revenus et vos charges, votre mensualité théorique disponible pour un nouveau crédit est d’environ ${formatEuro(
          capaciteMensuelle
        )}.`,
        `Sur ${dureeCreditCible} ans à ${tauxCreditCible.toLocaleString(
          "fr-FR",
          { maximumFractionDigits: 2 }
        )} % hors assurance, cela représente un capital empruntable proche de ${formatEuro(
          montantMax
        )}.`,
        prixBienMax > 0
          ? `En intégrant frais de notaire et d’agence dans le financement, le prix de bien visé se situe autour de ${formatEuro(
              prixBienMax
            )}.`
          : `Vous êtes à la limite de la capacité d’emprunt avec un taux cible de ${formatPct(
              tauxEndettementCible
            )}.`
      );
    } else {
      lignes.push(
        `Avec vos paramètres actuels, votre capacité d’emprunt est limitée : l’enveloppe à ${formatPct(
          tauxEndettementCible
        )} d’endettement est déjà consommée par vos charges.`
      );
    }

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
          window.location.href = "/mon-compte?redirect=/capacite";
        }
        return;
      }

      const { error } = await supabase.from("projects").insert({
        user_id: session.user.id,
        type: "capacite",
        title: "Simulation capacité d'emprunt (version simple)",
        data: {
          resume: resumeCapacite,
          texte: resultCapaciteTexte,
          version: "simple",
        },
      });

      if (error) throw error;
      setSaveMessage("✅ Résultat sauvegardé dans votre espace.");
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
      <p key={idx} className="text-sm text-slate-800 leading-relaxed">
        {line}
      </p>
    ));

  // Pour la petite jauge de taux d’endettement
  const getDebtBarWidth = (taux: number) => {
    const capped = Math.max(0, Math.min(taux, 50)); // cap à 50 %
    return `${(capped / 50) * 100}%`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header global */}
      <AppHeader />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Titre / intro */}
        <section className="text-center space-y-2">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600">
            Étude gratuite
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            Estimez votre capacité d&apos;emprunt immobilier
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Trois étapes simples pour obtenir une estimation de votre budget
            d&apos;achat et de votre mensualité maximale, sur la base d&apos;un taux
            d&apos;endettement de 35&nbsp;% et de 70&nbsp;% de vos loyers locatifs.
          </p>
        </section>

        {/* Carte principale : stepper + formulaire + résultats */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 sm:p-6 space-y-6">
          {/* Stepper */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              {[
                { id: 1, label: "Vos revenus" },
                { id: 2, label: "Vos charges" },
                { id: 3, label: "Paramètres du prêt" },
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

            {/* Barre de progression simple */}
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

          {/* Contenu de l'étape */}
          <div className="space-y-4">
            {step === 1 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  1. Vos revenus mensuels
                </h2>
                <p className="text-xs text-slate-500">
                  Nous prenons en compte vos revenus nets récurrents. Les
                  revenus locatifs sont pondérés à 70&nbsp;% comme le font
                  généralement les banques.
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
                    <InfoBadge text="Nous retiendrons automatiquement 70 % de ces loyers dans le calcul de vos revenus." />
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
                    Autres revenus stables (pensions, primes récurrentes, etc.)
                    (€/mois)
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
            )}

            {step === 2 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  2. Vos charges mensuelles
                </h2>
                <p className="text-xs text-slate-500">
                  Indiquez le total de vos charges qui resteront après l&apos;achat :
                  loyers, crédits conso/auto, pensions versées, etc.
                </p>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Charges conservées après l&apos;opération (€/mois)*
                    <InfoBadge text="Additionnez vos charges mensuelles : loyer actuel, crédits en cours, pensions alimentaires, etc." />
                  </label>
                  <input
                    type="number"
                    value={chargesMensuelles}
                    onChange={(e) =>
                      setChargesMensuelles(
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  3. Paramètres du crédit à simuler
                </h2>
                <p className="text-xs text-slate-500">
                  Ces paramètres servent à transformer votre capacité mensuelle
                  en montant empruntable et en budget d&apos;achat.
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

                <p className="text-[0.7rem] text-slate-500 flex items-center gap-1">
                  Nous appliquons par défaut un taux d&apos;endettement cible de{" "}
                  <span className="font-semibold">
                    {formatPct(tauxEndettementCible)}
                  </span>{" "}
                  (référence recommandée par le HCSF).
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
                  Afficher ma capacité d&apos;emprunt
                </button>
              )}
            </div>

            <p className="text-[0.7rem] text-slate-400">
              Simulation indicative, non contractuelle.
            </p>
          </div>

          {/* Résultats */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Résultat de votre simulation
            </h2>

            {hasResult ? (
              <>
                {/* 4 indicateurs clés */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Mensualité maximale
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

                    {/* mini “graphique” jauge */}
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

                {/* Analyse courte */}
                <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                    Lecture rapide
                  </p>
                  {renderMultiline(resultCapaciteTexte)}
                  <p className="mt-2 text-[0.7rem] text-slate-500">
                    Cette estimation ne remplace pas une étude complète de
                    votre banque ou de votre courtier (situation
                    professionnelle, épargne, historique de compte, fiscalité…).
                  </p>
                </div>

                {/* CTA version avancée / inscription */}
                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-3 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.75rem] font-semibold text-slate-900">
                      Aller plus loin avec la version avancée
                    </p>
                    <p className="text-[0.7rem] text-slate-500">
                      Multi-crédits, prise en compte détaillée des prêts
                      immobiliers (avec loyers à 70&nbsp;%), export PDF, suivi
                      de vos projets…
                    </p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <button
                      type="button"
                      onClick={handleSaveProject}
                      disabled={saving}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-1.5 text-[0.75rem] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {saving
                        ? "Sauvegarde..."
                        : "Sauvegarder ce résultat"}
                    </button>
                    {saveMessage && (
                      <p className="text-[0.65rem] text-slate-500 text-right max-w-xs">
                        {saveMessage}
                      </p>
                    )}
                    <Link
                      href="/mon-compte?mode=register"
                      className="text-[0.7rem] text-slate-600 underline decoration-dotted underline-offset-2"
                    >
                      Créer mon espace et débloquer les calculettes
                      avancées
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Complétez les 3 étapes puis cliquez sur{" "}
                <span className="font-semibold">
                  &quot;Afficher ma capacité d&apos;emprunt&quot;
                </span>{" "}
                pour voir votre résultat.
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
