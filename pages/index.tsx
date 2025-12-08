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
                <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg">
                  💶
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
                <div className="h-8 w-8 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-lg">
                  🏢
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
                <div className="h-8 w-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-lg">
                  🔁
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
                <div className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-lg">
                  📊
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
