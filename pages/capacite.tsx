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

function firstNameFromUser(user: SimpleUser | null) {
  const raw = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "");
  const first =
    String(raw || "")
      .trim()
      .split(/\s+/)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between">
        <span className="pr-4">{q}</span>
        <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
      </summary>
      <div className="mt-2 text-sm text-slate-700 leading-relaxed">{a}</div>
    </details>
  );
}

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

  const displayName = useMemo(() => firstNameFromUser(user), [user]);
  const isLoggedIn = !!user;

  // --- SEO
  const siteUrl = "https://lokt.fr";
  const pagePath = "/capacite";
  const pageUrl = `${siteUrl}${pagePath}`;

  // ✅ CTR-first (plus direct)
  const title = "Calcul de capacité d’emprunt gratuit – Combien puis-je emprunter ? | lokt.fr";
  const description =
    "Calculez gratuitement votre capacité d’emprunt : mensualité, durée, taux, apport et budget maximum. Simulation claire pour préparer votre projet immobilier.";

  // OG image (non transparent)
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const faqData = useMemo(
    () => [
      {
        q: "Comment savoir combien je peux emprunter ?",
        a: "Le simulateur estime une mensualité soutenable à partir de vos revenus et charges, puis la convertit en capital empruntable selon le taux, la durée et une hypothèse d’assurance.",
      },
      {
        q: "Quel taux d’endettement est pris en compte ?",
        a: "La simulation s’appuie sur une logique bancaire courante (autour de 35% selon les profils). Certaines banques peuvent aussi regarder le reste à vivre et la stabilité des revenus.",
      },
      {
        q: "L’apport est-il obligatoire ?",
        a: "Non, mais un apport peut améliorer votre dossier et votre budget global (notaire, garantie, travaux). Le budget d’achat correspond généralement au capital empruntable + apport.",
      },
      {
        q: "Pourquoi les loyers sont-ils parfois pris partiellement en compte ?",
        a: "C’est une approche prudente pour intégrer les aléas (vacance, impayés, charges). Elle aide à comparer des scénarios de manière plus réaliste.",
      },
      {
        q: "Les résultats sont-ils fiables ?",
        a: "Les résultats sont indicatifs : chaque banque a ses règles (assurance, reste à vivre, charges retenues, politiques internes). L’outil sert à comparer des scénarios et préparer un échange plus efficace.",
      },
      {
        q: "Dois-je créer un compte ?",
        a: "Non pour la V1 : vous pouvez utiliser la calculette librement. Certaines fonctionnalités à venir pourront nécessiter un compte.",
      },
    ],
    []
  );

  // ✅ mêmes “modifs SEO” que /pret-relais :
  // - JSON-LD SAFE
  // - SoftwareApplication
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
      name: "Calculateur de capacité d’emprunt",
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
        { "@type": "ListItem", position: 2, name: "Capacité d’emprunt", item: pageUrl },
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
  }, [title, description, pageUrl, siteUrl, ogImage, faqData]);

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
        <meta property="og:image:alt" content="Calcul de capacité d’emprunt — lokt.fr" />

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
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                CALCULETTE CAPACITÉ D&apos;EMPRUNT
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-emerald-700">
                lokt.fr
              </span>
            </div>

            {/* ✅ H1 plus “requête” */}
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {isLoggedIn && displayName
                ? `Bonjour ${displayName}, calculez votre capacité d’emprunt.`
                : "Calculer ma capacité d’emprunt immobilier"}
            </h1>

            <p className="text-xs text-slate-600 max-w-2xl">
              Estimez combien vous pouvez emprunter selon vos revenus, charges, durée et taux. Résultat clair :
              mensualité → capital → budget d’achat (apport + frais).
            </p>

            {/* Maillage interne discret */}
            <div className="pt-1 flex flex-wrap gap-2">
              <Link href="/" className="text-xs font-semibold underline decoration-emerald-200 text-emerald-800">
                Accueil →
              </Link>
              <Link href="/pret-relais" className="text-xs font-semibold underline decoration-emerald-200 text-emerald-800">
                Prêt relais →
              </Link>
              <Link
                href="/investissement"
                className="text-xs font-semibold underline decoration-emerald-200 text-emerald-800"
              >
                Rentabilité locative →
              </Link>
              <Link
                href="/plus-value-vente-immobiliere"
                className="text-xs font-semibold underline decoration-emerald-200 text-emerald-800"
              >
                Plus-value immobilière →
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

          {/* ✅ Micro bloc confiance (UX + SEO) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">Pourquoi utiliser ce simulateur de capacité d’emprunt ?</h2>
            <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
              <li>Connaître votre budget réaliste avant de chercher un bien.</li>
              <li>Comparer rapidement plusieurs scénarios (durée, taux, apport).</li>
              <li>Préparer un dossier clair pour la banque (lecture structurée).</li>
            </ul>
          </section>

          {/* Bloc SEO principal */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Comment est calculée la capacité d’emprunt ?</h2>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                La capacité d’emprunt correspond au montant maximal que vous pouvez emprunter sans dépasser un endettement
                cohérent. Elle dépend principalement de vos revenus nets, de vos charges, de la durée du prêt, du taux et
                de l’assurance.
              </p>

              <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
                <li>
                  On estime d’abord une <strong>mensualité soutenable</strong> (revenus – charges).
                </li>
                <li>
                  Cette mensualité est convertie en <strong>capital empruntable</strong> selon le <strong>taux</strong> et la{" "}
                  <strong>durée</strong>.
                </li>
                <li>
                  Le <strong>budget d’achat</strong> est généralement : capital + apport (en ajoutant frais de notaire /
                  travaux selon votre situation).
                </li>
              </ul>
            </div>

            {/* Exemple rapide */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Exemple de calcul de capacité d’emprunt</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Exemple indicatif : avec <strong>3 000 €</strong> de revenus nets mensuels, <strong>500 €</strong> de charges
                et un taux de <strong>3%</strong> sur <strong>25 ans</strong>, la capacité d’emprunt peut dépasser{" "}
                <strong>200 000 €</strong> selon l’assurance et votre profil. La simulation permet de comparer rapidement
                plusieurs hypothèses (durée, taux, apport).
              </p>
            </div>

            {/* FAQ visible */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Questions fréquentes sur la capacité d’emprunt</h2>
              <div className="mt-3 grid gap-3">
                {faqData.map((f) => (
                  <FaqItem key={f.q} q={f.q} a={<>{f.a}</>} />
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Note : les calculs sont fournis à titre indicatif et peuvent varier selon les banques, le type de projet et
              les conditions de financement.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
