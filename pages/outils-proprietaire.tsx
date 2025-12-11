// pages/outils-proprietaire.tsx
import { useState, FormEvent } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";

export default function OutilsProprietairePage() {
  // --- ÉTATS POUR LA QUITTANCE ---
  const [bailleurNom, setBailleurNom] = useState("");
  const [bailleurAdresse, setBailleurAdresse] = useState("");
  const [locataireNom, setLocataireNom] = useState("");
  const [bienAdresse, setBienAdresse] = useState("");
  const [loyerHC, setLoyerHC] = useState<string>("");
  const [charges, setCharges] = useState<string>("");
  const [periodeDebut, setPeriodeDebut] = useState("");
  const [periodeFin, setPeriodeFin] = useState("");
  const [datePaiement, setDatePaiement] = useState("");
  const [villeQuittance, setVilleQuittance] = useState("");
  const [dateQuittance, setDateQuittance] = useState("");
  const [modePaiement, setModePaiement] = useState("virement");
  const [mentionSolde, setMentionSolde] = useState(true);

  const [quittanceTexte, setQuittanceTexte] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const formatEuro = (val: number) =>
    val.toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleGenerateQuittance = (e: FormEvent) => {
    e.preventDefault();
    setCopyMessage(null);

    const loyerNum = parseFloat(loyerHC || "0") || 0;
    const chargesNum = parseFloat(charges || "0") || 0;
    const total = loyerNum + chargesNum;

    // Format des dates simples
    const formatDateFR = (val: string) => {
      if (!val) return "";
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return val;
      return d.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "2-digit",
      });
    };

    const periodeStr =
      periodeDebut && periodeFin
        ? `pour la période du ${formatDateFR(
            periodeDebut
          )} au ${formatDateFR(periodeFin)}`
        : "";

    const paiementStr = datePaiement
      ? `payé le ${formatDateFR(datePaiement)}`
      : "dû et réglé";

    const villeDateStr =
      villeQuittance && dateQuittance
        ? `${villeQuittance}, le ${formatDateFR(dateQuittance)}`
        : "";

    const modePaiementLabel =
      modePaiement === "virement"
        ? "par virement bancaire"
        : modePaiement === "cheque"
        ? "par chèque"
        : modePaiement === "especes"
        ? "en espèces"
        : "par prélèvement";

    const lignes: string[] = [];

    // En-tête bailleur / locataire
    if (bailleurNom || bailleurAdresse) {
      lignes.push(`${bailleurNom || "Nom du bailleur"}`);
      if (bailleurAdresse) lignes.push(bailleurAdresse);
      lignes.push("");
    }

    if (locataireNom) {
      lignes.push(`À l'attention de : ${locataireNom}`);
      lignes.push("");
    }

    lignes.push("QUITTANCE DE LOYER");
    lignes.push("".padEnd(22, "="));
    lignes.push("");

    // Corps principal
    lignes.push(
      `Je soussigné(e) ${bailleurNom || "[Nom du bailleur]"}, propriétaire du logement situé ${bienAdresse ||
        "[Adresse du logement]"}, certifie avoir reçu de la part de ${
        locataireNom || "[Nom du locataire]"
      } la somme de ${formatEuro(total)} (${formatEuro(
        loyerNum
      )} de loyer hors charges et ${formatEuro(
        chargesNum
      )} de provisions sur charges)${
        periodeStr ? ` ${periodeStr}` : ""
      }, ${paiementStr} ${modePaiementLabel}.`
    );

    lignes.push("");

    if (mentionSolde) {
      lignes.push(
        "La présente quittance vaut reçu pour toutes sommes versées à ce jour au titre des loyers et charges pour la période indiquée et éteint, à ce titre, toute dette de locataire envers le bailleur pour ladite période."
      );
      lignes.push("");
    }

    // Rappel usage
    lignes.push(
      "La présente quittance ne préjuge en rien du paiement des loyers et charges antérieurs ou ultérieurs non quittancés."
    );
    lignes.push("");

    if (villeDateStr) {
      lignes.push(villeDateStr);
      lignes.push("");
    }

    lignes.push("Signature du bailleur :");
    lignes.push("");
    lignes.push("____________________________________");

    setQuittanceTexte(lignes.join("\n"));
  };

  const handleCopyQuittance = async () => {
    if (!quittanceTexte) return;
    try {
      await navigator.clipboard.writeText(quittanceTexte);
      setCopyMessage("Quittance copiée dans le presse-papier ✅");
      setTimeout(() => setCopyMessage(null), 2500);
    } catch {
      setCopyMessage(
        "Impossible de copier automatiquement. Vous pouvez sélectionner le texte et copier manuellement."
      );
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* HERO */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <p className="text-[0.7rem] uppercase tracking-[0.20em] text-emerald-600">
              Boîte à outils propriétaire
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Centralisez la gestion de vos locations comme un pro.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Quittances automatiques, suivi des cautions, états des lieux, dossiers
              locataires... Un espace unique pour simplifier la vie des bailleurs
              particuliers comme pros.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                    Abonnement mensuel
                  </p>
                  <p className="text-2xl font-semibold text-slate-900 leading-tight">
                    49&nbsp;€ / mois
                  </p>
                  <p className="text-[0.7rem] text-emerald-800">
                    Résiliable à tout moment.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-[0.75rem] text-slate-600">
                <p>
                  Idéal si vous gérez plusieurs biens (meublés, nus, colocations) et
                  que vous voulez professionnaliser vos échanges avec vos locataires.
                </p>
                <p className="text-[0.7rem] text-slate-500">
                  Version bêta en préparation – pré-inscriptions possibles dès maintenant.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Link
                href="/mon-compte?mode=register&redirect=/outils-proprietaire"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-md"
              >
                Créer mon espace bailleur
              </Link>
              <a
                href="mailto:mtcourtage@gmail.com?subject=Pré-inscription%20Outils%20propriétaire"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Discuter de mes besoins
              </a>
            </div>
          </section>

          {/* FONCTIONNALITÉS CLÉS */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                  Fonctionnalités principales
                </p>
                <h2 className="mt-1 text-base sm:text-lg font-semibold text-slate-900">
                  Tout ce qu&apos;il faut pour piloter vos locations
                </h2>
              </div>
              <p className="text-[0.75rem] text-slate-500 max-w-xs">
                Pensé pour des propriétaires qui veulent gagner du temps sans passer
                par une agence.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 mt-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2">
                <div className="inline-flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                    🧾
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    Quittances automatiques
                  </p>
                </div>
                <ul className="space-y-1 text-[0.75rem] text-slate-700">
                  <li>• Génération automatique des quittances chaque mois</li>
                  <li>• Archivage par locataire et par bien</li>
                  <li>• Export PDF prêt à être envoyé</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2">
                <div className="inline-flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                    💶
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    Cautions & loyers
                  </p>
                </div>
                <ul className="space-y-1 text-[0.75rem] text-slate-700">
                  <li>• Suivi des dépôts de garantie</li>
                  <li>• Historique des loyers et retards</li>
                  <li>• Alertes sur régularisation ou fin de bail</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2">
                <div className="inline-flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                    📋
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    États des lieux & documents
                  </p>
                </div>
                <ul className="space-y-1 text-[0.75rem] text-slate-700">
                  <li>• Modèles d&apos;états des lieux d&apos;entrée / sortie</li>
                  <li>• Checklist personnalisable par type de bien</li>
                  <li>• Centralisation des pièces locataires</li>
                </ul>
              </div>
            </div>
          </section>

          {/* GÉNÉRATEUR DE QUITTANCE DE LOYER */}
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-700">
                  Outil pratique (bêta)
                </p>
                <h2 className="mt-1 text-base sm:text-lg font-semibold text-slate-900">
                  Générateur de quittance de loyer prête à envoyer
                </h2>
                <p className="text-[0.75rem] text-slate-700 max-w-xl mt-1">
                  Saisissez les informations principales de la location et obtenez une
                  quittance de loyer structurée, à copier-coller ou à imprimer en PDF.
                </p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2 mt-2">
              {/* Formulaire */}
              <form
                onSubmit={handleGenerateQuittance}
                className="space-y-3 rounded-2xl bg-white border border-amber-100 p-4"
              >
                <p className="text-[0.75rem] font-semibold text-slate-900 mb-1">
                  Informations de la location
                </p>

                {/* Bailleur */}
                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">
                    Nom / raison sociale du bailleur
                  </label>
                  <input
                    type="text"
                    value={bailleurNom}
                    onChange={(e) => setBailleurNom(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">
                    Adresse du bailleur
                  </label>
                  <textarea
                    value={bailleurAdresse}
                    onChange={(e) => setBailleurAdresse(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Locataire & bien */}
                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">
                    Nom du locataire
                  </label>
                  <input
                    type="text"
                    value={locataireNom}
                    onChange={(e) => setLocataireNom(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">
                    Adresse du logement loué
                  </label>
                  <textarea
                    value={bienAdresse}
                    onChange={(e) => setBienAdresse(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Montants */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Loyer mensuel hors charges (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={loyerHC}
                      onChange={(e) => setLoyerHC(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Provisions sur charges (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={charges}
                      onChange={(e) => setCharges(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Période + paiement */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Début de période (loyer)
                    </label>
                    <input
                      type="date"
                      value={periodeDebut}
                      onChange={(e) => setPeriodeDebut(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Fin de période (loyer)
                    </label>
                    <input
                      type="date"
                      value={periodeFin}
                      onChange={(e) => setPeriodeFin(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Date de paiement effectif
                    </label>
                    <input
                      type="date"
                      value={datePaiement}
                      onChange={(e) => setDatePaiement(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Mode de paiement
                    </label>
                    <select
                      value={modePaiement}
                      onChange={(e) => setModePaiement(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="virement">Virement bancaire</option>
                      <option value="prelevement">Prélèvement</option>
                      <option value="cheque">Chèque</option>
                      <option value="especes">Espèces</option>
                    </select>
                  </div>
                </div>

                {/* Ville / date de la quittance */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Lieu de rédaction (ville)
                    </label>
                    <input
                      type="text"
                      value={villeQuittance}
                      onChange={(e) => setVilleQuittance(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Date de la quittance
                    </label>
                    <input
                      type="date"
                      value={dateQuittance}
                      onChange={(e) => setDateQuittance(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Mentions */}
                <label className="mt-2 flex items-start gap-2 text-[0.7rem] text-slate-700">
                  <input
                    type="checkbox"
                    checked={mentionSolde}
                    onChange={(e) => setMentionSolde(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                  />
                  <span>
                    Inclure la mention indiquant que le locataire est à jour de ses
                    paiements pour la période concernée.
                  </span>
                </label>

                <button
                  type="submit"
                  className="mt-3 inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 shadow-sm"
                >
                  Générer la quittance
                </button>
              </form>

              {/* Prévisualisation */}
              <div className="flex flex-col rounded-2xl bg-white border border-amber-100 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-700">
                      Prévisualisation
                    </p>
                    <p className="text-xs text-slate-500">
                      Texte prêt à être copié dans un mail ou collé dans un document.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={handleCopyQuittance}
                      disabled={!quittanceTexte}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Copier la quittance
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      disabled={!quittanceTexte}
                      className="inline-flex items-center justify-center rounded-full border border-amber-400 bg-amber-100 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 hover:bg-amber-200 disabled:opacity-50"
                    >
                      Imprimer / PDF
                    </button>
                  </div>
                </div>

                {copyMessage && (
                  <p className="mb-2 text-[0.7rem] text-emerald-700">
                    {copyMessage}
                  </p>
                )}

                <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {quittanceTexte ? (
                    <pre className="whitespace-pre-wrap text-[0.75rem] text-slate-800 leading-relaxed">
                      {quittanceTexte}
                    </pre>
                  ) : (
                    <p className="text-[0.75rem] text-slate-500">
                      Renseignez les informations de la quittance dans le formulaire
                      de gauche puis cliquez sur &quot;Générer la quittance&quot;.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* POUR QUI ? */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
              Pour qui ?
            </p>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              Propriétaires solo, LMNP, multipropriétaires… si vous avez des locataires, c&apos;est pour vous.
            </h2>

            <div className="grid gap-4 md:grid-cols-3 mt-2 text-[0.75rem] text-slate-700">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="font-semibold text-slate-900 mb-1">
                  Bailleur débutant
                </p>
                <p>
                  Vous mettez votre premier bien en location et vous voulez éviter
                  les erreurs administratives (quittances, bail, caution…).
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="font-semibold text-slate-900 mb-1">
                  Multipropriétaire
                </p>
                <p>
                  Plusieurs biens, plusieurs locataires, plusieurs cautions… mais
                  un seul tableau de bord pour tout suivre.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="font-semibold text-slate-900 mb-1">
                  Investisseur structuré
                </p>
                <p>
                  Vous utilisez déjà les calculettes MT Courtage pour vos achats
                  et vous voulez aller jusqu&apos;à la gestion locative.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Link
                href="/capacite"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2 text-[0.8rem] font-semibold text-slate-800 hover:bg-slate-50"
              >
                Continuer à explorer les simulateurs
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils pour propriétaires et investisseurs.
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
