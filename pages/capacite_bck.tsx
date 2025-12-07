// pages/capacite.tsx
import { useState } from "react";
import Link from "next/link";

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

export default function CapaciteEmpruntPage() {
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
  const [resumeCapacite, setResumeCapacite] = useState<ResumeCapacite | null>(
    null
  );
  const [resultCapaciteTexte, setResultCapaciteTexte] = useState<string>("");

  const hasResult = resumeCapacite !== null;

  // Gestion dynamique des crédits
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

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCalculCapacite = () => {
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

    // Taux d'endettement actuel (sans nouveau projet)
    const tauxActuel =
      revenusPrisEnCompte > 0
        ? ((chargesActuelles / revenusPrisEnCompte) * 100)
        : 0;

    // Taux avec projet si on emprunte au max
    const tauxAvecProjet =
      revenusPrisEnCompte > 0
        ? (((chargesActuelles + capaciteMensuelle) / revenusPrisEnCompte) *
            100)
        : 0;

    // Montant max empruntable avec cette mensualité (crédit)
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

    // --- Prix max du bien finançable (prix + notaire + agence, sans apport) ---
    const tauxNotaire = 0.075; // 7,5 % par défaut
    const tauxAgence = 0.04;   // 4 % par défaut
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

    const texte = [
      `Sur la base de revenus mensuels pris en compte de ${formatEuro(
        revenusPrisEnCompte
      )} (salaires, autres revenus et 70 % des loyers pour les biens locatifs), votre enveloppe maximale théorique à un taux d'endettement cible de ${formatPct(
        tauxEndettementCible
      )} est de ${formatEuro(enveloppeMax)}.`,
      `Vos charges récurrentes hors nouveau projet représentent actuellement ${formatEuro(
        chargesActuelles
      )} par mois, dont ${formatEuro(
        mensualitesExistantes
      )} de mensualités de crédits en cours et ${formatEuro(
        chargesHors
      )} d'autres charges (loyer, pensions, etc.).`,
      `Votre taux d'endettement actuel est d'environ ${formatPct(
        tauxActuel
      )}.`,
      capaciteMensuelle > 0
        ? `Dans ce cadre, la mensualité maximale disponible pour un nouveau crédit est de l'ordre de ${formatEuro(
            capaciteMensuelle
          )} par mois. Avec un taux d'intérêt cible de ${tauxCreditCible.toLocaleString(
            "fr-FR",
            { maximumFractionDigits: 2 }
          )} % sur ${dureeCreditCible} ans, cela correspond à un capital empruntable d'environ ${formatEuro(
            montantMax
          )}.`
        : `Dans ce cadre, il n'y a pas de capacité mensuelle disponible pour un nouveau crédit en restant à un taux d'endettement de ${formatPct(
            tauxEndettementCible
          )}.`,
      prixBienMax > 0
        ? `En supposant un financement couvrant le prix du bien, les frais de notaire (≈ 7,5 %) et les frais d'agence (≈ 4 %), cela vous permettrait de viser un bien d'environ ${formatEuro(
            prixBienMax
          )}, avec des frais de notaire estimés à ${formatEuro(
            fraisNotaireEstimes
          )} et des frais d'agence autour de ${formatEuro(
            fraisAgenceEstimes
          )}, soit un budget global proche de ${formatEuro(
            coutTotalProjetMax
          )} financé par la banque (hors éventuel apport personnel).`
        : `Avec la capacité actuelle calculée, la projection d'un prix de bien n'est pas pertinente : il est préférable de travailler d'abord sur la réduction des charges ou l'augmentation des revenus.`,
      capaciteMensuelle > 0
        ? `Avec ce nouveau crédit au maximum de votre capacité, votre taux d'endettement théorique atteindrait environ ${formatPct(
            tauxAvecProjet
          )}, ce qui reste dans la logique d'un plafond autour de ${formatPct(
            tauxEndettementCible
          )}, sous réserve des politiques internes de chaque banque.`
        : `Une optimisation de vos charges, un rachat de crédits ou un ajustement du projet (apport, budget, durée) pourrait être nécessaire pour améliorer votre capacité d'emprunt.`,
    ].join("\n");

    setResultCapaciteTexte(texte);
  };

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, idx) => (
      <p key={idx} className="text-sm text-slate-800 leading-relaxed">
        {line}
      </p>
    ));

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Estimez votre capacité d&apos;emprunt comme un courtier.
            </p>
          </div>
          <div className="text-xs text-slate-500 sm:text-right">
            <p>Outil indicatif, ne remplace pas une étude personnalisée.</p>
            <Link href="/" className="underline">
              &larr; Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-4">
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Bloc saisie */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                Étape 1
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Votre situation financière
              </h2>
              <p className="text-xs text-slate-500">
                Renseignez vos revenus, charges et crédits en cours pour
                obtenir une vision réaliste de votre capacité d&apos;emprunt.
              </p>
            </div>

            <div className="space-y-3">
              {/* Revenus */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-[0.75rem] font-medium text-slate-800">
                  Revenus mensuels du foyer
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">
                      Salaires nets mensuels (€)
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
                      Autres revenus mensuels (€)
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
                      placeholder="Pensions, bonus récurrents, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Charges hors crédits */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-[0.75rem] font-medium text-slate-800">
                  Charges mensuelles hors crédits
                </p>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Charges fixes (loyer, pensions, etc.) (€ / mois)
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
              </div>

              {/* Crédits en cours */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[0.75rem] font-medium text-slate-800">
                    Crédits en cours
                  </p>
                  <div className="flex items-center gap-1">
                    <label className="text-[0.7rem] text-slate-600">
                      Nombre de crédits
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={nbCredits}
                      onChange={(e) =>
                        handleNbCreditsChange(
                          parseInt(e.target.value || "0", 10)
                        )
                      }
                      className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right"
                    />
                  </div>
                </div>

                {Array.from({ length: nbCredits }).map((_, idx) => {
                  const type = typesCredits[idx] || "immo";
                  return (
                    <div
                      key={idx}
                      className="mt-2 border-t border-slate-200 pt-2 first:border-none first:mt-0 first:pt-0 space-y-2"
                    >
                      <p className="text-[0.7rem] text-slate-700 font-medium">
                        Crédit #{idx + 1}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <div className="space-y-1 sm:col-span-1">
                          <label className="text-[0.7rem] text-slate-700">
                            Type de crédit
                          </label>
                          <select
                            value={type}
                            onChange={(e) =>
                              handleTypeCreditChange(
                                idx,
                                e.target.value as TypeCredit
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="immo">Crédit immo</option>
                            <option value="perso">Crédit perso</option>
                            <option value="auto">Crédit auto</option>
                            <option value="conso">Crédit conso</option>
                          </select>
                        </div>
                        <div className="space-y-1 sm:col-span-1">
                          <label className="text-[0.7rem] text-slate-700">
                            Mensualité (€)
                          </label>
                          <input
                            type="number"
                            value={mensualitesCredits[idx] || 0}
                            onChange={(e) =>
                              handleMensualiteChange(
                                idx,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-1">
                          <label className="text-[0.7rem] text-slate-700">
                            Reste à payer (années)
                          </label>
                          <input
                            type="number"
                            value={resteAnneesCredits[idx] || 0}
                            onChange={(e) =>
                              handleResteAnneesChange(
                                idx,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-1">
                          <label className="text-[0.7rem] text-slate-700">
                            Taux crédit (%)
                          </label>
                          <input
                            type="number"
                            value={tauxCredits[idx] || 0}
                            onChange={(e) =>
                              handleTauxCreditChange(
                                idx,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      {type === "immo" && (
                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                            Revenu locatif brut lié à ce bien (€ / mois)
                            <InfoBadge text="Par prudence, la banque considère en général seulement 70 % des loyers pour calculer votre capacité d'emprunt, afin de tenir compte des charges, vacances locatives et aléas." />
                          </label>
                          <input
                            type="number"
                            value={revenusLocatifs[idx] || 0}
                            onChange={(e) =>
                              handleRevenuLocatifChange(
                                idx,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Paramétrage capacité */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-[0.75rem] font-medium text-slate-800">
                  Paramètres de capacité
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
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
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">
                      Taux crédit futur (%)
                    </label>
                    <input
                      type="number"
                      value={tauxCreditCible}
                      onChange={(e) =>
                        setTauxCreditCible(parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">
                      Durée envisagée (années)
                    </label>
                    <input
                      type="number"
                      value={dureeCreditCible}
                      onChange={(e) =>
                        setDureeCreditCible(parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCalculCapacite}
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-400/40 hover:shadow-2xl hover:shadow-sky-400/60 transition-transform active:scale-[0.99]"
                >
                  Calculer votre capacité d&apos;emprunt
                </button>
              </div>
            </div>
          </div>

          {/* Bloc résultats */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Résultat
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Capacité d&apos;emprunt estimée
                </h2>
                <p className="text-xs text-slate-500">
                  Taux d&apos;endettement actuel, marge disponible, capital
                  empruntable et prix de bien possible.
                </p>
              </div>

              {hasResult && (
                <button
                  onClick={handlePrintPDF}
                  className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300 transition-colors"
                >
                  PDF
                </button>
              )}
            </div>

            {hasResult ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 mt-1">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Revenus pris en compte
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeCapacite!.revenusPrisEnCompte)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Mensualités actuelles
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(
                        resumeCapacite!.mensualitesExistantes +
                          resumeCapacite!.chargesHorsCredits
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Taux d&apos;endettement actuel
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatPct(resumeCapacite!.tauxEndettementActuel)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Mensualité max disponible
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeCapacite!.mensualiteMax)}
                    </p>
                  </div>
                </div>

                {/* Bloc prix du bien */}
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 space-y-1 mt-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-700 mb-1">
                    Projection de prix de bien
                  </p>
                  {resumeCapacite!.prixBienMax > 0 ? (
                    <>
                      <p className="text-sm text-slate-900">
                        Avec cette capacité d&apos;emprunt et en supposant un
                        financement couvrant le prix du bien, les frais de
                        notaire (≈ 7,5 %) et les frais d&apos;agence (≈ 4 %),
                        vous pouvez viser un bien d&apos;environ{" "}
                        <span className="font-semibold">
                          {formatEuro(resumeCapacite!.prixBienMax)}
                        </span>
                        .
                      </p>
                      <p className="text-[0.75rem] text-slate-700">
                        Frais de notaire estimés :{" "}
                        <span className="font-semibold">
                          {formatEuro(resumeCapacite!.fraisNotaireEstimes)}
                        </span>
                        {" · "}Frais d&apos;agence estimés :{" "}
                        <span className="font-semibold">
                          {formatEuro(resumeCapacite!.fraisAgenceEstimes)}
                        </span>
                        {" · "}Budget global financé (hors apport éventuel) :{" "}
                        <span className="font-semibold">
                          {formatEuro(resumeCapacite!.coutTotalProjetMax)}
                        </span>
                        .
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-800">
                      Avec la configuration actuelle, il n&apos;est pas
                      possible de projeter un prix de bien cohérent : la
                      capacité mensuelle disponible pour un nouveau crédit est
                      nulle ou négative.
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mt-2">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                    Analyse détaillée
                  </p>
                  {renderMultiline(resultCapaciteTexte)}
                </div>

                <p className="mt-1 text-[0.7rem] text-slate-500">
                  Simulation indicative, hors assurance emprunteur détaillée,
                  frais de dossier, garanties et politique de risque propre à
                  chaque établissement.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Renseignez votre situation dans le panneau de gauche, puis
                cliquez sur &quot;Calculer votre capacité d&apos;emprunt&quot;
                pour afficher une estimation détaillée, avec le capital
                empruntable et un prix de bien cohérent (prix + notaire +
                agence).
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Simulations
          indicatives.
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
