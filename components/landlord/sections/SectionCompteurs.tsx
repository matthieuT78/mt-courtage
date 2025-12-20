// components/landlord/sections/SectionCompteurs.tsx
import React from "react";
import { SectionTitle } from "../UiBits";

export function SectionCompteurs() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
      <SectionTitle
        kicker="Compteurs"
        title="Relevés (eau, électricité, gaz)"
        desc="Historiser les index par bien et faciliter les entrées/sorties."
      />

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-[0.85rem] text-slate-700">
        À venir : table <span className="font-semibold">meter_readings</span> (property_id, type, index, date, photo_url).
      </div>
    </div>
  );
}
