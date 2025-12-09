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

  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* HERO / introduction */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-600">
                Étude gratuite
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
                {displayName
                  ? `Bonjour ${displayName}, estimez votre capacité d’emprunt immobilier.`
                  : "Estimez votre capacité d’emprunt immobilier en quelques minutes."}
              </h1>
              <p className="text-xs text-slate-600 max-w-2xl">
                Revenus, charges, crédits en cours et loyers locatifs pris à
                70&nbsp;% : obtenez une estimation réaliste de votre mensualité
                maximale, du capital empruntable et d&apos;un prix de bien indicatif
                à présenter à votre banque ou à votre courtier.
              </p>

              {!isLoggedIn && (
                <p className="text-[0.7rem] text-slate-500">
                  La calculette est accessible sans compte. En créant votre
                  espace, vous pourrez sauvegarder vos simulations et accéder
                  aux autres outils (investissement locatif, achat revente, parc
                  immobilier…).
                </p>
              )}
            </div>

            {/* CTA central : lancer la simulation */}
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                href="/capacite"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-md"
              >
                Lancer la simulation de capacité d&apos;emprunt
              </Link>

              <p className="text-[0.7rem] text-slate-500">
                Simulation 100&nbsp;% gratuite, sans engagement.{" "}
                {isLoggedIn
                  ? "Vous pourrez ensuite sauvegarder vos résultats dans votre espace."
                  : "Aucun compte requis pour lancer une première étude."}
              </p>
            </div>
          </section>

          {/* 💬 Bloc marketing version payante / outils avancés */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Outils avancés (version complète)
            </p>
            <h2 className="text-sm font-semibold text-slate-900">
              Passez de la simple capacité d&apos;emprunt à une vision globale de
              votre stratégie immobilière
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl">
              La version complète (bientôt payante) rassemble les calculettes et
              analyses dont vous avez besoin pour décider rapidement : que vous
              soyez primo-accédant ou investisseur chevronné, vous disposez
              d&apos;outils concrets pour discuter d&apos;égal à égal avec votre
              banque ou votre courtier.
            </p>

            <div className="grid gap-3 md:grid-cols-3 mt-2">
              {/* Investissement locatif */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-900">
                  Investissement locatif
                </p>
                <p className="text-[0.7rem] text-slate-600">
                  Cash-flow, rendement net, effort d’épargne, scénarios de
                  financement… pour un ou plusieurs biens, en location nue ou
                  meublée.
                </p>
                <p className="text-[0.65rem] text-emerald-700 font-medium">
                  Idéal pour comparer plusieurs opportunités avant de faire une
                  offre.
                </p>
              </div>

              {/* Achat revente / prêt relais */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-900">
                  Achat revente / prêt relais
                </p>
                <p className="text-[0.7rem] text-slate-600">
                  Budget d&apos;achat, montant du relais, reste à vivre pendant la
                  période de transition, simulations avec ou sans revente
                  rapide.
                </p>
                <p className="text-[0.65rem] text-emerald-700 font-medium">
                  Visualisez clairement l&apos;impact de votre projet sur vos
                  mensualités.
                </p>
              </div>

              {/* Parc immobilier existant */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-900">
                  Parc immobilier existant
                </p>
                <p className="text-[0.7rem] text-slate-600">
                  Vue consolidée de vos biens : valeur de parc, encours de
                  crédit, cash-flow global, rendements, biens à arbitrer ou à
                  optimiser.
                </p>
                <p className="text-[0.65rem] text-emerald-700 font-medium">
                  Un tableau de bord simple pour piloter votre stratégie dans le
                  temps.
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href={isLoggedIn ? "/mon-compte" : "/mon-compte?mode=register"}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
              >
                {isLoggedIn
                  ? "Accéder à mon espace et aux outils avancés"
                  : "Créer mon espace et débloquer les outils avancés"}
              </Link>
              <p className="text-[0.7rem] text-slate-500 max-w-xl">
                Historique de vos simulations, export PDF, scénarios multiples
                et une présentation claire pour vos rendez-vous bancaires.
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement –
          Simulations indicatives.
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
