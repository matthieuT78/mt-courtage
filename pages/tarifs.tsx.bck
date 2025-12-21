// pages/tarifs.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type Billing = "monthly" | "yearly";

export default function TarifsPage() {
  const router = useRouter();

  // Toggle pricing (Mensuel / Annuel)
  const [billing, setBilling] = useState<Billing>("monthly");

  // Session (pour adapter le CTA)
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
        setChecking(false);
      } catch {
        if (!mounted) return;
        setIsLoggedIn(false);
        setChecking(false);
      }
    })();

    const { data: sub } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setIsLoggedIn(!!session?.user?.id);
        setChecking(false);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // CTA vers l’espace bailleur (et login si besoin)
  const goToLandlordTool = () => {
    const path = "/outils-proprietaire";
    if (isLoggedIn) router.push(path);
    else router.push(`/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`);
  };

  const plans = useMemo(() => {
    // 👉 Tarifs discutés ensemble : Standard 29€/mois ou 290€/an
    // 👉 Ajout “Pro” au-delà de 5 baux (limite pro)
    const standard = {
      name: "Bailleur",
      badge: "Jusqu’à 5 baux",
      monthly: 29,
      yearly: 290,
      highlight: true,
      description:
        "Pour les particuliers (multi-biens) qui veulent automatiser la gestion locative sans agence.",
      features: [
        "Quittances de loyer : génération + archivage",
        "Historique par bien & par locataire",
        "Cautions & loyers : suivi dépôts / paiements / retards",
        "Rappels d’échéances (bientôt : mail/cron)",
        "États des lieux & documents (bientôt)",
      ],
      cta: "Démarrer (Espace bailleur)",
    };

    const pro = {
      name: "Pro",
      badge: "6 à 25 baux",
      monthly: 59,
      yearly: 590,
      highlight: false,
      description:
        "Pour indépendants / gestion semi-pro. Plus de baux, plus d’automatisations et un usage professionnel assumé.",
      features: [
        "Tout le plan Bailleur",
        "Gestion multi-lots optimisée (tableaux & filtres)",
        "Templates avancés (quittances / courriers)",
        "Export (CSV) & historique étendu",
        "Support prioritaire (email)",
      ],
      cta: "Passer en Pro",
    };

    const agence = {
      name: "Agence",
      badge: "25+ baux",
      monthly: 99,
      yearly: 990,
      highlight: false,
      description:
        "Pour les pros qui gèrent du volume : organisation, traçabilité, et industrialisation.",
      features: [
        "Tout le plan Pro",
        "Rôles & accès (bientôt)",
        "Journal d’audit & logs email",
        "Envois automatiques avancés (bientôt)",
        "Onboarding & options sur-mesure",
      ],
      cta: "Nous contacter",
    };

    return { standard, pro, agence };
  }, []);

  const priceLabel = (monthly: number, yearly: number) => {
    return billing === "monthly" ? `${monthly} € / mois` : `${yearly} € / an`;
  };

  const subLabel = (billing: Billing, yearly: number) => {
    if (billing === "monthly") return `ou ${yearly} € / an`;
    return "Facturation annuelle";
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* HERO */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-[0.7rem] uppercase tracking-[0.20em] text-slate-500">
                  Tarifs
                </p>
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
                  Un prix clair, aligné sur votre volume de baux
                </h1>
                <p className="text-sm text-slate-600 max-w-2xl">
                  Les calculettes immobilières restent accessibles, et la boîte à outils bailleur est
                  facturée selon le nombre de <span className="font-semibold">baux actifs</span>.
                  Au-delà de 5 baux, on passe sur une offre “Pro”.
                </p>
              </div>

              {/* Toggle billing */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-1 inline-flex self-start">
                <button
                  type="button"
                  onClick={() => setBilling("monthly")}
                  className={
                    "rounded-xl px-4 py-2 text-xs font-semibold transition " +
                    (billing === "monthly"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-white")
                  }
                >
                  Mensuel
                </button>
                <button
                  type="button"
                  onClick={() => setBilling("yearly")}
                  className={
                    "rounded-xl px-4 py-2 text-xs font-semibold transition " +
                    (billing === "yearly"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-white")
                  }
                >
                  Annuel
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                ← Retour à l’accueil
              </Link>

              <button
                type="button"
                onClick={goToLandlordTool}
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-300"
              >
                Ouvrir la boîte à outils bailleur
              </button>
            </div>
          </section>

          {/* PLANS */}
          <section className="grid gap-4 lg:grid-cols-3">
            {/* Bailleur */}
            <article
              className={
                "rounded-2xl border shadow-sm p-6 bg-white " +
                (plans.standard.highlight ? "border-amber-300 ring-2 ring-amber-200" : "border-slate-200")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{plans.standard.name}</p>
                  <p className="text-[0.75rem] text-slate-500 mt-1">{plans.standard.badge}</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">
                  Recommandé
                </span>
              </div>

              <p className="mt-3 text-sm text-slate-600">{plans.standard.description}</p>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                  {billing === "monthly" ? "Abonnement mensuel" : "Abonnement annuel"}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {priceLabel(plans.standard.monthly, plans.standard.yearly)}
                </p>
                <p className="mt-1 text-[0.75rem] text-slate-600">
                  {subLabel(billing, plans.standard.yearly)}
                </p>
              </div>

              <ul className="mt-4 space-y-2 text-[0.8rem] text-slate-700">
                {plans.standard.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={goToLandlordTool}
                  className="w-full inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {plans.standard.cta}
                </button>

                <p className="mt-2 text-[0.7rem] text-slate-500">
                  Limite “particulier” : jusqu’à <span className="font-semibold">5 baux actifs</span>.
                </p>
              </div>
            </article>

            {/* Pro */}
            <article className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{plans.pro.name}</p>
                  <p className="text-[0.75rem] text-slate-500 mt-1">{plans.pro.badge}</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700">
                  Pro
                </span>
              </div>

              <p className="mt-3 text-sm text-slate-600">{plans.pro.description}</p>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                  {billing === "monthly" ? "Abonnement mensuel" : "Abonnement annuel"}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {priceLabel(plans.pro.monthly, plans.pro.yearly)}
                </p>
                <p className="mt-1 text-[0.75rem] text-slate-600">
                  {subLabel(billing, plans.pro.yearly)}
                </p>
              </div>

              <ul className="mt-4 space-y-2 text-[0.8rem] text-slate-700">
                {plans.pro.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={goToLandlordTool}
                  className="w-full inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  {plans.pro.cta}
                </button>

                <p className="mt-2 text-[0.7rem] text-slate-500">
                  Se déclenche à partir de <span className="font-semibold">6 baux actifs</span>.
                </p>
              </div>
            </article>

            {/* Agence */}
            <article className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{plans.agence.name}</p>
                  <p className="text-[0.75rem] text-slate-500 mt-1">{plans.agence.badge}</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-700">
                  Volume
                </span>
              </div>

              <p className="mt-3 text-sm text-slate-600">{plans.agence.description}</p>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                  {billing === "monthly" ? "Abonnement mensuel" : "Abonnement annuel"}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {priceLabel(plans.agence.monthly, plans.agence.yearly)}
                </p>
                <p className="mt-1 text-[0.75rem] text-slate-600">
                  {subLabel(billing, plans.agence.yearly)}
                </p>
              </div>

              <ul className="mt-4 space-y-2 text-[0.8rem] text-slate-700">
                {plans.agence.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                <a
                  href="mailto:mtcourtage@gmail.com?subject=Offre%20Agence%20-%20ImmoPilot"
                  className="w-full inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {plans.agence.cta}
                </a>

                <p className="mt-2 text-[0.7rem] text-slate-500">
                  Si vous gérez des portefeuilles (agence, conciergerie, CGP…).
                </p>
              </div>
            </article>
          </section>

          {/* RULES / LIMIT */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
              Comment on compte les “baux” ?
            </p>
            <h2 className="text-base font-semibold text-slate-900">
              Un bail = une location active (un bien + un locataire)
            </h2>
            <div className="text-sm text-slate-600 space-y-2">
              <p>
                Un “bail actif” correspond à une relation <span className="font-semibold">bien ↔ locataire</span>
                (dans ta table <span className="font-mono text-xs">leases</span> avec un statut actif).
              </p>
              <p>
                Les quittances restent historisées même si le locataire change (studio / rotation annuelle),
                tu gardes l’historique des locataires et des quittances par bail.
              </p>
              <p className="text-[0.8rem] text-slate-500">
                Techniquement : tu peux faire respecter la limite via un compteur “baux actifs” et bloquer
                la création du 6e bail en offre Bailleur (avec un CTA upgrade).
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-3">FAQ</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Les calculettes immobilières sont-elles payantes ?
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Non : elles servent de porte d’entrée et restent accessibles. Le paiement concerne la
                  gestion locative (bailleur).
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Pourquoi un prix plus élevé au-delà de 5 baux ?
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Parce que l’usage devient professionnel (indépendants / gestion pour compte de tiers).
                  Tu protèges ton modèle et tu adaptes la valeur au volume.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Annuel ou mensuel : je peux changer ?
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Oui, tu peux proposer un changement dans l’espace “Mon compte” une fois Stripe en place.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Et si j’ai 6 baux un mois puis 5 le mois suivant ?
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Le plus simple : on se base sur le nombre de baux actifs au moment de la facturation
                  (ou une moyenne mensuelle). On peut définir une règle claire.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={goToLandlordTool}
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
              >
                Démarrer maintenant
              </button>
              <Link
                href="/outils-proprietaire"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Voir les fonctionnalités
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} ImmoPilot</p>
        <p className="mt-1">
          Contact :{" "}
          <a href="mailto:mtcourtage@gmail.com" className="underline">
            mtcourtage@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
