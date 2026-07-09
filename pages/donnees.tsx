import Head from "next/head";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { getDonneesImmo, type DonneesImmo } from "../lib/donnees-service";

export async function getStaticProps() {
  const donnees = await getDonneesImmo();
  return { props: { donnees }, revalidate: 3600 }; // ISR toutes les heures
}

export default function DonneesPage({ donnees }: { donnees: DonneesImmo }) {
  const title = "Données immobilières France 2026 : loyers, rendements, taux de crédit | lokt.fr";
  const description =
    "Loyers médians par ville, rendements locatifs bruts par type de bien, taux de crédit immobilier et capacité d'emprunt par revenus — données de référence T2 2026, librement accessibles via API JSON.";
  const url = "https://lokt.fr/donnees";

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Données immobilières de référence France 2026 — lokt.fr",
      description,
      url,
      creator: { "@type": "Organization", name: "lokt.fr", url: "https://lokt.fr" },
      license: "https://creativecommons.org/licenses/by/4.0/",
      temporalCoverage: "2026",
      spatialCoverage: { "@type": "Place", name: "France" },
      distribution: [
        {
          "@type": "DataDownload",
          encodingFormat: "application/json",
          contentUrl: "https://lokt.fr/api/donnees",
        },
      ],
      keywords: [
        "loyer médian France",
        "rendement locatif",
        "taux crédit immobilier 2026",
        "capacité d'emprunt",
        "données immobilières",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "lokt.fr", item: "https://lokt.fr" },
        { "@type": "ListItem", position: 2, name: "Données immobilières", item: url },
      ],
    },
  ];

  const { loyers_medians_par_ville, rendements_locatifs_par_type, rendements_par_ville, taux_credit_immobilier, capacite_emprunt_reference, taux_endettement } = donnees;

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

      {/* Hero */}
      <section className="border-b border-slate-200 bg-white px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[0.72rem] font-semibold text-indigo-700">
            Données ouvertes · T2 2026
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
            Données immobilières de référence — France 2026
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Loyers médians par ville, rendements locatifs, taux de crédit et capacité d'emprunt. Données mises à jour trimestriellement, librement accessibles en JSON via notre API publique.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/api/donnees"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <span>API JSON</span>
              <span className="text-slate-400">→ lokt.fr/api/donnees</span>
            </a>
            <Link href="/capacite" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Simulateur capacité d'emprunt →
            </Link>
            <Link href="/investissement" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Calculette rentabilité →
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">

        {/* Taux de crédit */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Taux de crédit immobilier — France T2 2026</h2>
            <p className="mt-0.5 text-sm text-slate-500">Hors assurance emprunteur · Source : Observatoire Crédit Logement/CSA</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 font-semibold text-slate-700">Durée</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Taux moyen</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Fourchette basse</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Fourchette haute</th>
                </tr>
              </thead>
              <tbody>
                {taux_credit_immobilier.donnees.map((row) => (
                  <tr key={row.duree_ans} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.duree_ans} ans</td>
                    <td className="px-5 py-3 font-semibold text-indigo-700">{row.taux_moyen.toFixed(2)} %</td>
                    <td className="px-5 py-3 text-slate-500">{row.taux_bas.toFixed(2)} %</td>
                    <td className="px-5 py-3 text-slate-500">{row.taux_haut.toFixed(2)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
            <p className="text-xs text-slate-500">
              Taux d'endettement maximal réglementaire (HCSF) : <strong>{taux_endettement.plafond_reglementaire_hcsf} %</strong> charges incluses ·
              Taux moyen constaté : <strong>{taux_endettement.moyen_constate} %</strong>
            </p>
          </div>
        </section>

        {/* Capacité d'emprunt */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Capacité d'emprunt par tranche de revenus</h2>
            <p className="mt-0.5 text-sm text-slate-500">Sans autres charges · Taux 3,5 % · Assurance 0,36 % · Taux d'endettement 35 %</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 font-semibold text-slate-700">Revenus nets/mois</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Mensualité max</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Capital sur 20 ans</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Capital sur 25 ans</th>
                </tr>
              </thead>
              <tbody>
                {capacite_emprunt_reference.donnees.map((row) => (
                  <tr key={row.revenus_nets_mensuels} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.revenus_nets_mensuels.toLocaleString("fr-FR")} €</td>
                    <td className="px-5 py-3 text-slate-700">{row.mensualite_max.toLocaleString("fr-FR")} €</td>
                    <td className="px-5 py-3 font-semibold text-indigo-700">~{row.capital_20_ans.toLocaleString("fr-FR")} €</td>
                    <td className="px-5 py-3 text-slate-500">~{row.capital_25_ans.toLocaleString("fr-FR")} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">Données indicatives · Calculées avec le simulateur lokt.fr</p>
            <Link href="/capacite" className="text-xs font-semibold text-indigo-600 hover:underline">
              Calculer ma capacité personnalisée →
            </Link>
          </div>
        </section>

        {/* Loyers médians */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Loyers médians par ville — France T2 2026</h2>
            <p className="mt-0.5 text-sm text-slate-500">Appartements tous types confondus · Source : CLAMEUR / observatoires locaux</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 font-semibold text-slate-700">Ville</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Loyer médian (€/m²)</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Évolution annuelle</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Rendement brut T2 médian</th>
                </tr>
              </thead>
              <tbody>
                {loyers_medians_par_ville.donnees.map((row) => {
                  const rdmt = rendements_par_ville.donnees.find((r) => r.ville === row.ville);
                  return (
                    <tr key={row.ville} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{row.ville}</td>
                      <td className="px-5 py-3 font-semibold text-slate-900">{row.loyer_median_m2.toFixed(1)} €/m²</td>
                      <td className="px-5 py-3 text-emerald-700">+{row.evolution_annuelle_pct.toFixed(1)} %</td>
                      <td className="px-5 py-3 text-indigo-700">{rdmt ? `${rdmt.rendement_brut_median.toFixed(1)} %` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rendements par type */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Rendements bruts médians par type de bien — France hors Paris (T2 2026)</h2>
            <p className="mt-0.5 text-sm text-slate-500">Rendement brut = loyers annuels / prix d'achat frais inclus · Le rendement net est inférieur de ~1,5 à 2 points</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 font-semibold text-slate-700">Type de bien</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Rendement médian</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Fourchette basse</th>
                  <th className="px-5 py-3 font-semibold text-slate-500">Fourchette haute</th>
                </tr>
              </thead>
              <tbody>
                {rendements_locatifs_par_type.donnees.map((row) => (
                  <tr key={row.type_bien} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.type_bien}</td>
                    <td className="px-5 py-3 font-semibold text-indigo-700">{row.rendement_brut_median.toFixed(1)} %</td>
                    <td className="px-5 py-3 text-slate-500">{row.rendement_brut_bas.toFixed(1)} %</td>
                    <td className="px-5 py-3 text-slate-500">{row.rendement_brut_haut.toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">Ces rendements sont des médianes — votre projet peut sortir en dehors de ces fourchettes selon la ville et le bien.</p>
            <Link href="/investissement" className="text-xs font-semibold text-indigo-600 hover:underline">
              Calculer le rendement de mon projet →
            </Link>
          </div>
        </section>

        {/* API */}
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <h2 className="text-base font-semibold text-indigo-900">API JSON publique</h2>
          <p className="mt-1 text-sm text-indigo-800">
            Toutes ces données sont accessibles librement en JSON, sans authentification, sous licence CC BY 4.0.
          </p>
          <div className="mt-3 space-y-2 font-mono text-xs">
            <div className="rounded-lg bg-indigo-900 px-4 py-2 text-indigo-100">GET https://lokt.fr/api/donnees</div>
            <div className="rounded-lg bg-indigo-900 px-4 py-2 text-indigo-100">GET https://lokt.fr/api/donnees?section=taux_credit_immobilier</div>
            <div className="rounded-lg bg-indigo-900 px-4 py-2 text-indigo-100">GET https://lokt.fr/api/donnees?section=loyers_medians_par_ville</div>
            <div className="rounded-lg bg-indigo-900 px-4 py-2 text-indigo-100">GET https://lokt.fr/api/donnees?section=capacite_emprunt_reference</div>
          </div>
          <p className="mt-3 text-xs text-indigo-700">
            Cache 24h · CORS ouvert · Mise à jour trimestrielle ·{" "}
            <a href="/api/donnees" target="_blank" rel="noopener" className="underline font-semibold">Tester l'API →</a>
          </p>
        </section>

        <p className="text-xs text-slate-400 text-center pb-4">
          Données indicatives à titre de référence. Sources : Observatoire Crédit Logement/CSA, CLAMEUR, Banque de France. Mis à jour T2 2026.
          Ces données ne constituent pas un conseil en investissement.
        </p>
      </div>

      <AppFooter />
    </div>
  );
}
