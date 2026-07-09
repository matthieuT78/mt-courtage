import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

const SITE_URL = "https://lokt.fr";

// ── Workflow steps ─────────────────────────────────────────────────────────
const STEPS = [
  {
    key: "mise-en-location",
    num: "01",
    label: "Mise en location",
    kicker: "Trouver & sélectionner",
    title: "Un lien. Tous les dossiers. Zéro saisie.",
    desc: "Partagez un lien de candidature unique sur vos annonces. Les candidats postulent sans créer de compte. Vous recevez des dossiers scorés automatiquement — ratio loyer/revenu, type de contrat, garant — et vous sélectionnez le bon profil en quelques minutes.",
    points: [
      "Lien unique à partager sur Le Bon Coin, PAP, réseaux sociaux",
      "Candidats postulent sans compte — brouillon sauvegardé automatiquement",
      "Scoring automatique : revenus, contrat, garant",
      "Données des candidats non retenus supprimées automatiquement (RGPD)",
      "Dossier retenu pré-remplit le bail — zéro ressaisie",
    ],
    screenshot: "/screenshots/candidature.png",
    screenshotAlt: "Interface candidatures lokt.fr — dossiers scorés et comparaison",
    color: "from-violet-600 to-indigo-600",
    chipBg: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    key: "bail-edl",
    num: "02",
    label: "Bail & EDL",
    kicker: "Formaliser en un clic",
    title: "Bail généré, signé, archivé. EDL intégré.",
    desc: "Les informations du candidat retenu pré-remplissent le bail. Vous vérifiez, générez le PDF et partagez avec le locataire. L'état des lieux d'entrée est intégré au même dossier — photos, relevés compteurs, signature.",
    points: [
      "Bail pré-rempli depuis le dossier candidature retenu",
      "Génération PDF conforme loi ALUR / loi Élan",
      "Partage sécurisé avec le locataire — accusé de réception horodaté",
      "État des lieux d'entrée intégré avec photos et relevés",
      "Alertes automatiques : fin de bail, renouvellement, révision IRL",
    ],
    screenshot: "/screenshots/mise%20en%20route.png",
    screenshotAlt: "Interface mise en route lokt.fr — bail, locataire, étapes de démarrage",
    color: "from-sky-600 to-cyan-600",
    chipBg: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    key: "gestion",
    num: "03",
    label: "Gestion quotidienne",
    kicker: "Suivre sans y penser",
    title: "Loyer encaissé → quittance envoyée. Automatique.",
    desc: "Vous confirmez le paiement en un clic. La quittance PDF est générée, numérotée, archivée et envoyée au locataire. Les relances partent automatiquement en cas de retard. La messagerie centralise tous les échanges dans le dossier du bien.",
    points: [
      "Quittances auto en un clic — PDF + envoi email + archivage",
      "Relances automatiques dès le 1er jour de retard",
      "Messagerie locataire centralisée dans le dossier",
      "Portail locataire : quittances, bail, EDL accessibles en ligne",
      "Notifications configurables : révision IRL, fin de bail, caution",
    ],
    screenshot: "/screenshots/workflow%20changement%20locataire.png",
    screenshotAlt: "Interface gestion locative lokt.fr — workflow changement de locataire",
    color: "from-emerald-600 to-teal-600",
    chipBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    key: "finance",
    num: "04",
    label: "Finance & Performance",
    kicker: "Analyser et piloter",
    title: "Cash-flow, rendement, patrimoine. En temps réel.",
    desc: "Chaque loyer encaissé, chaque charge saisie, chaque transaction alimentent votre tableau de bord. Rendement brut, TRI estimé, valeur patrimoniale projetée sur 20 ans — vous savez exactement où vous en êtes, sans Excel.",
    points: [
      "Cash-flow mensuel par bien et global",
      "Rendement brut, net et TRI calculés automatiquement",
      "Valeur patrimoniale estimée + plus-value latente",
      "Projection patrimoniale sur 20 ans",
      "Export fiscal — préparation déclaration revenus fonciers",
    ],
    screenshot: "/screenshots/Finance.png",
    screenshotAlt: "Interface finance lokt.fr — tableau de bord cash-flow et performance",
    color: "from-orange-500 to-amber-500",
    chipBg: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

const TIME_SAVINGS = [
  { value: "2 min", label: "pour une quittance", sub: "vs 20 min manuellement" },
  { value: "Zéro", label: "relance manuelle", sub: "alertes automatiques sur tous les délais" },
  { value: "1 outil", label: "pour tout le cycle", sub: "mise en location → finance" },
  { value: "100%", label: "RGPD sans effort", sub: "suppression auto des candidats non retenus" },
];

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-violet-600 stroke-[1.8]" aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round"/>
      </svg>
    ),
    bg: "bg-violet-50",
    title: "Candidatures en ligne",
    desc: "Lien unique, scoring automatique, conformité RGPD intégrée.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-sky-600 stroke-[1.8]" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round"/>
        <polyline points="14,2 14,8 20,8" strokeLinejoin="round"/>
        <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round"/>
        <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round"/>
      </svg>
    ),
    bg: "bg-sky-50",
    title: "Baux & documents",
    desc: "Génération PDF conforme, partage sécurisé, congé, mise en demeure.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-emerald-600 stroke-[1.8]" aria-hidden>
        <circle cx="12" cy="12" r="9"/>
        <path d="M8.5 12.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    bg: "bg-emerald-50",
    title: "Quittances automatiques",
    desc: "Paiement confirmé → PDF généré → envoyé. Tout en un clic.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-amber-600 stroke-[1.8]" aria-hidden>
        <path d="M12 3a6 6 0 0 0-6 6v3.5l-1.5 2v.5h15v-.5L18 12.5V9a6 6 0 0 0-6-6z" strokeLinejoin="round"/>
        <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round"/>
      </svg>
    ),
    bg: "bg-amber-50",
    title: "Alertes & relances",
    desc: "IRL, retards, baux expirants — zéro oubli. Configurables par bail.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-indigo-600 stroke-[1.8]" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2"/>
        <path d="M3 7l9 6 9-6" strokeLinecap="round"/>
      </svg>
    ),
    bg: "bg-indigo-50",
    title: "Messagerie locataire",
    desc: "Échanges centralisés dans le dossier. Portail locataire inclus.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-teal-600 stroke-[1.8]" aria-hidden>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinejoin="round"/>
        <polyline points="9,22 9,12 15,12 15,22" strokeLinejoin="round"/>
      </svg>
    ),
    bg: "bg-teal-50",
    title: "États des lieux",
    desc: "Entrée, sortie, inventaire avec photos. Envoi locataire intégré.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-orange-600 stroke-[1.8]" aria-hidden>
        <line x1="12" y1="1" x2="12" y2="23" strokeLinecap="round"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round"/>
      </svg>
    ),
    bg: "bg-orange-50",
    title: "Finance & déclaration",
    desc: "Cash-flow, charges, exports fiscaux. Déclaration revenus fonciers guidée.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-[#635bff] stroke-[1.8]" aria-hidden>
        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    bg: "bg-[#635bff]/10",
    title: "Performance & rendement",
    desc: "Rendement brut, TRI, patrimoine projeté. Vision consolidée multi-biens.",
  },
];

