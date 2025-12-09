// components/AppHeader.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
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
    isLoggedIn ? path : `/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`;

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

          {/* Liens payants : même visibles pour tout le monde, 
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
            <Link
              href="/mon-compte"
              className="rounded-full border border-slate-300 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
            >
              Mon compte
            </Link>
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
