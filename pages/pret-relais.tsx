// pages/pret-relais.tsx
import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
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

  // Thème visuel propre au prêt relais (différent des autres calculettes)
  const toolGrad = "bg-gradient-to-r from-amber-500 to-sky-500";
  const toolSoft = "bg-gradient-to-b from-amber-50 to-sky-50";

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header de la page (IDENTITÉ VISUELLE PRÊT RELAIS) */}
          <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {/* barre top colorée */}
            <div className={`h-1.5 w-full ${toolGrad}`} />

            {/* fond soft + halos */}
            <div className={`relative ${toolSoft} p-5 sm:p-6`}>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-amber-400/25 blur-3xl" />
                <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
                <div className="absolute top-8 left-10 h-2.5 w-2.5 rounded-full bg-amber-500/40" />
                <div className="absolute bottom-10 right-14 h-2 w-2 rounded-full bg-sky-600/35" />
              </div>

              <div className="relative space-y-3">
                {/* Titre “calculette” mis en avant */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-amber-800">
                    Calculette
                  </span>

                  <p
                    className={
                      "text-[0.85rem] sm:text-[0.95rem] font-extrabold uppercase tracking-[0.22em] " +
                      "bg-gradient-to-r from-amber-700 to-sky-700 bg-clip-text text-transparent"
                    }
                  >
                    PRÊT RELAIS
                  </p>

                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-slate-700">
                    Budget d’achat
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
                  {displayName
                    ? `Bonjour ${displayName}, estimez votre budget d’achat avec un prêt relais.`
                    : "Estimez votre budget d’achat avec un prêt relais."}
                </h1>

                <p className="text-xs text-slate-700 max-w-2xl">
                  Estimez votre budget d’achat avec un prêt relais.
                  <br />
                  Parcours guidé en plusieurs étapes : revenus, bien actuel, nouveau projet et paramètres du futur prêt.
                  Résultat structuré pour une lecture claire (relais + nouveau prêt + apport).
                </p>

                {!isLoggedIn && (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <p className="text-[0.75rem] text-slate-700">
                      Sans compte, vous accédez à la simulation et à la synthèse.
                      En créant votre espace, vous pourrez sauvegarder vos scénarios et retrouver vos simulations.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Wizard */}
          <PretRelaisWizard showSaveButton={isLoggedIn} />
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage & Investissement — Simulations indicatives.
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
