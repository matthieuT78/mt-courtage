// pages/investissement.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

function firstNameFromUser(user: SimpleUser | null) {
  const raw = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "");
  const first =
    String(raw || "")
      .trim()
      .split(/\s+/)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
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

  const title = "Simulateur de rentabilité locative — cash-flow, rendement & charges | lokt.fr";
  const description =
    "Simulez la rentabilité locative : cash-flow mensuel, rendement, charges, vacance, gestion et financement. Comparez longue durée vs Airbnb avec une lecture structurée.";

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
  // - JSON-LD enrichi avec SoftwareApplication (plutôt que Service)
  // - Breadcrumb
  // - Contenu SEO visible : “comment ça marche”, “exemple rapide”
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
        <meta property="og:image:alt" content="Simulateur de rentabilité locative — lokt.fr" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* ✅ JSON-LD (SAFE) */}
        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header de la page */}
          <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                CALCULETTE RENTABILITÉ LOCATIVE
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-amber-700">
                lokt.fr
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {isLoggedIn && displayName
                ? `Bonjour ${displayName}, calculez votre cash-flow et votre rendement.`
                : "Calculez votre cash-flow et votre rendement locatif."}
            </h1>

            <p className="text-xs text-slate-600 max-w-3xl">
              Parcours guidé en plusieurs étapes : coûts d’acquisition, revenus (longue durée / Airbnb), charges et
              gestion, puis financement. Le résultat est structuré pour analyser la rentabilité réelle de votre projet.
            </p>

            {/* Maillage interne discret */}
            <div className="pt-1 flex flex-wrap gap-2">
              <Link href="/" className="text-xs font-semibold underline decoration-amber-200 text-amber-800">
                Accueil →
              </Link>
              <Link href="/pret-relais" className="text-xs font-semibold underline decoration-amber-200 text-amber-800">
                Prêt relais →
              </Link>
              <Link href="/capacite" className="text-xs font-semibold underline decoration-amber-200 text-amber-800">
                Capacité d’emprunt →
              </Link>
              <Link
                href="/parc-immobilier"
                className="text-xs font-semibold underline decoration-amber-200 text-amber-800"
              >
                Parc immobilier →
              </Link>
            </div>
          </section>

          {/* Calculette */}
          <InvestissementWizard showSaveButton={isLoggedIn} />

          {/* Bloc SEO enrichi (comme capacité / pret-relais) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Simulateur de rentabilité locative : cash-flow, charges et financement
              </h2>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Cette calculette de rentabilité locative vous aide à projeter un investissement en tenant compte des
                coûts d’acquisition, des revenus (location longue durée ou saisonnière), des charges (copropriété,
                travaux, gestion…) et du financement (taux, durée, apport). L’objectif : obtenir une lecture simple et
                comparable entre scénarios.
              </p>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Les résultats sont indicatifs et dépendent de vos hypothèses. Utilisez l’outil pour comparer plusieurs
                biens, tester différents niveaux de loyers/occupation, et identifier les leviers qui améliorent
                réellement le cash-flow.
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
            <div className="grid gap-3">
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
