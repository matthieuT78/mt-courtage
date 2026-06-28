// pages/calculettes.tsx
import Head from "next/head";
import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  CalculatorIcon,
  ChartBarIcon,
  HomeModernIcon,
  ScaleIcon,
  SparklesIcon,
  XMarkIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { useScrollReveal } from "../hooks/useScrollReveal";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { supabase } from "../lib/supabaseClient";
import { PAID_BILLING_PLANS } from "../lib/billingPlans";
import { firstNameFromUser } from "../lib/userDisplay";

type SimpleUser = {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; first_name?: string; given_name?: string };
};

type Tool = {
  key: string;
  title: string;
  desc: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  access: "free" | "analysis_after_login";
  metric: string;
};

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/calculettes`;

const faq = [
  {
    q: "Quels simulateurs immobiliers sont disponibles gratuitement sur lokt.fr ?",
    a: "lokt.fr propose 6 calculettes entièrement gratuites : capacité d'emprunt, rentabilité locative (rendement brut, net et cash-flow), prêt relais, parc immobilier, plus-value immobilière et arbitrage acheter ou louer. Toutes sont accessibles sans création de compte.",
  },
  {
    q: "Comment calculer ma capacité d'emprunt ?",
    a: "Renseignez vos revenus nets mensuels, vos charges en cours (crédits, pensions alimentaires) et votre apport disponible. Le simulateur applique la règle des 35 % de taux d'endettement imposée par le HCSF et calcule votre mensualité maximale, le montant empruntable et votre budget d'achat (frais de notaire inclus).",
  },
  {
    q: "Comment calculer la rentabilité d'un investissement locatif ?",
    a: "Entrez le prix d'achat, les frais (notaire, agence, travaux), les loyers envisagés et les charges annuelles (copropriété, taxe foncière, assurance, gestion). Le simulateur calcule le rendement brut, le rendement net avant crédit et le cash-flow mensuel après remboursement du prêt. Il compare aussi le prix au m² et le loyer au marché local si vous renseignez la ville.",
  },
  {
    q: "Faut-il créer un compte pour utiliser les calculettes ?",
    a: "Non. Toutes les calculettes sont accessibles immédiatement, sans inscription. Un compte gratuit permet de retrouver vos simulations passées et d'accéder à l'espace bailleur pour gérer un bien loué.",
  },
  {
    q: "Quelle différence entre rendement brut et rendement net ?",
    a: "Le rendement brut rapporte les loyers annuels au coût total d'acquisition. Le rendement net soustrait les charges réelles (taxe foncière, copropriété, assurance, frais de gestion). En pratique, l'écart est de 1,5 à 2 points. C'est le rendement net — avant remboursement du crédit — qui permet de comparer objectivement deux biens.",
  },
];
const ogImage = `${siteUrl}/screenCALCULETTE.png`;
const title = "Calculettes immobilières gratuites 2026 | Capacité d’emprunt, rentabilité locative, prêt relais | lokt.fr";
const description =
  "6 simulateurs immobiliers gratuits : capacité d’emprunt, rentabilité locative (rendement net + cash-flow), prêt relais, plus-value et arbitrage acheter/louer. Résultats immédiats, sans inscription.";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatPrice(value: number | null | undefined) {
  if (value == null) return "sur devis";
  return value.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
}

function StatCard({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="pointer-events-none absolute -right-5 -top-7 text-[7rem] font-semibold leading-none text-slate-100">
        {label}
      </div>
      <p className="relative text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">{label}</p>
      <p className="relative mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="relative mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function ToolSticker({ icon: Icon }: { icon: ComponentType<SVGProps<SVGSVGElement>> }) {
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-slate-900">
      <span className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-cyan-400/10 to-emerald-400/10" />
      <Icon className="relative h-6 w-6" />
    </span>
  );
}

function ToolPickerModal({
  open,
  onClose,
  tools,
}: {
  open: boolean;
  onClose: () => void;
  tools: Tool[];
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 1) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-[2rem] border border-white/60 bg-white/88 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Démarrer</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">Choisir une calculette</h3>
                <p className="mt-1 text-sm text-slate-600">Sélectionnez l’outil adapté à votre situation.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-700 hover:shadow-sm"
                aria-label="Fermer la fenêtre"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={onClose}
                    className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:shadow-sm"
                  >
                    <ToolSticker icon={Icon} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-900">{tool.title}</span>
                      <span className="mt-0.5 block text-sm text-slate-600">{tool.desc}</span>
                    </span>
                    <span className="text-slate-400 transition group-hover:translate-x-0.5">→</span>
                  </Link>
                );
              })}
            </div>

            <p className="mt-5 text-xs text-slate-500">
              Astuce : commencez par la capacité d’emprunt si vous ne savez pas par où démarrer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalculettesPage() {
  const router = useRouter();
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser((data.session?.user as any) ?? null);
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      setUser((session?.user as any) ?? null);
      setChecking(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useScrollReveal();

  const isLoggedIn = !!user?.id;
  const displayName = firstNameFromUser(user);
  const starter = PAID_BILLING_PLANS[0];

  const tools: Tool[] = useMemo(
    () => [
      {
        key: "capacite",
        title: "Capacité d’emprunt",
        desc: "Entrez vos revenus et charges : obtenez votre budget d’achat, la mensualité maximale et votre reste à vivre. Résultat en 2 minutes, avant même de visiter.",
        href: "/capacite",
        icon: CalculatorIcon,
        access: "free",
        metric: "Achat résidence principale ou investissement",
      },
      {
        key: "invest",
        title: "Rentabilité locative",
        desc: "Rendement brut, rendement net, cash-flow mensuel — avec comparaison au prix du marché local. Idéal pour savoir si un bien tient la route avant de faire une offre.",
        href: "/investissement",
        icon: ArrowTrendingUpIcon,
        access: "analysis_after_login",
        metric: "Investissement locatif",
      },
      {
        key: "relais",
        title: "Prêt relais",
        desc: "Vous avez un bien à vendre et un à acheter. Simulez l’apport libéré par la vente, votre budget net disponible et les mensualités du crédit relais.",
        href: "/pret-relais",
        icon: BanknotesIcon,
        access: "analysis_after_login",
        metric: "Projet avec bien existant à vendre",
      },
      {
        key: "parc",
        title: "Parc immobilier",
        desc: "Vue consolidée de tous vos biens : loyers encaissés, crédits en cours, cash-flow cumulé et performance globale du patrimoine. Pour les bailleurs multi-biens.",
        href: "/parc-immobilier",
        icon: BuildingOffice2Icon,
        access: "analysis_after_login",
        metric: "Propriétaires de plusieurs logements",
      },
      {
        key: "plus-value",
        title: "Plus-value immobilière",
        desc: "Estimez l’impôt sur la plus-value, le capital restant dû, les frais d’agence et votre net vendeur réel avant de signer un compromis de vente.",
        href: "/plus-value-vente-immobiliere",
        icon: ScaleIcon,
        access: "analysis_after_login",
        metric: "Vente d’un bien immobilier",
      },
      {
        key: "acheter-ou-louer",
        title: "Acheter ou louer ?",
        desc: "Renseignez votre durée de séjour envisagée, votre loyer actuel et votre apport disponible : l’outil calcule à quel horizon l’achat devient plus rentable que la location.",
        href: "/acheter-ou-louer",
        icon: QuestionMarkCircleIcon,
        access: "free",
        metric: "Arbitrage résidence principale",
      },
    ],
    []
  );

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          name: title,
          description,
          url: pageUrl,
          isPartOf: { "@type": "WebSite", name: "lokt.fr", url: siteUrl },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: tools.map((tool, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: tool.title,
              description: tool.desc,
              url: `${siteUrl}${tool.href}`,
            })),
          },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Calculettes immobilières", item: pageUrl },
          ],
        },
        {
          "@type": "FAQPage",
          mainEntity: faq.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        },
      ],
    }),
    [tools]
  );

  const go = (href: string) => router.push(href);
  const loginHref = `/mon-compte?mode=login&redirect=%2Fcalculettes`;

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f9fc]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:alt" content="Calculettes immobilières gratuites lokt.fr" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <AppHeader />
      <ToolPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} tools={tools} />

      <main className="flex-1 bg-[#f6f9fc] text-slate-950">
        <section className="relative overflow-hidden border-b border-slate-200 bg-white px-4 pb-12 pt-10 sm:pb-16 sm:pt-14">
          {/* Ligne accent top */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#635bff]/60 to-transparent" />
          {/* Orbes statiques — pas d'animation contrairement à l'index */}
          <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#635bff]/[0.08] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -right-24 top-16 h-[380px] w-[380px] rounded-full bg-[#00d4ff]/[0.06] blur-3xl" />
          <div className="relative mx-auto max-w-6xl">
            <div className="grid gap-7 sm:gap-10 lg:grid-cols-[0.95fr,1.05fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#635bff]/8 px-3 py-1 text-[0.72rem] font-semibold text-[#635bff] ring-1 ring-[#635bff]/15">
                  <SparklesIcon className="h-4 w-4 text-[#635bff]" />
                  Simulateurs immobiliers gratuits
                </div>
                <h1 className="mt-5 max-w-3xl font-semibold leading-[0.99] text-slate-950 sm:mt-6">
                  {displayName ? (
                    <>
                      <span className="block text-[2.55rem] sm:text-6xl">Bonjour {displayName}.</span>
                      <span className="mt-1 block text-[2rem] sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-[#635bff] to-[#00b4d8]">Simulez votre projet.</span>
                    </>
                  ) : (
                    <>
                      <span className="block text-[2.55rem] sm:text-6xl">Simuler avant d’acheter.</span>
                      <span className="mt-1 block text-[2rem] sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-[#635bff] to-[#00b4d8]">Vendre ou investir.</span>
                    </>
                  )}
                </h1>
                <p className="mt-5 max-w-xl text-[0.98rem] leading-7 text-slate-600 sm:mt-6 sm:text-lg">
                  Capacité d’emprunt, rentabilité, prêt relais, parc immobilier et plus-value : des résultats lisibles pour prendre une décision sans tableur.
                </p>
                <div className="mt-7 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#635bff] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 hover:bg-[#4f46e5] sm:w-auto"
                  >
                    Lancer une simulation →
                  </button>
                </div>
                <p className="mt-4 text-xs font-medium text-slate-500">
                  {checking
                    ? "Vérification de la session..."
                    : isLoggedIn
                    ? "Compte connecté : vos analyses peuvent être retrouvées plus facilement."
                    : "Aucun compte nécessaire pour lancer une simulation."}
                </p>
              </div>

              <div>
                <div className="relative rounded-[1.5rem] border border-slate-200 bg-white p-1.5 shadow-xl shadow-[#635bff]/10 sm:rounded-[2rem] sm:p-2 sm:shadow-2xl sm:shadow-slate-900/20">
                  <div className="overflow-hidden rounded-[1.25rem] border border-white/60 bg-white sm:rounded-[1.55rem]">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#ff5f57] sm:h-2.5 sm:w-2.5" />
                        <span className="h-2 w-2 rounded-full bg-[#ffbd2e] sm:h-2.5 sm:w-2.5" />
                        <span className="h-2 w-2 rounded-full bg-[#28c840] sm:h-2.5 sm:w-2.5" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[0.68rem] font-semibold text-slate-600">Capacité d’emprunt</span>
                    </div>
                    <div className="p-3 sm:p-6">
                      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
                        {[
                          ["Mensualité max", "1 470 €", "Hors assurance"],
                          ["Emprunt possible", "302 000 €", "Sur 25 ans"],
                          ["Budget achat", "327 000 €", "Apport inclus"],
                        ].map(([label, value, hint]) => (
                          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                            <p className="mt-2 text-xl font-semibold text-slate-950 sm:mt-3 sm:text-2xl">{value}</p>
                            <p className="mt-1 text-xs text-slate-500">{hint}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 sm:mt-4 sm:p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">Combien puis-je emprunter ?</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Revenus nets 4 200 €, charges 0 €, effort cible 35 % : l’outil traduit le projet en mensualité et en budget d’achat.</p>
                          </div>
                          <ChartBarIcon className="h-9 w-9 shrink-0 text-[#635bff]" />
                        </div>
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[0.68rem] font-semibold text-slate-500">
                            <span>Taux d’effort</span>
                            <span>35 %</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-[#635bff] to-[#00d4ff]" />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                          <p className="text-sm font-semibold text-emerald-950">Lecture simple</p>
                          <p className="mt-1 text-xs leading-5 text-emerald-800">Vous voyez tout de suite la mensualité réaliste.</p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
                          <p className="text-sm font-semibold text-amber-950">Marge bancaire</p>
                          <p className="mt-1 text-xs leading-5 text-amber-800">Le reste à vivre reste visible avant de visiter.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:py-20">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="max-w-3xl pb-3">
              <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Choisir son angle</p>
              <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 font-semibold leading-tight text-slate-950">
                <span className="block text-3xl sm:text-4xl">Une décision immobilière.</span>
                <span className="mt-1 block text-2xl text-cyan-600 sm:text-3xl">La bonne calculette au bon moment.</span>
              </h2>
            </div>
            <section className="grid gap-4 sm:grid-cols-2">
              {tools.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.key}
                    href={tool.href}
                    data-scroll-reveal
                    data-reveal-delay={`${index * 70}`}
                    className="group flex h-full flex-col rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#635bff]/30 hover:shadow-md sm:rounded-[1.75rem] sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f6f9fc] text-[#635bff] ring-1 ring-slate-200">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-slate-950">{tool.title}</p>
                          <p className="mt-1 text-xs font-semibold text-[#635bff]">{tool.metric}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white transition group-hover:bg-[#635bff]">
                        Lancer →
                      </span>
                    </div>
                    <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">{tool.desc}</p>
                    <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      {tool.access === "free" ? "✓ Accès libre, sans compte" : "✓ Gratuit — compte conseillé pour sauvegarder"}
                    </div>
                  </Link>
                );
              })}
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <div data-scroll-reveal data-reveal-delay="0"><StatCard label="01" value="Simuler" text="Vous renseignez les hypothèses clés du projet immobilier." /></div>
              <div data-scroll-reveal data-reveal-delay="80"><StatCard label="02" value="Comparer" text="lokt.fr met les résultats en perspective avec des seuils simples." /></div>
              <div data-scroll-reveal data-reveal-delay="160"><StatCard label="03" value="Gérer" text="Si le projet devient un bien loué, l’espace bailleur prend la suite." /></div>
            </section>

            {/* FAQ */}
            <section data-scroll-reveal data-reveal-delay="0">
              <h2 className="mb-5 text-xl font-semibold text-slate-950">Questions fréquentes</h2>
              <div className="space-y-2">
                {faq.map(({ q, a }) => (
                  <details key={q} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm open:border-[#635bff]/30">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 group-open:text-[#635bff]">{q}</summary>
                    <p className="mt-3 text-[0.85rem] leading-relaxed text-slate-600">{a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section data-scroll-reveal data-reveal-delay="0" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[1fr,360px] lg:items-center">
                <div>
                  <p className="font-semibold leading-tight text-slate-950">
                    <span className="block text-2xl">Après la simulation.</span>
                    <span className="mt-1 block text-xl text-[#635bff]">L’espace bailleur prend la suite.</span>
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Le premier logement actif est gratuit. Vous gérez manuellement le bail, le locataire, les quittances PDF, l’état des lieux,
                    l’inventaire et la finance simple. Les abonnements ajoutent l’automatisation des quittances, les emails, les rappels et l’aide à la déclaration.
                  </p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    Offre Starter : {formatPrice(starter?.monthlyPrice)} € / mois, jusqu’à 3 logements actifs.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Link
                    href="/outil-gestion-locative"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Découvrir l’outil bailleur
                  </Link>
                  <Link
                    href="/tarifs"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Voir les tarifs
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
