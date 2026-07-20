import { useEffect, useMemo, useState } from "react";
import { ArrowDownTrayIcon, ChevronDownIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";

type Props = { userId: string; leaseId: string; onComplete: () => void; onBack?: () => void };

const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";
const labelClass = "space-y-1 text-xs font-semibold text-slate-700";

const KIND_OPTIONS: Array<[string, string]> = [
  ["empty_primary", "Location vide"],
  ["furnished_primary", "Meublé résidence principale"],
  ["furnished_student", "Meublé étudiant 9 mois"],
  ["mobility", "Bail mobilité"],
];
const KIND_LABELS: Record<string, string> = Object.fromEntries(KIND_OPTIONS);

function fiscalIdRequired(country?: string) {
  return !["GP", "MQ", "GF", "RE", "YT"].includes(String(country || "FR").toUpperCase());
}

// Plafond légal du dépôt de garantie selon le type de bail.
function depositCapForKind(kind: string, rent: number): number | null {
  if (kind === "mobility") return 0;
  if (kind === "furnished_primary" || kind === "furnished_student") return rent * 2;
  if (kind === "empty_primary") return rent;
  return null;
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
function defaultEndDate(startDate?: string): string {
  const base = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  const end = new Date(base);
  end.setFullYear(end.getFullYear() + 1);
  return end.toISOString().slice(0, 10);
}

// Le trimestre de référence IRL correspond en général au trimestre en cours
// à la prise d'effet du bail — on le pré-calcule pour éviter que l'utilisateur
// ne doive deviner une valeur qu'il ne connaît pas.
function defaultIrlQuarter(startDate?: string): string {
  const d = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const labels = ["1er", "2e", "3e", "4e"];
  const quarter = Math.floor(d.getMonth() / 3);
  return `${labels[quarter]} trimestre ${d.getFullYear()}`;
}

// Tous les champs légalement requis pour générer un bail, tous groupes confondus —
// utilisé à la fois pour la barre de progression (live) et pour la validation finale.
function requiredFields(kind: string, form: Record<string, any>) {
  return [
    "landlord_name", "landlord_address", "tenant_name",
    "property_address_line1", "property_postal_code", "property_city",
    "housing_nature", "housing_type", "legal_regime", "building_period",
    "surface_m2", "main_rooms", "heating_method", "hot_water_method",
    ...(fiscalIdRequired(form.property_country) ? ["fiscal_property_id"] : []),
    "destination", "ict_equipment", "dpe_class", "ges_class",
    "start_date", "end_date",
    ...(kind === "mobility" ? ["mobility_reason"] : []),
    "rent_amount", "charges_amount",
    ...(kind === "mobility" ? [] : ["deposit_amount"]),
    "payment_method", "payment_day", "charges_type",
    ...(form.rent_revision_enabled ? ["irl_reference"] : []),
    ...(form.rent_controlled_area ? ["reference_rent", "reference_rent_increased"] : []),
    "signature_place", "signature_date",
  ];
}

function missingRequiredFields(kind: string, form: Record<string, any>) {
  return requiredFields(kind, form).filter((key) => String(form[key] ?? "").trim() === "");
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

export function LeaseContractOnboarding({ userId, leaseId, onComplete, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [document, setDoc] = useState<any>(null);
  const [generatedDone, setGeneratedDone] = useState(false);
  const [kind, setKind] = useState("furnished_primary");
  const [editingKind, setEditingKind] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [sigLoading, setSigLoading] = useState(false);
  const [sigSent, setSigSent] = useState(false);
  const [sigError, setSigError] = useState<string | null>(null);
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [editingParties, setEditingParties] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [goingBack, setGoingBack] = useState(false);

  const set = (key: string, value: any) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      return key.startsWith("property_") ? { ...next, property_address: propertyAddress(next) } : next;
    });
    if (invalidFields.has(key)) {
      setInvalidFields((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

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
        setDoc(existing || null);
        // Le type de bail a déjà été choisi à l'étape "Créer la location" — on ne
        // repose la question que s'il n'a jamais été vraiment tranché ("other").
        const resolvedKind = existing?.contract_kind || (lease.lease_kind && lease.lease_kind !== "other" ? lease.lease_kind : "") || "furnished_primary";
        setKind(resolvedKind);
        setEditingKind(!existing?.contract_kind && (!lease.lease_kind || lease.lease_kind === "other"));
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
          housing_nature: ({ apartment: "Appartement", house: "Maison" } as Record<string, string>)[property.type] || "",
          housing_type: property.type === "house" ? "Maison individuelle" : "Immeuble collectif",
          legal_regime: "",
          floor: "",
          lot_number: "",
          surface_m2: property.surface_m2 != null ? String(property.surface_m2) : "",
          main_rooms: property.rooms != null ? String(property.rooms) : "",
          other_parts: "",
          private_equipment: "",
          common_equipment: "",
          ict_equipment: "",
          destination: "Usage d’habitation",
          building_period: "",
          heating_method: "",
          hot_water_method: "",
          fiscal_property_id: "",
          dpe_class: property.energy_class || "",
          ges_class: property.ghg_class || "",
          energy_kwh_sqm: property.energy_value != null ? String(property.energy_value) : "",
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
          co_tenant_name: "",
          mandataire_name: "",
          mandataire_address: "",
          annual_insurance_clause: true,
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

  useEffect(() => {
    // Dépend de pdf_url (pas seulement de l'id) : generate() met à jour le même
    // document (id inchangé) une fois le PDF prêt — sans ça l'effet ne se
    // redéclenchait jamais et "Ouvrir le PDF" restait grisé indéfiniment.
    if (!document?.pdf_url) return;
    (async () => {
      try {
        const data = await fetch(
          `/api/lease-contracts/pdf-url?userId=${encodeURIComponent(userId)}&documentId=${encodeURIComponent(document.id)}`,
          { headers: await headers() }
        ).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
        setPdfSignedUrl(data.signedUrl);
      } catch { /* silencieux — le lien restera désactivé */ }
    })();
  }, [document?.pdf_url, document?.id, userId]);

  const progressPct = useMemo(() => {
    const all = requiredFields(kind, form);
    if (!all.length) return 0;
    const done = all.filter((key) => String(form[key] ?? "").trim() !== "").length;
    return Math.round((done / all.length) * 100);
  }, [kind, form]);

  const save = async () => {
    const data = await api("/api/lease-contracts", { action: "save", userId, leaseId, contractKind: kind, formData: form });
    setDoc(data.document);
    return data.document;
  };

  const handleBack = async () => {
    if (!onBack) return;
    setGoingBack(true);
    try {
      // Sans cette sauvegarde, revenir en arrière démonte le formulaire et perd
      // toute saisie non enregistrée (le formulaire ne s'auto-sauvegarde pas).
      await save();
    } catch {
      // On laisse quand même repartir en arrière — mieux vaut perdre la sauvegarde
      // que bloquer l'utilisateur sur une erreur réseau ponctuelle.
    } finally {
      setGoingBack(false);
      onBack();
    }
  };

  const generate = async () => {
    try {
      setLoading(true); setErr(null);
      const missing = missingRequiredFields(kind, form);
      if (missing.length) {
        setInvalidFields(new Set(missing));
        setErr("Complétez les champs surlignés en rouge ci-dessous.");
        setTimeout(() => {
          window.document.getElementById(missing[0])?.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 50);
        return;
      }
      setInvalidFields(new Set());
      const saved = await save();
      const data = await api("/api/lease-contracts/generate", { userId, documentId: saved.id });
      setDoc(data.document);
      setGeneratedDone(true);
    } catch (error: any) { setErr(error?.message || "Génération impossible."); } finally { setLoading(false); }
  };

  const sendForSignature = async () => {
    if (!document?.pdf_url || !form.tenant_email) return;
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
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) { setSigSent(true); return; }
      if (!res.ok) throw new Error(json?.error || "Erreur lors de l'envoi.");
      setSigSent(true);
    } catch (e: any) {
      setSigError(e?.message || "Envoi impossible.");
    } finally {
      setSigLoading(false);
    }
  };

  if (loading && !Object.keys(form).length) {
    return <p className="text-sm text-slate-600">Chargement…</p>;
  }

  const handleLeaveClick = () => {
    if (sigSent) { onComplete(); return; }
    setShowLeaveConfirm(true);
  };

  if (generatedDone && document?.pdf_url) {
    return (
      <div>
        {showLeaveConfirm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              <p className="text-sm font-semibold text-slate-950">Le bail n'a pas encore été envoyé en signature</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Pas de souci, le contrat reste enregistré dans lokt.fr. Pour l'envoyer en signature électronique plus tard : ouvrez{" "}
                <strong>Locations</strong>, sélectionnez ce bail, puis cliquez sur <strong>Contrat</strong> →{" "}
                <strong>Envoyer pour signature électronique</strong>.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Rester ici
                </button>
                <button
                  type="button"
                  onClick={onComplete}
                  className="rounded-lg bg-gradient-to-r from-[#635bff] to-[#00d4ff] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  Compris, continuer →
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <h2 className="text-xl font-semibold text-slate-950">Le PDF du bail est prêt</h2>
        <p className="mt-1 text-sm text-slate-600">Le contrat a été généré et archivé dans lokt.fr.</p>
        {err ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p> : null}
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-950">Génération terminée avec succès</p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">Le document est archivé dans lokt.fr. Vous pourrez le rouvrir plus tard depuis la fiche bail.</p>
        </div>
        {form.tenant_email ? (
          <div className="mt-4 rounded-xl border border-[#635bff]/20 bg-[#635bff]/5 p-4">
            <p className="text-sm font-semibold text-slate-950">Signature électronique</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Envoyez les liens de signature par email au bailleur et au locataire ({form.tenant_email}). Chacun signera depuis son téléphone ou son ordinateur, sans compte lokt.fr.</p>
            {sigError ? <p className="mt-2 text-xs text-red-600">{sigError}</p> : null}
            {sigSent ? (
              <p className="mt-2 text-xs font-semibold text-emerald-700">Liens de signature envoyés ✓ — Vous recevrez le PDF certifié par email une fois les deux signatures recueillies.</p>
            ) : (
              <button
                type="button"
                disabled={sigLoading}
                onClick={sendForSignature}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#635bff] to-[#00d4ff] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {sigLoading ? "Envoi…" : "Envoyer pour signature électronique →"}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500">Pour activer la signature électronique, renseignez l'e-mail du locataire dans la fiche locataire.</p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <a
            href={pdfSignedUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold${!pdfSignedUrl ? " pointer-events-none opacity-50" : ""}`}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />Ouvrir le PDF
          </a>
          <button
            type="button"
            onClick={handleLeaveClick}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-gradient-to-r from-[#635bff] to-[#00d4ff] px-6 text-sm font-semibold text-white shadow-md shadow-indigo-100 hover:opacity-90"
          >
            Aller à mon tableau de bord →
          </button>
        </div>
      </div>
    );
  }

  const rentNum = Number(form.rent_amount) || 0;
  const depositCap = depositCapForKind(kind, rentNum);
  const isPaymentOther = !!form.payment_method && !["Virement", "Chèque"].includes(form.payment_method);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-5">
        {onBack ? (
          <button
            type="button"
            onClick={handleBack}
            disabled={goingBack}
            className="mb-2 text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700 disabled:opacity-50"
          >
            {goingBack ? "Enregistrement…" : "← Précédent"}
          </button>
        ) : null}
        <h2 className="text-xl font-semibold text-slate-950">Créons votre contrat de bail</h2>
        <p className="mt-1 text-sm text-slate-600">Toutes les informations légales nécessaires, en une seule page.</p>
      </div>

      {err ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}

      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-[#635bff] to-[#00d4ff] transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="mt-6 space-y-8">

            <SectionBlock title="Type de bail" index={1}>
              {!editingKind ? (
                <PrefilledSummary lines={[KIND_LABELS[kind] || kind]} onEdit={() => setEditingKind(true)} />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {KIND_OPTIONS.map(([value, title]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setKind(value);
                        setEditingKind(false);
                      }}
                      className={`rounded-xl border p-4 text-left text-sm font-semibold ${kind === value ? "border-slate-900 bg-slate-100" : "border-slate-200"}`}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              )}
            </SectionBlock>

            <SectionBlock title="Parties" index={2}>
              {form.landlord_name && form.landlord_address && form.tenant_name && !editingParties ? (
                <PrefilledSummary
                  lines={[
                    `Bailleur : ${form.landlord_name}, ${form.landlord_address}`,
                    `Locataire : ${form.tenant_name}${form.tenant_email ? " · " + form.tenant_email : ""}`,
                  ]}
                  onEdit={() => setEditingParties(true)}
                />
              ) : (
                <Fields
                  form={form}
                  set={set}
                  required={requiredFields(kind, form)}
                  invalid={invalidFields}
                  names={[["landlord_name", "Nom du bailleur"], ["landlord_address", "Adresse du bailleur"], ["tenant_name", "Nom du locataire (ou 1er locataire)"], ["tenant_email", "E-mail du locataire"]]}
                />
              )}
              <CollapsibleExtra label="Ajouter un co-locataire ou un mandataire (optionnel)">
                <Fields form={form} set={set} names={[["co_tenant_name", "Co-locataire (si applicable)"], ["mandataire_name", "Mandataire / gestionnaire (si applicable)"], ["mandataire_address", "Adresse du mandataire"]]} />
              </CollapsibleExtra>
            </SectionBlock>

            <SectionBlock title="Logement" index={3}>
              {form.property_address_line1 && form.property_postal_code && form.property_city && !editingAddress ? (
                <PrefilledSummary
                  lines={[`📍 ${[form.property_address_line1, form.property_address_line2].filter(Boolean).join(", ")}, ${form.property_postal_code} ${form.property_city}`]}
                  onEdit={() => setEditingAddress(true)}
                />
              ) : (
                <Fields
                  form={form}
                  set={set}
                  required={requiredFields(kind, form)}
                  invalid={invalidFields}
                  names={[["property_address_line1", "Numéro et nom de rue"], ["property_address_line2", "Complément d’adresse"], ["property_postal_code", "Code postal"], ["property_city", "Ville"], ["property_country", "Pays", "select", [["FR", "France"], ["GP", "Guadeloupe"], ["MQ", "Martinique"], ["GF", "Guyane"], ["RE", "La Réunion"], ["YT", "Mayotte"]]]]}
                />
              )}
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Description du logement</p>
              <Fields
                form={form}
                set={set}
                required={requiredFields(kind, form)}
                invalid={invalidFields}
                names={[["housing_nature", "Nature du logement", "select", ["Appartement", "Studio", "F1", "F2", "F3", "F4", "F5 ou plus", "Maison", "Pavillon", "Villa", "Autre"]], ["housing_type", "Type d’habitat", "select", ["Immeuble collectif", "Maison individuelle"]], ["floor", "Étage (ex : RDC, 2e…)"], ["legal_regime", "Régime juridique de l’immeuble", "select", ["Copropriété", "Monopropriété"], "Copropriété : plusieurs propriétaires se partagent l'immeuble avec un règlement commun. Monopropriété : un seul propriétaire possède tout l'immeuble."], ["lot_number", "Numéro de lot (copropriété)"], ["building_period", "Période de construction", "select", ["Avant 1949", "De 1949 à 1974", "De 1975 à 1989", "De 1989 à 2005", "Depuis 2005"], "Indiquée sur le diagnostic de performance énergétique (DPE) ou l'acte de propriété."], ["surface_m2", "Surface habitable (m²)"], ["main_rooms", "Nombre de pièces principales"], ["destination", "Destination du logement", "select", ["Usage d’habitation", "Usage mixte professionnel et habitation"], "Choisissez \"usage mixte\" si le logement sert aussi à une activité professionnelle du locataire."]]}
              />
              <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Confort &amp; équipements</p>
              <Fields
                form={form}
                set={set}
                required={requiredFields(kind, form)}
                invalid={invalidFields}
                names={[["heating_method", "Mode de chauffage", "select", ["Individuel électrique", "Individuel gaz", "Individuel autre", "Collectif"]], ["hot_water_method", "Production d’eau chaude sanitaire", "select", ["Individuelle électrique", "Individuelle gaz", "Individuelle autre", "Collective"]], ["ict_equipment", "Accès internet, TV et communications", "text", [], "Précisez ce qui est déjà raccordé : fibre, ADSL, prise TV, interphone/visiophone... Laissez vide si rien n'est prévu."], ["other_parts", "Autres parties du logement"], ["private_equipment", "Équipements privatifs"], ["common_equipment", "Équipements communs"], ["furniture_inventory", "Mobilier principal"]]}
              />
              <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Diagnostics &amp; fiscalité</p>
              <Fields
                form={form}
                set={set}
                required={requiredFields(kind, form)}
                invalid={invalidFields}
                names={[["fiscal_property_id", "Identifiant fiscal du logement", "text", [], "Numéro à 15 caractères attribué par l'administration fiscale — disponible sur votre avis de taxe foncière ou sur impots.gouv.fr."], ["dpe_class", "Classe DPE (étiquette énergie)", "select", ["A", "B", "C", "D", "E", "F", "G", "Vierge / non soumis"], "Étiquette énergie du logement (de A, très performant, à G, passoire thermique), indiquée sur le diagnostic de performance énergétique."], ["energy_kwh_sqm", "Consommation énergétique (kWh/m²/an)"], ["ges_class", "Classe GES (émissions CO₂)", "select", ["A", "B", "C", "D", "E", "F", "G", "Non soumis"], "Étiquette climat du logement selon ses émissions de gaz à effet de serre, indiquée sur le même diagnostic que le DPE."], ["ges_kgco2_sqm", "Émissions GES (kg CO₂/m²/an)"]]}
              />
              <p className="mt-3 text-xs leading-5 text-slate-500">Le DPE et la classe GES sont obligatoires depuis la loi Climat du 22 août 2021. L’identifiant fiscal du logement est requis depuis le 1er janvier 2025, sauf DOM.</p>
            </SectionBlock>

            <SectionBlock title="Durée" index={4}>
              <Fields
                form={form}
                set={set}
                required={requiredFields(kind, form)}
                invalid={invalidFields}
                names={[["start_date", "Date de prise d’effet", "date"], ["end_date", "Date de fin", "date", [], "Pré-rempli à 1 an après la prise d'effet — modifiable selon la durée réellement convenue avec le locataire."], ["mobility_reason", "Motif d’éligibilité au bail mobilité", "text", [], "Motif obligatoire pour ce type de bail : formation professionnelle, études, stage, apprentissage, mission temporaire, mutation ou service civique."]]}
              />
            </SectionBlock>

            <SectionBlock title="Finances" index={5}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Loyer &amp; charges</p>
              <Fields
                form={form}
                set={set}
                required={requiredFields(kind, form)}
                invalid={invalidFields}
                names={[["rent_amount", "Loyer mensuel hors charges", "number", [], "Montant du loyer seul, sans les charges, tel que convenu avec le locataire."], ["charges_amount", "Charges mensuelles", "number", [], "Provision mensuelle en plus du loyer pour couvrir les charges (eau, entretien commun...), régularisée chaque année sur justificatifs."]]}
              />

              <div id="charges_type" className={`mb-4 mt-3 rounded-xl p-2 ${invalidFields.has("charges_type") ? "border border-red-300 bg-red-50" : ""}`}>
                <label className="text-xs font-semibold text-slate-700">
                  Nature des charges<span className="ml-1 font-bold text-red-600">*</span>
                  <InfoTip text="Provision : vous demandez une avance mensuelle, régularisée chaque année selon les dépenses réelles (charges récupérables). Forfait : montant fixe sans régularisation, uniquement possible en location meublée." />
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

              <div id="payment_method" className={`mb-4 rounded-xl p-2 ${invalidFields.has("payment_method") ? "border border-red-300 bg-red-50" : ""}`}>
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
                required={requiredFields(kind, form)}
                invalid={invalidFields}
                names={[["payment_day", "Jour de paiement (1 à 31)", "number", [], "Jour du mois où le locataire doit vous régler le loyer, par exemple le 5 de chaque mois."]]}
              />

              {kind === "mobility" ? (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  Le bail mobilité ne peut pas comporter de dépôt de garantie — c'est interdit par la loi.
                </p>
              ) : (
                <div id="deposit_amount" className="mb-4">
                  <label className="text-xs font-semibold text-slate-700">
                    Dépôt de garantie (€)<span className="ml-1 font-bold text-red-600">*</span>
                    <InfoTip
                      text={
                        depositCap != null
                          ? `Plafond légal pour ce type de bail : ${depositCap.toLocaleString("fr-FR")} € (${depositCap === rentNum ? "1 mois" : "2 mois"} de loyer hors charges).`
                          : "Montant librement convenu avec le locataire, dans la limite prévue par la loi selon le type de bail."
                      }
                    />
                  </label>
                  <input
                    type="number"
                    value={form.deposit_amount ?? ""}
                    onChange={(e) => set("deposit_amount", e.target.value)}
                    placeholder="Montant en €"
                    className={`${invalidFields.has("deposit_amount") ? input.replace("border-slate-300", "border-red-400") + " ring-1 ring-red-300" : input} mt-2 max-w-xs`}
                  />
                </div>
              )}

              <InfoToggle
                title="Révision annuelle du loyer"
                info="La clause de révision de loyer est prévue par le bail type. Elle s'applique automatiquement à la date anniversaire du bail (hors logements classés F ou G au DPE, où la révision est interdite). Vous pourrez la désactiver si vous ne souhaitez pas l'appliquer."
                value={form.rent_revision_enabled}
                onChange={(v: boolean) => set("rent_revision_enabled", v)}
              >
                <Fields form={form} set={set} required={requiredFields(kind, form)} invalid={invalidFields} names={[["irl_reference", "Trimestre de référence IRL", "text", [], "Pré-rempli à titre indicatif avec le trimestre en cours à la date de début du bail. L'INSEE publie l'indice avec un peu de retard : vérifiez la valeur exacte en vigueur à la signature sur insee.fr avant de valider."]]} />
              </InfoToggle>

              <InfoToggle
                title="Le logement est-il en zone d'encadrement des loyers ?"
                info="Concerne : Paris, Plaine Commune, Est Ensemble, Lille, Hellemmes, Lomme, Lyon, Villeurbanne, Montpellier, Bordeaux, certaines villes du Pays Basque, et Grenoble-Alpes-Métropole. Si le bien n'est pas concerné, laissez sur Non."
                value={form.rent_controlled_area}
                onChange={(v: boolean) => set("rent_controlled_area", v)}
              >
                <Fields
                  form={form}
                  set={set}
                  required={requiredFields(kind, form)}
                  invalid={invalidFields}
                  names={[["reference_rent", "Loyer de référence", "number", [], "Loyer de référence fixé par arrêté préfectoral pour la zone — disponible sur le site de la mairie ou de la préfecture."], ["reference_rent_increased", "Loyer de référence majoré", "number", [], "Plafond légal du loyer pour la zone : le loyer réel ne peut pas le dépasser (hors complément de loyer justifié)."]]}
                />
              </InfoToggle>

              <CollapsibleExtra label="Informations sur le précédent locataire (optionnel)">
                <Fields form={form} set={set} names={[["previous_rent", "Dernier loyer appliqué", "number"], ["previous_tenant_departure_date", "Date de départ du précédent locataire", "date"]]} />
              </CollapsibleExtra>
            </SectionBlock>

            <SectionBlock title="Clauses (optionnel)" index={6}>
              <CollapsibleExtra label="Ajouter des clauses ou informations complémentaires">
                <Fields form={form} set={set} names={[["recent_works", "Travaux récents"], ["estimated_energy_cost", "Estimation annuelle des dépenses d’énergie", "number"], ["energy_reference_year", "Année de référence de l’estimation énergétique"], ["tenant_agency_fees", "Honoraires imputés au locataire", "number"], ["tenant_inventory_fees", "Honoraires d’état des lieux imputés au locataire", "number"], ["rent_supplement", "Complément de loyer", "number"], ["rent_supplement_reason", "Justification du complément de loyer"], ["special_terms", "Clauses particulières"]]} />
              </CollapsibleExtra>
              <Checks form={form} set={set} names={[["annual_insurance_clause", "Clause assurance habitation annuelle (recommandée)"]]} />
            </SectionBlock>

            <SectionBlock title="Finalisation" index={7}>
              <AnnexChecks form={form} set={set} />
              <Fields
                form={form}
                set={set}
                required={requiredFields(kind, form)}
                invalid={invalidFields}
                names={[["signature_place", "Lieu de signature"], ["signature_date", "Date de signature", "date"]]}
              />
            </SectionBlock>

      </div>

      <div className="sticky bottom-0 mt-6 flex items-center justify-between border-t border-slate-100 bg-white pb-1 pt-4">
        <button
          type="button"
          disabled={loading}
          onClick={generate}
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-gradient-to-r from-[#635bff] to-[#00d4ff] px-6 text-sm font-semibold text-white shadow-md shadow-indigo-100 transition-all hover:shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? "Génération…" : "Générer le contrat de bail"}
        </button>
      </div>
    </div>
  );
}

function SectionBlock({ title, index, children }: { title: string; index: number; children: React.ReactNode }) {
  return (
    <div className={index > 1 ? "border-t border-slate-100 pt-8" : ""}>
      <h3 className="mb-4 flex items-center gap-2.5 text-lg font-semibold text-slate-950">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {index}
        </span>
        {title}
      </h3>
      {children}
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

function Fields({ form, set, names, required = [], invalid }: any) {
  const invalidSet: Set<string> = invalid || new Set();
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      {names.map(([key, title, type = "text", options = [], hint]: any[]) => {
        const isInvalid = invalidSet.has(key);
        const fieldClass = isInvalid ? `${input.replace("border-slate-300", "border-red-400")} ring-1 ring-red-300` : input;
        return (
          <label key={key} id={key} className={labelClass}>
            {title}
            {required.includes(key) ? <span className="ml-1 font-bold text-red-600">*</span> : null}
            {hint ? <InfoTip text={hint} /> : null}
            {type === "select" ? (
              <span className="relative block">
                <select
                  value={form[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  className={`${fieldClass} appearance-none pr-9`}
                >
                  <option value="">Sélectionner</option>
                  {options.map((option: string | [string, string]) => {
                    const value = Array.isArray(option) ? option[0] : option;
                    const optionLabel = Array.isArray(option) ? option[1] : option;
                    return <option key={value} value={value}>{optionLabel}</option>;
                  })}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              </span>
            ) : (
              <input type={type} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} className={fieldClass} />
            )}
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

function CollapsibleExtra({ label, children }: any) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 text-xs font-semibold text-[#635bff] underline underline-offset-2 hover:text-[#4f47cc]"
      >
        + {label}
      </button>
    );
  }
  return <div className="mb-4 space-y-3">{children}</div>;
}

function Checks({ form, set, names }: any) {
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2">
      {names.map(([key, title]: any[]) => (
        <label key={key} className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={!!form[key]} onChange={(e) => set(key, e.target.checked)} />
          {title}
        </label>
      ))}
    </div>
  );
}

function AnnexChecks({ form, set }: any) {
  const names = [
    ["annex_notice", "Notice d’information", "À remettre au locataire avec le bail."],
    ["annex_diagnostics", "Diagnostics dont DPE", "Coche si le dossier de diagnostics applicable sera joint."],
    ["annex_inventory_report", "État des lieux d’entrée", "À joindre une fois réalisé avec le locataire."],
    ["annex_furniture", "Inventaire du mobilier", "À joindre pour une location meublée."],
    ["annex_copro", "Extrait de copropriété", "À joindre si le logement est en copropriété."],
    ["annex_insurance", "Assurance habitation", "Attestation à récupérer auprès du locataire."],
  ];
  return (
    <div className="mb-5">
      <p className="text-sm font-semibold text-slate-950">Annexes à prévoir avec le contrat</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">Ces cases servent de pense-bête avant signature. Elles n’ajoutent pas automatiquement les documents au PDF.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {names.map(([key, title, description]) => (
          <label key={key} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={!!form[key]} onChange={(e) => set(key, e.target.checked)} />
            <span>
              <span className="block font-semibold text-slate-900">{title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
