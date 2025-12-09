// pages/index.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

// Icône euro / financement
function IconEuro() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-emerald-700"
    >
      <path
        d="M15.5 5.5a6 6 0 0 0-5.657 3.9H7.5a.75.75 0 0 0 0 1.5h1.91a6.8 6.8 0 0 0 0 2.2H7.5a.75.75 0 0 0 0 1.5h2.343A6 6 0 0 0 15.5 18.5a.75.75 0 0 0 0-1.5 4.5 4.5 0 0 1-4.14-2.5h2.64a.75.75 0 0 0 0-1.5h-3.1a5.3 5.3 0 0 1 0-2.2h3.1a.75.75 0 0 0 0-1.5h-2.64A4.5 4.5 0 0 1 15.5 7a.75.75 0 0 0 0-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Icône immeuble / investissement locatif
function IconBuilding() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-sky-700"
    >
      <path
        d="M7 4.75A2.75 2.75 0 0 1 9.75 2h4.5A2.75 2.75 0 0 1 17 4.75V20h1.25a.75.75 0 0 1 0 1.5H5.75a.75.75 0 0 1 0-1.5H7V4.75ZM15.5 20V4.75c0-.69-.56-1.25-1.25-1.25h-4.5C9.06 3.5 8.5 4.06 8.5 4.75V20h7ZM10.75 7a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 10.75 7Zm0 3.5a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75Zm0 3.5a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Icône flèches / prêt relais
function IconArrows() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-amber-700"
    >
      <path
        d="M6.22 5.22a.75.75 0 0 1 1.06 0L10 7.94a.75.75 0 1 1-1.06 1.06L7.75 7.81V15a.75.75 0 0 1-1.5 0V7.81L5.06 9a.75.75 0 0 1-1.06-1.06L6.22 5.22Zm11.56 13.56a.75.75 0 0 1-1.06 0L14 16.06a.75.75 0 1 1 1.06-1.06l1.19 1.19V9a.75.75 0 0 1 1.5 0v7.19l1.19-1.19A.75.75 0 1 1 20 16.06l-2.22 2.72Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Icône graphique / parc immobilier
function IconChart() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-indigo-700"
    >
      <path
        d="M5 5.75A.75.75 0 0 1 5.75 5H19a.75.75 0 0 1 0 1.5H6.5v12.75a.75.75 0 0 1-1.5 0V5.75ZM10 10a.75.75 0 0 1 .75-.75h1.5A.75.75 0 0 1 13 10v7.5a.75.75 0 0 1-1.5 0V10.75h-.75A.75.75 0 0 1 10 10Zm4-3a.75.75 0 0 1 .75-.75h1.5A.75.75 0 0 1 17 7v10.5a.75.75 0 0 1-1.5 0V7.75h-.75A.75.75 0 0 1 14 7Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function Home() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted) return;
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error("Erreur récupération session (home)", e);
      }
    };

    fetchSession();

    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const displayName =
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : null);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Bloc de bienvenue */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600 mb-1">
              Bienvenue
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              {displayName
                ? `Bonjour ${displayName}, simulons vos projets immobiliers.`
                : "Simulez vos projets immobiliers en quelques clics."}
            </h1>
            <p className="mt-2 text-sm text-slate-600 max-w-xl">
              Calculez votre capacité d&apos;emprunt, la rentabilité d&apos;un
              investissement locatif, l&apos;impact d&apos;un prêt relais ou la
              performance globale de votre parc immobilier.
            </p>

            {!user && (
              <p className="mt-3 text-xs text-slate-500">
                Pour sauvegarder vos projets et y revenir plus tard,{" "}
                <Link
                  href="/mon-compte?mode=login"
                  className="font-semibold text-slate-900 underline"
                >
                  connectez-vous ou créez un compte
                </Link>
                .
              </p>
            )}
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2">
            <p className="text-[0.7rem] text-slate-500">
              Quelques minutes suffisent pour obtenir un dossier clair à présenter
              à votre banque ou à votre courtier.
            </p>
          </div>
        </section>

        {/* Cartes des calculettes */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Choisissez une calculette
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Capacité d'emprunt */}
            <Link
              href="/capacite"
              className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-600">
                    Calculette
                  </p>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Capacité d&apos;emprunt
                  </h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <IconEuro />
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Évaluez combien vous pouvez emprunter en respectant les règles
                d&apos;endettement bancaires.
              </p>
            </Link>

            {/* Investissement locatif */}
            <Link
              href="/investissement"
              className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-600">
                    Calculette
                  </p>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Investissement locatif
                  </h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center">
                  <IconBuilding />
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Simulez loyers, charges, crédit et cash-flow pour un ou plusieurs
                lots, en longue durée ou saisonnière.
              </p>
            </Link>

            {/* Prêt relais */}
            <Link
              href="/pret-relais"
              className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-600">
                    Calculette
                  </p>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Achat revente / prêt relais
                  </h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <IconArrows />
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Estimez votre budget d&apos;achat en combinant prêt relais, nouveau
                crédit et apport.
              </p>
            </Link>

            {/* Parc immobilier */}
            <Link
              href="/parc-immobilier"
              className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-600">
                    Calculette
                  </p>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Parc immobilier existant
                  </h3>
                </div>
                <div className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <IconChart />
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Analysez la performance globale de vos biens locatifs : cash-flow,
                encours, rendements et biens à optimiser.
              </p>
            </Link>
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
