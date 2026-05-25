// pages/simulateur/investissement/[prix].tsx
import Head from "next/head";
import Link from "next/link";
import type { GetStaticPaths, GetStaticProps } from "next";
import { useMemo, useState } from "react";
import AppHeader from "../../../components/AppHeader";
import AppFooter from "../../../components/AppFooter";

// ✅ JSON-LD SAFE: évite tout crash si un schema est undefined/malformé
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

function safeNumber(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ✅ PRIX générés (SEO): 100k → 800k par pas de 10k
export const PRIX: number[] = Array.from({ length: 71 }, (_, i) => 100000 + i * 10000);

type Props = { prix: number };

export default function InvestissementPrixPage({ prix }: Props) {
  const siteUrl = "https://lokt.fr";

  // ✅ Route réelle (dossier dynamique): /simulateur/investissement/200000
  const pagePath = `/simulateur/investissement/${prix}`;
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = `Rentabilité locative pour un achat à ${formatEuro(prix)}€ — cash-flow & rendement | lokt.fr`;
  const description = `Estimez la rentabilité locative pour un achat à ${formatEuro(
    prix
  )}€ : repères sur loyers/charges/cash-flow et mini-simulation. Puis lancez la calculette complète lokt.fr (longue durée ou Airbnb).`;

  const ogImage = `${siteUrl}/logo-transparent-Lokt.jpg`;

  /**
   * Repères SEO par défaut (ne remplacent PAS le simulateur complet)
   */
  const rendementBrutRepere = 0.05; // 5% brut (repère générique)
  const loyerAnnuelRepere = Math.round(prix * rendementBrutRepere);
  const loyerMensuelRepere = Math.round(loyerAnnuelRepere / 12);

  const chargesPctRepere = 0.2; // 20% (repère générique)
  const chargesMensuellesRepere = Math.round(loyerMensuelRepere * chargesPctRepere);

  const cashflowMensuelAvantCredit = clamp(loyerMensuelRepere - chargesMensuellesRepere, 0, 999999);

  /**
   * ✅ Mini-simulation locale (UX + conversion)
   * - Mode: longue durée vs Airbnb
   * - Hypothèses ajustables
   */
  const [mode, setMode] = useState<"longue" | "airbnb">("longue");

  const [loyerMensuel, setLoyerMensuel] = useState<number>(
    clamp(loyerMensuelRepere, 350, 12000)
  );
  const [chargesPct, setChargesPct] = useState<number>(mode === "longue" ? 0.25 : 0.35);
  const [vacancePct, setVacancePct] = useState<number>(mode === "longue" ? 0.05 : 0.15);
  const [gestionPct, setGestionPct] = useState<number>(mode === "longue" ? 0.07 : 0.18);

  // 💡 mini hypothèse "crédit repère" (indicatif)
  const [mensualiteCredit, setMensualiteCredit] = useState<number>(
    clamp(Math.round((prix * 0.8) / 240 * 1.12), 350, 6500) // très repère (ne pas surestimer)
  );

  // Sync simple quand on change de mode (pour garder des valeurs cohérentes)
  const onModeChange = (m: "longue" | "airbnb") => {
    setMode(m);
    if (m === "longue") {
      setChargesPct(0.25);
      setVacancePct(0.05);
      setGestionPct(0.07);
    } else {
      setChargesPct(0.35);
      setVacancePct(0.15);
      setGestionPct(0.18);
    }
  };

  const sim = useMemo(() => {
    const loyersBrutsAn = loyerMensuel * 12;

    const vacance = loyersBrutsAn * vacancePct;
    const loyersNetVacance = loyersBrutsAn - vacance;

    const charges = loyersNetVacance * chargesPct;
    const gestion = loyersNetVacance * gestionPct;

    const revenuNetAvantCreditAn = loyersNetVacance - charges - gestion;
    const revenuNetAvantCreditM = revenuNetAvantCreditAn / 12;

    const cashflowApresCreditM = revenuNetAvantCreditM - mensualiteCredit;

    const rendementBrut = (loyersBrutsAn / prix) * 100;
    const rendementNetAvantCredit = (revenuNetAvantCreditAn / prix) * 100;

    return {
      loyersBrutsAn,
      vacance,
      charges,
      gestion,
      revenuNetAvantCreditM,
      cashflowApresCreditM,
      rendementBrut,
      rendementNetAvantCredit,
    };
  }, [loyerMensuel, chargesPct, vacancePct, gestionPct, mensualiteCredit, prix]);

  // ✅ Scénarios “prudent / optimiste” (ça aide l’utilisateur)
  const scenarios = useMemo(() => {
    const baseLoyer = loyerMensuelRepere;

    const prudent = {
      label: "Prudent",
      loyerM: Math.round(baseLoyer * 0.9),
      chargesPct: mode === "longue" ? 0.28 : 0.40,
      vacancePct: mode === "longue" ? 0.07 : 0.20,
      gestionPct: mode === "longue" ? 0.08 : 0.20,
    };

    const optimiste = {
      label: "Optimiste",
      loyerM: Math.round(baseLoyer * 1.1),
      chargesPct: mode === "longue" ? 0.22 : 0.32,
      vacancePct: mode === "longue" ? 0.03 : 0.10,
      gestionPct: mode === "longue" ? 0.06 : 0.16,
    };

    function compute(s: typeof prudent) {
      const loyersBrutsAn = s.loyerM * 12;
      const vacance = loyersBrutsAn * s.vacancePct;
      const loyersNetVacance = loyersBrutsAn - vacance;

      const charges = loyersNetVacance * s.chargesPct;
      const gestion = loyersNetVacance * s.gestionPct;

      const revenuNetAvantCreditAn = loyersNetVacance - charges - gestion;
      const revenuNetAvantCreditM = revenuNetAvantCreditAn / 12;
      const cashflowApresCreditM = revenuNetAvantCreditM - mensualiteCredit;

      return {
        ...s,
        loyersBrutsAn,
        revenuNetAvantCreditM,
        cashflowApresCreditM,
        rendementBrut: (loyersBrutsAn / prix) * 100,
        rendementNetAvantCredit: (revenuNetAvantCreditAn / prix) * 100,
      };
    }

    return {
      prudent: compute(prudent),
      optimiste: compute(optimiste),
    };
  }, [loyerMensuelRepere, mensualiteCredit, prix, mode]);

  const faq = [
    {
      q: "Quel rendement viser pour un investissement locatif ?",
      a:
        "Cela dépend de la ville, du type de bien et du mode d’exploitation (longue durée vs Airbnb). Le bon réflexe est de comparer le rendement brut et le rendement net avant crédit, puis de regarder le cash-flow après crédit.",
    },
    {
      q: "Pourquoi le cash-flow peut être négatif malgré un bon rendement ?",
      a:
        "Parce que le financement (taux, durée, assurance) et les charges (copro, entretien, gestion, vacance) peuvent absorber la marge. Une simulation utile doit intégrer ces postes — pas seulement un rendement brut.",
    },
    {
      q: "Longue durée ou Airbnb : qu’est-ce qui change ?",
      a:
        "Airbnb peut augmenter les loyers mais augmente souvent aussi la vacance, la gestion, les frais et la variabilité. La longue durée est plus stable mais parfois moins rentable selon les marchés.",
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
      isPartOf: {
        "@type": "WebSite",
        name: "lokt.fr",
        url: siteUrl,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Rentabilité locative", item: `${siteUrl}/investissement` },
        { "@type": "ListItem", position: 3, name: `${formatEuro(prix)}€`, item: pageUrl },
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

        {/* JSON-LD SAFE */}
        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* HERO */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-amber-200" />
            <div className="p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="max-w-3xl">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Simulateur rentabilité locative
                  </p>

                  <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">
                    Rentabilité locative pour un achat à {formatEuro(prix)}€
                  </h1>

                  <p className="mt-3 text-sm text-slate-600">
                    Cette page donne des <strong>repères rapides</strong> + une <strong>mini-simulation</strong>.
                    Pour un calcul fiable (financement, fiscalité, vacance, charges, Airbnb/longue durée),
                    utilisez la calculette complète lokt.fr.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/investissement"
                      className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      Lancer la calculette rentabilité locative →
                    </Link>

                    <Link
                      href="/capacite"
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
                    >
                      Vérifier ma capacité d’emprunt →
                    </Link>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-900">Loyer “repère” (indicatif)</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        ≈ {formatEuro(loyerMensuelRepere)}€ / mois
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Base repère ~ {Math.round(rendementBrutRepere * 100)}% brut (variable selon ville).
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-900">Charges “repère” (indicatif)</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        ≈ {formatEuro(chargesMensuellesRepere)}€ / mois
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Repère simple (copro/entretien/assurances…)
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-900">Cash-flow avant crédit (repère)</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        ≈ {formatEuro(cashflowMensuelAvantCredit)}€ / mois
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Hors financement (le vrai calcul est sur /investissement)
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA sidebar (desktop) */}
                <aside className="lg:w-[340px] w-full">
                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 lg:sticky lg:top-6">
                    <p className="text-xs font-semibold text-slate-900">Objectif : savoir si “ça passe”</p>
                    <p className="mt-2 text-sm text-slate-600">
                      En 2 minutes, testez un scénario réaliste : loyers, charges, vacance, gestion et une mensualité
                      de crédit indicative.
                    </p>
                    <div className="mt-4 space-y-2">
                      <Link
                        href="/investissement"
                        className="block text-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                      >
                        Calcul complet (fiable) →
                      </Link>
                      <Link
                        href="/pret-relais"
                        className="block text-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
                      >
                        Achat-revente ? Prêt relais →
                      </Link>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Astuce : comparez plusieurs prix et gardez une marge de sécurité.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </section>

          {/* MINI-SIM */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                Mini-simulation à {formatEuro(prix)}€ (rapide)
              </h2>

              <div className="flex gap-2">
                <button
                  onClick={() => onModeChange("longue")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold border ${
                    mode === "longue"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-900 border-slate-200"
                  }`}
                  type="button"
                >
                  Longue durée
                </button>
                <button
                  onClick={() => onModeChange("airbnb")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold border ${
                    mode === "airbnb"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-900 border-slate-200"
                  }`}
                  type="button"
                >
                  Airbnb
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {/* Inputs */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Hypothèses (ajustables)</p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-900">Loyer mensuel</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={loyerMensuel}
                      onChange={(e) => setLoyerMensuel(clamp(safeNumber(e.target.value, loyerMensuel), 0, 20000))}
                      inputMode="numeric"
                    />
                    <p className="mt-1 text-[0.75rem] text-slate-500">
                      Repère : {formatEuro(loyerMensuelRepere)}€
                    </p>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-900">Mensualité de crédit (repère)</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={mensualiteCredit}
                      onChange={(e) => setMensualiteCredit(clamp(safeNumber(e.target.value, mensualiteCredit), 0, 20000))}
                      inputMode="numeric"
                    />
                    <p className="mt-1 text-[0.75rem] text-slate-500">
                      Indicatif : dépend du taux, durée, assurance, apport.
                    </p>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-900">Charges (% des loyers nets)</span>
                    <input
                      className="mt-1 w-full"
                      type="range"
                      min={10}
                      max={60}
                      value={Math.round(chargesPct * 100)}
                      onChange={(e) => setChargesPct(clamp(Number(e.target.value) / 100, 0.1, 0.6))}
                    />
                    <p className="mt-1 text-[0.75rem] text-slate-500">{Math.round(chargesPct * 100)}%</p>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-900">Vacance locative</span>
                    <input
                      className="mt-1 w-full"
                      type="range"
                      min={0}
                      max={40}
                      value={Math.round(vacancePct * 100)}
                      onChange={(e) => setVacancePct(clamp(Number(e.target.value) / 100, 0, 0.4))}
                    />
                    <p className="mt-1 text-[0.75rem] text-slate-500">{Math.round(vacancePct * 100)}%</p>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-900">Gestion</span>
                    <input
                      className="mt-1 w-full"
                      type="range"
                      min={0}
                      max={30}
                      value={Math.round(gestionPct * 100)}
                      onChange={(e) => setGestionPct(clamp(Number(e.target.value) / 100, 0, 0.3))}
                    />
                    <p className="mt-1 text-[0.75rem] text-slate-500">{Math.round(gestionPct * 100)}%</p>
                  </label>
                </div>
              </div>

              {/* Outputs */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">Résultat (indicatif)</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-900">Rendement brut</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      ≈ {formatPct(sim.rendementBrut)}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">Loyers / prix (sans charges).</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-900">Rendement net avant crédit</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      ≈ {formatPct(sim.rendementNetAvantCredit)}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">Après charges + gestion + vacance.</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-900">Net avant crédit</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      ≈ {formatEuro(sim.revenuNetAvantCreditM)}€ / mois
                    </p>
                    <p className="mt-1 text-xs text-slate-600">Le “vrai” revenu locatif mensuel.</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-900">Cash-flow après crédit</p>
                    <p className={`mt-1 text-lg font-semibold ${sim.cashflowApresCreditM >= 0 ? "text-slate-900" : "text-rose-700"}`}>
                      ≈ {formatEuro(sim.cashflowApresCreditM)}€ / mois
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Positif = auto-financé. Négatif = effort d’épargne.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-900">Lecture rapide</p>
                  <ul className="mt-2 text-sm text-slate-600 list-disc pl-5 space-y-1">
                    <li>
                      Si le cash-flow est proche de zéro, une petite hausse de taux / charges peut le rendre négatif.
                    </li>
                    <li>
                      Pour une décision, il faut intégrer <strong>taux, durée, assurance, fiscalité</strong> et comparer
                      longue durée vs Airbnb.
                    </li>
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href="/investissement"
                      className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      Calcul complet (fiable) →
                    </Link>
                    <Link
                      href="/parc-immobilier"
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
                    >
                      J’ai déjà des biens (parc) →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SCENARIOS */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
              Deux scénarios utiles (pour éviter les mauvaises surprises)
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Même bien “rentable”, un projet peut devenir mauvais si vous sous-estimez la vacance / charges.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[scenarios.prudent, scenarios.optimiste].map((s) => (
                <div key={s.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold text-slate-900">{s.label}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Loyer: <strong>{formatEuro(s.loyerM)}€</strong> • Charges {Math.round(s.chargesPct * 100)}% • Vacance{" "}
                    {Math.round(s.vacancePct * 100)}% • Gestion {Math.round(s.gestionPct * 100)}%
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-900">Rendement brut</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatPct(s.rendementBrut)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-900">Net avant crédit</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatEuro(s.revenuNetAvantCreditM)}€ / mois
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
                      <p className="text-xs font-semibold text-slate-900">Cash-flow après crédit</p>
                      <p className={`mt-1 text-lg font-semibold ${s.cashflowApresCreditM >= 0 ? "text-slate-900" : "text-rose-700"}`}>
                        {formatEuro(s.cashflowApresCreditM)}€ / mois
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Ce scénario sert à tester ta “marge de sécurité”.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

                    {/* WHY IT FAILS */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
              Pourquoi beaucoup d’investissements à {formatEuro(prix)}€ se plantent
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">1) Charges sous-estimées</p>
                <p className="mt-2 text-sm text-slate-600">
                  Copro, entretien, assurance, travaux… Une petite erreur peut annuler le cash-flow.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">2) Crédit mal calibré</p>
                <p className="mt-2 text-sm text-slate-600">
                  Durée trop courte, assurance oubliée, taux qui bouge : le financement change tout.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">3) Vacance / gestion</p>
                <p className="mt-2 text-sm text-slate-600">
                  Airbnb peut booster le loyer… mais augmente variabilité, vacance, frais et gestion.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/investissement"
                className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Tester mon vrai scénario →
              </Link>
              <Link
                href="/capacite"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
              >
                Est-ce que je peux emprunter ? →
              </Link>
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

          {/* AUTRES PRIX (maillage interne) */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-sm font-semibold text-slate-900">Autres prix à explorer</h2>
            <p className="mt-2 text-sm text-slate-600">
              Comparez rapidement en changeant uniquement le prix d’achat :
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {PRIX.filter((p) => p !== prix)
                .slice(0, 18)
                .map((p) => (
                  <Link
                    key={p}
                    href={`/simulateur/investissement/${p}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-white"
                  >
                    {formatEuro(p)}€
                  </Link>
                ))}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Ces pages captent des requêtes “rentabilité locative {formatEuro(prix)}€” et renvoient vers la calculette complète.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: PRIX.map((p) => ({ params: { prix: String(p) } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const prixNum = Number(params?.prix);

  if (!Number.isFinite(prixNum)) return { notFound: true };
  if (!PRIX.includes(prixNum)) return { notFound: true };

  return { props: { prix: prixNum } };
};
