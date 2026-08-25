import React, { useEffect, useMemo, useState } from "react";
import { DELEGATED_SERVICES } from "../../../lib/landlord/delegatedServices";
import {
  UserCircleIcon,
  HomeModernIcon,
  UsersIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  HomeIcon,
  TruckIcon,
  MapPinIcon,
  LightBulbIcon,
  DocumentCheckIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import CalculatorWizardShell from "../../calculators/CalculatorWizardShell";
import AddressAutocomplete from "../../forms/AddressAutocomplete";
import { LeaseContractOnboarding } from "./LeaseContractOnboarding";
import { supabase } from "../../../lib/supabaseClient";
import type { Lease, Property, PropertyFinance, Tenant } from "../../../lib/landlord/types";
import type { Profile } from "../../../hooks/useProfile";
import { computeOnboardingStatus } from "../../../lib/landlord/onboardingStatus";
import { usePermissions } from "../../PermissionProvider";

/* ======================================================
   TYPES & PROPS
====================================================== */

type Props = {
  userId: string;
  userEmail?: string | null;
  profile: Profile | null;
  profileLoaded: boolean;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  properties: Property[];
  tenants: Tenant[];
  tenantById: Map<string, Tenant>;
  activeLeases: Lease[];
  propertyFinance: PropertyFinance[];
  onRefresh: () => Promise<void>;
  onComplete: () => void;
};

type StepKey = "profil" | "biens" | "locataires" | "baux";

const STEP_DEFS: Array<{ key: StepKey; label: string; icon: typeof UserCircleIcon }> = [
  { key: "profil", label: "Bailleur", icon: UserCircleIcon },
  { key: "biens", label: "Bien", icon: HomeModernIcon },
  { key: "locataires", label: "Locataire", icon: UsersIcon },
  { key: "baux", label: "Location", icon: DocumentTextIcon },
];

const WIZARD_STEP_HELP: Record<StepKey, { title: string; items: string[] }> = {
  profil: {
    title: "Pourquoi ces informations ?",
    items: [
      "Votre nom et votre adresse apparaissent sur les quittances, baux et états des lieux générés par lokt.fr.",
      "Si vous gérez vos biens via une société (SCI, SARL...), sa raison sociale peut aussi apparaître sur ces documents.",
    ],
  },
  biens: {
    title: "Pourquoi créer un bien ?",
    items: [
      "La fiche du bien sert de base à tout le reste : loyers, quittances, performance, déclarations fiscales.",
      "Vous pourrez compléter DPE et description plus tard depuis Logements.",
    ],
  },
  locataires: {
    title: "Pourquoi créer un locataire ?",
    items: [
      "Le dossier locataire permet d'envoyer automatiquement les quittances et les relances de loyer.",
      "L'email n'est pas obligatoire mais vous en aurez besoin pour activer l'envoi automatique plus tard.",
    ],
  },
  baux: {
    title: "Pourquoi créer une location ?",
    items: [
      "La location relie le bien, le locataire et le loyer — c'est elle qui déclenche le suivi des paiements et les quittances.",
      "Le dépôt de garantie et les options avancées (relances, IRL...) pourront être ajoutés ensuite depuis Locations.",
    ],
  },
};

const PROPERTY_TYPE_OPTIONS: Array<{ value: string; label: string; icon: typeof HomeIcon }> = [
  { value: "apartment", label: "Appartement", icon: BuildingOffice2Icon },
  { value: "house", label: "Maison", icon: HomeIcon },
  { value: "building", label: "Immeuble (plusieurs lots)", icon: HomeModernIcon },
  { value: "garage", label: "Garage", icon: TruckIcon },
  { value: "parking", label: "Parking", icon: MapPinIcon },
];

const LEASE_KIND_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: "furnished_primary", label: "Meublé — résidence principale", hint: "Cas le plus courant, bail d'un an reconduit tacitement." },
  { value: "empty_primary", label: "Nu — résidence principale", hint: "Bail non meublé, durée minimale de 3 ans." },
  { value: "other", label: "Autre / je préciserai plus tard", hint: "Modifiable à tout moment depuis Locations." },
];

const DPE_OPTIONS = ["", "A", "B", "C", "D", "E", "F", "G"] as const;

// Un lot d'immeuble est traité comme un bien à part entière : mêmes
// caractéristiques qu'un appartement classique (surface, pièces, DPE, GES,
// description), sauf l'adresse qui est héritée de l'immeuble.
type OnboardingLotDraft = {
  id: string; // id réel une fois créé en base, sinon id temporaire "pending-N"
  label: string;
  surface_m2: string;
  rooms: string;
  energy_class: string;
  ghg_class: string;
  energy_value: string;
  description: string;
};
const EMPTY_LOT_DRAFT: Omit<OnboardingLotDraft, "id"> = {
  label: "",
  surface_m2: "",
  rooms: "",
  energy_class: "",
  ghg_class: "",
  energy_value: "",
  description: "",
};

