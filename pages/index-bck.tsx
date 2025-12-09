// pages/index.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

type ResumeSimple = {
  revenusPrisEnCompte: number;
  chargesExistantes: number;
  tauxEndettementActuel: number;
  tauxEndettementAvecProjet: number;
  mensualiteMax: number;
  montantMax: number;
  prixBienMax: number;
  coutTotalProjetMax: number;
};

function formatEuro(val: number | null | undefined) {
  if (val === null || val === undefined || Number.isNaN(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number | null | undefined) {
  if (val === null || val === undefined || Number.isNaN(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 1,
    }) + " %"
  );
}

// Icône euro / financement (sobre)
function IconEuro() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 text-emerald-700"
    >
      <path
        d="M15.5 5.5a6 6 0 0 0-5.657 3.9H7.5a.75.75 0 0 0 0 1.5h1.91a5.9 5.9 0 0 0 0 2.2H7.5a.75.75 0 0 0 0 1.5h2.343A6 6 0 0 0 15.5 18.5a.75.75 0 0 0 0-1.5 4.5 4.5 0 0 1-4.14-2.5h2.64a.75.75 0 0 0 0-1.5h-3.1a5.3 5.3 0 0 1 0-2.2h3.1a.75.75 0 0 0 0-1.5h-2.64A4.5 4.5 0 0 1 15.5 7a.75.75 0 0 0 0-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Icône cadenas (pour les fonctionnalités réservées)
function IconLock() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-slate-500"
    >
      <path
        d="M8.75 10V8a3.25 3.25 0 0 1 6.5 0v2h.25A2.75 2.75 0 0 1 18.25 12.75v5A2.75 2.75 0 0 1 15.5 20.5h-7A2.75 2.75 0 0 1 5.75 17.75v-5A2.75 2.75 0 0 1 8.5 10h.25Zm1.5 0h3.5V8a1.75 1.75 0 0 0-3.5 0v2Zm-1.75 1.5A1.25 1.25 0 0 0 7.25 12.75v5c0 .69.56 1.25 1.25 1.25h7c.69 0 1.25-.56 1.25-1.25v-5A1.25 1.25 0 0 0 15.5 11.5h-7Zm3.5 2a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0v-1.25a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

type Step = 1 | 2 | 3;

export default function Home() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  // Étapes du wizard
  const [step, setStep] = useState<Step>(1);

  // Inputs simplifiés
  const [revenusNetMensuels, setRevenusNetMensuels] = useState<number>(4000);
  const [autresRevenusMensuels, setAutresRevenusMensuels] =
    useState<number>(0);

  const [loyerMensuel, setLoyerMensuel] = useState<number>(0);
  const [mensualitesCredits, setMensualitesCredits] = useState<number>(0);
  const [autresChargesMensuelles, setAutresChargesMensuelles] =
    useState<number>(0);

  const [tauxEndettementCible, setTauxEndettementCible] = useState<number>(35);
  const [tauxCreditCible, setTauxCreditCible] = useState<number>(3.5);
  const [dureeCreditCible, setDureeCreditCible] = useState<number>(25);

  // Résultat simple
  const [resume, setResume] = useState<ResumeSimple | null>(null);
  const [hasSimulated, setHasSimulated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted) return;
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error("Erreur récupération session (home)", e);
      }
    };

    fetchSession();

    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const displayName =
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : null);

  const isLoggedIn = !!user;

  const paidLink = (path: string) =>
    isLoggedIn
      ? path
      : `/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`;

  const handleNext = () => {
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  };

  const handlePrev = () => {
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const handleSimulate = () => {
    setHasSimulated(true);

    const revenusTotal =
      (revenusNetMensuels || 0) + (autresRevenusMensuels || 0);

    const chargesExistantes =
      (loyerMensuel || 0) +
      (mensualitesCredits || 0) +
      (autresChargesMensuelles || 0);

    if (revenusTotal <= 0) {
      setResume(null);
      return;
    }

    const enveloppeMax =
      revenusTotal * ((tauxEndettementCible || 0) / 100);

    const capaciteMensuelle = Math.max(enveloppeMax - chargesExistantes, 0);

    const tauxActuel = (chargesExistantes / revenusTotal) * 100;

    const tauxAvecProjet =
      revenusTotal > 0
        ? ((chargesExistantes + capaciteMensuelle) / revenusTotal) * 100
        : tauxActuel;

    // Calcul du capital empruntable (formule d'annuité)
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

    // Estimation prix de bien (frais inclus dans le crédit)
    const tauxNotaire = 0.075;
    const tauxAgence = 0.04;
    const denom = 1 + tauxNotaire + tauxAgence;

    let prixBienMax = 0;
    let coutTotalProjetMax = 0;

    if (montantMax > 0 && denom > 0) {
      prixBienMax = montantMax / denom;
      coutTotalProjetMax = montantMax; // ici : on considère que le crédit finance tout
    }

    setResume({
      revenusPrisEnCompte: revenusTotal,
      chargesExistantes,
      tauxEndettementActuel: tauxActuel,
      tauxEndettementAvecProjet: tauxAvecProjet,
      mensualiteMax: capaciteMensuelle,
      montantMax,
      prixBienMax,
      coutTotalProjetMax,
    });
  };

  // Mini "graph" de taux d'endettement (barres horizontales CSS)
  const renderDebtBars = () => {
    if (!resume) return null;

    const actuel = Math.max(0, Math.min(60, resume.tauxEndettementActuel));
    const cible = Math.max(0, Math.min(60, tauxEndettementCible));
    const avecProjet = Math.max(
      0,
      Math.min(60, resume.tauxEndettementAvecProjet)
    );

    const scale = (v: number) => `${(v / 60) * 100}%`;

    return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
          Taux d&apos;endettement (aperçu)
        </p>
        <div className="space-y-2">
          <div className="text-[0.7rem] text-slate-500 flex items-center justify-between">
            <span>Actuel</span>
            <span className="font-semibold text-slate-800">
              {formatPct(resume.tauxEndettementActuel)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-slate-900"
              style={{ width: scale(actuel) }}
            />
          </div>

          <div className="text-[0.7rem] text-slate-500 flex items-center justify-between mt-2">
            <span>Objectif (cible)</span>
            <span className="font-semibold text-emerald-700">
              {formatPct(tauxEndettementCible)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: scale(cible) }}
            />
          </div>

          <div className="text-[0.7rem] text-slate-500 flex items-center justify-between mt-2">
            <span>Après nouveau crédit</span>
            <span className="font-semibold text-sky-700">
              {formatPct(resume.tauxEndettementAvecProjet)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-sky-500"
              style={{ width: scale(avecProjet) }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header uniquement si connecté */}
      {isLoggedIn && <AppHeader />}

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Bloc principal : calculette step-by-step */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-6 md:p-7 lg:p-8">
          {/* Intro */}
          <div className="flex flex-col gap-3 mb-5">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600">
              Étude gratuite
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              {displayName
                ? `Bonjour ${displayName}, estimons votre capacité d'emprunt.`
                : "Estimez gratuitement votre capacité d'emprunt."}
            </h1>
            <p className="text-sm text-slate-600 max-w-xl">
              Répondez à quelques questions sur vos revenus, charges et le
              crédit envisagé. Vous obtenez un budget indicatif pour votre
              futur achat immobilier.
            </p>
            {!isLoggedIn && (
              <p className="text-[0.7rem] text-slate-500">
                Aucune création de compte n&apos;est nécessaire pour cette
                estimation. La version détaillée avec sauvegarde est réservée
                aux utilisateurs inscrits.
              </p>
            )}
          </div>

          {/* Grille calculette + résultats */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Colonne gauche : stepper + formulaires */}
            <div className="space-y-4">
              {/* Stepper */}
              <div className="flex items-center justify-between gap-2">
                {[
                  { id: 1, label: "Revenus" },
                  { id: 2, label: "Charges" },
                  { id: 3, label: "Crédit" },
                ].map((s) => {
                  const active = step === s.id;
                  const done = step > (s.id as Step);
                  return (
                    <div
                      key={s.id}
                      className="flex-1 flex items-center gap-2"
                    >
                      <div
                        className={
                          "inline-flex h-7 w-7 items-center justify-center rounded-full text-[0.75rem] font-semibold " +
                          (active
                            ? "bg-slate-900 text-white"
                            : done
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200")
                        }
                      >
                        {s.id}
                      </div>
                      <span
                        className={
                          "text-[0.7rem] font-medium " +
                          (active
                            ? "text-slate-900"
                            : "text-slate-500")
                        }
                      >
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Formulaire selon l'étape */}
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 sm:px-4 sm:py-4 space-y-3">
                {step === 1 && (
                  <>
                    <p className="text-xs font-semibold text-slate-900">
                      1. Revenus de votre foyer
                    </p>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[0.75rem] text-slate-700">
                          Revenus nets du foyer (€/mois)
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
                        <label className="text-[0.75rem] text-slate-700">
                          Autres revenus (pensions, primes régulières, etc.)
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
                  </>
                )}

                {step === 2 && (
                  <>
                    <p className="text-xs font-semibold text-slate-900">
                      2. Charges et crédits en cours
                    </p>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[0.75rem] text-slate-700">
                          Loyer actuel (si vous êtes locataire) (€/mois)
                        </label>
                        <input
                          type="number"
                          value={loyerMensuel}
                          onChange={(e) =>
                            setLoyerMensuel(
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.75rem] text-slate-700">
                          Mensualités de crédits en cours (total) (€/mois)
                        </label>
                        <input
                          type="number"
                          value={mensualitesCredits}
                          onChange={(e) =>
                            setMensualitesCredits(
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.75rem] text-slate-700">
                          Autres charges mensuelles récurrentes (pensions,
                          etc.) (€/mois)
                        </label>
                        <input
                          type="number"
                          value={autresChargesMensuelles}
                          onChange={(e) =>
                            setAutresChargesMensuelles(
                              parseFloat(e.target.value) || 0
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
                    <p className="text-xs font-semibold text-slate-900">
                      3. Paramètres du crédit à simuler
                    </p>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[0.75rem] text-slate-700">
                          Taux d&apos;endettement cible (%)
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
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[0.75rem] text-slate-700">
                            Taux crédit (annuel, en %)
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
                          <label className="text-[0.75rem] text-slate-700">
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
                    </div>
                  </>
                )}
              </div>

              {/* Navigation étapes */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={step === 1}
                  className="text-[0.7rem] text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-default"
                >
                  ← Étape précédente
                </button>
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Continuer →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSimulate}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg"
                  >
                    Voir mon estimation
                  </button>
                )}
              </div>
            </div>

            {/* Colonne droite : résultat épuré */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                    Résultats
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Budget indicatif pour votre projet
                  </h2>
                  <p className="text-[0.7rem] text-slate-500">
                    Montant de mensualité, capital empruntable et ordre de
                    grandeur du prix de bien.
                  </p>
                </div>
                <div className="hidden sm:flex h-9 w-9 rounded-full bg-emerald-50 border border-emerald-100 items-center justify-center">
                  <IconEuro />
                </div>
              </div>

              {!hasSimulated && (
                <p className="mt-2 text-sm text-slate-500">
                  Complétez les étapes à gauche puis cliquez sur{" "}
                  <span className="font-semibold">
                    &quot;Voir mon estimation&quot;
                  </span>{" "}
                  pour afficher votre budget indicatif.
                </p>
              )}

              {hasSimulated && !resume && (
                <p className="mt-2 text-sm text-red-600">
                  Merci de renseigner des revenus supérieurs à 0 € pour
                  obtenir une estimation.
                </p>
              )}

              {hasSimulated && resume && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 mt-2">
                    <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Mensualité maximale estimée
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatEuro(resume.mensualiteMax)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Capital empruntable
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatEuro(resume.montantMax)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Prix de bien indicatif
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatEuro(resume.prixBienMax)}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-slate-500">
                        Estimation incluant frais dans le financement.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Taux d&apos;endettement après projet
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatPct(resume.tauxEndettementAvecProjet)}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-slate-500">
                        Actuel : {formatPct(resume.tauxEndettementActuel)}
                      </p>
                    </div>
                  </div>

                  {renderDebtBars()}

                  <p className="mt-2 text-[0.7rem] text-slate-500">
                    Ces chiffres sont indicatifs et ne remplacent pas une offre
                    de prêt. Ils vous donnent un ordre de grandeur pour préparer
                    vos échanges avec votre banque ou votre courtier.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Bloc marketing version complète */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Version complète (bientôt payante)
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            Pour aller plus loin que cette estimation rapide
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            La version complète vous permet de détailler vos crédits un par un,
            d&apos;intégrer vos projets locatifs, un éventuel prêt relais et
            l&apos;analyse de votre parc immobilier existant. Vous obtenez des
            synthèses plus poussées, partageables en PDF et sauvegardées dans
            votre espace.
          </p>

          <div className="grid gap-3 md:grid-cols-3 mt-3">
            <Link
              href={paidLink("/investissement")}
              className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left flex flex-col gap-2 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  Investissement locatif
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[0.65rem] font-semibold text-white px-2 py-0.5">
                  <IconLock />
                  Réservé aux membres
                </span>
              </div>
              <p className="text-[0.7rem] text-slate-500">
                Cash-flow, rendements, fiscalité (LMNP, réel, etc.) et scénarios
                multi-biens.
              </p>
            </Link>

            <Link
              href={paidLink("/pret-relais")}
              className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left flex flex-col gap-2 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  Achat revente / prêt relais
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[0.65rem] font-semibold text-white px-2 py-0.5">
                  <IconLock />
                  Réservé aux membres
                </span>
              </div>
              <p className="text-[0.7rem] text-slate-500">
                Budget d&apos;achat, relais, nouveau crédit et comparaison de
                plusieurs scénarios.
              </p>
            </Link>

            <Link
              href={paidLink("/parc-immobilier")}
              className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left flex flex-col gap-2 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  Parc immobilier existant
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[0.65rem] font-semibold text-white px-2 py-0.5">
                  <IconLock />
                  Réservé aux membres
                </span>
              </div>
              <p className="text-[0.7rem] text-slate-500">
                Vue consolidée de vos biens, encours, cash-flow global et
                arbitrages possibles.
              </p>
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href={isLoggedIn ? "/mon-compte" : "/mon-compte?mode=register"}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
            >
              {isLoggedIn
                ? "Accéder à mon espace et aux calculettes avancées"
                : "Créer mon espace et découvrir la version complète"}
            </Link>
            <p className="text-[0.7rem] text-slate-500">
              La version payante intégrera progressivement des fonctionnalités
              avancées : export PDF, scénarios multiples, historique de vos
              projets…
            </p>
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
