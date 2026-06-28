import Head from "next/head";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import { VILLES_DATA } from "../../lib/villesRendement";

const SITE_URL = "https://lokt.fr";
const pageUrl = `${SITE_URL}/rendement-locatif`;
const metaTitle = "Rendement locatif par ville 2026 : comparatif des grandes villes françaises | lokt.fr";
const metaDesc = "Comparez le rendement locatif dans 15 grandes villes françaises : Lyon, Bordeaux, Toulouse, Marseille, Rennes, Lille, Strasbourg, Grenoble et plus. Prix au m², loyers et rentabilité 2026.";

const faq = [
  {
    q: "Quelle ville offre le meilleur rendement locatif en France en 2026 ?",
    a: "Les meilleures rentabilités brutes se trouvent dans les villes moyennes dynamiques : Nancy (~6,6 %), Clermont-Ferrand (~6,3 %), Metz (~6 %), Grenoble (~5,5 %) et Lille (~5,2 %). Les grandes métropoles comme Lyon, Bordeaux ou Nice offrent des rendements plus faibles (3,5-4 %) mais une liquidité supérieure et un potentiel de plus-value plus fort.",
  },
  {
    q: "Comment comparer les villes pour un investissement locatif ?",
    a: "Ne regardez pas que le rendement brut. Évaluez aussi : la tension locative (délai de relocation), la liquidité à la revente, la qualité du bassin d'emploi, la proportion d'étudiants, et les risques spécifiques (inondations, encadrement des loyers, passoires thermiques). Une ville à 6 % brut avec une forte vacance peut être moins intéressante qu'une ville à 4,5 % avec zéro vacance.",
  },
  {
    q: "Vaut-il mieux investir dans une grande métropole ou une ville moyenne ?",
    a: "Les deux approches sont valides selon votre objectif. Grandes métropoles (Lyon, Bordeaux, Nantes) : rendements plus faibles mais meilleure liquidité, plus-value potentielle plus forte, marché profond. Villes moyennes (Clermont, Grenoble, Nancy) : rendements élevés, tickets d'entrée bas, mais marché à la revente plus étroit. La règle : investissez dans une ville que vous connaissez et pouvez gérer.",
  },
  {
    q: "Le rendement brut suffit-il pour comparer des investissements ?",
    a: "Non. Le rendement brut (loyers annuels ÷ prix d'achat) ne prend pas en compte les charges, la taxe foncière, la vacance, les travaux et la fiscalité. Le rendement net est souvent 1,5 à 2 points en dessous du brut. Et le rendement sur fonds propres — le plus pertinent — dépend aussi du financement. Utilisez le simulateur lokt.fr pour calculer tous ces indicateurs en une fois.",
  },
];

const schemas = [
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: metaTitle,
    description: metaDesc,
    url: pageUrl,
    inLanguage: "fr-FR",
    dateModified: "2026-06-28",
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Investissement locatif", item: `${SITE_URL}/investissement-locatif` },
      { "@type": "ListItem", position: 3, name: "Rendement locatif par ville", item: pageUrl },
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
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Rendement locatif par ville",
    numberOfItems: VILLES_DATA.length,
    itemListElement: VILLES_DATA.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `Rendement locatif ${v.name}`,
      url: `${SITE_URL}/rendement-locatif/${v.slug}`,
    })),
  },
];

// Sort by rendement brut descending
const villesSorted = [...VILLES_DATA].sort((a, b) => b.rendementBrut - a.rendementBrut);

