import Head from "next/head";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/investissement-locatif`;
const metaTitle = "Investissement locatif 2026 : guide complet, rentabilité et erreurs à éviter | lokt.fr";
const metaDesc = "Tout ce qu'il faut savoir avant d'investir dans l'immobilier locatif en 2026 : les 5 étapes, les erreurs classiques, deux profils réels, et comment calculer la vraie rentabilité.";

const faq = [
  {
    q: "Quel rendement attendre d'un investissement locatif en 2026 ?",
    a: "Le rendement brut moyen tourne entre 3,5 % et 7 % selon les villes. Paris et Lyon sont autour de 3-4 % brut, les villes moyennes dynamiques (Rennes, Angers, Clermont) entre 5 et 7 %. Le rendement net — après charges, taxe foncière, vacance et fiscalité — est souvent 1,5 à 2 points en dessous du brut. C'est ce chiffre qui compte vraiment.",
  },
  {
    q: "Faut-il un apport pour investir dans l'immobilier locatif ?",
    a: "Non, pas nécessairement. Certains profils solides (CDI ancienneté, taux d'endettement faible) obtiennent des financements à 100 % voire 110 %. En pratique, les banques demandent souvent 10 % minimum pour couvrir les frais de notaire. Plus l'apport est faible, plus l'effet de levier est fort — et plus le rendement sur fonds propres est élevé.",
  },
  {
    q: "Vaut-il mieux investir en LMNP ou en location nue ?",
    a: "Le LMNP au régime réel est presque toujours plus avantageux fiscalement : vous amortissez le bien sur 25-30 ans, ce qui réduit vos revenus imposables à zéro pendant 10 à 15 ans. La location nue est pertinente si vous avez de gros travaux à déduire en déficit foncier dès les premières années. Les deux régimes peuvent coexister dans un même patrimoine.",
  },
  {
    q: "Cash-flow négatif : faut-il éviter ces investissements ?",
    a: "Pas forcément. Un cash-flow légèrement négatif dans une ville dynamique (Paris, Lyon, Bordeaux) peut être justifié par une forte plus-value potentielle et un capital remboursé chaque mois. Ce qui compte, c'est le bilan patrimonial global : effort mensuel + capital remboursé + plus-value latente. Certains investissements à -200 €/mois créent 30 000 € de patrimoine en 5 ans.",
  },
  {
    q: "Combien de temps faut-il pour gérer un bien locatif soi-même ?",
    a: "Environ 1 heure par mois pour un bien en bonne marche : quittance, vérification du virement, suivi des charges. En cas de changement de locataire, comptez 5 à 10 heures supplémentaires. Avec un outil comme lokt.fr, le temps de gestion mensuel tombe à 15-20 minutes — quittances automatiques, alertes de paiement et révision IRL incluses.",
  },
  {
    q: "Quelle ville choisir pour un premier investissement locatif ?",
    a: "Privilégiez une ville que vous connaissez bien (vous pouvez gérer les visites et les interventions), avec une demande locative soutenue (université, bassin d'emploi dynamique) et un prix au m² qui permet un rendement net d'au moins 4 %. Les villes moyennes en croissance (Angers, Rennes, Montpellier, Toulouse) offrent souvent un meilleur équilibre rendement/risque que les grandes métropoles saturées.",
  },
  {
    q: "Peut-on investir dans l'immobilier locatif sans expérience ?",
    a: "Oui — à condition de s'outiller correctement. Les erreurs classiques des primo-investisseurs (surestimer le loyer, sous-estimer les charges, bâcler la sélection du locataire) sont toutes évitables avec de la méthode. Simulez avant de visiter, sélectionnez rigoureusement, automatisez la gestion. La plupart des investisseurs qui échouent n'ont pas manqué de chance — ils n'avaient pas les bons chiffres au départ.",
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
    dateModified: "2026-06-26",
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Investissement locatif", item: pageUrl },
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

const steps = [
  {
    step: "01",
    title: "Trouver le bien",
    color: "bg-[#635bff]",
    body: "C'est l'étape la plus sous-estimée. On visite 10 appartements, on tombe sur le 11e un vendredi soir, et on fait une offre le samedi matin. L'erreur classique : acheter avec ses émotions plutôt qu'avec ses chiffres. Un bien « coup de cœur » dans une rue peu dynamique peut avoir un rendement brut séduisant (8 %) et un cash-flow catastrophique une fois la vacance et les travaux intégrés.",
    lesson: "Sortez le simulateur avant la visite, pas après. Si les chiffres ne tiennent pas à froid, ils ne tiendront pas à chaud.",
  },
  {
    step: "02",
    title: "Financer",
    color: "bg-[#00b4d8]",
    body: "La banque finance le prix — pas les imprévus. Les primo-investisseurs oublient systématiquement de budgéter : frais de notaire (7-8 % dans l'ancien), travaux de mise aux normes, ameublement si meublé, 3 mois de charges sans locataire pendant la transition. Sur un bien à 180 000 €, le coût total réel dépasse souvent 205 000 €.",
    lesson: "Le vrai coût d'acquisition = prix + notaire + travaux + ameublement + 3 mois de charges. Entrez ce chiffre dans le simulateur, pas juste le prix d'achat.",
  },
  {
    step: "03",
    title: "Louer",
    color: "bg-[#00a97b]",
    body: "Trois semaines de vacance, et la pression monte. On accepte le premier dossier qui se présente. C'est souvent là que les problèmes commencent. Un locataire avec des revenus insuffisants ou un historique de loyers impayés coûte bien plus cher qu'un mois de vacance supplémentaire.",
    lesson: "Le loyer à 33 % des revenus nets, un garant ou une GLI, un état des lieux photographié pièce par pièce. Ces 2 heures valent des mois de procédure.",
  },
  {
    step: "04",
    title: "Gérer",
    color: "bg-[#f59e0b]",
    body: "La gestion quotidienne, c'est 1 heure par mois — si on est organisé. La majorité des bailleurs y passent 4 à 5 heures parce qu'ils gèrent dans leur tête : quittances oubliées, révision IRL ratée, loyer non révisé pendant 3 ans. Sur 900 €/mois avec 2 % d'IRL, 3 ans sans révision = 54 € perdus par mois, soit 648 €/an donnés au locataire.",
    lesson: "Automatisez tout ce qui peut l'être. Quittances, alertes de paiement, révision IRL. Ce que vous ne mesurez pas, vous le perdez.",
  },
  {
    step: "05",
    title: "Optimiser",
    color: "bg-[#8b5cf6]",
    body: "Le régime fiscal choisi à l'achat n'est pas forcément le meilleur 3 ans plus tard. Un bailleur passé du micro-foncier au régime réel après des travaux a économisé 3 200 € d'impôts la première année. Un propriétaire qui a switché en LMNP après un départ de locataire a réduit sa fiscalité à zéro pendant 8 ans.",
    lesson: "Réévaluez votre régime fiscal tous les 2 ans. Les amortissements disponibles changent votre cash-flow réel plus que n'importe quel autre levier.",
  },
];

export default function InvestissementLocatifPage() {
  return (
    <div className="min-h-screen bg-[#f7f7fb]">
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        {schemas.map((s, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
        ))}
      </Head>

      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <nav className="mb-6 text-xs text-slate-500" aria-label="Fil d'Ariane">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link href="/" className="hover:text-slate-700">Accueil</Link></li>
            <li aria-hidden="true">›</li>
            <li className="text-slate-700">Investissement locatif</li>
          </ol>
        </nav>

        {/* Hero */}
        <header className="mb-12">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#635bff]">Guide complet 2026</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
            Investissement locatif :<br className="hidden sm:block" /> ce que les chiffres ne disent pas
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            Le simulateur calcule le rendement. Il ne dit pas pourquoi certains investisseurs bâtissent un patrimoine solide avec un cash-flow négatif — et pourquoi d&apos;autres revendent à perte après 3 ans malgré un rendement brut &quot;correct&quot;. Ce guide couvre les deux.
          </p>
          {/* CTA simulateur */}
          <div className="mt-6">
            <Link
              href="/investissement"
              className="inline-flex items-center gap-2 rounded-full bg-[#635bff] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#635bff]/25 transition hover:bg-[#4f46e5]"
            >
              Calculer la rentabilité de mon projet →
            </Link>
          </div>
        </header>

        {/* Bloc chiffres clés */}
        <section className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { value: "3,5 – 7 %", label: "Rendement brut typique selon les villes" },
            { value: "10 %", label: "Apport minimum demandé par les banques" },
            { value: "1 h/mois", label: "Temps de gestion avec un outil dédié" },
            { value: "−1,5 pt", label: "Écart rendement brut → net en moyenne" },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
              <p className="text-xl font-bold text-[#635bff]">{value}</p>
              <p className="mt-1 text-[0.72rem] leading-snug text-slate-500">{label}</p>
            </div>
          ))}
        </section>

        {/* Les 5 étapes */}
        <section className="mb-14 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-br from-[#635bff]/5 to-[#00b4d8]/5 px-6 py-7 sm:px-8">
            <h2 className="text-xl font-bold text-slate-950">Les 5 étapes d&apos;un investissement locatif — et où ça coince vraiment</h2>
            <p className="mt-2 text-sm text-slate-500">Les erreurs ne viennent pas du marché. Elles viennent de décisions prises sans les bons chiffres.</p>
          </div>
          <div className="space-y-0 px-6 py-8 sm:px-8">
            {steps.map(({ step, title, color, body, lesson }, i) => (
              <div key={step} className="relative flex gap-5 pb-8 last:pb-0">
                {i < steps.length - 1 && <div className="absolute left-5 top-10 bottom-0 w-px bg-slate-100" />}
                <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color} text-xs font-bold text-white shadow-sm`}>
                  {step}
                </div>
                <div className="pt-1.5 min-w-0">
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-xs leading-relaxed text-slate-700">
                    <span className="font-semibold text-slate-900">À retenir : </span>{lesson}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA simulateur mid-page */}
        <section className="mb-14 rounded-3xl border border-[#635bff]/20 bg-[#635bff]/5 px-6 py-7 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#635bff]">Passez à la pratique</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">Votre projet tient-il vraiment la route ?</h2>
          <p className="mt-2 text-sm text-slate-600">Entrez prix, loyer, charges et financement — le simulateur calcule le rendement brut, net et le cash-flow mensuel en temps réel.</p>
          <Link
            href="/investissement"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#635bff] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4f46e5]"
          >
            Lancer le simulateur gratuit →
          </Link>
        </section>

        {/* Deux profils */}
        <section className="mb-14">
          <h2 className="mb-2 text-xl font-bold text-slate-950">Deux investisseurs, deux trajectoires</h2>
          <p className="mb-6 text-sm text-slate-500">Scénarios fictifs basés sur des situations courantes.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
              <div className="border-b border-emerald-50 bg-emerald-50/60 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg">🏠</div>
                  <div>
                    <p className="font-bold text-slate-900">Thomas, 34 ans · Lyon 7e</p>
                    <p className="text-xs text-slate-500">Studio 28 m² · acheté 145 000 € en 2022</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-5 text-sm text-slate-700">
                <p>Thomas a simulé 4 biens avant de visiter. Il a acheté un studio étudiant près de la fac, loué 680 €/mois. Cash-flow : <strong className="text-emerald-700">−95 €/mois</strong> après crédit et charges.</p>
                <p>Il aurait pu se décourager. Mais en 3 ans : 14 400 € de capital remboursé, bien valorisé à ~165 000 €. Patrimoine créé : <strong className="text-emerald-700">+34 000 €</strong> pour un effort de 3 420 €.</p>
                <p>Il gère seul — quittances en 5 min par mois, zéro impayé. Il cherche son deuxième bien.</p>
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
                  Ce qui a marché : les chiffres d&apos;abord, le bien ensuite. Et un locataire sélectionné rigoureusement.
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
              <div className="border-b border-red-50 bg-red-50/60 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-lg">🏚️</div>
                  <div>
                    <p className="font-bold text-slate-900">Julie, 41 ans · Marseille 13e</p>
                    <p className="text-xs text-slate-500">T3 62 m² · acheté 178 000 € en 2021</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-5 text-sm text-slate-700">
                <p>Julie a acheté un T3 « parce que le quartier allait se valoriser ». Elle a loué au premier candidat pour éviter la vacance. Résultat : 4 mois d&apos;impayés, procédure à 8 mois.</p>
                <p>Elle a délégué à une agence (8 % des loyers) pour ne plus gérer. Cash-flow réel : <strong className="text-red-600">−380 €/mois</strong>. Elle envisage de vendre — mais la plus-value est faible après frais.</p>
                <div className="rounded-xl bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
                  Ce qui a coincé : aucune simulation avant achat, sélection du locataire bâclée, gestion réactive.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ce que les chiffres ne montrent pas */}
        <section className="mb-14">
          <h2 className="mb-6 text-xl font-bold text-slate-950">Ce que les chiffres ne diront jamais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: "😤", label: "Le premier impayé", body: "Même petit (150 €), il crée une anxiété disproportionnée. La plupart des bailleurs apprennent à cette occasion l'importance d'avoir 3 mois de réserve et une procédure de relance prête." },
              { icon: "✅", label: "La première quittance envoyée", body: "Il y a une vraie satisfaction à envoyer le premier document officiel en tant que propriétaire-bailleur. C'est le moment où l'investissement devient concret, pas juste un chiffre sur un simulateur." },
              { icon: "📈", label: "L'effet boule de neige", body: "Le deuxième bien est presque toujours plus facile que le premier. Les banques vous font davantage confiance, vous savez ce que vous cherchez, et la gestion est déjà rodée." },
              { icon: "🧠", label: "La charge mentale", body: "Gérer sans outil crée une charge diffuse — \"est-ce que le loyer est arrivé ?\", \"quand réviser le loyer ?\". Automatiser ces vérifications change radicalement l'expérience quotidienne." },
            ].map(({ icon, label, body }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-2xl">{icon}</p>
                <p className="mt-3 font-semibold text-slate-900">{label}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="mb-6 text-xl font-bold text-slate-950">Questions fréquentes</h2>
          <div className="space-y-3">
            {faq.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm open:border-[#635bff]/30">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 group-open:text-[#635bff]">
                  {q}
                </summary>
                <p className="mt-3 text-[0.85rem] leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="mb-14 rounded-3xl bg-slate-950 px-8 py-10 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Simulateur gratuit</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Calculez la rentabilité de votre projet</h2>
          <p className="mt-3 text-[0.9rem] text-white/60">
            Rendement brut, net, cash-flow mensuel, capital remboursé — en 2 minutes avec vos vrais chiffres.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/investissement" className="rounded-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90">
              Lancer le simulateur →
            </Link>
            <Link href="/espace-bailleur" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/70 transition hover:border-white/40 hover:text-white">
              Gérer mon bien avec lokt
            </Link>
          </div>
        </section>

        {/* Maillage interne */}
        <section>
          <h2 className="mb-5 text-base font-bold text-slate-950">Articles liés</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Calculer la rentabilité nette réelle", href: "/blog/investissement-locatif" },
              { label: "Cash-flow négatif : garder ou vendre ?", href: "/blog/cashflow-negatif-garder-ou-vendre" },
              { label: "Investir sans (gros) apport", href: "/blog/investir-sans-apport-immobilier" },
              { label: "LMNP ou location nue : quelle fiscalité ?", href: "/blog/lmnp-vs-location-nue" },
              { label: "Loyer impayé : que faire ?", href: "/blog/loyer-impaye-que-faire" },
              { label: "Gestion locative sans agence", href: "/blog/gestion-locative-sans-agence" },
            ].map(({ label, href }) => (
              <Link key={href} href={href} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[#635bff]/30 hover:text-[#635bff]">
                {label} →
              </Link>
            ))}
          </div>
        </section>

      </main>

      <AppFooter />
    </div>
  );
}
