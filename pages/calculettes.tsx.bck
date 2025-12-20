// pages/calculettes.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
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
  access: "free" | "blur_if_guest";
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

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
        title: "Investissement locatif",
        desc: "Cash-flow net, rendement réel, effort.",
        href: "/investissement",
        icon: "📈",
        access: "blur_if_guest",
      },
      {
        key: "relais",
        title: "Prêt relais",
        desc: "Budget réaliste, relais, reste à vivre.",
        href: "/pret-relais",
        icon: "🔁",
        access: "blur_if_guest",
      },
      {
        key: "parc",
        title: "Parc immobilier",
        desc: "Vue globale, encours, cash-flow total.",
        href: "/parc-immobilier",
        icon: "🧩",
        access: "blur_if_guest",
      },
    ],
    []
  );

  const go = (href: string) => router.push(href);

  const loginHref = useMemo(() => `/mon-compte?mode=login&redirect=%2Fcalculettes`, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* HERO : très minimal */}
          <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50" />
            <div className="relative p-7 sm:p-9">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600">
                    Calculettes ImmoPilot
                  </p>

                  <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
                    {displayName ? `Bonjour ${displayName}.` : "Simulez en 1 clic."}
                  </h1>

                  <p className="text-sm text-slate-700 max-w-xl">
                    4 outils. Une interface simple. Résultats immédiats.
                  </p>

                  <p className="text-[0.75rem] text-slate-500">
                    {checking ? "…" : isLoggedIn ? "Connecté" : "Visiteur"} —{" "}
                    {isLoggedIn ? "détails complets" : "certaines analyses sont floutées"}
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
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
                    >
                      Créer un compte
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => go("/capacite")}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-[0.9rem] font-semibold text-white hover:bg-slate-800 shadow-sm"
                  >
                    Commencer →
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 4 cartes : point final */}
          <section className="grid gap-4 sm:grid-cols-2">
            {tools.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => go(t.href)}
                className="group relative text-left rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
              >
                {/* halo discret */}
                <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-emerald-50/50 via-white to-slate-50/50" />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg shadow-sm">
                        {t.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-900">{t.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{t.desc}</p>
                      </div>
                    </div>

                    {/* micro info : une seule ligne, pas de badges */}
                    <p className="mt-4 text-[0.75rem] text-slate-500">
                      {t.access === "free"
                        ? "Accès libre"
                        : isLoggedIn
                        ? "Analyse complète"
                        : "Analyse détaillée après inscription"}
                    </p>
                  </div>

                  <span className="relative shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 group-hover:bg-slate-50">
                    Ouvrir →
                  </span>
                </div>
              </button>
            ))}
          </section>

          {/* 1 seul CTA bailleur, très discret */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Espace bailleur</p>
                <p className="text-xs text-slate-600 mt-1">
                  Biens • Locataires • Baux • Quittances • États des lieux
                </p>
              </div>
              <Link
                href="/espace-bailleur"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-[0.8rem] font-semibold text-slate-900 hover:bg-amber-300"
              >
                Ouvrir
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} ImmoPilot</p>
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
