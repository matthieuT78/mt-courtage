import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { getAllPostsMeta } from "../../lib/blog";

const SITE_URL = "https://lokt.fr";

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; gradient: string }> = {
  "Capacité d'emprunt":    { color: "text-[#635bff]", bg: "bg-[#635bff]/10",  gradient: "from-[#635bff]/40 via-[#635bff]/20 to-[#007ba7]/10" },
  "Investissement locatif":{ color: "text-emerald-700", bg: "bg-emerald-50",   gradient: "from-emerald-600/40 via-emerald-500/15 to-transparent" },
  "Plus-value immobilière":{ color: "text-amber-700",   bg: "bg-amber-50",     gradient: "from-amber-600/40 via-amber-400/15 to-transparent" },
  "Achat immobilier":      { color: "text-sky-700",     bg: "bg-sky-50",       gradient: "from-sky-600/40 via-sky-400/15 to-transparent" },
  "Crédit immobilier":     { color: "text-indigo-700",  bg: "bg-indigo-50",    gradient: "from-indigo-600/40 via-indigo-400/15 to-transparent" },
};
const DEFAULT_CAT = { color: "text-[#635bff]", bg: "bg-[#635bff]/10", gradient: "from-[#635bff]/30 via-[#007ba7]/15 to-[#00a97b]/10" };

function getCat(category?: string) {
  return (category && CATEGORY_CONFIG[category]) || DEFAULT_CAT;
}

function formatDateFR(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "long", day: "2-digit" }).format(d);
}

