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

      <main className="flex-1 bg-[#f6f9fc] text-slate-950">
        <section className="relative overflow-hidden px-4 pb-10 pt-10 sm:pb-20 sm:pt-16">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[720px] -skew-y-6 origin-top-left bg-gradient-to-br from-[#635bff] via-[#00d4ff] to-[#00e5a8] sm:h-[540px]" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-[720px] -skew-y-6 origin-top-left bg-[linear-gradient(120deg,rgba(255,255,255,.72)_0%,transparent_34%),linear-gradient(75deg,transparent_54%,rgba(255,184,0,.44)_100%)] sm:h-[540px]" />
          <div aria-hidden className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-[#635bff]/70 via-[#00b8e8]/35 to-transparent lg:w-[68%]" />

          <div className="relative mx-auto max-w-6xl">
            <div className="grid gap-7 sm:gap-10 lg:grid-cols-[0.95fr,1.05fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[0.72rem] font-semibold text-slate-700 shadow-sm backdrop-blur">
                  <HomeModernIcon className="h-4 w-4 text-[#635bff]" />
                  Gratuit pour un logement actif
                </div>
                <h1 className="mt-5 max-w-3xl text-[2.55rem] font-semibold leading-[0.99] tracking-tight text-white sm:mt-6 sm:text-6xl">
                  Un espace bailleur simple, clair, prêt à piloter.
                </h1>
                <p className="mt-5 max-w-xl text-[0.98rem] leading-7 text-white/90 sm:mt-6 sm:text-lg">
                  La page produit générale pour gérer une location nue, meublée ou LMNP : baux, loyers, quittances, états des lieux, inventaire, finance et alertes.
                </p>
                <div className="mt-7 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap">
                  <Link
                    href={authReady && isLoggedIn ? "/espace-bailleur" : "/mon-compte?mode=register&redirect=/espace-bailleur"}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 sm:w-auto"
                  >
                    {authReady && isLoggedIn ? "Aller à l’outil bailleur →" : "Créer un compte gratuit →"}
                  </Link>
                  <Link
                    href="/gestion-locative-lmnp"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#3f37c9] shadow-sm backdrop-blur hover:bg-white sm:w-auto"
                  >
                    Voir le cas LMNP →
                  </Link>
                </div>
              </div>

              <div>
                <div className="relative rounded-[1.5rem] bg-white/35 p-1.5 shadow-xl shadow-slate-900/15 backdrop-blur sm:rounded-[2rem] sm:p-2 sm:shadow-2xl sm:shadow-slate-900/20">
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

        <section className="px-4 py-8 sm:py-16">
          <div className="mx-auto max-w-6xl space-y-6">
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <article className="flex h-full flex-col rounded-[1.75rem] border border-[#635bff]/20 bg-white p-5 shadow-sm">
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
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </section>

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
              <div className="grid gap-0 lg:grid-cols-[0.8fr,1.2fr]">
                <div className="p-5 sm:p-8">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow bailleur</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Un parcours guidé, pas une pile de formulaires.</h2>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Chaque étape produit quelque chose d’utile pour le propriétaire : un logement exploitable, un bail suivi, puis des actions visibles dans le cockpit.
                  </p>
                </div>
                <div className="grid gap-3 bg-slate-50 p-4 sm:p-8 lg:grid-cols-3 lg:gap-4">
                  <StepCard
                    index="01"
                    icon={HomeModernIcon}
                    title="Créer le logement"
                    outcome="Une fiche prête pour les quittances, finances et documents."
                    text="Adresse, type de location, informations propriétaire et règles de suivi."
                  />
                  <StepCard
                    index="02"
                    icon={KeyIcon}
                    title="Rattacher le bail"
                    outcome="Le bail devient la référence pour les loyers et alertes."
                    text="Locataire, loyer, charges, échéance et renouvellement reliés au même dossier."
                  />
                  <StepCard
                    index="03"
                    icon={BellAlertIcon}
                    title="Piloter le mois"
                    outcome="Le cockpit indique quoi encaisser, générer, envoyer ou surveiller."
                    text="Paiements, quittances, retards et échéances remontent naturellement."
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
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
                    href={authReady && isLoggedIn ? "/espace-bailleur" : "/mon-compte?mode=register&redirect=/espace-bailleur"}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {authReady && isLoggedIn ? "Aller à l’outil bailleur" : "Créer un compte gratuit"}
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
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
                        <span className="text-slate-400 transition group-open:rotate-180">▾</span>
                      </summary>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
