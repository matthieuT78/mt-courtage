// pages/etats-des-lieux-documents.tsx
import Head from "next/head";
import Link from "next/link";
import {
  ArrowRightIcon,
  CameraIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  HomeModernIcon,
  KeyIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/etats-des-lieux-documents`;
const title = "État des lieux gratuit : checklist, modèle et documents | lokt.fr";
const description =
  "Préparez un état des lieux d’entrée ou de sortie : checklist propriétaire, compteurs, clés, photos, inventaire, dépôt de garantie et dossier locatif.";
const cta = "/mon-compte?mode=register&redirect=/espace-bailleur%3Ftab%3Detat-des-lieux";
const login = "/mon-compte?mode=login&redirect=/espace-bailleur%3Ftab%3Detat-des-lieux";

const workflow = [
  {
    title: "Avant la visite",
    text: "Préparez le bail, le logement, l’inventaire éventuel, les compteurs et la liste des clés à remettre.",
    icon: ClipboardDocumentCheckIcon,
  },
  {
    title: "Pendant l’état des lieux",
    text: "Avancez pièce par pièce, notez les observations factuelles et ajoutez les réserves sans les mélanger aux échanges informels.",
    icon: PencilSquareIcon,
  },
  {
    title: "Après signature",
    text: "Conservez le document avec le bail, les photos, les échanges et les preuves utiles en cas de sortie ou de retenue.",
    icon: ShieldCheckIcon,
  },
];

const checklist = [
  "Identité bailleur, locataire et adresse complète",
  "Date, type d’état des lieux et contexte",
  "Relevés eau, électricité et gaz",
  "Nombre de clés, badges et télécommandes",
  "État des murs, sols, plafonds et menuiseries",
  "Équipements cuisine, salle d’eau et chauffage",
  "Mobilier obligatoire en location meublée",
  "Réserves, photos et signatures",
];

const mistakes = [
  ["Rester trop général", "“Bon état” ne suffit pas toujours. Une observation utile décrit la pièce, l’élément, l’état et la localisation."],
  ["Oublier les compteurs", "Les relevés évitent les discussions au moment de l’ouverture ou de la clôture des contrats d’énergie."],
  ["Mélanger dépôt et loyer", "Le dépôt de garantie se suit séparément du loyer et doit être justifié en cas de retenue."],
  ["Ne pas comparer entrée/sortie", "La sortie doit se lire avec l’état d’entrée, sinon les retenues deviennent difficiles à expliquer."],
];

const fieldPreview = [
  { label: "Compteurs relevés", icon: CheckCircleIcon },
  { label: "Clés et badges comptés", icon: KeyIcon },
  { label: "Photos des réserves", icon: CameraIcon },
  { label: "PDF prêt à archiver", icon: DocumentArrowDownIcon },
];

const faq = [
  [
    "Entrée ou sortie : est-ce le même document ?",
    "La structure est proche, mais la sortie sert surtout à comparer l’état avec l’entrée et à documenter les éventuelles retenues.",
  ],
  [
    "Pourquoi préparer l’état des lieux sur mobile ?",
    "Parce que l’état des lieux se fait sur place. Le mobile évite les notes séparées et réduit les oublis pendant la visite.",
  ],
  [
    "Faut-il signer l’état des lieux ?",
    "Oui, l’état des lieux doit être établi contradictoirement et signé par les parties ou leurs représentants.",
  ],
  [
    "Faut-il garder les documents locataire au même endroit ?",
    "Oui, le dossier locatif est plus simple à piloter si bail, état des lieux, inventaire et pièces utiles sont centralisés.",
  ],
];

function SeoHead() {
  const jsonLdItems = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      url: pageUrl,
      description,
      inLanguage: "fr-FR",
      isPartOf: { "@type": "WebSite", name: "lokt.fr", url: siteUrl },
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "État des lieux d’entrée et de sortie : checklist propriétaire",
      description,
      url: pageUrl,
      dateModified: "2026-06-07",
      author: { "@type": "Organization", name: "lokt.fr" },
      publisher: { "@type": "Organization", name: "lokt.fr", url: siteUrl },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Outil d’état des lieux lokt.fr",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${siteUrl}/outil-gestion-locative`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "Comment préparer un état des lieux",
      description,
      step: workflow.map((item, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: item.title,
        text: item.text,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "État des lieux", item: pageUrl },
      ],
    },
  ];

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={pageUrl} />
      <meta property="og:type" content="article" />
      <meta property="og:site_name" content="lokt.fr" />
      <meta property="og:locale" content="fr_FR" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={`${siteUrl}/ESPACEBAILLEURSCREENSHOT.png`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${siteUrl}/ESPACEBAILLEURSCREENSHOT.png`} />
      {jsonLdItems.map((schema, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
    </Head>
  );
}

export default function EtatsDesLieuxDocumentsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f3fbf7] text-slate-950">
      <SeoHead />
      <AppHeader staticMode />

      <main className="flex-1">
        <section className="border-b border-emerald-100 bg-white px-4 py-8 sm:py-12">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr),420px] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <DocumentTextIcon className="h-4 w-4" />
                État des lieux d’entrée et de sortie
              </div>
              <h1 className="mt-5 max-w-4xl text-[2.35rem] font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-5xl">
                Une checklist claire pour faire l’état des lieux sans oublier l’essentiel.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                L’état des lieux n’est pas un simple formulaire : c’est la pièce qui permet de comparer l’entrée et la sortie,
                de justifier les réserves, de suivre les clés, les compteurs, les équipements et les éventuelles retenues sur dépôt de garantie.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href={cta} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800">
                  Préparer mon état des lieux
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link href={login} className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  J’ai déjà un compte
                </Link>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
              <div className="rounded-[1.35rem] border border-white/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-emerald-700">Aperçu terrain</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">Entrée locataire</p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white">
                    <HomeModernIcon className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-4 grid gap-2">
                  {fieldPreview.map(({ label, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <Icon className="h-4 w-4 text-emerald-700" />
                      <span className="text-sm font-semibold text-slate-800">{label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">À vérifier avant signature</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Le document doit être daté, signé, cohérent avec le bail et suffisamment précis pour être relu plusieurs mois plus tard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-10">
          <section className="grid gap-4 md:grid-cols-3">
            {workflow.map(({ title: itemTitle, text, icon: Icon }) => (
              <article key={itemTitle} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-base font-semibold text-slate-950">{itemTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[320px,1fr]">
              <div className="bg-emerald-800 p-6 text-white">
                <DocumentTextIcon className="h-7 w-7 text-emerald-200" />
                <h2 className="mt-4 text-2xl font-semibold leading-tight">Ce qu’un état des lieux doit contenir</h2>
                <p className="mt-3 text-sm leading-6 text-emerald-50">
                  Le document doit permettre une comparaison objective entre l’entrée et la sortie. La précision compte plus que la longueur.
                </p>
              </div>
              <div className="grid gap-2 p-5 sm:grid-cols-2 sm:p-6">
                {checklist.map((item) => (
                  <div key={item} className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr,1fr]">
            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">Entrée dans les lieux</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Construire la preuve dès le premier jour</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                À l’entrée, le bailleur doit décrire l’état réel du logement, les équipements remis, les compteurs et les clés.
                Les photos sont utiles si elles sont rattachées aux bonnes observations et conservées dans le dossier du bail.
              </p>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-700">
                <li className="flex gap-2"><CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />Décrire les défauts existants pour éviter de les imputer au locataire sortant.</li>
                <li className="flex gap-2"><CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />Noter les équipements remis en location meublée avec l’inventaire.</li>
                <li className="flex gap-2"><CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />Conserver le document avec le bail et les annexes.</li>
              </ul>
            </article>

            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Sortie du locataire</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Comparer, justifier, restituer</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                À la sortie, le document sert à comparer l’état actuel avec l’état d’entrée. Les retenues éventuelles sur dépôt de garantie
                doivent être justifiées par des éléments concrets : constat, devis, facture ou preuve exploitable.
              </p>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-700">
                <li className="flex gap-2"><CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-cyan-700" />Reprendre les mêmes pièces et éléments qu’à l’entrée.</li>
                <li className="flex gap-2"><CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-cyan-700" />Distinguer usure normale, défaut déjà présent et dégradation nouvelle.</li>
                <li className="flex gap-2"><CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-cyan-700" />Rattacher la restitution du dépôt au dossier de sortie.</li>
              </ul>
            </article>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Erreurs fréquentes</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Ce qui crée les litiges plus tard</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  La plupart des désaccords viennent d’un document trop vague, incomplet ou impossible à relier au bail concerné.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {mistakes.map(([mistakeTitle, text]) => (
                  <div key={mistakeTitle} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-950">{mistakeTitle}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Guides pratiques</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { href: "/guides/arrivee-locataire-remise-cles", cat: "Entrée locataire", title: "Arrivée du locataire et remise des clés : checklist bailleur" },
                { href: "/guides/dpe-diagnostics-location", cat: "Diagnostics", title: "DPE et diagnostics locatifs : le dossier à remettre au locataire" },
                { href: "/guides/depart-locataire-etat-des-lieux-sortie", cat: "Fin de bail", title: "Départ du locataire : état des lieux de sortie et restitution" },
              ].map((a) => (
                <a key={a.href} href={a.href} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-emerald-200 hover:bg-emerald-50">
                  <span className="text-[0.68rem] font-semibold text-emerald-600">{a.cat}</span>
                  <p className="mt-1 text-sm font-semibold leading-snug text-slate-900 group-hover:text-emerald-700">{a.title}</p>
                </a>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-emerald-200 bg-emerald-800 p-6 text-white shadow-sm sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr,360px] lg:items-center">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-emerald-200">Dans lokt.fr</p>
                <h2 className="mt-2 text-3xl font-semibold leading-tight">Préparez le dossier au même endroit que le bail.</h2>
                <p className="mt-3 text-sm leading-6 text-emerald-50">
                  L’objectif n’est pas d’avoir une page de conseils isolée : l’état des lieux doit vivre avec le bien, le locataire,
                  l’inventaire, les documents et l’historique du bail.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <Link href={cta} className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
                  Créer mon espace gratuit
                </Link>
                <Link href="/outil-gestion-locative" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                  Voir l’outil bailleur
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-2xl font-semibold text-slate-950">Questions fréquentes</h2>
            <div className="mt-4 grid gap-3">
              {faq.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-950">
                    {q}
                    <span className="text-slate-400 transition group-open:rotate-180">▾</span>
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
