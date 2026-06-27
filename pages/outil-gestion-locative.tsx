import Head from "next/head";
import Link from "next/link";
import { type ComponentType, type SVGProps } from "react";
import {
  ArchiveBoxIcon,
  BellAlertIcon,
  BuildingOffice2Icon,
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
import { useScrollReveal } from "../hooks/useScrollReveal";

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/outil-gestion-locative`;
const ogImage = `${siteUrl}/ESPACEBAILLEURSCREENSHOT.png`;
const title = "Outil de gestion locative gratuit pour propriétaire bailleur 2026 | lokt.fr";
const description =
  "Outil gratuit de gestion locative pour propriétaire bailleur : baux, locataires, quittances PDF, envoi automatique, états des lieux, inventaire, finance et alertes. Pour location nue, meublée ou LMNP.";

type Feature = {
  title: string;
  text: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

function FeatureCard({ title, text, icon: Icon }: Feature) {
  return (
    <article className="flex h-full flex-col rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#635bff]/30 hover:shadow-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f6f9fc] text-[#635bff] ring-1 ring-slate-200">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}

function StepCard({
  index,
  title,
  text,
  outcome,
  icon: Icon,
}: {
  index: string;
  title: string;
  text: string;
  outcome: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <article className="relative min-w-0 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="pointer-events-none absolute -right-5 -top-7 text-[7rem] font-semibold leading-none text-slate-100">
        {index}
      </div>
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f6f9fc] text-[#635bff] ring-1 ring-slate-200">
          <Icon className="h-6 w-6" />
        </div>
        <span className="rounded-full bg-[#635bff]/10 px-3 py-1 text-xs font-semibold text-[#635bff]">
          {index}
        </span>
      </div>
      <h2 className="relative mt-5 text-lg font-semibold text-slate-950">{title}</h2>
      <p className="relative mt-2 text-sm leading-6 text-slate-600">{text}</p>
      <div className="relative mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Résultat</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-slate-950">{outcome}</p>
      </div>
    </article>
  );
}

function IncludedLine({ icon: Icon, title, text }: Feature) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#635bff]" />
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
      </div>
    </div>
  );
}

export default function OutilGestionLocativePage() {
  useScrollReveal();

  const faq = [
    {
      q: "L’outil de gestion locative est-il vraiment gratuit ?",
      a: "Oui, lokt.fr permet de gérer gratuitement un logement actif. Les offres payantes ajoutent surtout l’automatisation, les alertes avancées, l’aide à la déclaration et plus de volume.",
    },
    {
      q: "Quelle différence avec un simple modèle de quittance ?",
      a: "Un modèle génère un document isolé. lokt.fr rattache la quittance au bail, au locataire, au mois concerné et au suivi du paiement pour garder un historique exploitable.",
    },
    {
      q: "Puis-je utiliser lokt.fr si je n’ai qu’un seul bien ?",
      a: "Oui, c’est précisément le cas d’usage gratuit : un propriétaire bailleur qui veut gérer proprement son premier logement sans tableur.",
    },
    {
      q: "Les actions se font-elles depuis cette page publique ?",
      a: "Non. Cette page explique le produit. Les actions métier se font dans l’espace bailleur privé après connexion.",
    },
    {
      q: "Combien de temps faut-il pour mettre en place lokt.fr ?",
      a: "Environ 10 à 15 minutes pour créer un compte, saisir le logement, le bail et le locataire. La première quittance peut être générée dans la foulée. Il n’y a pas de période de formation — l’outil guide chaque étape.",
    },
    {
      q: "Est-ce que lokt.fr fonctionne pour une location meublée (LMNP) ?",
      a: "Oui. lokt.fr gère les deux régimes : location nue (bail 3 ans, revenus fonciers) et location meublée LMNP (bail 1 an, BIC). L’inventaire mobilier, les règles de renouvellement de bail et les exports adaptés à chaque régime sont inclus.",
    },
    {
      q: "Vaut-il mieux gérer soi-même avec un outil ou déléguer à une agence ?",
      a: "Une agence de gestion coûte en moyenne 7 à 10 % des loyers, soit 700 à 1 000 € par an pour un loyer de 800 €/mois. Sur 10 ans, c’est 7 000 à 10 000 € donnés à l’agence pour des tâches qu’un outil comme lokt.fr automatise en grande partie. La gestion en direct est pertinente dès lors que vous avez un peu d’organisation et les bons outils.",
    },
    {
      q: "Comment lokt.fr gère-t-il la révision de loyer IRL ?",
      a: "lokt.fr calcule automatiquement la date de révision et le nouveau loyer à partir de l’indice IRL publié par l’INSEE. Une alerte vous prévient avant l’échéance pour que vous puissiez notifier le locataire dans les délais légaux. La révision est ensuite intégrée dans les quittances suivantes.",
    },
    {
      q: "Que se passe-t-il en cas de loyer impayé ?",
      a: "lokt.fr envoie une alerte automatique dès qu’un loyer attendu n’est pas enregistré. Vous pouvez déclencher une relance e-mail au locataire depuis l’outil. L’historique des paiements est conservé et exportable — utile si la situation évolue vers une procédure formelle.",
    },
  ];

  const jsonLdItems = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "lokt.fr - Outil de gestion locative",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: pageUrl,
      image: ogImage,
      description,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        description: "Offre gratuite pour un logement actif.",
      },
      featureList: [
        "Gestion des baux et locataires",
        "Quittances PDF",
        "Envoi automatique des quittances",
        "États des lieux mobile",
        "Inventaire LMNP",
        "Suivi financier propriétaire",
        "Alertes métier",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Outil de gestion locative", item: pageUrl },
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

  const features: Feature[] = [
    {
      title: "Baux et locataires",
      text: "Centralisez le logement, le bail actif, le locataire, le loyer, les charges, l’échéance et les règles de renouvellement.",
      icon: KeyIcon,
    },
    {
      title: "Quittances PDF",
      text: "Confirmez le paiement, générez une quittance PDF professionnelle, archivez-la et envoyez-la automatiquement au locataire.",
      icon: DocumentTextIcon,
    },
    {
      title: "États des lieux mobile",
      text: "Préparez l’entrée ou la sortie sur place, pièce par pièce, avec un workflow pensé pour le téléphone.",
      icon: ClipboardDocumentCheckIcon,
    },
    {
      title: "Inventaire LMNP",
      text: "Suivez mobilier, vaisselle, électroménager, literie et équipements obligatoires d’une location meublée.",
      icon: ArchiveBoxIcon,
    },
    {
      title: "Finance propriétaire",
      text: "Classez recettes, dépenses, charges, exports, justificatifs et indicateurs de rentabilité par logement.",
      icon: ChartBarSquareIcon,
    },
    {
      title: "Alertes métier",
      text: "Surveillez loyers attendus, retards, baux à échéance, préavis, documents manquants et actions à faire.",
      icon: BellAlertIcon,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
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
        <meta property="og:image:alt" content="Espace bailleur lokt.fr pour propriétaire bailleur" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        {jsonLdItems.map((schema, index) => (
          <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        ))}
      </Head>

      <AppHeader staticMode />

      <main className="flex-1 bg-[#f6f9fc] text-slate-950">
        <section className="relative overflow-hidden border-b border-slate-200 bg-white px-4 pb-12 pt-10 sm:pb-16 sm:pt-14">
          {/* Ligne accent top */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#635bff]/60 to-transparent" />
          {/* Orbes statiques */}
          <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#635bff]/[0.08] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -right-24 top-16 h-[380px] w-[380px] rounded-full bg-[#00d4ff]/[0.06] blur-3xl" />
          <div className="relative mx-auto max-w-6xl">
            <div className="grid gap-7 sm:gap-10 lg:grid-cols-[0.95fr,1.05fr] lg:items-start">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#635bff]/8 px-3 py-1 text-[0.72rem] font-semibold text-[#635bff] ring-1 ring-[#635bff]/15">
                  <HomeModernIcon className="h-4 w-4 text-[#635bff]" />
                  Gratuit pour un logement actif
                </div>
                <h1 className="mt-5 max-w-3xl font-semibold leading-[0.99] text-slate-950 sm:mt-6">
                  <span className="block text-[2.55rem] sm:text-6xl">Un espace bailleur simple.</span>
                  <span className="mt-1 block bg-clip-text text-transparent bg-gradient-to-r from-[#635bff] to-[#00b4d8] text-[2rem] sm:text-5xl">Clair, prêt à piloter.</span>
                </h1>
                <p className="mt-5 max-w-xl text-[0.98rem] leading-7 text-slate-600 sm:mt-6 sm:text-lg">
                  La page produit générale pour gérer une location nue, meublée ou LMNP : baux, loyers, quittances, états des lieux, inventaire, finance et alertes.
                </p>
                <div className="mt-6 grid gap-3 sm:mt-7 sm:flex sm:flex-wrap">
                  <Link
                    href="/mon-compte?mode=register&redirect=/espace-bailleur"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#635bff] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 hover:bg-[#4f46e5] sm:w-auto"
                  >
                    Créer un compte gratuit →
                  </Link>
                  <Link
                    href="/mon-compte?mode=login&redirect=/espace-bailleur"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#3f37c9] shadow-sm hover:bg-slate-50 sm:w-auto"
                  >
                    Se connecter →
                  </Link>
                  <Link
                    href="/gestion-locative-lmnp"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#3f37c9] shadow-sm hover:bg-slate-50 sm:w-auto"
                  >
                    Voir le cas LMNP →
                  </Link>
                </div>
              </div>

              <div>
                <div className="relative rounded-[1.5rem] border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/15 shadow-[#635bff]/10 sm:rounded-[2rem] sm:p-2 sm:shadow-2xl sm:shadow-slate-900/20">
                  <div className="overflow-hidden rounded-[1.25rem] border border-white/60 bg-white sm:rounded-[1.55rem]">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#ff5f57] sm:h-2.5 sm:w-2.5" />
                        <span className="h-2 w-2 rounded-full bg-[#ffbd2e] sm:h-2.5 sm:w-2.5" />
                        <span className="h-2 w-2 rounded-full bg-[#28c840] sm:h-2.5 sm:w-2.5" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[0.68rem] font-semibold text-slate-600">Cockpit bailleur</span>
                    </div>
                    <div className="p-3 sm:p-6">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Cockpit du mois</p>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Tout ce qui compte, au même endroit</h2>
                      <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-3">
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
                          <p className="text-sm font-semibold text-amber-950">2 loyers attendus</p>
                          <p className="mt-1 text-xs leading-5 text-amber-800">1 complet, 1 incomplet à relancer.</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                          <p className="text-sm font-semibold text-emerald-950">Quittances suivies</p>
                          <p className="mt-1 text-xs leading-5 text-emerald-800">PDF, archive et envoi locataire.</p>
                        </div>
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 sm:p-4">
                          <p className="text-sm font-semibold text-sky-950">Bail à surveiller</p>
                          <p className="mt-1 text-xs leading-5 text-sky-800">Renouvellement et état des lieux.</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-[1fr,0.9fr] sm:gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                          <p className="text-sm font-semibold text-slate-950">Vue finance</p>
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="flex justify-between gap-3"><span className="text-slate-500">Revenus encaissés</span><span className="font-semibold text-emerald-700">2 480 €</span></div>
                            <div className="flex justify-between gap-3"><span className="text-slate-500">Dépenses classées</span><span className="font-semibold text-red-700">-640 €</span></div>
                            <div className="flex justify-between gap-3 border-t border-slate-100 pt-2"><span className="text-slate-500">Résultat mensuel</span><span className="font-semibold text-slate-950">1 840 €</span></div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                          <p className="text-sm font-semibold text-slate-950">Dossier logement</p>
                          <div className="mt-3 grid gap-2 text-xs text-slate-600">
                            <span className="rounded-full bg-white px-3 py-1.5">Bail actif</span>
                            <span className="rounded-full bg-white px-3 py-1.5">Inventaire LMNP</span>
                            <span className="rounded-full bg-white px-3 py-1.5">État des lieux</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
                        <IncludedLine
                          icon={BuildingOffice2Icon}
                          title="Un logement actif gratuit"
                          text="Créez votre premier bien, son bail, son locataire et son suivi sans tableur."
                        />
                        <IncludedLine
                          icon={EnvelopeIcon}
                          title="Quittances automatiques"
                          text="Confirmez le paiement, générez le PDF et envoyez-le au locataire."
                        />
                        <IncludedLine
                          icon={ShieldCheckIcon}
                          title="Suivi métier guidé"
                          text="L’outil remonte les loyers à encaisser, les baux à surveiller et les documents à garder."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:py-20">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="max-w-3xl pb-3">
              <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Tout relier</p>
              <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 font-semibold leading-tight text-slate-950">
                <span className="block text-3xl sm:text-4xl">Un logement bien suivi.</span>
                <span className="mt-1 block text-2xl text-cyan-600 sm:text-3xl">Sans multiplier les outils.</span>
              </h2>
            </div>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <article data-scroll-reveal data-reveal-delay="0" className="flex h-full flex-col rounded-[1.75rem] border border-[#635bff]/20 bg-white p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f6f9fc] text-[#635bff] ring-1 ring-slate-200">
                  <HomeModernIcon className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-950">Page produit générale</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Cette page explique l’outil complet : biens, locataires, baux, quittances, états des lieux, inventaire, finance et alertes. Pour le référencement LMNP, consultez la page dédiée au cas d’usage meublé.
                </p>
                <Link href="/gestion-locative-lmnp" className="mt-4 text-sm font-semibold text-[#3f37c9]">
                  Gestion locative LMNP →
                </Link>
              </article>
              {features.map((feature, i) => (
                <div key={feature.title} data-scroll-reveal data-reveal-delay={`${(i + 1) * 70}`}>
                  <FeatureCard {...feature} />
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
              <div className="grid gap-0 lg:grid-cols-[0.8fr,1.2fr]">
                <div className="p-5 sm:p-8">
                  <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow bailleur</p>
                  <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 font-semibold leading-tight text-slate-950">
                    <span className="block text-2xl sm:text-3xl">Un parcours guidé.</span>
                    <span className="mt-1 block text-xl text-[#635bff] sm:text-2xl">Pas une pile de formulaires.</span>
                  </h2>
                  <p data-scroll-reveal data-reveal-delay="200" className="mt-4 text-sm leading-6 text-slate-600">
                    Chaque étape produit quelque chose d’utile pour le propriétaire : un logement exploitable, un bail suivi, puis des actions visibles dans le cockpit.
                  </p>
                </div>
                <div className="grid gap-3 bg-slate-50 p-4 sm:p-8 lg:grid-cols-3 lg:gap-4">
                  <div data-scroll-reveal data-reveal-delay="0">
                    <StepCard
                      index="01"
                      icon={HomeModernIcon}
                      title="Créer le logement"
                      outcome="Une fiche prête pour les quittances, finances et documents."
                      text="Adresse, type de location, informations propriétaire et règles de suivi."
                    />
                  </div>
                  <div data-scroll-reveal data-reveal-delay="70">
                    <StepCard
                      index="02"
                      icon={KeyIcon}
                      title="Rattacher le bail"
                      outcome="Le bail devient la référence pour les loyers et alertes."
                      text="Locataire, loyer, charges, échéance et renouvellement reliés au même dossier."
                    />
                  </div>
                  <div data-scroll-reveal data-reveal-delay="140">
                    <StepCard
                      index="03"
                      icon={BellAlertIcon}
                      title="Piloter le mois"
                      outcome="Le cockpit indique quoi encaisser, générer, envoyer ou surveiller."
                      text="Paiements, quittances, retards et échéances remontent naturellement."
                    />
                  </div>
                </div>
              </div>
            </section>

            <section data-scroll-reveal data-reveal-delay="0" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[1fr,360px] lg:items-center">
                <div>
                  <p className="text-lg font-semibold text-slate-950">Tout se pilote depuis l’espace bailleur</p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Cette page explique le produit, mais les actions métier restent centralisées dans l’outil : créer un logement, rattacher un bail,
                    générer une quittance, préparer un état des lieux, suivre l’inventaire et piloter la finance.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Link
                    href="/mon-compte?mode=register&redirect=/espace-bailleur"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Créer un compte gratuit
                  </Link>
                  <Link
                    href="/mon-compte?mode=login&redirect=/espace-bailleur"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Se connecter
                  </Link>
                </div>
              </div>
            </section>

            {/* ── SECTION ÉDITORIALE 1 : coûts cachés de la désorganisation ── */}
            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
              <div className="border-b border-slate-100 bg-gradient-to-br from-[#635bff]/5 to-[#00b4d8]/5 px-6 py-7 sm:px-8">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#635bff]">Ce que ça coûte vraiment</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Gérer sans outil : les pertes invisibles</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-2xl">
                  La plupart des bailleurs gèrent avec un fichier Excel, un dossier de mails et une pile de PDFs. Voici ce que ça coûte réellement.
                </p>
              </div>
              <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
                {[
                  {
                    value: "648 €/an",
                    label: "perdus en loyer non révisé",
                    detail: "Sur 900 €/mois, 3 ans sans révision IRL à 2 %/an = 54 €/mois oubliés.",
                    color: "text-red-600",
                  },
                  {
                    value: "3–5 h/mois",
                    label: "passées à chercher des infos",
                    detail: "Mails, tableurs, PDFs éparpillés : localiser une quittance ou un bail prend du temps.",
                    color: "text-amber-600",
                  },
                  {
                    value: "30 j",
                    label: "délai de déclaration GLI oublié",
                    detail: "La plupart des assurances GLI exigent une déclaration dans les 30-45 jours. Passé ce délai, vous perdez la garantie.",
                    color: "text-red-600",
                  },
                  {
                    value: "0 €",
                    label: "de traçabilité en cas de litige",
                    detail: "Sans historique structuré, prouver les paiements passés ou les relances effectuées est quasi impossible devant un tribunal.",
                    color: "text-slate-500",
                  },
                ].map(({ value, label, detail, color }) => (
                  <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{label}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── SECTION ÉDITORIALE 2 : profils ── */}
            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
              <div className="border-b border-slate-100 px-6 py-7 sm:px-8">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#635bff]">À qui s&apos;adresse lokt.fr</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Votre profil de bailleur</h2>
              </div>
              <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
                {[
                  {
                    icon: "🏠",
                    title: "1 bien, premier investissement",
                    body: "Vous venez d’acheter votre premier logement locatif. Vous voulez gérer proprement sans payer une agence. lokt.fr est gratuit pour un logement actif — quittances, bail, état des lieux inclus.",
                    link: null,
                  },
                  {
                    icon: "🏘️",
                    title: "2 à 5 biens en location nue",
                    body: "Vous avez plusieurs logements vides et gérez plusieurs locataires. Le cockpit centralise tous vos loyers attendus, retards et quittances à générer chaque mois, sans jongler entre plusieurs fichiers.",
                    link: null,
                  },
                  {
                    icon: "🛋️",
                    title: "Location meublée LMNP",
                    body: "Bail d’un an, inventaire mobilier obligatoire, régime BIC — le meublé a ses propres règles. lokt.fr intègre l’inventaire, les renouvellements et les exports adaptés au LMNP.",
                    link: { label: "En savoir plus sur le LMNP", href: "/gestion-locative-lmnp" },
                  },
                  {
                    icon: "📊",
                    title: "Bailleur qui veut optimiser sa fiscalité",
                    body: "Vous gérez déjà vos biens mais perdez de vue les charges déductibles, les révisions IRL et la rentabilité réelle. La vue finance de lokt.fr classe recettes et dépenses par logement, prêtes pour votre déclaration.",
                    link: { label: "Calculer la rentabilité", href: "/investissement" },
                  },
                ].map(({ icon, title, body, link }) => (
                  <div key={title} className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <p className="text-2xl">{icon}</p>
                    <p className="mt-3 font-semibold text-slate-900">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 flex-1">{body}</p>
                    {link && (
                      <Link href={link.href} className="mt-4 text-sm font-semibold text-[#635bff] hover:underline">
                        {link.label} →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ── FAQ étendue ── */}
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]">
                <div>
                  <p data-scroll-reveal data-reveal-delay="0" className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Questions fréquentes</p>
                  <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 text-2xl font-semibold text-slate-950">Comprendre l’outil avant de créer son compte</h2>
                  <p data-scroll-reveal data-reveal-delay="200" className="mt-3 text-sm leading-6 text-slate-600">
                    La page publique sert à expliquer. Le cockpit, les baux, les quittances et la finance restent dans l’espace bailleur privé.
                  </p>
                </div>
                <div className="grid gap-3">
                  {faq.map((item, i) => (
                    <details key={item.q} data-scroll-reveal data-reveal-delay={`${i * 80}`} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-950">
                        {item.q}
                        <span className="text-slate-400 transition group-open:rotate-180">▾</span>
                      </summary>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Maillage interne ── */}
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pour aller plus loin</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: "Gestion locative sans agence : le guide", href: "/blog/gestion-locative-sans-agence" },
                  { label: "Loyer impayé : que faire étape par étape ?", href: "/blog/loyer-impaye-que-faire" },
                  { label: "LMNP vs location nue : quelle fiscalité ?", href: "/blog/lmnp-vs-location-nue" },
                  { label: "Comparer les logiciels de gestion locative", href: "/comparatif-logiciel-gestion-locative" },
                  { label: "Calculer la rentabilité locative", href: "/investissement" },
                  { label: "Investissement locatif : le guide complet", href: "/investissement-locatif" },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[#635bff]/30 hover:text-[#635bff]">
                    {label} →
                  </Link>
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
