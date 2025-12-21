// pages/tarifs.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { supabase } from "../lib/supabaseClient";

type Billing = "monthly" | "yearly";

type Plan = {
  name: string;
  badge: string;
  monthly: number;
  yearly: number;
  highlight?: boolean;
  tag?: { label: string; tone: "cyan" | "emerald" | "slate" };
  description: string;
  features: string[];
  cta: { label: string; kind: "primary" | "secondary" | "dark" | "mailto" };
  footnote?: string;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function formatPrice(billing: Billing, monthly: number, yearly: number) {
  return billing === "monthly" ? `${monthly} € / mois` : `${yearly} € / an`;
}

function subLabel(billing: Billing, yearly: number) {
  return billing === "monthly" ? `ou ${yearly} € / an` : "Facturation annuelle";
}

function Tag({ label, tone }: { label: string; tone: "cyan" | "emerald" | "slate" }) {
  const cls =
    tone === "cyan"
      ? "border-cyan-200 bg-cyan-50 text-cyan-700"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold", cls)}>
      {label}
    </span>
  );
}

function PlanCard({
  plan,
  billing,
  onPrimaryAction,
}: {
  plan: Plan;
  billing: Billing;
  onPrimaryAction: () => void;
}) {
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  const cardClass = cx(
    "rounded-3xl border bg-white shadow-sm p-6",
    plan.highlight ? "border-cyan-200 ring-2 ring-cyan-100" : "border-slate-200"
  );

  const ctaClass =
    plan.cta.kind === "primary"
      ? cx("w-full inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold", brandBg, brandText, brandHover)
      : plan.cta.kind === "secondary"
      ? "w-full inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
      : "w-full inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800";

  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
          <p className="text-[0.75rem] text-slate-500 mt-1">{plan.badge}</p>
        </div>
        {plan.tag ? <Tag label={plan.tag.label} tone={plan.tag.tone} /> : null}
      </div>

      <p className="mt-3 text-sm text-slate-600">{plan.description}</p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
          {billing === "monthly" ? "Abonnement mensuel" : "Abonnement annuel"}
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{formatPrice(billing, plan.monthly, plan.yearly)}</p>
        <p className="mt-1 text-[0.75rem] text-slate-600">{subLabel(billing, plan.yearly)}</p>
      </div>

      <ul className="mt-4 space-y-2 text-[0.8rem] text-slate-700">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {plan.cta.kind === "mailto" ? (
          <a
            href="mailto:mtcourtage@gmail.com?subject=Offre%20Agence%20-%20Izimo"
            className={ctaClass}
          >
            {plan.cta.label}
          </a>
        ) : (
          <button type="button" onClick={onPrimaryAction} className={ctaClass}>
            {plan.cta.label}
          </button>
        )}

        {plan.footnote ? (
          <p className="mt-2 text-[0.7rem] text-slate-500">{plan.footnote}</p>
        ) : null}
      </div>
    </article>
  );
}

