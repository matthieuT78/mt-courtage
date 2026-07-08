import Head from "next/head";
import Link from "next/link";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  HomeModernIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import AppFooter from "./AppFooter";
import AppHeader from "./AppHeader";
import type { SeoLandingPage as SeoLandingPageData } from "../lib/seoLandingPages";

const siteUrl = "https://lokt.fr";
const ogImage = `${siteUrl}/espace-bailleur-lokt.png`;
const organization = {
  "@type": "Organization",
  name: "lokt.fr",
  url: siteUrl,
  logo: `${siteUrl}/android-chrome-512x512.png`,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function themeForSlug(slug: string) {
  if (slug.includes("lmnp") || slug.includes("meublee")) {
    return {
      page: "bg-[#f5fbf8]",
      strip: "bg-emerald-700",
      accentText: "text-emerald-700",
      accentBg: "bg-emerald-700 hover:bg-emerald-800",
      soft: "border-emerald-200 bg-emerald-50",
      ring: "ring-emerald-100",
    };
  }
  if (slug.includes("loyer") || slug.includes("impayes") || slug.includes("garantie")) {
    return {
      page: "bg-[#f8fafc]",
      strip: "bg-cyan-700",
      accentText: "text-cyan-700",
      accentBg: "bg-cyan-700 hover:bg-cyan-800",
      soft: "border-cyan-200 bg-cyan-50",
      ring: "ring-cyan-100",
    };
  }
  return {
    page: "bg-[#f7f7fb]",
    strip: "bg-indigo-700",
    accentText: "text-indigo-700",
    accentBg: "bg-indigo-700 hover:bg-indigo-800",
    soft: "border-indigo-200 bg-indigo-50",
    ring: "ring-indigo-100",
  };
}

export default function SeoLandingPage({ page }: { page: SeoLandingPageData }) {
  const pageUrl = `${siteUrl}/${page.slug}`;
  const heroBullets = page.sections.flatMap((section) => section.bullets || []).slice(0, 4);
  const theme = themeForSlug(page.slug);
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.title,
      headline: page.h1,
      description: page.description,
      url: pageUrl,
      inLanguage: "fr-FR",
      image: ogImage,
      dateModified: page.updatedAt,
      isPartOf: { "@type": "WebSite", name: "lokt.fr", url: siteUrl },
      publisher: organization,
      about: page.eyebrow,
      potentialAction: {
        "@type": "RegisterAction",
        target: `${siteUrl}/mon-compte?mode=register&redirect=/espace-bailleur`,
        name: page.primaryCta,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.h1,
      name: page.title,
      description: page.description,
      url: pageUrl,
      inLanguage: "fr-FR",
      image: ogImage,
      datePublished: page.updatedAt,
      dateModified: page.updatedAt,
      author: organization,
      publisher: organization,
      mainEntityOfPage: pageUrl,
      articleSection: page.eyebrow,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "lokt.fr",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${siteUrl}/outil-gestion-locative`,
      description: "Espace bailleur pour suivre baux, loyers, quittances, documents, alertes et dossiers locatifs.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      provider: organization,
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: page.h1,
      description: page.description,
      inLanguage: "fr-FR",
      totalTime: "PT10M",
      step: page.sections.slice(0, 6).map((section, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: section.title.replace(/^\d+\.\s*/, ""),
        text: section.body.join(" "),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
        { "@type": "ListItem", position: 2, name: page.title, item: pageUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: "fr-FR",
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];

  return (
    <div className={`min-h-screen ${theme.page} text-slate-950`}>
      <Head>
        <title>{page.metaTitle}</title>
        <meta name="description" content={page.description} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={pageUrl} />
        <link rel="alternate" hrefLang="fr-FR" href={pageUrl} />
        <link rel="alternate" hrefLang="x-default" href={pageUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={page.metaTitle} />
        <meta property="og:description" content={page.description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="article:modified_time" content={page.updatedAt} />
        <meta property="article:section" content={page.eyebrow} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={page.metaTitle} />
        <meta name="twitter:description" content={page.description} />
        <meta name="twitter:image" content={ogImage} />
        {schemas.map((schema, index) => (
          <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        ))}
      </Head>

      <AppHeader staticMode />

      <main>
        <section className="border-b border-slate-200 bg-white px-4 py-6 sm:py-8">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr),380px] lg:items-start">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
              <div className={`absolute inset-y-0 left-0 w-2 ${theme.strip}`} aria-hidden />
              <div className="p-6 sm:p-8 lg:p-10">
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.72rem] font-semibold ${theme.soft} ${theme.accentText}`}>
                  <BookOpenIcon className="h-4 w-4" />
                  Ressource bailleur · {page.eyebrow}
                </div>
                <h1 className="mt-5 max-w-4xl text-[2.35rem] font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-5xl">
                  {page.h1}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">{page.intro}</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/mon-compte?mode=register&redirect=/espace-bailleur"
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm ${theme.accentBg}`}
                  >
                    {page.primaryCta}
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                  {page.secondaryCta ? (
                    <Link
                      href={page.secondaryCta.href}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      {page.secondaryCta.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <aside className={`relative overflow-hidden rounded-[1.5rem] border bg-white p-4 shadow-sm ring-4 sm:p-5 ${theme.ring} ${theme.soft}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Fiche pratique</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{page.intent}</p>
                </div>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${theme.strip} text-white`}>
                  <DocumentTextIcon className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { label: "Mise à jour", value: formatDate(page.updatedAt), icon: CheckCircleIcon },
                  { label: "Format", value: "Guide + FAQ", icon: BookOpenIcon },
                  { label: "Usage", value: "Propriétaire bailleur", icon: UserGroupIcon },
                  { label: "Action", value: "Suivi dans lokt.fr", icon: HomeModernIcon },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-white/70 bg-white px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${theme.accentText}`} />
                      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-950">{value}</p>
                  </div>
                ))}
              </div>

              {heroBullets.length ? (
                <div className="mt-4 rounded-xl border border-white/70 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-950">À traiter dans le dossier</p>
                  <div className="mt-2 grid gap-1.5">
                    {heroBullets.map((item) => (
                      <div key={item} className="flex gap-2 text-xs leading-5 text-slate-600">
                        <CheckCircleIcon className={`mt-0.5 h-4 w-4 shrink-0 ${theme.accentText}`} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="px-4 py-8 sm:py-10">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr),320px]">
            <article className="space-y-5">
              {page.sections.map((section) => (
                <section key={section.title} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
                  <div className="grid gap-0 lg:grid-cols-[240px,1fr]">
                    <div className={`${theme.strip} p-5 text-white sm:p-6`}>
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                        <ClipboardDocumentCheckIcon className="h-6 w-6" />
                      </span>
                      <h2 className="mt-4 text-xl font-semibold leading-tight">{section.title}</h2>
                    </div>
                    <div className="p-5 sm:p-6">
                      <div className="space-y-3">
                        {section.body.map((paragraph) => (
                          <p key={paragraph} className="text-[0.95rem] leading-7 text-slate-700">
                            {paragraph}
                          </p>
                        ))}
                      </div>
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
                    </div>
                  </div>
                </section>
              ))}

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
                <h2 className="text-2xl font-semibold text-slate-950">Questions fréquentes</h2>
                <div className="mt-4 grid gap-3">
                  {page.faq.map((item) => (
                    <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-950">
                        {item.q}
                        <span className="text-slate-400 transition group-open:rotate-180">▾</span>
                      </summary>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            </article>

            <aside className="h-max space-y-4 lg:sticky lg:top-24">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ressources liées</p>
                <div className="mt-4 space-y-3">
                  {page.links.map((link) => (
                    link.href.startsWith("http") ? (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-indigo-200 hover:bg-indigo-50"
                      >
                        <span className="text-sm font-semibold text-slate-950">{link.label} ↗</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600">{link.text}</span>
                      </a>
                    ) : (
                      <Link key={link.href} href={link.href} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-indigo-200 hover:bg-indigo-50">
                        <span className="text-sm font-semibold text-slate-950">{link.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600">{link.text}</span>
                      </Link>
                    )
                  ))}
                </div>
              </div>

              <div className={`rounded-[1.5rem] border p-5 text-white shadow-sm ${theme.strip}`}>
                <DocumentTextIcon className="h-6 w-6 text-cyan-300" />
                <p className="mt-3 text-sm font-semibold">Vous gérez déjà un logement ?</p>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Créez le bien, rattachez le bail, suivez les loyers et conservez les documents utiles dans l’espace bailleur.
                </p>
                <Link
                  href="/outil-gestion-locative"
                  className="mt-4 inline-flex w-full justify-center rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
                >
                  Voir l’outil
                </Link>
              </div>
            </aside>
          </div>
        </section>

        <section className="bg-[#edf7f8] px-4 py-12 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[1fr,360px] lg:items-center">
            <div>
              <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${theme.accentText}`}>Passer à l’action</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-slate-950">Centralisez le sujet dans votre espace bailleur.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Le contenu explique la méthode. L’espace bailleur vous aide à l’appliquer sur vos biens, vos baux, vos locataires et vos documents.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Link href="/mon-compte?mode=register&redirect=/espace-bailleur" className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white ${theme.accentBg}`}>
                Créer mon espace gratuit
              </Link>
              <Link href="/outil-gestion-locative" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                Voir l’outil bailleur
              </Link>
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
