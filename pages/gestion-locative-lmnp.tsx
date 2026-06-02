import Head from "next/head";
import Link from "next/link";
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
const ogImage = `${siteUrl}/ESPACEBAILLEURSCREENSHOT.png`;
const title = "Gestion locative LMNP et location meublée | lokt.fr";
const description =
  "Outil de gestion locative LMNP pour propriétaire bailleur : bail, quittances, inventaire meublé, état des lieux, finance, charges et aide à la déclaration.";

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
    q: "lokt.fr est-il réservé au LMNP ?",
    a: "Non. L’outil peut gérer d’autres locations, mais il est particulièrement adapté à la location meublée grâce à l’inventaire, au suivi financier et à l’aide à la déclaration.",
  },
  {
    q: "Pourquoi une page dédiée à la gestion locative LMNP ?",
    a: "Parce que le propriétaire LMNP a des besoins spécifiques : mobilier à suivre, recettes et charges à classer, quittances à conserver et données utiles pour préparer sa déclaration.",
  },
  {
    q: "Le plan gratuit suffit-il pour commencer ?",
    a: "Oui. Il permet de gérer un logement actif avec le bail, le locataire, les quittances manuelles, l’état des lieux, l’inventaire et la finance simple.",
  },
  {
    q: "lokt.fr remplace-t-il un expert-comptable ?",
    a: "Non. lokt.fr aide à organiser les informations, documents et flux. Pour un choix fiscal ou une déclaration complexe, il faut vérifier avec un professionnel.",
  },
];

const jsonLdItems = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "lokt.fr - Gestion locative LMNP",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: pageUrl,
    image: ogImage,
    description,
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
  return (
    <div className="min-h-screen bg-[#f6f9fc] flex flex-col">
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

      <AppHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden px-4 pb-10 pt-10 sm:pb-20 sm:pt-16">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[700px] -skew-y-6 origin-top-left bg-gradient-to-br from-[#635bff] via-[#00d4ff] to-[#00e5a8] sm:h-[520px]" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-[700px] -skew-y-6 origin-top-left bg-[linear-gradient(120deg,rgba(255,255,255,.72)_0%,transparent_34%),linear-gradient(75deg,transparent_54%,rgba(255,184,0,.44)_100%)] sm:h-[520px]" />
          <div aria-hidden className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-[#635bff]/70 via-[#00b8e8]/35 to-transparent lg:w-[68%]" />

          <div className="relative mx-auto max-w-6xl">
            <div className="grid gap-7 sm:gap-10 lg:grid-cols-[0.95fr,1.05fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[0.72rem] font-semibold text-slate-700 shadow-sm backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Location meublée et LMNP
                </div>
                <h1 className="mt-5 max-w-3xl font-semibold leading-[0.99] text-white sm:mt-6">
                  <span className="block text-[2.55rem] sm:text-6xl">Gérer un meublé LMNP.</span>
                  <span className="mt-1 block text-[2rem] text-white/85 sm:text-5xl">Sans tableur dispersé.</span>
                </h1>
                <p className="mt-5 max-w-xl text-[0.98rem] leading-7 text-white/90 sm:mt-6 sm:text-lg">
                  La page cas d’usage pour les propriétaires en location meublée : inventaire, loyers, quittances, état des lieux, finance et préparation de déclaration autour d’un logement LMNP.
                </p>
                <div className="mt-7 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap">
                  <Link
                    href="/mon-compte?mode=register&redirect=/espace-bailleur"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 sm:w-auto"
                  >
                    Créer mon espace bailleur gratuit →
                  </Link>
                  <Link
                    href="/outil-gestion-locative"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#3f37c9] shadow-sm backdrop-blur hover:bg-white sm:w-auto"
                  >
                    Voir la page produit générale →
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-white/35 p-1.5 shadow-xl shadow-slate-900/15 backdrop-blur sm:rounded-[2rem] sm:p-2 sm:shadow-2xl sm:shadow-slate-900/20">
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
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Location meublée</p>
              <h2 className="mt-2 font-semibold leading-tight text-slate-950">
                <span className="block text-3xl sm:text-4xl">Les preuves au bon endroit.</span>
                <span className="mt-1 block text-2xl text-cyan-600 sm:text-3xl">Le pilotage sans surcharge.</span>
              </h2>
            </div>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
              ))}
            </section>

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
              <div className="grid gap-0 lg:grid-cols-[0.82fr,1.18fr]">
                <div className="p-5 sm:p-8">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Pourquoi LMNP</p>
                  <h2 className="mt-2 font-semibold leading-tight text-slate-950">
                    <span className="block text-2xl sm:text-3xl">Pensé pour le cas LMNP.</span>
                    <span className="mt-1 block text-xl text-[#635bff] sm:text-2xl">Utile bien au-delà.</span>
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    La page outil gestion locative présente le produit global. Cette page se concentre sur les recherches liées à la location meublée et au LMNP : mobilier, inventaire, justificatifs, recettes, charges et documents à conserver.
                  </p>
                </div>
                <div className="grid gap-3 bg-slate-50 p-4 sm:p-8">
                  {[
                    ["01", "Créer le logement", "Adresse, type de location, bail, locataire et montants."],
                    ["02", "Suivre le mois", "Loyer attendu, paiement reçu, quittance et relance si besoin."],
                    ["03", "Préparer les preuves", "Inventaire, état des lieux, justificatifs et finance classée."],
                  ].map(([step, titleStep, textStep]) => (
                    <LmnpStepCard key={step} step={step} title={titleStep} text={textStep} />
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[1fr,420px] lg:items-start">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Sources et prudence</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Un outil de pilotage, pas un conseil fiscal personnalisé.</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
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
                <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5">
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
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">FAQ</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Questions fréquentes</h2>
              <div className="mt-6 grid gap-3">
                {faq.map((item) => (
                  <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
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

      <AppFooter />
    </div>
  );
}
