// pages/investissement.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import InvestissementWizard from "../components/InvestissementWizard";
import CalculatorHero from "../components/calculators/CalculatorHero";
import { supabase } from "../lib/supabaseClient";
import { firstNameFromUser } from "../lib/userDisplay";
import { useScrollReveal } from "../hooks/useScrollReveal";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
    first_name?: string;
    given_name?: string;
  };
};

// ✅ JSON-LD SAFE (comme pret-relais) : évite tout crash si schema undefined/malformé
function JsonLd({ data }: { data: any }) {
  const items = Array.isArray(data) ? data : [data];
  const safeItems = items.filter(
    (x) => x && typeof x === "object" && typeof x["@context"] === "string" && x["@context"].length > 0
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

export default function InvestissementPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser((data.session?.user as any) ?? null);
      } catch (e) {
        console.error("Erreur récupération session (investissement)", e);
      }
    };

    fetchSession();

    const { data: authListener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser((session?.user as any) ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const displayName = useMemo(() => firstNameFromUser(user), [user]);
  const isLoggedIn = !!user;

  useScrollReveal();

  // --- SEO
  const siteUrl = "https://lokt.fr";
  const pagePath = "/investissement";
  const pageUrl = `${siteUrl}${pagePath}`;

  // ✅ CTR-first
  const title = "Simulateur rentabilité locative 2026 gratuit | lokt.fr";
  const description =
    "Simulateur de rentabilité locative gratuit : rendement brut, net et net-net, cash-flow, charges et financement. Résultat immédiat, sans inscription.";

  // OG image (non transparent, OK WhatsApp)
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  // Mini FAQ (SEO) — sans toucher au wizard
  const faqData = useMemo(
    () => [
      {
        q: "Quelle est la différence entre cash-flow et rendement ?",
        a: "Le cash-flow correspond au flux mensuel net (loyer – charges – crédit). Le rendement mesure la performance annuelle (revenus / prix d'achat), et peut être brut ou net selon les charges prises en compte.",
      },
      {
        q: "Quelle différence entre rendement brut et rendement net ?",
        a: "Le rendement brut compare les loyers annuels au prix d'achat. Le rendement net retire les charges (taxe foncière, copropriété, assurance, vacance, gestion…). Il est plus proche de la réalité pour comparer deux projets.",
      },
      {
        q: "Quelles charges faut-il inclure pour estimer une rentabilité réaliste ?",
        a: "À minima : copropriété, assurance, taxe foncière, entretien, gestion, vacance locative, travaux et frais liés au financement. La rentabilité dépend surtout de la cohérence des hypothèses.",
      },
      {
        q: "Longue durée ou Airbnb : comment comparer ?",
        a: "La location saisonnière se compare en convertissant un prix par nuit et un taux d'occupation en revenu mensuel équivalent, puis en ajoutant les coûts spécifiques (ménage, conciergerie, vacance, renouvellement du mobilier).",
      },
      {
        q: "La fiscalité est-elle prise en compte ?",
        a: "La V1 vise d'abord une rentabilité économique (revenus, charges, financement). La fiscalité peut être ajoutée ou estimée séparément selon votre régime (LMNP, réel, micro, etc.).",
      },
      {
        q: "Quels leviers ont le plus d'impact sur la rentabilité ?",
        a: "Le prix d'achat (et les frais), le niveau de loyer/occupation, la vacance, les charges récurrentes, et la structure du financement (taux, durée, apport). Tester 2 scénarios (prudent vs ambitieux) aide à décider.",
      },
      {
        q: "Quel rendement locatif viser en 2026 ?",
        a: "Le rendement brut national moyen est de 5,2 % en 2026. Un rendement brut inférieur à 4 % est difficile à rentabiliser après charges et fiscalité. Entre 5 et 7 % brut, la rentabilité nette est généralement positive avec un financement à taux actuel (3,4 % sur 20 ans). Au-delà de 7 %, vérifier la qualité du secteur et le risque locatif (vacance, impayés).",
      },
      {
        q: "Combien rapporte un studio en location par mois ?",
        a: "Un studio acheté 80 000 € avec 500 €/mois de loyer génère 6 000 €/an, soit un rendement brut de 7,5 %. Après charges (taxe foncière, copropriété, assurance, vacance estimée à 5 %), le rendement net tourne autour de 5 à 6 %. En LMNP au régime réel, l'amortissement peut annuler l'impôt sur ces revenus pendant 10 à 15 ans.",
      },
      {
        q: "Quelle est la différence entre rendement brut, net et net-net ?",
        a: "Le rendement brut = loyers annuels / prix d'achat. Le rendement net retire les charges (taxe foncière, copropriété, assurance, gestion, vacance) — c'est le chiffre affiché par le simulateur sous le nom \"rendement net avant crédit\". Le rendement net-net (ou net d'impôts) retire en plus la fiscalité selon votre régime (micro-BIC, réel, IR sur revenus fonciers), ce que la calculette ne modélise pas dans cette version — à estimer séparément selon votre régime.",
      },
      {
        q: "Quels sont les taux de rendement locatif en France en 2026 ?",
        a: "Le rendement brut médian national est de 5,2 % en 2026. Par ville : Paris ~3,2 % (prix élevés), Lyon ~5,1 %, Bordeaux ~4,8 %, Marseille ~6,2 %, Toulouse ~5,5 %, Lille ~6,1 %, Nantes ~5,2 %. Un rendement brut inférieur à 4 % est difficile à rentabiliser après charges et fiscalité. Au-delà de 7 %, vérifier la qualité locative du secteur.",
      },
      {
        q: "Comment financer un investissement locatif en 2026 ?",
        a: "La majorité des investisseurs locatifs empruntent à 100 % (hors frais de notaire). Les taux en 2026 sont autour de 3,40 % sur 20 ans. La banque regarde le taux d'endettement global (35 % max HCSF), le reste à vivre et la qualité du bien. Les loyers sont pris en compte à hauteur de 70 % pour compenser le risque de vacance. Le simulateur de capacité d'emprunt lokt.fr permet d'estimer le montant finançable selon vos revenus.",
      },
      {
        q: "Paris ou province : où investir dans le locatif en 2026 ?",
        a: "Paris offre un rendement brut faible (~3 %) mais une sécurité locative élevée et une valorisation sur le long terme. En province, les rendements sont plus élevés (5 à 7 % brut) avec un prix d'entrée moindre. Les villes comme Marseille, Lille ou Toulouse affichent de bons rendements avec une demande locative soutenue. Le choix dépend de votre objectif : cash-flow immédiat (province) ou capitalisation (grandes métropoles).",
      },
      {
        q: "Comment estimer la taxe foncière si je ne l'ai pas encore ?",
        a: "À défaut de l'avis du vendeur, comptez en moyenne 10 à 15 % du loyer annuel dans les grandes villes, et jusqu'à 20 % dans certaines communes à taux élevé (une partie de la banlieue parisienne, certaines villes du sud). L'agence ou le notaire peuvent vous communiquer le dernier avis de taxe foncière du bien — c'est le chiffre le plus fiable, à demander systématiquement avant l'offre d'achat.",
      },
      {
        q: "Quel taux de vacance locative retenir dans le calcul ?",
        a: "En location longue durée, 1 mois vide tous les 2-3 ans (soit 3 à 4 % de vacance) est une hypothèse réaliste dans une zone tendue ; comptez plutôt 6 à 8 % dans une zone détendue ou pour un bien atypique. En meublé/saisonnier, le taux d'occupation remplace la vacance : viser 65 à 75 % d'occupation annuelle selon la localisation est une hypothèse prudente, les meilleures zones touristiques pouvant dépasser 80 %.",
      },
      {
        q: "Combien prévoir de frais de notaire dans le coût total ?",
        a: "Dans l'ancien, comptez 7 à 8 % du prix d'achat (droits de mutation + émoluments). Dans le neuf (VEFA), les frais tombent à 2 à 3 %. Ces frais font partie du coût total du projet (prix + notaire + travaux) utilisé pour calculer le rendement — les oublier gonfle artificiellement la rentabilité affichée.",
      },
      {
        q: "Gestion locative déléguée (agence) ou en direct : quel impact sur le rendement ?",
        a: "Une agence facture en général 6 à 10 % TTC des loyers encaissés pour la gestion courante, auxquels s'ajoutent souvent des honoraires de mise en location (équivalant à 1 mois de loyer) à chaque changement de locataire. Sur un loyer de 800 €/mois, ça représente 600 à 950 €/an de charge de gestion — à intégrer dans les charges du simulateur si vous comptez déléguer, sous peine de surestimer le rendement net.",
      },
      {
        q: "Meublé (LMNP) ou nu : quel effet sur le rendement affiché par le simulateur ?",
        a: "Le loyer d'un meublé est généralement 10 à 20 % plus élevé qu'un nu équivalent, ce qui améliore mécaniquement le rendement brut et net calculés par l'outil. La vraie différence se joue ensuite côté fiscalité (non modélisée ici) : le régime LMNP permet d'amortir le bien et le mobilier, ce qui réduit fortement l'impôt sur les loyers pendant 10 à 15 ans — un avantage que le rendement \"net avant crédit\" du simulateur ne reflète pas.",
      },
      {
        q: "Peut-on simuler un achat en SCI avec cette calculette ?",
        a: "Oui pour la partie économique (coût, loyers, charges, financement, cash-flow) : les mécanismes sont identiques qu'on achète en nom propre ou via une SCI. La fiscalité diffère en revanche selon que la SCI est à l'IR (transparente, comme un achat en direct) ou à l'IS (imposition sur les sociétés, avec amortissement du bien) — un point à valider avec un expert-comptable avant de choisir.",
      },
      {
        q: "Combien de temps pour un retour sur investissement locatif ?",
        a: "Il n'y a pas de durée universelle : ça dépend du cash-flow, de l'apport initial et de la revalorisation du bien. En ordre de grandeur, avec un rendement net avant crédit de 5 à 6 % et un financement à 100 %, le point d'équilibre (loyers cumulés = capital investi au départ) se situe souvent entre 15 et 20 ans hors plus-value à la revente. L'apport personnel, s'il existe, raccourcit ce délai proportionnellement.",
      },
      {
        q: "Qu'est-ce qu'un bon cash-flow mensuel pour un investissement locatif ?",
        a: "Un cash-flow positif (même de quelques dizaines d'euros) signifie que le bien s'autofinance intégralement, crédit compris — c'est l'objectif le plus sûr pour un premier investissement. Un cash-flow légèrement négatif (jusqu'à -100/-150 €/mois) reste gérable si votre capacité d'épargne l'absorbe sans tension, en échange d'un effort patrimonial (vous remboursez le capital d'un bien qui s'enrichit). Au-delà de -300 €/mois, vérifiez que le projet a un vrai potentiel de valorisation pour justifier l'effort.",
      },
    ],
    []
  );

  // ✅ mêmes modifs SEO que /capacite et /pret-relais :
  // - JSON-LD enrichi avec SoftwareApplication
  // - Breadcrumb
  // - FAQPage
  const jsonLd = useMemo(() => {
    const webPage = {
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
    };

    const app = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Simulateur de rentabilité locative",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      url: pageUrl,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
      provider: {
        "@type": "Organization",
        name: "lokt.fr",
        url: siteUrl,
        logo: ogImage,
      },
      areaServed: "FR",
    };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Rentabilité locative", item: pageUrl },
      ],
    };

    const faqPage = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqData.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };

    const howTo = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "Comment calculer la rentabilité d'un investissement locatif",
      description: "Étapes pour estimer le rendement, le cash-flow et la rentabilité réelle d'un projet locatif.",
      inLanguage: "fr-FR",
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Calculer le coût total du projet",
          text: "Additionnez le prix d'achat, les frais de notaire (7-8 % dans l'ancien, 2-3 % dans le neuf) et les travaux ou l'ameublement éventuels.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Estimer les revenus locatifs",
          text: "Renseignez le loyer mensuel (location longue durée) ou le revenu équivalent (prix par nuit × taux d'occupation pour le meublé/saisonnier).",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Lister les charges récurrentes",
          text: "Copropriété, taxe foncière, assurance propriétaire non occupant, entretien, gestion locative si déléguée, et vacance locative estimée.",
        },
        {
          "@type": "HowToStep",
          position: 4,
          name: "Renseigner le financement",
          text: "Taux de crédit, durée, apport personnel et assurance emprunteur pour obtenir la mensualité et le cash-flow mensuel net.",
        },
        {
          "@type": "HowToStep",
          position: 5,
          name: "Lire le rendement brut et net avant crédit",
          text: "Le simulateur calcule le rendement brut (loyers / coût total) et le rendement net avant crédit (après charges), ainsi que le cash-flow mensuel réel.",
        },
        {
          "@type": "HowToStep",
          position: 6,
          name: "Comparer plusieurs scénarios",
          text: "Testez un scénario prudent et un scénario optimiste (loyer, vacance, charges) pour identifier les leviers qui améliorent réellement la rentabilité avant de vous engager.",
        },
      ],
    };

    return [webPage, app, breadcrumb, faqPage, howTo];
  }, [description, faqData, ogImage, pageUrl, siteUrl, title]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f9fc]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
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
        <meta property="og:image:alt" content="Calcul de rentabilité locative — lokt.fr" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* ✅ JSON-LD (SAFE) */}
        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1">
        <CalculatorHero
          eyebrow="Calculette rentabilité locative lokt.fr"
          title={isLoggedIn && displayName ? `${displayName}, mesurez la vraie performance de votre projet.` : "Calculer la rentabilité de votre investissement locatif"}
          description="Projetez le coût total, les loyers, les charges et le financement pour comparer rendement et cash-flow avec des hypothèses réalistes."
          links={[
            { href: "/", label: "Accueil" },
            { href: "/capacite", label: "Capacité d'emprunt" },
            { href: "/pret-relais", label: "Prêt relais" },
            { href: "/plus-value-vente-immobiliere", label: "Plus-value immobilière" },
            { href: "/parc-immobilier", label: "Parc immobilier" },
          ]}
        />
        <p className="mx-auto max-w-3xl px-4 pt-4 text-center text-sm leading-6 text-slate-600 sm:pt-6">
          Calculez le rendement brut, net et net-net de votre investissement locatif, le cash-flow mensuel, le coût total et la durée de retour sur investissement — en tenant compte des charges réelles et du financement.
        </p>

        <div className="mx-auto -mt-6 max-w-6xl space-y-5 px-3 pb-8 sm:-mt-8 sm:space-y-6 sm:px-4 sm:pb-12">

          {/* Calculette */}
          <InvestissementWizard />

          {/* ✅ Micro bloc confiance (UX + SEO) */}
          <section data-scroll-reveal data-reveal-delay="0" className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Pourquoi simuler la rentabilité locative avant d&apos;acheter ?
            </h2>
            <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
              <li>Vérifier si le projet s&apos;auto-finance (cash-flow) ou combien il &quot;coûte&quot; chaque mois.</li>
              <li>Comparer plusieurs biens/scénarios à périmètre constant (prix, loyer, vacance, charges).</li>
              <li>Identifier les leviers : prix d&apos;achat, vacance, charges et structure de financement.</li>
            </ul>
          </section>

          {/* Bloc SEO enrichi (comme capacité / pret-relais) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div data-scroll-reveal data-reveal-delay="0">
              <h2 className="text-sm font-semibold text-slate-900">
                Calcul de rentabilité locative : cash-flow, charges et financement
              </h2>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Cette calculette de rentabilité locative vous aide à projeter un investissement en tenant compte du coût
                total (prix + notaire + travaux/ameublement), des revenus (location longue durée ou saisonnière), des
                charges (copropriété, taxe foncière, assurance, entretien, gestion, vacance) et du financement (taux,
                durée, apport, assurance). L&apos;objectif : une lecture simple et comparable entre scénarios.
              </p>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Les résultats sont indicatifs et dépendent de vos hypothèses. Utilisez l&apos;outil pour comparer plusieurs
                biens, tester différents niveaux de loyers/occupation, et repérer ce qui améliore réellement le cash-flow.
              </p>
            </div>

            <div data-scroll-reveal data-reveal-delay="100">
              <h2 className="text-sm font-semibold text-slate-900">Comment estimer une rentabilité réaliste ?</h2>
              <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
                <li>
                  Commencez par le <strong>coût total</strong> (prix + notaire + travaux + ameublement éventuel).
                </li>
                <li>
                  Estimez les <strong>revenus</strong> (loyer mensuel ou revenu équivalent saisonnier : prix/nuit × taux
                  d&apos;occupation).
                </li>
                <li>
                  Ajoutez les <strong>charges récurrentes</strong> (copro, taxe foncière, assurance, entretien, gestion,
                  vacance).
                </li>
                <li>
                  Intégrez le <strong>financement</strong> (taux, durée, apport, assurance) pour obtenir le{" "}
                  <strong>cash-flow</strong>.
                </li>
              </ul>
            </div>

            <div data-scroll-reveal data-reveal-delay="200" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Exemple rapide</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Exemple indicatif : un achat à <strong>200 000 €</strong> avec <strong>25 000 €</strong> de frais/travaux,
                un loyer de <strong>950 €</strong>, des charges totales de <strong>250 €</strong> et un crédit à{" "}
                <strong>850 €</strong> donne un cash-flow proche de{" "}
                <strong>950 − 250 − 850 = −150 € / mois</strong>. En ajustant le prix, le loyer, la vacance ou la durée,
                vous visualisez rapidement les leviers qui font basculer le projet.
              </p>
            </div>

            {/* Mini FAQ visible (UX + SEO) */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Questions fréquentes sur la rentabilité locative</h2>
              <div className="mt-3 grid gap-3">
                {faqData.map((f, i) => (
                  <details key={f.q} data-scroll-reveal data-reveal-delay={i * 70} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between">
                      <span className="pr-4">{f.q}</span>
                      <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
                    </summary>
                    <div className="mt-2 text-sm text-slate-700 leading-relaxed">{f.a}</div>
                  </details>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Note : la fiscalité dépend fortement du régime (LMNP, réel, micro…) et n&apos;est pas l&apos;objectif principal de la
              V1. Ici, on vise d&apos;abord une rentabilité &quot;économique&quot; comparable.
            </p>
          </section>

          {/* ── Rendement locatif par ville ── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7 space-y-4" data-scroll-reveal>
            <h2 className="text-base font-semibold text-slate-900">Rendement locatif brut par ville en 2026</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Le rendement brut médian pour un T2 varie fortement selon la ville. Ces chiffres servent de point de repère
              pour juger si le rendement calculé par le simulateur est cohérent avec le marché local.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Ville</th>
                    <th className="pb-2 font-semibold text-slate-700">Rendement brut médian (T2)</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {[
                    ["Marseille", "6,2 %"],
                    ["Lille", "6,1 %"],
                    ["Grenoble", "6,0 %"],
                    ["Toulouse", "5,5 %"],
                    ["Montpellier", "5,8 %"],
                    ["Strasbourg", "5,7 %"],
                    ["Rennes", "5,4 %"],
                    ["Nantes", "5,2 %"],
                    ["Lyon", "5,1 %"],
                    ["Bordeaux", "4,8 %"],
                    ["Nice", "4,1 %"],
                    ["Paris", "3,2 %"],
                  ].map(([ville, rdt]) => (
                    <tr key={ville} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{ville}</td>
                      <td className="py-2 font-semibold text-indigo-700">{rdt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Rendements bruts médians constatés, hors charges et fiscalité — à utiliser comme ordre de grandeur, pas comme
              garantie pour un bien précis.
            </p>
          </section>

          {/* ── Charges à intégrer ── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7 space-y-4" data-scroll-reveal>
            <h2 className="text-base font-semibold text-slate-900">Charges typiques à intégrer dans le calcul</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Oublier une charge, même modeste, gonfle artificiellement le rendement net affiché. Voici les postes les plus
              souvent sous-estimés, avec des ordres de grandeur pour un bien locatif standard.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Poste</th>
                    <th className="pb-2 font-semibold text-slate-700">Ordre de grandeur</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {[
                    ["Taxe foncière", "10 à 20 % du loyer annuel"],
                    ["Charges de copropriété non récupérables", "5 à 15 % du loyer annuel"],
                    ["Assurance propriétaire non occupant (PNO)", "80 à 200 €/an"],
                    ["Gestion locative déléguée (agence)", "6 à 10 % TTC des loyers encaissés"],
                    ["Vacance locative", "3 à 8 % des loyers annuels"],
                    ["Entretien et petits travaux", "0,5 à 1 % du prix du bien par an"],
                  ].map(([poste, valeur]) => (
                    <tr key={poste} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{poste}</td>
                      <td className="py-2 text-slate-600">{valeur}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Ordres de grandeur indicatifs — variables selon la ville, le type de bien et le mode de gestion choisi.
            </p>
          </section>

          {/* ── Erreurs classiques ── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7 space-y-4" data-scroll-reveal>
            <h2 className="text-base font-semibold text-slate-900">Les erreurs les plus fréquentes à éviter</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Pièges courants</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  {[
                    "Oublier les frais de notaire et les travaux dans le coût total — ça fausse tout le calcul de rendement.",
                    "Raisonner uniquement en rendement brut sans jamais regarder le cash-flow réel après crédit.",
                    "Sous-estimer la vacance locative ou le taux d'occupation en meublé/saisonnier.",
                    "Ignorer la gestion locative (temps ou frais d'agence) dans le calcul des charges.",
                  ].map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Bons réflexes</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  {[
                    "Demander le dernier avis de taxe foncière avant l'offre d'achat, plutôt que l'estimer.",
                    "Tester un scénario prudent (loyer bas, vacance haute) avant de s'engager.",
                    "Comparer le rendement obtenu avec la médiane de la ville pour juger de sa cohérence.",
                    "Vérifier la capacité d'emprunt réelle avant de chiffrer un projet trop ambitieux.",
                  ].map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-indigo-500 shrink-0">→</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {[
                { href: "/capacite", label: "Calculer ma capacité d'emprunt" },
                { href: "/pret-relais", label: "Simuler un prêt relais" },
                { href: "/outil-gestion-locative", label: "Gérer le bien après achat" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-200 hover:bg-indigo-50"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          {/* Teaser → guide investissement */}
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#635bff]/20 bg-[#635bff]/5 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#635bff]">Guide complet</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">Les 5 étapes, les erreurs classiques, deux profils réels</p>
              <p className="mt-0.5 text-xs text-slate-500">Ce que les chiffres ne disent pas sur l&apos;investissement locatif</p>
            </div>
            <Link
              href="/investissement-locatif"
              className="shrink-0 rounded-full border border-[#635bff] px-4 py-2 text-xs font-semibold text-[#635bff] transition hover:bg-[#635bff] hover:text-white"
            >
              Lire le guide →
            </Link>
          </div>

        </div>
      </main>

      {/* Maillage → gestion locative */}
      <div className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-indigo-100 bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Vous avez acheté ?</p>
              <p className="mt-1 text-base font-semibold text-slate-900">Passez à la gestion : loyers, quittances, état des lieux.</p>
              <p className="mt-0.5 text-sm text-slate-500">Pilotez votre investissement locatif depuis lokt.fr — sans agence.</p>
            </div>
            <a
              href="/espace-bailleur"
              className="shrink-0 rounded-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Accéder à l'espace bailleur →
            </a>
          </div>
        </div>
      </div>

      {/* Articles liés — maillage blog */}
      <div className="border-t border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">À lire aussi</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { href: "/blog/investissement-locatif", cat: "Investissement locatif", title: "Rentabilité et cash-flow : la méthode complète 2026" },
              { href: "/blog/lmnp-vs-location-nue", cat: "Investissement locatif", title: "LMNP vs location nue : quelle fiscalité choisir ?" },
              { href: "/blog/cashflow-negatif-garder-ou-vendre", cat: "Investissement locatif", title: "Cash-flow négatif : garder ou vendre ?" },
            ].map((a) => (
              <a key={a.href} href={a.href} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50">
                <span className="text-[0.68rem] font-semibold text-indigo-500">{a.cat}</span>
                <p className="mt-1 text-sm font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">{a.title}</p>
              </a>
            ))}
          </div>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