export default function RendementLocatifIndex() {
  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={`${SITE_URL}/logo-transparent-Lokt.jpg`} />
        {schemas.map((s, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
        ))}
      </Head>

      <AppHeader />

      <div className="bg-[#f6f9fc]">
        {/* ── HERO ── */}
        <section className="border-b border-slate-200 bg-white px-6 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto max-w-4xl">
            <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <Link href="/" className="hover:text-slate-600">Accueil</Link>
              <span>›</span>
              <Link href="/investissement-locatif" className="hover:text-slate-600">Investissement locatif</Link>
              <span>›</span>
              <span className="text-slate-600">Rendement par ville</span>
            </nav>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Comparatif 2026</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Rendement locatif par ville en France
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
              Comparez le prix au m², les loyers médians et le rendement brut estimé dans {VILLES_DATA.length} grandes villes françaises.{" "}
              <span className="font-medium text-slate-700">Données indicatives 2026.</span>
            </p>
            <div className="mt-6">
              <Link
                href="/investissement"
                className="inline-flex items-center rounded-full bg-[#635bff] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#635bff]/25 hover:bg-[#4f46e5] transition"
              >
                Calculer la rentabilité de mon bien →
              </Link>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-12">

          {/* ── TABLE COMPARATIF ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Comparatif rendement locatif — {VILLES_DATA.length} villes
            </h2>
            <p className="mt-1 text-sm text-slate-400">Classé par rendement brut décroissant. Cliquez sur une ville pour le détail.</p>

            {/* Mobile: cards */}
            <div className="mt-5 space-y-3 sm:hidden">
              {villesSorted.map((v) => (
                <Link
                  key={v.slug}
                  href={`/rendement-locatif/${v.slug}`}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-[#635bff]/40 hover:shadow-md"
                >
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-[#635bff]">{v.name}</p>
                    <p className="text-xs text-slate-400">{v.prixM2.toLocaleString("fr-FR")} €/m² · {v.loyerM2} €/m²/mois</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#635bff]">~{v.rendementBrut} %</p>
                    <p className="text-[0.65rem] text-slate-400">rendement brut</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="mt-5 hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Ville</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Région</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Prix m²</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Loyer m²/mois</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Rdt brut</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Tension</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {villesSorted.map((v) => (
                    <tr key={v.slug} className="group hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5">
                        <Link href={`/rendement-locatif/${v.slug}`} className="font-semibold text-slate-900 group-hover:text-[#635bff]">
                          {v.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{v.region}</td>
                      <td className="px-4 py-3.5 text-right text-slate-700">{v.prixM2.toLocaleString("fr-FR")} €</td>
                      <td className="px-4 py-3.5 text-right text-slate-700">{v.loyerM2} €</td>
                      <td className="px-4 py-3.5 text-right font-bold text-[#635bff]">~{v.rendementBrut} %</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          v.tensionLocative === "forte"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : v.tensionLocative === "moyenne"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-sky-200 bg-sky-50 text-sky-700"
                        }`}>
                          {v.tensionLocative === "forte" ? "Forte" : v.tensionLocative === "moyenne" ? "Moyenne" : "Modérée"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── COMMENT LIRE CES DONNÉES ── */}
          <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900">Comment lire ce tableau ?</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><span className="font-medium text-slate-800">Prix m² :</span> prix moyen dans l'ancien, toutes surfaces confondues. Varie fortement selon les quartiers.</li>
              <li><span className="font-medium text-slate-800">Loyer m²/mois :</span> loyer médian charges exclues. Varie selon la surface (les studios se louent plus cher au m²).</li>
              <li><span className="font-medium text-slate-800">Rendement brut :</span> (loyer annuel ÷ prix d'achat) × 100. Ne tient pas compte des charges, fiscalité et vacance.</li>
              <li><span className="font-medium text-slate-800">Rendement net :</span> généralement 1,5 à 2 points en dessous du brut, selon les charges et la fiscalité.</li>
            </ul>
            <p className="mt-3 text-xs text-slate-400">Données indicatives 2026 — non certifiées. Consultez le simulateur pour un calcul précis sur votre bien.</p>
          </section>

          {/* ── CTA ── */}
          <section className="rounded-2xl bg-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-25 blur-3xl bg-cyan-500" />
            <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full opacity-15 blur-3xl bg-emerald-400" />
            <div className="relative">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">Simulateur gratuit</p>
              <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
                Calculez le rendement net de votre investissement
              </h2>
              <p className="mt-2 text-sm text-slate-200 max-w-xl">
                Prix d'achat, loyer, charges, vacance, régime LMNP ou revenus fonciers — cash-flow mensuel et rendement net en 2 minutes.
              </p>
              <Link
                href="/investissement"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:opacity-95 transition"
              >
                Lancer le simulateur →
              </Link>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Questions fréquentes
            </h2>
            <div className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden">
              {faq.map(({ q, a }, i) => (
                <details key={i} className="group">
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 list-none">
                    <span>{q}</span>
                    <span className="ml-4 shrink-0 text-slate-400 transition group-open:rotate-45">+</span>
                  </summary>
                  <div className="px-5 pb-5 pt-1 text-sm leading-6 text-slate-600">{a}</div>
                </details>
              ))}
            </div>
          </section>

          {/* ── LIENS ── */}
          <section className="rounded-2xl border border-[#635bff]/20 bg-gradient-to-r from-[#635bff]/5 to-[#00b4d8]/5 p-6 sm:p-8">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Pour aller plus loin</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Guides et outils liés</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { href: "/investissement-locatif", label: "Guide complet de l'investissement locatif 2026" },
                { href: "/investissement", label: "Simulateur de rentabilité locative" },
                { href: "/blog/rentabilite-locative-comment-calculer", label: "Comment calculer le rendement net" },
                { href: "/blog/lmnp-vs-location-nue", label: "LMNP vs location nue : quel régime choisir ?" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-[#635bff]/40 hover:text-[#635bff] transition"
                >
                  {link.label}
                  <span className="ml-2 shrink-0 text-slate-400">→</span>
                </Link>
              ))}
            </div>
          </section>

        </main>
      </div>

      <AppFooter />
    </>
  );
}
