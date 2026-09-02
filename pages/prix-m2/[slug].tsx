import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef, type FormEvent } from "react";
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
  ReceiptPercentIcon,
  InformationCircleIcon,
  MapIcon,
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

// Mêmes réseaux/icônes que pages/blog/[slug].tsx — cf. ce fichier pour la
// version de référence.
function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const shares = [
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.763l7.722-8.84-8.163-10.66h7.014l4.259 5.622 5.649-6.624ZM17.083 19.77h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(title + " " + url)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Partager</span>
      {shares.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Partager sur ${s.label}`}
          title={`Partager sur ${s.label}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-[#635bff]/40 hover:bg-[#635bff]/5 hover:text-[#635bff]"
        >
          {s.icon}
        </a>
      ))}
      <button
        onClick={handleCopy}
        aria-label="Copier le lien"
        title="Copier le lien"
        className="flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[0.72rem] font-semibold text-slate-500 transition hover:border-[#635bff]/40 hover:bg-[#635bff]/5 hover:text-[#635bff]"
      >
        {copied ? (
          <>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            Copié !
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
            Copier le lien
          </>
        )}
      </button>
    </div>
  );
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

function scoreBandColor(band: string | null | undefined) {
  switch (band) {
    case "Excellent potentiel": return "text-emerald-600";
    case "Bon potentiel": return "text-teal-600";
    case "Potentiel moyen": return "text-amber-600";
    case "Potentiel limité": return "text-orange-600";
    case "Faible potentiel": return "text-rose-600";
    default: return "text-slate-600";
  }
}

// Même composant que components/landlord/sections/SectionFinance.tsx — cliquable
// (pas seulement au survol) pour rester utilisable au tactile.
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Plus d'informations"
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        <InformationCircleIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-1.5 w-60 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2.5 text-[0.7rem] leading-4 text-slate-600 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}

function ScoreBadge({ score, band }: { score: number; band: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#635bff]/20 bg-white px-4 py-3 shadow-sm transition hover:shadow-lg">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#635bff] to-[#00d4ff] shadow-md shadow-[#635bff]/30">
        <span className="text-xl font-extrabold text-white">{score}</span>
      </div>
      <div>
        <p className="flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
          Score lokt.fr
          <InfoTip text="Score composite 0-100 : rendement locatif, tension locative, dynamique des prix et risque DPE, chaque critère comparé au reste des communes françaises." />
        </p>
        <p className={`text-sm font-extrabold ${scoreBandColor(band)}`}>{band}</p>
        <Link href="/prix-m2/classements#potentiel-investissement" className="text-[0.65rem] font-medium text-slate-400 hover:text-[#635bff] hover:underline">
          Voir le classement →
        </Link>
      </div>
    </div>
  );
}

// Seuils volontairement stricts : même 20-29 ventes/an reste un échantillon
// fragile pour une commune (un prix médian peut bondir de +50 à +80 % d'une
// année sur l'autre rien qu'en changeant la poignée de biens vendus — vérifié
// empiriquement sur des milliers de communes). "Fiable" est réservé à un
// volume qui absorbe mieux ce bruit d'échantillonnage.
function reliabilityLevel(nTransactions: number | null): "fiable" | "moderee" | "limitee" {
  const n = nTransactions ?? 0;
  if (n >= 30) return "fiable";
  if (n >= 20) return "moderee";
  return "limitee";
}

