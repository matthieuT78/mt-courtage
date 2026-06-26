import Head from "next/head";
import Link from "next/link";
import { getAllPostsMeta } from "../../lib/blog";

function formatDateFR(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "long", day: "2-digit" }).format(d);
}

export default function BlogIndex({ posts }: any) {
  const siteUrl = "https://lokt.fr";
  const pagePath = "/blog";
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = "Blog immobilier — guides & simulateurs | lokt.fr";
  const description =
    "Guides pratiques pour emprunter, investir, optimiser un prêt relais et comprendre les calculs bancaires. Articles + liens directs vers les calculettes lokt.fr.";
  const ogImage = `${siteUrl}/logo-transparent-Lokt.jpg`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Blog lokt.fr",
      url: pageUrl,
      description,
      inLanguage: "fr-FR",
      publisher: { "@type": "Organization", name: "lokt.fr", url: siteUrl },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: pageUrl },
      ],
    },
  ];

  return (
    <>
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

        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* HERO */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 to-cyan-500" />
          <div className="p-6 sm:p-8">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Guides & méthodes</p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">Blog lokt.fr</h1>
            <p className="mt-3 text-sm text-slate-600 max-w-3xl">
              Articles actionnables (banque, crédit, investissement) + liens directs vers les simulateurs.
              Objectif : comprendre vite, décider mieux.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/capacite"
                className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Simulateur capacité d’emprunt →
              </Link>
              <Link
                href="/pret-relais"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
              >
                Simulateur prêt relais →
              </Link>
              <Link
                href="/investissement"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
              >
                Rentabilité locative →
              </Link>
            </div>
          </div>
        </section>

        {/* LISTE */}
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Derniers articles</h2>
            <p className="text-sm text-slate-600">{posts.length} article(s)</p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {posts.map((p: any) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {p.frontmatter.category ? (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
                      {p.frontmatter.category}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Article</span>
                  )}
                  {p.frontmatter.date && (
                    <span className="text-slate-400">{formatDateFR(p.frontmatter.date)}</span>
                  )}
                  <span className="text-slate-400">{p.readingTime} min</span>
                </div>

                <p className="mt-2.5 text-base font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">
                  {p.frontmatter.title}
                </p>

                {p.frontmatter.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 line-clamp-3">
                    {p.frontmatter.description}
                  </p>
                ) : null}

                {p.frontmatter.tags?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.frontmatter.tags.slice(0, 3).map((tag: string) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.68rem] text-slate-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-4 text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
                  Lire l’article →
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

export async function getStaticProps() {
  const posts = getAllPostsMeta();

  // ✅ tri date desc si besoin (ça évite un blog “bizarre”)
  const sorted = [...posts].sort((a: any, b: any) => {
    const da = new Date(a?.frontmatter?.date || 0).getTime();
    const db = new Date(b?.frontmatter?.date || 0).getTime();
    return db - da;
  });

  return { props: { posts: sorted } };
}
