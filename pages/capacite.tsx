// pages/capacite.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import CapaciteWizard from "../components/CapaciteWizard";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export default function CapaciteEmpruntPage() {
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
        console.error("Erreur récupération session (capacite)", e);
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

  const displayName = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : null);
  const isLoggedIn = !!user;

  // ---- SEO
  const siteUrl = "https://lokt.fr";
  const pageUrl = `${siteUrl}/capacite`;

  const title = "Simulateur de capacité d’emprunt immobilier — mensualité, capital & budget | lokt.fr";
  const description =
    "Estimez votre capacité d’emprunt immobilier : mensualité cible, capital empruntable et budget d’achat. Lecture bancaire (revenus, charges, crédits, loyers pris à 70%) et simulation gratuite.";

  // OG image : fichier existant dans /public
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const faqData = useMemo(
    () => [
      {
        q: "Comment calculez-vous la capacité d’emprunt ?",
        a: "La capacité dépend de vos revenus, charges et crédits en cours. On estime une mensualité soutenable, puis on la convertit en capital empruntable selon le taux, la durée et une hypothèse d’assurance.",
      },
      {
        q: "Pourquoi les loyers sont-ils pris à 70% ?",
        a: "C’est une approche prudente souvent utilisée pour intégrer le risque de vacance, impayés, charges non récupérables et aléas. Cela permet de comparer des scénarios de façon plus réaliste.",
      },
      {
        q: "Quelle différence entre mensualité, capital et budget ?",
        a: "La mensualité est votre charge mensuelle de crédit. Le capital empruntable est le montant que vous pouvez emprunter. Le budget d’achat combine capital + apport (et doit intégrer frais de notaire / travaux selon le cas).",
      },
      {
        q: "Le taux d’endettement est-il la seule règle ?",
        a: "Non. Les banques peuvent aussi regarder le reste à vivre, la stabilité des revenus, l’épargne, le profil, et parfois des règles internes. Les résultats restent indicatifs.",
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
      name: "Simulateur de capacité d’emprunt immobilier",
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
        { "@type": "ListItem", position: 2, name: "Capacité d’emprunt", item: pageUrl },
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
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header de la page (identité visuelle capacité) */}
          <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                CALCULETTE CAPACITÉ D&apos;EMPRUNT
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-emerald-700">
                Lokt.fr
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {displayName
                ? `Bonjour ${displayName}, estimez précisément votre capacité d’emprunt.`
                : "Estimez précisément votre capacité d’emprunt immobilier."}
            </h1>

            <p className="text-xs text-slate-600 max-w-2xl">
              Parcours guidé : revenus, charges, crédits en cours, loyers pris à 70 %, et paramètres du futur prêt. Le
              résultat est structuré pour se rapprocher d’une lecture bancaire.
            </p>

            {/* Maillage interne discret */}
            <div className="pt-1 flex flex-wrap gap-2">
              <Link href="/" className="text-xs font-semibold underline decoration-emerald-200 text-emerald-800">
                Accueil →
              </Link>
              <Link href="/pret-relais" className="text-xs font-semibold underline decoration-emerald-200 text-emerald-800">
                Prêt relais →
              </Link>
              <Link href="/investissement" className="text-xs font-semibold underline decoration-emerald-200 text-emerald-800">
                Rentabilité locative →
              </Link>
              <Link
                href="/parc-immobilier"
                className="text-xs font-semibold underline decoration-emerald-200 text-emerald-800"
              >
                Parc immobilier →
              </Link>
            </div>
          </section>

          {/* Calculette */}
          <CapaciteWizard showSaveButton={isLoggedIn} />

          {/* Bloc SEO (discret mais indexable) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">Simulateur de capacité d’emprunt immobilier</h2>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Cette calculette vous aide à estimer un budget immobilier cohérent à partir de vos revenus, charges et
              crédits en cours. Vous obtenez une mensualité cible, un capital empruntable et un budget d’achat réaliste.
            </p>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Si vous avez des revenus locatifs, ils peuvent être intégrés de façon prudente (prise en compte partielle)
              pour comparer des scénarios avec plus de fiabilité. Les résultats restent indicatifs : ils dépendent des
              conditions de crédit (taux, durée, assurance) et des critères propres à chaque banque.
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
