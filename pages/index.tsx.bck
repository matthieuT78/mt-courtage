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
        setUser((data.session?.user as any) ?? null);
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
        setUser((session?.user as any) ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const displayName =
    user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : null);

  const isLoggedIn = !!user;

  // 🔐: pour la boîte à outils bailleur (si pas connecté -> login)
  const goToLandlordTool = () => {
    const path = "/outils-proprietaire";
    if (isLoggedIn) router.push(path);
    else router.push(`/mon-compte?mode=login&redirect=${encodeURIComponent(path)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* HERO / introduction */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-600">Étude gratuite</p>

              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
                {displayName
                  ? `Bonjour ${displayName}, estimez votre capacité d’emprunt immobilier.`
                  : "Estimez votre capacité d’emprunt immobilier en quelques minutes."}
              </h1>

              <p className="text-xs text-slate-600 max-w-2xl">
                Revenus, charges, crédits en cours et loyers locatifs pris à 70&nbsp;% : obtenez une
                estimation réaliste de votre mensualité maximale, du capital empruntable et d&apos;un
                prix de bien indicatif à présenter à votre banque ou à votre courtier.
              </p>

              {!isLoggedIn && (
                <p className="text-[0.7rem] text-slate-500">
                  Les calculettes sont accessibles gratuitement. En créant votre espace, vous pourrez
                  sauvegarder vos simulations et retrouver votre historique.
                </p>
              )}
            </div>

            {/* CTA central : lancer la simulation */}
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                href="/capacite"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-md"
              >
                Lancer la simulation de capacité d&apos;emprunt
              </Link>

              <p className="text-[0.7rem] text-slate-500">
                Simulation 100&nbsp;% gratuite, sans engagement.{" "}
                {isLoggedIn
                  ? "Vous pourrez ensuite sauvegarder vos résultats dans votre espace."
                  : "Aucun compte requis pour lancer une première étude."}
              </p>
            </div>
          </section>

          {/* OUTILS : calculettes gratuites + boîte à outils bailleur (payante) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-6 space-y-5">
            <div className="space-y-1">
              <p className="text-[0.7rem] uppercase tracking-[0.20em] text-slate-500">
                OUTILS IMMOBILIERS
              </p>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                Calculettes gratuites & boîte à outils propriétaire
              </h2>
              <p className="text-xs text-slate-600 max-w-2xl">
                Les calculettes vous aident à décider (gratuit). La boîte à outils propriétaire vous
                aide à gérer vos locations au quotidien (abonnement).
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2 mt-2">
              {/* Colonne gauche : calculettes GRATUITES */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-700">
                      Calculettes immobilières gratuites
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      Décidez avant d’acheter ou d’investir
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-600">
                      Capacité d’emprunt, investissement locatif, prêt relais, parc immobilier :
                      des outils clairs pour prendre les bonnes décisions, sans engagement.
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-right shrink-0">
                    <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Accès</p>
                    <p className="text-base font-semibold text-slate-900 leading-tight">Gratuit</p>
                    <p className="text-[0.65rem] text-emerald-700">Sans carte • Sans limite</p>
                  </div>
                </div>

                {/* 4 cartes cliquables */}
                <div className="grid gap-3 md:grid-cols-2">
                  <Link
                    href="/capacite"
                    className="text-left rounded-2xl border border-slate-200 bg-white p-3 space-y-2 cursor-pointer hover:bg-slate-100 hover:shadow-md transition"
                  >
                    <div className="inline-flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-base">
                        🧮
                      </div>
                      <p className="text-[0.75rem] font-semibold text-slate-900">Capacité d’emprunt</p>
                    </div>
                    <ul className="space-y-0.5 text-[0.7rem] text-slate-700">
                      <li>• Mensualité max & capital</li>
                      <li>• Prix de bien indicatif</li>
                    </ul>
                  </Link>

                  <Link
                    href="/investissement"
                    className="text-left rounded-2xl border border-slate-200 bg-white p-3 space-y-2 cursor-pointer hover:bg-slate-100 hover:shadow-md transition"
                  >
                    <div className="inline-flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-base">
                        📈
                      </div>
                      <p className="text-[0.75rem] font-semibold text-slate-900">
                        Investissement locatif
                      </p>
                    </div>
                    <ul className="space-y-0.5 text-[0.7rem] text-slate-700">
                      <li>• Cash-flow net & rendement</li>
                      <li>• Effort d’épargne</li>
                    </ul>
                  </Link>

                  <Link
                    href="/pret-relais"
                    className="text-left rounded-2xl border border-slate-200 bg-white p-3 space-y-2 cursor-pointer hover:bg-slate-100 hover:shadow-md transition"
                  >
                    <div className="inline-flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-base">
                        🔁
                      </div>
                      <p className="text-[0.75rem] font-semibold text-slate-900">
                        Achat-revente / prêt relais
                      </p>
                    </div>
                    <ul className="space-y-0.5 text-[0.7rem] text-slate-700">
                      <li>• Budget & relais</li>
                      <li>• Reste à vivre</li>
                    </ul>
                  </Link>

                  <Link
                    href="/parc-immobilier"
                    className="text-left rounded-2xl border border-slate-200 bg-white p-3 space-y-2 cursor-pointer hover:bg-slate-100 hover:shadow-md transition"
                  >
                    <div className="inline-flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-base">
                        🧩
                      </div>
                      <p className="text-[0.75rem] font-semibold text-slate-900">Parc immobilier</p>
                    </div>
                    <ul className="space-y-0.5 text-[0.7rem] text-slate-700">
                      <li>• Vue globale</li>
                      <li>• Cash-flow & encours</li>
                    </ul>
                  </Link>
                </div>

                <div className="pt-1">
                  <Link
                    href={isLoggedIn ? "/mon-compte" : "/mon-compte?mode=register"}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[0.75rem] font-semibold text-white hover:bg-slate-800 shadow-sm"
                  >
                    {isLoggedIn ? "Ouvrir mon espace" : "Créer mon espace (gratuit)"}
                  </Link>
                </div>
              </div>

              {/* Colonne droite : boîte à outils propriétaire (abonnement) */}
              <div className="rounded-2xl border border-slate-200 bg-slate-900 text-slate-50 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-300">
                      Boîte à outils propriétaire
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">Le kit du bailleur exigeant</p>
                    <p className="mt-1 text-[0.7rem] text-slate-200 max-w-sm">
                      Quand vous passez de la simulation à la gestion réelle : quittances, cautions,
                      documents, rappels… Tout au même endroit.
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-800 border border-amber-300/60 px-3 py-2 text-right shrink-0">
                    <p className="text-[0.65rem] text-slate-200 uppercase tracking-[0.14em]">
                      Abonnement mensuel
                    </p>
                    <p className="text-base font-semibold text-amber-300 leading-tight">29&nbsp;€ / mois</p>
                    <p className="text-[0.65rem] text-slate-300">Pour bailleurs multi-biens.</p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-[0.7rem] text-slate-100 mt-1">
                  <li>• Génération automatique de quittances PDF</li>
                  <li>• Suivi des dépôts de garantie et restitutions</li>
                  <li>• Modèles d’états des lieux & documents</li>
                  <li>• Rappels des échéances importantes</li>
                </ul>

                <div className="pt-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={goToLandlordTool}
                    className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-[0.8rem] font-semibold text-slate-900 hover:bg-amber-300 shadow-md"
                  >
                    Découvrir la boîte à outils propriétaire
                  </button>
                  <p className="text-[0.65rem] text-slate-300 max-w-sm">
                    Idéal si vous gérez plusieurs lots et souhaitez professionnaliser vos process sans
                    multiplier les logiciels.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Simulations indicatives.
        </p>
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
