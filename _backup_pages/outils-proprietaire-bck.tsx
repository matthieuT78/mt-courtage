// pages/outils-proprietaire.tsx
import Link from "next/link";
import AppHeader from "../components/AppHeader";

export default function OutilsProprietairePage() {
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
              {/* Carte cliquable vers /quittances-loyer */}
              <Link
                href="/quittances-loyer"
                className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2 cursor-pointer hover:bg-amber-50 hover:border-amber-300 hover:shadow-md transition"
              >
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
                <p className="text-[0.7rem] font-medium text-amber-700 opacity-0 group-hover:opacity-100 transition">
                  Accéder au générateur de quittances →
                </p>
              </Link>

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
