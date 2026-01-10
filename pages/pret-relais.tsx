// pages/pret-relais.tsx
import Head from "next/head";
import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import PretRelaisWizard from "../components/PretRelaisWizard";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export default function PretRelaisPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error("Erreur récupération session (pret-relais)", e);
      }
    };

    fetchSession();

    const { data: authListener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
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
  const pageUrl = `${siteUrl}/pret-relais`;
  const title = "Simulateur de prêt relais — budget d’achat avant revente | lokt.fr";
  const description =
    "Estimez votre budget d’achat avec un prêt relais : montant du relais, nouveau prêt possible, apport et budget maximal. Simulation gratuite avec lecture claire (relais + nouveau prêt + apport).";

  // OG image : utilise ton logo existant dans /public
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  // JSON-LD : WebPage + Service
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
      name: "Simulateur de prêt relais",
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
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header de la page (identité visuelle prêt relais) */}
          <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm p-5 space-y-3">
            {/* Titre calculette */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                CALCULETTE PRÊT RELAIS
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-amber-700">
                Lokt.fr
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {displayName
                ? `Bonjour ${displayName}, estimez votre budget d’achat avec un prêt relais.`
                : "Estimez votre budget d’achat avec un prêt relais."}
            </h1>

            <p className="text-xs text-slate-600 max-w-2xl">
              Parcours guidé en plusieurs étapes : estimation du relais (valeur du bien actuel, capital restant
              dû, conditions de vente), apport disponible, et paramètres du futur prêt. Le résultat est structuré
              pour une lecture claire (relais + nouveau prêt + apport).
            </p>

            {/* ⚠️ Supprimé : le bloc “Sans compte… créer un espace” car la création de compte n’est pas ouverte */}
          </section>

          {/* Calculette */}
          <PretRelaisWizard showSaveButton={isLoggedIn} />

          {/* Bloc SEO discret */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Simulateur de prêt relais : acheter avant d’avoir vendu
            </h2>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Cette calculette de prêt relais vous permet d’estimer le montant de relais mobilisable à partir
              de la valeur de votre bien actuel, du capital restant dû et du pourcentage retenu par la banque.
              Elle projette ensuite votre capacité pour un nouveau prêt et votre budget d’achat total
              (relais + nouveau prêt + apport).
            </p>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Les résultats restent indicatifs : chaque banque applique ses propres règles (durée du relais,
              franchise, intérêts intercalaires, assurance, frais). Utilisez l’outil pour comparer des scénarios
              et préparer un échange plus efficace avec un conseiller.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
