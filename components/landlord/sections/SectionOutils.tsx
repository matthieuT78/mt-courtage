import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  BeakerIcon,
  CalculatorIcon,
  CameraIcon,
  ChartBarIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  EyeIcon,
  PlusIcon,
  PrinterIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { Tenant } from "../../../lib/landlord/types";
import { supabase } from "../../../lib/supabaseClient";
import type { Lease, Property } from "../../../lib/landlord/types";
import { isActivePropertyLike, isSelectableLeaseLike } from "../../../lib/landlord/archiveFilters";
import type { Plan } from "../../../lib/permissions";
import { SectionSimulateursBailleur } from "./SectionSimulateursBailleur";
import { xhrUploadDirect } from "../../../lib/uploadWithProgress";
import { UploadProgressBar } from "../../UploadProgressBar";
import AddressAutocomplete from "../../forms/AddressAutocomplete";

const WATER_BUCKET = "water-tools";
const DEFAULT_SITE_NAME = "Compteur eau principal";
const DEFAULT_GLOBAL_METER_LABEL = "Compteur général";
const DEFAULT_PRINCIPAL_UNIT_LABEL = "Logement principal";
const DEFAULT_ALLOCATION_TITLE = "Répartition facture d’eau";

type ToolKey = "water" | "charges" | "teom" | "regularization" | "preavis" | "simulators";
type AllocationMethod = "all_meters" | "principal_residual";
type WaterWizardStep = "setup" | "invoice" | "readings" | "review";
type FinanceDirection = "in" | "out";
type FinanceStatus = "expected" | "received" | "paid";

type FinanceTransactionDraft = {
  title: string;
  propertyId?: string | null;
  leaseId?: string | null;
  occurredAt: string;
  direction: FinanceDirection;
  status: FinanceStatus;
  category: string;
  label: string;
  amount: number;
  notes: string;
};

const WATER_WIZARD_STEPS: Array<{ key: WaterWizardStep; title: string; desc: string }> = [
  { key: "setup", title: "Configuration", desc: "Adresse, cas de figure et occupants" },
  { key: "invoice", title: "Facture", desc: "Montant et compteur général" },
  { key: "readings", title: "Relevés", desc: "Sous-compteurs et justificatifs" },
  { key: "review", title: "Contrôle", desc: "Vérification et enregistrement" },
];

