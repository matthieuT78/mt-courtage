// pages/simulateur/investissement/[prix].tsx
import Head from "next/head";
import Link from "next/link";
import type { GetStaticPaths, GetStaticProps } from "next";
import AppHeader from "../../../components/AppHeader";
import AppFooter from "../../../components/AppFooter";

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

function formatEuro(n: number) {
  try {
    return new Intl.NumberFormat("fr-FR").format(n);
  } catch {
    return String(n);
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ✅ PRIX générés (SEO): 100k → 800k par pas de 10k
export const PRIX: number[] = Array.from({ length: 71 }, (_, i) => 100000 + i * 10000);

type Props = { prix: number };

export default function InvestissementPrixPage({ prix }: Props) {
  const siteUrl = "https://lokt.fr";

  // ✅ Route réelle (dossier dynamique): /simulateur/investissement/200000
  const pagePath = `/simulateur/investissement/${prix}`;
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = `Rentabilité locative pour un achat à ${formatEuro(prix)}€ — cash-flow & rendement | lokt.fr`;
  const description = `Estimez la rentabilité locative pour un achat à ${formatEuro(
    prix
  )}€ : repères sur loyers/charges/cash-flow, puis lancez la calculette complète lokt.fr (longue durée ou Airbnb).`;

  const ogImage = `${siteUrl}/logo-transparent-Lokt.jpg`;

  /**
   * Repères INDICATIFS (SEO only) — on reste prudent :
   * - loyer brut "repère" basé sur un rendement brut "moyen" (ex: 5%)
   * - charges repère (ex: 20% des loyers)
   * - cash-flow repère = loyers - charges (SANS financement)
   *
   * ⚠️ Le vrai calcul (financement, taux, durée, assurance, vacance, gestion...) est dans /investissement.
   */
  const rendementBrutRepere = 0.05; // 5% brut (repère générique)
  const loyerAnnuelRepere = Math.round(prix * rendementBrutRepere);
  const loyerMensuelRepere = Math.round(loyerAnnuelRepere / 12);

  const chargesPctRepere = 0.2; // 20% (repère générique)
  const chargesMensuellesRepere = Math.round(loyerMensuelRepere * chargesPctRepere);

  const cashflowMensuelAvantCredit = clamp(loyerMensuelRepere - chargesMensuellesRepere, 0, 999999);

  const jsonLd = [
    {
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
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Rentabilité locative", item: `${siteUrl}/investissement` },
        { "@type": "ListItem", position: 3, name: `${formatEuro(prix)}€`, item: pageUrl },
      ],
    },
  ];

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

        {/* JSON-LD SAFE */}
        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* HERO */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-amber-200" />
            <div className="p-6 sm:p-8">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                Simulateur rentabilité locative
              </p>

              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">
                Rentabilité locative pour un achat à {formatEuro(prix)}€
              </h1>

              <p className="mt-3 text-sm text-slate-600 max-w-3xl">
                Cette page donne des <strong>repères rapides</strong> (indicatifs) pour démarrer.
                Pour un résultat fiable (financement, vacance, gestion, charges, Airbnb/longue durée),
                lancez la calculette complète lokt.fr.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/investissement"
                  className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Lancer la calculette rentabilité locative →
                </Link>

                <Link
                  href="/capacite"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
                >
                  Vérifier ma capacité d’emprunt →
                </Link>

                <Link
                  href="/parc-immobilier"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
                >
                  J’ai déjà plusieurs biens (parc) →
                </Link>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">Loyer “repère” (indicatif)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">≈ {formatEuro(loyerMensuelRepere)}€ / mois</p>
                  <p className="mt-1 text-xs text-slate-600">Base repère ~ {Math.round(rendementBrutRepere * 100)}% brut.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">Charges “repère” (indicatif)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    ≈ {formatEuro(chargesMensuellesRepere)}€ / mois
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Repère simple (copro/entretien/assurances…)</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">Cash-flow avant crédit (repère)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    ≈ {formatEuro(cashflowMensuelAvantCredit)}€ / mois
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Hors financement (le vrai calcul est sur lokt.fr)</p>
                </div>
              </div>
            </div>
          </section>

          {/* CONTENU SEO UTILE */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
              Comment analyser la rentabilité locative à {formatEuro(prix)}€ ?
            </h2>

            <div className="mt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                La rentabilité ne se résume pas à un rendement brut. Pour décider, vous devez voir l’impact réel
                des <strong>charges</strong>, de la <strong>vacance</strong>, de la <strong>gestion</strong> et surtout
                du <strong>financement</strong> (taux, durée, assurance, apport).
              </p>

              <p>
                L’objectif, ce n’est pas “un chiffre”, mais une lecture exploitable :{" "}
                <strong>cash-flow</strong>, effort d’épargne, marges de sécurité, et comparaison entre scénarios
                (longue durée vs Airbnb).
              </p>

              <p>
                Pour aller plus loin avec un résultat fiable :{" "}
                <Link href="/investissement" className="font-semibold underline decoration-slate-300 text-slate-900">
                  lancez la calculette rentabilité locative
                </Link>
                .
              </p>
            </div>
          </section>

          {/* AUTRES PRIX (maillage interne) */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-sm font-semibold text-slate-900">Autres prix à explorer</h2>
            <p className="mt-2 text-sm text-slate-600">
              Comparez rapidement en changeant uniquement le prix d’achat :
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {PRIX.filter((p) => p !== prix)
                .slice(0, 18)
                .map((p) => (
                  <Link
                    key={p}
                    href={`/simulateur/investissement/${p}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-white"
                  >
                    {formatEuro(p)}€
                  </Link>
                ))}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Ces pages sont pensées pour capter des requêtes du type “rentabilité locative 250000€” et renvoyer vers la
              calculette complète.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: PRIX.map((p) => ({ params: { prix: String(p) } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const prixNum = Number(params?.prix);

  if (!Number.isFinite(prixNum)) return { notFound: true };
  if (!PRIX.includes(prixNum)) return { notFound: true };

  return { props: { prix: prixNum } };
};
