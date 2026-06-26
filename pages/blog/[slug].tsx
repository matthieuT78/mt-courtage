import Head from "next/head";
import Link from "next/link";
import type { GetStaticPaths, GetStaticProps } from "next";
import { getAllBlogSlugs, getAllPostsMeta, getPostBySlug, type BlogPost, type BlogFrontmatter } from "../../lib/blog";

type RelatedPost = { slug: string; frontmatter: BlogFrontmatter };
type Props = { post: BlogPost; slug: string; related: RelatedPost[] };

const SITE_URL = "https://lokt.fr";

const CALCULATOR_MAP: Record<string, { href: string; label: string }> = {
  capacite:         { href: "/capacite",                       label: "Simulateur capacité d'emprunt" },
  investissement:   { href: "/investissement",                 label: "Simulateur rentabilité locative" },
  "pret-relais":    { href: "/pret-relais",                    label: "Simulateur prêt relais" },
  "plus-value":     { href: "/plus-value-vente-immobiliere",   label: "Calculette plus-value" },
  "acheter-ou-louer": { href: "/acheter-ou-louer",            label: "Calculette acheter ou louer" },
  "parc-immobilier": { href: "/parc-immobilier",              label: "Cockpit parc immobilier" },
};

const DEFAULT_CALCULATORS = ["capacite", "investissement", "pret-relais"];

function formatDateFR(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "long", day: "2-digit" }).format(d);
}

export default function BlogPostPage({ post, slug: postSlug, related }: Props) {
  const { frontmatter, contentHtml, readingTime, toc } = post;

  const pageUrl = `${SITE_URL}/blog/${postSlug}`;
  const title = frontmatter.title ? `${frontmatter.title} | lokt.fr` : "Blog | lokt.fr";
  const description =
    frontmatter.description ||
    "Guide immobilier lokt.fr : explications simples + simulateurs pour emprunter, investir et optimiser vos projets.";
  const ogImage = frontmatter.coverImage
    ? `${SITE_URL}${frontmatter.coverImage}`
    : `${SITE_URL}/logo-transparent-Lokt.jpg`;

  const calculatorKeys = frontmatter.relatedCalculators?.length
    ? frontmatter.relatedCalculators
    : DEFAULT_CALCULATORS;
  const ctaLinks = calculatorKeys
    .map((k) => CALCULATOR_MAP[k])
    .filter(Boolean);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: frontmatter.title || "Article lokt.fr",
      description,
      url: pageUrl,
      inLanguage: "fr-FR",
      datePublished: frontmatter.date || undefined,
      dateModified: frontmatter.date || undefined,
      author: { "@type": "Organization", name: "lokt.fr", url: SITE_URL },
      publisher: { "@type": "Organization", name: "lokt.fr", url: SITE_URL },
      mainEntityOfPage: pageUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
        { "@type": "ListItem", position: 3, name: frontmatter.title || "Article", item: pageUrl },
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
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={frontmatter.title || "lokt.fr"} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:alt" content="lokt.fr — simulateurs immobiliers" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={frontmatter.title || "lokt.fr"} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        {jsonLd.map((schema, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        ))}
      </Head>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link href="/blog" className="text-sm text-slate-500 hover:text-slate-900 hover:underline">
          ← Retour au blog
        </Link>

        <div className="mt-6 lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
          {/* ── Contenu principal ── */}
          <div className="min-w-0">
            <header className="mb-8">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {frontmatter.category && (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
                    {frontmatter.category}
                  </span>
                )}
                {frontmatter.tags?.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                    {tag}
                  </span>
                ))}
                {frontmatter.date && (
                  <span className="text-slate-400">{formatDateFR(frontmatter.date)}</span>
                )}
                <span className="text-slate-400">{readingTime} min de lecture</span>
              </div>

              <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                {frontmatter.title}
              </h1>

              {frontmatter.description && (
                <p className="mt-3 text-lg text-slate-600 leading-relaxed">{frontmatter.description}</p>
              )}

              {/* CTAs dynamiques selon le sujet de l'article */}
              <div className="mt-5 flex flex-wrap gap-2">
                {ctaLinks.map((c, i) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className={
                      i === 0
                        ? "inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                        : "inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    }
                  >
                    {c.label} →
                  </Link>
                ))}
              </div>
            </header>

            <article
              className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />

            {/* Articles liés */}
            {related.length > 0 && (
              <section className="mt-12 border-t border-slate-200 pt-8">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  À lire aussi
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {related.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/blog/${r.slug}`}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                      {r.frontmatter.category && (
                        <span className="text-[0.7rem] font-medium text-indigo-600">
                          {r.frontmatter.category}
                        </span>
                      )}
                      <p className="mt-1 font-semibold text-slate-900 leading-snug group-hover:text-indigo-700">
                        {r.frontmatter.title}
                      </p>
                      {r.frontmatter.description && (
                        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {r.frontmatter.description}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Sidebar : table des matières ── */}
          {toc.length >= 3 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Sommaire
                </p>
                <nav className="mt-3 space-y-1">
                  {toc.map((entry) => (
                    <a
                      key={entry.id}
                      href={`#${entry.id}`}
                      className={
                        "block rounded-lg px-2 py-1 text-[0.78rem] leading-snug text-slate-600 hover:bg-white hover:text-slate-900 transition " +
                        (entry.level === 3 ? "pl-5 text-slate-400" : "font-medium")
                      }
                    >
                      {entry.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = getAllBlogSlugs();
  return {
    paths: slugs.map((slug) => ({ params: { slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const slug = String(ctx.params?.slug || "");
  const post = await getPostBySlug(slug);
  const allMeta = getAllPostsMeta();

  const related = allMeta
    .filter((p) => p.slug !== slug)
    .filter(
      (p) =>
        p.frontmatter.category === post.frontmatter.category ||
        p.frontmatter.relatedCalculators?.some((k) =>
          post.frontmatter.relatedCalculators?.includes(k)
        )
    )
    .slice(0, 2);

  return { props: { post, slug, related } };
};
