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
  const title = "Calcul rentabilité locative gratuit – Cash-flow, rendement, charges | lokt.fr";
  const description =
    "Calculez la rentabilité locative (cash-flow, rendement brut/net, charges, vacance, financement). Comparez location longue durée vs Airbnb avec une lecture claire.";

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

    return [webPage, app, breadcrumb, faqPage];
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
          title={isLoggedIn && displayName ? `${displayName}, mesurez la vraie performance de votre projet.` : "Votre investissement locatif tient-il vraiment la route ?"}
          description="Projetez le coût total, les loyers, les charges et le financement pour comparer rendement et cash-flow avec des hypothèses réalistes."
          links={[
            { href: "/", label: "Accueil" },
            { href: "/capacite", label: "Capacité d'emprunt" },
            { href: "/pret-relais", label: "Prêt relais" },
            { href: "/plus-value-vente-immobiliere", label: "Plus-value immobilière" },
            { href: "/parc-immobilier", label: "Parc immobilier" },
          ]}
        />
        <div className="mx-auto -mt-12 max-w-6xl space-y-5 px-3 pb-8 sm:-mt-16 sm:space-y-6 sm:px-4 sm:pb-12">

          {/* Calculette */}
          <InvestissementWizard showSaveButton={isLoggedIn} />

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

          {/* ── SECTION ÉDITORIALE ── */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            {/* Intro */}
            <div className="border-b border-slate-100 bg-gradient-to-br from-[#635bff]/5 to-[#00b4d8]/5 px-6 py-8 sm:px-8">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#635bff]">Ce que les simulateurs ne montrent pas</p>
              <h2 className="mt-2 text-xl font-bold leading-snug text-slate-950 sm:text-2xl">
                Investir dans l&apos;immobilier locatif :<br className="hidden sm:block" /> la réalité derrière les chiffres
              </h2>
              <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-slate-600">
                Un simulateur calcule le rendement. Il ne dit pas pourquoi 60 % des primo-investisseurs sous-estiment les charges, pourquoi certains revendent à perte après 3 ans — et pourquoi d&apos;autres construisent un patrimoine solide avec un cash-flow légèrement négatif. Voici la réalité du terrain.
              </p>
            </div>

            <div className="space-y-12 px-6 py-8 sm:px-8">

              {/* ── 5 ÉTAPES ── */}
              <div>
                <h3 className="text-base font-bold text-slate-900">Les 5 étapes d&apos;un investissement locatif — et où ça coince vraiment</h3>
                <div className="mt-6 space-y-0">
                  {[
                    {
                      step: "01",
                      title: "Trouver le bien",
                      color: "bg-[#635bff]",
                      body: "C'est l'étape la plus sous-estimée. On visite 10 appartements, on tombe sur le 11e un vendredi soir, et on fait une offre le samedi matin. L'erreur classique : acheter avec ses émotions plutôt qu'avec ses chiffres. Un bien « coup de cœur » dans une rue peu dynamique peut avoir un rendement brut séduisant (8 %) et un cash-flow catastrophique une fois la vacance et les travaux intégrés.",
                      lesson: "Règle : sortez le simulateur avant la visite, pas après. Si les chiffres ne tiennent pas à froid, ils ne tiendront pas à chaud.",
                    },
                    {
                      step: "02",
                      title: "Financer",
                      color: "bg-[#00b4d8]",
                      body: "La banque finance le prix — pas les imprévus. Les primo-investisseurs oublient systématiquement de budgéter : frais de notaire (7-8 % dans l'ancien), travaux de mise aux normes, ameublement si meublé, 3 mois de charges sans locataire pendant la transition. Sur un bien à 180 000 €, le coût total réel dépasse souvent 205 000 €.",
                      lesson: "Règle : le vrai coût d'acquisition = prix + notaire + travaux + ameublement + 3 mois de charges. Entrez ce chiffre dans le simulateur, pas juste le prix.",
                    },
                    {
                      step: "03",
                      title: "Louer",
                      color: "bg-[#00a97b]",
                      body: "Trois semaines de vacance, et la pression monte. On accepte le premier dossier qui se présente. C'est souvent là que les problèmes commencent. Un locataire avec des revenus insuffisants ou un historique de loyers impayés coûte bien plus cher qu'un mois de vacance supplémentaire.",
                      lesson: "Règle : le loyer à 33 % des revenus nets, un garant ou une GLI, un EDL photographié pièce par pièce. Ces 2 heures valent des mois de procédure.",
                    },
                    {
                      step: "04",
                      title: "Gérer",
                      color: "bg-[#f59e0b]",
                      body: "La gestion quotidienne, c'est 1 heure par mois — si on est organisé. La majorité des bailleurs y passent 4 à 5 heures parce qu'ils gèrent dans leur tête : quittances oubliées, révision IRL ratée, loyer non révisé pendant 3 ans. Sur 900 €/mois avec 2 % d'IRL, 3 ans sans révision = 54 € perdus par mois, soit 648 €/an donnés au locataire.",
                      lesson: "Règle : automatisez tout ce qui peut l'être. Quittances, alertes de paiement, révision IRL. Ce que vous ne mesurez pas, vous le perdez.",
                    },
                    {
                      step: "05",
                      title: "Optimiser",
                      color: "bg-[#8b5cf6]",
                      body: "Le régime fiscal choisi à l'achat n'est pas forcément le meilleur 3 ans plus tard. Un bailleur passé du micro-foncier au régime réel après des travaux a économisé 3 200 € d'impôts la première année. Un propriétaire qui a switché en LMNP après un départ de locataire a réduit sa fiscalité à zéro pendant 8 ans. Ces décisions se prennent avec des chiffres — pas à l'instinct.",
                      lesson: "Règle : réévaluez votre régime fiscal tous les 2 ans. Les abattements et amortissements disponibles changent votre cash-flow réel plus que n'importe quel autre levier.",
                    },
                  ].map(({ step, title, color, body, lesson }, i) => (
                    <div key={step} className="relative flex gap-4 pb-8 last:pb-0">
                      {/* Ligne verticale */}
                      {i < 4 && <div className="absolute left-5 top-10 bottom-0 w-px bg-slate-100" />}
                      {/* Numéro */}
                      <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color} text-xs font-bold text-white shadow-sm`}>
                        {step}
                      </div>
                      <div className="pt-1.5">
                        <h4 className="font-semibold text-slate-900">{title}</h4>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-xs leading-relaxed text-slate-700">
                          <span className="font-semibold text-slate-900">À retenir : </span>{lesson}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── DEUX PROFILS ── */}
              <div>
                <h3 className="text-base font-bold text-slate-900">Deux investisseurs, deux trajectoires</h3>
                <p className="mt-2 text-sm text-slate-500">Scénarios fictifs basés sur des situations courantes.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">

                  {/* Profil positif */}
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-base">🏠</div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Thomas, 34 ans · Lyon 7e</p>
                        <p className="text-xs text-slate-500">Studio 28 m² · acheté 145 000 € en 2022</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      <p>Thomas a simulé 4 biens avant de visiter. Il a acheté un studio étudiant près de la fac, loué 680 €/mois. Cash-flow : <strong className="text-emerald-700">−95 €/mois</strong> après crédit et charges.</p>
                      <p>Il aurait pu se décourager. Mais en 3 ans : 14 400 € de capital remboursé, bien valorisé à ~165 000 €. Patrimoine créé : <strong className="text-emerald-700">+34 000 €</strong> pour un effort de 3 420 €.</p>
                      <p>Il gère seul — quittances en 5 min par mois, zéro impayé. Il cherche son deuxième bien.</p>
                    </div>
                    <div className="mt-4 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-800">
                      Ce qui a marché : les chiffres d&apos;abord, le bien ensuite. Et un locataire sélectionné rigoureusement.
                    </div>
                  </div>

                  {/* Profil négatif */}
                  <div className="rounded-2xl border border-red-100 bg-red-50/50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-base">🏚️</div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Julie, 41 ans · Marseille 13e</p>
                        <p className="text-xs text-slate-500">T3 62 m² · acheté 178 000 € en 2021</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      <p>Julie a acheté un T3 « parce que le quartier allait se valoriser ». Elle a loué au premier candidat pour éviter la vacance. Résultat : 4 mois d&apos;impayés, procédure à 8 mois.</p>
                      <p>Elle a délégué à une agence (8 % des loyers) pour ne plus gérer. Cash-flow réel : <strong className="text-red-600">−380 €/mois</strong>. Elle envisage de vendre — mais la plus-value est faible après frais.</p>
                    </div>
                    <div className="mt-4 rounded-xl bg-red-100 px-3 py-2 text-xs font-medium text-red-800">
                      Ce qui a coincé : aucune simulation avant l&apos;achat, sélection du locataire bâclée, gestion réactive plutôt que proactive.
                    </div>
                  </div>
                </div>
              </div>

              {/* ── CE QUE LES CHIFFRES NE MONTRENT PAS ── */}
              <div>
                <h3 className="text-base font-bold text-slate-900">Ce que les chiffres ne diront jamais</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: "😤", label: "Le premier impayé", body: "Même petit (150 €), il crée une anxiété disproportionnée. La plupart des bailleurs apprennent à cette occasion l'importance d'avoir 3 mois de réserve et une procédure de relance prête." },
                    { icon: "✅", label: "La première quittance envoyée", body: "Il y a une vraie satisfaction à envoyer le premier document officiel en tant que propriétaire-bailleur. C'est le moment où l'investissement devient concret, pas juste un chiffre sur un simulateur." },
                    { icon: "📈", label: "L'effet boule de neige", body: "Le deuxième bien est presque toujours plus facile que le premier. Vous connaissez la procédure, les banques vous font davantage confiance, et vous savez ce que vous cherchez vraiment." },
                    { icon: "🧠", label: "La charge mentale de gestion", body: "Gérer seul sans outil dédié crée une charge mentale diffuse — \"est-ce que le loyer est arrivé ?\", \"quand réviser le loyer ?\". Automatiser ces vérifications change radicalement l'expérience." },
                  ].map(({ icon, label, body }) => (
                    <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xl">{icon}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{label}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── LIENS BLOG ── */}
              <div className="border-t border-slate-100 pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pour aller plus loin</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: "Calculer la rentabilité nette réelle", href: "/blog/rentabilite-locative-comment-calculer" },
                    { label: "Cash-flow négatif : garder ou vendre ?", href: "/blog/cashflow-negatif-garder-ou-vendre" },
                    { label: "Investir sans (gros) apport", href: "/blog/investir-sans-apport-immobilier" },
                    { label: "LMNP ou location nue : quelle fiscalité ?", href: "/blog/lmnp-vs-location-nue" },
                    { label: "Loyer impayé : que faire ?", href: "/blog/loyer-impaye-que-faire" },
                    { label: "Gestion locative sans agence", href: "/blog/gestion-locative-sans-agence" },
                  ].map(({ label, href }) => (
                    <Link key={href} href={href} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-700 shadow-sm transition hover:border-[#635bff]/30 hover:text-[#635bff]">
                      {label} →
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </section>

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
      <AppFooter />
    </div>
  );
}
