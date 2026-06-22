import Head from "next/head";
import Link from "next/link";
import { CheckIcon, XMarkIcon, MinusIcon } from "@heroicons/react/24/outline";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

const siteUrl = "https://lokt.fr";
const metaTitle = "Comparatif logiciel gestion locative : pourquoi choisir lokt.fr | lokt.fr";
const metaDesc =
  "Tableur, agence, logiciel généraliste ou lokt.fr ? Comparez les approches et choisissez l'outil de gestion locative adapté aux propriétaires bailleurs indépendants.";
const pageUrl = `${siteUrl}/comparatif-logiciel-gestion-locative`;

type Mark = "yes" | "no" | "partial";

const criteria: { label: string; marks: [Mark, Mark, Mark, Mark] }[] = [
  { label: "Gratuit ou sans abonnement élevé",          marks: ["yes",     "no",      "partial", "yes"]     },
  { label: "Pensé pour 1 à 10 biens",                   marks: ["partial", "no",      "no",      "yes"]     },
  { label: "Quittances générées automatiquement",        marks: ["no",      "yes",     "partial", "yes"]     },
  { label: "Suivi des paiements et retards",             marks: ["partial", "yes",     "partial", "yes"]     },
  { label: "Relances et alertes loyers",                 marks: ["no",      "yes",     "partial", "yes"]     },
  { label: "Baux et documents stockés",                  marks: ["no",      "yes",     "partial", "yes"]     },
  { label: "Simulateurs (rentabilité, capacité…)",       marks: ["partial", "no",      "no",      "yes"]     },
  { label: "Mise en place en moins de 10 min",           marks: ["yes",     "no",      "no",      "yes"]     },
  { label: "Sans intermédiaire entre bailleur/locataire",marks: ["yes",     "no",      "yes",     "yes"]     },
  { label: "LMNP : inventaire, charges, suivi",         marks: ["no",      "partial", "partial", "yes"]     },
];

const columns = ["Tableur Excel / Sheets", "Agence locative", "Logiciel généraliste", "lokt.fr"];
const isLokt = (i: number) => i === 3;

function MarkIcon({ mark, lokt }: { mark: Mark; lokt: boolean }) {
  if (mark === "yes")
    return <CheckIcon className={"h-5 w-5 " + (lokt ? "text-[#635bff]" : "text-emerald-500")} aria-label="Oui" />;
  if (mark === "no")
    return <XMarkIcon className="h-5 w-5 text-red-400" aria-label="Non" />;
  return <MinusIcon className="h-5 w-5 text-amber-400" aria-label="Partiel" />;
}

const whyNot = [
  {
    label: "Tableur Excel ou Google Sheets",
    icon: "📊",
    pros: ["Gratuit", "Flexible", "Familier"],
    cons: [
      "Aucune automatisation : quittances, relances, alertes à faire à la main",
      "Pas de génération PDF ou d'envoi au locataire",
      "Fragile : une formule cassée ou un fichier mal partagé, tout s'effondre",
      "Ne scale pas au-delà de 2 biens sans devenir ingérable",
    ],
  },
  {
    label: "Une agence de gestion locative",
    icon: "🏢",
    pros: ["Délégation totale", "Réseau de locataires"],
    cons: [
      "6 à 10 % des loyers prélevés chaque mois — sur 10 ans, ça représente une année de loyer offerte",
      "Vous perdez le lien direct avec votre locataire",
      "Peu de visibilité sur ce qui se passe réellement",
      "Inadapté si vous gérez vous-même et souhaitez juste un outil d'appui",
    ],
  },
  {
    label: "Un logiciel de gestion généraliste",
    icon: "💻",
    pros: ["Fonctionnalités complètes", "Support client"],
    cons: [
      "Conçu pour les professionnels (agences, syndics) : interface surdimensionnée pour un particulier",
      "Abonnement mensuel souvent élevé pour 1 à 5 biens",
      "Pas de simulateurs pour décider d'un investissement",
      "Aucune cohérence entre l'avant-achat et la gestion quotidienne",
    ],
  },
];

