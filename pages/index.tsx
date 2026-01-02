// pages/index.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

function firstNameFromUser(user: SimpleUser | null) {
  const raw =
    user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "");
  const first = String(raw || "").trim().split(/\s+/)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
      {children}
    </span>
  );
}

function ToolCard({
  title,
  desc,
  href,
  onClick,
  badge,
  requiresAuth = false,
  featured = false,
}: {
  title: string;
  desc: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
  requiresAuth?: boolean;
  featured?: boolean;
}) {
  // Plus de gros noir : on met une card claire, avec un liseré + halo coloré si "featured"
  const base =
    "h-full rounded-3xl border transition flex flex-col overflow-hidden " +
    (featured
      ? "border-cyan-200 bg-white shadow-sm hover:shadow-md"
      : "border-slate-200 bg-slate-50 hover:bg-white hover:shadow-md");

  const pad = "p-4 sm:p-5";

  const content = (
    <div className={base}>
      {featured ? (
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-700 to-cyan-500" />
      ) : (
        <div className="h-1 w-full bg-slate-100" />
      )}

      <div className={`${pad} flex flex-col h-full relative`}>
        {featured ? (
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-cyan-200/40 blur-3xl" />
        ) : null}

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{title}</p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              {badge ? (
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                  {badge}
                </p>
              ) : null}

              {requiresAuth ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold border bg-white text-slate-700 border-slate-200">
                  Compte requis
                </span>
              ) : null}

              {featured ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold border border-cyan-200 bg-cyan-50 text-cyan-800">
                  Recommandé
                </span>
              ) : null}
            </div>
          </div>

          <span className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[0.65rem] font-semibold border bg-white text-slate-700 border-slate-200">
            Calculette
          </span>
        </div>

        <p className="relative mt-2 leading-relaxed text-[0.78rem] sm:text-xs text-slate-600">
          {desc}
        </p>

        <div className="mt-auto pt-4 relative">
          <p className="text-xs font-semibold underline decoration-slate-300 text-slate-900">
            Ouvrir →
          </p>
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block h-full">{content}</Link>;
  return (
    <button type="button" onClick={onClick} className="text-left block h-full w-full">
      {content}
    </button>
  );
}

