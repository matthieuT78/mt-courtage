// components/landlord/sections/TransitionPanel.tsx
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { cx } from "../ui/uiHelpers";
import type { Lease, Property, Tenant } from "../../../lib/landlord/types";
import type { LandlordSectionKey } from "../SidebarNav";
import type { Plan } from "../../../lib/permissions";
import { planAllowsCandidatures } from "../../../lib/permissions";
import { isInTransition } from "../../../lib/landlord/leaseTransition";

type Props = {
  leases: Lease[];
  propertyById: Map<string, Property>;
  tenantById: Map<string, Tenant>;
  userId: string;
  plan?: Plan;
  onGo: (k: LandlordSectionKey, link?: { leaseId?: string; openPanel?: string; depositAction?: "collect" | "return"; openCreate?: boolean; prefillPropertyId?: string }) => void;
  onRefresh: () => Promise<void>;
};

type StepKey = "edl" | "caution" | "annonce" | "candidat_retenu" | "nouveau_bail";

type TransitionData = {
  lease: Lease;
  property: Property | null;
  tenant: Tenant | null;
  steps: Record<StepKey, boolean>;
  // Délai légal de restitution : 1 mois si l'EDL de sortie ne révèle aucune
  // dégradation, 2 mois sinon (art. 22, loi du 6 juillet 1989). L'app ne
  // compare pas automatiquement les EDL entrée/sortie, donc on ne peut pas
  // trancher — on affiche les deux seuils plutôt que d'en présumer un.
  cautionOneMonthDeadline: Date | null;
  cautionTwoMonthDeadline: Date | null;
  hasNewLease: boolean;
  submittedCount: number;
  // Un état des lieux de sortie sans état des lieux d'entrée au dossier ne
  // permet aucune comparaison automatique des dégradations — le bailleur doit
  // le savoir avant de s'y lancer, pas le découvrir une fois dedans.
  hasEntryReport: boolean;
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

function addMonths(iso: string, n: number): Date {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d;
}

function daysDiff(target: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export { isInTransition };

// "done" : fait. "pending" : à faire par le bailleur, ce qui fait avancer la
// relocation. "delegated"/"locked"/"not_required" sont trois raisons
// différentes de ne PAS compter une étape comme à faire — délégué à une
// agence, réservé au plan lokt·one (accélère la relocation mais optionnel),
// ou sans objet (EDL de sortie sans EDL d'entrée au dossier, donc sans valeur
// de comparaison). Elles sont regroupées ensemble pour la progression, mais
// affichées différemment pour que le bailleur comprenne pourquoi.
type StepStatus = "done" | "pending" | "delegated" | "locked" | "not_required";

function computeStepStatus(
  key: StepKey,
  t: TransitionData,
  delegatedListing: boolean,
  delegatedBailEdl: boolean,
  candidaturesLocked: boolean,
): StepStatus {
  if (t.steps[key]) return "done";
  if (key === "edl" || key === "caution" || key === "nouveau_bail") {
    if (delegatedBailEdl) return "delegated";
  } else if (delegatedListing) {
    return "delegated";
  }
  if (key === "edl" && !t.hasEntryReport) return "not_required";
  if ((key === "annonce" || key === "candidat_retenu") && candidaturesLocked) return "locked";
  return "pending";
}

const isSkipped = (status: StepStatus) => status === "delegated" || status === "locked" || status === "not_required";

function transitionStepStatuses(t: TransitionData, plan: Plan | undefined): Record<StepKey, StepStatus> {
  const delegatedServices = t.property?.delegated_services || [];
  const delegatedListing = delegatedServices.includes("mise_en_location");
  const delegatedBailEdl = delegatedServices.includes("bail_edl");
  const candidaturesLocked = !planAllowsCandidatures(plan || "calc_full");
  const entries = STEPS.map((s) => [s.key, computeStepStatus(s.key, t, delegatedListing, delegatedBailEdl, candidaturesLocked)] as const);
  return Object.fromEntries(entries) as Record<StepKey, StepStatus>;
}

function hasPendingSteps(t: TransitionData, plan: Plan | undefined): boolean {
  const statuses = transitionStepStatuses(t, plan);
  return STEPS.some((s) => statuses[s.key] === "pending");
}

function nextAction(
  statusOf: (key: StepKey) => StepStatus,
  leaseId: string,
  submittedCount: number,
  propertyId: string,
  depositPaid: boolean,
): { label: string; target: LandlordSectionKey; link?: { leaseId?: string; openPanel?: string; depositAction?: "collect" | "return"; openCreate?: boolean; prefillPropertyId?: string } } {
  // But du workflow : reloger le logement au plus vite. Les étapes déléguées,
  // verrouillées par le plan ou sans objet ne bloquent jamais cet objectif —
  // on saute directement à la prochaine étape réellement à faire.
  if (statusOf("edl") === "pending")
    return { label: "Faire l'état des lieux de sortie", target: "etat_des_lieux" };
  if (statusOf("caution") === "pending") {
    // Sans encaissement enregistré, "restituer" n'a pas de sens (l'API le
    // refuse) — la vraie prochaine étape est d'abord d'encaisser la caution.
    if (!depositPaid) return { label: "Encaisser la caution", target: "baux", link: { leaseId, openPanel: "deposit", depositAction: "collect" } };
    return { label: "Restituer la caution", target: "baux", link: { leaseId, openPanel: "deposit", depositAction: "return" } };
  }
  if (statusOf("annonce") === "pending")
    return { label: "Créer l'annonce", target: "candidatures" };
  if (statusOf("candidat_retenu") === "pending") {
    if (submittedCount > 0) return { label: `Analyser ${submittedCount} dossier${submittedCount > 1 ? "s" : ""}`, target: "candidatures" };
    return { label: "Partager l'annonce", target: "candidatures" };
  }
  if (statusOf("nouveau_bail") === "pending")
    return { label: "Créer le bail", target: "baux", link: { openCreate: true, prefillPropertyId: propertyId } };
  return { label: "Voir le bail", target: "baux" };
}

export function TransitionPanel({ leases, propertyById, tenantById, userId, plan, onGo, onRefresh }: Props) {
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
          .select("lease_id, status, report_type")
          .eq("user_id", userId)
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

      const edlExitByLease = new Map<string, string>();
      const entryReportLeases = new Set<string>();
      for (const r of (edlRes.data || []) as any[]) {
        if (r.report_type === "entry") {
          entryReportLeases.add(r.lease_id);
        } else if (r.report_type === "exit" && !edlExitByLease.has(r.lease_id)) {
          edlExitByLease.set(r.lease_id, r.status || "");
        }
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
        const edlStatus = edlExitByLease.get(lease.id) || "";
        const edlDone = ["ready", "signed", "archived"].includes(edlStatus.toLowerCase());
        const hasEntryReport = entryReportLeases.has(lease.id);
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
        const cautionOneMonthDeadline = lease.end_date ? addMonths(lease.end_date, 1) : null;
        const cautionTwoMonthDeadline = lease.end_date ? addMonths(lease.end_date, 2) : null;

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
          cautionOneMonthDeadline,
          cautionTwoMonthDeadline,
          hasNewLease,
          submittedCount,
          hasEntryReport,
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

  const allDone = transitions.every((t) => !hasPendingSteps(t, plan));
  if (allDone) return null;

  return (
    <div className="space-y-2">
      <div className="px-1">
        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">
          Logement{transitions.length > 1 ? "s" : ""} en transition
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[0.62rem] font-bold text-amber-700">
            {transitions.length}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Objectif : reloger au plus vite. Formalités de départ d'abord (EDL de sortie, caution), puis nouveau locataire.
        </p>
      </div>

      {transitions.map((t) => {
        if (!hasPendingSteps(t, plan)) return null;

        // Services délégués à un tiers (agence...) : les tâches couvertes ne
        // sont pas à faire par le bailleur. "Mise en location & candidatures"
        // couvre l'annonce et le tri des dossiers ; "Bail & états des lieux"
        // couvre l'EDL sortie, la caution et le nouveau bail.
        const statuses = transitionStepStatuses(t, plan);
        const statusOf = (key: StepKey) => statuses[key];

        const remaining = STEPS.filter((s) => statusOf(s.key) === "pending");
        const total = STEPS.length;
        const pct = Math.round(((total - remaining.length) / total) * 100);
        const action = nextAction(statusOf, t.lease.id, t.submittedCount, t.lease.property_id, !!t.lease.deposit_paid_at);

        const daysUntilOneMonth = t.cautionOneMonthDeadline ? daysDiff(t.cautionOneMonthDeadline) : null;
        const daysUntilTwoMonths = t.cautionTwoMonthDeadline ? daysDiff(t.cautionTwoMonthDeadline) : null;
        const cautionShow = statusOf("caution") === "pending" && daysUntilOneMonth !== null;
        // Délai légal maximum (2 mois) dépassé : vraiment en retard, quel que
        // soit le contexte. Entre 1 et 2 mois : le délai est atteint si l'EDL
        // ne révèle aucune dégradation, mais encore dans les clous sinon — on
        // ne tranche pas (l'app ne compare pas les EDL entrée/sortie), d'où un
        // ton amber "à restituer" plutôt qu'un rouge "en retard".
        const cautionOverdue = daysUntilTwoMonths !== null && daysUntilTwoMonths < 0;
        const cautionDue = !cautionOverdue && daysUntilOneMonth !== null && daysUntilOneMonth <= 0;
        const cautionUrgent = !cautionOverdue && !cautionDue && daysUntilOneMonth !== null && daysUntilOneMonth <= 7;

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
              <span className={cx(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold",
                remaining.length === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              )}>
                {remaining.length === 0 ? "Prêt à signer" : `${remaining.length} étape${remaining.length > 1 ? "s" : ""} à faire`}
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
                const status = statusOf(s.key);
                const isLast = i === STEPS.length - 1;
                const skipped = isSkipped(status);
                // "Candidat" step : amber dot when submissions pending but none accepted yet
                const isWaiting = s.key === "candidat_retenu" && status === "pending" && t.submittedCount > 0;
                return (
                  <React.Fragment key={s.key}>
                    <div className={cx("flex min-w-[68px] flex-col items-center gap-1 text-center", skipped && "opacity-60")}>
                      <div className={cx(
                        "flex h-7 w-7 items-center justify-center rounded-full border-2 transition",
                        status === "done"
                          ? "border-emerald-400 bg-emerald-50"
                          : skipped
                          ? "border-dashed border-slate-300 bg-slate-50"
                          : isWaiting
                          ? "border-amber-400 bg-amber-50"
                          : "border-indigo-300 bg-white"
                      )}>
                        {status === "done"
                          ? <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                          : status === "locked"
                          ? <LockClosedIcon className="h-3 w-3 text-slate-400" />
                          : skipped
                          ? <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          : isWaiting
                          ? <span className="h-2 w-2 rounded-full bg-amber-400" />
                          : <span className="h-2 w-2 rounded-full bg-indigo-400" />
                        }
                      </div>
                      <span className={cx(
                        "text-[0.6rem] font-semibold leading-tight",
                        status === "done" ? "text-emerald-600" : skipped ? "text-slate-400" : isWaiting ? "text-amber-600" : "text-indigo-600"
                      )}>
                        {s.key === "candidat_retenu" && isWaiting
                          ? `${t.submittedCount} dossier${t.submittedCount > 1 ? "s" : ""}`
                          : s.label}
                      </span>
                      {status === "delegated" ? (
                        <span className="text-[0.55rem] font-medium leading-tight text-slate-400">Délégué agence</span>
                      ) : status === "locked" ? (
                        <Link href="/tarifs?source=transition" className="text-[0.55rem] font-semibold leading-tight text-[#4f46e5] underline-offset-2 hover:underline">
                          Plan lokt·one →
                        </Link>
                      ) : status === "not_required" ? (
                        <span className="text-[0.55rem] font-medium leading-tight text-slate-400">Non requis</span>
                      ) : null}
                    </div>
                    {!isLast && (
                      <div className={cx(
                        "mt-3.5 h-px flex-1 min-w-[8px]",
                        status === "done" || skipped ? "bg-emerald-200" : "bg-slate-100"
                      )} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {statusOf("edl") === "not_required" ? (
              <p className="flex items-center gap-1.5 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                <ClockIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                Aucun état des lieux d'entrée au dossier pour ce bail — pas de comparaison possible, cette étape n'est pas requise.
              </p>
            ) : null}

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
              {cautionShow ? (
                <div className={cx(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  cautionOverdue
                    ? "bg-red-100 text-red-700"
                    : cautionDue || cautionUrgent
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                )}>
                  <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                  {cautionOverdue
                    ? `Délai légal maximum dépassé (${Math.abs(daysUntilTwoMonths!)}j)`
                    : cautionDue
                    ? "Caution à restituer — délai légal atteint (1 mois, 2 si dégradations)"
                    : daysUntilOneMonth === 0
                    ? "Caution à restituer aujourd'hui (délai légal min.)"
                    : `Caution à restituer dans ${daysUntilOneMonth}j (délai légal min.)`
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
