// pages/index.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
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
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setUser((data.session?.user as any) ?? null);
    };

    fetchSession();

    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser((session?.user as any) ?? null);
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

  const goToLandlordTool = () => {
    const path = "/outils-proprietaire";
    if (isLoggedIn) router.push(path);
    else router.push(`/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* HERO */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600">
              Étude gratuite
            </p>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {displayName
                ? `Bonjour ${displayName}, estimez votre capacité d’emprunt immobilier.`
                : "Estimez votre capacité d’emprunt immobilier en quelques minutes."}
            </h1>

            <p className="text-xs text-slate-600 max-w-2xl">
              Une estimation réaliste de votre capacité d’achat, utilisée par
              courtiers et banques : mensualité, capital et prix de bien indicatif.
            </p>

            <Link
              href="/capacite"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-md"
            >
              Lancer la simulation gratuite
            </Link>
          </section>

          {/* OUTILS */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-6 space-y-5">
            <p className="text-[0.7rem] uppercase tracking-[0.20em] text-slate-500">
              OUTILS IMMOBILIERS
            </p>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Calculettes gratuites */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
                <p className="text-sm font-semibold text-slate-900">
                  Calculettes immobilières gratuites
                </p>
                <p className="text-[0.7rem] text-slate-600">
                  Décidez avant d’acheter. Aucun abonnement, aucun engagement.
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  <Link href="/capacite" className="tool-card">🧮 Capacité d’emprunt</Link>
                  <Link href="/investissement" className="tool-card">📈 Investissement locatif</Link>
                  <Link href="/pret-relais" className="tool-card">🔁 Achat-revente</Link>
                  <Link href="/parc-immobilier" className="tool-card">🧩 Parc immobilier</Link>
                </div>
              </div>

              {/* Boîte à outils bailleur */}
              <div className="rounded-2xl border border-slate-200 bg-slate-900 text-slate-50 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-300">
                      Boîte à outils propriétaire
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      Le kit du bailleur organisé
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-200">
                      Quittances, cautions, documents, rappels, suivi locatif.
                    </p>
                  </div>

                  {/* 💰 PRICING */}
                  <div className="rounded-xl bg-slate-800 border border-amber-300/60 px-3 py-2 text-right">
                    <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-300">
                      Abonnement
                    </p>
                    <p className="text-base font-semibold text-amber-300">
                      29 € / mois
                    </p>
                    <p className="text-[0.75rem] text-slate-200">
                      ou 290 € / an
                    </p>
                    <p className="text-[0.65rem] text-slate-400 mt-1">
                      Pour bailleurs multi-biens
                    </p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-[0.7rem]">
                  <li>• Quittances automatiques PDF</li>
                  <li>• Suivi des dépôts de garantie</li>
                  <li>• États des lieux & documents</li>
                  <li>• Alertes & rappels bailleur</li>
                </ul>

                <button
                  onClick={goToLandlordTool}
                  className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-[0.8rem] font-semibold text-slate-900 hover:bg-amber-300"
                >
                  Découvrir la boîte à outils bailleur
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        © {new Date().getFullYear()} MT Courtage & Investissement
      </footer>
    </div>
  );
}
