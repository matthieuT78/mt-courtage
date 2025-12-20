// components/landlord/sections/SectionParametres.tsx
import React from "react";
import { SectionTitle, Pill } from "../UiBits";
import type { LandlordSettings } from "../../../lib/landlord/types";

export function SectionParametres({
  landlord,
  overLimit,
  leaseLimit,
  activeLeaseCount,
}: {
  landlord: LandlordSettings | null;
  overLimit: boolean;
  leaseLimit: number;
  activeLeaseCount: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
      <SectionTitle kicker="Paramètres" title="Profil bailleur" desc="Identité, defaults, automatisations. (édition à venir)" />

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{landlord?.display_name || "Bailleur"}</p>
          <Pill tone={landlord?.auto_send_enabled ? "emerald" : "amber"}>
            Envoi auto {landlord?.auto_send_enabled ? "activé" : "désactivé"}
          </Pill>
        </div>

        <p className="text-[0.85rem] text-slate-600">
          Fréquence : {landlord?.auto_send_frequency || "—"} • Jour : {landlord?.auto_send_day ?? "—"} • Heure : {landlord?.auto_send_hour ?? "—"}h
        </p>
        <p className="text-[0.85rem] text-slate-600">
          Lieu par défaut : {landlord?.default_issue_place || "—"} • Paiement par défaut : {landlord?.default_payment_method || "—"}
        </p>
      </div>

      <div className={"rounded-xl border px-4 py-4 " + (overLimit ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50")}>
        <p className="text-sm font-semibold text-slate-900">Limite d’usage</p>
        <p className="mt-1 text-[0.85rem] text-slate-700">
          Baux actifs : <span className="font-semibold">{activeLeaseCount}</span> • Seuil :{" "}
          <span className="font-semibold">{leaseLimit}</span>
        </p>
        <p className="mt-1 text-[0.75rem] text-slate-600">
          {overLimit ? "Seuil dépassé : prévoir une offre Pro." : "OK : vous êtes dans les limites."}
        </p>
      </div>
    </div>
  );
}
