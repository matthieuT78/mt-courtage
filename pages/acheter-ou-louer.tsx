// pages/acheter-ou-louer.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import AcheterOuLouerWizard from "../components/AcheterOuLouerWizard";
import CalculatorHero from "../components/calculators/CalculatorHero";
import { supabase } from "../lib/supabaseClient";
import { firstNameFromUser } from "../lib/userDisplay";

type SimpleUser = {
  email?: string;
  user_metadata?: { full_name?: string; first_name?: string; given_name?: string };
};

function JsonLd({ data }: { data: any }) {
  const items = Array.isArray(data) ? data : [data];
  const safe = items.filter(
    (x) => x && typeof x === "object" && typeof x["@context"] === "string" && x["@context"].length > 0
  );
  return (
    <>
      {safe.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
    </>
  );
}

export default function AcheterOuLouerPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(data.session?.user ?? null);
      } catch {}
    })();

    const { data: sub } =
      supabase?.auth.onAuthStateChange((_e, s) => {
        if (!mounted) return;
        setUser(s?.user ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const siteUrl = "https://lokt.fr";
  const pagePath = "/acheter-ou-louer";
  const pageUrl = `${siteUrl}${pagePath}`;
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const title = "Acheter ou louer ? Calculette de décision immobilière gratuite | lokt.fr";
  const description =
    "Faut-il acheter ou louer ? Notre calculette analyse votre situation professionnelle, votre projet et le marché local pour vous donner une recommandation personnalisée en quelques minutes.";

  const faqData = useMemo(
    () => [
      {
        q: "Comment savoir s'il vaut mieux acheter ou louer ?",
        a: "La décision dépend de trois paramètres principaux : votre horizon de temps dans le logement (moins de 5 ans → souvent louer), le ratio prix/loyer du marché local (au-delà de ×25 → la location reste souvent plus compétitive), et votre stabilité professionnelle. Notre calculette combine ces facteurs pour vous donner une recommandation personnalisée.",
      },
      {
        q: "Qu'est-ce que le ratio prix/loyer ?",
        a: "C'est le prix d'achat divisé par le loyer annuel équivalent. Un ratio de ×20 signifie qu'il faut 20 ans de loyer pour égaler le prix du bien. En dessous de ×15, acheter est généralement avantageux. Au-dessus de ×25, la location reste souvent plus intéressante financièrement.",
      },
      {
        q: "Quel est le seuil de rentabilité de l'achat ?",
        a: "C'est le nombre d'années à partir duquel l'achat devient financièrement plus intéressant que la location. Il intègre les frais de notaire (~8 %), les intérêts d'emprunt, l'entretien et la taxe foncière. En France, ce seuil est souvent entre 5 et 10 ans selon le marché.",
      },
      {
        q: "Un CDD peut-il acheter ?",
        a: "C'est possible mais plus difficile. Les banques exigent généralement 2 ou 3 bilans en CDD renouvelé, ou une ancienneté significative. Un apport plus élevé (>20 %) et un co-emprunteur en CDI peuvent compenser ce frein. Notre calculette prend en compte ce paramètre dans son score.",
      },
      {
        q: "Quels sont les frais d'achat à prévoir ?",
        a: "Les frais annexes à l'achat représentent environ 7 à 9 % du prix : frais de notaire (5 à 8 % selon ancienneté du bien), frais d'agence si non inclus, frais de garantie et de dossier bancaire. Ces frais d'entrée allongent le seuil de rentabilité.",
      },
    ],
    []
  );

  const jsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: title,
        url: pageUrl,
        description,
        inLanguage: "fr-FR",
        isPartOf: { "@type": "WebSite", name: "lokt.fr", url: siteUrl },
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Calculette acheter ou louer",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        url: pageUrl,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        provider: { "@type": "Organization", name: "lokt.fr", url: siteUrl },
        areaServed: "FR",
        inLanguage: "fr-FR",
      },
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "Comment décider entre acheter ou louer en France",
        description: "Méthode en 5 étapes pour comparer résidence principale, investissement locatif et location — et choisir la stratégie adaptée à votre situation.",
        totalTime: "PT5M",
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: "Définir votre objectif immobilier",
            text: "Précisez si vous souhaitez acquérir votre résidence principale (arrêter de payer un loyer à fonds perdu), investir dans un bien locatif pour constituer un patrimoine, ou comparer les deux stratégies.",
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: "Évaluer votre stabilité professionnelle",
            text: "Le type de contrat (CDI, CDD, fonctionnaire, indépendant) et l'ancienneté conditionnent directement votre accès au crédit immobilier et les conditions de financement proposées par les banques.",
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: "Chiffrer votre profil financier",
            text: "Renseignez vos revenus nets mensuels, votre apport disponible en euros et votre loyer actuel. Ces données permettent de calculer les mensualités réelles pour chaque scénario et de les comparer objectivement.",
          },
          {
            "@type": "HowToStep",
            position: 4,
            name: "Analyser la tension du marché local",
            text: "Le ratio prix / loyer annuel est le principal indicateur financier. En dessous de ×15, acheter est clairement avantageux. Au-delà de ×25, investir dans le locatif en restant locataire de votre logement actuel peut être plus efficace.",
          },
          {
            "@type": "HowToStep",
            position: 5,
            name: "Comparer les scénarios et décider",
            text: "La calculette compare le surcoût mensuel de la résidence principale (mensualité − loyer actuel) avec le coût net de l'investissement locatif (loyer actuel − cashflow locatif net). Le scénario au meilleur équilibre financier et patrimonial est recommandé.",
          },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqData.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Calculettes", item: `${siteUrl}/calculettes` },
          { "@type": "ListItem", position: 3, name: "Acheter ou louer", item: pageUrl },
        ],
      },
    ],
    [faqData, pageUrl, title, description]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f9fc]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1">
        <CalculatorHero
          eyebrow="Calculette de décision"
          title="Acheter ou louer ?"
          description="Répondez à quelques questions sur votre situation professionnelle, votre projet et le marché local. Obtenez une recommandation personnalisée et le seuil de rentabilité de l'achat."
          links={[
            { href: "/capacite", label: "Capacité d'emprunt" },
            { href: "/investissement", label: "Rentabilité locative" },
            { href: "/plus-value-vente-immobiliere", label: "Plus-value immobilière" },
            { href: "/calculettes", label: "Toutes les calculettes" },
          ]}
        />

        <section className="px-4 py-10 sm:py-14">
          <div className="mx-auto max-w-5xl">
            <AcheterOuLouerWizard />
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold text-slate-950 sm:text-3xl">Questions fréquentes</h2>
            <div className="mt-6 space-y-4">
              {faqData.map(({ q, a }) => (
                <details key={q} className="group rounded-xl border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-slate-900 marker:content-none">
                    {q}
                    <span className="shrink-0 text-slate-400 transition group-open:rotate-180">▾</span>
                  </summary>
                  <p className="px-5 pb-4 text-sm leading-6 text-slate-600">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Cross-links */}
        <section className="px-4 py-10 sm:py-14">
          <div className="mx-auto max-w-5xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Aller plus loin</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Autres simulateurs</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { href: "/capacite", label: "Capacité d'emprunt", desc: "Budget, mensualité max, taux d'endettement et reste à vivre." },
                { href: "/investissement", label: "Rentabilité locative", desc: "Cash-flow, rendement net, charges et plan d'action." },
                { href: "/plus-value-vente-immobiliere", label: "Plus-value", desc: "Cash net, impôts, CRD et arbitrage avant de vendre." },
              ].map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-sm hover:border-[#635bff]/30 transition"
                >
                  <p className="font-semibold text-slate-950">{c.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{c.desc}</p>
                  <p className="mt-3 text-xs font-semibold text-[#635bff] group-hover:underline">Ouvrir →</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
