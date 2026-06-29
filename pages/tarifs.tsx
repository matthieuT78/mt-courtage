import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { PAID_BILLING_PLANS } from "../lib/billingPlans";
import { supabase } from "../lib/supabaseClient";
import { useScrollReveal } from "../hooks/useScrollReveal";

type Billing = "monthly" | "yearly";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function formatEuroAmount(value: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function priceLabel(plan: (typeof PAID_BILLING_PLANS)[number], billing: Billing) {
  if (plan.monthlyPrice == null || plan.yearlyPrice == null) return plan.priceLabel;
  return billing === "monthly" ? `${formatEuroAmount(plan.monthlyPrice)} € / mois` : `${formatEuroAmount(plan.yearlyPrice)} € / an`;
}

function PlanCard({
  plan,
  billing,
  loading,
  onCheckout,
  revealDelay,
}: {
  plan: (typeof PAID_BILLING_PLANS)[number];
  billing: Billing;
  loading: boolean;
  onCheckout: (planId: string) => void;
  revealDelay?: number;
}) {
  const isQuote = plan.monthlyPrice == null;
  const isComingSoon = plan.id === "landlord_unlimited";

  return (
    <article
      data-scroll-reveal
      data-reveal-delay={revealDelay ?? 0}
      className={cx(
        "flex h-full flex-col rounded-[1.5rem] border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[1.75rem] sm:p-5",
        plan.recommended ? "border-[#635bff]/30 ring-2 ring-[#635bff]/10" : "border-slate-200"
      )}
    >
      <div className="flex min-h-[3.65rem] items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
          <p className="mt-1 max-w-[11rem] text-xs leading-5 text-slate-500">{plan.audience}</p>
        </div>
        {plan.recommended ? (
          <span className="shrink-0 rounded-full border border-[#635bff]/20 bg-[#635bff]/10 px-2 py-0.5 text-[0.68rem] font-semibold text-[#3f37c9]">
            Recommandé
          </span>
        ) : isComingSoon ? (
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.68rem] font-semibold text-amber-800">
            À venir
          </span>
        ) : null}
      </div>

      <div className="mt-3 min-h-[4.5rem]">
        <p className="text-2xl font-semibold leading-tight text-slate-950">{priceLabel(plan, billing)}</p>
        <p className="mt-1 text-xs text-slate-600">
          {isComingSoon ? "Module en préparation" : isQuote ? plan.limitLabel : billing === "monthly" ? `${plan.yearlyPrice} € / an` : "2 mois offerts"}
        </p>
      </div>

      <p className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-800">
        Sans engagement
      </p>

      <p className="mt-4 text-sm leading-6 text-slate-600">{plan.description}</p>

      {isComingSoon ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          Cette offre n’est pas encore ouverte. Elle est pensée pour les agences, administrateurs de biens et bailleurs qui ont besoin de dossiers
          locataires, pièces sensibles, diagnostics et preuves de gestion au même endroit.
        </div>
      ) : null}

      <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
        <li className="font-semibold text-slate-900">{plan.limitLabel}</li>
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="text-[#635bff]">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {isQuote ? (
        <a
          href="mailto:contact@lokt.fr?subject=Offre%20Pro%20Agence%20lokt.fr"
          className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Contacter lokt.fr
        </a>
      ) : (
        <button
          type="button"
          onClick={() => onCheckout(plan.id)}
          disabled={loading}
          className={cx(
            "mt-5 inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white",
            plan.recommended ? "bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8] hover:opacity-95" : "bg-slate-950 hover:bg-slate-800",
            loading && "opacity-60"
          )}
        >
          {loading ? "Redirection Stripe…" : "Souscrire"}
        </button>
      )}
    </article>
  );
}

