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
  const isLoggedIn = !!user;

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
        console.error("Erreur récupération session (header)", e);
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

  // helpers pour construire les liens
  const paidLink = (path: string) =>
    isLoggedIn
      ? path
      : `/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`;

  // Initiales pour l'avatar
  const initials = (() => {
    if (!user) return "";
    const fullName = user.user_metadata?.full_name;
    const base = fullName?.trim() || user.email || "";
    if (!base) return "";
    const parts = base.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return base.slice(0, 2).toUpperCase();
  })();

  const handleLogout = async () => {
    try {
      if (!supabase) return;
      await supabase.auth.signOut();
      setUser(null);
      router.push("/");
    } catch (e) {
      console.error("Erreur lors de la déconnexion", e);
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo / titre */}
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            MT Courtage &amp; Investissement
          </Link>
        </div>

        {/* Navigation principale */}
        <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-slate-700">
          <Link
            href="/"
            className={
              router.pathname === "/"
                ? "text-slate-900 underline underline-offset-4"
                : "hover:text-slate-900"
            }
          >
            Accueil
          </Link>

          {/* Capacité d'emprunt : toujours accessible gratuitement */}
          <Link
            href="/capacite"
            className={
              router.pathname === "/capacite"
                ? "text-slate-900 underline underline-offset-4"
                : "hover:text-slate-900"
            }
          >
            Capacité d&apos;emprunt
          </Link>

          {/* Liens payants : visibles pour tout le monde,
              mais redirigent vers login si non connecté */}
          <Link
            href={paidLink("/investissement")}
            className={
              router.pathname === "/investissement"
                ? "text-slate-900 underline underline-offset-4"
                : "hover:text-slate-900"
            }
          >
            Investissement locatif
          </Link>

          <Link
            href={paidLink("/pret-relais")}
            className={
              router.pathname === "/pret-relais"
                ? "text-slate-900 underline underline-offset-4"
                : "hover:text-slate-900"
            }
          >
            Prêt relais
          </Link>

          <Link
            href={paidLink("/parc-immobilier")}
            className={
              router.pathname === "/parc-immobilier"
                ? "text-slate-900 underline underline-offset-4"
                : "hover:text-slate-900"
            }
          >
            Parc immobilier
          </Link>
        </nav>

        {/* Zone droite : compte / connexion */}
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              {/* Avatar + pastille verte */}
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-slate-900 text-xs font-semibold text-white flex items-center justify-center uppercase">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
              </div>

              {/* Bouton compte + lien déconnexion */}
              <div className="flex flex-col items-start leading-tight">
                <Link
                  href="/mon-compte"
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Mon compte
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-0.5 text-[0.65rem] text-slate-500 hover:text-slate-800 underline decoration-dotted"
                >
                  Me déconnecter
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/mon-compte?mode=login"
              className="rounded-full bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-white hover:bg-slate-800"
            >
              Connexion
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
