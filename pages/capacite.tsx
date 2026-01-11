import Head from "next/head";
import { useEffect, useState } from "react";
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

  const displayName =
    user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : null);

  const isLoggedIn = !!user;

  // ---- SEO
  const siteUrl = "https://lokt.fr";
  const pageUrl = `${siteUrl}/capacite`;
  const title = "Simulateur de capacité d’emprunt immobilier | lokt.fr";
  const description =
    "Estimez votre capacité d’emprunt immobilier : mensualité cible, capital empruntable et budget d’achat selon vos revenus, charges et crédits. Simulation gratuite.";

  // Utilise une image qui existe vraiment dans /public
  const ogImage = `${siteUrl}/logo-transparent-Lokt.jpg`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Simulateur de capacité d’emprunt immobilier",
    url: pageUrl,
    description,
    applicationCategory: "FinanceApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
    publisher: {
      "@type": "Organization",
      name: "lokt.fr",
      url: siteUrl,
    },
  };

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
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:alt" content="Simulateur de capacité d’emprunt lokt.fr" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm p-5 space-y-3">
            <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              CALCULETTE CAPACITÉ D’EMPRUNT
            </p>

            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Simulateur de capacité d’emprunt immobilier
            </h1>

            {displayName ? (
              <p className="text-sm text-slate-700">
                Bonjour {displayName} — estimez précisément votre capacité d’emprunt.
              </p>
            ) : null}

            <p className="text-xs text-slate-600 max-w-2xl">
              Estimez votre budget immobilier à partir de vos revenus, charges, crédits en cours et
              loyers locatifs (pris en compte de manière prudente). Le calcul est structuré pour
              correspondre à une lecture bancaire réaliste.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <a href="/pret-relais" className="text-xs font-semibold underline text-emerald-700">
                Calculer un prêt relais →
              </a>
              <a href="/investissement" className="text-xs font-semibold underline text-emerald-700">
                Calculer une rentabilité locative →
              </a>
            </div>
          </section>

          {/* Wizard */}
          <CapaciteWizard showSaveButton={isLoggedIn} />

          {/* SEO content */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Comment est calculée votre capacité d’emprunt ?
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed">
              La capacité d’emprunt correspond au montant maximum que vous pouvez emprunter en
              fonction de votre mensualité supportable. Celle-ci est généralement limitée par un
              taux d’endettement (souvent 35 %) et par votre reste à vivre après paiement des charges.
            </p>

            <p className="text-sm text-slate-600 leading-relaxed">
              Les revenus locatifs peuvent être intégrés partiellement (souvent autour de 70 %) afin
              de tenir compte des charges, de la vacance et des imprévus. La durée du crédit, le taux
              d’intérêt et l’assurance influencent fortement le capital empruntable.
            </p>
          </section>

          {/* FAQ */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">Questions fréquentes</h2>

            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <details className="rounded-xl border border-slate-200 p-3">
                <summary className="font-semibold text-slate-900 cursor-pointer">
                  Quel salaire faut-il pour emprunter ?
                </summary>
                <p className="mt-2">
                  Cela dépend de votre mensualité maximale, de la durée du crédit et du taux.
                  La calculette estime ces paramètres pour donner un ordre de grandeur réaliste.
                </p>
              </details>

              <details className="rounded-xl border border-slate-200 p-3">
                <summary className="font-semibold text-slate-900 cursor-pointer">
                  Pourquoi les loyers sont-ils pris à 70 % ?
                </summary>
                <p className="mt-2">
                  Les banques appliquent souvent un abattement pour couvrir les charges et la
                  vacance locative. Cela permet une estimation plus prudente.
                </p>
              </details>

              <details className="rounded-xl border border-slate-200 p-3">
                <summary className="font-semibold text-slate-900 cursor-pointer">
                  Le résultat est-il garanti par une banque ?
                </summary>
                <p className="mt-2">
                  Non. Il s’agit d’une estimation. Chaque banque applique ses propres critères
                  (reste à vivre, stabilité des revenus, type de projet).
                </p>
              </details>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
