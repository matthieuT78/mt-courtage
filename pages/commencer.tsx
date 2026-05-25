// pages/commencer.tsx
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { supabase } from "../lib/supabaseClient";
import { firstNameFromUser } from "../lib/userDisplay";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
    first_name?: string;
    given_name?: string;
  };
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
      {children}
    </span>
  );
}

function AbstractHeroArt() {
  // ✅ même style que la home (sans point “bleu” étrange)
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

function StartCard({
  title,
  desc,
  href,
  badge,
}: {
  title: string;
  desc: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link href={href} className="block h-full">
      <div className="h-full rounded-3xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            {badge ? (
              <p className="mt-1 text-[0.7rem] uppercase tracking-[0.18em] text-indigo-700">
                {badge}
              </p>
            ) : null}
          </div>

          <span className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[0.65rem] font-semibold border bg-white text-slate-700 border-slate-200">
            Parcours
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-600">{desc}</p>

        <div className="mt-auto pt-4">
          <p className="text-xs font-semibold underline decoration-slate-300 text-slate-900">
            Continuer →
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function CommencerPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser(data.session?.user ?? null);
      } catch {
        // silence
      }
    };

    fetchSession();

    const sub =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }) ?? null;

    return () => {
      isMounted = false;
      sub?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  const isLoggedIn = !!user;
  const displayName = useMemo(() => firstNameFromUser(user), [user]);

  // Couleurs logo (rappel)
  const brandGrad = "bg-gradient-to-r from-indigo-700 to-cyan-500";

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Head>
        <meta name="robots" content="noindex, follow" />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* HERO identitaire comme la home */}
          <section className="relative rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${brandGrad}`} />
            <div className="relative p-7 sm:p-10">
              <AbstractHeroArt />

              <div className="relative space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>Choisir un objectif</Pill>
                  <Pill>Lancer une calculette</Pill>
                  <Pill>Comparer des scénarios</Pill>
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 leading-tight">
                    {isLoggedIn && displayName ? (
                      <>
                        Bonjour {displayName}.<br />
                        Démarrons votre simulation.
                      </>
                    ) : (
                      <>
                        Commencer une simulation
                        <br />
                        sur lokt.fr
                      </>
                    )}
                  </h1>

                  <p className="text-sm text-slate-600 max-w-3xl">
                    Sélectionnez votre objectif : lokt.fr vous dirige vers la calculette la plus adaptée,
                    avec une lecture structurée et exploitable.
                  </p>
                </div>

                {/* CTA léger (pas obligatoire, mais cohérent) */}
                <div className="pt-1">
                  <span
                    className={`inline-flex items-center rounded-full ${brandGrad} px-4 py-2 text-[0.75rem] font-semibold text-white shadow-sm`}
                  >
                    4 parcours • 4 calculettes
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Cartes parcours (même style que les toolcards) */}
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
            <StartCard
              title="Acheter une résidence principale"
              badge="Capacité d’emprunt"
              desc="Estimer budget, mensualité maximale, capital empruntable et prix de bien indicatif."
              href="/capacite"
            />

            <StartCard
              title="Investir dans un bien locatif"
              badge="Rentabilité locative"
              desc="Mesurer cash-flow, rendement, effort d’épargne et tester des hypothèses."
              href="/investissement"
            />

            <StartCard
              title="Acheter avant d’avoir vendu"
              badge="Prêt relais"
              desc="Estimer relais + nouveau prêt + budget maximal et se positionner sur une cible."
              href="/pret-relais"
            />

            <StartCard
              title="Analyser un parc immobilier"
              badge="Parc immobilier"
              desc="Consolider encours, flux et vision globale de patrimoine (cash-flow total)."
              href="/parc-immobilier"
            />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
            <p className="text-sm font-semibold text-slate-900">Accès direct</p>
            <p className="mt-1 text-sm text-slate-600">
              Vous pouvez aussi ouvrir une calculette directement depuis la page d’accueil.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
