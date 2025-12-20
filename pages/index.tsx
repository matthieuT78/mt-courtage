// pages/index.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
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

  // 🔐 Navigation vers les tools protégés
  const goToProtectedTool = (path: string) => {
    if (isLoggedIn) router.push(path);
    else router.push(`/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`);
  };

  // 🔐 Navigation vers espace bailleur (vendu)
  const goToLandlordTool = () => {
    const path = "/outils-proprietaire";
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
                      {/* ✅ LOGO PLUS GROS ICI */}
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

        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
          <p>© {new Date().getFullYear()} Izimo – Simulations indicatives.</p>
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

  // ===========================
  // CONNECTÉ
  // ===========================
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
            <h1 className="text-xl font-semibold text-slate-900">Bienvenue sur Izimo</h1>
            <p className="text-sm text-slate-600 mt-2">
              Accédez à vos calculettes et à votre espace bailleur.
            </p>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Link
                href="/capacite"
                className={`inline-flex items-center justify-center rounded-full ${brandBg} px-6 py-3 text-sm font-semibold text-white hover:opacity-95`}
              >
                Lancer une simulation
              </Link>
              <button
                type="button"
                onClick={goToLandlordTool}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Ouvrir l’espace bailleur
              </button>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} Izimo – Simulations indicatives.</p>
      </footer>
    </div>
  );
}
