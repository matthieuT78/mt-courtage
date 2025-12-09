// pages/index.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

// Icône euro / financement (sobre)
function IconEuro() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 text-emerald-700"
    >
      <path
        d="M15.5 5.5a6 6 0 0 0-5.657 3.9H7.5a.75.75 0 0 0 0 1.5h1.91a5.9 5.9 0 0 0 0 2.2H7.5a.75.75 0 0 0 0 1.5h2.343A6 6 0 0 0 15.5 18.5a.75.75 0 0 0 0-1.5 4.5 4.5 0 0 1-4.14-2.5h2.64a.75.75 0 0 0 0-1.5h-3.1a5.3 5.3 0 0 1 0-2.2h3.1a.75.75 0 0 0 0-1.5h-2.64A4.5 4.5 0 0 1 15.5 7a.75.75 0 0 0 0-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Icône cadenas (pour les fonctionnalités réservées)
function IconLock() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 text-slate-500"
    >
      <path
        d="M8.75 10V8a3.25 3.25 0 0 1 6.5 0v2h.25A2.75 2.75 0 0 1 18.25 12.75v5A2.75 2.75 0 0 1 15.5 20.5h-7A2.75 2.75 0 0 1 5.75 17.75v-5A2.75 2.75 0 0 1 8.5 10h.25Zm1.5 0h3.5V8a1.75 1.75 0 0 0-3.5 0v2Zm-1.75 1.5A1.25 1.25 0 0 0 7.25 12.75v5c0 .69.56 1.25 1.25 1.25h7c.69 0 1.25-.56 1.25-1.25v-5A1.25 1.25 0 0 0 15.5 11.5h-7Zm3.5 2a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0v-1.25a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
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

  const displayName =
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : null);

  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* 👉 Si connecté : header complet. Si non connecté : header ultra simple sans menu */}
      {isLoggedIn ? (
        <AppHeader />
      ) : (
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">
                MT Courtage &amp; Investissement
              </span>
            </div>
            <Link
              href="/mon-compte?mode=login"
              className="text-[0.75rem] font-semibold text-slate-600 hover:text-slate-900"
            >
              Se connecter
            </Link>
          </div>
        </header>
      )}

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* HERO : calculette capacité d'emprunt (accès gratuit, ultra mise en avant) */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-6 md:p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-600">
              Étude gratuite – sans inscription obligatoire
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              {displayName
                ? `Bonjour ${displayName}, calculez précisément votre capacité d’emprunt immobilier.`
                : "Calculez précisément votre capacité d’emprunt immobilier."}
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              La calculette reproduit une logique proche de celle des banques :
              revenus, charges, crédits en cours, loyers locatifs pris à 70&nbsp;%, taux
              d’endettement cible, paramètres du nouveau prêt… Vous obtenez un
              budget d’achat crédible pour préparer vos démarches.
            </p>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <IconEuro />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Calculette Capacité d&apos;emprunt avancée
                </p>
                <p className="text-xs text-slate-500">
                  Étude gratuite, résultats immédiatement affichés à l’écran.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <Link
                href="/capacite"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm"
              >
                Lancer l&apos;étude de capacité
              </Link>
              {!isLoggedIn ? (
                <p className="text-[0.7rem] text-slate-500 max-w-xs">
                  Pas besoin de compte pour réaliser l&apos;étude. À la fin, vous
                  pourrez créer un espace pour sauvegarder vos résultats et
                  débloquer les autres simulateurs.
                </p>
              ) : (
                <p className="text-[0.7rem] text-slate-500">
                  Vos simulations peuvent être sauvegardées dans votre espace
                  personnel.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Ce que l'étude va fournir */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Ce que vous obtenez
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            Une vision claire de votre budget immobilier
          </h2>

          <div className="grid gap-4 md:grid-cols-3 mt-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
              <p className="text-xs font-semibold text-slate-900 mb-1">
                Mensualité & capital empruntable
              </p>
              <p className="text-[0.75rem] text-slate-500">
                Estimation de votre mensualité maximale et du montant de crédit
                que vous pouvez raisonnablement envisager.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
              <p className="text-xs font-semibold text-slate-900 mb-1">
                Prix de bien & budget global
              </p>
              <p className="text-[0.75rem] text-slate-500">
                Ordre de grandeur du prix de bien accessible, frais de notaire
                et d’agence inclus dans le financement.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
              <p className="text-xs font-semibold text-slate-900 mb-1">
                Taux d&apos;endettement avant / après projet
              </p>
              <p className="text-[0.75rem] text-slate-500">
                Comparaison de votre situation actuelle et après projet pour
                vérifier votre cohérence avec les standards bancaires.
              </p>
            </div>
          </div>

          <p className="mt-2 text-[0.7rem] text-slate-500">
            La calculette est accessible gratuitement et sans engagement. Les
            résultats restent indicatifs et doivent être confirmés par votre
            banque ou votre courtier.
          </p>
        </section>

        {/* Marketing : version complète / simulateurs avancés (payants / réservés inscrits) */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Aller plus loin
          </p>
          <h2 className="text-sm font-semibold text-slate-900">
            Débloquez les simulateurs avancés en créant votre espace
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            En vous inscrivant, vous accéderez à l&apos;ensemble des outils pour
            construire une vraie stratégie patrimoniale : investissement locatif,
            achat revente / prêt relais, analyse détaillée de votre parc
            immobilier… La version payante intégrera progressivement des
            fonctionnalités avancées (historique, comparatifs, exports PDF,
            scénarios multiples).
          </p>

          <div className="grid gap-3 md:grid-cols-3 mt-3">
            {/* Investissement locatif */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href =
                    "/mon-compte?mode=login&redirect=/investissement";
                }
              }}
              className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left flex flex-col gap-2 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  Investissement locatif
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[0.65rem] font-semibold text-white px-2 py-0.5">
                  <IconLock />
                  Réservé aux membres
                </span>
              </div>
              <p className="text-[0.7rem] text-slate-500">
                Analyse fine des loyers, charges, crédit et cash-flow sur un ou
                plusieurs biens, en longue durée ou saisonnière.
              </p>
            </button>

            {/* Achat revente / prêt relais */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href =
                    "/mon-compte?mode=login&redirect=/pret-relais";
                }
              }}
              className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left flex flex-col gap-2 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  Achat revente / prêt relais
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[0.65rem] font-semibold text-white px-2 py-0.5">
                  <IconLock />
                  Réservé aux membres
                </span>
              </div>
              <p className="text-[0.7rem] text-slate-500">
                Estimez votre budget d&apos;achat en combinant prêt relais, nouveau
                crédit, revente et apport personnel.
              </p>
            </button>

            {/* Parc immobilier existant */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href =
                    "/mon-compte?mode=login&redirect=/parc-immobilier";
                }
              }}
              className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left flex flex-col gap-2 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  Parc immobilier existant
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-[0.65rem] font-semibold text-white px-2 py-0.5">
                  <IconLock />
                  Réservé aux membres
                </span>
              </div>
              <p className="text-[0.7rem] text-slate-500">
                Vision consolidée de vos biens : valeur du parc, encours de
                crédit, cash-flow global et biens à optimiser.
              </p>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href={isLoggedIn ? "/mon-compte" : "/mon-compte?mode=register"}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
            >
              {isLoggedIn
                ? "Accéder à mon espace et aux simulateurs avancés"
                : "Créer mon espace et débloquer les simulateurs avancés"}
            </Link>
            <p className="text-[0.7rem] text-slate-500">
              L&apos;inscription est gratuite. La version payante ajoutera des
              fonctionnalités de suivi et d’export.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement –
          Simulations indicatives.
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
