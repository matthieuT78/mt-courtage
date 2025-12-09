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

// 🔼 Bloc marketing version complète / payante (affiché après la simulation)
function UpsellBloc() {
  return (
    <section className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 space-y-2">
      <p className="text-[0.75rem] font-semibold text-slate-900">
        Aller plus loin que la simple capacité d&apos;emprunt
      </p>
      <p className="text-[0.75rem] text-slate-700">
        Vous venez d&apos;obtenir une estimation structurée de votre capacité
        d&apos;emprunt. C&apos;est une excellente base pour discuter avec votre
        banque ou votre courtier.  
        La version complète de l&apos;outil vous permet ensuite de :
      </p>
      <ul className="text-[0.75rem] text-slate-700 list-disc pl-4 space-y-1">
        <li>
          simuler précisément un{" "}
          <span className="font-semibold">investissement locatif</span> (loyers,
          charges, fiscalité, cash-flow) ;
        </li>
        <li>
          anticiper un{" "}
          <span className="font-semibold">achat revente / prêt relais</span> avec
          différents scénarios ;
        </li>
        <li>
          analyser la{" "}
          <span className="font-semibold">
            performance globale de votre parc immobilier existant
          </span>
          .
        </li>
      </ul>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link
          href="/mon-compte?mode=register"
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Créer mon espace et débloquer les calculettes avancées
        </Link>
        <p className="text-[0.7rem] text-slate-500">
          Actuellement réservées aux utilisateurs inscrits – la{" "}
          <span className="font-semibold">version payante</span> intégrera
          bientôt des fonctionnalités supplémentaires (export PDF enrichi,
          scénarios multiples, suivi dans le temps…).
        </p>
      </div>
    </section>
  );
}

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
  const [resumeCapacite, setResumeCapacite] =
    useState<ResumeCapacite | null>(null);
  const [resultCapaciteTexte, setResultCapaciteTexte] = useState<string>("");

  // Sauvegarde
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hasResult = !!resumeCapacite;

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

    const lignes: string[] = [
      `Vos revenus mensuels pris en compte (salaires, autres revenus et 70 % des loyers locatifs) s’élèvent à ${formatEuro(
        revenusPrisEnCompte
      )}. Avec un taux d’endettement cible de ${formatPct(
        tauxEndettementCible
      )}, l’enveloppe maximale théorique que la banque peut consacrer à l’ensemble de vos charges de crédit et charges récurrentes est d’environ ${formatEuro(
        enveloppeMax
      )}.`,
      `Aujourd’hui, vos charges récurrentes hors nouveau projet représentent ${formatEuro(
        chargesActuelles
      )} par mois, dont ${formatEuro(
        mensualitesExistantes
      )} de mensualités de crédits en cours et ${formatEuro(
        chargesHors
      )} d’autres charges (loyer, pensions, etc.). Cela correspond à un taux d’endettement actuel d’environ ${formatPct(
        tauxActuel
      )}.`,
      capaciteMensuelle > 0
        ? `Dans ce cadre, la mensualité maximale disponible pour un nouveau crédit est de l’ordre de ${formatEuro(
            capaciteMensuelle
          )} par mois. En simulant un financement à ${tauxCreditCible.toLocaleString(
            "fr-FR",
            { maximumFractionDigits: 2 }
          )} % sur ${dureeCreditCible} ans, cela correspond à un capital empruntable d’environ ${formatEuro(
            montantMax
          )}.`
        : `Avec votre niveau de revenus et de charges, la capacité mensuelle disponible pour un nouveau crédit est nulle si l’on reste sur un taux d’endettement cible de ${formatPct(
            tauxEndettementCible
          )}.`,
      prixBienMax > 0
        ? `En supposant que le crédit finance le prix du bien, les frais de notaire (≈ 7,5 %) et les frais d’agence (≈ 4 %), vous pouvez viser un bien d’environ ${formatEuro(
            prixBienMax
          )}. Les frais de notaire seraient de l’ordre de ${formatEuro(
            fraisNotaireEstimes
          )} et les honoraires d’agence autour de ${formatEuro(
            fraisAgenceEstimes
          )}, soit un budget global financé proche de ${formatEuro(
            coutTotalProjetMax
          )} hors éventuel apport personnel supplémentaire.`
        : `Dans l’état actuel des paramètres, la projection d’un prix de bien n’est pas pertinente : il est préférable de retravailler le projet (budget, durée, apport) ou de réduire les charges avant de solliciter une nouvelle banque.`,
      capaciteMensuelle > 0
        ? `Si vous utilisez pleinement cette capacité mensuelle, votre taux d’endettement théorique après projet atteindrait environ ${formatPct(
            tauxAvecProjet
          )}. Ce niveau reste dans l’esprit d’un plafond de 35 %–40 %, sous réserve bien sûr des politiques internes de chaque établissement et de l’analyse qualitative de votre dossier (stabilité professionnelle, épargne, comportement de compte…).`
        : `Une optimisation de vos charges, un rachat de crédits ou un apport plus important peuvent améliorer significativement votre capacité d’emprunt avant de présenter votre projet à une banque ou à un courtier.`,
    ];

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
      {/* ✅ Header commun */}
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-4">
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Colonne gauche : saisie */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                Calculette
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Situation actuelle & paramètres du crédit
              </h2>
              <p className="text-xs text-slate-500">
                Renseignez vos revenus, charges, crédits en cours et le type de
                financement envisagé pour le futur projet.
              </p>
            </div>

            <div className="space-y-3">
              {/* Revenus */}
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
                  Autres revenus (pensions, loyers, etc.) (€/mois)
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

              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Autres charges mensuelles hors crédits (loyer, pensions, etc.)
                  (€/mois)
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

              {/* Taux cible */}
              <div className="space-y-1">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Taux d&apos;endettement cible (%)
                  <InfoBadge text="La plupart des banques travaillent autour de 33 % à 35 % d’endettement, parfois un peu plus selon le profil et le patrimoine." />
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

              {/* Crédits en cours */}
              <div className="space-y-2">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Nombre de crédits en cours
                  <InfoBadge text="Détaillez vos crédits pour une vision proche de l’analyse bancaire : type, mensualité, durée restante, loyer associé pour les prêts immobiliers locatifs." />
                </label>
                <input
                  type="number"
                  value={nbCredits}
                  min={0}
                  max={5}
                  onChange={(e) =>
                    handleNbCreditsChange(parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

                {Array.from({ length: nbCredits }).map((_, index) => (
                  <div
                    key={index}
                    className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 space-y-2"
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
                            70 % de ce loyer sera intégré à vos revenus, comme le
                            font les banques pour un bien locatif.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paramètres du nouveau crédit */}
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                  Paramètres du crédit à simuler
                  <InfoBadge text="Ces paramètres servent uniquement à estimer le capital que vous pourriez emprunter et un ordre de grandeur du prix de bien accessible." />
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Taux crédit (annuel, en %)
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
                  <div className="space-y-1">
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
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={handleCalculCapacite}
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-2xl active:scale-[0.99]"
                >
                  Calculer ma capacité d&apos;emprunt
                </button>
              </div>
            </div>
          </div>

          {/* Colonne droite : résultats */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Résultats
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Synthèse & lecture bancaire
                </h2>
                <p className="text-xs text-slate-500">
                  Montant théorique, prix de bien estimé et taux d&apos;endettement
                  après projet.
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
                  <p className="text-[0.65rem] text-slate-500 max-w-[200px] text-right">
                    La sauvegarde nécessite un compte. Vous serez invité à vous
                    connecter ou à créer un espace si ce n&apos;est pas déjà fait.
                  </p>
                  {saveMessage && (
                    <p className="text-[0.65rem] text-slate-500 max-w-[190px] text-right">
                      {saveMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            {hasResult ? (
              <>
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
                      Incluant frais de notaire (~7,5 %) et d&apos;agence (~4 %)
                      dans le financement.
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Taux d&apos;endettement après projet
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatPct(resumeCapacite!.tauxEndettementAvecProjet)}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Taux actuel :{" "}
                      {formatPct(resumeCapacite!.tauxEndettementActuel)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                    Analyse détaillée
                  </p>
                  {renderMultiline(resultCapaciteTexte)}
                  <p className="mt-2 text-[0.7rem] text-slate-500">
                    Ces calculs sont indicatifs et ne tiennent pas compte de la
                    fiscalité, ni de l&apos;analyse qualitative complète (profil,
                    historique bancaire, patrimoine…).
                  </p>
                </div>

                {/* 🔼 Bloc marketing version complète */}
                <UpsellBloc />
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Lancez une simulation pour afficher une estimation détaillée de
                votre capacité d&apos;emprunt et un ordre de grandeur du prix de bien
                accessible.
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
