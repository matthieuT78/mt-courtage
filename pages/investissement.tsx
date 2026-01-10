// pages/investissement.tsx
import Head from "next/head";
import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import InvestissementWizard from "../components/InvestissementWizard";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export default function InvestissementPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser((data.session?.user as any) ?? null);
      } catch (e) {
        console.error("Erreur récupération session (investissement)", e);
      }
    };

    fetchSession();

    const { data: authListener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser((session?.user as any) ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const displayName =
    user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : null);

  const isLoggedIn = !!user;

  // --- SEO
  const siteUrl = "https://lokt.fr";
  const pageUrl = `${siteUrl}/investissement`;
  const title = "Simulateur rentabilité locative — cash-flow & rendement | lokt.fr";
  const description =
    "Calculez la rentabilité locative d’un projet (cash-flow, rendement, charges, financement). Simulation longue durée ou Airbnb avec une lecture structurée et comparable.";
  const ogImage = `${siteUrl}/lokt-logo.jpg`; // fichier existant dans /public

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    url: pageUrl,
    description,
    isPartOf: {
      "@type": "WebSite",
      name: "lokt.fr",
      url: siteUrl,
    },
    about: {
      "@type": "Service",
      name: "Simulateur de rentabilité locative",
      provider: {
        "@type": "Organization",
        name: "lokt.fr",
        url: siteUrl,
      },
    },
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:alt" content="lokt.fr — simulateurs immobiliers" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header de la page (identité visuelle RENTABILITÉ – AMBER) */}
          <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                CALCULETTE RENTABILITÉ LOCATIVE
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-amber-700">
                Lokt.fr
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {displayName
                ? `Bonjour ${displayName}, calculez votre cash-flow et votre rendement.`
                : "Calculez votre cash-flow et votre rendement locatif."}
            </h1>

            <p className="text-xs text-slate-600 max-w-3xl">
              Parcours guidé en plusieurs étapes : coûts d’acquisition, revenus (longue durée / Airbnb),
              charges et gestion, puis financement. Le résultat est structuré pour analyser la rentabilité
              réelle de votre projet.
            </p>

            {/* ⚠️ Supprimé : le bloc “Sans compte… créer un espace” car la création de compte n’est pas ouverte */}
          </section>

          {/* Calculette */}
          <InvestissementWizard showSaveButton={isLoggedIn} />

          {/* Bloc SEO discret */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Simulateur de rentabilité locative : cash-flow, charges et financement
            </h2>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Cette calculette de rentabilité locative vous aide à projeter un investissement en tenant compte
              des coûts d’acquisition, des revenus (location longue durée ou saisonnière), des charges
              (copropriété, travaux, gestion…) et du financement (taux, durée, apport). L’objectif : obtenir
              une lecture simple et comparable entre scénarios.
            </p>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Les résultats sont indicatifs et dépendent de vos hypothèses. Utilisez l’outil pour comparer
              plusieurs biens, tester différents niveaux de loyers/occupation, et identifier les leviers qui
              améliorent réellement le cash-flow.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
