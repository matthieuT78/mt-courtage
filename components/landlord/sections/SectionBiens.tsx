// components/landlord/sections/SectionBiens.tsx
import React, { useEffect, useMemo, useState } from "react";
import { xhrUploadDirect } from "../../../lib/uploadWithProgress";
import { DELEGATED_SERVICES } from "../../../lib/landlord/delegatedServices";
import { UploadProgressBar } from "../../UploadProgressBar";
import Link from "next/link";
import {
  ArrowTrendingUpIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  ChevronDownIcon,
  ClockIcon,
  CubeIcon,
  EllipsisHorizontalCircleIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  HomeModernIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  TruckIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import { ExpandableSection } from "../ui/ExpandableSection";
import { badge, cx, pluralFR } from "../ui/uiHelpers";
import { NiceSelect } from "../ui/NiceSelect";
import { usePermissions } from "../../PermissionProvider";
import { PropertyDpePanel } from "../PropertyDpePanel";
import AddressAutocomplete from "../../forms/AddressAutocomplete";

type Props = {
  userId: string;
  properties?: any[];
  propertyLots?: any[];
  leases?: any[];
  tenants?: any[];
  photos?: any[];
  onRefresh: () => Promise<void>;
  deepLink?: { key: number; openCreate?: boolean; propertyId?: string; highlightDelegation?: boolean } | null;
  onNavigateDeep?: (section: string, link?: { openCreate?: boolean; prefillTenantId?: string; prefillPropertyId?: string }) => void;
};

const CREATE_ID = "__create__";
const FREE_PROPERTY_LIMIT = 1;

const PROPERTY_TYPES = [
  { key: "apartment", label: "Appartement", icon: HomeModernIcon, bg: "bg-indigo-100", text: "text-indigo-700" },
  { key: "house", label: "Maison", icon: HomeIcon, bg: "bg-amber-100", text: "text-amber-700" },
  { key: "building", label: "Immeuble (plusieurs lots)", icon: BuildingOffice2Icon, bg: "bg-violet-100", text: "text-violet-700" },
  { key: "garage", label: "Garage", icon: CubeIcon, bg: "bg-slate-200", text: "text-slate-700" },
  { key: "parking", label: "Parking", icon: TruckIcon, bg: "bg-sky-100", text: "text-sky-700" },
  { key: "other", label: "Autre", icon: EllipsisHorizontalCircleIcon, bg: "bg-slate-100", text: "text-slate-600" },
] as const;

const PROPERTY_TYPE_LABELS: Record<string, string> = Object.fromEntries(PROPERTY_TYPES.map((t) => [t.key, t.label]));
const propertyTypeMeta = (type?: string | null) => PROPERTY_TYPES.find((t) => t.key === type) || PROPERTY_TYPES[PROPERTY_TYPES.length - 1];

const DPE_OPTIONS = ["", "A", "B", "C", "D", "E", "F", "G"] as const;
// Couleurs officielles de l'étiquette énergie (DPE : vert → rouge, GES : mauve
// clair → violet foncé) — le code couleur est universellement reconnu (arrêté
// du 22 décembre 2021), plus parlant qu'une icône générique pour ces classes.
const DPE_COLORS: Record<string, string> = {
  A: "bg-[#00A651] text-white",
  B: "bg-[#4CB848] text-white",
  C: "bg-[#A0CD3C] text-slate-900",
  D: "bg-[#FFF200] text-slate-900",
  E: "bg-[#FBB03B] text-slate-900",
  F: "bg-[#F26A21] text-white",
  G: "bg-[#ED1C24] text-white",
};
const GES_COLORS: Record<string, string> = {
  A: "bg-[#EFE6F6] text-slate-900",
  B: "bg-[#DCC7EE] text-slate-900",
  C: "bg-[#C9A8E6] text-slate-900",
  D: "bg-[#B389DD] text-slate-900",
  E: "bg-[#9B68D2] text-white",
  F: "bg-[#7F45C4] text-white",
  G: "bg-[#5E2A99] text-white",
};
// Plages officielles associées à chaque classe (arrêté du 22 décembre 2021).
const DPE_RANGES: Record<string, string> = {
  A: "≤ 50 kWh/m²/an",
  B: "51 à 90 kWh/m²/an",
  C: "91 à 150 kWh/m²/an",
  D: "151 à 230 kWh/m²/an",
  E: "231 à 330 kWh/m²/an",
  F: "331 à 450 kWh/m²/an",
  G: "> 450 kWh/m²/an",
};
const GES_RANGES: Record<string, string> = {
  A: "≤ 5 kg CO₂/m²/an",
  B: "6 à 10 kg CO₂/m²/an",
  C: "11 à 20 kg CO₂/m²/an",
  D: "21 à 35 kg CO₂/m²/an",
  E: "36 à 55 kg CO₂/m²/an",
  F: "56 à 80 kg CO₂/m²/an",
  G: "> 80 kg CO₂/m²/an",
};
function classPill(prefix: string, letter: string, colors: Record<string, string>) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", colors[letter] || "bg-slate-100 text-slate-600")}>
      {prefix} {letter}
    </span>
  );
}
const isNew = (createdAt?: string | null) =>
  !!createdAt && Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
