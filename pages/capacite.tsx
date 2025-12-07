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
    val.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %"
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
  mensualiteAssurance: number;
};

export default function CapaciteEmpruntPage() {
  // Situation
  const [revenusNetMensuels, setRevenusNetMensuels] = useState(4000);
  const [autresRevenusMensuels, setAutresRevenusMensuels] = useState(0);
  const [chargesMensuellesHorsCredits, setChargesMensuellesHorsCredits] =
    useState(0);
  const [tauxEndettementCible, setTauxEndettementCible] = useState(35);

  // Crédits existants
  const [nbCredits, setNbCredits] = useState(0);
  const [typesCredits, setTypesCredits] = useState<TypeCredit[]>([]);
  const [mensualitesCredits, setMensualitesCredits] = useState<number[]>([]);
  const [resteAnneesCredits, setResteAnneesCredits] = useState<number[]>([]);
  const [tauxCredits, setTauxCredits] = useState<number[]>([]);
  const [revenusLocatifs, setRevenusLocatifs] = useState<number[]>([]);

  // Nouveau crédit
  const [tauxCreditCible, setTauxCreditCible] = useState(3.5);
  const [dureeCreditCible, setDureeCreditCible] = useState(25);
  const [tauxAssuranceEmp, setTauxAssuranceEmp] = useState(0.25); // % annuel du capital

  // Résultats
  const [resumeCapacite, setResumeCapacite] =
    useState<ResumeCapacite | null>(null);
  const [analyseTexte, setAnalyseTexte] = useState<string>("");
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
        ? ((chargesActuelles + capaciteMensuelle) / revenusPrisEnCompte) * 100
        : 0;

    // Conversion capacité mensuelle -> capital max
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

    // Assurance emprunteur
    const tAss = (tauxAssuranceEmp || 0) / 100;
    const annuiteAssurance = montantMax * tAss;
    const mensualiteAssurance = annuiteAssurance / 12;

    // Hypothèse : la mensualité max inclut crédit + assurance
    // Ici on garde montantMax comme estimation de capital empruntable,
    // et on affiche la mensualité d'assurance pour information.

    // Estimation prix du bien : montantMax = bien + notaire + agence
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
      mensualiteAssurance,
    };

    setResumeCapacite(resume);

    // Analyse narrative
    const lignes: string[] = [];

    lignes.push(
      `Vos revenus pris en compte (salaires, autres revenus, et 70 % des loyers pour les biens locatifs) ressortent à environ ${formatEuro(
        revenusPrisEnCompte
      )} par mois.`
    );

    lignes.push(
      `Vos charges actuelles représentent ${formatEuro(
        chargesActuelles
      )} par mois, dont ${formatEuro(
        mensualitesExistantes
      )} de mensualités de crédits en cours et ${formatEuro(
        chargesHors
      )} d'autres charges récurrentes (loyer, pensions, etc.).`
    );

    lignes.push(
      `Sur cette base, votre taux d'endettement actuel est proche de ${formatPct(
        tauxActuel
      )}.`
    );

    if (capaciteMensuelle > 0) {
      lignes.push(
        `En visant un taux d'endettement cible de ${formatPct(
          tauxEndettementCible
        )}, l’enveloppe globale disponible pour vos charges (crédits inclus) serait d’environ ${formatEuro(
          enveloppeMax
        )} par mois. La capacité théorique restante pour un nouveau crédit est donc de l’ordre de ${formatEuro(
          capaciteMensuelle
        )} par mois.`
      );

      lignes.push(
        `Avec un taux d'intérêt de ${tauxCreditCible.toLocaleString("fr-FR", {
          maximumFractionDigits: 2,
        })} % sur ${dureeCreditCible} ans, cette mensualité permettrait de financer un capital d’environ ${formatEuro(
          montantMax
        )}.`
      );

      if (prixBienMax > 0) {
        lignes.push(
          `En supposant que ce capital couvre le prix du bien, les frais de notaire (environ 7,5 %) et les frais d'agence (environ 4 %), cela vous positionne sur un bien d’un prix approximatif de ${formatEuro(
            prixBienMax
          )}. Les frais de notaire seraient alors de l’ordre de ${formatEuro(
            fraisNotaireEstimes
          )} et les frais d'agence d’environ ${formatEuro(
            fraisAgenceEstimes
          )}, pour un budget global financé proche de ${formatEuro(
            coutTotalProjetMax
          )} (hors éventuel apport personnel).`
        );
      }

      lignes.push(
        `En intégrant ce nouveau crédit au maximum de votre capacité, votre taux d'endettement théorique atteindrait environ ${formatPct(
          tauxAvecProjet
        )}. Ce niveau reste cohérent avec les pratiques courantes de nombreuses banques, tout en restant dépendant de leur politique interne et de votre profil global.`
      );

      if (mensualiteAssurance > 0) {
        lignes.push(
          `L'assurance emprunteur associée à ce montage représenterait environ ${formatEuro(
            mensualiteAssurance
          )} par mois, incluse dans l’enveloppe globale de mensualité que la banque analysera.`
        );
      }
    } else {
      lignes.push(
        `Avec vos charges actuelles et un taux d'endettement cible de ${formatPct(
          tauxEndettementCible
        )}, il n’apparaît pas de capacité mensuelle disponible pour un nouveau crédit. Il peut être pertinent d’étudier une réduction de certaines charges, un rachat de crédits ou un projet avec davantage d’apport pour retrouver une marge de manœuvre.`
      );
    }

    lignes.push(
      `Ces éléments constituent une base de travail pour vos échanges avec un courtier ou votre conseiller bancaire : ils ne remplacent pas une étude personnalisée, mais vous permettent de cadrer rapidement le budget réaliste de votre prochain projet.`
    );

    setAnalyseTexte(lignes.join("\n"));
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
        title: "Simulation capacité d'emprunt",
        data: {
          resume: resumeCapacite,
          analyse: analyseTexte,
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
      <p key={idx} className="text-sm text-slate-800 leading-relaxed mb-1.5">
        {line}
      </p>
    ));

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Calculette de capacité d&apos;emprunt – niveau courtier.
            </p>
          </div>
          <div className="text-xs text-slate-500 sm:text-right">
            <p>Simulations indicatives, hors décision bancaire.</p>
            <Link href="/" className="underline">
              &larr; Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* COLONNE GAUCHE : FORMULAIRE */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                Paramètres de votre situation
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Revenus, charges et crédits en cours
              </h2>
              <p className="text-xs text-slate-500">
                Renseignez votre situation actuelle pour simuler une capacité
                d&apos;emprunt réaliste, dans la logique des grilles bancaires.
              </p>
            </div>

            {/* Revenus & charges */}
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
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
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Charges hors crédits (€/mois)
                    <InfoBadge text="Loyer de résidence principale, pensions, crédits renouvelables non saisis ci-dessous, etc." />
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

              <div className="space-y-1">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Taux d&apos;endettement cible (%)
                  <InfoBadge text="Les banques se basent souvent sur un plafond autour de 35 % d'endettement, à ajuster en fonction de votre profil." />
                </label>
                <input
                  type="number"
                  value={tauxEndettementCible}
                  onChange={(e) =>
                    setTauxEndettementCible(parseFloat(e.target.value) || 0)
                  }
                  className="w-full max-w-[180px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Crédits en cours */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Crédits en cours
                  </p>
                  <p className="text-[0.7rem] text-slate-500">
                    Déclarez chaque crédit pour approcher la logique de calcul
                    bancaire.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[0.7rem] text-slate-600">
                    Nombre de crédits
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={nbCredits}
                    onChange={(e) =>
                      handleNbCreditsChange(
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {Array.from({ length: nbCredits }).map((_, idx) => {
                const type = typesCredits[idx] || "immo";
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.7rem] font-semibold text-slate-700 uppercase tracking-[0.14em]">
                        Crédit #{idx + 1}
                      </p>
                      <select
                        value={type}
                        onChange={(e) =>
                          handleTypeCreditChange(
                            idx,
                            e.target.value as TypeCredit
                          )
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[0.75rem] text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="immo">Crédit immobilier</option>
                        <option value="auto">Crédit auto</option>
                        <option value="perso">Crédit personnel</option>
                        <option value="conso">Crédit conso / divers</option>
                      </select>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-4">
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Reste à courir (années)
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">
                          Taux du crédit (annuel, %)
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
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      {type === "immo" && (
                        <div className="space-y-1">
                          <label className="text-[0.7rem] text-slate-700 flex items-center gap-1">
                            Loyer associé (€/mois)
                            <InfoBadge text="Pour les prêts immobilier locatifs, les banques intègrent souvent 70 % du loyer pour compenser la mensualité." />
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
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paramètres du crédit à simuler */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Paramètres du crédit à simuler
                </p>
                <p className="text-[0.7rem] text-slate-500">
                  Taux, durée et assurance pour estimer le capital finançable.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Taux crédit (annuel, %)
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
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Taux assurance emprunteur (annuel, %)
                    <InfoBadge text="Taux annuel appliqué au capital emprunté. Valeur indicative, souvent entre 0,20 et 0,40 % pour un contrat groupe." />
                  </label>
                  <input
                    type="number"
                    value={tauxAssuranceEmp}
                    onChange={(e) =>
                      setTauxAssuranceEmp(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Bouton calcul */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[0.7rem] text-slate-500 max-w-sm">
                Cliquez sur « Calculer ma capacité » pour obtenir un ordre de
                grandeur du capital finançable et du prix de bien compatible
                avec votre situation.
              </p>
              <button
                onClick={handleCalculCapacite}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-400/40 hover:shadow-2xl hover:shadow-emerald-400/60 transition-transform active:scale-[0.99]"
              >
                Calculer ma capacité
              </button>
            </div>
          </section>

          {/* COLONNE DROITE : RÉSULTATS */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-600 mb-1">
                  Résultats & interprétation
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Synthèse de votre capacité d&apos;emprunt
                </h2>
                <p className="text-xs text-slate-500">
                  Vue d&apos;ensemble des montants, des taux d&apos;endettement
                  et du budget immobilier associé.
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
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5">
                    <p className="text-[0.7rem] text-emerald-800 uppercase tracking-[0.14em]">
                      Mensualité maximale
                    </p>
                    <p className="mt-1 text-lg font-semibold text-emerald-900">
                      {formatEuro(resumeCapacite!.mensualiteMax)}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-emerald-900/80">
                      Enveloppe théorique pour un nouveau crédit (crédit +
                      assurance inclus).
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Capital finançable estimé
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {formatEuro(resumeCapacite!.montantMax)}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Montant indicatif du prêt possible dans ce cadre.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Prix de bien cible
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {resumeCapacite!.prixBienMax > 0
                        ? formatEuro(resumeCapacite!.prixBienMax)
                        : "-"}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      En intégrant des frais de notaire (~7,5 %) et d&apos;agence
                      (~4 %).
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Taux d&apos;endettement
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      Actuel : {formatPct(resumeCapacite!.tauxEndettementActuel)}
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      Après projet :{" "}
                      {formatPct(resumeCapacite!.tauxEndettementAvecProjet)}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      À comparer à votre cible de{" "}
                      {formatPct(tauxEndettementCible)}.
                    </p>
                  </div>
                </div>

                {/* Analyse narrative */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                    Analyse détaillée
                  </p>
                  {renderMultiline(analyseTexte)}
                </div>

                {/* Actions & sauvegarde */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[0.7rem] text-slate-500 max-w-sm">
                    Ces résultats ne constituent pas une offre de prêt, mais
                    peuvent servir de support structuré lors d&apos;un rendez-vous
                    avec votre banque ou votre courtier.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCalculCapacite}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Recalculer
                    </button>
                    <button
                      disabled={saving}
                      onClick={handleSaveProject}
                      className="rounded-full bg-slate-900 px-4 py-2 text-[0.75rem] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {saving ? "Sauvegarde..." : "Sauvegarder dans mon espace"}
                    </button>
                  </div>
                </div>
                {saveMessage && (
                  <p className="text-[0.7rem] text-slate-600 mt-1">
                    {saveMessage}
                  </p>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-500 text-center max-w-xs">
                  Renseignez votre situation dans la colonne de gauche puis
                  cliquez sur « Calculer ma capacité » pour afficher ici une
                  synthèse chiffrée et une analyse détaillée.
                </p>
              </div>
            )}
          </section>
        </div>
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
