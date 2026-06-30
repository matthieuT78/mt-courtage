// pages/capacite.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import CapaciteWizard from "../components/CapaciteWizard";
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

  useScrollReveal();

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
        q: "Combien puis-je emprunter avec 2 000 € de salaire ?",
        a: "Avec 2 000 € de revenus nets et sans autre charge, la mensualité soutenable à 35 % est d’environ 700 €. Cela correspond à une capacité d’emprunt indicative de 121 000 € sur 20 ans ou 140 000 € sur 25 ans (taux 3,5 %, hors assurance). Avec un apport de 20 000 €, le budget d’achat peut approcher 155 000 €.",
      },
      {
        q: "Combien puis-je emprunter avec 3 000 € de salaire ?",
        a: "Avec 3 000 € de revenus nets mensuels et sans charges, la mensualité disponible est d’environ 1 050 €. Soit une capacité indicative de 181 000 € sur 20 ans ou 210 000 € sur 25 ans à 3,5 %. Si vous avez des crédits à la consommation ou un loyer retenu, la mensualité disponible diminue en conséquence.",
      },
      {
        q: "Combien puis-je emprunter avec 4 000 € de salaire ?",
        a: "À 35 % d’endettement et sans charges, la mensualité disponible est d’environ 1 400 €. La capacité d’emprunt indicative est de 241 000 € sur 20 ans ou 280 000 € sur 25 ans à 3,5 %. Pour un ménage à deux revenus, c’est la somme des deux salaires qui est prise en compte.",
      },
      {
        q: "Combien puis-je emprunter avec 5 000 € de salaire ?",
        a: "Avec 5 000 € de revenus nets mensuels et sans autres charges, la mensualité soutenable est d’environ 1 750 €. Cela correspond à environ 302 000 € sur 20 ans ou 349 000 € sur 25 ans à 3,5 %. Utilisez le simulateur pour intégrer vos charges réelles.",
      },
      {
        q: "Combien puis-je emprunter avec 6 000 € de salaire ?",
        a: "La mensualité disponible à 35 % est d’environ 2 100 €. Capacité indicative : 362 000 € sur 20 ans ou 419 000 € sur 25 ans à 3,5 %. Ces montants varient selon les banques en fonction du reste à vivre, du type de revenus et des garanties exigées.",
      },
      {
        q: "Combien puis-je emprunter avec 8 000 € de salaire ?",
        a: "Avec 8 000 € de revenus nets et sans charges, la mensualité soutenable est d’environ 2 800 €. La capacité d’emprunt indicative est de 483 000 € sur 20 ans ou 559 000 € sur 25 ans à 3,5 %. À ce niveau de revenus, les banques regardent aussi le patrimoine, la stabilité de l’emploi et le reste à vivre.",
      },
      {
        q: "Comment savoir combien je peux emprunter ?",
        a: "Le simulateur estime une mensualité soutenable à partir de vos revenus et charges, puis la convertit en capital empruntable selon le taux, la durée et une hypothèse d’assurance.",
      },
      {
        q: "Quel taux d’endettement est pris en compte ?",
        a: "La simulation s’appuie sur la norme HCSF de 35 % (taux d’endettement charges incluses). Certaines banques peuvent aussi regarder le reste à vivre et la stabilité des revenus.",
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
        a: "Non. La calculette est totalement libre d’accès, sans inscription.",
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

    const howTo = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "Comment calculer sa capacité d'emprunt immobilier",
      description: "Méthode en 4 étapes pour estimer le montant maximum que vous pouvez emprunter en France pour un achat immobilier.",
      totalTime: "PT3M",
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Calculer la mensualité soutenable",
          text: "Multipliez vos revenus nets mensuels par le taux d'effort cible (généralement 35 % selon les règles bancaires françaises), puis déduisez vos charges fixes et crédits en cours. Cette mensualité disponible constitue le plafond de remboursement mensuel.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Convertir en capital empruntable",
          text: "Appliquez la formule d'emprunt : capital = mensualité × [(1 − (1 + taux_mensuel)^−n) / taux_mensuel], où le taux mensuel est le taux annuel divisé par 12 et n la durée en mois. Le simulateur effectue ce calcul automatiquement pour différentes durées et taux.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Ajouter l'apport personnel",
          text: "Le budget d'achat total correspond au capital empruntable additionné de votre apport disponible. Attention : une partie de l'apport couvre les frais de notaire (7 à 9 % dans l'ancien, 2 à 3 % dans le neuf) et les frais de garantie.",
        },
        {
          "@type": "HowToStep",
          position: 4,
          name: "Vérifier le reste à vivre",
          text: "Certaines banques complètent l'analyse du taux d'endettement par le reste à vivre (revenus nets − toutes charges − mensualité). Ce montant doit être suffisant selon la composition du foyer, généralement au moins 800 à 1 000 € par personne adulte.",
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

      <main className="flex-1">
        <section className="relative overflow-hidden px-4 pb-20 pt-10 text-white sm:pb-28 sm:pt-14">
          <div className="absolute inset-0 bg-gradient-to-br from-[#635bff] via-[#00a8d4] to-[#00c895]" />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.22)_0%,transparent_42%),linear-gradient(72deg,transparent_58%,rgba(255,184,0,.38)_100%)]" />
          <div className="relative mx-auto max-w-6xl">
            <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/80">
              Calculette immobilière lokt.fr
            </p>
            <h1 data-scroll-reveal data-reveal-delay="100" className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">
              {isLoggedIn && displayName
                ? `${displayName}, trouvez le budget juste pour votre projet.`
                : "Combien pouvez-vous emprunter pour votre projet immobilier ?"}
            </h1>
            <p data-scroll-reveal data-reveal-delay="200" className="mt-4 max-w-2xl text-sm leading-6 text-white/85 sm:text-base sm:leading-7">
              Revenus, charges, apport et durée : obtenez une estimation structurée de votre mensualité et de votre
              budget d&apos;achat.
            </p>
            <div data-scroll-reveal data-reveal-delay="300" className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-white/90">
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 backdrop-blur">Gratuit</span>
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 backdrop-blur">Sans engagement</span>
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 backdrop-blur">Résultat immédiat</span>
            </div>
          </div>
        </section>

        <div className="mx-auto -mt-12 max-w-6xl space-y-5 px-3 pb-8 sm:-mt-16 sm:space-y-6 sm:px-4 sm:pb-12">
          {/* Calculette */}
          <CapaciteWizard showSaveButton={isLoggedIn} />

          {/* ✅ Micro bloc confiance (UX + SEO) */}
          <section className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm sm:grid-cols-3">
            {[
              ["01", "Cadrez votre recherche", "Un budget réaliste avant les visites."],
              ["02", "Comparez vos scénarios", "Durée, taux et apport restent ajustables."],
              ["03", "Préparez la suite", "Une lecture structurée pour avancer sereinement."],
            ].map(([num, heading, text], index) => (
              <div key={num} data-scroll-reveal data-reveal-delay={index * 70} className="bg-white p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">{num}</p>
                <h2 className="mt-2 text-sm font-semibold text-slate-950">{heading}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </section>

          <nav aria-label="Autres calculettes" className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs font-semibold text-[#3f37c9]">
            <Link href="/">Accueil</Link>
            <Link href="/pret-relais">Prêt relais</Link>
            <Link href="/investissement">Rentabilité locative</Link>
            <Link href="/plus-value-vente-immobiliere">Plus-value immobilière</Link>
            <Link href="/parc-immobilier">Parc immobilier</Link>
          </nav>

          {/* Tableau par salaire */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7 space-y-4" data-scroll-reveal>
            <h2 className="text-sm font-semibold text-slate-900">Combien puis-je emprunter selon mon salaire ?</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Estimation indicative basée sur la règle des 35 % d’endettement, sans charges existantes, à un taux de 3,5 %.
              En pratique, vos charges en cours (crédits, pension alimentaire…) réduisent la mensualité disponible.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Revenu net mensuel</th>
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Mensualité max (35 %)</th>
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Capital sur 20 ans</th>
                    <th className="pb-2 font-semibold text-slate-700">Capital sur 25 ans</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {[
                    ["2 000 €", "700 €", "~121 000 €", "~140 000 €"],
                    ["2 500 €", "875 €", "~151 000 €", "~175 000 €"],
                    ["3 000 €", "1 050 €", "~181 000 €", "~210 000 €"],
                    ["3 200 €", "1 120 €", "~193 000 €", "~224 000 €"],
                    ["4 000 €", "1 400 €", "~241 000 €", "~280 000 €"],
                    ["4 500 €", "1 575 €", "~272 000 €", "~315 000 €"],
                    ["5 000 €", "1 750 €", "~302 000 €", "~349 000 €"],
                    ["6 000 €", "2 100 €", "~362 000 €", "~419 000 €"],
                    ["8 000 €", "2 800 €", "~483 000 €", "~559 000 €"],
                  ].map(([sal, mens, c20, c25]) => (
                    <tr key={sal} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{sal}</td>
                      <td className="py-2 pr-4">{mens}</td>
                      <td className="py-2 pr-4">{c20}</td>
                      <td className="py-2">{c25}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Estimations hors charges et hors assurance, à titre indicatif. Taux utilisé : 3,5 %. Chaque dossier est analysé individuellement par la banque.
            </p>
          </section>

          {/* Bloc SEO principal */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div>
              <h2 data-scroll-reveal data-reveal-delay="0" className="text-sm font-semibold text-slate-900">Comment est calculée la capacité d’emprunt ?</h2>

              <p data-scroll-reveal data-reveal-delay="100" className="mt-2 text-sm text-slate-600 leading-relaxed">
                La capacité d’emprunt correspond au montant maximal que vous pouvez emprunter sans dépasser un endettement
                cohérent. Elle dépend principalement de vos revenus nets, de vos charges, de la durée du prêt, du taux et
                de l’assurance.
              </p>

              <ul data-scroll-reveal data-reveal-delay="200" className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
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
            <div data-scroll-reveal data-reveal-delay="0" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
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
              <h2 data-scroll-reveal data-reveal-delay="0" className="text-sm font-semibold text-slate-900">Questions fréquentes sur la capacité d’emprunt</h2>
              <div className="mt-3 grid gap-3">
                {faqData.map((f, index) => (
                  <div key={f.q} data-scroll-reveal data-reveal-delay={index * 70}>
                    <FaqItem q={f.q} a={<>{f.a}</>} />
                  </div>
                ))}
              </div>
            </div>

            <p data-scroll-reveal data-reveal-delay="0" className="text-xs text-slate-500">
              Note : les calculs sont fournis à titre indicatif et peuvent varier selon les banques, le type de projet et
              les conditions de financement.
            </p>
          </section>
        </div>
      </main>

      {/* Maillage → rentabilité (étape suivante du parcours) */}
      <div className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-indigo-100 bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Étape suivante</p>
              <p className="mt-1 text-base font-semibold text-slate-900">Vous avez votre budget. Vérifiez maintenant si le bien rapporte.</p>
              <p className="mt-0.5 text-sm text-slate-500">Rendement brut et net, cash-flow, fiscalité — estimez la rentabilité de votre futur investissement.</p>
            </div>
            <a
              href="/investissement"
              className="shrink-0 rounded-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Calculer la rentabilité →
            </a>
          </div>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
