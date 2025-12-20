// pages/pret-relais.tsx
import { useState } from "react";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient"; // 👉 ajout pour la sauvegarde

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
      <span className="pointer-events-none absolute left-1/2 top-[125%] z-20 hidden w-72 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-[0.7rem] text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

type ResumeRelais = {
  montantRelais: number;
  mensualiteNouveauMax: number;
  capitalNouveau: number;
  budgetMax: number;
};

export default function PretRelaisPage() {
  // Revenus & charges
  const [revMensuels, setRevMensuels] = useState(4500);
  const [autresMensualites, setAutresMensualites] = useState(0); // hors bien actuel
  const [tauxEndettement, setTauxEndettement] = useState(35);

  // Bien actuel
  const [valeurBienActuel, setValeurBienActuel] = useState(400000);
  const [crdActuel, setCrdActuel] = useState(200000);
  const [pctRetenu, setPctRetenu] = useState(70); // % retenu par la banque

  // Prêt relais (juste pour info)
  const [tauxRelais, setTauxRelais] = useState(4); // annuel, en %

  // Nouveau projet
  const [apportPerso, setApportPerso] = useState(30000);
  const [tauxNouveau, setTauxNouveau] = useState(3.5); // annuel, en %
  const [dureeNouveau, setDureeNouveau] = useState(25); // années
  const [prixCible, setPrixCible] = useState(450000); // pour comparer

  const [resume, setResume] = useState<ResumeRelais | null>(null);
  const [texteDetail, setTexteDetail] = useState<string>("");

  // Sauvegarde projet
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleCalculRelais = () => {
    setSaveMessage(null); // on reset le message de sauvegarde à chaque nouveau calcul

    const revenus = revMensuels || 0;
    const autresMens = autresMensualites || 0;
    const endettementMax = (tauxEndettement || 35) / 100;

    const valeur = valeurBienActuel || 0;
    const crd = crdActuel || 0;
    const pct = (pctRetenu || 70) / 100;
    const tRelaisAnnuel = (tauxRelais || 0) / 100;

    const apport = apportPerso || 0;
    const tNouveauAnnuel = (tauxNouveau || 0) / 100;
    const tNouveauMensuel = tNouveauAnnuel / 12;
    const nMois = (dureeNouveau || 0) * 12;

    if (revenus <= 0 || valeur <= 0 || nMois <= 0) {
      setTexteDetail(
        "Merci de renseigner des valeurs cohérentes (revenus, bien actuel, durée du nouveau crédit, etc.)."
      );
      setResume(null);
      return;
    }

    // 1) Montant théorique du prêt relais
    const relaisBrut = valeur * pct;
    const montantRelais = Math.max(relaisBrut - crd, 0);

    // 2) Plafond d'endettement (long terme)
    const plafondEndettement = revenus * endettementMax;

    // On enlève seulement les autres crédits (auto, conso, etc.), pas les intérêts du relais
    const mensualiteNouveauMax = plafondEndettement - autresMens;

    if (mensualiteNouveauMax <= 0) {
      const section1 = [
        "1. Revenus et endettement",
        `Vous avez indiqué un revenu net mensuel de ${formatEuro(
          revenus
        )} et des autres mensualités de crédits de ${formatEuro(autresMens)}.`,
        `Avec un taux d’endettement cible de ${tauxEndettement.toFixed(
          0
        )} %, la charge totale maximale supportable est d’environ ${formatEuro(
          plafondEndettement
        )} par mois.`,
      ];

      const section2 = [
        "2. Capacité actuelle insuffisante pour un nouveau prêt",
        `En tenant compte de vos autres crédits, il ne reste aucune marge de mensualité disponible pour un nouveau prêt immobilier.`,
        `Dans cette configuration, le projet d’achat devra être retravaillé (baisse du prix du bien, augmentation de la durée, hausse de l’apport, remboursement de certains crédits, etc.).`,
      ];

      const section3 = [
        "3. Pistes d’action possibles",
        `• Étudier le remboursement anticipé total ou partiel de certains crédits à la consommation.`,
        `• Revoir le prix cible du nouveau bien à la baisse, au moins de façon temporaire.`,
        `• Allonger la durée du futur prêt pour réduire la mensualité cible (dans la limite de l’âge et des pratiques bancaires).`,
      ];

      const msg = [section1.join("\n"), section2.join("\n"), section3.join("\n")].join(
        "\n\n"
      );

      setTexteDetail(msg);
      setResume(null);
      return;
    }

    // 3) Capital empruntable pour le nouveau prêt
    let capitalNouveau = 0;
    if (tNouveauMensuel === 0) {
      capitalNouveau = mensualiteNouveauMax * nMois;
    } else {
      const facteur = Math.pow(1 + tNouveauMensuel, nMois);
      capitalNouveau =
        mensualiteNouveauMax * ((facteur - 1) / (tNouveauMensuel * facteur));
    }

    // 4) Budget d'achat total max
    const budgetMax = montantRelais + capitalNouveau + apport;

    // 🔎 Construction d'une analyse structurée par blocs
    const section1 = [
      "1. Revenus et endettement",
      `Vous avez indiqué un revenu net mensuel de ${formatEuro(
        revenus
      )} et des autres mensualités de crédits de ${formatEuro(autresMens)}.`,
      `Avec un taux d’endettement cible de ${tauxEndettement.toFixed(
        0
      )} %, la charge totale maximale supportable est d’environ ${formatEuro(
        plafondEndettement
      )} par mois.`,
    ];

    const section2 = [
      "2. Estimation du prêt relais",
      `Valeur estimée du bien actuel : ${formatEuro(valeur)}.`,
      `Capital restant dû : ${formatEuro(crd)}.`,
      `Part retenue par la banque pour le calcul du relais : ${pctRetenu.toFixed(
        0
      )} %.`,
      `Montant théorique du prêt relais : ${formatEuro(montantRelais)}.`,
      `Au taux indicatif de ${formatPct(
        tauxRelais
      )}, cela donne un ordre d'idée du coût financier du relais, mais les intérêts ne sont pas intégrés dans le calcul de capacité ci-dessous (on raisonne ici sur la soutenabilité long terme).`,
    ];

    const section3 = [
      "3. Capacité pour le nouveau prêt immobilier",
      `Après prise en compte de vos autres crédits, la mensualité disponible pour le nouveau prêt immobilier est estimée à ${formatEuro(
        mensualiteNouveauMax
      )}.`,
      `Sur ${dureeNouveau.toFixed(
        0
      )} ans à ${formatPct(tauxNouveau)}, cela correspond à un capital empruntable d’environ ${formatEuro(
        capitalNouveau
      )}.`,
    ];

    const section4 = [
      "4. Budget d’achat total estimé",
      `En ajoutant votre apport personnel (${formatEuro(
        apport
      )}) et le prêt relais (${formatEuro(
        montantRelais
      )}), votre budget d’achat maximal théorique se situe autour de ${formatEuro(
        budgetMax
      )}.`,
      prixCible > 0
        ? `À titre de comparaison, le bien que vous visez actuellement est à ${formatEuro(
            prixCible
          )}.`
        : `Vous n’avez pas encore renseigné de prix cible : ce budget peut vous servir de repère pour vos recherches.`,
    ].filter(Boolean) as string[];

    const section5 = [
      "5. À garder en tête",
      `Ce calcul reste indicatif : chaque banque applique ses propres règles (prise en compte exacte du relais, taux et durée, assurance, éventuelle franchise sur les intérêts, etc.).`,
    ];

    const message = [
      section1.join("\n"),
      section2.join("\n"),
      section3.join("\n"),
      section4.join("\n"),
      section5.join("\n"),
    ].join("\n\n");

    setResume({
      montantRelais,
      mensualiteNouveauMax,
      capitalNouveau,
      budgetMax,
    });
    setTexteDetail(message);
  };

  // Analyse détaillée en blocs structurés (sections + paragraphes)
  const renderAnalysisBlocks = (text: string) => {
    if (!text) return null;

    // On découpe par double saut de ligne = sections
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

          if (lines.length === 0) return null;

          const title = lines[0];
          const body = lines.slice(1);

          return (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3"
            >
              <p className="text-[0.75rem] font-semibold text-slate-900 mb-1">
                {title}
              </p>
              {body.map((line, i) => (
                <p
                  key={i}
                  className="text-[0.8rem] text-slate-700 leading-relaxed"
                >
                  {line}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Sauvegarde du projet prêt relais
  const handleSaveProject = async () => {
    if (!resume || !texteDetail) return;
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
          window.location.href = "/mon-compte?mode=login&redirect=/pret-relais";
        }
        return;
      }

      const { error } = await supabase.from("projects").insert({
        user_id: session.user.id,
        type: "pret-relais",
        title: "Simulation prêt relais",
        data: {
          inputs: {
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
          resume,
          analyse: texteDetail,
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* ✅ Header global */}
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Formulaire */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5">
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-amber-600 mb-1">
              Prêt relais
            </p>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Quel bien puis-je acheter avec un prêt relais ?
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Renseignez votre situation pour obtenir un budget d&apos;achat maximal
              (prêt relais + nouveau crédit + apport).
            </p>

            <div className="space-y-3">
              {/* Revenus & charges */}
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Revenus nets mensuels du foyer (€)
                </label>
                <input
                  type="number"
                  value={revMensuels}
                  onChange={(e) =>
                    setRevMensuels(parseFloat(e.target.value) || 0)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Autres mensualités de crédits (€ / mois)
                  <InfoBadge text="Hors crédit lié au bien actuel : crédit auto, conso, autres emprunts... Cela réduit la marge disponible pour le futur prêt." />
                </label>
                <input
                  type="number"
                  value={autresMensualites}
                  onChange={(e) =>
                    setAutresMensualites(parseFloat(e.target.value) || 0)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Taux d’endettement cible (%)
                </label>
                <input
                  type="number"
                  value={tauxEndettement}
                  onChange={(e) =>
                    setTauxEndettement(parseFloat(e.target.value) || 0)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Bien actuel */}
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-700">
                  Bien actuel à vendre
                </p>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Valeur estimée du bien (€)
                  </label>
                  <input
                    type="number"
                    value={valeurBienActuel}
                    onChange={(e) =>
                      setValeurBienActuel(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Capital restant dû sur ce bien (€)
                  </label>
                  <input
                    type="number"
                    value={crdActuel}
                    onChange={(e) =>
                      setCrdActuel(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Pourcentage retenu par la banque (%)
                    <InfoBadge text="Les banques retiennent souvent 60–80 % de la valeur estimée, avant de déduire le capital restant dû, pour déterminer le montant du relais." />
                  </label>
                  <input
                    type="number"
                    value={pctRetenu}
                    onChange={(e) =>
                      setPctRetenu(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Taux du prêt relais (annuel, en %) – indicatif
                  </label>
                  <input
                    type="number"
                    value={tauxRelais}
                    onChange={(e) =>
                      setTauxRelais(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Nouveau projet */}
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-700">
                  Nouveau projet immobilier
                </p>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Apport personnel prévu (€)
                  </label>
                  <input
                    type="number"
                    value={apportPerso}
                    onChange={(e) =>
                      setApportPerso(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">
                      Taux du nouveau crédit (annuel, en %)
                    </label>
                    <input
                      type="number"
                      value={tauxNouveau}
                      onChange={(e) =>
                        setTauxNouveau(parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">
                      Durée du nouveau crédit (années)
                    </label>
                    <input
                      type="number"
                      value={dureeNouveau}
                      onChange={(e) =>
                        setDureeNouveau(parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Prix du bien que vous visez (optionnel, pour comparer) (€)
                  </label>
                  <input
                    type="number"
                    value={prixCible}
                    onChange={(e) =>
                      setPrixCible(parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                onClick={handleCalculRelais}
                className="mt-2 w-full rounded-full bg-gradient-to-r from-amber-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-300/40 hover:shadow-2xl hover:shadow-amber-300/60 transition-transform active:scale-[0.99]"
              >
                Calculer mon budget d&apos;achat avec prêt relais
              </button>
            </div>
          </section>

          {/* Résultats */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Résultat de la simulation
                </h2>
                <p className="text-xs text-slate-500">
                  Montant du relais, capacité de prêt et budget d&apos;achat maximal.
                </p>
              </div>

              {resume && (
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={handleSaveProject}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full border border-emerald-500/80 bg-emerald-500 px-3 py-1.5 text-[0.7rem] font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {saving ? "Sauvegarde..." : "Sauvegarder le projet"}
                  </button>
                  <button
                    onClick={handlePrintPDF}
                    className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300 transition-colors"
                  >
                    PDF
                  </button>
                  {saveMessage && (
                    <p className="text-[0.65rem] text-slate-500 text-right max-w-[230px]">
                      {saveMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            {resume && (
              <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 flex flex-col gap-3">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-700 mb-1">
                    Synthèse prêt relais & budget
                  </p>
                  <p className="text-xs text-slate-600">
                    Estimation indicative de votre budget d&apos;achat avec relais.
                  </p>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Montant du prêt relais
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatEuro(resume.montantRelais)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Mensualité max nouveau prêt
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatEuro(resume.mensualiteNouveauMax)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Capital nouveau prêt
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatEuro(resume.capitalNouveau)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Budget d&apos;achat max
                    </p>
                    <p className="text-lg font-semibold text-emerald-700">
                      {formatEuro(resume.budgetMax)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {texteDetail ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-3">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                  Analyse détaillée
                </p>
                {renderAnalysisBlocks(texteDetail)}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Renseignez votre situation puis cliquez sur “Calculer mon budget
                d&apos;achat avec prêt relais”.
              </p>
            )}

            <p className="mt-3 text-[0.7rem] text-slate-500">
              Cette simulation est indicative et ne remplace pas une étude
              détaillée de votre dossier par un courtier ou une banque.
            </p>
          </section>
        </div>

        {/* 🔁 Rappel pédagogique sur le prêt relais */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Rappel : comment fonctionne un prêt relais ?
          </h3>
          <p className="text-[0.8rem] text-slate-600">
            Le prêt relais est un financement transitoire qui vous permet
            d&apos;acheter un nouveau bien avant d&apos;avoir vendu l&apos;ancien. La banque
            avance une partie de la valeur du bien à vendre, en attendant sa
            vente définitive.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-[0.75rem] font-semibold text-emerald-800 mb-1">
                Les principaux avantages
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li className="text-[0.8rem] text-slate-700">
                  Vous pouvez acheter le nouveau bien sans attendre la vente de
                  l&apos;ancien.
                </li>
                <li className="text-[0.8rem] text-slate-700">
                  Vous évitez un déménagement intermédiaire ou une location
                  temporaire.
                </li>
                <li className="text-[0.8rem] text-slate-700">
                  La durée est généralement courte (12 à 24 mois), ce qui limite
                  la période d&apos;incertitude.
                </li>
              </ul>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
              <p className="text-[0.75rem] font-semibold text-rose-800 mb-1">
                Points de vigilance
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li className="text-[0.8rem] text-slate-700">
                  Si le bien se vend moins cher que prévu, il peut rester un
                  capital à rembourser.
                </li>
                <li className="text-[0.8rem] text-slate-700">
                  Tant que le bien n&apos;est pas vendu, vous supportez le coût du
                  relais en plus de vos autres charges.
                </li>
                <li className="text-[0.8rem] text-slate-700">
                  En cas de délai de vente long, la banque peut demander un
                  remboursement ou une restructuration de la dette.
                </li>
              </ul>
            </div>
          </div>
          <p className="text-[0.7rem] text-slate-500">
            Ce rappel est volontairement simplifié. Un échange détaillé avec un
            professionnel permet d&apos;adapter le montage (relais sec ou relais +
            amortissable, franchise d&apos;intérêts, etc.) à votre situation.
          </p>
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
