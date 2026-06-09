import Head from "next/head";
import Link from "next/link";
import {
  ArrowRightIcon,
  BanknotesIcon,
  CalculatorIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DocumentChartBarIcon,
  DocumentTextIcon,
  HomeModernIcon,
  ScaleIcon,
  ShieldCheckIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/outils-proprietaire`;
const ogImage = `${siteUrl}/ESPACEBAILLEURSCREENSHOT.png`;
const title = "Outils propriétaire bailleur : eau, charges, TEOM et régularisation | lokt.fr";
const description =
  "Boîte à outils propriétaire bailleur pour calculer une répartition d’eau, des charges locatives, la TEOM récupérable et une régularisation annuelle, avec synthèse et import finance après validation.";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const tools = [
  {
    name: "Répartition facture d’eau",
    short: "Transformer une facture générale en montants dus par occupant.",
    inputs: ["Facture fournisseur", "Compteur général", "Relevés individuels", "Part fixe"],
    output: "Montant dû par occupant, avec période, justificatifs et historique.",
    icon: CalculatorIcon,
    tone: "from-cyan-500 to-emerald-400",
  },
  {
    name: "Répartition des charges",
    short: "Ventiler un montant global selon tantièmes, lots concernés ou quote-part.",
    inputs: ["Montant à répartir", "Lots", "Tantièmes", "Période"],
    output: "Quote-part claire par lot, exploitable pour suivi ou demande locataire.",
    icon: ScaleIcon,
    tone: "from-indigo-500 to-sky-400",
  },
  {
    name: "TEOM récupérable",
    short: "Isoler la taxe d’ordures ménagères récupérable depuis la taxe foncière.",
    inputs: ["Taxe foncière", "Montant TEOM", "Prorata d’occupation", "Locataire"],
    output: "Montant récupérable documenté, hors frais non récupérables.",
    icon: DocumentTextIcon,
    tone: "from-emerald-600 to-teal-300",
  },
  {
    name: "Régularisation des charges",
    short: "Comparer provisions versées et dépenses réelles pour calculer le solde.",
    inputs: ["Provisions", "Dépenses réelles", "Période", "Justificatifs"],
    output: "Solde à demander au locataire ou à lui rembourser.",
    icon: BanknotesIcon,
    tone: "from-violet-500 to-cyan-400",
  },
];

const workflow = [
  ["Saisir", "Les montants, périodes, lots et occupants sont guidés pour éviter le tableur fragile."],
  ["Contrôler", "La formule est visible, les incohérences ressortent et les totaux restent lisibles."],
  ["Justifier", "La synthèse garde le contexte : période, méthode, documents et résultat par occupant."],
  ["Suivre", "Après validation, le résultat peut alimenter la finance du bien sans double saisie."],
];

const faq = [
  {
    q: "À quoi servent les outils propriétaire bailleur de lokt.fr ?",
    a: "Ils servent à transformer des calculs locatifs sensibles en résultats exploitables : répartition d’eau, charges, TEOM récupérable et régularisation annuelle. L’objectif n’est pas seulement d’obtenir un chiffre, mais de garder la période, la méthode, les justificatifs et l’historique.",
  },
  {
    q: "Quelle différence avec un tableau Excel ?",
    a: "Un tableau peut calculer, mais il ne guide pas le workflow métier. lokt.fr structure la saisie, indique la formule, conserve les informations utiles et prépare l’import en finance uniquement après validation de l’utilisateur.",
  },
  {
    q: "Les outils sont-ils inclus dans l’offre gratuite ?",
    a: "Non. La boîte à outils bailleur est pensée comme une fonctionnalité avancée de l’offre Essentiel. L’offre gratuite reste centrée sur la gestion du premier logement, tandis que les outils de calcul et de régularisation sont réservés aux besoins de pilotage plus avancés.",
  },
  {
    q: "Peut-on relier le résultat à la finance du logement ?",
    a: "Oui, le principe est de proposer un import vers la finance après validation. Le propriétaire garde la main : rien n’est écrit automatiquement sans confirmation.",
  },
  {
    q: "L’outil de répartition d’eau gère-t-il plusieurs compteurs ?",
    a: "Oui. Il est prévu pour une facture générale avec compteur principal, compteurs individuels, occupant par lot, relevés, photos et historique d’une facture à l’autre.",
  },
];

export default function OutilsProprietairePage() {
  const jsonLdItems = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "lokt.fr - Outils propriétaire bailleur",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: pageUrl,
      image: ogImage,
      description,
      featureList: [
        "Répartition facture d’eau",
        "Répartition des charges par tantièmes",
        "Calcul TEOM récupérable",
        "Régularisation des charges locatives",
        "Synthèse de calcul",
        "Import finance après validation",
      ],
      offers: {
        "@type": "Offer",
        price: "9.90",
        priceCurrency: "EUR",
        category: "Abonnement Essentiel",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Outils propriétaire", item: pageUrl },
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

  return (
    <div className="min-h-screen bg-[#f6f9fc] text-slate-950">
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
        <meta property="og:image:alt" content="Boîte à outils propriétaire bailleur lokt.fr" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        {jsonLdItems.map((schema, index) => (
          <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        ))}
      </Head>

      <AppHeader staticMode />

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white px-4 py-14 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.02fr,0.98fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                Boîte à outils bailleur incluse dans Essentiel
              </p>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-6xl">
                Calculer, justifier, régulariser. Sans repartir d’un tableur.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                lokt.fr aide les propriétaires bailleurs à traiter les calculs qui demandent de la rigueur : eau, charges, TEOM et
                régularisation. Chaque outil guide la saisie, explique le résultat et prépare le suivi financier après validation.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/tarifs"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-200 hover:bg-slate-800"
                >
                  Voir l’offre Essentiel <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/mon-compte?mode=register&redirect=%2Fespace-bailleur"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Créer mon espace gratuit
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-[#f6f9fc] p-4 shadow-xl shadow-slate-200/70">
              <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Facture d’eau - juin 2026</p>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">Prêt à valider</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Total facture", "842,60 EUR"],
                    ["Conso globale", "133 m3"],
                    ["Écart relevés", "0,4 m3"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-400">{label}</p>
                      <p className="mt-2 text-lg font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {["Appartement A - 38,20 EUR", "Appartement B - 51,90 EUR", "Maison principale - 122,40 EUR"].map((line) => (
                    <div key={line} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm text-slate-950">
                      <span className="font-semibold">{line}</span>
                      <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {["Formule visible", "Justificatifs", "Import finance"].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">Outils inclus</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Des calculateurs pensés pour une décision de gestion.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Le résultat doit pouvoir être relu, expliqué et suivi dans le temps. C’est ce qui différencie un outil métier d’une simple
                cellule Excel.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <article key={tool.name} className="overflow-hidden rounded-[1.55rem] border border-slate-200 bg-white shadow-sm">
                    <div className={cx("h-1.5 bg-gradient-to-r", tool.tone)} />
                    <div className="flex min-h-[430px] flex-col p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-950 ring-1 ring-slate-200">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">{tool.name}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{tool.short}</p>
                      <div className="mt-5 flex-1">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Données guidées</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tool.inputs.map((input) => (
                            <span key={input} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                              {input}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-950">{tool.output}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-14 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr,1.1fr] lg:items-start">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Workflow</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Pas seulement un calcul. Un parcours vérifiable.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Les outils servent aux moments où le propriétaire doit être clair : demander un complément, rembourser, répartir ou justifier une
                charge. Le workflow garde le raisonnement avec le résultat.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {workflow.map(([step, text], index) => (
                <div key={step} className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-[#635bff]">0{index + 1}</p>
                  <h3 className="mt-3 text-lg font-semibold text-slate-950">{step}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                {
                  icon: TableCellsIcon,
                  title: "Moins fragile qu’un tableur",
                  text: "Les champs attendus sont contextualisés : période, bien, occupant, quote-part, formule et justificatifs.",
                },
                {
                  icon: DocumentChartBarIcon,
                  title: "Connecté au pilotage",
                  text: "Le résultat peut devenir une ligne finance, mais seulement après validation explicite du propriétaire.",
                },
                {
                  icon: ShieldCheckIcon,
                  title: "Plus simple à expliquer",
                  text: "Chaque calcul produit une synthèse lisible pour comprendre ce qui est dû, récupérable ou remboursable.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-[1.55rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <Icon className="h-7 w-7 text-[#635bff]" />
                    <h3 className="mt-5 text-xl font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-950 px-4 py-14 text-white sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr,0.82fr] lg:items-center">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cyan-300">Inclus dans Essentiel</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Une boîte à outils pour les bailleurs qui veulent arrêter de bricoler leurs régularisations.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                L’offre Essentiel ajoute les outils, le pilotage financier, l’aide à la déclaration et les exports. Starter reste centré sur les
                quittances et alertes. Gratuit permet de démarrer avec un logement actif.
              </p>
            </div>
            <div className="rounded-[1.55rem] border border-white/10 bg-white/[0.06] p-5">
              <div className="flex items-center gap-3">
                <HomeModernIcon className="h-7 w-7 text-cyan-300" />
                <div>
                  <p className="text-sm font-semibold text-white">Essentiel</p>
                  <p className="text-xs text-slate-400">Outils bailleur + finance + déclaration</p>
                </div>
              </div>
              <p className="mt-5 text-3xl font-semibold">9,90 EUR / mois</p>
              <Link
                href="/tarifs"
                className="mt-5 inline-flex w-full min-h-12 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100"
              >
                Comparer les offres <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Questions fréquentes sur les outils bailleur</h2>
            <div className="mt-8 divide-y divide-slate-200 rounded-[1.55rem] border border-slate-200 bg-white">
              {faq.map((item) => (
                <details key={item.q} className="group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-slate-950">
                    {item.q}
                    <span className="text-xl text-slate-400 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
