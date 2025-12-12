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
              locataires… Un espace unique pour simplifier la vie des bailleurs
              particuliers comme professionnels.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                    Abonnement (bientôt)
                  </p>
                  <p className="text-2xl font-semibold text-slate-900">
                    49 € / mois
                  </p>
                  <p className="text-[0.7rem] text-emerald-800">
                    Résiliable à tout moment
                  </p>
                </div>
              </div>

              <div className="text-[0.75rem] text-slate-600 space-y-1">
                <p>
                  Conçu pour les propriétaires qui veulent structurer leur gestion
                  sans passer par une agence.
                </p>
                <p className="text-slate-500">
                  Version bêta – fonctionnalités activées progressivement.
                </p>
              </div>
            </div>

            {/* CTA PRINCIPAL */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Link
                href="/mon-compte?tab=bailleur"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-md"
              >
                Créer / accéder à mon espace bailleur
              </Link>

              <a
                href="mailto:mtcourtage@gmail.com?subject=Pré-inscription%20Outils%20propriétaire"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Discuter de mes besoins
              </a>
            </div>

            <p className="text-[0.7rem] text-slate-500">
              Vous serez redirigé vers votre compte, onglet{" "}
              <span className="font-semibold">« Espace bailleur »</span>.
            </p>
          </section>

          {/* FONCTIONNALITÉS */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                Fonctionnalités principales
              </p>
              <h2 className="mt-1 text-base sm:text-lg font-semibold text-slate-900">
                Les outils essentiels du bailleur moderne
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* QUITTANCES */}
              <Link
                href="/quittances-loyer"
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 hover:bg-amber-50 hover:border-amber-300 hover:shadow transition"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    🧾
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    Quittances de loyer
                  </p>
                </div>
                <ul className="text-[0.75rem] text-slate-700 space-y-1">
                  <li>• Génération mensuelle</li>
                  <li>• Historique par bien</li>
                  <li>• Envoi e-mail automatisable</li>
                </ul>
                <p className="text-[0.7rem] text-amber-700 font-medium group-hover:underline">
                  Accéder au module →
                </p>
              </Link>

              {/* À VENIR */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 opacity-60">
                <p className="text-xs font-semibold text-slate-900">
                  💶 Loyers & cautions
                </p>
                <p className="text-[0.75rem] text-slate-600">
                  Suivi des paiements, dépôts de garantie, alertes.
                </p>
                <p className="text-[0.7rem] text-slate-500">Bientôt</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 opacity-60">
                <p className="text-xs font-semibold text-slate-900">
                  📋 États des lieux
                </p>
                <p className="text-[0.75rem] text-slate-600">
                  Modèles, checklists et signatures.
                </p>
                <p className="text-[0.7rem] text-slate-500">Bientôt</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        © {new Date().getFullYear()} MT Courtage & Investissement
      </footer>
    </div>
  );
}
