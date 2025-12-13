// pages/outils-proprietaire.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

export default function OutilsProprietairePage() {
  // On veut atterrir sur l'onglet bailleur APRÈS auth
  const redirectToBailleur = encodeURIComponent("/mon-compte?tab=bailleur");

  // Session state (pour afficher un CTA "ouvrir" si déjà connecté)
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setIsLoggedIn(false);
      setChecking(false);
      return;
    }

    // Session immédiate
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session?.user?.id);
      setChecking(false);
    });

    // Reste synchro (login/logout/refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user?.id);
      setChecking(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // ✅ Lien intelligent : si non connecté -> login + redirect
  const etatsDesLieuxHref = useMemo(() => {
    const target = "/etats-des-lieux-documents";
    return isLoggedIn ? target : `/mon-compte?mode=login&redirect=${encodeURIComponent(target)}`;
  }, [isLoggedIn]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* HERO */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <p className="text-[0.7rem] uppercase tracking-[0.20em] text-emerald-600">
              Boîte à outils propriétaire
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Centralisez la gestion de vos locations comme un pro.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Quittances automatiques, suivi des cautions, états des lieux, dossiers
              locataires... Un espace unique pour simplifier la vie des bailleurs
              particuliers comme pros.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                    Abonnement mensuel (bientôt)
                  </p>
                  <p className="text-2xl font-semibold text-slate-900 leading-tight">
                    49&nbsp;€ / mois
                  </p>
                  <p className="text-[0.7rem] text-emerald-800">Résiliable à tout moment.</p>
                </div>
              </div>

              <div className="space-y-2 text-[0.75rem] text-slate-600">
                <p>
                  Idéal si vous gérez plusieurs biens (meublés, nus, colocations) et
                  que vous voulez professionnaliser vos échanges avec vos locataires.
                </p>
                <p className="text-[0.7rem] text-slate-500">
                  Version bêta en préparation – pré-inscriptions possibles dès maintenant.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              {checking ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white opacity-60"
                >
                  Chargement…
                </button>
              ) : isLoggedIn ? (
                // ✅ déjà connecté -> on ouvre directement l'onglet bailleur
                <Link
                  href="/mon-compte?tab=bailleur"
                  className="inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 shadow-md"
                >
                  Ouvrir mon espace bailleur
                </Link>
              ) : (
                <>
                  {/* ✅ CTA principal : créer un compte puis atterrir sur l'onglet bailleur */}
                  <Link
                    href={`/mon-compte?mode=register&tab=bailleur&redirect=${redirectToBailleur}`}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-md"
                  >
                    Créer mon espace bailleur
                  </Link>

                  {/* ✅ CTA secondaire : déjà un compte -> login -> redirection bailleur */}
                  <Link
                    href={`/mon-compte?mode=login&tab=bailleur&redirect=${redirectToBailleur}`}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    J’ai déjà un compte
                  </Link>
                </>
              )}

              <a
                href="mailto:mtcourtage@gmail.com?subject=Pré-inscription%20Outils%20propriétaire"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Discuter de mes besoins
              </a>
            </div>
          </section>

          {/* FONCTIONNALITÉS CLÉS */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                  Fonctionnalités principales
                </p>
                <h2 className="mt-1 text-base sm:text-lg font-semibold text-slate-900">
                  Tout ce qu&apos;il faut pour piloter vos locations
                </h2>
              </div>
              <p className="text-[0.75rem] text-slate-500 max-w-xs">
                Pensé pour des propriétaires qui veulent gagner du temps sans passer
                par une agence.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 mt-2">
              {/* 🧾 Quittances automatiques - cliquable */}
              <Link
                href="/quittances-loyer"
                className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2 cursor-pointer hover:bg-amber-50 hover:border-amber-300 hover:shadow-md transition"
              >
                <div className="inline-flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                    🧾
                  </div>
                  <p className="text-xs font-semibold text-slate-900">Quittances automatiques</p>
                </div>
                <ul className="space-y-1 text-[0.75rem] text-slate-700">
                  <li>• Génération automatique des quittances chaque mois</li>
                  <li>• Archivage par locataire et par bien</li>
                  <li>• Envoi par e-mail au format PDF</li>
                </ul>
                <p className="text-[0.7rem] font-medium text-amber-700 group-hover:underline">
                  Accéder au générateur de quittances →
                </p>
              </Link>

              {/* 💶 Cautions & loyers - cliquable */}
              <Link
                href="/cautions-loyers"
                className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2 cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-md transition"
              >
                <div className="inline-flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                    💶
                  </div>
                  <p className="text-xs font-semibold text-slate-900">Cautions & loyers</p>
                </div>
                <ul className="space-y-1 text-[0.75rem] text-slate-700">
                  <li>• Suivi des dépôts de garantie (entrée / sortie)</li>
                  <li>• Historique des loyers et retards</li>
                  <li>• Alertes sur régularisation ou fin de bail</li>
                </ul>
                <p className="text-[0.7rem] font-medium text-emerald-700 group-hover:underline">
                  Accéder au suivi cautions & loyers →
                </p>
              </Link>

              {/* 📋 États des lieux & documents - MAINTENANT CLIQUABLE + LOGIN REDIRECT */}
              <Link
                href={etatsDesLieuxHref}
                className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2 cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md transition"
              >
                <div className="inline-flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                    📋
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    États des lieux & documents
                  </p>
                </div>
                <ul className="space-y-1 text-[0.75rem] text-slate-700">
                  <li>• Modèles d&apos;états des lieux d&apos;entrée / sortie</li>
                  <li>• Checklist personnalisable par type de bien</li>
                  <li>• Centralisation des pièces locataires</li>
                </ul>
                <p className="text-[0.7rem] font-medium text-indigo-700 group-hover:underline">
                  {isLoggedIn ? "Accéder aux documents →" : "Se connecter pour accéder →"}
                </p>
              </Link>
            </div>
          </section>

          {/* POUR QUI ? */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Pour qui ?</p>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              Propriétaires solo, LMNP, multipropriétaires… si vous avez des locataires,
              c&apos;est pour vous.
            </h2>

            <div className="grid gap-4 md:grid-cols-3 mt-2 text-[0.75rem] text-slate-700">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="font-semibold text-slate-900 mb-1">Bailleur débutant</p>
                <p>
                  Vous mettez votre premier bien en location et vous voulez éviter
                  les erreurs administratives (quittances, bail, caution…).
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="font-semibold text-slate-900 mb-1">Multipropriétaire</p>
                <p>
                  Plusieurs biens, plusieurs locataires, plusieurs cautions… mais
                  un seul tableau de bord pour tout suivre.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="font-semibold text-slate-900 mb-1">Investisseur structuré</p>
                <p>
                  Vous utilisez déjà les calculettes MT Courtage pour vos achats
                  et vous voulez aller jusqu&apos;à la gestion locative.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Link
                href="/capacite"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2 text-[0.8rem] font-semibold text-slate-800 hover:bg-slate-50"
              >
                Continuer à explorer les simulateurs
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils pour propriétaires et
          investisseurs.
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
