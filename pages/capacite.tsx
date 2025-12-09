// pages/capacite.tsx
import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import CapaciteWizard from "../components/CapaciteWizard";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export default function CapaciteEmpruntPage() {
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
        console.error("Erreur récupération session (capacite)", e);
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
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Titre / intro spécifique page capacité */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600">
              Calculette capacité d&apos;emprunt
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {displayName
                ? `Bonjour ${displayName}, estimez précisément votre capacité d’emprunt.`
                : "Estimez précisément votre capacité d’emprunt immobilier."}
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl">
              Parcours guidé en plusieurs étapes : revenus, charges, crédits en cours,
              loyers locatifs pris à 70&nbsp;% et paramètres de votre futur prêt.
              Résultat épuré, prêt à être présenté à votre banque ou à votre courtier.
            </p>

            {!isLoggedIn && (
              <p className="text-[0.7rem] text-slate-500">
                Sans compte, vous accédez gratuitement à la calculette et à une
                synthèse simplifiée. En créant votre espace, vous débloquez la
                sauvegarde de vos simulations et une analyse plus complète avec
                les autres outils (investissement locatif, achat revente, parc
                immobilier…).
              </p>
            )}
          </section>

          {/* 🧮 Calculette capacité – même composant que sur la home */}
          <CapaciteWizard
            showSaveButton={isLoggedIn}
            blurAnalysis={!isLoggedIn}
          />
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
