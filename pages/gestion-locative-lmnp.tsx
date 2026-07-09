import Head from "next/head";
import Link from "next/link";
import { useScrollReveal } from "../hooks/useScrollReveal";
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  HomeModernIcon,
  KeyIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/gestion-locative-lmnp`;
const ogImage = `${siteUrl}/espace-bailleur-lokt.png`;
const title = "Gestion locative LMNP gratuite 2026 : bail meublé, quittances PDF, inventaire | lokt.fr";
const description =
  "Gérez votre LMNP sans tableur : bail meublé, inventaire, quittances PDF, suivi des loyers et bilan financier propriétaire. Gratuit pour un logement actif, sans carte bancaire.";

const features = [
  {
    title: "Inventaire meublé",
    text: "Suivez mobilier, vaisselle, literie, électroménager et équipements utiles pour garder une preuve claire à l’entrée comme à la sortie.",
    icon: ArchiveBoxIcon,
  },
  {
    title: "Quittances et loyers",
    text: "Confirmez le paiement, générez le PDF, archivez la quittance et gardez une vision du loyer encaissé, incomplet ou manquant.",
    icon: DocumentTextIcon,
  },
  {
    title: "État des lieux mobile",
    text: "Préparez l’entrée ou la sortie directement sur place, pièce par pièce, avec un parcours pensé pour le téléphone.",
    icon: ClipboardDocumentCheckIcon,
  },
  {
    title: "Finance propriétaire",
    text: "Classez recettes, dépenses, charges, assurances et taxes pour mieux piloter votre résultat locatif.",
    icon: BanknotesIcon,
  },
];

const faq = [
  {
    q: "Qu'est-ce que la gestion LMNP ?",
    a: "La gestion LMNP (Loueur en Meublé Non Professionnel) désigne l'ensemble des tâches administratives et financières liées à une location meublée : suivi du bail, encaissement des loyers, émission des quittances, gestion de l'inventaire, états des lieux, et suivi des charges déductibles. Contrairement à la location vide, le LMNP implique un inventaire détaillé du mobilier et une comptabilité spécifique (micro-BIC ou régime réel).",
  },
  {
    q: "Quel logiciel pour gérer une location meublée LMNP ?",
    a: "lokt.fr est un logiciel de gestion locative LMNP gratuit pour un premier logement. Il regroupe bail numérique, inventaire meublé, état des lieux, suivi des loyers, quittances PDF automatiques et tableau de bord financier. Pensé pour les bailleurs particuliers en LMNP qui veulent éviter les tableurs dispersés et les outils trop complexes.",
  },
  {
    q: "Quel outil utiliser pour gérer une location meublée LMNP ?",
    a: "Un bailleur LMNP doit pouvoir suivre le bail, le locataire, les loyers, les quittances, l’inventaire du mobilier, les états des lieux, les charges et les justificatifs. lokt.fr regroupe ces éléments dans un espace bailleur pensé pour la gestion locative meublée.",
  },
  {
    q: "La gestion locative LMNP est-elle différente d’une location vide ?",
    a: "Oui. En LMNP, le bailleur doit notamment suivre le mobilier, conserver l’inventaire, classer les recettes et dépenses de location meublée, et garder des justificatifs utiles pour sa comptabilité ou sa déclaration.",
  },
  {
    q: "Peut-on suivre les loyers et quittances d’un meublé LMNP ?",
    a: "Oui. Le workflow permet de suivre le loyer attendu, confirmer le paiement, repérer un retard ou un paiement partiel, puis générer et archiver la quittance PDF quand la période est soldée.",
  },
  {
    q: "L’inventaire est-il important en location meublée ?",
    a: "Oui. L’inventaire permet de lister les meubles et équipements remis au locataire, de garder des preuves à l’entrée et de comparer l’état du logement lors de la sortie.",
  },
  {
    q: "lokt.fr remplace-t-il un expert-comptable LMNP ?",
    a: "Non. lokt.fr aide à organiser les informations, documents, loyers et charges. Pour un choix fiscal, une liasse ou une déclaration complexe, il faut vérifier avec un expert-comptable ou un professionnel compétent.",
  },
  {
    q: "Le plan gratuit suffit-il pour commencer ?",
    a: "Oui. Il permet de gérer un logement actif avec le bail, le locataire, les quittances manuelles, l’état des lieux, l’inventaire et une finance simple.",
  },
  {
    q: "Quelle est la durée d’un bail en location meublée LMNP ?",
    a: "La durée minimale d’un bail meublé à titre de résidence principale est d’un an, reconductible tacitement. Pour un étudiant, cette durée peut être réduite à 9 mois (bail étudiant), non reconductible. En bail mobilité, la durée varie de 1 à 10 mois, sans reconduction.",
  },
  {
    q: "Quelle est la différence entre LMNP et LMP ?",
    a: "Le LMNP (Loueur en Meublé Non Professionnel) s’applique quand les recettes locatives annuelles sont inférieures à 23 000 € ou représentent moins de 50 % des revenus du foyer fiscal. Au-delà de ces deux seuils simultanément, le bailleur bascule en LMP (Professionnel), ce qui entraîne des obligations comptables et sociales différentes.",
  },
  {
    q: "Micro-BIC ou régime réel en LMNP : lequel choisir ?",
    a: "Le micro-BIC s’applique automatiquement si les recettes restent sous 77 700 € (ou 15 000 € pour les meublés de tourisme classés). Il offre un abattement forfaitaire de 50 % mais ne permet pas de déduire les charges réelles ni d’amortir le bien. Le régime réel simplifié permet de déduire toutes les charges (intérêts, travaux, frais de gestion) et d’amortir le bien, ce qui peut annuler l’impôt sur plusieurs années. Il est souvent plus avantageux dès que les charges réelles dépassent 50 % des recettes.",
  },
  {
    q: "Quels meubles sont obligatoires en location meublée ?",
    a: "Le décret du 31 juillet 2015 liste le mobilier minimum obligatoire : literie avec couette, volets ou rideaux dans les chambres, plaques de cuisson, four ou micro-ondes, réfrigérateur, congélateur ou compartiment, vaisselle, ustensiles de cuisine, table et sièges, étagères, luminaires et matériel d’entretien ménager. L’absence d’un élément peut requalifier le bail en location vide.",
  },
  {
    q: "Que se passe-t-il en cas de départ du locataire d’un meublé ?",
    a: "Le préavis de départ est d’un mois pour le locataire d’un meublé (contre 3 mois en location vide). À la sortie, un état des lieux de sortie est obligatoire et doit être comparé à l’état des lieux d’entrée. Le dépôt de garantie doit être restitué dans un délai d’un mois (ou deux si des dégradations sont constatées), déduction faite des retenues justifiées.",
  },
  {
    q: "Comment gérer une location meublée LMNP au quotidien ?",
    a: "La gestion LMNP s’organise en trois axes : (1) l’opérationnel mensuel — confirmer le loyer, générer la quittance, signaler un retard ; (2) les preuves — inventaire détaillé du mobilier, états des lieux d’entrée et de sortie comparables, bail et avenants archivés ; (3) la comptabilité — classer les charges déductibles (travaux, assurances, intérêts), conserver les justificatifs et préparer les éléments pour la déclaration. Un outil de gestion locative LMNP comme lokt.fr centralise ces trois dimensions pour éviter les tableurs dispersés.",
  },
  {
    q: "Gestion LMNP vs gestion de location vide : quelles différences ?",
    a: "En location meublée LMNP, la gestion se distingue sur plusieurs points : l’inventaire du mobilier est obligatoire et doit être comparé à chaque sortie, le bail a une durée minimale d’un an (contre 3 ans en vide), le préavis du locataire est réduit à 1 mois, le dépôt de garantie est plafonné à 2 mois de loyer (contre 1 mois en vide), et la fiscalité relève du régime BIC (micro-BIC 50 % ou réel simplifié avec amortissement) plutôt que des revenus fonciers. Ces spécificités nécessitent un outil de gestion de location meublée adapté au suivi du mobilier, des quittances et des charges.",
  },
];

const jsonLdItems = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    headline: "Gestion locative LMNP pour location meublée",
    url: pageUrl,
    description,
    inLanguage: "fr-FR",
    image: ogImage,
    isPartOf: {
      "@type": "WebSite",
      name: "lokt.fr",
      url: siteUrl,
    },
    about: ["gestion locative LMNP", "gestion LMNP", "gestion de location meublée", "location meublée", "inventaire meublé", "quittances de loyer"],
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "lokt.fr - Gestion locative LMNP",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: pageUrl,
    image: ogImage,
    description,
    inLanguage: "fr-FR",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      description: "Gestion gratuite pour un logement actif.",
    },
    featureList: [
      "Gestion locative LMNP",
      "Inventaire location meublée",
      "Quittances PDF",
      "État des lieux mobile",
      "Suivi financier propriétaire",
      "Aide à la déclaration",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Gestion locative LMNP", item: pageUrl },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "fr-FR",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  },
];

function FeatureCard({ feature }: { feature: (typeof features)[number] }) {
  const Icon = feature.icon;
  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#635bff]/30 hover:shadow-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f6f9fc] text-[#635bff] ring-1 ring-slate-200">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-950">{feature.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
    </article>
  );
}

function LmnpStepCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="pointer-events-none absolute -right-5 -top-7 text-[7rem] font-semibold leading-none text-slate-100">
        {step}
      </div>
      <p className="relative text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">{step}</p>
      <h3 className="relative mt-3 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="relative mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

export default function GestionLocativeLmnpPage() {
  useScrollReveal();
  return (
    <div className="min-h-screen bg-[#f6f9fc] flex flex-col">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={pageUrl} />
        <link rel="alternate" hrefLang="fr-FR" href={pageUrl} />
        <link rel="alternate" hrefLang="x-default" href={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:alt" content="Gestion locative LMNP avec lokt.fr" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        {jsonLdItems.map((schema, index) => (
          <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        ))}
      </Head>

      <AppHeader staticMode />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-slate-200 bg-white px-4 pb-12 pt-10 sm:pb-16 sm:pt-14">
          {/* Ligne accent top */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#635bff]/60 to-transparent" />
          {/* Orbes statiques */}
          <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#635bff]/[0.08] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -right-24 top-16 h-[380px] w-[380px] rounded-full bg-[#00d4ff]/[0.06] blur-3xl" />
          <div className="relative mx-auto max-w-6xl">
            <div className="grid gap-7 sm:gap-10 lg:grid-cols-[0.95fr,1.05fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#635bff]/8 px-3 py-1 text-[0.72rem] font-semibold text-[#635bff] ring-1 ring-[#635bff]/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Location meublée et LMNP
                </div>
                <h1 className="mt-5 max-w-3xl font-semibold leading-[0.99] text-slate-950 sm:mt-6">
                  <span className="block text-[2.55rem] sm:text-6xl">Gestion locative LMNP.</span>
                  <span className="mt-1 block text-[2rem] bg-clip-text text-transparent bg-gradient-to-r from-[#635bff] to-[#00b4d8] sm:text-5xl">Le meublé sans tableur dispersé.</span>
                </h1>
                <p className="mt-5 max-w-xl text-[0.98rem] leading-7 text-slate-600 sm:mt-6 sm:text-lg">
                  Un outil pour gérer une location meublée LMNP : bail, locataire, inventaire, état des lieux, loyers, quittances, charges, documents et suivi financier.
                </p>
                <div className="mt-7 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap">
                  <Link
                    href="/mon-compte?mode=register&redirect=/espace-bailleur"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#635bff] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 hover:bg-[#4f46e5] sm:w-auto"
                  >
                    Créer mon espace bailleur gratuit →
                  </Link>
                  <Link
                    href="/outil-gestion-locative"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#3f37c9] hover:bg-slate-50 sm:w-auto"
                  >
                    Voir la page produit générale →
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-1.5 shadow-xl shadow-[#635bff]/10 sm:rounded-[2rem] sm:p-2 sm:shadow-2xl sm:shadow-[#635bff]/10">
                <div className="overflow-hidden rounded-[1.25rem] border border-white/60 bg-white sm:rounded-[1.55rem]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#ff5f57] sm:h-2.5 sm:w-2.5" />
                      <span className="h-2 w-2 rounded-full bg-[#ffbd2e] sm:h-2.5 sm:w-2.5" />
                      <span className="h-2 w-2 rounded-full bg-[#28c840] sm:h-2.5 sm:w-2.5" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[0.68rem] font-semibold text-slate-600">Dossier meublé</span>
                  </div>
                  <div className="p-3 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Dossier LMNP</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Un cockpit pensé pour le meublé</h2>
                        <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                          Bail, locataire, mobilier, loyers et pièces utiles restent reliés au même logement.
                        </p>
                      </div>
                      <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-[0.68rem] font-semibold text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex">
                        1 logement gratuit
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3">
                      {[
                        [KeyIcon, "Locataire en place", "Bail actif · dépôt 1 200 €"],
                        [ArchiveBoxIcon, "Inventaire LMNP", "34 éléments · 2 à remplacer"],
                        [EnvelopeIcon, "Quittance", "Paiement confirmé · PDF prêt"],
                        [BellAlertIcon, "Relance", "Loyer incomplet à traiter"],
                      ].map(([Icon, titleCard, textCard]) => {
                        const TypedIcon = Icon as typeof HomeModernIcon;
                        return (
                          <div key={String(titleCard)} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                            <div className="flex items-start gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#635bff] ring-1 ring-slate-200">
                                <TypedIcon className="h-5 w-5" />
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-slate-950">{String(titleCard)}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-600">{String(textCard)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-[1fr,0.9fr] sm:gap-3">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                        <div className="flex items-center gap-2">
                          <ChartBarSquareIcon className="h-5 w-5 text-emerald-700" />
                          <p className="text-sm font-semibold text-emerald-950">Résultat mensuel</p>
                        </div>
                        <div className="mt-3 space-y-2 text-xs text-emerald-900">
                          <div className="flex justify-between gap-3">
                            <span>Loyers encaissés</span>
                            <strong>2 480 €</strong>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Charges classées</span>
                            <strong>-640 €</strong>
                          </div>
                          <div className="flex justify-between gap-3 border-t border-emerald-200 pt-2">
                            <span>Solde net</span>
                            <strong>+1 840 €</strong>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 sm:p-4">
                        <div className="flex items-center gap-2">
                          <CalendarDaysIcon className="h-5 w-5 text-indigo-700" />
                          <p className="text-sm font-semibold text-indigo-950">À conserver</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["Bail", "EDL", "Inventaire", "Quittances", "Charges"].map((tag) => (
                            <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-indigo-900 ring-1 ring-indigo-100">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-10 pt-12 sm:pb-16 sm:pt-20">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="max-w-3xl pb-3">
              <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Location meublée</p>
              <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 font-semibold leading-tight text-slate-950">
                <span className="block text-3xl sm:text-4xl">Les preuves au bon endroit.</span>
                <span className="mt-1 block text-2xl text-cyan-600 sm:text-3xl">Le pilotage sans surcharge.</span>
              </h2>
            </div>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, i) => (
                <div key={feature.title} data-scroll-reveal data-reveal-delay={`${i * 80}`}>
                  <FeatureCard feature={feature} />
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
              <div className="grid gap-0 lg:grid-cols-[0.82fr,1.18fr]">
                <div className="p-5 sm:p-8">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Logiciel LMNP</p>
                  <h2 className="mt-2 font-semibold leading-tight text-slate-950">
                    <span className="block text-2xl sm:text-3xl">Un dossier complet par meublé.</span>
                    <span className="mt-1 block text-xl text-[#635bff] sm:text-2xl">Pas seulement une liste de loyers.</span>
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    La gestion locative LMNP demande plus qu’un suivi de paiement. Il faut conserver les documents du bail, suivre les loyers, produire les quittances, garder l’inventaire du mobilier, classer les charges et retrouver rapidement les preuves utiles en cas de départ du locataire.
                  </p>
                </div>
                <div className="grid gap-3 bg-slate-50 p-4 sm:p-8">
                  {[
                    ["01", "Créer le logement", "Adresse, type de location, bail, locataire et montants."],
                    ["02", "Suivre le mois", "Loyer attendu, paiement reçu, quittance et relance si besoin."],
                    ["03", "Préparer les preuves", "Inventaire, état des lieux, justificatifs et finance classée."],
                  ].map(([step, titleStep, textStep], i) => (
                    <div key={step} data-scroll-reveal data-reveal-delay={`${i * 80}`}>
                      <LmnpStepCard step={step} title={titleStep} text={textStep} />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr] lg:items-start">
                <div>
                  <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Méthode LMNP</p>
                  <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Que doit suivre un propriétaire LMNP ?
                  </h2>
                  <p data-scroll-reveal data-reveal-delay="200" className="mt-3 text-sm leading-6 text-slate-600">
                    Pour une location meublée, le risque n’est pas seulement d’oublier un loyer. C’est de perdre le lien entre le bail, le mobilier, les photos, les états des lieux, les quittances et les charges. Un bon outil de gestion locative LMNP doit donc relier l’opérationnel et les justificatifs.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Bail et locataire", "Type de bail, dates, dépôt de garantie, coordonnées et logement rattaché."],
                    ["Inventaire meublé", "Mobilier, équipements, photos, état et éléments à remplacer."],
                    ["Loyers et quittances", "Montant attendu, paiement reçu, retard, reçu partiel et quittance PDF."],
                    ["Charges et documents", "Factures, assurances, taxes, dépenses et pièces utiles pour la déclaration."],
                  ].map(([titleBlock, textBlock], i) => (
                    <div key={titleBlock} data-scroll-reveal data-reveal-delay={`${i * 80}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-950">{titleBlock}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{textBlock}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Section éditoriale A : Qu'est-ce que le LMNP ── */}
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8 space-y-5">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Comprendre le statut</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Qu'est-ce que le LMNP ?</h2>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Le statut de <strong>Loueur en Meublé Non Professionnel (LMNP)</strong> s'applique à toute personne physique qui met en location un logement meublé sans que cette activité constitue son activité principale. C'est l'un des statuts les plus répandus parmi les propriétaires bailleurs en France, notamment pour les studios en ville, les appartements proches d'universités ou les biens destinés à la location saisonnière.
              </p>
              <p className="text-sm leading-relaxed text-slate-600">
                Pour rester en LMNP, deux conditions doivent être respectées simultanément : les <strong>recettes locatives annuelles doivent être inférieures à 23 000 €</strong> ET elles doivent représenter <strong>moins de 50 % des revenus globaux du foyer fiscal</strong>. Si ces deux seuils sont dépassés en même temps, le bailleur passe en LMP (Loueur en Meublé Professionnel), avec des obligations comptables et sociales différentes.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                  <p className="text-sm font-semibold text-indigo-900">LMNP — Non Professionnel</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-indigo-800">
                    <li>→ Recettes &lt; 23 000 € / an</li>
                    <li>→ Recettes &lt; 50 % des revenus du foyer</li>
                    <li>→ Régimes fiscaux : micro-BIC ou réel simplifié</li>
                    <li>→ Pas de cotisations sociales sur les revenus</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">LMP — Professionnel</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-amber-800">
                    <li>→ Recettes ≥ 23 000 € ET ≥ 50 % des revenus</li>
                    <li>→ Inscription au registre du commerce (RCS)</li>
                    <li>→ Cotisations sociales obligatoires</li>
                    <li>→ Déficits imputables sur le revenu global</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* ── Section éditoriale B : Micro-BIC vs réel ── */}
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8 space-y-5">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Fiscalité LMNP</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Micro-BIC ou régime réel simplifié ?</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  C'est la question centrale de tout bailleur LMNP. Le choix du régime fiscal impacte directement le montant d'impôt payé chaque année. Il se fait au moment de la déclaration et peut être modifié annuellement.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200 text-left">
                      <th className="pb-3 pr-4 font-semibold text-slate-700 w-1/3"></th>
                      <th className="pb-3 pr-4 font-semibold text-indigo-700">Micro-BIC</th>
                      <th className="pb-3 font-semibold text-emerald-700">Réel simplifié</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-600">
                    {[
                      ["Plafond de recettes", "77 700 € / an", "Aucun plafond"],
                      ["Abattement forfaitaire", "50 % des recettes", "Aucun — charges réelles"],
                      ["Déduction des charges", "Non", "Oui (travaux, intérêts, frais…)"],
                      ["Amortissement du bien", "Non", "Oui — peut annuler l'impôt"],
                      ["Comptabilité", "Simplifiée", "Bilan comptable requis"],
                      ["Idéal si…", "Peu de charges réelles", "Charges > 50 % des recettes"],
                    ].map(([label, micro, reel]) => (
                      <tr key={String(label)} className="border-b border-slate-100">
                        <td className="py-2.5 pr-4 font-medium text-slate-800">{label}</td>
                        <td className="py-2.5 pr-4 text-indigo-700">{micro}</td>
                        <td className="py-2.5 text-emerald-700">{reel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-800">En pratique :</strong> le régime réel est souvent plus avantageux dès que vous avez un crédit immobilier en cours (intérêts déductibles), des travaux ou un bien récemment acquis (amortissement). L'amortissement comptable du bien (hors terrain) et du mobilier permet de créer un déficit fiscal qui s'impute sur les recettes locatives, réduisant l'imposition à zéro sur plusieurs années. Un expert-comptable spécialisé LMNP peut calculer l'option optimale pour votre situation.
              </div>
            </section>

            {/* ── Section éditoriale C : Obligations légales ── */}
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8 space-y-5">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Obligations légales</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Ce que la loi impose en location meublée</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  La location meublée est encadrée par des règles spécifiques qui diffèrent de la location vide. Les ignorer peut entraîner une requalification du bail ou des litiges au départ du locataire.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    title: "Le bail meublé",
                    items: [
                      "Durée minimale : 1 an (ou 9 mois pour un bail étudiant)",
                      "Bail mobilité : 1 à 10 mois, non reconductible",
                      "Dépôt de garantie limité à 2 mois de loyer hors charges",
                      "Préavis locataire : 1 mois (contre 3 mois en vide)",
                    ],
                  },
                  {
                    title: "L'inventaire obligatoire",
                    items: [
                      "Rédigé contradictoirement à l'entrée ET à la sortie",
                      "Liste les meubles, équipements et leur état",
                      "Sert de référence en cas de litige sur les dégradations",
                      "Décret du 31 juillet 2015 : liste minimale d'équipements",
                    ],
                  },
                  {
                    title: "Les documents à conserver",
                    items: [
                      "Bail signé + avenants éventuels",
                      "État des lieux d'entrée et de sortie",
                      "Quittances de loyer (preuve des paiements)",
                      "Justificatifs de charges, travaux, assurances",
                    ],
                  },
                ].map((block) => (
                  <div key={block.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{block.title}</p>
                    <ul className="mt-3 space-y-2">
                      {block.items.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-slate-600">
                          <span className="mt-0.5 shrink-0 text-indigo-400">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Sources : loi ALUR, décret n°2015-981 du 31 juillet 2015, Service-Public.fr. Ces informations sont indicatives — consultez un professionnel pour votre situation.
              </p>
            </section>

            {/* ── Section éditoriale D : Gestion de location meublée ── */}
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8 space-y-5">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Gestion pratique</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Gérer une location meublée LMNP au quotidien</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  La gestion de location meublée LMNP se distingue de la location vide par la nécessité de suivre le mobilier, de produire un inventaire contradictoire et de maîtriser un régime fiscal spécifique (BIC). Bien organisée, la gestion LMNP peut se gérer sans agence ni comptable pour un ou deux logements — à condition de disposer des bons outils et des bonnes habitudes.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    title: "Gestion LMNP au démarrage",
                    items: [
                      "Rédiger le bail meublé et l'inventaire détaillé",
                      "Réaliser l'état des lieux d'entrée (mobile ou papier)",
                      "Encaisser et documenter le dépôt de garantie",
                      "Déclarer le bien (formulaire P0i) pour l'activité LMNP",
                    ],
                  },
                  {
                    title: "Gestion LMNP mois par mois",
                    items: [
                      "Confirmer chaque paiement de loyer dans les délais",
                      "Émettre et archiver la quittance PDF",
                      "Signaler et gérer les retards ou paiements partiels",
                      "Classer les charges (assurance, charges de copropriété, travaux)",
                    ],
                  },
                  {
                    title: "Gestion LMNP en fin de bail",
                    items: [
                      "Réaliser l'état des lieux de sortie et comparer l'inventaire",
                      "Évaluer les retenues éventuelles sur dépôt de garantie",
                      "Restituer dans le délai légal (1 ou 2 mois selon l'état des lieux)",
                      "Archiver tous les documents pour la déclaration fiscale",
                    ],
                  },
                  {
                    title: "Gestion LMNP et déclaration",
                    items: [
                      "Choisir entre micro-BIC (50 %) et régime réel simplifié",
                      "Conserver tous les justificatifs de charges et travaux",
                      "Anticiper la liasse P0i si changement de régime",
                      "Faire appel à un expert-comptable spécialisé LMNP si besoin",
                    ],
                  },
                ].map((block) => (
                  <div key={block.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{block.title}</p>
                    <ul className="mt-3 space-y-2">
                      {block.items.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-slate-600">
                          <span className="mt-0.5 shrink-0 text-indigo-400">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                L'essentiel de la gestion LMNP repose sur la traçabilité : chaque loyer encaissé, chaque charge réglée, chaque document signé doit être retrouvable rapidement — pour un contrôle fiscal, un départ de locataire ou une revente du bien. lokt.fr centralise ces preuves dans un espace bailleur structuré autour du logement plutôt que du document.
              </p>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[1fr,420px] lg:items-start">
                <div>
                  <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Sources et prudence</p>
                  <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Un outil de pilotage, pas un conseil fiscal personnalisé.</h2>
                  <p data-scroll-reveal data-reveal-delay="200" className="mt-3 text-sm leading-6 text-slate-600">
                    Service-Public rappelle qu’un logement meublé doit comporter un minimum d’équipements, qu’un inventaire et un état détaillé du mobilier sont utiles lors de la remise et de la restitution des clés, et que les revenus LMNP relèvent des revenus de location meublée. lokt.fr aide à organiser ces données, mais ne remplace pas un expert-comptable.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <a className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="https://www.service-public.fr/particuliers/vosdroits/F34769" target="_blank" rel="noreferrer">
                      Mobilier meublé - Service-Public →
                    </a>
                    <a className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="https://www.service-public.fr/particuliers/vosdroits/F2066" target="_blank" rel="noreferrer">
                      Documents location - Service-Public →
                    </a>
                    <a className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="https://www.service-public.fr/particuliers/vosdroits/F32744" target="_blank" rel="noreferrer">
                      Revenus meublés - Service-Public →
                    </a>
                  </div>
                </div>
                <div data-scroll-reveal data-reveal-delay="300" className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5">
                  <ShieldCheckIcon className="h-8 w-8 text-emerald-700" />
                  <p className="mt-4 text-sm font-semibold text-emerald-950">Plan gratuit</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-900">
                    Un logement actif inclus : idéal pour tester la gestion d’un premier meublé avec bail, locataire, quittances, état des lieux, inventaire et finance simple.
                  </p>
                  <Link href="/tarifs" className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Voir les tarifs →
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 sm:rounded-[2rem] sm:p-8">
              <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">FAQ</p>
              <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Questions fréquentes</h2>
              <div className="mt-6 grid gap-3">
                {faq.map((item, i) => (
                  <details key={item.q} data-scroll-reveal data-reveal-delay={`${i * 80}`} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-950">
                      {item.q}
                      <span className="text-slate-400 transition group-open:rotate-180">▾</span>
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>

      {/* Maillage → simulateurs */}
      <div className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Avant d'acheter un nouveau bien</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="/investissement"
              className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-lg">📈</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Simulateur de rentabilité locative</p>
                <p className="mt-0.5 text-[0.8rem] text-slate-500">Calculez le rendement brut, net et cash-flow avant d'investir dans un nouveau bien LMNP.</p>
                <p className="mt-2 text-[0.78rem] font-semibold text-indigo-600">Tester le simulateur →</p>
              </div>
            </a>
            <a
              href="/parc-immobilier"
              className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-lg">🏘️</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Simulateur de parc immobilier</p>
                <p className="mt-0.5 text-[0.8rem] text-slate-500">Visualisez la performance globale de vos biens LMNP : revenus, charges, rendement du parc.</p>
                <p className="mt-2 text-[0.78rem] font-semibold text-indigo-600">Simuler mon parc →</p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Guides pratiques — maillage pages non indexées */}
      <div className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Guides pratiques</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a href="/inventaire-location-meublee" className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-lg">📋</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Inventaire de location meublée</p>
                <p className="mt-0.5 text-[0.8rem] text-slate-500">Checklist du mobilier obligatoire, état des équipements, photos et signature à l'entrée.</p>
                <p className="mt-2 text-[0.78rem] font-semibold text-indigo-600">Préparer l'inventaire →</p>
              </div>
            </a>
            <a href="/guides/choisir-bail-vide-meuble-mobilite" className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-lg">📄</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Choisir entre bail vide, meublé ou mobilité</p>
                <p className="mt-0.5 text-[0.8rem] text-slate-500">Comparatif des 4 contrats possibles : fiscalité, durée et conditions d'application.</p>
                <p className="mt-2 text-[0.78rem] font-semibold text-indigo-600">Comparer les baux →</p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Articles liés — maillage blog */}
      <div className="border-t border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">À lire aussi</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { href: "/blog/lmnp-guide-complet-2026", cat: "Investissement locatif", title: "LMNP : le guide complet 2026 (régime, charges, déclaration)" },
              { href: "/blog/charges-deductibles-lmnp-regime-reel", cat: "Investissement locatif", title: "Charges déductibles LMNP au régime réel : liste complète" },
              { href: "/blog/lmnp-vs-location-nue", cat: "Investissement locatif", title: "LMNP vs location nue : quelle fiscalité choisir ?" },
            ].map((a) => (
              <a key={a.href} href={a.href} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50">
                <span className="text-[0.68rem] font-semibold text-indigo-500">{a.cat}</span>
                <p className="mt-1 text-sm font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">{a.title}</p>
              </a>
            ))}
          </div>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
