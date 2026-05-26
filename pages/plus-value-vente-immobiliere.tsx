// pages/plus-value-vente-immobiliere.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import PlusValueWizard from "../components/PlusValueWizard";
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

// ✅ JSON-LD SAFE (évite les crashs si un schema est malformé)
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

export default function PlusValueVenteImmobilierePage() {
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
        console.error("Erreur récupération session (plus-value)", e);
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

  // ---- SEO
  const siteUrl = "https://lokt.fr";
  const pagePath = "/plus-value-vente-immobiliere";
  const pageUrl = `${siteUrl}${pagePath}`;

  // ✅ CTR-first
  const title = "Calcul plus-value immobilière gratuit – Cash net, CRD, LMNP et impôts | lokt.fr";
  const description =
    "Calculez gratuitement votre plus-value immobilière et le cash net après vente : prix net vendeur, frais, travaux, CRD, IRA, LMNP/amortissements et impôts.";

  // OG image (non transparent)
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const faqData = useMemo(
    () => [
      {
        q: "Pourquoi le CRD (capital restant dû) est obligatoire ?",
        a: "Parce que votre gain réel dépend de ce qu’il reste à rembourser. Sans CRD, on peut calculer une plus-value “théorique”, mais pas le cash net réellement récupéré après remboursement du prêt.",
      },
      {
        q: "Quelle différence entre plus-value et cash net ?",
        a: "La plus-value compare prix de vente et coût d’achat. Le cash net correspond à ce que vous récupérez réellement après remboursement du CRD, frais éventuels (IRA, mainlevée…) et impôt sur la plus-value si applicable.",
      },
      {
        q: "Résidence principale : y a-t-il un impôt sur la plus-value ?",
        a: "En général, la plus-value sur la résidence principale est exonérée. Si ce n’est pas votre résidence principale, une imposition peut s’appliquer selon les règles en vigueur et les abattements.",
      },
      {
        q: "Pourquoi la banque applique parfois des pénalités (IRA) ?",
        a: "En cas de remboursement anticipé, certaines banques appliquent des indemnités (IRA). Leur montant dépend du contrat et des règles applicables (souvent plafonnées).",
      },
      {
        q: "Les travaux peuvent-ils réduire la plus-value imposable ?",
        a: "Selon les cas, certains travaux peuvent être retenus (sous conditions) pour augmenter le coût d’acquisition et réduire la plus-value. Le détail dépend du régime fiscal et des justificatifs.",
      },
      {
        q: "Les abattements pour durée de détention sont-ils pris en compte ?",
        a: "La logique de la calculette est de donner un ordre de grandeur. Les abattements (durée de détention, exonérations) dépendent de votre situation et des règles en vigueur.",
      },
      {
        q: "La calculette tient-elle compte du LMNP ?",
        a: "Oui, elle permet d’ajouter les amortissements LMNP déjà déduits pour obtenir une estimation plus prudente du cash net vendeur. Le montant exact doit être vérifié avec votre liasse ou votre expert-comptable.",
      },
    ],
    []
  );

  // ✅ JSON-LD (SAFE) : WebPage + SoftwareApplication + Breadcrumb + FAQPage
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

    const softwareApp = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Calculateur de plus-value immobilière",
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

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Plus-value immobilière", item: pageUrl },
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

    return [webPage, softwareApp, breadcrumb, faqPage];
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
        <meta property="og:image:alt" content="Calcul plus-value immobilière — lokt.fr" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* ✅ JSON-LD SAFE */}
        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header de la page */}
          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />
            <div className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#635bff]">
                CALCULETTE PLUS-VALUE IMMOBILIÈRE
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-[#f6f9fc] px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
                lokt.fr
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {isLoggedIn && displayName
                ? `Bonjour ${displayName}, calculez votre cash net après vente.`
                : "Calculer le cash net après vente (plus-value immobilière)"}
            </h1>

            <p className="text-xs text-slate-600 max-w-3xl">
              Parcours guidé : prix de vente, coût d’achat (notaire/travaux), <strong>CRD</strong>, pénalités (IRA),
              LMNP/amortissements et imposition si applicable. Le résultat est présenté en <strong>cash net</strong>{" "}
              (ce que vous récupérez réellement).
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
              <Link href="/parc-immobilier" className="text-xs font-semibold underline decoration-[#635bff]/30 text-[#3f37c9]">
                Parc immobilier →
              </Link>
            </div>
            </div>
          </section>

          {/* Calculette */}
          <PlusValueWizard />

          {/* ✅ Micro bloc confiance (UX + SEO) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">Pourquoi simuler avant de vendre ?</h2>
            <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
              <li>Connaître le <strong>cash net</strong> réellement récupéré (et pas seulement la plus-value).</li>
              <li>Comparer plusieurs prix de vente (prudent vs optimiste) et mesurer l’impact sur votre projet suivant.</li>
              <li>Anticiper l’effet du <strong>CRD</strong>, des frais et d’une éventuelle imposition.</li>
            </ul>
          </section>

          {/* Bloc SEO enrichi */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Calcul plus-value immobilière : ce qui compte vraiment</h2>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Cette calculette de plus-value immobilière vise surtout le <strong>cash net après vente</strong> :
                prix net vendeur, coût d’acquisition (frais de notaire, travaux), remboursement du prêt (CRD) et frais
                éventuels. C’est ce montant qui détermine ce que vous récupérez réellement pour financer la suite
                (achat, investissement, apport…).
              </p>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Les résultats sont indicatifs : ils dépendent du prix signé, des conditions bancaires (IRA, intérêts,
                frais) et du régime fiscal (résidence principale, durée de détention, exonérations). Utilisez l’outil
                pour comparer des scénarios et vous donner un ordre de grandeur fiable.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Comment fonctionne le calcul (simplifié) ?</h2>
              <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
                <li>
                  <strong>Prix net vendeur</strong> : prix de vente – frais d’agence éventuels (selon cas).
                </li>
                <li>
                  <strong>Plus-value</strong> : prix de vente – (prix d’achat + notaire + travaux éligibles).
                </li>
                <li>
                  <strong>Cash net</strong> : prix net vendeur – <strong>CRD</strong> – frais (IRA, mainlevée…) – impôt éventuel.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Exemple rapide</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Exemple indicatif : vente <strong>350 000 €</strong>, coût d’achat (notaire + travaux inclus){" "}
                <strong>280 000 €</strong>, CRD <strong>140 000 €</strong>. Avant impôt/frais éventuels, le cash net
                se rapproche de <strong>350 000 − 140 000 = 210 000 €</strong>, puis on ajuste avec frais et fiscalité
                selon votre situation.
              </p>
            </div>

            {/* FAQ visible */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Questions fréquentes sur la plus-value immobilière</h2>
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
              Note : calculs indicatifs. Les règles fiscales et les conditions bancaires varient selon votre situation.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
