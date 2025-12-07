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

    // Calcul du capital max empruntable
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

    // Prix du bien max en intégrant notaire + agence (par défaut)
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

    // --- Analyse narrative structurée ---
    const texte = [
      `Profil de revenus : vos revenus mensuels pris en compte, incluant salaires, autres revenus et 70 % des loyers des biens locatifs, s’élèvent à ${formatEuro(
        revenusPrisEnCompte
      )}.`,
      `Situation actuelle (hors nouveau projet) : vos charges récurrentes représentent ${formatEuro(
        chargesActuelles
      )} par mois, dont ${formatEuro(
        mensualitesExistantes
      )} de mensualités de crédits en cours et ${formatEuro(
        chargesHors
      )} d’autres charges (loyer, pensions, crédits à la consommation, etc.). Cela se traduit par un taux d’endettement actuel d’environ ${formatPct(
        tauxActuel
      )}.`,
      capaciteMensuelle > 0
        ? `Capacité mensuelle pour un nouveau crédit : en visant un taux d’endettement cible de ${formatPct(
            tauxEndettementCible
          )}, l’enveloppe maximale théorique destinée à l’ensemble de vos charges est de ${formatEuro(
            enveloppeMax
          )} par mois. Une fois vos charges actuelles déduites, la mensualité disponible pour un nouveau prêt ressort à environ ${formatEuro(
            capaciteMensuelle
          )}.`
        : `Capacité mensuelle pour un nouveau crédit : avec un taux d’endettement cible de ${formatPct(
            tauxEndettementCible
          )}, l’ensemble de vos charges actuelles ne laisse pas de marge pour une nouvelle mensualité de crédit. La priorité serait de réduire certaines charges ou de renégocier des encours.`,
      montantMax > 0
        ? `Capital empruntable : avec une mensualité maximale de ${formatEuro(
            capaciteMensuelle
          )}, un taux d’intérêt de ${tauxCreditCible.toLocaleString("fr-FR", {
            maximumFractionDigits: 2,
          })} % sur ${dureeCreditCible} ans permet d’envisager un capital empruntable d’environ ${formatEuro(
            montantMax
          )}.`
        : `Capital empruntable : dans la configuration actuelle, le calcul ne fait pas apparaître de capital empruntable cohérent avec le taux cible retenu et la durée envisagée.`,
      prixBienMax > 0
        ? `Prix du bien et budget global indicatifs : en supposant un financement couvrant le prix du bien ainsi que les frais de notaire (≈ 7,5 %) et de mise en relation / agence (≈ 4 %), le prix de bien théorique que vous pourriez viser se situe autour de ${formatEuro(
            prixBienMax
          )}. Les frais de notaire seraient alors estimés à ${formatEuro(
            fraisNotaireEstimes
          )}, et les frais d’agence à environ ${formatEuro(
            fraisAgenceEstimes
          )}, soit un budget global financé proche de ${formatEuro(
            coutTotalProjetMax
          )}, hors éventuel apport personnel supplémentaire.`,
      capaciteMensuelle > 0
        ? `Lecture bancaire : si vous utilisez pleinement cette capacité mensuelle, votre taux d’endettement théorique après projet atteindrait environ ${formatPct(
            tauxAvecProjet
          )}. Ce niveau reste dans l’esprit d’un plafond autour de ${formatPct(
            tauxEndettementCible
          )}, sous réserve des critères internes de chaque établissement (stabilité professionnelle, historique de compte, reste-à-vivre, etc.).`
        : `Lecture bancaire : en l’état, un financement supplémentaire risque d’être difficile à faire accepter. Une optimisation préalable (rachat de crédits, diminution de certaines charges, augmentation de revenus, apport plus important) pourrait améliorer sensiblement votre capacité d’emprunt et la lecture de votre dossier.`,
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
    text.split("\n").map((line, idx) => {
      const [label, ...rest] = line.split(":");
      const hasLabel = rest.length > 0;
      const content = rest.join(":").trim();

      return (
        <div key={idx} className="mb-2">
          {hasLabel ? (
            <p className="text-sm text-slate-800 leading-relaxed">
              <span className="font-semibold text-slate-900">
                {label.trim()}
                {": "}
              </span>
              {content}
            </p>
          ) : (
            <p className="text-sm text-slate-800 leading-relaxed">{line}</p>
          )}
        </div>
      );
    });

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
        <section className="grid gap-4 lg:grid-cols-2 items-start">
          {/* Colonne gauche : formulaire */}
          <div className="space-y-4">
            {/* Situation financière */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Étape 1
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Situation financière
                </h2>
                <p className="text-xs text-slate-500">
                  Revenus, charges hors crédits et taux d&apos;endettement cible.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
                    Autres revenus (pensions, etc.) (€/mois)
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Charges hors crédits (loyer, pensions…) (€/mois)
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
                  <label className="text-xs text-slate-700">
                    Taux d&apos;endettement cible (%)
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
              </div>
            </section>

            {/* Crédits en cours */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Étape 2
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Crédits en cours
                </h2>
                <p className="text-xs text-slate-500">
                  Détaillez vos prêts actuels. Pour les prêts immo, les loyers
                  associés sont pris à 70 % comme le font les banques.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-700">
                  Nombre de crédits en cours (0 à 5)
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
              </div>

              {Array.from({ length: nbCredits }).map((_, idx) => {
                const type = typesCredits[idx] || "immo";
                return (
                  <div
                    key={idx}
                    className="mt-3 border-t border-slate-200 pt-3 space-y-2"
                  >
                    <p className="text-[0.7rem] text-slate-700 font-medium">
                      Crédit #{idx + 1}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Type
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
                      <div className="space-y-1">
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {type === "immo" && (
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700 flex items-center">
                          Loyer mensuel associé au bien (€)
                          <InfoBadge text="Pour un crédit immo locatif, 70 % du loyer est ajouté à vos revenus pour simuler la manière dont les banques traitent ce type de dossier." />
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
            </section>

            {/* Paramètres du nouveau crédit */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Étape 3
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Nouveau projet de financement
                </h2>
                <p className="text-xs text-slate-500">
                  Taux d&apos;intérêt et durée envisagés pour le futur prêt.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  onClick={handleCalculCapacite}
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-400/40 hover:shadow-2xl hover:shadow-emerald-400/60 transition-transform active:scale-[0.99]"
                >
                  Calculer ma capacité d&apos;emprunt
                </button>
                <p className="text-xs text-slate-500">
                  Le calcul se base sur un fonctionnement proche d&apos;une analyse
                  bancaire : revenus, charges, encours et taux cible.
                </p>
              </div>
            </section>
          </div>

          {/* Colonne droite : résultats */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-600 mb-1">
                    Synthèse de la capacité
                  </p>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Résultat simulé
                  </h2>
                  <p className="text-xs text-slate-500">
                    Montant empruntable, prix de bien cible et impact sur
                    votre taux d&apos;endettement.
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {hasResult && (
                    <button
                      onClick={handlePrintPDF}
                      className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300 transition-colors"
                    >
                      PDF
                    </button>
                  )}
                </div>
              </div>

              {hasResult ? (
                <>
                  {/* Cartes principales */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Mensualité max pour le nouveau crédit
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatEuro(resumeCapacite!.mensualiteMax)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Capital maximum empruntable
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatEuro(resumeCapacite!.montantMax)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Prix de bien indicatif
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatEuro(resumeCapacite!.prixBienMax)}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-slate-500">
                        En intégrant des frais de notaire (~7,5 %) et d&apos;agence (~4 %)
                        dans le financement.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                        Taux d&apos;endettement après projet
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatPct(resumeCapacite!.tauxEndettementAvecProjet)}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-slate-500">
                        Comparé à votre taux actuel de{" "}
                        {formatPct(resumeCapacite!.tauxEndettementActuel)}.
                      </p>
                    </div>
                  </div>

                  {/* Analyse narrative */}
                  <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-3">
                      Analyse détaillée de votre capacité d&apos;emprunt
                    </p>
                    {renderMultiline(resultCapaciteTexte)}
                  </div>

                  {/* Bouton de sauvegarde */}
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      onClick={handleSaveProject}
                      disabled={saving}
                      className="inline-flex items-center rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                    >
                      {saving
                        ? "Sauvegarde en cours..."
                        : "Enregistrer cette simulation"}
                    </button>
                    {saveMessage && (
                      <p className="text-[0.7rem] text-slate-500">
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
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Renseignez votre situation financière, vos crédits en cours et
                  les paramètres du futur prêt, puis cliquez sur{" "}
                  <span className="font-semibold">
                    “Calculer ma capacité d&apos;emprunt”
                  </span>{" "}
                  pour afficher une synthèse exploitable en rendez-vous bancaire.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                Note importante
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ces calculs sont fournis à titre indicatif et ne remplacent pas une
                étude personnalisée. Chaque banque applique ses propres règles
                (reste-à-vivre, politique interne, type de contrat de travail,
                patrimoine, etc.). Utilisez ce simulateur comme un outil de
                préparation pour structurer votre projet et vos échanges avec un
                conseiller ou un courtier.
              </p>
            </section>
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
