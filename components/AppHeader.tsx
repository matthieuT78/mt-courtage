// components/AppHeader.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export default function AppHeader() {
  const router = useRouter();
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
        console.error("Erreur récupération session Supabase", e);
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

  const handleLogout = async () => {
    try {
      await supabase?.auth.signOut();
      setUser(null);
      router.push("/");
    } catch (e) {
      console.error("Erreur déconnexion", e);
    }
  };

  const handleGoToAccount = () => {
    router.push("/mon-compte");
  };

  const handleGoToLogin = () => {
    router.push("/mon-compte?mode=login");
  };

  const isActive = (path: string) =>
    router.pathname === path
      ? "text-slate-900 font-semibold"
      : "text-slate-500 hover:text-slate-900";

  const displayName =
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : "Mon compte");

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Logo + marque */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl border border-slate-300 bg-slate-900 flex items-center justify-center text-xs font-bold text-white tracking-tight">
              MT
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">
                MT Courtage &amp; Investissement
              </p>
              <p className="text-[0.7rem] text-slate-500">
                Simulateurs &amp; accompagnement crédit
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation centrale (optionnelle, légère) */}
        <nav className="hidden sm:flex items-center gap-4 text-xs">
          <Link href="/" className={isActive("/")}>
            Accueil
          </Link>
          <Link href="/capacite" className={isActive("/capacite")}>
            Capacité d&apos;emprunt
          </Link>
          <Link href="/investissement" className={isActive("/investissement")}>
            Investissement locatif
          </Link>
          <Link
            href="/parc-immobilier"
            className={isActive("/parc-immobilier")}
          >
            Parc immobilier
          </Link>
        </nav>

        {/* Compte utilisateur */}
        <div className="relative">
          {user ? (
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-100"
            >
              <span className="h-7 w-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[0.75rem] font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{displayName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoToLogin}
              className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Connexion
            </button>
          )}

          {user && menuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg text-xs z-30">
              <button
                className="w-full text-left px-3 py-2 hover:bg-slate-50"
                onClick={handleGoToAccount}
              >
                Tableau de bord
              </button>
              <Link
                href="/projets"
                className="block px-3 py-2 hover:bg-slate-50"
              >
                Mes projets sauvegardés
              </Link>
              <Link
                href="/mon-compte?tab=infos"
                className="block px-3 py-2 hover:bg-slate-50"
              >
                Informations personnelles
              </Link>
              <Link
                href="/mon-compte?tab=securite"
                className="block px-3 py-2 hover:bg-slate-50"
              >
                Sécurité &amp; mot de passe
              </Link>
              <button
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 border-t border-slate-100"
                onClick={handleLogout}
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
