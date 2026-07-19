// components/landlord/sections/SectionBiens.tsx
import React, { useEffect, useMemo, useState } from "react";
import { xhrUploadDirect } from "../../../lib/uploadWithProgress";
import { UploadProgressBar } from "../../UploadProgressBar";
import Link from "next/link";
import {
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  PencilSquareIcon,
  PlusIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import { ExpandableSection } from "../ui/ExpandableSection";
import { ExpandableRow } from "../ui/ExpandableRow";
import { badge, cx, pluralFR } from "../ui/uiHelpers";
import { usePermissions } from "../../PermissionProvider";
import { PropertyDpePanel } from "../PropertyDpePanel";
import PostalCodeCityFields from "../../forms/PostalCodeCityFields";

type Props = {
  userId: string;
  properties?: any[];
  leases?: any[];
  tenants?: any[];
  photos?: any[];
  onRefresh: () => Promise<void>;
  deepLink?: { key: number; openCreate?: boolean } | null;
  onGoToBaux?: () => void;
};

const CREATE_ID = "__create__";
const FREE_PROPERTY_LIMIT = 1;

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "Appartement",
  house: "Maison",
  garage: "Garage",
  parking: "Parking",
  other: "Autre",
};

const DPE_OPTIONS = ["", "A", "B", "C", "D", "E", "F", "G"] as const;
const isNew = (createdAt?: string | null) =>
  !!createdAt && Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
const SUBSCRIPTION_URL = "/mon-compte/abonnement";

const EMPTY = {
  id: null as string | null,
  type: "apartment",
  label: "",
  address_line1: "",
  postal_code: "",
  city: "",
  description: "",
  surface_m2: "",
  rooms: "",
  energy_class: "",
  energy_value: "",
  ghg_class: "",
  delegated_services: [] as string[],
  delegation_agency_name: "",
};

const DELEGATED_SERVICES = [
  { key: "mise_en_location", label: "Mise en location & candidatures", desc: "Recherche locataire, dossiers de candidature" },
  { key: "bail_edl", label: "Bail & états des lieux", desc: "Rédaction du bail, état des lieux entrée et sortie" },
  { key: "gestion_courante", label: "Gestion courante", desc: "Encaissement loyers, quittances, révision IRL" },
  { key: "depot_garantie", label: "Dépôt de garantie", desc: "Encaissement et restitution" },
] as const;

const toNumOrNull = (v: string) => {
  const n = Number(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function isArchived(p: any) {
  return (p?.status || "").toLowerCase() === "archived";
}

const normalizeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(String(value).slice(0, 10) + "T00:00:00");
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const daysBetween = (start: Date, end: Date) => Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));

const pct = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
};

