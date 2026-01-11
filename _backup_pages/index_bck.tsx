import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Simulations professionnelles pour préparer vos projets immobiliers.
            </p>
          </div>
          <p className="text-xs text-slate-500 sm:text-right">
            Outil indicatif. Une étude personnalisée reste nécessaire avant tout engagement.
          </p>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-5xl mx-auto px-4 py-10 w-full">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Choisissez le simulateur dont vous avez besoin
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            Trois outils complémentaires pour structurer votre projet avant un rendez-vous bancaire.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href="/capacite"
              className="group rounded-2xl border border-sky-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-sky-300 transition"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
                Simulateur
              </p>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">
                Capacité d&apos;emprunt
              </h3>
              <p className="mt-2 text-xs text-slate-600">
                Calculez votre enveloppe de financement en fonction de vos revenus, crédits en cours et loyers perçus.
              </p>
            </Link>

            <Link
              href="/investissement"
              className="group rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                Simulateur
              </p>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">
                Investissement locatif
              </h3>
              <p className="mt-2 text-xs text-slate-600">
                Analysez rentabilité, cash-flow et équilibre charges / crédit pour un projet locatif (classique ou saisonnier).
              </p>
            </Link>

            <Link
              href="/pret-relais"
              className="group rounded-2xl border border-amber-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-amber-300 transition"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">
                Simulateur
              </p>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">
                Achat revente / prêt relais
              </h3>
              <p className="mt-2 text-xs text-slate-600">
                Estimez le montant du prêt relais, les charges provisoires et votre capacité pour le nouveau bien.
              </p>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} MT Courtage &amp; Investissement – Simulations indicatives.</p>
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
