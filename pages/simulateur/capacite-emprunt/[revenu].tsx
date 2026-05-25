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

function toNumber(v: string, fallback = 0) {
  const norm = (v || "").replace(",", ".").replace(/[^\d.]/g, "").trim();
  if (!norm) return fallback;
  const x = Number(norm);
  return Number.isFinite(x) ? x : fallback;
}

// ✅ Liste des revenus que TU veux générer en pages SEO
const REVENUS = [
  1500, 1800, 2000, 2200, 2500, 2800, 3000, 3200, 3500, 3800, 4000, 4500, 5000,
  5500, 6000, 7000, 8000,
];

type Props = {
  revenu: number;
};

// Petite fonction de capacité (approx) : mensualité -> capital empruntable
// Formule annuité (prudent) : capital = mensualité * (1 - (1+r)^-n) / r
function capitalFromMensualite(mensualite: number, tauxAnnuelPct: number, dureeAnnees: number) {
  const n = Math.max(1, Math.round(dureeAnnees * 12));
  const r = Math.max(0, tauxAnnuelPct / 100) / 12;
  if (r === 0) return mensualite * n;
  const k = mensualite * (1 - Math.pow(1 + r, -n)) / r;
  return Math.max(0, k);
}

export default function CapaciteEmpruntRevenuPage({ revenu }: Props) {
  const siteUrl = "https://lokt.fr";

  // ✅ URL dynamique (slash) - compatible Next + SEO
  const pagePath = `/simulateur/capacite-emprunt/${revenu}`;
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = `Capacité d’emprunt avec ${formatEuro(revenu)}€ — combien puis-je emprunter ? | lokt.fr`;
  const description = `Estimez votre capacité d’emprunt avec ${formatEuro(
    revenu
  )}€ de revenus mensuels : mensualité cible, capital empruntable et budget d’achat. Simulation gratuite avec lecture claire sur lokt.fr.`;

  const ogImage = `${siteUrl}/logo-transparent-Lokt.jpg`;

  // Mini-sim locale (sans back) : apport + taux + durée
  const [apportStr, setApportStr] = useState<string>("20000");
  const [tauxStr, setTauxStr] = useState<string>("4,0");
  const [dureeStr, setDureeStr] = useState<string>("25");

  const apport = clamp(toNumber(apportStr, 0), 0, 5_000_000);
  const taux = clamp(toNumber(tauxStr, 4.0), 0, 12);
  const duree = clamp(toNumber(dureeStr, 25), 5, 30);

  // Scénarios d'endettement (repères) + estimation reste à vivre
  // NB: ce sont des repères — la calculette /capacite fait le vrai calcul (charges, crédits, loyers 70%, etc.)
  const scenarii = useMemo(() => {
    const scenarios = [
      { key: "prudent", label: "Prudent", ratio: 0.30, hint: "Marge confortable, souvent plus “banque-friendly”." },
      { key: "standard", label: "Standard", ratio: 0.35, hint: "Repère classique (selon profil / banque)." },
      { key: "agressif", label: "Agressif", ratio: 0.40, hint: "Possible selon dossier, mais plus fragile." },
    ] as const;

    return scenarios.map((s) => {
      const mensualite = clamp(Math.round(revenu * s.ratio), 250, 8000);

      // Budget achat approximatif = apport + capital empruntable
      const capital = capitalFromMensualite(mensualite, taux, duree);
      const budgetAchat = capital + apport;

      // Reste à vivre repère (hyper simplifié) : revenus - mensualité
      // En vrai : revenus - mensualités - charges fixes, etc.
      const resteAVivre = Math.max(0, revenu - mensualite);

      return { ...s, mensualite, capital, budgetAchat, resteAVivre };
    });
  }, [revenu, taux, duree, apport]);

  const best = scenarii[1]; // standard

  const faq = [
    {
      q: "La capacité d’emprunt avec " + formatEuro(revenu) + "€ est-elle la même pour tout le monde ?",
      a:
        "Non. Les banques regardent les charges (crédits, pensions), l’apport, la stabilité des revenus, la durée, le taux, l’assurance et parfois un reste à vivre minimum. Les loyers futurs ou existants peuvent être retenus partiellement.",
    },
    {
      q: "Pourquoi 35% n’est pas toujours suffisant ?",
      a:
        "35% est un repère, mais un dossier peut être refusé si le reste à vivre est jugé trop faible, si le budget est trop tendu, ou si le profil est considéré plus risqué (CDD, période d’essai, crédits conso, etc.).",
    },
    {
      q: "Faut-il un apport pour emprunter ?",
      a:
        "Ce n’est pas toujours obligatoire, mais en pratique un apport aide fortement (frais de notaire, dossier plus solide, meilleures conditions). À budget identique, plus d’apport = moins de dette = dossier plus confortable.",
    },
    {
      q: "Ces chiffres sont-ils fiables ?",
      a:
        "Ce sont des repères rapides pour comprendre l’ordre de grandeur. Pour un calcul fiable (charges, crédits, loyers retenus, taux, durée, assurance), utilise la calculette complète sur lokt.fr.",
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
        { "@type": "ListItem", position: 2, name: "Capacité d’emprunt", item: `${siteUrl}/capacite` },
        { "@type": "ListItem", position: 3, name: `Revenu ${formatEuro(revenu)}€`, item: pageUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((x) => ({
        "@type": "Question",
        name: x.q,
        acceptedAnswer: { "@type": "Answer", text: x.a },
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
        <div className="max-w-5xl mx-auto space-y-6">
          {/* HERO */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 to-cyan-500" />
            <div className="p-6 sm:p-8">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Simulateur capacité d’emprunt</p>

              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">
                Capacité d’emprunt avec {formatEuro(revenu)}€
              </h1>

              <p className="mt-3 text-sm text-slate-600 max-w-3xl">
                Ici : des <strong>repères rapides</strong> pour comprendre l’ordre de grandeur (mensualité, capital,
                budget). Pour un résultat fiable (charges, crédits, loyers retenus à 70%, taux, durée, assurance),
                lancez la calculette complète.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/capacite"
                  className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Tester mon vrai dossier (calculette complète) →
                </Link>

                <Link
                  href="/pret-relais"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
                >
                  Achat avant vente ? Prêt relais →
                </Link>
              </div>

              {/* Résumé ultra clair */}
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">Mensualité “standard” (repère)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">≈ {formatEuro(best.mensualite)}€ / mois</p>
                  <p className="mt-1 text-xs text-slate-600">Repère à ~35% (hors règles détaillées banque).</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">Capital empruntable (repère)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">≈ {formatEuro(best.capital)}€</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Basé sur {formatEuro(taux)}% sur {formatEuro(duree)} ans (modifiable ci-dessous).
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">Budget d’achat (avec apport)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">≈ {formatEuro(best.budgetAchat)}€</p>
                  <p className="mt-1 text-xs text-slate-600">Apport actuel : {formatEuro(apport)}€.</p>
                </div>
              </div>
            </div>
          </section>

          {/* MINI SIM (super utile pour l'utilisateur) */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                  Ajuster rapidement (sans entrer tout votre dossier)
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Changez <strong>apport</strong>, <strong>taux</strong> et <strong>durée</strong> pour voir l’impact sur le capital et le budget.
                </p>
              </div>
              <Link
                href="/capacite"
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
              >
                Faire le calcul complet →
              </Link>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Apport (€)</label>
                <input
                  value={apportStr}
                  onChange={(e) => setApportStr(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Taux (%)</label>
                <input
                  value={tauxStr}
                  onChange={(e) => setTauxStr(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Durée (années)</label>
                <input
                  value={dureeStr}
                  onChange={(e) => setDureeStr(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {scenarii.map((s) => (
                <div key={s.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-900">{s.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{s.hint}</p>

                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-slate-600">Mensualité repère</p>
                    <p className="text-lg font-semibold text-slate-900">≈ {formatEuro(s.mensualite)}€</p>
                  </div>

                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-slate-600">Capital repère</p>
                    <p className="text-sm font-semibold text-slate-900">≈ {formatEuro(s.capital)}€</p>
                  </div>

                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-slate-600">Budget d’achat (avec apport)</p>
                    <p className="text-sm font-semibold text-slate-900">≈ {formatEuro(s.budgetAchat)}€</p>
                  </div>

                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-slate-600">Reste à vivre (repère)</p>
                    <p className="text-sm font-semibold text-slate-900">≈ {formatEuro(s.resteAVivre)}€</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Pourquoi un dossier peut être refusé même si “ça passe” ?</p>
              <ul className="mt-2 text-sm text-slate-600 list-disc pl-5 space-y-1">
                <li>Reste à vivre trop faible une fois charges fixes déduites (loyer, pensions, crédits…).</li>
                <li>Crédits conso / auto en cours, ou utilisation élevée du revolving.</li>
                <li>Profil jugé instable (période d’essai, revenus variables, ancienneté faible).</li>
                <li>Projet locatif : loyers retenus partiellement (souvent 70% ou moins).</li>
              </ul>
              <div className="mt-3">
                <Link
                  href="/capacite"
                  className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Tester mon dossier avec toutes mes charges →
                </Link>
              </div>
            </div>
          </section>

          {/* CONTENU SEO UTILE */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
              Comment estimer sa capacité d’emprunt avec {formatEuro(revenu)}€ ?
            </h2>

            <div className="mt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                En première approche, les banques raisonnent souvent avec un taux d’endettement maximal (souvent autour
                de 35%). Mais le calcul réel dépend aussi des <strong>charges</strong> (crédits auto, conso, pensions),
                des paramètres de prêt (<strong>durée</strong>, <strong>taux</strong>, <strong>assurance</strong>) et,
                si vous êtes déjà propriétaire bailleur, des loyers retenus de façon prudente (souvent partiellement).
              </p>

              <p>
                Pour obtenir un résultat exploitable, l’idée n’est pas d’avoir “un chiffre”, mais une{" "}
                <strong>lecture claire</strong> : ce qui fait monter/descendre la mensualité, et ce qui sécurise un
                dossier (apport, reste à vivre, stabilité des revenus).
              </p>

              <p>
                Avec lokt.fr, vous testez plusieurs scénarios et vous comparez rapidement :{" "}
                <Link href="/capacite" className="font-semibold underline decoration-slate-300 text-slate-900">
                  capacité d’emprunt
                </Link>
                ,{" "}
                <Link href="/pret-relais" className="font-semibold underline decoration-slate-300 text-slate-900">
                  prêt relais
                </Link>
                ,{" "}
                <Link href="/investissement" className="font-semibold underline decoration-slate-300 text-slate-900">
                  rentabilité locative
                </Link>{" "}
                et{" "}
                <Link href="/parc-immobilier" className="font-semibold underline decoration-slate-300 text-slate-900">
                  parc immobilier
                </Link>
                .
              </p>
            </div>
          </section>

          {/* FAQ (SEO + conversion) */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900">Questions fréquentes</h2>
            <div className="mt-4 space-y-3">
              {faq.map((x, idx) => (
                <details key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">{x.q}</summary>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{x.a}</p>
                </details>
              ))}
            </div>

            <div className="mt-5">
              <Link
                href="/capacite"
                className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Faire la simulation complète →
              </Link>
            </div>
          </section>

          {/* AUTRES REVENUS (maillage interne) */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <h2 className="text-sm font-semibold text-slate-900">Autres revenus à explorer</h2>
            <p className="mt-2 text-sm text-slate-600">Comparez rapidement en changeant uniquement le niveau de revenus :</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {REVENUS.filter((r) => r !== revenu)
                .slice(0, 12)
                .map((r) => (
                  <Link
                    key={r}
                    href={`/simulateur/capacite-emprunt/${r}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-white"
                  >
                    {formatEuro(r)}€
                  </Link>
                ))}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Astuce : plus tard, tu peux décliner par “apport” ou “durée” pour capter encore plus d’intentions.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = REVENUS.map((revenu) => ({
    params: { revenu: String(revenu) },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const raw = ctx.params?.revenu;
  const revenuNum = Number(raw);

  if (!Number.isFinite(revenuNum)) {
    return { notFound: true };
  }

  if (!REVENUS.includes(revenuNum)) {
    return { notFound: true };
  }

  return {
    props: { revenu: revenuNum },
  };
};
