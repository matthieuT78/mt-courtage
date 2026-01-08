// pages/parc-immobilier.tsx
import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import ParcImmobilierWizard from "../components/ParcImmobilierWizard";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export default function ParcImmobilierPage() {
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
        console.error("Erreur récupération session (parc-immobilier)", e);
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
          {/* Header de la page (même logique que capacite/investissement) */}
          <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700">
                CALCULETTE PARC IMMOBILIER
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-indigo-700">
                Lokt.fr
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {displayName
                ? `Bonjour ${displayName}, analysez votre parc immobilier.`
                : "Analysez votre parc immobilier (multi-biens)."}
            </h1>

            <p className="text-xs text-slate-600 max-w-3xl">
              Ajoutez 1 à 20 biens locatifs et obtenez une synthèse globale : valeur du parc, encours,
              cash-flow, rendements, graphiques. Activez la version avancée pour intégrer vacance/gestion/impôts
              et afficher les indicateurs DSCR/LTV.
            </p>

            {!isLoggedIn && (
              <div className="rounded-xl border border-indigo-200/70 bg-white/70 p-3">
                <p className="text-[0.7rem] text-slate-600">
                  Sans compte, vous avez accès à la simulation et à la synthèse.
                  En créant votre espace, vous pourrez sauvegarder vos scénarios et retrouver vos analyses.
                </p>
              </div>
            )}
          </section>

          {/* Wizard (comme CapaciteWizard / InvestissementWizard) */}
          <ParcImmobilierWizard />
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} MT Courtage &amp; Investissement — Simulations indicatives.</p>
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