const SUBSCRIPTION_URL = "/tarifs";

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

function photoUrl(photo: any): string | null {
  if (!photo) return null;
  if (photo.storage_bucket && photo.storage_path) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    return `${base}/storage/v1/object/public/${photo.storage_bucket}/${photo.storage_path}`;
  }
  return null;
}

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

export function SectionBiens({ userId, properties, propertyLots, leases, tenants, photos, onRefresh, deepLink, onNavigateDeep }: Props) {
  const { loading: permissionsLoading, maxActiveProperties } = usePermissions();
  const safeProperties = Array.isArray(properties) ? properties : [];
  const safePropertyLots = Array.isArray(propertyLots) ? propertyLots : [];
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeTenants = Array.isArray(tenants) ? tenants : [];
  const safePhotos = Array.isArray(photos) ? photos : [];

  // Lots actifs groupés par bien — un immeuble sans lot configuré se comporte comme
  // un bien simple (une seule "unité" = le bien), donc aucune régression possible.
  const activeLotsByProperty = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const lot of safePropertyLots) {
      if (String(lot?.status || "active").toLowerCase() === "archived") continue;
      const pid = lot?.property_id;
      if (!pid) continue;
      if (!m.has(pid)) m.set(pid, []);
      m.get(pid)!.push(lot);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return m;
  }, [safePropertyLots]);

  const [expandedId, setExpandedId] = useState<string | null>(null); // "__create__" ou propertyId
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [uploadPhotoProgress, setUploadPhotoProgress] = useState<number | null>(null);
  // Erreurs de validation par champ, indexées par formId ("create" ou propertyId)
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, { label?: string; address_line1?: string; surface_m2?: string; rooms?: string; energy_value?: string }>
  >({});

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

    // Une "unité" = un lot pour un immeuble qui en a, sinon le bien lui-même — pour
    // qu'un immeuble à plusieurs lots compte plusieurs occupations distinctes au lieu
    // de se réduire à un seul bail (comme un bien simple, qui garde exactement le
    // même calcul qu'avant : une unité = le bien).
    type Unit = { unitId: string; property: any; lot: any | null; leases: any[] };
    const units: Unit[] = [];
    for (const property of actifs) {
      const lots = property?.type === "building" ? activeLotsByProperty.get(property.id) || [] : [];
      if (lots.length > 0) {
        for (const lot of lots) {
          units.push({ unitId: lot.id, property, lot, leases: safeLeases.filter((lease) => lease?.lot_id === lot.id) });
        }
      } else {
        units.push({ unitId: property.id, property, lot: null, leases: safeLeases.filter((lease) => lease?.property_id === property?.id) });
      }
    }

    const rows = units.map(({ unitId, property, lot, leases: propertyLeases }) => {
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
        unitId,
        property,
        lot,
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
  }, [actifs, safeLeases, tenantById, activeLotsByProperty]);
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
  const [highlightDelegation, setHighlightDelegation] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [archiveBlockedId, setArchiveBlockedId] = useState<string | null>(null);
  const [occupancyOpen, setOccupancyOpen] = useState(false);

  useEffect(() => {
    if (!deepLink?.openCreate) return;
    setExpandedId(CREATE_ID);
    setHighlightCreate(true);
    setTimeout(() => {
      document.getElementById("biens-create-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    setTimeout(() => setHighlightCreate(false), 2500);
  }, [deepLink]);

  useEffect(() => {
    if (!deepLink?.propertyId) return;
    const p = safeProperties.find((x) => x?.id === deepLink.propertyId);
    if (!p) return;
    openPropertyModal(p);
    if (deepLink.highlightDelegation) {
      setTimeout(() => {
        document.getElementById("biens-delegation-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      setHighlightDelegation(true);
      setTimeout(() => setHighlightDelegation(false), 2500);
    }
  }, [deepLink]);

  const validate = (f: typeof EMPTY, formId: string): boolean => {
    const label = (f.label || "").trim();
    const addr1 = (f.address_line1 || "").trim();
    const errors: { label?: string; address_line1?: string; surface_m2?: string; rooms?: string; energy_value?: string } = {};
    if (!label) errors.label = "Champ obligatoire";
    if (!addr1) errors.address_line1 = "Champ obligatoire";

    const surface = f.surface_m2 ? toNumOrNull(f.surface_m2) : null;
    if (f.surface_m2 && (surface == null || surface <= 0)) {
      errors.surface_m2 = "Surface invalide.";
    } else if (surface != null && surface > 100000) {
      errors.surface_m2 = "Surface irréaliste.";
    }

    const rooms = f.rooms ? toNumOrNull(f.rooms) : null;
    if (f.rooms && (rooms == null || rooms < 0)) {
      errors.rooms = "Ne peut pas être négatif.";
    } else if (rooms != null && rooms > 200) {
      errors.rooms = "Nombre de pièces irréaliste.";
    }

    const energyValue = f.energy_value ? toNumOrNull(f.energy_value) : null;
    if (f.energy_value && (energyValue == null || energyValue < 0)) {
      errors.energy_value = "Ne peut pas être négatif.";
    } else if (energyValue != null && energyValue > 2000) {
      errors.energy_value = "Valeur DPE irréaliste (kWh/m²/an).";
    }

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
    if (!expandedId || expandedId === CREATE_ID) return;
    const p = safeProperties.find((x) => x?.id === expandedId);
    if (!p) return;
    hydrateEditForm(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      let newPropertyId: string | null = null;

      if (isEdit) {
        const { error } = await supabase.from("properties").update(payload).eq("id", propertyId).eq("user_id", userId);
        if (error) throw error;
        closePropertyModal();
        setOk("Bien mis à jour ✅");
      } else {
        const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
        if (error) throw error;

        newPropertyId = (data as any)?.id ?? null;

        setOk("Bien créé ✅");
        setCreateForm(EMPTY);
      }

      await safeRefresh();
      // Le nouveau bien n'existe dans `properties` (prop) qu'après ce refresh — ouvrir la
      // modale avant provoquerait un rendu avec activeProperty introuvable.
      if (newPropertyId) setExpandedId(newPropertyId);
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

  const hasActiveLeaseForProperty = (propertyId: string) =>
    safeLeases.some((l) => l?.property_id === propertyId && String(l?.status || "").toLowerCase() === "active");

  const activeTenantNameForProperty = (propertyId: string) => {
    const lease = safeLeases.find((l) => l?.property_id === propertyId && String(l?.status || "").toLowerCase() === "active");
    const tenant = lease ? safeTenants.find((t) => t?.id === lease.tenant_id) : null;
    if (!tenant) return null;
    return tenant.full_name || [tenant.first_name, tenant.last_name].filter(Boolean).join(" ") || null;
  };

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

      const { error: insErr } = await supabase.from("property_photos").insert({
        user_id: userId,
        property_id: propertyId,
        storage_bucket: "property-photos",
        storage_path: path,
        original_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (insErr) throw insErr;

      setOk("Photo ajoutée ✅");
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Erreur upload.");
      setUploadPhotoProgress(null);
    }
  };

  const deletePhoto = async (photo: any) => {
    setErr(null);
    setOk(null);
    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      if (photo.storage_bucket && photo.storage_path) {
        await supabase.storage.from(photo.storage_bucket).remove([photo.storage_path]);
      }
      const { error: delErr } = await supabase.from("property_photos").delete().eq("id", photo.id);
      if (delErr) throw delErr;
      setOk("Photo supprimée ✅");
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de la suppression de la photo.");
    }
  };

  const [newLotLabel, setNewLotLabel] = useState<Record<string, string>>({});
  const [lotBusyId, setLotBusyId] = useState<string | null>(null);
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);
  const [lotNumDrafts, setLotNumDrafts] = useState<Record<string, { surface_m2?: string; rooms?: string; energy_value?: string }>>({});

  const addLot = async (propertyId: string) => {
    const label = (newLotLabel[propertyId] || "").trim();
    if (!label) return;
    setErr(null);
    setOk(null);
    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      const existing = activeLotsByProperty.get(propertyId) || [];
      // Le 1er lot d'un immeuble ne change rien au total (il remplace juste le bien
      // lui-même comme unité) ; à partir du 2e, chaque lot ajoute une unité de plus —
      // sans ce garde-fou, un immeuble permettrait de contourner la limite du plan.
      if (existing.length > 0) {
        const totalUnits = actifs.reduce((sum, p) => {
          const lots = activeLotsByProperty.get(p.id) || [];
          return sum + (lots.length > 0 ? lots.length : 1);
        }, 0);
        if (totalUnits >= activePropertyLimit) {
          setErr(upgradeMessage);
          return;
        }
      }
      const { error } = await supabase.from("property_lots").insert({
        property_id: propertyId,
        user_id: userId,
        label,
        sort_order: existing.length,
      });
      if (error) throw error;
      setNewLotLabel((prev) => ({ ...prev, [propertyId]: "" }));
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible d’ajouter ce lot.");
    }
  };

  const renameLot = async (lotId: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      const { error } = await supabase.from("property_lots").update({ label: trimmed }).eq("id", lotId).eq("user_id", userId);
      if (error) throw error;
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible de renommer ce lot.");
    }
  };

  const updateLot = async (lotId: string, patch: Record<string, any>) => {
    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      const { error } = await supabase.from("property_lots").update(patch).eq("id", lotId).eq("user_id", userId);
      if (error) throw error;
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible de mettre à jour ce lot.");
    }
  };

  const removeLot = async (lotId: string) => {
    const hasLease = safeLeases.some((l) => l?.lot_id === lotId);
    if (hasLease) {
      setErr("Suppression impossible : ce lot a un historique de bail. Archivez-le pour le masquer — les données sont conservées.");
      return;
    }
    setLotBusyId(lotId);
    setErr(null);
    setOk(null);
    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      const { error } = await supabase.from("property_lots").delete().eq("id", lotId).eq("user_id", userId);
      if (error) throw error;
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible de retirer ce lot.");
    } finally {
      setLotBusyId(null);
    }
  };

  const clearFieldError = (formId: string, field: "label" | "address_line1" | "surface_m2" | "rooms" | "energy_value") => {
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
        <div className="space-y-1">
          <span className="text-xs text-slate-700">Type de bien</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PROPERTY_TYPES.map((t) => {
              const Icon = t.icon;
              const selected = form.type === t.key;
              // "Immeuble" n'a de sens que si le plan autorise plus d'un logement actif —
              // sinon un compte gratuit pourrait contourner la limite via des lots
              // illimités sur un seul bien. Affiché grisé plutôt que masqué, pour rester
              // découvrable (édition d'un immeuble existant après downgrade : jamais grisé).
              const locked = t.key === "building" && activePropertyLimit <= 1 && !selected;
              return (
                <button
                  key={t.key}
                  type="button"
                  disabled={locked}
                  onClick={() => setForm((s) => ({ ...s, type: t.key }))}
                  title={locked ? "Disponible à partir d'un abonnement payant" : undefined}
                  className={cx(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition",
                    locked
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                      : selected
                      ? "border-[#635bff] bg-indigo-50/60 ring-1 ring-[#635bff]"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <span className={cx("flex h-9 w-9 items-center justify-center rounded-full", locked ? "bg-slate-200 text-slate-400" : cx(t.bg, t.text))}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className={cx("text-xs font-medium", locked ? "text-slate-400" : selected ? "text-[#635bff]" : "text-slate-700")}>{t.label}</span>
                  {locked ? <span className="text-[0.6rem] font-semibold text-amber-600">Payant</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <span className="text-xs text-slate-700">Nom du bien *</span>
          <input
            className={`w-full rounded-xl border px-3 py-2 text-sm bg-white ${fErr.label ? "border-red-400 ring-1 ring-red-300" : "border-slate-300"}`}
            placeholder="Ex : Appartement rue Victor Hugo"
            value={form.label}
            onChange={(e) => { clearFieldError(formId, "label"); setForm((s) => ({ ...s, label: e.target.value })); }}
          />
          {fErr.label ? <p className="text-xs font-medium text-red-600">{fErr.label}</p> : null}
        </div>

        <div className="mt-3 space-y-1">
          <span className="text-xs text-slate-700">Adresse (ligne 1) *</span>
          <AddressAutocomplete
            id={`property_${propertyId || "new"}_address1`}
            hint={false}
            placeholder="Numéro et rue"
            className={`w-full rounded-xl border px-3 py-2 text-sm bg-white ${fErr.address_line1 ? "border-red-400 ring-1 ring-red-300" : "border-slate-300"}`}
            addressLine1={form.address_line1}
            postalCode={form.postal_code}
            city={form.city}
            onAddressLine1Change={(v) => { clearFieldError(formId, "address_line1"); setForm((s) => ({ ...s, address_line1: v })); }}
            onPostalCodeChange={(v) => setForm((s) => ({ ...s, postal_code: v }))}
            onCityChange={(v) => setForm((s) => ({ ...s, city: v }))}
          />
          {fErr.address_line1 ? <p className="text-xs font-medium text-red-600">{fErr.address_line1}</p> : null}
        </div>

        {form.type === "building" ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            Surface, pièces et DPE se renseignent par lot ci-dessous — un immeuble n’a pas une surface ou un DPE unique représentatif de tous ses logements.
          </p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs text-slate-700">Surface</span>
                <input
                  className={`w-full rounded-xl border px-3 py-2 text-sm bg-white ${fErr.surface_m2 ? "border-red-400 ring-1 ring-red-300" : "border-slate-300"}`}
                  placeholder="Surface (m²)"
                  value={form.surface_m2}
                  onChange={(e) => { clearFieldError(formId, "surface_m2"); setForm((s) => ({ ...s, surface_m2: e.target.value })); }}
                />
                {fErr.surface_m2 ? <p className="text-xs font-medium text-red-600">{fErr.surface_m2}</p> : null}
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-700">Pièces</span>
                <input
                  className={`w-full rounded-xl border px-3 py-2 text-sm bg-white ${fErr.rooms ? "border-red-400 ring-1 ring-red-300" : "border-slate-300"}`}
                  placeholder="Nb. de pièces"
                  value={form.rooms}
                  onChange={(e) => { clearFieldError(formId, "rooms"); setForm((s) => ({ ...s, rooms: e.target.value })); }}
                />
                {fErr.rooms ? <p className="text-xs font-medium text-red-600">{fErr.rooms}</p> : null}
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-700">DPE</span>
                <NiceSelect
                  placeholder="Classe (A–G)"
                  value={form.energy_class}
                  onChange={(value) => setForm((s) => ({ ...s, energy_class: value }))}
                  options={DPE_OPTIONS.filter((o) => o !== "").map((o) => ({
                    value: o,
                    label: `Classe ${o}`,
                    subtitle: DPE_RANGES[o],
                    badgeText: o,
                    badgeClassName: DPE_COLORS[o],
                  }))}
                />
              </label>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <input
                  className={`w-full rounded-xl border px-3 py-2 text-sm bg-white ${fErr.energy_value ? "border-red-400 ring-1 ring-red-300" : "border-slate-300"}`}
                  placeholder="kWh/m²/an"
                  value={form.energy_value}
                  onChange={(e) => { clearFieldError(formId, "energy_value"); setForm((s) => ({ ...s, energy_value: e.target.value })); }}
                />
                {fErr.energy_value ? <p className="text-xs font-medium text-red-600">{fErr.energy_value}</p> : null}
              </div>
              <NiceSelect
                placeholder="GES (A–G)"
                value={form.ghg_class}
                onChange={(value) => setForm((s) => ({ ...s, ghg_class: value }))}
                options={DPE_OPTIONS.filter((o) => o !== "").map((o) => ({
                  value: o,
                  label: `Classe ${o}`,
                  subtitle: GES_RANGES[o],
                  badgeText: o,
                  badgeClassName: GES_COLORS[o],
                }))}
              />
            </div>
          </>
        )}

        <textarea
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          rows={3}
          placeholder="Description (étage, balcon, etc.)"
          value={form.description}
          onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
        />

        {/* ── Gestion de ce bien ── */}
        <div
          id="biens-delegation-section"
          className={cx(
            "mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 transition",
            highlightDelegation ? "ring-2 ring-orange-400 ring-offset-2" : ""
          )}
        >
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
                    {checked && (
                      <p className="mt-1 text-xs font-medium text-[#635bff]">
                        → Pris en charge par un tiers, alertes lokt désactivées pour ce service.
                      </p>
                    )}
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

        {propertyId && form.type === "building" ? (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Lots de cet immeuble</p>
              {badge("emerald", `${(activeLotsByProperty.get(propertyId) || []).length} lot(s)`)}
            </div>
            <p className="text-xs text-slate-600">
              Un crédit et une fiche finance pour tout l’immeuble, mais un bail par lot — chaque lot pourra avoir son propre locataire.
            </p>

            <div className="space-y-1.5">
              {(activeLotsByProperty.get(propertyId) || []).map((lot: any) => {
                const isExpanded = expandedLotId === lot.id;
                const draft = lotNumDrafts[lot.id] || {};
                return (
                  <div key={lot.id} className="rounded-xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <input
                        className="min-w-[8rem] flex-1 border-none bg-transparent text-sm font-medium text-slate-900 focus:outline-none"
                        defaultValue={lot.label}
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value.trim() !== lot.label) renameLot(lot.id, e.target.value);
                        }}
                      />
                      <input
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                        placeholder="m²"
                        inputMode="decimal"
                        value={draft.surface_m2 ?? (lot.surface_m2 != null ? String(lot.surface_m2) : "")}
                        onChange={(e) => setLotNumDrafts((prev) => ({ ...prev, [lot.id]: { ...prev[lot.id], surface_m2: e.target.value } }))}
                        onBlur={(e) => {
                          setLotNumDrafts((prev) => { const { [lot.id]: _drop, ...rest } = prev; return rest; });
                          const parsed = e.target.value.trim() === "" ? null : toNumOrNull(e.target.value);
                          if (parsed !== (lot.surface_m2 ?? null)) updateLot(lot.id, { surface_m2: parsed });
                        }}
                      />
                      <input
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                        placeholder="pièces"
                        inputMode="numeric"
                        value={draft.rooms ?? (lot.rooms != null ? String(lot.rooms) : "")}
                        onChange={(e) => setLotNumDrafts((prev) => ({ ...prev, [lot.id]: { ...prev[lot.id], rooms: e.target.value } }))}
                        onBlur={(e) => {
                          setLotNumDrafts((prev) => { const { [lot.id]: _drop, ...rest } = prev; return rest; });
                          const parsed = e.target.value.trim() === "" ? null : Math.round(toNumOrNull(e.target.value) ?? 0);
                          if (parsed !== (lot.rooms ?? null)) updateLot(lot.id, { rooms: parsed });
                        }}
                      />
                      <select
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                        value={lot.energy_class || ""}
                        onChange={(e) => updateLot(lot.id, { energy_class: e.target.value || null })}
                      >
                        <option value="">DPE —</option>
                        {DPE_OPTIONS.filter((o) => o !== "").map((o) => (
                          <option key={o} value={o}>DPE {o}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setExpandedLotId(isExpanded ? null : lot.id)}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                        aria-label={isExpanded ? "Réduire" : "Plus de détails (GES, DPE)"}
                      >
                        <ChevronDownIcon className={cx("h-4 w-4 transition-transform", isExpanded ? "rotate-180" : "")} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLot(lot.id)}
                        disabled={lotBusyId === lot.id}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Retirer ${lot.label}`}
                      >
                        <TrashIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    {isExpanded ? (
                      <div className="border-t border-slate-100 px-3 py-3 space-y-3">
                        <div className="grid max-w-md gap-3 sm:grid-cols-2">
                          <label className="block space-y-1">
                            <span className="text-xs text-slate-700">GES</span>
                            <select
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                              value={lot.ghg_class || ""}
                              onChange={(e) => updateLot(lot.id, { ghg_class: e.target.value || null })}
                            >
                              <option value="">GES —</option>
                              {DPE_OPTIONS.filter((o) => o !== "").map((o) => (
                                <option key={o} value={o}>GES {o}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block space-y-1">
                            <span className="text-xs text-slate-700">kWh/m²/an</span>
                            <input
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                              inputMode="decimal"
                              value={draft.energy_value ?? (lot.energy_value != null ? String(lot.energy_value) : "")}
                              onChange={(e) => setLotNumDrafts((prev) => ({ ...prev, [lot.id]: { ...prev[lot.id], energy_value: e.target.value } }))}
                              onBlur={(e) => {
                                setLotNumDrafts((prev) => { const { [lot.id]: _drop, ...rest } = prev; return rest; });
                                const parsed = e.target.value.trim() === "" ? null : toNumOrNull(e.target.value);
                                if (parsed !== (lot.energy_value ?? null)) updateLot(lot.id, { energy_value: parsed });
                              }}
                            />
                          </label>
                        </div>
                        <PropertyDpePanel propertyId={propertyId} lotId={lot.id} propertyLabel={lot.label} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex : Lot 1, Appt 2B, Rez-de-chaussée…"
                value={newLotLabel[propertyId] || ""}
                onChange={(e) => setNewLotLabel((prev) => ({ ...prev, [propertyId]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLot(propertyId); } }}
              />
              <button
                type="button"
                onClick={() => addLot(propertyId)}
                className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Ajouter un lot
              </button>
            </div>
          </div>
        ) : null}

        {propertyId && form.type !== "building" ? <PropertyDpePanel propertyId={propertyId} propertyLabel={form.label} /> : null}

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
                  <div key={ph.id || ph.storage_path} className="group relative h-16 w-16 shrink-0">
                    <a
                      href={photoUrl(ph) || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white"
                      title="Ouvrir"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl(ph) || ""} alt="" className="h-full w-full object-cover" />
                    </a>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Supprimer cette photo ?")) deletePhoto(ph);
                      }}
                      title="Supprimer la photo"
                      aria-label="Supprimer la photo"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
                    >
                      <XMarkIcon className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
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

  const openPropertyModal = (p: any) => {
    setErr(null);
    setOk(null);
    hydrateEditForm(p);
    setExpandedId(p.id);
  };

  const closePropertyModal = () => {
    setExpandedId(null);
    setCreateForm(EMPTY);
    setConfirmDeleteId(null);
    setArchiveBlockedId(null);
    setErr(null);
    setOk(null);
  };

  const renderPropertyTile = (p: any, archived: boolean) => {
    const pPhotos = photosByProperty.get(p.id) ?? [];
    const meta = propertyTypeMeta(p.type);
    const Icon = meta.icon;
    const cover = photoUrl(pPhotos[0]);
    const unitRows = !archived ? parcStats.rows.filter((r) => r.property.id === p.id) : [];
    const isBuilding = p.type === "building" && unitRows.length > 0 && unitRows.some((r) => r.lot);
    const statusRow = unitRows[0] ?? null;
    const tenantName = statusRow?.currentTenant
      ? statusRow.currentTenant.full_name ||
        [statusRow.currentTenant.first_name, statusRow.currentTenant.last_name].filter(Boolean).join(" ") ||
        "Locataire"
      : null;
    const occupiedLots = isBuilding ? unitRows.filter((r) => r.currentLease).length : 0;

    return (
      <button
        key={p.id}
        type="button"
        onClick={() => openPropertyModal(p)}
        className={cx(
          "flex flex-col overflow-hidden rounded-2xl border text-left transition hover:shadow-md",
          archived ? "border-slate-200 bg-white opacity-90" : "border-slate-200 bg-white hover:border-slate-300"
        )}
      >
        <div className="relative h-28 w-full shrink-0">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#6072ff] via-[#4d9cff] to-[#5bcbd5]">
              <Icon className="h-10 w-10 text-white/90" aria-hidden="true" />
            </div>
          )}
          <div
            className={cx(
              "absolute inset-x-0 bottom-0 p-3",
              cover ? "bg-gradient-to-t from-black/70 via-black/20 to-transparent" : "bg-gradient-to-t from-black/25 to-transparent"
            )}
          >
            <div className="flex items-baseline gap-1.5 min-w-0">
              <p className="truncate text-sm font-semibold text-white">{p.label || "Bien"}</p>
              {isNew(p.created_at) && <em className="shrink-0 text-[0.65rem] font-medium text-indigo-200">new</em>}
            </div>
            <p className="truncate text-xs text-white/85">
              {(p.address_line1 || "Adresse manquante") + " • " + (p.city || "—")}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          {archived ? (
            <p className="text-sm text-slate-500">Bien archivé</p>
          ) : isBuilding ? (
            <p className="text-sm font-medium text-slate-900">
              {occupiedLots}/{unitRows.length} lot{unitRows.length > 1 ? "s" : ""} occupé{occupiedLots > 1 ? "s" : ""}
            </p>
          ) : tenantName ? (
            <p className="text-sm font-medium text-slate-900">{tenantName} • Bail actif</p>
          ) : (
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-slate-700">Aucun locataire</p>
              <p className="text-xs text-slate-500">Pas de bail enregistré</p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {badge(archived ? "amber" : "emerald", archived ? "Archivé" : "Actif")}
            {p.surface_m2 ? badge("slate", `${p.surface_m2} m²`) : null}
            {p.rooms ? badge("slate", `${p.rooms} pièces`) : null}
            {pPhotos.length ? badge("emerald", `${pPhotos.length} photo(s)`) : badge("slate", "0 photo")}
            {p.energy_class ? classPill("DPE", p.energy_class, DPE_COLORS) : null}
            {p.ghg_class ? classPill("GES", p.ghg_class, GES_COLORS) : null}
          </div>

          <span className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white">
            Gérer ce bien
          </span>
        </div>
      </button>
    );
  };

  const activeProperty = expandedId && expandedId !== CREATE_ID ? safeProperties.find((x) => x?.id === expandedId) : null;
  const activeForm = activeProperty
    ? editForms[activeProperty.id] ?? {
        ...EMPTY,
        id: activeProperty.id,
        label: activeProperty.label ?? "",
        address_line1: activeProperty.address_line1 ?? "",
        postal_code: activeProperty.postal_code ?? "",
        city: activeProperty.city ?? "",
        description: activeProperty.description ?? "",
        surface_m2: activeProperty.surface_m2 != null ? String(activeProperty.surface_m2) : "",
        rooms: activeProperty.rooms != null ? String(activeProperty.rooms) : "",
        energy_class: activeProperty.energy_class ?? "",
        energy_value: activeProperty.energy_value != null ? String(activeProperty.energy_value) : "",
        ghg_class: activeProperty.ghg_class ?? "",
        delegated_services: Array.isArray(activeProperty.delegated_services) ? activeProperty.delegated_services : [],
        delegation_agency_name: activeProperty.delegation_agency_name ?? "",
      }
    : null;

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
        <button
          type="button"
          onClick={() => setOccupancyOpen((v) => !v)}
          className="flex w-full flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-[#6072ff] via-[#4d9cff] to-[#5bcbd5] px-4 py-3 text-left text-white sm:px-5"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/18 shadow-sm backdrop-blur">
              <ChartBarIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold">Pilotage occupation</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tabular-nums">{pct(parcStats.occupancyRate12m)}</span>
            {badge(occupancyTone(parcStats.occupancyRate12m), occupancyLabel(parcStats.occupancyRate12m))}
            <ChevronDownIcon className={cx("h-4 w-4 transition-transform", occupancyOpen ? "rotate-180" : "")} aria-hidden="true" />
          </div>
        </button>

        {occupancyOpen ? (
          <>
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
                  <div key={row.unitId} className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                    <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1.4fr_10rem] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                            <HomeModernIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {row.property.label || "Bien"}
                              {row.lot ? <span className="font-normal text-slate-500"> — {row.lot.label}</span> : null}
                            </p>
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
          </>
        ) : null}
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

      {expandedId && (expandedId === CREATE_ID || activeProperty) ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closePropertyModal(); }}
        >
          <div
            id="biens-create-form"
            className={cx(
              "max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-indigo-100 bg-white shadow-2xl",
              highlightCreate ? "ring-2 ring-[#635bff] ring-offset-2" : ""
            )}
          >
            {/* Barre gradient */}
            <div className="h-1 bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />

            {/* En-tête */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50">
                  {expandedId === CREATE_ID ? (
                    <HomeModernIcon className="h-5 w-5 text-[#635bff]" />
                  ) : (
                    React.createElement(propertyTypeMeta(activeProperty?.type).icon, { className: "h-5 w-5 text-[#635bff]" })
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {expandedId === CREATE_ID ? "Nouveau bien" : activeProperty?.label || "Bien"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {expandedId === CREATE_ID
                      ? freeLimitReached
                        ? hasFreeLimit ? "Limite gratuite atteinte : 1 logement actif." : `Limite atteinte : ${activePropertyLimit} logements actifs.`
                        : "Nom + Adresse (ligne 1) obligatoires."
                      : (PROPERTY_TYPE_LABELS[activeProperty?.type] || activeProperty?.type || "—") +
                        " • " +
                        (activeProperty?.address_line1 || "Adresse manquante") +
                        " • " +
                        (activeProperty?.city || "—")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePropertyModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Contenu */}
            <div className="p-5">
              {err ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
              ) : null}
              {ok ? (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>
              ) : null}

              {expandedId === CREATE_ID ? (
                freeLimitReached ? (
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
                ) : (
                  renderForm(createForm, (updater) => setCreateForm((prev) => updater(prev)), null)
                )
              ) : activeProperty ? (
                archiveBlockedId === activeProperty.id ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
                    <p className="font-semibold">Impossible d’archiver ce bien</p>
                    <p className="mt-2 leading-6">
                      Il y a un bail actif sur ce bien
                      {activeTenantNameForProperty(activeProperty.id) ? (
                        <>
                          {" "}
                          avec <strong>{activeTenantNameForProperty(activeProperty.id)}</strong>
                        </>
                      ) : null}
                      . Pour archiver ce bien, finalisez d’abord le bail : utilisez le bouton « Gérer le départ » du
                      locataire dans la section Locataires, et suivez le workflow de départ complet (état des lieux de
                      sortie, restitution du dépôt de garantie…).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => { onNavigateDeep?.("locataires"); closePropertyModal(); }}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Aller à la section Locataires
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchiveBlockedId(null)}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Retour
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { archive(activeProperty.id); setArchiveBlockedId(null); }}
                      disabled={saving}
                      className="mt-4 text-xs font-medium text-red-700 underline decoration-dotted hover:text-red-900 disabled:opacity-60"
                    >
                      Cas particulier (bien vendu, transfert de gestion…) — archiver quand même
                    </button>
                  </div>
                ) : (
                  renderForm(
                    activeForm!,
                    (updater) => setEditForms((m) => ({ ...m, [activeProperty.id]: updater(m[activeProperty.id] ?? activeForm!) })),
                    activeProperty.id
                  )
                )
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {expandedId === CREATE_ID ? (
                  <>
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
                      onClick={closePropertyModal}
                      disabled={saving}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
                    >
                      Annuler
                    </button>
                  </>
                ) : activeProperty ? (
                  <>
                    <button
                      type="button"
                      onClick={() => saveProperty(activeProperty.id)}
                      disabled={saving}
                      className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {saving ? "Enregistrement…" : "Mettre à jour"}
                    </button>
                    <button
                      type="button"
                      onClick={closePropertyModal}
                      className="rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Annuler
                    </button>

                    {isArchived(activeProperty) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => restore(activeProperty.id)}
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
                      </>
                    ) : hasActiveLeaseForProperty(activeProperty.id) ? (
                      <button
                        type="button"
                        onClick={() => setArchiveBlockedId(activeProperty.id)}
                        disabled={saving}
                        className="rounded-full border border-amber-300 bg-amber-50 px-5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                        title="Ce bien a un bail actif"
                      >
                        Archiver
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => archive(activeProperty.id)}
                        disabled={saving}
                        className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Archiver
                      </button>
                    )}

                    {!hasAnyLeaseForProperty(activeProperty.id) ? (
                      confirmDeleteId === activeProperty.id ? (
                        <span className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5">
                          <span className="text-xs font-medium text-red-700">Confirmer ?</span>
                          <button
                            type="button"
                            onClick={() => { void remove(activeProperty.id); setConfirmDeleteId(null); }}
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
                            Retour
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(activeProperty.id)}
                          disabled={saving}
                          className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      )
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4">

        {/* ✅ ACTIFS */}
        <ExpandableSection
          title="Actifs"
          subtitle="Clique une tuile pour modifier."
          right={badge("emerald", pluralFR(actifs.length, "bien"))}
          defaultOpen={true}
        >
          {actifs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun logement actif.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {actifs.map((p: any) => renderPropertyTile(p, false))}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {archives.map((p: any) => renderPropertyTile(p, true))}
            </div>
          )}
        </ExpandableSection>
      </div>
    </div>
  );
}
