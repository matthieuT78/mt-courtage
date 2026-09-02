import type { NextApiRequest, NextApiResponse } from "next";
import PDFDocument from "pdfkit";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export type CongeKind = "reprise" | "vente" | "motif";

export type CongePayload = {
  userId: string;
  leaseId: string;
  kind: CongeKind;
  // Commun
  landlordName: string;
  landlordAddress: string;
  tenantName: string;
  propertyAddress: string;
  leaseStartDate: string;
  leaseEndDate: string;
  bailType: "empty_primary" | "furnished_primary" | "furnished_student" | "mobility" | string;
  signaturePlace: string;
  signatureDate: string;
  // Reprise
  beneficiaryName?: string;
  beneficiaryRelationship?: string;
  beneficiaryCurrentAddress?: string;
  // Vente
  salePrice?: number;
  saleConditions?: string;
  // Motif légitime
  motifDescription?: string;
};

const euro = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const fmtDate = (iso: string) => {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

function preavisLabel(bailType: string) {
  return bailType === "empty_primary" ? "six (6) mois" : "trois (3) mois";
}

const PREEMPTION_TEXT = `Le présent congé vaut offre de vente au profit du locataire. Cette offre est valable pendant les deux premiers mois du délai de préavis.

Conformément à l'article 15-II de la loi n°89-462 du 6 juillet 1989 :
- Le locataire qui désire accepter l'offre doit notifier son acceptation au bailleur dans les deux mois suivant la réception du congé.
- En cas d'acceptation, le délai de réalisation de la vente est de deux mois à compter de la date d'envoi de l'acceptation, ou de quatre mois si le locataire indique recourir à un prêt.
- Si le prix ou les conditions de vente sont modifiés, le propriétaire en avise le locataire par lettre recommandée avec accusé de réception ; le locataire dispose d'un délai d'un mois pour accepter.
- Si le logement n'est pas vendu dans les trois ans suivant l'expiration du délai de préavis, ou s'il est vendu à un prix inférieur à celui mentionné dans le congé-vente, le locataire doit en être informé et retrouve son droit de préemption.`;

function makePdf(payload: CongePayload): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: "Lettre de congé bailleur" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const body = (text: string, opts?: any) =>
      doc.font("Helvetica").fontSize(10).fillColor("#1e293b").text(text, opts);
    const bold = (text: string, opts?: any) =>
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(text, opts);
    const small = (text: string) =>
      doc.font("Helvetica").fontSize(8.5).fillColor("#64748b").text(text);

    // En-tête expéditeur
    bold(payload.landlordName);
    body(payload.landlordAddress);
    doc.moveDown(1.2);

    // Destinataire
    bold(payload.tenantName);
    body(payload.propertyAddress);
    doc.moveDown(1.2);

    // Lieu et date
    body(`${payload.signaturePlace}, le ${fmtDate(payload.signatureDate)}`);
    doc.moveDown(0.4);
    body("Envoi par lettre recommandée avec accusé de réception");
    doc.moveDown(1.2);

    // Objet
    const objetMap: Record<CongeKind, string> = {
      reprise: "Congé pour reprise du logement",
      vente: "Congé pour vente du logement",
      motif: "Congé pour motif légitime et sérieux",
    };
    bold(`Objet : ${objetMap[payload.kind]}`);
    body(`Référence : Bail du ${fmtDate(payload.leaseStartDate)} — ${payload.propertyAddress}`);
    doc.moveDown(1.2);

    // Formule d'appel
    body(`Madame, Monsieur,`);
    doc.moveDown(0.6);

    // Corps selon motif
    if (payload.kind === "reprise") {
      body(
        `Conformément à l'article 15-I de la loi n°89-462 du 6 juillet 1989, je vous adresse par la présente un congé concernant le logement situé au ${payload.propertyAddress}, dont vous êtes locataire depuis le ${fmtDate(payload.leaseStartDate)}.`
      );
      doc.moveDown(0.6);
      body(
        `Ce congé est motivé par la reprise du logement pour y habiter. Le bénéficiaire de cette reprise est ${payload.beneficiaryName || "[Nom du bénéficiaire]"}, ${payload.beneficiaryRelationship || "[lien avec le bailleur]"}, demeurant actuellement au ${payload.beneficiaryCurrentAddress || "[adresse actuelle du bénéficiaire]"}.`
      );
      doc.moveDown(0.6);
      body(
        `Ce congé prend effet à la date d'échéance du bail, soit le ${fmtDate(payload.leaseEndDate)}, à l'expiration du délai de préavis de ${preavisLabel(payload.bailType)} prévu par la loi.`
      );
    } else if (payload.kind === "vente") {
      body(
        `Conformément à l'article 15-II de la loi n°89-462 du 6 juillet 1989, je vous adresse par la présente un congé pour vendre le logement situé au ${payload.propertyAddress}, dont vous êtes locataire depuis le ${fmtDate(payload.leaseStartDate)}.`
      );
      doc.moveDown(0.6);
      if (payload.salePrice) {
        body(`Ce congé vaut offre de vente aux conditions suivantes :`);
        body(`- Prix de vente : ${euro(payload.salePrice)}`);
        if (payload.saleConditions) body(`- Conditions : ${payload.saleConditions}`);
      }
      doc.moveDown(0.6);
      body(PREEMPTION_TEXT);
      doc.moveDown(0.6);
      body(
        `Ce congé prend effet à la date d'échéance du bail, soit le ${fmtDate(payload.leaseEndDate)}, à l'expiration du délai de préavis de ${preavisLabel(payload.bailType)}.`
      );
    } else {
      body(
        `Conformément à l'article 15-I de la loi n°89-462 du 6 juillet 1989, je vous adresse par la présente un congé pour motif légitime et sérieux concernant le logement situé au ${payload.propertyAddress}, dont vous êtes locataire depuis le ${fmtDate(payload.leaseStartDate)}.`
      );
      doc.moveDown(0.6);
      bold("Motif du congé :");
      body(payload.motifDescription || "[Description précise et détaillée du motif]");
      doc.moveDown(0.6);
      body(
        `Ce congé prend effet à la date d'échéance du bail, soit le ${fmtDate(payload.leaseEndDate)}, à l'expiration du délai de préavis de ${preavisLabel(payload.bailType)}.`
      );
    }

    doc.moveDown(0.6);
    body(
      `Vous êtes invité(e) à restituer les clés du logement au plus tard le ${fmtDate(payload.leaseEndDate)}. Un état des lieux de sortie sera réalisé contradictoirement à cette date.`
    );
    doc.moveDown(1.2);

    // Formule de politesse
    body("Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.");
    doc.moveDown(2);

    bold(payload.landlordName);
    doc.moveDown(0.3);
    body("(Signature)");
    doc.moveDown(2);

    // Pied de page légal
    doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).stroke("#e2e8f0");
    doc.moveDown(0.4);
    small(
      "Document établi conformément à l'article 15 de la loi n°89-462 du 6 juillet 1989 tendant à améliorer les rapports locatifs. " +
      "Le présent congé a pleine valeur juridique une fois envoyé dans les formes et délais légaux. " +
      "Conservez l'accusé de réception ou le récépissé comme preuve de la date de remise."
    );

    doc.end();
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const payload: CongePayload = req.body;
  const userCheck = requireMatchingUser(auth, String(payload.userId || ""));
  if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

  // Compléter landlordName depuis le profil si absent
  if (!payload.landlordName) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, address_line1, postal_code, city")
      .eq("id", auth.userId)
      .single();
    if (profile) {
      payload.landlordName = profile.full_name || "";
      payload.landlordAddress = [profile.address_line1, profile.postal_code, profile.city].filter(Boolean).join(", ");
    }
  }

  // Validation minimale
  const missing: string[] = [];
  if (!payload.landlordName) missing.push("landlordName");
  if (!payload.tenantName) missing.push("tenantName");
  if (!payload.propertyAddress) missing.push("propertyAddress");
  if (!payload.leaseEndDate) missing.push("leaseEndDate");
  if (!payload.signaturePlace) missing.push("signaturePlace");
  if (!payload.signatureDate) missing.push("signatureDate");
  if (payload.kind === "reprise" && !payload.beneficiaryName) missing.push("beneficiaryName");
  if (payload.kind === "vente" && !payload.salePrice) missing.push("salePrice");
  if (payload.kind === "motif" && !payload.motifDescription) missing.push("motifDescription");
  if (missing.length) return res.status(400).json({ error: `Champs manquants : ${missing.join(", ")}` });

  try {
    const pdf = await makePdf(payload);

    // Stocker dans Supabase Storage sous lease-contract-pdfs/{userId}/{leaseId}/conge-{kind}-{ts}.pdf
    const ts = Date.now();
    const path = `${payload.userId}/${payload.leaseId}/conge-${payload.kind}-${ts}.pdf`;
    const bucket = "lease-contract-pdfs";

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;

    const { data: signed } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 3600);

    // Un congé fixe une échéance définitive : si ce PDF est rattaché à un vrai
    // bail suivi dans lokt.fr (pas le générateur de courrier autonome, dont
    // leaseId vaut toujours "standalone"), on aligne le bail sur cette échéance
    // pour que le suivi de transition locataire (TransitionPanel, alertes
    // dashboard) la détecte — sinon un bail déjà reconduit tacitement resterait
    // calculé sur son prochain cycle théorique au lieu du vrai départ.
    if (payload.leaseId && payload.leaseId !== "standalone") {
      const { error: leaseUpdateError } = await supabaseAdmin
        .from("leases")
        .update({ end_date: payload.leaseEndDate, auto_renewal_enabled: false })
        .eq("id", payload.leaseId)
        .eq("user_id", payload.userId);
      if (leaseUpdateError) console.error("[generate-conge] lease update failed:", leaseUpdateError);
    }

    return res.status(200).json({ ok: true, signedUrl: signed?.signedUrl, path });
  } catch (err: any) {
    console.error("[generate-conge]", err);
    return res.status(500).json({ error: err?.message || "Génération impossible." });
  }
}
