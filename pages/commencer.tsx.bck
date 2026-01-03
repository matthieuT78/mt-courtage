// pages/commencer.tsx
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

export default function CommencerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
              Démarrage
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">
              Commencer une simulation
            </h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              Choisissez votre objectif. Nous vous dirigeons vers la calculette la plus adaptée.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/capacite"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
              >
                <p className="text-sm font-semibold text-slate-900">
                  Acheter une résidence principale
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Estimer budget, mensualité et prix de bien.
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-900 underline decoration-slate-300">
                  Ouvrir la calculette capacité →
                </p>
              </Link>

              <Link
                href="/investissement"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
              >
                <p className="text-sm font-semibold text-slate-900">
                  Investir dans un bien locatif
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Cash-flow, rendement, effort d’épargne.
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-900 underline decoration-slate-300">
                  Ouvrir la calculette rentabilité →
                </p>
              </Link>

              <Link
                href="/pret-relais"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
              >
                <p className="text-sm font-semibold text-slate-900">
                  Acheter avant d’avoir vendu
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Estimer relais + nouveau prêt + budget max.
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-900 underline decoration-slate-300">
                  Ouvrir la calculette prêt relais →
                </p>
              </Link>

              <Link
                href="/parc-immobilier"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
              >
                <p className="text-sm font-semibold text-slate-900">
                  Analyser un parc immobilier
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Vision globale, encours, cash-flow total.
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-900 underline decoration-slate-300">
                  Ouvrir la calculette parc →
                </p>
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">
                Vous pouvez aussi accéder directement aux outils depuis la page d’accueil.
              </p>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