const faq = [
  {
    q: "Est-ce que lokt.fr est gratuit ?",
    a: "lokt.fr propose une offre gratuite pour démarrer avec 1 logement : quittances, bail, suivi des loyers et simulateurs inclus. Les plans payants débloquent plusieurs biens et des fonctionnalités avancées.",
  },
  {
    q: "Lokt.fr convient-il aux propriétaires LMNP ?",
    a: "Oui. lokt.fr est pensé pour la location meublée et nue. Il gère l'inventaire, les quittances LMNP, les charges et le suivi mensuel — sans nécessiter de comptable pour les opérations courantes.",
  },
  {
    q: "Puis-je utiliser lokt.fr si j'ai déjà un tableur Excel ?",
    a: "Oui, la transition est rapide. Vous importez vos biens, locataires et baux en quelques minutes. Vos données Excel deviennent inutiles dès que lokt.fr génère vos premières quittances et relances automatiquement.",
  },
  {
    q: "Lokt.fr remplace-t-il une agence de gestion ?",
    a: "Pour les propriétaires qui veulent garder la main sur leur patrimoine, oui. Lokt.fr automatise les tâches répétitives (quittances, relances, suivi) sans vous retirer le contrôle ni prélever un pourcentage sur les loyers.",
  },
  {
    q: "Quelle est la différence entre lokt.fr et un logiciel classique ?",
    a: "Lokt.fr est conçu exclusivement pour les bailleurs indépendants gérant 1 à 10 biens. Il combine les simulateurs d'aide à la décision (rentabilité, capacité, prêt relais) et la gestion quotidienne (loyers, quittances, baux) dans un seul outil — sans la complexité des logiciels professionnels.",
  },
  {
    q: "Est-ce que lokt.fr propose des simulateurs immobiliers ?",
    a: "Oui. Lokt.fr inclut un simulateur de rentabilité locative, de capacité d'emprunt, de prêt relais, de plus-value et de parc immobilier. C'est ce qui le distingue : vous décidez d'investir avec les bons chiffres, puis vous gérez depuis le même outil.",
  },
];

const schemas = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: metaTitle,
    description: metaDesc,
    url: pageUrl,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "lokt.fr",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Outil de gestion locative gratuit pour propriétaire bailleur indépendant.",
    url: siteUrl,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Comparatif logiciel gestion locative", item: pageUrl },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  },
];

