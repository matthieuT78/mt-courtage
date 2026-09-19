import { useEffect, useRef, useState } from "react";
import { AcademicCapIcon, ArrowDownTrayIcon, ArrowLeftIcon, ArrowRightIcon, ArrowsRightLeftIcon, BriefcaseIcon, DocumentArrowUpIcon, DocumentTextIcon, HomeIcon, HomeModernIcon, InformationCircleIcon, PencilSquareIcon, TrashIcon, UserIcon, UsersIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../lib/supabaseClient";
import { xhrUploadToSignedUrl } from "../../lib/uploadWithProgress";
import { UploadProgressBar } from "../UploadProgressBar";
import { depositCapForKind } from "../../lib/landlord/depositCap";

type Props = { userId: string; leaseId: string; onClose: () => void };
const steps = ["Type", "Parties", "Logement", "Durée", "Finances", "Clauses", "Finaliser"];
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const label = "space-y-1 text-xs font-semibold text-slate-700";

function requiredFieldsForStep(step: number, kind: string, form: Record<string, any>) {
  if (step === 1) return ["landlord_name", "landlord_address", "tenant_name"];
  if (step === 2) return ["property_address_line1", "property_postal_code", "property_city", "housing_nature", "housing_type", "legal_regime", "building_period", "surface_m2", "main_rooms", "heating_method", "hot_water_method", ...(fiscalIdRequired(form.property_country) ? ["fiscal_property_id"] : []), "destination", "ict_equipment", "dpe_class", "ges_class"];
  if (step === 3) return ["start_date", "end_date", ...(kind === "mobility" ? ["mobility_reason"] : [])];
  if (step === 4) return ["rent_amount", "charges_amount", ...(kind === "mobility" ? [] : ["deposit_amount"]), "payment_method", "payment_day", "charges_type", ...(form.rent_revision_enabled ? ["irl_reference"] : []), ...(form.rent_controlled_area ? ["reference_rent", "reference_rent_increased"] : [])];
  if (step === 6) return ["signature_place", "signature_date"];
  return [];
}

function isEmailLike(v?: string | null) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
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

// La colonne leases.payment_method est en base au format legacy minuscule
// ("virement"), ce qui n'est jamais reconnu par les options du bouton
// ("Virement"/"Chèque") et faisait retomber le champ sur "Autre".
function normalizePaymentMethod(value?: string | null): string {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "Virement";
  if (v === "virement") return "Virement";
  if (v === "cheque" || v === "chèque") return "Chèque";
  return String(value);
}

// Durée par défaut d'1 an à partir de la date de prise d'effet — évite un
// champ vide qui donne l'impression que la génération du contrat est cassée.
// Réutilise le garant déjà renseigné sur la fiche locataire (section
// Locataires) plutôt que de faire retaper son identité dans le contrat —
// simple pré-remplissage, reste éditable et propre à ce document (même
// logique que pour le nom du bailleur ou du locataire).
function guarantorDefaults(tenant: any): { garant_name: string; garant_address: string } {
  if (!tenant?.guarantor_type) return { garant_name: "", garant_address: "" };
  if (tenant.guarantor_type === "visale") {
    return {
      garant_name: `Garantie Visale${tenant.visale_number ? ` n° ${tenant.visale_number}` : ""}`,
      garant_address: "Action Logement Services",
    };
  }
  return {
    garant_name: [tenant.guarantor_first_name, tenant.guarantor_last_name].filter(Boolean).join(" "),
    garant_address: [tenant.guarantor_address_line1, tenant.guarantor_postal_code, tenant.guarantor_city].filter(Boolean).join(", "),
  };
}

function defaultEndDate(startDate?: string): string {
  const base = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  const end = new Date(base);
  end.setFullYear(end.getFullYear() + 1);
  return end.toISOString().slice(0, 10);
}

// Pré-remplissage indicatif : le trimestre en cours à la date de début du
// bail — l'utilisateur doit vérifier la valeur exacte de l'indice sur
// insee.fr avant signature (voir l'info-bulle du champ).
function defaultIrlQuarter(startDate?: string): string {
  const d = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const labels = ["1er", "2e", "3e", "4e"];
  const quarter = Math.floor(d.getMonth() / 3);
  return `${labels[quarter]} trimestre ${d.getFullYear()}`;
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

export function LeaseContractWizard({ userId, leaseId, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [document, setDocument] = useState<any>(null);
  const [sourceMode, setSourceMode] = useState<"choose" | "generated" | "external">("choose");
  const [generatedDone, setGeneratedDone] = useState(false);
  // Un bail signé est protégé par défaut (voir plus bas) — ce drapeau, posé
  // sur une action explicite du bailleur, autorise à rouvrir l'assistant
  // d'édition dessus malgré tout.
  const [editingSignedLease, setEditingSignedLease] = useState(false);
  const [kind, setKind] = useState("furnished_primary");
  const [form, setForm] = useState<Record<string, any>>({});
  const [sigLoading, setSigLoading] = useState(false);
  const [sigSent, setSigSent] = useState(false);
  const [sigError, setSigError] = useState<string | null>(null);
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [confirmDeleteExternal, setConfirmDeleteExternal] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [editingParties, setEditingParties] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [pendingSignature, setPendingSignature] = useState(false);
  const [isCompanyTenant, setIsCompanyTenant] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const set = (key: string, value: any) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      return key.startsWith("property_") ? { ...next, property_address: propertyAddress(next) } : next;
    });
    // La validation (format email, co-locataire à moitié rempli) ne se
    // déclenche qu'au clic sur "Suivant" — pas à chaque frappe, sinon remplir
    // le nom du co-locataire avant son email l'affiche en rouge alors qu'on
    // n'a simplement pas encore eu le temps de le renseigner.
    if (invalidFields.has(key)) {
      setInvalidFields((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api("/api/lease-contracts", { action: "load", userId, leaseId });
        const existing = data.document;
        const lease = data.lease || {};
        const property = data.property || {};
        const lot = data.lot || null;
        const tenant = data.tenant || {};
        const profile = data.profile || {};
        const landlord = data.landlord || {};
        setDocument(existing || null);
        setIsCompanyTenant(!!tenant.is_company);
        // Un locataire personne morale ne peut pas signer un bail loi de 1989 (résidence
        // principale) — mais un bail professionnel reste possible (art. 57 A loi 1986,
        // pas de condition de résidence principale). On ne force donc l'import que si
        // aucun bail n'a jamais été rédigé sous ce type ; le choix "Rédiger avec Lokt"
        // reste ouvert, StepType n'y proposant alors que "Bail professionnel".
        setSourceMode(
          existing?.document_source === "external" ? "external" : existing ? "generated" : "choose"
        );
        setPendingSignature(!!data.pendingSignature);
        setKind(existing?.contract_kind || lease.lease_kind || "furnished_primary");
        setForm({
          landlord_name: landlord.display_name || profile.full_name || "",
          landlord_address: landlord.address || [profile.address_line1, profile.postal_code, profile.city].filter(Boolean).join(", "),
          // Pré-coché si le profil a une raison sociale renseignée, mais reste modifiable :
          // seul le nom effectivement saisi comme bailleur ci-dessus fait foi juridiquement.
          landlord_is_company: !!profile.company_name,
          tenant_name: tenant.full_name || "",
          tenant_email: tenant.email || "",
          landlord_phone: "",
          tenant_phone: "",
          property_address: [property.address_line1, lot?.label || property.address_line2, property.postal_code, property.city, property.country].filter(Boolean).join(", "),
          property_address_line1: property.address_line1 || "",
          // Un bail sur un lot d'immeuble n'a pas de complément d'adresse propre — le nom
          // du lot (ex. "Appartement 001") en tient lieu, pour que le contrat identifie
          // clairement le logement loué au sein du bâtiment.
          property_address_line2: lot?.label || property.address_line2 || "",
          property_postal_code: property.postal_code || "",
          property_city: property.city || "",
          property_country: property.country || "FR",
          // Pré-remplissage depuis le lot s'il existe (immeuble), sinon depuis le bien —
          // un immeuble n'a plus ces caractéristiques en propre, elles sont par lot.
          housing_nature: ({ apartment: "Appartement", house: "Maison" } as Record<string, string>)[property.type] || (lot ? "Appartement" : ""),
          housing_type: property.type === "house" ? "Maison individuelle" : "Immeuble collectif",
          legal_regime: "",
          floor: "",
          lot_number: "",
          surface_m2: (lot?.surface_m2 ?? property.surface_m2) != null ? String(lot?.surface_m2 ?? property.surface_m2) : "",
          main_rooms: (lot?.rooms ?? property.rooms) != null ? String(lot?.rooms ?? property.rooms) : "",
          other_parts: "",
          private_equipment: "",
          common_equipment: "",
          ict_equipment: "",
          destination: "Usage d’habitation",
          building_period: "",
          heating_method: "",
          hot_water_method: "",
          fiscal_property_id: "",
          dpe_class: lot?.energy_class || property.energy_class || "",
          ges_class: lot?.ghg_class || property.ghg_class || "",
          energy_kwh_sqm: (lot?.energy_value ?? property.energy_value) != null ? String(lot?.energy_value ?? property.energy_value) : "",
          ges_kgco2_sqm: "",
          furniture_inventory: "",
          start_date: lease.start_date || "",
          end_date: lease.end_date || defaultEndDate(lease.start_date),
          mobility_reason: "",
          rent_amount: lease.rent_amount || 0,
          charges_amount: lease.charges_amount || 0,
          deposit_amount: lease.deposit_amount || 0,
          payment_method: normalizePaymentMethod(lease.payment_method),
          payment_day: lease.payment_day || 1,
          rent_revision_enabled: true,
          irl_reference: defaultIrlQuarter(lease.start_date),
          charges_type: "",
          rent_controlled_area: false,
          reference_rent: "",
          reference_rent_increased: "",
          rent_supplement: "",
          rent_supplement_reason: "",
          mandataire_name: "",
          mandataire_address: "",
          ...guarantorDefaults(tenant),
          annual_insurance_clause: true,
          // Servitude de résidence principale (art. L.151-14-1 code de l'urbanisme) : ne
          // concerne que certains logements neufs dans des communes/zones PLU délimitées.
          // Décoché par défaut — cf. décret n°2026-596 du 6 juillet 2026, applicable aux
          // baux vide/meublé/étudiant conclus ou renouvelés à partir du 1er octobre 2026.
          primary_residence_servitude: false,
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
          // Le colocataire vit désormais sur la Location (source de vérité) —
          // s'il y est renseigné, il prime toujours sur un ancien instantané
          // form_data (qui a pu être saisi avant l'existence de ce champ dédié,
          // ou être devenu obsolète). S'il n'est pas renseigné côté Location,
          // on garde ce qui était déjà dans form_data pour ne rien perdre.
          co_tenant_name: lease.co_tenant_name || "",
          co_tenant_email: lease.co_tenant_email || "",
        });
      } catch (error: any) {
        setErr(error?.message || "Chargement impossible.");
      } finally {
        setLoading(false);
      }
    })();
  }, [leaseId, userId]);

  // Pré-charge l'URL signée dès que le document a un PDF.
  // L'URL est valide 600 s — largement suffisant pour une session.
  // Dépend de pdf_url (pas seulement de l'id) : generate() met à jour le même
  // document (id inchangé) une fois le PDF prêt — sans ça l'effet ne se
  // redéclenchait jamais et "Ouvrir le PDF" restait grisé indéfiniment.
  useEffect(() => {
    // signed_pdf_url (bail signé) / external_pdf_url (bail importé) / pdf_url (généré par Lokt) :
    // même priorité que l'API pdf-url.ts, sinon un bail importé n'a jamais de pdf_url et l'effet
    // ne se déclenche jamais — "Ouvrir le bail importé" reste grisé indéfiniment.
    if (!document?.signed_pdf_url && !document?.external_pdf_url && !document?.pdf_url) return;
    (async () => {
      try {
        const data = await fetch(
          `/api/lease-contracts/pdf-url?userId=${encodeURIComponent(userId)}&documentId=${encodeURIComponent(document.id)}`,
          { headers: await headers() }
        ).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
        setPdfSignedUrl(data.signedUrl);
      } catch { /* silencieux — le lien restera désactivé */ }
    })();
  }, [document?.pdf_url, document?.external_pdf_url, document?.signed_pdf_url, document?.id, userId]);

  const save = async () => {
    const data = await api("/api/lease-contracts", { action: "save", userId, leaseId, contractKind: kind, formData: form });
    setDocument(data.document);
    return data.document;
  };
  const validateStep = (targetStep: number) => {
    const missing = missingRequiredFields(targetStep, kind, form);
    // Les emails (locataire, co-locataire) ne sont pas des champs "obligatoires"
    // légalement (cf. décret contrat-type), mais un format invalide ou un
    // co-locataire à moitié renseigné doit bloquer l'avancée — sinon ça ne se
    // voit qu'au moment d'envoyer la signature, bien plus tard dans le parcours.
    const badFormat: string[] = [];
    if (targetStep === 1) {
      if (form.tenant_email && !isEmailLike(form.tenant_email)) badFormat.push("tenant_email");
      if (!!form.co_tenant_name !== !!form.co_tenant_email) badFormat.push(form.co_tenant_name ? "co_tenant_email" : "co_tenant_name");
      else if (form.co_tenant_email && !isEmailLike(form.co_tenant_email)) badFormat.push("co_tenant_email");
    }
    const allInvalid = [...missing, ...badFormat];
    if (!allInvalid.length) {
      setInvalidFields(new Set());
      return true;
    }
    setStep(targetStep);
    setInvalidFields(new Set(allInvalid));
    setErr(
      missing.length
        ? "Complétez les champs surlignés en rouge ci-dessous."
        : "Corrige les champs surlignés en rouge ci-dessous (email invalide ou co-locataire incomplet)."
    );
    setTimeout(() => {
      window.document.getElementById(allInvalid[0])?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
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

  const sendForSignature = async () => {
    if (!document?.pdf_url || !form.tenant_email) return;
    if (!isEmailLike(form.tenant_email)) { setSigError("L'email du locataire n'a pas un format valide."); return; }
    // Un nom sans email (ou l'inverse) laisserait le co-locataire apparaître sur le
    // PDF sans jamais être invité à signer — exactement le bug initial signalé.
    if (!!form.co_tenant_name !== !!form.co_tenant_email) {
      setSigError("Le co-locataire a un nom sans email (ou l'inverse) — complétez les deux champs, ou videz-les tous les deux, avant d'envoyer.");
      return;
    }
    if (form.co_tenant_email && !isEmailLike(form.co_tenant_email)) {
      setSigError("L'email du co-locataire n'a pas un format valide.");
      return;
    }
    if (form.co_tenant_email && form.co_tenant_email.toLowerCase() === String(form.tenant_email).toLowerCase()) {
      setSigError("Le co-locataire doit avoir un email différent de celui du locataire.");
      return;
    }
    setSigLoading(true); setSigError(null);
    try {
      const { data: sessionData } = await supabase!.auth.getSession();
      const landlordEmail = sessionData.session?.user?.email;
      if (!landlordEmail) throw new Error("Session expirée. Reconnecte-toi.");
      const h = await headers();
      const propAddress = [form.property_address_line1, form.property_city].filter(Boolean).join(", ");
      const documentLabel = `Bail — ${form.tenant_name || form.tenant_email}${propAddress ? ` — ${propAddress}` : ""}`;
      const res = await fetch("/api/signatures/create", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          document_type: "bail",
          document_label: documentLabel,
          lease_contract_id: document.id,
          lease_id: leaseId,
          original_pdf_url: document.pdf_url,
          landlord_email: landlordEmail,
          landlord_name: form.landlord_name || landlordEmail,
          tenant_email: form.tenant_email,
          tenant_name: form.tenant_name || form.tenant_email,
          ...(form.co_tenant_name && form.co_tenant_email
            ? { co_tenant_email: form.co_tenant_email, co_tenant_name: form.co_tenant_name }
            : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) { setSigSent(true); return; } // déjà envoyé
      if (!res.ok) throw new Error(json?.error || "Erreur lors de l'envoi.");
      setSigSent(true);
    } catch (e: any) {
      setSigError(e?.message || "Envoi impossible.");
    } finally {
      setSigLoading(false);
    }
  };

  const deleteExternal = async () => {
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
          {isCompanyTenant ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Locataire professionnel (personne morale) : seul un <strong>bail professionnel</strong> peut être rédigé
              avec Lokt pour ce locataire — pour tout autre type, seule l&apos;importation d&apos;un bail rédigé par
              ailleurs est possible.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              icon={DocumentTextIcon}
              title="Rédiger avec Lokt"
              description={isCompanyTenant ? "Bail professionnel uniquement pour ce locataire." : "Compléter l’assistant, générer un PDF et envoyer pour signature électronique."}
              onClick={() => {
                if (isCompanyTenant) setKind("professional");
                else if (kind === "other" || kind === "professional") setKind("furnished_primary");
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
          {isCompanyTenant ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Locataire professionnel (personne morale) : seul un bail professionnel peut être rédigé avec Lokt pour ce
              locataire — pour tout autre type, seule l&apos;importation d&apos;un bail rédigé par ailleurs est possible.
            </p>
          ) : null}
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
            {document?.external_pdf_url ? <a href={pdfSignedUrl ?? undefined} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold${!pdfSignedUrl ? " pointer-events-none opacity-50" : ""}`}><ArrowDownTrayIcon className="h-4 w-4"/>Ouvrir le bail importé</a> : null}
            {document?.external_pdf_url ? (
              confirmDeleteExternal ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-red-700">Confirmer ?</span>
                  <button type="button" onClick={() => { setConfirmDeleteExternal(false); void deleteExternal(); }} className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">Oui</button>
                  <button type="button" onClick={() => setConfirmDeleteExternal(false)} className="rounded-md border px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Non</button>
                </div>
              ) : (
                <button type="button" disabled={loading} onClick={() => setConfirmDeleteExternal(true)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><TrashIcon className="h-4 w-4"/>Supprimer</button>
              )
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><DocumentArrowUpIcon className="h-4 w-4"/>{loading ? "Import..." : document?.external_pdf_url ? "Remplacer le PDF" : "Importer mon bail"}<input type="file" accept="application/pdf" className="hidden" disabled={loading} onChange={(event) => uploadExternal(event.target.files?.[0])}/></label>
            <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><XMarkIcon className="h-4 w-4"/>Fermer</button>
          </div>
        </div>
      </Modal>
    );
  }
  if (document?.signed_pdf_url && !editingSignedLease) {
    return (
      <Modal onClose={onClose}>
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Bail signé</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Bail signé archivé avec succès</h2>
        </div>
        <div className="space-y-4 p-5">
          {err ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p> : null}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-950">Document enregistré</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">{document.original_file_name || "bail-signé.pdf"} · Le bail est archivé dans Lokt et accessible depuis la fiche.</p>
          </div>
          <p className="text-sm leading-6 text-slate-600">Le bail signé est archivé dans Lokt et accessible depuis la fiche bail.</p>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white"><XMarkIcon className="h-4 w-4"/>Fermer</button>
          <div className="flex flex-wrap gap-2">
            <a href={pdfSignedUrl ?? undefined} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold${!pdfSignedUrl ? " pointer-events-none opacity-50" : ""}`}><ArrowDownTrayIcon className="h-4 w-4"/>Ouvrir le bail signé</a>
            <button
              type="button"
              onClick={() => { setEditingSignedLease(true); setGeneratedDone(false); }}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              <PencilSquareIcon className="h-4 w-4" />
              Modifier ce bail (nouvelle signature requise)
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (generatedDone && document?.pdf_url) {
    const tenantEmailValid = isEmailLike(form.tenant_email);
    const coTenantHalfFilled = !!form.co_tenant_name !== !!form.co_tenant_email;
    const coTenantEmailValid = !form.co_tenant_email || isEmailLike(form.co_tenant_email);
    const coTenantReady = !!form.co_tenant_name && !!form.co_tenant_email && coTenantEmailValid;
    const canSendSignature = tenantEmailValid && !coTenantHalfFilled && coTenantEmailValid;
    return (
      <Modal onClose={onClose}>
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Contrat généré</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Le PDF du bail est prêt</h2>
        </div>
        <div className="space-y-4 p-5">
          {err ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p> : null}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-950">Génération terminée avec succès</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">Le document est archivé dans Lokt. Tu peux le rouvrir plus tard depuis cette fiche bail.</p>
          </div>
          {form.tenant_email ? (
            <div className="rounded-xl border border-[#635bff]/20 bg-[#635bff]/5 p-4">
              <p className="text-sm font-semibold text-slate-950">Signature électronique</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Envoie les liens de signature par email au bailleur, au locataire ({form.tenant_email})
                {coTenantReady ? ` et au co-locataire (${form.co_tenant_email})` : ""}. Chacun signera depuis son
                téléphone ou son ordinateur, sans compte lokt.fr.
              </p>
              {!tenantEmailValid ? (
                <p className="mt-2 text-xs leading-5 text-red-600">L'email du locataire ({form.tenant_email}) n'a pas un format valide.</p>
              ) : null}
              {coTenantHalfFilled ? (
                <p className="mt-2 text-xs leading-5 text-amber-700">
                  {form.co_tenant_name
                    ? `Un co-locataire (${form.co_tenant_name}) est renseigné mais sans email : il apparaîtra sur le PDF mais ne sera pas invité à signer tant que son email n'est pas ajouté.`
                    : `Un email de co-locataire est renseigné mais sans nom : ajoute son nom pour qu'il soit invité à signer.`}
                </p>
              ) : null}
              {form.co_tenant_email && form.co_tenant_name && !coTenantEmailValid ? (
                <p className="mt-2 text-xs leading-5 text-red-600">L'email du co-locataire ({form.co_tenant_email}) n'a pas un format valide.</p>
              ) : null}
              {sigError ? <p className="mt-2 text-xs text-red-600">{sigError}</p> : null}
              {sigSent ? (
                <p className="mt-2 text-xs font-semibold text-emerald-700">
                  Liens de signature envoyés ✓ — Vous recevrez le PDF certifié par email une fois{" "}
                  {coTenantReady ? "les trois signatures recueillies" : "les deux signatures recueillies"}.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={sigLoading || !canSendSignature}
                  onClick={sendForSignature}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#635bff] to-[#00d4ff] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {sigLoading ? "Envoi…" : "Envoyer pour signature électronique →"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Pour activer la signature électronique, renseigne l'e-mail du locataire à l'étape Parties.</p>
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><XMarkIcon className="h-4 w-4"/>Fermer</button>
          <div className="flex flex-wrap gap-2">
            <a href={pdfSignedUrl ?? undefined} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold${!pdfSignedUrl ? " pointer-events-none opacity-50" : ""}`}><ArrowDownTrayIcon className="h-4 w-4"/>Ouvrir le PDF</a>
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
      <div ref={contentRef} className="max-h-[68vh] overflow-auto p-5">
        {err ? <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p> : null}
        {pendingSignature ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Une demande de signature est en cours pour ce bail. Si vous modifiez puis régénérez le contrat, cette demande deviendra invalide — vous devrez en envoyer une nouvelle.
          </p>
        ) : null}
        {editingSignedLease ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Ce bail a déjà été signé. La version actuellement signée reste consultable dans l'historique de la location — en régénérant le
            PDF, vous créez une nouvelle version qui devra être signée à nouveau par toutes les parties (bailleur, locataire, et
            colocataire le cas échéant).
          </p>
        ) : null}
        {step > 0 ? <p className="mb-4 text-xs leading-5 text-slate-500"><span className="font-bold text-red-600">*</span> Information obligatoire pour établir le contrat de location avec ce modèle.</p> : null}
        {step === 0 ? <StepType kind={kind} setKind={setKind} isCompanyTenant={isCompanyTenant} /> : null}
        {step === 1 ? (
          <>
            {form.landlord_name && form.landlord_address && form.tenant_name && !editingParties ? (
              <PrefilledParties
                landlordName={form.landlord_name}
                landlordAddress={form.landlord_address}
                tenantName={form.tenant_name}
                tenantEmail={form.tenant_email}
                coTenantName={form.co_tenant_name}
                coTenantEmail={form.co_tenant_email}
                onEdit={() => setEditingParties(true)}
              />
            ) : (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-indigo-700">
                    <HomeModernIcon className="h-3.5 w-3.5" aria-hidden="true" /> Bailleur
                  </p>
                  <Fields
                    form={form}
                    set={set}
                    required={requiredFieldsForStep(step, kind, form)}
                    invalid={invalidFields}
                    columns={1}
                    names={[["landlord_name","Nom du bailleur"],["landlord_address","Adresse du bailleur"]]}
                  />
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/50 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-cyan-700">
                    <UserIcon className="h-3.5 w-3.5" aria-hidden="true" /> Locataire
                  </p>
                  <Fields
                    form={form}
                    set={set}
                    required={requiredFieldsForStep(step, kind, form)}
                    invalid={invalidFields}
                    columns={1}
                    names={[["tenant_name","Nom du locataire (ou 1er locataire)"],["tenant_email","E-mail du locataire"]]}
                    fieldErrors={{ tenant_email: "Format d'email invalide (ex : nom@domaine.fr)." }}
                  />
                </div>
              </div>
            )}
            {kind === "empty_primary" ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <Checks form={form} set={set} names={[["landlord_is_company","Le bailleur est une personne morale (SCI, SARL...)"]]} />
                <p className="text-xs leading-5 text-slate-500">
                  La durée minimale d'un bail nu est de 3 ans pour un bailleur personne physique, 6 ans pour une personne morale (art. 10 loi du 6 juillet 1989).
                </p>
              </div>
            ) : null}
            <CollapsibleExtra
              label={form.co_tenant_name || form.co_tenant_email || form.mandataire_name || form.mandataire_address ? "Co-locataire ou mandataire" : "Ajouter un co-locataire ou un mandataire (optionnel)"}
              defaultOpen={!!(form.co_tenant_name || form.co_tenant_email || form.mandataire_name || form.mandataire_address)}
            >
              <Fields
                form={form}
                set={set}
                invalid={invalidFields}
                fieldErrors={{
                  co_tenant_name: "Ajoute aussi son email, sinon il ne sera pas invité à signer.",
                  co_tenant_email: !form.co_tenant_name
                    ? "Ajoute aussi son nom, sinon il ne sera pas invité à signer."
                    : "Format d'email invalide (ex : nom@domaine.fr).",
                }}
                names={[["co_tenant_name","Co-locataire (si applicable)"],["co_tenant_email","E-mail du co-locataire (pour la signature électronique)"],["mandataire_name","Mandataire / gestionnaire (si applicable)"],["mandataire_address","Adresse du mandataire"]]}
              />
            </CollapsibleExtra>
            <CollapsibleExtra
              label={form.garant_name || form.garant_address ? "Garant / caution" : "Ajouter un garant / une caution (optionnel)"}
              defaultOpen={!!(form.garant_name || form.garant_address)}
            >
              <Fields form={form} set={set} names={[["garant_name","Nom du garant"],["garant_address","Adresse du garant"]]} />
            </CollapsibleExtra>
            <CollapsibleExtra
              label={form.landlord_phone || form.tenant_phone ? "Numéros de téléphone portable" : "Ajouter les numéros de téléphone portable (optionnel)"}
              defaultOpen={!!(form.landlord_phone || form.tenant_phone)}
            >
              <Fields form={form} set={set} names={[["landlord_phone","Téléphone portable du bailleur"],["tenant_phone","Téléphone portable du locataire"]]} />
            </CollapsibleExtra>
          </>
        ) : null}
        {step === 2 ? (
          <>
            {form.property_address_line1 && form.property_postal_code && form.property_city && !editingAddress ? (
              <PrefilledSummary
                lines={[`📍 ${[form.property_address_line1, form.property_address_line2].filter(Boolean).join(", ")}, ${form.property_postal_code} ${form.property_city}`]}
                onEdit={() => setEditingAddress(true)}
              />
            ) : (
              <Fields
                form={form}
                set={set}
                required={requiredFieldsForStep(step, kind, form)}
                invalid={invalidFields}
                names={[["property_address_line1","Numéro et nom de rue"],["property_address_line2","Complément d’adresse"],["property_postal_code","Code postal"],["property_city","Ville"],["property_country","Pays","select",[["FR","France"],["GP","Guadeloupe"],["MQ","Martinique"],["GF","Guyane"],["RE","La Réunion"],["YT","Mayotte"]]]]}
              />
            )}
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Description du logement</p>
            <Fields
              form={form}
              set={set}
              required={requiredFieldsForStep(step, kind, form)}
              invalid={invalidFields}
              names={[["housing_nature","Nature du logement","select",["Appartement","Studio","F1","F2","F3","F4","F5 ou plus","Maison","Pavillon","Villa","Autre"]],["housing_type","Type d’habitat","select",["Immeuble collectif","Maison individuelle"]],["floor","Étage (ex : RDC, 2e…)"],["legal_regime","Régime juridique de l’immeuble","select",["Copropriété","Monopropriété"],"Copropriété : plusieurs propriétaires se partagent l'immeuble avec un règlement commun. Monopropriété : un seul propriétaire possède tout l'immeuble."],["lot_number","Numéro de lot (copropriété)"],["building_period","Période de construction","select",["Avant 1949","De 1949 à 1974","De 1975 à 1989","De 1989 à 2005","Depuis 2005"],"Indiquée sur le diagnostic de performance énergétique (DPE) ou l'acte de propriété."],["surface_m2","Surface habitable (m²)"],["main_rooms","Nombre de pièces principales"],["destination","Destination du logement","select",["Usage d’habitation","Usage mixte professionnel et habitation","Usage exclusivement professionnel"],"Choisissez \"usage mixte\" si le logement sert aussi à une activité professionnelle du locataire, ou \"exclusivement professionnel\" pour un bail professionnel."]]}
            />
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Confort &amp; équipements</p>
            <Fields
              form={form}
              set={set}
              required={requiredFieldsForStep(step, kind, form)}
              invalid={invalidFields}
              names={[["heating_method","Mode de chauffage","select",["Individuel électrique","Individuel gaz","Individuel autre","Collectif"]],["hot_water_method","Production d’eau chaude sanitaire","select",["Individuelle électrique","Individuelle gaz","Individuelle autre","Collective"]],["ict_equipment","Accès internet, TV et communications","text",[],"Précisez ce qui est déjà raccordé : fibre, ADSL, prise TV, interphone/visiophone... Laissez vide si rien n'est prévu."],["other_parts","Autres parties du logement"],["private_equipment","Équipements privatifs"],["common_equipment","Équipements communs"],["furniture_inventory","Mobilier principal"]]}
            />
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Diagnostics &amp; fiscalité</p>
            <Fields
              form={form}
              set={set}
              required={requiredFieldsForStep(step, kind, form)}
              invalid={invalidFields}
              names={[["fiscal_property_id","Identifiant fiscal du logement","text",[],"Numéro à 15 caractères attribué par l'administration fiscale — disponible sur votre avis de taxe foncière ou sur impots.gouv.fr."],["dpe_class","Classe DPE (étiquette énergie)","select",["A","B","C","D","E","F","G","Vierge / non soumis"],"Étiquette énergie du logement (de A, très performant, à G, passoire thermique), indiquée sur le diagnostic de performance énergétique."],["energy_kwh_sqm","Consommation énergétique (kWh/m²/an)"],["ges_class","Classe GES (émissions CO₂)","select",["A","B","C","D","E","F","G","Non soumis"],"Étiquette climat du logement selon ses émissions de gaz à effet de serre, indiquée sur le même diagnostic que le DPE."],["ges_kgco2_sqm","Émissions GES (kg CO₂/m²/an)"]]}
            />
            <p className="mt-3 text-xs leading-5 text-slate-500">Le DPE et la classe GES sont obligatoires depuis la loi Climat du 22 août 2021. L’identifiant fiscal du logement est requis depuis le 1er janvier 2025, sauf DOM.</p>
          </>
        ) : null}
        {step === 3 ? (
          <Fields
            form={form}
            set={set}
            required={requiredFieldsForStep(step, kind, form)}
            invalid={invalidFields}
            names={[
              ["start_date","Date de prise d’effet","date"],
              ["end_date","Date de fin","date",[],"Pré-rempli à 1 an après la prise d'effet — modifiable selon la durée réellement convenue avec le locataire."],
              ["mobility_reason","Motif d’éligibilité au bail mobilité","text",[],"Motif obligatoire pour ce type de bail : formation professionnelle, études, stage, apprentissage, mission temporaire, mutation ou service civique."],
            ]}
          />
        ) : null}
        {step === 4 ? (() => {
          const rentNum = Number(form.rent_amount) || 0;
          const depositCap = depositCapForKind(kind, rentNum);
          const isPaymentOther = !!form.payment_method && !["Virement", "Chèque"].includes(form.payment_method);
          return (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Loyer &amp; charges</p>
              <Fields
                form={form}
                set={set}
                required={requiredFieldsForStep(step, kind, form)}
                invalid={invalidFields}
                names={[["rent_amount","Loyer mensuel hors charges","number",[],"Montant du loyer seul, sans les charges, tel que convenu avec le locataire."],["charges_amount","Charges mensuelles","number",[],"Provision mensuelle en plus du loyer pour couvrir les charges (eau, entretien commun...), régularisée chaque année sur justificatifs."]]}
              />

              <div
                id="charges_type"
                className={`mb-4 mt-3 rounded-xl p-2 ${invalidFields.has("charges_type") ? "border border-red-300 bg-red-50" : ""}`}
              >
                <label className="text-xs font-semibold text-slate-700">
                  Nature des charges<span className="ml-1 font-bold text-red-600">*</span>
                </label>
                <div className="mt-2">
                  <ButtonGroup
                    value={form.charges_type}
                    onChange={(v: string) => set("charges_type", v)}
                    options={[
                      ["Provision sur charges récupérables (régularisation annuelle)", "Provision (régularisation annuelle)"],
                      ["Forfait de charges (meublé uniquement)", "Forfait (meublé uniquement)"],
                    ]}
                  />
                </div>
              </div>

              <div
                id="payment_method"
                className={`mb-4 rounded-xl p-2 ${invalidFields.has("payment_method") ? "border border-red-300 bg-red-50" : ""}`}
              >
                <label className="text-xs font-semibold text-slate-700">
                  Modalité de paiement<span className="ml-1 font-bold text-red-600">*</span>
                </label>
                <div className="mt-2">
                  <ButtonGroup
                    value={isPaymentOther ? "Autre" : form.payment_method}
                    onChange={(v: string) => set("payment_method", v === "Autre" ? "" : v)}
                    options={["Virement", "Chèque", "Autre"]}
                  />
                </div>
                {isPaymentOther || form.payment_method === "" ? (
                  <input
                    type="text"
                    placeholder="Préciser (ex : espèces, prélèvement...)"
                    value={isPaymentOther ? form.payment_method : ""}
                    onChange={(e) => set("payment_method", e.target.value)}
                    className={`${input} mt-2`}
                  />
                ) : null}
              </div>

              <Fields
                form={form}
                set={set}
                required={requiredFieldsForStep(step, kind, form)}
                invalid={invalidFields}
                names={[["payment_day","Jour de paiement (1 à 31)","number",[],"Jour du mois où le locataire doit vous régler le loyer, par exemple le 5 de chaque mois."]]}
              />

              {kind === "mobility" ? (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  Le bail mobilité ne peut pas comporter de dépôt de garantie — c'est interdit par la loi.
                </p>
              ) : (
                <div id="deposit_amount" className="mb-4">
                  <label className="text-xs font-semibold text-slate-700">
                    Dépôt de garantie (€)<span className="ml-1 font-bold text-red-600">*</span>
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {depositCap != null ? (
                      <button
                        type="button"
                        onClick={() => set("deposit_amount", depositCap)}
                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${Number(form.deposit_amount) === depositCap ? "border-[#635bff] bg-[#635bff]/10 text-[#635bff]" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}
                      >
                        {depositCap === rentNum ? "1 mois de loyer (max légal)" : "2 mois de loyer (max légal)"}
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="number"
                    value={form.deposit_amount ?? ""}
                    onChange={(e) => set("deposit_amount", e.target.value)}
                    placeholder="Montant en €"
                    className={`${invalidFields.has("deposit_amount") ? input.replace("border-slate-300", "border-red-400") + " ring-1 ring-red-300" : input} mt-2 max-w-xs`}
                  />
                  {depositCap != null ? (
                    <p className="mt-1 text-xs text-slate-500">Maximum légal pour ce type de bail : {depositCap.toLocaleString("fr-FR")} €.</p>
                  ) : kind === "professional" ? (
                    <p className="mt-1 text-xs text-slate-500">Pas de plafond légal pour un bail professionnel — l'usage courant est de 2 mois de loyer.</p>
                  ) : null}
                </div>
              )}

              <InfoToggle
                title="Révision annuelle du loyer"
                info={
                  kind === "professional"
                    ? "Le loyer d'un bail professionnel est libre : la révision n'est pas une obligation légale, mais une clause d'indexation contractuelle. L'indice usuel est l'ILAT (indice des loyers des activités tertiaires), publié par l'INSEE."
                    : "La clause de révision de loyer est prévue par le bail type. Elle s'applique automatiquement à la date anniversaire du bail (hors logements classés F ou G au DPE, où la révision est interdite). Vous pourrez la désactiver si vous ne souhaitez pas l'appliquer."
                }
                value={form.rent_revision_enabled}
                onChange={(v: boolean) => set("rent_revision_enabled", v)}
              >
                <Fields
                  form={form}
                  set={set}
                  required={requiredFieldsForStep(step, kind, form)}
                  invalid={invalidFields}
                  names={[[
                    "irl_reference",
                    kind === "professional" ? "Référence ILAT" : "Trimestre de référence IRL",
                    "text",
                    [],
                    kind === "professional"
                      ? "Valeur de l'indice ILAT en vigueur à la date de signature — publié chaque trimestre par l'INSEE."
                      : "Pré-rempli à titre indicatif avec le trimestre en cours à la date de début du bail. L'INSEE publie l'indice avec un peu de retard : vérifiez la valeur exacte en vigueur à la signature sur insee.fr avant de valider.",
                  ]]}
                />
              </InfoToggle>

              {kind !== "professional" ? (
                <InfoToggle
                  title="Le logement est-il en zone d'encadrement des loyers ?"
                  info="Concerne : Paris, Plaine Commune, Est Ensemble, Lille, Hellemmes, Lomme, Lyon, Villeurbanne, Montpellier, Bordeaux, certaines villes du Pays Basque, et Grenoble-Alpes-Métropole. Si le bien n'est pas concerné, laissez sur Non."
                  value={form.rent_controlled_area}
                  onChange={(v: boolean) => set("rent_controlled_area", v)}
                >
                  <Fields
                    form={form}
                    set={set}
                    required={requiredFieldsForStep(step, kind, form)}
                    invalid={invalidFields}
                    names={[["reference_rent","Loyer de référence","number",[],"Loyer de référence fixé par arrêté préfectoral pour la zone — disponible sur le site de la mairie ou de la préfecture."],["reference_rent_increased","Loyer de référence majoré","number",[],"Plafond légal du loyer pour la zone : le loyer réel ne peut pas le dépasser (hors complément de loyer justifié)."]]}
                  />
                </InfoToggle>
              ) : null}

              <CollapsibleExtra
                label={form.previous_rent || form.previous_tenant_departure_date ? "Précédent locataire" : "Informations sur le précédent locataire (optionnel)"}
                defaultOpen={!!(form.previous_rent || form.previous_tenant_departure_date)}
              >
                <Fields form={form} set={set} names={[["previous_rent","Dernier loyer appliqué","number"],["previous_tenant_departure_date","Date de départ du précédent locataire","date"]]} />
              </CollapsibleExtra>
            </>
          );
        })() : null}
        {step === 5 ? <><Fields form={form} set={set} names={[["recent_works","Travaux récents"],["estimated_energy_cost","Estimation annuelle des dépenses d’énergie","number"],["energy_reference_year","Année de référence de l’estimation énergétique"],["tenant_agency_fees","Honoraires imputés au locataire","number"],["tenant_inventory_fees","Honoraires d’état des lieux imputés au locataire","number"],["rent_supplement","Complément de loyer","number"],["rent_supplement_reason","Justification du complément de loyer"],["special_terms","Clauses particulières"]]} /><Checks form={form} set={set} names={[["annual_insurance_clause", kind === "professional" ? "Clause assurance des locaux professionnels annuelle (recommandée)" : "Clause assurance habitation annuelle (recommandée)"]]} />
        {["empty_primary","furnished_primary","furnished_student"].includes(kind) ? (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <Checks form={form} set={set} names={[["primary_residence_servitude","Ce logement est soumis à la servitude de résidence principale (art. L.151-14-1 code de l'urbanisme)"]]} />
            <p className="text-xs leading-5 text-slate-500">
              Concerne certains logements neufs dans des communes/zones délimitées par le PLU. Si vous n'êtes pas concerné, laissez décoché.
            </p>
          </div>
        ) : null}
        </> : null}
        {step === 6 ? <><AnnexChecks form={form} set={set} /><Fields form={form} set={set} required={requiredFieldsForStep(step, kind, form)} invalid={invalidFields} names={[["signature_place","Lieu de signature"],["signature_date","Date de signature","date"]]} /></> : null}
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {step > 0 ? <button type="button" disabled={loading} onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><ArrowLeftIcon className="h-4 w-4"/>Précédent</button> : null}
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><XMarkIcon className="h-4 w-4"/>Fermer</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSourceMode("choose")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><ArrowLeftIcon className="h-4 w-4"/>Changer de méthode</button>
          {document?.pdf_url ? <a href={pdfSignedUrl ?? undefined} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold${!pdfSignedUrl ? " pointer-events-none opacity-50" : ""}`}><ArrowDownTrayIcon className="h-4 w-4"/>{document.signed_pdf_url ? "Ouvrir le bail signé" : "Ouvrir le PDF"}</a> : null}
          {step < 6 ?<button type="button" disabled={loading} onClick={next} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Suivant<ArrowRightIcon className="h-4 w-4"/></button> : <button type="button" disabled={loading} onClick={generate} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{loading ? "Génération..." : "Finaliser et générer le PDF"}</button>}
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: any) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl"><button type="button" onClick={onClose} title="Fermer" aria-label="Fermer" className="absolute right-3 top-3 z-10 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"><XMarkIcon className="h-5 w-5"/></button>{children}</div></div>; }
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
function Fields({ form, set, names, required = [], invalid, columns = 2, fieldErrors }: any) {
  const invalidSet: Set<string> = invalid || new Set();
  const errors: Record<string, string> = fieldErrors || {};
  return (
    <div className={`grid gap-3 ${columns === 1 ? "" : "sm:grid-cols-2"}`}>
      {names.map(([key, title, type = "text", options = [], hint]: any[]) => {
        const isInvalid = invalidSet.has(key);
        // Le halo de focus natif du navigateur (bleu) écrase visuellement une
        // bordure rouge classique dès qu'on clique dans le champ pour le
        // corriger — exactement le moment où on veut le plus que ça reste
        // visible. On force donc le focus lui-même à rester rouge.
        const fieldClass = isInvalid
          ? `${input.replace("border-slate-300", "border-red-400")} ring-1 ring-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-300`
          : input;
        return (
          <label key={key} id={key} className={label}>
            {title}
            {required.includes(key) ? <span className="ml-1 font-bold text-red-600">*</span> : null}
            {hint ? <InfoTip text={hint} /> : null}
            {type === "select" ? (
              <select value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} className={fieldClass}>
                <option value="">Sélectionner</option>
                {options.map((option: string | [string, string]) => {
                  const value = Array.isArray(option) ? option[0] : option;
                  const optionLabel = Array.isArray(option) ? option[1] : option;
                  return <option key={value} value={value}>{optionLabel}</option>;
                })}
              </select>
            ) : (
              <input type={type} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} className={fieldClass} />
            )}
            {isInvalid && errors[key] ? <span className="block text-[0.7rem] font-normal normal-case tracking-normal text-red-600">{errors[key]}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
function ButtonGroup({ value, onChange, options }: any) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt: string | [string, string]) => {
        const optValue = Array.isArray(opt) ? opt[0] : opt;
        const optLabel = Array.isArray(opt) ? opt[1] : opt;
        const selected = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(optValue)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              selected ? "border-[#635bff] bg-[#635bff]/10 text-[#635bff]" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}
function InfoToggle({ title, info, value, onChange, children }: any) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {info ? (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{info}</p>
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold ${value ? "border-[#635bff] bg-[#635bff]/10 text-[#635bff]" : "border-slate-300 bg-white text-slate-700"}`}
        >
          Oui
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold ${!value ? "border-[#635bff] bg-[#635bff]/10 text-[#635bff]" : "border-slate-300 bg-white text-slate-700"}`}
        >
          Non
        </button>
      </div>
      {value && children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
function PrefilledSummary({ lines, onEdit }: { lines: string[]; onEdit: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="min-w-0 space-y-0.5">
        {lines.map((line, i) => (
          <p key={i} className="truncate text-sm text-slate-800">{line}</p>
        ))}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-xs font-semibold text-[#635bff] underline underline-offset-2 hover:text-[#4f47cc]"
      >
        Modifier
      </button>
    </div>
  );
}
// Variante colorée de PrefilledSummary spécifique à Bailleur/Locataire — garde
// le même code couleur (indigo/cyan) que la vue d'édition juste à côté, pour
// que passer de l'un à l'autre reste lisible d'un coup d'œil.
function PrefilledParties({
  landlordName,
  landlordAddress,
  tenantName,
  tenantEmail,
  coTenantName,
  coTenantEmail,
  onEdit,
}: {
  landlordName: string;
  landlordAddress: string;
  tenantName: string;
  tenantEmail?: string;
  coTenantName?: string;
  coTenantEmail?: string;
  onEdit: () => void;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-slate-800">
          <HomeModernIcon className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
          <span className="truncate"><span className="font-semibold text-indigo-700">Bailleur</span> — {landlordName}, {landlordAddress}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-slate-800">
          <UserIcon className="h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" />
          <span className="truncate"><span className="font-semibold text-cyan-700">Locataire</span> — {tenantName}{tenantEmail ? ` · ${tenantEmail}` : ""}</span>
        </div>
        {coTenantName ? (
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-slate-800">
            <UsersIcon className="h-4 w-4 shrink-0 text-violet-600" aria-hidden="true" />
            <span className="truncate"><span className="font-semibold text-violet-700">Co-locataire</span> — {coTenantName}{coTenantEmail ? ` · ${coTenantEmail}` : ""}</span>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-xs font-semibold text-[#635bff] underline underline-offset-2 hover:text-[#4f47cc]"
      >
        Modifier
      </button>
    </div>
  );
}
function CollapsibleExtra({ label, children, defaultOpen = false }: any) {
  const [open, setOpen] = useState(defaultOpen);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-2 block text-left text-xs font-semibold text-[#635bff] underline underline-offset-2 hover:text-[#4f47cc]"
      >
        + {label}
      </button>
    );
  }
  return <div className="mb-4 space-y-3">{children}</div>;
}
function Checks({ form, set, names }: any) { return <div className="mb-4 grid gap-2 sm:grid-cols-2">{names.map(([key,title]: any[]) => <label key={key} className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!form[key]} onChange={(e) => set(key,e.target.checked)}/>{title}</label>)}</div>; }
function AnnexChecks({ form, set }: any) { const names = [["annex_notice","Notice d’information","À remettre au locataire avec le bail."],["annex_diagnostics","Diagnostics dont DPE","Coche si le dossier de diagnostics applicable sera joint."],["annex_inventory_report","État des lieux d’entrée","À joindre une fois réalisé avec le locataire."],["annex_furniture","Inventaire du mobilier","À joindre pour une location meublée."],["annex_copro","Extrait de copropriété","À joindre si le logement est en copropriété."],["annex_insurance","Assurance habitation","Attestation à récupérer auprès du locataire."]]; return <div className="mb-5"><p className="text-sm font-semibold text-slate-950">Annexes à prévoir avec le contrat</p><p className="mt-1 text-xs leading-5 text-slate-600">Ces cases servent de pense-bête avant signature. Elles n’ajoutent pas automatiquement les documents au PDF.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{names.map(([key,title,description]) => <label key={key} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={!!form[key]} onChange={(e) => set(key,e.target.checked)}/><span><span className="block font-semibold text-slate-900">{title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span></span></label>)}</div></div>; }
function StepType({ kind, setKind, isCompanyTenant }: any) {
  const allOptions = [
    { value: "empty_primary", title: "Location vide", desc: "Résidence principale, non meublé — 3 ans", icon: HomeIcon },
    { value: "furnished_primary", title: "Meublé résidence principale", desc: "Cas LMNP classique — 1 an reconduit tacitement", icon: HomeModernIcon },
    { value: "furnished_student", title: "Meublé étudiant", desc: "9 mois, non reconductible", icon: AcademicCapIcon },
    { value: "mobility", title: "Bail mobilité", desc: "1 à 10 mois, sans dépôt de garantie", icon: ArrowsRightLeftIcon },
    { value: "professional", title: "Bail professionnel", desc: "Profession libérale — locaux exclusivement professionnels", icon: BriefcaseIcon },
  ];
  const options = isCompanyTenant ? allOptions.filter((o) => o.value === "professional") : allOptions;
  return (
    <div className="space-y-3">
      {isCompanyTenant ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Locataire professionnel (personne morale) : seul le bail professionnel est disponible pour ce locataire.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(({ value, title, desc, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
              kind === value ? "border-[#635bff] bg-[#635bff]/5 ring-1 ring-[#635bff]/20" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kind === value ? "bg-gradient-to-br from-[#635bff] to-[#00d4ff] text-white" : "bg-slate-100 text-slate-500"}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-950">{title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-500">{desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
function Choice({ icon: Icon, title, description, onClick }: any) { return <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-400 hover:bg-slate-50"><Icon className="h-6 w-6 text-slate-700"/><span className="mt-3 block text-sm font-semibold text-slate-950">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span></button>; }
