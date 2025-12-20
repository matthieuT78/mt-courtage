// pages/index.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

export default function Home() {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const router = useRouter();

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

  const displayName = useMemo(() => {
    const n = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : null);
    return n || "à vous";
  }, [user]);

  // 🔐 Navigation vers les tools protégés
  const goToProtectedTool = (path: string) => {
    if (isLoggedIn) router.push(path);
    else router.push(`/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`);
  };

  // ✅ Espace bailleur : pointe vers /espace-bailleur
  const goToLandlordTool = () => {
    const path = "/espace-bailleur";
    if (isLoggedIn) router.push(path);
    else router.push(`/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`);
  };

  // 🎨 Brand Izimo
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  // ===========================
  // LANDING (non connecté)
  // ===========================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />

        <main className="flex-1 px-4 py-10">
          <div className="max-w-5xl mx-auto space-y-10">
            {/* HERO pub */}
            <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className={`h-1.5 w-full ${brandBg}`} />
              <div className="p-7 sm:p-10">
                <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                  {/* Texte */}
                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <img
                        src="/izimo-logo.png"
                        alt="Izimo"
                        className="h-16 sm:h-20 w-auto object-contain"
                      />
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
                        Suite immobilière • Simulations + Gestion locative
                      </span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 leading-tight">
                      Izimo vous aide à{" "}
                      <span className="text-slate-900">acheter</span>,{" "}
                      <span className="text-slate-900">investir</span> et surtout{" "}
                      <span className="text-slate-900">gérer vos locations</span>.
                    </h1>

                    <p className="text-sm text-slate-600">
                      Des calculettes simples et réalistes pour décider vite, et un{" "}
                      <span className="font-semibold">Espace bailleur</span> pour professionnaliser
                      votre gestion locative (quittances, cautions, états des lieux, rappels…).
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="button"
                        onClick={goToLandlordTool}
                        className={`inline-flex items-center justify-center rounded-full ${brandBg} px-6 py-3 text-sm font-semibold ${brandText} ${brandHover} shadow-md`}
                      >
                        Découvrir l’Espace bailleur Izimo
                      </button>

                      <Link
                        href="/capacite"
                        className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Essayer la calculette capacité (gratuit)
                      </Link>
                    </div>

                    <p className="text-[0.75rem] text-slate-500">
                      Aucun compte requis pour lancer la calculette de capacité. L’Espace bailleur
                      est un service premium.
                    </p>
                  </div>

                  {/* Carte focus produit */}
                  <div className="rounded-3xl border border-slate-200 bg-slate-900 text-white p-6 sm:p-7 relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-30 blur-3xl bg-cyan-500" />
                    <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl bg-indigo-600" />

                    <div className="relative space-y-4">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">
                        Produit principal
                      </p>
                      <h2 className="text-xl font-semibold">Espace bailleur • Gestion locative</h2>
                      <p className="text-sm text-slate-200">
                        Conçu pour gagner du temps, éviter les oublis et centraliser vos documents.
                      </p>

                      <div className="grid gap-3 sm:grid-cols-2 pt-2">
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                          <p className="font-semibold text-sm">Quittances PDF</p>
                          <p className="text-xs text-slate-200 mt-1">
                            Génération automatique et historique.
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                          <p className="font-semibold text-sm">Dépôts de garantie</p>
                          <p className="text-xs text-slate-200 mt-1">
                            Suivi, restitutions et rappels.
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                          <p className="font-semibold text-sm">États des lieux</p>
                          <p className="text-xs text-slate-200 mt-1">
                            Modèles prêts à remplir + archivage.
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                          <p className="font-semibold text-sm">Rappels & échéances</p>
                          <p className="text-xs text-slate-200 mt-1">
                            Assurances, révisions, renouvellements.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-300">À partir de</p>
                          <p className="text-2xl font-semibold text-cyan-200">29 € / mois</p>
                          <p className="text-xs text-slate-300">
                            ou <span className="font-semibold text-white">290 € / an</span>
                          </p>
                        </div>
                        <Link
                          href="/tarifs"
                          className="text-sm font-semibold text-white underline decoration-white/30 hover:decoration-white/60"
                        >
                          Voir les tarifs →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* “Izimo c’est…” : suite de calculettes */}
            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
              <div className="space-y-2">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                  Izimo, en bref
                </p>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                  Les calculettes pour décider + l’outil pour gérer
                </h2>
                <p className="text-sm text-slate-600 max-w-3xl">
                  Faites vos simulations (gratuit) et passez à la gestion locative (premium) quand
                  vous êtes prêt à structurer votre parc.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
                <Link
                  href="/capacite"
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
                >
                  <p className="text-sm font-semibold text-slate-900">Capacité d’emprunt</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Mensualité max, capital empruntable, prix indicatif.
                  </p>
                  <p className="text-xs font-semibold mt-3 text-slate-900 underline decoration-slate-300">
                    Lancer →
                  </p>
                </Link>

                <button
                  type="button"
                  onClick={() => goToProtectedTool("/investissement")}
                  className="text-left rounded-3xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
                >
                  <p className="text-sm font-semibold text-slate-900">Rentabilité locative</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Cash-flow net, rendement réel, effort d’épargne.
                  </p>
                  <p className="text-xs font-semibold mt-3 text-slate-900 underline decoration-slate-300">
                    Découvrir →
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => goToProtectedTool("/pret-relais")}
                  className="text-left rounded-3xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
                >
                  <p className="text-sm font-semibold text-slate-900">Achat-revente / relais</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Budget réaliste, relais, reste à vivre.
                  </p>
                  <p className="text-xs font-semibold mt-3 text-slate-900 underline decoration-slate-300">
                    Découvrir →
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => goToProtectedTool("/parc-immobilier")}
                  className="text-left rounded-3xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
                >
                  <p className="text-sm font-semibold text-slate-900">Parc immobilier</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Vision globale, encours, cash-flow total.
                  </p>
                  <p className="text-xs font-semibold mt-3 text-slate-900 underline decoration-slate-300">
                    Découvrir →
                  </p>
                </button>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={goToLandlordTool}
                  className={`inline-flex items-center justify-center rounded-full ${brandBg} px-6 py-3 text-sm font-semibold ${brandText} ${brandHover}`}
                >
                  Démarrer l’Espace bailleur (premium)
                </button>

                <Link
                  href="/tarifs"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Comparer les offres
                </Link>
              </div>
            </section>

            {/* Preuve / rassurance */}
            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Simple & rapide</p>
                <p className="text-sm text-slate-600 mt-2">
                  Izimo va droit au but : chiffres utiles, décisions plus rapides.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Pensé pour les bailleurs</p>
                <p className="text-sm text-slate-600 mt-2">
                  Centralisez documents, échéances et suivi par bail.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Évolutif</p>
                <p className="text-sm text-slate-600 mt-2">
                  Commencez avec les calculettes, passez à la gestion quand votre parc grandit.
                </p>
              </div>
            </section>
          </div>
        </main>

        <AppFooter />
      </div>
    );
  }

  // ===========================
  // CONNECTÉ — WAOU (sans les 3 cases à droite)
  // ===========================
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* HERO connecté */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${brandBg}`} />
            <div className="p-7 sm:p-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-3">
                  <div className="rounded-2xl bg-white border border-slate-200 p-2 shadow-sm">
                    <img
                      src="/izimo-logo.png"
                      alt="Izimo"
                      className="h-9 sm:h-10 w-auto object-contain"
                    />
                  </div>
                  <span className="hidden sm:inline text-xs font-semibold tracking-wide text-slate-600">
                    Simuler • Décider • Gérer
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
                  Bonjour {displayName} 👋
                </h1>

                <p className="text-sm text-slate-600 max-w-3xl">
                  Votre espace Izimo est prêt. Lancez une simulation, comparez vos scénarios, puis
                  centralisez votre gestion locative dans l’espace bailleur.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Link
                    href="/calculettes"
                    className={`inline-flex items-center justify-center rounded-full ${brandBg} px-6 py-3 text-sm font-semibold ${brandText} ${brandHover} shadow-md`}
                  >
                    Ouvrir les calculettes
                  </Link>

                  <Link
                    href="/espace-bailleur"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Ouvrir l’espace bailleur →
                  </Link>

                  <Link
                    href="/tarifs"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Mon abonnement
                  </Link>
                </div>

                <div className="pt-2 text-[0.75rem] text-slate-500">
                  Raccourcis :{" "}
                  <Link
                    href="/capacite"
                    className="underline decoration-slate-300 hover:decoration-slate-500"
                  >
                    capacité
                  </Link>
                  {" • "}
                  <Link
                    href="/investissement"
                    className="underline decoration-slate-300 hover:decoration-slate-500"
                  >
                    rentabilité
                  </Link>
                  {" • "}
                  <Link
                    href="/pret-relais"
                    className="underline decoration-slate-300 hover:decoration-slate-500"
                  >
                    prêt relais
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Parcours */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">1 • Simuler</p>
              <p className="mt-1 text-base font-semibold text-slate-900">Capacité & scénarios</p>
              <p className="mt-2 text-sm text-slate-600">
                Évaluez votre budget, mensualité et points d’équilibre en quelques clics.
              </p>
              <div className="mt-4">
                <Link
                  href="/capacite"
                  className="text-sm font-semibold text-slate-900 underline decoration-slate-300"
                >
                  Lancer une simulation →
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">2 • Décider</p>
              <p className="mt-1 text-base font-semibold text-slate-900">Rentabilité & arbitrage</p>
              <p className="mt-2 text-sm text-slate-600">
                Comparez cash-flow, rendement, effort d’épargne et scénarios de financement.
              </p>
              <div className="mt-4">
                <Link
                  href="/investissement"
                  className="text-sm font-semibold text-slate-900 underline decoration-slate-300"
                >
                  Ouvrir l’analyse →
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-900 text-white p-6 shadow-sm relative overflow-hidden">
              <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-30 blur-3xl bg-cyan-500" />
              <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl bg-indigo-600" />

              <div className="relative">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">3 • Gérer</p>
                <p className="mt-1 text-base font-semibold text-white">Espace bailleur</p>
                <p className="mt-2 text-sm text-slate-200">
                  Centralisez vos baux, quittances, dépôts de garantie, états des lieux et rappels.
                </p>

                <div className="mt-4 flex gap-2">
                  <Link
                    href="/espace-bailleur"
                    className={`inline-flex items-center justify-center rounded-full ${brandBg} px-4 py-2 text-sm font-semibold ${brandText} ${brandHover}`}
                  >
                    Ouvrir →
                  </Link>
                  <Link
                    href="/tarifs"
                    className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Tarifs
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Hub outils */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Hub</p>
                <h2 className="mt-1 text-lg sm:text-xl font-semibold text-slate-900">
                  Accès rapide à vos outils
                </h2>
                <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                  Tout ce dont vous avez besoin pour avancer : simulations, analyses et gestion.
                </p>
              </div>
              <Link
                href="/calculettes"
                className="hidden sm:inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Voir toutes les calculettes →
              </Link>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link
                href="/capacite"
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
              >
                <p className="text-sm font-semibold text-slate-900">Capacité d’emprunt</p>
                <p className="text-xs text-slate-600 mt-1">Budget, mensualité, prix indicatif.</p>
                <p className="text-xs font-semibold mt-3 text-slate-900 underline decoration-slate-300">
                  Ouvrir →
                </p>
              </Link>

              <Link
                href="/investissement"
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
              >
                <p className="text-sm font-semibold text-slate-900">Rentabilité locative</p>
                <p className="text-xs text-slate-600 mt-1">Cash-flow, rendement, effort.</p>
                <p className="text-xs font-semibold mt-3 text-slate-900 underline decoration-slate-300">
                  Ouvrir →
                </p>
              </Link>

              <Link
                href="/pret-relais"
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
              >
                <p className="text-sm font-semibold text-slate-900">Prêt relais</p>
                <p className="text-xs text-slate-600 mt-1">Achat-revente & relais.</p>
                <p className="text-xs font-semibold mt-3 text-slate-900 underline decoration-slate-300">
                  Ouvrir →
                </p>
              </Link>

              <Link
                href="/parc-immobilier"
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 hover:bg-white hover:shadow-md transition"
              >
                <p className="text-sm font-semibold text-slate-900">Parc immobilier</p>
                <p className="text-xs text-slate-600 mt-1">Vue globale & cash-flow total.</p>
                <p className="text-xs font-semibold mt-3 text-slate-900 underline decoration-slate-300">
                  Ouvrir →
                </p>
              </Link>
            </div>

            <div className="mt-6 sm:hidden">
              <Link
                href="/calculettes"
                className={`inline-flex w-full items-center justify-center rounded-full ${brandBg} px-6 py-3 text-sm font-semibold ${brandText} ${brandHover}`}
              >
                Voir toutes les calculettes
              </Link>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
