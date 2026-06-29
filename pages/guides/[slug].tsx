import Head from "next/head";
import Link from "next/link";
import type { GetStaticPaths, GetStaticProps } from "next";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import AppFooter from "../../components/AppFooter";
import AppHeader from "../../components/AppHeader";
import { GUIDE_CATEGORIES, GUIDES, getGuideBySlug, type GuideArticle } from "../../lib/guides";

type Props = { guide: GuideArticle };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

// Articles blog liés par guide (anti-cannibalisation + maillage)
const GUIDE_BLOG_LINKS: Record<string, Array<{ label: string; href: string }>> = {
  "choisir-bail-vide-meuble-mobilite": [
    { label: "Bail meublé vs bail vide : comparatif complet avec chiffres", href: "/blog/bail-meuble-vs-bail-vide" },
    { label: "IRL 2026 : calcul et révision annuelle du loyer", href: "/blog/irl-indice-reference-loyers-2026" },
  ],
  "lmnp-checklist-location-meublee": [
    { label: "Charges déductibles en LMNP réel 2026 : liste complète et amortissements", href: "/blog/charges-deductibles-lmnp-regime-reel" },
    { label: "LMNP ou location nue : quelle fiscalité choisir en 2026 ?", href: "/blog/lmnp-vs-location-nue" },
  ],
  "checklist-mise-en-location": [
    { label: "GLI 2026 : assurance loyers impayés — fonctionnement, coût et comparatif", href: "/blog/assurance-loyers-impayes-gli-2026" },
    { label: "Investir dans le locatif : guide complet 2026", href: "/blog/investissement-locatif" },
  ],
  "travaux-reparations-bailleur-locataire": [
    { label: "Loyer impayé : que faire étape par étape en 2026 ?", href: "/blog/loyer-impaye-que-faire" },
    { label: "GLI 2026 : assurance loyers impayés — protection du bailleur", href: "/blog/assurance-loyers-impayes-gli-2026" },
  ],
  "depart-locataire-etat-des-lieux-sortie": [
    { label: "IRL 2026 : calcul et révision annuelle du loyer", href: "/blog/irl-indice-reference-loyers-2026" },
  ],
  "depot-garantie-restitution-retenues": [
    { label: "Loyer impayé : que faire étape par étape en 2026 ?", href: "/blog/loyer-impaye-que-faire" },
  ],
  "dpe-diagnostics-location": [
    { label: "Investir dans le locatif : guide complet 2026", href: "/blog/investissement-locatif" },
  ],
  "choisir-son-locataire": [
    { label: "GLI 2026 : assurance loyers impayés — fonctionnement, coût et comparatif", href: "/blog/assurance-loyers-impayes-gli-2026" },
    { label: "Loyer impayé : que faire étape par étape en 2026 ?", href: "/blog/loyer-impaye-que-faire" },
  ],
  "arrivee-locataire-remise-cles": [
    { label: "Assurance habitation locataire : obligations et recours du bailleur", href: "/blog/assurance-habitation-locataire" },
  ],
};

