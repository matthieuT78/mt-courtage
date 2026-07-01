// components/landlord/sections/SectionLocataires.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import { ExpandableSection } from "../ui/ExpandableSection";
import { ExpandableRow } from "../ui/ExpandableRow";
import { badge, cx, pluralFR } from "../ui/uiHelpers";
import { getLeaseRentPeriod } from "../../../lib/rentPeriod";
import { PhoneIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { RentPayment } from "../../../lib/landlord/types";

/* ======================================================
   TYPES
====================================================== */

export type Tenant = {
  id: string;
  user_id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived_at?: string | null;
  archived_reason?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Lease = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  status: string | null;
  auto_reminder_enabled?: boolean | null;
  auto_quittance_enabled?: boolean | null;
  rent_amount?: number | null;
  charges_amount?: number | null;
  created_at?: string;
};

export type PropertyLite = {
  id: string;
  label: string | null;
};

type InventoryExitReport = {
  id: string;
  status: "draft" | "ready" | "signed" | "archived" | string | null;
  performed_at: string | null;
};

type ArchiveWorkflow = {
  tenantId: string;
  leaseId: string;
  exitDate: string;
  exitReport: InventoryExitReport | null;
  edlConfirmed: boolean;
};

type Props = {
  userId: string;
  tenants?: Tenant[];
  leases?: Lease[];
  properties?: PropertyLite[];
  payments?: RentPayment[];
  onRefresh: () => Promise<void>;
  onContactTenant?: (tenantId: string) => void;
  initialDepartureTenantId?: string | null;
  onDepartureOpened?: () => void;
  onOpenExitInventory?: () => void;
  deepLink?: { key: number; openCreate?: boolean } | null;
};

const fmt = (v?: string | null) => (v ? v : "—");
const isNew = (createdAt?: string | null) =>
  !!createdAt && Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
const todayISO = () => new Date().toISOString().slice(0, 10);
const formatEuro = (value: number) => value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

function departureProrataSummary(lease: Lease, exitDate: string) {
  const period = getLeaseRentPeriod({ ...lease, end_date: exitDate }, exitDate.slice(0, 7));
  if (!period) return null;
  return {
    periodLabel: `${period.periodStart} → ${period.periodEnd}`,
    detail: `${formatEuro(period.rent)} de loyer + ${formatEuro(period.charges)} de charges`,
    total: formatEuro(period.total),
    prorated: period.prorated,
  };
}

/* ======================================================
   UTIL
====================================================== */

const withTimeout = async <T,>(p: Promise<T>, ms = 15000) => {
  let t: any;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`Timeout réseau (${ms}ms)`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
};

function buildFullName(first?: string, last?: string) {
  const f = (first || "").trim();
  const l = (last || "").trim();
  return [f, l].filter(Boolean).join(" ").trim();
}

function splitFullName(full?: string | null) {
  const s = (full || "").trim();
  if (!s) return { first: "", last: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function initials(first?: string | null, last?: string | null, fallbackFull?: string | null) {
  const f = (first || "").trim();
  const l = (last || "").trim();
  if (f || l) return ((f[0] || "L") + (l[0] || "")).toUpperCase();

  const n = (fallbackFull || "").trim();
  if (!n) return "L";
  const parts = n.split(/\s+/).slice(0, 2);
  const a = parts[0]?.[0] || "L";
  const b = parts.length > 1 ? parts[1]?.[0] : "";
  return (a + b).toUpperCase();
}

function displayName(t: Tenant) {
  const n = buildFullName(t.first_name || "", t.last_name || "");
  return n || (t.full_name || "Locataire");
}

function sanitizePhone(p?: string | null) {
  if (!p) return "";
  return p.replace(/\s+/g, "");
}

function copyToClipboard(v: string) {
  if (!v) return;
  navigator.clipboard?.writeText(v).catch(() => {});
}

function isArchived(t: Tenant) {
  return !!t.archived_at;
}

const AVATAR_COLORS = [
  "bg-violet-500", "bg-sky-500", "bg-indigo-500",
  "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-teal-500", "bg-orange-500",
];
function avatarColor(name: string): string {
  if (!name) return "bg-slate-400";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getTenantPaymentStatus(leaseId: string, payments: RentPayment[]): "paid" | "overdue" | "pending" {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const pastOverdue = payments.some(
    (p) => p.lease_id === leaseId && String(p.period_start || "").slice(0, 7) < currentMonth && !p.paid_at
  );
  if (pastOverdue) return "overdue";
  const current = payments.find((p) => p.lease_id === leaseId && String(p.period_start || "").slice(0, 7) === currentMonth);
  if (current?.paid_at) return "paid";
  if (current?.due_date && new Date(current.due_date + "T23:59:59") < now) return "overdue";
  return "pending";
}

/* ======================================================
   COMPONENT
====================================================== */

const CREATE_ID = "__create__";

export function SectionLocataires({
  userId,
  tenants,
  leases,
  properties,
  payments,
  onRefresh,
  onContactTenant,
  initialDepartureTenantId,
  onDepartureOpened,
  onOpenExitInventory,
  deepLink,
}: Props) {
  const safeTenants = Array.isArray(tenants) ? tenants : [];
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeProperties = Array.isArray(properties) ? properties : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const [expandedId, setExpandedId] = useState<string | null>(null); // row ouverte (create ou tenant id)
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"az" | "recent">("az");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [archiveWorkflow, setArchiveWorkflow] = useState<ArchiveWorkflow | null>(null);
  const [departureStep, setDepartureStep] = useState<1 | 2 | 3>(1);

  const propertyById = useMemo(() => {
    const m = new Map<string, PropertyLite>();
    for (const p of safeProperties) m.set(p.id, p);
    return m;
  }, [safeProperties]);

  const activeLeaseForTenant = (tenantId: string) => {
    const now = new Date();
    return (
      safeLeases.find((l) => {
        if (!l || l.tenant_id !== tenantId) return false;

        const startOk = l.start_date ? new Date(l.start_date) <= now : false;
        const notEnded = !l.end_date || new Date(l.end_date) >= now;

        if ((l.status || "").toLowerCase() === "active") return true;
        return startOk && notEnded;
      }) || null
    );
  };

  const activePropertyForTenant = (tenantId: string) => {
    const lease = activeLeaseForTenant(tenantId);
    if (!lease) return null;
    return propertyById.get(lease.property_id) || null;
  };

  const hasAnyLeaseForTenant = (tenantId: string) => safeLeases.some((l) => l?.tenant_id === tenantId);
  const hasActiveLeaseForTenant = (tenantId: string) =>
    safeLeases.some((l) => l?.tenant_id === tenantId && !["archived", "ended"].includes(String(l.status || "").toLowerCase()));

  const leasesForTenant = (tenantId: string) => safeLeases.filter((l) => l?.tenant_id === tenantId).slice(0, 12);

  const safeRefresh = async () => {
    try {
      await onRefresh?.();
    } catch (e) {
      console.error("[SectionLocataires] onRefresh error:", e);
    }
  };

  /* ======================================================
     DATA LISTS (actifs / archivés)
  ====================================================== */

  const normalized = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = safeTenants.filter((t) => {
      if (!q) return true;
      const name = (displayName(t) || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      const phone = (t.phone || "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });

    const sorter = (a: Tenant, b: Tenant) => {
      if (sort === "recent") {
        const da = new Date(a.updated_at || a.created_at || 0).getTime();
        const db = new Date(b.updated_at || b.created_at || 0).getTime();
        return db - da;
      }
      const na = (displayName(a) || "Locataire").toLowerCase();
      const nb = (displayName(b) || "Locataire").toLowerCase();
      return na.localeCompare(nb);
    };

    const actifs = base.filter((t) => !isArchived(t)).sort(sorter);
    const archives = base.filter((t) => isArchived(t)).sort(sorter);

    return { actifs, archives };
  }, [safeTenants, query, sort]);

  /* ======================================================
     FORMS
  ====================================================== */

  const emptyForm = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
    archived_reason: "",
  };

  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForms, setEditForms] = useState<Record<string, typeof emptyForm>>({});
  const [highlightCreate, setHighlightCreate] = useState(false);

  useEffect(() => {
    if (!deepLink?.openCreate) return;
    setExpandedId(CREATE_ID);
    setHighlightCreate(true);
    setTimeout(() => {
      document.getElementById("locataires-create-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    setTimeout(() => setHighlightCreate(false), 2500);
  }, [deepLink]);

  const formFromTenant = (t: Tenant) => {
    const fromCols = { first_name: (t.first_name || "").trim(), last_name: (t.last_name || "").trim() };
    const fromFull = splitFullName(t.full_name);

    return {
      first_name: fromCols.first_name || fromFull.first,
      last_name: fromCols.last_name || fromFull.last,
      email: t.email || "",
      phone: t.phone || "",
      notes: t.notes || "",
      archived_reason: t.archived_reason || "",
    };
  };

  // hydrate edit form quand on expand un tenant
  useEffect(() => {
    setErr(null);
    setOk(null);

    if (!expandedId || expandedId === CREATE_ID) return;
    const t = safeTenants.find((x) => x.id === expandedId);
    if (!t) return;

    setEditForms((prev) => {
      if (prev[expandedId]) return prev;

      return {
        ...prev,
        [expandedId]: formFromTenant(t),
      };
    });
  }, [expandedId, safeTenants]);

  /* ======================================================
     CRUD
  ====================================================== */

  const saveTenant = async (tenantId?: string) => {
    if (!userId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const isEdit = !!tenantId;
      const form = isEdit ? editForms[tenantId!] : createForm;
      if (!form) throw new Error("Formulaire introuvable.");

      const full_name = buildFullName(form.first_name, form.last_name) || "Locataire";

      const payload = {
        user_id: userId,
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        full_name,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        notes: form.notes?.trim() || null,
        archived_reason: form.archived_reason?.trim() || null,
      };

      if (isEdit) {
        const res = await withTimeout(
          Promise.resolve(
            supabase.from("tenants").update(payload).eq("id", tenantId).eq("user_id", userId).select("id").single()
          )
        );
        // @ts-ignore
        if ((res as any)?.error) throw (res as any).error;
        setOk("Locataire mis à jour ✅");
      } else {
        const res = await withTimeout(
          Promise.resolve(supabase.from("tenants").insert(payload).select("*").single())
        );
        // @ts-ignore
        if ((res as any)?.error) throw (res as any).error;

        const createdTenant = ((res as any)?.data ?? null) as Tenant | null;
        const newId = createdTenant?.id ?? null;

        setOk("Locataire créé ✅");
        if (createdTenant?.id) {
          setEditForms((prev) => ({
            ...prev,
            [createdTenant.id]: formFromTenant(createdTenant),
          }));
        }
        setCreateForm(emptyForm);
        setExpandedId(newId || null);
      }

      await safeRefresh();
    } catch (e: any) {
      console.error("[saveTenant] error:", e);
      setErr(e?.message || "Erreur lors de l’enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const getExitReportForLease = async (leaseId: string) => {
    if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

    const res = await withTimeout(
      Promise.resolve(
        supabase
          .from("inventory_reports")
          .select("id,status,performed_at")
          .eq("user_id", userId)
          .eq("lease_id", leaseId)
          .eq("report_type", "exit")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    );
    // @ts-ignore
    if ((res as any)?.error) throw (res as any).error;
    return ((res as any)?.data ?? null) as InventoryExitReport | null;
  };

  const archiveTenantOnly = async (tenantId: string, message = "Locataire archivé ✅") => {
    if (!userId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");
      const f = editForms[tenantId];
      const reason = f?.archived_reason?.trim() || null;

      const res = await withTimeout(
        Promise.resolve(
          supabase
            .from("tenants")
            .update({ archived_at: new Date().toISOString(), archived_reason: reason })
            .eq("id", tenantId)
            .eq("user_id", userId)
            .select("id")
            .single()
        )
      );
      // @ts-ignore
      if ((res as any)?.error) throw (res as any).error;

      setOk(message);
      await safeRefresh();
    } catch (e: any) {
      console.error("[archiveTenant] error:", e);
      setErr(e?.message || "Archivage impossible.");
    } finally {
      setLoading(false);
    }
  };

  const archiveTenant = async (tenantId: string) => {
    if (!userId) return;

    const activeLease = activeLeaseForTenant(tenantId);
    if (!activeLease) {
      await archiveTenantOnly(tenantId);
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const exitReport = await getExitReportForLease(activeLease.id);
      setArchiveWorkflow({
        tenantId,
        leaseId: activeLease.id,
        exitDate: activeLease.end_date || todayISO(),
        exitReport,
        edlConfirmed: false,
      });
      setDepartureStep(1);
    } catch (e: any) {
      console.error("[archiveTenant] exit workflow error:", e);
      setErr(e?.message || "Impossible de préparer le workflow de sortie.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialDepartureTenantId) return;
    setExpandedId(initialDepartureTenantId);
    archiveTenant(initialDepartureTenantId);
    onDepartureOpened?.();
    // Le tenantId sert de signal ponctuel envoyé par le cockpit ou la section Baux.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDepartureTenantId]);

  const saveDeparturePlan = async (tenantId: string) => {
    if (!userId || !archiveWorkflow || archiveWorkflow.tenantId !== tenantId) return;

    const activeLease = safeLeases.find((l) => l.id === archiveWorkflow.leaseId) || null;
    if (!activeLease) {
      setErr("Bail actif introuvable. Recharge la page puis réessaie.");
      return;
    }
    if (!archiveWorkflow.exitDate) {
      setErr("Renseigne la date effective de départ.");
      return;
    }
    if (archiveWorkflow.exitDate < activeLease.start_date) {
      setErr("La date de départ doit être postérieure au début du bail.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");
      const { error } = await supabase
        .from("leases")
        .update({ end_date: archiveWorkflow.exitDate, updated_at: new Date().toISOString() })
        .eq("id", activeLease.id)
        .eq("user_id", userId);
      if (error) throw error;

      setOk("Départ planifié : alertes et dernier loyer recalculés avec la date effective.");
      await safeRefresh();
      setDepartureStep(2);
    } catch (e: any) {
      console.error("[saveDeparturePlan] error:", e);
      setErr(e?.message || "Impossible d’enregistrer la date de départ.");
    } finally {
      setLoading(false);
    }
  };

  const completeExitAndArchive = async (tenantId: string) => {
    if (!userId || !archiveWorkflow || archiveWorkflow.tenantId !== tenantId) return;

    const activeLease = safeLeases.find((l) => l.id === archiveWorkflow.leaseId) || null;
    if (!activeLease) {
      setErr("Bail actif introuvable. Recharge la page puis réessaie.");
      return;
    }

    const exitStatus = (archiveWorkflow.exitReport?.status || "").toLowerCase();
    const exitReportReady = ["ready", "signed", "archived"].includes(exitStatus);

    if (!archiveWorkflow.exitDate) {
      setErr("Renseigne la date de sortie avant de clôturer le bail.");
      return;
    }
    if (archiveWorkflow.exitDate < activeLease.start_date) {
      setErr("La date de sortie doit être postérieure au début du bail.");
      return;
    }
    if (!exitReportReady && !archiveWorkflow.edlConfirmed) {
      setErr("Confirme que l’état des lieux de sortie a été fait ou qu’il doit être finalisé séparément.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const f = editForms[tenantId];
      const reason = f?.archived_reason?.trim() || "Départ du locataire";
      const now = new Date().toISOString();

      const leaseRes = await withTimeout(
        Promise.resolve(
          supabase
            .from("leases")
            .update({
              status: "ended",
              end_date: archiveWorkflow.exitDate,
              auto_reminder_enabled: false,
              auto_quittance_enabled: false,
              updated_at: now,
            })
            .eq("id", activeLease.id)
            .eq("user_id", userId)
        )
      );
      // @ts-ignore
      if ((leaseRes as any)?.error) throw (leaseRes as any).error;

      const tenantRes = await withTimeout(
        Promise.resolve(
          supabase
            .from("tenants")
            .update({ archived_at: now, archived_reason: reason })
            .eq("id", tenantId)
            .eq("user_id", userId)
        )
      );
      // @ts-ignore
      if ((tenantRes as any)?.error) throw (tenantRes as any).error;

      setArchiveWorkflow(null);
      setOk("Sortie clôturée : bail terminé, automatisations arrêtées, locataire archivé ✅");
      await safeRefresh();
    } catch (e: any) {
      console.error("[completeExitAndArchive] error:", e);
      setErr(e?.message || "Impossible de clôturer le workflow de sortie.");
    } finally {
      setLoading(false);
    }
  };

  const restoreTenant = async (tenantId: string) => {
    if (!userId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const res = await withTimeout(
        Promise.resolve(
          supabase
            .from("tenants")
            .update({ archived_at: null, archived_reason: null })
            .eq("id", tenantId)
            .eq("user_id", userId)
            .select("id")
            .single()
        )
      );
      // @ts-ignore
      if ((res as any)?.error) throw (res as any).error;

      setOk("Locataire restauré ✅");
      await safeRefresh();
    } catch (e: any) {
      console.error("[restoreTenant] error:", e);
      setErr(e?.message || "Restauration impossible.");
    } finally {
      setLoading(false);
    }
  };

  const deleteTenant = async (tenantId: string) => {
    if (!userId) return;

    if (hasAnyLeaseForTenant(tenantId)) {
      setErr("Suppression impossible : ce locataire a un historique de bail. Archivez-le pour le masquer — les données (quittances, comptabilité) sont conservées.");
      return;
    }
    if (!confirm("Supprimer définitivement ce locataire ?")) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const res = await withTimeout(Promise.resolve(supabase.from("tenants").delete().eq("id", tenantId).eq("user_id", userId)));
      // @ts-ignore
      if ((res as any)?.error) throw (res as any).error;

      setOk("Locataire supprimé ✅");
      if (expandedId === tenantId) setExpandedId(null);
      await safeRefresh();
    } catch (e: any) {
      console.error("[deleteTenant] error:", e);
      setErr(e?.message || "Suppression impossible.");
    } finally {
      setLoading(false);
    }
  };

  const departureTenant = archiveWorkflow ? safeTenants.find((tenant) => tenant.id === archiveWorkflow.tenantId) || null : null;
  const departureLease = archiveWorkflow ? safeLeases.find((lease) => lease.id === archiveWorkflow.leaseId) || null : null;
  const departureSummary =
    archiveWorkflow && departureLease ? departureProrataSummary(departureLease, archiveWorkflow.exitDate) : null;
  const departureEdlReady = ["ready", "signed", "archived"].includes(
    String(archiveWorkflow?.exitReport?.status || "").toLowerCase()
  );

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Locataires"
        title="Locataires"
        desc="Coordonnées, bail actif et statut de paiement du mois en cours pour chaque locataire."
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>
      ) : null}

      {/* TOOLBAR */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (nom, email, téléphone)…"
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-1 inline-flex self-start">
            <button
              type="button"
              onClick={() => setSort("az")}
              className={cx(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                sort === "az" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              A → Z
            </button>
            <button
              type="button"
              onClick={() => setSort("recent")}
              className={cx(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                sort === "recent" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              Récents
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {/* ✅ LIGNE CRÉER (pas de section) */}
        <div id="locataires-create-form" className={highlightCreate ? "rounded-2xl ring-2 ring-red-400 ring-offset-2 transition-shadow duration-500" : ""}>
        <ExpandableRow
          id={CREATE_ID}
          expandedId={expandedId}
          setExpandedId={(id) => {
            // Quand on ouvre "Créer", on reset les messages
            setErr(null);
            setOk(null);
            setExpandedId(id);
          }}
          tone="sky"
          hideRight
          left={
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {badge("sky", "Créer")}
                <p className="text-sm font-semibold text-slate-900">+ Nouveau locataire</p>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">Clique pour ouvrir le formulaire.</p>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Prénom</label>
              <input
                value={createForm.first_name}
                onChange={(e) => setCreateForm((s) => ({ ...s, first_name: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex : Marie"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Nom</label>
              <input
                value={createForm.last_name}
                onChange={(e) => setCreateForm((s) => ({ ...s, last_name: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex : Dupont"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Email</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="nom@email.fr"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Téléphone</label>
              <input
                value={createForm.phone}
                onChange={(e) => setCreateForm((s) => ({ ...s, phone: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="06 00 00 00 00"
              />
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <label className="text-[0.7rem] text-slate-700">Notes</label>
            <textarea
              rows={3}
              value={createForm.notes}
              onChange={(e) => setCreateForm((s) => ({ ...s, notes: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => saveTenant(undefined)}
              className="rounded-full bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {loading ? "Enregistrement…" : "Créer"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => setExpandedId(null)}
              className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </ExpandableRow>
        </div>

        {/* 1) ACTIFS */}
        <ExpandableSection
          title="Actifs"
          subtitle="Clique une ligne pour voir / modifier."
          right={badge("emerald", pluralFR(normalized.actifs.length, "locataire"))}
          defaultOpen={true}
        >
          {normalized.actifs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun locataire actif.
            </div>
          ) : (
            <div className="space-y-2">
              {normalized.actifs.map((t) => {
                const open = expandedId === t.id;
                const activeLease = activeLeaseForTenant(t.id);
                const p = activePropertyForTenant(t.id);
                const hasLease = hasAnyLeaseForTenant(t.id);

                const f =
                  editForms[t.id] ??
                  ({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    notes: "",
                    archived_reason: "",
                  } as const);

                const paymentStatus = activeLease ? getTenantPaymentStatus(activeLease.id, safePayments) : null;
                const paymentBadge = open
                  ? badge("slate", "Ouvert")
                  : paymentStatus === "paid"
                  ? badge("emerald", "Payé ✓")
                  : paymentStatus === "overdue"
                  ? badge("red", "En retard")
                  : null;
                const totalRent = activeLease
                  ? Number(activeLease.rent_amount || 0) + Number(activeLease.charges_amount || 0)
                  : 0;

                return (
                  <ExpandableRow
                    key={t.id}
                    id={t.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => {
                      setErr(null);
                      setOk(null);
                      setExpandedId(id);
                    }}
                    left={
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className={cx("shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center text-sm font-bold text-white", avatarColor(displayName(t)))}>
                            {initials(t.first_name, t.last_name, t.full_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1.5 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate min-w-0">{displayName(t)}</p>
                              {isNew(t.created_at) && <em className="shrink-0 text-[0.65rem] font-medium text-indigo-400">new</em>}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <p className="text-[0.75rem] text-slate-600 truncate">
                                {t.email || "—"}{t.phone ? ` · ${t.phone}` : ""}
                              </p>
                              {t.phone ? (
                                <a
                                  href={`tel:${sanitizePhone(t.phone)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  title={`Appeler ${t.phone}`}
                                  className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
                                >
                                  <PhoneIcon className="h-3.5 w-3.5" />
                                </a>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {activeLease ? badge("emerald", "Actif") : hasLease ? badge("slate", "Historique") : badge("amber", "Sans bail")}
                              {p ? (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-slate-800">
                                  🏠 {p.label}
                                </span>
                              ) : null}
                              {totalRent > 0 ? (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-slate-700">
                                  {formatEuro(totalRent)}/mois
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    }
                    right={paymentBadge}
                  >
                    {/* Quick actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onContactTenant?.(t.id)}
                        className="rounded-full bg-slate-950 px-3 py-1.5 text-[0.75rem] font-semibold text-white hover:bg-slate-800"
                      >
                        Contacter
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          copyToClipboard(t.email || "");
                          setOk(t.email ? "Email copié ✅" : "Aucun email.");
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Copier email
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          copyToClipboard(sanitizePhone(t.phone));
                          setOk(t.phone ? "Téléphone copié ✅" : "Aucun téléphone.");
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Copier tél.
                      </button>

                      {t.phone ? (
                        <a
                          href={`tel:${sanitizePhone(t.phone)}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Appeler
                        </a>
                      ) : null}

                      {t.email ? (
                        <a
                          onClick={(e) => e.stopPropagation()}
                          href={`mailto:${t.email}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Envoyer un email
                        </a>
                      ) : null}
                    </div>

                    {/* Form */}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Prénom</label>
                        <input
                          value={f.first_name}
                          onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, first_name: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Nom</label>
                        <input
                          value={f.last_name}
                          onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, last_name: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Email</label>
                        <input
                          type="email"
                          value={f.email}
                          onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, email: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Téléphone</label>
                        <input
                          value={f.phone}
                          onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, phone: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Notes</label>
                      <textarea
                        rows={3}
                        value={f.notes}
                        onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, notes: e.target.value } }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="mt-3 space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Raison d’archivage (optionnel)</label>
                      <input
                        value={f.archived_reason}
                        onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, archived_reason: e.target.value } }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Ex : départ, état des lieux…"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => saveTenant(t.id)}
                        className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {loading ? "Enregistrement…" : "Mettre à jour"}
                      </button>

                      {archiveWorkflow?.tenantId !== t.id ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => archiveTenant(t.id)}
                          className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {activeLease ? "Gérer le départ" : "Archiver"}
                        </button>
                      ) : null}

                      {!hasLease ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => deleteTenant(t.id)}
                          className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      ) : (
                        <span className="text-[0.75rem] text-slate-500">Archivez-le pour le masquer</span>
                      )}
                    </div>

                    {/* History */}
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[0.75rem] font-semibold text-slate-900">Historique des baux</p>
                      <div className="mt-2 space-y-2">
                        {leasesForTenant(t.id).length === 0 ? (
                          <p className="text-[0.75rem] text-slate-500">Aucun bail.</p>
                        ) : (
                          leasesForTenant(t.id).map((l) => {
                            const prop = propertyById.get(l.property_id);
                            return (
                              <div key={l.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                <p className="text-[0.75rem] font-semibold text-slate-900">
                                  🏠 {prop?.label || "Bien"} • {fmt(l.status)}
                                </p>
                                <p className="text-[0.7rem] text-slate-600">
                                  Début : {l.start_date} • Fin : {l.end_date || "—"}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>

        {/* 2) ARCHIVÉS */}
        <ExpandableSection
          title="Archivés"
          subtitle="Restaure si besoin, ou supprime si aucun bail."
          right={badge("amber", pluralFR(normalized.archives.length, "locataire"))}
          defaultOpen={false}
        >
          {normalized.archives.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun locataire archivé.
            </div>
          ) : (
            <div className="space-y-2">
              {normalized.archives.map((t) => {
                const f =
                  editForms[t.id] ??
                  ({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    notes: "",
                    archived_reason: t.archived_reason || "",
                  } as const);

                return (
                  <ExpandableRow
                    key={t.id}
                    id={t.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => {
                      setErr(null);
                      setOk(null);
                      setExpandedId(id);
                    }}
                    left={
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 h-10 w-10 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-800">
                            {initials(t.first_name, t.last_name, t.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{displayName(t)}</p>
                            <p className="mt-0.5 text-[0.75rem] text-slate-600 truncate">
                              {(t.email || "—") + (t.phone ? ` • ${t.phone}` : "")}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {badge("amber", "Archivé")}
                              {t.archived_at ? badge("slate", `Le ${new Date(t.archived_at).toLocaleDateString("fr-FR")}`) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    }
                  >
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Raison d’archivage</label>
                      <input
                        value={f.archived_reason}
                        onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, archived_reason: e.target.value } }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => onContactTenant?.(t.id)}
                        className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Contacter
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => restoreTenant(t.id)}
                        className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Restaurer
                      </button>

                      {!hasAnyLeaseForTenant(t.id) ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => deleteTenant(t.id)}
                          className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      ) : (
                        <span className="text-[0.75rem] text-slate-500">Données conservées</span>
                      )}
                    </div>
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>
      </div>

      {archiveWorkflow && departureTenant && departureLease ? (
        <div
          className="fixed inset-0 z-[210] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={`Gérer le départ de ${displayName(departureTenant)}`}
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Départ locataire · étape {departureStep}/3
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">Départ de {displayName(departureTenant)}</h3>
                </div>
                <button
                  type="button"
                  title="Fermer"
                  aria-label="Fermer"
                  onClick={() => setArchiveWorkflow(null)}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {["Date de départ", "État des lieux", "Clôture"].map((label, index) => (
                  <div key={label}>
                    <div className={cx("h-1 rounded-full", departureStep >= index + 1 ? "bg-slate-950" : "bg-slate-200")} />
                    <p className={cx("mt-1 text-[0.68rem] font-semibold", departureStep === index + 1 ? "text-slate-900" : "text-slate-500")}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5">
              {departureStep === 1 ? (
                <>
                  <h4 className="text-base font-semibold text-slate-950">Quand le locataire quitte-t-il le logement ?</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Cette date adapte le dernier loyer, les charges et les alertes de sortie.
                  </p>
                  <label className="mt-4 block text-xs font-semibold text-slate-700">Date effective de départ</label>
                  <input
                    type="date"
                    value={archiveWorkflow.exitDate}
                    onChange={(e) => setArchiveWorkflow((workflow) => (workflow ? { ...workflow, exitDate: e.target.value } : workflow))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900"
                  />
                  {departureSummary ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Dernier mois recalculé</p>
                      <p className="mt-1 text-xl font-semibold text-slate-950">{departureSummary.total}</p>
                      <p className="mt-1 text-sm text-slate-600">{departureSummary.detail}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Période {departureSummary.periodLabel}{departureSummary.prorated ? " · prorata automatique" : ""}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => saveDeparturePlan(departureTenant.id)}
                      className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {loading ? "Enregistrement…" : "Continuer"}
                    </button>
                  </div>
                </>
              ) : null}

              {departureStep === 2 ? (
                <>
                  <h4 className="text-base font-semibold text-slate-950">État des lieux de sortie</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Prépare le document dans lokt.fr ou importe le PDF transmis par l’agence. Tu pourras reprendre cet assistant ensuite.
                  </p>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-900">
                      {departureEdlReady
                        ? "État des lieux finalisé"
                        : archiveWorkflow.exitReport
                        ? `Document ${archiveWorkflow.exitReport.status || "en cours"}`
                        : "Aucun état des lieux de sortie rattaché"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {departureEdlReady ? "Le document est prêt pour clôturer le bail." : "La sortie peut rester planifiée pendant la préparation du document."}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <button type="button" onClick={() => setDepartureStep(1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                      Précédent
                    </button>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          setArchiveWorkflow(null);
                          onOpenExitInventory?.();
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Ouvrir les états des lieux
                      </button>
                      <button type="button" onClick={() => setDepartureStep(3)} className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                        Continuer
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              {departureStep === 3 ? (
                <>
                  <h4 className="text-base font-semibold text-slate-950">Clôturer le dossier locatif</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Le bail sera terminé, les automatisations seront arrêtées et le locataire sera archivé.
                  </p>
                  <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <p><span className="font-semibold text-slate-950">Départ :</span> {archiveWorkflow.exitDate}</p>
                    <p><span className="font-semibold text-slate-950">Dernier mois :</span> {departureSummary?.total || "—"}</p>
                    <p><span className="font-semibold text-slate-950">État des lieux :</span> {departureEdlReady ? "finalisé" : "à finaliser séparément"}</p>
                  </div>
                  {!departureEdlReady ? (
                    <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-950">
                      <input
                        type="checkbox"
                        checked={archiveWorkflow.edlConfirmed}
                        onChange={(e) => setArchiveWorkflow((workflow) => (workflow ? { ...workflow, edlConfirmed: e.target.checked } : workflow))}
                        className="mt-0.5"
                      />
                      <span>Je souhaite clôturer maintenant et finaliser l’état des lieux de sortie séparément.</span>
                    </label>
                  ) : null}
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <button type="button" onClick={() => setDepartureStep(2)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                      Précédent
                    </button>
                    <button
                      type="button"
                      disabled={loading || (!departureEdlReady && !archiveWorkflow.edlConfirmed)}
                      onClick={() => completeExitAndArchive(departureTenant.id)}
                      className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading ? "Clôture…" : "Clôturer le bail"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
