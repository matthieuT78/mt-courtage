// pages/pret-relais.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import PretRelaisWizard from "../components/PretRelaisWizard";
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

// ✅ JSON-LD SAFE: évite tout crash si un schema est undefined/malformé
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

function FaqItem({ q, a, revealDelay }: { q: string; a: React.ReactNode; revealDelay?: number }) {
  return (
    <details
      className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
      data-scroll-reveal
      data-reveal-delay={revealDelay ?? 0}
    >
      <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between">
        <span className="pr-4">{q}</span>
        <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
      </summary>
      <div className="mt-2 text-sm text-slate-700 leading-relaxed">{a}</div>
    </details>
  );
}

export default function PretRelaisPage() {
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
        console.error("Erreur récupération session (pret-relais)", e);
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

  const displayName = useMemo(() => firstNameFromUser(user), [user]);
  const isLoggedIn = !!user;

  useScrollReveal();

  // --- SEO
  const siteUrl = "https://lokt.fr";
  const pagePath = "/pret-relais";
  const pageUrl = `${siteUrl}${pagePath}`;

  const title = "Simulation Prêt Relais Immobilier — Calculette Gratuite 2026 | lokt.fr";
  const description =
    "Simulation prêt relais gratuite en ligne. Calculez le montant du crédit relais, les intérêts intercalaires et votre budget d'achat avant la vente de votre bien. Prêt relais sec ou adossé, résultat instantané.";

  // OG image (non transparent, OK WhatsApp)
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const faqData = useMemo(
    () => [
      {
        q: "Comment calculer un prêt relais ?",
        a: "Le calcul part généralement de la valeur estimée du bien à vendre. La banque retient une partie de cette valeur, souvent 60 % à 80 %, puis retire le capital restant dû. Le résultat donne un ordre de grandeur du crédit relais mobilisable.",
      },
      {
        q: "Quelle est la formule simple du prêt relais ?",
        a: "Une formule indicative est : valeur du bien à vendre × pourcentage retenu par la banque - capital restant dû. Exemple : 400 000 € × 70 % - 120 000 € = 160 000 € de prêt relais estimé.",
      },
      {
        q: "Quelle différence entre prêt relais et crédit relais ?",
        a: "Dans l’usage courant, prêt relais et crédit relais désignent le même mécanisme : un financement temporaire accordé en attendant la vente du bien actuel.",
      },
      {
        q: "Quels sont les coûts d’un prêt relais ?",
        a: "Le coût dépend du taux, de la durée, des intérêts intercalaires, de l’assurance et des frais de dossier. Plus la vente tarde, plus le coût réel du relais augmente.",
      },
      {
        q: "Combien de temps dure un prêt relais ?",
        a: "La durée est souvent courte, généralement autour de 12 à 24 mois selon les banques et le dossier. L’objectif reste de vendre le bien actuel rapidement pour rembourser le relais.",
      },
      {
        q: "Le simulateur remplace-t-il un accord bancaire ?",
        a: "Non. Le simulateur donne un ordre de grandeur pour préparer votre projet. La banque reste seule décisionnaire sur le montant accordé, le taux, la durée et les conditions exactes.",
      },
      {
        q: "Qu'est-ce qu'un prêt relais sec ?",
        a: "Un prêt relais sec couvre seul l'achat du nouveau bien, sans crédit complémentaire. Il s'applique quand le produit de la vente suffit à financer intégralement le nouveau projet. Pendant la période de relais, vous ne remboursez que les intérêts.",
      },
      {
        q: "Que se passe-t-il si le bien ne se vend pas dans les délais ?",
        a: "La plupart des banques accordent un prêt relais pour 12 à 24 mois maximum. Si la vente tarde, deux options : la banque peut accepter une prorogation (rare), ou le prêt relais doit être transformé en prêt classique — ce qui alourdit les mensualités. Il est donc conseillé d'estimer le bien à sa valeur de vente réelle, légèrement conservatrice.",
      },
      {
        q: "Peut-on obtenir un prêt relais sans crédit en cours ?",
        a: "Oui. Si vous avez fini de rembourser votre crédit ou que vous êtes propriétaire sans emprunt, le calcul est simplifié : la banque retient directement 60 % à 80 % de la valeur estimée du bien à vendre, sans déduire de capital restant dû.",
      },
      {
        q: "Faut-il un compromis de vente pour obtenir un prêt relais ?",
        a: "Non, mais cela aide. Un compromis signé sur le bien à vendre rassure la banque sur la réalité et le délai de la transaction. Sans compromis, la banque appliquera généralement une décote plus importante sur la valeur du bien, par prudence.",
      },
      {
        q: "Comment calculer les intérêts intercalaires d'un prêt relais ?",
        a: "Les intérêts intercalaires correspondent aux intérêts que vous payez chaque mois sur le capital du relais, sans rembourser le capital lui-même. Formule : montant du relais × taux annuel ÷ 12. Exemple : 150 000 € × 4 % ÷ 12 = 500 €/mois. Ces intérêts s'accumulent jusqu'au remboursement total lors de la vente.",
      },
      {
        q: "Prêt relais ou achat-revente : quelle différence ?",
        a: "Le prêt achat-revente (ou prêt relais adossé) est une variante proposée par certaines banques qui regroupe en un seul contrat le relais et le nouveau prêt immobilier. Il simplifie la gestion mais implique une renégociation du crédit global. Le prêt relais classique reste plus courant et plus flexible.",
      },
      {
        q: "Quel taux pour un prêt relais en 2026 ?",
        a: "En 2026, les taux de prêt relais se situent généralement entre 3,5 % et 5 % selon les banques et le profil emprunteur. Ils sont typiquement 0,5 à 1 point au-dessus des taux de prêt classiques, car le risque est plus élevé pour la banque (durée courte, remboursement conditionné à la vente).",
      },
      {
        q: "Peut-on faire une simulation prêt relais en ligne sans engagement ?",
        a: "Oui. Notre simulateur est entièrement gratuit et sans inscription obligatoire. Il vous donne un ordre de grandeur du montant mobilisable, des intérêts indicatifs et de votre budget d'achat. Il ne constitue pas une offre de crédit et n'engage aucune banque.",
      },
      {
        q: "Crédit relais : quelle banque choisir ?",
        a: "Crédit Agricole, LCL, Crédit Mutuel, BNP Paribas et la plupart des grandes banques proposent des prêts relais. Les conditions varient significativement : décote appliquée (60 % à 80 %), taux, durée maximale (12 à 24 mois), franchise possible. Il est recommandé de comparer au moins 3 offres ou de passer par un courtier.",
      },
    ],
    []
  );

  // ✅ mêmes “modifs SEO” que /capacite :
  // - JSON-LD enrichi avec SoftwareApplication (plutôt que Service)
  // - Breadcrumb
  // - Contenu SEO visible : “comment ça marche”, “exemple rapide”
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
      name: "Simulateur de prêt relais",
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
        { "@type": "ListItem", position: 2, name: "Prêt relais", item: pageUrl },
      ],
    };

    const faqPage = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: "fr-FR",
      mainEntity: faqData.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };

    const howTo = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "Calculer un prêt relais immobilier",
      description: "Méthode simple pour estimer un prêt relais avant la vente d'un bien immobilier.",
      inLanguage: "fr-FR",
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Estimer la valeur du bien à vendre",
          text: "Renseignez une valeur réaliste du bien actuel, idéalement avec une estimation prudente.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Déduire le capital restant dû",
          text: "Retirez le capital restant à rembourser sur le crédit immobilier actuel.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Appliquer le pourcentage bancaire",
          text: "Appliquez le pourcentage retenu par la banque, souvent entre 60 % et 80 % de la valeur du bien.",
        },
        {
          "@type": "HowToStep",
          position: 4,
          name: "Comparer avec le nouveau projet",
          text: "Ajoutez le nouveau prêt possible et l'apport pour estimer votre budget d'achat avant la vente.",
        },
      ],
    };

    return [webPage, app, breadcrumb, faqPage, howTo];
  }, [title, description, pageUrl, siteUrl, ogImage, faqData]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f9fc]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={pageUrl} />
        <link rel="alternate" hrefLang="fr-FR" href={pageUrl} />
        <link rel="alternate" hrefLang="x-default" href={pageUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:alt" content="Simulateur de prêt relais — lokt.fr" />

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
          eyebrow="Simulation prêt relais — lokt.fr"
          title={isLoggedIn && displayName ? `${displayName}, simulez votre prêt relais.` : "Simulation prêt relais immobilier gratuite"}
          description="Calculez le montant du crédit relais, les intérêts intercalaires et votre budget d'achat avant la vente du bien actuel. Prêt relais sec ou adossé."
          links={[
            { href: "/", label: "Accueil" },
            { href: "/capacite", label: "Capacité d'emprunt" },
            { href: "/investissement", label: "Rentabilité locative" },
            { href: "/parc-immobilier", label: "Parc immobilier" },
          ]}
        />
        <div className="mx-auto -mt-12 max-w-6xl space-y-5 px-3 pb-8 sm:-mt-16 sm:space-y-6 sm:px-4 sm:pb-12">

          {/* Calculette */}
          <PretRelaisWizard showSaveButton={isLoggedIn} />

          {/* ── Section 1 : définition + formule ── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7 space-y-5">
            <div data-scroll-reveal data-reveal-delay="0">
              <h2 className="text-base font-semibold text-slate-900">
                Qu’est-ce qu’un prêt relais immobilier ?
              </h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Le <strong>prêt relais</strong> (ou crédit relais) est un financement temporaire accordé par une banque pour permettre
                d’acheter un nouveau bien immobilier <em>avant</em> d’avoir vendu l’ancien. Il « fait le pont » entre les deux
                transactions, évitant d’avoir à attendre la vente pour disposer des fonds.
              </p>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                La banque avance une partie de la valeur estimée du bien à vendre — généralement entre 60 % et 80 % — déduction faite
                du capital restant dû s’il existe encore un crédit en cours. Cette avance est remboursée en une seule fois dès que la
                vente est conclue. Pendant la période de relais, vous ne payez généralement que les <strong>intérêts intercalaires</strong>,
                ce qui limite l’effort mensuel à court terme.
              </p>
            </div>

            <div data-scroll-reveal data-reveal-delay="70">
              <h3 className="text-sm font-semibold text-slate-900">La formule de calcul</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Formule indicative : <strong>valeur du bien à vendre × pourcentage retenu − capital restant dû</strong>.
              </p>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold">Exemple concret</p>
                <ul className="mt-2 space-y-1 text-slate-600">
                  <li>Valeur du bien à vendre : <strong>400 000 €</strong></li>
                  <li>Pourcentage retenu par la banque : <strong>70 %</strong> → 280 000 €</li>
                  <li>Capital restant dû : <strong>120 000 €</strong></li>
                  <li className="pt-1 font-semibold text-slate-800">Prêt relais estimé : 280 000 − 120 000 = <strong>160 000 €</strong></li>
                </ul>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3" data-scroll-reveal data-reveal-delay="140">
              {[
                { title: "1. Bien à vendre", text: "Renseignez la valeur estimée, le capital restant dû et le pourcentage retenu par la banque." },
                { title: "2. Nouveau financement", text: "Ajoutez vos revenus, crédits existants, taux, durée et apport pour calculer la capacité restante." },
                { title: "3. Budget d’achat", text: "Comparez le prix cible avec le relais, le nouveau prêt possible et les intérêts indicatifs." },
              ].map((item, i) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500" data-scroll-reveal>
              Chaque banque applique ses propres règles : décote, durée maximale, franchise, assurance et analyse du taux d’endettement. Le résultat du simulateur reste indicatif.
            </p>
          </section>

          {/* ── Section 2 : prêt relais sec vs adossé ── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7 space-y-4" data-scroll-reveal>
            <h2 className="text-base font-semibold text-slate-900">Simulation prêt relais sec ou adossé : quelle différence ?</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Il existe deux grandes formes de crédit relais. Le choix dépend de votre situation : avez-vous besoin d’un financement
              complémentaire pour acheter le nouveau bien, ou le produit de la vente couvre-t-il l’intégralité du prix ?
              Certaines banques proposent également un <strong>prêt achat-revente</strong>, qui regroupe relais et nouveau prêt en un seul contrat.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4">
                <p className="text-sm font-semibold text-indigo-900">Prêt relais sec</p>
                <p className="mt-2 text-sm text-indigo-800 leading-relaxed">
                  Le prêt relais couvre à lui seul l’achat du nouveau bien. Aucun nouveau crédit long terme n’est souscrit en parallèle.
                  Cas typique : la vente du bien actuel suffit largement à financer le suivant.
                </p>
                <p className="mt-2 text-xs text-indigo-700 font-medium">Mensualité : intérêts seuls pendant la période de relais.</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                <p className="text-sm font-semibold text-amber-900">Prêt relais adossé</p>
                <p className="mt-2 text-sm text-amber-800 leading-relaxed">
                  Le crédit relais est combiné avec un nouveau prêt immobilier classique. C’est le cas le plus courant : le produit de
                  la vente ne suffit pas — un financement long terme complète l’opération.
                </p>
                <p className="mt-2 text-xs text-amber-700 font-medium">Mensualité : intérêts du relais + mensualité du nouveau prêt.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Dans les deux cas, le remboursement du capital du relais intervient lors de la vente du bien. Certaines banques proposent
              une <strong>franchise totale</strong> pendant les premiers mois (ni capital ni intérêts), mais les intérêts s’accumulent
              alors et viennent gonfler la somme à rembourser in fine.
            </p>
          </section>

          {/* ── Section 3 : coût réel ── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7 space-y-4" data-scroll-reveal>
            <h2 className="text-base font-semibold text-slate-900">Le coût réel d’un prêt relais</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Le coût d’un crédit relais dépend essentiellement du <strong>taux appliqué</strong>, de la <strong>durée avant la vente</strong>
              et du <strong>montant avancé</strong>. Plus la vente tarde, plus les intérêts s’accumulent.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Montant relais</th>
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Taux</th>
                    <th className="pb-2 pr-4 font-semibold text-slate-700">6 mois</th>
                    <th className="pb-2 font-semibold text-slate-700">12 mois</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {[
                    ["100 000 €", "4,0 %", "~2 000 €", "~4 000 €"],
                    ["160 000 €", "4,0 %", "~3 200 €", "~6 400 €"],
                    ["250 000 €", "4,0 %", "~5 000 €", "~10 000 €"],
                  ].map(([m, t, s, a]) => (
                    <tr key={m} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{m}</td>
                      <td className="py-2 pr-4">{t}</td>
                      <td className="py-2 pr-4">{s}</td>
                      <td className="py-2">{a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Intérêts indicatifs hors assurance et frais de dossier. Taux à titre d’illustration.</p>
            <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
              <p>
                À ces intérêts s’ajoutent en pratique : l’<strong>assurance emprunteur</strong> (souvent 0,2 % à 0,4 % du capital par an),
                les <strong>frais de dossier</strong> (plusieurs centaines d’euros) et parfois des frais de garantie si la banque exige
                une hypothèque sur le bien à vendre.
              </p>
              <p>
                Le coût total reste raisonnable si la vente est rapide (3 à 6 mois). En revanche, si le marché est difficile et que la
                vente s’étire sur 18 à 24 mois, la facture peut rapidement dépasser 10 000 à 15 000 € sur un relais moyen.
              </p>
            </div>
          </section>

          {/* ── Section 4 : conditions et précautions ── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7 space-y-4" data-scroll-reveal>
            <h2 className="text-base font-semibold text-slate-900">Conditions d’obtention et précautions</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Ce que les banques examinent</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  {[
                    "La capacité de remboursement : le taux d’endettement global (relais + nouveau prêt) doit rester supportable.",
                    "La valeur du bien à vendre, souvent vérifiée par une expertise ou estimation immobilière.",
                    "L’état du marché local : une banque sera plus prudente si la vente paraît longue ou incertaine.",
                    "L’existence d’un avant-contrat (compromis) sur le bien à vendre rassure le dossier.",
                  ].map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-indigo-500 shrink-0">→</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Les pièges à éviter</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  {[
                    "Surestimer la valeur du bien à vendre : une décote de 10 % peut compromettre tout l’équilibre financier.",
                    "Sous-estimer la durée de vente : prévoir systématiquement au moins 6 à 9 mois de relais.",
                    "Oublier les frais de double propriété : taxe foncière, charges, assurances des deux biens en parallèle.",
                    "Accepter un taux de relais sans comparer : les écarts entre banques peuvent atteindre 0,5 à 1 point.",
                  ].map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {[
                { href: "/capacite", label: "Calculer ma capacité d’emprunt" },
                { href: "/investissement", label: "Tester la rentabilité du futur bien" },
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

          {/* FAQ */}
          <section id="faq" className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-50 to-white" />
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-slate-600"
                    data-scroll-reveal
                    data-reveal-delay="0"
                  >
                    FAQ
                  </p>
                  <h2
                    className="text-lg sm:text-xl font-semibold text-slate-900 mt-1"
                    data-scroll-reveal
                    data-reveal-delay="100"
                  >
                    Questions fréquentes sur le prêt relais
                  </h2>
                  <p
                    className="text-sm text-slate-600 mt-2 max-w-3xl"
                    data-scroll-reveal
                    data-reveal-delay="200"
                  >
                    Des réponses rapides pour comprendre le relais, le budget total et les hypothèses.
                  </p>
                </div>

                <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-600">
                  lokt.fr
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                {faqData.map((f, i) => (
                  <FaqItem key={f.q} q={f.q} a={<>{f.a}</>} revealDelay={i * 70} />
                ))}
              </div>

              <p className="mt-6 text-xs text-slate-500">
                Une question ? Écrivez-nous à{" "}
                <a className="underline" href="mailto:contact@lokt.fr">
                  contact@lokt.fr
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Maillage → gestion locative */}
      <div className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-indigo-100 bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Après la transition</p>
              <p className="mt-1 text-base font-semibold text-slate-900">Votre nouveau bien mis en location ? Gérez-le depuis lokt.fr.</p>
              <p className="mt-0.5 text-sm text-slate-500">Baux, quittances, suivi des loyers et relances — tout en un seul outil.</p>
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