export default function GuideArticlePage({ guide }: Props) {
  const category = GUIDE_CATEGORIES.find((row) => row.key === guide.category);
  const pageUrl = `https://lokt.fr/guides/${guide.slug}`;
  const metaTitle = `${guide.title} | lokt.fr`;
  const related = GUIDES.filter((row) => row.category === guide.category && row.slug !== guide.slug).slice(0, 3);
  const blogLinks = GUIDE_BLOG_LINKS[guide.slug] ?? [];

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-slate-950">
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={guide.description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "HowTo",
              name: guide.title,
              description: guide.description,
              dateModified: guide.updatedAt,
              mainEntityOfPage: pageUrl,
              step: guide.sections.map((s, i) => ({
                "@type": "HowToStep",
                position: i + 1,
                name: s.title,
                text: s.paragraphs?.[0] ?? s.bullets?.[0] ?? "",
              })),
              author: { "@type": "Organization", name: "lokt.fr" },
            }),
          }}
        />
      </Head>
      <AppHeader staticMode />

      {/* ── Hero ── */}
      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-700">
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Tous les guides
          </Link>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[0.72rem] font-semibold text-indigo-700">
              <BookOpenIcon className="h-3.5 w-3.5" />
              {category?.label ?? "Guide bailleur"}
            </span>
          </div>

          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
            {guide.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{guide.intro}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              Mis à jour le {formatDate(guide.updatedAt)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              {guide.sections.length} étapes
            </span>
            {guide.checklist && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                ✓ Checklist incluse ({guide.checklist.length} points)
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr),260px]">

        {/* ── Sections ── */}
        <article className="min-w-0 space-y-4">
          {guide.sections.map((section, i) => (
            <section
              key={section.title}
              id={`s${i}`}
              className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
            >
              {/* Section header */}
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-[0.7rem] font-bold text-white">
                  {i + 1}
                </span>
                <h2 className="text-base font-semibold leading-snug text-slate-950 sm:text-lg">{section.title}</h2>
              </div>

              {/* Content */}
              <div className="mt-4 space-y-3">
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-slate-700 sm:text-[0.95rem]">
                    {paragraph}
                  </p>
                ))}

                {section.bullets && (
                  <ul className="mt-1 space-y-2 pt-1">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5 text-sm leading-6 text-slate-700">
                        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.note && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-sm leading-6 text-amber-900">{section.note}</p>
                  </div>
                )}
              </div>
            </section>
          ))}

          {/* Checklist */}
          {guide.checklist && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-7">
              <div className="flex items-center gap-3">
                <ClipboardDocumentListIcon className="h-5 w-5 text-emerald-700" />
                <h2 className="text-base font-semibold text-emerald-950 sm:text-lg">Checklist opérationnelle</h2>
              </div>
              <p className="mt-1 text-sm text-emerald-800">Tous les points à valider avant de passer à l'étape suivante.</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {guide.checklist.map((item) => (
                  <li key={item} className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm leading-5 text-slate-700 shadow-sm">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Pour aller plus loin */}
          {blogLinks.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-base font-semibold text-slate-950 sm:text-lg">Pour aller plus loin</h2>
              <p className="mt-1 text-sm text-slate-500">Articles complémentaires pour approfondir ce sujet.</p>
              <ul className="mt-4 space-y-2">
                {blogLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                      <span>{link.label}</span>
                      <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Sources */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-base font-semibold text-slate-950 sm:text-lg">Sources officielles</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Les règles peuvent évoluer. Vérifiez votre situation sur les fiches à jour avant d'agir.
            </p>
            <ul className="mt-4 space-y-2">
              {guide.sources.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" />
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </article>

        {/* ── Sidebar ── */}
        <aside className="h-max space-y-4 lg:sticky lg:top-24">
          {/* Sommaire */}
          <nav className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-400">Sommaire</p>
            <ol className="mt-3 space-y-2">
              {guide.sections.map((s, i) => (
                <li key={i}>
                  <a
                    href={`#s${i}`}
                    className="flex items-start gap-2.5 text-sm leading-5 text-slate-600 transition hover:text-indigo-700"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.6rem] font-bold text-slate-500">
                      {i + 1}
                    </span>
                    <span>{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Guides de la même catégorie */}
          {related.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-400">Dans la même étape</p>
              <div className="mt-3 space-y-2">
                {related.map((row) => (
                  <Link
                    key={row.slug}
                    href={`/guides/${row.slug}`}
                    className="block rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-medium leading-5 text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {row.shortTitle} →
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA outil */}
          <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <DocumentTextIcon className="h-5 w-5 text-indigo-300" />
            <p className="mt-3 text-sm font-semibold">Du guide au dossier</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">
              Créez le bien, rattachez le bail, suivez les loyers et conservez vos documents.
            </p>
            <Link
              href="/outil-gestion-locative"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Voir l'outil bailleur
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
      </div>

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