type WaterAllocation = {
  id: string;
  user_id: string;
  site_id: string | null;
  property_id: string | null;
  title: string;
  scope_label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  allocation_method: AllocationMethod;
  principal_unit_label: string | null;
  principal_occupant_label: string | null;
  principal_occupant_email: string | null;
  period_start: string;
  period_end: string;
  invoice_total_amount: number;
  fixed_charge_amount: number;
  billed_consumption: number | null;
  global_previous_reading: number;
  global_current_reading: number;
  global_consumption: number;
  total_consumption: number;
  invoice_storage_bucket: string | null;
  invoice_storage_path: string | null;
  invoice_file_name: string | null;
  invoice_size_bytes: number | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type WaterReading = {
  id: string;
  allocation_id: string;
  user_id: string;
  site_unit_id: string | null;
  reading_source: "manual" | "principal_residual";
  unit_label: string;
  occupant_label: string | null;
  occupant_email: string | null;
  previous_reading: number;
  current_reading: number;
  consumption: number;
  share_percent: number;
  variable_amount_due: number;
  fixed_amount_due: number;
  amount_due: number;
  photo_storage_bucket: string | null;
  photo_storage_path: string | null;
  photo_file_name: string | null;
  notes: string | null;
};

type WaterMeterSite = {
  id: string;
  user_id: string;
  property_id: string | null;
  site_name: string;
  scope_label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  global_meter_label: string | null;
  allocation_method: AllocationMethod;
  principal_unit_label: string | null;
  principal_occupant_label: string | null;
  principal_occupant_email: string | null;
};

type WaterMeterSiteUnit = {
  id: string;
  site_id: string;
  user_id: string;
  unit_label: string;
  occupant_label: string | null;
  occupant_email: string | null;
  notes: string | null;
  sort_order: number;
  active: boolean;
};

type DraftLine = {
  id: string;
  siteUnitId?: string | null;
  enabled: boolean;
  unitLabel: string;
  occupantLabel: string;
  occupantEmail: string;
  previous: string;
  current: string;
  notes: string;
  photo?: File | null;
};

type WaterDraftSnapshot = {
  waterStep: WaterWizardStep;
  selectedSiteId: string;
  selectedPropertyId: string;
  siteName: string;
  title: string;
  scopeLabel: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  globalMeterLabel: string;
  allocationMethod: AllocationMethod;
  principalUnitLabel: string;
  principalOccupantLabel: string;
  principalOccupantEmail: string;
  globalPreviousReading: string;
  globalCurrentReading: string;
  periodStart: string;
  periodEnd: string;
  invoiceAmount: string;
  fixedChargeAmount: string;
  billedConsumption: string;
  notes: string;
  lines: Array<Omit<DraftLine, "photo">>;
};

type SimpleShareLine = {
  id: string;
  label: string;
  occupant: string;
  tantiemes: string;
  recoverablePercent: string;
  notes: string;
};

type RegularizationExpenseLine = {
  id: string;
  label: string;
  amount: string;
  recoverablePercent: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStartISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const newDraftLine = (index: number): DraftLine => ({
  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
  enabled: true,
  unitLabel: `Lot ${index}`,
  occupantLabel: "",
  occupantEmail: "",
  previous: "",
  current: "",
  notes: "",
  photo: null,
});
const defaultDraftLines = () => [newDraftLine(1), newDraftLine(2)];
const newShareLine = (index: number): SimpleShareLine => ({
  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
  label: `Lot ${index}`,
  occupant: "",
  tantiemes: "",
  recoverablePercent: "100",
  notes: "",
});
const newRegularizationExpenseLine = (label = "Charge récupérable", amount = "", recoverablePercent = "100"): RegularizationExpenseLine => ({
  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
  label,
  amount,
  recoverablePercent,
});
const waterDraftStorageKey = (userId: string) => `lokt:water-tool:draft:${userId}`;
const formatEuro = (value: number) =>
  Number(value || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const num = (value: string) => {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const clampPercent = (value: string) => Math.min(100, Math.max(0, num(value)));
const formatPercent = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
const daysInclusive = (start: string, end: string) => {
  if (!start || !end) return 0;
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return 0;
  return Math.floor((endTime - startTime) / 86400000) + 1;
};
const copyToolSummary = async (summary: string, onDone: (message: string) => void) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(summary);
    onDone("Synthèse copiée dans le presse-papiers.");
  }
};
const normalizeReadingKey = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const computedFixedShare = (lineCount: number, fixedTotal: number) => (lineCount > 0 ? fixedTotal / lineCount : 0);
const toolInputClass =
  "w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-medium text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100";
const toolPanelClass = "rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]";
const propertyAddress = (property: Partial<Property>) =>
  [property.address_line1, property.address_line2, [property.postal_code, property.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
const extFromFile = (file: File) => {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
};

function ToolTile({
  title,
  description,
  tags,
  eyebrow,
  metric,
  status = "Calcul rapide",
  tone = "cyan",
  icon,
  onOpen,
}: {
  title: string;
  description: string;
  tags: string[];
  eyebrow: string;
  metric: string;
  status?: string;
  tone?: "cyan" | "violet" | "emerald" | "amber" | "indigo" | "slate";
  icon?: React.ReactNode;
  onOpen: () => void;
}) {
  const toneClasses = {
    cyan: {
      bar: "from-cyan-700 via-sky-400 to-emerald-400",
      panel: "from-cyan-50 via-white to-emerald-50/60",
      icon: "bg-cyan-950 text-cyan-50 ring-cyan-200",
      link: "text-cyan-700",
      hover: "hover:border-cyan-200",
      glow: "bg-cyan-400/15",
      chip: "border-cyan-100 bg-cyan-50 text-cyan-800",
    },
    violet: {
      bar: "from-violet-700 via-fuchsia-400 to-cyan-400",
      panel: "from-violet-50 via-white to-cyan-50/60",
      icon: "bg-violet-950 text-violet-50 ring-violet-200",
      link: "text-violet-700",
      hover: "hover:border-violet-200",
      glow: "bg-violet-400/15",
      chip: "border-violet-100 bg-violet-50 text-violet-800",
    },
    emerald: {
      bar: "from-emerald-700 via-teal-400 to-sky-400",
      panel: "from-emerald-50 via-white to-sky-50/60",
      icon: "bg-emerald-950 text-emerald-50 ring-emerald-200",
      link: "text-emerald-700",
      hover: "hover:border-emerald-200",
      glow: "bg-emerald-400/15",
      chip: "border-emerald-100 bg-emerald-50 text-emerald-800",
    },
    amber: {
      bar: "from-amber-600 via-orange-400 to-cyan-500",
      panel: "from-amber-50 via-white to-cyan-50/60",
      icon: "bg-amber-950 text-amber-50 ring-amber-200",
      link: "text-amber-700",
      hover: "hover:border-amber-200",
      glow: "bg-amber-400/15",
      chip: "border-amber-100 bg-amber-50 text-amber-800",
    },
    indigo: {
      bar: "from-indigo-700 via-blue-400 to-violet-400",
      panel: "from-indigo-50 via-white to-violet-50/60",
      icon: "bg-indigo-950 text-indigo-50 ring-indigo-200",
      link: "text-indigo-700",
      hover: "hover:border-indigo-200",
      glow: "bg-indigo-400/15",
      chip: "border-indigo-100 bg-indigo-50 text-indigo-800",
    },
    slate: {
      bar: "from-slate-700 via-slate-500 to-slate-400",
      panel: "from-slate-50 via-white to-slate-50/60",
      icon: "bg-slate-900 text-slate-50 ring-slate-200",
      link: "text-slate-700",
      hover: "hover:border-slate-300",
      glow: "bg-slate-400/10",
      chip: "border-slate-200 bg-slate-50 text-slate-700",
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        "group relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br text-left shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.12)] sm:min-h-[26rem] sm:rounded-[1.75rem] " +
        toneClasses.panel +
        " " +
        toneClasses.hover
      }
    >
      <span className={"absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl " + toneClasses.glow} />
      <div className={"h-1.5 bg-gradient-to-r " + toneClasses.bar} />
      <div className="relative flex h-full flex-col p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <span className={"flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg ring-1 sm:h-12 sm:w-12 " + toneClasses.icon}>
            {icon ?? <CalculatorIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
          </span>
          <span className={"rounded-full border px-2.5 py-1 text-xs font-semibold sm:px-3 " + toneClasses.chip}>
            {status}
          </span>
        </div>
        <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:mt-5">{eyebrow}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:min-h-[3.5rem]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-3 rounded-2xl border border-white/70 bg-white/65 px-3 py-2.5 shadow-sm backdrop-blur sm:mt-5 sm:px-4 sm:py-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Sortie produite</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">{metric}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
          {tags.map((item) => (
            <span key={item} className="inline-flex min-h-8 items-center rounded-xl border border-white/70 bg-white/70 px-2.5 py-1.5 text-xs font-semibold leading-tight text-slate-700 shadow-sm sm:min-h-9 sm:px-3 sm:py-2">
              {item}
            </span>
          ))}
        </div>
        <span className={"mt-auto inline-flex pt-4 text-sm font-semibold group-hover:underline sm:pt-5 " + toneClasses.link}>Ouvrir l’outil →</span>
      </div>
    </button>
  );
}

function ToolBackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Retour aux outils
    </button>
  );
}

const FINANCE_CATEGORIES = [
  { value: "tax", label: "Taxe foncière" },
  { value: "utilities", label: "Eau / énergie / services" },
  { value: "copro", label: "Copropriété non récupérée" },
  { value: "charges_recovered", label: "Charges récupérées / refacturées" },
  { value: "regularization", label: "Régularisation de charges" },
  { value: "other", label: "Autre" },
];

function FinanceValidationModal({
  userId,
  properties,
  leases,
  tenants,
  draft,
  onClose,
  onSaved,
}: {
  userId: string;
  properties: Property[];
  leases: Lease[];
  tenants: Tenant[];
  draft: FinanceTransactionDraft | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<FinanceTransactionDraft | null>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(draft);
    setError("");
  }, [draft]);

  const activeProperties = useMemo(() => properties.filter(isActivePropertyLike), [properties]);
  const availableLeases = useMemo(
    () => leases.filter((lease) => isSelectableLeaseLike(lease) && (!form?.propertyId || lease.property_id === form.propertyId)),
    [leases, form?.propertyId]
  );
  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const propById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  if (!draft || !form) return null;
  const amount = Number(form.amount || 0);

  const save = async () => {
    if (!supabase || !userId) return;
    setSaving(true);
    setError("");
    try {
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide.");
      const payload = {
        user_id: userId,
        property_id: form.propertyId || null,
        lease_id: form.leaseId || null,
        receipt_id: null,
        occurred_at: form.occurredAt,
        direction: form.direction,
        status: form.status,
        category: form.category,
        label: form.label.trim() || form.title,
        amount,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error: insertError } = await supabase.from("transactions").insert(payload);
      if (insertError) throw insertError;
      onSaved("Écriture ajoutée à Finance.");
      onClose();
    } catch (e: any) {
      setError(e?.message || "Impossible d’ajouter l’écriture Finance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-cyan-700">Enregistrer dans Finance</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">{form.title}</h3>
            <p className="mt-1 text-sm text-slate-600">
              L’outil prépare une écriture comptable. Vérifiez le bien, la date, le montant et la catégorie avant validation.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100" aria-label="Fermer">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Bien rattaché</span>
            <select
              value={form.propertyId || ""}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, propertyId: e.target.value || null, leaseId: "" } : prev))}
              className={toolInputClass}
            >
              <option value="">Aucun bien</option>
              {activeProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label || propertyAddress(property) || "Bien sans libellé"}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Bail concerné</span>
            <select
              value={form.leaseId || ""}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, leaseId: e.target.value || null } : prev))}
              className={toolInputClass}
            >
              <option value="">Aucun bail</option>
              {availableLeases.map((lease) => {
                const prop = propById.get(lease.property_id);
                const tenant = tenantById.get(lease.tenant_id);
                const propLabel = prop?.label || prop?.address_line1 || "Bien";
                const tenantLabel = tenant?.full_name || "Locataire inconnu";
                return (
                  <option key={lease.id} value={lease.id}>
                    {propLabel} — {tenantLabel} (depuis {lease.start_date})
                  </option>
                );
              })}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Date comptable</span>
            <input type="date" value={form.occurredAt} onChange={(e) => setForm((prev) => (prev ? { ...prev, occurredAt: e.target.value } : prev))} className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Montant</span>
            <input inputMode="decimal" value={String(form.amount)} onChange={(e) => setForm((prev) => (prev ? { ...prev, amount: num(e.target.value) } : prev))} className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Sens</span>
            <select value={form.direction} onChange={(e) => setForm((prev) => (prev ? { ...prev, direction: e.target.value as FinanceDirection } : prev))} className={toolInputClass}>
              <option value="in">Recette</option>
              <option value="out">Dépense</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Statut</span>
            <select value={form.status} onChange={(e) => setForm((prev) => (prev ? { ...prev, status: e.target.value as FinanceStatus } : prev))} className={toolInputClass}>
              <option value="expected">Prévu</option>
              <option value="received">Encaissé</option>
              <option value="paid">Payé</option>
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Catégorie</span>
            <select value={form.category} onChange={(e) => setForm((prev) => (prev ? { ...prev, category: e.target.value } : prev))} className={toolInputClass}>
              {FINANCE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Libellé</span>
            <input value={form.label} onChange={(e) => setForm((prev) => (prev ? { ...prev, label: e.target.value } : prev))} className={toolInputClass} />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Notes</span>
            <textarea value={form.notes} onChange={(e) => setForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))} rows={5} className={toolInputClass} />
          </label>
        </div>

        {error ? <div className="mx-5 mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Annuler
          </button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {saving ? "Enregistrement..." : "Enregistrer dans Finance"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CalculatorShell({
  tone,
  eyebrow,
  title,
  description,
  resultLabel,
  resultValue,
  resultHint,
  onBack,
  children,
}: {
  tone: "violet" | "emerald" | "amber" | "slate";
  eyebrow: string;
  title: string;
  description: string;
  resultLabel: string;
  resultValue: string;
  resultHint: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const toneClasses = {
    violet: {
      bar: "from-violet-700 via-fuchsia-400 to-cyan-400",
      result: "from-violet-950 to-slate-950 text-violet-50",
      badge: "border-violet-200 bg-violet-50 text-violet-800",
      ring: "ring-violet-200/70",
    },
    emerald: {
      bar: "from-emerald-700 via-teal-400 to-sky-400",
      result: "from-emerald-950 to-slate-950 text-emerald-50",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
      ring: "ring-emerald-200/70",
    },
    amber: {
      bar: "from-amber-600 via-orange-400 to-cyan-500",
      result: "from-amber-950 to-slate-950 text-amber-50",
      badge: "border-amber-200 bg-amber-50 text-amber-800",
      ring: "ring-amber-200/70",
    },
    slate: {
      bar: "from-slate-600 via-slate-400 to-slate-300",
      result: "from-slate-900 to-slate-950 text-slate-50",
      badge: "border-slate-200 bg-slate-50 text-slate-800",
      ring: "ring-slate-200/70",
    },
  }[tone];

  return (
    <section className="space-y-5">
      <ToolBackButton onBack={onBack} />
      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className={"h-1.5 bg-gradient-to-r " + toneClasses.bar} />
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr),380px]">
          <div className="bg-gradient-to-br from-slate-50 via-white to-cyan-50/40 p-5 sm:p-7">
            <span className={"inline-flex rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] " + toneClasses.badge}>
              {eyebrow}
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <aside className={"relative overflow-hidden bg-gradient-to-br p-5 sm:p-6 " + toneClasses.result}>
            <span className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
            <p className="relative text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{resultLabel}</p>
            <p className="relative mt-3 text-4xl font-semibold tracking-tight">{resultValue}</p>
            <p className="relative mt-3 text-xs leading-5 opacity-75">{resultHint}</p>
          </aside>
        </div>
      </section>
      <section className={toolPanelClass + " ring-1 " + toneClasses.ring}>{children}</section>
    </section>
  );
}

function ToolWorkflowNotice({ title, steps, finance }: { title: string; steps: string[]; finance?: string }) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-400">Étape {index + 1}</p>
                <p className="mt-1 text-xs leading-5 text-slate-700">{step}</p>
              </div>
            ))}
          </div>
        </div>
        {finance ? (
          <aside className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Lien Finance</p>
            <p className="mt-2 text-sm leading-6 text-cyan-950">{finance}</p>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function FinanceImportActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">Importer les données dans Finance</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Choisissez ce que vous voulez transférer. Une fenêtre de validation s’ouvre avant toute écriture.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}

function ChargesAllocationTool({ userId, onBack, onFinanceDraft }: { userId: string; onBack: () => void; onFinanceDraft: (draft: FinanceTransactionDraft) => void }) {
  const storageKey = `lokt:charges-tool:draft:${userId}`;
  const [periodLabel, setPeriodLabel] = useState(() => {
    try { const s = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null; if (s) return JSON.parse(s).periodLabel ?? `${new Date().getFullYear()}`; } catch {}
    return `${new Date().getFullYear()}`;
  });
  const [assetLabel, setAssetLabel] = useState(() => {
    try { const s = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null; if (s) return JSON.parse(s).assetLabel ?? ""; } catch {} return "";
  });
  const [totalCharges, setTotalCharges] = useState(() => {
    try { const s = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null; if (s) return JSON.parse(s).totalCharges ?? ""; } catch {} return "";
  });
  const [totalTantiemes, setTotalTantiemes] = useState(() => {
    try { const s = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null; if (s) return JSON.parse(s).totalTantiemes ?? "1000"; } catch {} return "1000";
  });
  const [lines, setLines] = useState<SimpleShareLine[]>(() => {
    try { const s = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null; if (s) { const d = JSON.parse(s).lines; if (Array.isArray(d) && d.length) return d; } } catch {}
    return [newShareLine(1), newShareLine(2)];
  });
  useEffect(() => {
    try { if (typeof window !== "undefined") window.localStorage.setItem(storageKey, JSON.stringify({ periodLabel, assetLabel, totalCharges, totalTantiemes, lines })); } catch {}
  }, [storageKey, periodLabel, assetLabel, totalCharges, totalTantiemes, lines]);
  const total = num(totalCharges);
  const baseTantiemes = num(totalTantiemes);
  const usedTantiemes = lines.reduce((sum, line) => sum + num(line.tantiemes), 0);
  const denominator = baseTantiemes > 0 ? baseTantiemes : usedTantiemes;
  const computedShares = lines.map((line) => {
    const tantiemes = num(line.tantiemes);
    const sharePercent = denominator > 0 ? (tantiemes / denominator) * 100 : 0;
    const grossAmount = denominator > 0 ? (total * tantiemes) / denominator : 0;
    const recoverablePercent = clampPercent(line.recoverablePercent);
    const recoverableAmount = (grossAmount * recoverablePercent) / 100;
    const ownerAmount = grossAmount - recoverableAmount;
    return { ...line, tantiemes, sharePercent, grossAmount, recoverablePercent, recoverableAmount, ownerAmount };
  });
  const allocated = computedShares.reduce((sum, line) => sum + line.grossAmount, 0);
  const recoverableTotal = computedShares.reduce((sum, line) => sum + line.recoverableAmount, 0);
  const ownerTotal = computedShares.reduce((sum, line) => sum + line.ownerAmount, 0);
  const unallocatedTantiemes = Math.max(0, denominator - usedTantiemes);
  const overAllocatedTantiemes = baseTantiemes > 0 ? Math.max(0, usedTantiemes - baseTantiemes) : 0;
  const unallocatedAmount = Math.max(0, total - allocated);
  const [copied, setCopied] = useState("");

  const updateLine = (id: string, patch: Partial<SimpleShareLine>) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };
  const summary = [
    "Répartition des charges",
    assetLabel ? `Bien : ${assetLabel}` : null,
    periodLabel ? `Période : ${periodLabel}` : null,
    `Montant à répartir : ${formatEuro(total)}`,
    `Base : ${denominator.toLocaleString("fr-FR")} tantièmes`,
    "",
    ...computedShares.map(
      (line) =>
        `${line.label}${line.occupant ? ` - ${line.occupant}` : ""} : ${line.tantiemes.toLocaleString("fr-FR")} tantièmes (${formatPercent(
          line.sharePercent
        )}), quote-part ${formatEuro(line.grossAmount)}, récupérable ${formatEuro(line.recoverableAmount)}`
    ),
    "",
    `Total récupérable : ${formatEuro(recoverableTotal)}`,
    `Part non récupérable / bailleur : ${formatEuro(ownerTotal + unallocatedAmount)}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <CalculatorShell
      tone="violet"
      eyebrow="Répartition des charges"
      title="Répartir des charges par lots"
      description="Préparez une ventilation exploitable : montant global, base de tantièmes, lots concernés, part récupérable et reste bailleur."
      resultLabel="Total récupérable"
      resultValue={formatEuro(recoverableTotal)}
      resultHint={`${usedTantiemes.toLocaleString("fr-FR")} tantièmes saisis sur une base ${denominator.toLocaleString("fr-FR") || "0"}${
        unallocatedTantiemes > 0 ? `, ${unallocatedTantiemes.toLocaleString("fr-FR")} non affectés` : ""
      }.`}
      onBack={onBack}
    >
        <ToolWorkflowNotice
          title="Comment remplir cet outil"
          steps={[
            "Renseignez le bien, l’exercice et le montant global à répartir.",
            "Saisissez les lots avec leurs tantièmes et la part récupérable auprès de l’occupant.",
            "Contrôlez le total récupérable, puis importez seulement les écritures utiles dans Finance.",
          ]}
          finance="L’import Finance sert à créer une dépense de charges, une recette attendue de charges récupérables, ou les deux après validation."
        />
        {total > 0 && denominator === 0 && (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Saisissez la base de tantièmes (ex : 1 000) pour calculer les quotes-parts.
          </div>
        )}
        {overAllocatedTantiemes > 0 && (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Les lots totalisent {usedTantiemes.toLocaleString("fr-FR")} tantièmes pour une base de {baseTantiemes.toLocaleString("fr-FR")} — dépassement de {overAllocatedTantiemes.toLocaleString("fr-FR")}. Vérifiez la saisie.
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-[1.2fr,1fr,0.8fr,0.8fr]">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Bien / immeuble</span>
            <input value={assetLabel} onChange={(e) => setAssetLabel(e.target.value)} placeholder="Ex : Immeuble A, 12 rue..." className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Période ou exercice</span>
            <input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="Ex : 2026" className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Montant total des charges</span>
            <input inputMode="decimal" value={totalCharges} onChange={(e) => setTotalCharges(e.target.value)} placeholder="Ex : 2 400" className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Base de tantièmes</span>
            <input inputMode="decimal" value={totalTantiemes} onChange={(e) => setTotalTantiemes(e.target.value)} placeholder="Ex : 1000" className={toolInputClass} />
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Réparti brut</p>
            <p className="mt-1 text-2xl font-semibold text-violet-950">{formatEuro(allocated)}</p>
            <p className="mt-1 text-xs text-violet-700">{formatPercent(denominator > 0 ? (usedTantiemes / denominator) * 100 : 0)} de la base</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">À facturer aux locataires</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-950">{formatEuro(recoverableTotal)}</p>
            <p className="mt-1 text-xs text-emerald-700">Somme à appeler selon les lots</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Bailleur / non affecté</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{formatEuro(ownerTotal + unallocatedAmount)}</p>
            <p className="mt-1 text-xs text-slate-500">Non récupérable ou tantièmes hors lots</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="grid min-w-[920px] grid-cols-[1.2fr,1fr,110px,110px,130px,130px,44px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-slate-500">
            <span>Lot</span>
            <span>Occupant</span>
            <span>Tantièmes</span>
            <span>Récup.</span>
            <span>Quote-part</span>
            <span>À appeler</span>
            <span />
          </div>
          {computedShares.map((line) => {
            return (
              <div key={line.id} className="grid min-w-[920px] grid-cols-[1.2fr,1fr,110px,110px,130px,130px,44px] gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0">
                <input value={line.label} onChange={(e) => updateLine(line.id, { label: e.target.value })} className={toolInputClass + " rounded-xl py-2"} />
                <input value={line.occupant} onChange={(e) => updateLine(line.id, { occupant: e.target.value })} placeholder="Nom" className={toolInputClass + " rounded-xl py-2"} />
                <input inputMode="decimal" value={line.tantiemes} onChange={(e) => updateLine(line.id, { tantiemes: e.target.value })} className={toolInputClass + " rounded-xl py-2"} />
                <input inputMode="decimal" value={line.recoverablePercent} onChange={(e) => updateLine(line.id, { recoverablePercent: e.target.value })} className={toolInputClass + " rounded-xl py-2"} />
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                  {formatEuro(line.grossAmount)}
                  <span className="block text-[0.68rem] font-medium text-slate-500">{formatPercent(line.sharePercent)}</span>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-950">{formatEuro(line.recoverableAmount)}</div>
                {lines.length > 1 ? (
                  <button type="button" onClick={() => setLines((prev) => prev.filter((item) => item.id !== line.id))} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50" aria-label="Supprimer le lot">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setLines((prev) => [...prev, newShareLine(prev.length + 1)])} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            <PlusIcon className="h-4 w-4" />
            Ajouter un lot
          </button>
          <button type="button" onClick={() => copyToolSummary(summary, setCopied)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <DocumentTextIcon className="h-4 w-4" />
            Copier la synthèse
          </button>
          {copied ? <span className="inline-flex items-center rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">{copied}</span> : null}
        </div>
        <FinanceImportActions>
          <button
            type="button"
            onClick={() =>
              onFinanceDraft({
                title: "Dépense de charges",
                occurredAt: todayISO(),
                direction: "out",
                status: "paid",
                category: "copro",
                label: `Charges ${assetLabel || periodLabel || ""}`.trim(),
                amount: total,
                notes: summary,
              })
            }
            disabled={total <= 0}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <BanknotesIcon className="h-4 w-4" />
            Importer la dépense
          </button>
          <button
            type="button"
            onClick={() =>
              onFinanceDraft({
                title: "Charges récupérables",
                occurredAt: todayISO(),
                direction: "in",
                status: "expected",
                category: "charges_recovered",
                label: `Charges récupérables ${assetLabel || periodLabel || ""}`.trim(),
                amount: recoverableTotal,
                notes: summary,
              })
            }
            disabled={recoverableTotal <= 0}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            <BanknotesIcon className="h-4 w-4" />
            Importer le récupérable
          </button>
        </FinanceImportActions>
    </CalculatorShell>
  );
}

function TeomTool({ userId, onBack, onFinanceDraft }: { userId: string; onBack: () => void; onFinanceDraft: (draft: FinanceTransactionDraft) => void }) {
  const storageKey = `lokt:teom-tool:draft:${userId}`;
  const load = <T,>(key: string, fallback: T): T => { try { const s = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null; if (s) { const v = JSON.parse(s)[key]; if (v !== undefined) return v as T; } } catch {} return fallback; };
  const [assetLabel, setAssetLabel] = useState(() => load("assetLabel", ""));
  const [occupantLabel, setOccupantLabel] = useState(() => load("occupantLabel", ""));
  const [propertyTax, setPropertyTax] = useState(() => load("propertyTax", ""));
  const [teomAmount, setTeomAmount] = useState(() => load("teomAmount", ""));
  const [periodStart, setPeriodStart] = useState(() => load("periodStart", `${new Date().getFullYear()}-01-01`));
  const [periodEnd, setPeriodEnd] = useState(() => load("periodEnd", `${new Date().getFullYear()}-12-31`));
  const [occupancyStart, setOccupancyStart] = useState(() => load("occupancyStart", `${new Date().getFullYear()}-01-01`));
  const [occupancyEnd, setOccupancyEnd] = useState(() => load("occupancyEnd", `${new Date().getFullYear()}-12-31`));
  const [lotShare, setLotShare] = useState(() => load("lotShare", "100"));
  useEffect(() => {
    try { if (typeof window !== "undefined") window.localStorage.setItem(storageKey, JSON.stringify({ assetLabel, occupantLabel, propertyTax, teomAmount, periodStart, periodEnd, occupancyStart, occupancyEnd, lotShare })); } catch {}
  }, [storageKey, assetLabel, occupantLabel, propertyTax, teomAmount, periodStart, periodEnd, occupancyStart, occupancyEnd, lotShare]);
  const teom = num(teomAmount);
  const share = clampPercent(lotShare);
  const periodDays = daysInclusive(periodStart, periodEnd);
  const occupiedDays = Math.min(periodDays, daysInclusive(occupancyStart, occupancyEnd));
  const occupancyRate = periodDays > 0 ? occupiedDays / periodDays : 0;
  const recoverable = teom * (share / 100) * occupancyRate;
  const ownerPart = teom - recoverable;
  const [copied, setCopied] = useState("");
  const summary = [
    "Récupération TEOM",
    assetLabel ? `Bien : ${assetLabel}` : null,
    occupantLabel ? `Occupant : ${occupantLabel}` : null,
    `Taxe foncière totale : ${formatEuro(num(propertyTax))}`,
    `TEOM sur avis : ${formatEuro(teom)}`,
    `Période taxe : ${periodStart || "?"} au ${periodEnd || "?"} (${periodDays} jours)`,
    `Occupation retenue : ${occupancyStart || "?"} au ${occupancyEnd || "?"} (${occupiedDays} jours)`,
    `Quote-part lot : ${formatPercent(share)}`,
    `Montant récupérable : ${formatEuro(recoverable)}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <CalculatorShell
      tone="emerald"
      eyebrow="Ordures ménagères"
      title="Récupérer la TEOM au prorata"
      description="Calculez la TEOM récupérable depuis l’avis de taxe foncière, avec quote-part de lot et prorata d’occupation."
      resultLabel="Montant récupérable"
      resultValue={formatEuro(recoverable)}
      resultHint={`${occupiedDays} jour(s) retenu(s) sur ${periodDays || 0}, quote-part ${formatPercent(share)}. Reste non récupéré : ${formatEuro(ownerPart)}.`}
      onBack={onBack}
    >
        <ToolWorkflowNotice
          title="Comment remplir cet outil"
          steps={[
            "Reportez le montant TEOM visible sur l’avis de taxe foncière, pas toute la taxe foncière.",
            "Indiquez la période de taxe et la période réelle d’occupation du locataire.",
            "Vérifiez le prorata, puis importez la TEOM récupérable dans Finance si vous voulez la suivre.",
          ]}
          finance="L’import Finance peut créer une recette attendue de TEOM récupérable. Vous pouvez aussi importer la taxe foncière comme dépense si elle n’est pas déjà saisie."
        />
        <div className="grid gap-3 lg:grid-cols-4">
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Bien / adresse</span>
            <input value={assetLabel} onChange={(e) => setAssetLabel(e.target.value)} placeholder="Ex : Appartement 2, 12 rue..." className={toolInputClass} />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Occupant facturé</span>
            <input value={occupantLabel} onChange={(e) => setOccupantLabel(e.target.value)} placeholder="Nom du locataire" className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Taxe foncière totale</span>
            <input inputMode="decimal" value={propertyTax} onChange={(e) => setPropertyTax(e.target.value)} placeholder="Ex : 1 250" className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">
              Montant TEOM
              <span className="ml-1 font-normal text-slate-400">(taxe ordures ménagères, incluse dans la taxe foncière)</span>
            </span>
            <input inputMode="decimal" value={teomAmount} onChange={(e) => setTeomAmount(e.target.value)} placeholder="Ex : 186" className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Quote-part du lot (%)</span>
            <input inputMode="decimal" value={lotShare} onChange={(e) => setLotShare(e.target.value)} placeholder="100" className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Début taxe</span>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Fin taxe</span>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Début occupation</span>
            <input type="date" value={occupancyStart} onChange={(e) => setOccupancyStart(e.target.value)} className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Fin occupation</span>
            <input type="date" value={occupancyEnd} onChange={(e) => setOccupancyEnd(e.target.value)} className={toolInputClass} />
          </label>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Taxe foncière</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{formatEuro(num(propertyTax))}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">TEOM avis</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{formatEuro(teom)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">À récupérer</p>
            <p className="mt-2 text-xl font-semibold text-emerald-950">{formatEuro(recoverable)}</p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-950">Formule appliquée</p>
          <p className="mt-1 text-sm leading-6 text-emerald-900">
            TEOM {formatEuro(teom)} × quote-part {formatPercent(share)} × prorata {occupiedDays}/{periodDays || 0} ={" "}
            <span className="font-semibold">{formatEuro(recoverable)}</span>. Les frais de gestion de taxe foncière ne sont pas intégrés.
          </p>
        </div>
        <FinanceImportActions>
          <button
            type="button"
            onClick={() =>
              onFinanceDraft({
                title: "Taxe foncière",
                occurredAt: periodEnd || todayISO(),
                direction: "out",
                status: "paid",
                category: "tax",
                label: `Taxe foncière ${assetLabel || new Date().getFullYear()}`.trim(),
                amount: num(propertyTax),
                notes: summary,
              })
            }
            disabled={num(propertyTax) <= 0}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <BanknotesIcon className="h-4 w-4" />
            Importer la taxe foncière
          </button>
          <button
            type="button"
            onClick={() =>
              onFinanceDraft({
                title: "TEOM récupérable",
                occurredAt: periodEnd || todayISO(),
                direction: "in",
                status: "expected",
                category: "charges_recovered",
                label: `TEOM récupérable ${assetLabel || occupantLabel || ""}`.trim(),
                amount: recoverable,
                notes: summary,
              })
            }
            disabled={recoverable <= 0}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            <BanknotesIcon className="h-4 w-4" />
            Importer la TEOM récupérable
          </button>
        </FinanceImportActions>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => copyToolSummary(summary, setCopied)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <DocumentTextIcon className="h-4 w-4" />
            Copier la synthèse
          </button>
          {copied ? <span className="inline-flex items-center rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">{copied}</span> : null}
        </div>
    </CalculatorShell>
  );
}

function ChargeRegularizationTool({ userId, onBack, onFinanceDraft }: { userId: string; onBack: () => void; onFinanceDraft: (draft: FinanceTransactionDraft) => void }) {
  const storageKey = `lokt:regularization-tool:draft:${userId}`;
  const load = <T,>(key: string, fallback: T): T => { try { const s = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null; if (s) { const v = JSON.parse(s)[key]; if (v !== undefined) return v as T; } } catch {} return fallback; };
  const [assetLabel, setAssetLabel] = useState(() => load("assetLabel", ""));
  const [occupantLabel, setOccupantLabel] = useState(() => load("occupantLabel", ""));
  const [periodStart, setPeriodStart] = useState(() => load("periodStart", `${new Date().getFullYear()}-01-01`));
  const [periodEnd, setPeriodEnd] = useState(() => load("periodEnd", `${new Date().getFullYear()}-12-31`));
  const [monthlyProvision, setMonthlyProvision] = useState(() => load("monthlyProvision", ""));
  const [manualProvisions, setManualProvisions] = useState(() => load("manualProvisions", ""));
  const [useManualProvisions, setUseManualProvisions] = useState(() => load("useManualProvisions", false));
  const [expenses, setExpenses] = useState<RegularizationExpenseLine[]>(() => {
    try { const s = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null; if (s) { const d = JSON.parse(s).expenses; if (Array.isArray(d) && d.length) return d; } } catch {}
    return [newRegularizationExpenseLine("Charges de copropriété récupérables"), newRegularizationExpenseLine("Eau / entretien / petites fournitures")];
  });
  useEffect(() => {
    try { if (typeof window !== "undefined") window.localStorage.setItem(storageKey, JSON.stringify({ assetLabel, occupantLabel, periodStart, periodEnd, monthlyProvision, manualProvisions, useManualProvisions, expenses })); } catch {}
  }, [storageKey, assetLabel, occupantLabel, periodStart, periodEnd, monthlyProvision, manualProvisions, useManualProvisions, expenses]);
  const periodDays = daysInclusive(periodStart, periodEnd);
  const estimatedMonths = periodDays > 0 ? periodDays / 30.4375 : 0;
  const paid = useManualProvisions ? num(manualProvisions) : num(monthlyProvision) * estimatedMonths;
  const computedExpenses = expenses.map((expense) => {
    const amount = num(expense.amount);
    const recoverablePercent = clampPercent(expense.recoverablePercent);
    return { ...expense, amount, recoverablePercent, recoverableAmount: (amount * recoverablePercent) / 100 };
  });
  const real = computedExpenses.reduce((sum, expense) => sum + expense.recoverableAmount, 0);
  const delta = real - paid;
  const tenantOwes = delta > 0;
  const [copied, setCopied] = useState("");
  const updateExpense = (id: string, patch: Partial<RegularizationExpenseLine>) => {
    setExpenses((prev) => prev.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense)));
  };
  const summary = [
    "Régularisation des charges locatives",
    assetLabel ? `Bien : ${assetLabel}` : null,
    occupantLabel ? `Occupant : ${occupantLabel}` : null,
    `Période : ${periodStart || "?"} au ${periodEnd || "?"}`,
    `Provisions versées : ${formatEuro(paid)}`,
    "",
    ...computedExpenses.map((expense) => `${expense.label} : ${formatEuro(expense.amount)} × ${formatPercent(expense.recoverablePercent)} = ${formatEuro(expense.recoverableAmount)}`),
    "",
    `Dépenses récupérables : ${formatEuro(real)}`,
    tenantOwes ? `Complément à payer par le locataire : ${formatEuro(Math.abs(delta))}` : `Trop-perçu à rembourser au locataire : ${formatEuro(Math.abs(delta))}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <CalculatorShell
      tone="amber"
      eyebrow="Régularisation"
      title="Régulariser les charges locatives"
      description="Préparez un solde de régularisation clair : période, provisions encaissées, dépenses réelles et part réellement récupérable."
      resultLabel={tenantOwes ? "À payer par le locataire" : "À rembourser au locataire"}
      resultValue={formatEuro(Math.abs(delta))}
      resultHint={tenantOwes ? "Les dépenses réelles récupérables dépassent les provisions versées." : "Les provisions dépassent les dépenses réelles récupérables."}
      onBack={onBack}
    >
        <ToolWorkflowNotice
          title="Comment remplir cet outil"
          steps={[
            "Renseignez la période, le bien et l’occupant concerné.",
            "Saisissez les provisions versées et les dépenses réelles avec leur part récupérable.",
            "Contrôlez le solde : complément à demander ou trop-perçu à rembourser, puis importez-le dans Finance.",
          ]}
          finance="L’import Finance crée uniquement le solde de régularisation : recette attendue si le locataire doit payer, dépense si vous devez rembourser."
        />
        <div className="grid gap-3 lg:grid-cols-4">
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Bien / adresse</span>
            <input value={assetLabel} onChange={(e) => setAssetLabel(e.target.value)} placeholder="Ex : Appartement 2, 12 rue..." className={toolInputClass} />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Occupant</span>
            <input value={occupantLabel} onChange={(e) => setOccupantLabel(e.target.value)} placeholder="Nom du locataire" className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Début période</span>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Fin période</span>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Provision mensuelle</span>
            <input inputMode="decimal" value={monthlyProvision} onChange={(e) => setMonthlyProvision(e.target.value)} disabled={useManualProvisions} placeholder="Ex : 75" className={toolInputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Provisions versées total</span>
            <input inputMode="decimal" value={manualProvisions} onChange={(e) => setManualProvisions(e.target.value)} disabled={!useManualProvisions} placeholder="Ex : 900" className={toolInputClass} />
          </label>
        </div>
        <label className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={useManualProvisions} onChange={(e) => { setUseManualProvisions(e.target.checked); if (e.target.checked) setMonthlyProvision(""); else setManualProvisions(""); }} className="h-4 w-4 rounded border-slate-300" />
          Saisir directement le total des provisions versées
        </label>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="grid min-w-[760px] grid-cols-[1fr,140px,120px,150px,44px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-slate-500">
            <span>Dépense</span>
            <span>Montant réel</span>
            <span>Récup.</span>
            <span>Retenu</span>
            <span />
          </div>
          {computedExpenses.map((expense) => (
            <div key={expense.id} className="grid min-w-[760px] grid-cols-[1fr,140px,120px,150px,44px] gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0">
              <input value={expense.label} onChange={(e) => updateExpense(expense.id, { label: e.target.value })} className={toolInputClass + " rounded-xl py-2"} />
              <input inputMode="decimal" value={expense.amount} onChange={(e) => updateExpense(expense.id, { amount: e.target.value })} className={toolInputClass + " rounded-xl py-2"} />
              <input inputMode="decimal" value={expense.recoverablePercent} onChange={(e) => updateExpense(expense.id, { recoverablePercent: e.target.value })} className={toolInputClass + " rounded-xl py-2"} />
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">{formatEuro(expense.recoverableAmount)}</div>
              {expenses.length > 1 ? (
                <button type="button" onClick={() => setExpenses((prev) => prev.filter((item) => item.id !== expense.id))} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50" aria-label="Supprimer la dépense">
                  <TrashIcon className="h-4 w-4" />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setExpenses((prev) => [...prev, newRegularizationExpenseLine()])} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          <PlusIcon className="h-4 w-4" />
          Ajouter une dépense
        </button>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Provisions</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{formatEuro(paid)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Réel récupérable</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{formatEuro(real)}</p>
          </div>
          <div className={(tenantOwes ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50") + " rounded-2xl border p-4"}>
            <p className={(tenantOwes ? "text-amber-700" : "text-emerald-700") + " text-xs font-semibold uppercase tracking-[0.12em]"}>Solde</p>
            <p className={(tenantOwes ? "text-amber-950" : "text-emerald-950") + " mt-2 text-xl font-semibold"}>{formatEuro(Math.abs(delta))}</p>
          </div>
        </div>
        <FinanceImportActions>
          <button
            type="button"
            onClick={() =>
              onFinanceDraft({
                title: tenantOwes ? "Régularisation à encaisser" : "Régularisation à rembourser",
                occurredAt: periodEnd || todayISO(),
                direction: tenantOwes ? "in" : "out",
                status: tenantOwes ? "expected" : "paid",
                category: "regularization",
                label: tenantOwes
                  ? `Complément charges ${occupantLabel || assetLabel || ""}`.trim()
                  : `Remboursement charges ${occupantLabel || assetLabel || ""}`.trim(),
                amount: Math.abs(delta),
                notes: summary,
              })
            }
            disabled={Math.abs(delta) <= 0}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-700 px-4 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
          >
            <BanknotesIcon className="h-4 w-4" />
            Importer le solde dans Finance
          </button>
        </FinanceImportActions>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => copyToolSummary(summary, setCopied)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <DocumentTextIcon className="h-4 w-4" />
            Copier la synthèse
          </button>
          {copied ? <span className="inline-flex items-center rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">{copied}</span> : null}
        </div>
    </CalculatorShell>
  );
}

type BailType = "vide" | "meuble";
type CongeBy = "locataire" | "bailleur";
type BailleurMotif = "vente" | "habiter" | "autre";

function computePreavis(bail: BailType, by: CongeBy, motif: BailleurMotif, zoneTendue: boolean): { months: number; label: string; rule: string } {
  if (by === "locataire") {
    if (bail === "meuble") return { months: 1, label: "1 mois", rule: "Bail meublé : préavis locataire toujours 1 mois (art. 25-8 loi 89-462)." };
    if (zoneTendue) return { months: 1, label: "1 mois", rule: "Bail vide, zone tendue : préavis réduit à 1 mois (art. 15 loi 89-462)." };
    return { months: 3, label: "3 mois", rule: "Bail vide, hors zone tendue : préavis 3 mois (art. 15 loi 89-462). Réduction à 1 mois possible en cas de mutation, perte d'emploi ou raisons de santé." };
  }
  // bailleur
  if (bail === "meuble") return { months: 3, label: "3 mois", rule: "Bail meublé : préavis bailleur 3 mois avant l'échéance (art. 25-8 loi 89-462)." };
  if (motif === "vente") return { months: 6, label: "6 mois", rule: "Bail vide, congé pour vente : préavis 6 mois avant l'échéance (art. 15 loi 89-462). Droit de préemption du locataire." };
  if (motif === "habiter") return { months: 6, label: "6 mois", rule: "Bail vide, congé pour habiter : préavis 6 mois avant l'échéance (art. 15 loi 89-462). Justificatif requis." };
  return { months: 6, label: "6 mois", rule: "Bail vide, congé pour autre motif légitime et sérieux : préavis 6 mois avant l'échéance (art. 15 loi 89-462)." };
}

function addMonthsToDate(dateStr: string, months: number): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return "";
  const targetRaw = month + months;
  const targetYear = year + Math.floor(targetRaw / 12);
  const targetMonth = ((targetRaw % 12) + 12) % 12;
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(day, daysInMonth);
  return [
    String(targetYear).padStart(4, "0"),
    String(targetMonth + 1).padStart(2, "0"),
    String(clampedDay).padStart(2, "0"),
  ].join("-");
}

function PreavisTool({ onBack }: { onBack: () => void }) {
  const [bail, setBail] = useState<BailType>("vide");
  const [by, setBy] = useState<CongeBy>("locataire");
  const [motif, setMotif] = useState<BailleurMotif>("habiter");
  const [zoneTendue, setZoneTendue] = useState(false);
  const [notifDate, setNotifDate] = useState(todayISO());

  const result = computePreavis(bail, by, motif, zoneTendue);
  const endDate = addMonthsToDate(notifDate, result.months);
  const fmtDate = (s: string) => {
    if (!s) return "—";
    const d = new Date(`${s}T00:00:00`);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <CalculatorShell
      tone="slate"
      eyebrow="Délai légal"
      title="Calculateur de préavis"
      description="Déterminez la durée de préavis applicable et calculez la date de fin selon le type de bail, la situation géographique et l'auteur du congé."
      resultLabel="Durée de préavis"
      resultValue={result.label}
      resultHint={notifDate ? `Fin estimée : ${fmtDate(endDate)}` : "Saisissez une date de notification."}
      onBack={onBack}
    >
      <ToolWorkflowNotice
        title="Comment utiliser cet outil"
        steps={[
          "Sélectionnez le type de bail et qui donne le congé.",
          "Précisez la zone et la date de notification.",
          "Vérifiez la durée légale et la date de fin estimée.",
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Type de bail</span>
          <select value={bail} onChange={(e) => setBail(e.target.value as BailType)} className={toolInputClass}>
            <option value="vide">Vide (non meublé)</option>
            <option value="meuble">Meublé</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Qui donne congé ?</span>
          <select value={by} onChange={(e) => setBy(e.target.value as CongeBy)} className={toolInputClass}>
            <option value="locataire">Le locataire</option>
            <option value="bailleur">Le bailleur</option>
          </select>
        </label>
        {by === "bailleur" && bail === "vide" && (
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Motif du congé</span>
            <select value={motif} onChange={(e) => setMotif(e.target.value as BailleurMotif)} className={toolInputClass}>
              <option value="habiter">Pour habiter (reprise)</option>
              <option value="vente">Pour vendre</option>
              <option value="autre">Motif légitime et sérieux</option>
            </select>
          </label>
        )}
        {by === "locataire" && bail === "vide" && (
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Zone tendue ?</span>
            <select value={String(zoneTendue)} onChange={(e) => setZoneTendue(e.target.value === "true")} className={toolInputClass}>
              <option value="false">Non</option>
              <option value="true">Oui — zone tendue</option>
            </select>
          </label>
        )}
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Date de notification</span>
          <input type="date" value={notifDate} onChange={(e) => setNotifDate(e.target.value)} className={toolInputClass} />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Notification</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{fmtDate(notifDate)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Durée</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{result.label}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">Fin de préavis</p>
          <p className="mt-2 text-xl font-semibold text-indigo-950">{fmtDate(endDate)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Règle appliquée</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{result.rule}</p>
      </div>
    </CalculatorShell>
  );
}

export function SectionOutils({
  userId,
  properties = [],
  leases = [],
  tenants = [],
  plan = "calc_full",
  onRefresh,
}: {
  userId: string;
  properties?: Property[];
  leases?: Lease[];
  tenants?: Tenant[];
  plan?: Plan;
  onRefresh?: () => Promise<void> | void;
}) {
  const [activeTool, setActiveToolRaw] = useState<ToolKey | null>(null);
  const setActiveTool = (tool: ToolKey | null) => {
    setActiveToolRaw(tool);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [financeDraft, setFinanceDraft] = useState<FinanceTransactionDraft | null>(null);
  const [financeNotice, setFinanceNotice] = useState("");
  const [creatingWaterInvoice, setCreatingWaterInvoice] = useState(false);
  const [waterStep, setWaterStep] = useState<WaterWizardStep>("setup");
  const [sites, setSites] = useState<WaterMeterSite[]>([]);
  const [siteUnits, setSiteUnits] = useState<Record<string, WaterMeterSiteUnit[]>>({});
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [siteName, setSiteName] = useState(DEFAULT_SITE_NAME);
  const [title, setTitle] = useState(DEFAULT_ALLOCATION_TITLE);
  const [scopeLabel, setScopeLabel] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [globalMeterLabel, setGlobalMeterLabel] = useState(DEFAULT_GLOBAL_METER_LABEL);
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>("all_meters");
  const [principalUnitLabel, setPrincipalUnitLabel] = useState(DEFAULT_PRINCIPAL_UNIT_LABEL);
  const [principalOccupantLabel, setPrincipalOccupantLabel] = useState("");
  const [principalOccupantEmail, setPrincipalOccupantEmail] = useState("");
  const [globalPreviousReading, setGlobalPreviousReading] = useState("");
  const [globalCurrentReading, setGlobalCurrentReading] = useState("");
  const [periodStart, setPeriodStart] = useState(monthStartISO());
  const [periodEnd, setPeriodEnd] = useState(todayISO());
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [fixedChargeAmount, setFixedChargeAmount] = useState("");
  const [billedConsumption, setBilledConsumption] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [lines, setLines] = useState<DraftLine[]>(defaultDraftLines);
  const [allocations, setAllocations] = useState<WaterAllocation[]>([]);
  const [readings, setReadings] = useState<Record<string, WaterReading[]>>({});
  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);
  const [confirmDeleteAllocation, setConfirmDeleteAllocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const activeProperties = useMemo(() => properties.filter(isActivePropertyLike), [properties]);

  const selectedLines = useMemo(
    () =>
      lines
        .filter((line) => line.enabled)
        .map((line) => {
          const previous = num(line.previous);
          const current = num(line.current);
          return { ...line, previousValue: previous, currentValue: current, consumption: Math.max(0, current - previous) };
        }),
    [lines]
  );
  const totalConsumption = selectedLines.reduce((sum, line) => sum + line.consumption, 0);
  const globalPreviousValue = num(globalPreviousReading);
  const globalCurrentValue = num(globalCurrentReading);
  const globalConsumption = Math.max(0, globalCurrentValue - globalPreviousValue);
  const principalResidualConsumption = allocationMethod === "principal_residual" ? Math.max(0, globalConsumption - totalConsumption) : 0;
  const manualAllocationLines = selectedLines.map((line) => ({ ...line, readingSource: "manual" as const }));
  const allocationLines =
    allocationMethod === "principal_residual" && globalConsumption > 0
      ? [
          ...manualAllocationLines,
          {
            id: "principal_residual",
            siteUnitId: null,
            enabled: true,
            unitLabel: principalUnitLabel.trim() || DEFAULT_PRINCIPAL_UNIT_LABEL,
            occupantLabel: principalOccupantLabel,
            occupantEmail: principalOccupantEmail,
            previous: "0",
            current: String(principalResidualConsumption),
            previousValue: 0,
            currentValue: principalResidualConsumption,
            consumption: principalResidualConsumption,
            notes: "Consommation calculée par différence avec le compteur général.",
            photo: null,
            readingSource: "principal_residual" as const,
          },
        ]
      : manualAllocationLines;
  const allocatedConsumption = allocationLines.reduce((sum, line) => sum + line.consumption, 0);
  const consumptionDelta = globalConsumption - allocatedConsumption;
  const consumptionTolerance = 1;
  const consumptionMatchesGlobal = globalConsumption > 0 && Math.abs(consumptionDelta) <= consumptionTolerance;
  const invoiceTotal = num(invoiceAmount);
  const fixedChargeTotal = Math.min(invoiceTotal, num(fixedChargeAmount));
  const variableTotal = Math.max(0, invoiceTotal - fixedChargeTotal);
  const billedConsumptionValue = num(billedConsumption);
  const equalFixedShare = computedFixedShare(allocationLines.length, fixedChargeTotal);
  const unitPrice = (globalConsumption > 0 ? variableTotal / globalConsumption : billedConsumptionValue > 0 ? variableTotal / billedConsumptionValue : totalConsumption > 0 ? variableTotal / totalConsumption : 0) || 0;
  const computedLines = allocationLines.map((line) => {
    const share = allocatedConsumption > 0 ? line.consumption / allocatedConsumption : 0;
    const variableAmountDue = variableTotal * share;
    return {
      ...line,
      sharePercent: share * 100,
      variableAmountDue,
      fixedAmountDue: equalFixedShare,
      amountDue: variableAmountDue + equalFixedShare,
    };
  });
  const selectedAllocation = allocations.find((allocation) => allocation.id === selectedAllocationId) || allocations[0] || null;
  const selectedReadings = selectedAllocation ? readings[selectedAllocation.id] || [] : [];
  const latestReadingByKey = useMemo(() => {
    const latest = new Map<string, { value: number; periodEnd: string; allocationTitle: string }>();
    const sortedAllocations = [...allocations].sort((a, b) => {
      const periodCompare = String(b.period_end || "").localeCompare(String(a.period_end || ""));
      if (periodCompare !== 0) return periodCompare;
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });

    sortedAllocations.forEach((allocation) => {
      (readings[allocation.id] || []).forEach((reading) => {
        const payload = {
          value: Number(reading.current_reading || 0),
          periodEnd: allocation.period_end,
          allocationTitle: allocation.title,
        };
        const siteUnitKey = reading.site_unit_id ? `unit:${reading.site_unit_id}` : "";
        const labelKey = normalizeReadingKey(reading.unit_label) ? `label:${normalizeReadingKey(reading.unit_label)}` : "";
        if (siteUnitKey && !latest.has(siteUnitKey)) latest.set(siteUnitKey, payload);
        if (labelKey && !latest.has(labelKey)) latest.set(labelKey, payload);
      });
    });

    return latest;
  }, [allocations, readings]);
  const selectedSite = selectedSiteId ? sites.find((site) => site.id === selectedSiteId) || null : null;
  const selectedSiteSavedUnits = selectedSiteId ? siteUnits[selectedSiteId] || [] : [];
  const hasUnsavedConfigurationDraft = selectedSite
    ? selectedPropertyId !== (selectedSite.property_id || "") ||
      siteName.trim() !== (selectedSite.site_name || DEFAULT_SITE_NAME) ||
      scopeLabel.trim() !== (selectedSite.scope_label || "") ||
      addressLine1.trim() !== (selectedSite.address_line1 || "") ||
      addressLine2.trim() !== (selectedSite.address_line2 || "") ||
      postalCode.trim() !== (selectedSite.postal_code || "") ||
      city.trim() !== (selectedSite.city || "") ||
      allocationMethod !== (selectedSite.allocation_method || "all_meters") ||
      principalUnitLabel.trim() !== (selectedSite.principal_unit_label || DEFAULT_PRINCIPAL_UNIT_LABEL) ||
      principalOccupantLabel.trim() !== (selectedSite.principal_occupant_label || "") ||
      principalOccupantEmail.trim() !== (selectedSite.principal_occupant_email || "") ||
      lines.length !== selectedSiteSavedUnits.length ||
      lines.some((line, index) => {
        const savedUnit = selectedSiteSavedUnits[index];
        if (!savedUnit) return true;
        return (
          line.siteUnitId !== savedUnit.id ||
          line.unitLabel.trim() !== savedUnit.unit_label ||
          line.occupantLabel.trim() !== (savedUnit.occupant_label || "") ||
          line.occupantEmail.trim() !== (savedUnit.occupant_email || "") ||
          line.notes.trim() !== (savedUnit.notes || "") ||
          line.enabled !== savedUnit.active
        );
      })
    : Boolean(selectedPropertyId) ||
      siteName.trim() !== DEFAULT_SITE_NAME ||
      Boolean(scopeLabel.trim()) ||
      Boolean(addressLine1.trim()) ||
      Boolean(addressLine2.trim()) ||
      Boolean(postalCode.trim()) ||
      Boolean(city.trim()) ||
      allocationMethod !== "all_meters" ||
      principalUnitLabel.trim() !== DEFAULT_PRINCIPAL_UNIT_LABEL ||
      Boolean(principalOccupantLabel.trim()) ||
      Boolean(principalOccupantEmail.trim()) ||
      lines.length !== 2 ||
      lines.some(
        (line, index) =>
          line.unitLabel.trim() !== `Lot ${index + 1}` ||
          Boolean(line.occupantLabel.trim()) ||
          Boolean(line.occupantEmail.trim()) ||
          Boolean(line.previous.trim()) ||
          Boolean(line.current.trim()) ||
          Boolean(line.notes.trim()) ||
          Boolean(line.photo) ||
          !line.enabled
      );
  const hasInvoiceDraft =
    title.trim() !== DEFAULT_ALLOCATION_TITLE ||
    periodStart !== monthStartISO() ||
    periodEnd !== todayISO() ||
    Boolean(invoiceAmount.trim()) ||
    Boolean(fixedChargeAmount.trim()) ||
    Boolean(billedConsumption.trim()) ||
    Boolean(globalPreviousReading.trim()) ||
    Boolean(globalCurrentReading.trim()) ||
    Boolean(notes.trim()) ||
    Boolean(invoiceFile) ||
    lines.some((line) => Boolean(line.previous.trim()) || Boolean(line.current.trim()) || Boolean(line.photo));
  const hasWaterDraft = hasUnsavedConfigurationDraft || hasInvoiceDraft;
  const waterStepIndex = WATER_WIZARD_STEPS.findIndex((step) => step.key === waterStep);
  const canGoBack = waterStepIndex > 0;
  const canGoNext = waterStepIndex < WATER_WIZARD_STEPS.length - 1;
  const goToNextStep = () => {
    if (!canGoNext) return;
    setError(null);
    if (waterStep === "setup" && allocationMethod === "principal_residual" && !principalOccupantLabel.trim()) {
      return setError("Renseignez l’occupant du logement principal calculé par différence.");
    }
    if (waterStep === "invoice" && globalPreviousReading.trim() && globalCurrentReading.trim() && globalCurrentValue < globalPreviousValue) {
      return setError("Le relevé général actuel ne peut pas être inférieur au relevé précédent — vérifiez que les deux valeurs ne sont pas inversées.");
    }
    if (waterStep === "readings") {
      if (lines.some((line) => line.enabled && !line.occupantLabel.trim())) {
        return setError("Chaque compteur individuel inclus doit avoir un occupant à facturer.");
      }
      if (allocationMethod === "principal_residual" && !principalOccupantLabel.trim()) {
        return setError("Renseignez l’occupant du logement principal calculé par différence.");
      }
      const invertedLine = lines.find(
        (line) => line.enabled && line.previous.trim() && line.current.trim() && num(line.current) < num(line.previous)
      );
      if (invertedLine) {
        return setError(`Relevé "${invertedLine.unitLabel || "compteur"}" : le relevé actuel ne peut pas être inférieur au relevé précédent.`);
      }
    }
    setWaterStep(WATER_WIZARD_STEPS[waterStepIndex + 1].key);
  };
  const goToPreviousStep = () => {
    if (!canGoBack) return;
    setWaterStep(WATER_WIZARD_STEPS[waterStepIndex - 1].key);
  };
  const latestAllocationForSite = (siteId: string) =>
    allocations
      .filter((allocation) => allocation.site_id === siteId)
      .sort((a, b) => {
        const periodCompare = String(b.period_end || "").localeCompare(String(a.period_end || ""));
        if (periodCompare !== 0) return periodCompare;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      })[0] || null;
  const latestReadingForLine = (line: DraftLine) => {
    const siteUnitKey = line.siteUnitId ? `unit:${line.siteUnitId}` : "";
    const labelKey = normalizeReadingKey(line.unitLabel) ? `label:${normalizeReadingKey(line.unitLabel)}` : "";
    return (siteUnitKey ? latestReadingByKey.get(siteUnitKey) : null) || (labelKey ? latestReadingByKey.get(labelKey) : null) || null;
  };
  const lineWithLatestPrevious = (line: DraftLine): DraftLine => {
    const latestReading = latestReadingForLine(line);
    return latestReading ? { ...line, previous: String(latestReading.value).replace(".", ",") } : line;
  };
  const draftLineFromSiteUnit = (unit: WaterMeterSiteUnit): DraftLine =>
    lineWithLatestPrevious({
      id: `${unit.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      siteUnitId: unit.id,
      enabled: unit.active,
      unitLabel: unit.unit_label,
      occupantLabel: unit.occupant_label || "",
      occupantEmail: unit.occupant_email || "",
      previous: "",
      current: "",
      notes: unit.notes || "",
      photo: null,
    });

  useEffect(() => {
    if (!creatingWaterInvoice || !selectedSiteId || !allocations.length) return;

    if (!globalPreviousReading.trim()) {
      const latestAllocation = latestAllocationForSite(selectedSiteId);
      if (latestAllocation) setGlobalPreviousReading(String(Number(latestAllocation.global_current_reading || 0)).replace(".", ","));
    }

    setLines((prev) => {
      let changed = false;
      const next = prev.map((line) => {
        if (line.previous.trim()) return line;
        const latestReading = latestReadingForLine(line);
        if (!latestReading) return line;
        changed = true;
        return { ...line, previous: String(latestReading.value).replace(".", ",") };
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatingWaterInvoice, selectedSiteId, allocations, readings]);
  const buildWaterDraftSnapshot = (): WaterDraftSnapshot => ({
    waterStep,
    selectedSiteId,
    selectedPropertyId,
    siteName,
    title,
    scopeLabel,
    addressLine1,
    addressLine2,
    postalCode,
    city,
    globalMeterLabel,
    allocationMethod,
    principalUnitLabel,
    principalOccupantLabel,
    principalOccupantEmail,
    globalPreviousReading,
    globalCurrentReading,
    periodStart,
    periodEnd,
    invoiceAmount,
    fixedChargeAmount,
    billedConsumption,
    notes,
    lines: lines.map(({ photo: _photo, ...line }) => line),
  });

  const applyWaterDraftSnapshot = (snapshot: WaterDraftSnapshot) => {
    setWaterStep(snapshot.waterStep || "setup");
    setSelectedSiteId(snapshot.selectedSiteId || "");
    setSelectedPropertyId(snapshot.selectedPropertyId || "");
    setSiteName(snapshot.siteName || DEFAULT_SITE_NAME);
    setTitle(snapshot.title || DEFAULT_ALLOCATION_TITLE);
    setScopeLabel(snapshot.scopeLabel || "");
    setAddressLine1(snapshot.addressLine1 || "");
    setAddressLine2(snapshot.addressLine2 || "");
    setPostalCode(snapshot.postalCode || "");
    setCity(snapshot.city || "");
    setGlobalMeterLabel(snapshot.globalMeterLabel || DEFAULT_GLOBAL_METER_LABEL);
    setAllocationMethod(snapshot.allocationMethod || "all_meters");
    setPrincipalUnitLabel(snapshot.principalUnitLabel || DEFAULT_PRINCIPAL_UNIT_LABEL);
    setPrincipalOccupantLabel(snapshot.principalOccupantLabel || "");
    setPrincipalOccupantEmail(snapshot.principalOccupantEmail || "");
    setGlobalPreviousReading(snapshot.globalPreviousReading || "");
    setGlobalCurrentReading(snapshot.globalCurrentReading || "");
    setPeriodStart(snapshot.periodStart || monthStartISO());
    setPeriodEnd(snapshot.periodEnd || todayISO());
    setInvoiceAmount(snapshot.invoiceAmount || "");
    setFixedChargeAmount(snapshot.fixedChargeAmount || "");
    setBilledConsumption(snapshot.billedConsumption || "");
    setNotes(snapshot.notes || "");
    setInvoiceFile(null);
    setLines(snapshot.lines?.length ? snapshot.lines.map((line) => ({ ...line, photo: null })) : defaultDraftLines());
  };

  const resetUnsavedConfigurationDraft = () => {
    if (selectedSiteId) return;
    setSelectedPropertyId("");
    setSiteName(DEFAULT_SITE_NAME);
    setScopeLabel("");
    setAddressLine1("");
    setAddressLine2("");
    setPostalCode("");
    setCity("");
    setGlobalMeterLabel(DEFAULT_GLOBAL_METER_LABEL);
    setAllocationMethod("all_meters");
    setPrincipalUnitLabel(DEFAULT_PRINCIPAL_UNIT_LABEL);
    setPrincipalOccupantLabel("");
    setPrincipalOccupantEmail("");
  };

  const resetWaterInvoiceDraft = (options: { resetUnsavedConfiguration?: boolean } = {}) => {
    if (options.resetUnsavedConfiguration) resetUnsavedConfigurationDraft();
    setTitle(DEFAULT_ALLOCATION_TITLE);
    setPeriodStart(monthStartISO());
    setPeriodEnd(todayISO());
    setInvoiceAmount("");
    setFixedChargeAmount("");
    setBilledConsumption("");
    const latestAllocation = selectedSiteId ? latestAllocationForSite(selectedSiteId) : null;
    setGlobalPreviousReading(latestAllocation ? String(Number(latestAllocation.global_current_reading || 0)).replace(".", ",") : "");
    setGlobalCurrentReading("");
    setInvoiceFile(null);
    setNotes("");

    const units = selectedSiteId ? siteUnits[selectedSiteId] || [] : [];
    setLines(
      units.length
        ? units.map((unit) => draftLineFromSiteUnit(unit))
        : defaultDraftLines()
    );
  };

  const startWaterInvoice = () => {
    setError(null);
    setOk(null);
    resetWaterInvoiceDraft({ resetUnsavedConfiguration: true });
    setWaterStep("setup");
    setCreatingWaterInvoice(true);
  };

  const resumeWaterInvoice = () => {
    setError(null);
    setOk(null);
    setWaterStep("setup");
    setCreatingWaterInvoice(true);
  };

  const applyProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const property = properties.find((item) => item.id === propertyId);
    if (!property) return;
    setAddressLine1(property.address_line1 || "");
    setAddressLine2(property.address_line2 || "");
    setPostalCode(property.postal_code || "");
    setCity(property.city || "");
    setScopeLabel(propertyAddress(property) || scopeLabel);
    setSiteName(property.label || propertyAddress(property) || siteName);
  };

  const applySite = (siteId: string) => {
    setSelectedSiteId(siteId);
    const site = sites.find((item) => item.id === siteId);
    if (!site) return;
    setSelectedPropertyId(site.property_id || "");
    setSiteName(site.site_name || DEFAULT_SITE_NAME);
    setScopeLabel(site.scope_label || "");
    setAddressLine1(site.address_line1 || "");
    setAddressLine2(site.address_line2 || "");
    setPostalCode(site.postal_code || "");
    setCity(site.city || "");
    setGlobalMeterLabel(site.global_meter_label || DEFAULT_GLOBAL_METER_LABEL);
    setAllocationMethod(site.allocation_method || "all_meters");
    setPrincipalUnitLabel(site.principal_unit_label || DEFAULT_PRINCIPAL_UNIT_LABEL);
    setPrincipalOccupantLabel(site.principal_occupant_label || "");
    setPrincipalOccupantEmail(site.principal_occupant_email || "");
    const latestAllocation = latestAllocationForSite(site.id);
    setGlobalPreviousReading(latestAllocation ? String(Number(latestAllocation.global_current_reading || 0)).replace(".", ",") : "");
    const units = siteUnits[site.id] || [];
    setLines(
      units.length
        ? units.map((unit) => draftLineFromSiteUnit(unit))
        : defaultDraftLines()
    );
  };

  const loadSites = async () => {
    if (!userId || !supabase) return;
    const { data: siteData, error: siteError } = await supabase
      .from("water_meter_sites")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (siteError) throw siteError;
    const siteList = (siteData || []) as WaterMeterSite[];
    setSites(siteList);

    if (!siteList.length) {
      setSiteUnits({});
      return;
    }

    const { data: unitData, error: unitError } = await supabase
      .from("water_meter_site_units")
      .select("*")
      .in("site_id", siteList.map((site) => site.id))
      .order("sort_order", { ascending: true });
    if (unitError) throw unitError;
    const grouped: Record<string, WaterMeterSiteUnit[]> = {};
    ((unitData || []) as WaterMeterSiteUnit[]).forEach((unit) => {
      grouped[unit.site_id] = grouped[unit.site_id] || [];
      grouped[unit.site_id].push(unit);
    });
    setSiteUnits(grouped);
  };

  const loadAllocations = async () => {
    if (!userId || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: allocationError } = await supabase
        .from("water_allocations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (allocationError) throw allocationError;
      const list = (data || []) as WaterAllocation[];
      setAllocations(list);
      if (!selectedAllocationId && list[0]) setSelectedAllocationId(list[0].id);

      if (!list.length) return setReadings({});
      const { data: readingData, error: readingError } = await supabase
        .from("water_allocation_readings")
        .select("*")
        .in("allocation_id", list.map((allocation) => allocation.id))
        .order("created_at", { ascending: true });
      if (readingError) throw readingError;
      const grouped: Record<string, WaterReading[]> = {};
      ((readingData || []) as WaterReading[]).forEach((reading) => {
        grouped[reading.allocation_id] = grouped[reading.allocation_id] || [];
        grouped[reading.allocation_id].push(reading);
      });
      setReadings(grouped);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger l’historique des répartitions d’eau.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      setDraftReady(true);
      return;
    }

    try {
      const rawDraft = window.localStorage.getItem(waterDraftStorageKey(userId));
      if (rawDraft) applyWaterDraftSnapshot(JSON.parse(rawDraft) as WaterDraftSnapshot);
    } catch {
      window.localStorage.removeItem(waterDraftStorageKey(userId));
    } finally {
      setDraftReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!draftReady || !userId || typeof window === "undefined") return;
    const key = waterDraftStorageKey(userId);
    if (hasWaterDraft) {
      window.localStorage.setItem(key, JSON.stringify(buildWaterDraftSnapshot()));
    } else {
      window.localStorage.removeItem(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftReady,
    userId,
    hasWaterDraft,
    waterStep,
    selectedSiteId,
    selectedPropertyId,
    siteName,
    title,
    scopeLabel,
    addressLine1,
    addressLine2,
    postalCode,
    city,
    globalMeterLabel,
    allocationMethod,
    principalUnitLabel,
    principalOccupantLabel,
    principalOccupantEmail,
    globalPreviousReading,
    globalCurrentReading,
    periodStart,
    periodEnd,
    invoiceAmount,
    fixedChargeAmount,
    billedConsumption,
    notes,
    lines,
  ]);

  useEffect(() => {
    void loadAllocations();
    void loadSites().catch((e: any) => setError(e?.message || "Impossible de charger les configurations eau."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (draftReady && !hasWaterDraft && !selectedSiteId && sites[0]) applySite(sites[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, hasWaterDraft, selectedSiteId, sites, siteUnits]);

  const saveSiteConfiguration = async () => {
    if (!userId || !supabase) return;
    setError(null);
    setOk(null);
    if (!siteName.trim()) return setError("Donnez un nom à cette configuration.");
    if (!addressLine1.trim() && !city.trim()) return setError("Renseignez au moins une adresse ou une ville.");
    const activeLines = lines.filter((line) => line.enabled);
    if (!activeLines.length) return setError("Ajoutez au moins un lot ou compteur actif.");
    if (activeLines.some((line) => !line.unitLabel.trim())) return setError("Chaque lot actif doit avoir un nom.");
    if (activeLines.some((line) => !line.occupantLabel.trim())) return setError("Chaque lot actif doit avoir un occupant.");
    if (allocationMethod === "principal_residual" && !principalOccupantLabel.trim()) {
      return setError("Renseignez l’occupant du logement principal calculé par différence.");
    }

    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        property_id: selectedPropertyId || null,
        site_name: siteName.trim(),
        scope_label: scopeLabel.trim() || null,
        address_line1: addressLine1.trim() || null,
        address_line2: addressLine2.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null,
        global_meter_label: globalMeterLabel.trim() || null,
        allocation_method: allocationMethod,
        principal_unit_label: allocationMethod === "principal_residual" ? principalUnitLabel.trim() || DEFAULT_PRINCIPAL_UNIT_LABEL : null,
        principal_occupant_label: allocationMethod === "principal_residual" ? principalOccupantLabel.trim() || null : null,
        principal_occupant_email: allocationMethod === "principal_residual" ? principalOccupantEmail.trim() || null : null,
      };
      const query = selectedSiteId
        ? supabase.from("water_meter_sites").update(payload).eq("id", selectedSiteId).eq("user_id", userId).select("*").single()
        : supabase.from("water_meter_sites").insert(payload).select("*").single();
      const { data: savedSite, error: siteError } = await query;
      if (siteError) throw siteError;
      const site = savedSite as WaterMeterSite;

      await supabase.from("water_meter_site_units").delete().eq("site_id", site.id).eq("user_id", userId);
      const unitsPayload = lines.map((line, index) => ({
        site_id: site.id,
        user_id: userId,
        unit_label: line.unitLabel.trim() || `Lot ${index + 1}`,
        occupant_label: line.occupantLabel.trim() || null,
        occupant_email: line.occupantEmail.trim() || null,
        notes: line.notes.trim() || null,
        sort_order: index,
        active: line.enabled,
      }));
      if (unitsPayload.length) {
        const { error: unitsError } = await supabase.from("water_meter_site_units").insert(unitsPayload);
        if (unitsError) throw unitsError;
      }

      setSelectedSiteId(site.id);
      setOk("Configuration eau enregistrée.");
      await loadSites();
    } catch (e: any) {
      setError(e?.message || "Impossible d’enregistrer la configuration.");
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File, path: string) => {
    if (!supabase) throw new Error("Supabase indisponible.");
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Session expirée.");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    setUploadProgress(0);
    await xhrUploadDirect(supabaseUrl, WATER_BUCKET, path, accessToken, anonKey, file, (pct) => setUploadProgress(pct), true);
    setUploadProgress(null);
  };

  const openStorageFile = async (bucket?: string | null, path?: string | null) => {
    if (!bucket || !path || !supabase) return;
    const { data, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
    if (signedError || !data?.signedUrl) return setError(signedError?.message || "Impossible d’ouvrir le fichier.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const saveAllocation = async () => {
    if (!userId || !supabase) return;
    setError(null);
    setOk(null);
    if (!title.trim()) return setError("Donnez un nom à cette répartition.");
    if (!addressLine1.trim() && !city.trim()) return setError("Renseignez l’adresse du bien ou du compteur.");
    if (!periodStart || !periodEnd) return setError("Renseignez la période de facture.");
    if (invoiceTotal <= 0) return setError("Renseignez le montant total de la facture.");
    if (num(fixedChargeAmount) > invoiceTotal) return setError("La part fixe ne peut pas dépasser le montant total de la facture.");
    if (!globalPreviousReading.trim() || !globalCurrentReading.trim()) return setError("Renseignez le relevé précédent et le relevé actuel du compteur général.");
    if (globalCurrentValue <= globalPreviousValue) return setError("Le relevé actuel du compteur général doit être supérieur au relevé précédent.");
    if (computedLines.length === 0) return setError("Ajoutez au moins un compteur individuel ou activez le logement principal calculé par différence.");
    if (lines.some((line) => line.enabled && (!line.previous.trim() || !line.current.trim()))) {
      return setError("Chaque ligne cochée doit avoir un ancien et un nouveau relevé. Décochez les lignes non utilisées.");
    }
    if (computedLines.some((line) => !line.unitLabel.trim())) return setError("Chaque ligne doit avoir un nom de lot, logement ou compteur.");
    if (computedLines.some((line) => !line.occupantLabel.trim())) return setError("Chaque ligne facturée doit avoir un occupant.");
    if (allocationMethod === "all_meters" && totalConsumption <= 0) return setError("La consommation totale doit être supérieure à 0.");
    if (allocationMethod === "principal_residual" && totalConsumption > globalConsumption + consumptionTolerance) {
      return setError("Les sous-compteurs dépassent le compteur général. Vérifiez les relevés avant de calculer le logement principal par différence.");
    }
    if (allocationMethod === "principal_residual" && principalResidualConsumption <= 0) {
      return setError("Le logement principal calculé par différence doit avoir une consommation positive. Sinon utilisez le mode avec tous les compteurs inclus.");
    }
    if (!consumptionMatchesGlobal) {
      return setError(
        `La consommation répartie doit correspondre au compteur général, à 1 m³ près. Écart actuel : ${consumptionDelta.toLocaleString("fr-FR")} m³.`
      );
    }

    setSaving(true);
    let createdAllocationId: string | null = null;
    try {
      const { data: allocation, error: allocationError } = await supabase
        .from("water_allocations")
        .insert({
          user_id: userId,
          site_id: selectedSiteId || null,
          property_id: selectedPropertyId || null,
          title: title.trim(),
          scope_label: scopeLabel.trim() || null,
          address_line1: addressLine1.trim() || null,
          address_line2: addressLine2.trim() || null,
          postal_code: postalCode.trim() || null,
          city: city.trim() || null,
          allocation_method: allocationMethod,
          principal_unit_label: allocationMethod === "principal_residual" ? principalUnitLabel.trim() || DEFAULT_PRINCIPAL_UNIT_LABEL : null,
          principal_occupant_label: allocationMethod === "principal_residual" ? principalOccupantLabel.trim() || null : null,
          principal_occupant_email: allocationMethod === "principal_residual" ? principalOccupantEmail.trim() || null : null,
          period_start: periodStart,
          period_end: periodEnd,
          invoice_total_amount: invoiceTotal,
          fixed_charge_amount: fixedChargeTotal,
          billed_consumption: billedConsumptionValue > 0 ? billedConsumptionValue : null,
          global_previous_reading: globalPreviousValue,
          global_current_reading: globalCurrentValue,
          global_consumption: globalConsumption,
          total_consumption: allocatedConsumption,
          notes: notes.trim() || null,
          status: "finalized",
        })
        .select("*")
        .single();
      if (allocationError) throw allocationError;
      const savedAllocation = allocation as WaterAllocation;
      createdAllocationId = savedAllocation.id;

      if (invoiceFile) {
        const path = `${userId}/${savedAllocation.id}/invoice/${Date.now()}.${extFromFile(invoiceFile)}`;
        await uploadFile(invoiceFile, path);
        const { error: updateError } = await supabase
          .from("water_allocations")
          .update({
            invoice_storage_bucket: WATER_BUCKET,
            invoice_storage_path: path,
            invoice_file_name: invoiceFile.name,
            invoice_size_bytes: invoiceFile.size,
          })
          .eq("id", savedAllocation.id)
          .eq("user_id", userId);
        if (updateError) throw updateError;
      }

      for (const line of computedLines) {
        const { data: reading, error: readingError } = await supabase
          .from("water_allocation_readings")
          .insert({
            allocation_id: savedAllocation.id,
            user_id: userId,
            site_unit_id: line.siteUnitId || null,
            reading_source: "readingSource" in line ? line.readingSource : "manual",
            unit_label: line.unitLabel.trim(),
            occupant_label: line.occupantLabel.trim() || null,
            occupant_email: line.occupantEmail.trim() || null,
            previous_reading: line.previousValue,
            current_reading: line.currentValue,
            consumption: line.consumption,
            share_percent: line.sharePercent,
            variable_amount_due: line.variableAmountDue,
            fixed_amount_due: line.fixedAmountDue,
            amount_due: line.amountDue,
            notes: line.notes.trim() || null,
          })
          .select("*")
          .single();
        if (readingError) throw readingError;

        if (line.photo && reading?.id) {
          const path = `${userId}/${savedAllocation.id}/meters/${reading.id}.${extFromFile(line.photo)}`;
          await uploadFile(line.photo, path);
          const { error: photoUpdateError } = await supabase
            .from("water_allocation_readings")
            .update({
              photo_storage_bucket: WATER_BUCKET,
              photo_storage_path: path,
              photo_file_name: line.photo.name,
            })
            .eq("id", reading.id)
            .eq("user_id", userId);
          if (photoUpdateError) throw photoUpdateError;
        }

        if (line.siteUnitId && line.readingSource === "manual") {
          const { error: unitUpdateError } = await supabase
            .from("water_meter_site_units")
            .update({
              unit_label: line.unitLabel.trim(),
              occupant_label: line.occupantLabel.trim(),
              occupant_email: line.occupantEmail.trim() || null,
              notes: line.notes.trim() || null,
            })
            .eq("id", line.siteUnitId)
            .eq("user_id", userId);
          if (unitUpdateError) throw unitUpdateError;
        }
      }

      if (selectedSiteId && allocationMethod === "principal_residual") {
        const { error: siteUpdateError } = await supabase
          .from("water_meter_sites")
          .update({
            principal_unit_label: principalUnitLabel.trim() || DEFAULT_PRINCIPAL_UNIT_LABEL,
            principal_occupant_label: principalOccupantLabel.trim(),
            principal_occupant_email: principalOccupantEmail.trim() || null,
          })
          .eq("id", selectedSiteId)
          .eq("user_id", userId);
        if (siteUpdateError) throw siteUpdateError;
      }

      setOk("Répartition d’eau enregistrée.");
      if (typeof window !== "undefined") window.localStorage.removeItem(waterDraftStorageKey(userId));
      resetWaterInvoiceDraft({ resetUnsavedConfiguration: !selectedSiteId });
      await loadAllocations();
      await loadSites();
      setSelectedAllocationId(savedAllocation.id);
      setCreatingWaterInvoice(false);
      setWaterStep("setup");
    } catch (e: any) {
      if (createdAllocationId && supabase) {
        try { await supabase.from("water_allocation_readings").delete().eq("allocation_id", createdAllocationId).eq("user_id", userId); } catch {}
        try { await supabase.from("water_allocations").delete().eq("id", createdAllocationId).eq("user_id", userId); } catch {}
      }
      setError(e?.message || "Impossible d’enregistrer la répartition.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAllocation = async (allocation: WaterAllocation) => {
    if (!supabase) return;
    setError(null);
    setOk(null);
    try {
      const paths = [
        allocation.invoice_storage_path,
        ...(readings[allocation.id] || []).map((reading) => reading.photo_storage_path),
      ].filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from(WATER_BUCKET).remove(paths);
      const { error: deleteError } = await supabase.from("water_allocations").delete().eq("id", allocation.id).eq("user_id", userId);
      if (deleteError) throw deleteError;
      setOk("Répartition supprimée.");
      setSelectedAllocationId(null);
      await loadAllocations();
    } catch (e: any) {
      setError(e?.message || "Impossible de supprimer la répartition.");
    }
  };

  const allocationAddress = (allocation: WaterAllocation) =>
    [allocation.address_line1, allocation.address_line2, [allocation.postal_code, allocation.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");

  const buildAllocationHtml = (allocation: WaterAllocation, allocationReadings: WaterReading[]) => {
    const rows = allocationReadings
      .map(
        (reading) => `
          <tr>
            <td>${reading.unit_label || ""}</td>
            <td>${reading.occupant_label || ""}</td>
            <td>${Number(reading.previous_reading || 0).toLocaleString("fr-FR")}</td>
            <td>${Number(reading.current_reading || 0).toLocaleString("fr-FR")}</td>
            <td>${Number(reading.consumption || 0).toLocaleString("fr-FR")} m³</td>
            <td>${formatEuro(Number(reading.variable_amount_due || 0))}</td>
            <td>${formatEuro(Number(reading.fixed_amount_due || 0))}</td>
            <td><strong>${formatEuro(Number(reading.amount_due || 0))}</strong></td>
          </tr>`
      )
      .join("");
    return `<!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>${allocation.title}</title>
          <style>
            body{font-family:Arial,sans-serif;color:#0f172a;margin:32px;line-height:1.45}
            h1{font-size:24px;margin:0 0 8px}
            .meta{color:#475569;margin-bottom:20px}
            .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
            .box{border:1px solid #cbd5e1;border-radius:12px;padding:12px}
            .label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700}
            .value{margin-top:4px;font-size:16px;font-weight:700}
            table{width:100%;border-collapse:collapse;margin-top:18px}
            th,td{border-bottom:1px solid #e2e8f0;text-align:left;padding:8px;font-size:13px}
            th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}
          </style>
        </head>
        <body>
          <h1>${allocation.title}</h1>
          <div class="meta">${allocationAddress(allocation) || allocation.scope_label || "Adresse non renseignée"}<br/>Période : ${allocation.period_start} → ${allocation.period_end}</div>
          <div class="grid">
            <div class="box"><div class="label">Facture totale</div><div class="value">${formatEuro(Number(allocation.invoice_total_amount || 0))}</div></div>
            <div class="box"><div class="label">Part fixe</div><div class="value">${formatEuro(Number(allocation.fixed_charge_amount || 0))}</div></div>
            <div class="box"><div class="label">Compteur général</div><div class="value">${Number(allocation.global_consumption || 0).toLocaleString("fr-FR")} m³</div></div>
          </div>
          <table>
            <thead><tr><th>Lot</th><th>Occupant</th><th>Ancien</th><th>Nouveau</th><th>Conso</th><th>Part conso</th><th>Part fixe</th><th>Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>`;
  };

  const exportAllocationPdf = (allocation: WaterAllocation) => {
    const allocationReadings = readings[allocation.id] || [];
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return setError("Impossible d’ouvrir l’export. Vérifiez le blocage des fenêtres.");
    popup.document.write(buildAllocationHtml(allocation, allocationReadings));
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const prepareAllocationEmail = (allocation: WaterAllocation) => {
    const allocationReadings = readings[allocation.id] || [];
    const emails = Array.from(new Set(allocationReadings.map((reading) => reading.occupant_email).filter(Boolean))) as string[];
    if (!emails.length) return setError("Aucune adresse email renseignée pour les occupants impactés.");
    const subject = `Répartition facture d’eau - ${allocationAddress(allocation) || allocation.scope_label || allocation.title}`;
    const body = [
      "Bonjour,",
      "",
      `Veuillez trouver ci-dessous la répartition de la facture d’eau pour la période ${allocation.period_start} au ${allocation.period_end}.`,
      "",
      ...allocationReadings.map(
        (reading) =>
          `${reading.unit_label}${reading.occupant_label ? ` - ${reading.occupant_label}` : ""} : ${Number(reading.consumption || 0).toLocaleString("fr-FR")} m³, montant ${formatEuro(Number(reading.amount_due || 0))}`
      ),
      "",
      `Facture totale : ${formatEuro(Number(allocation.invoice_total_amount || 0))}`,
      `Compteur général : ${Number(allocation.global_consumption || 0).toLocaleString("fr-FR")} m³`,
      "",
      "Cordialement,",
    ].join("\n");
    window.location.href = `mailto:${emails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const openFinanceDraft = (draft: FinanceTransactionDraft) => {
    setFinanceNotice("");
    setFinanceDraft(draft);
  };

  const financeFeedback = financeNotice ? (
    <div className="fixed bottom-4 right-4 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-xl">
      {financeNotice}
    </div>
  ) : null;

  const financeModal = (
    <FinanceValidationModal
      userId={userId}
      properties={properties}
      leases={leases}
      tenants={tenants}
      draft={financeDraft}
      onClose={() => setFinanceDraft(null)}
      onSaved={async (message) => {
        setFinanceNotice(message);
        window.setTimeout(() => setFinanceNotice(""), 3200);
        await onRefresh?.();
      }}
    />
  );

  if (!activeTool) {
    return (
      <>
        <section>
          <div className="grid items-stretch gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <ToolTile
              title="Facturation eau"
              eyebrow="Outil historisé"
              description="Répartissez une facture d’eau générale entre compteurs individuels : consommation au prorata des m³, abonnement à parts égales, justificatifs et historique."
              metric="Montant dû par compteur"
              tags={["Part fixe + m³", "Relevés individuels", "Historique"]}
              tone="cyan"
              status="Avancé"
              icon={<BeakerIcon className="h-6 w-6" />}
              onOpen={() => setActiveTool("water")}
            />
            <ToolTile
              title="Répartition des charges"
              eyebrow="Quote-part"
              description="Calculez la quote-part de charges par lot à partir d’un montant global, d’une base de tantièmes et des lots concernés."
              metric="Quote-part par lot"
              tags={["Tantièmes", "Lots", "Quote-part"]}
              tone="violet"
              icon={<Squares2X2Icon className="h-6 w-6" />}
              onOpen={() => setActiveTool("charges")}
            />
            <ToolTile
              title="TEOM récupérable"
              eyebrow="Taxe ordures ménagères"
              description="Isolez le montant de TEOM récupérable auprès du locataire depuis l’avis de taxe foncière, avec quote-part et prorata d’occupation."
              metric="TEOM à récupérer"
              tags={["Taxe foncière", "TEOM", "Prorata"]}
              tone="emerald"
              icon={<DocumentTextIcon className="h-6 w-6" />}
              onOpen={() => setActiveTool("teom")}
            />
            <ToolTile
              title="Régularisation des charges"
              eyebrow="Solde locatif"
              description="Comparez provisions versées et dépenses réelles pour déterminer si le locataire doit payer un complément ou être remboursé."
              metric="Solde à payer ou rembourser"
              tags={["Provisions", "Dépenses", "Solde"]}
              tone="amber"
              icon={<ArrowsRightLeftIcon className="h-6 w-6" />}
              onOpen={() => setActiveTool("regularization")}
            />
            <ToolTile
              title="Calculateur de préavis"
              eyebrow="Délai légal"
              description="Calculez la durée de préavis applicable et la date de fin selon le type de bail, la zone et l’auteur du congé."
              metric="Date de fin de préavis"
              tags={["Bail vide / meublé", "Zone tendue", "Bailleur / locataire"]}
              tone="slate"
              icon={<ClockIcon className="h-6 w-6" />}
              onOpen={() => setActiveTool("preavis")}
            />
            <ToolTile
              title="Simulateurs bailleur"
              eyebrow="Décision"
              description="Arbitrez vos décisions de gestion : LMNP vs location nue, révision IRL, rentabilité, conserver ou vendre."
              metric="Aide à la décision"
              tags={["LMNP", "IRL", "Rentabilité"]}
              tone="indigo"
              status="Simulateurs"
              icon={<ChartBarIcon className="h-6 w-6" />}
              onOpen={() => setActiveTool("simulators")}
            />
          </div>
        </section>
        {financeModal}
        {financeFeedback}
      </>
    );
  }

  if (activeTool === "charges") {
    return (
      <>
        <ChargesAllocationTool userId={userId} onBack={() => setActiveTool(null)} onFinanceDraft={openFinanceDraft} />
        {financeModal}
        {financeFeedback}
      </>
    );
  }

  if (activeTool === "teom") {
    return (
      <>
        <TeomTool userId={userId} onBack={() => setActiveTool(null)} onFinanceDraft={openFinanceDraft} />
        {financeModal}
        {financeFeedback}
      </>
    );
  }

  if (activeTool === "regularization") {
    return (
      <>
        <ChargeRegularizationTool userId={userId} onBack={() => setActiveTool(null)} onFinanceDraft={openFinanceDraft} />
        {financeModal}
        {financeFeedback}
      </>
    );
  }

  if (activeTool === "preavis") {
    return (
      <>
        <PreavisTool onBack={() => setActiveTool(null)} />
        {financeModal}
        {financeFeedback}
      </>
    );
  }

  if (activeTool === "simulators") {
    return (
      <section className="space-y-5">
        <button
          type="button"
          onClick={() => setActiveTool(null)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Retour aux outils
        </button>
        <SectionSimulateursBailleur plan={plan} />
        {financeModal}
        {financeFeedback}
      </section>
    );
  }

  if (!creatingWaterInvoice) {
    return (
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setActiveTool(null)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Retour aux outils
          </button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {hasWaterDraft && (
              <button
                type="button"
                onClick={resumeWaterInvoice}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-5 py-2 text-sm font-semibold text-cyan-900 hover:bg-cyan-100"
              >
                <DocumentTextIcon className="h-4 w-4" />
                Reprendre la facture en cours
              </button>
            )}
            <button
              type="button"
              onClick={startWaterInvoice}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <PlusIcon className="h-4 w-4" />
              Nouvelle facture
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-cyan-700 via-sky-400 to-emerald-400" />
          <div className="grid gap-0 lg:grid-cols-[1fr,360px]">
            <div className="p-5 sm:p-6">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Gestion facturation eau</p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight text-slate-950">Factures et relevés d’eau</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Une ligne correspond à une facture reçue. Créez une nouvelle facture, saisissez la période, le compteur général, puis les
                relevés des lots configurés.
              </p>
            </div>
            <aside className="border-t border-slate-200 bg-[#f6f9fc] p-5 lg:border-l lg:border-t-0">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Factures</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{allocations.length}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Sites</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{sites.length}</p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {(error || ok) && (
          <div className={"rounded-2xl border px-4 py-3 text-sm " + (error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
            {error || ok}
          </div>
        )}

        <ToolWorkflowNotice
          title="Workflow de l’outil eau"
          steps={[
            "Créez une facture avec la période, la facture générale et les relevés des compteurs.",
            "Contrôlez que les compteurs individuels correspondent au compteur général.",
            "Depuis une facture enregistrée, importez dans Finance la dépense fournisseur ou le récupérable à facturer.",
          ]}
          finance="L’import Finance ne se fait jamais automatiquement : sélectionnez une facture, choisissez l’écriture à importer, puis validez la date, le bien et la catégorie."
        />

        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Historique des factures</h3>
                <p className="mt-1 text-sm text-slate-500">Facture après facture, avec la période et le montant réparti.</p>
              </div>
              <button type="button" onClick={loadAllocations} className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50" aria-label="Rafraîchir">
                <ArrowPathIcon className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
              </button>
            </div>

            <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-[820px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Période</th>
                    <th className="px-3 py-2">Facture</th>
                    <th className="px-3 py-2">Compteur général</th>
                    <th className="px-3 py-2">Lots</th>
                    <th className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                        Aucune facture enregistrée pour l’instant.
                      </td>
                    </tr>
                  ) : (
                    allocations.map((allocation) => {
                      const rowReadings = readings[allocation.id] || [];
                      const active = selectedAllocation?.id === allocation.id;
                      return (
                        <tr
                          key={allocation.id}
                          onClick={() => setSelectedAllocationId(allocation.id)}
                          className={"cursor-pointer border-t border-slate-100 " + (active ? "bg-cyan-50/70" : "hover:bg-slate-50")}
                        >
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-950">{allocation.period_start} → {allocation.period_end}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{allocation.scope_label || allocation.title}</p>
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-950">{formatEuro(Number(allocation.invoice_total_amount || 0))}</td>
                          <td className="px-3 py-3 text-slate-700">{Number(allocation.global_consumption || 0).toLocaleString("fr-FR")} m³</td>
                          <td className="px-3 py-3 text-slate-700">{rowReadings.length}</td>
                          <td className="px-3 py-3">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Enregistrée</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-4">
            {selectedAllocation ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{selectedAllocation.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedAllocation.period_start} → {selectedAllocation.period_end}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {formatEuro(Number(selectedAllocation.invoice_total_amount || 0))} · {Number(selectedAllocation.global_consumption || 0).toLocaleString("fr-FR")} m³ · {selectedReadings.length} lot(s)
                    </p>
                  </div>
                  {confirmDeleteAllocation ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-red-700">Confirmer ?</span>
                      <button type="button" onClick={() => { setConfirmDeleteAllocation(false); void deleteAllocation(selectedAllocation); }} className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">Oui</button>
                      <button type="button" onClick={() => setConfirmDeleteAllocation(false)} className="rounded-md border px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Non</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDeleteAllocation(true)} className="w-max rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" aria-label="Supprimer">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {selectedAllocation.invoice_storage_path ? (
                  <button type="button" onClick={() => openStorageFile(selectedAllocation.invoice_storage_bucket, selectedAllocation.invoice_storage_path)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                    <DocumentTextIcon className="h-4 w-4" />
                    Ouvrir la facture
                  </button>
                ) : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <button type="button" onClick={() => exportAllocationPdf(selectedAllocation)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                    <PrinterIcon className="h-4 w-4" />
                    Export PDF
                  </button>
                  <button type="button" onClick={() => prepareAllocationEmail(selectedAllocation)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
                    <EnvelopeIcon className="h-4 w-4" />
                    Préparer email
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openFinanceDraft({
                        title: "Facture d’eau fournisseur",
                        propertyId: selectedAllocation.property_id,
                        occurredAt: selectedAllocation.period_end || todayISO(),
                        direction: "out",
                        status: "paid",
                        category: "utilities",
                        label: `Facture eau ${allocationAddress(selectedAllocation) || selectedAllocation.scope_label || selectedAllocation.title}`,
                        amount: Number(selectedAllocation.invoice_total_amount || 0),
                        notes: `Facture d’eau ${selectedAllocation.period_start} au ${selectedAllocation.period_end}\nCompteur général : ${Number(
                          selectedAllocation.global_consumption || 0
                        ).toLocaleString("fr-FR")} m³\nMontant réparti : ${formatEuro(Number(selectedAllocation.invoice_total_amount || 0))}`,
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <BanknotesIcon className="h-4 w-4" />
                    Importer dépense
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const recoverableAmount = selectedReadings.reduce((sum, reading) => sum + Number(reading.amount_due || 0), 0);
                      openFinanceDraft({
                        title: "Eau à récupérer",
                        propertyId: selectedAllocation.property_id,
                        occurredAt: selectedAllocation.period_end || todayISO(),
                        direction: "in",
                        status: "expected",
                        category: "charges_recovered",
                        label: `Eau à récupérer ${allocationAddress(selectedAllocation) || selectedAllocation.scope_label || selectedAllocation.title}`,
                        amount: recoverableAmount,
                        notes: [
                          `Répartition eau ${selectedAllocation.period_start} au ${selectedAllocation.period_end}`,
                          ...selectedReadings.map(
                            (reading) =>
                              `${reading.unit_label}${reading.occupant_label ? ` - ${reading.occupant_label}` : ""} : ${Number(
                                reading.consumption || 0
                              ).toLocaleString("fr-FR")} m³, ${formatEuro(Number(reading.amount_due || 0))}`
                          ),
                        ].join("\n"),
                      });
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
                  >
                    <BanknotesIcon className="h-4 w-4" />
                    Importer récupérable
                  </button>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {selectedReadings.map((reading) => (
                    <div key={reading.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{reading.unit_label}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {Number(reading.consumption).toLocaleString("fr-FR")} m³ · {reading.occupant_label || "occupant non renseigné"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-950">{formatEuro(Number(reading.amount_due || 0))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
                Sélectionnez une facture pour voir le détail.
              </section>
            )}
          </aside>
        </div>
        {financeModal}
        {financeFeedback}
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <button
        type="button"
        onClick={() => {
          setCreatingWaterInvoice(false);
          setWaterStep("setup");
          setError(null);
          setOk(null);
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Retour aux factures
      </button>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-cyan-700 via-sky-400 to-emerald-400" />
        <div className="grid gap-0 lg:grid-cols-[1fr,360px]">
          <div className="p-5 sm:p-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Outil métier</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-slate-950">Gestion facturation eau</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Saisissez librement les lots, logements, occupants ou compteurs concernés. Le calcul ne dépend pas des locataires ou biens
              enregistrés dans lokt.fr.
            </p>
          </div>
          <aside className="border-t border-slate-200 bg-[#f6f9fc] p-5 lg:border-l lg:border-t-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">Méthode</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Tous les logements raccordés doivent être saisis, y compris le logement principal qui reçoit la facture. La somme des
                sous-compteurs doit retrouver le compteur général, à 1 m³ près.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-cyan-50 px-3 py-2">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-cyan-700">Compteur général</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-950">{globalConsumption.toLocaleString("fr-FR")} m³</p>
                </div>
                <div className="rounded-xl bg-indigo-50 px-3 py-2">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-indigo-700">Sous-compteurs</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-950">{totalConsumption.toLocaleString("fr-FR")} m³</p>
                </div>
                <div className="rounded-xl bg-violet-50 px-3 py-2">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-violet-700">Réparti</p>
                  <p className="mt-1 text-sm font-semibold text-violet-950">{allocatedConsumption.toLocaleString("fr-FR")} m³</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-emerald-700">Facture</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-950">{formatEuro(invoiceTotal)}</p>
                </div>
                <div className="rounded-xl bg-sky-50 px-3 py-2">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-sky-700">Part conso</p>
                  <p className="mt-1 text-sm font-semibold text-sky-950">{formatEuro(variableTotal)}</p>
                </div>
                <div className="rounded-xl bg-amber-50 px-3 py-2">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-amber-700">Part fixe</p>
                  <p className="mt-1 text-sm font-semibold text-amber-950">{formatEuro(fixedChargeTotal)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Prix m³ indicatif : <span className="font-semibold text-slate-800">{formatEuro(unitPrice)}</span>
                {globalConsumption > 0 && totalConsumption > 0 ? (
                  <>
                    {" "}
                    · écart compteur général/sous-compteurs :{" "}
                    <span className={consumptionMatchesGlobal ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                      {consumptionDelta.toLocaleString("fr-FR")} m³
                    </span>
                  </>
                ) : null}
                {allocationMethod === "principal_residual" && globalConsumption > 0 ? (
                  <>
                    {" "}
                    · logement principal calculé : <span className="font-semibold text-slate-800">{principalResidualConsumption.toLocaleString("fr-FR")} m³</span>
                  </>
                ) : null}
              </p>
            </div>
          </aside>
        </div>
      </div>

      {(error || ok) && (
        <div className={"rounded-2xl border px-4 py-3 text-sm " + (error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
          {error || ok}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-4">
          {WATER_WIZARD_STEPS.map((step, index) => {
            const active = step.key === waterStep;
            const done = index < waterStepIndex;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => setWaterStep(step.key)}
                className={
                  "rounded-2xl border p-3 text-left transition " +
                  (active
                    ? "border-cyan-500 bg-cyan-50 text-cyan-950 shadow-sm"
                    : done
                      ? "border-emerald-100 bg-emerald-50/70 text-slate-800 hover:bg-emerald-50"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white")
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold " +
                      (active ? "bg-cyan-700 text-white" : done ? "bg-emerald-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200")
                    }
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold">{step.title}</span>
                </div>
                <p className="mt-2 text-xs leading-5">{step.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-5">
          {waterStep === "setup" ? (
          <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-cyan-50/45 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-cyan-700">Paramètres du compteur</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">Bien, adresse et méthode de répartition</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Créez une configuration par immeuble, maison divisée ou copropriété. Elle sera réutilisée à chaque nouvelle facture.
                </p>
              </div>
              <button
                type="button"
                onClick={saveSiteConfiguration}
                disabled={saving}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
              >
                {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                Enregistrer la configuration
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Reprendre un bien déjà configuré</span>
                <select value={selectedSiteId} onChange={(e) => applySite(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Créer une nouvelle configuration</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {[site.site_name, site.address_line1, site.city].filter(Boolean).join(" - ")}
                    </option>
                  ))}
                </select>
                <span className="block text-xs leading-5 text-slate-500">
                  Sert à récupérer l’adresse, les compteurs et les occupants déjà saisis pour ce bien.
                </span>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Importer depuis la page Biens</span>
                <select value={selectedPropertyId} onChange={(e) => applyProperty(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Adresse libre / non liée</option>
                  {activeProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.label || propertyAddress(property) || "Bien sans libellé"}
                    </option>
                  ))}
                </select>
                <span className="block text-xs leading-5 text-slate-500">
                  Optionnel : utile si le bien existe déjà dans votre espace bailleur.
                </span>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Nom du bien / immeuble</span>
                <input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Ex : Maison rue Victor Hugo, Immeuble A..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="space-y-2 sm:col-span-2">
                <div>
                  <span className="text-xs font-semibold text-slate-600">Comment le compteur général alimente le bien ?</span>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Ce choix sert uniquement à savoir si le logement principal doit être saisi comme les autres lots ou calculé automatiquement.
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAllocationMethod("all_meters")}
                    className={
                      "rounded-2xl border p-4 text-left transition " +
                      (allocationMethod === "all_meters" ? "border-cyan-500 bg-cyan-50 ring-1 ring-cyan-200" : "border-slate-200 bg-white hover:bg-slate-50")
                    }
                  >
                    <span className="text-sm font-semibold text-slate-950">Chaque logement a son propre compteur</span>
                    <span className="mt-2 block text-xs leading-5 text-slate-600">
                      Choisir ce cas si le compteur général sert de total fournisseur et que chaque logement à facturer a un relevé individuel,
                      y compris le logement principal s’il existe.
                    </span>
                    <span className="mt-3 block rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
                      Exemple : appartement 1 + appartement 2 + maison principale ont chacun un petit compteur.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMethod("principal_residual")}
                    className={
                      "rounded-2xl border p-4 text-left transition " +
                      (allocationMethod === "principal_residual" ? "border-violet-500 bg-violet-50 ring-1 ring-violet-200" : "border-slate-200 bg-white hover:bg-slate-50")
                    }
                  >
                    <span className="text-sm font-semibold text-slate-950">Le logement principal utilise le compteur général</span>
                    <span className="mt-2 block text-xs leading-5 text-slate-600">
                      Choisir ce cas si certains lots ont un petit compteur, mais que le logement principal n’en a pas. Sa consommation sera
                      calculée par différence.
                    </span>
                    <span className="mt-3 block rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
                      Exemple : compteur général 120 m³ - studios 30 m³ et 25 m³ = logement principal 65 m³.
                    </span>
                  </button>
                </div>
              </div>
              {allocationMethod === "principal_residual" ? (
                <div className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-3 sm:col-span-2 sm:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-600">Libellé logement principal</span>
                    <input value={principalUnitLabel} onChange={(e) => setPrincipalUnitLabel(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-600">Occupant à facturer</span>
                    <input value={principalOccupantLabel} onChange={(e) => setPrincipalOccupantLabel(e.target.value)} placeholder="Nom de l’occupant" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-600">Email partage</span>
                    <input type="email" value={principalOccupantEmail} onChange={(e) => setPrincipalOccupantEmail(e.target.value)} placeholder="email@exemple.fr" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                </div>
              ) : null}
              <div className="space-y-1 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-600">Adresse</span>
                <AddressAutocomplete
                  id="outils_site_address1"
                  hint={false}
                  addressLine1={addressLine1}
                  postalCode={postalCode}
                  city={city}
                  onAddressLine1Change={setAddressLine1}
                  onPostalCodeChange={setPostalCode}
                  onCityChange={setCity}
                  placeholder="Numéro et rue"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Complément</span>
                <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Bâtiment, entrée, étage..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="mt-5 flex flex-col gap-2 border-t border-cyan-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">La configuration peut être enregistrée pour les prochaines factures.</p>
              <button type="button" onClick={goToNextStep} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Continuer vers la facture
              </button>
            </div>
          </section>
          ) : null}

          {waterStep === "invoice" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Facture à répartir</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">Relevé général et facture fournisseur</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Saisissez d’abord ce qui figure sur la facture et le relevé du compteur général. C’est la référence de contrôle du calcul.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Nom de la répartition</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Périmètre</span>
                <input value={scopeLabel} onChange={(e) => setScopeLabel(e.target.value)} placeholder="Ex : Immeuble A, copropriété, mono-propriété..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Relevé général précédent</span>
                <input inputMode="decimal" value={globalPreviousReading} onChange={(e) => setGlobalPreviousReading(e.target.value)} placeholder="Obligatoire" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Relevé général actuel</span>
                <input inputMode="decimal" value={globalCurrentReading} onChange={(e) => setGlobalCurrentReading(e.target.value)} placeholder="Obligatoire" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Montant facture générale</span>
                <input inputMode="decimal" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder="Ex : 842,60" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Abonnement / part fixe TTC</span>
                <input inputMode="decimal" value={fixedChargeAmount} onChange={(e) => setFixedChargeAmount(e.target.value)} placeholder="Ex : 34,20" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Consommation facturée fournisseur</span>
                <input inputMode="decimal" value={billedConsumption} onChange={(e) => setBilledConsumption(e.target.value)} placeholder="Optionnel, ex : 133" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Facture générale</span>
                <span className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  <DocumentArrowUpIcon className="h-5 w-5" />
                  {invoiceFile ? invoiceFile.name : "Ajouter PDF ou image"}
                  <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
                </span>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Début période</span>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-slate-600">Fin période</span>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="mt-3 block space-y-1">
              <span className="text-xs font-semibold text-slate-600">Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={goToPreviousStep} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Retour configuration
              </button>
              <button type="button" onClick={goToNextStep} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Continuer vers les relevés
              </button>
            </div>
          </section>
          ) : null}

          {waterStep === "readings" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Compteurs individuels</p>
                <p className="mt-1 text-xs text-slate-500">
                  {allocationMethod === "principal_residual"
                    ? "Saisissez les sous-compteurs des logements secondaires. Le logement principal sera calculé par différence."
                    : "Incluez tous les compteurs raccordés au général. La somme doit égaler la consommation globale, avec ou sans logement principal."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLines((prev) => [...prev, newDraftLine(prev.length + 1)])}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  Ajouter une ligne
                </button>
              </div>
            </div>

            {allocationMethod === "principal_residual" ? (
              <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-violet-950">{principalUnitLabel.trim() || DEFAULT_PRINCIPAL_UNIT_LABEL} calculé automatiquement</p>
                    <p className="mt-1 text-xs leading-5 text-violet-800">
                      Consommation = compteur général - somme des sous-compteurs saisis. Cette ligne sera ajoutée à la répartition et
                      facturée au prorata comme les autres.
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-2 text-right ring-1 ring-violet-100">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-violet-700">À répartir</p>
                    <p className={"mt-1 text-lg font-semibold " + (principalResidualConsumption > 0 ? "text-violet-950" : "text-red-700")}>
                      {principalResidualConsumption.toLocaleString("fr-FR")} m³
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4">
              {lines.map((line, index) => {
                const computed = computedLines.find((item) => item.id === line.id);
                const latestReading = latestReadingForLine(line);
                const disabledStyle = line.enabled ? "" : " opacity-60";
                return (
                  <div key={line.id} className={"rounded-2xl border border-slate-200 bg-slate-50 p-4" + disabledStyle}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={line.enabled}
                          onChange={(e) => updateLine(line.id, { enabled: e.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                          aria-label={`Inclure ${line.unitLabel || `lot ${index + 1}`}`}
                        />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Compteur {index + 1}</p>
                          <p className="mt-1 text-base font-semibold text-slate-950">{line.unitLabel || `Lot ${index + 1}`}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
                        <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-slate-500">Conso</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">{(computed?.consumption || 0).toLocaleString("fr-FR")} m³</p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-slate-500">Part conso</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">{formatEuro(computed?.variableAmountDue || 0)}</p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-slate-500">Part fixe</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">{formatEuro(computed?.fixedAmountDue || 0)}</p>
                        </div>
                        <div className="rounded-xl bg-cyan-50 px-3 py-2 ring-1 ring-cyan-100">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-cyan-700">À payer</p>
                          <p className="mt-1 text-sm font-semibold text-cyan-950">{formatEuro(computed?.amountDue || 0)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr),minmax(0,1.1fr),minmax(0,1.1fr)]">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-600">Lot / compteur</span>
                        <input value={line.unitLabel} onChange={(e) => updateLine(line.id, { unitLabel: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-600">Occupant à facturer</span>
                        <input value={line.occupantLabel} onChange={(e) => updateLine(line.id, { occupantLabel: e.target.value })} placeholder="Nom de l’occupant" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-600">Email partage</span>
                        <input type="email" value={line.occupantEmail} onChange={(e) => updateLine(line.id, { occupantEmail: e.target.value })} placeholder="email@exemple.fr" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[160px,160px,minmax(0,1fr),auto]">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-600">Ancien relevé</span>
                        <input inputMode="decimal" value={line.previous} onChange={(e) => updateLine(line.id, { previous: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                        {latestReading ? (
                          <button
                            type="button"
                            onClick={() => updateLine(line.id, { previous: String(latestReading.value).replace(".", ",") })}
                            className="inline-flex text-left text-xs font-semibold text-cyan-700 hover:underline"
                          >
                            Reprendre {latestReading.value.toLocaleString("fr-FR")} m³ du {latestReading.periodEnd}
                          </button>
                        ) : null}
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-600">Nouveau relevé</span>
                        <input inputMode="decimal" value={line.current} onChange={(e) => updateLine(line.id, { current: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-slate-600">Note</span>
                        <input value={line.notes} onChange={(e) => updateLine(line.id, { notes: e.target.value })} placeholder="Commentaire, précision compteur..." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                      </label>
                      <div className="space-y-1">
                        <span className="block text-xs font-semibold text-slate-600">Photo compteur</span>
                        <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          <CameraIcon className="h-4 w-4" />
                          {line.photo ? "Remplacer" : "Ajouter"}
                          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => updateLine(line.id, { photo: e.target.files?.[0] || null })} />
                        </label>
                        {line.photo ? <p className="max-w-[220px] truncate text-xs text-slate-500">{line.photo.name}</p> : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        Part de consommation :{" "}
                        <span className="font-semibold text-slate-800">{(computed?.sharePercent || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%</span>
                      </span>
                      {lines.length > 1 ? (
                        <button type="button" onClick={() => setLines((prev) => prev.filter((item) => item.id !== line.id))} className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline">
                          <TrashIcon className="h-4 w-4" />
                          Supprimer cette ligne
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={goToPreviousStep} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Retour facture
              </button>
              <button type="button" onClick={goToNextStep} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Contrôler la répartition
              </button>
            </div>
          </section>
          ) : null}

          {waterStep === "review" ? (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className={"h-1.5 " + (consumptionMatchesGlobal ? "bg-gradient-to-r from-emerald-500 to-cyan-500" : "bg-gradient-to-r from-red-500 to-amber-400")} />
            <div className="p-5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Contrôle final</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">Vérifier avant d’enregistrer</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Cette étape confirme que la consommation répartie retombe bien sur le compteur général et que le total à refacturer est cohérent.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Compteur général</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{globalConsumption.toLocaleString("fr-FR")} m³</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Consommation répartie</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{allocatedConsumption.toLocaleString("fr-FR")} m³</p>
                </div>
                <div className={"rounded-2xl border p-4 " + (consumptionMatchesGlobal ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Écart</p>
                  <p className={"mt-2 text-2xl font-semibold " + (consumptionMatchesGlobal ? "text-emerald-800" : "text-red-700")}>{consumptionDelta.toLocaleString("fr-FR")} m³</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total facture</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{formatEuro(invoiceTotal)}</p>
                </div>
              </div>

              {allocationMethod === "principal_residual" ? (
                <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
                  Le logement principal sera ajouté automatiquement avec une consommation de{" "}
                  <span className="font-semibold">{principalResidualConsumption.toLocaleString("fr-FR")} m³</span>.
                </div>
              ) : null}

              <div className="mt-5 overflow-auto rounded-2xl border border-slate-200">
                <table className="min-w-[760px] w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Lot</th>
                      <th className="px-3 py-2">Occupant</th>
                      <th className="px-3 py-2">Conso</th>
                      <th className="px-3 py-2">Part conso</th>
                      <th className="px-3 py-2">Part fixe</th>
                      <th className="px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedLines.map((line) => (
                      <tr key={line.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-900">{line.unitLabel}</td>
                        <td className="px-3 py-2 text-slate-600">{line.occupantLabel || "—"}</td>
                        <td className="px-3 py-2 text-slate-900">{line.consumption.toLocaleString("fr-FR")} m³</td>
                        <td className="px-3 py-2 text-slate-900">{formatEuro(line.variableAmountDue)}</td>
                        <td className="px-3 py-2 text-slate-900">{formatEuro(line.fixedAmountDue)}</td>
                        <td className="px-3 py-2 font-semibold text-slate-950">{formatEuro(line.amountDue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <UploadProgressBar progress={uploadProgress} className="mt-4" />
              <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={goToPreviousStep} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                  Retour aux relevés
                </button>
                <button
                  type="button"
                  onClick={saveAllocation}
                  disabled={saving || !consumptionMatchesGlobal}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CalculatorIcon className="h-4 w-4" />}
                  Enregistrer la facture
                </button>
              </div>
            </div>
          </section>
          ) : null}
      </div>
    </section>
  );
}
