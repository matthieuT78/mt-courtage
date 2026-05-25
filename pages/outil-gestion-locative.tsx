import Head from "next/head";
import Link from "next/link";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
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
import { supabase } from "../lib/supabaseClient";

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/outil-gestion-locative`;
const ogImage = `${siteUrl}/ESPACEBAILLEURSCREENSHOT.png`;
const title = "Outil de gestion locative gratuit pour propriétaire bailleur | lokt.fr";
const description =
  "Outil gratuit de gestion locative pour propriétaire bailleur : baux, locataires, quittances PDF, envoi automatique, états des lieux, inventaire, finance et alertes.";

type Feature = {
  title: string;
  text: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

function FeatureCard({ title, text, icon: Icon }: Feature) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-900">
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
    <article className="relative min-w-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-5 text-white shadow-sm">
      <div className="pointer-events-none absolute -right-5 -top-7 text-[7rem] font-semibold leading-none text-white/[0.04]">
        {index}
      </div>
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-sm">
          <Icon className="h-6 w-6" />
        </div>
        <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          {index}
        </span>
      </div>
      <h2 className="relative mt-5 text-lg font-semibold text-white">{title}</h2>
      <p className="relative mt-2 text-sm leading-6 text-slate-300">{text}</p>
      <div className="relative mt-5 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-cyan-200">Résultat</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-white">{outcome}</p>
      </div>
    </article>
  );
}

function IncludedLine({ icon: Icon, title, text }: Feature) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">{text}</p>
      </div>
    </div>
  );
}

export default function OutilGestionLocativePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        if (!supabase) {
          if (mounted) setAuthReady(true);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setIsLoggedIn(!!data.session?.user?.id);
        setAuthReady(true);

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          setIsLoggedIn(!!session?.user?.id);
          setAuthReady(true);
        });

        return () => sub.subscription.unsubscribe();
      } catch {
        if (!mounted) return;
        setIsLoggedIn(false);
        setAuthReady(true);
      }
    };

    let unsubscribe: (() => void) | undefined;
    init().then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

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

      <AppHeader />

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.05fr,0.95fr]">
              <div className="p-7 sm:p-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                  <HomeModernIcon className="h-4 w-4" />
                  Gratuit pour un logement actif
                </div>
                <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
                  L’outil gratuit pour gérer une location proprement, du bail à la quittance.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                  lokt.fr accompagne le propriétaire au quotidien : suivi du bail, locataire, loyers, quittances, envoi automatique,
                  états des lieux, inventaire meublé, finance, alertes et archives. Tout part d’un principe simple : un seul endroit
                  pour savoir quoi faire et ne rien oublier.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={authReady && isLoggedIn ? "/espace-bailleur" : "/mon-compte?mode=register&redirect=/espace-bailleur"}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {authReady && isLoggedIn ? "Aller à l’outil bailleur" : "Créer un compte gratuit"}
                  </Link>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-950 p-6 lg:border-l lg:border-t-0">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Ce qui est inclus</p>
                    <p className="mt-1 text-xs text-slate-400">Une logique métier claire, pas seulement une liste de données.</p>
                  </div>
                  <ShieldCheckIcon className="h-8 w-8 text-emerald-200" />
                </div>
                <div className="grid gap-3">
                  <IncludedLine
                    icon={BuildingOffice2Icon}
                    title="Un logement actif gratuit"
                    text="Créez votre premier bien, son bail, son locataire et son suivi sans tableur."
                  />
                  <IncludedLine
                    icon={EnvelopeIcon}
                    title="Quittances automatiques"
                    text="Préparez les quittances, confirmez le paiement, générez le PDF et envoyez-le au locataire."
                  />
                  <IncludedLine
                    icon={ShieldCheckIcon}
                    title="Suivi métier guidé"
                    text="L’outil remonte les loyers à encaisser, les baux à surveiller et les documents à garder."
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </section>

          <section className="overflow-hidden rounded-[2rem] border border-slate-900 bg-slate-950 shadow-sm">
            <div className="relative p-6 sm:p-8">
              <div
                aria-hidden="true"
                className="absolute inset-x-10 top-[58%] hidden h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent lg:block"
              />
              <div className="relative grid gap-6 lg:grid-cols-[0.78fr,1.22fr] lg:items-start">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-cyan-200">Workflow bailleur</p>
                  <h2 className="mt-3 max-w-md text-2xl font-semibold leading-tight text-white sm:text-3xl">
                    Un parcours guidé, pas une pile de formulaires.
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
                    Chaque étape produit quelque chose d’utile pour le propriétaire : un logement exploitable, un bail suivi, puis
                    des actions visibles dans le cockpit.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <StepCard
                    index="01"
                    icon={HomeModernIcon}
                    title="Créer le logement"
                    outcome="Une fiche prête pour les quittances, finances et documents."
                    text="Vous posez la base : adresse, type de location, informations propriétaire et règles de suivi."
                  />
                  <StepCard
                    index="02"
                    icon={KeyIcon}
                    title="Rattacher le bail"
                    outcome="Le bail devient la référence pour les loyers et alertes."
                    text="Locataire, loyer, charges, échéance, renouvellement et documents sont reliés au même dossier."
                  />
                  <StepCard
                    index="03"
                    icon={BellAlertIcon}
                    title="Piloter le mois"
                    outcome="Le cockpit indique quoi encaisser, générer, envoyer ou surveiller."
                    text="Les actions importantes remontent naturellement : paiements, quittances, retards et échéances."
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[1fr,360px] lg:items-center">
              <div>
                <p className="text-lg font-semibold text-slate-950">Tout se pilote depuis l’espace bailleur</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Cette page explique le produit, mais les actions métier restent centralisées dans l’outil : créer un logement, rattacher un bail,
                  générer une quittance, préparer un état des lieux, suivre l’inventaire et piloter la finance. L’objectif est de ne pas disperser
                  le propriétaire entre plusieurs parcours.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <Link
                  href={authReady && isLoggedIn ? "/espace-bailleur" : "/mon-compte?mode=register&redirect=/espace-bailleur"}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {authReady && isLoggedIn ? "Aller à l’outil bailleur" : "Créer un compte gratuit"}
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Questions fréquentes</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Comprendre l’outil avant de créer son compte</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  La page publique sert à expliquer. Le cockpit, les baux, les quittances et la finance restent dans l’espace bailleur privé.
                </p>
              </div>
              <div className="grid gap-3">
                {faq.map((item) => (
                  <details key={item.q} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-950">
                      {item.q}
                      <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
