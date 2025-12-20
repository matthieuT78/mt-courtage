// pages/calculettes.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string };
};

type Tool = {
  key: string;
  title: string;
  desc: string;
  href: string;
  icon: string;
  access: "free" | "analysis_after_login";
};

export default function CalculettesPage() {
  const router = useRouter();
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser((data.session?.user as any) ?? null);
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      setUser((session?.user as any) ?? null);
      setChecking(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isLoggedIn = !!user?.id;
  const displayName =
    user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : null);

  const tools: Tool[] = useMemo(
    () => [
      {
        key: "capacite",
        title: "Capacité d’emprunt",
        desc: "Mensualité max, capital, prix indicatif.",
        href: "/capacite",
        icon: "🏠",
        access: "free",
      },
      {
        key: "invest",
        title: "Rentabilité locative",
        desc: "Cash-flow net, rendement réel, effort.",
        href: "/investissement",
        icon: "📈",
        access: "analysis_after_login",
      },
      {
        key: "relais",
        title: "Achat-revente / prêt relais",
        desc: "Budget réaliste, relais, reste à vivre.",
        href: "/pret-relais",
        icon: "🔁",
        access: "analysis_after_login",
      },
      {
        key: "parc",
        title: "Parc immobilier",
        desc: "Vue globale, encours, cash-flow total.",
        href: "/parc-immobilier",
        icon: "🧩",
        access: "analysis_after_login",
      },
    ],
    []
  );

  const go = (href: string) => router.push(href);

  const loginHref = `/mon-compte?mode=login&redirect=%2Fcalculettes`;

  // 🎨 Brand Izimo
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* HERO */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className={`h-1.5 w-full ${brandBg}`} />
            <div className="p-7 sm:p-9">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-3">
                  {/* Logo Izimo propre (sans halo) */}
                  <div className="inline-flex items-center gap-3">
                    <div className="rounded-2xl bg-white border border-slate-200 p-2 shadow-sm">
                      <img
                        src="/izimo-logo.png"
                        alt="Izimo"
                        className="h-9 sm:h-10 w-auto object-contain"
                      />
                    </div>
                    <p className="hidden sm:block text-xs font-semibold tracking-wide text-slate-600">
                      Simuler • Décider • Gérer
                    </p>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
                    {displayName ? `Bonjour ${displayName}.` : "Toutes les calculettes Izimo."}
                  </h1>

                  <p className="text-sm text-slate-700 max-w-xl">
                    Simulez librement vos projets. Les résultats essentiels sont gratuits.
                    L’analyse détaillée est disponible après création d’un compte gratuit.
                  </p>

                  <p className="text-[0.75rem] text-slate-500">
                    {checking ? "…" : isLoggedIn ? "Connecté" : "Visiteur"} — analyses de base accessibles
                  </p>
                </div>

                {!checking && !isLoggedIn ? (
                  <div className="flex gap-2">
                    <Link
                      href={loginHref}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.8rem] font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Connexion
                    </Link>
                    <Link
                      href="/mon-compte?mode=register&redirect=%2Fcalculettes"
                      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-[0.8rem] font-semibold ${brandBg} ${brandText} ${brandHover}`}
                    >
                      Créer un compte
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => go("/capacite")}
                    className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-[0.9rem] font-semibold ${brandBg} ${brandText} ${brandHover}`}
                  >
                    Commencer →
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* CARTES CALCULETTES */}
          <section className="grid gap-4 sm:grid-cols-2">
            {tools.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => go(t.href)}
                className="group relative text-left rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-11 w-11 rounded-2xl ${brandBg} text-white flex items-center justify-center text-lg shadow-sm`}
                      >
                        {t.icon}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-900">{t.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{t.desc}</p>
                      </div>
                    </div>

                    <p className="mt-4 text-[0.75rem] text-slate-500">
                      {t.access === "free"
                        ? "Accès libre"
                        : "Analyse détaillée disponible après inscription gratuite"}
                    </p>
                  </div>

                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 group-hover:bg-slate-50">
                    Ouvrir →
                  </span>
                </div>
              </button>
            ))}
          </section>

          {/* CTA Espace bailleur */}
          <section className="rounded-3xl border border-slate-200 bg-slate-900 text-white shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Espace bailleur</p>
                <p className="text-sm text-slate-200 mt-1">
                  Gestion locative complète : baux, quittances, cautions, états des lieux.
                </p>
                <p className="text-xs text-slate-300 mt-2">
                  À partir de <span className="font-semibold text-cyan-200">29 € / mois</span>
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/tarifs"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-white/10"
                >
                  Voir les tarifs
                </Link>
                <Link
                  href="/espace-bailleur"
                  className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-[0.8rem] font-semibold ${brandBg} ${brandText} ${brandHover}`}
                >
                  Découvrir l’espace bailleur
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
