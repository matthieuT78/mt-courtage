// components/landlord/sections/SectionLoyers.tsx
import React from "react";
import { SectionTitle, formatEuro, fmtDate, Pill } from "../UiBits";
import type { RentPayment, Lease, Property, Tenant } from "../../../lib/landlord/types";

export function SectionLoyers({
  payments,
  leases,
  propertyById,
  tenantById,
}: {
  payments: RentPayment[];
  leases: Lease[];
  propertyById: Map<string, Property>;
  tenantById: Map<string, Tenant>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
      <SectionTitle kicker="Loyers" title="Encaissements & retards" desc="Liste des paiements (à enrichir : filtres, actions, relances)." />

      {payments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-[0.85rem] text-slate-700">
          Aucun paiement enregistré.
        </div>
      ) : (
        <div className="space-y-2">
          {payments.slice(0, 30).map((p) => {
            const l = leases.find((x) => x.id === p.lease_id);
            const prop = l ? propertyById.get(l.property_id) : null;
            const ten = l ? tenantById.get(l.tenant_id) : null;
            const paid = !!p.paid_at;
            return (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {prop?.label || "Bien"} • {ten?.full_name || "Locataire"}
                    </p>
                    <p className="mt-0.5 text-[0.8rem] text-slate-600">
                      Période {fmtDate(p.period_start)} → {fmtDate(p.period_end)} • Montant{" "}
                      <span className="font-semibold">{formatEuro(p.total_amount)}</span>
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-slate-500">
                      Échéance {fmtDate(p.due_date)} • {paid ? `Payé le ${fmtDate(p.paid_at)}` : "Non payé"}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Pill tone={paid ? "emerald" : "red"}>{paid ? "Payé" : "En retard ?"}</Pill>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
