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

type Tone = "emerald" | "amber" | "slate";

type Tool = {
  key: string;
  title: string;
  desc: string;
  href: string;
  icon: string;
  category: "Achat" | "Investissement" | "Patrimoine";
  access: "free" | "blur_if_guest";
  badge?: { label: string; tone: Tone };
  tags?: string[];
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function Badge({ tone, label }: { tone: Tone; label: string }) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold", cls)}>
      {label}
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
      {children}
    </span>
  );
}

export default function CalculettesPage() {
  const router = useRouter();

  const [user, setUser] = useState<SimpleUser | null>(null);
  const [checking, setChecking] = useState(true);

  // UI state
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"Toutes" | Tool["category"]>("Toutes");

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

  const go = (href: string) => router.push(href);

  const tools: Tool[] = useMemo(
    () => [
      {
        key: "capacite",
        title: "Capacité d’emprunt",
        desc: "Mensualité max, capital empruntable, prix indicatif.",
        href: "/capacite",
        icon: "🏠",
        category: "Achat",
        access: "free",
        badge: { label: "Gratuit", tone: "emerald" },
        tags: ["Budget", "Mensualité", "Banque"],
      },
      {
        key: "invest",
        title: "Investissement locatif",
        desc: "Cash-flow net, rendement réel, effort mensuel.",
        href: "/investissement",
        icon: "📈",
        category: "Investissement",
        access: "blur_if_guest",
        badge: { label: "Analyse si inscrit", tone: "amber" },
        tags: ["Cash-flow", "Rendement", "Charges"],
      },
      {
        key: "relais",
        title: "Achat revente / Prêt relais",
        desc: "Budget réaliste, relais, reste à vivre.",
        href: "/pret-relais",
        icon: "🔁",
        category: "Achat",
        access: "blur_if_guest",
        badge: { label: "Analyse si inscrit", tone: "amber" },
        tags: ["Relais", "Reste à vivre"],
      },
      {
        key: "parc",
        title: "Parc immobilier global",
        desc: "Vue globale, cash-flow total, encours.",
        href: "/parc-immobilier",
        icon: "🧩",
        category: "Patrimoine",
        access: "blur_if_guest",
        badge: { label: "Analyse si inscrit", tone: "amber" },
        tags: ["Portefeuille", "Global"],
      },
    ],
    []
  );

  // “Recommandé” : 3 cartes max, orientées action
  const featuredKeys = ["capacite", "invest", "relais"];
  const featured = tools.filter((t) => featuredKeys.includes(t.key));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((t) => {
      const inCat = category === "Toutes" ? true : t.category === category;

      if (!q) return inCat;

      const hay = [
        t.title,
        t.desc,
        t.category,
        ...(t.tags || []),
        t.access === "free" ? "gratuit" : "inscription",
      ]
        .join(" ")
        .toLowerCase();

      return inCat && hay.includes(q);
    });
  }, [tools, query, category]);

  // CTA connexion “soft” (pas agressif)
  const loginHref = useMemo(() => {
    const redirect = encodeURIComponent("/calculettes");
    return `/mon-compte?mode=login&redirect=${redirect}`;
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-6xl space-y-5">
          {/* TOP BAR (pro, ultra simple) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50" />
              <div className="relative p-6 sm:p-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600">
                      Bibliothèque de calculettes
                    </p>

                    <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
                      {displayName ? `Bonjour ${displayName}.` : "Choisissez un outil, et simulez."}
                    </h1>

                    <p className="text-sm text-slate-700 max-w-2xl">
                      Une interface unique. Recherche instantanée. En visiteur : accès OK, certaines analyses sont floutées.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Pill>⚡ Rapide</Pill>
                      <Pill>🧠 “Logique banque”</Pill>
                      <Pill>📌 Sauvegarde {isLoggedIn ? "active" : "si inscrit"}</Pill>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-stretch gap-2">
                    <button
                      type="button"
                      onClick={() => go("/capacite")}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
                    >
                      Démarrer par la capacité →
                    </button>

                    {!checking && !isLoggedIn ? (
                      <div className="flex gap-2 justify-end">
                        <Link
                          href={loginHref}
                          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.8rem] font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Connexion
                        </Link>
                        <Link
                          href="/mon-compte?mode=register&redirect=%2Fcalculettes"
                          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-emerald-500"
                        >
                          Créer un compte
                        </Link>
                      </div>
                    ) : (
                      <p className="text-[0.7rem] text-slate-600 text-right">
                        {checking ? "…" : isLoggedIn ? "Connecté" : "Visiteur"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Search + filter */}
                <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr,auto] md:items-center">
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                        ⌕
                      </div>
                      <div className="flex-1">
                        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                          Recherche
                        </p>
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Ex : cashflow, prêt relais, rendement, mensualité…"
                          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                        />
                      </div>
                      {query ? (
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.75rem] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Effacer
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap md:justify-end">
                    {(["Toutes", "Achat", "Investissement", "Patrimoine"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={cx(
                          "rounded-full px-4 py-2 text-xs font-semibold border transition",
                          category === c
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RECOMMANDÉ (3 cartes, pas plus) */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Recommandé</p>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                  Les 3 outils les plus utilisés
                </h2>
              </div>
              <p className="text-[0.75rem] text-slate-500">
                Objectif : aller vite, sans se poser de questions.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {featured.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => go(t.href)}
                  className="group text-left rounded-2xl border border-slate-200 bg-white shadow-sm p-5 hover:shadow-md transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg shadow-sm">
                          {t.icon}
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">{t.desc}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {t.badge ? <Badge tone={t.badge.tone} label={t.badge.label} /> : null}
                        <span className="text-[0.65rem] text-slate-500">{t.category}</span>
                      </div>
                    </div>

                    <span className="shrink-0 inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-white">
                      Ouvrir →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* TOUTES */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Catalogue</p>
                <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                  Toutes les calculettes
                </h2>
              </div>
              <p className="text-[0.75rem] text-slate-500">
                {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-700">
                Aucun résultat. Essaie “cashflow”, “mensualité”, “relais”, “rendement”…
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filtered.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => go(t.href)}
                    className="group text-left rounded-2xl border border-slate-200 bg-white shadow-sm p-5 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg shadow-sm">
                            {t.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{t.desc}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {t.badge ? <Badge tone={t.badge.tone} label={t.badge.label} /> : null}
                          <Badge tone="slate" label={t.category} />
                          {(t.tags || []).slice(0, 3).map((x) => (
                            <span key={x} className="text-[0.65rem] text-slate-500">
                              {x}
                            </span>
                          ))}
                        </div>
                      </div>

                      <span className="shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 group-hover:bg-slate-50">
                        Ouvrir →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* CTA bailleur (sobre, 1 seul) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Gestion locative</p>
                <p className="text-xs text-slate-600 mt-1">
                  Biens, locataires, baux, quittances, états des lieux.
                </p>
              </div>
              <Link
                href="/espace-bailleur"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-[0.8rem] font-semibold text-slate-900 hover:bg-amber-300"
              >
                Ouvrir l’espace bailleur
              </Link>
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
