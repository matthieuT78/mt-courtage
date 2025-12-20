// components/landlord/sections/SectionRevision.tsx
import React from "react";
import { SectionTitle } from "../UiBits";

export function SectionRevision() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
      <SectionTitle
        kicker="Révision"
        title="Révision annuelle du loyer"
        desc="Préparer la révision (IRL) et générer un courrier/email au locataire."
      />

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-[0.85rem] text-slate-700">
        À venir : un mini assistant “IRL” + modèle de message.
        <div className="mt-2 text-[0.75rem] text-slate-500">
          On stockera la clause et l’IRL de référence au niveau du bail.
        </div>
      </div>
    </div>
  );
}
