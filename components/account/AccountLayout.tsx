// components/account/AccountLayout.tsx
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import AppHeader from "../AppHeader";
import AppFooter from "../AppFooter";

type Props = {
  userEmail: string | null;
  active: "overview" | "profile" | "securite" | "abonnement" | "preferences";
  onLogout: () => Promise<void> | void;
  children: ReactNode;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function NavItem({
  href,
  active,
  label,
  sub,
}: {
  href: string;
  active: boolean;
  label: string;
  sub?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors",
        active
          ? "bg-slate-900 text-white"
          : "text-slate-700 hover:bg-slate-100"
      )}
    >
      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
      <div className="min-w-0">
        <p className={cx("text-sm font-semibold truncate", active ? "text-white" : "text-slate-900")}>
          {label}
        </p>
        {sub && (
          <p className={cx("mt-0.5 text-xs truncate", active ? "text-slate-300" : "text-slate-500")}>
            {sub}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function AccountLayout({ userEmail, active, onLogout, children }: Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle =
    active === "overview" ? "Mon compte"
    : active === "profile" ? "Profil"
    : active === "securite" ? "Sécurité"
    : active === "abonnement" ? "Abonnement"
    : "Préférences";

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await onLogout(); } catch {}
    router.push("/");
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileMenuOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  const accountNav = (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header compte */}
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">Mon compte</p>
        <p className="text-sm font-semibold text-slate-900 truncate">{userEmail || "Non connecté"}</p>
      </div>

      {/* Navigation */}
      <div className="p-2 space-y-0.5">
        <NavItem href="/mon-compte"               active={active === "overview"}     label="Vue d'ensemble"  sub="Statut & accès rapide" />
        <NavItem href="/mon-compte/profil"        active={active === "profile"}      label="Profil"          sub="Identité, adresse & RIB" />
        <NavItem href="/mon-compte/securite"      active={active === "securite"}     label="Sécurité"        sub="Mot de passe & compte" />
        <NavItem href="/mon-compte/abonnement"    active={active === "abonnement"}   label="Abonnement"      sub="Offre & facturation" />
        <NavItem href="/mon-compte/preferences"   active={active === "preferences"}  label="Préférences"     sub="Ordre des onglets" />
      </div>

      {/* Déconnexion */}
      <div className="p-3 border-t border-slate-100">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          {loggingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Head>
        <title>{`${pageTitle} | lokt.fr`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AppHeader />
      <div className="h-px w-full bg-slate-200" />

      {/* Mobile menu trigger */}
      <div className="mx-auto max-w-6xl px-4 pt-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm"
          aria-label="Ouvrir le menu du compte"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={"fixed inset-0 z-50 md:hidden " + (mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className={"absolute inset-0 bg-slate-950/30 transition-opacity duration-300 " + (mobileMenuOpen ? "opacity-100" : "opacity-0")}
          aria-label="Fermer le menu"
          tabIndex={mobileMenuOpen ? 0 : -1}
        />
        <div
          className={"absolute inset-y-0 left-0 w-[min(88vw,320px)] overflow-y-auto bg-slate-50 p-3 shadow-2xl transition-transform duration-300 ease-out " + (mobileMenuOpen ? "translate-x-0" : "-translate-x-full")}
          role="dialog"
          aria-modal="true"
        >
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              aria-label="Fermer le menu"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {accountNav}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 grid gap-6 md:grid-cols-[260px,1fr]">
        <aside className="hidden h-fit md:block">
          {accountNav}
        </aside>
        <section className="min-w-0">{children}</section>
      </main>

      <AppFooter />
    </div>
  );
}
