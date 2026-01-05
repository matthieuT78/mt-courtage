// pages/index.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  const raw = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "");
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

function AbstractHeroArt() {
  // micro-illustration abstraite, légère (sans “encadré” / squelette)
  // ✅ point bleu en haut à droite supprimé
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="absolute -bottom-36 -left-36 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="absolute top-10 left-12 h-3 w-3 rounded-full bg-cyan-500/40" />
      <div className="absolute bottom-12 left-24 h-2 w-2 rounded-full bg-emerald-500/30" />
    </div>
  );
}

function ToolCard({
  title,
  desc,
  href,
  highlight = false,
  badge,
}: {
  title: string;
  desc: string;
  href: string;
  highlight?: boolean;
  badge?: string;
}) {
  const base =
    "h-full rounded-3xl border p-5 transition flex flex-col " +
    (highlight
      ? "border-slate-200 bg-white shadow-sm hover:shadow-md"
      : "border-slate-200 bg-slate-50 hover:bg-white hover:shadow-md");

  const content = (
    <div className={base}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {badge ? (
            <p className="mt-1 text-[0.7rem] uppercase tracking-[0.18em] text-indigo-700">{badge}</p>
          ) : null}
        </div>

        <span
          className={
            "shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[0.65rem] font-semibold border " +
            (highlight ? "bg-indigo-50 text-indigo-800 border-indigo-200" : "bg-white text-slate-700 border-slate-200")
          }
        >
          Calculette
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-600">{desc}</p>

      <div className="mt-auto pt-4">
        <p className="text-xs font-semibold underline decoration-slate-300 text-slate-900">Ouvrir →</p>
      </div>
    </div>
  );

  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  );
}