export default function BlogIndex({ posts }: any) {
  const pageUrl = `${SITE_URL}/blog`;
  const title = "Blog immobilier — guides & simulateurs | lokt.fr";
  const description =
    "Guides actionnables sur le crédit immobilier, l'investissement locatif et la fiscalité — avec des liens directs vers les simulateurs lokt.";
  const ogImage = `${SITE_URL}/logo-transparent-Lokt.jpg`;

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Blog", name: "Blog lokt.fr", url: pageUrl, description, inLanguage: "fr-FR", publisher: { "@type": "Organization", name: "lokt.fr", url: SITE_URL } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: pageUrl },
    ]},
  ];

  const [featured, ...rest] = posts;

  return (
    <>
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
        {jsonLd.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}
      </Head>

      <div className="bg-[#f6f9fc]">
        {/* ── HERO ── */}
        <section
          className="relative overflow-hidden border-b border-slate-200 px-6 py-12 sm:px-10 sm:py-16"
          style={{ backgroundImage: "url('/blog/background-image.PNG')", backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-white/80 backdrop-blur-[2px]" />
          <div aria-hidden className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#635bff]/30 to-transparent" />

          <div className="relative mx-auto max-w-6xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#635bff]/8 px-3 py-1 text-[0.72rem] font-semibold text-[#635bff] ring-1 ring-[#635bff]/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#635bff]" />
              Blog &amp; Guides immobilier
            </div>

            <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Comprendre l&apos;immobilier,{" "}
              <span className="bg-gradient-to-r from-[#635bff] to-[#00b4d8] bg-clip-text text-transparent">
                décider mieux.
              </span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
              Guides actionnables sur le crédit, l&apos;investissement locatif et la fiscalité — avec des liens directs vers les simulateurs lokt.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/calculettes" className="inline-flex items-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
                Voir les simulateurs →
              </Link>
              <Link href="/guides" className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Guides pratiques
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {[
                { label: "Articles", value: posts.length },
                { label: "Simulateurs", value: "6" },
                { label: "Lecture moy.", value: `${Math.round(posts.reduce((s: number, p: any) => s + (p.readingTime || 5), 0) / Math.max(posts.length, 1))} min` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">{s.label}</p>
                  <p className="mt-0.5 text-xl font-semibold text-slate-900">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          {/* ── ARTICLE À LA UNE ── */}
          {featured && (
            <section>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">À la une</p>
              <Link href={`/blog/${featured.slug}`} className="group mt-3 flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:shadow-xl sm:flex-row">
                {/* Image / placeholder */}
                <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden sm:aspect-auto sm:w-[44%]">
                  {featured.frontmatter.coverImage ? (
                    <Image
                      src={featured.frontmatter.coverImage}
                      alt={featured.frontmatter.title}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${getCat(featured.frontmatter.category).gradient}`}>
                      <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <svg viewBox="0 0 64 64" className="h-32 w-32 fill-current text-white"><path d="M32 2 L2 30 H12 V62 H26 V44 H38 V62 H52 V30 H62 Z"/></svg>
                      </div>
                    </div>
                  )}
                </div>
                {/* Content */}
                <div className="flex flex-col justify-center p-7 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    {featured.frontmatter.category && (
                      <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${getCat(featured.frontmatter.category).bg} ${getCat(featured.frontmatter.category).color}`}>
                        {featured.frontmatter.category}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{featured.readingTime} min de lecture</span>
                    {featured.frontmatter.date && <span className="text-xs text-slate-400">{formatDateFR(featured.frontmatter.date)}</span>}
                  </div>
                  <h2 className="mt-3 text-xl font-semibold leading-snug text-slate-900 group-hover:text-[#635bff] sm:text-2xl">
                    {featured.frontmatter.title}
                  </h2>
                  {featured.frontmatter.description && (
                    <p className="mt-2.5 text-sm leading-6 text-slate-500 line-clamp-3">{featured.frontmatter.description}</p>
                  )}
                  <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#635bff]">
                    Lire l&apos;article
                    <svg className="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </div>
                </div>
              </Link>
            </section>
          )}

          {/* ── GRILLE D'ARTICLES ── */}
          {rest.length > 0 && (
            <section className="mt-10">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Tous les articles</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p: any) => {
                  const cat = getCat(p.frontmatter.category);
                  return (
                    <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                      {/* Thumbnail */}
                      <div className="relative aspect-[16/9] w-full overflow-hidden">
                        {p.frontmatter.coverImage ? (
                          <Image
                            src={p.frontmatter.coverImage}
                            alt={p.frontmatter.title}
                            fill
                            className="object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className={`h-full w-full bg-gradient-to-br ${cat.gradient}`}>
                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                              <svg viewBox="0 0 64 64" className="h-16 w-16 fill-current text-white"><path d="M32 2 L2 30 H12 V62 H26 V44 H38 V62 H52 V30 H62 Z"/></svg>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Body */}
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          {p.frontmatter.category && (
                            <span className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold ${cat.bg} ${cat.color}`}>
                              {p.frontmatter.category}
                            </span>
                          )}
                          <span className="text-[0.7rem] text-slate-400">{p.readingTime} min</span>
                        </div>
                        <p className="mt-2.5 font-semibold leading-snug text-slate-900 group-hover:text-[#635bff]">
                          {p.frontmatter.title}
                        </p>
                        {p.frontmatter.description && (
                          <p className="mt-1.5 text-[0.78rem] leading-5 text-slate-500 line-clamp-2">
                            {p.frontmatter.description}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between pt-4">
                          <span className="text-[0.7rem] text-slate-400">{formatDateFR(p.frontmatter.date)}</span>
                          <span className="text-[0.78rem] font-semibold text-[#635bff]">Lire →</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── CTA SIMULATEURS ── */}
          <section className="mt-12 rounded-[1.5rem] border border-[#635bff]/20 bg-gradient-to-r from-[#635bff]/8 to-[#00b4d8]/8 p-7 sm:p-8">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Passez à l&apos;action</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900 sm:text-xl">
              Les simulateurs lokt pour chiffrer votre projet
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { href: "/capacite",                     label: "Capacité d'emprunt" },
                { href: "/investissement",               label: "Rentabilité locative" },
                { href: "/pret-relais",                  label: "Prêt relais" },
                { href: "/plus-value-vente-immobiliere", label: "Plus-value" },
                { href: "/acheter-ou-louer",             label: "Acheter ou louer ?" },
                { href: "/parc-immobilier",              label: "Parc immobilier" },
              ].map((c) => (
                <Link key={c.href} href={c.href} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#635bff]/40 hover:text-[#635bff]">
                  {c.label}
                  <span className="text-slate-400">→</span>
                </Link>
              ))}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export async function getStaticProps() {
  const posts = getAllPostsMeta();
  const sorted = [...posts].sort((a: any, b: any) => {
    const da = new Date(a?.frontmatter?.date || 0).getTime();
    const db = new Date(b?.frontmatter?.date || 0).getTime();
    return db - da;
  });
  return { props: { posts: sorted } };
}
