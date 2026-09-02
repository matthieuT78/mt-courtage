// lib/cityPriceData.ts
// Données de prix au m² par commune (DVF) pour les pages /prix-m2/[slug].
import { supabaseAdmin } from "./supabaseAdmin";
import { getDepartmentCodeFromInsee, getRegionForDepartment, DEPARTMENT_TO_REGION, REGIONS, slugify } from "./frenchGeo";
import { getDepartmentNames } from "./frenchGeoServer";
import { slugifyCityName, citySlug, parseCitySlug } from "./cityPriceSlug";

export { slugifyCityName, citySlug, parseCitySlug };

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// PostgREST plafonne à 1000 lignes par requête (max_rows) : pour les
// requêtes portant sur beaucoup de communes (département entier, France
// entière pour la carte), on doit paginer plutôt que .limit() au-delà.
async function fetchAllPaginated<T>(buildQuery: () => any, pageSize = 1000): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export type CityPricePoint = {
  year: number;
  priceM2: number | null;
  rentM2: number | null;
  nTransactions: number | null;
};

export type CityPriceByType = {
  propertyType: "maison" | "appartement";
  priceM2: number | null;
  nTransactions: number | null;
};

export type CityPriceByRoom = {
  roomBracket: "T1" | "T2" | "T3" | "T4+";
  priceM2: number | null;
  nTransactions: number | null;
};

export type CityPriceData = {
  inseeCode: string;
  cityName: string;
  postalCode: string;
  priceM2: number | null;
  rentM2: number | null;
  history: CityPricePoint[];
  historyByType: Record<"tous" | "maison" | "appartement", CityPricePoint[]>;
  evolution5y: number | null;
  evolution1y: number | null;
  byType: CityPriceByType[];
  byRoom: CityPriceByRoom[];
  latestYear: number | null;
  departmentCode: string;
  departmentName: string;
  regionName: string | null;
  departmentAvgPriceM2: number | null;
  regionAvgPriceM2: number | null;
  nationalAvgPriceM2: number | null;
};


function computeEvolution(history: CityPricePoint[]) {
  const withPrice = history.filter((p) => p.priceM2 != null && p.priceM2 > 0);
  if (withPrice.length < 2) return { evolution5y: null, evolution1y: null };

  const first = withPrice[0];
  const last = withPrice[withPrice.length - 1];
  const prev = withPrice[withPrice.length - 2];

  const evolution5y = first.priceM2 ? ((last.priceM2! - first.priceM2!) / first.priceM2!) * 100 : null;
  const evolution1y =
    last.year !== prev.year && prev.priceM2 ? ((last.priceM2! - prev.priceM2!) / prev.priceM2!) * 100 : null;

  return { evolution5y, evolution1y };
}

