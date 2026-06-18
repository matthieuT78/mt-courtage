import { useEffect, useState } from "react";
import { ArrowDownTrayIcon, ArrowLeftIcon, ArrowRightIcon, DocumentArrowUpIcon, DocumentTextIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../lib/supabaseClient";
import { xhrUploadToSignedUrl } from "../../lib/uploadWithProgress";
import { UploadProgressBar } from "../UploadProgressBar";

type Props = { userId: string; leaseId: string; onClose: () => void };
const steps = ["Type", "Parties", "Logement", "Durée", "Finances", "Clauses", "Finaliser"];
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const label = "space-y-1 text-xs font-semibold text-slate-700";
const requiredLabels: Record<string, string> = {
  landlord_name: "Nom du bailleur",
  landlord_address: "Adresse du bailleur",
  tenant_name: "Nom du locataire",
  property_address_line1: "Adresse du logement",
  property_postal_code: "Code postal du logement",
  property_city: "Ville du logement",
  housing_type: "Type d’habitat",
  legal_regime: "Régime juridique de l’immeuble",
  building_period: "Période de construction",
  surface_m2: "Surface habitable",
  main_rooms: "Nombre de pièces principales",
  heating_method: "Mode de chauffage",
  hot_water_method: "Production d’eau chaude",
  fiscal_property_id: "Identifiant fiscal du logement",
  destination: "Destination du logement",
  ict_equipment: "Équipements d’accès aux communications",
  start_date: "Date de prise d’effet",
  end_date: "Date de fin",
  mobility_reason: "Motif d’éligibilité au bail mobilité",
  rent_amount: "Loyer mensuel",
  charges_amount: "Charges mensuelles",
  deposit_amount: "Dépôt de garantie",
  payment_method: "Modalité de paiement",
  payment_day: "Jour de paiement",
  irl_reference: "Trimestre de référence IRL",
  reference_rent_increased: "Loyer de référence majoré",
  signature_place: "Lieu de signature",
  signature_date: "Date de signature",
};

function requiredFieldsForStep(step: number, kind: string, form: Record<string, any>) {
  if (step === 1) return ["landlord_name", "landlord_address", "tenant_name"];
  if (step === 2) return ["property_address_line1", "property_postal_code", "property_city", "housing_type", "legal_regime", "building_period", "surface_m2", "main_rooms", "heating_method", "hot_water_method", ...(fiscalIdRequired(form.property_country) ? ["fiscal_property_id"] : []), "destination", "ict_equipment"];
  if (step === 3) return ["start_date", "end_date", ...(kind === "mobility" ? ["mobility_reason"] : [])];
  if (step === 4) return ["rent_amount", "charges_amount", ...(kind === "mobility" ? [] : ["deposit_amount"]), "payment_method", "payment_day", ...(form.rent_revision_enabled ? ["irl_reference"] : []), ...(form.rent_controlled_area ? ["reference_rent_increased"] : [])];
  if (step === 6) return ["signature_place", "signature_date"];
  return [];
}

function fiscalIdRequired(country?: string) {
  return !["GP", "MQ", "GF", "RE", "YT"].includes(String(country || "FR").toUpperCase());
}

function missingRequiredFields(step: number, kind: string, form: Record<string, any>) {
  return requiredFieldsForStep(step, kind, form).filter((key) => String(form[key] ?? "").trim() === "");
}

function propertyAddress(form: Record<string, any>) {
  return [form.property_address_line1, form.property_address_line2, form.property_postal_code, form.property_city, form.property_country]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [document, setDocument] = useState<any>(null);
  const [sourceMode, setSourceMode] = useState<"choose" | "generated" | "external">("choose");
  const [generatedDone, setGeneratedDone] = useState(false);
  const [kind, setKind] = useState("furnished_primary");
  const [form, setForm] = useState<Record<string, any>>({});
  const set = (key: string, value: any) =>
    setForm((current) => {
      const next = { ...current, [key]: value };
      return key.startsWith("property_") ? { ...next, property_address: propertyAddress(next) } : next;
    });

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
        setSourceMode(existing?.document_source === "external" ? "external" : existing ? "generated" : "choose");
        setKind(existing?.contract_kind || lease.lease_kind || "furnished_primary");
        setForm({
          landlord_name: landlord.display_name || profile.full_name || "",
          landlord_address: landlord.address || [profile.address_line1, profile.postal_code, profile.city].filter(Boolean).join(", "),
          tenant_name: tenant.full_name || "",
          tenant_email: tenant.email || "",
          property_address: [property.address_line1, property.address_line2, property.postal_code, property.city, property.country].filter(Boolean).join(", "),
          property_address_line1: property.address_line1 || "",
          property_address_line2: property.address_line2 || "",
          property_postal_code: property.postal_code || "",
          property_city: property.city || "",
          property_country: property.country || "FR",
          housing_type: "Immeuble collectif",
          legal_regime: "",
          surface_m2: "",
          main_rooms: "",
          other_parts: "",
          private_equipment: "",
          common_equipment: "",
          ict_equipment: "",
          destination: "Usage d’habitation",
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
  const validateStep = (targetStep: number) => {
    const missing = missingRequiredFields(targetStep, kind, form);
    if (!missing.length) return true;
    setStep(targetStep);
    setErr(`Complète les informations obligatoires avant de continuer : ${missing.map((key) => requiredLabels[key] || key).join(", ")}.`);
    return false;
  };
  const next = () => {
    setErr(null);
    if (!validateStep(step)) return;
    setStep(step + 1);
  };
  const generate = async () => {
    try {
      setLoading(true); setErr(null);
      for (let index = 1; index <= 6; index += 1) {
        if (!validateStep(index)) return;
      }
      const saved = await save();
      const data = await api("/api/lease-contracts/generate", { userId, documentId: saved.id });
      setDocument(data.document);
      setGeneratedDone(true);
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
      setLoading(true); setErr(null); setUploadProgress(0);
      const saved = document?.id ? document : await save();
      const signed = await api("/api/lease-contracts/signed-upload-url", { userId, documentId: saved.id, uploadType: "signed", sizeBytes: file.size });
      await xhrUploadToSignedUrl(signed.signedUrl, file, (pct) => setUploadProgress(pct));
      setUploadProgress(null);
      const result = await api("/api/lease-contracts", { action: "confirmSigned", userId, leaseId, signedPdfUrl: `${signed.bucket}:${signed.path}` });
      setDocument(result.document);
    } catch (error: any) { setErr(error?.message || "Import impossible."); setUploadProgress(null); } finally { setLoading(false); }
  };
  const deleteExternal = async () => {
    if (!confirm("Supprimer le bail importé ? Cette action est irréversible.")) return;
    try {
      setLoading(true); setErr(null);
      const result = await api("/api/lease-contracts", { action: "deleteExternal", userId, leaseId });
      setDocument(result.document);
    } catch (error: any) { setErr(error?.message || "Suppression impossible."); } finally { setLoading(false); }
  };
  const uploadExternal = async (file?: File) => {
    if (!file || file.type !== "application/pdf") return setErr("Sélectionne ton bail au format PDF.");
    try {
      setLoading(true); setErr(null); setUploadProgress(0);
      const saved = document?.id ? document : await save();
      const signed = await api("/api/lease-contracts/signed-upload-url", { userId, documentId: saved.id, uploadType: "external", sizeBytes: file.size });
      await xhrUploadToSignedUrl(signed.signedUrl, file, (pct) => setUploadProgress(pct));
      setUploadProgress(null);
      const result = await api("/api/lease-contracts", {
        action: "confirmExternal",
        userId,
        leaseId,
        externalPdfUrl: `${signed.bucket}:${signed.path}`,
        fileName: file.name,
      });
      setDocument(result.document);
      setSourceMode("external");
    } catch (error: any) { setErr(error?.message || "Import impossible."); setUploadProgress(null); } finally { setLoading(false); }
  };

  if (loading && !Object.keys(form).length) return <Modal onClose={onClose}><p className="p-6 text-sm text-slate-600">Chargement...</p></Modal>;
  if (sourceMode === "choose") {
    return (
      <Modal onClose={onClose}>
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contrat de location</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Associer le document juridique au bail Lokt</h2>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-slate-700">
            La fiche bail Lokt reste obligatoire pour suivre les loyers, charges, quittances et échéances. Choisis maintenant comment archiver le
            contrat signé avec ton locataire.
          </p>
          {err ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              icon={DocumentTextIcon}
              title="Rédiger avec Lokt"
              description="Compléter l’assistant, générer un PDF puis importer la version signée."
              onClick={() => {
                if (kind === "other") setKind("furnished_primary");
                setSourceMode("generated");
              }}
            />
            <Choice
              icon={DocumentArrowUpIcon}
              title="Importer mon propre bail"
              description="Archiver ton modèle existant. Aucun PDF Lokt ne sera généré."
              onClick={() => setSourceMode("external")}
            />
          </div>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><XMarkIcon className="h-4 w-4"/>Fermer</button>
        </div>
      </Modal>
    );
  }
  if (sourceMode === "external") {
    return (
      <Modal onClose={onClose}>
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contrat de location</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Bail externe associé à la fiche Lokt</h2>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-slate-700">
            Lokt utilise toujours la fiche bail pour gérer la location. Le fichier ci-dessous est ton contrat juridique : aucun autre PDF ne sera
            généré par Lokt dans ce parcours.
          </p>
          {err ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p> : null}
          <UploadProgressBar progress={uploadProgress} />
          {document?.external_pdf_url ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-950">Bail importé et archivé</p>
              <p className="mt-1 text-xs text-emerald-800">{document.original_file_name || "bail-importé.pdf"}</p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Aucun bail externe importé pour le moment.</p>
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={() => setSourceMode("choose")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><ArrowLeftIcon className="h-4 w-4"/>Changer de méthode</button>
          <div className="flex flex-wrap gap-2">
            {document?.external_pdf_url ? <button type="button" onClick={openPdf} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><ArrowDownTrayIcon className="h-4 w-4"/>Ouvrir le bail importé</button> : null}
            {document?.external_pdf_url ? <button type="button" disabled={loading} onClick={deleteExternal} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><TrashIcon className="h-4 w-4"/>Supprimer</button> : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><DocumentArrowUpIcon className="h-4 w-4"/>{loading ? "Import..." : document?.external_pdf_url ? "Remplacer le PDF" : "Importer mon bail"}<input type="file" accept="application/pdf" className="hidden" disabled={loading} onChange={(event) => uploadExternal(event.target.files?.[0])}/></label>
            {document?.external_pdf_url
              ? <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Contrat juridique enregistré<XMarkIcon className="h-4 w-4"/></button>
              : <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><XMarkIcon className="h-4 w-4"/>Fermer</button>
            }
          </div>
        </div>
      </Modal>
    );
  }
  if (generatedDone && document?.pdf_url) {
    return (
      <Modal onClose={onClose}>
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Contrat généré</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Le PDF du bail est prêt</h2>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-slate-700">
            Télécharge le PDF, fais-le signer par les parties puis reviens importer la version signée. Le bail Lokt reste actif pour le suivi de la location.
          </p>
          {err ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p> : null}
          <UploadProgressBar progress={uploadProgress} />
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-950">Génération terminée avec succès</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">Le document est archivé dans Lokt. Tu peux le rouvrir plus tard depuis cette fiche bail.</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><XMarkIcon className="h-4 w-4"/>Fermer</button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openPdf} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><ArrowDownTrayIcon className="h-4 w-4"/>Ouvrir le PDF</button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white"><DocumentArrowUpIcon className="h-4 w-4"/>Importer la version signée<input type="file" accept="application/pdf" className="hidden" onChange={(event) => uploadSigned(event.target.files?.[0])}/></label>
          </div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal onClose={onClose}>
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assistant contrat de location</p>
        <div className="mt-3 flex gap-1 overflow-auto">{steps.map((name, index) => <span key={name} className={`min-w-fit rounded-md px-2 py-1 text-xs font-semibold ${index === step ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{index + 1}. {name}</span>)}</div>
      </div>
      <div className="max-h-[68vh] overflow-auto p-5">
        {err ? <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p> : null}
        {step > 0 ? <p className="mb-4 text-xs leading-5 text-slate-500"><span className="font-bold text-red-600">*</span> Information obligatoire pour établir le contrat de location avec ce modèle.</p> : null}
        {step === 0 ? <StepType kind={kind} setKind={setKind} /> : null}
        {step === 1 ? <Fields form={form} set={set} required={requiredFieldsForStep(step, kind, form)} names={[["landlord_name","Nom du bailleur"],["landlord_address","Adresse du bailleur"],["tenant_name","Nom du locataire"],["tenant_email","E-mail du locataire"]]} /> : null}
        {step === 2 ? <><Fields form={form} set={set} required={requiredFieldsForStep(step, kind, form)} names={[["property_address_line1","Numéro et nom de rue"],["property_address_line2","Complément d’adresse"],["property_postal_code","Code postal"],["property_city","Ville"],["property_country","Pays","select",[["FR","France"],["GP","Guadeloupe"],["MQ","Martinique"],["GF","Guyane"],["RE","La Réunion"],["YT","Mayotte"]]],["fiscal_property_id","Identifiant fiscal du logement"],["housing_type","Type d’habitat","select",["Immeuble collectif","Maison individuelle"]],["legal_regime","Régime juridique de l’immeuble","select",["Copropriété","Monopropriété"]],["building_period","Période de construction","select",["Avant 1949","De 1949 à 1974","De 1975 à 1989","De 1989 à 2005","Depuis 2005"]],["surface_m2","Surface habitable (m²)"],["main_rooms","Nombre de pièces principales"],["heating_method","Mode de chauffage","select",["Individuel électrique","Individuel gaz","Individuel autre","Collectif"]],["hot_water_method","Production d’eau chaude sanitaire","select",["Individuelle électrique","Individuelle gaz","Individuelle autre","Collective"]],["destination","Destination du logement","select",["Usage d’habitation","Usage mixte professionnel et habitation"]],["ict_equipment","Accès internet, TV et communications"],["other_parts","Autres parties du logement"],["private_equipment","Équipements privatifs"],["common_equipment","Équipements communs"],["furniture_inventory","Mobilier principal"]]} /><p className="mt-3 text-xs leading-5 text-slate-500">L’identifiant fiscal du logement figure dans le contrat type depuis le 1er janvier 2025. Il n’est pas requis pour les logements situés en Guadeloupe, Martinique, Guyane, à La Réunion ou à Mayotte.</p></> : null}
        {step === 3 ? <Fields form={form} set={set} required={requiredFieldsForStep(step, kind, form)} names={[["start_date","Date de prise d’effet","date"],["end_date","Date de fin","date"],["mobility_reason","Motif d’éligibilité au bail mobilité"]]} /> : null}
        {step === 4 ? <><Fields form={form} set={set} required={requiredFieldsForStep(step, kind, form)} names={[["rent_amount","Loyer mensuel hors charges","number"],["charges_amount","Charges mensuelles","number"],["deposit_amount","Dépôt de garantie","number"],["payment_method","Modalité de paiement"],["payment_day","Jour de paiement","number"],["irl_reference","Trimestre de référence IRL"],["previous_rent","Dernier loyer appliqué au précédent locataire","number"],["previous_tenant_departure_date","Date de départ du précédent locataire","date"]]} /><Checks form={form} set={set} names={[["rent_revision_enabled","Révision annuelle du loyer"],["rent_controlled_area","Zone soumise à encadrement des loyers"]]} /></> : null}
        {step === 5 ? <Fields form={form} set={set} names={[["recent_works","Travaux récents"],["estimated_energy_cost","Estimation annuelle des dépenses d’énergie","number"],["energy_reference_year","Année de référence de l’estimation énergétique"],["tenant_agency_fees","Honoraires imputés au locataire","number"],["tenant_inventory_fees","Honoraires d’état des lieux imputés au locataire","number"],["special_terms","Clauses particulières"],["reference_rent_increased","Loyer de référence majoré","number"],["rent_supplement","Complément de loyer","number"],["rent_supplement_reason","Justification du complément"]]} /> : null}
        {step === 6 ? <><AnnexChecks form={form} set={set} /><Fields form={form} set={set} required={requiredFieldsForStep(step, kind, form)} names={[["signature_place","Lieu de signature"],["signature_date","Date de signature","date"]]} /></> : null}
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {step > 0 ? <button type="button" disabled={loading} onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><ArrowLeftIcon className="h-4 w-4"/>Précédent</button> : null}
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><XMarkIcon className="h-4 w-4"/>Fermer</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSourceMode("choose")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><ArrowLeftIcon className="h-4 w-4"/>Changer de méthode</button>
          {document?.pdf_url ? <button type="button" onClick={openPdf} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><ArrowDownTrayIcon className="h-4 w-4"/>{document.signed_pdf_url ? "Ouvrir le bail signé" : "Ouvrir le PDF"}</button> : null}
          {document?.pdf_url ? <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><DocumentArrowUpIcon className="h-4 w-4"/>Importer signé<input type="file" accept="application/pdf" className="hidden" onChange={(event) => uploadSigned(event.target.files?.[0])}/></label> : null}
          {step < 6 ? <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Suivant<ArrowRightIcon className="h-4 w-4"/></button> : <button type="button" disabled={loading} onClick={generate} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">{loading ? "Génération..." : "Finaliser et générer le PDF"}</button>}
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: any) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl"><button type="button" onClick={onClose} title="Fermer" aria-label="Fermer" className="absolute right-3 top-3 z-10 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"><XMarkIcon className="h-5 w-5"/></button>{children}</div></div>; }
function Fields({ form, set, names, required = [] }: any) { return <div className="grid gap-3 sm:grid-cols-2">{names.map(([key,title,type="text",options=[]]: any[]) => <label key={key} className={label}>{title}{required.includes(key) ? <span className="ml-1 font-bold text-red-600">*</span> : null}{type === "select" ? <select value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} className={input}><option value="">Sélectionner</option>{options.map((option: string | [string, string]) => { const value = Array.isArray(option) ? option[0] : option; const optionLabel = Array.isArray(option) ? option[1] : option; return <option key={value} value={value}>{optionLabel}</option>; })}</select> : <input type={type} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} className={input}/>}</label>)}</div>; }
function Checks({ form, set, names }: any) { return <div className="mb-4 grid gap-2 sm:grid-cols-2">{names.map(([key,title]: any[]) => <label key={key} className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!form[key]} onChange={(e) => set(key,e.target.checked)}/>{title}</label>)}</div>; }
function AnnexChecks({ form, set }: any) { const names = [["annex_notice","Notice d’information","À remettre au locataire avec le bail."],["annex_diagnostics","Diagnostics dont DPE","Coche si le dossier de diagnostics applicable sera joint."],["annex_inventory_report","État des lieux d’entrée","À joindre une fois réalisé avec le locataire."],["annex_furniture","Inventaire du mobilier","À joindre pour une location meublée."],["annex_copro","Extrait de copropriété","À joindre si le logement est en copropriété."],["annex_insurance","Assurance habitation","Attestation à récupérer auprès du locataire."]]; return <div className="mb-5"><p className="text-sm font-semibold text-slate-950">Annexes à prévoir avec le contrat</p><p className="mt-1 text-xs leading-5 text-slate-600">Ces cases servent de pense-bête avant signature. Elles n’ajoutent pas automatiquement les documents au PDF.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{names.map(([key,title,description]) => <label key={key} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={!!form[key]} onChange={(e) => set(key,e.target.checked)}/><span><span className="block font-semibold text-slate-900">{title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span></span></label>)}</div></div>; }
function StepType({ kind, setKind }: any) { return <div className="grid gap-2 sm:grid-cols-2">{[["empty_primary","Location vide"],["furnished_primary","Meublé résidence principale"],["furnished_student","Meublé étudiant 9 mois"],["mobility","Bail mobilité"]].map(([value,title]) => <button key={value} type="button" onClick={() => setKind(value)} className={`rounded-xl border p-4 text-left text-sm font-semibold ${kind === value ? "border-slate-900 bg-slate-100" : "border-slate-200"}`}>{title}</button>)}</div>; }
function Choice({ icon: Icon, title, description, onClick }: any) { return <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-400 hover:bg-slate-50"><Icon className="h-6 w-6 text-slate-700"/><span className="mt-3 block text-sm font-semibold text-slate-950">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span></button>; }
