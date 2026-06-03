// components/account/AccountLayout.tsx
import Head from "next/head";
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import AppHeader from "../AppHeader";
import AppFooter from "../AppFooter";

type Props = {
  userEmail: string | null;
  active: "overview" | "profile" | "securite" | "projets" | "abonnement";
  onLogout: () => Promise<void> | void;
  children: ReactNode;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function NavItem({
  href,
  active,
  children,
  sub,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  sub?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "block rounded-2xl border px-3 py-2.5 transition",
        active ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={cx("text-sm font-semibold truncate", active ? "text-sky-900" : "text-slate-900")}>
            {children}
          </p>
          {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
        </div>
        <span
          className={cx(
            "shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold",
            active ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700"
          )}
        >
          {active ? "Ouvert" : "Ouvrir"}
        </span>
      </div>
    </Link>
  );
}

export default function AccountLayout({ userEmail, active, onLogout, children }: Props) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pageTitle =
    active === "overview"
      ? "Mon compte"
      : active === "profile"
      ? "Profil"
      : active === "securite"
      ? "Sécurité"
      : active === "abonnement"
      ? "Abonnement"
      : "Projets";

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await onLogout();
    } finally {
      window.location.href = "/";
    }
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  const accountNav = (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-br from-sky-50 via-white to-cyan-50 border-b border-slate-200">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Compte</p>
        <p className="mt-1 text-sm font-semibold text-slate-900 break-all">{userEmail || "Non connecté"}</p>
      </div>

      <div className="p-3 space-y-2">
        <NavItem href="/mon-compte" active={active === "overview"} sub="Statut & raccourcis">
          Vue d’ensemble
        </NavItem>

        <NavItem href="/mon-compte/profil" active={active === "profile"} sub="Infos perso & adresse">
          Profil
        </NavItem>

        <NavItem href="/mon-compte/securite" active={active === "securite"} sub="Mot de passe & newsletter">
          Sécurité
        </NavItem>

        <NavItem href="/mon-compte/abonnement" active={active === "abonnement"} sub="Offre & facturation">
          Abonnement
        </NavItem>
      </div>

      <div className="p-3 border-t border-slate-200">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loggingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <Head>
        <title>{`${pageTitle} | lokt.fr`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AppHeader />
      <div className="h-1 w-full bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400" />

      <div className="mx-auto max-w-6xl px-4 pt-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-md shadow-slate-900/10"
          aria-label="Ouvrir le menu du compte"
          aria-expanded={mobileMenuOpen}
          aria-controls="account-mobile-menu"
        >
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <div
        className={
          "fixed inset-0 z-50 md:hidden " +
          (mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none")
        }
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className={
            "absolute inset-0 bg-slate-950/35 transition-opacity duration-300 " +
            (mobileMenuOpen ? "opacity-100" : "opacity-0")
          }
          aria-label="Fermer le menu"
          tabIndex={mobileMenuOpen ? 0 : -1}
        />
        <div
          id="account-mobile-menu"
          className={
            "absolute inset-y-0 left-0 w-[min(88vw,320px)] overflow-y-auto bg-white p-3 shadow-2xl transition-transform duration-300 ease-out " +
            (mobileMenuOpen ? "translate-x-0" : "-translate-x-full")
          }
          role="dialog"
          aria-modal="true"
          aria-label="Navigation du compte"
        >
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              aria-label="Fermer le menu"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {accountNav}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-4 md:grid-cols-[280px,1fr]">
        <aside className="hidden h-fit space-y-3 md:block">
          {accountNav}

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-900">Besoin d’aide ?</p>
            <p className="mt-1 text-xs text-slate-600">
              Si tu as oublié ton mot de passe, va dans <span className="font-semibold">Sécurité</span>.
            </p>
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </main>

      <AppFooter />
    </div>
  );
}