function ProgressMini() {
  const steps = [
    { n: 1, label: "Choisir la calculette" },
    { n: 2, label: "Renseigner" },
    { n: 3, label: "Analyse" },
  ];

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        {steps.map((s, idx) => (
          <div key={s.n} className="flex items-center gap-3 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-indigo-700 to-cyan-500 text-white text-[0.75rem] font-semibold">
              {s.n}
            </div>
            <p className="text-[0.8rem] text-slate-700 font-medium truncate">{s.label}</p>
            {idx < steps.length - 1 ? (
              <div className="hidden sm:block h-px w-10 bg-slate-200" />
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.72rem] text-slate-500">
        Un parcours rapide, des résultats clairs, et une lecture structurée pour décider.
      </p>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted) return;
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error("Erreur récupération session (home)", e);
      }
    };

    fetchSession();

    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const isLoggedIn = !!user;
  const displayName = useMemo(() => firstNameFromUser(user), [user]);

  const goToProtectedTool = (path: string) => {
    if (isLoggedIn) router.push(path);
    else router.push(`/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`);
  };

  const brandBar = "bg-gradient-to-r from-indigo-700 to-cyan-500";

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* =========================================================
              1) HERO — joyeux, coloré, épuré
          ========================================================== */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${brandBar}`} />

            <div className="p-7 sm:p-10">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>Capacité d’emprunt</Pill>
                  <Pill>Prêt relais</Pill>
                  <Pill>Rentabilité locative</Pill>
                  <Pill>Parc immobilier</Pill>
                </div>

                <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
                  <div className="space-y-3">
                    <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 leading-tight">
                      {isLoggedIn && displayName ? (
                        <>
                          Bonjour {displayName}.<br />
                          Lancez vos simulations avec lokt.fr.
                        </>
                      ) : (
                        <>
                          Lancez vos simulations
                          <br />
                          immobilières avec lokt.fr.
                        </>
                      )}
                    </h1>

                    <p className="text-sm text-slate-600 max-w-2xl">
                      Quatre calculettes essentielles pour cadrer un budget, comparer un projet et avancer
                      avec une analyse structurée.
                    </p>

                    {/* CTA plus “marque” */}
                    <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-3">
                      <Link
                        href="/commencer"
                        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-700 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-md hover:opacity-95"
                      >
                        Commencer à calculer
                      </Link>

                      <Link
                        href="/capacite"
                        className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Aller à la capacité d’emprunt →
                      </Link>
                    </div>

                    {/* Mini progression (plus colorée) */}
                    <ProgressMini />
                  </div>

                  {/* Petit panneau “différence” coloré (sans noir) */}
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-40 blur-3xl bg-cyan-200" />
                    <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-30 blur-3xl bg-indigo-200" />

                    <div className="relative space-y-3">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                        Ce que vous obtenez
                      </p>
                      <p className="text-base font-semibold text-slate-900">
                        Des résultats compréhensibles et réutilisables
                      </p>
                      <p className="text-sm text-slate-600">
                        lokt.fr ne se contente pas d’un chiffre : la sortie est structurée, avec les points
                        utiles pour arbitrer et préparer un échange.
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-900">Lecture structurée</p>
                          <p className="mt-1 text-xs text-slate-600">
                            Contexte, cohérence, points d’attention.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-900">Historique</p>
                          <p className="mt-1 text-xs text-slate-600">
                            Suivi des simulations (selon accès).
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 cartes alignées (mêmes tailles) */}
                <div className="pt-2 grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
                  <ToolCard
                    title="Capacité d’emprunt"
                    badge="La plus recherchée"
                    desc="Mensualité maximale, capital empruntable et budget indicatif, avec une lecture structurée."
                    href="/capacite"
                    featured
                  />

                  <ToolCard
                    title="Prêt relais"
                    desc="Budget d’achat maximal : estimation du relais, capacité du nouveau prêt et comparaison avec votre cible."
                    href="/pret-relais"
                  />

                  <ToolCard
                    title="Rentabilité locative"
                    desc="Cash-flow net, rendement, effort d’épargne et scénarios de financement."
                    requiresAuth
                    onClick={() => goToProtectedTool("/investissement")}
                  />

                  <ToolCard
                    title="Parc immobilier"
                    desc="Vision globale de votre patrimoine : consolidation, encours et flux (cash-flow total)."
                    requiresAuth
                    onClick={() => goToProtectedTool("/parc-immobilier")}
                  />
                </div>

                <p className="text-[0.75rem] text-slate-500">
                  Résultats indicatifs. Certaines fonctionnalités (sauvegarde, analyses) dépendent de votre accès.
                </p>
              </div>
            </div>
          </section>

          {/* =========================================================
              2) MARKETING — comparaison “classique vs lokt.fr”
          ========================================================== */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <div className="space-y-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                Qualité d’analyse
              </p>

              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                lokt.fr apporte une lecture plus exploitable qu’une calculette standard.
              </h2>

              <p className="text-sm text-slate-600 max-w-4xl">
                Au lieu d’un simple résultat, lokt.fr met en forme l’information : ce qui compte, ce qui
                pèse, et ce qui peut être ajusté pour améliorer votre situation.
              </p>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">Calculette classique</p>
                  <ul className="mt-3 space-y-2 text-xs text-slate-700">
                    <li className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-slate-400" />
                      <span>Résultat brut, peu contextualisé</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-slate-400" />
                      <span>Lecture “dossier” limitée</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-slate-400" />
                      <span>Peu d’aide pour prioriser les leviers</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-3xl border border-cyan-200 bg-white p-5">
                  <div className="inline-flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-700 to-cyan-500" />
                    <p className="text-sm font-semibold text-slate-900">lokt.fr</p>
                  </div>

                  <ul className="mt-3 space-y-2 text-xs text-slate-700">
                    <li className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-cyan-600" />
                      <span>Chiffres + explication structurée</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-cyan-600" />
                      <span>Points d’attention et cohérence globale</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-cyan-600" />
                      <span>Résultat plus facile à réutiliser et comparer</span>
                    </li>
                  </ul>

                  <div className="mt-4">
                    <Link
                      href="/capacite"
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-700 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
                    >
                      Voir sur la capacité d’emprunt →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================
              4) Bandeau bailleur — inchangé
          ========================================================== */}
          <section className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-900 text-white p-7 sm:p-10 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-25 blur-3xl bg-emerald-400" />
              <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl bg-cyan-500" />

              <div className="relative grid gap-6 lg:grid-cols-2 lg:items-center">
                <div className="space-y-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-300">
                    Pour aller plus loin
                  </p>
                  <h3 className="text-2xl font-semibold">
                    Espace bailleur : centralisez votre gestion locative
                  </h3>
                  <p className="text-sm text-slate-200 max-w-2xl">
                    Quittances, dépôts de garantie, états des lieux, rappels et documents : un espace
                    dédié pour structurer votre gestion et gagner du temps.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Link
                      href="/espace-bailleur"
                      className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:opacity-95"
                    >
                      Découvrir l’espace bailleur →
                    </Link>
                    <Link
                      href="/tarifs"
                      className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Voir les tarifs →
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-sm font-semibold">Quittances & documents</p>
                    <p className="text-xs text-slate-200 mt-1">Génération, archivage, historique.</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-sm font-semibold">Dépôts de garantie</p>
                    <p className="text-xs text-slate-200 mt-1">Suivi, restitutions et rappels.</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-sm font-semibold">États des lieux</p>
                    <p className="text-xs text-slate-200 mt-1">Modèles et organisation.</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-sm font-semibold">Échéances</p>
                    <p className="text-xs text-slate-200 mt-1">Alertes, révisions, renouvellements.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
