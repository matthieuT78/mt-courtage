// components/account/AccountLayout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../AppHeader";

type Props = {
  userEmail?: string | null;
  active: "dashboard" | "bailleur" | "securite" | "projets";
  children: ReactNode;
  onLogout?: () => void;
};

export default function AccountLayout({ userEmail, active, children, onLogout }: Props) {
  const router = useRouter();

  const nav = [
    { key: "dashboard", label: "Mon compte", href: "/mon-compte" },
    { key: "bailleur", label: "Bailleur", href: "/mon-compte/bailleur" },
    { key: "securite", label: "Sécurité", href: "/mon-compte/securite" },
    { key: "projets", label: "Projets", href: "/mon-compte/projets" },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[220px,1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 h-fit">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-3">
              Mon espace
            </p>

            {userEmail ? (
              <>
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1">Connecté en tant que :</p>
                  <p className="text-sm font-semibold text-slate-900 break-all">{userEmail}</p>
                </div>

                <nav className="space-y-1 text-sm">
                  {nav.map((item) => {
                    const isActive = item.key === active;
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        className={
                          "block w-full rounded-lg px-3 py-2 " +
                          (isActive
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-50")
                        }
                      >
                        {item.label}
                      </Link>
                    );
                  })}

                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={!onLogout}
                    className="w-full text-left rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Déconnexion
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="w-full text-left rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50"
                  >
                    Retour accueil
                  </button>
                </nav>
              </>
            ) : (
              <div className="text-xs text-slate-500">
                <p>Connectez-vous pour accéder à votre espace.</p>
              </div>
            )}
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            {children}
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} MT Courtage &amp; Investissement</p>
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
