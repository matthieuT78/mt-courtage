// pages/calculettes.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
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
  badge?: { label: string; tone: "emerald" | "amber" | "slate" };
  note?: string;
};

export default function CalculettesPage() {
  const router = useRouter();
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // ✅ évite un "checking" bloqué si, un jour, supabase n'est pas dispo
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
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : null);

  // ✅ IMPORTANT : Calculettes = toujours accessibles (visiteur OK)
  const goToTool = (path: string) => {
    router.push(path);
  };

  const tools: Tool[] = useMemo(
    () => [
      {
        key: "capacite",
        title: "Capacité d’emprunt",
        desc: "Mensualité max, capital empruntable, prix indicatif.",
        href: "/capacite",
        icon: "🏠",
        badge: { label: "Gratuit", tone: "emerald" },
        note: "Accès direct",
      },
      {
        key: "invest",
        title: "Investissement locatif",
        desc: "Cash-flow net, rendement réel, effort mensuel.",
        href: "/investissement",
        icon: "📈",
        badge: { label: "Analyse + si inscrit", tone: "amber" },
        note: "Analyse floutée si visiteur",
      },
      {
        key: "relais",
        title: "Achat revente / Prêt relais",
        desc: "Budget réaliste, relais, reste à vivre.",
        href: "/pret-relais",
        icon: "🔁",
        badge: { label: "Analyse + si inscrit", tone: "amber" },
        note: "Analyse floutée si visiteur",
      },
      {
        key: "parc",
        title: "Parc immobilier global",
        desc: "Vue globale, cash-flow total, encours.",
        href: "/parc-immobilier",
        icon: "🧩",
        badge: { label: "Analyse + si inscrit", tone: "amber" },
        note: "Analyse floutée si visiteur",
      },
    ],
    []
  );

  const Badge = ({
    tone,
    label,
  }: {
    tone: "emerald" | "amber" | "slate";
    label: string;
  }) => {
    const cls =
      tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

    return (
      <span
        className={
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold " +
          cls
        }
      >
        {label}
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* HERO WAOU */}
          <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-amber-50" />
            <div className="relative p-6 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600">
                    Calculettes • Simulations
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
                    {displayName
                      ? `Bonjour ${displayName}.`
                      : "Choisissez votre objectif."}
                  </h1>
                  <p className="text-sm text-slate-700 max-w-2xl">
                    Cliquez, simulez, sauvegardez. En visiteur : accès OK,
                    analyse détaillée floutée.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
                      ⚡ Résultats instantanés
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
                      🧠 Logique “banque”
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
                      📌 Sauvegarde {isLoggedIn ? "active" : "après inscription"}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => goToTool("/capacite")}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 shadow-md"
                  >
                    Démarrer en 30 secondes →
                  </button>
                  <p className="text-[0.7rem] text-slate-600 text-right">
                    Accès direct.
                  </p>
                </div>
              </div>

              {/* Quick start tiles */}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: "Acheter",
                    desc: "Capacité + budget",
                    icon: "🏠",
                    href: "/capacite",
                  },
                  {
                    title: "Investir",
                    desc: "Cash-flow & rendement",
                    icon: "📈",
                    href: "/investissement",
                  },
                  {
                    title: "Achat revente",
                    desc: "Prêt relais",
                    icon: "🔁",
                    href: "/pret-relais",
                  },
                ].map((x) => (
                  <button
                    key={x.title}
                    type="button"
                    onClick={() => goToTool(x.href)}
                    className="group text-left rounded-2xl border border-slate-200 bg-white/70 backdrop-blur px-4 py-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {x.title}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">{x.desc}</p>
                      </div>
                      <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg shadow-sm transition group-hover:scale-[1.03]">
                        {x.icon}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* GRID DES OUTILS */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                  Bibliothèque
                </p>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                  Toutes les calculettes
                </h2>
              </div>
              <div className="text-[0.7rem] text-slate-500">
                {checking ? "…" : isLoggedIn ? "Connecté" : "Visiteur"}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {tools.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => goToTool(t.href)}
                  className="group relative text-left rounded-2xl border border-slate-200 bg-white shadow-sm p-5 transition hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-emerald-50/60 via-white to-amber-50/60" />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg shadow-sm">
                          {t.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {t.title}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {t.desc}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {t.badge ? (
                          <Badge tone={t.badge.tone} label={t.badge.label} />
                        ) : null}
                        <span className="text-[0.65rem] text-slate-500">
                          {t.note ?? ""}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-white">
                        Ouvrir →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Vous voulez gérer vos locations ?
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Accédez au dashboard bailleur (biens, locataires, baux,
                    quittances).
                  </p>
                </div>
                <Link
                  href="/espace-bailleur"
                  className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-[0.8rem] font-semibold text-slate-900 hover:bg-amber-300"
                >
                  Ouvrir l’espace bailleur
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} ImmoPilot – Calculettes.</p>
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
