import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { getAllPostsMeta } from "../../lib/blog";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";

const SITE_URL = "https://lokt.fr";

const CATEGORY_CONFIG: Record<string, { color: string; bg: string }> = {
  "Investissement locatif": { color: "text-emerald-700", bg: "bg-emerald-50" },
  "Gestion locative":       { color: "text-teal-700",    bg: "bg-teal-50" },
  "Fiscalité locative":     { color: "text-orange-700",  bg: "bg-orange-50" },
  "Plus-value immobilière": { color: "text-amber-700",   bg: "bg-amber-50" },
  "Crédit immobilier":      { color: "text-indigo-700",  bg: "bg-indigo-50" },
  "Achat immobilier":       { color: "text-sky-700",     bg: "bg-sky-50" },
  "Capacité d'emprunt":     { color: "text-[#635bff]",  bg: "bg-[#635bff]/10" },
};

const DEFAULT_CAT = { color: "text-[#635bff]", bg: "bg-[#635bff]/10" };

function getCat(category?: string) {
  return (category && CATEGORY_CONFIG[category]) || DEFAULT_CAT;
}

function formatDateFR(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

function formatMonthYearFR(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "long" }).format(d);
}

const FILTERS = ["Tous", "Investissement locatif", "Gestion locative", "Crédit immobilier", "Fiscalité locative", "Capacité d'emprunt"];

