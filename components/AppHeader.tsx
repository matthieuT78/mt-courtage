// components/AppHeader.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

type UserInfo = {
  email: string | null;
};

export default function AppHeader() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!supabase) {
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          setUser(null);
        } else {
          setUser(data.user ? { email: data.user.email } : null);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router.pathname]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : router.pathname;

  const redirectParam = encodeURIComponent(currentPath || "/");

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* Logo simple MT Courtage (texte pour l’instant) */}
          <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
            MT
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Outils d&apos;aide à la décision pour vos projets immobiliers et votre patrimoine.
            </p>
          </div>
        </div>

        {/* Zone profil / connexion */}
        <div className="flex items-center gap-3 justify-between sm:justify-end">
          <div className="text-[0.7rem] text-slate-500 hidden sm:block text-right">
            <p>Simulations indicatives, à affiner avec un courtier.</p>
            <p className="mt-1">
              Contact :{" "}
              <a href="mailto:mtcourtage@gmail.com" className="underline">
                mtcourtage@gmail.com
              </a>
            </p>
          </div>

          {/* Profil / Connexion */}
          {!loading && (
            <>
              {user ? (
                <div className="relative group">
                  <button
                    type="button"
                    className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold shadow-sm"
                    aria-label="Profil"
                  >
                    {user.email?.[0]?.toUpperCase() || "U"}
                  </button>
                  {/* Menu au survol / clic (simple : au survol) */}
                  <div className="hidden group-hover:block absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg text-xs text-slate-700 z-30">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="font-semibold text-[0.7rem] uppercase tracking-[0.14em] text-slate-400">
                        Compte
                      </p>
                      <p className="mt-1 truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/projets"
                        className="block px-3 py-1.5 hover:bg-slate-50"
                      >
                        Voir mes projets sauvegardés
                      </Link>
                      <Link
                        href="/mon-compte"
                        className="block px-3 py-1.5 hover:bg-slate-50"
                      >
                        Informations personnelles
                      </Link>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50 border-t border-slate-100"
                    >
                      Déconnexion
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  href={`/mon-compte?mode=login&redirect=${redirectParam}`}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Connexion
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
