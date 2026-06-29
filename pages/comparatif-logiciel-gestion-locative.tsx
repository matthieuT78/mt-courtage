import Head from "next/head";
import Link from "next/link";
import { CheckIcon, XMarkIcon, MinusIcon } from "@heroicons/react/24/outline";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

const siteUrl = "https://lokt.fr";
const metaTitle = "Comparatif logiciels gestion locative 2026 : Rentila, Smovin, lokt.fr | lokt.fr";
const metaDesc =
  "Comparatif complet des meilleurs logiciels de gestion locative en 2026 : Rentila, Smovin, lokt.fr. Tableau de fonctionnalités, tarifs, points forts et limites de chaque outil pour les bailleurs indépendants.";
const pageUrl = `${siteUrl}/comparatif-logiciel-gestion-locative`;
const updatedAt = "Juin 2026";

type Mark = "yes" | "no" | "partial";

const criteria: { label: string; marks: [Mark, Mark, Mark, Mark] }[] = [
  { label: "Gratuit pour démarrer",                    marks: ["yes",     "yes",     "no",      "yes"]     },
  { label: "Pensé pour 1 à 10 biens",                  marks: ["partial", "yes",     "partial", "yes"]     },
  { label: "Quittances PDF automatiques",               marks: ["no",      "yes",     "yes",     "yes"]     },
  { label: "Suivi des paiements et retards",            marks: ["partial", "yes",     "yes",     "yes"]     },
  { label: "Alertes bailleur (retard, IRL, rappels)",   marks: ["no",      "no",      "partial", "yes"]     },
  { label: "Relances locataires automatiques",          marks: ["no",      "partial", "yes",     "yes"]     },
  { label: "Baux et documents stockés",                 marks: ["no",      "yes",     "yes",     "yes"]     },
  { label: "Révision IRL automatique",                  marks: ["no",      "partial", "yes",     "yes"]     },
  { label: "Dossier de candidature en ligne (lien, scoring, RGPD)", marks: ["no", "no", "no", "yes"] },
  { label: "Simulateurs (rentabilité, capacité…)",      marks: ["partial", "no",      "no",      "yes"]     },
  { label: "LMNP : inventaire, charges, suivi",         marks: ["no",      "partial", "partial", "yes"]     },
  { label: "Mise en place en moins de 10 min",          marks: ["yes",     "yes",     "no",      "yes"]     },
  { label: "Interface claire pour particuliers",        marks: ["yes",     "yes",     "partial", "yes"]     },
  { label: "Zéro commission sur les loyers",            marks: ["yes",     "yes",     "yes",     "yes"]     },
];

const columns = ["Tableur Excel", "Rentila", "Smovin", "lokt.fr"];
const isLokt = (i: number) => i === 3;

function MarkIcon({ mark, lokt }: { mark: Mark; lokt: boolean }) {
  if (mark === "yes")
    return <CheckIcon className={"h-5 w-5 " + (lokt ? "text-[#635bff]" : "text-emerald-500")} aria-label="Oui" />;
  if (mark === "no")
    return <XMarkIcon className="h-5 w-5 text-red-400" aria-label="Non" />;
  return <MinusIcon className="h-5 w-5 text-amber-400" aria-label="Partiel" />;
}

