// pages/index.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import {
  ChartBarIcon,
  HomeIcon,
  BanknotesIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchUser = async () => {
      try {
        if (!supabase) {
          setLoadingUser(false);
          return;
        }
        const { data } = await supabase.auth.getUser();
        if (!isMounted) return;
        setUser(data?.user ?? null);
      } catch {
        if (!isMounted) return;
        setUser(null);
      } finally {
        if (isMounted) setLoadingUser(false);
      }
    };
    fetchUser();

    // écoute les changements de session (login / logout)
    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      });
      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const initials =
    user?.user_metadata?.full_name?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "M";

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          {/* Bloc gauche : logo + baseline */}
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Outils d&apos;aide à la décision pour vos projets immobiliers et votre patrimoine.
            </p>
          </div>

          {/* Bloc droite : contact + user / connexion */}
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-slate-500 text-right">
              <p>Simulateurs indicatifs, à affiner avec une étude personnalisée.</p>
              <p className="mt-1">
                Contact :{" "}
                <a href="mailto:mtcourtage@gmail.com" className="underline">
                  mtcourtage@gmail.com
                </a>
              </p>
            </div>

            {/* Zone user / connexion */}
            <div className="relative">
              {loadingUser ? (
                <div className="h-8 w-24 rounded-full bg-slate-100 animate-pulse" />
              ) : !user ? (
                <Link
                  href="/auth"
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
                >
                  Connexion
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-[0.75rem] text-slate-600">
                    Bonjour,{" "}
                    <span className="font-semibold">
                      {user.user_metadata?.full_name || user.email}
                    </span>
                  </span>
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="relative inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-900 text-white h-9 w-9 overflow-hidden"
                  >
                    {avatarUrl ? (
                      // Avatar image si l'utilisateur a défini une URL
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold">{initials}</span>
                    )}
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-11 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-2 text-sm z-30">
                      <div className="px-3 pb-2 border-b border-slate-100 mb-1">
                        <p className="text-xs text-slate-500">Connecté en tant que</p>
                        <p className="text-[0.8rem] font-semibold text-slate-800 truncate">
                          {user.user_metadata?.full_name || user.email}
                        </p>
                      </div>
                      <Link
                        href="/projets"
                        className="block px-3 py-1.5 text-[0.85rem] text-slate-700 hover:bg-slate-50"
                      >
                        Voir mes projets sauvegardés
                      </Link>
                      <Link
                        href="/mon-compte"
                        className="block px-3 py-1.5 text-[0.85rem] text-slate-700 hover:bg-slate-50"
                      >
                        Informations personnelles
                      </Link>
                      <Link
                        href="/mon-compte#password"
                        className="block px-3 py-1.5 text-[0.85rem] text-slate-700 hover:bg-slate-50"
                      >
                        Changer mon mot de passe
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="mt-1 block w-full text-left px-3 py-1.5 text-[0.85rem] text-red-600 hover:bg-red-50"
                      >
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 space-y-8">
        <section>
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-2">
            Tableau de bord
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Choisissez l&apos;outil adapté à votre situation
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Que vous prépariez un premier achat, un investissement locatif, un prêt relais
            ou que vous souhaitiez simplement mesurer la performance de votre parc
            existant, ces modules vous donnent une vision claire et structurée à présenter
            à votre banque ou à votre courtier.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          {/* Carte 1 : Capacité d'emprunt */}
          <Link
            href="/capacite"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <BanknotesIcon className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600 mb-1">
                  Calculette
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Capacité d&apos;emprunt
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Estimez le montant que vous pouvez emprunter en fonction de vos revenus,
                  charges et crédits en cours, avec un calcul de taux d&apos;endettement
                  comme en banque.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Simulation mensuelle & capital max</span>
              <span className="text-emerald-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>

          {/* Carte 2 : Simulation investissement locatif */}
          <Link
            href="/investissement"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-sky-50 flex items-center justify-center border border-sky-100">
                <ChartBarIcon className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-sky-600 mb-1">
                  Calculette
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Investissement locatif (projet)
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Construisez un business plan complet pour un bien à financer : coût
                  global, loyers, charges, crédit, assurance, cash-flow et rendements avec
                  graphiques prêts à être montrés à un banquier.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Rentabilité d&apos;un projet futur</span>
              <span className="text-sky-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>

          {/* Carte 3 : Prêt relais */}
          <Link
            href="/pret-relais"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
                <HomeIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-600 mb-1">
                  Calculette
                </p>
                <h3 className="text-lg font-semibold text-slate-900">Prêt relais</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Estimez le montant de prêt relais mobilisable à partir de votre bien
                  actuel, en tenant compte du capital restant dû et des pratiques courantes
                  (pourcentage de la valeur du bien, marge de sécurité, etc.).
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Montant relais & marge de manœuvre</span>
              <span className="text-amber-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>

          {/* Carte 4 : Parc existant */}
          <Link
            href="/parc-immobilier"
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                <Squares2X2Icon className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-indigo-600 mb-1">
                  Outil patrimoine
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Rentabilité de votre parc existant
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Mesurez la performance de vos biens déjà acquis : rendements bruts,
                  nets, cash-flow par bien et global, avec un graphique qui met en évidence
                  les actifs les plus performants… et ceux à optimiser.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Vue consolidée de votre patrimoine</span>
              <span className="text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                Accéder &rarr;
              </span>
            </div>
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
            Note importante
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ces calculs sont fournis à titre indicatif et ne constituent pas un conseil
            financier ou un engagement de financement. Ils ne tiennent pas compte de
            l&apos;ensemble des critères d&apos;analyse des banques (profil, historique,
            comportement de compte, patrimoine global, fiscalité, etc.). Pour toute
            décision d&apos;investissement, rapprochez-vous d&apos;un professionnel
            (courtier, conseiller en gestion de patrimoine, expert-comptable…).
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils de
          simulation immobilière.
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
