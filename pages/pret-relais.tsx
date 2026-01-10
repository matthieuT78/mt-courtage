// pages/pret-relais.tsx
import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import PretRelaisWizard from "../components/PretRelaisWizard";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export default function PretRelaisPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error("Erreur récupération session (pret-relais)", e);
      }
    };

    fetchSession();

    const { data: authListener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
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
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header de la page (identité visuelle prêt relais) */}
          <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm p-5 space-y-3">
            {/* Titre calculette (même pattern que capacité) */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                CALCULETTE PRÊT RELAIS
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-amber-700">
                Lokt.fr
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {displayName
                ? `Bonjour ${displayName}, estimez votre budget d’achat avec un prêt relais.`
                : "Estimez votre budget d’achat avec un prêt relais."}
            </h1>

            <p className="text-xs text-slate-600 max-w-2xl">
              Parcours guidé en plusieurs étapes : estimation du relais (valeur du bien actuel,
              capital restant dû, conditions de vente), apport disponible, et paramètres du futur
              prêt. Le résultat est structuré pour une lecture claire (relais + nouveau prêt +
              apport).
            </p>

            {!isLoggedIn && (
              <div className="rounded-xl border border-amber-200/70 bg-white/70 p-3">
                <p className="text-[0.7rem] text-slate-600">
                  Sans compte, vous accédez à la simulation et à la synthèse. En créant votre
                  espace, vous pourrez sauvegarder vos scénarios et accéder aux autres outils
                  (capacité, investissement, parc immobilier).
                </p>
              </div>
            )}
          </section>

          {/* Calculette */}
          <PretRelaisWizard showSaveButton={isLoggedIn} />
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