const tools = [
  {
    name: "Tableur Excel / Google Sheets",
    icon: "📊",
    price: "Gratuit",
    ideal: "Propriétaire d'un seul bien, à l'aise avec les formules",
    pros: ["Aucun coût", "Entière liberté de personnalisation", "Pas de dépendance à un éditeur"],
    cons: [
      "Zéro automatisation : quittances, relances et suivi à refaire chaque mois à la main",
      "Pas de génération PDF ni d'envoi directement au locataire",
      "Fragile : une formule cassée ou un mauvais partage, tout s'effondre",
      "Ingérable dès 2-3 biens sans y passer plusieurs heures par mois",
    ],
    verdict: "Acceptable pour un seul bien si vous avez du temps. Dépasse rapidement ses limites dès que vous gérez plusieurs locations ou souhaitez des documents professionnels.",
  },
  {
    name: "Rentila",
    icon: "🏠",
    price: "Gratuit (limité) · ~9 €/mois au-delà",
    ideal: "Bailleur débutant souhaitant un outil simple et gratuit",
    pros: [
      "Offre gratuite pour démarrer avec 1 à 2 biens",
      "Interface claire et accessible sans formation",
      "Génération de quittances et gestion des baux incluse",
      "Bonne notoriété, communauté d'utilisateurs active",
    ],
    cons: [
      "Fonctionnalités avancées (relances automatiques, révision IRL) limitées ou absentes sur le plan gratuit",
      "Aucun simulateur d'investissement : vous devez sortir de l'outil pour analyser un achat",
      "Suivi LMNP (inventaire, charges meublées) limité",
      "Interface web vieillissante, peu optimisée mobile",
      "Pas d'indicateurs de performance du parc (taux d'occupation, score de gestion)",
    ],
    verdict: "Bon point d'entrée gratuit pour un premier bien. Les limites se font sentir dès que vous avez 2-3 locations ou un profil LMNP, ou quand vous cherchez à analyser un nouvel investissement.",
  },
  {
    name: "Smovin",
    icon: "💼",
    price: "À partir de ~15 €/mois · Pas d'offre gratuite",
    ideal: "Propriétaire de 3 biens et plus cherchant un outil professionnel complet",
    pros: [
      "Fonctionnalités complètes : quittances, révision IRL, relances, signature électronique",
      "Interface moderne et bien pensée pour la gestion multi-biens",
      "Exports comptables et suivi financier avancé",
      "Application mobile correcte",
    ],
    cons: [
      "Aucun plan gratuit : engagement mensuel immédiat",
      "Onboarding long, prise en main de plusieurs heures",
      "Conçu pour des bailleurs professionnels ou semi-professionnels — surdimensionné pour 1 à 3 biens",
      "Pas de simulateurs immobiliers (rentabilité, capacité d'emprunt, plus-value)",
      "Tarif mensuel fixe même en période sans activité",
    ],
    verdict: "Excellent outil si vous gérez 5 biens ou plus et cherchez une solution professionnelle. Pour un particulier avec 1 à 4 biens, la complexité et le coût mensuel sont difficiles à justifier.",
  },
];

