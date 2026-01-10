// pages/investissement.tsx
import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import InvestissementWizard from "../components/InvestissementWizard";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export default function InvestissementPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser((data.session?.user as any) ?? null);
      } catch (e) {
        console.error("Erreur récupération session (investissement)", e);
      }
    };

    fetchSession();

    const { data: authListener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser((session?.user as any) ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const displayName =
    user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : null);

  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header de la page (identité visuelle RENTABILITÉ – AMBER) */}
          <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                CALCULETTE RENTABILITÉ LOCATIVE
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-amber-700">
                Lokt.fr
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {displayName
                ? `Bonjour ${displayName}, calculez votre cash-flow et votre rendement.`
                : "Calculez votre cash-flow et votre rendement locatif."}
            </h1>

            <p className="text-xs text-slate-600 max-w-3xl">
              Parcours guidé en plusieurs étapes : coûts d’acquisition, revenus (longue durée / Airbnb),
              charges et gestion, puis financement. Le résultat est structuré pour analyser
              la rentabilité réelle de votre projet.
            </p>

            {!isLoggedIn && (
              <div className="rounded-xl border border-amber-200/70 bg-white/70 p-3">
                <p className="text-[0.7rem] text-slate-600">
                  Sans compte, vous accédez à la simulation et à la synthèse.
                  En créant votre espace, vous pourrez sauvegarder vos projets
                  et accéder aux autres outils (capacité, prêt relais, parc immobilier).
                </p>
              </div>
            )}
          </section>

          {/* Calculette */}
          <InvestissementWizard showSaveButton={isLoggedIn} />
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} MT Courtage & Investissement — Simulations indicatives.</p>
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
