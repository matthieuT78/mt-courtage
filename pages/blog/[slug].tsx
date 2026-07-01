import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import type { GetStaticPaths, GetStaticProps } from "next";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import { getAllBlogSlugs, getAllPostsMeta, getPostBySlug, type BlogPost, type BlogFrontmatter } from "../../lib/blog";

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; gradient: string }> = {
  "Capacité d'emprunt":    { color: "text-[#635bff]",  bg: "bg-[#635bff]/10", gradient: "from-[#635bff]/50 via-[#007ba7]/30 to-[#00a97b]/10" },
  "Investissement locatif":{ color: "text-emerald-700", bg: "bg-emerald-50",   gradient: "from-emerald-800/60 via-emerald-600/30 to-transparent" },
  "Plus-value immobilière":{ color: "text-amber-700",   bg: "bg-amber-50",     gradient: "from-amber-800/60 via-amber-600/25 to-transparent" },
  "Achat immobilier":      { color: "text-sky-700",     bg: "bg-sky-50",       gradient: "from-sky-800/60 via-sky-600/25 to-transparent" },
  "Crédit immobilier":     { color: "text-indigo-700",  bg: "bg-indigo-50",    gradient: "from-indigo-800/60 via-indigo-600/25 to-transparent" },
};
const DEFAULT_CAT = { color: "text-[#635bff]", bg: "bg-[#635bff]/10", gradient: "from-[#635bff]/50 via-[#007ba7]/30 to-[#00a97b]/15" };
function getCat(category?: string) { return (category && CATEGORY_CONFIG[category]) || DEFAULT_CAT; }

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
      image: frontmatter.coverImage ? `${SITE_URL}${frontmatter.coverImage}` : `${SITE_URL}/logo-transparent-Lokt.jpg`,
      inLanguage: "fr-FR",
      datePublished: frontmatter.date || undefined,
      dateModified: frontmatter.updatedAt || frontmatter.date || undefined,
      wordCount: Math.round(contentHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length),
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
    ...(frontmatter.faq?.length ? [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: frontmatter.faq.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    }] : []),
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

      <AppHeader />
      {/* ── COVER IMAGE / GRADIENT HERO ── */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: 280 }}>
        {frontmatter.coverImage ? (
          <>
            <div className="relative h-[320px] w-full sm:h-[400px]">
              <Image src={frontmatter.coverImage} alt={frontmatter.title} fill priority className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 sm:px-8">
              <div className="mx-auto max-w-6xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                  {frontmatter.category && (
                    <span className="rounded-full bg-[#635bff] px-2.5 py-1 font-semibold text-white">
                      {frontmatter.category}
                    </span>
                  )}
                  <span>{readingTime} min de lecture</span>
                  {frontmatter.date && <span>{formatDateFR(frontmatter.date)}</span>}
                </div>
                <h1 className="mt-2 max-w-3xl text-2xl font-bold leading-tight text-white sm:text-4xl">
                  {frontmatter.title}
                </h1>
              </div>
            </div>
          </>
        ) : (
          <div className={`relative flex min-h-[280px] items-end bg-gradient-to-br ${getCat(frontmatter.category).gradient} bg-slate-950`}>
            <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-[#635bff]/15 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#635bff]/60 to-transparent" />
            <div className="relative mx-auto w-full max-w-6xl px-4 pb-8 sm:px-8">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {frontmatter.category && (
                  <span className="rounded-full bg-[#635bff] px-2.5 py-1 font-semibold text-white">
                    {frontmatter.category}
                  </span>
                )}
                <span className="text-slate-400">{readingTime} min de lecture</span>
                {frontmatter.date && <span className="text-slate-400">{formatDateFR(frontmatter.date)}</span>}
              </div>
              <h1 className="mt-3 max-w-3xl text-2xl font-bold leading-tight text-white sm:text-4xl">
                {frontmatter.title}
              </h1>
              {frontmatter.description && (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{frontmatter.description}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Retour au blog
        </Link>

        <div className="mt-6 lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
          {/* ── Contenu principal ── */}
          <div className="min-w-0">
            <header className="mb-8">
              {/* Description (si pas affichée dans le hero gradient) */}
              {frontmatter.coverImage && frontmatter.description && (
                <p className="text-lg leading-relaxed text-slate-600">{frontmatter.description}</p>
              )}

              {/* Tags */}
              {frontmatter.tags && frontmatter.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {frontmatter.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.72rem] text-slate-500">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* CTAs dynamiques */}
              <div className="mt-5 flex flex-wrap gap-2">
                {ctaLinks.map((c, i) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className={
                      i === 0
                        ? "inline-flex items-center rounded-full bg-[#635bff] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#635bff]/25 hover:bg-[#4f46e5]"
                        : "inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    }
                  >
                    {c.label} →
                  </Link>
                ))}
              </div>
            </header>

            <article
              className={[
                "prose prose-slate max-w-none",
                // headings
                "prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:text-slate-900",
                "prose-h2:mt-10 prose-h2:text-xl prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-2",
                "prose-h3:mt-6 prose-h3:text-base",
                // body text
                "prose-p:text-slate-600 prose-p:leading-7",
                // links
                "prose-a:text-[#635bff] prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
                // blockquote
                "prose-blockquote:border-l-[#635bff] prose-blockquote:bg-[#635bff]/5 prose-blockquote:rounded-r-xl prose-blockquote:py-1 prose-blockquote:not-italic prose-blockquote:text-slate-700",
                // tables
                "prose-table:text-sm prose-thead:bg-slate-50 prose-th:text-slate-700 prose-th:font-semibold prose-td:text-slate-600",
                // lists
                "prose-li:text-slate-600 prose-li:marker:text-[#635bff]",
                // hr
                "prose-hr:border-slate-200",
                // strong
                "prose-strong:text-slate-800 prose-strong:font-semibold",
                // code
                "prose-code:text-[#635bff] prose-code:bg-[#635bff]/8 prose-code:rounded prose-code:px-1 prose-code:font-medium prose-code:before:content-none prose-code:after:content-none",
              ].join(" ")}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />

            {/* Rendement par ville — maillage interne */}
            {(frontmatter.category === "Investissement locatif" || frontmatter.relatedCalculators?.includes("investissement")) && (
              <section className="mt-12 border-t border-slate-200 pt-8">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Rendement locatif par ville
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { slug: "lyon", nom: "Lyon" },
                    { slug: "bordeaux", nom: "Bordeaux" },
                    { slug: "toulouse", nom: "Toulouse" },
                    { slug: "marseille", nom: "Marseille" },
                    { slug: "rennes", nom: "Rennes" },
                    { slug: "nantes", nom: "Nantes" },
                    { slug: "strasbourg", nom: "Strasbourg" },
                    { slug: "lille", nom: "Lille" },
                    { slug: "montpellier", nom: "Montpellier" },
                    { slug: "grenoble", nom: "Grenoble" },
                    { slug: "angers", nom: "Angers" },
                    { slug: "clermont-ferrand", nom: "Clermont-Ferrand" },
                    { slug: "nancy", nom: "Nancy" },
                    { slug: "metz", nom: "Metz" },
                    { slug: "nice", nom: "Nice" },
                  ].map((v) => (
                    <Link
                      key={v.slug}
                      href={`/rendement-locatif/${v.slug}`}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition"
                    >
                      {v.nom}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* FAQ accordion — only rendered when FAQ is NOT already in the markdown body */}
            {frontmatter.faq && frontmatter.faq.length > 0 && !toc.some(e => /fréquentes|questions/i.test(e.text)) && (
              <section className="mt-12 border-t border-slate-200 pt-8">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Questions fréquentes</p>
                <div className="mt-4 space-y-4">
                  {frontmatter.faq.map(({ q, a }, i) => (
                    <details key={i} className="group rounded-2xl border border-slate-200 bg-white">
                      <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-slate-900 marker:content-none hover:text-indigo-700">
                        {q}
                        <svg className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </summary>
                      <p className="px-5 pb-4 text-sm leading-6 text-slate-600">{a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

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
      <AppFooter />
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