const faq = [
  {
    q: "Quelle est la différence entre Rentila et lokt.fr ?",
    a: "Rentila est un logiciel de gestion locative pure : quittances, baux, suivi des loyers. lokt.fr couvre la même gestion quotidienne ET intègre des simulateurs d'aide à la décision (rentabilité, capacité d'emprunt, prêt relais, plus-value) ainsi qu'un module de candidature en ligne. Concrètement : avec lokt.fr, vous sélectionnez vos locataires, analysez un investissement et gérez le quotidien depuis le même outil, sans jongler entre plusieurs plateformes.",
  },
  {
    q: "lokt.fr permet-il de recevoir des dossiers de candidature en ligne ?",
    a: "Oui. À partir du plan lokt·one (4,90 €/mois), lokt.fr génère un lien dédié pour chaque annonce. Les candidats remplissent leur dossier à leur rythme — le brouillon est sauvegardé automatiquement. Vous recevez les dossiers dans votre tableau de bord avec un scoring règle-par-règle (revenus, stabilité professionnelle, garant) pour comparer les profils objectivement. Les données des candidats non retenus sont supprimées à la clôture de l'annonce, conformément au RGPD. Rentila et Smovin ne proposent pas de module équivalent.",
  },
  {
    q: "Lokt.fr est-il mieux que Smovin ?",
    a: "Ça dépend de votre profil. Smovin est plus complet pour des bailleurs professionnels gérant 10+ biens. lokt.fr est plus adapté aux propriétaires particuliers avec 1 à 10 biens : mise en place en moins de 10 minutes, gratuit pour commencer, et les simulateurs immobiliers sont intégrés — ce que Smovin n'a pas. Pour la grande majorité des bailleurs indépendants, lokt.fr est suffisant et moins coûteux.",
  },
  {
    q: "Peut-on migrer depuis Rentila vers lokt.fr ?",
    a: "Oui. La migration se fait manuellement en quelques minutes : vous créez vos biens, ajoutez vos locataires et renseignez les informations de bail. Il n'y a pas d'import automatique depuis Rentila, mais la simplicité de lokt.fr fait que la saisie initiale prend moins de 15 minutes par bien.",
  },
  {
    q: "Quel logiciel choisir pour la location meublée (LMNP) ?",
    a: "lokt.fr est conçu pour la location meublée et nue. Il intègre la gestion de l'inventaire obligatoire en meublé, le suivi des charges LMNP et les quittances adaptées. Rentila a un support LMNP partiel. Smovin couvre le LMNP mais avec une complexité supérieure. Pour un bailleur LMNP particulier, lokt.fr offre le meilleur rapport fonctionnalités / simplicité.",
  },
  {
    q: "Est-ce que lokt.fr est gratuit ?",
    a: "lokt.fr propose une offre gratuite pour démarrer avec 1 logement : quittances PDF, bail, suivi des loyers et accès aux simulateurs inclus. Les plans payants débloquent plusieurs biens, les relances automatiques et des fonctionnalités avancées — à un tarif fixe sans commission sur les loyers.",
  },
  {
    q: "Lokt.fr remplace-t-il une agence de gestion locative ?",
    a: "Pour les propriétaires qui veulent garder la main sur leur patrimoine, oui. lokt.fr automatise les tâches répétitives (quittances, relances, suivi des paiements) sans prélever 6 à 10 % sur vos loyers comme le ferait une agence. Vous gardez le lien direct avec votre locataire et la visibilité complète sur vos flux.",
  },
  {
    q: "Lokt.fr fonctionne-t-il sur mobile ?",
    a: "Oui. lokt.fr est accessible depuis n'importe quel navigateur mobile. Vous pouvez consulter votre tableau de bord, suivre les paiements et accéder aux simulateurs depuis votre téléphone sans installer d'application.",
  },
  {
    q: "Quelle est la différence entre un logiciel de gestion locative et un tableur ?",
    a: "Un tableur vous donne une feuille vierge — à vous de construire les formules, de générer les quittances manuellement et de gérer les relances à la main. Un logiciel dédié comme lokt.fr automatise tout ça : les quittances PDF sont générées en un clic, les retards de paiement déclenchent des alertes, et les documents sont stockés et accessibles à tout moment.",
  },
  {
    q: "Peut-on utiliser lokt.fr si on a déjà un tableur Excel ?",
    a: "Oui. La transition est rapide : vous importez vos biens et locataires en quelques minutes. Votre tableur devient inutile dès que lokt.fr génère vos premières quittances et déclenche vos premières relances automatiquement.",
  },
  {
    q: "Quelles alertes lokt.fr envoie-t-il au bailleur ?",
    a: "lokt.fr envoie des alertes automatiques dans trois situations : (1) loyer en retard — vous êtes notifié dès le lendemain de la date d'échéance si le paiement n'est pas enregistré ; (2) révision IRL — vous êtes alerté avant la date d'anniversaire du bail pour ne pas rater la revalorisation annuelle ; (3) rappels de quittances — lokt.fr vous indique quelles quittances du mois sont à envoyer. Ces alertes remplacent le travail de surveillance manuelle que vous faisiez sur un tableur.",
  },
  {
    q: "Gererseul, Homii ou Bighands : comment se comparent-ils ?",
    a: "Ces outils ciblent des profils similaires. Gererseul est fonctionnel mais l'interface a vieilli. Homii est récent et bien conçu mais avec moins de recul utilisateur. Bighands se positionne sur la délégation partielle (hybride entre agence et logiciel). lokt.fr se distingue par l'intégration des simulateurs immobiliers et une prise en main immédiate sans formation.",
  },
];