export default function BlogIndex({ posts }: any) {
  const [activeFilter, setActiveFilter] = useState("Tous");

  const latestUpdateDate = posts.reduce((latest: string, p: any) => {
    const d = p.frontmatter.updatedAt || p.frontmatter.date || "";
    return d > latest ? d : latest;
  }, "");

  const pageUrl = `${SITE_URL}/blog`;
  const title = "Blog immobilier 2026 : guides investissement, gestion locative et crédit | lokt.fr";
  const description =
    "Rendement locatif, LMNP, crédit immobilier, fiscalité 2026 — articles chiffrés avec simulateurs intégrés pour investir et gérer sans se tromper.";
  const ogImage = `${SITE_URL}/lokt-logo-transparent.jpg`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Blog lokt.fr — Guides immobilier",
      url: pageUrl,
      description,
      inLanguage: "fr-FR",
      publisher: { "@type": "Organization", name: "lokt.fr", url: SITE_URL },
      blogPost: posts.slice(0, 10).map((p: any) => ({
        "@type": "BlogPosting",
        headline: p.frontmatter.title,
        description: p.frontmatter.description,
        url: `${SITE_URL}/blog/${p.slug}`,
        datePublished: p.frontmatter.date,
        dateModified: p.frontmatter.updatedAt || p.frontmatter.date,
        image: p.frontmatter.coverImage ? `${SITE_URL}${p.frontmatter.coverImage}` : ogImage,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: pageUrl },
      ],
    },
  ];

  const [featured, ...rest] = posts;

  const filtered = activeFilter === "Tous"
    ? rest
    : rest.filter((p: any) => p.frontmatter.category === activeFilter);

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
        {jsonLd.map((s, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
        ))}
      </Head>

      <AppHeader />

      <div className="min-h-screen bg-[#f6f9fc]">

        {/* ── HERO ── */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-white px-6 py-12 sm:px-10 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-[#635bff]/5 to-transparent" />
          <div className="relative mx-auto max-w-6xl flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">

            {/* Texte gauche */}
            <div className="flex-1">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">
                Blog immobilier
              </p>
              <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
                Guides pratiques pour{" "}
                <span className="bg-gradient-to-r from-[#635bff] to-[#00b4d8] bg-clip-text text-transparent">
                  investir, gérer et optimiser
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
                Rendement locatif, LMNP, prêt relais, taux d&apos;endettement, fiscalité — des guides chiffrés avec simulateurs intégrés pour prendre les bonnes décisions.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/calculettes"
                  className="inline-flex items-center gap-2 rounded-full bg-[#635bff] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#635bff]/25 transition hover:bg-[#4f46e5]"
                >
                  Accéder aux simulateurs →
                </Link>
              </div>
            </div>

            {/* Stats droite */}
            <div className="grid grid-cols-2 gap-3 lg:w-72 shrink-0">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-2xl font-bold text-slate-900">{posts.length}</p>
                <p className="mt-0.5 text-xs text-slate-500">guides disponibles</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-2xl font-bold text-slate-900">6</p>
                <p className="mt-0.5 text-xs text-slate-500">simulateurs gratuits</p>
              </div>
              <div className="col-span-2 rounded-xl border border-[#635bff]/15 bg-[#635bff]/5 p-4">
                <p className="text-xs font-semibold text-[#635bff]">Mis à jour — {formatMonthYearFR(latestUpdateDate)}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Chiffres, barèmes et exemples actualisés pour l&apos;année en cours.</p>
              </div>
              <div className="col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-xs font-semibold text-emerald-700">100% gratuit</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Tous les guides et simulateurs sont accessibles sans inscription.</p>
              </div>
            </div>

          </div>
        </section>

        {/* ── CONTEXTE ÉDITORIAL ── */}
        <section className="border-b border-slate-100 bg-white px-6 pb-8 pt-2 sm:px-10">
          <div className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-emerald-700">Investissement locatif</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Rendement brut, net et net-net, cashflow, LMNP, effet de levier et zones tendues — les chiffres pour décider avant d'acheter.</p>
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-teal-700">Gestion locative</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Baux, quittances, révision IRL, charges récupérables, état des lieux et dépôt de garantie — les règles pratiques pour gérer sans litige.</p>
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-indigo-700">Crédit &amp; fiscalité</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Capacité d'emprunt, taux d'endettement, prêt relais, micro-foncier et régime réel — les leviers pour optimiser financement et imposition.</p>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

          {/* ── ARTICLE À LA UNE ── */}
          {featured && (
            <section aria-label="Article à la une">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">À la une</h2>
              <Link
                href={`/blog/${featured.slug}`}
                className="group mt-3 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-xl sm:flex-row"
              >
                <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden sm:aspect-auto sm:w-[44%]">
                  {featured.frontmatter.coverImage ? (
                    <Image
                      src={featured.frontmatter.coverImage}
                      alt={featured.frontmatter.title}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      priority
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[#635bff]/30 to-[#00b4d8]/20" />
                  )}
                </div>
                <div className="flex flex-col justify-center p-7 sm:p-10">
                  <div className="flex flex-wrap items-center gap-2">
                    {featured.frontmatter.category && (
                      <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${getCat(featured.frontmatter.category).bg} ${getCat(featured.frontmatter.category).color}`}>
                        {featured.frontmatter.category}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{featured.readingTime} min de lecture</span>
                    {featured.frontmatter.date && (
                      <span className="text-xs text-slate-400">{formatDateFR(featured.frontmatter.date)}</span>
                    )}
                  </div>
                  <h3 className="mt-3 text-xl font-bold leading-snug text-slate-900 group-hover:text-[#635bff] sm:text-2xl">
                    {featured.frontmatter.title}
                  </h3>
                  {featured.frontmatter.description && (
                    <p className="mt-2.5 text-sm leading-6 text-slate-500 line-clamp-3">
                      {featured.frontmatter.description}
                    </p>
                  )}
                  <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#635bff]">
                    Lire l&apos;article
                    <svg className="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </Link>
            </section>
          )}

          {/* ── FILTRES ── */}
          <section className="mt-10" aria-label="Filtrer par thème">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    activeFilter === f
                      ? "bg-[#635bff] text-white shadow-sm shadow-[#635bff]/30"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-[#635bff]/40 hover:text-[#635bff]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </section>

          {/* ── GRILLE D'ARTICLES ── */}
          <section className="mt-6" aria-label="Articles">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Aucun article dans cette catégorie pour le moment.</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p: any) => {
                  const cat = getCat(p.frontmatter.category);
                  return (
                    <Link
                      key={p.slug}
                      href={`/blog/${p.slug}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      {/* Image */}
                      <div className="relative aspect-[16/9] w-full overflow-hidden">
                        {p.frontmatter.coverImage ? (
                          <Image
                            src={p.frontmatter.coverImage}
                            alt={p.frontmatter.title}
                            fill
                            className="object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-[#635bff]/20 to-[#00b4d8]/10" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-center gap-2">
                          {p.frontmatter.category && (
                            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${cat.bg} ${cat.color}`}>
                              {p.frontmatter.category}
                            </span>
                          )}
                          <span className="text-[0.7rem] text-slate-400">{p.readingTime} min</span>
                        </div>
                        <p className="mt-2.5 font-semibold leading-snug text-slate-900 group-hover:text-[#635bff] line-clamp-2">
                          {p.frontmatter.title}
                        </p>
                        {p.frontmatter.description && (
                          <p className="mt-1.5 text-[0.78rem] leading-5 text-slate-500 line-clamp-2">
                            {p.frontmatter.description}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between pt-4">
                          <span className="text-[0.7rem] text-slate-400">{formatDateFR(p.frontmatter.date)}</span>
                          <span className="text-[0.78rem] font-semibold text-[#635bff] transition group-hover:translate-x-0.5">Lire →</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── CTA SIMULATEURS ── */}
          <section className="mt-14 rounded-2xl border border-[#635bff]/15 bg-gradient-to-r from-[#635bff]/6 to-[#00b4d8]/6 p-7 sm:p-8">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Passez à l&apos;action</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              Chiffrez votre projet avec nos simulateurs gratuits
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { href: "/capacite",                     label: "Capacité d'emprunt" },
                { href: "/investissement",               label: "Rentabilité locative" },
                { href: "/pret-relais",                  label: "Prêt relais" },
                { href: "/plus-value-vente-immobiliere", label: "Plus-value immobilière" },
                { href: "/acheter-ou-louer",             label: "Acheter ou louer ?" },
                { href: "/parc-immobilier",              label: "Gérer mon parc" },
              ].map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#635bff]/40 hover:text-[#635bff]"
                >
                  {c.label}
                  <span className="text-slate-400">→</span>
                </Link>
              ))}
            </div>
          </section>

        </main>
      </div>

      <AppFooter />
    </>
  );
}

const FEATURED_SLUG = "charges-locatives-recuperables";

export async function getStaticProps() {
  const posts = getAllPostsMeta();
  const sorted = [...posts].sort((a: any, b: any) => {
    const da = new Date(a?.frontmatter?.date || 0).getTime();
    const db = new Date(b?.frontmatter?.date || 0).getTime();
    return db - da;
  });
  const featuredIdx = sorted.findIndex((p: any) => p.slug === FEATURED_SLUG);
  if (featuredIdx > 0) {
    const [featured] = sorted.splice(featuredIdx, 1);
    sorted.unshift(featured);
  }
  return { props: { posts: sorted } };
}