export default function ComparatifPage() {
  return (
    <div className="min-h-screen bg-[#f7f7fb]">
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        {schemas.map((s, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
        ))}
      </Head>

      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-xs text-slate-500" aria-label="Fil d'Ariane">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link href="/" className="hover:text-slate-700">Accueil</Link></li>
            <li aria-hidden="true">›</li>
            <li className="text-slate-700">Comparatif logiciel gestion locative</li>
          </ol>
        </nav>

        {/* Hero */}
        <header className="mb-12">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-indigo-600">Comparatif</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
            Quel outil de gestion locative choisir ?
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            Tableur, agence, logiciel généraliste ou solution dédiée : chaque approche a ses limites.
            Voici pourquoi les propriétaires bailleurs indépendants choisissent lokt.fr.
          </p>
        </header>

        {/* Comparison table */}
        <section className="mb-16 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-4 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500 w-2/5">
                    Critère
                  </th>
                  {columns.map((col, i) => (
                    <th
                      key={col}
                      className={
                        "px-3 py-4 text-center text-[0.75rem] font-semibold uppercase tracking-wide " +
                        (isLokt(i)
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-500")
                      }
                    >
                      {isLokt(i) ? (
                        <span className="inline-flex items-center gap-1">
                          {col}
                          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-indigo-700 normal-case tracking-normal">
                            Notre choix
                          </span>
                        </span>
                      ) : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteria.map((row, ri) => (
                  <tr key={row.label} className={"border-b border-slate-50 " + (ri % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                    <td className="px-5 py-3 font-medium text-slate-800">{row.label}</td>
                    {row.marks.map((mark, ci) => (
                      <td
                        key={ci}
                        className={"px-3 py-3 text-center " + (isLokt(ci) ? "bg-indigo-50/60" : "")}
                      >
                        <div className="flex justify-center">
                          <MarkIcon mark={mark} lokt={isLokt(ci)} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-5 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><CheckIcon className="h-4 w-4 text-emerald-500" /> Oui / Inclus</span>
            <span className="flex items-center gap-1.5"><XMarkIcon className="h-4 w-4 text-red-400" /> Non / Absent</span>
            <span className="flex items-center gap-1.5"><MinusIcon className="h-4 w-4 text-amber-400" /> Partiel / À configurer</span>
          </div>
        </section>

        {/* Why not sections */}
        <section className="mb-16 space-y-6">
          <h2 className="text-2xl font-bold text-slate-950">Pourquoi les autres approches atteignent leurs limites</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {whyNot.map(({ label, icon, pros, cons }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-2xl">{icon}</p>
                <h3 className="mt-2 text-sm font-bold text-slate-900">{label}</h3>
                <div className="mt-3 space-y-1">
                  {pros.map((p) => (
                    <p key={p} className="flex items-start gap-1.5 text-xs text-emerald-700">
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {p}
                    </p>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                  {cons.map((c) => (
                    <p key={c} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <XMarkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      {c}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Why lokt.fr */}
        <section className="mb-16 overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">Ce que lokt.fr apporte de différent</h2>
          <p className="mt-3 text-slate-600 leading-relaxed max-w-2xl">
            Lokt.fr est conçu pour le bailleur qui veut gérer lui-même, sans déléguer à une agence et sans se noyer dans un tableur.
            L'idée de départ : une seule plateforme couvre toute la vie d'un investissement locatif.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Décision avant achat",
                body: "Simulateurs intégrés : rentabilité nette, capacité d'emprunt, prêt relais, plus-value. Vous investissez avec les bons chiffres.",
                href: "/calculettes",
                cta: "Voir les calculettes",
              },
              {
                title: "Gestion après mise en location",
                body: "Baux, quittances PDF, suivi des loyers, relances, dépôt de garantie, documents — tout depuis un tableau de bord.",
                href: "/outil-gestion-locative",
                cta: "Voir l'outil",
              },
              {
                title: "Taillé pour les particuliers",
                body: "Pas de jargon professionnel. Mise en place en moins de 10 minutes. Gratuit jusqu'à 1 bien, sans engagement.",
                href: "/espace-bailleur",
                cta: "Essayer gratuitement",
              },
              {
                title: "LMNP intégré",
                body: "Inventaire obligatoire, charges, suivi des recettes — adapté aussi bien à la location meublée qu'à la location nue.",
                href: "/gestion-locative-lmnp",
                cta: "En savoir plus",
              },
              {
                title: "Zéro commission",
                body: "Contrairement à une agence, lokt.fr ne prélève rien sur vos loyers. Un abonnement fixe, prévisible.",
                href: "/tarifs",
                cta: "Voir les tarifs",
              },
              {
                title: "Données structurées",
                body: "Score de gestion, taux d'encaissement, occupation du parc, retards — vous pilotez avec des indicateurs réels.",
                href: "/espace-bailleur",
                cta: "Accéder au cockpit",
              },
            ].map(({ title, body, href, cta }) => (
              <div key={title} className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-[0.82rem] leading-relaxed text-slate-600">{body}</p>
                <Link
                  href={href}
                  className="mt-3 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {cta} →
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mb-16 rounded-3xl bg-slate-950 px-8 py-10 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Essai gratuit</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Gérez votre patrimoine locatif depuis un seul endroit</h2>
          <p className="mt-3 text-[0.9rem] text-white/60">
            Commencez avec 1 bien, sans carte bancaire. Quittances, suivi des loyers et simulateurs inclus dès le départ.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/espace-bailleur"
              className="rounded-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
            >
              Accéder à l'espace bailleur →
            </Link>
            <Link
              href="/tarifs"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Voir les tarifs
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-bold text-slate-950">Questions fréquentes</h2>
          <div className="space-y-3">
            {faq.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm open:border-indigo-200"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 group-open:text-indigo-700">
                  {q}
                </summary>
                <p className="mt-3 text-[0.85rem] leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Internal links */}
        <section>
          <h2 className="mb-5 text-base font-bold text-slate-950">Pour aller plus loin</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Outil de gestion locative", href: "/outil-gestion-locative" },
              { label: "Gestion locative LMNP", href: "/gestion-locative-lmnp" },
              { label: "Modèle quittance PDF gratuit", href: "/modele-quittance-loyer-pdf" },
              { label: "Suivi loyers impayés", href: "/suivi-loyers-impayes" },
              { label: "Simulateur rentabilité locative", href: "/investissement" },
              { label: "Gestion locative pour particulier", href: "/gestion-locative-proprietaire-particulier" },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
              >
                {label} →
              </Link>
            ))}
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
