// components/landlord/sections/TransitionPanel.tsx
import React, { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { cx } from "../ui/uiHelpers";
import type { Lease, Property, Tenant } from "../../../lib/landlord/types";
import type { LandlordSectionKey } from "../SidebarNav";

type Props = {
  leases: Lease[];
  propertyById: Map<string, Property>;
  tenantById: Map<string, Tenant>;
  userId: string;
  onGo: (k: LandlordSectionKey, link?: { leaseId?: string; openPanel?: string; openCreate?: boolean; prefillPropertyId?: string }) => void;
  onPrepareDeparture?: (tenantId: string) => void;
  onRefresh: () => Promise<void>;
};

type StepKey = "edl" | "caution" | "annonce" | "candidat_retenu" | "nouveau_bail";

type TransitionData = {
  lease: Lease;
  property: Property | null;
  tenant: Tenant | null;
  steps: Record<StepKey, boolean>;
  cautionDeadline: Date | null;
  hasNewLease: boolean;
  submittedCount: number;
};

const STEPS: { key: StepKey; label: string }[] = [
  { key: "edl",             label: "EDL sortie" },
  { key: "caution",         label: "Caution" },
  { key: "annonce",         label: "Annonce" },
  { key: "candidat_retenu", label: "Candidat" },
  { key: "nouveau_bail",    label: "Nouveau bail" },
];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function addDays(iso: string, n: number): Date {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d;
}

function daysDiff(target: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export function isInTransition(lease: Lease, allLeases: Lease[], propertyById: Map<string, Property>): boolean {
  const status = String(lease.status || "").toLowerCase();
  if (!["active", "ended"].includes(status)) return false;
  if (!lease.end_date) return false;

  // Un bien archivé n'est plus géré activement — ne pas relancer sa remise
  // en location (annonce, candidats...) ni sa caution ici. Le propriétaire
  // a explicitement sorti ce bien de la gestion active.
  const property = propertyById.get(lease.property_id);
  if (String(property?.status || "").toLowerCase() === "archived") return false;

  const endDate = new Date(lease.end_date + "T00:00:00");
  const now = new Date();
  const sixMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

  if (endDate < ninetyDaysAgo || endDate > sixMonthsAhead) return false;

  // A lease with "ended" status and any active successor for the same property
  // is no longer in transition (property is already re-rented)
  if (status === "ended") {
    const hasActiveSuccessor = allLeases.some(
      (l) =>
        l.id !== lease.id &&
        l.property_id === lease.property_id &&
        String(l.status || "").toLowerCase() === "active"
    );
    if (hasActiveSuccessor) return false;
  }

  const hasSuccessor = allLeases.some(
    (l) =>
      l.id !== lease.id &&
      l.property_id === lease.property_id &&
      String(l.status || "").toLowerCase() === "active" &&
      l.start_date >= lease.end_date!  // >= handles same-day handover
  );
  return !hasSuccessor;
}

function nextAction(
  steps: Record<StepKey, boolean>,
  leaseId: string,
  submittedCount: number,
  propertyId: string,
  delegatedListing: boolean,
): { label: string; target: LandlordSectionKey; link?: { leaseId?: string; openPanel?: string; openCreate?: boolean; prefillPropertyId?: string } } {
  if (!steps.edl)             return { label: "Faire l'état des lieux", target: "etat_des_lieux" };
  if (!steps.caution)         return { label: "Restituer la caution", target: "baux", link: { leaseId, openPanel: "deposit" } };
  // Mise en location déléguée à un tiers : rien à faire côté bailleur pour
  // l'annonce et l'analyse des candidatures, on saute directement à la suite.
  if (!delegatedListing) {
    if (!steps.annonce)         return { label: "Créer l'annonce", target: "candidatures" };
    if (!steps.candidat_retenu) {
      if (submittedCount > 0)   return { label: `Analyser ${submittedCount} dossier${submittedCount > 1 ? "s" : ""}`, target: "candidatures" };
      return { label: "Partager l'annonce", target: "candidatures" };
    }
  }
  if (!steps.nouveau_bail)    return { label: "Créer le bail", target: "baux", link: { openCreate: true, prefillPropertyId: propertyId } };
  return { label: "Voir le bail", target: "baux" };
}

export function TransitionPanel({ leases, propertyById, tenantById, userId, onGo, onRefresh }: Props) {
  const [transitions, setTransitions] = useState<TransitionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !userId) { setLoading(false); return; }

    const inTransition = leases.filter((l) => isInTransition(l, leases, propertyById));
    if (inTransition.length === 0) { setTransitions([]); setLoading(false); return; }

    const leaseIds = inTransition.map((l) => l.id);
    const propertyIds = inTransition.map((l) => l.property_id).filter(Boolean);

    (async () => {
      const [edlRes, listingsRes] = await Promise.all([
        supabase
          .from("inventory_reports")
          .select("lease_id, status")
          .eq("user_id", userId)
          .eq("report_type", "exit")
          .in("lease_id", leaseIds),
        // Annonces non-archivées, les plus récentes en premier
        supabase
          .from("rental_listings")
          .select("id, property_id")
          .eq("user_id", userId)
          .in("property_id", propertyIds)
          .not("status", "eq", "archived")
          .order("created_at", { ascending: false }),
      ]);

      const edlByLease = new Map<string, string>();
      for (const r of edlRes.data || []) {
        if (!edlByLease.has(r.lease_id)) edlByLease.set(r.lease_id, r.status || "");
      }

      // On garde uniquement la listing la plus récente par property
      const listingByProp = new Map<string, string>();
      for (const l of listingsRes.data || []) {
        if (!listingByProp.has(l.property_id)) listingByProp.set(l.property_id, l.id);
      }

      // Candidatures depuis la listing la plus récente (non-archivée)
      const listingIds = (listingsRes.data || [])
        .filter((l: any) => listingByProp.get(l.property_id) === l.id)
        .map((l: any) => l.id);
      const candidaturesByListing = new Map<string, { submitted: number; accepted: number }>();

      if (listingIds.length > 0) {
        const { data: cands } = await supabase
          .from("candidatures")
          .select("listing_id, status")
          .in("listing_id", listingIds)
          .in("status", ["submitted", "accepted", "converted"]);

        for (const c of cands || []) {
          const cur = candidaturesByListing.get(c.listing_id) || { submitted: 0, accepted: 0 };
          if (c.status === "submitted") cur.submitted++;
          if (c.status === "accepted" || c.status === "converted") cur.accepted++;
          candidaturesByListing.set(c.listing_id, cur);
        }
      }

      const result: TransitionData[] = inTransition.map((lease) => {
        const edlStatus = edlByLease.get(lease.id) || "";
        const edlDone = ["ready", "signed", "archived"].includes(edlStatus.toLowerCase());
        const cautionDone = !!lease.deposit_returned_at;
        const listingId = listingByProp.get(lease.property_id);
        const annonceDone = !!listingId;
        const cands = listingId ? candidaturesByListing.get(listingId) : null;
        const acceptedCount = cands?.accepted ?? 0;
        const submittedCount = cands?.submitted ?? 0;
        const newLease = leases.find(
          (l) =>
            l.id !== lease.id &&
            l.property_id === lease.property_id &&
            String(l.status || "").toLowerCase() === "active"
        );
        const hasNewLease = !!newLease;
        const candidatRetenuDone = acceptedCount > 0 || hasNewLease;
        const cautionDeadline = lease.end_date ? addDays(lease.end_date, 30) : null;

        return {
          lease,
          property: propertyById.get(lease.property_id) || null,
          tenant: tenantById.get(lease.tenant_id) || null,
          steps: {
            edl: edlDone,
            caution: cautionDone,
            annonce: annonceDone,
            candidat_retenu: candidatRetenuDone,
            nouveau_bail: hasNewLease,
          },
          cautionDeadline,
          hasNewLease,
          submittedCount,
        };
      });

      // Dedup: one card per property — prefer active lease, then latest end_date
      const byProp = new Map<string, TransitionData>();
      for (const t of result) {
        const prev = byProp.get(t.lease.property_id);
        if (!prev) { byProp.set(t.lease.property_id, t); continue; }
        const tActive = String(t.lease.status || "").toLowerCase() === "active";
        const prevActive = String(prev.lease.status || "").toLowerCase() === "active";
        if (tActive && !prevActive) byProp.set(t.lease.property_id, t);
        else if (tActive === prevActive && (t.lease.end_date || "") > (prev.lease.end_date || ""))
          byProp.set(t.lease.property_id, t);
      }

      setTransitions([...byProp.values()]);
      setLoading(false);
    })();
  }, [leases, propertyById, tenantById, userId]);

  if (loading || transitions.length === 0) return null;

  const allDone = transitions.every((t) => Object.values(t.steps).every(Boolean));
  if (allDone) return null;

  return (
    <div className="space-y-2">
      <p className="px-1 text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">
        Logement{transitions.length > 1 ? "s" : ""} en transition
        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[0.62rem] font-bold text-amber-700">
          {transitions.length}
        </span>
      </p>

      {transitions.map((t) => {
        if (Object.values(t.steps).every(Boolean)) return null;

        // "Mise en location & candidatures" déléguée à un tiers (agence...) :
        // l'annonce et le tri des candidatures ne sont pas des tâches du
        // bailleur — on ne les compte pas comme "à faire" pour lui.
        const delegatedListing = (t.property?.delegated_services || []).includes("mise_en_location");
        const isDelegatedStep = (key: StepKey) => delegatedListing && (key === "annonce" || key === "candidat_retenu");

        const doneCount = STEPS.filter((s) => t.steps[s.key] || isDelegatedStep(s.key)).length;
        const total = STEPS.length;
        const pct = Math.round((doneCount / total) * 100);
        const action = nextAction(t.steps, t.lease.id, t.submittedCount, t.lease.property_id, delegatedListing);

        const cautionDays = t.cautionDeadline ? daysDiff(t.cautionDeadline) : null;
        const cautionUrgent = !t.steps.caution && cautionDays !== null && cautionDays <= 7;
        const cautionOverdue = !t.steps.caution && cautionDays !== null && cautionDays < 0;

        const propLabel = t.property?.label || t.property?.city || "Bien";
        const tenantName = t.tenant?.full_name || "Locataire";

        return (
          <div
            key={t.lease.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{propLabel}</p>
                <p className="text-xs text-slate-500">
                    Départ de {tenantName} · {fmtDate(t.lease.end_date)}
                  </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.68rem] font-semibold text-slate-600">
                {doneCount}/{total}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-slate-100">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Steps */}
            <div className="flex items-start gap-0 overflow-x-auto px-4 py-3">
              {STEPS.map((s, i) => {
                const done = t.steps[s.key];
                const isLast = i === STEPS.length - 1;
                const delegated = !done && isDelegatedStep(s.key);
                // "Candidat" step : amber dot when submissions pending but none accepted yet
                const isPending = s.key === "candidat_retenu" && !done && !delegated && t.submittedCount > 0;
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex min-w-[52px] flex-col items-center gap-1 text-center">
                      <div className={cx(
                        "flex h-7 w-7 items-center justify-center rounded-full border-2 transition",
                        done
                          ? "border-emerald-400 bg-emerald-50"
                          : delegated
                          ? "border-indigo-300 bg-indigo-50"
                          : isPending
                          ? "border-amber-400 bg-amber-50"
                          : "border-slate-200 bg-white"
                      )}>
                        {done
                          ? <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                          : delegated
                          ? <span className="h-2 w-2 rounded-full bg-indigo-400" />
                          : isPending
                          ? <span className="h-2 w-2 rounded-full bg-amber-400" />
                          : <span className="h-2 w-2 rounded-full bg-slate-200" />
                        }
                      </div>
                      <span className={cx(
                        "text-[0.6rem] font-semibold leading-tight",
                        done ? "text-emerald-600" : delegated ? "text-indigo-500" : isPending ? "text-amber-600" : "text-slate-400"
                      )}>
                        {delegated
                          ? "Délégué"
                          : s.key === "candidat_retenu" && isPending
                          ? `${t.submittedCount} dossier${t.submittedCount > 1 ? "s" : ""}`
                          : s.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div className={cx(
                        "mt-3.5 h-px flex-1 min-w-[8px]",
                        done || delegated ? "bg-emerald-200" : "bg-slate-100"
                      )} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
              {!t.steps.caution && t.cautionDeadline ? (
                <div className={cx(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  cautionOverdue
                    ? "bg-red-100 text-red-700"
                    : cautionUrgent
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                )}>
                  <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                  {cautionOverdue
                    ? `Caution en retard (${Math.abs(cautionDays!)}j)`
                    : cautionDays === 0
                    ? "Caution à restituer aujourd'hui"
                    : `Caution à restituer dans ${cautionDays}j`
                  }
                </div>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => onGo(action.target, action.link)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {action.label}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
