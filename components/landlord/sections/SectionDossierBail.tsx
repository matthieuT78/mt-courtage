// components/landlord/sections/SectionDossierBail.tsx
import React, { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import { isSelectableLeaseLike } from "../../../lib/landlord/archiveFilters";
import type { Lease, Property, Tenant } from "../../../lib/landlord/types";

type Props = {
  userId: string;
  leases?: Lease[];
  properties?: Property[];
  tenants?: Tenant[];
};

type DossierData = {
  contract: any | null;
  entryReport: any | null;
  exitReport: any | null;
  lastReceipt: any | null;
  acknowledgments: Record<string, string>; // document_id → acknowledged_at
};

function fmt(date: string | null | undefined) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function StatusPill({
  tone,
  label,
  icon: Icon,
}: {
  tone: "emerald" | "amber" | "slate" | "indigo" | "red";
  label: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold ${classes[tone]}`}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}

function DocRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 py-3 sm:flex-row sm:items-center sm:gap-3">
      <p className="w-36 shrink-0 text-xs font-semibold text-slate-500">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

export function SectionDossierBail({ userId, leases, properties, tenants }: Props) {
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeProps = Array.isArray(properties) ? properties : [];
  const safeTenants = Array.isArray(tenants) ? tenants : [];

  const activeLeases = safeLeases.filter(isSelectableLeaseLike);

  const propertyById = new Map(safeProps.map((p) => [(p as any).id, p]));
  const tenantById = new Map(safeTenants.map((t) => [(t as any).id, t]));

  const [data, setData] = useState<Record<string, DossierData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !userId || activeLeases.length === 0) {
      setLoading(false);
      return;
    }

    const leaseIds = activeLeases.map((l: any) => l.id);

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [contractsRes, reportsRes, receiptsRes] = await Promise.all([
          supabase
            .from("lease_contract_documents")
            .select("id,lease_id,contract_kind,status,document_source,signed_pdf_url,external_pdf_url,signed_at,shared_with_tenant_at,shared_to_tenant_email")
            .in("lease_id", leaseIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("inventory_reports")
            .select("id,lease_id,report_type,status,performed_at,pdf_url,document_source")
            .in("lease_id", leaseIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("rent_receipts")
            .select("id,lease_id,period_start,period_end,pdf_url,sent_at,status")
            .in("lease_id", leaseIds)
            .order("period_start", { ascending: false }),
        ]);

        // Accusés de réception — table peut ne pas exister encore
        let ackMap: Record<string, string> = {};
        try {
          const ackRes = await (supabase as any)
            .from("document_acknowledgments")
            .select("document_id,acknowledged_at")
            .eq("landlord_user_id", userId);
          if (!ackRes.error && ackRes.data) {
            ackMap = Object.fromEntries(ackRes.data.map((a: any) => [a.document_id, a.acknowledged_at]));
          }
        } catch {
          // migration pas encore appliquée
        }

        const contracts = contractsRes.data || [];
        const reports = reportsRes.data || [];
        const receipts = receiptsRes.data || [];

        const result: Record<string, DossierData> = {};
        for (const leaseId of leaseIds) {
          const leaseContracts = contracts.filter((c: any) => c.lease_id === leaseId);
          const contract = leaseContracts.find((c: any) => c.signed_pdf_url || c.external_pdf_url) || leaseContracts[0] || null;
          const leaseReports = reports.filter((r: any) => r.lease_id === leaseId);
          const leaseReceipts = receipts.filter((r: any) => r.lease_id === leaseId);
          result[leaseId] = {
            contract,
            entryReport: leaseReports.find((r: any) => r.report_type === "entry") || null,
            exitReport: leaseReports.find((r: any) => r.report_type === "exit") || null,
            lastReceipt: leaseReceipts[0] || null,
            acknowledgments: ackMap,
          };
        }
        setData(result);
      } catch (e: any) {
        console.error("[SectionDossierBail]", e?.message);
      } finally {
        setLoading(false);
      }
    };

    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeLeases.length]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Dossier par bail"
        desc="Vue consolidée : contrat de bail, états des lieux et quittances — statut et partage locataire pour chaque location active."
      />

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Chargement…</div>
      ) : activeLeases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          Aucun bail actif. Créez un bail dans la section <strong>Baux</strong> pour commencer.
        </div>
      ) : (
        <div className="space-y-4">
          {activeLeases.map((lease: any) => {
            const property = propertyById.get(lease.property_id);
            const tenant = tenantById.get(lease.tenant_id);
            const d = data[lease.id];

            const propLabel = (property as any)?.label || (property as any)?.address_line1 || "Logement";
            const tenantName = (tenant as any)?.full_name || "Locataire";

            return (
              <div key={lease.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Header bail */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                  <div>
                    <p className="text-sm font-bold text-slate-950">{propLabel}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {tenantName}
                      {lease.start_date ? ` · depuis ${fmt(lease.start_date)}` : ""}
                    </p>
                  </div>
                  <StatusPill tone="emerald" label="Bail actif" icon={CheckCircleIcon} />
                </div>

                {!d ? (
                  <div className="px-5 py-4 text-xs text-slate-400">Chargement…</div>
                ) : (
                  <div className="px-5 pb-4">
                    {/* Contrat de bail */}
                    <DocRow label="Contrat de bail">
                      {!d.contract ? (
                        <StatusPill tone="amber" label="Non associé" icon={ExclamationTriangleIcon} />
                      ) : d.contract.signed_pdf_url || d.contract.external_pdf_url ? (
                        <StatusPill tone="emerald" label="PDF disponible" icon={CheckCircleIcon} />
                      ) : (
                        <StatusPill tone="amber" label="Brouillon" icon={ClockIcon} />
                      )}
                      {d.contract?.shared_with_tenant_at ? (
                        <StatusPill tone="indigo" label={`Partagé le ${fmt(d.contract.shared_with_tenant_at)}`} icon={EnvelopeIcon} />
                      ) : d.contract && (d.contract.signed_pdf_url || d.contract.external_pdf_url) ? (
                        <StatusPill tone="slate" label="Non partagé" />
                      ) : null}
                      {d.contract && d.acknowledgments[d.contract.id] ? (
                        <StatusPill tone="emerald" label={`Accusé réception ${fmt(d.acknowledgments[d.contract.id])}`} icon={CheckCircleIcon} />
                      ) : d.contract && d.contract.shared_with_tenant_at ? (
                        <StatusPill tone="slate" label="En attente accusé" icon={ClockIcon} />
                      ) : null}
                    </DocRow>

                    {/* EDL entrée */}
                    <DocRow label="EDL d'entrée">
                      {!d.entryReport ? (
                        <StatusPill tone="amber" label="À réaliser" icon={ExclamationTriangleIcon} />
                      ) : d.entryReport.status === "signed" || d.entryReport.status === "archived" ? (
                        <StatusPill tone="emerald" label={`Signé · ${fmt(d.entryReport.performed_at) || "—"}`} icon={CheckCircleIcon} />
                      ) : (
                        <StatusPill tone="amber" label={`En cours · ${fmt(d.entryReport.performed_at) || "—"}`} icon={ClockIcon} />
                      )}
                      {d.entryReport && d.acknowledgments[d.entryReport.id] ? (
                        <StatusPill tone="emerald" label={`Accusé réception ${fmt(d.acknowledgments[d.entryReport.id])}`} icon={CheckCircleIcon} />
                      ) : d.entryReport?.pdf_url ? (
                        <StatusPill tone="slate" label="En attente accusé" icon={ClockIcon} />
                      ) : null}
                    </DocRow>

                    {/* EDL sortie */}
                    <DocRow label="EDL de sortie">
                      {!d.exitReport ? (
                        <StatusPill tone="slate" label="À venir" />
                      ) : d.exitReport.status === "signed" || d.exitReport.status === "archived" ? (
                        <StatusPill tone="emerald" label={`Signé · ${fmt(d.exitReport.performed_at) || "—"}`} icon={CheckCircleIcon} />
                      ) : (
                        <StatusPill tone="amber" label={`En cours · ${fmt(d.exitReport.performed_at) || "—"}`} icon={ClockIcon} />
                      )}
                      {d.exitReport && d.acknowledgments[d.exitReport.id] ? (
                        <StatusPill tone="emerald" label={`Accusé réception ${fmt(d.acknowledgments[d.exitReport.id])}`} icon={CheckCircleIcon} />
                      ) : d.exitReport?.pdf_url ? (
                        <StatusPill tone="slate" label="En attente accusé" icon={ClockIcon} />
                      ) : null}
                    </DocRow>

                    {/* Dernière quittance */}
                    <DocRow label="Dernière quittance">
                      {!d.lastReceipt ? (
                        <StatusPill tone="slate" label="Aucune quittance" />
                      ) : (
                        <>
                          <StatusPill
                            tone="emerald"
                            label={`${d.lastReceipt.period_start ? new Date(d.lastReceipt.period_start).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "—"}`}
                            icon={CheckCircleIcon}
                          />
                          {d.lastReceipt.sent_at ? (
                            <StatusPill tone="indigo" label={`Envoyée le ${fmt(d.lastReceipt.sent_at)}`} icon={EnvelopeIcon} />
                          ) : (
                            <StatusPill tone="slate" label="Non envoyée" />
                          )}
                        </>
                      )}
                    </DocRow>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
