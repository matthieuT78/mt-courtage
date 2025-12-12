// components/account/AccountLayout.tsx
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../AppHeader";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  title?: string;
  children: ReactNode;
};

export default function AccountLayout({ title, children }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!supabase) {
        setChecking(false);
        return;
      }
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
      setChecking(false);
    };
    run();
  }, []);

  const isLoggedIn = !!userEmail;
  const pathname = router.pathname; // ex: /mon-compte/securite

  const linkClass = (href: string) =>
    "w-full text-left rounded-lg px-3 py-2 text-sm " +
    (pathname === href
      ? "bg-slate-900 text-white"
      : "text-slate-700 hover:bg-slate-50");

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 max-w-5xl mx-auto px-4 py-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <p className="text-sm text-slate-500">Chargement…</p>
          </div>
        </main>
      </div>
    );
  }

  // 👉 Si pas connecté : redirection vers la page existante mon-compte en mode login
  // (tu peux aussi afficher un écran login ici si tu préfères)
  if (!isLoggedIn) {
    router.replace(
      `/mon-compte?mode=login&redirect=${encodeURIComponent(router.asPath)}`
    );
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[220px,1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 h-fit">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-3">
              Mon espace
            </p>

            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-1">Connecté :</p>
              <p className="text-sm font-semibold text-slate-900 break-all">
                {userEmail}
              </p>
            </div>

            <nav className="space-y-1">
              <Link href="/mon-compte" className={linkClass("/mon-compte")}>
                Tableau de bord
              </Link>
              <Link
                href="/mon-compte/bailleur"
                className={linkClass("/mon-compte/bailleur")}
              >
                Espace bailleur
              </Link>
              <Link
                href="/mon-compte/securite"
                className={linkClass("/mon-compte/securite")}
              >
                Sécurité
              </Link>
              <Link
                href="/mon-compte/projets"
                className={linkClass("/mon-compte/projets")}
              >
                Projets
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Déconnexion
              </button>
            </nav>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            {title && (
              <div className="mb-4">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                  Mon compte
                </p>
                <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
              </div>
            )}
            {children}
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} MT Courtage &amp; Investissement</p>
      </footer>
    </div>
  );
}
