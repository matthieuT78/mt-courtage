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
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-6 space-y-5">
            {/* Bandeau titre + prix */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.20em] text-emerald-600">
                  OUTILS AVANCÉS (VERSION COMPLÈTE)
                </p>
                <h2 className="mt-1 text-base sm:text-lg font-semibold text-slate-900">
                  Tous vos projets immobiliers pilotés comme un pro
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-right">
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                    Accès illimité
                  </p>
                  <p className="text-lg font-semibold text-slate-900 leading-tight">
                    49&nbsp;€ / an
                  </p>
                  <p className="text-[0.7rem] text-emerald-700">
                    Moins de 5&nbsp;€ / mois.
                  </p>
                </div>
              </div>
            </div>

            {/* 3 gros blocs fonctionnels */}
            <div className="grid gap-4 md:grid-cols-3 mt-1">
              {/* Investissement locatif */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div className="inline-flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                    📈
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    Investissement locatif
                  </p>
                </div>
                <ul className="space-y-1 text-[0.7rem] text-slate-700">
                  <li>• Cash-flow net, rendement réel</li>
                  <li>• Effort d&apos;épargne par bien</li>
                  <li>• Comparaison de plusieurs opportunités</li>
                </ul>
                <p className="text-[0.7rem] font-medium text-emerald-700">
                  Ne signez plus un bien sans voir son cash-flow.
                </p>
              </div>

              {/* Achat revente / prêt relais */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div className="inline-flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                    🔁
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    Achat revente / prêt relais
                  </p>
                </div>
                <ul className="space-y-1 text-[0.7rem] text-slate-700">
                  <li>• Budget d&apos;achat réaliste</li>
                  <li>• Montant du relais & reste à vivre</li>
                  <li>• Scénarios avec / sans revente rapide</li>
                </ul>
                <p className="text-[0.7rem] font-medium text-emerald-700">
                  Visualisez l&apos;impact exact sur vos mensualités.
                </p>
              </div>

              {/* Parc immobilier existant */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div className="inline-flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                    🧩
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    Parc immobilier global
                  </p>
                </div>
                <ul className="space-y-1 text-[0.7rem] text-slate-700">
                  <li>• Vue d&apos;ensemble de tous vos biens</li>
                  <li>• Encours, valeurs, cash-flow total</li>
                  <li>• Biens à optimiser ou arbitrer</li>
                </ul>
                <p className="text-[0.7rem] font-medium text-emerald-700">
                  Un vrai tableau de bord pour décider sereinement.
                </p>
              </div>
            </div>

            {/* CTA principal version complète */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                href={isLoggedIn ? "/mon-compte" : "/mon-compte?mode=register"}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-md"
              >
                {isLoggedIn
                  ? "Ouvrir mes outils avancés"
                  : "Créer mon espace et débloquer les outils avancés"}
              </Link>
              <p className="text-[0.7rem] text-slate-500 max-w-xl">
                Historique de vos simulations, scénarios multiples et exports
                prêts à être envoyés à votre banque ou votre courtier.
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
