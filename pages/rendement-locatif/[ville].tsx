import Head from "next/head";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import { VILLES_DATA, getVilleBySlug, getAllVilleSlugs, VilleData } from "../../lib/villesRendement";

const SITE_URL = "https://lokt.fr";

function TensionBadge({ tension }: { tension: VilleData["tensionLocative"] }) {
  const cfg = {
    forte: { label: "Forte", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    moyenne: { label: "Moyenne", color: "text-amber-700 bg-amber-50 border-amber-200" },
    modérée: { label: "Modérée", color: "text-sky-700 bg-sky-50 border-sky-200" },
  }[tension];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatEur(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

// Mensualité crédit (capital × taux mensuel / (1 − (1 + taux)^−n))
function mensualite(capital: number, tauxAnnuel = 0.037, dureeAns = 20) {
  const t = tauxAnnuel / 12;
  const n = dureeAns * 12;
  return capital * (t / (1 - Math.pow(1 + t, -n)));
}

export default function RendementLocatifVille({ ville }: { ville: VilleData }) {
  const pageUrl = `${SITE_URL}/rendement-locatif/${ville.slug}`;
  const metaTitle = `Rendement locatif ${ville.name} 2026 : prix du m², loyers et rentabilité | lokt.fr`;
  const metaDesc = `Investir à ${ville.name} en 2026 : prix moyen ${ville.prixM2.toLocaleString("fr-FR")} €/m², loyer ${ville.loyerM2} €/m²/mois, rendement brut estimé ${ville.rendementBrut} %. Quartiers, types de biens et stratégie.`;

  const faq = [
    {
      q: `Quel est le rendement locatif moyen à ${ville.name} en 2026 ?`,
      a: `Le rendement brut moyen à ${ville.name} se situe autour de ${ville.rendementBrut} % en 2026, pour un prix d'achat moyen de ${ville.prixM2.toLocaleString("fr-FR")} €/m² et un loyer médian de ${ville.loyerM2} €/m²/mois. Le rendement net — après charges de copropriété, taxe foncière, vacance locative et fiscalité — est généralement 1,5 à 2 points en dessous du brut. Ces chiffres sont indicatifs : utilisez le simulateur lokt.fr pour calculer le rendement exact de votre bien.`,
    },
    {
      q: `Quel type de bien acheter pour louer à ${ville.name} ?`,
      a: `À ${ville.name}, les biens les plus performants sont : ${ville.biensPerformants.map((b) => b.type).join(", ")}. Le choix dépend de votre budget, de votre fiscalité et de votre tolérance au turnover. Les petites surfaces (studio, T2) offrent des rendements plus élevés mais une rotation plus fréquente ; les T3/T4 ont un rendement légèrement inférieur mais des locataires plus stables.`,
    },
    {
      q: `Faut-il un apport pour investir à ${ville.name} ?`,
      a: `Non, pas nécessairement. Certains profils (CDI ancienneté, taux d'endettement faible) obtiennent des financements à 100 % voire 110 %. En pratique, les banques demandent souvent 10 % minimum pour couvrir les frais de notaire. À ${ville.name}, avec un prix moyen de ${ville.prixM2.toLocaleString("fr-FR")} €/m², un studio de 25 m² s'achète autour de ${Math.round((ville.prixM2 * 25) / 1000) * 1000} € — un apport de 10 % représente donc environ ${Math.round((ville.prixM2 * 25 * 0.1) / 100) * 100} €.`,
    },
    {
      q: `Comment calculer la rentabilité d'un investissement locatif à ${ville.name} ?`,
      a: `La formule du rendement brut est : (loyer annuel ÷ prix d'achat) × 100. Pour un appartement acheté 200 000 € loué 800 €/mois, cela donne (9 600 ÷ 200 000) × 100 = 4,8 % brut. Le simulateur lokt.fr calcule automatiquement le rendement net en intégrant charges, taxe foncière, vacance et régime fiscal (LMNP ou revenus fonciers). Vous obtenez aussi le cash-flow mensuel et le retour sur fonds propres.`,
    },
    {
      q: `Quelle est la tension locative à ${ville.name} ?`,
      a: `La tension locative à ${ville.name} est ${ville.tensionLocative}. ${ville.tensionLocative === "forte" ? `Cela signifie que la demande de logements locatifs dépasse l'offre disponible : les délais de relocation sont courts (parfois quelques jours) et la vacance locative est très limitée.` : `La demande locative est présente mais moins tendue que dans les grandes métropoles. Une sélection rigoureuse de l'emplacement et du bien reste importante pour minimiser la vacance.`}`,
    },
    {
      q: `Est-ce le bon moment pour investir à ${ville.name} en 2026 ?`,
      a: `Le marché immobilier à ${ville.name} a traversé une période de correction depuis 2022, ce qui a ramené les prix à des niveaux plus cohérents avec les fondamentaux locaux. En 2026, les taux d'intérêt se sont stabilisés autour de 3,5-4 %, ce qui reste élevé par rapport aux niveaux de 2019-2021, mais les prix d'achat ont baissé en proportion. Pour un investisseur ayant un horizon de 10 ans minimum, ${ville.name} présente un bon profil risque/rendement grâce à sa démographie, son bassin d'emploi et sa demande locative structurelle. La clé reste le choix du bien : évitez les passoires thermiques (DPE F/G, location interdite dès 2025 pour G et gelée pour F) et privilégiez les emplacements proches des transports.`,
    },
    {
      q: `Comment gérer un bien à ${ville.name} depuis lokt.fr ?`,
      a: `lokt.fr permet aux bailleurs de gérer leur bien locatif entièrement en ligne, quelle que soit leur localisation. Depuis le tableau de bord, vous pouvez envoyer les quittances de loyer, suivre les paiements, générer les révisions IRL, rédiger les baux, gérer les états des lieux et recevoir les candidatures en ligne via un lien dédié. La plateforme est conçue pour les bailleurs particuliers qui gèrent 1 à 5 biens — sans agence, sans frais fixes.`,
    },
  ];

  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: metaTitle,
      description: metaDesc,
      url: pageUrl,
      inLanguage: "fr-FR",
      dateModified: "2026-06-28",
      publisher: {
        "@type": "Organization",
        name: "lokt.fr",
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Investissement locatif", item: `${SITE_URL}/investissement-locatif` },
        { "@type": "ListItem", position: 3, name: `Rendement locatif ${ville.name}`, item: pageUrl },
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

  const autresVilles = ville.villesProches
    .map((slug) => VILLES_DATA.find((v) => v.slug === slug))
    .filter(Boolean) as VilleData[];

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
        <meta property="og:image" content={`${SITE_URL}/logo-transparent-Lokt.jpg`} />
        {schemas.map((s, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
        ))}
      </Head>

      <AppHeader />

      <div className="bg-[#f6f9fc]">
        {/* ── HERO ── */}
        <section className="border-b border-slate-200 bg-white px-6 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto max-w-4xl">
            {/* Breadcrumb */}
            <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <Link href="/" className="hover:text-slate-600">Accueil</Link>
              <span>›</span>
              <Link href="/investissement-locatif" className="hover:text-slate-600">Investissement locatif</Link>
              <span>›</span>
              <span className="text-slate-600">Rendement locatif {ville.name}</span>
            </nav>

            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">
              {ville.region}
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Rendement locatif à {ville.name} en 2026
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
              Prix du m², loyers médians, rendement estimé et stratégie d'investissement.{" "}
              <span className="font-medium text-slate-700">Données indicatives 2026.</span>
            </p>

            {/* Key metrics */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-[#f6f9fc] p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Prix moyen</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{ville.prixM2.toLocaleString("fr-FR")} €</p>
                <p className="text-xs text-slate-400">par m²</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#f6f9fc] p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Loyer médian</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{ville.loyerM2} €</p>
                <p className="text-xs text-slate-400">par m²/mois</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#f6f9fc] p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Rendement brut</p>
                <p className="mt-1 text-2xl font-bold text-[#635bff]">~{ville.rendementBrut} %</p>
                <p className="text-xs text-slate-400">indicatif</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#f6f9fc] p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Tension locative</p>
                <div className="mt-1.5">
                  <TensionBadge tension={ville.tensionLocative} />
                </div>
                <p className="mt-1 text-xs text-slate-400">{ville.population}</p>
              </div>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-12">

          {/* ── MARCHÉ ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Le marché locatif à {ville.name}
            </h2>
            <div className="mt-3 space-y-4 text-base leading-7 text-slate-600">
              <p>{ville.descriptionMarche}</p>
              {ville.analyses.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>

          {/* ── LOYER PAR SURFACE ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Loyer médian estimé par surface à {ville.name}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Sur la base d'un loyer médian de {ville.loyerM2} €/m²/mois. Les petites surfaces affichent un loyer au m² supérieur aux grandes.
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Surface</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Loyer estimé</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Au m²</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 hidden sm:table-cell">Prix d'achat estimé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { type: "Studio", surface: 22, coeff: 1.22 },
                    { type: "T1 bis", surface: 32, coeff: 1.10 },
                    { type: "T2", surface: 45, coeff: 1.00 },
                    { type: "T3", surface: 65, coeff: 0.90 },
                    { type: "T4", surface: 85, coeff: 0.83 },
                  ].map(({ type, surface, coeff }) => {
                    const loyerM2Eff = ville.loyerM2 * coeff;
                    const loyer = Math.round(loyerM2Eff * surface);
                    const prixAchat = ville.prixM2 * surface;
                    return (
                      <tr key={type} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{type}</td>
                        <td className="px-4 py-3 text-slate-500">{surface} m²</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{loyer} €/mois</td>
                        <td className="px-4 py-3 text-slate-500">{loyerM2Eff.toFixed(1)} €/m²</td>
                        <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{prixAchat.toLocaleString("fr-FR")} €</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-400">Estimations indicatives 2026 basées sur les données de marché locales. La location meublée affiche généralement un loyer 10-15 % supérieur au loyer nu.</p>
          </section>

          {/* ── SIMULATION CONCRÈTE ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Simulation de rendement à {ville.name} : 3 scénarios
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Basé sur les prix et loyers médians 2026. Crédit estimé à 3,7 % sur 20 ans avec 10 % d'apport. Ces calculs sont indicatifs.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Studio", surface: 25, loyerCoeff: 1.18, netDecote: 2.3 },
                { label: "T2", surface: 45, loyerCoeff: 1.00, netDecote: 1.8 },
                { label: "T3", surface: 65, loyerCoeff: 0.90, netDecote: 1.5 },
              ].map(({ label, surface, loyerCoeff, netDecote }) => {
                const prix = ville.prixM2 * surface;
                const loyer = Math.round(ville.loyerM2 * surface * loyerCoeff);
                const loyerAn = loyer * 12;
                const rdtBrut = ((loyerAn / prix) * 100).toFixed(1);
                const rdtNetEst = Math.max(parseFloat(rdtBrut) - netDecote, 1.2).toFixed(1);
                const budgetTotal = prix * 1.08;
                const apport10 = prix * 0.1;
                const capitalEmprunte = prix * 0.9;
                const mensual = mensualite(capitalEmprunte);
                const chargesEst = loyer * 0.15;
                const cashFlow = loyer - mensual - chargesEst;
                const cfPositif = cashFlow >= 0;
                return (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                    <p className="font-semibold text-slate-900">{label} — {surface} m²</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Prix d'achat</span>
                        <span className="font-medium text-slate-800">{formatEur(prix)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Loyer estimé</span>
                        <span className="font-medium text-slate-800">{formatEur(loyer)}/mois</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mensualité crédit</span>
                        <span className="font-medium text-slate-600">{formatEur(mensual)}/mois</span>
                      </div>
                      <div className="my-1 border-t border-slate-100" />
                      <div className="flex justify-between">
                        <span className="text-slate-500">Rendement brut</span>
                        <span className="font-bold text-[#635bff]">~{rdtBrut} %</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Rendement net est.</span>
                        <span className="font-medium text-slate-600">~{rdtNetEst} %</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Cash-flow est.</span>
                        <span className={`font-semibold ${cfPositif ? "text-emerald-600" : "text-amber-600"}`}>
                          {cfPositif ? "+" : ""}{formatEur(cashFlow)}/mois
                        </span>
                      </div>
                      <div className="my-1 border-t border-slate-100" />
                      <div className="flex justify-between">
                        <span className="text-slate-500">Budget total (+8 % frais)</span>
                        <span className="font-medium text-slate-800">{formatEur(budgetTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Apport 10 %</span>
                        <span className="font-medium text-slate-800">{formatEur(apport10)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Crédit : 90 % du prix, taux 3,7 % sur 20 ans. Charges estimées à 15 % du loyer (taxe foncière, copropriété, vacance). Le cash-flow réel dépend de votre apport, de votre taux et du régime fiscal.{" "}
              <Link href="/investissement" className="text-[#635bff] hover:underline">Calculer avec vos données →</Link>
            </p>
          </section>

          {/* ── CTA SIMULATEUR ── */}
          <section className="rounded-2xl bg-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-25 blur-3xl bg-cyan-500" />
            <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full opacity-15 blur-3xl bg-emerald-400" />
            <div className="relative">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">Simulateur gratuit</p>
              <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
                Calculez la rentabilité exacte de votre bien à {ville.name}
              </h2>
              <p className="mt-2 text-sm text-slate-200 max-w-xl">
                Prix d'achat, loyer, charges, vacance, fiscalité LMNP ou revenus fonciers — obtenez le rendement net et le cash-flow mensuel en 2 minutes.
              </p>
              <Link
                href="/investissement"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:opacity-95 transition"
              >
                Lancer le simulateur →
              </Link>
            </div>
          </section>

          {/* ── BIENS PERFORMANTS ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Types de biens qui performent à {ville.name}
            </h2>
            <div className="mt-5 space-y-3">
              {ville.biensPerformants.map((bien, i) => (
                <div key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#635bff]/10 text-sm font-bold text-[#635bff]">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{bien.type}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{bien.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── QUARTIERS ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Quartiers à surveiller à {ville.name}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {ville.quartiers.map((q, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{q.nom}</p>
                  <p className="mt-1 text-sm text-slate-500">{q.note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── AVANTAGES / VIGILANCES ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Avantages et points de vigilance
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-emerald-800 mb-3">Points forts</p>
                <ul className="space-y-2">
                  {ville.avantages.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                      <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-semibold text-amber-800 mb-3">Points de vigilance</p>
                <ul className="space-y-2">
                  {ville.vigilances.map((v, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                      <span className="mt-0.5 shrink-0">⚠</span>
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Questions fréquentes — Investissement locatif à {ville.name}
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

          {/* ── COMMENT INVESTIR ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Comment investir à {ville.name} en 2026 : les 5 étapes
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Du calcul de capacité à la mise en location, voici le parcours type d'un investisseur qui achète à {ville.name}.
            </p>
            <div className="mt-5 space-y-3">
              {[
                {
                  n: "01",
                  title: "Définir son budget et sa capacité d'emprunt",
                  body: `Avant de chercher un bien, calculez votre capacité de financement. À ${ville.name} avec un prix moyen de ${ville.prixM2.toLocaleString("fr-FR")} €/m², un studio de 25 m² coûte environ ${formatEur(ville.prixM2 * 25)}. Ajoutez 8 % de frais de notaire pour un bien ancien. Le simulateur lokt.fr calcule le rendement net et le cash-flow selon votre apport et votre taux.`,
                },
                {
                  n: "02",
                  title: "Choisir le type de bien et le secteur",
                  body: `Les types de biens les plus performants à ${ville.name} sont : ${ville.biensPerformants.map((b) => b.type).join(", ")}. Concentrez-vous sur les quartiers bien desservis par les transports : ${ville.quartiers.slice(0, 2).map((q) => q.nom).join(" et ")}. Évitez les passoires thermiques (DPE F/G) : les G sont interdits à la location depuis 2025 et les F font l'objet d'un gel de loyer.`,
                },
                {
                  n: "03",
                  title: "Choisir le régime fiscal : LMNP ou revenus fonciers",
                  body: `Pour les petites surfaces meublées, le LMNP réel est presque toujours plus avantageux. L'amortissement du bien et du mobilier efface généralement l'impôt sur les loyers pendant 10 à 15 ans. Pour les grandes surfaces nues (T3/T4), les revenus fonciers au régime réel permettent de déduire les charges et de créer un déficit foncier imputable sur le revenu global (jusqu'à 10 700 €/an).`,
                },
                {
                  n: "04",
                  title: "Sélectionner le locataire dans les règles",
                  body: `Le décret du 5 novembre 2015 encadre les pièces que vous pouvez demander (identité, bulletins de salaire, avis d'imposition). Le critère de revenus habituellement retenu est 3 fois le loyer charges comprises. Vous ne pouvez pas cumuler garantie loyers impayés (GLI) et caution solidaire sauf si le locataire est étudiant ou apprenti.`,
                },
                {
                  n: "05",
                  title: "Gérer le bien efficacement",
                  body: `La gestion locative représente l'essentiel du temps d'un bailleur : quittances, révisions IRL, suivi des paiements, déclaration fiscale. lokt.fr automatise ces tâches — quittances générées automatiquement, alertes de révision IRL, suivi des loyers et gestion des candidatures en ligne. La plateforme est gratuite jusqu'à 1 bien.`,
                },
              ].map(({ n, title, body }) => (
                <div key={n} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#635bff]/10 text-sm font-bold text-[#635bff]">{n}</div>
                  <div>
                    <p className="font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA GESTION ── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Déjà propriétaire à {ville.name} ?</p>
                <h2 className="mt-1.5 text-lg font-semibold text-slate-950">
                  Gérez votre bien locatif sans agence avec lokt.fr
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Quittances automatiques, révision IRL, suivi des loyers, baux en ligne et réception des candidatures — tout en un, à partir de 4,90 €/mois.
                </p>
                <ul className="mt-3 space-y-1">
                  {["Quittances générées en 1 clic", "Candidatures en ligne avec scoring automatique", "Révisions IRL et alertes échéances", "Déclaration fiscale simplifiée"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="text-[#635bff]">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 flex-col gap-3">
                <Link href="/espace-bailleur" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#635bff] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition">
                  Essayer gratuitement →
                </Link>
                <Link href="/tarifs" className="text-center text-xs text-slate-400 hover:text-slate-600 hover:underline">
                  Voir les tarifs
                </Link>
              </div>
            </div>
          </section>

          {/* ── DISCLAIMER ── */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-400 leading-5">
            Les données présentées sur cette page (prix au m², loyers, rendements) sont des estimations indicatives basées sur les données de marché disponibles en 2026. Elles ne constituent pas un conseil en investissement. Consultez un professionnel qualifié avant toute décision d'achat.
          </div>

          {/* ── AUTRES VILLES ── */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Comparer avec d'autres villes
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {autresVilles.map((v) => (
                <Link
                  key={v.slug}
                  href={`/rendement-locatif/${v.slug}`}
                  className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#635bff]/40 hover:shadow-md"
                >
                  <p className="font-semibold text-slate-900 group-hover:text-[#635bff]">{v.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{v.region}</p>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <span className="font-medium text-[#635bff]">~{v.rendementBrut} %</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{v.prixM2.toLocaleString("fr-FR")} €/m²</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link href="/rendement-locatif" className="text-sm text-[#635bff] hover:underline">
                Voir toutes les villes →
              </Link>
            </div>
          </section>

          {/* ── ARTICLES LIÉS ── */}
          <section className="rounded-2xl border border-[#635bff]/20 bg-gradient-to-r from-[#635bff]/5 to-[#00b4d8]/5 p-6 sm:p-8">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Pour aller plus loin</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Guides et outils liés</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { href: "/investissement-locatif", label: "Guide complet de l'investissement locatif 2026" },
                { href: "/investissement", label: "Simulateur de rentabilité locative" },
                { href: "/blog/investissement-locatif", label: "Comment calculer le rendement net d'un investissement" },
                { href: "/blog/lmnp-vs-location-nue", label: "LMNP vs location nue : quel régime choisir ?" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-[#635bff]/40 hover:text-[#635bff] transition"
                >
                  {link.label}
                  <span className="ml-2 shrink-0 text-slate-400">→</span>
                </Link>
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
  return {
    paths: getAllVilleSlugs().map((slug) => ({ params: { ville: slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }: { params: { ville: string } }) {
  const ville = getVilleBySlug(params.ville);
  if (!ville) return { notFound: true };
  return { props: { ville } };
}
