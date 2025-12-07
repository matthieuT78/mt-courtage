// pages/index.tsx
import Link from "next/link";

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
              Outils d&apos;aide à la décision pour vos projets immobiliers et votre patrimoine.
            </p>
          </div>
          <div className="text-xs text-slate-500 sm:text-right">
            <p>Simulateurs indicatifs, à affiner avec une étude personnalisée.</p>
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
        <section>
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-2">
            Tableau de bord
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Choisissez l&apos;outil adapté à votre situation
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Que vous prépariez un premier achat, un investissement locatif, un prêt relais
            ou que vous souhaitiez simplement mesurer la performance de votre parc
            existant, ces modules vous donnent une vision claire et structurée à présenter
            à votre banque ou à votre courtier.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          {/* Carte 1 : Capacité d'emprunt */}
          <Link
            href="/capacite"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600 mb-1">
                Étape 1
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                Capacité d&apos;emprunt
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Estimez le montant que vous pouvez emprunter en fonction de vos revenus,
                charges et crédits en cours, avec un calcul de taux d&apos;endettement
                comme en banque.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Simulation mensuelle & capital max</span>
              <span className="text-emerald-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>

          {/* Carte 2 : Simulation investissement locatif */}
          <Link
            href="/investissement"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-sky-600 mb-1">
                Étape 2
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                Investissement locatif (projet)
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Construisez un business plan complet pour un bien à financer : coût global,
                loyers, charges, crédit, assurance, cash-flow et rendements avec graphiques
                prêts à être montrés à un banquier.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Rentabilité d&apos;un projet futur</span>
              <span className="text-sky-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>

          {/* Carte 3 : Prêt relais */}
          <Link
            href="/pret-relais"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-600 mb-1">
                Étape 3
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                Prêt relais
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Estimez le montant de prêt relais mobilisable à partir de votre bien
                actuel, en tenant compte du capital restant dû et des pratiques courantes
                (pourcentage de la valeur du bien, marge de sécurité, etc.).
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Montant relais & marge de manœuvre</span>
              <span className="text-amber-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>

          {/* Carte 4 : Parc existant */}
          <Link
            href="/parc-immobilier"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-indigo-600 mb-1">
                Outil patrimoine
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                Rentabilité de votre parc existant
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Mesurez la performance de vos biens déjà acquis : rendements bruts,
                nets, cash-flow par bien et global, avec un graphique qui met en évidence
                les actifs les plus performants… et ceux à optimiser.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Vue consolidée de votre patrimoine</span>
              <span className="text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
            Note importante
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ces calculs sont fournis à titre indicatif et ne constituent pas un conseil
            financier ou un engagement de financement. Ils ne tiennent pas compte de
            l&apos;ensemble des critères d&apos;analyse des banques (profil, historique,
            comportement de compte, patrimoine global, fiscalité, etc.). Pour toute
            décision d&apos;investissement, rapprochez-vous d&apos;un professionnel
            (courtier, conseiller en gestion de patrimoine, expert-comptable…).
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils de
          simulation immobilière.
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
