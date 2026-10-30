// pages/plus-value-vente-immobiliere.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import PlusValueWizard from "../components/PlusValueWizard";
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

// ✅ JSON-LD SAFE (évite les crashs si un schema est malformé)
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

export default function PlusValueVenteImmobilierePage() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error("Erreur récupération session (plus-value)", e);
      }
    };

    fetchSession();

    const { data: authListener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  useScrollReveal();

  const displayName = useMemo(() => firstNameFromUser(user), [user]);
  const isLoggedIn = !!user;

  // ---- SEO
  const siteUrl = "https://lokt.fr";
  const pagePath = "/plus-value-vente-immobiliere";
  const pageUrl = `${siteUrl}${pagePath}`;

  // ✅ CTR-first
  const title = "Calculateur plus-value immobilière 2026 gratuit | lokt.fr";
  const description =
    "Simulez votre plus-value en 2 minutes : entrez le prix de vente, le prix d'achat et les travaux. lokt.fr calcule le cash net après remboursement du crédit et impôts.";

  // OG image (non transparent)
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const faqData = useMemo(
    () => [
      {
        q: "Pourquoi le CRD (capital restant dû) est obligatoire ?",
        a: "Parce que votre gain réel dépend de ce qu’il reste à rembourser. Sans CRD, on peut calculer une plus-value “théorique”, mais pas le cash net réellement récupéré après remboursement du prêt.",
      },
      {
        q: "Quelle différence entre plus-value et cash net ?",
        a: "La plus-value compare prix de vente et coût d’achat. Le cash net correspond à ce que vous récupérez réellement après remboursement du CRD, frais éventuels (IRA, mainlevée…) et impôt sur la plus-value si applicable.",
      },
      {
        q: "Résidence principale : y a-t-il un impôt sur la plus-value ?",
        a: "En général, la plus-value sur la résidence principale est exonérée. Si ce n’est pas votre résidence principale, une imposition peut s’appliquer selon les règles en vigueur et les abattements.",
      },
      {
        q: "Pourquoi la banque applique parfois des pénalités (IRA) ?",
        a: "En cas de remboursement anticipé, certaines banques appliquent des indemnités (IRA). Leur montant dépend du contrat et des règles applicables (souvent plafonnées).",
      },
      {
        q: "Les travaux peuvent-ils réduire la plus-value imposable ?",
        a: "Selon les cas, certains travaux peuvent être retenus (sous conditions) pour augmenter le coût d’acquisition et réduire la plus-value. Le détail dépend du régime fiscal et des justificatifs.",
      },
      {
        q: "Les abattements pour durée de détention sont-ils pris en compte ?",
        a: "La logique de la calculette est de donner un ordre de grandeur. Les abattements (durée de détention, exonérations) dépendent de votre situation et des règles en vigueur.",
      },
      {
        q: "La calculette tient-elle compte du LMNP ?",
        a: "Oui, elle permet d’ajouter les amortissements LMNP déjà déduits pour obtenir une estimation plus prudente du cash net vendeur. Le montant exact doit être vérifié avec votre liasse ou votre expert-comptable.",
      },
      {
        q: "Combien de temps faut-il détenir un bien pour ne payer aucun impôt sur la plus-value ?",
        a: "Il faut distinguer les deux taxes : l'impôt sur le revenu (IR) est totalement exonéré à partir de 22 ans de détention, les prélèvements sociaux (PS) seulement à partir de 30 ans. Entre 22 et 30 ans, vous ne payez donc plus que les PS, à un taux dégressif.",
      },
      {
        q: "Quel est le taux d'imposition sur une plus-value immobilière en 2026 ?",
        a: "Le taux plein (sans abattement, détention ≤ 5 ans) est de 19 % au titre de l'impôt sur le revenu + 17,2 % de prélèvements sociaux, soit 36,2 % du gain taxable. Une surtaxe additionnelle de 2 à 6 % peut s'ajouter si le gain taxable dépasse 50 000 €.",
      },
      {
        q: "Comment fonctionne l'abattement pour durée de détention, année par année ?",
        a: "Pour l'IR : 0 % jusqu'à la 5e année incluse, puis 6 % par an de la 6e à la 21e année, soit une exonération totale à 22 ans. Pour les prélèvements sociaux : 0 % jusqu'à 5 ans, 1,65 %/an de la 6e à la 21e année, +1,6 % la 22e année, puis 9 %/an de la 23e à la 30e année, pour une exonération totale à 30 ans.",
      },
      {
        q: "Qu'est-ce que la surtaxe sur les plus-values immobilières élevées ?",
        a: "Une taxe additionnelle s'applique sur la part du gain taxable (après abattement IR) qui dépasse 50 000 €, selon un barème progressif de 2 % à 6 % par tranche. Elle ne concerne donc que les plus-values déjà conséquentes après abattement — la calculette l'estime automatiquement si vous activez cette option.",
      },
      {
        q: "Qu'est-ce que le forfait de travaux de 15 % et quand peut-on l'utiliser ?",
        a: "Si vous détenez le bien depuis plus de 5 ans, vous pouvez majorer forfaitairement le prix d'acquisition de 15 % au titre des travaux, sans avoir à produire la moindre facture — même si vous n'avez rien fait faire. C'est souvent plus avantageux que le réel pour des travaux modestes, et ça évite de devoir ressortir d'anciennes factures.",
      },
      {
        q: "Faut-il garder les factures de travaux pour les déduire ?",
        a: "Oui, si vous optez pour le réel plutôt que le forfait de 15 % — par exemple si les travaux ont coûté bien plus que 15 % du prix d'achat. Seuls les travaux de construction, reconstruction, agrandissement ou amélioration réalisés par des professionnels sont éligibles (pas l'entretien courant, ni les travaux que vous avez faits vous-même).",
      },
      {
        q: "Qu'est-ce que le forfait de frais d'acquisition de 7,5 % ?",
        a: "À défaut de connaître le détail des frais de notaire réellement payés à l'achat, vous pouvez les estimer forfaitairement à 7,5 % du prix d'acquisition pour les ajouter au coût d'achat et réduire la plus-value imposable. Si vos frais réels étaient plus élevés (justificatifs à l'appui), le réel peut être plus avantageux.",
      },
      {
        q: "Qu'est-ce que l'IRA et comment est-il plafonné ?",
        a: "L'indemnité de remboursement anticipé (IRA) est la pénalité que la banque peut appliquer quand vous soldez un crédit avant son terme. Elle est plafonnée par la loi au plus petit des deux montants : 3 % du capital restant dû, ou l'équivalent de 6 mois d'intérêts sur ce capital au taux du prêt. La calculette applique ce plafond légal par défaut.",
      },
      {
        q: "Résidence secondaire : comment est-elle imposée à la revente ?",
        a: "Une résidence secondaire est imposée comme un investissement locatif classique : IR + prélèvements sociaux selon la durée de détention, avec les mêmes abattements. Elle ne bénéficie pas de l'exonération totale de la résidence principale, sauf cas particulier (première cession d'une résidence secondaire par un propriétaire qui ne détient pas sa résidence principale, sous conditions strictes de remploi).",
      },
      {
        q: "Le capital restant dû (CRD) réduit-il la plus-value imposable ?",
        a: "Non, c'est une confusion fréquente. Le CRD n'intervient pas dans le calcul fiscal de la plus-value (qui compare uniquement prix de vente et prix d'achat) — il réduit seulement le cash net que vous récupérez après la vente, une fois le prêt soldé. Deux vendeurs avec le même gain mais des CRD différents paient le même impôt, mais repartent avec des montants différents.",
      },
      {
        q: "Le prix net vendeur inclut-il les frais d'agence ?",
        a: "Ça dépend de qui les paie selon le mandat : si les frais d'agence sont \"à la charge acquéreur\", le prix net vendeur correspond au prix affiché. S'ils sont \"à la charge vendeur\", ils viennent en déduction. Vérifiez le mandat de vente ou le compromis — c'est une source d'erreur fréquente dans les simulations de cash net.",
      },
      {
        q: "Un bien détenu en indivision ou en SCI est-il imposé différemment ?",
        a: "En indivision, chaque indivisaire est imposé séparément sur sa quote-part de plus-value, avec ses propres abattements. En SCI à l'IR (la forme la plus courante), le régime est transparent : c'est comme si chaque associé vendait sa part directement, mêmes règles qu'en nom propre. Une SCI à l'IS suit en revanche le régime des plus-values professionnelles, nettement moins favorable (pas d'abattement pour durée de détention) — un point à vérifier avant de vendre.",
      },
    ],
    []
  );

  // ✅ JSON-LD (SAFE) : WebPage + SoftwareApplication + Breadcrumb + FAQPage
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

    const softwareApp = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Calculateur de plus-value immobilière",
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
      inLanguage: "fr-FR",
    };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Plus-value immobilière", item: pageUrl },
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
      name: "Comment calculer sa plus-value immobilière et son cash net vendeur",
      description: "Étapes pour estimer la plus-value imposable, l'impôt dû et le montant réellement récupéré après une vente immobilière.",
      inLanguage: "fr-FR",
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Renseigner le prix de vente et le prix d'achat",
          text: "Indiquez le prix de vente signé (ou envisagé) et le prix d'acquisition initial du bien, point de départ du calcul de la plus-value brute.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Ajouter les frais d'acquisition et les travaux",
          text: "Majorez le prix d'achat des frais de notaire (réel ou forfait 7,5 %) et des travaux éligibles (réel ou forfait 15 % si détention de plus de 5 ans) pour obtenir le coût d'acquisition total.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Appliquer les abattements pour durée de détention",
          text: "La calculette applique automatiquement le barème officiel : abattement IR progressif jusqu'à l'exonération totale à 22 ans, abattement PS jusqu'à l'exonération totale à 30 ans.",
        },
        {
          "@type": "HowToStep",
          position: 4,
          name: "Calculer l'impôt dû",
          text: "19 % d'impôt sur le revenu + 17,2 % de prélèvements sociaux sur le gain taxable après abattement, plus une surtaxe de 2 à 6 % si le gain taxable dépasse 50 000 €.",
        },
        {
          "@type": "HowToStep",
          position: 5,
          name: "Renseigner le capital restant dû",
          text: "Indiquez le CRD de votre crédit en cours et une éventuelle indemnité de remboursement anticipé (IRA) pour passer de la plus-value théorique au cash réellement récupéré.",
        },
        {
          "@type": "HowToStep",
          position: 6,
          name: "Lire le cash net vendeur",
          text: "Le résultat final (prix net vendeur − CRD − frais − impôt) indique le montant disponible pour financer votre projet suivant.",
        },
      ],
    };

    return [webPage, softwareApp, breadcrumb, faqPage, howTo];
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
        <meta property="og:image:alt" content="Calcul plus-value immobilière — lokt.fr" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* ✅ JSON-LD SAFE */}
        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1">
        <CalculatorHero
          eyebrow="Calculette plus-value immobilière lokt.fr"
          title={isLoggedIn && displayName ? `${displayName}, estimez ce qu'il vous restera vraiment après la vente.` : "Calculer votre plus-value immobilière après vente"}
          description="Calculez votre cash net vendeur après remboursement du crédit, frais éventuels et fiscalité, au-delà de la seule plus-value théorique."
          links={[
            { href: "/", label: "Accueil" },
            { href: "/capacite", label: "Capacité d'emprunt" },
            { href: "/pret-relais", label: "Prêt relais" },
            { href: "/investissement", label: "Rentabilité locative" },
            { href: "/parc-immobilier", label: "Parc immobilier" },
          ]}
        />
        <div className="mx-auto -mt-12 max-w-6xl space-y-5 px-3 pb-8 sm:-mt-16 sm:space-y-6 sm:px-4 sm:pb-12">

          {/* Calculette */}
          <PlusValueWizard />

          {/* ✅ Micro bloc confiance (UX + SEO) */}
          <section data-scroll-reveal data-reveal-delay="0" className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900">Pourquoi simuler avant de vendre ?</h2>
            <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
              <li>Connaître le <strong>cash net</strong> réellement récupéré (et pas seulement la plus-value).</li>
              <li>Comparer plusieurs prix de vente (prudent vs optimiste) et mesurer l’impact sur votre projet suivant.</li>
              <li>Anticiper l’effet du <strong>CRD</strong>, des frais et d’une éventuelle imposition.</li>
            </ul>
          </section>

          {/* Bloc SEO enrichi */}
          <section data-scroll-reveal data-reveal-delay="100" className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Calcul plus-value immobilière : ce qui compte vraiment</h2>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Cette calculette de plus-value immobilière vise surtout le <strong>cash net après vente</strong> :
                prix net vendeur, coût d’acquisition (frais de notaire, travaux), remboursement du prêt (CRD) et frais
                éventuels. C’est ce montant qui détermine ce que vous récupérez réellement pour financer la suite
                (achat, investissement, apport…).
              </p>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Les résultats sont indicatifs : ils dépendent du prix signé, des conditions bancaires (IRA, intérêts,
                frais) et du régime fiscal (résidence principale, durée de détention, exonérations). Utilisez l’outil
                pour comparer des scénarios et vous donner un ordre de grandeur fiable.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Comment fonctionne le calcul (simplifié) ?</h2>
              <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
                <li>
                  <strong>Prix net vendeur</strong> : prix de vente – frais d’agence éventuels (selon cas).
                </li>
                <li>
                  <strong>Plus-value</strong> : prix de vente – (prix d’achat + notaire + travaux éligibles).
                </li>
                <li>
                  <strong>Cash net</strong> : prix net vendeur – <strong>CRD</strong> – frais (IRA, mainlevée…) – impôt éventuel.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Exemple rapide</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Exemple indicatif : vente <strong>350 000 €</strong>, coût d’achat (notaire + travaux inclus){" "}
                <strong>280 000 €</strong>, CRD <strong>140 000 €</strong>. Avant impôt/frais éventuels, le cash net
                se rapproche de <strong>350 000 − 140 000 = 210 000 €</strong>, puis on ajuste avec frais et fiscalité
                selon votre situation.
              </p>
            </div>

            {/* FAQ visible */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Questions fréquentes sur la plus-value immobilière</h2>
              <div className="mt-3 grid gap-3">
                {faqData.map((f) => (
                  <details key={f.q} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
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
              Note : calculs indicatifs. Les règles fiscales et les conditions bancaires varient selon votre situation.
            </p>
          </section>

          {/* ── Barème des abattements pour durée de détention ── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7 space-y-4" data-scroll-reveal>
            <h2 className="text-base font-semibold text-slate-900">Barème des abattements pour durée de détention</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              L'impôt sur le revenu (IR) et les prélèvements sociaux (PS) suivent deux calendriers d'abattement différents
              — c'est l'une des sources d'erreur les plus fréquentes dans les estimations faites à la main.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Durée de détention</th>
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Abattement IR (19 %)</th>
                    <th className="pb-2 font-semibold text-slate-700">Abattement PS (17,2 %)</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {[
                    ["0 à 5 ans", "0 %", "0 %"],
                    ["10 ans", "30 %", "8,25 %"],
                    ["15 ans", "60 %", "16,5 %"],
                    ["20 ans", "90 %", "24,75 %"],
                    ["22 ans", "100 % (exonération totale)", "28 %"],
                    ["25 ans", "100 %", "55 %"],
                    ["30 ans et +", "100 %", "100 % (exonération totale)"],
                  ].map(([duree, ir, ps]) => (
                    <tr key={duree} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{duree}</td>
                      <td className="py-2 pr-4 font-semibold text-indigo-700">{ir}</td>
                      <td className="py-2 text-slate-600">{ps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Barème officiel 2026. L'exonération IR arrive 8 ans avant l'exonération PS — entre 22 et 30 ans de détention,
              seuls les prélèvements sociaux restent dus, à un taux résiduel dégressif.
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
                    "Confondre plus-value imposable et cash net : le CRD réduit ce que vous touchez, pas l'impôt dû.",
                    "Appliquer le même abattement à l'IR et aux PS — les deux calendriers sont différents.",
                    "Oublier le forfait de 7,5 % (frais d'acquisition) ou 15 % (travaux) quand les justificatifs réels manquent.",
                    "Négliger le plafond légal de l'IRA en cas de remboursement anticipé du crédit.",
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
                    "Vérifier si le bien est votre résidence principale : l'exonération totale change tout le calcul.",
                    "Rassembler les factures de travaux avant de choisir entre le réel et le forfait de 15 %.",
                    "Demander le décompte de CRD à jour auprès de la banque, pas une estimation approximative.",
                    "Comparer plusieurs dates de vente si vous approchez d'un seuil d'abattement (22 ou 30 ans).",
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
                { href: "/investissement", label: "Simuler la rentabilité locative" },
                { href: "/pret-relais", label: "Simuler un prêt relais" },
                { href: "/capacite", label: "Calculer ma capacité d'emprunt" },
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
        </div>
      </main>

      {/* Maillage → gestion locative */}
      <div className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-indigo-100 bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Vous gardez le bien ?</p>
              <p className="mt-1 text-base font-semibold text-slate-900">Avant de revendre, pensez à le mettre en location.</p>
              <p className="mt-0.5 text-sm text-slate-500">Simulez la rentabilité locative, puis gérez vos loyers depuis lokt.fr.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/investissement"
                className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                Simuler la rentabilité →
              </a>
              <a
                href="/espace-bailleur"
                className="shrink-0 rounded-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                Espace bailleur →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Articles liés — maillage blog */}
      <div className="border-t border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">À lire aussi</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { href: "/blog/plus-value-residence-principale", cat: "Plus-value immobilière", title: "Plus-value résidence principale : exonération et cas particuliers" },
              { href: "/blog/calcul-plus-value-immobiliere-2026", cat: "Plus-value immobilière", title: "Calcul plus-value immobilière 2026 : méthode et abattements" },
              { href: "/blog/deficit-foncier-reduire-impots", cat: "Investissement locatif", title: "Déficit foncier : comment réduire ses impôts légalement" },
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
