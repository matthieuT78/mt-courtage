// pages/investissement.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import InvestissementWizard from "../components/InvestissementWizard";
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

// ✅ JSON-LD SAFE (comme pret-relais) : évite tout crash si schema undefined/malformé
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

  const displayName = useMemo(() => firstNameFromUser(user), [user]);
  const isLoggedIn = !!user;

  // --- SEO
  const siteUrl = "https://lokt.fr";
  const pagePath = "/investissement";
  const pageUrl = `${siteUrl}${pagePath}`;

  // ✅ CTR-first
  const title = "Calcul rentabilité locative gratuit – Cash-flow, rendement, charges | lokt.fr";
  const description =
    "Calculez la rentabilité locative (cash-flow, rendement brut/net, charges, vacance, financement). Comparez location longue durée vs Airbnb avec une lecture claire.";

  // OG image (non transparent, OK WhatsApp)
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  // Mini FAQ (SEO) — sans toucher au wizard
  const faqData = useMemo(
    () => [
      {
        q: "Quelle est la différence entre cash-flow et rendement ?",
        a: "Le cash-flow correspond au flux mensuel net (loyer – charges – crédit). Le rendement mesure la performance annuelle (revenus / prix d’achat), et peut être brut ou net selon les charges prises en compte.",
      },
      {
        q: "Quelle différence entre rendement brut et rendement net ?",
        a: "Le rendement brut compare les loyers annuels au prix d’achat. Le rendement net retire les charges (taxe foncière, copropriété, assurance, vacance, gestion…). Il est plus proche de la réalité pour comparer deux projets.",
      },
      {
        q: "Quelles charges faut-il inclure pour estimer une rentabilité réaliste ?",
        a: "À minima : copropriété, assurance, taxe foncière, entretien, gestion, vacance locative, travaux et frais liés au financement. La rentabilité dépend surtout de la cohérence des hypothèses.",
      },
      {
        q: "Longue durée ou Airbnb : comment comparer ?",
        a: "La location saisonnière se compare en convertissant un prix par nuit et un taux d’occupation en revenu mensuel équivalent, puis en ajoutant les coûts spécifiques (ménage, conciergerie, vacance, renouvellement du mobilier).",
      },
      {
        q: "La fiscalité est-elle prise en compte ?",
        a: "La V1 vise d’abord une rentabilité économique (revenus, charges, financement). La fiscalité peut être ajoutée ou estimée séparément selon votre régime (LMNP, réel, micro, etc.).",
      },
      {
        q: "Quels leviers ont le plus d’impact sur la rentabilité ?",
        a: "Le prix d’achat (et les frais), le niveau de loyer/occupation, la vacance, les charges récurrentes, et la structure du financement (taux, durée, apport). Tester 2 scénarios (prudent vs ambitieux) aide à décider.",
      },
    ],
    []
  );

  // ✅ mêmes modifs SEO que /capacite et /pret-relais :
  // - JSON-LD enrichi avec SoftwareApplication
  // - Breadcrumb
  // - FAQPage
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

    const app = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Simulateur de rentabilité locative",
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
    };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Rentabilité locative", item: pageUrl },
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

    return [webPage, app, breadcrumb, faqPage];
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
        <meta property="og:image:alt" content="Calcul de rentabilité locative — lokt.fr" />

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
                CALCULETTE RENTABILITÉ LOCATIVE
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-[#f6f9fc] px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
                lokt.fr
              </span>
            </div>

            <h1 className="text-[1.35rem] font-semibold leading-tight text-slate-900 sm:text-2xl">
              {isLoggedIn && displayName
                ? `Bonjour ${displayName}, calculez votre cash-flow et votre rendement.`
                : "Calculer la rentabilité locative (cash-flow & rendement)"}
            </h1>

            <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-xs">
              Parcours guidé : coût total (achat + frais + travaux), revenus (longue durée / Airbnb), charges et gestion,
              puis financement. Résultat structuré pour analyser la rentabilité réelle et comparer des scénarios.
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
              <Link
                href="/plus-value-vente-immobiliere"
                className="text-xs font-semibold underline decoration-[#635bff]/30 text-[#3f37c9]"
              >
                Plus-value immobilière →
              </Link>
              <Link
                href="/parc-immobilier"
                className="text-xs font-semibold underline decoration-[#635bff]/30 text-[#3f37c9]"
              >
                Parc immobilier →
              </Link>
            </div>
            </div>
          </section>

          {/* Calculette */}
          <InvestissementWizard showSaveButton={isLoggedIn} />

          {/* ✅ Micro bloc confiance (UX + SEO) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Pourquoi simuler la rentabilité locative avant d’acheter ?
            </h2>
            <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
              <li>Vérifier si le projet s’auto-finance (cash-flow) ou combien il “coûte” chaque mois.</li>
              <li>Comparer plusieurs biens/scénarios à périmètre constant (prix, loyer, vacance, charges).</li>
              <li>Identifier les leviers : prix d’achat, vacance, charges et structure de financement.</li>
            </ul>
          </section>

          {/* Bloc SEO enrichi (comme capacité / pret-relais) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Calcul de rentabilité locative : cash-flow, charges et financement
              </h2>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Cette calculette de rentabilité locative vous aide à projeter un investissement en tenant compte du coût
                total (prix + notaire + travaux/ameublement), des revenus (location longue durée ou saisonnière), des
                charges (copropriété, taxe foncière, assurance, entretien, gestion, vacance) et du financement (taux,
                durée, apport, assurance). L’objectif : une lecture simple et comparable entre scénarios.
              </p>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Les résultats sont indicatifs et dépendent de vos hypothèses. Utilisez l’outil pour comparer plusieurs
                biens, tester différents niveaux de loyers/occupation, et repérer ce qui améliore réellement le cash-flow.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Comment estimer une rentabilité réaliste ?</h2>
              <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
                <li>
                  Commencez par le <strong>coût total</strong> (prix + notaire + travaux + ameublement éventuel).
                </li>
                <li>
                  Estimez les <strong>revenus</strong> (loyer mensuel ou revenu équivalent saisonnier : prix/nuit × taux
                  d’occupation).
                </li>
                <li>
                  Ajoutez les <strong>charges récurrentes</strong> (copro, taxe foncière, assurance, entretien, gestion,
                  vacance).
                </li>
                <li>
                  Intégrez le <strong>financement</strong> (taux, durée, apport, assurance) pour obtenir le{" "}
                  <strong>cash-flow</strong>.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Exemple rapide</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Exemple indicatif : un achat à <strong>200 000 €</strong> avec <strong>25 000 €</strong> de frais/travaux,
                un loyer de <strong>950 €</strong>, des charges totales de <strong>250 €</strong> et un crédit à{" "}
                <strong>850 €</strong> donne un cash-flow proche de{" "}
                <strong>950 − 250 − 850 = −150 € / mois</strong>. En ajustant le prix, le loyer, la vacance ou la durée,
                vous visualisez rapidement les leviers qui font basculer le projet.
              </p>
            </div>

            {/* Mini FAQ visible (UX + SEO) */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Questions fréquentes sur la rentabilité locative</h2>
              <div className="mt-3 grid gap-3">
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
            </div>

            <p className="text-xs text-slate-500">
              Note : la fiscalité dépend fortement du régime (LMNP, réel, micro…) et n’est pas l’objectif principal de la
              V1. Ici, on vise d’abord une rentabilité “économique” comparable.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
