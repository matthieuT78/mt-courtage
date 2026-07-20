// pages/espace-bailleur.tsx
import React, { useEffect, useState } from "react";
import Head from "next/head";
import AppHeader from "../components/AppHeader";
import { useLandlordDashboard } from "../lib/landlord/useLandlordDashboard";
import { DashboardShell } from "../components/landlord/DashboardShell";
import { OnboardingWizard } from "../components/landlord/onboarding/OnboardingWizard";
import { useBailleurTheme } from "../hooks/useBailleurTheme";
import { useProfile } from "../hooks/useProfile";
import { computeOnboardingStatus } from "../lib/landlord/onboardingStatus";
import { useWizardCompletionFlag } from "../lib/landlord/useWizardCompletionFlag";

export default function EspaceBailleurPage() {
  const d = useLandlordDashboard();
  const { dark, toggle } = useBailleurTheme();
  const { profile, loaded: profileLoaded, save: saveProfile } = useProfile(d.userId || null);
  const wizardFlag = useWizardCompletionFlag(d.userId || null);

  const onboardingStatus = computeOnboardingStatus({
    properties: d.properties,
    tenantById: d.tenantById,
    // Liste brute (pas d.activeLeases) : un bail déjà créé avec une date de
    // début future doit compter comme "location configurée" pour l'assistant,
    // même s'il n'est pas encore opérationnellement actif aujourd'hui.
    activeLeases: d.leases,
    propertyFinance: d.propertyFinance,
    profile,
    profileLoaded,
  });

  // useLandlordDashboard() a `loading` à `false` avant même que le premier
  // fetch démarre (le temps qu'un useEffect enchaîne dessus) — sans ce
  // suivi, on pourrait décider "wizardRequired" avec properties/tenants
  // encore vides alors qu'ils existent déjà en base, et figer l'assistant
  // sur une étape déjà complétée. On attend un vrai cycle loading:true → false.
  const [dataFetchStarted, setDataFetchStarted] = useState(false);
  const [dataReadyOnce, setDataReadyOnce] = useState(false);
  useEffect(() => {
    if (d.loading) setDataFetchStarted(true);
  }, [d.loading]);
  useEffect(() => {
    if (dataFetchStarted && !d.loading) setDataReadyOnce(true);
  }, [dataFetchStarted, d.loading]);

  // profileLoaded doit être réglé avant de décider quoi afficher : sinon
  // computeOnboardingStatus traite le profil comme "complet" par défaut
  // (placeholder anti-flash pour la checklist du cockpit) et l'assistant
  // calculerait sa 1ère étape sur cette base fausse, sautant "Bailleur".
  const stillCheckingWizardGate = d.checkingAuth || !wizardFlag.loaded || !profileLoaded || !dataReadyOnce;

  // Décision "faut-il afficher l'assistant" prise UNE SEULE FOIS, dès que les
  // données sont prêtes — pas recalculée à chaque re-render. Sans ça, dès que
  // la dernière étape (Location) écrit ses données et rafraîchit l'état,
  // mandatoryStepsComplete devient vrai immédiatement et le cockpit remplace
  // l'assistant avant même que l'utilisateur voie l'écran "Terminé" ou clique
  // sur le bouton de sortie. Seul un onComplete() explicite (ou un rechargement
  // complet de page) doit faire sortir de l'assistant.
  const [wizardDecided, setWizardDecided] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  useEffect(() => {
    if (!stillCheckingWizardGate && !wizardDecided) {
      setShowWizard(!wizardFlag.done && !onboardingStatus.mandatoryStepsComplete);
      setWizardDecided(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stillCheckingWizardGate, wizardDecided]);

  // 🎨 Brand lokt.fr
  const brandBg = "bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]";
  const brandText = "text-white";

  const pageClass = `min-h-screen flex flex-col transition-colors duration-300 ${
    dark ? "bailleur-dark bg-[#0d1423]" : "bg-[#f6f9fc]"
  }`;

  // `stillCheckingWizardGate` peut devenir faux un render avant que l'effet
  // ci-dessus n'ait eu la main pour poser `showWizard` (les effets tournent
  // après le commit, pas pendant le même render) — sans ce garde, ce render
  // intermédiaire retombe sur la branche <DashboardShell>, produisant un
  // flash d'une frame du cockpit avant que l'assistant ne s'affiche.
  if (stillCheckingWizardGate || !wizardDecided) {
    return (
      <div className={pageClass}>
        <Head>
          <title>Espace bailleur | lokt.fr</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <AppHeader />
        <main className="flex-1 px-4 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className={`h-1.5 w-full ${brandBg}`} />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-2xl ${brandBg} ${brandText} flex items-center justify-center text-sm font-semibold`}>
                    L
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Espace bailleur</p>
                    <p className="text-sm text-slate-600">
                      Chargement de votre espace lokt.fr…
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full w-2/3 ${brandBg}`} />
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Vérification de la session et chargement de vos données.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <Head>
        <title>Espace bailleur | lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AppHeader />

      {/* On garde le shell monté même pendant loading,
          sinon l'onglet actif revient à "dashboard" après un refresh */}
      {showWizard ? (
        <main className="flex-1">
          <OnboardingWizard
            userId={d.userId || ""}
            userEmail={d.user?.email}
            profile={profile}
            profileLoaded={profileLoaded}
            saveProfile={saveProfile}
            properties={d.properties}
            tenants={d.tenants}
            tenantById={d.tenantById}
            // Liste brute : cf. commentaire sur onboardingStatus plus haut.
            activeLeases={d.leases}
            propertyFinance={d.propertyFinance}
            onRefresh={d.refresh}
            onComplete={() => {
              wizardFlag.markDone();
              setShowWizard(false);
            }}
          />
        </main>
      ) : d.error ? (
        <main className="flex-1 px-4 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-[2rem] border border-red-200 bg-white shadow-sm overflow-hidden">
              <div className="h-1.5 w-full bg-red-500" />
              <div className="p-6">
                <p className="text-sm font-semibold text-red-700">Impossible d'ouvrir l'espace bailleur</p>
                <p className="mt-1 text-sm text-red-700">{d.error}</p>
                <p className="mt-3 text-xs text-slate-500">
                  Si le problème persiste, contactez-nous :{" "}
                  <a href="mailto:mtcourtage@gmail.com" className="underline">
                    mtcourtage@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <>
          {/* Indicateur discret pendant refresh */}
          {d.loading ? (
            <div className="px-4 pt-4">
              <div className="max-w-7xl mx-auto">
                <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className={`h-1 w-full ${brandBg}`} />
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-700">
                      Actualisation des données…
                    </p>
                    <span className="text-[0.7rem] text-slate-500">
                      lokt.fr • Espace bailleur
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <main className="flex-1">
            <DashboardShell {...d} profile={profile} profileLoaded={profileLoaded} isDark={dark} onToggleDark={toggle} />
          </main>
        </>
      )}

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500 lg:hidden">
        <p>© {new Date().getFullYear()} lokt.fr – Espace bailleur.</p>
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
