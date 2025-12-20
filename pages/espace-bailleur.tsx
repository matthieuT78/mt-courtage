// pages/espace-bailleur.tsx
import React from "react";
import AppHeader from "../components/AppHeader";
import { useLandlordDashboard } from "../lib/landlord/useLandlordDashboard";
import { DashboardShell } from "../components/landlord/DashboardShell";

export default function EspaceBailleurPage() {
  const d = useLandlordDashboard();

  if (d.checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 px-4 py-6">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <p className="text-sm text-slate-600">Chargement de votre espace bailleur…</p>
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
        <main className="flex-1 px-4 py-6">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {d.error}
            </div>
          </div>
        </main>
      ) : (
        <>
          {/* Indicateur discret pendant refresh */}
          {d.loading ? (
            <div className="px-4 pt-4">
              <div className="max-w-7xl mx-auto">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
                  <p className="text-xs text-slate-600">Chargement…</p>
                </div>
              </div>
            </div>
          ) : null}

          <main className="flex-1">
            <DashboardShell {...d} />
          </main>
        </>
      )}

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} ImmoPilot – Espace bailleur.</p>
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
