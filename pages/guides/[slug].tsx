import Head from "next/head";
import Link from "next/link";
import type { GetStaticPaths, GetStaticProps } from "next";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
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
  const related = GUIDES.filter((row) => row.category === guide.category && row.slug !== guide.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-slate-950">
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
        <section className="border-b border-slate-200 bg-white px-4 py-6 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <Link href="/guides" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
              <ArrowLeftIcon className="h-4 w-4" />
              Tous les guides
            </Link>

            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr),340px] lg:items-start">
              <header className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                <div className="absolute inset-y-0 left-0 w-2 bg-indigo-700" aria-hidden />
                <div className="p-6 sm:p-8 lg:p-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[0.72rem] font-semibold text-indigo-700">
                    <BookOpenIcon className="h-4 w-4" />
                    {category?.label || "Guide bailleur"}
                  </div>
                  <h1 className="mt-5 max-w-4xl text-[2.25rem] font-semibold leading-[1.04] tracking-tight text-slate-950 sm:text-5xl">{guide.title}</h1>
                  <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">{guide.intro}</p>
                  <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Mis à jour le {formatDate(guide.updatedAt)}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">{guide.sections.length} étapes</span>
                    {guide.checklist ? <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">{guide.checklist.length} points de contrôle</span> : null}
                  </div>
                </div>
              </header>

              <aside className="rounded-[1.5rem] border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
                <DocumentTextIcon className="h-7 w-7 text-indigo-700" />
                <p className="mt-3 text-sm font-semibold text-slate-950">À quoi sert ce guide ?</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{guide.description}</p>
                <Link href="/mon-compte?mode=register&redirect=/espace-bailleur" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800">
                  Créer mon dossier bailleur
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </aside>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr),320px]">
          <article className="min-w-0 space-y-5">
            {guide.sections.map((section) => (
              <section key={section.title} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
                <div className="grid gap-0 lg:grid-cols-[230px,1fr]">
                  <div className="bg-slate-950 p-5 text-white sm:p-6">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <ClipboardDocumentCheckIcon className="h-6 w-6" />
                    </span>
                    <h2 className="mt-4 text-xl font-semibold leading-tight">{section.title}</h2>
                  </div>
                  <div className="p-5 sm:p-6">
                    {section.paragraphs?.map((paragraph) => (
                      <p key={paragraph} className="mt-3 first:mt-0 text-[0.95rem] leading-7 text-slate-700">
                        {paragraph}
                      </p>
                    ))}
                    {section.bullets ? (
                      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2 text-sm leading-6 text-slate-700">
                            <CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {section.note ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{section.note}</p> : null}
                  </div>
                </div>
              </section>
            ))}

              {guide.checklist ? (
                <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
                  <h2 className="text-xl font-semibold text-emerald-950">Checklist opérationnelle</h2>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {guide.checklist.map((item) => (
                      <div key={item} className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                        <CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                        {item}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
                <h2 className="text-xl font-semibold text-slate-950">Sources officielles et ressources utiles</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Les règles peuvent évoluer et certaines dépendent du logement ou de la commune. Consultez les fiches à jour avant d’agir.
                </p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {guide.sources.map((source) => (
                    <li key={source.href}>
                      <a href={source.href} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-indigo-700 hover:border-indigo-200 hover:bg-indigo-50">
                        {source.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
          </article>

          <aside className="h-max space-y-4 lg:sticky lg:top-24">
            {related.length ? (
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Continuer à lire</p>
                <div className="mt-4 space-y-3">
                  {related.map((row) => (
                    <Link key={row.slug} href={`/guides/${row.slug}`} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-5 text-slate-800 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                      {row.shortTitle} →
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-[1.5rem] border border-slate-950 bg-slate-950 p-5 text-white shadow-sm">
              <DocumentTextIcon className="h-6 w-6 text-indigo-200" />
              <p className="mt-3 text-sm font-semibold">Passer du guide au dossier</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Créez le bien, rattachez le bail, suivez les loyers et conservez les documents utiles dans l’espace bailleur.
              </p>
              <Link href="/outil-gestion-locative" className="mt-4 inline-flex w-full justify-center rounded-full bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                Découvrir l’outil bailleur
              </Link>
            </div>
          </aside>
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
