// pages/capacite.tsx
import { useState } from "react";
import Link from "next/link";
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

  // Nouveau projet
  const [tauxCreditCible, setTauxCreditCible] = useState(3.5);
  const [dureeCreditCible, setDureeCreditCible] = useState(25);

  // Résultats
  const [resumeCapacite, setResumeCapacite] =
    useState<ResumeCapacite | null>(null);
  const [resultCapaciteTexte, setResultCapaciteTexte] = useState<string>("");

  // Sauvegarde projet
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
        ? ((chargesActuelles / revenusPrisEnCompte) * 100)
        : 0;

    const tauxAvecProjet =
      revenusPrisEnCompte > 0
        ? (((chargesActuelles + capaciteMensuelle) / revenusPrisEnCompte) *
            100)
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

    // Hypothèses moyennes pour les frais
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

    const texte = [
      `Sur la base de revenus mensuels pris en compte de ${formatEuro(
        revenusPrisEnCompte
      )} (salaires, autres revenus et 70 % des loyers pour les biens locatifs), votre enveloppe maximale théorique, avec un taux d’endettement cible de ${formatPct(
        tauxEndettementCible
      )}, est de ${formatEuro(enveloppeMax)}.`,
      `Vos charges récurrentes hors nouveau projet représentent actuellement ${formatEuro(
        chargesActuelles
      )} par mois, dont ${formatEuro(
        mensualitesExistantes
      )} de mensualités de crédits en cours et ${formatEuro(
        chargesHors
      )} d’autres charges (loyer, pensions, etc.).`,
      `Votre taux d’endettement actuel est d’environ ${formatPct(
        tauxActuel
      )}.`,
      capaciteMensuelle > 0
        ? `Dans ce cadre, la mensualité maximale disponible pour un nouveau crédit est de l’ordre de ${formatEuro(
            capaciteMensuelle
          )} par mois. Avec un taux d’intérêt cible de ${tauxCreditCible.toLocaleString(
            "fr-FR",
            { maximumFractionDigits: 2 }
          )} % sur ${dureeCreditCible} ans, cela correspond à un capital empruntable d’environ ${formatEuro(
            montantMax
          )}.`
        : `Dans ce cadre, il n’y a pas de capacité mensuelle disponible pour un nouveau crédit en restant sur un taux d’endettement cible de ${formatPct(
            tauxEndettementCible
          )}.`,
      prixBienMax > 0
        ? `En supposant un financement couvrant le prix du bien, les frais de notaire (≈ 7,5 %) et les frais d’agence (≈ 4 %), cela vous permettrait de viser un bien d’environ ${formatEuro(
            prixBienMax
          )}, avec des frais de notaire estimés à ${formatEuro(
            fraisNotaireEstimes
          )} et des frais d’agence autour de ${formatEuro(
            fraisAgenceEstimes
          )}, soit un budget global financé proche de ${formatEuro(
            coutTotalProjetMax
          )} (hors éventuel apport personnel supplémentaire).`
        : `Avec la capacité actuelle calculée, la projection d’un prix de bien n’est pas pertinente : il est préférable de travailler d’abord sur la réduction des charges ou l’augmentation des revenus.`,
      capaciteMensuelle > 0
        ? `Lecture bancaire : si vous utilisez pleinement cette capacité mensuelle, votre taux d’endettement théorique après projet atteindrait environ ${formatPct(
            tauxAvecProjet
          )}, ce qui reste cohérent avec un plafond cible de ${formatPct(
            tauxEndettementCible
          )}, sous réserve des politiques internes de chaque banque.`
        : `Une optimisation de vos charges, un rachat de crédits ou un ajustement du projet (apport, budget, durée) pourrait être nécessaire pour améliorer votre capacité d’emprunt avant de solliciter un financement.`,
    ].join("\n");

    setResultCapaciteTexte(texte);
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
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                Situation & charges
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Vos revenus et charges actuels
              </h2>
              <p className="text-xs text-slate-500">
                Revenus nets, charges fixes et crédits en cours. La base de
                calcul de votre taux d&apos;endettement.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Revenus nets mensuels du foyer (€)
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
                      setAutresRevenusMensuels(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700 flex items-center">
                  Charges mensuelles hors crédits (€)
                  <InfoBadge text="Loyer de résidence principale si vous êtes locataire, pensions alimentaires, crédits renouvelables, etc. Hors mensualités de crédits immobiliers ou personnels déclarés plus bas." />
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
                <label className="text-xs text-slate-700 flex items-center">
                  Taux d&apos;endettement cible (%)
                  <InfoBadge text="La plupart des banques travaillent avec un taux d’endettement cible autour de 30–35 % des revenus pris en compte, mais elles regardent aussi le reste à vivre." />
                </label>
                <input
                  type="number"
                  value={tauxEndettementCible}
                  onChange={(e) =>
                    setTauxEndettementCible(parseFloat(e.target.value) || 0)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="mt-2 pt-3 border-t border-slate-200 space-y-2">
                <label className="text-xs text-slate-700">
                  Nombre de crédits en cours
                </label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={nbCredits}
                  onChange={(e) =>
                    handleNbCreditsChange(parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

                {Array.from({ length: nbCredits }).map((_, idx) => (
                  <div
                    key={idx}
                    className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2"
                  >
                    <p className="text-[0.7rem] text-slate-700 font-semibold">
                      Crédit #{idx + 1}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Type de crédit
                        </label>
                        <select
                          value={typesCredits[idx] || "immo"}
                          onChange={(e) =>
                            handleTypeCreditChange(
                              idx,
                              e.target.value as TypeCredit
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="immo">Crédit immobilier</option>
                          <option value="perso">Crédit personnel</option>
                          <option value="auto">Crédit auto</option>
                          <option value="conso">Crédit conso / autre</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Mensualité actuelle (€)
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Années restantes (approx.)
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Taux du crédit (%)
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      {typesCredits[idx] === "immo" && (
                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700 flex items-center">
                            Revenu locatif brut mensuel (€)
                            <InfoBadge text="Pour un crédit immobilier locatif, indiquez le loyer perçu. 70 % de ce loyer sera pris en compte dans les revenus (30 % considérés en charges)." />
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
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Bloc paramètres de crédit + résultats */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                Nouveau projet
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Paramètres du crédit à simuler
              </h2>
              <p className="text-xs text-slate-500">
                Taux, durée et lecture de la mensualité maximale possible.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Taux crédit (annuel, en %)
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
                  Durée du crédit (années)
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
              <div className="flex items-end">
                <button
                  onClick={handleCalculCapacite}
                  className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-400/40 hover:shadow-2xl hover:shadow-emerald-400/60 transition-transform active:scale-[0.99]"
                >
                  Calculer la capacité
                </button>
              </div>
            </div>

            {resumeCapacite && (
              <>
                {/* Cartes de synthèse */}
                <div className="grid gap-3 sm:grid-cols-2 mt-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Revenus pris en compte
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeCapacite.revenusPrisEnCompte)}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Incluant 70 % des loyers des biens locatifs.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Mensualités de crédits existants
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatEuro(resumeCapacite.mensualitesExistantes)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Taux d&apos;endettement actuel
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatPct(resumeCapacite.tauxEndettementActuel)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Taux d&apos;endettement avec projet
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatPct(resumeCapacite.tauxEndettementAvecProjet)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-emerald-700 uppercase tracking-[0.14em]">
                      Mensualité maximale pour ce projet
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-800">
                      {formatEuro(resumeCapacite.mensualiteMax)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-emerald-700 uppercase tracking-[0.14em]">
                      Capital empruntable estimé
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-800">
                      {formatEuro(resumeCapacite.montantMax)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-1">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Projection de budget immobilier
                  </p>
                  <p className="text-sm text-slate-800">
                    Prix de bien envisageable :{" "}
                    <span className="font-semibold">
                      {formatEuro(resumeCapacite.prixBienMax)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-800">
                    Frais de notaire estimés (≈ 7,5 %) :{" "}
                    <span className="font-semibold">
                      {formatEuro(resumeCapacite.fraisNotaireEstimes)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-800">
                    Frais d&apos;agence estimés (≈ 4 %) :{" "}
                    <span className="font-semibold">
                      {formatEuro(resumeCapacite.fraisAgenceEstimes)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-800">
                    Budget global financé (hors apport) :{" "}
                    <span className="font-semibold">
                      {formatEuro(resumeCapacite.coutTotalProjetMax)}
                    </span>
                  </p>
                </div>

                {/* Boutons action */}
                <div className="mt-3 flex flex-wrap gap-3 items-center">
                  <button
                    onClick={handlePrintPDF}
                    className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300 transition-colors"
                  >
                    PDF
                  </button>

                  <button
                    onClick={handleSaveProject}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-900 px-4 py-1.5 text-[0.7rem] font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? "Enregistrement..." : "Sauvegarder ce projet"}
                  </button>

                  {saveMessage && (
                    <p className="text-[0.7rem] text-slate-600">
                      {saveMessage}{" "}
                      {saveMessage.startsWith("✅") && (
                        <Link
                          href="/projets"
                          className="underline font-medium"
                        >
                          Voir mes projets
                        </Link>
                      )}
                    </p>
                  )}
                </div>

                {/* Analyse narrative */}
                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                    Analyse détaillée
                  </p>
                  {renderMultiline(resultCapaciteTexte)}
                  <p className="mt-2 text-[0.7rem] text-slate-500">
                    Ces éléments restent indicatifs et ne tiennent pas compte
                    de l&apos;ensemble des critères qualitatifs analysés par les
                    banques (stabilité professionnelle, gestion de compte,
                    épargne de précaution, patrimoine global, etc.).
                  </p>
                </div>
              </>
            )}
          </section>
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
