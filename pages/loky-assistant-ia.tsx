import Head from "next/head";
import Link from "next/link";
import { type ComponentType, type SVGProps } from "react";
import { useScrollReveal } from "../hooks/useScrollReveal";
import {
  UserPlusIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  BanknotesIcon,
  ArrowPathIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/loky-assistant-ia`;
const ogImage = `${siteUrl}/cockpit-bailleur-lokt-v2.webp`;
const title = "Loky : l'assistant IA de gestion locative | lokt.fr";
const description =
  "Loky est l'assistant IA intégré au cockpit bailleur de lokt.fr : il crée un bail, confirme un loyer, renvoie une quittance ou relance un locataire en une phrase — avec confirmation avant chaque action. Inclus dès 6,90 €/mois.";

const capabilities = [
  {
    title: "Baux et locataires",
    icon: UserPlusIcon,
    text: "Créer un bien, une fiche locataire ou un bail (y compris meublé, étudiant ou mobilité) sans ouvrir de formulaire.",
    prompt: "Crée un bail meublé pour Camille sur le T2 rue Victor Hugo, 780 € à partir du 1er octobre",
  },
  {
    title: "Loyers, quittances et relances",
    icon: DocumentTextIcon,
    text: "Vérifier un paiement, confirmer un loyer reçu (la quittance PDF part automatiquement), renvoyer une quittance ou relancer un impayé.",
    prompt: "Le loyer de Karim est-il arrivé ce mois-ci ?",
  },
  {
    title: "LMNP et location meublée",
    icon: ArchiveBoxIcon,
    text: "Vérifier la conformité de l'inventaire meublé bien par bien, avec le détail exact de ce qui manque.",
    prompt: "Mon inventaire LMNP est-il complet pour le studio Bellevue ?",
  },
  {
    title: "Finance et pilotage",
    icon: BanknotesIcon,
    text: "Consulter le cash-flow confirmé d'un bien, ajouter une écriture, ou connaître le taux d'occupation réel du parc sur 12 mois.",
    prompt: "Quel est mon taux d'occupation en ce moment ?",
  },
  {
    title: "Révision de loyer et fin de bail",
    icon: ArrowPathIcon,
    text: "Calculer et envoyer une révision IRL, résilier un bail, générer une lettre de congé ou une mise en demeure.",
    prompt: "Révise le loyer de Julien selon le dernier IRL publié",
  },
  {
    title: "Recherche de locataire",
    icon: UserGroupIcon,
    text: "Publier une annonce pour un logement vacant afin de recevoir des candidatures, sans repasser par l'écran dédié.",
    prompt: "Trouve-moi un locataire pour le studio qui vient de se libérer",
  },
];

const faq = [
  {
    q: "Qu'est-ce que Loky ?",
    a: "Loky est l'assistant IA intégré au cockpit bailleur de lokt.fr. Contrairement à un chatbot qui se contente de répondre à des questions, Loky peut exécuter de vraies actions sur votre compte — créer un bail, confirmer un paiement, renvoyer une quittance, relancer un locataire — quand vous le lui demandez en langage naturel.",
  },
  {
    q: "Comment fonctionne l'assistant IA de lokt.fr ?",
    a: "Vous décrivez ce que vous voulez faire en une phrase. Loky va chercher les vraies données de votre compte (jamais une estimation générique) pour vous répondre ou préparer l'action demandée. Pour toute action qui modifie vos données, une carte de confirmation s'affiche : vous validez avant que Loky agisse.",
  },
  {
    q: "Loky peut-il agir sans mon accord ?",
    a: "Non. Toute action qui écrit une donnée sur votre compte (créer un bail, confirmer un paiement, envoyer une relance ou une révision de loyer...) nécessite une confirmation explicite de votre part avant exécution. Les questions de consultation (taux d'occupation, statut d'un paiement, solde d'un bien) sont répondues directement, sans action à valider.",
  },
  {
    q: "Quelles actions Loky peut-il réaliser ?",
    a: "Créer un bien, une fiche locataire ou un bail ; confirmer un loyer reçu et générer la quittance ; renvoyer une quittance ; relancer un impayé ; vérifier l'inventaire LMNP d'un logement meublé ; consulter le cash-flow ou le taux d'occupation d'un bien ; réviser un loyer selon l'IRL ; résilier un bail ou générer une lettre de congé ; publier une annonce pour trouver un locataire.",
  },
  {
    q: "Mes données sont-elles utilisées pour entraîner un modèle d'IA ?",
    a: "Loky s'appuie sur l'API d'Anthropic (Claude) pour comprendre vos demandes. Vos messages sont utilisés uniquement pour générer la réponse, pas pour entraîner leurs modèles, conformément aux conditions commerciales standard de l'API. Loky n'a par ailleurs accès qu'aux données de votre propre compte lokt.fr, jamais à celles des autres utilisateurs.",
  },
  {
    q: "Quel est le prix de Loky ?",
    a: "Le plan gratuit donne accès à un essai de 8 messages à vie avec Loky. Au-delà, l'accès complet est inclus à partir du plan lokt·one (6,90 €/mois), avec un usage étendu sur les plans lokt·plus et Pro/agence.",
  },
  {
    q: "Loky remplace-t-il un expert-comptable ou un gestionnaire ?",
    a: "Non. Loky exécute des actions et centralise vos données de gestion locative, mais ne fournit pas de conseil juridique ou fiscal personnalisé. Pour un choix de régime fiscal ou une situation complexe, il reste préférable de vérifier avec un professionnel.",
  },
  {
    q: "Est-ce que Loky peut se tromper ?",
    a: "Loky s'appuie toujours sur les données réelles de votre compte plutôt que sur une estimation, et affiche une carte de confirmation avant toute action qui modifie vos données — vous pouvez donc vérifier les montants, dates et noms avant de valider. Comme pour tout assistant, restez attentif au récapitulatif affiché avant de confirmer une action.",
  },
];

const jsonLdItems = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    headline: "Loky, l'assistant IA du cockpit bailleur lokt.fr",
    url: pageUrl,
    description,
    inLanguage: "fr-FR",
    image: ogImage,
    isPartOf: {
      "@type": "WebSite",
      name: "lokt.fr",
      url: siteUrl,
    },
    about: ["assistant IA gestion locative", "agent IA immobilier", "IA bailleur", "chatbot gestion locative", "automatisation gestion locative"],
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Loky — assistant IA de lokt.fr",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: pageUrl,
    image: ogImage,
    description,
    inLanguage: "fr-FR",
    offers: {
      "@type": "Offer",
      price: "6.90",
      priceCurrency: "EUR",
      description: "Essai de 8 messages à vie sur le plan gratuit, accès complet à partir du plan lokt·one.",
    },
    featureList: capabilities.map((c) => c.title),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Loky, l'assistant IA", item: pageUrl },
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

function CapabilityCard({ capability }: { capability: (typeof capabilities)[number] }) {
  const Icon = capability.icon;
  return (
    <article className="flex flex-col rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#635bff]/30 hover:shadow-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f6f9fc] text-[#635bff] ring-1 ring-slate-200">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-950">{capability.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{capability.text}</p>
      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs italic leading-5 text-slate-500">« {capability.prompt} »</p>
    </article>
  );
}

function StepCard({ step, title, text, icon: Icon }: { step: string; title: string; text: string; icon: ComponentType<SVGProps<SVGSVGElement>> }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="pointer-events-none absolute -right-5 -top-7 text-[7rem] font-semibold leading-none text-slate-100">{step}</div>
      <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f6f9fc] text-[#635bff] ring-1 ring-slate-200">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="relative mt-3 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="relative mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

export default function LokyAssistantIaPage() {
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
        <meta property="og:image:alt" content="Loky, l'assistant IA du cockpit bailleur lokt.fr" />
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
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#635bff]/60 to-transparent" />
          <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#635bff]/[0.08] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -right-24 top-16 h-[380px] w-[380px] rounded-full bg-[#00d4ff]/[0.06] blur-3xl" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32">
                <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-[#635bff]/25 to-[#00d4ff]/25 blur-2xl" />
                <img src="/loky-avatar.png" alt="Loky, l'assistant IA de lokt.fr" className="relative h-full w-full object-contain drop-shadow-[0_18px_30px_rgba(79,70,229,0.25)]" />
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#635bff]/8 px-3 py-1 text-[0.72rem] font-semibold text-[#635bff] ring-1 ring-[#635bff]/15">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Assistant IA lokt.fr
              </div>
              <h1 className="mt-5 font-semibold leading-[0.99] text-slate-950">
                <span className="block text-[2.55rem] sm:text-6xl">Loky.</span>{" "}
                <span className="mt-1 block text-[2rem] bg-clip-text text-transparent bg-gradient-to-r from-[#635bff] to-[#00b4d8] sm:text-5xl">
                  Un message suffit, il s'occupe du reste.
                </span>
              </h1>
              <p className="mt-5 text-[0.98rem] leading-7 text-slate-600 sm:mt-6 sm:text-lg">
                Décrivez ce que vous voulez faire, en une phrase. Loky retrouve le bon bien, le bon locataire, prépare l'action et vous demande de confirmer — avant d'écrire quoi que ce soit sur votre compte.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:mt-8">
                <Link
                  href="/mon-compte?mode=register&redirect=/espace-bailleur"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#635bff] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 hover:bg-[#4f46e5]"
                >
                  Créer mon espace bailleur →
                </Link>
                <Link
                  href="/tarifs"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#3f37c9] hover:bg-slate-50"
                >
                  Voir les tarifs →
                </Link>
              </div>
            </div>

            {/* Mockups de conversation */}
            <div data-scroll-reveal data-reveal-delay="300" className="relative mx-auto mt-12 grid gap-5 overflow-hidden rounded-[1.5rem] bg-slate-950 p-5 sm:mt-16 sm:rounded-[2rem] sm:p-8 lg:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/40 backdrop-blur sm:p-6">
                <div className="space-y-3.5">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm">
                      Quel est mon taux d'occupation en ce moment ?
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <img src="/loky-avatar.png" alt="Loky" className="mt-0.5 h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm" />
                    <div className="max-w-[85%] space-y-2.5 rounded-2xl rounded-tl-md bg-gradient-to-br from-indigo-600 to-cyan-500 px-4 py-3 text-sm text-white shadow-sm">
                      <p>92 % sur 12 mois glissants — 6 logements occupés sur 7.</p>
                      <div className="space-y-1.5 rounded-xl bg-white/15 p-3 text-xs">
                        <p>🏠 6 occupés / 1 vacant</p>
                        <p>🔄 2 nouvelles entrées locataire sur 12 mois</p>
                      </div>
                      <p className="text-white/80">Le studio Bellevue est vacant depuis 18 jours — je vous ouvre Biens pour le détail ?</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/40 backdrop-blur sm:p-6">
                <div className="space-y-3.5">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm">
                      Révise le loyer de Julien selon le dernier IRL publié
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <img src="/loky-avatar.png" alt="Loky" className="mt-0.5 h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm" />
                    <div className="max-w-[85%] space-y-2.5 rounded-2xl rounded-tl-md bg-gradient-to-br from-indigo-600 to-cyan-500 px-4 py-3 text-sm text-white shadow-sm">
                      <p>Le loyer de Julien peut passer de 720 € à 738,50 € (IRL T2 2026).</p>
                      <div className="space-y-1.5 rounded-xl bg-white/15 p-3 text-xs">
                        <p>🏠 Studio Bellevue · Julien Morel</p>
                        <p>📈 720 € → 738,50 €/mois</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm">
                      Confirmer
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-[42px]">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                      ✓ Révision envoyée à Julien — nouveau loyer 738,50 €
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-10 pt-12 sm:pb-16 sm:pt-20">
          <div className="mx-auto max-w-6xl space-y-6">
            {/* Comment ça marche */}
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
              <div className="max-w-2xl">
                <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Comment ça marche</p>
                <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Un agent qui agit, pas un chatbot qui renvoie vers un écran.
                </h2>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    step: "01",
                    title: "Vous décrivez la demande",
                    text: "En une phrase, comme à un collaborateur : « confirme le loyer de Karim », « renvoie la quittance de janvier à Marie »...",
                    icon: ChatBubbleLeftRightIcon,
                  },
                  {
                    step: "02",
                    title: "Loky va chercher les vraies données",
                    text: "Jamais une estimation générique : Loky interroge directement votre compte (biens, baux, paiements) pour répondre ou préparer l'action.",
                    icon: BoltIcon,
                  },
                  {
                    step: "03",
                    title: "Vous validez avant toute écriture",
                    text: "Pour une action qui modifie vos données, une carte de confirmation récapitule bien, locataire et montant. Rien n'est écrit sans votre accord.",
                    icon: ShieldCheckIcon,
                  },
                ].map((item, i) => (
                  <div key={item.step} data-scroll-reveal data-reveal-delay={`${i * 80}`}>
                    <StepCard step={item.step} title={item.title} text={item.text} icon={item.icon} />
                  </div>
                ))}
              </div>
            </section>

            {/* Capacités */}
            <section>
              <div className="max-w-2xl pb-3">
                <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Ce que Loky sait faire</p>
                <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Six familles d'actions, avec de vrais exemples.
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {capabilities.map((capability, i) => (
                  <div key={capability.title} data-scroll-reveal data-reveal-delay={`${i * 80}`}>
                    <CapabilityCard capability={capability} />
                  </div>
                ))}
              </div>
            </section>

            {/* Deux exemples supplémentaires en situation */}
            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
              <div className="p-5 pb-0 sm:p-8 sm:pb-0">
                <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">En situation</p>
                <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Deux autres exemples, du quotidien à la recherche de locataire.
                </h2>
              </div>

              <div data-scroll-reveal data-reveal-delay="200" className="mt-6 grid gap-5 bg-slate-950 p-5 sm:p-8 lg:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/40 backdrop-blur sm:p-6">
                  <div className="space-y-3.5">
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm">
                        Confirme le loyer du Studio Bellevue, Karim vient de payer
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <img src="/loky-avatar.png" alt="Loky" className="mt-0.5 h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm" />
                      <div className="max-w-[85%] space-y-2.5 rounded-2xl rounded-tl-md bg-gradient-to-br from-indigo-600 to-cyan-500 px-4 py-3 text-sm text-white shadow-sm">
                        <p>Je confirme le loyer de septembre — la quittance PDF sera générée automatiquement.</p>
                        <div className="space-y-1.5 rounded-xl bg-white/15 p-3 text-xs">
                          <p>🏠 Studio Bellevue · Karim Haddad</p>
                          <p>📄 Loyer septembre 2026 → quittance générée</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm">
                        Confirmer
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-[42px]">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                        ✓ Paiement confirmé — quittance générée pour Karim
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/40 backdrop-blur sm:p-6">
                  <div className="space-y-3.5">
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm">
                        Trouve-moi un locataire pour le T2 qui vient de se libérer
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <img src="/loky-avatar.png" alt="Loky" className="mt-0.5 h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm" />
                      <div className="max-w-[85%] space-y-2.5 rounded-2xl rounded-tl-md bg-gradient-to-br from-indigo-600 to-cyan-500 px-4 py-3 text-sm text-white shadow-sm">
                        <p>Je publie une annonce pour recevoir des candidatures.</p>
                        <div className="space-y-1.5 rounded-xl bg-white/15 p-3 text-xs">
                          <p>🏠 T2 Bellevue · 780 € + charges</p>
                          <p>📢 Annonce prête à publier</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm">
                        Confirmer
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-[42px]">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                        ✓ Annonce publiée — T2 Bellevue
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Plan gratuit / tarifs */}
            <section className="flex flex-col items-start justify-between gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 shadow-sm sm:flex-row sm:items-center sm:rounded-[2rem] sm:p-8">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-cyan-300">Disponibilité</p>
                <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">Essai gratuit, puis accès complet dès lokt·one à 6,90 €/mois.</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  Le plan gratuit inclut un essai de 8 messages à vie avec Loky. Usage étendu sur les plans lokt·plus et Pro/agence.
                </p>
              </div>
              <Link href="/tarifs" className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                Voir les tarifs →
              </Link>
            </section>

            {/* FAQ */}
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

      {/* Maillage → pages produit */}
      <div className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Découvrir lokt.fr</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="/outil-gestion-locative"
              className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-lg">🗂️</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Gestion locative lokt.fr</p>
                <p className="mt-0.5 text-[0.8rem] text-slate-500">Bail, loyers, quittances, alertes et finance — la plateforme dans laquelle vit Loky.</p>
                <p className="mt-2 text-[0.78rem] font-semibold text-indigo-600">Voir la page produit →</p>
              </div>
            </a>
            <a
              href="/gestion-locative-lmnp"
              className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-lg">🛋️</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Gestion locative LMNP</p>
                <p className="mt-0.5 text-[0.8rem] text-slate-500">Inventaire meublé, quittances et fiscalité — avec Loky pour aller plus vite au quotidien.</p>
                <p className="mt-2 text-[0.78rem] font-semibold text-indigo-600">Voir la page LMNP →</p>
              </div>
            </a>
          </div>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