function ReliabilityBadge({ nTransactions }: { nTransactions: number | null }) {
  const level = reliabilityLevel(nTransactions);
  const cfg =
    level === "fiable"
      ? { label: "Fiable", color: "text-emerald-700 bg-emerald-50 border-emerald-200" }
      : level === "moderee"
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
  // Une évolution n'est réellement lisible que si les DEUX années comparées
  // reposent sur un échantillon fiable — un seul côté fragile suffit à fausser
  // le pourcentage affiché (cf. reliabilityLevel : un an à 15 ventes peut faire
  // bondir le prix médian de 50-80 % sans rapport avec une vraie tendance).
  const evolution5yReliable =
    yearsWithPrice.length >= 2 &&
    reliabilityLevel(yearsWithPrice[0].nTransactions) === "fiable" &&
    reliabilityLevel(yearsWithPrice[yearsWithPrice.length - 1].nTransactions) === "fiable";
  const evolution1yReliable =
    yearsWithPrice.length >= 2 &&
    reliabilityLevel(yearsWithPrice[yearsWithPrice.length - 2].nTransactions) === "fiable" &&
    reliabilityLevel(yearsWithPrice[yearsWithPrice.length - 1].nTransactions) === "fiable";
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
    ...(externalKpis?.taxeFonciereTfb != null
      ? [
          {
            q: `Quel est le taux de taxe foncière à ${city.cityName} ?`,
            a: `Le taux global de taxe foncière sur les propriétés bâties à ${city.cityName} est de ${externalKpis.taxeFonciereTfb.toFixed(1)} %${externalKpis.taxeFonciereYear ? ` en ${externalKpis.taxeFonciereYear}` : ""} (commune + intercommunalité). Ce taux s'applique à la valeur locative cadastrale du bien, pas à son prix d'achat — pour estimer le montant réel, il faut appliquer ce taux à la valeur locative cadastrale (généralement 40 à 50 % de la valeur locative brute, avant abattement). Source : DGFiP.`,
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

            <div className="mt-4">
              <ShareBar url={pageUrl} title={metaTitle} />
            </div>

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

                <div className="flex flex-col items-start gap-4 sm:items-end">
                  {externalKpis?.investmentScore != null && (
                    <ScoreBadge score={externalKpis.investmentScore} band={externalKpis.investmentScoreBand} />
                  )}
                  <div className="flex gap-6 sm:gap-8">
                    <div>
                      <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Évolution {yearsWithPrice[0]?.year}-{yearsWithPrice[yearsWithPrice.length - 1]?.year}
                        {!evolution5yReliable && (
                          <InfoTip text="Basé sur un faible nombre de ventes sur au moins une des deux années comparées — avec un échantillon aussi restreint, le prix médian peut bondir d'une année sur l'autre sans refléter une vraie tendance de marché. À interpréter avec prudence." />
                        )}
                      </p>
                      <p className="mt-1 text-2xl font-bold"><EvolutionBadge pct={city.evolution5y} /></p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        1 an
                        {!evolution1yReliable && (
                          <InfoTip text="Basé sur un faible nombre de ventes sur au moins une des deux années comparées — avec un échantillon aussi restreint, le prix médian peut bondir d'une année sur l'autre sans refléter une vraie tendance de marché. À interpréter avec prudence." />
                        )}
                      </p>
                      <p className="mt-1 text-2xl font-bold"><EvolutionBadge pct={city.evolution1y} /></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECONDARY KPIs */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <BanknotesIcon className="h-4 w-4 text-slate-400" />
                <p className="mt-2 text-lg font-bold text-slate-900">{rentM2Display ? `${rentM2Display.toFixed(1)} €` : "—"}</p>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  Loyer {rentIsOfficial ? "constaté" : "estimé"} /m²/mois
                  <InfoTip
                    text={
                      rentIsOfficial
                        ? "Loyer d'annonce réel par m²/mois, issu de la Carte des loyers (DGALN/ANIL) — basé sur les annonces SeLoger/LeBonCoin, pas une estimation lokt.fr."
                        : "Estimation indicative par m²/mois via un ratio de rendement standard — aucune donnée officielle de loyer n'est disponible pour cette commune."
                    }
                  />
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <ChartBarIcon className="h-4 w-4 text-slate-400" />
                <p className="mt-2 text-lg font-bold text-slate-900">{yieldPct != null ? `${yieldPct.toFixed(1)} %` : "—"}</p>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  Rendement brut estimé
                  <InfoTip text="(loyer annuel ÷ prix d'achat) × 100. Ne tient pas compte des charges, de la vacance ni de la fiscalité — utilisez le simulateur pour un calcul net précis." />
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <ShieldCheckIcon className="h-4 w-4 text-slate-400" />
                <div className="mt-2"><ReliabilityBadge nTransactions={latestNTransactions} /></div>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  {latestNTransactions ?? 0} ventes analysées
                  <InfoTip text="Indique la robustesse statistique du prix affiché : plus il y a de ventes récentes analysées, plus le prix médian est représentatif du marché réel de la commune." />
                </p>
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
          {externalKpis && (externalKpis.revenuMedian != null || externalKpis.population != null || externalKpis.dpeFgPct != null || externalKpis.taxeFonciereTfb != null || externalKpis.gareNom != null) && (
            <section>
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Contexte local à {city.cityName}</h2>
              <p className="mt-2 text-sm text-slate-500">Données socio-démographiques, énergétiques et de cadre de vie publiques (INSEE, ADEME, DGFiP, SNCF).</p>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {externalKpis.revenuMedian != null && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <ScaleIcon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 text-lg font-bold text-slate-900">{Math.round(externalKpis.revenuMedian).toLocaleString("fr-FR")} €</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      Revenu médian annuel{externalKpis.filosofiYear ? ` (${externalKpis.filosofiYear})` : ""}
                      <InfoTip text="Revenu médian annuel des foyers fiscaux de la commune (INSEE, données Filosofi) — la moitié des foyers gagnent plus, l'autre moitié moins." />
                    </p>
                    {externalKpis.prixRevenuRatio != null && (
                      <p className="mt-1.5 text-xs font-medium text-[#635bff]">{externalKpis.prixRevenuRatio.toFixed(1)} ans de revenu pour 50 m²</p>
                    )}
                  </div>
                )}
                {externalKpis.population != null && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <UserGroupIcon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 text-lg font-bold text-slate-900">{externalKpis.population.toLocaleString("fr-FR")}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      Habitants{externalKpis.filosofiYear ? ` (${externalKpis.filosofiYear})` : ""}
                      <InfoTip text="Population totale de la commune au dernier recensement disponible (INSEE)." />
                    </p>
                  </div>
                )}
                {externalKpis.tauxResidencesSecondaires != null && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <HomeModernIcon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 text-lg font-bold text-slate-900">{externalKpis.tauxResidencesSecondaires.toFixed(1)} %</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      Résidences secondaires
                      <InfoTip text="Part des logements de la commune utilisés comme résidence secondaire (INSEE) — un taux élevé peut signaler une zone touristique/saisonnière, avec une demande locative à l'année plus limitée." />
                    </p>
                  </div>
                )}
                {externalKpis.dpeFgPct != null && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <FireIcon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 text-lg font-bold text-slate-900">{externalKpis.dpeFgPct.toFixed(0)} %</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      Logements classés F/G ({(externalKpis.dpeTotal ?? 0).toLocaleString("fr-FR")} DPE)
                      <InfoTip text="Part des diagnostics de performance énergétique classés F ou G (ADEME) — les logements G sont interdits à la location depuis 2025, les F le seront en 2028." />
                    </p>
                  </div>
                )}
                {externalKpis.taxeFonciereTfb != null && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <ReceiptPercentIcon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 text-lg font-bold text-slate-900">{externalKpis.taxeFonciereTfb.toFixed(1)} %</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      Taxe foncière{externalKpis.taxeFonciereYear ? ` (${externalKpis.taxeFonciereYear})` : ""}
                      <InfoTip text="Taux appliqué à la valeur locative cadastrale du bien (pas au prix d'achat ni au loyer réel) — sert à comparer la pression fiscale entre communes." />
                    </p>
                  </div>
                )}
                {externalKpis.gareNom != null && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <MapIcon className="h-4 w-4 text-slate-400" />
                    <p className="mt-2 text-lg font-bold text-slate-900">{externalKpis.gareDistanceKm != null ? `${externalKpis.gareDistanceKm.toFixed(1)} km` : "—"}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      Gare la plus proche ({externalKpis.gareNom})
                      <InfoTip text="Distance à vol d'oiseau jusqu'à la gare voyageurs SNCF la plus proche du centre de la commune — pas forcément la distance réelle par la route." />
                    </p>
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
            Prix calculés à partir des DVF (Demandes de Valeurs Foncières, DGFiP), mises à jour semestriellement — des ventes réellement actées, pas des prix d'annonce, ce qui explique un niveau généralement inférieur aux estimations d'agences (SeLoger, MeilleursAgents...). {rentIsOfficial ? "Le loyer provient de la Carte des loyers (DGALN/ANIL)." : "Le loyer est une estimation par heuristique de rendement, pas une donnée observée."} Revenu médian et population : INSEE (recensement, Filosofi). Part de logements F/G : ADEME (base DPE). Taxe foncière : DGFiP. Gare la plus proche : SNCF. Ces données sont indicatives et ne constituent pas un conseil en investissement.
          </div>

          <section className="flex flex-col items-center gap-4 text-center">
            <ShareBar url={pageUrl} title={metaTitle} />
            <Link href="/prix-m2" className="text-sm text-[#635bff] hover:underline">
              ← Rechercher une autre ville
            </Link>
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
