import { useEffect, useState } from "react";
import { ArrowDownTrayIcon, ArrowLeftIcon, ArrowRightIcon, DocumentArrowUpIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../lib/supabaseClient";

type Props = { userId: string; leaseId: string; onClose: () => void };
const steps = ["Type", "Parties", "Logement", "Durée", "Finances", "Clauses", "Finaliser"];
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const label = "space-y-1 text-xs font-semibold text-slate-700";

async function headers() {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}
async function api(path: string, body: any) {
  const response = await fetch(path, { method: "POST", headers: await headers(), body: JSON.stringify(body) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error || "Erreur serveur.");
  return json;
}
function openUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function LeaseContractWizard({ userId, leaseId, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [document, setDocument] = useState<any>(null);
  const [kind, setKind] = useState("furnished_primary");
  const [form, setForm] = useState<Record<string, any>>({});
  const set = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    (async () => {
      try {
        const data = await api("/api/lease-contracts", { action: "load", userId, leaseId });
        const existing = data.document;
        const lease = data.lease || {};
        const property = data.property || {};
        const tenant = data.tenant || {};
        const profile = data.profile || {};
        const landlord = data.landlord || {};
        setDocument(existing || null);
        setKind(existing?.contract_kind || lease.lease_kind || "furnished_primary");
        setForm({
          landlord_name: landlord.display_name || profile.full_name || "",
          landlord_address: landlord.address || [profile.address_line1, profile.postal_code, profile.city].filter(Boolean).join(", "),
          tenant_name: tenant.full_name || "",
          tenant_email: tenant.email || "",
          property_address: [property.address_line1, property.address_line2, property.postal_code, property.city].filter(Boolean).join(", "),
          housing_type: "Appartement",
          surface_m2: "",
          main_rooms: "",
          private_equipment: "",
          common_equipment: "",
          building_period: "",
          heating_method: "",
          hot_water_method: "",
          fiscal_property_id: "",
          furniture_inventory: "",
          start_date: lease.start_date || "",
          end_date: lease.end_date || "",
          mobility_reason: "",
          rent_amount: lease.rent_amount || 0,
          charges_amount: lease.charges_amount || 0,
          deposit_amount: lease.deposit_amount || 0,
          payment_method: lease.payment_method || "Virement",
          payment_day: lease.payment_day || 1,
          rent_revision_enabled: true,
          irl_reference: "",
          rent_controlled_area: false,
          reference_rent_increased: "",
          rent_supplement: "",
          rent_supplement_reason: "",
          previous_rent: "",
          previous_tenant_departure_date: "",
          estimated_energy_cost: "",
          energy_reference_year: "",
          tenant_agency_fees: "",
          tenant_inventory_fees: "",
          recent_works: "",
          special_terms: "",
          annex_notice: false,
          annex_diagnostics: false,
          annex_inventory_report: false,
          annex_furniture: false,
          annex_copro: false,
          annex_insurance: false,
          signature_place: property.city || profile.city || "",
          signature_date: new Date().toISOString().slice(0, 10),
          ...(existing?.form_data || {}),
        });
      } catch (error: any) {
        setErr(error?.message || "Chargement impossible.");
      } finally {
        setLoading(false);
      }
    })();
  }, [leaseId, userId]);

  const save = async () => {
    const data = await api("/api/lease-contracts", { action: "save", userId, leaseId, contractKind: kind, formData: form });
    setDocument(data.document);
    return data.document;
  };
  const generate = async () => {
    try {
      setLoading(true); setErr(null);
      const saved = await save();
      const data = await api("/api/lease-contracts/generate", { userId, documentId: saved.id });
      setDocument(data.document);
    } catch (error: any) { setErr(error?.message || "Génération impossible."); } finally { setLoading(false); }
  };
  const openPdf = async () => {
    try {
      const data = await fetch(`/api/lease-contracts/pdf-url?userId=${encodeURIComponent(userId)}&documentId=${encodeURIComponent(document.id)}`, { headers: await headers() }).then(async (response) => {
        const json = await response.json(); if (!response.ok) throw new Error(json.error); return json;
      });
      openUrl(data.signedUrl);
    } catch (error: any) { setErr(error?.message || "Ouverture impossible."); }
  };
  const uploadSigned = async (file?: File) => {
    if (!file || file.type !== "application/pdf") return setErr("Sélectionne un fichier PDF signé.");
    try {
      setLoading(true); setErr(null);
      const saved = document?.id ? document : await save();
      const signed = await api("/api/lease-contracts/signed-upload-url", { userId, documentId: saved.id });
      const { error } = await supabase!.storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, file, { contentType: "application/pdf" });
      if (error) throw error;
      const result = await api("/api/lease-contracts", { action: "confirmSigned", userId, leaseId, signedPdfUrl: `${signed.bucket}:${signed.path}` });
      setDocument(result.document);
    } catch (error: any) { setErr(error?.message || "Import impossible."); } finally { setLoading(false); }
  };

  if (loading && !Object.keys(form).length) return <Modal onClose={onClose}><p className="p-6 text-sm text-slate-600">Chargement...</p></Modal>;
  return (
    <Modal onClose={onClose}>
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assistant contrat de location</p>
        <div className="mt-3 flex gap-1 overflow-auto">{steps.map((name, index) => <span key={name} className={`min-w-fit rounded-md px-2 py-1 text-xs font-semibold ${index === step ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{index + 1}. {name}</span>)}</div>
      </div>
      <div className="max-h-[68vh] overflow-auto p-5">
        {err ? <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p> : null}
        {step === 0 ? <StepType kind={kind} setKind={setKind} /> : null}
        {step === 1 ? <Fields form={form} set={set} names={[["landlord_name","Nom du bailleur"],["landlord_address","Adresse du bailleur"],["tenant_name","Nom du locataire"],["tenant_email","E-mail du locataire"]]} /> : null}
        {step === 2 ? <Fields form={form} set={set} names={[["property_address","Adresse complète du logement"],["fiscal_property_id","Identifiant fiscal du logement"],["housing_type","Type d’habitat"],["building_period","Période de construction"],["surface_m2","Surface habitable (m²)"],["main_rooms","Nombre de pièces principales"],["heating_method","Mode de chauffage"],["hot_water_method","Production d’eau chaude"],["private_equipment","Équipements privatifs"],["common_equipment","Équipements communs"],["furniture_inventory","Mobilier principal"]]} /> : null}
        {step === 3 ? <Fields form={form} set={set} names={[["start_date","Date de prise d’effet","date"],["end_date","Date de fin","date"],["mobility_reason","Motif d’éligibilité au bail mobilité"]]} /> : null}
        {step === 4 ? <><Fields form={form} set={set} names={[["rent_amount","Loyer mensuel hors charges","number"],["charges_amount","Charges mensuelles","number"],["deposit_amount","Dépôt de garantie","number"],["payment_method","Modalité de paiement"],["payment_day","Jour de paiement","number"],["irl_reference","Trimestre de référence IRL"],["previous_rent","Dernier loyer appliqué au précédent locataire","number"],["previous_tenant_departure_date","Date de départ du précédent locataire","date"]]} /><Checks form={form} set={set} names={[["rent_revision_enabled","Révision annuelle du loyer"],["rent_controlled_area","Zone soumise à encadrement des loyers"]]} /></> : null}
        {step === 5 ? <Fields form={form} set={set} names={[["recent_works","Travaux récents"],["estimated_energy_cost","Estimation annuelle des dépenses d’énergie","number"],["energy_reference_year","Année de référence de l’estimation énergétique"],["tenant_agency_fees","Honoraires imputés au locataire","number"],["tenant_inventory_fees","Honoraires d’état des lieux imputés au locataire","number"],["special_terms","Clauses particulières"],["reference_rent_increased","Loyer de référence majoré","number"],["rent_supplement","Complément de loyer","number"],["rent_supplement_reason","Justification du complément"]]} /> : null}
        {step === 6 ? <><Checks form={form} set={set} names={[["annex_notice","Notice d’information"],["annex_diagnostics","Diagnostics dont DPE"],["annex_inventory_report","État des lieux d’entrée"],["annex_furniture","Inventaire du mobilier"],["annex_copro","Extrait de copropriété"],["annex_insurance","Assurance habitation"]]} /><Fields form={form} set={set} names={[["signature_place","Lieu de signature"],["signature_date","Date de signature","date"]]} /></> : null}
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-5 py-4">
        <button type="button" disabled={!step || loading} onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><ArrowLeftIcon className="h-4 w-4"/>Précédent</button>
        <div className="flex flex-wrap gap-2">
          {document?.pdf_url ? <button type="button" onClick={openPdf} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><ArrowDownTrayIcon className="h-4 w-4"/>{document.signed_pdf_url ? "Ouvrir le bail signé" : "Ouvrir le PDF"}</button> : null}
          {document?.pdf_url ? <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><DocumentArrowUpIcon className="h-4 w-4"/>Importer signé<input type="file" accept="application/pdf" className="hidden" onChange={(event) => uploadSigned(event.target.files?.[0])}/></label> : null}
          {step < 6 ? <button type="button" onClick={() => setStep(step + 1)} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Suivant<ArrowRightIcon className="h-4 w-4"/></button> : <button type="button" disabled={loading} onClick={generate} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">{loading ? "Génération..." : "Finaliser et générer le PDF"}</button>}
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: any) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl"><button type="button" onClick={onClose} className="absolute right-6 top-6 rounded-lg p-2 text-slate-500"><XMarkIcon className="h-5 w-5"/></button>{children}</div></div>; }
function Fields({ form, set, names }: any) { return <div className="grid gap-3 sm:grid-cols-2">{names.map(([key,title,type="text"]: any[]) => <label key={key} className={label}>{title}<input type={type} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} className={input}/></label>)}</div>; }
function Checks({ form, set, names }: any) { return <div className="mb-4 grid gap-2 sm:grid-cols-2">{names.map(([key,title]: any[]) => <label key={key} className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!form[key]} onChange={(e) => set(key,e.target.checked)}/>{title}</label>)}</div>; }
function StepType({ kind, setKind }: any) { return <div className="grid gap-2 sm:grid-cols-2">{[["empty_primary","Location vide"],["furnished_primary","Meublé résidence principale"],["furnished_student","Meublé étudiant 9 mois"],["mobility","Bail mobilité"]].map(([value,title]) => <button key={value} type="button" onClick={() => setKind(value)} className={`rounded-xl border p-4 text-left text-sm font-semibold ${kind === value ? "border-slate-900 bg-slate-100" : "border-slate-200"}`}>{title}</button>)}</div>; }