export default function TarifsPage() {
  const router = useRouter();
  const title = "Tarifs gestion locative propriétaire bailleur | lokt.fr";
  const description =
    "Comparez les offres lokt.fr : gestion locative gratuite pour un logement actif, Starter pour automatiser les quittances, Essentiel pour le pilotage et les outils bailleur.";
  const pageUrl = "https://lokt.fr/tarifs";
  const ogImage = "https://lokt.fr/lokt-logo.jpg";
  const pricingJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "lokt.fr",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: pageUrl,
    description,
    offers: [
      { "@type": "Offer", name: "Gratuit", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
      { "@type": "Offer", name: "Starter", price: "4.90", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
      { "@type": "Offer", name: "Essentiel", price: "9.90", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
      { "@type": "Offer", name: "Pro / Agence", priceCurrency: "EUR", availability: "https://schema.org/PreOrder" },
    ],
  };
  useScrollReveal();
  const [billing, setBilling] = useState<Billing>("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const startCheckout = async (planId: string) => {
    setCheckoutError(null);
    setCheckoutLoading(planId);

    try {
      if (!supabase) throw new Error("Authentification indisponible.");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        const redirect = `/mon-compte/abonnement?plan=${encodeURIComponent(planId)}&billing=${billing}`;
        router.push(`/mon-compte?mode=register&redirect=${encodeURIComponent(redirect)}`);
        return;
      }

      const resp = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId, billing }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(payload?.error || "Impossible de démarrer le paiement.");
      if (!payload?.url) throw new Error("URL de paiement Stripe manquante.");

      window.location.href = payload.url;
    } catch (error: any) {
      setCheckoutError(error?.message || "Impossible de démarrer le paiement.");
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f9fc] flex flex-col">
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
        <meta property="og:image:alt" content="Tarifs de l'espace bailleur lokt.fr" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }} />
      </Head>

      <AppHeader staticMode />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-slate-200 bg-white px-4 pb-10 pt-10 sm:pb-16 sm:pt-14">
          {/* Ligne accent top */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#635bff]/60 to-transparent" />
          {/* Orbes statiques */}
          <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#635bff]/[0.08] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -right-24 top-16 h-[380px] w-[380px] rounded-full bg-[#00d4ff]/[0.06] blur-3xl" />
          <div className="relative mx-auto max-w-6xl">
            <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr,360px] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[0.72rem] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Tarifs espace bailleur
                </div>
                <h1 className="mt-5 max-w-3xl font-semibold leading-[0.99] sm:mt-6">
                  <span className="block text-[2.55rem] text-slate-950 sm:text-6xl">Gratuit pour gérer.</span>
                  <span className="mt-1 block text-[2rem] bg-clip-text text-transparent bg-gradient-to-r from-[#635bff] to-[#00b4d8] sm:text-5xl">Payant quand lokt.fr automatise.</span>
                </h1>
                <p className="mt-5 max-w-3xl text-[0.98rem] leading-7 text-slate-600 sm:mt-6 sm:text-lg">
                  Un logement gratuit pour démarrer. Starter automatise les quittances, active le portail locataire et le partage de documents. Essentiel ajoute le pilotage financier et la boîte à outils bailleur.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-xl shadow-[#635bff]/10 sm:rounded-[1.75rem]">
                <p className="text-sm font-semibold text-slate-950">Facturation</p>
                <div className="mt-3 inline-flex rounded-xl border border-slate-200 bg-[#f6f9fc] p-1">
                  {(["monthly", "yearly"] as Billing[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBilling(value)}
                      className={cx(
                        "rounded-lg px-4 py-2 text-xs font-semibold transition",
                        billing === value ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-white"
                      )}
                    >
                      {value === "monthly" ? "Mensuel" : "Annuel"}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-600">L’annuel garde une remise lisible, sans engagement complexe.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-10 pt-8 sm:pb-16 sm:pt-14">
          <div className="relative mx-auto max-w-6xl space-y-6">
          <div className="max-w-3xl pb-2">
            <p data-scroll-reveal data-reveal-delay="0" className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Choisir simplement</p>
            <h2 data-scroll-reveal data-reveal-delay="100" className="mt-2 font-semibold leading-tight text-slate-950">
              <span className="block text-3xl sm:text-4xl">Un abonnement lisible.</span>
              <span className="mt-1 block text-2xl text-cyan-600 sm:text-3xl">Le bon niveau quand il devient utile.</span>
            </h2>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article data-scroll-reveal data-reveal-delay="0" className="flex h-full flex-col rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[1.75rem] sm:p-5">
              <div className="min-h-[3.65rem]">
                <p className="text-sm font-semibold text-slate-900">Gratuit</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">Gestion manuelle</p>
              </div>
              <div className="mt-3 min-h-[4.5rem]">
                <p className="text-2xl font-semibold leading-tight text-slate-950">0 €</p>
                <p className="mt-1 text-xs text-slate-600">1 logement actif inclus</p>
              </div>
              <p className="inline-flex w-fit rounded-full border border-emerald-200 bg-white/70 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-800">
                Sans engagement
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                <li>✓ Bien, bail et locataire</li>
                <li>✓ Quittances manuelles et PDF</li>
                <li>✓ États des lieux et inventaire</li>
                <li>✓ 25 Mo de stockage documentaire sécurisé</li>
                <li>✓ Finance simple</li>
                <li>✓ 4 alertes essentielles : retard de paiement, quittance à finaliser, email manquant</li>
                <li className="text-slate-500">Quittances automatiques non incluses</li>
                <li className="text-slate-500">Portail locataire non inclus</li>
                <li className="text-slate-500">Partage de documents non inclus</li>
                <li className="text-slate-500">Alertes IRL, fin de bail, EDL non incluses</li>
              </ul>
              <Link
                href="/mon-compte?mode=register&redirect=/espace-bailleur"
                className="mt-5 inline-flex min-h-9 w-full items-center justify-center whitespace-nowrap rounded-full bg-emerald-700 px-3 py-2 text-[0.8rem] font-semibold text-white hover:bg-emerald-600"
              >
                Créer espace gratuit
              </Link>
            </article>

            {PAID_BILLING_PLANS.map((plan, i) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billing={billing}
                loading={checkoutLoading === plan.id}
                onCheckout={startCheckout}
                revealDelay={(i + 1) * 80}
              />
            ))}
          </section>

          {checkoutError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {checkoutError}
            </div>
          ) : null}

          <section data-scroll-reveal data-reveal-delay="0" className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[1.75rem]">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Comparatif détaillé</p>
              <h2 className="mt-1 font-semibold leading-tight text-slate-950">
                <span className="block text-xl">Ce que chaque abonnement débloque.</span>
                <span className="mt-1 block text-lg text-[#635bff]">Réellement.</span>
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Tous les plans sont sans engagement. Starter automatise le quotidien ; Essentiel ajoute le pilotage financier et les outils métier.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f6f9fc] text-slate-900">
                    <th className="px-4 py-3 font-semibold sm:px-5">Fonctionnalité</th>
                    <th className="px-4 py-3 font-semibold">Gratuit</th>
                    <th className="px-4 py-3 font-semibold">Starter</th>
                    <th className="px-4 py-3 font-semibold">Essentiel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {[
                    ["Logements actifs", "1", "Jusqu’à 3", "Jusqu’à 10"],
                    ["Biens, locataires et baux", "Inclus", "Inclus", "Inclus"],
                    ["Quittances PDF manuelles", "Inclus", "Inclus", "Inclus"],
                    ["États des lieux et inventaire", "Inclus", "Inclus", "Inclus"],
                    ["Finance simple", "Inclus", "Inclus", "Inclus"],
                    ["4 alertes essentielles (retard, quittance, email manquant)", "Inclus", "Inclus", "Inclus"],
                    ["Stockage documentaire sécurisé", "25 Mo", "150 Mo", "500 Mo"],
                    ["Dossier de candidature en ligne (lien dédié, scoring, RGPD)", "Non inclus", "Inclus", "Inclus"],
                    ["Alertes IRL, fin de bail et EDL", "Non inclus", "Inclus", "Inclus"],
                    ["Validation loyer par email", "Non inclus", "Inclus", "Inclus"],
                    ["Relance bailleur automatique à J+1", "Non inclus", "Inclus", "Inclus"],
                    ["Envoi automatique des quittances", "Non inclus", "Inclus", "Inclus"],
                    ["Portail locataire (quittances, bail, EDL en ligne)", "Non inclus", "Inclus", "Inclus"],
                    ["Partage des documents avec le locataire par email", "Non inclus", "Inclus", "Inclus"],
                    ["Accusé de réception locataire horodaté", "Non inclus", "Inclus", "Inclus"],
                    ["Vue dossier bail (statut consolidé par location)", "Non inclus", "Inclus", "Inclus"],
                    ["Boîte à outils bailleur", "Non inclus", "Non inclus", "Inclus"],
                    ["Répartition eau, charges, TEOM et régularisation", "Non inclus", "Non inclus", "Inclus"],
                    ["Simulateurs bailleur", "Non inclus", "Non inclus", "Inclus"],
                    ["Performance et cash-flow par bien", "Non inclus", "Non inclus", "Inclus"],
                    ["Aide à la déclaration et exports avancés", "Non inclus", "Non inclus", "Inclus"],
                  ].map(([feature, free, starter, essential]) => (
                    <tr key={feature}>
                      <td className="px-4 py-3 font-medium text-slate-900 sm:px-5">{feature}</td>
                      <td className="px-4 py-3">{free}</td>
                      <td className="px-4 py-3">{starter}</td>
                      <td className="px-4 py-3">{essential}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div data-scroll-reveal data-reveal-delay="0" className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5">
              <p className="text-sm font-semibold text-slate-900">Gratuit = gestion manuelle</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Un propriétaire peut tester un vrai usage : créer son logement, rattacher un bail, générer une quittance PDF, tenir ses archives et recevoir quatre alertes essentielles. Le partage avec le locataire et le portail en ligne nécessitent le plan Starter.
              </p>
            </div>
            <div data-scroll-reveal data-reveal-delay="80" className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5">
              <p className="text-sm font-semibold text-slate-900">Starter = candidatures + automatisation</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Le propriétaire paie quand lokt.fr enlève les tâches répétitives et active la relation locataire : validation paiement, quittances auto, relances, alertes avancées, portail locataire, partage des documents et accusés de réception.
              </p>
            </div>
            <div data-scroll-reveal data-reveal-delay="160" className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5">
              <p className="text-sm font-semibold text-slate-900">Essentiel = pilotage</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Le palier supérieur ajoute la vision investisseur et les outils métier : rentabilité, exports finance, aide à la déclaration, répartitions d’eau, charges, TEOM, régularisation et simulateurs bailleur.
              </p>
            </div>
          </section>

          <section data-scroll-reveal data-reveal-delay="0" className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[0.85fr,1.15fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold text-emerald-950">Un coût utile pour piloter votre location</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  Pour un bailleur LMNP, Pinel ou investisseur locatif, lokt.fr sert à organiser les loyers, quittances, justificatifs,
                  charges, états des lieux et exports. L’abonnement peut donc s’inscrire dans l’outillage de gestion du bien.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white/70 px-4 py-3 text-xs leading-5 text-emerald-950">
                À vérifier selon votre situation : la déduction fiscale éventuelle dépend du régime choisi, de l’usage réel du service et de
                la validation par votre expert-comptable ou conseil fiscal. lokt.fr aide à piloter, mais ne remplace pas un conseil fiscal personnalisé.
              </div>
            </div>
          </section>

          <section data-scroll-reveal data-reveal-delay="0" className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-950">Pro / Agence arrive ensuite</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
                  L’offre Pro / Agence n’est pas encore commercialisée. Elle sera construite autour de la gestion documentaire : dossiers
                  locataires, justificatifs, assurances, diagnostics, accès équipe et traçabilité. Les agences intéressées peuvent déjà nous
                  contacter pour cadrer le besoin.
                </p>
              </div>
              <a
                href="mailto:contact@lokt.fr?subject=Offre%20Pro%20Agence%20lokt.fr"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Contacter lokt.fr
              </a>
            </div>
          </section>

          <section data-scroll-reveal data-reveal-delay="0" className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5">
            <p className="text-sm font-semibold text-slate-900">Logement actif ou bail actif ?</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Les limites commerciales sont exprimées en <span className="font-semibold text-slate-900">logements actifs</span> : c’est le plus clair
              pour un propriétaire. En interne, les loyers, quittances et états des lieux restent rattachés aux baux actifs. Un logement archivé ou
              sans suivi locatif actif ne doit pas compter comme un usage courant.
            </p>
          </section>

          <section data-scroll-reveal data-reveal-delay="0" className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Vous hésitez sur le bon plan ?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Commencez gratuitement avec un logement actif. lokt.fr vous proposera l’abonnement seulement quand le besoin devient concret.
                </p>
              </div>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <Link href="/#espace-bailleur" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Voir l’espace bailleur
                </Link>
                <Link href="/gestion-locative-lmnp" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Gestion LMNP
                </Link>
                <Link href="/mon-compte?mode=register&redirect=/espace-bailleur" className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  Démarrer gratuitement
                </Link>
              </div>
            </div>
          </section>

          <p className="text-xs text-slate-500">
            Aucune carte bancaire demandée pour le plan gratuit.
          </p>
          </div>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
