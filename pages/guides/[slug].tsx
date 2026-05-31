import Head from "next/head";
import Link from "next/link";
import type { GetStaticPaths, GetStaticProps } from "next";
import AppFooter from "../../components/AppFooter";
import AppHeader from "../../components/AppHeader";
import { GUIDE_CATEGORIES, GUIDES, getGuideBySlug, type GuideArticle } from "../../lib/guides";

type Props = { guide: GuideArticle };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

export default function GuideArticlePage({ guide }: Props) {
  const category = GUIDE_CATEGORIES.find((row) => row.key === guide.category);
  const pageUrl = `https://lokt.fr/guides/${guide.slug}`;
  const title = `${guide.title} | lokt.fr`;

  return (
    <div className="min-h-screen bg-[#f6f9fc]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={guide.description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: guide.title,
              description: guide.description,
              dateModified: guide.updatedAt,
              mainEntityOfPage: pageUrl,
              author: { "@type": "Organization", name: "lokt.fr" },
              publisher: { "@type": "Organization", name: "lokt.fr" },
            }),
          }}
        />
      </Head>
      <AppHeader />

      <main>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <Link href="/guides" className="text-sm font-semibold text-indigo-700 hover:underline">
            ← Tous les guides
          </Link>

          <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr),270px]">
            <article className="min-w-0">
              <header className="border-b border-slate-200 pb-6">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-indigo-700">{category?.label}</p>
                <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">{guide.title}</h1>
                <p className="mt-4 text-base leading-7 text-slate-600">{guide.intro}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                  <span>Mis à jour le {formatDate(guide.updatedAt)}</span>
                </div>
              </header>

              <div className="mt-7 space-y-8">
                {guide.sections.map((section) => (
                  <section key={section.title}>
                    <h2 className="text-xl font-semibold text-slate-950">{section.title}</h2>
                    {section.paragraphs?.map((paragraph) => (
                      <p key={paragraph} className="mt-3 text-[0.95rem] leading-7 text-slate-700">
                        {paragraph}
                      </p>
                    ))}
                    {section.bullets ? (
                      <ul className="mt-3 space-y-2">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2 text-[0.95rem] leading-6 text-slate-700">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {section.note ? <p className="mt-4 border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{section.note}</p> : null}
                  </section>
                ))}
              </div>

              {guide.checklist ? (
                <section className="mt-9 border-y border-slate-200 bg-white px-5 py-5">
                  <h2 className="text-lg font-semibold text-slate-950">Checklist opérationnelle</h2>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {guide.checklist.map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                        <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center border border-slate-300 text-[0.6rem] text-slate-400">✓</span>
                        {item}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="mt-8">
                <h2 className="text-lg font-semibold text-slate-950">Sources officielles et ressources utiles</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Les règles peuvent évoluer et certaines dépendent du logement ou de la commune. Consultez les fiches à jour avant d’agir.
                </p>
                <ul className="mt-3 space-y-2">
                  {guide.sources.map((source) => (
                    <li key={source.href}>
                      <a href={source.href} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-700 hover:underline">
                        {source.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </article>

            <aside className="h-max border-t-4 border-slate-950 bg-white p-4 shadow-sm lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Continuer à lire</p>
              <div className="mt-3 space-y-3">
                {GUIDES.filter((row) => row.category === guide.category && row.slug !== guide.slug)
                  .slice(0, 3)
                  .map((row) => (
                    <Link key={row.slug} href={`/guides/${row.slug}`} className="block text-sm font-semibold leading-5 text-slate-800 hover:text-indigo-700">
                      {row.shortTitle} →
                    </Link>
                  ))}
              </div>
              <Link href="/outil-gestion-locative" className="mt-5 inline-flex w-full justify-center bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                Découvrir l’outil bailleur
              </Link>
            </aside>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: GUIDES.map((guide) => ({ params: { slug: guide.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const guide = getGuideBySlug(String(context.params?.slug || ""));
  if (!guide) return { notFound: true };
  return { props: { guide } };
};
