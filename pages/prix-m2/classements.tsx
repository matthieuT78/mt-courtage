import Head from "next/head";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import {
  getCheapestCities, getMostExpensiveCities, getEvolutionRankings,
  type RankedCity,
} from "../../lib/cityPriceData";

const SITE_URL = "https://lokt.fr";

function formatEur(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

function RankingTable({
  cities, valueLabel, valueFn, positive,
}: {
  cities: RankedCity[];
  valueLabel: string;
  valueFn: (c: RankedCity) => string;
  positive?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">#</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Commune</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">{valueLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cities.map((c, i) => (
            <tr key={c.slug} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-400">{i + 1}</td>
              <td className="px-4 py-3">
                <Link href={`/prix-m2/${c.slug}`} className="font-medium text-slate-800 hover:text-[#635bff]">{c.cityName}</Link>
                <span className="ml-1.5 text-xs text-slate-400">({c.postalCode})</span>
              </td>
              <td className={`px-4 py-3 font-semibold ${positive ? "text-emerald-600" : "text-slate-900"}`}>{valueFn(c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Classements({
  cheapest, expensive, gainers, losers,
}: {
  cheapest: RankedCity[];
  expensive: RankedCity[];
  gainers: RankedCity[];
  losers: RankedCity[];
}) {
  const title = "Classements immobiliers : prix au m² par ville | lokt.fr";
  const description = "Classement des communes françaises par prix au m² et évolution sur plusieurs années — données DVF officielles.";
  const url = `${SITE_URL}/prix-m2/classements`;

  const jsonLd = [{
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Prix au m²", item: `${SITE_URL}/prix-m2` },
      { "@type": "ListItem", position: 3, name: "Classements", item: url },
    ],
  }];

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-slate-950">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`${SITE_URL}/lokt-logo.jpg`} />
        <meta property="og:image:alt" content="Classements immobiliers par ville — lokt.fr" />
        {jsonLd.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}
      </Head>

      <AppHeader staticMode />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600">Accueil</Link><span>›</span>
          <Link href="/prix-m2" className="hover:text-slate-600">Prix au m²</Link><span>›</span>
          <span className="text-slate-600">Classements</span>
        </nav>

        <h1 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Classements immobiliers</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
          Communes classées par prix au m² et évolution — basé sur les transactions DVF, communes avec au moins 10 ventes/an pour la fiabilité.
        </p>

        <div className="mt-10 space-y-12">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Villes les moins chères</h2>
            <p className="mt-1 text-sm text-slate-500">Prix médian au m² le plus bas, parmi les communes avec un marché actif.</p>
            <div className="mt-4"><RankingTable cities={cheapest} valueLabel="Prix médian" valueFn={(c) => `${formatEur(c.priceM2)}/m²`} /></div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Villes les plus chères</h2>
            <p className="mt-1 text-sm text-slate-500">Prix médian au m² le plus élevé.</p>
            <div className="mt-4"><RankingTable cities={expensive} valueLabel="Prix médian" valueFn={(c) => `${formatEur(c.priceM2)}/m²`} /></div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Plus fortes hausses de prix</h2>
            <p className="mt-1 text-sm text-slate-500">Évolution du prix médian entre la première et la dernière année disponible (DVF).</p>
            <div className="mt-4">
              <RankingTable cities={gainers} valueLabel="Évolution" positive valueFn={(c) => `+${(c.evolution5y ?? 0).toFixed(1)} %`} />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Plus fortes baisses de prix</h2>
            <div className="mt-4">
              <RankingTable cities={losers} valueLabel="Évolution" valueFn={(c) => `${(c.evolution5y ?? 0).toFixed(1)} %`} />
            </div>
          </section>

        </div>

        <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-400 leading-5">
          Classements basés sur les données DVF (Demandes de Valeurs Foncières, DGFiP), limités aux communes avec au moins 10 transactions/an pour la fiabilité statistique.
        </div>

        <div className="mt-6 text-center">
          <Link href="/prix-m2" className="text-sm text-[#635bff] hover:underline">← Rechercher une ville</Link>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}

export async function getStaticProps() {
  const [cheapest, expensive, evolution] = await Promise.all([
    getCheapestCities(25),
    getMostExpensiveCities(25),
    getEvolutionRankings(25),
  ]);

  return {
    props: {
      cheapest, expensive,
      gainers: evolution.gainers,
      losers: evolution.losers,
    },
    revalidate: 60 * 60 * 24,
  };
}
