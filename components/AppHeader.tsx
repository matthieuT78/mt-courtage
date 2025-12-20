// components/AppHeader.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string };
};

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

export default function AppHeader() {
  const router = useRouter();

  const [user, setUser] = useState<SimpleUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ✅ SSR-safe: on évite asPath côté serveur (sinon mismatch)
  const [clientAsPath, setClientAsPath] = useState<string>("/");

  useEffect(() => {
    if (!router.isReady) return;
    setClientAsPath(router.asPath || "/");
  }, [router.isReady, router.asPath]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        if (!supabase) {
          if (!mounted) return;
          setUser(null);
          setAuthReady(true);
          return;
        }

        // 1) session initiale
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        setUser((data.session?.user as any) ?? null);
        setAuthReady(true);

        // 2) sync realtime
        const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
          if (!mounted) return;
          setUser((session?.user as any) ?? null);
          setAuthReady(true);
        });

        unsubscribe = () => sub.subscription.unsubscribe();
      } catch (e) {
        if (!mounted) return;
        setUser(null);
        setAuthReady(true);
      }
    };

    init();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const isLoggedIn = !!user?.id;

  const displayName = useMemo(() => {
    if (!user) return "Mon compte";
    return user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "Mon compte");
  }, [user]);

  const closeMobile = () => setMobileOpen(false);

  const signOut = async () => {
    try {
      // signOut supabase
      await supabase?.auth.signOut();
    } finally {
      closeMobile();

      // ✅ replace plutôt que push pour éviter les états "gris" / back weird
      router.replace("/").catch(() => {
        // fallback
        window.location.href = "/";
      });
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return router.pathname === "/";
    return router.pathname === href || router.pathname.startsWith(href + "/");
  };

  const publicLinks: NavLink[] = [
    { href: "/calculettes", label: "Calculettes (gratuit)" },
    { href: "/tarifs", label: "Tarifs" },
    { href: "/#faq", label: "FAQ" },
  ];

  const privateLinks: NavLink[] = [
    { href: "/calculettes", label: "Calculettes" },
    { href: "/espace-bailleur", label: "Boîte à outils bailleur" },
    { href: "/tarifs", label: "Tarifs" },
    { href: "mailto:mtcourtage@gmail.com", label: "Contact", external: true },
  ];

  const links = isLoggedIn ? privateLinks : publicLinks;

  // ✅ lien connexion stable SSR (redirect="/"), puis correct côté client
  const loginHref = useMemo(() => {
    const redirect = encodeURIComponent(clientAsPath || "/");
    return `/mon-compte?mode=login&redirect=${redirect}`;
  }, [clientAsPath]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2" onClick={closeMobile}>
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold">
              IP
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">ImmoPilot</p>
              <p className="text-[0.7rem] text-slate-500 -mt-0.5">Simuler • Décider • Gérer</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            {links.map((l) =>
              l.external ? (
                <a
                  key={l.label}
                  href={l.href}
                  className="rounded-full px-3 py-2 text-[0.8rem] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.label}
                  href={l.href}
                  className={
                    "rounded-full px-3 py-2 text-[0.8rem] font-semibold transition " +
                    (isActive(l.href) ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100")
                  }
                >
                  {l.label}
                </Link>
              )
            )}

            {/* CTAs */}
            {!authReady ? (
              <div className="flex items-center gap-2 pl-2">
                <div className="h-9 w-28 rounded-full bg-slate-100 animate-pulse" />
                <div className="h-9 w-28 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ) : isLoggedIn ? (
              <div className="flex items-center gap-2 pl-2">
                <Link
                  href="/mon-compte"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.8rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {displayName}
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
                >
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2">
                <Link
                  href={loginHref}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.8rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Connexion
                </Link>
                <Link
                  href="/mon-compte?mode=register"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
                >
                  Créer un compte
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile button */}
          <button
            type="button"
            onClick={() => setMobileOpen((s) => !s)}
            className="md:hidden inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            aria-label="Menu"
          >
            {mobileOpen ? "Fermer" : "Menu"}
          </button>
        </div>

        {/* Mobile panel */}
        {mobileOpen && (
          <div className="md:hidden mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
            <div className="flex flex-col gap-1">
              {links.map((l) =>
                l.external ? (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={closeMobile}
                    className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.label}
                    href={l.href}
                    onClick={closeMobile}
                    className={
                      "rounded-xl px-3 py-2 text-sm font-semibold transition " +
                      (isActive(l.href) ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-slate-50")
                    }
                  >
                    {l.label}
                  </Link>
                )
              )}

              <div className="my-2 h-px bg-slate-200" />

              {!authReady ? (
                <p className="px-3 py-2 text-sm text-slate-500">Chargement…</p>
              ) : isLoggedIn ? (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/mon-compte"
                    onClick={closeMobile}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {displayName}
                  </Link>
                  <button
                    type="button"
                    onClick={signOut}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Déconnexion
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href={loginHref}
                    onClick={closeMobile}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Connexion
                  </Link>
                  <Link
                    href="/mon-compte?mode=register"
                    onClick={closeMobile}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Créer un compte
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
