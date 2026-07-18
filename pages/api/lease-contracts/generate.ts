import type { NextApiRequest, NextApiResponse } from "next";
import PDFDocument from "pdfkit";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { contractPdfPath, LEASE_CONTRACT_BUCKET, leaseContractKindLabels } from "../../../lib/leaseContract";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { invalidateStorageCache } from "../../../lib/storageQuota";

const text = (value: unknown, fallback = "Non renseigné") => String(value ?? "").trim() || fallback;
const euro = (value: unknown) => Number(value || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const yesNo = (value: unknown) => (value ? "Oui" : "Non");
const line = (values: unknown[]) => values.map((value) => String(value || "").trim()).filter(Boolean).join(", ");
const fiscalIdRequired = (country: unknown) => !["GP", "MQ", "GF", "RE", "YT"].includes(String(country || "FR").toUpperCase());
const propertyAddress = (data: any) =>
  line([data.property_address_line1, data.property_address_line2, data.property_postal_code, data.property_city, data.property_country]) ||
  data.property_address;

function missingRequiredFields(payload: any) {
  const d = payload.form_data || {};
  const required = [
    "landlord_name",
    "landlord_address",
    "tenant_name",
    "property_address_line1",
    "property_postal_code",
    "property_city",
    "housing_nature",
    "housing_type",
    "legal_regime",
    "building_period",
    "surface_m2",
    "main_rooms",
    "heating_method",
    "hot_water_method",
    ...(fiscalIdRequired(d.property_country) ? ["fiscal_property_id"] : []),
    "destination",
    "ict_equipment",
    "dpe_class",
    "ges_class",
    "start_date",
    "end_date",
    ...(payload.contract_kind === "mobility" ? ["mobility_reason"] : []),
    "rent_amount",
    "charges_amount",
    "charges_type",
    ...(payload.contract_kind === "mobility" ? [] : ["deposit_amount"]),
    "payment_method",
    "payment_day",
    ...(d.rent_revision_enabled ? ["irl_reference"] : []),
    ...(d.rent_controlled_area ? ["reference_rent", "reference_rent_increased"] : []),
    "signature_place",
    "signature_date",
  ];
  return required.filter((key) => String(d[key] ?? "").trim() === "");
}

function makePdf(payload: any) {
  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 54, info: { Title: "Contrat de location" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    const d = payload.form_data || {};

    const W = doc.page.width - 108; // usable width (2 × margin 54)

    const heading = (value: string) => {
      doc.moveDown(1.4);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(value.toUpperCase(), { characterSpacing: 0.3 });
      doc.moveDown(0.15);
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + W, doc.y)
        .strokeColor("#94a3b8").lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(9.5).fillColor("#1e293b");
    };

    const row = (label: string, value: unknown) => {
      doc.moveDown(0.15);
      const x = doc.page.margins.left;
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#475569").text(label, x, y, { width: W * 0.42, lineBreak: false });
      doc.font("Helvetica").fontSize(9.5).fillColor("#0f172a").text(text(value), x + W * 0.44, y, { width: W * 0.56 });
    };

    const clause = (title: string, body: string) => {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0f172a").text(title);
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(9.5).fillColor("#1e293b").text(body, { lineGap: 2 });
    };

    // ── En-tête ──────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text("CONTRAT DE LOCATION", { align: "center", characterSpacing: 1 });
    doc.moveDown(0.35).fontSize(11).fillColor("#334155").text(leaseContractKindLabels[payload.contract_kind], { align: "center" });
    doc.moveDown(0.4).font("Helvetica").fontSize(7.5).fillColor("#64748b").text(
      "Établi conformément à la loi n°89-462 du 6 juillet 1989, à la loi ALUR du 24 mars 2014 et au décret n°2015-587 du 29 mai 2015.",
      { align: "center" }
    );
    doc.moveDown(0.6);
    doc.moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + W, doc.y)
      .strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.moveDown(0.6);
    doc.fontSize(8).fillColor("#475569").text(
      "Ce contrat a pleine valeur juridique une fois signé par les deux parties. Avant signature, joignez les annexes obligatoires : notice d’information bailleur-locataire, dossier de diagnostics techniques (dont DPE), état des lieux d’entrée, et inventaire du mobilier si location meublée. Ce modèle ne couvre pas : colocation avec baux individuels, logement conventionné APL/Anah, locataire personne morale, SCI, bail commercial.",
      { align: "left", lineGap: 2 }
    );

    // ── 1. Parties ───────────────────────────────────────────
    heading("1. Désignation des parties");
    row("Bailleur", d.landlord_name);
    row("Adresse du bailleur", d.landlord_address);
    if (d.mandataire_name) {
      doc.moveDown(0.4);
      row("Mandataire / gestionnaire", d.mandataire_name);
      if (d.mandataire_address) row("Adresse du mandataire", d.mandataire_address);
    }
    doc.moveDown(0.4);
    row("Locataire", d.tenant_name);
    if (d.co_tenant_name) row("Co-locataire", d.co_tenant_name);
    if (d.tenant_email) row("Adresse e-mail du locataire", d.tenant_email);

    // ── 2. Logement ──────────────────────────────────────────
    heading("2. Objet du contrat et désignation du logement");
    row("Adresse du logement", propertyAddress(d));
    if (d.housing_nature) row("Nature du logement", d.housing_nature);
    row("Type d’habitat", d.housing_type);
    if (d.floor) row("Étage", d.floor);
    doc.moveDown(0.4);
    row("Régime juridique de l’immeuble", d.legal_regime);
    if (d.lot_number) row("Numéro de lot de copropriété", d.lot_number);
    row("Identifiant fiscal du logement", d.fiscal_property_id);
    row("Période de construction", d.building_period);
    doc.moveDown(0.4);
    row("Surface habitable", d.surface_m2 ? `${d.surface_m2} m²` : "");
    row("Nombre de pièces principales", d.main_rooms);
    row("Mode de chauffage", d.heating_method);
    row("Production d’eau chaude", d.hot_water_method);
    row("Destination des locaux", d.destination);
    row("Équipements ICT (accès internet, télévision…)", d.ict_equipment);
    if (d.other_parts) { doc.moveDown(0.4); row("Autres parties du logement", d.other_parts); }
    if (d.private_equipment) row("Équipements privatifs", d.private_equipment);
    if (d.common_equipment) row("Parties et équipements communs", d.common_equipment);
    row("Usage", "Habitation à titre de résidence principale");
    if (payload.contract_kind !== "empty_primary") { doc.moveDown(0.4); row("Mobilier principal", d.furniture_inventory); }

    // DPE & GES
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0f172a")
      .text("Diagnostic de performance énergétique (DPE) et émissions de gaz à effet de serre (GES)");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9.5).fillColor("#1e293b");
    row("Classe DPE", d.dpe_class || "Non renseigné");
    if (d.energy_kwh_sqm) row("Consommation énergétique estimée", `${d.energy_kwh_sqm} kWh/m²/an`);
    row("Classe GES", d.ges_class || "Non renseigné");
    if (d.ges_kgco2_sqm) row("Émissions de GES estimées", `${d.ges_kgco2_sqm} kg CO₂/m²/an`);
    if (d.estimated_energy_cost) row("Estimation annuelle des dépenses d’énergie", euro(d.estimated_energy_cost) + (d.energy_reference_year ? ` (référence ${d.energy_reference_year})` : ""));

    // ── 3. Durée ─────────────────────────────────────────────
    heading("3. Date de prise d’effet et durée");
    row("Date de prise d’effet", d.start_date);
    row("Date de fin", d.end_date);
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9.5).fillColor("#1e293b");
    if (payload.contract_kind === "empty_primary") {
      doc.text("Ce contrat est conclu pour une durée de trois (3) ans, conformément à l’article 10 de la loi n°89-462 du 6 juillet 1989. Il est reconduit tacitement par périodes de trois ans. Le bailleur souhaitant donner congé doit notifier le locataire par lettre recommandée avec accusé de réception ou acte d’huissier au moins six (6) mois avant le terme du contrat.", { lineGap: 2 });
    } else if (payload.contract_kind === "furnished_primary") {
      doc.text("Ce contrat est conclu pour une durée de un (1) an, conformément à l’article 11 de la loi n°89-462 du 6 juillet 1989. Il est reconduit tacitement par périodes d’un an. Le bailleur souhaitant donner congé doit notifier le locataire par lettre recommandée avec accusé de réception ou acte d’huissier au moins trois (3) mois avant le terme du contrat.", { lineGap: 2 });
    } else if (payload.contract_kind === "furnished_student") {
      doc.text("Ce contrat est conclu pour une durée de neuf (9) mois, conformément à l’article 25-7 de la loi n°89-462 du 6 juillet 1989. Il n’est pas reconduit tacitement à son terme. Le locataire peut donner congé à tout moment avec un préavis d’un mois.", { lineGap: 2 });
    } else if (payload.contract_kind === "mobility") {
      row("Motif d’éligibilité au bail mobilité", d.mobility_reason);
      doc.moveDown(0.4).text("Ce contrat est un bail mobilité au sens de l’article 25-12 de la loi n°89-462 du 6 juillet 1989. Il n’est ni renouvelable ni reconductible. Aucun dépôt de garantie ne peut être exigé. Le locataire peut donner congé à tout moment avec un préavis d’un mois.", { lineGap: 2 });
    }
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9.5).text(
      "Un état des lieux contradictoire sera établi à l’entrée dans les lieux et à la sortie du locataire, conformément à l’article 3-2 de la loi du 6 juillet 1989. À défaut d’état des lieux d’entrée, le logement est présumé avoir été remis en bon état de réparations locatives.",
      { lineGap: 2 }
    );

    // ── 4. Conditions financières ─────────────────────────────
    heading("4. Conditions financières");
    row("Loyer mensuel hors charges", euro(d.rent_amount));
    row("Charges mensuelles", euro(d.charges_amount));
    row("Nature des charges", d.charges_type || (payload.contract_kind === "empty_primary" ? "Provision sur charges récupérables avec régularisation annuelle" : "À préciser"));
    row("Total mensuel (loyer + charges)", euro(Number(d.rent_amount || 0) + Number(d.charges_amount || 0)));
    doc.moveDown(0.4);
    row("Modalité de règlement", d.payment_method);
    row("Date de paiement", d.payment_day ? `Le ${d.payment_day} de chaque mois` : "");
    row("Dépôt de garantie", payload.contract_kind === "mobility" ? "Aucun (bail mobilité)" : euro(d.deposit_amount));
    if (d.previous_rent) { doc.moveDown(0.4); row("Dernier loyer du précédent locataire", euro(d.previous_rent)); }
    if (d.previous_tenant_departure_date) row("Date de départ du précédent locataire", d.previous_tenant_departure_date);
    doc.moveDown(0.4);
    row("Révision annuelle du loyer (IRL)", yesNo(d.rent_revision_enabled));
    if (d.rent_revision_enabled) {
      row("Trimestre de référence IRL", d.irl_reference);
      doc.moveDown(0.3).font("Helvetica").fontSize(9.5).text(
        "Le loyer sera révisé chaque année à la date anniversaire du contrat selon la formule : Nouveau loyer = Loyer en cours × (Nouvel IRL / IRL de référence), conformément à l’article 17-1 de la loi du 6 juillet 1989.",
        { lineGap: 2 }
      );
    }
    doc.moveDown(0.4);
    row("Zone soumise à encadrement des loyers", yesNo(d.rent_controlled_area));
    if (d.rent_controlled_area) {
      if (d.reference_rent) row("Loyer de référence", `${euro(d.reference_rent)} / mois`);
      row("Loyer de référence majoré", d.reference_rent_increased ? `${euro(d.reference_rent_increased)} / mois` : "");
      row("Complément de loyer", d.rent_supplement ? `${euro(d.rent_supplement)} / mois` : "Aucun");
      if (d.rent_supplement_reason) row("Justification du complément", d.rent_supplement_reason);
    }

    // ── 5. Clauses ───────────────────────────────────────────
    heading("5. Travaux, obligations et clauses particulières");
    if (d.recent_works) row("Travaux réalisés depuis le précédent contrat", d.recent_works);
    if (d.tenant_agency_fees) row("Honoraires imputés au locataire", euro(d.tenant_agency_fees));
    if (d.tenant_inventory_fees) row("Honoraires d’état des lieux imputés au locataire", euro(d.tenant_inventory_fees));

    clause(
      "Clause résolutoire",
      "Le contrat prévoit sa résiliation de plein droit, deux mois après un commandement de payer resté infructueux, en cas de : défaut de paiement du loyer ou des charges aux termes convenus ; non-versement du dépôt de garantie ; défaut de souscription d’une assurance des risques locatifs ; troubles de voisinage constatés par une décision de justice passée en force de chose jugée (art. 24 loi du 6 juillet 1989)."
    );

    if (d.annual_insurance_clause !== false) {
      clause(
        "Assurance habitation",
        "Le locataire est tenu de souscrire une assurance contre les risques locatifs (incendie, dégâts des eaux, responsabilité civile) et de remettre une attestation au bailleur lors de la remise des clés, puis à chaque renouvellement et sur simple demande (art. 7 g) de la loi du 6 juillet 1989)."
      );
    }

    clause(
      "Obligations d’entretien du locataire",
      "Le locataire est tenu d’entretenir le logement en bon état et d’effectuer les réparations locatives à sa charge, telles que définies par le décret n°87-712 du 26 août 1987. Il ne peut effectuer de transformation ou travaux sans accord écrit préalable du bailleur (art. 7 b) et f) de la loi du 6 juillet 1989)."
    );

    clause(
      "Sous-location et cession",
      "Le locataire ne peut sous-louer le logement, même partiellement, ni céder le présent bail, sans l’accord écrit préalable du bailleur. En cas de sous-location autorisée, le loyer payé par le sous-locataire ne peut excéder le loyer principal (art. 8 de la loi du 6 juillet 1989)."
    );

    if (d.co_tenant_name) {
      clause(
        "Solidarité entre co-locataires",
        `Les co-locataires ${text(d.tenant_name)} et ${text(d.co_tenant_name)} sont solidairement tenus de l’ensemble des obligations découlant du présent bail, notamment du paiement du loyer et des charges. Le bailleur peut réclamer à l’un ou l’autre la totalité des sommes dues sans ordre de préférence.`
      );
    }

    clause(
      "Décence et performance énergétique",
      "Le bailleur certifie que le logement répond aux critères de décence définis par le décret n°2002-120 du 30 janvier 2002 et respecte les exigences de performance énergétique applicables aux logements décents (loi n°2021-1104 du 22 août 2021)."
    );

    if (d.special_terms) {
      clause("Clauses particulières", d.special_terms);
    }

    // ── 6. Annexes ───────────────────────────────────────────
    heading("6. Annexes à remettre avec le contrat");
    const annexes: [string, unknown, boolean?][] = [
      ["Notice d’information bailleur-locataire", d.annex_notice],
      ["Dossier de diagnostic technique (dont DPE)", d.annex_diagnostics],
      ["État des lieux d’entrée", d.annex_inventory_report],
      ["Inventaire et état détaillé du mobilier", d.annex_furniture, payload.contract_kind !== "empty_primary"],
      ["Extrait du règlement de copropriété utile au locataire", d.annex_copro],
      ["Attestation d’assurance habitation du locataire", d.annex_insurance],
    ];
    for (const [label, checked, applicable = true] of annexes) {
      if (applicable) {
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(9.5).fillColor("#0f172a")
          .text(`${checked ? "[x]" : "[ ]"}  ${label}`, { lineGap: 2 });
      }
    }

    // ── 7. Signature ─────────────────────────────────────────
    heading("7. Signatures");
    row("Fait à", d.signature_place);
    row("Le", d.signature_date);
    doc.moveDown(1.5);

    // Bailleur
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0f172a").text("Bailleur — " + text(d.landlord_name));
    doc.moveDown(0.3).font("Helvetica").fontSize(9).fillColor("#64748b").text("Précédée de la mention manuscrite « Lu et approuvé »");
    doc.moveDown(3.5);
    doc.moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + W * 0.45, doc.y)
      .strokeColor("#94a3b8").lineWidth(0.5).stroke();
    doc.moveDown(0.3).font("Helvetica").fontSize(8).fillColor("#94a3b8").text("Signature du bailleur");

    doc.moveDown(2);
    // Locataire
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0f172a").text("Locataire — " + text(d.tenant_name));
    doc.moveDown(0.3).font("Helvetica").fontSize(9).fillColor("#64748b").text("Précédée de la mention manuscrite « Lu et approuvé »");
    doc.moveDown(3.5);
    doc.moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + W * 0.45, doc.y)
      .strokeColor("#94a3b8").lineWidth(0.5).stroke();
    doc.moveDown(0.3).font("Helvetica").fontSize(8).fillColor("#94a3b8").text("Signature du locataire");

    if (d.co_tenant_name) {
      doc.moveDown(2);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0f172a").text("Co-locataire — " + text(d.co_tenant_name));
      doc.moveDown(0.3).font("Helvetica").fontSize(9).fillColor("#64748b").text("Précédée de la mention manuscrite « Lu et approuvé »");
      doc.moveDown(3.5);
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + W * 0.45, doc.y)
        .strokeColor("#94a3b8").lineWidth(0.5).stroke();
      doc.moveDown(0.3).font("Helvetica").fontSize(8).fillColor("#94a3b8").text("Signature du co-locataire");
    }

    doc.moveDown(2).fontSize(8).fillColor("#94a3b8").text(
      "Ce document doit être complété par les annexes applicables. Pour toute situation particulière (colocation avec baux individuels, logement conventionné, locataire personne morale, clause spécifique), consultez un professionnel du droit.",
      { lineGap: 2 }
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
    if (document.status === "signed" || document.status === "archived" || document.signed_pdf_url) {
      return res.status(409).json({ error: "Ce bail est déjà signé et ne peut plus être régénéré." });
    }
    const missing = missingRequiredFields(document);
    if (missing.length) return res.status(400).json({ error: `Contrat incomplet : ${missing.join(", ")}.` });
    const pdf = await makePdf(document);
    const path = contractPdfPath(String(userId), document.lease_id, document.id);
    const { error: uploadError } = await supabaseAdmin.storage.from(LEASE_CONTRACT_BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;
    invalidateStorageCache(String(userId));
    const pdfUrl = `${LEASE_CONTRACT_BUCKET}:${path}`;
    const { data, error } = await supabaseAdmin.from("lease_contract_documents").update({ pdf_url: pdfUrl, status: "ready", generated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", document.id).select("*").single();
    if (error) throw error;
    return res.status(200).json({ ok: true, document: data });
  } catch (error: any) {
    console.error("[api/lease-contracts/generate] error:", error);
    return res.status(500).json({ error: error?.message || "Génération impossible." });
  }
}
