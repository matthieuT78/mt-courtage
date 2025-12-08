// pages/index.tsx
import Link from "next/link";
import { ChartBarIcon, HomeIcon, BanknotesIcon, Squares2X2Icon } from "@heroicons/react/24/outline";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Outils pros & calculatrices pour vos projets immobiliers.
            </p>
          </div>

          <div className="text-xs text-slate-500 sm:text-right">
            <p>Simulations indicatives — Affinez avec une étude personnalisée.</p>
            <p className="mt-1">
              Contact :{" "}
              <a href="mailto:mtcourtage@gmail.com" className="underline">
                mtcourtage@gmail.com
              </a>
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Introduction */}
        <section>
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-2">
            Tableau de bord
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Choisissez votre calculatrice
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Sélectionnez un module pour simuler votre capacité d&apos;emprunt,
            analyser un investissement locatif, calculer un prêt relais ou
            mesurer la rentabilité de votre patrimoine existant.
          </p>
        </section>

        {/* Cartes principales */}
        <section className="grid gap-5 sm:grid-cols-2">
          {/* Capacité d'emprunt */}
          <Link
            href="/capacite"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3">
              <ChartBarIcon className="h-7 w-7 text-emerald-600" />
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600 mb-1">
                  Calculette
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Capacité d&apos;emprunt
                </h3>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Calculez votre capacité maximale, taux d&apos;endettement et budget
              immobilier potentiel.
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Simulation d&apos;achat</span>
              <span className="text-emerald-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>

          {/* Investissement locatif */}
          <Link
            href="/investissement"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3">
              <HomeIcon className="h-7 w-7 text-sky-600" />
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-sky-600 mb-1">
                  Calculette
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Investissement locatif
                </h3>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Business plan complet : rendement, cash-flow, dashboard & PDF pro.
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Projet à financer</span>
              <span className="text-sky-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>

          {/* Prêt relais */}
          <Link
            href="/pret-relais"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3">
              <BanknotesIcon className="h-7 w-7 text-amber-600" />
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-600 mb-1">
                  Calculette
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Prêt relais
                </h3>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Déterminez le montant de relais possible à partir de votre bien actuel.
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Vente + nouvel achat</span>
              <span className="text-amber-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>

          {/* Parc immobilier */}
          <Link
            href="/parc-immobilier"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3">
              <Squares2X2Icon className="h-7 w-7 text-indigo-600" />
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-indigo-600 mb-1">
                  Calculette
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Rentabilité du parc existant
                </h3>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Analyse complète de vos biens : cash-flow, rendement consolidé, classement des lots.
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Vue patrimoine</span>
              <span className="text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>
        </section>

        {/* Disclaimer */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
            Note importante
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ces calculs sont fournis à titre indicatif. Ils ne remplacent pas une étude
            bancaire personnalisée et ne constituent pas un conseil financier.
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement.
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
