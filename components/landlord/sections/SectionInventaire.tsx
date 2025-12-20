// components/landlord/sections/SectionInventaire.tsx
import React from "react";
import { SectionTitle } from "../UiBits";

export function SectionInventaire() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
      <SectionTitle
        kicker="Inventaire"
        title="Équipements & pièces"
        desc="Suivi par bien : cuisine, électroménager, meubles, numéros de série, état, photos."
      />

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-[0.85rem] text-slate-700">
        À venir : on crée une table <span className="font-semibold">inventory_items</span> liée à <span className="font-semibold">properties</span>.
        <div className="mt-2 text-[0.75rem] text-slate-500">
          Bonus : export PDF pour l’état des lieux.
        </div>
      </div>
    </div>
  );
}
