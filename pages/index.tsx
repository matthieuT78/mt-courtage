// pages/index.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

function firstNameFromUser(user: SimpleUser | null) {
  const raw = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "");
  const first =
    String(raw || "")
      .trim()
      .split(/\s+/)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
      {children}
    </span>
  );
}

function AbstractHeroArt() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="absolute -bottom-36 -left-36 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="absolute top-10 left-12 h-3 w-3 rounded-full bg-cyan-500/40" />
      <div className="absolute bottom-12 left-24 h-2 w-2 rounded-full bg-emerald-500/30" />
    </div>
  );
}

function ToolCard({
  title,
  desc,
  href,
  highlight = false,
  badge,
}: {
  title: string;
  desc: string;
  href: string;
  highlight?: boolean;
  badge?: string;
}) {
  const base =
    "h-full rounded-3xl border p-5 transition flex flex-col " +
    (highlight
      ? "border-slate-200 bg-white shadow-sm hover:shadow-md"
      : "border-slate-200 bg-slate-50 hover:bg-white hover:shadow-md");

  const content = (
    <div className={base}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {badge ? (
            <p className="mt-1 text-[0.7rem] uppercase tracking-[0.18em] text-indigo-700">{badge}</p>
          ) : null}
        </div>

        <span
          className={
            "shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[0.65rem] font-semibold border " +
            (highlight
              ? "bg-indigo-50 text-indigo-800 border-indigo-200"
              : "bg-white text-slate-700 border-slate-200")
          }
        >
          Calculette
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-600">{desc}</p>

      <div className="mt-auto pt-4">
        <p className="text-xs font-semibold underline decoration-slate-300 text-slate-900">Ouvrir →</p>
      </div>
    </div>
  );

  return (
    <Link href={href} className="block h-full" aria-label={`Ouvrir ${title}`}>
      {content}
    </Link>
  );
}

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between">
        <span className="pr-4">{q}</span>
        <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
      </summary>
      <div className="mt-2 text-sm text-slate-700 leading-relaxed">{a}</div>
    </details>
  );
}