function formatDateFR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  if (!Number.isFinite(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function durationLabel(days: number | null | undefined) {
  if (days == null || !Number.isFinite(days) || days < 0) return "—";
  if (days < 31) return `${days} j`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  return restMonths ? `${years} an${years > 1 ? "s" : ""} ${restMonths} mois` : `${years} an${years > 1 ? "s" : ""}`;
}

function isLeaseUsable(lease: any) {
  const status = String(lease?.status || "").toLowerCase();
  return status !== "draft" && status !== "archived";
}

function isLeaseCurrent(lease: any, now: Date) {
  if (String(lease?.status || "").toLowerCase() !== "active") return false;
  const start = normalizeDate(lease?.start_date);
  const end = normalizeDate(lease?.end_date);
  if (!start || start.getTime() > now.getTime()) return false;
  return !end || end.getTime() >= now.getTime();
}

function occupancyDaysForWindow(leases: any[], windowStart: Date, windowEnd: Date) {
  const intervals = leases
    .filter(isLeaseUsable)
    .map((lease) => {
      const start = normalizeDate(lease?.start_date);
      const rawEnd = normalizeDate(lease?.end_date);
      if (!start) return null;
      const end = rawEnd ? addDays(rawEnd, 1) : windowEnd;
      const clippedStart = new Date(Math.max(start.getTime(), windowStart.getTime()));
      const clippedEnd = new Date(Math.min(end.getTime(), windowEnd.getTime()));
      return clippedEnd.getTime() > clippedStart.getTime() ? { start: clippedStart, end: clippedEnd } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.start.getTime() - b.start.getTime()) as Array<{ start: Date; end: Date }>;

  const merged: Array<{ start: Date; end: Date }> = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval.start.getTime() > last.end.getTime()) {
      merged.push({ ...interval });
    } else if (interval.end.getTime() > last.end.getTime()) {
      last.end = interval.end;
    }
  }
  return merged.reduce((total, interval) => total + daysBetween(interval.start, interval.end), 0);
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function occupancyTone(value: number) {
  if (value >= 95) return "emerald" as const;
  if (value >= 80) return "sky" as const;
  if (value >= 60) return "amber" as const;
  return "red" as const;
}

function occupancyLabel(value: number) {
  if (value >= 95) return "Très stable";
  if (value >= 80) return "Sous contrôle";
  if (value >= 60) return "À surveiller";
  return "Vacance forte";
}

function toneClasses(tone: "emerald" | "sky" | "amber" | "red" | "slate") {
  if (tone === "emerald") return { text: "text-emerald-700", bg: "bg-emerald-500", soft: "bg-emerald-50", border: "border-emerald-200" };
  if (tone === "sky") return { text: "text-sky-700", bg: "bg-sky-500", soft: "bg-sky-50", border: "border-sky-200" };
  if (tone === "amber") return { text: "text-amber-700", bg: "bg-amber-500", soft: "bg-amber-50", border: "border-amber-200" };
  if (tone === "red") return { text: "text-red-700", bg: "bg-red-500", soft: "bg-red-50", border: "border-red-200" };
  return { text: "text-slate-700", bg: "bg-slate-500", soft: "bg-slate-50", border: "border-slate-200" };
}

function rowSignal(row: { currentLease: any; vacancyDays12m: number; turnover12m: number; occupancyRate12m: number }) {
  if (!row.currentLease) return { tone: "red" as const, label: "Vacant", detail: "Remettre en location ou compléter le bail en cours." };
  if (row.turnover12m >= 2) return { tone: "amber" as const, label: "Turnover élevé", detail: "Vérifier loyer, qualité du logement ou profil locataire." };
  if (row.occupancyRate12m >= 95) return { tone: "emerald" as const, label: "Stable", detail: "Occupation solide sur 12 mois." };
  if (row.vacancyDays12m >= 30) return { tone: "amber" as const, label: "Vacance notable", detail: "Revoir délai de relocation et attractivité." };
  return { tone: "sky" as const, label: "Correct", detail: "Suivi normal du bien." };
}

export function SectionBiens({ userId, properties, leases, tenants, photos, onRefresh, deepLink, onGoToBaux }: Props) {
  const { loading: permissionsLoading, maxActiveProperties } = usePermissions();
  const safeProperties = Array.isArray(properties) ? properties : [];
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeTenants = Array.isArray(tenants) ? tenants : [];
  const safePhotos = Array.isArray(photos) ? photos : [];

  const [expandedId, setExpandedId] = useState<string | null>(null); // "__create__" ou propertyId
  const [editingId, setEditingId] = useState<string | null>(null); // bien en cours d'édition (formulaire visible)
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [uploadPhotoProgress, setUploadPhotoProgress] = useState<number | null>(null);
  // Erreurs de validation par champ, indexées par formId ("create" ou propertyId)
  const [fieldErrors, setFieldErrors] = useState<Record<string, { label?: string; address_line1?: string }>>({});

  const photosByProperty = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const ph of safePhotos) {
      const pid = ph?.property_id;
      if (!pid) continue;
      if (!m.has(pid)) m.set(pid, []);
      m.get(pid)!.push(ph);
    }
    return m;
  }, [safePhotos]);

  const { actifs, archives } = useMemo(() => {
    const a = safeProperties.filter((p) => !isArchived(p));
    const ar = safeProperties.filter((p) => isArchived(p));
    return { actifs: a, archives: ar };
  }, [safeProperties]);

  const tenantById = useMemo(() => {
    const m = new Map<string, any>();
    for (const tenant of safeTenants) {
      if (tenant?.id) m.set(tenant.id, tenant);
    }
    return m;
  }, [safeTenants]);

  const parcStats = useMemo(() => {
    const now = new Date();
    const windowEnd = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1);
    const windowStart = addDays(windowEnd, -365);
    const windowDays = Math.max(1, daysBetween(windowStart, windowEnd));

    const rows = actifs.map((property) => {
      const propertyLeases = safeLeases.filter((lease) => lease?.property_id === property?.id);
      const usableLeases = propertyLeases.filter(isLeaseUsable);
      const firstLeaseStart =
        usableLeases
          .map((lease) => normalizeDate(lease?.start_date))
          .filter((date): date is Date => Boolean(date))
          .sort((a, b) => a.getTime() - b.getTime())[0] || null;
      const analysisStart =
        firstLeaseStart && firstLeaseStart.getTime() > windowStart.getTime() && firstLeaseStart.getTime() < windowEnd.getTime()
          ? firstLeaseStart
          : windowStart;
      const analysisDays = Math.max(1, daysBetween(analysisStart, windowEnd));
      const currentLease =
        propertyLeases
          .filter((lease) => isLeaseCurrent(lease, now))
          .sort((a, b) => (normalizeDate(b?.start_date)?.getTime() || 0) - (normalizeDate(a?.start_date)?.getTime() || 0))[0] || null;
      const currentTenant = currentLease ? tenantById.get(currentLease.tenant_id) : null;
      const occupiedDays12m = occupancyDaysForWindow(propertyLeases, analysisStart, windowEnd);
      const vacancyDays12m = Math.max(0, analysisDays - occupiedDays12m);
      const turnover12m = propertyLeases.filter((lease) => {
        const start = normalizeDate(lease?.start_date);
        return start && start.getTime() >= windowStart.getTime() && start.getTime() < windowEnd.getTime() && isLeaseUsable(lease);
      }).length;
      const currentStart = normalizeDate(currentLease?.start_date);
      const currentTenantDays = currentStart ? daysBetween(currentStart, now) : null;

      return {
        property,
        currentLease,
        currentTenant,
        currentTenantDays,
        analysisDays,
        analysisStart,
        occupiedDays12m,
        vacancyDays12m,
        occupancyRate12m: (occupiedDays12m / analysisDays) * 100,
        turnover12m,
      };
    });

    const totalWindowDays = Math.max(1, rows.reduce((sum, row) => sum + row.analysisDays, 0));
    const totalOccupiedDays = rows.reduce((sum, row) => sum + row.occupiedDays12m, 0);
    const occupiedNow = rows.filter((row) => row.currentLease).length;
    const currentDurations = rows.map((row) => row.currentTenantDays).filter((days): days is number => days != null);
    const averageCurrentTenantDays = currentDurations.length
      ? Math.round(currentDurations.reduce((sum, days) => sum + days, 0) / currentDurations.length)
      : null;

    return {
      rows,
      occupiedNow,
      averageCurrentTenantDays,
      occupancyRate12m: rows.length ? (totalOccupiedDays / totalWindowDays) * 100 : 0,
      averageVacancyDays12m: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.vacancyDays12m, 0) / rows.length) : 0,
      turnover12m: rows.reduce((sum, row) => sum + row.turnover12m, 0),
      vacantNow: rows.filter((row) => !row.currentLease).length,
      attentionCount: rows.filter((row) => !row.currentLease || row.turnover12m >= 2 || row.vacancyDays12m >= 30).length,
    };
  }, [actifs, safeLeases, tenantById]);
  const activePropertyCount = actifs.length;
  const activePropertyLimit = permissionsLoading ? FREE_PROPERTY_LIMIT : Math.max(maxActiveProperties, FREE_PROPERTY_LIMIT);
  const hasFreeLimit = activePropertyLimit === FREE_PROPERTY_LIMIT;
  const freeLimitReached = activePropertyCount >= activePropertyLimit;
  const upgradeMessage =
    activePropertyLimit === FREE_PROPERTY_LIMIT
      ? "L’offre gratuite inclut 1 logement actif. Pour ajouter ou restaurer un 2e logement, vous devez souscrire à un abonnement."
      : `Votre abonnement permet ${activePropertyLimit} logements actifs. Passez à l’offre supérieure pour en ajouter davantage.`;

  const [createForm, setCreateForm] = useState(EMPTY);
  const [editForms, setEditForms] = useState<Record<string, typeof EMPTY>>({});
  const [highlightCreate, setHighlightCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!deepLink?.openCreate) return;
    setExpandedId(CREATE_ID);
    setHighlightCreate(true);
    setTimeout(() => {
      document.getElementById("biens-create-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    setTimeout(() => setHighlightCreate(false), 2500);
  }, [deepLink]);

  const validate = (f: typeof EMPTY, formId: string): boolean => {
    const label = (f.label || "").trim();
    const addr1 = (f.address_line1 || "").trim();
    const errors: { label?: string; address_line1?: string } = {};
    if (!label) errors.label = "Champ obligatoire";
    if (!addr1) errors.address_line1 = "Champ obligatoire";
    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, [formId]: errors }));
      return false;
    }
    setFieldErrors((prev) => { const next = { ...prev }; delete next[formId]; return next; });
    return true;
  };

  const safeRefresh = async () => {
    try {
      await onRefresh?.();
    } catch (e) {
      console.error("[SectionBiens] onRefresh error:", e);
    }
  };

  const hydrateEditForm = (p: any) => {
    if (!p?.id) return;

    setEditForms((prev) => {
      if (prev[p.id]) return prev;

      return {
        ...prev,
        [p.id]: {
          ...EMPTY,
          ...p,
          id: p.id,
          label: p.label ?? "",
          address_line1: p.address_line1 ?? "",
          postal_code: p.postal_code ?? "",
          city: p.city ?? "",
          description: p.description ?? "",
          surface_m2: p.surface_m2 != null ? String(p.surface_m2) : "",
          rooms: p.rooms != null ? String(p.rooms) : "",
          energy_class: p.energy_class ?? "",
          energy_value: p.energy_value != null ? String(p.energy_value) : "",
          ghg_class: p.ghg_class ?? "",
          delegated_services: Array.isArray(p.delegated_services) ? p.delegated_services : [],
          delegation_agency_name: p.delegation_agency_name ?? "",
        },
      };
    });
  };

  // hydrate quand on ouvre une row bien
  useEffect(() => {
    setErr(null);
    setOk(null);

    if (!expandedId || expandedId === CREATE_ID) return;
    const p = safeProperties.find((x) => x?.id === expandedId);
    if (!p) return;
    hydrateEditForm(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  // referme le formulaire d'édition dès qu'on change de ligne ouverte
  useEffect(() => {
    setEditingId(null);
  }, [expandedId]);

  const saveProperty = async (propertyId?: string) => {
    if (!userId) {
      setErr("userId manquant.");
      return;
    }

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const isEdit = !!propertyId;
      if (!isEdit && freeLimitReached) throw new Error(upgradeMessage);

      const form = isEdit ? editForms[propertyId!] : createForm;
      if (!form) throw new Error("Formulaire introuvable.");

      const formId = propertyId || "create";
      if (!validate(form, formId)) return;

      const selectedIsArchived = isEdit ? isArchived(safeProperties.find((p) => p?.id === propertyId)) : false;

      const payload = {
        user_id: userId,
        type: form.type,
        label: (form.label || "").trim(),
        address_line1: (form.address_line1 || "").trim(),
        postal_code: (form.postal_code || "").trim() || null,
        city: (form.city || "").trim() || null,
        description: (form.description || "").trim() || null,
        surface_m2: form.surface_m2 ? toNumOrNull(form.surface_m2) : null,
        rooms: form.rooms ? toNumOrNull(form.rooms) : null,
        energy_class: (form.energy_class || "").trim() || null,
        energy_value: form.energy_value ? toNumOrNull(form.energy_value) : null,
        ghg_class: (form.ghg_class || "").trim() || null,
        delegated_services: Array.isArray(form.delegated_services) ? form.delegated_services : [],
        delegation_agency_name: (form.delegation_agency_name || "").trim() || null,
        status: isEdit ? (selectedIsArchived ? "archived" : "active") : "active",
      };

      if (isEdit) {
        const { error } = await supabase.from("properties").update(payload).eq("id", propertyId).eq("user_id", userId);
        if (error) throw error;
        setOk("Bien mis à jour ✅");
        setEditingId(null);
      } else {
        const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
        if (error) throw error;

        const newId = (data as any)?.id ?? null;

        setOk("Bien créé ✅");
        setCreateForm(EMPTY);
        setExpandedId(newId);
      }

      await safeRefresh();
    } catch (e: any) {
      console.error("[saveProperty] error:", e);
      setErr(e?.message || "Erreur lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id: string) => {
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      if (!userId) throw new Error("userId manquant.");

      const { error } = await supabase
        .from("properties")
        .update({ status: "archived" })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;

      setOk("Bien archivé ✅");
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible d’archiver ce bien.");
    }
  };

  const restore = async (id: string) => {
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      if (!userId) throw new Error("userId manquant.");
      if (freeLimitReached) throw new Error(upgradeMessage);

      const { error } = await supabase
        .from("properties")
        .update({ status: "active" })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;

      setOk("Bien restauré ✅");
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible de restaurer ce bien.");
    }
  };

  const hasAnyLeaseForProperty = (propertyId: string) =>
    safeLeases.some((l) => l?.property_id === propertyId);

  const remove = async (id: string) => {
    if (hasAnyLeaseForProperty(id)) {
      setErr("Suppression impossible : ce bien a un historique de bail. Archivez-le pour le masquer des vues actives — les données (quittances, comptabilité) sont conservées.");
      return;
    }

    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      if (!userId) throw new Error("userId manquant.");

      await supabase.from("property_finance").delete().eq("property_id", id).eq("user_id", userId);
      await supabase.from("property_inventory_items").delete().eq("property_id", id).eq("user_id", userId);

      const { error } = await supabase.from("properties").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;

      setOk("Bien supprimé ✅");
      if (expandedId === id) setExpandedId(null);
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Suppression impossible.");
    }
  };

  const uploadPhoto = async (file: File, propertyId: string) => {
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      if (!userId) throw new Error("userId manquant.");

      if (file.size > 2 * 1024 * 1024) throw new Error("Image > 2 Mo refusée.");

      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${propertyId}/${Date.now()}-${safeName}`;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expirée.");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      setUploadPhotoProgress(0);
      await xhrUploadDirect(supabaseUrl, "property-photos", path, accessToken, anonKey, file, (pct) => setUploadPhotoProgress(pct), false);
      setUploadPhotoProgress(null);

      const { data } = supabase.storage.from("property-photos").getPublicUrl(path);
      const url = data?.publicUrl;
      if (!url) throw new Error("Impossible d’obtenir l’URL publique de la photo.");

      const { error: insErr } = await supabase.from("property_photos").insert({
        user_id: userId,
        property_id: propertyId,
        url,
      });
      if (insErr) throw insErr;

      setOk("Photo ajoutée ✅");
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Erreur upload.");
      setUploadPhotoProgress(null);
    }
  };

  const clearFieldError = (formId: string, field: "label" | "address_line1") => {
    setFieldErrors((prev) => {
      if (!prev[formId]?.[field]) return prev;
      const next = { ...prev, [formId]: { ...prev[formId], [field]: undefined } };
      return next;
    });
  };

  const renderForm = (
    form: typeof EMPTY,
    setForm: (updater: (prev: typeof EMPTY) => typeof EMPTY) => void,
    propertyId?: string | null
  ) => {
    const formId = propertyId || "create";
    const fErr = fieldErrors[formId] ?? {};
    const selectedPhotos = propertyId ? (photosByProperty.get(propertyId) ?? []) : [];

    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <input
              className={`w-full rounded-xl border px-3 py-2 text-sm bg-white ${fErr.label ? "border-red-400 ring-1 ring-red-300" : "border-slate-300"}`}
              placeholder="Nom du bien *"
              value={form.label}
              onChange={(e) => { clearFieldError(formId, "label"); setForm((s) => ({ ...s, label: e.target.value })); }}
            />
            {fErr.label ? <p className="text-xs font-medium text-red-600">{fErr.label}</p> : null}
          </div>

          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.type}
            onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
          >
            <option value="apartment">Appartement</option>
            <option value="house">Maison</option>
            <option value="garage">Garage</option>
            <option value="parking">Parking</option>
            <option value="other">Autre</option>
          </select>
        </div>

        <div className="mt-3 space-y-1">
          <input
            className={`w-full rounded-xl border px-3 py-2 text-sm bg-white ${fErr.address_line1 ? "border-red-400 ring-1 ring-red-300" : "border-slate-300"}`}
            placeholder="Adresse (ligne 1) *"
            value={form.address_line1}
            onChange={(e) => { clearFieldError(formId, "address_line1"); setForm((s) => ({ ...s, address_line1: e.target.value })); }}
          />
          {fErr.address_line1 ? <p className="text-xs font-medium text-red-600">{fErr.address_line1}</p> : null}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr,180px]">
          <PostalCodeCityFields
            idPrefix={`property_${propertyId || "new"}`}
            postalCode={form.postal_code}
            city={form.city}
            onPostalCodeChange={(value) => setForm((s) => ({ ...s, postal_code: value }))}
            onCityChange={(value) => setForm((s) => ({ ...s, city: value }))}
            className="grid gap-3 sm:grid-cols-3"
          />
          <label className="space-y-1">
            <span className="text-xs text-slate-700">Surface</span>
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Surface (m²)"
              value={form.surface_m2}
              onChange={(e) => setForm((s) => ({ ...s, surface_m2: e.target.value }))}
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-700">Pièces</span>
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Nb. de pièces"
              value={form.rooms}
              onChange={(e) => setForm((s) => ({ ...s, rooms: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-700">DPE</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={form.energy_class}
              onChange={(e) => setForm((s) => ({ ...s, energy_class: e.target.value }))}
            >
              {DPE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o === "" ? "Classe (A–G)" : `Classe ${o}`}</option>
              ))}
            </select>
          </label>
        </div>

        <textarea
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          rows={3}
          placeholder="Description (étage, balcon, etc.)"
          value={form.description}
          onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="kWh/m²/an"
            value={form.energy_value}
            onChange={(e) => setForm((s) => ({ ...s, energy_value: e.target.value }))}
          />
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.ghg_class}
            onChange={(e) => setForm((s) => ({ ...s, ghg_class: e.target.value }))}
          >
            {DPE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o === "" ? "GES (A–G)" : `Classe ${o}`}</option>
            ))}
          </select>
        </div>

        {/* ── Gestion de ce bien ── */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Comment ce bien est géré ?</p>
            <p className="mt-0.5 text-xs text-slate-500">Cochez les services pris en charge par un tiers. lokt désactivera les alertes correspondantes pour ce bien.</p>
          </div>
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Nom de l'agence ou du gestionnaire (optionnel)"
            value={form.delegation_agency_name}
            onChange={(e) => setForm((s) => ({ ...s, delegation_agency_name: e.target.value }))}
          />
          <div className="space-y-2">
            {DELEGATED_SERVICES.map((svc) => {
              const checked = (form.delegated_services || []).includes(svc.key);
              return (
                <label key={svc.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-[#635bff]/40 transition">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#635bff]"
                    checked={checked}
                    onChange={() =>
                      setForm((s) => ({
                        ...s,
                        delegated_services: checked
                          ? (s.delegated_services || []).filter((k) => k !== svc.key)
                          : [...(s.delegated_services || []), svc.key],
                      }))
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{svc.label}</p>
                    <p className="text-xs text-slate-500">{svc.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
          {(form.delegated_services || []).length > 0 && (
            <p className="text-xs text-[#635bff] font-medium">
              {(form.delegated_services || []).length === DELEGATED_SERVICES.length
                ? "Toutes les alertes liées à ce bien sont désactivées."
                : `${(form.delegated_services || []).length} service(s) délégué(s) — alertes correspondantes désactivées.`}
            </p>
          )}
        </div>

        {propertyId ? <PropertyDpePanel propertyId={propertyId} propertyLabel={form.label} /> : null}

        {propertyId ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Photos</p>
              {badge("emerald", `${selectedPhotos.length} photo(s)`)}
            </div>
            <div>
              <label className="text-[0.7rem] text-slate-600">Ajouter une photo (2 Mo max)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && propertyId) uploadPhoto(f, propertyId);
                  e.currentTarget.value = "";
                }}
                className="mt-1 block text-xs"
              />
            </div>
            <UploadProgressBar progress={uploadPhotoProgress} className="mt-2" />

            {selectedPhotos.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedPhotos.slice(0, 10).map((ph: any) => (
                  <a
                    key={ph.id || ph.url}
                    href={ph.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white"
                    title="Ouvrir"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Aucune photo pour l’instant.</p>
            )}
          </div>
        ) : null}
      </>
    );
  };

  const renderPropertyDetails = (p: any) => {
    const pPhotos = photosByProperty.get(p.id) ?? [];
    const hasDelegation = (p.delegated_services || []).length > 0 || !!p.delegation_agency_name;

    return (
      <div className="space-y-3">
        {p.description ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{p.description}</p>
          </div>
        ) : null}

        {p.energy_value || p.ghg_class ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Diagnostic</p>
            <p className="mt-1 text-sm text-slate-700">
              {p.energy_value ? `${p.energy_value} kWh/m²/an` : "—"}
              {p.ghg_class ? ` • GES ${p.ghg_class}` : ""}
            </p>
          </div>
        ) : null}

        {hasDelegation ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Gestion déléguée</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{p.delegation_agency_name || "Agence non précisée"}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(p.delegated_services || []).map((key: string) => {
                const svc = DELEGATED_SERVICES.find((s) => s.key === key);
                return svc ? <span key={key}>{badge("sky", svc.label)}</span> : null;
              })}
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Photos</p>
            {badge("slate", `${pPhotos.length} photo(s)`)}
          </div>
          {pPhotos.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {pPhotos.slice(0, 10).map((ph: any) => (
                <a
                  key={ph.id || ph.url}
                  href={ph.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white"
                  title="Ouvrir"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.url} alt="" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Aucune photo pour l’instant.</p>
          )}
        </div>

        <PropertyDpePanel propertyId={p.id} propertyLabel={p.label || ""} />
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Biens"
        title="Parc immobilier"
        desc={
          hasFreeLimit
            ? "Renseignez les logements à suivre dans lokt.fr. L’offre gratuite inclut 1 logement actif ; l’ajout d’un 2e logement nécessite un abonnement."
            : `Renseignez les logements à suivre dans lokt.fr. Votre abonnement permet jusqu’à ${activePropertyLimit} logements actifs.`
        }
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-gradient-to-br from-[#6072ff] via-[#4d9cff] to-[#5bcbd5] px-4 py-4 text-white sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/18 shadow-sm backdrop-blur">
                  <ChartBarIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold">Pilotage occupation</p>
                <span className="rounded-full border border-white/25 bg-white/18 px-2.5 py-1 text-[0.7rem] font-semibold text-white shadow-sm backdrop-blur">
                  Période connue
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-white/88">
                Lecture rapide du remplissage, de la vacance et de la stabilité locative sur l’historique réellement renseigné.
              </p>
            </div>

            <div className="min-w-[14rem]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/70">Remplissage global</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{pct(parcStats.occupancyRate12m)}</p>
                </div>
                {badge(occupancyTone(parcStats.occupancyRate12m), occupancyLabel(parcStats.occupancyRate12m))}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${clampPercent(parcStats.occupancyRate12m)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid border-b border-slate-200 bg-slate-50 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: HomeModernIcon,
              label: "Biens occupés",
              value: `${parcStats.occupiedNow}/${actifs.length || 0}`,
              detail: parcStats.vacantNow ? `${parcStats.vacantNow} vacant${parcStats.vacantNow > 1 ? "s" : ""}` : "parc entièrement occupé",
              tone: parcStats.vacantNow ? ("amber" as const) : ("emerald" as const),
            },
            {
              icon: ArrowTrendingUpIcon,
              label: "Turnover",
              value: String(parcStats.turnover12m),
              detail: `entrée${parcStats.turnover12m > 1 ? "s" : ""} locataire / 12 mois`,
              tone: parcStats.turnover12m >= 2 ? ("amber" as const) : ("sky" as const),
            },
            {
              icon: ClockIcon,
              label: "Ancienneté",
              value: durationLabel(parcStats.averageCurrentTenantDays),
              detail: "locataire actuel moyen",
              tone: "slate" as const,
            },
            {
              icon: ExclamationTriangleIcon,
              label: "Points d’attention",
              value: String(parcStats.attentionCount),
              detail: "vacance, turnover ou bail manquant",
              tone: parcStats.attentionCount ? ("amber" as const) : ("emerald" as const),
            },
          ].map((item) => {
            const Icon = item.icon;
            const tone = toneClasses(item.tone);
            return (
              <div key={item.label} className="border-b border-slate-200 px-4 py-4 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{item.value}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                  </div>
                  <span className={cx("inline-flex h-9 w-9 items-center justify-center rounded-lg border", tone.soft, tone.border, tone.text)}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {parcStats.rows.length ? (
          <div className="p-4 sm:p-5">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Lecture par bien</p>
                <p className="text-xs text-slate-600">{parcStats.averageVacancyDays12m} jour(s) de vacance moyenne par logement actif, sur la période connue.</p>
              </div>
              <div className="hidden items-center gap-3 text-[0.7rem] font-semibold text-slate-500 sm:flex">
                <span>Remplissage</span>
                <span>Stabilité</span>
              </div>
            </div>

            <div className="space-y-2">
              {parcStats.rows.map((row) => {
                const signal = rowSignal(row);
                const occupancy = clampPercent(row.occupancyRate12m);
                const occupancyClasses = toneClasses(occupancyTone(row.occupancyRate12m));
                const signalClasses = toneClasses(signal.tone);

                return (
                  <div key={row.property.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                    <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1.4fr_10rem] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                            <HomeModernIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{row.property.label || "Bien"}</p>
                            <p className="truncate text-xs text-slate-500">{row.property.city || row.property.address_line1 || "Adresse à compléter"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <UsersIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="truncate">{row.currentTenant?.full_name || "Vacant"}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.currentLease
                            ? `Présent depuis ${durationLabel(row.currentTenantDays)} (${formatDateFR(row.currentLease.start_date)})`
                            : `${row.vacancyDays12m} j vacants sur 12 mois glissants`}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-slate-600">{pct(row.occupancyRate12m)}</p>
                          <p className="text-xs text-slate-500">{row.vacancyDays12m} j vides</p>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={cx("h-full rounded-full", occupancyClasses.bg)} style={{ width: `${occupancy}%` }} />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold", signalClasses.soft, signalClasses.border, signalClasses.text)}>
                          {signal.label}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[0.7rem] font-semibold text-slate-700">
                          {pluralFR(row.turnover12m, "rotation")}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">{signal.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Ajoute un bien et un bail pour obtenir les statistiques d’occupation.
            </div>
          </div>
        )}
      </div>

      {/* CTA Ajouter un bien */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setErr(null);
            setOk(null);
            setExpandedId(expandedId === CREATE_ID ? null : CREATE_ID);
          }}
          className={cx(
            "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200",
            expandedId === CREATE_ID
              ? "bg-slate-700 shadow-slate-200 hover:bg-slate-600"
              : "bg-gradient-to-r from-[#635bff] to-[#00d4ff] shadow-indigo-200 hover:shadow-indigo-300 hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          <HomeModernIcon className="h-4 w-4" />
          Ajouter un bien
        </button>
      </div>

      {/* Carte création bien */}
      {expandedId === CREATE_ID && (
        <div
          id="biens-create-form"
          className={cx(
            "overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-xl shadow-indigo-50",
            highlightCreate ? "ring-2 ring-[#635bff] ring-offset-2" : ""
          )}
        >
          {/* Barre gradient */}
          <div className="h-1 bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />

          {/* En-tête */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50">
                <HomeModernIcon className="h-5 w-5 text-[#635bff]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Nouveau bien</p>
                <p className="text-xs text-slate-500">
                  {freeLimitReached
                    ? hasFreeLimit ? "Limite gratuite atteinte : 1 logement actif." : `Limite atteinte : ${activePropertyLimit} logements actifs.`
                    : "Nom + Adresse (ligne 1) obligatoires."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setCreateForm(EMPTY); setExpandedId(null); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Formulaire */}
          <div className="p-5">
            {freeLimitReached ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Vous avez déjà {pluralFR(activePropertyCount, "logement actif")}.</p>
                <p className="mt-1">
                  {hasFreeLimit
                    ? "L’offre gratuite permet de gérer 1 logement. Pour créer un 2e logement et continuer votre gestion locative, passez sur une offre adaptée."
                    : "Votre abonnement actuel a atteint sa limite de logements actifs. Passez sur une offre supérieure pour continuer."}
                </p>
                <Link
                  href={SUBSCRIPTION_URL}
                  className="mt-3 inline-flex rounded-full bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800"
                >
                  Voir les abonnements
                </Link>
              </div>
            ) : renderForm(createForm, (updater) => setCreateForm((prev) => updater(prev)), null)}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveProperty(undefined)}
                disabled={saving || freeLimitReached}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#635bff] to-[#00d4ff] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-100 hover:shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
              >
                <PlusIcon className="h-4 w-4" />
                {saving ? "Enregistrement…" : freeLimitReached ? "Abonnement requis" : "Créer le bien"}
              </button>

              <button
                type="button"
                onClick={() => { setCreateForm(EMPTY); setExpandedId(null); }}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">

        {/* ✅ ACTIFS */}
        <ExpandableSection
          title="Actifs"
          subtitle="Clique une ligne pour voir / modifier."
          right={badge("emerald", pluralFR(actifs.length, "bien"))}
          defaultOpen={true}
        >
          {actifs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun logement actif.
            </div>
          ) : (
            <div className="space-y-2">
              {actifs.map((p: any) => {
                const open = expandedId === p.id;
                const pPhotos = photosByProperty.get(p.id) ?? [];

                const f = editForms[p.id] ?? {
                  ...EMPTY,
                  id: p.id,
                  label: p.label ?? "",
                  address_line1: p.address_line1 ?? "",
                  postal_code: p.postal_code ?? "",
                  city: p.city ?? "",
                  description: p.description ?? "",
                  surface_m2: p.surface_m2 != null ? String(p.surface_m2) : "",
                  rooms: p.rooms != null ? String(p.rooms) : "",
                  energy_class: p.energy_class ?? "",
                  energy_value: p.energy_value != null ? String(p.energy_value) : "",
                  ghg_class: p.ghg_class ?? "",
                          delegated_services: Array.isArray(p.delegated_services) ? p.delegated_services : [],
                  delegation_agency_name: p.delegation_agency_name ?? "",
                };

                return (
                  <ExpandableRow
                    key={p.id}
                    id={p.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => {
                      setErr(null);
                      setOk(null);
                      if (id && id !== CREATE_ID) hydrateEditForm(p);
                      setExpandedId(id);
                    }}
                    left={
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate min-w-0">{p.label || "Bien"}</p>
                          {isNew(p.created_at) && <em className="shrink-0 text-[0.65rem] font-medium text-indigo-400">new</em>}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 truncate">
                          {(PROPERTY_TYPE_LABELS[p.type] || p.type || "—") + " • " + (p.address_line1 || "Adresse manquante") + " • " + (p.city || "—")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {badge("emerald", "Actif")}
                          {p.surface_m2 ? badge("slate", `${p.surface_m2} m²`) : null}
                          {p.rooms ? badge("slate", `${p.rooms} pièces`) : null}
                          {pPhotos.length ? badge("emerald", `${pPhotos.length} photo(s)`) : badge("slate", "0 photo")}
                          {p.energy_class ? badge(
                            ["A","B","C","D"].includes(p.energy_class) ? "emerald" : p.energy_class === "E" ? "amber" : "red",
                            `DPE ${p.energy_class}`
                          ) : null}
                        </div>
                      </div>
                    }
                    right={open ? badge("slate", "Ouvert") : null}
                  >
                    {editingId === p.id
                      ? renderForm(f, (updater) => setEditForms((m) => ({ ...m, [p.id]: updater(m[p.id] ?? f) })), p.id)
                      : renderPropertyDetails(p)}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {editingId === p.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveProperty(p.id)}
                            disabled={saving}
                            className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            {saving ? "Enregistrement…" : "Mettre à jour"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Annuler
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingId(p.id)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                          Modifier
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => archive(p.id)}
                        disabled={saving}
                        className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Archiver
                      </button>

                      {!hasAnyLeaseForProperty(p.id) ? (
                        confirmDeleteId === p.id ? (
                          <span className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5">
                            <span className="text-xs font-medium text-red-700">Confirmer ?</span>
                            <button
                              type="button"
                              onClick={() => { void remove(p.id); setConfirmDeleteId(null); }}
                              disabled={saving}
                              className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                            >
                              Supprimer
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Annuler
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(p.id)}
                            disabled={saving}
                            className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Supprimer
                          </button>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-slate-500">
                          Supprimez d&apos;abord le bail
                          {onGoToBaux ? (
                            <button type="button" onClick={onGoToBaux} className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">→ Baux</button>
                          ) : null}
                        </span>
                      )}
                    </div>
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>

        {/* ✅ ARCHIVÉS */}
        <ExpandableSection
          title="Archivés"
          subtitle="Restaure si besoin, ou supprime."
          right={badge("amber", pluralFR(archives.length, "bien"))}
          defaultOpen={false}
        >
          {archives.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun bien archivé.
            </div>
          ) : (
            <div className="space-y-2">
              {archives.map((p: any) => {
                const open = expandedId === p.id;
                const pPhotos = photosByProperty.get(p.id) ?? [];

                const f = editForms[p.id] ?? {
                  ...EMPTY,
                  id: p.id,
                  label: p.label ?? "",
                  address_line1: p.address_line1 ?? "",
                  postal_code: p.postal_code ?? "",
                  city: p.city ?? "",
                  description: p.description ?? "",
                  surface_m2: p.surface_m2 != null ? String(p.surface_m2) : "",
                  rooms: p.rooms != null ? String(p.rooms) : "",
                  energy_class: p.energy_class ?? "",
                  energy_value: p.energy_value != null ? String(p.energy_value) : "",
                  ghg_class: p.ghg_class ?? "",
                          delegated_services: Array.isArray(p.delegated_services) ? p.delegated_services : [],
                  delegation_agency_name: p.delegation_agency_name ?? "",
                };

                return (
                  <ExpandableRow
                    key={p.id}
                    id={p.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => {
                      setErr(null);
                      setOk(null);
                      if (id && id !== CREATE_ID) hydrateEditForm(p);
                      setExpandedId(id);
                    }}
                    left={
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate min-w-0">{p.label || "Bien"}</p>
                          {isNew(p.created_at) && <em className="shrink-0 text-[0.65rem] font-medium text-indigo-400">new</em>}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 truncate">
                          {(PROPERTY_TYPE_LABELS[p.type] || p.type || "—") + " • " + (p.address_line1 || "Adresse manquante") + " • " + (p.city || "—")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {badge("amber", "Archivé")}
                          {pPhotos.length ? badge("slate", `${pPhotos.length} photo(s)`) : badge("slate", "0 photo")}
                          {p.energy_class ? badge(
                            ["A","B","C","D"].includes(p.energy_class) ? "emerald" : p.energy_class === "E" ? "amber" : "red",
                            `DPE ${p.energy_class}`
                          ) : null}
                        </div>
                      </div>
                    }
                    right={open ? badge("slate", "Ouvert") : null}
                  >
                    {editingId === p.id
                      ? renderForm(f, (updater) => setEditForms((m) => ({ ...m, [p.id]: updater(m[p.id] ?? f) })), p.id)
                      : renderPropertyDetails(p)}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {editingId === p.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveProperty(p.id)}
                            disabled={saving}
                            className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            {saving ? "Enregistrement…" : "Mettre à jour"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Annuler
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingId(p.id)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                          Modifier
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => restore(p.id)}
                        disabled={saving || freeLimitReached}
                        className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {freeLimitReached ? "Abonnement requis" : "Restaurer"}
                      </button>

                      {freeLimitReached ? (
                        <Link
                          href={SUBSCRIPTION_URL}
                          className="rounded-full border border-amber-200 bg-amber-50 px-5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          Voir les abonnements
                        </Link>
                      ) : null}

                      {!hasAnyLeaseForProperty(p.id) ? (
                        confirmDeleteId === p.id ? (
                          <span className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5">
                            <span className="text-xs font-medium text-red-700">Confirmer ?</span>
                            <button
                              type="button"
                              onClick={() => { void remove(p.id); setConfirmDeleteId(null); }}
                              disabled={saving}
                              className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                            >
                              Supprimer
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Annuler
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(p.id)}
                            disabled={saving}
                            className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Supprimer
                          </button>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-slate-500">
                          Supprimez d&apos;abord le bail
                          {onGoToBaux ? (
                            <button type="button" onClick={onGoToBaux} className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">→ Baux</button>
                          ) : null}
                        </span>
                      )}
                    </div>
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>
      </div>
    </div>
  );
}