export async function getCityPriceData(inseeCode: string): Promise<CityPriceData | null> {
  if (!supabaseAdmin) return null;

  const [{ data: current }, { data: historyRows }] = await Promise.all([
    supabaseAdmin.from("city_market_benchmarks").select("*").eq("insee_code", inseeCode).maybeSingle(),
    supabaseAdmin
      .from("city_market_benchmarks_history")
      .select("year, property_type, reference_price_m2_sale, reference_rent_m2, n_transactions")
      .eq("insee_code", inseeCode)
      .order("year", { ascending: true }),
  ]);

  if (!current) return null;

  const rows = historyRows || [];

  const history: CityPricePoint[] = rows
    .filter((h) => h.property_type === "tous")
    .map((h) => ({
      year: h.year,
      priceM2: h.reference_price_m2_sale,
      rentM2: h.reference_rent_m2,
      nTransactions: h.n_transactions,
    }));

  const { evolution5y, evolution1y } = computeEvolution(history);

  const latestYear = history.length ? history[history.length - 1].year : null;
  const byType: CityPriceByType[] = rows
    .filter((h) => h.year === latestYear && (h.property_type === "maison" || h.property_type === "appartement"))
    .map((h) => ({
      propertyType: h.property_type as "maison" | "appartement",
      priceM2: h.reference_price_m2_sale,
      nTransactions: h.n_transactions,
    }));

  const historyByType = {
    tous: history,
    maison: rows.filter((h) => h.property_type === "maison").map((h) => ({
      year: h.year, priceM2: h.reference_price_m2_sale, rentM2: h.reference_rent_m2, nTransactions: h.n_transactions,
    })),
    appartement: rows.filter((h) => h.property_type === "appartement").map((h) => ({
      year: h.year, priceM2: h.reference_price_m2_sale, rentM2: h.reference_rent_m2, nTransactions: h.n_transactions,
    })),
  };

  const departmentCode = getDepartmentCodeFromInsee(inseeCode);
  const departmentName = getDepartmentNames().get(departmentCode) || departmentCode;
  const regionName = getRegionForDepartment(departmentCode);

  const [departmentAvgPriceM2, regionAvgPriceM2, nationalAvgPriceM2, roomRows] = await Promise.all([
    getLatestGeoStat("departement", departmentCode),
    regionName ? getLatestGeoStat("region", regionName) : Promise.resolve(null),
    getLatestGeoStat("national", "FR"),
    latestYear
      ? supabaseAdmin
          .from("city_market_benchmarks_rooms")
          .select("room_bracket, price_m2, n_transactions")
          .eq("insee_code", inseeCode)
          .eq("year", latestYear)
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const byRoom: CityPriceByRoom[] = (roomRows || [])
    .map((r) => ({ roomBracket: r.room_bracket as "T1" | "T2" | "T3" | "T4+", priceM2: r.price_m2, nTransactions: r.n_transactions }))
    .sort((a, b) => a.roomBracket.localeCompare(b.roomBracket));

  return {
    inseeCode: current.insee_code,
    cityName: current.city_name,
    postalCode: current.postal_code,
    priceM2: current.reference_price_m2_sale,
    rentM2: current.reference_rent_m2,
    history,
    historyByType,
    evolution5y,
    evolution1y,
    byType,
    byRoom,
    latestYear,
    departmentCode,
    departmentName,
    regionName,
    departmentAvgPriceM2,
    regionAvgPriceM2,
    nationalAvgPriceM2,
  };
}

async function getLatestGeoStat(
  geoType: "departement" | "region" | "national",
  geoCode: string,
  propertyType: "tous" | "maison" | "appartement" = "tous"
): Promise<number | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("city_market_benchmarks_geo_stats")
    .select("price_m2")
    .eq("geo_type", geoType)
    .eq("geo_code", geoCode)
    .eq("property_type", propertyType)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.price_m2 ?? null;
}

// Communes pré-générées au build (les plus actives, par volume de transactions
// sur la dernière année dispo) — le reste est généré à la demande (fallback
// blocking) puis mis en cache par l'ISR.
export async function getTopCitySlugs(limit = 300): Promise<string[]> {
  if (!supabaseAdmin) return [];

  const { data: yearRow } = await supabaseAdmin
    .from("city_market_benchmarks_history")
    .select("year")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestYear = yearRow?.year;
  if (!latestYear) return [];

  const { data } = await supabaseAdmin
    .from("city_market_benchmarks_history")
    .select("insee_code, city_name")
    .eq("year", latestYear)
    .eq("property_type", "tous")
    .order("n_transactions", { ascending: false })
    .limit(limit);

  return (data || [])
    .filter((r) => r.insee_code && r.city_name)
    .map((r) => citySlug(r.city_name, r.insee_code));
}

export async function getPopularCities(limit = 24) {
  if (!supabaseAdmin) return [];

  const { data: yearRow } = await supabaseAdmin
    .from("city_market_benchmarks_history")
    .select("year")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestYear = yearRow?.year;
  if (!latestYear) return [];

  const { data } = await supabaseAdmin
    .from("city_market_benchmarks_history")
    .select("insee_code, city_name, postal_code, reference_price_m2_sale, n_transactions")
    .eq("year", latestYear)
    .eq("property_type", "tous")
    .order("n_transactions", { ascending: false })
    .limit(limit);

  return (data || [])
    .filter((r) => r.insee_code && r.city_name)
    .map((r) => ({
      slug: citySlug(r.city_name, r.insee_code),
      cityName: r.city_name,
      postalCode: r.postal_code,
      priceM2: r.reference_price_m2_sale,
    }));
}

export type MajorCityMarker = {
  name: string;
  lat: number;
  lon: number;
  priceM2: number | null;
  slug: string | null;
};

// Les 10 plus grandes villes françaises par population. Paris, Lyon et
// Marseille n'existent pas comme commune unique dans les données DVF (elles
// y sont découpées par arrondissement) : on agrège leurs arrondissements par
// une moyenne pondérée par le nombre de transactions, et on pointe le lien
// vers l'arrondissement le plus actif. Strasbourg est absente du DVF (régime
// local du livre foncier en Alsace-Moselle, hors périmètre DVF) : remplacée
// par Rennes (11e ville française par population).
const MAJOR_CITIES: Array<{ name: string; lat: number; lon: number; inseePrefix?: string; inseeCode?: string }> = [
  { name: "Paris", lat: 48.8566, lon: 2.3522, inseePrefix: "751" },
  { name: "Marseille", lat: 43.2965, lon: 5.3698, inseePrefix: "132" },
  { name: "Lyon", lat: 45.764, lon: 4.8357, inseePrefix: "693" },
  { name: "Toulouse", lat: 43.6047, lon: 1.4442, inseeCode: "31555" },
  { name: "Nice", lat: 43.7102, lon: 7.262, inseeCode: "06088" },
  { name: "Nantes", lat: 47.2184, lon: -1.5536, inseeCode: "44109" },
  { name: "Montpellier", lat: 43.6108, lon: 3.8767, inseeCode: "34172" },
  { name: "Bordeaux", lat: 44.8378, lon: -0.5792, inseeCode: "33063" },
  { name: "Lille", lat: 50.6292, lon: 3.0573, inseeCode: "59350" },
  { name: "Rennes", lat: 48.1173, lon: -1.6778, inseeCode: "35238" },
];

export async function getMajorCitiesForMap(): Promise<MajorCityMarker[]> {
  if (!supabaseAdmin) return [];

  const singleCodes = MAJOR_CITIES.filter((c) => c.inseeCode).map((c) => c.inseeCode!);
  const { data: singleRows } = await supabaseAdmin
    .from("city_market_benchmarks")
    .select("insee_code, city_name, reference_price_m2_sale")
    .in("insee_code", singleCodes);

  const { data: yearRow } = await supabaseAdmin
    .from("city_market_benchmarks_history")
    .select("year")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestYear = yearRow?.year;

  const splitCities = MAJOR_CITIES.filter((c) => c.inseePrefix);
  const splitResults = new Map<string, { priceM2: number | null; slug: string | null }>();

  if (latestYear) {
    for (const c of splitCities) {
      const { data: rows } = await supabaseAdmin
        .from("city_market_benchmarks_history")
        .select("insee_code, city_name, reference_price_m2_sale, n_transactions")
        .eq("year", latestYear)
        .eq("property_type", "tous")
        .like("insee_code", `${c.inseePrefix}%`);

      if (!rows || rows.length === 0) continue;

      let weightedSum = 0;
      let totalN = 0;
      let topRow = rows[0];
      for (const r of rows) {
        const n = r.n_transactions || 0;
        if (r.reference_price_m2_sale != null) weightedSum += r.reference_price_m2_sale * n;
        totalN += n;
        if (n > (topRow.n_transactions || 0)) topRow = r;
      }

      splitResults.set(c.name, {
        priceM2: totalN > 0 ? weightedSum / totalN : null,
        slug: citySlug(topRow.city_name, topRow.insee_code),
      });
    }
  }

  return MAJOR_CITIES.map((c) => {
    if (c.inseeCode) {
      const row = (singleRows || []).find((r) => r.insee_code === c.inseeCode);
      return {
        name: c.name,
        lat: c.lat,
        lon: c.lon,
        priceM2: row?.reference_price_m2_sale ?? null,
        slug: row ? citySlug(row.city_name, row.insee_code) : null,
      };
    }
    const agg = splitResults.get(c.name);
    return { name: c.name, lat: c.lat, lon: c.lon, priceM2: agg?.priceM2 ?? null, slug: agg?.slug ?? null };
  });
}

export async function searchCities(query: string, limit = 8) {
  if (!supabaseAdmin || query.trim().length < 2) return [];

  const { data } = await supabaseAdmin
    .from("city_market_benchmarks")
    .select("insee_code, city_name, postal_code, reference_price_m2_sale")
    .ilike("city_name", `${query.trim()}%`)
    .order("city_name", { ascending: true })
    .limit(limit);

  return (data || []).map((r) => ({
    slug: citySlug(r.city_name, r.insee_code),
    cityName: r.city_name,
    postalCode: r.postal_code,
    priceM2: r.reference_price_m2_sale,
  }));
}

// ── Département / région ─────────────────────────────────────────────────

export type GeoAreaStats = {
  code: string;
  name: string;
  slug: string;
  parentName: string | null;
  parentSlug: string | null;
  priceM2: number | null;
  evolution5y: number | null;
  history: CityPricePoint[];
  byType: CityPriceByType[];
  nCommunes: number;
};

async function getGeoStatsHistory(
  geoType: "departement" | "region" | "national",
  geoCode: string,
  propertyType: "tous" | "maison" | "appartement" = "tous"
): Promise<CityPricePoint[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("city_market_benchmarks_geo_stats")
    .select("year, price_m2, n_transactions")
    .eq("geo_type", geoType)
    .eq("geo_code", geoCode)
    .eq("property_type", propertyType)
    .order("year", { ascending: true });

  return (data || []).map((r) => ({ year: r.year, priceM2: r.price_m2, rentM2: null, nTransactions: r.n_transactions }));
}

// Séparé de getDepartmentStats/getRegionStats et récupéré côté client (voir
// /api/prix-m2/communes) plutôt qu'embarqué dans les props de la page :
// certaines régions dépassent 3 700 communes, ce qui gonflait le payload
// d'hydratation à 300-400 Ko (seuil recommandé Next.js : 128 Ko).
export async function getAreaCommunes(
  type: "departement" | "region",
  code: string
): Promise<Array<{ slug: string; cityName: string; postalCode: string; priceM2: number | null }>> {
  if (!supabaseAdmin) return [];

  const rows = await fetchAllPaginated<{
    insee_code: string; city_name: string; postal_code: string; reference_price_m2_sale: number | null;
  }>(() => {
    let q = supabaseAdmin!
      .from("city_market_benchmarks")
      .select("insee_code, city_name, postal_code, reference_price_m2_sale")
      .order("reference_price_m2_sale", { ascending: false });
    if (type === "departement") {
      q = q.like("insee_code", `${code}%`);
    } else {
      const deptCodes = Object.entries(DEPARTMENT_TO_REGION).filter(([, r]) => r === code).map(([c]) => c);
      q = q.or(deptCodes.map((c) => `insee_code.like.${c}%`).join(","));
    }
    return q;
  });

  return rows.map((c) => ({
    slug: citySlug(c.city_name, c.insee_code),
    cityName: c.city_name,
    postalCode: c.postal_code,
    priceM2: c.reference_price_m2_sale,
  }));
}

export async function getDepartmentStats(deptCode: string): Promise<GeoAreaStats | null> {
  if (!supabaseAdmin) return null;

  const name = getDepartmentNames().get(deptCode.toUpperCase());
  if (!name) return null;
  const regionName = getRegionForDepartment(deptCode);

  const [nCommunes, history, maisonPrice, appartPrice] = await Promise.all([
    fetchAllPaginated<{ insee_code: string }>(() =>
      supabaseAdmin!.from("city_market_benchmarks").select("insee_code").like("insee_code", `${deptCode}%`)
    ).then((r) => r.length),
    getGeoStatsHistory("departement", deptCode),
    getLatestGeoStat("departement", deptCode, "maison"),
    getLatestGeoStat("departement", deptCode, "appartement"),
  ]);

  const { evolution5y } = computeEvolution(history);

  return {
    code: deptCode,
    name,
    slug: slugify(name),
    parentName: regionName,
    parentSlug: regionName ? slugify(regionName) : null,
    priceM2: history.length ? history[history.length - 1].priceM2 : null,
    evolution5y,
    history,
    byType: [
      { propertyType: "maison", priceM2: maisonPrice, nTransactions: null },
      { propertyType: "appartement", priceM2: appartPrice, nTransactions: null },
    ],
    nCommunes,
  };
}

export async function getRegionStats(regionName: string): Promise<GeoAreaStats | null> {
  if (!supabaseAdmin) return null;

  const deptCodes = Object.entries(DEPARTMENT_TO_REGION)
    .filter(([, r]) => r === regionName)
    .map(([code]) => code);
  if (deptCodes.length === 0) return null;

  const orFilter = deptCodes.map((c) => `insee_code.like.${c}%`).join(",");

  const [nCommunes, history, maisonPrice, appartPrice] = await Promise.all([
    fetchAllPaginated<{ insee_code: string }>(() =>
      supabaseAdmin!.from("city_market_benchmarks").select("insee_code").or(orFilter)
    ).then((r) => r.length),
    getGeoStatsHistory("region", regionName),
    getLatestGeoStat("region", regionName, "maison"),
    getLatestGeoStat("region", regionName, "appartement"),
  ]);

  const { evolution5y } = computeEvolution(history);

  return {
    code: regionName,
    name: regionName,
    slug: slugify(regionName),
    parentName: "France",
    parentSlug: null,
    priceM2: history.length ? history[history.length - 1].priceM2 : null,
    evolution5y,
    history,
    byType: [
      { propertyType: "maison", priceM2: maisonPrice, nTransactions: null },
      { propertyType: "appartement", priceM2: appartPrice, nTransactions: null },
    ],
    nCommunes,
  };
}

export async function getAllDepartmentSlugs(): Promise<Array<{ code: string; slug: string }>> {
  const names = getDepartmentNames();
  return Array.from(names.entries()).map(([code, name]) => ({ code, slug: slugify(name) }));
}

export function getAllRegionSlugs(): Array<{ name: string; slug: string }> {
  return REGIONS.map((name) => ({ name, slug: slugify(name) }));
}

export type DepartmentLink = { code: string; name: string; slug: string };

// Utilisé pour le maillage interne : liste texte des départements d'une région
// (page région) ou de tous les départements (hub), en vrais <Link> crawlables —
// à la différence de la carte choroplèthe, qui ne l'est pas (clic JS sur SVG).
export function getAllDepartmentsWithNames(): DepartmentLink[] {
  const names = getDepartmentNames();
  return Array.from(names.entries())
    .map(([code, name]) => ({ code, name, slug: slugify(name) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function getDepartmentsForRegion(regionName: string): DepartmentLink[] {
  const names = getDepartmentNames();
  return Object.entries(DEPARTMENT_TO_REGION)
    .filter(([, r]) => r === regionName)
    .map(([code]) => ({ code, name: names.get(code) || code, slug: slugify(names.get(code) || code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export type NationalStats = {
  priceM2: number | null;
  latestYear: number | null;
  evolution5y: number | null;
  avgInvestmentScore: number | null;
};

// KPI "France entière" affichés sur le hub /prix-m2, à côté de la carte.
export async function getNationalStats(): Promise<NationalStats> {
  if (!supabaseAdmin) return { priceM2: null, latestYear: null, evolution5y: null, avgInvestmentScore: null };

  const [history, scoreRows] = await Promise.all([
    getGeoStatsHistory("national", "FR"),
    // fetchAllPaginated indispensable ici : PostgREST plafonne un select sans
    // .range() à 1000 lignes, largement sous les ~5 300 communes notées —
    // une moyenne sur un sous-ensemble tronqué aurait été silencieusement fausse.
    fetchAllPaginated<{ investment_score: number }>(() =>
      supabaseAdmin!.from("city_external_kpis").select("investment_score").not("investment_score", "is", null)
    ),
  ]);

  const withPrice = history.filter((p) => p.priceM2 != null);
  const latest = withPrice[withPrice.length - 1] || null;
  const { evolution5y } = computeEvolution(history);

  const scores = scoreRows.map((r) => r.investment_score);
  const avgInvestmentScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return {
    priceM2: latest?.priceM2 ?? null,
    latestYear: latest?.year ?? null,
    evolution5y,
    avgInvestmentScore,
  };
}

export type DepartmentChoroplethEntry = { code: string; name: string; slug: string; priceM2: number | null };

export async function getDepartmentChoropleth(): Promise<DepartmentChoroplethEntry[]> {
  if (!supabaseAdmin) return [];

  const { data: yearRow } = await supabaseAdmin
    .from("city_market_benchmarks_geo_stats")
    .select("year")
    .eq("geo_type", "departement")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestYear = yearRow?.year;
  if (!latestYear) return [];

  const { data } = await supabaseAdmin
    .from("city_market_benchmarks_geo_stats")
    .select("geo_code, price_m2")
    .eq("geo_type", "departement")
    .eq("property_type", "tous")
    .eq("year", latestYear);

  const names = getDepartmentNames();
  return (data || []).map((r) => {
    const name = names.get(r.geo_code) || r.geo_code;
    return { code: r.geo_code, name, slug: slugify(name), priceM2: r.price_m2 };
  });
}

// ── Classements ───────────────────────────────────────────────────────────

export type RankedCity = {
  slug: string;
  cityName: string;
  postalCode: string;
  priceM2: number | null;
  evolution5y?: number | null;
  yieldPct?: number | null;
  investmentScore?: number | null;
  investmentScoreBand?: string | null;
};

// Aligné sur le seuil "Fiable" de ReliabilityBadge (cf. pages/prix-m2/[slug].tsx) :
// un classement expose des extrêmes par construction (le plus cher, la plus
// forte hausse...), c'est justement là que le bruit d'échantillonnage d'une
// petite commune est le plus visible et le plus trompeur — pas de place pour
// une nuance/avertissement contextuel comme sur une fiche ville. 3 727
// communes ont 30+ ventes en 2025, largement assez pour remplir les classements.
const MIN_TRANSACTIONS_FOR_RANKING = 30;

export async function getCheapestCities(limit = 30): Promise<RankedCity[]> {
  return getSortedCities(true, limit);
}

export async function getMostExpensiveCities(limit = 30): Promise<RankedCity[]> {
  return getSortedCities(false, limit);
}

async function getSortedCities(ascending: boolean, limit: number): Promise<RankedCity[]> {
  if (!supabaseAdmin) return [];

  // On ne classe que les communes avec assez de transactions récentes pour
  // que le prix médian soit représentatif (cf. limite connue : une commune
  // avec 1-2 ventes/an peut afficher un prix aberrant).
  const { data: yearRow } = await supabaseAdmin
    .from("city_market_benchmarks_history")
    .select("year")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestYear = yearRow?.year;

  const reliableCodes = latestYear
    ? await fetchAllPaginated<{ insee_code: string }>(() =>
        supabaseAdmin!
          .from("city_market_benchmarks_history")
          .select("insee_code")
          .eq("year", latestYear)
          .eq("property_type", "tous")
          .gte("n_transactions", MIN_TRANSACTIONS_FOR_RANKING)
      )
    : [];
  const reliableSet = new Set(reliableCodes.map((r) => r.insee_code));
  if (reliableSet.size === 0) return [];

  // Filtrer AVANT de trier (pas l'inverse) : les communes les moins chères
  // en tri brut sont presque toutes des communes à 1-2 transactions/an — un
  // tri global puis intersection avec les communes fiables ne remontait
  // quasiment aucun résultat (aucun recoupement dans les ~125 premières).
  const allRows = await fetchAllPaginated<{
    insee_code: string; city_name: string; postal_code: string; reference_price_m2_sale: number | null;
  }>(() =>
    supabaseAdmin!
      .from("city_market_benchmarks")
      .select("insee_code, city_name, postal_code, reference_price_m2_sale")
      .not("reference_price_m2_sale", "is", null)
  );

  const filtered = allRows.filter((r) => reliableSet.has(r.insee_code));
  filtered.sort((a, b) =>
    ascending ? a.reference_price_m2_sale! - b.reference_price_m2_sale! : b.reference_price_m2_sale! - a.reference_price_m2_sale!
  );

  return filtered.slice(0, limit).map((r) => ({
    slug: citySlug(r.city_name, r.insee_code),
    cityName: r.city_name,
    postalCode: r.postal_code,
    priceM2: r.reference_price_m2_sale,
  }));
}

export async function getEvolutionRankings(limit = 30): Promise<{ gainers: RankedCity[]; losers: RankedCity[] }> {
  if (!supabaseAdmin) return { gainers: [], losers: [] };

  // Deux requêtes min/max plutôt qu'un .select("year") dédupliqué en JS :
  // une seule année totalise déjà ~30 000 lignes, largement au-dessus du
  // plafond PostgREST (1000 lignes/requête) — un tri sans agrégat renvoyait
  // uniquement l'année la plus ancienne, jamais les suivantes.
  const [{ data: firstYearRow }, { data: lastYearRow }] = await Promise.all([
    supabaseAdmin.from("city_market_benchmarks_history").select("year").eq("property_type", "tous").order("year", { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin.from("city_market_benchmarks_history").select("year").eq("property_type", "tous").order("year", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const firstYear = firstYearRow?.year;
  const lastYear = lastYearRow?.year;
  if (!firstYear || !lastYear || firstYear === lastYear) return { gainers: [], losers: [] };

  const [firstRows, lastRows] = await Promise.all([
    fetchAllPaginated<{ insee_code: string; city_name: string; postal_code: string; reference_price_m2_sale: number | null; n_transactions: number | null }>(() =>
      supabaseAdmin!
        .from("city_market_benchmarks_history")
        .select("insee_code, city_name, postal_code, reference_price_m2_sale, n_transactions")
        .eq("year", firstYear)
        .eq("property_type", "tous")
    ),
    fetchAllPaginated<{ insee_code: string; city_name: string; postal_code: string; reference_price_m2_sale: number | null; n_transactions: number | null }>(() =>
      supabaseAdmin!
        .from("city_market_benchmarks_history")
        .select("insee_code, city_name, postal_code, reference_price_m2_sale, n_transactions")
        .eq("year", lastYear)
        .eq("property_type", "tous")
    ),
  ]);

  const firstByInsee = new Map(firstRows.map((r) => [r.insee_code, r]));
  const ranked: Array<RankedCity & { insee: string }> = [];

  for (const last of lastRows) {
    const first = firstByInsee.get(last.insee_code);
    if (!first) continue;
    if ((first.n_transactions || 0) < MIN_TRANSACTIONS_FOR_RANKING || (last.n_transactions || 0) < MIN_TRANSACTIONS_FOR_RANKING) continue;
    if (!first.reference_price_m2_sale || !last.reference_price_m2_sale) continue;

    const evolution5y = ((last.reference_price_m2_sale - first.reference_price_m2_sale) / first.reference_price_m2_sale) * 100;
    ranked.push({
      insee: last.insee_code,
      slug: citySlug(last.city_name, last.insee_code),
      cityName: last.city_name,
      postalCode: last.postal_code,
      priceM2: last.reference_price_m2_sale,
      evolution5y,
    });
  }

  const sorted = [...ranked].sort((a, b) => (b.evolution5y ?? 0) - (a.evolution5y ?? 0));
  return {
    gainers: sorted.slice(0, limit),
    losers: sorted.slice(-limit).reverse(),
  };
}

// Pas de classement "meilleur rendement" : reference_rent_m2 est calculé comme
// reference_price_m2_sale × un taux constant (3,2 % Paris / 5,5 % ailleurs,
// cf. process-dvf.py), donc (loyer×12)/prix redonne toujours exactement ce
// taux constant — un classement sur cette base n'ordonnerait rien de réel,
// juste la liste des communes parisiennes vs non-parisiennes.
//
// Le Score lokt.fr (investment_score) contourne ce problème : il est calculé
// à partir du loyer OFFICIEL (Carte des loyers DGALN/ANIL), pas de l'heuristique
// à taux constant — cf. scripts/compute-investment-scores.py.
export async function getBestInvestmentPotential(limit = 30): Promise<RankedCity[]> {
  if (!supabaseAdmin) return [];

  const { data: rows } = await supabaseAdmin
    .from("city_external_kpis")
    .select("insee_code, investment_score, investment_score_band")
    .not("investment_score", "is", null)
    .order("investment_score", { ascending: false })
    .limit(limit);

  if (!rows || rows.length === 0) return [];

  const { data: cities } = await supabaseAdmin
    .from("city_market_benchmarks")
    .select("insee_code, city_name, postal_code, reference_price_m2_sale")
    .in("insee_code", rows.map((r) => r.insee_code));
  const cityByInsee = new Map((cities || []).map((c) => [c.insee_code, c]));

  const results: RankedCity[] = [];
  for (const r of rows) {
    const city = cityByInsee.get(r.insee_code);
    if (!city) continue;
    results.push({
      slug: citySlug(city.city_name, city.insee_code),
      cityName: city.city_name,
      postalCode: city.postal_code,
      priceM2: city.reference_price_m2_sale,
      investmentScore: r.investment_score,
      investmentScoreBand: r.investment_score_band,
    });
  }

  return results.sort((a, b) => (b.investmentScore ?? 0) - (a.investmentScore ?? 0));
}

// Utilisé par /rendement-locatif pour afficher le Score lokt.fr dans son
// tableau comparatif (villes déjà mappées à un code INSEE via getVilleInseeCode).
export async function getInvestmentScoresByInsee(
  inseeCodes: string[]
): Promise<Map<string, { score: number; band: string }>> {
  if (!supabaseAdmin || inseeCodes.length === 0) return new Map();

  const { data } = await supabaseAdmin
    .from("city_external_kpis")
    .select("insee_code, investment_score, investment_score_band")
    .in("insee_code", inseeCodes)
    .not("investment_score", "is", null);

  return new Map((data || []).map((r) => [r.insee_code, { score: r.investment_score, band: r.investment_score_band }]));
}

// ── KPI externes (INSEE, ADEME, Carte des loyers) ──────────────────────────

export type CityExternalKpis = {
  revenuMedian: number | null;
  filosofiYear: number | null;
  population: number | null;
  tauxVacance: number | null;
  tauxResidencesSecondaires: number | null;
  dpeTotal: number | null;
  dpeFgPct: number | null;
  loyerPreditAppartement: number | null;
  loyerPreditMaison: number | null;
  loyersYear: number | null;
  // Nombre d'années de revenu médian nécessaires pour acheter 50 m² —
  // indice d'accessibilité, pas juste le prix brut.
  prixRevenuRatio: number | null;
  // Score lokt.fr (0-100) : potentiel d'investissement locatif, cf.
  // scripts/compute-investment-scores.py. Toujours lu sur la commune elle-même
  // (jamais de fallback vers le code parent) : chaque arrondissement a son
  // propre score, contrairement au revenu/population Filosofi.
  investmentScore: number | null;
  investmentScoreBand: string | null;
  // Taux global de taxe foncière sur le bâti (commune + intercommunalité),
  // en %. Source : DGFiP. cf. scripts/process-taxe-fonciere.py.
  taxeFonciereTfb: number | null;
  taxeFonciereYear: number | null;
  // Gare voyageurs SNCF la plus proche (à vol d'oiseau). Source : SNCF +
  // geo.api.gouv.fr. cf. scripts/process-gares.py.
  gareNom: string | null;
  gareDistanceKm: number | null;
};

// Paris/Lyon/Marseille sont découpés en arrondissements dans le DVF (donc
// dans city_market_benchmarks) mais PAS dans le recensement/Filosofi INSEE
// ni la taxe foncière (revenu, population, vacance, taux de taxe foncière
// restent au niveau de la ville entière) — on retombe sur le code de la
// ville parente pour ces indicateurs. Les DPE et la Carte des loyers ont,
// eux, bien une granularité par arrondissement.
const ARRONDISSEMENT_PARENT: Record<string, string> = { "751": "75056", "693": "69123", "132": "13055" };

async function getExternalKpisRow(inseeCode: string) {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin.from("city_external_kpis").select("*").eq("insee_code", inseeCode).maybeSingle();
  return data;
}

export async function getCityExternalKpis(inseeCode: string, priceM2: number | null): Promise<CityExternalKpis | null> {
  if (!supabaseAdmin) return null;

  const direct = await getExternalKpisRow(inseeCode);

  let socialRow = direct;
  const parentCode = ARRONDISSEMENT_PARENT[inseeCode.slice(0, 3)];
  if ((!direct || direct.revenu_median == null) && parentCode) {
    socialRow = await getExternalKpisRow(parentCode);
  }

  if (!direct && !socialRow) return null;

  const dpeTotal = direct?.dpe_total ?? null;
  const dpeFg = direct?.dpe_fg ?? null;
  const revenuMedian = socialRow?.revenu_median ?? null;
  const logementsTotal = socialRow?.logements_total ?? null;

  return {
    revenuMedian,
    filosofiYear: socialRow?.filosofi_year ?? null,
    population: socialRow?.population ?? null,
    tauxVacance: logementsTotal && socialRow?.logements_vacants != null ? (socialRow.logements_vacants / logementsTotal) * 100 : null,
    tauxResidencesSecondaires: logementsTotal && socialRow?.residences_secondaires != null ? (socialRow.residences_secondaires / logementsTotal) * 100 : null,
    dpeTotal,
    dpeFgPct: dpeTotal ? ((dpeFg ?? 0) / dpeTotal) * 100 : null,
    loyerPreditAppartement: direct?.loyer_predit_appartement ?? null,
    loyerPreditMaison: direct?.loyer_predit_maison ?? null,
    loyersYear: direct?.loyers_year ?? null,
    prixRevenuRatio: priceM2 && revenuMedian ? (priceM2 * 50) / revenuMedian : null,
    investmentScore: direct?.investment_score ?? null,
    investmentScoreBand: direct?.investment_score_band ?? null,
    taxeFonciereTfb: socialRow?.taxe_fonciere_tfb ?? null,
    taxeFonciereYear: socialRow?.taxe_fonciere_year ?? null,
    gareNom: direct?.gare_nom ?? null,
    gareDistanceKm: direct?.gare_distance_km ?? null,
  };
}
