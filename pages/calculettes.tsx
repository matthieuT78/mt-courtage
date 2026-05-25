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
} from "@heroicons/react/24/outline";
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
const ogImage = `${siteUrl}/screenCALCULETTE.png`;
const title = "Calculettes immobilières gratuites | Capacité, rentabilité, prêt relais | lokt.fr";
const description =
  "Simulez votre capacité d’emprunt, votre rentabilité locative, votre prêt relais et votre parc immobilier avec les calculettes gratuites lokt.fr.";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatPrice(value: number | null | undefined) {
  if (value == null) return "sur devis";
  return value.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
}

function StatCard({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
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
              <div>
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

  const isLoggedIn = !!user?.id;
  const displayName = firstNameFromUser(user);
  const starter = PAID_BILLING_PLANS[0];

  const tools: Tool[] = useMemo(
    () => [
      {
        key: "capacite",
        title: "Capacité d’emprunt",
        desc: "Budget, mensualité max, taux d’endettement et reste à vivre avant de visiter.",
        href: "/capacite",
        icon: CalculatorIcon,
        access: "free",
        metric: "Achat résidence ou investissement",
      },
      {
        key: "invest",
        title: "Rentabilité locative",
        desc: "Cash-flow, rendement net, charges, fiscalité simplifiée et plan d’action.",
        href: "/investissement",
        icon: ArrowTrendingUpIcon,
        access: "analysis_after_login",
        metric: "Décision investisseur",
      },
      {
        key: "relais",
        title: "Achat-revente",
        desc: "Prêt relais, apport disponible, budget de rachat et marge de sécurité.",
        href: "/pret-relais",
        icon: BanknotesIcon,
        access: "analysis_after_login",
        metric: "Projet avec bien à vendre",
      },
      {
        key: "parc",
        title: "Parc immobilier",
        desc: "Vision consolidée des loyers, crédits, cash-flow et performance globale.",
        href: "/parc-immobilier",
        icon: BuildingOffice2Icon,
        access: "analysis_after_login",
        metric: "Plusieurs logements",
      },
      {
        key: "plus-value",
        title: "Plus-value immobilière",
        desc: "Cash net vendeur, impôts, CRD, frais et arbitrage avant de vendre.",
        href: "/plus-value-vente-immobiliere",
        icon: ScaleIcon,
        access: "analysis_after_login",
        metric: "Vente d’un bien",
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
      ],
    }),
    [tools]
  );

  const go = (href: string) => router.push(href);
  const loginHref = `/mon-compte?mode=login&redirect=%2Fcalculettes`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
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

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="p-7 sm:p-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-900">
                  <SparklesIcon className="h-4 w-4" />
                  Simuler avant de décider
                </div>
                <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
                  {displayName ? `Bonjour ${displayName}, choisissez votre simulateur.` : "Toutes les calculettes immobilières lokt.fr."}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Capacité d’emprunt, rentabilité locative, achat-revente et parc immobilier : chaque outil donne une réponse lisible,
                  avec les bons indicateurs pour avancer sans tableur bricolé.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Lancer une simulation
                  </button>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  {checking
                    ? "Vérification de la session..."
                    : isLoggedIn
                    ? "Compte connecté : vous pourrez retrouver plus facilement vos analyses."
                    : "Aucun compte nécessaire pour lancer une simulation."}
                </p>
              </div>

              <div className="border-t border-slate-200 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0">
                <div className="grid h-full gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <ChartBarIcon className="h-7 w-7 text-cyan-200" />
                    <p className="mt-4 text-sm font-semibold">Lecture immédiate</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      Résultats, alertes et interprétation métier au même endroit.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <ScaleIcon className="h-7 w-7 text-emerald-200" />
                    <p className="mt-4 text-sm font-semibold">Décision plus sûre</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      Budget, effort, cash-flow et marge de sécurité mis en perspective.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2 lg:col-span-1">
                    <HomeModernIcon className="h-7 w-7 text-indigo-200" />
                    <p className="mt-4 text-sm font-semibold">Suite logique : gérer le bien</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      Une fois le projet lancé, l’espace bailleur prend le relais pour le suivi locatif.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.key}
                  type="button"
                  onClick={() => go(tool.href)}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-900">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-950">{tool.title}</p>
                        <p className="mt-1 text-xs font-semibold text-cyan-800">{tool.metric}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition group-hover:bg-cyan-700">
                      Ouvrir
                    </span>
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">{tool.desc}</p>
                  <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    {tool.access === "free" ? "Accès libre" : "Compte gratuit conseillé pour sauvegarder et approfondir"}
                  </div>
                </button>
              );
            })}
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <StatCard label="01" value="Simuler" text="Vous renseignez les hypothèses clés du projet immobilier." />
            <StatCard label="02" value="Comparer" text="lokt.fr met les résultats en perspective avec des seuils simples." />
            <StatCard label="03" value="Gérer" text="Si le projet devient un bien loué, l’espace bailleur prend la suite." />
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[1fr,360px] lg:items-center">
              <div>
                <p className="text-sm font-semibold text-slate-950">Après la simulation : l’espace bailleur</p>
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
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Découvrir l’outil bailleur
                </Link>
                <Link
                  href="/tarifs"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Voir les tarifs
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