const schemas = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: metaTitle,
    description: metaDesc,
    url: pageUrl,
    dateModified: "2026-06-26",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "lokt.fr",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Outil de gestion locative gratuit pour propriétaire bailleur indépendant avec simulateurs immobiliers intégrés.",
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
        <meta name="robots" content="index, follow" />
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
        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#635bff]">Comparatif 2026</p>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[0.68rem] text-slate-400">
              Mis à jour : {updatedAt}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
            Meilleur logiciel de gestion locative en 2026 :<br className="hidden sm:block" /> Rentila, Smovin ou lokt.fr ?
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            Nous avons testé et comparé les principaux outils utilisés par les bailleurs indépendants en France. Voici ce que chaque solution fait bien, ses limites, et pour quel profil elle convient vraiment.
          </p>
          {/* Réponse courte */}
          <div className="mt-6 rounded-2xl border border-[#635bff]/20 bg-[#635bff]/5 p-5">
            <p className="text-sm font-semibold text-slate-900">En résumé</p>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              Pour un bailleur particulier gérant 1 à 10 biens, <strong>lokt.fr</strong> est l'option la plus complète : gestion quotidienne + simulateurs immobiliers intégrés, sans frais d'agence ni abonnement élevé. <strong>Rentila</strong> est une alternative gratuite correcte si vous n'avez qu'un bien et pas besoin de simulateurs. <strong>Smovin</strong> vise les bailleurs professionnels gérant plus de 5 biens.
            </p>
          </div>
        </header>

        {/* Tableau comparatif */}
        <section className="mb-14 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">Tableau comparatif des fonctionnalités</h2>
            <p className="mt-0.5 text-xs text-slate-400">Tableur Excel · Rentila · Smovin · lokt.fr</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="w-2/5 px-5 py-4 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
                    Fonctionnalité
                  </th>
                  {columns.map((col, i) => (
                    <th
                      key={col}
                      className={
                        "px-3 py-4 text-center text-[0.75rem] font-semibold uppercase tracking-wide " +
                        (isLokt(i) ? "bg-[#635bff]/8 text-[#635bff]" : "text-slate-500")
                      }
                    >
                      {isLokt(i) ? (
                        <span className="inline-flex flex-col items-center gap-1">
                          {col}
                          <span className="rounded-full bg-[#635bff] px-2 py-0.5 text-[0.6rem] font-bold text-white normal-case tracking-normal">
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
                  <tr key={row.label} className={"border-b border-slate-50 " + (ri % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                    <td className="px-5 py-3 font-medium text-slate-800">{row.label}</td>
                    {row.marks.map((mark, ci) => (
                      <td key={ci} className={"px-3 py-3 text-center " + (isLokt(ci) ? "bg-[#635bff]/5" : "")}>
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
            <span className="flex items-center gap-1.5"><MinusIcon className="h-4 w-4 text-amber-400" /> Partiel ou limité</span>
          </div>
        </section>

        {/* Fiches détaillées par outil */}
        <section className="mb-14">
          <h2 className="mb-6 text-2xl font-bold text-slate-950">Analyse détaillée de chaque outil</h2>
          <div className="space-y-5">
            {tools.map(({ name, icon, price, ideal, pros, cons, verdict }) => (
              <div key={name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-6 py-5">
                  <span className="text-3xl">{icon}</span>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-900">{name}</h3>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{price}</span>
                      <span>·</span>
                      <span>Idéal pour : {ideal}</span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-emerald-700">Points forts</p>
                    <ul className="space-y-1.5">
                      {pros.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-red-600">Limites</p>
                    <ul className="space-y-1.5">
                      {cons.map((c) => (
                        <li key={c} className="flex items-start gap-2 text-sm text-slate-600">
                          <XMarkIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
                  <p className="text-[0.8rem] leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-800">Notre verdict : </span>
                    {verdict}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pourquoi lokt.fr */}
        <section className="mb-14 overflow-hidden rounded-3xl border border-[#635bff]/15 bg-gradient-to-br from-[#635bff]/5 to-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">Ce que lokt.fr apporte de différent</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
            La plupart des outils de gestion locative s'arrêtent à la gestion quotidienne. lokt.fr couvre aussi la phase d'avant-achat : vous analysez un investissement avec les bons chiffres, puis vous gérez depuis le même outil.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Simulateurs intégrés", body: "Rentabilité nette, capacité d'emprunt, prêt relais, plus-value — pour décider d'investir avec les bons chiffres, sans quitter la plateforme.", href: "/calculettes", cta: "Voir les simulateurs" },
              { title: "Alertes bailleur automatiques", body: "lokt.fr vous alerte dès qu'un loyer est en retard, avant chaque échéance de révision IRL et lors de chaque quittance à envoyer. Plus rien ne passe entre les mailles.", href: "/outil-gestion-locative", cta: "Voir les alertes" },
              { title: "Relances locataires intégrées", body: "Relances automatiques par e-mail au locataire en cas d'impayé ou de retard. Vous n'avez pas à rédiger, envoyer ou suivre manuellement.", href: "/outil-gestion-locative", cta: "Voir l'outil" },
              { title: "Taillé pour les particuliers", body: "Mise en place en moins de 10 minutes. Pas de jargon professionnel. Gratuit jusqu'à 1 bien, sans engagement ni carte bancaire.", href: "/espace-bailleur", cta: "Essayer gratuitement" },
              { title: "LMNP complet", body: "Inventaire obligatoire, charges meublées, suivi des recettes — adapté à la location meublée comme à la location nue.", href: "/gestion-locative-lmnp", cta: "En savoir plus" },
              { title: "Zéro commission", body: "Contrairement à une agence, lokt.fr ne prélève rien sur vos loyers. Un abonnement fixe et prévisible.", href: "/tarifs", cta: "Voir les tarifs" },
              { title: "Cockpit parc immobilier", body: "Score de gestion, taux d'encaissement, occupation du parc, retards — des indicateurs réels pour piloter votre patrimoine.", href: "/parc-immobilier", cta: "Voir le cockpit" },
            ].map(({ title, body, href, cta }) => (
              <div key={title} className="rounded-2xl border border-[#635bff]/15 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-[0.82rem] leading-relaxed text-slate-600">{body}</p>
                <Link href={href} className="mt-3 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-[#635bff] hover:text-[#4f46e5]">
                  {cta} →
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mb-14 rounded-3xl bg-slate-950 px-8 py-10 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Essai gratuit · Sans carte bancaire</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Gérez votre patrimoine locatif depuis un seul endroit</h2>
          <p className="mt-3 text-[0.9rem] text-white/60">
            Commencez avec 1 bien. Quittances, suivi des loyers, relances et simulateurs inclus dès le départ.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/espace-bailleur" className="rounded-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90">
              Accéder à l&apos;espace bailleur →
            </Link>
            <Link href="/tarifs" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/70 transition hover:border-white/40 hover:text-white">
              Voir les tarifs
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-bold text-slate-950">Questions fréquentes</h2>
          <div className="space-y-3">
            {faq.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm open:border-[#635bff]/30">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 group-open:text-[#635bff]">
                  {q}
                </summary>
                <p className="mt-3 text-[0.85rem] leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Maillage interne */}
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
              <Link key={href} href={href} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[#635bff]/30 hover:text-[#635bff]">
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
