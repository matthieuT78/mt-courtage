import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { supabase } from "../lib/supabaseClient";
import { PAID_BILLING_PLANS } from "../lib/billingPlans";

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
}: {
  plan: (typeof PAID_BILLING_PLANS)[number];
  billing: Billing;
  loading: boolean;
  onCheckout: (planId: string) => void;
}) {
  const isQuote = plan.monthlyPrice == null;
  const isComingSoon = plan.id === "landlord_unlimited";

  return (
    <article
      className={cx(
        "flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm",
        plan.recommended ? "border-cyan-300 ring-2 ring-cyan-100" : "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
          <p className="mt-1 text-xs text-slate-500">{plan.audience}</p>
        </div>
        {plan.recommended ? (
          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[0.68rem] font-semibold text-cyan-800">
            Recommandé
          </span>
        ) : isComingSoon ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.68rem] font-semibold text-amber-800">
            À venir
          </span>
        ) : null}
      </div>

      <div className="mt-4 min-h-[4.5rem]">
        <p className="text-2xl font-semibold leading-tight text-slate-950">{priceLabel(plan, billing)}</p>
        <p className="mt-1 text-xs text-slate-600">
          {isComingSoon ? "Module en préparation" : isQuote ? plan.limitLabel : billing === "monthly" ? `${plan.yearlyPrice} € / an` : "2 mois offerts"}
        </p>
      </div>

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
            <span className="text-cyan-700">✓</span>
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
            plan.recommended ? "bg-gradient-to-r from-indigo-700 to-cyan-500 hover:opacity-95" : "bg-slate-900 hover:bg-slate-800",
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
  const [billing, setBilling] = useState<Billing>("monthly");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } as any };
        if (!mounted) return;
        setIsLoggedIn(!!data.session?.user?.id);
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    const sub =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setIsLoggedIn(!!session?.user?.id);
        setChecking(false);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      mounted = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const startCheckout = async (planId: string) => {
    setCheckoutError(null);

    if (!isLoggedIn) {
      router.push(`/mon-compte?mode=register&redirect=${encodeURIComponent(`/tarifs?plan=${planId}`)}`);
      return;
    }

    setCheckoutLoading(planId);
    try {
      if (!supabase) throw new Error("Authentification indisponible.");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Merci de vous reconnecter avant de souscrire.");

      const resp = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId, billing }),
      });
      const payload = await resp.json();
      if (!resp.ok) throw new Error(payload?.error || "Impossible de démarrer le paiement.");
      if (!payload?.url) throw new Error("URL Stripe manquante.");
      window.location.href = payload.url;
    } catch (error: any) {
      setCheckoutError(error?.message || "Impossible de démarrer le paiement.");
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Head>
        <title>Tarifs espace bailleur | lokt.fr</title>
        <meta
          name="description"
          content="Tarifs lokt.fr pour propriétaires bailleurs : un logement gratuit, puis automatisation des quittances, pilotage finance, déclaration et offres pro."
        />
      </Head>

      <AppHeader />
      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[1fr,340px] lg:items-end">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Tarifs espace bailleur</p>
                <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight text-slate-950">
                  Gratuit pour démarrer, payant quand lokt.fr automatise et sécurise votre gestion.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Le premier logement actif reste gratuit pour tester le produit en conditions réelles. Les offres payantes ne vendent pas seulement
                  plus de volume : elles débloquent l’automatisation des quittances, les alertes, le pilotage financier et l’aide à la déclaration.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Facturation</p>
                <div className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white p-1">
                  {(["monthly", "yearly"] as Billing[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBilling(value)}
                      className={cx(
                        "rounded-lg px-4 py-2 text-xs font-semibold transition",
                        billing === value ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {value === "monthly" ? "Mensuel" : "Annuel"}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-600">L’annuel garde une remise lisible, sans engagement complexe.</p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-4">
            <article className="flex h-full flex-col rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Gratuit</p>
              <p className="mt-1 text-xs text-emerald-800">Gestion manuelle</p>
              <div className="mt-4 min-h-[4.5rem]">
                <p className="text-2xl font-semibold leading-tight text-slate-950">0 €</p>
                <p className="mt-1 text-xs text-slate-600">1 logement actif inclus</p>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                <li>✓ Bien, bail et locataire</li>
                <li>✓ Quittances manuelles et PDF</li>
                <li>✓ États des lieux et inventaire</li>
                <li>✓ Finance simple</li>
                <li className="text-slate-500">Automatisations email non incluses</li>
                <li className="text-slate-500">Aide déclaration premium non incluse</li>
              </ul>
              <Link
                href={isLoggedIn ? "/espace-bailleur" : "/mon-compte?mode=register&redirect=/espace-bailleur"}
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                {isLoggedIn ? "Accéder à mon espace" : "Créer un compte gratuit"}
              </Link>
            </article>

            {PAID_BILLING_PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billing={billing}
                loading={checkoutLoading === plan.id}
                onCheckout={startCheckout}
              />
            ))}
          </section>

          {checkoutError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{checkoutError}</div>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Gratuit = gestion manuelle</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Un propriétaire peut tester un vrai usage : créer son logement, rattacher un bail, générer une quittance PDF et garder ses archives.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Starter = automatisation</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Le propriétaire paie quand lokt.fr enlève les tâches répétitives : validation paiement, génération PDF, envoi email et rappels.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Essentiel = pilotage</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Le palier supérieur ajoute la vision investisseur : rentabilité, exports finance, aide à la déclaration et plans d’action.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
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
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Contacter lokt.fr
              </a>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Logement actif ou bail actif ?</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Les limites commerciales sont exprimées en <span className="font-semibold text-slate-900">logements actifs</span> : c’est le plus clair
              pour un propriétaire. En interne, les loyers, quittances et états des lieux restent rattachés aux baux actifs. Un logement archivé ou
              sans suivi locatif actif ne doit pas compter comme un usage courant.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Vous hésitez sur le bon plan ?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Commencez gratuitement avec un logement actif. lokt.fr vous proposera l’abonnement seulement quand le besoin devient concret.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/#espace-bailleur" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Voir l’espace bailleur
                </Link>
                <Link href="/mon-compte?mode=register&redirect=/espace-bailleur" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  Démarrer gratuitement
                </Link>
              </div>
            </div>
          </section>

          <p className="text-xs text-slate-500">
            {checking ? "Vérification de la session…" : isLoggedIn ? "Vous êtes connecté." : "Aucune carte bancaire demandée pour le plan gratuit."}
          </p>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
