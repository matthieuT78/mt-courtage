import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import {
  MapIcon,
  GlobeEuropeAfricaIcon,
  BuildingOffice2Icon,
  InformationCircleIcon,
  ArrowUpRightIcon,
} from "@heroicons/react/24/outline";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import {
  getPopularCities, getMajorCitiesForMap, getDepartmentChoropleth, getAllRegionSlugs,
  type MajorCityMarker, type DepartmentChoroplethEntry,
} from "../../lib/cityPriceData";

const FranceMap = dynamic(() => import("../../components/FranceMap"), { ssr: false });
const DepartmentChoropleth = dynamic(() => import("../../components/DepartmentChoropleth"), { ssr: false });

const SITE_URL = "https://lokt.fr";

type CityResult = { slug: string; cityName: string; postalCode: string; priceM2: number | null };

function CitySearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityResult[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/prix-m2/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => {
          setResults(d.results || []);
          setOpen(true);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={boxRef} className="relative mt-6 max-w-lg">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Rechercher une ville (ex. Lyon, Bordeaux, Rennes...)"
        className="w-full rounded-full border border-slate-200 bg-white px-5 py-3.5 text-sm text-slate-900 shadow-sm outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/20"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={r.slug}
              onClick={() => router.push(`/prix-m2/${r.slug}`)}
              className="flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">
                {r.cityName} <span className="text-slate-400">({r.postalCode})</span>
              </span>
              <span className="text-slate-500">{r.priceM2 ? `${Math.round(r.priceM2).toLocaleString("fr-FR")} €/m²` : "—"}</span>
            </button>
          ))}
        </div>
      )}
      {open && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-400 shadow-lg">
          Aucune ville trouvée.
        </div>
      )}
    </div>
  );
}

export default function PrixM2Index({
  popularCities, majorCities, departments, regions,
}: {
  popularCities: CityResult[];
  majorCities: MajorCityMarker[];
  departments: DepartmentChoroplethEntry[];
  regions: Array<{ name: string; slug: string }>;
}) {
  const [mapView, setMapView] = useState<"villes" | "departements">("villes");
  const title = "Prix au m² par ville : évolution des prix immobiliers | lokt.fr";
  const description =
    "Prix médian au m² pour plus de 29 000 communes françaises, avec évolution sur 5 ans — calculé à partir des données DVF officielles (DGFiP). Recherchez votre ville.";
  const url = `${SITE_URL}/prix-m2`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Prix immobiliers par commune — lokt.fr",
      description,
      url,
      creator: { "@type": "Organization", name: "lokt.fr", url: SITE_URL },
      license: "https://creativecommons.org/licenses/by/4.0/",
      spatialCoverage: { "@type": "Place", name: "France" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "lokt.fr", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Prix au m²", item: url },
      ],
    },
  ];

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
        {jsonLd.map((schema, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        ))}
      </Head>

      <AppHeader staticMode />

      <section className="relative overflow-hidden border-b border-slate-200 bg-white px-4 py-10 sm:py-16">
        <div className="pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full bg-[#635bff] opacity-[0.08] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-[#00b4d8] opacity-[0.07] blur-3xl" />
        <div className="relative mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[0.72rem] font-semibold text-indigo-700">
            Données DVF · 29 000+ communes
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
            Prix au m² par ville en France
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Prix médian au m², évolution sur plusieurs années et loyer estimé pour chaque commune française — calculés à partir des transactions immobilières officielles (DVF, DGFiP).
          </p>
          <CitySearchBox />
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/prix-m2/classements" className="inline-flex items-center gap-1 font-medium text-[#635bff] hover:underline">
              Voir les classements <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </Link>
            <Link href="/prix-m2/comparer" className="inline-flex items-center gap-1 font-medium text-[#635bff] hover:underline">
              Comparer deux villes <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-slate-100 pt-6 sm:max-w-lg">
            <div>
              <p className="text-xl font-bold text-slate-950">29 000+</p>
              <p className="text-xs text-slate-500">communes couvertes</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-950">2021-2025</p>
              <p className="text-xs text-slate-500">historique de prix</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-950">DVF / DGFiP</p>
              <p className="text-xs text-slate-500">source officielle</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#635bff]/10">
                <MapIcon className="h-5 w-5 text-[#635bff]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {mapView === "villes" ? "Les 10 plus grandes villes de France" : "Prix médian par département"}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {mapView === "villes" ? "Survolez ou cliquez sur une ville pour voir son prix au m²." : "Cliquez sur un département pour explorer ses communes."}
                </p>
              </div>
            </div>
            <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1 text-sm">
              <button
                onClick={() => setMapView("villes")}
                className={`rounded-full px-3 py-1.5 font-medium transition ${mapView === "villes" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
              >
                Grandes villes
              </button>
              <button
                onClick={() => setMapView("departements")}
                className={`rounded-full px-3 py-1.5 font-medium transition ${mapView === "departements" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
              >
                Départements
              </button>
            </div>
          </div>
          <div className="mt-4">
            {mapView === "villes" ? <FranceMap cities={majorCities} /> : <DepartmentChoropleth departments={departments} />}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00b4d8]/10">
              <GlobeEuropeAfricaIcon className="h-5 w-5 text-[#00b4d8]" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Parcourir par région</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {regions.map((r) => (
              <Link
                key={r.slug}
                href={`/prix-m2/region/${r.slug}`}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#635bff]/40 hover:text-[#635bff] hover:shadow-md"
              >
                {r.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <BuildingOffice2Icon className="h-5 w-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Villes les plus consultées</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {popularCities.map((c) => (
              <Link
                key={c.slug}
                href={`/prix-m2/${c.slug}`}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#635bff]/40 hover:shadow-lg"
              >
                <p className="font-semibold text-slate-900 group-hover:text-[#635bff]">{c.cityName}</p>
                <p className="mt-1 text-xs text-slate-400">{c.postalCode}</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  {c.priceM2 ? `${Math.round(c.priceM2).toLocaleString("fr-FR")} €/m²` : "—"}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 flex gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <InformationCircleIcon className="h-5 w-5 shrink-0 text-indigo-500" />
          <div>
            <h2 className="text-base font-semibold text-indigo-900">Méthodologie</h2>
            <p className="mt-1 text-sm text-indigo-800">
              Ces prix sont calculés à partir des données DVF (Demandes de Valeurs Foncières), publiées semestriellement par la DGFiP. Pour chaque commune, nous calculons le prix médian au m² sur les ventes de maisons et d'appartements, en excluant les mutations portant sur plusieurs lots (dont le prix total fausserait le calcul par lot). L'historique couvre 2021 à aujourd'hui. Ce sont des ventes réellement actées chez le notaire, pas des prix d'annonce — le niveau est donc généralement inférieur de 5 à 15 % aux estimations basées sur les annonces en cours (type SeLoger, MeilleursAgents).
            </p>
          </div>
        </section>
      </div>

      <AppFooter />
    </div>
  );
}

export async function getStaticProps() {
  const [popularCities, majorCities, departments] = await Promise.all([
    getPopularCities(24),
    getMajorCitiesForMap(),
    getDepartmentChoropleth(),
  ]);
  const regions = getAllRegionSlugs();
  return { props: { popularCities, majorCities, departments, regions }, revalidate: 60 * 60 * 24 };
}
