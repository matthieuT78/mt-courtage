import type { NextApiRequest, NextApiResponse } from "next";
import PDFDocument from "pdfkit";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { contractPdfPath, LEASE_CONTRACT_BUCKET, leaseContractKindLabels } from "../../../lib/leaseContract";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const text = (value: unknown, fallback = "Non renseigné") => String(value ?? "").trim() || fallback;
const euro = (value: unknown) => Number(value || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const yesNo = (value: unknown) => (value ? "Oui" : "Non");
const line = (values: unknown[]) => values.map((value) => String(value || "").trim()).filter(Boolean).join(", ");

function makePdf(payload: any) {
  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 46, info: { Title: "Contrat de location" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    const d = payload.form_data || {};
    const heading = (value: string) => {
      doc.moveDown(0.8).font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text(value).moveDown(0.25);
      doc.font("Helvetica").fontSize(9.5).fillColor("#1e293b");
    };
    const row = (label: string, value: unknown) => doc.text(`${label} : ${text(value)}`, { lineGap: 2 });

    doc.font("Helvetica-Bold").fontSize(17).fillColor("#0f172a").text("CONTRAT DE LOCATION", { align: "center" });
    doc.moveDown(0.25).fontSize(11).text(leaseContractKindLabels[payload.contract_kind], { align: "center" });
    doc.moveDown(0.6).font("Helvetica").fontSize(8.5).fillColor("#475569").text(
      "Document préparé à partir des informations saisies par le bailleur. Relisez l’intégralité du contrat et joignez les annexes obligatoires avant signature.",
      { align: "center" }
    );

    heading("1. Désignation des parties");
    row("Bailleur", d.landlord_name);
    row("Adresse du bailleur", d.landlord_address);
    row("Locataire", d.tenant_name);
    row("Adresse e-mail du locataire", d.tenant_email);

    heading("2. Objet du contrat et logement");
    row("Adresse du logement", d.property_address);
    row("Type d’habitat", d.housing_type);
    row("Identifiant fiscal du logement", d.fiscal_property_id);
    row("Période de construction", d.building_period);
    row("Surface habitable", d.surface_m2 ? `${d.surface_m2} m²` : "");
    row("Nombre de pièces principales", d.main_rooms);
    row("Mode de chauffage", d.heating_method);
    row("Production d’eau chaude", d.hot_water_method);
    row("Équipements privatifs", d.private_equipment);
    row("Parties et équipements communs", d.common_equipment);
    row("Destination", "Usage d’habitation à titre de résidence principale");
    if (payload.contract_kind !== "empty_primary") row("Mobilier principal", d.furniture_inventory);

    heading("3. Date de prise d’effet et durée");
    row("Date de prise d’effet", d.start_date);
    row("Date de fin", d.end_date);
    if (payload.contract_kind === "mobility") {
      row("Motif d’éligibilité au bail mobilité", d.mobility_reason);
      doc.text("Le bail mobilité n’est ni renouvelable ni reconductible. Aucun dépôt de garantie ne peut être exigé.");
    } else if (payload.contract_kind === "furnished_student") {
      doc.text("Le contrat étudiant est conclu pour neuf mois et n’est pas reconduit tacitement.");
    } else {
      doc.text("Le contrat est soumis aux règles de reconduction applicables au type de location choisi.");
    }

    heading("4. Conditions financières");
    row("Loyer mensuel hors charges", euro(d.rent_amount));
    row("Provision ou forfait mensuel de charges", euro(d.charges_amount));
    row("Total mensuel", euro(Number(d.rent_amount || 0) + Number(d.charges_amount || 0)));
    row("Modalité de règlement", d.payment_method);
    row("Date de paiement", d.payment_day ? `Le ${d.payment_day} de chaque mois` : "");
    row("Dépôt de garantie", payload.contract_kind === "mobility" ? "Aucun" : euro(d.deposit_amount));
    row("Dernier loyer appliqué au précédent locataire", d.previous_rent ? euro(d.previous_rent) : "");
    row("Date de départ du précédent locataire", d.previous_tenant_departure_date);
    row("Révision annuelle du loyer", yesNo(d.rent_revision_enabled));
    if (d.rent_revision_enabled) row("Trimestre de référence IRL", d.irl_reference);
    row("Zone soumise à encadrement des loyers", yesNo(d.rent_controlled_area));
    if (d.rent_controlled_area) {
      row("Loyer de référence majoré", d.reference_rent_increased ? `${euro(d.reference_rent_increased)} / mois` : "");
      row("Complément de loyer", d.rent_supplement ? `${euro(d.rent_supplement)} / mois` : "Aucun");
      row("Justification du complément", d.rent_supplement_reason);
    }

    heading("5. Travaux et clauses particulières");
    row("Travaux réalisés depuis le précédent contrat", d.recent_works);
    row("Estimation annuelle des dépenses d’énergie", d.estimated_energy_cost ? euro(d.estimated_energy_cost) : "");
    row("Année de référence de l’estimation énergétique", d.energy_reference_year);
    row("Honoraires imputés au locataire", d.tenant_agency_fees ? euro(d.tenant_agency_fees) : "Aucun");
    row("Honoraires d’état des lieux imputés au locataire", d.tenant_inventory_fees ? euro(d.tenant_inventory_fees) : "Aucun");
    row("Clause résolutoire et assurances", "Application des dispositions légales en vigueur");
    row("Clauses particulières", d.special_terms);

    heading("6. Annexes à remettre avec le contrat");
    const annexes = [
      ["Notice d’information bailleur-locataire", d.annex_notice],
      ["Dossier de diagnostic technique, dont DPE", d.annex_diagnostics],
      ["État des lieux d’entrée", d.annex_inventory_report],
      ["Inventaire et état détaillé du mobilier", d.annex_furniture, payload.contract_kind !== "empty_primary"],
      ["Extrait du règlement de copropriété utile au locataire", d.annex_copro],
      ["Attestation d’assurance habitation à remettre par le locataire", d.annex_insurance],
    ];
    for (const [label, checked, applicable = true] of annexes) {
      if (applicable) doc.text(`${checked ? "☒" : "☐"} ${label}`);
    }

    heading("7. Signature");
    row("Fait à", d.signature_place);
    row("Le", d.signature_date);
    doc.moveDown(1).text("Signature du bailleur précédée de la mention « Lu et approuvé »");
    doc.moveDown(2.5).text("Signature du locataire précédée de la mention « Lu et approuvé »");
    doc.moveDown(1.5).fontSize(8).fillColor("#64748b").text(
      "Ce document doit être complété par les annexes applicables. Pour une situation particulière (colocation avec baux individuels, conventionnement, personne morale, logement de fonction ou clause spécifique), sollicitez un professionnel."
    );
    doc.end();
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { userId, documentId } = req.body || {};
    const userCheck = requireMatchingUser(auth, String(userId || ""));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    const { data: document } = await supabaseAdmin.from("lease_contract_documents").select("*").eq("id", documentId).eq("user_id", userId).maybeSingle();
    if (!document) return res.status(404).json({ error: "Contrat introuvable." });
    const pdf = await makePdf(document);
    const path = contractPdfPath(String(userId), document.lease_id, document.id);
    const { error: uploadError } = await supabaseAdmin.storage.from(LEASE_CONTRACT_BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;
    const pdfUrl = `${LEASE_CONTRACT_BUCKET}:${path}`;
    const { data, error } = await supabaseAdmin.from("lease_contract_documents").update({ pdf_url: pdfUrl, status: "ready", generated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", document.id).select("*").single();
    if (error) throw error;
    return res.status(200).json({ ok: true, document: data });
  } catch (error: any) {
    console.error("[api/lease-contracts/generate] error:", error);
    return res.status(500).json({ error: error?.message || "Génération impossible." });
  }
}
