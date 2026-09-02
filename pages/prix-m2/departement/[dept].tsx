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
import { getDepartmentStats, getAllDepartmentSlugs, type GeoAreaStats } from "../../../lib/cityPriceData";

type CommuneRow = { slug: string; cityName: string; postalCode: string; priceM2: number | null };

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);
const Chart = dynamic(() => import("react-chartjs-2").then((m) => m.Chart), { ssr: false });

const SITE_URL = "https://lokt.fr";

function formatEur(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

export default function DepartmentHub({ area }: { area: GeoAreaStats }) {
  const [filter, setFilter] = useState("");
  const [cities, setCities] = useState<CommuneRow[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  useEffect(() => {
    setCitiesLoading(true);
    fetch(`/api/prix-m2/communes?type=departement&code=${area.code}`)
      .then((r) => r.json())
      .then((d) => setCities(d.cities || []))
      .catch(() => {})
      .finally(() => setCitiesLoading(false));
  }, [area.code]);

  const pageUrl = `${SITE_URL}/prix-m2/departement/${area.slug}`;
  const metaTitle = `Prix immobilier en ${area.name} : évolution par ville | lokt.fr`;
  const metaDesc = `Prix médian au m² dans le département ${area.name} (${area.nCommunes} communes) : ${formatEur(area.priceM2)}/m² en moyenne, évolution sur plusieurs années — données DVF officielles.`;

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

  const filteredCities = cities.filter((c) => c.cityName.toLowerCase().includes(filter.toLowerCase()));

  const jsonLd = [{
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Prix au m²", item: `${SITE_URL}/prix-m2` },
      ...(area.parentSlug ? [{ "@type": "ListItem", position: 3, name: area.parentName, item: `${SITE_URL}/prix-m2/region/${area.parentSlug}` }] : []),
      { "@type": "ListItem", position: area.parentSlug ? 4 : 3, name: area.name, item: pageUrl },
    ],
  }];

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
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
              {area.parentSlug && (<><Link href={`/prix-m2/region/${area.parentSlug}`} className="hover:text-slate-600">{area.parentName}</Link><span>›</span></>)}
              <span className="text-slate-600">{area.name}</span>
            </nav>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Département {area.code}</p>
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
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Chargement des communes...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
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
        </main>
      </div>

      <AppFooter />
    </>
  );
}

export async function getStaticPaths() {
  const depts = await getAllDepartmentSlugs();
  return { paths: depts.map((d) => ({ params: { dept: d.slug } })), fallback: false };
}

export async function getStaticProps({ params }: { params: { dept: string } }) {
  const depts = await getAllDepartmentSlugs();
  const match = depts.find((d) => d.slug === params.dept);
  if (!match) return { notFound: true };

  const area = await getDepartmentStats(match.code);
  if (!area) return { notFound: true };

  return { props: { area }, revalidate: 60 * 60 * 24 };
}
