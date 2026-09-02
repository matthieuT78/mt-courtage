import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import {
  CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from "chart.js";
import { BuildingOffice2Icon, HomeModernIcon } from "@heroicons/react/24/outline";
import AppHeader from "../../../components/AppHeader";
import AppFooter from "../../../components/AppFooter";
import { getRegionStats, getAllRegionSlugs, getAreaCommunes, getDepartmentsForRegion, type GeoAreaStats, type DepartmentLink } from "../../../lib/cityPriceData";

type CommuneRow = { slug: string; cityName: string; postalCode: string; priceM2: number | null };

// cf. departement/[dept].tsx : même logique — rendre un lot server-side crawlable
// et borné, puis élargir à la demande côté client pour les grandes régions
// (certaines dépassent 3 700 communes).
const SSR_COMMUNES_CAP = 600;

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);
const Chart = dynamic(() => import("react-chartjs-2").then((m) => m.Chart), { ssr: false });

const SITE_URL = "https://lokt.fr";

function formatEur(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

export default function RegionHub({ area, initialCities, childDepartments, topCity, cheapestCity }: { area: GeoAreaStats; initialCities: CommuneRow[]; childDepartments: DepartmentLink[]; topCity: CommuneRow | null; cheapestCity: CommuneRow | null }) {
  const [filter, setFilter] = useState("");
  const [cities, setCities] = useState<CommuneRow[]>(initialCities);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [fullyLoaded, setFullyLoaded] = useState(initialCities.length >= area.nCommunes);

  const filteredCities = cities.filter((c) => c.cityName.toLowerCase().includes(filter.toLowerCase()));

  useEffect(() => {
    if (fullyLoaded || filter.trim().length < 2 || filteredCities.length > 0) return;
    setCitiesLoading(true);
    fetch(`/api/prix-m2/communes?type=region&code=${encodeURIComponent(area.code)}`)
      .then((r) => r.json())
      .then((d) => {
        setCities(d.cities && d.cities.length ? d.cities : cities);
        setFullyLoaded(true);
      })
      .catch(() => {})
      .finally(() => setCitiesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, fullyLoaded, filteredCities.length, area.code]);

  const pageUrl = `${SITE_URL}/prix-m2/region/${area.slug}`;
  const metaTitle = `Prix immobilier en région ${area.name} : évolution par ville | lokt.fr`;
  const metaDesc = `Prix médian au m² en région ${area.name} (${area.nCommunes} communes) : ${formatEur(area.priceM2)}/m² en moyenne, évolution sur plusieurs années — données DVF officielles.`;

  const yearsWithPrice = area.history.filter((h) => h.priceM2 != null);
  const chartData = {
    labels: yearsWithPrice.map((h) => String(h.year)),
    datasets: [{
      label: "Prix médian €/m²", data: yearsWithPrice.map((h) => Math.round(h.priceM2!)),
      borderColor: "#635bff", backgroundColor: "rgba(99, 91, 255, 0.1)", tension: 0.25, fill: true,
      pointRadius: 4, pointBackgroundColor: "#635bff",
    }],
  };
  const chartOptions = {
    responsive: true, plugins: { legend: { display: false } },
    scales: { y: { ticks: { callback: (v: any) => `${v} €` }, grid: { color: "#f1f5f9" } }, x: { grid: { display: false } } },
  };

  const faq = [
    {
      q: `Quel est le prix moyen au m² en région ${area.name} ?`,
      a: `Le prix médian au m² en région ${area.name} est d'environ ${formatEur(area.priceM2)}, calculé à partir des données DVF (Demandes de Valeurs Foncières) publiées par la DGFiP sur les ${area.nCommunes} communes de la région. Les prix varient fortement entre les grandes agglomérations et les zones rurales : consultez la page de chaque département ou ville pour un chiffre précis.`,
    },
    {
      q: `Comment évolue le prix de l'immobilier en région ${area.name} ?`,
      a: yearsWithPrice.length >= 2
        ? `Sur la période observée (${yearsWithPrice[0]?.year}-${yearsWithPrice[yearsWithPrice.length - 1]?.year}), le prix médian au m² en ${area.name} a ${(area.evolution5y ?? 0) >= 0 ? "progressé" : "reculé"} de ${Math.abs(area.evolution5y ?? 0).toFixed(1)} %.`
        : `Les données historiques pour cette région sont encore limitées pour établir une tendance sur plusieurs années.`,
    },
    ...(topCity ? [{
      q: `Quelle est la commune la plus chère de la région ${area.name} ?`,
      a: `Parmi les communes de la région ${area.name} avec suffisamment de transactions DVF, ${topCity.cityName} affiche le prix médian au m² le plus élevé, autour de ${formatEur(topCity.priceM2)}/m².${cheapestCity ? ` À l'inverse, ${cheapestCity.cityName} est la commune la plus abordable de la région, autour de ${formatEur(cheapestCity.priceM2)}/m².` : ""}`,
    }] : []),
    {
      q: `Combien de départements compte la région ${area.name} ?`,
      a: `La région ${area.name} compte ${childDepartments.length} département${childDepartments.length > 1 ? "s" : ""} : ${childDepartments.map((d) => d.name).join(", ")}.`,
    },
    {
      q: `D'où viennent ces données de prix ?`,
      a: `Ces prix sont calculés à partir des données DVF (Demandes de Valeurs Foncières), publiées semestriellement par la DGFiP via data.gouv.fr. Elles recensent la quasi-totalité des transactions immobilières réellement actées chez le notaire (hors Alsace-Moselle et Mayotte, qui utilisent un régime de publicité foncière différent).`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Prix au m²", item: `${SITE_URL}/prix-m2` },
        { "@type": "ListItem", position: 3, name: area.name, item: pageUrl },
      ],
    },
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={`${SITE_URL}/lokt-logo.jpg`} />
        <meta property="og:image:alt" content={`Prix immobilier en région ${area.name} — lokt.fr`} />
        {jsonLd.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}
      </Head>

      <AppHeader />

      <div className="bg-[#f6f9fc]">
        <section className="relative overflow-hidden border-b border-slate-200 bg-white px-6 py-10 sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#635bff] opacity-[0.07] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[#00b4d8] opacity-[0.06] blur-3xl" />
          <div className="relative mx-auto max-w-4xl">
            <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <Link href="/" className="hover:text-slate-600">Accueil</Link><span>›</span>
              <Link href="/prix-m2" className="hover:text-slate-600">Prix au m²</Link><span>›</span>
              <span className="text-slate-600">{area.name}</span>
            </nav>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Région</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Prix immobilier en {area.name}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">{area.nCommunes} communes avec données DVF, prix médian et évolution.</p>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-gradient-to-br from-[#f8f7ff] to-[#eef6fb] p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prix médian · tous types</p>
                  <p className="mt-1 text-4xl font-bold text-slate-950 sm:text-5xl">
                    {formatEur(area.priceM2)}
                    <span className="ml-2 text-base font-medium text-slate-400">/m²</span>
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {area.byType.find((t) => t.propertyType === "appartement")?.priceM2 != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm">
                        <BuildingOffice2Icon className="h-4 w-4 text-[#635bff]" />
                        <span className="text-slate-500">Appartement</span>
                        <span className="font-semibold text-slate-900">{formatEur(area.byType.find((t) => t.propertyType === "appartement")?.priceM2)}/m²</span>
                      </span>
                    )}
                    {area.byType.find((t) => t.propertyType === "maison")?.priceM2 != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm">
                        <HomeModernIcon className="h-4 w-4 text-[#635bff]" />
                        <span className="text-slate-500">Maison</span>
                        <span className="font-semibold text-slate-900">{formatEur(area.byType.find((t) => t.propertyType === "maison")?.priceM2)}/m²</span>
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Évolution</p>
                  <p className={`mt-1 text-2xl font-bold ${(area.evolution5y ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {area.evolution5y != null ? `${area.evolution5y >= 0 ? "+" : ""}${area.evolution5y.toFixed(1)} %` : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-10">
          {yearsWithPrice.length >= 2 && (
            <section>
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Évolution du prix en {area.name}</h2>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
                <Chart type="line" data={chartData} options={chartOptions} />
              </div>
            </section>
          )}

          {childDepartments.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Départements de {area.name}</h2>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {childDepartments.map((d) => (
                  <Link
                    key={d.slug}
                    href={`/prix-m2/departement/${d.slug}`}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#635bff]/40 hover:text-[#635bff] hover:shadow-md"
                  >
                    {d.name} <span className="text-slate-400">({d.code})</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Communes de {area.name}</h2>
              <input
                type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrer par nom..."
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-[#635bff]"
              />
            </div>
            <div className="mt-4 max-h-[600px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Commune</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Code postal</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Prix médian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCities.map((c) => (
                    <tr key={c.slug} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/prix-m2/${c.slug}`} className="font-medium text-slate-800 hover:text-[#635bff]">{c.cityName}</Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{c.postalCode}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatEur(c.priceM2)}</td>
                    </tr>
                  ))}
                  {!citiesLoading && filteredCities.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Aucune commune trouvée.</td></tr>
                  )}
                  {citiesLoading && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Recherche dans les {area.nCommunes} communes de la région...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {!fullyLoaded && !filter && (
              <p className="mt-2 text-xs text-slate-400">
                {initialCities.length} communes affichées sur {area.nCommunes} (triées par prix) — tapez un nom pour retrouver une commune plus rare.
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-25 blur-3xl bg-cyan-500" />
            <div className="relative">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">Simulateur gratuit</p>
              <h2 className="mt-2 text-xl font-semibold sm:text-2xl">Calculez la rentabilité d'un investissement en {area.name}</h2>
              <Link href="/investissement" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:opacity-95 transition">
                Lancer le simulateur →
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Questions fréquentes</h2>
            <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {faq.map((item) => (
                <details key={item.q} className="group p-4 sm:p-5">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 marker:content-none">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </main>
      </div>

      <AppFooter />
    </>
  );
}

export async function getStaticPaths() {
  const regions = getAllRegionSlugs();
  return { paths: regions.map((r) => ({ params: { region: r.slug } })), fallback: false };
}

export async function getStaticProps({ params }: { params: { region: string } }) {
  const regions = getAllRegionSlugs();
  const match = regions.find((r) => r.slug === params.region);
  if (!match) return { notFound: true };

  const area = await getRegionStats(match.name);
  if (!area) return { notFound: true };

  const allCities = await getAreaCommunes("region", match.name);
  const initialCities = allCities.slice(0, SSR_COMMUNES_CAP);
  const pricedCities = allCities.filter((c) => c.priceM2 != null);
  const topCity = pricedCities[0] || null;
  const cheapestCity = pricedCities.length > 1 ? pricedCities[pricedCities.length - 1] : null;
  const childDepartments = getDepartmentsForRegion(match.name);

  return { props: { area, initialCities, childDepartments, topCity, cheapestCity }, revalidate: 60 * 60 * 24 };
}
