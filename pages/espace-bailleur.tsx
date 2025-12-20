// pages/espace-bailleur.tsx
import React from "react";
import AppHeader from "../components/AppHeader";
import { useLandlordDashboard } from "../lib/landlord/useLandlordDashboard";
import { DashboardShell } from "../components/landlord/DashboardShell";

export default function EspaceBailleurPage() {
  const d = useLandlordDashboard();

  // 🎨 Brand Izimo
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";

  if (d.checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 px-4 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className={`h-1.5 w-full ${brandBg}`} />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-2xl ${brandBg} ${brandText} flex items-center justify-center text-sm font-semibold`}>
                    ⏳
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Espace bailleur</p>
                    <p className="text-sm text-slate-600">
                      Chargement de votre espace Izimo…
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
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      {/* On garde le shell monté même pendant loading,
          sinon l’onglet actif revient à "dashboard" après un refresh */}
      {d.error ? (
        <main className="flex-1 px-4 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-3xl border border-red-200 bg-white shadow-sm overflow-hidden">
              <div className="h-1.5 w-full bg-red-500" />
              <div className="p-6">
                <p className="text-sm font-semibold text-red-700">Impossible d’ouvrir l’espace bailleur</p>
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
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className={`h-1 w-full ${brandBg}`} />
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-700">
                      Actualisation des données…
                    </p>
                    <span className="text-[0.7rem] text-slate-500">
                      Izimo • Espace bailleur
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <main className="flex-1">
            <DashboardShell {...d} />
          </main>
        </>
      )}

      <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} Izimo – Espace bailleur.</p>
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