export default function TarifsPage() {
  const router = useRouter();

  const [billing, setBilling] = useState<Billing>("monthly");
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!supabase) {
          if (!mounted) return;
          setIsLoggedIn(false);
          setChecking(false);
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setIsLoggedIn(!!data.session?.user?.id);
      } catch {
        if (!mounted) return;
        setIsLoggedIn(false);
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

  const goToLandlordTool = () => {
    const path = "/espace-bailleur";
    if (isLoggedIn) router.push(path);
    else router.push(`/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`);
  };

  const plans = useMemo(() => {
    const standard: Plan = {
      name: "Bailleur",
      badge: "Jusqu’à 5 baux",
      monthly: 29,
      yearly: 290,
      highlight: true,
      tag: { label: "Recommandé", tone: "cyan" },
      description: "Pour les particuliers (multi-biens) qui veulent automatiser la gestion locative sans agence.",
      features: [
        "Quittances de loyer : génération + archivage",
        "Historique par bien & par locataire",
        "Cautions & loyers : suivi dépôts / paiements / retards",
        "Rappels d’échéances (bientôt : mail/cron)",
        "États des lieux & documents (bientôt)",
      ],
      cta: { label: "Démarrer (Espace bailleur)", kind: "primary" },
      footnote: "Limite “particulier” : jusqu’à 5 baux actifs.",
    };

    const pro: Plan = {
      name: "Pro",
      badge: "6 à 25 baux",
      monthly: 59,
      yearly: 590,
      tag: { label: "Pro", tone: "emerald" },
      description: "Pour indépendants / gestion semi-pro. Plus de baux, plus d’automatisations, usage pro assumé.",
      features: [
        "Tout le plan Bailleur",
        "Gestion multi-lots optimisée (tableaux & filtres)",
        "Templates avancés (quittances / courriers)",
        "Export (CSV) & historique étendu",
        "Support prioritaire (email)",
      ],
      cta: { label: "Passer en Pro", kind: "secondary" },
      footnote: "Se déclenche à partir de 6 baux actifs.",
    };

    const agence: Plan = {
      name: "Agence",
      badge: "25+ baux",
      monthly: 99,
      yearly: 990,
      tag: { label: "Volume", tone: "slate" },
      description: "Pour les pros qui gèrent du volume : organisation, traçabilité et industrialisation.",
      features: [
        "Tout le plan Pro",
        "Rôles & accès (bientôt)",
        "Journal d’audit & logs email",
        "Envois automatiques avancés (bientôt)",
        "Onboarding & options sur-mesure",
      ],
      cta: { label: "Nous contacter", kind: "mailto" },
      footnote: "Pour agences, conciergeries, CGP…",
    };

    return [standard, pro, agence];
  }, []);

  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />
      <div className="h-1 w-full bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400" />

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* HERO */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={cx("h-1.5 w-full", brandBg)} />
            <div className="p-7 sm:p-9">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-3">
                    <div className="rounded-2xl bg-white border border-slate-200 p-2 shadow-sm">
                      <img src="/izimo-logo.png" alt="Izimo" className="h-9 sm:h-10 w-auto object-contain" />
                    </div>
                    <p className="hidden sm:block text-xs font-semibold tracking-wide text-slate-600">
                      Simuler • Décider • Gérer
                    </p>
                  </div>

                  <p className="text-[0.7rem] uppercase tracking-[0.20em] text-slate-500">Tarifs</p>
                  <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
                    Un prix clair, aligné sur votre volume de baux
                  </h1>

                  <p className="text-sm text-slate-600 max-w-2xl">
                    Les calculettes restent accessibles. L’abonnement concerne l’{" "}
                    <span className="font-semibold">Espace bailleur</span>, facturé selon le nombre de{" "}
                    <span className="font-semibold">baux actifs</span>.
                  </p>

                  <p className="text-[0.75rem] text-slate-500">
                    {checking ? "…" : isLoggedIn ? "Connecté" : "Visiteur"} — commencez quand vous voulez.
                  </p>
                </div>

                {/* Toggle */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-1 inline-flex self-start">
                  <button
                    type="button"
                    onClick={() => setBilling("monthly")}
                    className={cx(
                      "rounded-xl px-4 py-2 text-xs font-semibold transition",
                      billing === "monthly" ? cx(brandBg, brandText) : "text-slate-700 hover:bg-white"
                    )}
                  >
                    Mensuel
                  </button>
                  <button
                    type="button"
                    onClick={() => setBilling("yearly")}
                    className={cx(
                      "rounded-xl px-4 py-2 text-xs font-semibold transition",
                      billing === "yearly" ? cx(brandBg, brandText) : "text-slate-700 hover:bg-white"
                    )}
                  >
                    Annuel
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  ← Retour à l’accueil
                </Link>

                <button
                  type="button"
                  onClick={goToLandlordTool}
                  className={cx(
                    "inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold",
                    brandBg,
                    brandText,
                    brandHover
                  )}
                >
                  Ouvrir l’espace bailleur
                </button>
              </div>
            </div>
          </section>

          {/* PLANS */}
          <section className="grid gap-4 lg:grid-cols-3">
            {plans.map((p) => (
              <PlanCard key={p.name} plan={p} billing={billing} onPrimaryAction={goToLandlordTool} />
            ))}
          </section>

          {/* RULES */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
              Comment on compte les “baux” ?
            </p>
            <h2 className="text-base font-semibold text-slate-900">
              Un bail = une location active (un bien + un locataire)
            </h2>
            <div className="text-sm text-slate-600 space-y-2">
              <p>
                Un “bail actif” correspond à une relation{" "}
                <span className="font-semibold">bien ↔ locataire</span>.
              </p>
              <p>
                Les quittances restent historisées même si le locataire change : vous gardez l’historique.
              </p>
              <p className="text-[0.8rem] text-slate-500">
                Astuce produit : bloquez la création du 6e bail en offre Bailleur avec un CTA “upgrade”.
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-3">FAQ</p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Les calculettes sont-elles payantes ?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Non : elles restent accessibles. Le paiement concerne l’Espace bailleur (gestion locative).
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Pourquoi plus cher au-delà de 5 baux ?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Parce que l’usage devient professionnel (indépendants / gestion pour compte de tiers).
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Je peux passer de mensuel à annuel ?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Oui — vous pourrez le gérer depuis “Mon compte” une fois Stripe en place.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Et si je passe de 6 à 5 baux ?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Définissez une règle simple (au moment de la facturation, ou moyenne mensuelle).
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={goToLandlordTool}
                className={cx(
                  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold",
                  brandBg,
                  brandText,
                  brandHover
                )}
              >
                Démarrer maintenant
              </button>

              <Link
                href="/espace-bailleur"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Voir l’espace bailleur
              </Link>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