export default function Home() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted) return;
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error("Erreur récupération session (home)", e);
      }
    };

    fetchSession();

    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const isLoggedIn = !!user;
  const displayName = useMemo(() => firstNameFromUser(user), [user]);

  const brandGrad = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandGradSoft = "bg-gradient-to-r from-indigo-50 to-cyan-50";

  // SEO
  const siteUrl = "https://lokt.fr";
  const pageUrl = `${siteUrl}/`;

  const title =
    "Simulateurs immobiliers — capacité d’emprunt, prêt relais, rentabilité & parc immobilier | lokt.fr";
  const description =
    "Simulateurs immobiliers gratuits : capacité d’emprunt, budget avec prêt relais, rentabilité locative (cash-flow) et analyse de parc immobilier. Une lecture claire pour comparer vos scénarios.";

  // OG IMAGE (doit exister dans /public)
	const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const faqData = useMemo(
    () => [
      {
        q: "Les résultats sont-ils fiables ?",
        a: "Les calculs sont indicatifs : ils dépendent de vos hypothèses (loyers, charges, vacance, travaux, financement). lokt.fr aide à comparer des scénarios et à structurer une analyse, mais ne remplace pas un conseil professionnel.",
      },
      {
        q: "Est-ce que lokt.fr est gratuit ?",
        a: "La V1 met à disposition des calculettes gratuites. Certaines fonctions (comme l’espace bailleur) sont en préparation : l’objectif actuel est de proposer un socle simple, rapide et utile.",
      },
      {
        q: "Par où commencer si je débute ?",
        a: "Si vous achetez votre résidence principale, commencez par la capacité d’emprunt. Si vous achetez avant de vendre, utilisez le prêt relais. Pour un achat locatif, partez sur la rentabilité locative. Si vous avez déjà plusieurs biens, utilisez le parc immobilier pour consolider.",
      },
      {
        q: "Quelles hypothèses de crédit utilisez-vous ?",
        a: "Les mensualités sont calculées selon une méthode standard (taux annuel / 12, durée en mois). Selon la calculette, l’assurance emprunteur peut être estimée de façon simplifiée afin d’obtenir un ordre de grandeur.",
      },
      {
        q: "La fiscalité est-elle prise en compte ?",
        a: "Pas encore sur la V1 (ou de façon volontairement simplifiée selon l’outil). L’objectif est d’abord de fiabiliser la rentabilité “économique” (loyers, charges, financement). La fiscalité pourra être ajoutée progressivement.",
      },
      {
        q: "Location longue durée vs saisonnière : comment comparez-vous ?",
        a: "Pour la saisonnière, les revenus sont convertis en équivalent mensuel à partir d’un prix par nuit et d’un taux d’occupation. C’est utile pour comparer des scénarios, mais la saisonnière peut varier selon la saison et le marché local.",
      },
      {
        q: "Que faites-vous de mes données ?",
        a: "Les données saisies peuvent être stockées uniquement pour améliorer le site et restituer des analyses. Vous pouvez demander la suppression de vos données à tout moment en écrivant à contact@lokt.fr.",
      },
      {
        q: "Est-ce que lokt.fr revend mes données ?",
        a: "Non. Les données ne sont pas revendues à des tiers.",
      },
      {
        q: "Dois-je créer un compte ?",
        a: "Non pour la V1 : vous pouvez utiliser les calculettes librement. Certaines fonctions à venir pourront nécessiter un compte.",
      },
      {
        q: "Comment vous contacter ?",
        a: "Par email : contact@lokt.fr.",
      },
    ],
    []
  );

  const jsonLd = useMemo(() => {
    const webSite = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "lokt.fr",
      url: siteUrl,
    };

    const organization = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "lokt.fr",
      url: siteUrl,
      logo: ogImage,
      email: "contact@lokt.fr",
    };

    const faqPage = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqData.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.a,
        },
      })),
    };

    return [webSite, organization, faqPage];
  }, [faqData, ogImage, siteUrl]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
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
        <meta property="og:image:alt" content="lokt.fr — simulateurs immobiliers" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* JSON-LD (SAFE) */}
        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* =========================================================
              1) HERO — 4 calculettes
          ========================================================== */}
          <section className="relative rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${brandGrad}`} />
            <div className="relative p-7 sm:p-10">
              <AbstractHeroArt />

              <div className="relative space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>Capacité d’emprunt</Pill>
                  <Pill>Prêt relais</Pill>
                  <Pill>Rentabilité locative</Pill>
                  <Pill>Parc immobilier</Pill>
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 leading-tight">
                    {isLoggedIn && displayName ? (
                      <>
                        Bonjour {displayName}.<br />
                        Lancez vos simulations immobilières avec lokt.fr
                      </>
                    ) : (
                      <>
                        Lancez vos simulations
                        <br />
                        immobilières avec lokt.fr
                      </>
                    )}
                  </h1>

                  <p className="text-sm text-slate-600 max-w-3xl">
                    Choisissez directement la calculette qui correspond à votre situation — achat, investissement,
                    relais ou consolidation de patrimoine.
                  </p>

                  <p className="text-[0.85rem] text-slate-700 max-w-3xl">
                    <span className="font-semibold">Par où commencer ?</span> Si c’est votre premier achat, commencez
                    par la <span className="font-semibold">capacité d’emprunt</span>. Si vous achetez avant de vendre,
                    utilisez le <span className="font-semibold">prêt relais</span>. Pour investir, lancez une{" "}
                    <span className="font-semibold">simulation de rentabilité locative</span>.
                  </p>
                </div>

                <div className="pt-2 grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
                  <ToolCard
                    title="Capacité d’emprunt"
                    badge="Le point de départ"
                    desc="Vous achetez (ou vous envisagez d’acheter) ? Estimez votre mensualité cible, votre capital empruntable et un budget réaliste."
                    href="/capacite"
                    highlight
                  />

                  <ToolCard
                    title="Prêt relais"
                    desc="Vous voulez acheter avant d’avoir vendu ? Estimez le relais, la capacité du nouveau prêt et votre budget maximal."
                    href="/pret-relais"
                  />

                  <ToolCard
                    title="Rentabilité locative"
                    desc="Vous souhaitez investir ? Projetez votre achat et calculez une rentabilité cohérente (cash-flow, charges, financement)."
                    href="/investissement"
                  />

                  <ToolCard
                    title="Parc immobilier"
                    desc="Vous avez plusieurs biens ? Vision consolidée : encours, flux mensuels et lecture globale de votre patrimoine."
                    href="/parc-immobilier"
                  />
                </div>

                <p className="text-[0.75rem] text-slate-500">
                  Résultats indicatifs. Les fonctionnalités peuvent évoluer.
                </p>
              </div>
            </div>
          </section>

          {/* =========================================================
              1bis) TEXTE SEO DISCRET + MAILLAGE INTERNE
          ========================================================== */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${brandGradSoft}`} />
            <div className="p-6 sm:p-8">
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                Simulateurs immobiliers : comparez vos scénarios (achat, relais, investissement)
              </h2>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-4xl">
                lokt.fr regroupe des <strong>simulateurs immobiliers</strong> conçus pour obtenir une lecture claire et
                comparable : <strong>capacité d’emprunt</strong> (mensualité, capital, budget),{" "}
                <strong>prêt relais</strong> (acheter avant de vendre), <strong>rentabilité locative</strong> (cash-flow
                / rendement) et <strong>analyse de parc immobilier</strong> (vision consolidée). L’objectif est de
                gagner du temps et d’arbitrer avec méthode.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/capacite" className="text-sm font-semibold underline decoration-slate-300 text-slate-900">
                  Simulateur de capacité d’emprunt →
                </Link>
                <Link href="/pret-relais" className="text-sm font-semibold underline decoration-slate-300 text-slate-900">
                  Simulateur de prêt relais →
                </Link>
                <Link
                  href="/investissement"
                  className="text-sm font-semibold underline decoration-slate-300 text-slate-900"
                >
                  Simulateur de rentabilité locative →
                </Link>
                <Link
                  href="/parc-immobilier"
                  className="text-sm font-semibold underline decoration-slate-300 text-slate-900"
                >
                  Simulateur de parc immobilier →
                </Link>
              </div>
            </div>
          </section>

          {/* =========================================================
              2) MARKETING — Qualité d’analyse + screenshot calculette lokt.fr™
          ========================================================== */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${brandGradSoft}`} />
            <div className="p-6 sm:p-8">
              <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
                {/* Texte marketing */}
                <div className="space-y-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Ce que <span className="lowercase">lokt.fr</span> apporte de plus qu’une simple calculette
                  </p>

                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                    La calculette <span className="font-semibold">lokt.fr™</span> : une lecture “décision”, pas juste un
                    résultat.
                  </h2>

                  <p className="text-sm text-slate-600 max-w-2xl">
                    Une simulation ne sert à rien si elle ne vous aide pas à trancher. Avec la calculette{" "}
                    <span className="font-semibold">lokt.fr™</span>, vous obtenez une lecture{" "}
                    <span className="font-semibold">claire</span>,{" "}
                    <span className="font-semibold">structurée</span> et{" "}
                    <span className="font-semibold">comparable</span> entre scénarios — pour passer de “j’ai un chiffre”
                    à “je sais quoi faire”.
                  </p>

                  <div className="pt-3 space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Une lecture structurée (comme un dossier)</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Revenus, charges, endettement, hypothèses : tout est présenté de façon lisible. Vous savez ce
                        qui “tient” — et ce qui doit être optimisé.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        Des leviers concrets plutôt qu’un chiffre isolé
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Durée, taux, apport, structure : vous voyez l’impact réel sur mensualité, budget, effort
                        d’épargne ou rentabilité.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Une cohérence entre les calculettes</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Même logique de lecture entre capacité, relais, investissement et parc : vous comparez des
                        scénarios sans biais d’outil.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href="/capacite"
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:shadow-sm"
                    >
                      Démarrer une simulation →
                    </Link>
                    <span className="text-xs text-slate-500">(Conseil : commencez par la capacité d’emprunt)</span>
                  </div>
                </div>

                {/* Screenshot + preuves */}
                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Aperçu de la calculette lokt.fr™</p>
                        <p className="text-xs text-slate-600 mt-1">
                          Synthèse immédiate, puis détails quand vous en avez besoin.
                        </p>
                      </div>

                      <span className="shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
                        Aperçu
                      </span>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <img
                        src="/screenCALCULETTE.png"
                        alt="Capture de la calculette lokt.fr"
                        className="w-full h-auto object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold text-slate-900">Lisibilité immédiate</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Une synthèse claire, puis le détail si vous en avez besoin.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold text-slate-900">Arbitrage plus rapide</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Vous identifiez vite le scénario le plus cohérent (budget, effort, rentabilité).
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold text-slate-900">Résultats actionnables</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Un rendu pensé pour comprendre, décider, et préparer un échange efficace.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold text-slate-900">Comparaison homogène</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Même logique entre outils : vous comparez “à périmètre constant”.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs text-slate-600">
                        Astuce : faites 2 simulations (prudent vs ambitieux). En quelques minutes, vous visualisez les
                        écarts — et les leviers qui comptent vraiment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================
              3) Bandeau bailleur — teaser (à venir)
          ========================================================== */}
          <section className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className={`relative ${brandGrad} text-white p-7 sm:p-10 overflow-hidden`}>
              <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-25 blur-3xl bg-white" />
              <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full opacity-20 blur-3xl bg-indigo-900" />

              <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
                {/* Texte */}
                <div className="space-y-4">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-white/80">Fonctionnalité à venir</p>

                  <div className="space-y-2">
		<h3 className="text-2xl sm:text-3xl font-semibold leading-tight">
  Votre gestion locative, au même endroit
  <br className="hidden sm:block" />
  {" "}que vos simulations.