function toNumOrNull(v: string): number | null {
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* ======================================================
   HELPERS
====================================================== */

// Plafond légal du dépôt de garantie selon le type de bail (même règle que
// dans le générateur de contrat).
function depositCapForKind(kind: string, rent: number): number | null {
  if (kind === "mobility") return 0;
  if (kind === "furnished_primary") return rent * 2;
  if (kind === "empty_primary") return rent;
  return null;
}

// Durée par défaut d'1 an à partir de la date de prise d'effet.
function defaultEndDate(startDate?: string): string {
  const base = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  const end = new Date(base);
  end.setFullYear(end.getFullYear() + 1);
  return end.toISOString().slice(0, 10);
}

async function authJsonHeaders() {
  if (!supabase) throw new Error("Supabase non initialisé.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function buildFullName(first?: string | null, last?: string | null) {
  return [first?.trim(), last?.trim()].filter(Boolean).join(" ");
}

type SiretCheckResult = { tone: "ok" | "warn" | "error"; message: string; companyName?: string };
async function checkSiret(siret: string): Promise<SiretCheckResult> {
  const clean = String(siret || "").replace(/\s+/g, "");
  if (!/^\d{14}$/.test(clean)) return { tone: "error", message: "Le SIRET doit contenir 14 chiffres." };
  try {
    const headers = await authJsonHeaders();
    const res = await fetch(`/api/company/lookup-siret?siret=${clean}`, { headers });
    const data = await res.json();
    if (!data.ok) return { tone: "warn", message: data.error || "Vérification indisponible pour le moment." };
    if (!data.found) return { tone: "warn", message: "SIRET introuvable — vérifiez la saisie." };
    if (!data.establishmentActive) return { tone: "error", message: `Établissement fermé (${data.companyName || "société"}).` };
    if (!data.companyActive) return { tone: "error", message: `Société radiée (${data.companyName || "société"}).` };
    return { tone: "ok", message: `${data.companyName} — SIRET vérifié, société active.`, companyName: data.companyName };
  } catch {
    return { tone: "warn", message: "Vérification indisponible pour le moment." };
  }
}
function siretCheckClass(tone: SiretCheckResult["tone"]) {
  return tone === "ok"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "warn"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-red-200 bg-red-50 text-red-700";
}

function isEmailLike(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/* ======================================================
   SMALL UI PIECES
====================================================== */

function StepShell({
  title,
  desc,
  children,
  footer,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        {desc ? <p className="mt-1 text-sm text-slate-600">{desc}</p> : null}
      </div>
      <div className="flex-1 space-y-4">{children}</div>
      <div className="sticky bottom-0 mt-6 flex items-center justify-between border-t border-slate-100 bg-white pb-1 pt-4">{footer}</div>
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-block align-middle">
      <button
        type="button"
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-300 text-[0.62rem] font-bold leading-none text-slate-500 hover:border-slate-400 hover:text-slate-700"
        aria-label="Aide"
      >
        i
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 text-[0.7rem] font-normal normal-case leading-4 text-slate-600 opacity-0 shadow-lg transition-opacity duration-100 group-hover/tip:opacity-100">
        {text}
      </span>
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  hint,
  infoTip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  hint?: string;
  infoTip?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
        {infoTip ? <InfoTip text={infoTip} /> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      />
      {hint ? <span className="block text-[0.68rem] leading-4 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#635bff]/30 ${
        checked ? "border-transparent bg-gradient-to-r from-[#635bff] to-[#00d4ff]" : "border-slate-300 bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200 ${
          checked ? "left-[1.35rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function ChoiceCard({
  label,
  hint,
  icon: Icon,
  selected,
  onClick,
  dense,
  disabled,
}: {
  label: string;
  hint?: string;
  icon?: typeof HomeIcon;
  selected: boolean;
  onClick: () => void;
  dense?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Disponible à partir d'un abonnement payant" : undefined}
      className={
        "flex min-h-[84px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border p-2.5 text-center transition " +
        (disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-60"
          : selected
          ? "border-[#635bff] bg-indigo-50 text-indigo-950 ring-2 ring-indigo-100"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")
      }
    >
      {Icon ? <Icon className={"h-6 w-6 " + (disabled ? "text-slate-300" : selected ? "text-[#635bff]" : "text-slate-400")} aria-hidden="true" /> : null}
      <span className={dense ? "text-xs font-semibold leading-4 break-words" : "text-sm font-semibold leading-4 break-words"}>{label}</span>
      {hint ? <span className={"text-[0.68rem] leading-4 " + (disabled ? "font-semibold text-amber-600" : "text-slate-500")}>{hint}</span> : null}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-gradient-to-r from-[#635bff] to-[#00d4ff] px-6 text-sm font-semibold text-white shadow-md shadow-indigo-100 transition-all hover:shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
    >
      {children}
    </button>
  );
}

function HelpPanel({ step }: { step: StepKey }) {
  const help = WIZARD_STEP_HELP[step];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-slate-900">
        <LightBulbIcon className="h-5 w-5 text-amber-500" aria-hidden="true" />
        <p className="text-sm font-semibold">On vous informe</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-slate-900">{help.title}</p>
        <ul className="mt-2 space-y-2">
          {help.items.map((item, i) => (
            <li key={i} className="text-xs leading-5 text-slate-600">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ======================================================
   MAIN COMPONENT
====================================================== */

export function OnboardingWizard({
  userId,
  userEmail,
  profile,
  profileLoaded,
  saveProfile,
  properties,
  tenants,
  tenantById,
  activeLeases,
  propertyFinance,
  onRefresh,
  onComplete,
}: Props) {
  const status = useMemo(
    () => computeOnboardingStatus({ properties, tenantById, activeLeases, propertyFinance, profile, profileLoaded }),
    [properties, tenantById, activeLeases, propertyFinance, profile, profileLoaded]
  );

  const { maxActiveProperties } = usePermissions();
  // "Immeuble" n'a de sens que si le plan autorise plus d'un logement actif — sinon
  // un compte gratuit pourrait créer un seul bien avec des lots illimités et
  // contourner la limite (même garde-fou que dans la section Biens complète).
  // Affiché grisé plutôt que masqué, pour rester découvrable.
  const buildingTypeLocked = maxActiveProperties <= 1;

  const initialIndex = useMemo(() => {
    const idx = STEP_DEFS.findIndex((s) => s.key === status.next?.key);
    return idx >= 0 ? idx : 0;
  }, [status.next]);

  const [stepIndex, setStepIndex] = useState(initialIndex);
  const [err, setErr] = useState<string | null>(null);
  const [errIsPlanLimit, setErrIsPlanLimit] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bailleur
  const [civility, setCivility] = useState(profile?.civility || "M.");
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [companyName, setCompanyName] = useState(profile?.company_name || "");
  const [addressLine1, setAddressLine1] = useState(profile?.address_line1 || "");
  const [postalCode, setPostalCode] = useState(profile?.postal_code || "");
  const [city, setCity] = useState(profile?.city || "");

  // Bien
  const [propertyLabel, setPropertyLabel] = useState("");
  const [propertyType, setPropertyType] = useState("apartment");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyPostalCode, setPropertyPostalCode] = useState("");
  const [propertyCity, setPropertyCity] = useState("");
  const [propertySurface, setPropertySurface] = useState("");
  const [propertyRooms, setPropertyRooms] = useState("");
  const [delegatedServices, setDelegatedServices] = useState<string[]>([]);
  const [delegationAgencyName, setDelegationAgencyName] = useState("");
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  // Immeuble : un ou plusieurs lots, chacun avec ses propres caractéristiques —
  // gérés en mémoire tant que l'immeuble n'est pas créé, insérés/mis à jour en
  // base au clic sur "Continuer" (cf. submitBien).
  const [lots, setLots] = useState<OnboardingLotDraft[]>([{ id: "pending-0", ...EMPTY_LOT_DRAFT, label: "Lot 1" }]);
  const [expandedLotRowId, setExpandedLotRowId] = useState<string | null>(null);
  const [selectedLeaseLotId, setSelectedLeaseLotId] = useState<string | null>(null);

  // Locataire
  const [tenantIsCompany, setTenantIsCompany] = useState(false);
  const [tenantCompanyName, setTenantCompanyName] = useState("");
  const [tenantSiret, setTenantSiret] = useState("");
  const [tenantSiretCheck, setTenantSiretCheck] = useState<SiretCheckResult | null>(null);
  const [tenantSiretChecking, setTenantSiretChecking] = useState(false);
  const [tenantLegalRepName, setTenantLegalRepName] = useState("");
  const [tenantFirstName, setTenantFirstName] = useState("");
  const [tenantLastName, setTenantLastName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);

  // Location
  const [leaseChoice, setLeaseChoice] = useState<"existing" | "new" | null>(null);
  const [leaseKind, setLeaseKind] = useState("furnished_primary");
  const [rentAmount, setRentAmount] = useState("");
  const [chargesAmount, setChargesAmount] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => defaultEndDate());
  const [depositAmount, setDepositAmount] = useState("");
  const [createdLeaseId, setCreatedLeaseId] = useState<string | null>(null);
  const [reviewingLease, setReviewingLease] = useState(false);
  const [leaseReloadNonce, setLeaseReloadNonce] = useState(0);

  const activeStepKey = STEP_DEFS[stepIndex]?.key || "profil";

  // Le contenu ne se recharge pas en page complète entre les étapes (SPA) : sans
  // ça, la position de scroll de l'étape précédente reste, et le titre/les premiers
  // champs de l'étape suivante peuvent se retrouver masqués derrière l'en-tête.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeStepKey, leaseChoice, createdLeaseId, reviewingLease]);

  const targetPropertyId = createdPropertyId || properties[0]?.id || null;
  const targetTenantId = createdTenantId || tenants[0]?.id || null;
  const targetTenant = tenants.find((t) => t.id === targetTenantId) || null;
  const targetTenantIsCompany = targetTenant ? !!targetTenant.is_company : tenantIsCompany;
  const targetProperty = properties.find((p) => p.id === targetPropertyId) || null;
  // Source de vérité = le bien réellement enregistré, pas le state local `propertyType`
  // (resterait sur sa valeur par défaut si le bien existait déjà avant cette session
  // de l'assistant, par ex. repris en cours de route).
  const targetPropertyIsBuilding = (targetProperty as any)?.type === "building";
  // Lots réellement enregistrés en base (id temporaire "pending-" = pas encore créé) —
  // c'est parmi eux que l'étape Location choisit celui qui reçoit le bail.
  const createdLots = useMemo(() => lots.filter((l) => !l.id.startsWith("pending-")), [lots]);

  useEffect(() => {
    if (targetPropertyIsBuilding && createdLots.length === 1 && !selectedLeaseLotId) {
      setSelectedLeaseLotId(createdLots[0].id);
    }
  }, [targetPropertyIsBuilding, createdLots, selectedLeaseLotId]);

  const goToStep = (index: number) => {
    if (index < 0 || index >= STEP_DEFS.length) return;
    // On ne permet pas de sauter en avant au-delà de la 1ère étape incomplète.
    if (index > stepIndex + 1) return;
    setErr(null);
    setErrIsPlanLimit(false);
    setStepIndex(index);
  };

  const next = () => goToStep(stepIndex + 1);

  /* -------------------- Étape 1 : Bailleur -------------------- */
  const submitProfil = async () => {
    if (!firstName.trim() || !lastName.trim()) return setErr("Prénom et nom sont obligatoires.");
    if (!addressLine1.trim() || !postalCode.trim() || !city.trim()) return setErr("L'adresse complète est obligatoire.");
    setSaving(true);
    setErr(null);
    setErrIsPlanLimit(false);
    try {
      await saveProfile({
        civility,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        company_name: companyName.trim() || null,
        address_line1: addressLine1.trim(),
        postal_code: postalCode.trim(),
        city: city.trim(),
      });
      next();
    } catch (e: any) {
      setErr(e?.message || "Impossible d'enregistrer le profil.");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------- Étape 2 : Bien -------------------- */
  const submitBien = async () => {
    if (!propertyLabel.trim() || !propertyAddress.trim()) return setErr("Nom du bien et adresse sont obligatoires.");
    if (propertyType === "building" && !lots.some((l) => l.label.trim())) {
      return setErr("Au moins un lot doit avoir un nom.");
    }
    if (!supabase) return setErr("Supabase non initialisé.");
    setSaving(true);
    setErr(null);
    setErrIsPlanLimit(false);
    try {
      const isBuilding = propertyType === "building";
      const payload = {
        user_id: userId,
        type: propertyType,
        label: propertyLabel.trim(),
        address_line1: propertyAddress.trim(),
        postal_code: propertyPostalCode.trim() || null,
        city: propertyCity.trim() || null,
        // Un immeuble n'a pas de surface/pièces uniques représentatives de tous ses
        // logements — ces caractéristiques se saisissent par lot ci-dessous.
        surface_m2: isBuilding ? null : propertySurface.trim() ? Number(propertySurface.trim().replace(",", ".")) || null : null,
        rooms: isBuilding ? null : propertyRooms.trim() ? Number(propertyRooms.trim()) || null : null,
        delegated_services: delegatedServices,
        delegation_agency_name: delegationAgencyName.trim() || null,
        status: "active",
      };

      let propertyId = createdPropertyId;
      if (createdPropertyId) {
        // Retour en arrière depuis une étape suivante : on met à jour le bien déjà
        // créé plutôt que d'en insérer un second à chaque nouveau passage sur cette étape.
        const { error } = await supabase.from("properties").update(payload).eq("id", createdPropertyId).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
        if (error) throw error;
        propertyId = data?.id || null;
        setCreatedPropertyId(propertyId);
      }

      // Un immeuble a besoin d'au moins un lot pour que la location puisse s'y
      // rattacher — les lots sont traités comme des biens à part entière, avec
      // leurs propres caractéristiques (mêmes champs qu'un appartement classique).
      if (isBuilding && propertyId) {
        const namedLots = lots.filter((l) => l.label.trim());
        const toInsert = namedLots.filter((l) => l.id.startsWith("pending-"));
        const toUpdate = namedLots.filter((l) => !l.id.startsWith("pending-"));

        const lotPatch = (l: OnboardingLotDraft) => ({
          label: l.label.trim(),
          surface_m2: l.surface_m2 ? toNumOrNull(l.surface_m2) : null,
          rooms: l.rooms ? Math.round(toNumOrNull(l.rooms) ?? 0) : null,
          energy_class: l.energy_class || null,
          ghg_class: l.ghg_class || null,
          energy_value: l.energy_value ? toNumOrNull(l.energy_value) : null,
          description: l.description.trim() || null,
        });

        for (const l of toUpdate) {
          const { error } = await supabase.from("property_lots").update(lotPatch(l)).eq("id", l.id).eq("user_id", userId);
          if (error) throw error;
        }

        let newIds: string[] = [];
        if (toInsert.length > 0) {
          const { data, error } = await supabase
            .from("property_lots")
            .insert(
              toInsert.map((l, index) => ({
                property_id: propertyId,
                user_id: userId,
                ...lotPatch(l),
                sort_order: toUpdate.length + index,
              }))
            )
            .select("id");
          if (error) throw error;
          newIds = (data || []).map((row: any) => row.id as string);
        }
        // Remplace les id temporaires par les vrais id renvoyés (même ordre que
        // `toInsert`) et retire les lignes vides jamais nommées.
        setLots((prev) => {
          let cursor = 0;
          return prev
            .filter((l) => l.label.trim())
            .map((l) => (l.id.startsWith("pending-") ? { ...l, id: newIds[cursor++] || l.id } : l));
        });
      }

      await onRefresh();
      next();
    } catch (e: any) {
      setErr(e?.message || "Impossible de créer le bien.");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------- Étape 3 : Locataire -------------------- */
  const submitLocataire = async () => {
    if (tenantIsCompany) {
      if (!tenantCompanyName.trim()) return setErr("La raison sociale du locataire est obligatoire.");
    } else if (!tenantFirstName.trim() || !tenantLastName.trim()) {
      return setErr("Prénom et nom du locataire sont obligatoires.");
    }
    if (tenantEmail.trim() && !isEmailLike(tenantEmail)) return setErr("Email locataire invalide.");
    if (!supabase) return setErr("Supabase non initialisé.");
    setSaving(true);
    setErr(null);
    setErrIsPlanLimit(false);
    try {
      const payload = {
        user_id: userId,
        first_name: tenantIsCompany ? null : tenantFirstName.trim(),
        last_name: tenantIsCompany ? null : tenantLastName.trim(),
        full_name: tenantIsCompany ? tenantCompanyName.trim() || "Locataire professionnel" : buildFullName(tenantFirstName, tenantLastName) || "Locataire",
        email: tenantEmail.trim() || null,
        phone: tenantPhone.trim() || null,
        is_company: tenantIsCompany,
        company_name: tenantIsCompany ? tenantCompanyName.trim() || null : null,
        siret: tenantIsCompany ? tenantSiret.trim() || null : null,
        legal_representative_name: tenantIsCompany ? tenantLegalRepName.trim() || null : null,
      };

      if (createdTenantId) {
        // Retour en arrière depuis une étape suivante : on met à jour le locataire déjà
        // créé plutôt que d'en insérer un second à chaque nouveau passage sur cette étape.
        const { error } = await supabase.from("tenants").update(payload).eq("id", createdTenantId).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("tenants").insert(payload).select("id").single();
        if (error) throw error;
        setCreatedTenantId(data?.id || null);
      }
      await onRefresh();
      next();
    } catch (e: any) {
      setErr(e?.message || "Impossible de créer le locataire.");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------- Étape 4 : Location (bail) -------------------- */
  const submitBail = async () => {
    if (!leaseChoice) return setErr("Merci d'indiquer si le bail existe déjà.");
    if (!targetPropertyId || !targetTenantId) return setErr("Bien et locataire introuvables — revenez aux étapes précédentes.");
    if (targetPropertyIsBuilding && !selectedLeaseLotId) {
      return setErr("Choisissez le lot loué dans cet immeuble.");
    }
    const rent = Number(String(rentAmount).replace(",", "."));
    if (!Number.isFinite(rent) || rent <= 0) return setErr("Le loyer doit être supérieur à 0 €.");
    const charges = chargesAmount ? Number(String(chargesAmount).replace(",", ".")) : 0;
    if (!Number.isFinite(charges) || charges < 0) return setErr("Les charges ne peuvent pas être négatives.");
    const deposit = depositAmount ? Number(String(depositAmount).replace(",", ".")) : 0;
    if (!Number.isFinite(deposit) || deposit < 0) return setErr("Le dépôt de garantie ne peut pas être négatif.");
    if (deposit > 0) {
      const cap = depositCapForKind(leaseKind, rent);
      if (cap != null && deposit > cap) {
        return setErr(
          leaseKind === "empty_primary"
            ? `Le dépôt de garantie en location nue est plafonné à 1 mois de loyer hors charges, soit ${cap.toLocaleString("fr-FR")} €.`
            : `Le dépôt de garantie en meublé est plafonné à 2 mois de loyer hors charges, soit ${cap.toLocaleString("fr-FR")} €.`
        );
      }
    }
    setSaving(true);
    setErr(null);
    setErrIsPlanLimit(false);
    try {
      const leasePayload = {
        property_id: targetPropertyId,
        lot_id: targetPropertyIsBuilding ? selectedLeaseLotId : null,
        tenant_id: targetTenantId,
        start_date: startDate,
        end_date: endDate || null,
        rent_amount: rent,
        charges_amount: charges,
        deposit_amount: depositAmount ? Number(String(depositAmount).replace(",", ".")) || 0 : 0,
        lease_kind: leaseKind,
        payment_day: 1,
        status: "active",
      };

      if (createdLeaseId) {
        // Retour en arrière depuis le générateur de contrat : on met à jour le bail déjà
        // créé plutôt que d'en insérer un second (et sans repasser par l'API, qui recompte
        // les locations actives — il ne s'agit pas d'une nouvelle location).
        if (!supabase) throw new Error("Supabase non initialisé.");
        let { error } = await supabase.from("leases").update(leasePayload).eq("id", createdLeaseId).eq("user_id", userId);
        if (error && /auto_renewal_enabled|lease_kind/i.test(error.message || "")) {
          const { lease_kind, ...withoutKind } = leasePayload;
          ({ error } = await supabase.from("leases").update(withoutKind).eq("id", createdLeaseId).eq("user_id", userId));
        }
        if (error) throw error;
        await onRefresh();
        if (leaseChoice === "new") {
          // On revient réviser le contrat avec les valeurs à jour.
          setLeaseReloadNonce((n) => n + 1);
          setReviewingLease(false);
        } else {
          // Entre-temps, l'utilisateur a changé d'avis pour "le bail existe déjà" :
          // le bail est à jour, inutile de rouvrir le générateur de contrat.
          onComplete();
        }
        return;
      }

      const headers = await authJsonHeaders();
      const res = await fetch("/api/landlord/leases", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, payload: leasePayload }),
      });
      const raw = await res.text();
      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      if (!res.ok) {
        if (json?.code === "plan_limit") setErrIsPlanLimit(true);
        throw new Error(json?.error || raw || `Erreur serveur ${res.status}.`);
      }
      await onRefresh();
      if (leaseChoice === "new" && json?.id) {
        // Le bail n'existe pas encore : on ouvre le générateur de contrat par-dessus
        // pour compléter les infos légales — il se charge lui-même de fermer l'assistant.
        setCreatedLeaseId(json.id);
      } else {
        onComplete();
      }
    } catch (e: any) {
      setErr(e?.message || "Impossible de créer la location.");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------- Lots (étape Bien, immeuble) -------------------- */
  const addLotRow = () => {
    setLots((prev) => [...prev, { id: `pending-${Date.now()}-${prev.length}`, ...EMPTY_LOT_DRAFT }]);
  };
  const updateLotRow = (id: string, patch: Partial<OnboardingLotDraft>) => {
    setLots((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };
  const removeLotRow = (id: string) => {
    setLots((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
    if (expandedLotRowId === id) setExpandedLotRowId(null);
    if (selectedLeaseLotId === id) setSelectedLeaseLotId(null);
  };

  /* ======================================================
     RENDER
  ====================================================== */

  const wizardSteps = STEP_DEFS.map((s) => ({ label: s.label, icon: s.icon }));

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bienvenue sur lokt.fr</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Configurons votre parc immobilier</h1>
          <p className="mt-1 text-sm text-slate-600">4 étapes, environ 3 minutes — vous pourrez tout compléter plus tard.</p>
        </div>

        <CalculatorWizardShell
          steps={wizardSteps}
          currentIndex={stepIndex}
          onStepClick={goToStep}
          canAccessStep={(index) => index <= stepIndex + 1}
          title="Votre mise en route en quelques étapes."
          helpPanel={<HelpPanel step={activeStepKey} />}
        >
          {err ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
              {errIsPlanLimit ? (
                <>
                  {" "}
                  <a href="/tarifs" className="font-semibold underline underline-offset-2 hover:text-red-800">
                    Voir les offres →
                  </a>
                </>
              ) : null}
            </div>
          ) : null}

          {activeStepKey === "profil" ? (
            <StepShell
              title="Qui êtes-vous ?"
              desc="Ces informations apparaîtront sur vos documents (quittances, baux, états des lieux)."
              footer={<PrimaryButton onClick={submitProfil} disabled={saving}>{saving ? "Enregistrement…" : "Continuer"}</PrimaryButton>}
            >
              <div className="flex gap-2">
                {["M.", "Mme", "Mx"].map((c) => (
                  <ChoiceCard key={c} label={c} selected={civility === c} onClick={() => setCivility(c)} />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Prénom" value={firstName} onChange={setFirstName} required />
                <TextField label="Nom" value={lastName} onChange={setLastName} required />
              </div>
              <TextField
                label="Raison sociale / SCI"
                value={companyName}
                onChange={setCompanyName}
                placeholder="SCI des Lilas"
                hint="Optionnel — si vous gérez vos biens via une société, le nom apparaîtra sur les documents."
              />
              <AddressAutocomplete
                id="wizard_profil_address1"
                label="Adresse *"
                addressLine1={addressLine1}
                postalCode={postalCode}
                city={city}
                onAddressLine1Change={setAddressLine1}
                onPostalCodeChange={setPostalCode}
                onCityChange={setCity}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </StepShell>
          ) : null}

          {activeStepKey === "biens" ? (
            <StepShell
              title="Votre premier bien"
              desc="Vous pourrez ajouter DPE et description plus tard."
              footer={<PrimaryButton onClick={submitBien} disabled={saving}>{saving ? "Enregistrement…" : "Continuer"}</PrimaryButton>}
            >
              <TextField label="Nom du bien" value={propertyLabel} onChange={setPropertyLabel} placeholder="Ex : Appartement rue Victor Hugo" required />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PROPERTY_TYPE_OPTIONS.map((opt) => (
                  <ChoiceCard
                    key={opt.value}
                    label={opt.label}
                    hint={opt.value === "building" && buildingTypeLocked ? "Payant" : undefined}
                    icon={opt.icon}
                    selected={propertyType === opt.value}
                    onClick={() => setPropertyType(opt.value)}
                    disabled={opt.value === "building" && buildingTypeLocked}
                    dense
                  />
                ))}
              </div>
              <AddressAutocomplete
                id="wizard_bien_address1"
                label="Adresse *"
                addressLine1={propertyAddress}
                postalCode={propertyPostalCode}
                city={propertyCity}
                onAddressLine1Change={setPropertyAddress}
                onPostalCodeChange={setPropertyPostalCode}
                onCityChange={setPropertyCity}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              {propertyType === "building" ? (
                <>
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                    Surface, pièces et DPE se renseignent par lot ci-dessous — un immeuble n'a pas une surface ou un DPE unique représentatif de tous ses logements.
                  </p>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">Lots de cet immeuble</p>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-800">
                        {lots.length} lot{lots.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Chaque lot est un logement à part entière — mêmes caractéristiques qu'un bien classique, sauf l'adresse (héritée de l'immeuble). Vous choisirez ensuite lequel reçoit la première location.
                    </p>
                    <div className="space-y-1.5">
                      {lots.map((lot) => {
                        const isExpanded = expandedLotRowId === lot.id;
                        return (
                          <div key={lot.id} className="rounded-xl border border-slate-200 bg-white">
                            <div className="flex flex-wrap items-center gap-2 p-2">
                              <input
                                className="min-w-[8rem] flex-1 rounded-lg border-none bg-transparent px-1 text-sm font-medium text-slate-900 focus:outline-none"
                                value={lot.label}
                                onChange={(e) => updateLotRow(lot.id, { label: e.target.value })}
                                placeholder="Ex : Lot 1, Appt 2B, Rez-de-chaussée…"
                              />
                              <input
                                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                                placeholder="m²"
                                inputMode="decimal"
                                value={lot.surface_m2}
                                onChange={(e) => updateLotRow(lot.id, { surface_m2: e.target.value })}
                              />
                              <input
                                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                                placeholder="pièces"
                                inputMode="numeric"
                                value={lot.rooms}
                                onChange={(e) => updateLotRow(lot.id, { rooms: e.target.value })}
                              />
                              <select
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                                value={lot.energy_class}
                                onChange={(e) => updateLotRow(lot.id, { energy_class: e.target.value })}
                              >
                                <option value="">DPE —</option>
                                {DPE_OPTIONS.filter((o) => o !== "").map((o) => (
                                  <option key={o} value={o}>DPE {o}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setExpandedLotRowId(isExpanded ? null : lot.id)}
                                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                                aria-label={isExpanded ? "Réduire" : "Plus de détails (GES, DPE)"}
                              >
                                <ChevronDownIcon className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                              </button>
                              {lots.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removeLotRow(lot.id)}
                                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  aria-label={`Retirer ${lot.label || "ce lot"}`}
                                >
                                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>
                            {isExpanded ? (
                              <div className="space-y-2 border-t border-slate-100 p-3">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <select
                                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                                    value={lot.ghg_class}
                                    onChange={(e) => updateLotRow(lot.id, { ghg_class: e.target.value })}
                                  >
                                    <option value="">GES —</option>
                                    {DPE_OPTIONS.filter((o) => o !== "").map((o) => (
                                      <option key={o} value={o}>GES {o}</option>
                                    ))}
                                  </select>
                                  <input
                                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                                    placeholder="kWh/m²/an"
                                    inputMode="decimal"
                                    value={lot.energy_value}
                                    onChange={(e) => updateLotRow(lot.id, { energy_value: e.target.value })}
                                  />
                                </div>
                                <textarea
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                                  rows={2}
                                  placeholder="Description (étage, balcon, etc.)"
                                  value={lot.description}
                                  onChange={(e) => updateLotRow(lot.id, { description: e.target.value })}
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={addLotRow}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 hover:border-[#635bff]/50 hover:bg-indigo-50/40 hover:text-[#635bff]"
                    >
                      <PlusIcon className="h-4 w-4" aria-hidden="true" />
                      Ajouter un lot
                    </button>
                  </div>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Surface (m²)" value={propertySurface} onChange={setPropertySurface} placeholder="Ex : 45" type="number" />
                  <TextField label="Nombre de pièces" value={propertyRooms} onChange={setPropertyRooms} placeholder="Ex : 2" type="number" />
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Comment ce bien est géré ?</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Cochez les services pris en charge par un tiers. lokt.fr désactivera les alertes correspondantes pour ce bien.
                  </p>
                </div>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Nom de l'agence ou du gestionnaire (optionnel)"
                  value={delegationAgencyName}
                  onChange={(e) => setDelegationAgencyName(e.target.value)}
                />
                <div className="space-y-2">
                  {DELEGATED_SERVICES.map((svc) => {
                    const checked = delegatedServices.includes(svc.key);
                    return (
                      <label
                        key={svc.key}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-[#635bff]/40 transition"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#635bff]"
                          checked={checked}
                          onChange={() =>
                            setDelegatedServices((prev) =>
                              checked ? prev.filter((k) => k !== svc.key) : [...prev, svc.key]
                            )
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
              </div>
            </StepShell>
          ) : null}

          {activeStepKey === "locataires" ? (
            <StepShell
              title="Votre premier locataire"
              desc="Le téléphone et l'email sont optionnels mais recommandés."
              footer={
                <>
                  <PrimaryButton onClick={submitLocataire} disabled={saving}>
                    {saving ? "Enregistrement…" : "Continuer"}
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={onComplete}
                    disabled={saving}
                    className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700 disabled:opacity-50"
                  >
                    Je n'ai pas encore de locataire
                  </button>
                </>
              }
            >
              <div className="mb-1 flex items-center gap-3">
                <Switch checked={tenantIsCompany} onChange={setTenantIsCompany} label="Locataire professionnel (personne morale)" />
                <span className="text-sm font-medium text-slate-700">Locataire professionnel (personne morale)</span>
              </div>

              {tenantIsCompany ? (
                <>
                  <TextField label="Raison sociale" value={tenantCompanyName} onChange={setTenantCompanyName} required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">SIRET</span>
                      <div className="flex gap-1.5">
                        <input
                          value={tenantSiret}
                          onChange={(e) => { setTenantSiretCheck(null); setTenantSiret(e.target.value); }}
                          placeholder="14 chiffres"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                        <button
                          type="button"
                          disabled={tenantSiretChecking || !tenantSiret.trim()}
                          onClick={async () => {
                            setTenantSiretChecking(true);
                            const result = await checkSiret(tenantSiret);
                            setTenantSiretCheck(result);
                            if (result.tone === "ok" && result.companyName && !tenantCompanyName.trim()) {
                              setTenantCompanyName(result.companyName);
                            }
                            setTenantSiretChecking(false);
                          }}
                          className="shrink-0 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
                        >
                          {tenantSiretChecking ? "…" : "Vérifier"}
                        </button>
                      </div>
                      {tenantSiretCheck ? (
                        <span className={`block rounded-lg border px-2 py-1.5 text-[0.7rem] leading-4 ${siretCheckClass(tenantSiretCheck.tone)}`}>
                          {tenantSiretCheck.message}
                        </span>
                      ) : null}
                    </label>
                    <TextField label="Représentant légal" value={tenantLegalRepName} onChange={setTenantLegalRepName} placeholder="Nom du signataire" />
                  </div>
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    Pour ce locataire, lokt.fr peut générer un bail professionnel à l'étape suivante, ou importer un bail
                    que vous avez rédigé par ailleurs. Le suivi de la location (loyers, quittances, échéances) reste
                    possible dans lokt.fr dans tous les cas.
                  </p>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Prénom" value={tenantFirstName} onChange={setTenantFirstName} required />
                  <TextField label="Nom" value={tenantLastName} onChange={setTenantLastName} required />
                </div>
              )}
              <TextField label="Email" value={tenantEmail} onChange={setTenantEmail} type="email" placeholder="locataire@email.fr" />
              <TextField label="Téléphone" value={tenantPhone} onChange={setTenantPhone} placeholder="06 12 34 56 78" />
            </StepShell>
          ) : null}

          {activeStepKey === "baux" && !leaseChoice ? (
            <StepShell title="Avez-vous déjà signé un bail avec ce locataire ?" footer={<span />}>
              <div className="flex min-h-[26rem] items-center justify-center">
                <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setLeaseChoice("existing")}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#635bff]/50 hover:bg-indigo-50/40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-[#635bff]">
                      <DocumentCheckIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-slate-900">Oui, le bail existe déjà</span>
                    <span className="text-xs leading-5 text-slate-500">Je configure juste le suivi (loyer, dates) dans lokt.fr.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (targetTenantIsCompany) setLeaseKind("professional");
                      setLeaseChoice("new");
                    }}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#635bff]/50 hover:bg-indigo-50/40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-[#635bff]">
                      <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-slate-900">Non, j'ai besoin de le créer</span>
                    <span className="text-xs leading-5 text-slate-500">
                      {targetTenantIsCompany
                        ? "lokt.fr génère un bail professionnel (le seul type compatible avec un locataire personne morale)."
                        : "lokt.fr génère un vrai contrat de bail à faire signer."}
                    </span>
                  </button>
                </div>
              </div>
            </StepShell>
          ) : null}

          {activeStepKey === "baux" && createdLeaseId && !reviewingLease ? (
            <LeaseContractOnboarding
              key={`${createdLeaseId}-${leaseReloadNonce}`}
              userId={userId}
              leaseId={createdLeaseId}
              onComplete={onComplete}
              onBack={() => setReviewingLease(true)}
            />
          ) : null}

          {activeStepKey === "baux" && leaseChoice && (!createdLeaseId || reviewingLease) ? (
            <StepShell
              title={reviewingLease ? "Modifier la location" : "Créer la location"}
              desc="Elle relie le bien et le locataire que vous venez de créer."
              footer={
                <>
                  <PrimaryButton onClick={submitBail} disabled={saving}>
                    {saving ? "Enregistrement…" : "Continuer"}
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={() => setLeaseChoice(null)}
                    disabled={saving}
                    className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700 disabled:opacity-50"
                  >
                    ← Précédent
                  </button>
                </>
              }
            >
              {leaseChoice === "new" ? (
                <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                  Renseignez d'abord ces infos de base, vous compléterez ensuite le contrat complet (parties, clauses...) dans
                  l'étape suivante.
                </p>
              ) : null}
              {targetPropertyIsBuilding ? (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Lot loué <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={selectedLeaseLotId || ""}
                    onChange={(e) => setSelectedLeaseLotId(e.target.value || null)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="">— Sélectionner —</option>
                    {createdLots.map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                  <span className="block text-[0.68rem] leading-4 text-slate-500">Cet immeuble a {createdLots.length} lot{createdLots.length > 1 ? "s" : ""} — cette première location se rattache à l'un d'eux, les autres se louent ensuite depuis Locations.</span>
                </label>
              ) : null}
              {targetTenantIsCompany ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  Type de bail : <strong>Bail professionnel</strong> (seul type compatible avec un locataire personne morale).
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {LEASE_KIND_OPTIONS.map((opt) => (
                    <ChoiceCard key={opt.value} label={opt.label} hint={opt.hint} selected={leaseKind === opt.value} onClick={() => setLeaseKind(opt.value)} />
                  ))}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Loyer (€)" hint="Hors charges" value={rentAmount} onChange={setRentAmount} placeholder="850" required />
                <TextField label="Charges (€)" value={chargesAmount} onChange={setChargesAmount} placeholder="50" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Date de début" value={startDate} onChange={setStartDate} type="date" required />
                <TextField
                  label="Date de fin"
                  hint="Pré-remplie à 1 an, modifiable"
                  value={endDate}
                  onChange={setEndDate}
                  type="date"
                />
              </div>
              <TextField
                label="Dépôt de garantie (€)"
                value={depositAmount}
                onChange={setDepositAmount}
                placeholder="0"
                infoTip={(() => {
                  const cap = depositCapForKind(leaseKind, Number(rentAmount) || 0);
                  return cap != null
                    ? `Plafond légal pour ce type de bail : ${cap.toLocaleString("fr-FR")} € (${cap === Number(rentAmount) ? "1" : "2"} mois de loyer).`
                    : "Montant librement convenu avec le locataire, dans la limite prévue par la loi selon le type de bail.";
                })()}
              />
              <p className="text-xs text-slate-500">Options avancées (relances, révision du loyer...) : à compléter ensuite depuis Locations.</p>
            </StepShell>
          ) : null}
        </CalculatorWizardShell>
      </div>
    </div>
  );
}
