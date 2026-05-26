// pages/parc-immobilier.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import ParcImmobilierWizard from "../components/ParcImmobilierWizard";
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

// ✅ JSON-LD SAFE: évite tout crash si un schema est undefined/malformé
function JsonLd({ data }: { data: any }) {
  const items = Array.isArray(data) ? data : [data];

  const safeItems = items.filter(
    (x) => x && typeof x === "object" && typeof x["@context"] === "string" && x["@context"].length > 0
  );

  return (
    <>
      {safeItems.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

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

  const displayName = firstNameFromUser(user);
  const isLoggedIn = !!user;

  // --- SEO
  const siteUrl = "https://lokt.fr";
  const pagePath = "/parc-immobilier";
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = "Simulateur parc immobilier — analyse multi-biens, cash-flow & ratios | lokt.fr";
  const description =
    "Analysez votre parc immobilier (1 à 20 biens) : valeur, encours, cash-flow global, rendements et indicateurs (DSCR, LTV). Une vue consolidée pour piloter votre patrimoine.";

  // OG image (doit exister dans /public)
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

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
      inLanguage: "fr-FR",
      isPartOf: {
        "@type": "WebSite",
        name: "lokt.fr",
        url: siteUrl,
      },
    };

    // ✅ Pour Google: "outil" plutôt que juste "Service"
    const softwareApp = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Simulateur parc immobilier",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      url: pageUrl,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
      provider: {
        "@type": "Organization",
        name: "lokt.fr",
        url: siteUrl,
        logo: ogImage,
      },
      areaServed: "FR",
      inLanguage: "fr-FR",
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
      url: pageUrl,
      inLanguage: "fr-FR",
    };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Parc immobilier", item: pageUrl },
      ],
    };

    const faqPage = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqData.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };

    return [webPage, softwareApp, breadcrumb, service, faqPage];
  }, [description, faqData, ogImage, pageUrl, siteUrl, title]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f9fc]">
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
        <meta property="og:image:alt" content="Simulateur parc immobilier — lokt.fr" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* ✅ JSON-LD (SAFE) */}
        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-3 py-5 sm:px-4 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
          {/* Header de la page */}
          <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />
            <div className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#635bff]">
                CALCULETTE PARC IMMOBILIER
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-[#f6f9fc] px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
                lokt.fr
              </span>
            </div>

            <h1 className="text-[1.35rem] font-semibold leading-tight text-slate-900 sm:text-2xl">
              {displayName
                ? `Bonjour ${displayName}, analysez votre parc immobilier.`
                : "Analysez votre parc immobilier (multi-biens)."}
            </h1>

            <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-xs">
              Ajoutez 1 à 20 biens locatifs et obtenez une synthèse globale : valeur du parc, encours, cash-flow,
              rendements, graphiques. Activez la version avancée pour intégrer vacance/gestion/impôts et afficher les
              indicateurs DSCR/LTV.
            </p>

            {/* Maillage interne discret */}
            <div className="pt-1 flex flex-wrap gap-2">
              <Link href="/" className="text-xs font-semibold underline decoration-[#635bff]/30 text-[#3f37c9]">
                Accueil →
              </Link>
              <Link href="/capacite" className="text-xs font-semibold underline decoration-[#635bff]/30 text-[#3f37c9]">
                Capacité d’emprunt →
              </Link>
              <Link href="/pret-relais" className="text-xs font-semibold underline decoration-[#635bff]/30 text-[#3f37c9]">
                Prêt relais →
              </Link>
              <Link href="/investissement" className="text-xs font-semibold underline decoration-[#635bff]/30 text-[#3f37c9]">
                Rentabilité locative →
              </Link>
            </div>
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
              L’objectif est de comparer des scénarios (nouvel achat, refinancement, vacance, hausse de charges) avec une
              lecture homogène, plutôt que de multiplier les tableurs.
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

            {/* (optionnel) petit rappel UX */}
            <p className="mt-4 text-xs text-slate-500">
              Note : les calculs sont fournis à titre indicatif. Les critères et hypothèses peuvent varier selon les banques
              et votre situation.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