</h3>
                    <p className="text-sm text-white/90 max-w-2xl">
                      L’espace bailleur lokt.fr est en préparation : un endroit clair pour{" "}
                      <span className="font-semibold">centraliser vos documents</span>,{" "}
                      <span className="font-semibold">suivre vos échéances</span> et{" "}
                      <span className="font-semibold">piloter vos biens</span> sans tableurs dispersés.
                    </p>
                  </div>

                  {/* Bénéfices */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <p className="text-sm font-semibold">Moins de friction</p>
                      <p className="text-xs text-white/85 mt-1">Fin des fichiers éparpillés et des oublis.</p>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <p className="text-sm font-semibold">Suivi lisible</p>
                      <p className="text-xs text-white/85 mt-1">Une vision claire de vos biens et échéances.</p>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <p className="text-sm font-semibold">Documents prêts</p>
                      <p className="text-xs text-white/85 mt-1">Historique, organisation, accès rapide.</p>
                    </div>
                  </div>

                  {/* Ce que vous pourrez faire */}
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-5">
                    <p className="text-sm font-semibold">Ce que vous pourrez faire (V1)</p>
                    <ul className="mt-2 space-y-1 text-xs text-white/85">
                      <li>• Centraliser vos documents (quittances, états des lieux, pièces clés)</li>
                      <li>• Suivre dépôts de garantie et restitutions</li>
                      <li>• Gérer les échéances (rappels, révisions, renouvellements)</li>
                      <li>
                        • <span className="font-semibold">Templates de documents</span> : des dizaines de modèles prêts
                        à l’emploi pour l’immobilier
                      </li>
                    </ul>

                    <div className="mt-4 pt-4 border-t border-white/15">
                      <p className="text-sm font-semibold">Tarifs</p>
                      <p className="mt-1 text-xs text-white/85">
                        Les tarifs seront publiés lorsque l’espace bailleur sera prêt à ouvrir.
                      </p>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                    <p className="text-sm font-semibold">Être informé à l’ouverture</p>
                    <p className="text-xs text-white/85 mt-1">
                      Écrivez-nous à{" "}
                      <a className="underline" href="mailto:contact@lokt.fr">
                        contact@lokt.fr
                      </a>{" "}
                      pour être ajouté à la liste des accès prioritaires.
                    </p>
                  </div>

                  <p className="text-[0.75rem] text-white/70">
                    Aperçu non contractuel — l’interface et le périmètre peuvent évoluer avant lancement.
                  </p>
                </div>

                {/* Visuel */}
                <div className="space-y-3">
                  <div className="relative rounded-3xl border border-white/20 bg-white/10 p-3 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-2 pb-3">
                      <p className="text-sm font-semibold">Aperçu</p>
                      <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-[0.7rem] font-semibold">
                        Espace bailleur
                      </span>
                    </div>

                    <img
                      src="/ESPACEBAILLEURSCREENSHOT.png"
                      alt="Aperçu espace bailleur lokt.fr"
                      className="w-full rounded-2xl border border-white/10 shadow-sm object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                      <p className="text-sm font-semibold">Quittances & documents</p>
                      <p className="text-xs text-white/85 mt-1">Génération, archivage, historique.</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                      <p className="text-sm font-semibold">Dépôts de garantie</p>
                      <p className="text-xs text-white/85 mt-1">Suivi, restitutions et rappels.</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                      <p className="text-sm font-semibold">États des lieux</p>
                      <p className="text-xs text-white/85 mt-1">Modèles, checklists, organisation.</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                      <p className="text-sm font-semibold">Templates</p>
                      <p className="text-xs text-white/85 mt-1">Constituer et réutiliser vos modèles.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================
              4) FAQ — ancre utilisée par le header (/#faq)
          ========================================================== */}
          <section id="faq" className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${brandGradSoft}`} />
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
                    FAQ
                  </p>
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mt-1">Questions fréquentes</h2>
                  <p className="text-sm text-slate-600 mt-2 max-w-3xl">
                    Des réponses rapides sur les calculettes, les hypothèses de calcul et la gestion des données.
                  </p>
                </div>

                <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-600">
                  lokt.fr
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                {faqData.map((f) => (
                  <FaqItem
                    key={f.q}
                    q={f.q}
                    a={
                      <>
                        {f.a.includes("contact@lokt.fr") ? (
                          <>
                            {f.a.split("contact@lokt.fr")[0]}
                            <a className="underline" href="mailto:contact@lokt.fr">
                              contact@lokt.fr
                            </a>
                            {f.a.split("contact@lokt.fr")[1] ?? ""}
                          </>
                        ) : (
                          f.a
                        )}
                      </>
                    }
                  />
                ))}
              </div>

              <p className="mt-6 text-xs text-slate-500">
                Vous ne trouvez pas la réponse ? Écrivez-nous à{" "}
                <a className="underline" href="mailto:contact@lokt.fr">
                  contact@lokt.fr
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
