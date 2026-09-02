import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, type FormEvent } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import {
  BuildingOffice2Icon,
  HomeModernIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  MapPinIcon,
  UserGroupIcon,
  FireIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import {
  getCityPriceData,
  getCityExternalKpis,
  getTopCitySlugs,
  parseCitySlug,
  type CityPriceData,
  type CityExternalKpis,
} from "../../lib/cityPriceData";
import { citySlug, slugifyCityName } from "../../lib/cityPriceSlug";
import { getVilleBySlug } from "../../lib/villesRendement";
import { slugify as slugifyGeo } from "../../lib/frenchGeo";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

const Chart = dynamic(() => import("react-chartjs-2").then((m) => m.Chart), { ssr: false });

const SITE_URL = "https://lokt.fr";

function formatEur(n: number | null) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

function EvolutionBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-slate-400">—</span>;
  const positive = pct >= 0;
  return (
    <span className={`font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
      {positive ? "+" : ""}
      {pct.toFixed(1)} %
    </span>
  );
}

function ReliabilityBadge({ nTransactions }: { nTransactions: number | null }) {
  const n = nTransactions ?? 0;
  const cfg =
    n >= 30
      ? { label: "Fiable", color: "text-emerald-700 bg-emerald-50 border-emerald-200" }
      : n >= 10
      ? { label: "Modérée", color: "text-amber-700 bg-amber-50 border-amber-200" }
      : { label: "Limitée", color: "text-rose-700 bg-rose-50 border-rose-200" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function EmailReportForm({ slug, cityName }: { slug: string; cityName: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/prix-m2/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erreur lors de l'envoi.");
      setStatus("sent");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Erreur lors de l'envoi.");
    }
  }

  if (status === "sent") {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <p className="text-sm font-semibold text-emerald-800">Rapport envoyé ! Vérifiez votre boîte mail.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Recevoir le rapport {cityName} par email</h2>
      <p className="mt-1 text-sm text-slate-500">Prix, évolution et historique complet dans votre boîte mail.</p>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
          className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#635bff]"
        />
        <button
          type="submit" disabled={status === "loading"}
          className="rounded-full bg-[#635bff] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {status === "loading" ? "Envoi..." : "Recevoir le rapport"}
        </button>
      </form>
      {status === "error" && <p className="mt-2 text-xs text-rose-600">{errorMsg}</p>}
    </section>
  );
}

function ComparisonRow({ label, cityPrice, refPrice }: { label: string; cityPrice: number | null; refPrice: number | null }) {
  if (cityPrice == null || refPrice == null || refPrice === 0) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-400">—</span>
      </div>
    );
  }
  const pct = ((cityPrice - refPrice) / refPrice) * 100;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-slate-400">{formatEur(refPrice)}/m²</span>
        <EvolutionBadge pct={pct} />
      </span>
    </div>
  );
}

const PROPERTY_TYPE_LABELS: Record<"tous" | "maison" | "appartement", string> = {
  tous: "Tous types",
  maison: "Maison",
  appartement: "Appartement",
};

export default function PrixM2City({ city, externalKpis }: { city: CityPriceData; externalKpis: CityExternalKpis | null }) {
  const [propertyTypeView, setPropertyTypeView] = useState<"tous" | "maison" | "appartement">("tous");
  const pageUrl = `${SITE_URL}/prix-m2/${citySlug(city.cityName, city.inseeCode)}`;
  const metaTitle = `Prix m² ${city.cityName} (${city.postalCode}) : évolution ${new Date().getFullYear()} | lokt.fr`;
  const metaDesc = `Prix au m² à ${city.cityName} : ${formatEur(city.priceM2)}/m² en moyenne, évolution sur ${city.history.length} ans basée sur les transactions DVF officielles. Loyer estimé et rendement locatif.`;

  const latestNTransactions = city.history.length ? city.history[city.history.length - 1].nTransactions : null;
  const officialRentM2 = externalKpis?.loyerPreditAppartement ?? externalKpis?.loyerPreditMaison ?? null;
  const rentM2Display = officialRentM2 ?? city.rentM2;
  const rentIsOfficial = officialRentM2 != null;
  const yieldPct = city.priceM2 && rentM2Display ? ((rentM2Display * 12) / city.priceM2) * 100 : null;
  const availableTypes = (["tous", "maison", "appartement"] as const).filter(
    (t) => t === "tous" || city.historyByType[t].some((h) => h.priceM2 != null)
  );

  const yearsWithPrice = city.history.filter((h) => h.priceM2 != null);
  const activeYearsWithPrice = city.historyByType[propertyTypeView].filter((h) => h.priceM2 != null);
  const chartData = {
    labels: activeYearsWithPrice.map((h) => String(h.year)),
    datasets: [
      {
        label: "Prix médian €/m²",
        data: activeYearsWithPrice.map((h) => Math.round(h.priceM2!)),
        borderColor: "#635bff",
        backgroundColor: "rgba(99, 91, 255, 0.1)",
        tension: 0.25,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: "#635bff",
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        ticks: { callback: (v: any) => `${v} €` },
        grid: { color: "#f1f5f9" },
      },
      x: { grid: { display: false } },
    },
  };

  const curatedVille = getVilleBySlug(slugifyCityName(city.cityName));

  const faq = [
    {
      q: `Quel est le prix moyen au m² à ${city.cityName} ?`,
      a: `Le prix médian au m² à ${city.cityName} est d'environ ${formatEur(city.priceM2)} sur les ventes de maisons et appartements les plus récentes, calculé à partir des données DVF (Demandes de Valeurs Foncières) publiées par la DGFiP. Ce chiffre est une médiane, pas une moyenne arithmétique : la moitié des ventes se sont faites en dessous, l'autre moitié au-dessus.`,
    },
    {
      q: `Comment évolue le prix de l'immobilier à ${city.cityName} ?`,
      a:
        city.evolution5y != null
          ? `Sur la période observée (${yearsWithPrice[0]?.year}-${yearsWithPrice[yearsWithPrice.length - 1]?.year}), le prix au m² à ${city.cityName} a ${city.evolution5y >= 0 ? "progressé" : "reculé"} de ${Math.abs(city.evolution5y).toFixed(1)} %.${city.evolution1y != null ? ` Sur la dernière année, la variation est de ${city.evolution1y >= 0 ? "+" : ""}${city.evolution1y.toFixed(1)} %.` : ""}`
          : `Les données historiques sur ${city.cityName} sont encore limitées (commune avec peu de transactions annuelles) pour établir une tendance fiable.`,
    },
    {
      q: `D'où viennent ces données de prix ?`,
      a: `Ces prix sont calculés à partir des données DVF (Demandes de Valeurs Foncières), publiées semestriellement par la DGFiP via data.gouv.fr. Elles recensent la quasi-totalité des transactions immobilières en France (hors Alsace-Moselle et Mayotte). lokt.fr calcule un prix médian au m² par commune à partir des ventes de maisons et d'appartements, en excluant les ventes en lot groupé (plusieurs biens vendus dans un seul acte) qui fausseraient le calcul.`,
    },
    {
      q: `Pourquoi ce prix diffère de celui affiché sur d'autres sites (SeLoger, MeilleursAgents...) ?`,
      a: `Ces sites combinent souvent les ventes réalisées avec les prix affichés dans les annonces en cours, qui sont structurellement plus élevés qu'un prix de vente réel (un vendeur affiche toujours au-dessus du prix qu'il obtiendra). lokt.fr n'utilise que les ventes effectivement actées chez le notaire (DVF), sans mélanger avec des prix d'annonce. Le prix DVF reflète donc un marché réellement conclu, généralement inférieur de 5 à 15 % aux estimations basées sur les annonces — c'est une mesure du marché passé, pas une estimation du prix auquel vous vendriez aujourd'hui.`,
    },
    {
      q: `Quel loyer estimer pour un bien à ${city.cityName} ?`,
      a: rentIsOfficial
        ? `Le loyer d'annonce constaté à ${city.cityName} est d'environ ${rentM2Display?.toFixed(1)} €/m²/mois, d'après la Carte des loyers (DGALN/ANIL), un modèle statistique basé sur les annonces réelles (SeLoger, LeBonCoin), pas une estimation lokt.fr. Pour un calcul précis intégrant charges, fiscalité et cash-flow, utilisez le simulateur lokt.fr.`
        : `À titre indicatif, le loyer estimé à ${city.cityName} est d'environ ${rentM2Display ? rentM2Display.toFixed(1) : "—"} €/m²/mois, calculé par une heuristique de rendement locatif brut (les données DVF ne couvrent que les ventes, pas les loyers). Pour un calcul précis intégrant charges, fiscalité et cash-flow, utilisez le simulateur lokt.fr.`,
    },
    ...(city.byType.length > 0
      ? [
          {
            q: `Une maison est-elle plus chère qu'un appartement à ${city.cityName} ?`,
            a: city.byType
              .map((t) => `${t.propertyType === "maison" ? "Une maison" : "Un appartement"} se négocie autour de ${formatEur(t.priceM2)}/m²`)
              .join(", tandis qu'") + ` à ${city.cityName}, sur la base des transactions les plus récentes.`,
          },
        ]
      : []),
    ...(city.byRoom.length > 0
      ? [
          {
            q: `Un studio coûte-t-il plus cher au m² qu'un grand appartement à ${city.cityName} ?`,
            a: `Oui, en général : ${city.byRoom.map((r) => `${r.roomBracket === "T1" ? "un T1/studio" : `un ${r.roomBracket}`} se négocie autour de ${formatEur(r.priceM2)}/m²`).join(", ")} à ${city.cityName}. Le prix au m² baisse généralement avec la taille du logement, car les pièces communes (cuisine, salle de bain) pèsent proportionnellement moins sur les grandes surfaces.`,
          },
        ]
      : []),
    ...(externalKpis?.investmentScore != null
      ? [
          {
            q: `Est-ce un bon investissement locatif à ${city.cityName} ?`,
            a: `Le Score lokt.fr à ${city.cityName} est de ${externalKpis.investmentScore}/100 (${externalKpis.investmentScoreBand?.toLowerCase()}). Ce score combine le rendement locatif brut (loyer officiel/prix), la tension locative (taux de vacance), la dynamique récente des prix et la part de logements classés F/G, chaque critère étant comparé au reste des communes françaises. Consultez le classement complet sur lokt.fr pour comparer avec d'autres villes.`,
          },
        ]
      : []),
  ];

  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: metaTitle,
      description: metaDesc,
      url: pageUrl,
      inLanguage: "fr-FR",
      publisher: { "@type": "Organization", name: "lokt.fr", url: SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Prix au m²", item: `${SITE_URL}/prix-m2` },
        { "@type": "ListItem", position: 3, name: city.cityName, item: pageUrl },
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
  ];

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={`${SITE_URL}/lokt-logo.jpg`} />
        <meta property="og:image:alt" content={`Prix au m² à ${city.cityName} — lokt.fr`} />
        {schemas.map((s, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
        ))}
      </Head>

      <AppHeader />

      <div className="bg-[#f6f9fc]">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-white px-6 py-10 sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#635bff] opacity-[0.07] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[#00b4d8] opacity-[0.06] blur-3xl" />
          <div className="relative mx-auto max-w-4xl">
            <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <Link href="/" className="hover:text-slate-600">Accueil</Link>
              <span>›</span>
              <Link href="/prix-m2" className="hover:text-slate-600">Prix au m²</Link>
              <span>›</span>
              <span className="text-slate-600">{city.cityName}</span>
            </nav>

            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">
              {city.postalCode}
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Prix au m² à {city.cityName}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
              Prix médian, évolution sur {yearsWithPrice.length || "plusieurs"} ans et loyer estimé — calculés à partir des transactions DVF officielles.
            </p>
            {city.latestYear && (
              <p className="mt-1.5 text-xs text-slate-400">Dernière mise à jour : données DVF {city.latestYear}</p>
            )}

            {/* STAT PANEL — prix médian + distinction maison/appartement + évolution */}
            <div className="mt-8 rounded-3xl border border-slate-200 bg-gradient-to-br from-[#f8f7ff] to-[#eef6fb] p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prix médian · tous types</p>
                  <p className="mt-1 text-4xl font-bold text-slate-950 sm:text-5xl">
                    {formatEur(city.priceM2)}
                    <span className="ml-2 text-base font-medium text-slate-400">/m²</span>
                  </p>

                  {city.byType.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {city.byType.map((t) => (
                        <span
                          key={t.propertyType}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm"
                        >
                          {t.propertyType === "maison" ? (
                            <HomeModernIcon className="h-4 w-4 text-[#635bff]" />
                          ) : (
                            <BuildingOffice2Icon className="h-4 w-4 text-[#635bff]" />
                          )}
                          <span className="capitalize text-slate-500">{t.propertyType}</span>
                          <span className="font-semibold text-slate-900">{formatEur(t.priceM2)}/m²</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-6 sm:gap-8">
                  {externalKpis?.investmentScore != null && (
                    <Link href="/prix-m2/classements#potentiel-investissement" className="group">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score lokt.fr</p>
                      <p className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-[#635bff] group-hover:underline">{externalKpis.investmentScore}</span>
                        <span className="text-xs font-medium text-slate-400">/100</span>
                      </p>
                      <p className="text-[0.68rem] font-medium text-slate-500">{externalKpis.investmentScoreBand}</p>
                    </Link>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Évolution {yearsWithPrice[0]?.year}-{yearsWithPrice[yearsWithPrice.length - 1]?.year}
                    </p>
                    <p className="mt-1 text-2xl font-bold"><EvolutionBadge pct={city.evolution5y} /></p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">1 an</p>
                    <p className="mt-1 text-2xl font-bold"><EvolutionBadge pct={city.evolution1y} /></p>
                  </div>
                </div>
              </div>
            </div>

            {/* SECONDARY KPIs */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <BanknotesIcon className="h-4 w-4 text-slate-400" />
                <p className="mt-2 text-lg font-bold text-slate-900">{rentM2Display ? `${rentM2Display.toFixed(1)} €` : "—"}</p>
                <p className="text-xs text-slate-400">Loyer {rentIsOfficial ? "constaté" : "estimé"} /m²/mois</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <ChartBarIcon className="h-4 w-4 text-slate-400" />
                <p className="mt-2 text-lg font-bold text-slate-900">{yieldPct != null ? `${yieldPct.toFixed(1)} %` : "—"}</p>
                <p className="text-xs text-slate-400">Rendement brut estimé</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <ShieldCheckIcon className="h-4 w-4 text-slate-400" />
                <div className="mt-2"><ReliabilityBadge nTransactions={latestNTransactions} /></div>
                <p className="mt-1 text-xs text-slate-400">{latestNTransactions ?? 0} ventes analysées</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <MapPinIcon className="h-4 w-4 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {/* La page /prix-m2/departement/[x] n'existe que pour les 96
                      départements métropolitains (couverture GeoJSON) : hors
                      de ce périmètre (ex. Saint-Martin), pas de lien mort. */}
                  {city.regionName ? (
                    <Link href={`/prix-m2/departement/${slugifyGeo(city.departmentName)}`} className="hover:text-[#635bff] hover:underline">{city.departmentName}</Link>
                  ) : (
                    city.departmentName
                  )}
                </p>
                {city.regionName && (
                  <p className="text-xs text-slate-400">
                    <Link href={`/prix-m2/region/${slugifyGeo(city.regionName)}`} className="hover:text-[#635bff] hover:underline">{city.regionName}</Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-12">
          {/* COMPARAISON */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Comparaison avec les moyennes</h2>
            <div className="mt-3 space-y-2.5">
              <ComparisonRow label={`Département (${city.departmentName})`} cityPrice={city.priceM2} refPrice={city.departmentAvgPriceM2} />
              {city.regionName && <ComparisonRow label={`Région (${city.regionName})`} cityPrice={city.priceM2} refPrice={city.regionAvgPriceM2} />}
              <ComparisonRow label="France" cityPrice={city.priceM2} refPrice={city.nationalAvgPriceM2} />
            </div>
          </section>

          {/* CONTEXTE LOCAL (INSEE / ADEME) */}
          {externalKpis && (externalKpis.revenuMedian != null || externalKpis.population != null || externalKpis.dpeFgPct != null) && (
            <section>
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Contexte local à {city.cityName}</h2>
              <p className="mt-2 text-sm text-slate-500">Données socio-démographiques et énergétiques publiques (INSEE, ADEME).</p>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {externalKpis.revenuMedian != null && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <ScaleIcon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 text-lg font-bold text-slate-900">{Math.round(externalKpis.revenuMedian).toLocaleString("fr-FR")} €</p>
                    <p className="text-xs text-slate-400">Revenu médian annuel{externalKpis.filosofiYear ? ` (${externalKpis.filosofiYear})` : ""}</p>
                    {externalKpis.prixRevenuRatio != null && (
                      <p className="mt-1.5 text-xs font-medium text-[#635bff]">{externalKpis.prixRevenuRatio.toFixed(1)} ans de revenu pour 50 m²</p>
                    )}
                  </div>
                )}
                {externalKpis.population != null && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <UserGroupIcon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 text-lg font-bold text-slate-900">{externalKpis.population.toLocaleString("fr-FR")}</p>
                    <p className="text-xs text-slate-400">Habitants{externalKpis.filosofiYear ? ` (${externalKpis.filosofiYear})` : ""}</p>
                  </div>
                )}
                {externalKpis.tauxResidencesSecondaires != null && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <HomeModernIcon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 text-lg font-bold text-slate-900">{externalKpis.tauxResidencesSecondaires.toFixed(1)} %</p>
                    <p className="text-xs text-slate-400">Résidences secondaires</p>
                  </div>
                )}
                {externalKpis.dpeFgPct != null && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <FireIcon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 text-lg font-bold text-slate-900">{externalKpis.dpeFgPct.toFixed(0)} %</p>
                    <p className="text-xs text-slate-400">Logements classés F/G ({(externalKpis.dpeTotal ?? 0).toLocaleString("fr-FR")} DPE)</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* CHART */}
          {yearsWithPrice.length >= 2 && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                  Évolution du prix au m² à {city.cityName}
                </h2>
                {availableTypes.length > 1 && (
                  <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs">
                    {availableTypes.map((t) => (
                      <button
                        key={t}
                        onClick={() => setPropertyTypeView(t)}
                        className={`rounded-full px-3 py-1.5 font-medium transition ${propertyTypeView === t ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
                      >
                        {PROPERTY_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
                {activeYearsWithPrice.length >= 2 ? (
                  <Chart type="line" data={chartData} options={chartOptions} />
                ) : (
                  <p className="py-10 text-center text-sm text-slate-400">Pas assez de données pour ce type de bien.</p>
                )}
              </div>
            </section>
          )}

          {/* TABLE */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Détail par année {availableTypes.length > 1 ? `— ${PROPERTY_TYPE_LABELS[propertyTypeView]}` : ""}
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Année</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Prix médian €/m²</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Variation</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 hidden sm:table-cell">Transactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeYearsWithPrice.map((h, i) => {
                    const prev = i > 0 ? activeYearsWithPrice[i - 1] : null;
                    const yoy = prev && prev.priceM2 ? ((h.priceM2! - prev.priceM2!) / prev.priceM2!) * 100 : null;
                    return (
                      <tr key={h.year} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{h.year}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatEur(h.priceM2)}</td>
                        <td className="px-4 py-3"><EvolutionBadge pct={yoy} /></td>
                        <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{h.nTransactions ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {activeYearsWithPrice.some((h) => (h.nTransactions ?? 0) < 5) && (
              <p className="mt-2 text-xs text-slate-400">
                Certaines années affichent peu de transactions : le prix médian y est moins représentatif du marché local.
              </p>
            )}
          </section>

          {/* PAR NOMBRE DE PIÈCES */}
          {city.byRoom.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                Prix par nombre de pièces à {city.cityName}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Studio (T1), T2, T3, T4 et plus — prix médian sur la dernière année disponible.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {city.byRoom.map((r) => (
                  <div key={r.roomBracket} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">{r.roomBracket === "T1" ? "T1 (studio)" : r.roomBracket}</p>
                    <p className="mt-1.5 text-xl font-bold text-slate-900">{formatEur(r.priceM2)}<span className="ml-1 text-xs font-normal text-slate-400">/m²</span></p>
                    <p className="mt-1 text-xs text-slate-400">{r.nTransactions ?? 0} vente{(r.nTransactions ?? 0) > 1 ? "s" : ""}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* CTA SIMULATEUR */}
          <section className="rounded-2xl bg-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-25 blur-3xl bg-cyan-500" />
            <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full opacity-15 blur-3xl bg-emerald-400" />
            <div className="relative">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">Simulateur gratuit</p>
              <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
                Calculez la rentabilité d'un investissement à {city.cityName}
              </h2>
              <p className="mt-2 text-sm text-slate-200 max-w-xl">
                Prix d'achat, loyer, charges, vacance, fiscalité LMNP ou revenus fonciers — obtenez le rendement net et le cash-flow mensuel en 2 minutes.
              </p>
              <Link
                href={{
                  pathname: "/investissement",
                  query: {
                    ville: city.cityName,
                    cp: city.postalCode,
                    insee: city.inseeCode,
                    ...(city.priceM2 ? { prixM2: String(Math.round(city.priceM2)) } : {}),
                  },
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:opacity-95 transition"
              >
                Lancer le simulateur →
              </Link>
              <Link
                href={{ pathname: "/capacite", query: { departement: city.departmentName } }}
                className="mt-5 ml-3 inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Ma capacité d'emprunt →
              </Link>
            </div>
          </section>

          {curatedVille && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm text-slate-600">
                Une analyse plus détaillée du marché locatif à {city.cityName} (quartiers, tension locative, stratégies d'investissement) est disponible ici :
              </p>
              <Link href={`/rendement-locatif/${curatedVille.slug}`} className="mt-2 inline-block text-sm font-semibold text-[#635bff] hover:underline">
                Voir le guide rendement locatif {city.cityName} →
              </Link>
            </section>
          )}

          <EmailReportForm slug={citySlug(city.cityName, city.inseeCode)} cityName={city.cityName} />

          {/* FAQ */}
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

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-400 leading-5">
            Prix calculés à partir des DVF (Demandes de Valeurs Foncières, DGFiP), mises à jour semestriellement — des ventes réellement actées, pas des prix d'annonce, ce qui explique un niveau généralement inférieur aux estimations d'agences (SeLoger, MeilleursAgents...). {rentIsOfficial ? "Le loyer provient de la Carte des loyers (DGALN/ANIL)." : "Le loyer est une estimation par heuristique de rendement, pas une donnée observée."} Revenu médian et population : INSEE (recensement, Filosofi). Part de logements F/G : ADEME (base DPE). Ces données sont indicatives et ne constituent pas un conseil en investissement.
          </div>

          <section>
            <div className="text-center">
              <Link href="/prix-m2" className="text-sm text-[#635bff] hover:underline">
                ← Rechercher une autre ville
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
  const slugs = await getTopCitySlugs(300);
  return {
    paths: slugs.map((slug) => ({ params: { slug } })),
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: { params: { slug: string } }) {
  const inseeCode = parseCitySlug(params.slug);
  if (!inseeCode) return { notFound: true };

  const city = await getCityPriceData(inseeCode);
  if (!city || !city.priceM2) return { notFound: true };

  const externalKpis = await getCityExternalKpis(inseeCode, city.priceM2);

  return { props: { city, externalKpis }, revalidate: 60 * 60 * 24 * 7 };
}
