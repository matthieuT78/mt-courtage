import Head from "next/head";
import Link from "next/link";
import { UserPlusIcon, LinkIcon, GiftIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { PAID_BILLING_PLANS } from "../lib/billingPlans";
import { useScrollReveal } from "../hooks/useScrollReveal";

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/parrainage`;
const ogImage = `${siteUrl}/espace-bailleur-lokt.png`;
const title = "Parrainage lokt.fr : 3 mois à -50% pour vous deux";
const description = "Parrainez un bailleur sur lokt.fr : dès qu'il souscrit avec votre lien, vous bénéficiez tous les deux de 3 mois à moitié prix, automatiquement.";

const lokt1 = PAID_BILLING_PLANS.find((p) => p.id === "landlord_5")!;
const lokt1SavingsLabel = ((lokt1.monthlyPrice ?? 0) * 3 * 0.5).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const steps = [
  {
    icon: LinkIcon,
    title: "Récupérez votre lien personnel",
    text: "Depuis votre compte lokt.fr, copiez votre lien de parrainage unique — ou partagez-le en un clic par WhatsApp ou email.",
  },
  {
    icon: UserPlusIcon,
    title: "Un bailleur s'inscrit avec votre lien",
    text: "Il clique, crée son compte : son parrainage est enregistré automatiquement, sans code à ressaisir.",
  },
  {
    icon: GiftIcon,
    title: "Dès qu'il souscrit, vous gagnez tous les deux",
    text: "3 mois à moitié prix, appliqués automatiquement sur vos abonnements respectifs — pas de démarche à faire.",
  },
];

const faq = [
  {
    q: "Comment mon filleul est-il rattaché à mon parrainage ?",
    a: "Automatiquement. Dès qu'il clique sur votre lien, son navigateur mémorise votre code. S'il crée un compte ensuite, le parrainage est appliqué tout seul — il peut aussi saisir votre code manuellement à l'inscription si vous le lui avez transmis autrement.",
  },
  {
    q: "Quand la récompense est-elle appliquée ?",
    a: "Dès que votre filleul souscrit à une offre payante (lokt·one ou lokt·plus). Vous recevez chacun 3 mois à −50 % sur votre abonnement, sans action de votre part.",
  },
  {
    q: "Y a-t-il une limite au nombre de filleuls ?",
    a: "Non, vous pouvez parrainer autant de bailleurs que vous le souhaitez avec le même lien.",
  },
  {
    q: "Je n'ai pas encore de compte lokt.fr, puis-je quand même être parrainé ?",
    a: "Oui. Cliquez sur le lien qu'on vous a partagé, puis créez votre compte — le parrainage sera pris en compte automatiquement.",
  },
];

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
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Parrainage", item: pageUrl },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "fr-FR",
    mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  },
];

export default function ParrainagePage() {
  useScrollReveal();

  return (
    <div className="min-h-screen bg-[#f7f7fb]">
      <Head>
        <title>{title} | lokt.fr</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="website" />
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
        <meta name="robots" content="index, follow" />
        {schemas.map((s, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
        ))}
      </Head>

      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-12 sm:px-6">
        <nav className="mb-6 text-xs text-slate-500" aria-label="Fil d'Ariane">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link href="/" className="hover:text-slate-700">Accueil</Link></li>
            <li aria-hidden="true">›</li>
            <li className="text-slate-700">Parrainage</li>
          </ol>
        </nav>

        <header data-scroll-reveal className="text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#635bff]">Programme de parrainage</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
            Parrainez un bailleur,<br className="hidden sm:block" /> gagnez 3 mois à −50 % chacun
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Vous gérez déjà vos locations avec lokt.fr ? Partagez votre lien avec un propriétaire de votre entourage — dès qu'il s'abonne, vous économisez tous les deux, automatiquement.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/mon-compte/abonnement" className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#635bff] to-[#00d4ff] px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 hover:opacity-90 transition">
              J'ai un compte — récupérer mon lien →
            </Link>
            <Link href="/mon-compte?mode=register&redirect=/mon-compte/abonnement" className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 transition">
              Créer mon compte gratuit
            </Link>
          </div>
        </header>

        <section className="mt-14">
          <div className="grid gap-4 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title: stepTitle, text }, i) => (
              <div key={stepTitle} data-scroll-reveal data-reveal-delay={i * 100} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#635bff]/10 text-[#635bff]">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400">Étape {i + 1}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{stepTitle}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section data-scroll-reveal className="mt-10 overflow-hidden rounded-[1.75rem] border border-[#635bff]/20 bg-gradient-to-br from-[#635bff]/5 to-white p-6 shadow-sm sm:p-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Le gain, en chiffres</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            Sur l'offre {lokt1.name} ({lokt1.priceLabel}), 3 mois à −50 % représentent environ{" "}
            {lokt1SavingsLabel} € d'économie — pour vous, et pour votre filleul.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            La récompense s'applique automatiquement sur votre abonnement en cours dès la souscription de votre filleul. Plus vous parrainez de bailleurs, plus vous cumulez d'économies — aucune limite au nombre de filleuls.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="mb-5 text-xl font-bold text-slate-950">Questions fréquentes</h2>
          <div className="space-y-3">
            {faq.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm open:border-[#635bff]/30">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 group-open:text-[#635bff]">{q}</summary>
                <p className="mt-3 text-[0.85rem] leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-3xl bg-slate-950 px-8 py-10 text-center shadow-sm">
          <CheckCircleIcon className="mx-auto h-8 w-8 text-emerald-400" />
          <h2 className="mt-4 text-2xl font-bold text-white">Prêt à parrainer votre premier bailleur ?</h2>
          <p className="mt-3 text-[0.9rem] text-white/60">Votre lien vous attend dans votre espace compte.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/mon-compte/abonnement" className="rounded-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90">
              Récupérer mon lien de parrainage →
            </Link>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