export default function GestionLocativePage() {
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];

  const title = "Logiciel de gestion locative gratuit — Workflow complet | lokt.fr";
  const description =
    "Logiciel de gestion locative tout-en-un : candidatures, bail, quittances automatiques, états des lieux et finance bailleur. Gratuit pour les bailleurs particuliers.";
  const pageUrl = `${SITE_URL}/gestion-locative`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${SITE_URL}/lokt-logo-transparent.jpg`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "lokt.fr",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
              description,
              url: SITE_URL,
            }),
          }}
        />
      </Head>

      <AppHeader />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#07040f] px-4 pb-0 pt-14 sm:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,91,255,0.25),transparent)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[0.72rem] font-semibold text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Mise en location · Bail · Gestion · Finance
            </div>
            <h1 className="mt-5 text-[2.4rem] font-semibold leading-[0.95] tracking-tight text-white sm:text-6xl">
              Tout le cycle locatif.{" "}
              <span className="bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8] bg-clip-text text-transparent">
                Un seul outil.
              </span>
            </h1>
            <p className="mt-5 text-base leading-7 text-white/75 sm:text-lg">
              lokt.fr est le seul logiciel de gestion locative qui couvre la mise en location, le bail, la gestion quotidienne et la performance financière — sans jongler entre plusieurs outils.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/mon-compte?mode=register&redirect=/espace-bailleur"
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#635bff] to-[#00b4d8] px-7 text-sm font-semibold text-white shadow-lg shadow-[#635bff]/25 hover:opacity-90 sm:w-auto"
              >
                Créer mon espace gratuit →
              </Link>
              <Link
                href="/comparatif-logiciel-gestion-locative"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/15 bg-white/8 px-7 text-sm font-semibold text-white backdrop-blur hover:bg-white/12 sm:w-auto"
              >
                Voir le comparatif →
              </Link>
            </div>
          </div>

          {/* Hero screenshot */}
          <div className="relative mx-auto mt-12 max-w-5xl">
            <div className="pointer-events-none absolute -inset-x-20 bottom-0 h-32 bg-gradient-to-t from-[#f6f9fc] to-transparent" />
            <div className="overflow-hidden rounded-t-[1.5rem] shadow-2xl shadow-black/40 ring-1 ring-white/10 sm:rounded-t-[2rem]">
              <img
                src="/cockpit-bailleur-lokt.png"
                alt="Tableau de bord gestion locative lokt.fr"
                className="block h-auto w-full"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="bg-[#f6f9fc]">

        {/* ── STATS ────────────────────────────────────────────────────────── */}
        <section className="border-b border-slate-200 bg-white px-4 py-10">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {TIME_SAVINGS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-3xl font-semibold text-slate-950 sm:text-4xl">{s.value}</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">{s.label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WORKFLOW TABS ─────────────────────────────────────────────────── */}
        <section className="border-b border-slate-200 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Le parcours complet</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                De la recherche de locataire au bilan financier.
              </h2>
              <p className="mt-3 mx-auto max-w-xl text-sm leading-7 text-slate-600">
                Chaque étape s'enchaîne naturellement. Les données circulent d'un bout à l'autre — sans ressaisie, sans fichier intermédiaire.
              </p>
            </div>

            {/* Tab strip */}
            <div className="flex overflow-x-auto gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid sm:grid-cols-4">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveStep(i)}
                  className={`flex min-w-[140px] flex-col items-center rounded-xl px-3 py-3 text-center transition sm:min-w-0 ${
                    activeStep === i
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className={`text-[0.65rem] font-bold ${activeStep === i ? "text-slate-400" : "text-slate-400"}`}>{s.num}</span>
                  <span className="mt-0.5 text-xs font-semibold leading-snug">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="mt-5 grid gap-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm lg:grid-cols-2">
              {/* Left: text */}
              <div className="flex flex-col justify-center p-8 sm:p-10">
                <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold ${step.chipBg}`}>
                  {step.num} — {step.kicker}
                </span>
                <h3 className="mt-4 text-2xl font-semibold leading-snug text-slate-950 sm:text-3xl">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{step.desc}</p>
                <ul className="mt-6 space-y-2.5">
                  {step.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.55rem] font-bold text-slate-600">✓</span>
                      <span className="text-sm text-slate-700">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: screenshot */}
              <div className="relative overflow-hidden bg-slate-50">
                <div className="overflow-hidden">
                  <img
                    src={step.screenshot}
                    alt={step.screenshotAlt}
                    className="block h-[460px] w-full object-cover object-top sm:h-[520px]"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      const next = (e.target as HTMLImageElement).nextElementSibling as HTMLElement | null;
                      if (next) next.style.removeProperty("display");
                    }}
                  />
                  <div
                    className="hidden h-[460px] flex-col items-center justify-center gap-2 bg-slate-50 text-center sm:h-[520px]"
                    aria-hidden
                  >
                    <p className="text-sm font-semibold text-slate-400">Screenshot à ajouter</p>
                    <p className="text-xs text-slate-300">{step.screenshot}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step arrows */}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveStep((i) => Math.max(0, i - 1))}
                disabled={activeStep === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-30"
              >
                ← Étape précédente
              </button>
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveStep(i)}
                    className={`h-2 rounded-full transition-all ${activeStep === i ? "w-6 bg-slate-950" : "w-2 bg-slate-300"}`}
                  />
                ))}
              </div>
              {activeStep < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep((i) => Math.min(STEPS.length - 1, i + 1))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300"
                >
                  Étape suivante →
                </button>
              ) : (
                <Link
                  href="/mon-compte?mode=register&redirect=/espace-bailleur"
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  Commencer gratuitement →
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── CE QUE VOUS NE FAITES PLUS ───────────────────────────────────── */}
        <section className="border-b border-slate-200 bg-white px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Gagner du temps</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Ce que vous ne ferez plus jamais manuellement.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  before: "Générer la quittance en Word, la renommer, l'envoyer par mail",
                  after: "1 clic — quittance PDF générée, archivée et envoyée automatiquement",
                  tone: "emerald",
                },
                {
                  before: "Recevoir les dossiers par mail, les comparer dans un tableur",
                  after: "Lien unique — dossiers scorés automatiquement, RGPD géré",
                  tone: "violet",
                },
                {
                  before: "Calculer la révision IRL manuellement avec l'indice sur insee.fr",
                  after: "Alerte 30 jours avant — calcul IRL intégré, envoi locataire en un clic",
                  tone: "amber",
                },
                {
                  before: "Chercher combien vous rapporte chaque bien dans un fichier Excel",
                  after: "Cash-flow, rendement brut, TRI — mis à jour en temps réel",
                  tone: "sky",
                },
                {
                  before: "Relancer le locataire manuellement quand le loyer est en retard",
                  after: "Relances automatiques dès J+1 — par email et messagerie",
                  tone: "rose",
                },
                {
                  before: "Imprimer l'EDL, le faire signer, le scanner, l'envoyer par mail",
                  after: "EDL numérique avec photos — partagé et archivé dans le dossier",
                  tone: "teal",
                },
              ].map(({ before, after, tone }) => {
                const colors: Record<string, { border: string; bg: string; text: string }> = {
                  emerald: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-800" },
                  violet:  { border: "border-violet-200",  bg: "bg-violet-50",  text: "text-violet-800" },
                  amber:   { border: "border-amber-200",   bg: "bg-amber-50",   text: "text-amber-800" },
                  sky:     { border: "border-sky-200",     bg: "bg-sky-50",     text: "text-sky-800" },
                  rose:    { border: "border-rose-200",    bg: "bg-rose-50",    text: "text-rose-800" },
                  teal:    { border: "border-teal-200",    bg: "bg-teal-50",    text: "text-teal-800" },
                };
                const c = colors[tone];
                return (
                  <div key={before} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-base">❌</span>
                      <p className="text-sm text-slate-500 line-through">{before}</p>
                    </div>
                    <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 ${c.border} ${c.bg}`}>
                      <span className="mt-0.5 text-base">✓</span>
                      <p className={`text-sm font-medium ${c.text}`}>{after}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FEATURES GRID ─────────────────────────────────────────────────── */}
        <section className="border-b border-slate-200 px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Fonctionnalités</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Tout ce qu'un bailleur indépendant peut avoir besoin.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${f.bg}`}>{f.icon}</div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-950">{f.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── VS CONCURRENTS ────────────────────────────────────────────────── */}
        <section className="border-b border-slate-200 bg-white px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Positionnement</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Pourquoi pas Rentila, BailFacile ou Smovin ?
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                Chaque outil a ses forces. lokt.fr est le seul qui couvre la mise en location ET la gestion quotidienne ET l'analyse financière dans un seul workflow.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 text-left text-xs font-semibold text-slate-500">Fonctionnalité</th>
                    {["Rentila", "BailFacile", "Smovin", "lokt.fr"].map((tool) => (
                      <th key={tool} className={`pb-3 text-center text-xs font-semibold ${tool === "lokt.fr" ? "text-[#635bff]" : "text-slate-500"}`}>
                        {tool}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ["Candidatures & scoring en ligne", "—", "—", "—", "✓"],
                    ["Bail & documents conformes", "✓", "✓", "✓", "✓"],
                    ["Quittances automatiques", "—", "—", "✓", "✓"],
                    ["Alertes & relances auto", "—", "—", "✓", "✓"],
                    ["Portail locataire", "—", "—", "✓", "✓"],
                    ["États des lieux intégrés", "—", "—", "✓", "✓"],
                    ["Finance & rendement", "—", "—", "✓", "✓"],
                    ["Simulateurs immobiliers", "—", "—", "—", "✓"],
                    ["Gratuit pour 1 bien", "✓", "✓", "—", "✓"],
                  ].map(([feature, ...vals]) => (
                    <tr key={String(feature)}>
                      <td className="py-2.5 pr-4 text-xs text-slate-700">{feature}</td>
                      {vals.map((v, i) => (
                        <td key={i} className={`py-2.5 text-center text-sm font-semibold ${i === 3 ? (v === "✓" ? "text-[#635bff]" : "text-slate-300") : v === "✓" ? "text-emerald-600" : "text-slate-300"}`}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 text-right">
              <Link href="/comparatif-logiciel-gestion-locative" className="text-xs font-semibold text-[#635bff] hover:underline">
                Voir le comparatif détaillé →
              </Link>
            </div>
          </div>
        </section>

        {/* ── PARC IMMOBILIER SPOTLIGHT ────────────────────────────────────── */}
        <section className="border-b border-slate-200 bg-white px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg lg:order-first">
                <img
                  src="/screenshots/parc%20immobilier.png"
                  alt="Vue parc immobilier lokt.fr — indicateurs de performance multi-biens"
                  className="block h-auto w-full"
                  loading="lazy"
                />
              </div>
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[0.68rem] font-semibold text-amber-700">
                  04 — Finance & Performance
                </span>
                <h2 className="mt-4 text-2xl font-semibold leading-snug tracking-tight text-slate-950 sm:text-3xl">
                  Votre parc en un coup d'œil. Vacance, turnover, rendement.
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  La vue parc immobilier consolide tous vos biens : taux d'occupation, jours de vacance, rotation des locataires, cashflow global. Identifiez en un instant quel bien performe et lequel demande une action.
                </p>
                <ul className="mt-5 space-y-2">
                  {[
                    "Vacance locative et turnover sur 12 mois par bien",
                    "Cashflow et rendement net consolidés",
                    "Score de performance lokt — conserver, optimiser, arbitrer",
                    "Actions prioritaires suggérées automatiquement",
                  ].map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[0.55rem] font-bold text-amber-700">✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
        <section className="px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Prêt à tout centraliser ?
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Gratuit pour 1 bien. Pas de carte bancaire requise. Opérationnel en moins de 10 minutes.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/mon-compte?mode=register&redirect=/espace-bailleur"
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#635bff] to-[#00b4d8] px-8 text-sm font-semibold text-white shadow-lg shadow-[#635bff]/20 hover:opacity-90 sm:w-auto"
              >
                Créer mon espace gratuitement →
              </Link>
              <Link
                href="/tarifs"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-8 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 sm:w-auto"
              >
                Voir les tarifs →
              </Link>
            </div>
            <p className="mt-5 text-xs text-slate-400">
              lokt·one à 4,90 €/mois débloque quittances auto, alertes complètes et portail locataire.
            </p>
          </div>
        </section>
      </div>

      <AppFooter />
    </>
  );
}
