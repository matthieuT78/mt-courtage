import Head from "next/head";
import Link from "next/link";
import type { GetStaticPaths, GetStaticProps } from "next";
import AppHeader from "../../../components/AppHeader";
import AppFooter from "../../../components/AppFooter";

// ✅ JSON-LD SAFE (robuste)
function JsonLd({ data }: { data: any }) {
  const items = Array.isArray(data) ? data : [data];

  const safeItems = items.filter(
    (x) =>
      x &&
      typeof x === "object" &&
      typeof x["@context"] === "string" &&
      x["@context"].length > 0
  );

  return (
    <>
      {safeItems.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

function formatEuro(n: number) {
  try {
    return new Intl.NumberFormat("fr-FR").format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPct(p: number) {
  return `${Math.round(p * 10) / 10}%`;
}

// 🔥 Valeurs de biens que Google va indexer
export const VALEURS = [
  150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 700000, 800000,
];

type Props = { valeur: number };

export default function PretRelaisValeurPage({ valeur }: Props) {
  const siteUrl = "https://lokt.fr";
  const pagePath = `/simulateur/pret-relais/${valeur}`;
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = `Prêt relais avec un bien de ${formatEuro(valeur)}€ — estimation relais & budget | lokt.fr`;
  const description = `Estimez un prêt relais avec un bien évalué à ${formatEuro(
    valeur
  )}€ : montant du relais (ordre de grandeur), décote banque, capital restant dû, et budget d’achat possible.`;

  const ogImage = `${siteUrl}/logo-transparent-Lokt.jpg`;

  /**
   * Repères SEO (prudence) — pour ne pas vendre du rêve :
   * - Décote banque : souvent 60% à 80% selon dossier/banque/zone
   * - CRD : dépend du prêt actuel ; on met un repère ajustable mentalement
   */
  const decotePct = 0.7; // repère
  const crdReperePct = 0.3; // repère
  const capitalRestantDu = Math.round(valeur * crdReperePct);
  const relais = clamp(Math.round(valeur * decotePct - capitalRestantDu), 0, valeur);

  const cashDeTransition = clamp(Math.round(valeur * decotePct - relais), 0, valeur); // ce qui est “mangé” par CRD (repère)

  // Deux “marges” pour aider à comprendre (scénarios)
  const relaisBas = clamp(Math.round(valeur * 0.6 - capitalRestantDu), 0, valeur);
  const relaisHaut = clamp(Math.round(valeur * 0.8 - capitalRestantDu), 0, valeur);

  const faq = [
    {
      q: "C’est quoi un prêt relais, concrètement ?",
      a: "C’est un crédit temporaire qui avance une partie de la valeur de votre bien actuel, le temps de le vendre. Il sert à financer l’achat du nouveau logement avant la vente définitive.",
    },
    {
      q: "Pourquoi la banque applique une “décote” (ex : 70%) ?",
      a: "Parce que le prix de vente final peut être inférieur à l’estimation, et la banque veut se protéger (délai de vente, négociation, frais). La décote varie selon votre dossier et le marché local.",
    },
    {
      q: "Le capital restant dû (CRD) change tout : pourquoi ?",
      a: "Parce que le prêt relais ne peut pas “effacer” votre prêt actuel : la banque calcule souvent le relais sur la valeur décotée, puis retire ce qu’il reste à rembourser sur le bien actuel.",
    },
    {
      q: "Relais sec vs relais adossé : quelle différence ?",
      a: "Le relais adossé combine un relais + un nouveau prêt amortissable. Le relais “sec” est plus rare : il finance presque tout seul l’achat et se rembourse à la vente.",
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      url: pageUrl,
      description,
      inLanguage: "fr-FR",
      isPartOf: { "@type": "WebSite", name: "lokt.fr", url: siteUrl },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Prêt relais", item: `${siteUrl}/pret-relais` },
        { "@type": "ListItem", position: 3, name: `${formatEuro(valeur)}€`, item: pageUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={pageUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:alt" content="lokt.fr — simulateurs immobiliers" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* HERO */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 to-cyan-500" />
            <div className="p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="max-w-3xl">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Simulateur prêt relais
                  </p>

                  <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">
                    Prêt relais avec un bien de {formatEuro(valeur)}€
                  </h1>

                  <p className="mt-3 text-sm text-slate-600">
                    Cette page donne un <strong>ordre de grandeur</strong> basé sur des hypothèses prudentes.
                    Pour un résultat fiable (CRD exact, mensualités, taux, durée, relais adossé, reste à vivre),
                    utilisez la calculette complète lokt.fr.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/pret-relais"
                      className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      Lancer la vraie calculette prêt relais →
                    </Link>

                    <Link
                      href="/capacite"
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
                    >
                      Vérifier ma capacité d’emprunt →
                    </Link>

                    <Link
                      href="/investissement"
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
                    >
                      Et si je loue ? Rentabilité →
                    </Link>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-900">Valeur du bien (repère)</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatEuro(valeur)}€</p>
                      <p className="mt-1 text-xs text-slate-600">Estimation du logement actuel.</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-900">Décote banque (repère)</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatPct(decotePct * 100)}</p>
                      <p className="mt-1 text-xs text-slate-600">Souvent ~ 60% à 80%.</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-900">Relais (ordre de grandeur)</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatEuro(relais)}€</p>
                      <p className="mt-1 text-xs text-slate-600">Après CRD estimé (repère).</p>
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <aside className="lg:w-[360px] w-full">
                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 lg:sticky lg:top-6">
                    <p className="text-xs font-semibold text-slate-900">Fourchette rapide (très utile)</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Avec un CRD estimé à ~ {formatEuro(capitalRestantDu)}€, le relais peut varier selon la banque.
                    </p>

                    <div className="mt-4 grid gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold text-slate-900">Relais “bas” (60%)</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{formatEuro(relaisBas)}€</p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold text-slate-900">Relais “haut” (80%)</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{formatEuro(relaisHaut)}€</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      Conseil : pour une décision, utilisez le CRD réel et le coût du relais (intérêts / assurance).
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </section>

          {/* EXPLICATION */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
              Comment la banque calcule un prêt relais (simple)
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">1) Estimation du bien</p>
                <p className="mt-2 text-sm text-slate-600">
                  Point de départ : une valeur réaliste (agence, notaire, ventes comparables).
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">2) Décote (60–80%)</p>
                <p className="mt-2 text-sm text-slate-600">
                  La banque applique une marge de sécurité pour absorber une négociation ou un délai de vente.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">3) Retrait du CRD</p>
                <p className="mt-2 text-sm text-slate-600">
                  On retire le capital restant dû du prêt actuel : c’est souvent ça qui fait “tomber” le relais.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-900">Lecture rapide (repère)</p>
              <p className="mt-2 text-sm text-slate-600">
                Ici : {formatEuro(valeur)}€ × {Math.round(decotePct * 100)}% − {formatEuro(capitalRestantDu)}€ ≈{" "}
                <strong className="text-slate-900">{formatEuro(relais)}€</strong>.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                ⚠️ Ce n’est pas une offre bancaire : le coût du relais (intérêts), la durée et votre endettement
                global doivent être simulés précisément.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">CRD (repère)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    ≈ {formatEuro(capitalRestantDu)}€
                  </p>
                  <p className="mt-1 text-xs text-slate-600">À remplacer par votre capital restant dû réel.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">Valeur décotée</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    ≈ {formatEuro(valeur * decotePct)}€
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Base sur laquelle la banque raisonne souvent.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">“Mangé” par le CRD</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    ≈ {formatEuro(cashDeTransition)}€
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Ce qui réduit le relais (ordre de grandeur).
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                  Faites le calcul complet en 2 minutes
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Avec votre CRD réel, votre durée de vente estimée, et votre nouveau projet d’achat.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/pret-relais"
                  className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Calcul complet prêt relais →
                </Link>
                <Link
                  href="/capacite"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
                >
                  Capacité d’emprunt →
                </Link>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">FAQ</h2>
            <div className="mt-4 space-y-4">
              {faq.map((f) => (
                <div key={f.q} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">{f.q}</p>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* AUTRES VALEURS (maillage interne) */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-sm font-semibold text-slate-900">Autres valeurs à explorer</h2>
            <p className="mt-2 text-sm text-slate-600">
              Comparez rapidement en changeant uniquement la valeur du bien :
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {VALEURS.filter((v) => v !== valeur).map((v) => (
                <Link
                  key={v}
                  href={`/simulateur/pret-relais/${v}`}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-white"
                >
                  {formatEuro(v)}€
                </Link>
              ))}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Ces pages visent des requêtes du type “prêt relais {formatEuro(valeur)}€” et renvoient vers la calculette
              complète.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

// Génération SEO
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: VALEURS.map((v) => ({ params: { valeur: String(v) } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const valeur = Number(params?.valeur);

  if (!Number.isFinite(valeur)) return { notFound: true };
  if (!VALEURS.includes(valeur)) return { notFound: true };

  return { props: { valeur } };
};
