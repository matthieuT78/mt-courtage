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

// Icône euro / financement (sobre)
function IconEuro() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 text-emerald-700"
    >
      <path
        d="M15.5 5.5a6 6 0 0 0-5.657 3.9H7.5a.75.75 0 0 0 0 1.5h1.91a5.9 5.9 0 0 0 0 2.2H7.5a.75.75 0 0 0 0 1.5h2.343A6 6 0 0 0 15.5 18.5a.75.75 0 0 0 0-1.5 4.5 4.5 0 0 1-4.14-2.5h2.64a.75.75 0 0 0 0-1.5h-3.1a5.3 5.3 0 0 1 0-2.2h3.1a.75.75 0 0 0 0-1.5h-2.64A4.5 4.5 0 0 1 15.5 7a.75.75 0 0 0 0-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Icône cadenas (pour les fonctionnalités réservées)
function IconLock() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-slate-500"
    >
      <path
        d="M8.75 10V8a3.25 3.25 0 0 1 6.5 0v2h.25A2.75 2.75 0 0 1 18.25 12.75v5A2.75 2.75 0 0 1 15.5 20.5h-7A2.75 2.75 0 0 1 5.75 17.75v-5A2.75 2.75 0 0 1 8.5 10h.25Zm1.5 0h3.5V8a1.75 1.75 0 0 0-3.5 0v2Zm-1.75 1.5A1.25 1.25 0 0 0 7.25 12.75v5c0 .69.56 1.25 1.25 1.25h7c.69 0 1.25-.56 1.25-1.25v-5A1.25 1.25 0 0 0 15.5 11.5h-7Zm3.5 2a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0v-1.25a.75.75 0 0 1 .75-.75Z"
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

  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* HERO : calculette gratuite capacité d'emprunt */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-6 md:p-8 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600">
              Étude gratuite
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              {displayName
                ? `Bonjour ${displayName}, estimez votre capacité d'emprunt en quelques minutes.`
                : "Estimez gratuitement votre capacité d'emprunt en quelques minutes."}
            </h1>
            <p className="text-sm text-slate-600 max-w-xl">
              Répondez à quelques questions simples sur vos revenus, charges et
              crédits en cours. Vous obtenez une estimation structurée, prête à
              être présentée à votre banque ou à votre courtier.
            </p>

            {!isLoggedIn && (
              <p className="text-xs text-slate-500">
                Cette étude est accessible sans compte. En fin de simulation,
                vous pourrez créer un espace pour sauvegarder vos résultats et
                découvrir la version complète.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <IconEuro />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Calculette Capacité d&apos;emprunt
                </p>
                <p className="text-xs text-slate-500">
                  Étude gratuite, aucune inscription obligatoire.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/capacite"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Lancer la simulation gratuite
              </Link>
              {isLoggedIn ? (
                <p className="text-[0.7rem] text-slate-500">
                  Vous pourrez ensuite sauvegarder vos résultats dans votre
                  espace.
                </p>
              ) : (
                <p className="text-[0.7rem] text-slate-500 max-w-xs">
                  Déjà client ?{" "}
                  <Link
                    href="/mon-compte?mode=login"
                    className="font-semibold text-slate-900 underline"
                  >
                    Connectez-vous
                  </Link>{" "}
                  pour retrouver vos projets.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Étapes de la calculette (step by step) */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Comment ça marche ?
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            Une estimation structurée, en 4 étapes
          </h2>

          <div className="grid gap-4 md:grid-cols-4 mt-2">
            {/* Étape 1 */}
            <div className="flex flex-col gap-2">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[0.75rem] font-semibold text-white">
                1
              </div>
              <p className="text-xs font-semibold text-slate-900">
                Situation & revenus
              </p>
              <p className="text-xs text-slate-500">
                État civil, revenus nets, éventuels revenus locatifs et primes.
              </p>
            </div>

            {/* Étape 2 */}
            <div className="flex flex-col gap-2">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[0.75rem] font-semibold text-white">
                2
              </div>
              <p className="text-xs font-semibold text-slate-900">
                Charges & crédits en cours
              </p>
              <p className="text-xs text-slate-500">
                Loyer actuel, crédits conso / auto, pensions, autres charges.
              </p>
            </div>

            {/* Étape 3 */}
            <div className="flex flex-col gap-2">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[0.75rem] font-semibold text-white">
                3
              </div>
              <p className="text-xs font-semibold text-slate-900">
                Paramètres de financement
              </p>
              <p className="text-xs text-slate-500">
                Taux, durée, apport éventuel : vous ajustez selon vos hypothèses.
              </p>
            </div>

            {/* Étape 4 */}
            <div className="flex flex-col gap-2">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[0.75rem] font-semibold text-white">
                4
              </div>
              <p className="text-xs font-semibold text-slate-900">
                Résultat détaillé
              </p>
              <p className="text-xs text-slate-500">
                Capacité d&apos;emprunt, mensualité maximale, budget global et
                synthèse à partager.
              </p>
            </div>
          </div>

          <p className="mt-3 text-[0.7rem] text-slate-500">
            Cette étude ne remplace pas une offre de prêt bancaire, mais vous
            donne un ordre de grandeur réaliste pour préparer vos démarches.
          </p>
        </section>

        {/* Marketing : version complète / payante bientôt */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Version complète (bientôt payante)
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            Allez plus loin que la simple capacité d&apos;emprunt
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            La version complète (actuellement accessible aux utilisateurs
            inscrits, bientôt en version payante) vous permet d&apos;analyser vos
            projets immobiliers avec davantage de finesse et de préparer une
            stratégie globale : investissement locatif, achat revente, parc
            immobilier existant…
          </p>

          <div className="grid gap-3 md:grid-cols-3 mt-3">
            {/* Investissement locatif - locké */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/mon-compte?mode=login";
                }
              }}
              className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left flex flex-col gap-2 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  Investissement locatif
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[0.65rem] font-semibold text-white px-2 py-0.5">
                  <IconLock />
                  Réservé aux membres
                </span>
              </div>
              <p className="text-[0.7rem] text-slate-500">
                Analyse fine des loyers, charges, fiscalité et cash-flow sur un
                ou plusieurs biens.
              </p>
            </button>

            {/* Achat revente / prêt relais - locké */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/mon-compte?mode=login";
                }
              }}
              className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left flex flex-col gap-2 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  Achat revente / prêt relais
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[0.65rem] font-semibold text-white px-2 py-0.5">
                  <IconLock />
                  Réservé aux membres
                </span>
              </div>
              <p className="text-[0.7rem] text-slate-500">
                Budget d&apos;achat, montant du relais, simulations avec et sans
                revente immédiate.
              </p>
            </button>

            {/* Parc immobilier existant - locké */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/mon-compte?mode=login";
                }
              }}
              className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left flex flex-col gap-2 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  Parc immobilier existant
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[0.65rem] font-semibold text-white px-2 py-0.5">
                  <IconLock />
                  Réservé aux membres
                </span>
              </div>
              <p className="text-[0.7rem] text-slate-500">
                Vision consolidée de vos biens : encours, valeurs, cash-flow et
                pistes d&apos;optimisation.
              </p>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href={isLoggedIn ? "/mon-compte" : "/mon-compte?mode=register"}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
            >
              {isLoggedIn
                ? "Accéder à mon espace et aux calculettes avancées"
                : "Créer mon espace et découvrir la version complète"}
            </Link>
            <p className="text-[0.7rem] text-slate-500">
              La version payante intégrera progressivement des fonctionnalités
              avancées (export PDF, historiques, scénarios multiples…).
            </p>
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
