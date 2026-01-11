// pages/parc-immobilier.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import ParcImmobilierWizard from "../components/ParcImmobilierWizard";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export default function ParcImmobilierPage() {
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
        console.error("Erreur récupération session (parc-immobilier)", e);
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

  const displayName = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : null);
  const isLoggedIn = !!user;

  // --- SEO
  const siteUrl = "https://lokt.fr";
  const pageUrl = `${siteUrl}/parc-immobilier`;
  const title = "Simulateur parc immobilier — analyse multi-biens, cash-flow & ratios | lokt.fr";
  const description =
    "Analysez votre parc immobilier (1 à 20 biens) : valeur, encours, cash-flow global, rendements et indicateurs (DSCR, LTV). Une vue consolidée pour piloter votre patrimoine.";
  const ogImage = `${siteUrl}/lokt-logo.jpg`; // fichier existant dans /public

  const faqData = useMemo(
    () => [
      {
        q: "Qu’est-ce qu’un simulateur de parc immobilier ?",
        a: "Un simulateur de parc immobilier consolide plusieurs biens pour obtenir une vision globale : valeur totale, encours, cash-flow et rendements. Cela aide à piloter un patrimoine plutôt que d’analyser un bien isolé.",
      },
      {
        q: "Combien de biens puis-je analyser ?",
        a: "La calculette permet généralement d’ajouter plusieurs biens (par exemple 1 à 20) afin de calculer des indicateurs consolidés.",
      },
      {
        q: "À quoi servent les ratios LTV et DSCR ?",
        a: "Le LTV (Loan-to-Value) compare l’encours total au prix/valeur du parc. Le DSCR (Debt Service Coverage Ratio) compare les revenus nets au service de la dette. Ce sont des indicateurs utiles pour mesurer la robustesse d’un parc.",
      },
      {
        q: "Les résultats sont-ils “bancaires” ?",
        a: "Les résultats sont indicatifs. Selon les établissements, les hypothèses (vacance, charges, prise en compte des loyers, etc.) peuvent varier. L’outil sert surtout à comparer des scénarios avec une lecture homogène.",
      },
    ],
    []
  );

  const jsonLd = useMemo(() => {
    const webPage = {
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
    };

    const service = {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Analyse de parc immobilier (multi-biens)",
      provider: {
        "@type": "Organization",
        name: "lokt.fr",
        url: siteUrl,
        logo: ogImage,
      },
      areaServed: "FR",
      serviceType: "Simulation immobilière",
    };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Parc immobilier", item: pageUrl },
      ],
    };

    const faqPage = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqData.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.a,
        },
      })),
    };

    return [webPage, service, breadcrumb, faqPage];
  }, [description, faqData, ogImage, pageUrl, siteUrl, title]);

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
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:alt" content="lokt.fr — simulateurs immobiliers" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header de la page */}
          <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700">
                CALCULETTE PARC IMMOBILIER
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-indigo-700">
                Lokt.fr
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {displayName ? `Bonjour ${displayName}, analysez votre parc immobilier.` : "Analysez votre parc immobilier (multi-biens)."}
            </h1>

            <p className="text-xs text-slate-600 max-w-3xl">
              Ajoutez 1 à 20 biens locatifs et obtenez une synthèse globale : valeur du parc, encours, cash-flow,
              rendements, graphiques. Activez la version avancée pour intégrer vacance/gestion/impôts et afficher les
              indicateurs DSCR/LTV.
            </p>

            {/* Maillage interne discret */}
            <div className="pt-1 flex flex-wrap gap-2">
              <Link href="/" className="text-xs font-semibold underline decoration-indigo-200 text-indigo-800">
                Accueil →
              </Link>
              <Link href="/capacite" className="text-xs font-semibold underline decoration-indigo-200 text-indigo-800">
                Capacité d’emprunt →
              </Link>
              <Link href="/pret-relais" className="text-xs font-semibold underline decoration-indigo-200 text-indigo-800">
                Prêt relais →
              </Link>
              <Link href="/investissement" className="text-xs font-semibold underline decoration-indigo-200 text-indigo-800">
                Rentabilité locative →
              </Link>
            </div>
          </section>

          {/* Wizard */}
          <ParcImmobilierWizard />

          {/* Bloc SEO discret */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">Analyse de parc immobilier : vue consolidée multi-biens</h2>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Ce simulateur de parc immobilier consolide plusieurs biens locatifs pour vous donner une vision globale :
              valeur totale, encours de crédit, cash-flow mensuel, rendements et ratios de pilotage comme le{" "}
              <span className="font-semibold">LTV</span> (Loan-to-Value) et le{" "}
              <span className="font-semibold">DSCR</span> (Debt Service Coverage Ratio) lorsque la version avancée est
              activée.
            </p>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              L’objectif est de comparer des scénarios (nouvel achat, refinancement, vacance, hausse de charges) avec
              une lecture homogène, plutôt que de multiplier les tableurs.
            </p>

            {/* Mini FAQ visible */}
            <div className="mt-4 grid gap-3">
              {faqData.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between">
                    <span className="pr-4">{f.q}</span>
                    <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
                  </summary>
                  <div className="mt-2 text-sm text-slate-700 leading-relaxed">{f.a}</div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
