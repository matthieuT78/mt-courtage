// pages/pret-relais.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import PretRelaisWizard from "../components/PretRelaisWizard";
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

function FaqItem({ q, a, revealDelay }: { q: string; a: React.ReactNode; revealDelay?: number }) {
  return (
    <details
      className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
      data-scroll-reveal
      data-reveal-delay={revealDelay ?? 0}
    >
      <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between">
        <span className="pr-4">{q}</span>
        <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
      </summary>
      <div className="mt-2 text-sm text-slate-700 leading-relaxed">{a}</div>
    </details>
  );
}

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

  const displayName = useMemo(() => firstNameFromUser(user), [user]);
  const isLoggedIn = !!user;

  useScrollReveal();

  // --- SEO
  const siteUrl = "https://lokt.fr";
  const pagePath = "/pret-relais";
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = "Simulateur prêt relais immobilier gratuit | lokt.fr";
  const description =
    "Simulateur prêt relais immobilier : calculez le montant du crédit relais, le budget d'achat avant vente, les intérêts et votre marge de financement.";

  // OG image (non transparent, OK WhatsApp)
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const faqData = useMemo(
    () => [
      {
        q: "Comment calculer un prêt relais ?",
        a: "Le calcul part généralement de la valeur estimée du bien à vendre. La banque retient une partie de cette valeur, souvent 60 % à 80 %, puis retire le capital restant dû. Le résultat donne un ordre de grandeur du crédit relais mobilisable.",
      },
      {
        q: "Quelle est la formule simple du prêt relais ?",
        a: "Une formule indicative est : valeur du bien à vendre × pourcentage retenu par la banque - capital restant dû. Exemple : 400 000 € × 70 % - 120 000 € = 160 000 € de prêt relais estimé.",
      },
      {
        q: "Quelle différence entre prêt relais et crédit relais ?",
        a: "Dans l’usage courant, prêt relais et crédit relais désignent le même mécanisme : un financement temporaire accordé en attendant la vente du bien actuel.",
      },
      {
        q: "Quels sont les coûts d’un prêt relais ?",
        a: "Le coût dépend du taux, de la durée, des intérêts intercalaires, de l’assurance et des frais de dossier. Plus la vente tarde, plus le coût réel du relais augmente.",
      },
      {
        q: "Combien de temps dure un prêt relais ?",
        a: "La durée est souvent courte, généralement autour de 12 à 24 mois selon les banques et le dossier. L’objectif reste de vendre le bien actuel rapidement pour rembourser le relais.",
      },
      {
        q: "Le simulateur remplace-t-il un accord bancaire ?",
        a: "Non. Le simulateur donne un ordre de grandeur pour préparer votre projet. La banque reste seule décisionnaire sur le montant accordé, le taux, la durée et les conditions exactes.",
      },
    ],
    []
  );

  // ✅ mêmes “modifs SEO” que /capacite :
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
      name: "Simulateur de prêt relais",
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
        { "@type": "ListItem", position: 2, name: "Prêt relais", item: pageUrl },
      ],
    };

    const faqPage = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: "fr-FR",
      mainEntity: faqData.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };

    const howTo = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "Calculer un prêt relais immobilier",
      description: "Méthode simple pour estimer un prêt relais avant la vente d'un bien immobilier.",
      inLanguage: "fr-FR",
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Estimer la valeur du bien à vendre",
          text: "Renseignez une valeur réaliste du bien actuel, idéalement avec une estimation prudente.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Déduire le capital restant dû",
          text: "Retirez le capital restant à rembourser sur le crédit immobilier actuel.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Appliquer le pourcentage bancaire",
          text: "Appliquez le pourcentage retenu par la banque, souvent entre 60 % et 80 % de la valeur du bien.",
        },
        {
          "@type": "HowToStep",
          position: 4,
          name: "Comparer avec le nouveau projet",
          text: "Ajoutez le nouveau prêt possible et l'apport pour estimer votre budget d'achat avant la vente.",
        },
      ],
    };

    return [webPage, app, breadcrumb, faqPage, howTo];
  }, [title, description, pageUrl, siteUrl, ogImage, faqData]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f9fc]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={pageUrl} />
        <link rel="alternate" hrefLang="fr-FR" href={pageUrl} />
        <link rel="alternate" hrefLang="x-default" href={pageUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:alt" content="Simulateur de prêt relais — lokt.fr" />

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
          eyebrow="Calculette prêt relais lokt.fr"
          title={isLoggedIn && displayName ? `${displayName}, simulez votre prêt relais.` : "Simulateur prêt relais immobilier gratuit"}
          description="Calculez le crédit relais possible, les intérêts indicatifs et votre budget d'achat avant la vente du bien actuel."
          links={[
            { href: "/", label: "Accueil" },
            { href: "/capacite", label: "Capacité d'emprunt" },
            { href: "/investissement", label: "Rentabilité locative" },
            { href: "/parc-immobilier", label: "Parc immobilier" },
          ]}
        />
        <div className="mx-auto -mt-12 max-w-6xl space-y-5 px-3 pb-8 sm:-mt-16 sm:space-y-6 sm:px-4 sm:pb-12">

          {/* Calculette */}
          <PretRelaisWizard showSaveButton={isLoggedIn} />

          {/* Bloc SEO éditorial */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div data-scroll-reveal data-reveal-delay="0">
              <h2 className="text-sm font-semibold text-slate-900">
                Calcul prêt relais : la formule à connaître
              </h2>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Le calcul d’un prêt relais repose sur une logique simple : la banque part de la valeur du bien à vendre,
                retient seulement une partie de cette valeur par prudence, puis déduit le capital restant dû. Le simulateur
                vous donne ensuite un budget d’achat en combinant <strong>crédit relais</strong>, nouveau prêt et apport.
              </p>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Formule indicative : <strong>valeur du bien à vendre × pourcentage retenu - capital restant dû</strong>.
                Si votre logement vaut 400 000 €, que la banque retient 70 % et qu’il reste 120 000 € à rembourser, le
                relais estimé est de 160 000 €.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  title: "1. Bien à vendre",
                  text: "Renseignez la valeur estimée, le capital restant dû et le pourcentage retenu par la banque.",
                },
                {
                  title: "2. Nouveau financement",
                  text: "Ajoutez vos revenus, crédits existants, taux, durée et apport pour calculer la capacité restante.",
                },
                {
                  title: "3. Budget d’achat",
                  text: "Comparez le prix cible avec le relais, le nouveau prêt possible et les intérêts indicatifs.",
                },
              ].map((item, i) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  data-scroll-reveal
                  data-reveal-delay={i * 70}
                >
                  <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500" data-scroll-reveal data-reveal-delay="0">
              Note : chaque banque applique ses règles internes : décote, durée, franchise, assurance, frais et analyse
              du taux d’endettement. Le résultat reste indicatif.
            </p>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4" data-scroll-reveal data-reveal-delay="0">
              {[
                { href: "/capacite", label: "Calculer ma capacité d’emprunt" },
                { href: "/investissement", label: "Tester la rentabilité du futur bien" },
                { href: "/outil-gestion-locative", label: "Gérer le bien après achat" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-200 hover:bg-indigo-50"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-50 to-white" />
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-slate-600"
                    data-scroll-reveal
                    data-reveal-delay="0"
                  >
                    FAQ
                  </p>
                  <h2
                    className="text-lg sm:text-xl font-semibold text-slate-900 mt-1"
                    data-scroll-reveal
                    data-reveal-delay="100"
                  >
                    Questions fréquentes sur le prêt relais
                  </h2>
                  <p
                    className="text-sm text-slate-600 mt-2 max-w-3xl"
                    data-scroll-reveal
                    data-reveal-delay="200"
                  >
                    Des réponses rapides pour comprendre le relais, le budget total et les hypothèses.
                  </p>
                </div>

                <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-600">
                  lokt.fr
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                {faqData.map((f, i) => (
                  <FaqItem key={f.q} q={f.q} a={<>{f.a}</>} revealDelay={i * 70} />
                ))}
              </div>

              <p className="mt-6 text-xs text-slate-500">
                Une question ? Écrivez-nous à{" "}
                <a className="underline" href="mailto:contact@lokt.fr">
                  contact@lokt.fr
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
