// pages/cautions-loyers.tsx
import Head from "next/head";
import Link from "next/link";
import {
  ArrowRightIcon,
  BanknotesIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/cautions-loyers`;
const title = "Caution, dépôt de garantie et suivi des loyers | lokt.fr";
const description =
  "Comprendre et suivre dépôt de garantie, loyers, retards, quittances, relances et restitution dans un dossier locatif clair pour propriétaire bailleur.";
const ogImage = `${siteUrl}/ESPACEBAILLEURSCREENSHOT.png`;

const cta = "/mon-compte?mode=register&redirect=/espace-bailleur";

const steps = [
  {
    title: "À l’entrée",
    text: "Notez le montant du dépôt de garantie, sa date d’encaissement, le bail concerné et les conditions prévues au contrat.",
    icon: ShieldCheckIcon,
  },
  {
    title: "Chaque mois",
    text: "Suivez le loyer attendu, les charges, le paiement reçu, les retards éventuels et la quittance générée après paiement complet.",
    icon: CalendarDaysIcon,
  },
  {
    title: "À la sortie",
    text: "Comparez l’état des lieux de sortie avec l’entrée, justifiez les retenues et archivez la restitution du dépôt.",
    icon: ClipboardDocumentCheckIcon,
  },
];

const checklist = [
  "Montant du dépôt de garantie distinct du loyer",
  "Date d’encaissement et bail concerné",
  "Loyer hors charges et charges séparés",
  "Paiement complet ou partiel qualifié",
  "Relance datée en cas de retard",
  "Quittance générée seulement après paiement complet",
  "État des lieux d’entrée et de sortie conservés",
  "Retenues justifiées par devis, facture ou constat",
];

const mistakes = [
  [
    "Confondre caution et dépôt de garantie",
    "Dans le langage courant on parle de caution, mais le dépôt de garantie est la somme versée par le locataire. La caution est plutôt la personne ou l’organisme qui se porte garant.",
  ],
  [
    "Générer une quittance trop tôt",
    "La quittance atteste un paiement complet. Si le locataire paie seulement une partie, il faut plutôt garder la trace du paiement partiel.",
  ],
  [
    "Perdre l’historique des relances",
    "En cas d’impayé, la date, le canal et le contenu de la relance doivent être conservés pour comprendre la chronologie.",
  ],
  [
    "Justifier une retenue trop vaguement",
    "Une retenue sur dépôt de garantie doit être reliée à l’état des lieux, à une dégradation imputable et à un justificatif exploitable.",
  ],
];

const faq = [
  {
    q: "Le dépôt de garantie est-il un loyer d’avance ?",
    a: "Non. Le dépôt de garantie sert à couvrir certaines sommes ou dégradations justifiées en fin de bail. Il doit être suivi séparément du loyer.",
  },
  {
    q: "Peut-on faire une quittance si le locataire a payé en partie ?",
    a: "Il vaut mieux éviter. Une quittance correspond à un paiement complet du loyer et des charges de la période. Un paiement partiel doit être suivi comme tel.",
  },
  {
    q: "Que suivre en cas de retard de loyer ?",
    a: "Il faut suivre le montant attendu, le montant reçu, la date d’échéance, la date de paiement, les relances, les réponses du locataire et les justificatifs éventuels.",
  },
  {
    q: "Comment préparer la restitution du dépôt de garantie ?",
    a: "Le bailleur doit comparer l’état de sortie avec l’état d’entrée, identifier les éventuelles retenues justifiables et conserver les devis, factures ou éléments de preuve.",
  },
];

function SeoHead() {
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: pageUrl,
      inLanguage: "fr-FR",
      isPartOf: { "@type": "WebSite", name: "lokt.fr", url: siteUrl },
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Caution, dépôt de garantie et suivi des loyers pour propriétaire bailleur",
      description,
      url: pageUrl,
      dateModified: "2026-06-07",
      author: { "@type": "Organization", name: "lokt.fr" },
      publisher: { "@type": "Organization", name: "lokt.fr", url: siteUrl },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "lokt.fr - Suivi loyers et dépôt de garantie",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${siteUrl}/outil-gestion-locative`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Caution et loyers", item: pageUrl },
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
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {schemas.map((schema, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
    </Head>
  );
}

export default function CautionsLoyersPage() {
  return (
    <div className="min-h-screen bg-[#f7fbfb] text-slate-950">
      <SeoHead />
      <AppHeader staticMode />

      <main>
        <section className="border-b border-cyan-100 bg-white px-4 py-8 sm:py-12">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr),420px] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
                <BanknotesIcon className="h-4 w-4" />
                Caution · loyers · retards
              </div>
              <h1 className="mt-5 max-w-4xl text-[2.35rem] font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-5xl">
                Suivre les loyers et le dépôt de garantie sans mélanger les sujets.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                Le dépôt de garantie, les loyers, les paiements partiels, les retards et les quittances ne répondent pas à la même logique.
                Une gestion propre consiste à les rattacher au bon bail, à la bonne période et au bon justificatif.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href={cta} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800">
                  Suivre mes loyers dans lokt.fr
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link href="/modele-quittance-loyer-pdf" className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-200 bg-white px-5 py-2.5 text-sm font-semibold text-cyan-900 hover:bg-cyan-50">
                  Lire le guide quittance
                </Link>
              </div>
            </div>

            <aside className="rounded-[1.75rem] border border-cyan-200 bg-cyan-50 p-3 shadow-sm">
              <div className="rounded-[1.35rem] border border-white/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-cyan-700">Dossier bail</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">Ce qu’il faut isoler</p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-700 text-white">
                    <DocumentTextIcon className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-4 grid gap-2">
                  {[
                    ["Dépôt encaissé", "Somme distincte du loyer"],
                    ["Loyer attendu", "Période, charges, échéance"],
                    ["Paiement reçu", "Complet, partiel ou manquant"],
                    ["Quittance", "PDF après paiement complet"],
                  ].map(([label, text]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{label}</p>
                      <p className="mt-0.5 text-xs text-slate-600">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-10">
          <section className="grid gap-4 md:grid-cols-3">
            {steps.map(({ title: itemTitle, text, icon: Icon }) => (
              <article key={itemTitle} className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-base font-semibold text-slate-950">{itemTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[320px,1fr]">
              <div className="bg-cyan-800 p-6 text-white">
                <CheckCircleIcon className="h-7 w-7 text-cyan-200" />
                <h2 className="mt-4 text-2xl font-semibold leading-tight">Checklist de suivi propriétaire</h2>
                <p className="mt-3 text-sm leading-6 text-cyan-50">
                  Le bon suivi sépare les flux financiers, les documents et les actions à faire.
                </p>
              </div>
              <div className="grid gap-2 p-5 sm:grid-cols-2 sm:p-6">
                {checklist.map((item) => (
                  <div key={item} className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Retards et relances</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Qualifier le retard avant d’agir</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Un retard peut venir d’un oubli, d’un virement en cours, d’un paiement partiel ou d’une difficulté réelle.
                Le suivi doit donc afficher la période concernée, le montant attendu, le montant reçu et l’historique des échanges.
              </p>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-2">
                  <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <p className="text-sm leading-6 text-amber-900">
                    Une relance utile reste factuelle : période, somme, échéance, moyen de paiement attendu et demande de retour.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">Restitution du dépôt</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Préparer la sortie dès l’entrée</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                La restitution se prépare avec l’état des lieux d’entrée, l’inventaire, les photos, les échanges et les justificatifs.
                Plus le dossier est clair, plus la décision de restitution ou de retenue est facile à expliquer.
              </p>
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex gap-2">
                  <BellAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <p className="text-sm leading-6 text-emerald-900">
                    Dans lokt.fr, l’objectif est de rattacher ces éléments au bail pour éviter de reconstruire le dossier au départ.
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Erreurs fréquentes</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Ce qui rend un dossier fragile</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Les problèmes apparaissent souvent lorsque les paiements, les documents et les échanges ne sont pas reliés au bon bail.
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
                { href: "/depot-garantie-location-meublee", cat: "Location meublée", title: "Dépôt de garantie en location meublée : restitution et retenues" },
                { href: "/guides/depart-locataire-etat-des-lieux-sortie", cat: "Fin de bail", title: "Départ du locataire et état des lieux de sortie" },
                { href: "/guides/depot-garantie-restitution-retenues", cat: "Fin de bail", title: "Restitution du dépôt de garantie : retenues possibles" },
              ].map((a) => (
                <a key={a.href} href={a.href} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-cyan-200 hover:bg-cyan-50">
                  <span className="text-[0.68rem] font-semibold text-cyan-600">{a.cat}</span>
                  <p className="mt-1 text-sm font-semibold leading-snug text-slate-900 group-hover:text-cyan-700">{a.title}</p>
                </a>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-cyan-200 bg-cyan-800 p-6 text-white shadow-sm sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr,360px] lg:items-center">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-200">Passer à l’action</p>
                <h2 className="mt-2 text-3xl font-semibold leading-tight">Centralisez loyers, quittances et dépôt dans le même dossier.</h2>
                <p className="mt-3 text-sm leading-6 text-cyan-50">
                  Cette page donne la méthode. L’espace bailleur vous aide à l’appliquer sur vos biens, vos baux, vos locataires et vos documents.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <Link href={cta} className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-cyan-900 hover:bg-cyan-50">
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
              {faq.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-950">
                    {item.q}
                    <span className="text-slate-400 transition group-open:rotate-180">▾</span>
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.a}</p>
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
