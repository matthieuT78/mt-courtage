// components/CapaciteSimple.tsx
import { useState } from "react";
import Link from "next/link";

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
      maximumFractionDigits: 1,
    }) + " %"
  );
}

type SimpleResult = {
  revenusPrisEnCompte: number;
  chargesMensuelles: number;
  tauxEndettementActuel: number;
  tauxEndettementAvecProjet: number;
  mensualiteMax: number;
  montantMax: number;
  prixBienMax: number;
};

export function CapaciteSimple() {
  // Stepper
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Inputs simplifiés
  const [revenusNetMensuels, setRevenusNetMensuels] = useState(4000);
  const [autresRevenusMensuels, setAutresRevenusMensuels] = useState(0);

  const [chargesMensuelles, setChargesMensuelles] = useState(0);
  const [tauxEndettementCible, setTauxEndettementCible] = useState(35);

  const [tauxCredit, setTauxCredit] = useState(3.5);
  const [dureeCredit, setDureeCredit] = useState(25);

  // Résultat
  const [result, setResult] = useState<SimpleResult | null>(null);

  const handleNext = () => {
    setStep((s) => (s < 3 ? ((s + 1) as 2 | 3) : s));
  };

  const handlePrev = () => {
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s));
  };

  const handleSubmit = () => {
    const revenusPrisEnCompte =
      (revenusNetMensuels || 0) + (autresRevenusMensuels || 0);
    const charges = chargesMensuelles || 0;

    const enveloppeMax =
      revenusPrisEnCompte * ((tauxEndettementCible || 0) / 100);

    const mensualiteMax = Math.max(enveloppeMax - charges, 0);

    const tauxActuel =
      revenusPrisEnCompte > 0
        ? (charges / revenusPrisEnCompte) * 100
        : 0;

    const tauxAvecProjet =
      revenusPrisEnCompte > 0
        ? ((charges + mensualiteMax) / revenusPrisEnCompte) * 100
        : 0;

    const tAnnuel = (tauxCredit || 0) / 100;
    const i = tAnnuel / 12;
    const n = (dureeCredit || 0) * 12;
    let montantMax = 0;

    if (mensualiteMax > 0 && n > 0) {
      if (i === 0) {
        montantMax = mensualiteMax * n;
      } else {
        const facteur = Math.pow(1 + i, n);
        montantMax =
          mensualiteMax * ((facteur - 1) / (i * facteur));
      }
    }

    const tauxNotaire = 0.075;
    const tauxAgence = 0.04;
    const denom = 1 + tauxNotaire + tauxAgence;

    let prixBienMax = 0;

    if (montantMax > 0 && denom > 0) {
      prixBienMax = montantMax / denom;
    }

    setResult({
      revenusPrisEnCompte,
      chargesMensuelles: charges,
      tauxEndettementActuel: tauxActuel,
      tauxEndettementAvecProjet: tauxAvecProjet,
      mensualiteMax,
      montantMax,
      prixBienMax,
    });

    // On reste sur la même page, mais on peut scroll vers les résultats si besoin
    const anchor = document.getElementById("resultats-capacite-simple");
    if (anchor) {
      setTimeout(() => {
        anchor.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Card centrale */}
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-md p-5 sm:p-6 space-y-5">
        {/* Titre + sous-titre */}
        <div className="space-y-2">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600">
            Calculette gratuite
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            Estimez votre capacité d&apos;emprunt en 3 étapes
          </h1>
          <p className="text-xs text-slate-500">
            Une version simplifiée, idéale pour obtenir rapidement un ordre de
            grandeur de votre budget d&apos;achat. Pour une analyse ultra précise,
            vous pourrez passer ensuite à la version avancée.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-2 text-[0.7rem]">
          {[
            { id: 1, label: "Revenus" },
            { id: 2, label: "Charges" },
            { id: 3, label: "Crédit" },
          ].map((s) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="flex-1 flex items-center gap-2">
                <div
                  className={[
                    "h-6 w-6 rounded-full flex items-center justify-center text-[0.7rem] font-semibold",
                    isActive
                      ? "bg-slate-900 text-white"
                      : isDone
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {s.id}
                </div>
                <span
                  className={
                    "hidden sm:inline text-[0.7rem] " +
                    (isActive
                      ? "text-slate-900 font-semibold"
                      : "text-slate-500")
                  }
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Contenu de l'étape */}
        <div className="mt-2 space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-900">
                Étape 1 – Vos revenus mensuels
              </p>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">
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
                <p className="text-[0.7rem] text-slate-500">
                  Salaire net, primes régulières, revenus d&apos;activité…
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Autres revenus (€/mois)
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
                <p className="text-[0.7rem] text-slate-500">
                  Pensions, loyers, rentes… Si vous avez plusieurs biens
                  locatifs, vous pouvez saisir ici un montant déjà
                  &quot;nettoyé&quot;. La version avancée permet un calcul bien plus
                  fin, bien par bien.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-900">
                Étape 2 – Vos charges mensuelles
              </p>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Total de vos charges mensuelles (€/mois)
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
                <p className="text-[0.7rem] text-slate-500">
                  Loyer ou mensualité actuelle de logement, crédits en cours,
                  pensions, charges récurrentes importantes…
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">
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
                <p className="text-[0.7rem] text-slate-500">
                  La plupart des banques visent ~35 % d&apos;endettement, parfois
                  un peu plus selon le profil et le patrimoine.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-900">
                Étape 3 – Paramètres du futur crédit
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Taux de crédit envisagé (annuel, en %)
                  </label>
                  <input
                    type="number"
                    value={tauxCredit}
                    onChange={(e) =>
                      setTauxCredit(parseFloat(e.target.value) || 0)
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
                    value={dureeCredit}
                    onChange={(e) =>
                      setDureeCredit(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <p className="text-[0.7rem] text-slate-500">
                Ces paramètres servent à estimer un capital empruntable et un
                prix de bien indicatif. Ils ne constituent pas une offre de
                prêt.
              </p>
            </div>
          )}
        </div>

        {/* Boutons navigation */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={step === 1}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.8rem] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Précédent
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
            >
              Continuer
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-[0.8rem] font-semibold text-white shadow-md hover:shadow-lg"
            >
              Calculer ma capacité d&apos;emprunt
            </button>
          )}
        </div>
      </div>

      {/* Résultats épurés */}
      <div
        id="resultats-capacite-simple"
        className="w-full max-w-3xl space-y-4"
      >
        {result ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600 mb-1">
                Résultats indicatifs
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 mb-3">
                Ordre de grandeur de votre budget d&apos;achat
              </h2>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Mensualité maximale
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(result.mensualiteMax)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Capital empruntable
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(result.montantMax)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Prix de bien estimé*
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(result.prixBienMax)}
                  </p>
                  <p className="mt-1 text-[0.65rem] text-slate-500">
                    *En intégrant des frais de notaire et d&apos;agence dans le
                    financement.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Taux d&apos;endettement actuel
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(result.tauxEndettementActuel)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Après projet (théorique)
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPct(result.tauxEndettementAvecProjet)}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[0.7rem] text-slate-500">
                Ces résultats sont fournis à titre indicatif et ne remplacent
                pas une étude complète par une banque ou un courtier. Ils
                permettent néanmoins de positionner votre projet dans une
                fourchette réaliste.
              </p>
            </div>

            {/* Bloc marketing vers version avancée */}
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-1">
                  Aller plus loin
                </p>
                <p className="text-sm font-semibold text-slate-900 mb-1">
                  Obtenez une analyse bancaire détaillée de votre capacité
                  d&apos;emprunt.
                </p>
                <p className="text-[0.75rem] text-slate-600">
                  Version avancée : prise en compte détaillée de chaque crédit en
                  cours (immo, conso, auto…), loyers locatifs pondérés à 70 %,
                  génération de synthèse complète et sauvegarde dans votre
                  espace personnel.
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <Link
                  href="/mon-compte?mode=register&redirect=/capacite"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
                >
                  Créer mon espace et tester la version avancée
                </Link>
                <p className="text-[0.65rem] text-slate-500 max-w-xs text-right sm:text-right">
                  Gratuit pour le moment. La future version payante intégrera des
                  exports PDF, des scénarios multiples et l&apos;historique de vos
                  simulations.
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-[0.8rem] text-slate-500 text-center">
            Remplissez les 3 étapes ci-dessus pour afficher une première
            estimation de votre capacité d&apos;emprunt.
          </p>
        )}
      </div>
    </div>
  );
}