export default function Home() {
  const [user, setUser] = useState<SimpleUser | null>(null);

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

  // Couleurs logo (rappel)
  const brandGrad = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandGradSoft = "bg-gradient-to-r from-indigo-50 to-cyan-50";

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* =========================================================
              1) HERO — section clé : 4 calculettes (sans bouton CTA)
          ========================================================== */}
          <section className="relative rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${brandGrad}`} />
            <div className="relative p-7 sm:p-10">
              <AbstractHeroArt />

              <div className="relative space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>Capacité d’emprunt</Pill>
                  <Pill>Prêt relais</Pill>
                  <Pill>Rentabilité locative</Pill>
                  <Pill>Parc immobilier</Pill>
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 leading-tight">
                    {isLoggedIn && displayName ? (
                      <>
                        Bonjour {displayName}.<br />
                        Lancez vos simulations immobilières avec lokt.fr
                      </>
                    ) : (
                      <>
                        Lancez vos simulations
                        <br />
                        immobilières avec lokt.fr
                      </>
                    )}
                  </h1>

                  <p className="text-sm text-slate-600 max-w-3xl">
                    Choisissez directement la calculette qui correspond à votre situation — achat, investissement, relais
                    ou consolidation de patrimoine.
                  </p>

                  <p className="text-[0.85rem] text-slate-700 max-w-3xl">
                    <span className="font-semibold">Par où commencer ?</span> Si c’est votre premier achat, commencez
                    par la <span className="font-semibold">capacité d’emprunt</span>. Si vous hésitez entre plusieurs
                    scénarios, testez la calculette la plus proche de votre objectif, puis comparez.
                  </p>
                </div>

                {/* 4 cartes alignées / mêmes tailles */}
                <div className="pt-2 grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
                  <ToolCard
                    title="Capacité d’emprunt"
                    badge="Le point de départ"
                    desc="Vous achetez (ou vous envisagez d’acheter) ? Estimez votre mensualité cible, votre capital empruntable et un budget réaliste."
                    href="/capacite"
                    highlight
                  />

                  <ToolCard
                    title="Prêt relais"
                    desc="Vous voulez acheter avant d’avoir vendu ? Estimez le relais, la capacité du nouveau prêt et votre budget maximal."
                    href="/pret-relais"
                  />

                  <ToolCard
                    title="Rentabilité locative"
                    desc="Vous souhaitez investir dans l’immobilier ? Cette calculette vous aide à projeter votre futur achat et à calculer sa rentabilité réelle."
                    href="/investissement"
                  />

                  <ToolCard
                    title="Parc immobilier"
                    desc="Vous avez plusieurs biens ? Obtenez une vision consolidée : encours, flux mensuels et lecture globale de votre patrimoine."
                    href="/parc-immobilier"
                  />
                </div>

                <p className="text-[0.75rem] text-slate-500">
                  Résultats indicatifs. Certaines fonctionnalités (sauvegarde, analyses avancées) peuvent dépendre de
                  votre accès.
                </p>
              </div>
            </div>
          </section>

          {/* =========================================================
              2) MARKETING — Qualité d’analyse (plus “waou”)
          ========================================================== */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${brandGradSoft}`} />
            <div className="p-6 sm:p-8">
              <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                <div className="space-y-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Ce que <span className="lowercase">lokt.fr</span> apporte de plus qu’une simple calculette
                  </p>

                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                    Une analyse conçue pour décider — et pour être comprise.
                  </h2>

                  <p className="text-sm text-slate-600 max-w-2xl">
                    Un “bon résultat” n’a de valeur que s’il est{" "}
                    <span className="font-semibold">exploitable</span>. lokt.fr met en avant les hypothèses, clarifie
                    les leviers, et propose une lecture homogène entre outils, afin que vous puissiez arbitrer avec
                    méthode.
                  </p>

                  <div className="pt-3 space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Une lecture structurée (comme un dossier)</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Revenus, charges, endettement, hypothèses : tout est présenté de façon lisible. Vous savez ce
                        qui “tient” et ce qui doit être optimisé.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        Des leviers concrets plutôt qu’un chiffre isolé
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Ajustez durée, taux, apport ou structure : vous voyez l’impact réel sur la mensualité, le
                        budget, l’effort d’épargne ou la rentabilité.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Une cohérence entre les calculettes</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Même logique de lecture entre capacité, relais, investissement et parc : vous comparez des
                        scénarios sans biais d’outil.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bloc “preuve” marketing — visuel + bullets */}
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6">
                  <p className="text-sm font-semibold text-slate-900">Ce qui fait la différence</p>
                  <p className="text-xs text-slate-600 mt-1">Une expérience pensée pour des décisions immobilières.</p>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-900">Lisibilité immédiate</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Une synthèse claire, puis le détail si vous en avez besoin.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-900">Arbitrage plus rapide</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Vous identifiez rapidement le scénario le plus cohérent (budget, effort, rentabilité).
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-900">Résultats utilisables</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Un rendu pensé pour comprendre, décider, et préparer un échange efficace.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-600">
                      Conseil pratique : commencez par la calculette la plus proche de votre objectif, puis utilisez les
                      autres pour valider ou affiner votre décision.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================
              3) Bandeau bailleur — couleurs logo + bouton Tarifs qui ressort
          ========================================================== */}
          <section className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className={`relative ${brandGrad} text-white p-7 sm:p-10 overflow-hidden`}>
              <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-25 blur-3xl bg-white" />
              <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full opacity-20 blur-3xl bg-indigo-900" />

              <div className="relative grid gap-6 lg:grid-cols-2 lg:items-center">
                <div className="space-y-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-white/80">Pour aller plus loin</p>
                  <h3 className="text-2xl font-semibold">Espace bailleur</h3>
                  <p className="text-sm text-white/90 max-w-2xl">
                    Centralisez quittances, dépôts de garantie, états des lieux, rappels et documents. Un espace dédié
                    pour structurer votre gestion et gagner du temps.
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
                      className="inline-flex items-center justify-center rounded-full border border-white/30 bg-slate-900/20 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-900/30"
                    >
                      Tarifs →
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                    <p className="text-sm font-semibold">Quittances & documents</p>
                    <p className="text-xs text-white/85 mt-1">Génération, archivage, historique.</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                    <p className="text-sm font-semibold">Dépôts de garantie</p>
                    <p className="text-xs text-white/85 mt-1">Suivi, restitutions et rappels.</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                    <p className="text-sm font-semibold">États des lieux</p>
                    <p className="text-xs text-white/85 mt-1">Modèles et organisation.</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                    <p className="text-sm font-semibold">Échéances</p>
                    <p className="text-xs text-white/85 mt-1">Alertes, révisions, renouvellements.</p>
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
