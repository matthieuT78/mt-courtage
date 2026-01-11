import Head from "next/head";
import Link from "next/link";
import type { GetStaticPaths, GetStaticProps } from "next";
import AppHeader from "../../../components/AppHeader";
import AppFooter from "../../../components/AppFooter";

// JSON-LD SAFE
function JsonLd({ data }: { data: any }) {
  const items = Array.isArray(data) ? data : [data];
  const safe = items.filter(
    (x) => x && typeof x === "object" && typeof x["@context"] === "string"
  );

  return (
    <>
      {safe.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  );
}

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// 🔥 Valeurs de biens que Google va indexer
export const VALEURS = [
  150000, 200000, 250000, 300000, 350000, 400000, 450000,
  500000, 600000, 700000, 800000,
];

type Props = {
  valeur: number;
};

export default function PretRelaisValeurPage({ valeur }: Props) {
  const siteUrl = "https://lokt.fr";
  const pagePath = `/simulateur/pret-relais/${valeur}`; // ✅ CORRECT
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = `Prêt relais avec un bien de ${formatEuro(valeur)}€ — combien puis-je acheter ? | lokt.fr`;
  const description = `Simulez votre prêt relais avec un bien estimé à ${formatEuro(
    valeur
  )}€. Découvrez votre budget d’achat, le montant du relais et le nouveau prêt possible.`;

  const ogImage = `${siteUrl}/logo-transparent-Lokt.jpg`;

  // Hypothèses prudentes (SEO only)
  const decote = 0.7;
  const capitalRestantDu = valeur * 0.3;
  const relais = clamp(Math.round(valeur * decote - capitalRestantDu), 0, valeur);

  const jsonLd = [
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
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Prêt relais", item: `${siteUrl}/pret-relais` },
        { "@type": "ListItem", position: 3, name: `${formatEuro(valeur)}€`, item: pageUrl },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={pageUrl} />

        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />

        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
              Prêt relais avec un bien de {formatEuro(valeur)}€
            </h1>

            <p className="mt-3 text-sm text-slate-600">
              Si votre logement actuel vaut environ <strong>{formatEuro(valeur)}€</strong>,
              vous pouvez obtenir un prêt relais d’environ{" "}
              <strong>{formatEuro(relais)}€</strong> selon les règles bancaires usuelles
              (décote et capital restant dû).
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-600">Valeur du bien</p>
                <p className="text-lg font-semibold">{formatEuro(valeur)}€</p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-600">Capital restant dû (estimation)</p>
                <p className="text-lg font-semibold">{formatEuro(Math.round(capitalRestantDu))}€</p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-600">Relais possible (ordre de grandeur)</p>
                <p className="text-lg font-semibold">{formatEuro(relais)}€</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3 flex-wrap">
              <Link
                href="/pret-relais"
                className="rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold"
              >
                Lancer la vraie calculette prêt relais →
              </Link>

              <Link
                href="/capacite"
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold"
              >
                Vérifier ma capacité d’emprunt →
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              Autres valeurs à explorer
            </h2>

            <div className="mt-3 flex flex-wrap gap-2">
              {VALEURS.filter((v) => v !== valeur).map((v) => (
                <Link
                  key={v}
                  href={`/simulateur/pret-relais/${v}`}   // ✅ CORRECT
                  className="rounded-full border bg-slate-50 px-3 py-1.5 text-sm font-semibold hover:bg-white"
                >
                  {formatEuro(v)}€
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

// Génération SEO
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: VALEURS.map((v) => ({ params: { valeur: String(v) } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const valeur = Number(params?.valeur);

  if (!VALEURS.includes(valeur)) return { notFound: true };

  return { props: { valeur } };
};
