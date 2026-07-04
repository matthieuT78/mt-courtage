// pages/parc-immobilier.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import ParcImmobilierWizard from "../components/ParcImmobilierWizard";
import CalculatorHero from "../components/calculators/CalculatorHero";
import { supabase } from "../lib/supabaseClient";
import { firstNameFromUser } from "../lib/userDisplay";
import { useScrollReveal } from "../hooks/useScrollReveal";

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

  useScrollReveal();

  const displayName = firstNameFromUser(user);
  const isLoggedIn = !!user;

  // --- SEO
  const siteUrl = "https://lokt.fr";
  const pagePath = "/parc-immobilier";
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = "Simulateur parc immobilier 2026 — analyse multi-biens, cash-flow & ratios | lokt.fr";
  const description =
    "Analysez votre parc immobilier (1 à 20 biens) : valeur, encours, cash-flow global, rendements et indicateurs (DSCR, LTV). Une vue consolidée pour piloter votre patrimoine.";

  // OG image (doit exister dans /public)
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const faqData = useMemo(
    () => [
      {
        q: "Qu'est-ce qu'un simulateur de parc immobilier ?",
        a: "Un simulateur de parc immobilier consolide plusieurs biens pour obtenir une vision globale : valeur totale, encours, cash-flow et rendements. Cela aide à piloter un patrimoine plutôt que d'analyser un bien isolé.",
      },
      {
        q: "Combien de biens puis-je analyser ?",
        a: "La calculette permet généralement d'ajouter plusieurs biens (par exemple 1 à 20) afin de calculer des indicateurs consolidés.",
      },
      {
        q: "À quoi servent les ratios LTV et DSCR ?",
        a: "Le LTV (Loan-to-Value) compare l'encours total au prix/valeur du parc. Le DSCR (Debt Service Coverage Ratio) compare les revenus nets au service de la dette. Ce sont des indicateurs utiles pour mesurer la robustesse d'un parc.",
      },
      {
        q: "Les résultats sont-ils acceptés par les banques ?",
        a: "Les résultats sont indicatifs. Selon les établissements, les hypothèses (vacance, charges, prise en compte des loyers, etc.) peuvent varier. L'outil sert surtout à comparer des scénarios avec une lecture homogène.",
      },
      {
        q: "Quel DSCR est considéré comme sain pour un investisseur immobilier ?",
        a: "Un DSCR (Debt Service Coverage Ratio) supérieur à 1,2 est généralement considéré comme sain : les loyers nets couvrent 120 % des remboursements de crédit. En dessous de 1,0, les revenus locatifs ne couvrent pas la dette — le parc est en flux négatif chronique. Les banques analysent souvent le DSCR global avant d'accorder un nouveau financement.",
      },
      {
        q: "À partir de combien de biens est-il utile d'analyser son parc en consolidé ?",
        a: "Dès 2 biens, une vue consolidée apporte une clarté que les tableurs par bien ne donnent pas : vision du risque de concentration, du LTV moyen et du cash-flow global. À partir de 3-4 biens, les ratios DSCR et LTV deviennent des indicateurs pilotables pour anticiper les conditions d'un nouveau financement.",
      },
      {
        q: "Comment améliorer la rentabilité globale d'un parc immobilier ?",
        a: "Les leviers principaux : renégocier les crédits en cours (taux, durée), optimiser la vacance locative (candidatures rapides, loyer au marché), passer au LMNP réel pour les meublés (amortissement qui réduit l'impôt), arbitrer les biens à rendement faible, et diversifier vers des marchés à rendement plus élevé pour les nouveaux achats.",
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

      <main className="flex-1">
        <CalculatorHero
          eyebrow="Calculette parc immobilier lokt.fr"
          title={displayName ? `${displayName}, prenez de la hauteur sur votre patrimoine.` : "Pilotez votre parc immobilier avec une vue consolidée."}
          description="Ajoutez vos biens locatifs et visualisez valeur, encours, cash-flow, rendement et ratios de solidité dans une lecture commune."
          links={[
            { href: "/", label: "Accueil" },
            { href: "/capacite", label: "Capacité d'emprunt" },
            { href: "/pret-relais", label: "Prêt relais" },
            { href: "/investissement", label: "Rentabilité locative" },
          ]}
        />
        <div className="mx-auto -mt-12 max-w-6xl space-y-5 px-3 pb-8 sm:-mt-16 sm:space-y-6 sm:px-4 sm:pb-12">

          {/* Wizard */}
          <ParcImmobilierWizard />

          {/* Bloc SEO discret */}
          <section data-scroll-reveal data-reveal-delay="0" className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">Analyse de parc immobilier : vue consolidée multi-biens</h2>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Ce simulateur de parc immobilier consolide plusieurs biens locatifs pour vous donner une vision globale :
              valeur totale, encours de crédit, cash-flow mensuel, rendements et ratios de pilotage comme le{" "}
              <span className="font-semibold">LTV</span> (Loan-to-Value) et le{" "}
              <span className="font-semibold">DSCR</span> (Debt Service Coverage Ratio) lorsque la version avancée est
              activée.
            </p>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              L'objectif est de comparer des scénarios (nouvel achat, refinancement, vacance, hausse de charges) avec une
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

          {/* Section DSCR / LTV expliqués */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">LTV et DSCR : comprendre les deux ratios clés du parc immobilier</h2>
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="space-y-2">
                <p className="font-semibold text-slate-800">LTV — Loan-to-Value</p>
                <p className="leading-6 text-slate-600">
                  Le LTV compare l'encours de crédit total à la valeur du parc. Un LTV de 60 % signifie que vous devez encore 60 € pour chaque 100 € de valeur immobilière.
                </p>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <span className="font-semibold">Lecture :</span> &lt; 70 % → position solide. &gt; 80 % → faible marge de manœuvre pour un rachat ou refinancement.
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-slate-800">DSCR — Debt Service Coverage Ratio</p>
                <p className="leading-6 text-slate-600">
                  Le DSCR compare les loyers nets annuels au total des remboursements de crédit (capital + intérêts). Un DSCR de 1,25 signifie que vos loyers couvrent 125 % de vos mensualités de crédit.
                </p>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <span className="font-semibold">Lecture :</span> &lt; 1,0 → cash-flow global négatif. 1,0 à 1,2 → équilibré mais fragile. &gt; 1,2 → parc rentable avec marge.
                </div>
              </div>
            </div>
          </section>

          {/* CTA gestion */}
          <section className="rounded-2xl border border-[#635bff]/20 bg-[#635bff]/5 p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#635bff]">Étape suivante</p>
            <p className="mt-1 text-base font-semibold text-slate-900">Votre parc est analysé. Gérez-le au quotidien depuis lokt.fr.</p>
            <p className="mt-1 text-sm text-slate-600">Loyers, quittances, états des lieux, suivi financier — sans agence, pour un ou plusieurs biens.</p>
            <a href="/outil-gestion-locative" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Découvrir l'outil bailleur →
            </a>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
