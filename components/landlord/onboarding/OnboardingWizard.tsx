import React, { useEffect, useMemo, useState } from "react";
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
} from "@heroicons/react/24/outline";
import CalculatorWizardShell from "../../calculators/CalculatorWizardShell";
import AddressAutocomplete from "../../forms/AddressAutocomplete";
import { LeaseContractOnboarding } from "./LeaseContractOnboarding";
import { supabase } from "../../../lib/supabaseClient";
import type { Lease, Property, PropertyFinance, Tenant } from "../../../lib/landlord/types";
import type { Profile } from "../../../hooks/useProfile";
import { computeOnboardingStatus } from "../../../lib/landlord/onboardingStatus";

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

const DELEGATED_SERVICES = [
  { key: "mise_en_location", label: "Mise en location & candidatures", desc: "Recherche locataire, dossiers de candidature" },
  { key: "bail_edl", label: "Bail & états des lieux", desc: "Rédaction du bail, état des lieux, dépôt de garantie" },
  { key: "gestion_courante", label: "Gestion courante", desc: "Encaissement loyers, quittances, révision IRL" },
] as const;

const PROPERTY_TYPE_OPTIONS: Array<{ value: string; label: string; icon: typeof HomeIcon }> = [
  { value: "apartment", label: "Appartement", icon: BuildingOffice2Icon },
  { value: "house", label: "Maison", icon: HomeIcon },
  { value: "garage", label: "Garage", icon: TruckIcon },
  { value: "parking", label: "Parking", icon: MapPinIcon },
];

const LEASE_KIND_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: "furnished_primary", label: "Meublé — résidence principale", hint: "Cas le plus courant, bail d'un an reconduit tacitement." },
  { value: "empty_primary", label: "Nu — résidence principale", hint: "Bail non meublé, durée minimale de 3 ans." },
  { value: "other", label: "Autre / je préciserai plus tard", hint: "Modifiable à tout moment depuis Locations." },
];

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

function ChoiceCard({
  label,
  hint,
  icon: Icon,
  selected,
  onClick,
  dense,
}: {
  label: string;
  hint?: string;
  icon?: typeof HomeIcon;
  selected: boolean;
  onClick: () => void;
  dense?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex min-h-[84px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border p-2.5 text-center transition " +
        (selected
          ? "border-[#635bff] bg-indigo-50 text-indigo-950 ring-2 ring-indigo-100"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")
      }
    >
      {Icon ? <Icon className={"h-6 w-6 " + (selected ? "text-[#635bff]" : "text-slate-400")} aria-hidden="true" /> : null}
      <span className={dense ? "text-xs font-semibold leading-4 break-words" : "text-sm font-semibold leading-4 break-words"}>{label}</span>
      {hint ? <span className="text-[0.68rem] leading-4 text-slate-500">{hint}</span> : null}
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

  // Locataire
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
    if (!supabase) return setErr("Supabase non initialisé.");
    setSaving(true);
    setErr(null);
    setErrIsPlanLimit(false);
    try {
      const { data, error } = await supabase
        .from("properties")
        .insert({
          user_id: userId,
          type: propertyType,
          label: propertyLabel.trim(),
          address_line1: propertyAddress.trim(),
          postal_code: propertyPostalCode.trim() || null,
          city: propertyCity.trim() || null,
          surface_m2: propertySurface.trim() ? Number(propertySurface.trim().replace(",", ".")) || null : null,
          rooms: propertyRooms.trim() ? Number(propertyRooms.trim()) || null : null,
          delegated_services: delegatedServices,
          delegation_agency_name: delegationAgencyName.trim() || null,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      setCreatedPropertyId(data?.id || null);
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
    if (!tenantFirstName.trim() || !tenantLastName.trim()) return setErr("Prénom et nom du locataire sont obligatoires.");
    if (tenantEmail.trim() && !isEmailLike(tenantEmail)) return setErr("Email locataire invalide.");
    if (!supabase) return setErr("Supabase non initialisé.");
    setSaving(true);
    setErr(null);
    setErrIsPlanLimit(false);
    try {
      const { data, error } = await supabase
        .from("tenants")
        .insert({
          user_id: userId,
          first_name: tenantFirstName.trim(),
          last_name: tenantLastName.trim(),
          full_name: buildFullName(tenantFirstName, tenantLastName) || "Locataire",
          email: tenantEmail.trim() || null,
          phone: tenantPhone.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      setCreatedTenantId(data?.id || null);
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
    const rent = Number(String(rentAmount).replace(",", "."));
    if (!Number.isFinite(rent) || rent <= 0) return setErr("Le loyer doit être supérieur à 0 €.");
    const charges = chargesAmount ? Number(String(chargesAmount).replace(",", ".")) : 0;
    if (!Number.isFinite(charges) || charges < 0) return setErr("Les charges ne peuvent pas être négatives.");
    setSaving(true);
    setErr(null);
    setErrIsPlanLimit(false);
    try {
      const leasePayload = {
        property_id: targetPropertyId,
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
                    icon={opt.icon}
                    selected={propertyType === opt.value}
                    onClick={() => setPropertyType(opt.value)}
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
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Surface (m²)" value={propertySurface} onChange={setPropertySurface} placeholder="Ex : 45" type="number" />
                <TextField label="Nombre de pièces" value={propertyRooms} onChange={setPropertyRooms} placeholder="Ex : 2" type="number" />
              </div>

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
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Prénom" value={tenantFirstName} onChange={setTenantFirstName} required />
                <TextField label="Nom" value={tenantLastName} onChange={setTenantLastName} required />
              </div>
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
                    onClick={() => setLeaseChoice("new")}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#635bff]/50 hover:bg-indigo-50/40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-[#635bff]">
                      <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-slate-900">Non, j'ai besoin de le créer</span>
                    <span className="text-xs leading-5 text-slate-500">lokt.fr génère un vrai contrat de bail à faire signer.</span>
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
              <div className="grid gap-2 sm:grid-cols-3">
                {LEASE_KIND_OPTIONS.map((opt) => (
                  <ChoiceCard key={opt.value} label={opt.label} hint={opt.hint} selected={leaseKind === opt.value} onClick={() => setLeaseKind(opt.value)} />
                ))}
              </div>
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
              <p className="text-xs text-slate-500">Options avancées (relances, révision IRL...) : à compléter ensuite depuis Locations.</p>
            </StepShell>
          ) : null}
        </CalculatorWizardShell>
      </div>
    </div>
  );
}
