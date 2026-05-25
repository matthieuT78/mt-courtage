// components/AppHeader.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

/**
 * ✅ LOKT V1 (landing-first)
 * - Header minimal : Logo + pages clés.
 *
 * Quand tu passeras à la V2 SaaS : tu pourras remettre la logique auth/nav.
 */

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

export default function AppHeader() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        if (!supabase) {
          if (mounted) setAuthReady(true);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setIsLoggedIn(!!data.session?.user?.id);
        setAuthReady(true);

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          setIsLoggedIn(!!session?.user?.id);
          setAuthReady(true);
        });
        unsubscribe = () => sub.subscription.unsubscribe();
      } catch {
        if (!mounted) return;
        setIsLoggedIn(false);
        setAuthReady(true);
      }
    };

    init();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  // ✅ Toggle simple : V1 landing
  const LOKT_V1_LANDING = true;

  // Liens minimalistes V1
  const v1Links: NavLink[] = [
    ...(authReady && isLoggedIn ? [{ href: "/mon-compte/profil", label: "Mon compte" }] : []),
    { href: "/calculettes", label: "Calculettes" },
    { href: "/outil-gestion-locative", label: "Outil bailleur" },
    { href: "/tarifs", label: "Tarifs" },
    { href: "/#faq", label: "FAQ" },
    { href: "mailto:contact@lokt.fr", label: "Contact", external: true },
  ];

  const isActive = (href: string) => {
    if (href.startsWith("/#")) return false;
    if (href === "/") return router.pathname === "/";
    return router.pathname === href || router.pathname.startsWith(href + "/");
  };

  // 🎨 Brand lokt.fr (accent global)
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  // Header V1 : minimal
  if (LOKT_V1_LANDING) {
    return (
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/LOKT_LOGO.jpg"
                alt="lokt.fr"
                className="h-10 md:h-11 w-auto object-contain"
              />
              <span className="hidden sm:inline text-xs font-semibold tracking-wide text-slate-600">
                Simuler • Décider • Optimiser
              </span>
            </Link>

            {/* Minimal links */}
            <nav className="flex items-center gap-2">
              {v1Links.map((l) =>
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
                      (isActive(l.href)
                        ? `${brandBg} ${brandText} ${brandHover}`
                        : "text-slate-700 hover:bg-slate-100")
                    }
                  >
                    {l.label}
                  </Link>
                )
              )}

              {/* Optionnel : petit badge produit */}
              <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-600">
                lokt.fr
              </span>
            </nav>
          </div>
        </div>
      </header>
    );
  }

  // (Réservé V2 si tu veux réactiver un header SaaS plus tard)
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/LOKT_LOGO.jpg"
              alt="lokt.fr"
              className="h-10 md:h-11 w-auto object-contain"
            />
            <span className="hidden sm:inline text-xs font-semibold tracking-wide text-slate-600">
              Simuler • Décider • Optimiser
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
