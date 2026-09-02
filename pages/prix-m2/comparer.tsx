import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from "chart.js";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import type { CityPriceData } from "../../lib/cityPriceData";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);
const Chart = dynamic(() => import("react-chartjs-2").then((m) => m.Chart), { ssr: false });

const SITE_URL = "https://lokt.fr";
const COLORS = ["#635bff", "#00b4d8", "#f59e0b"];
const MAX_CITIES = 3;

function formatEur(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

type SearchResult = { slug: string; cityName: string; postalCode: string; priceM2: number | null };

function CitySlot({ index, city, onSelect }: { index: number; city: CityPriceData | null; onSelect: (slug: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/prix-m2/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => { setResults(d.results || []); setOpen(true); })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (city) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS[index] }}>Ville {index + 1}</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{city.cityName}</p>
            <p className="text-xs text-slate-400">{city.postalCode}</p>
          </div>
          <button onClick={() => onSelect("")} className="text-xs text-slate-400 hover:text-rose-600">Changer</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative rounded-2xl border border-dashed border-slate-300 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ville {index + 1}</p>
      <input
        type="text" value={query} onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Rechercher une ville..."
        className="mt-2 w-full rounded-full border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#635bff]"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 z-10 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={r.slug}
              onClick={() => { onSelect(r.slug); setOpen(false); setQuery(""); }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <span>{r.cityName} <span className="text-slate-400">({r.postalCode})</span></span>
              <span className="text-slate-500">{r.priceM2 ? `${Math.round(r.priceM2).toLocaleString("fr-FR")} €/m²` : "—"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompareRow({ label, values, format }: { label: string; values: Array<number | null | undefined>; format: (v: number) => string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-4 py-3 text-sm text-slate-500">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-4 py-3 text-sm font-semibold text-slate-900">{v != null ? format(v) : "—"}</td>
      ))}
    </tr>
  );
}

export default function ComparerVilles() {
  const [cities, setCities] = useState<Array<CityPriceData | null>>(Array(MAX_CITIES).fill(null));

  function handleSelect(index: number, slug: string) {
    if (!slug) {
      setCities((prev) => prev.map((c, i) => (i === index ? null : c)));
      return;
    }

    fetch(`/api/prix-m2/city?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        setCities((prev) => prev.map((c, i) => (i === index ? d.city || null : c)));
      })
      .catch(() => {});
  }

  const selectedCities = cities.filter((c): c is CityPriceData => c != null);
  const canCompare = selectedCities.length >= 2;

  const chartData = canCompare
    ? {
        labels: selectedCities[0].history.filter((h) => h.priceM2 != null).map((h) => String(h.year)),
        datasets: selectedCities.map((c, i) => ({
          label: c.cityName,
          data: c.history.filter((h) => h.priceM2 != null).map((h) => Math.round(h.priceM2!)),
          borderColor: COLORS[i],
          backgroundColor: `${COLORS[i]}22`,
          tension: 0.25,
          pointRadius: 3,
        })),
      }
    : null;

  const title = "Comparer le prix au m² de plusieurs villes | lokt.fr";
  const description = "Comparez le prix médian au m², l'évolution et le rendement locatif estimé entre 2 ou 3 communes françaises — données DVF.";
  const url = `${SITE_URL}/prix-m2/comparer`;

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-slate-950">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={url} />
      </Head>

      <AppHeader staticMode />

      <section className="border-b border-slate-200 bg-white px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <Link href="/" className="hover:text-slate-600">Accueil</Link><span>›</span>
            <Link href="/prix-m2" className="hover:text-slate-600">Prix au m²</Link><span>›</span>
            <span className="text-slate-600">Comparer</span>
          </nav>
          <h1 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Comparer plusieurs villes</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Prix au m², évolution et rendement estimé, côte à côte — 2 ou 3 villes.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {cities.map((c, i) => (
            <CitySlot key={i} index={i} city={c} onSelect={(s) => handleSelect(i, s)} />
          ))}
        </div>

        {canCompare && (
          <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Indicateur</th>
                    {selectedCities.map((c, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: COLORS[i] }}>{c.cityName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Prix médian" values={selectedCities.map((c) => c.priceM2)} format={(v) => `${formatEur(v)}/m²`} />
                  <CompareRow label="Loyer estimé" values={selectedCities.map((c) => c.rentM2)} format={(v) => `${v.toFixed(1)} €/m²/mois`} />
                  <CompareRow label={`Évolution (${selectedCities[0].history[0]?.year}-${selectedCities[0].history[selectedCities[0].history.length - 1]?.year})`} values={selectedCities.map((c) => c.evolution5y)} format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} %`} />
                  <CompareRow label="Évolution 1 an" values={selectedCities.map((c) => c.evolution1y)} format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} %`} />
                  <CompareRow
                    label="Prix appartement"
                    values={selectedCities.map((c) => c.byType.find((t) => t.propertyType === "appartement")?.priceM2)}
                    format={(v) => `${formatEur(v)}/m²`}
                  />
                  <CompareRow
                    label="Prix maison"
                    values={selectedCities.map((c) => c.byType.find((t) => t.propertyType === "maison")?.priceM2)}
                    format={(v) => `${formatEur(v)}/m²`}
                  />
                </tbody>
              </table>
            </section>

            {chartData && (
              <section>
                <h2 className="text-xl font-semibold text-slate-900">Évolution comparée</h2>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <Chart type="line" data={chartData} options={{ responsive: true, plugins: { legend: { display: true, position: "top" } }, scales: { y: { ticks: { callback: (v: any) => `${v} €` } } } }} />
                </div>
              </section>
            )}

          </>
        )}

        <div className="text-center">
          <Link href="/prix-m2" className="text-sm text-[#635bff] hover:underline">← Retour à la recherche</Link>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
