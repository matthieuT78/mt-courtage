import Head from "next/head";
import Link from "next/link";
import type { GetStaticPaths, GetStaticProps } from "next";
import AppHeader from "../../../components/AppHeader";
import AppFooter from "../../../components/AppFooter";

// ✅ JSON-LD SAFE: évite tout crash si un schema est undefined/malformé
function JsonLd({ data }: { data: any }) {
  const items = Array.isArray(data) ? data : [data];

  const safeItems = items.filter(
    (x) =>
      x &&
      typeof x === "object" &&
      typeof x["@context"] === "string" &&
      x["@context"].length > 0
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

// ✅ Liste des revenus que TU veux générer en pages SEO
const REVENUS = [
  1500, 1800, 2000, 2200, 2500, 2800, 3000, 3200, 3500, 3800, 4000, 4500, 5000,
  5500, 6000, 7000, 8000,
];

type Props = {
  revenu: number;
};

export default function CapaciteEmpruntRevenuPage({ revenu }: Props) {
  const siteUrl = "https://lokt.fr";

  // ✅ URL dynamique (slash) - compatible Next + SEO
  const pagePath = `/simulateur/capacite-emprunt/${revenu}`;
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = `Capacité d’emprunt avec ${formatEuro(
    revenu
  )}€ — combien puis-je emprunter ? | lokt.fr`;

  const description = `Estimez votre capacité d’emprunt avec ${formatEuro(
    revenu
  )}€ de revenus mensuels : mensualité cible, capital empruntable et budget d’achat. Simulation gratuite avec lecture claire sur lokt.fr.`;

  const ogImage = `${siteUrl}/logo-transparent-Lokt.jpg`;

  // Repère indicatif (prudence)
  const tauxEndettement = 0.35;
  const mensualiteIndicative = Math.round(revenu * tauxEndettement);
  const mensualite = clamp(mensualiteIndicative, 300, 5000);

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
        {
          "@type": "ListItem",
          position: 2,
          name: "Capacité d’emprunt",
          item: `${siteUrl}/capacite`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: `Revenu ${formatEuro(revenu)}€`,
          item: pageUrl,
        },
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
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 to-cyan-500" />
            <div className="p-6 sm:p-8">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                Simulateur capacité d’emprunt
              </p>

              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">
                Capacité d’emprunt avec {formatEuro(revenu)}€
              </h1>

              <p className="mt-3 text-sm text-slate-600 max-w-3xl">
                Cette page vous donne un repère rapide pour démarrer. Pour un résultat fiable (charges, crédits, loyers
                à 70%, taux, durée, assurance), lancez la calculette complète lokt.fr.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/capacite"
                  className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Lancer la calculette capacité d’emprunt →
                </Link>

                <Link
                  href="/pret-relais"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
                >
                  Vous achetez avant de vendre ? Prêt relais →
                </Link>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">Mensualité “repère” (indicatif)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    ≈ {formatEuro(mensualite)}€ / mois
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Base simple à 35% des revenus (hors règles banque).</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">Ce qui change tout</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Charges, crédits en cours, assurance, durée, taux, loyers retenus à 70%.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">Ce que fait lokt.fr</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Une lecture structurée (comme un dossier), et comparable entre simulateurs.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CONTENU SEO UTILE */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
              Comment estimer sa capacité d’emprunt avec {formatEuro(revenu)}€ ?
            </h2>

            <div className="mt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                En première approche, les banques raisonnent souvent avec un taux d’endettement maximal (souvent autour
                de 35%). Mais le calcul réel dépend aussi des <strong>charges</strong> (crédits auto, conso, pensions),
                des paramètres de prêt (<strong>durée</strong>, <strong>taux</strong>, <strong>assurance</strong>) et,
                si vous êtes déjà propriétaire bailleur, des loyers retenus de façon prudente (souvent partiellement).
              </p>

              <p>
                Pour obtenir un résultat exploitable, l’idée n’est pas d’avoir “un chiffre”, mais une{" "}
                <strong>lecture claire</strong> : ce qui fait monter/descendre la mensualité, et ce qui sécurise un
                dossier (apport, reste à vivre, stabilité des revenus).
              </p>

              <p>
                Avec lokt.fr, vous testez plusieurs scénarios et vous comparez rapidement :{" "}
                <Link href="/capacite" className="font-semibold underline decoration-slate-300 text-slate-900">
                  capacité d’emprunt
                </Link>
                ,{" "}
                <Link href="/pret-relais" className="font-semibold underline decoration-slate-300 text-slate-900">
                  prêt relais
                </Link>
                ,{" "}
                <Link href="/investissement" className="font-semibold underline decoration-slate-300 text-slate-900">
                  rentabilité locative
                </Link>{" "}
                et{" "}
                <Link href="/parc-immobilier" className="font-semibold underline decoration-slate-300 text-slate-900">
                  parc immobilier
                </Link>
                .
              </p>
            </div>
          </section>

          {/* AUTRES REVENUS (maillage interne) */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-sm font-semibold text-slate-900">Autres revenus à explorer</h2>
            <p className="mt-2 text-sm text-slate-600">
              Comparez rapidement en changeant uniquement le niveau de revenus :
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {REVENUS.filter((r) => r !== revenu)
                .slice(0, 12)
                .map((r) => (
                  <Link
                    key={r}
                    href={`/simulateur/capacite-emprunt/${r}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-white"
                  >
                    {formatEuro(r)}€
                  </Link>
                ))}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Astuce : crée aussi des pages “avec apport X€” ou “avec taux Y%” si tu veux pousser le SEO.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = REVENUS.map((revenu) => ({
    params: { revenu: String(revenu) },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const raw = ctx.params?.revenu;
  const revenuNum = Number(raw);

  if (!Number.isFinite(revenuNum)) {
    return { notFound: true };
  }

  if (!REVENUS.includes(revenuNum)) {
    return { notFound: true };
  }

  return {
    props: { revenu: revenuNum },
  };
};
