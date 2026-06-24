import type { NextApiRequest, NextApiResponse } from "next";
import PDFDocument from "pdfkit";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type UnpaidRow = { period: string; amount: number };

type Payload = {
  userId: string;
  landlordName: string;
  landlordAddress: string;
  tenantName: string;
  propertyAddress: string;
  unpaidRows: UnpaidRow[];
  totalAmount: number;
  deadlineDate: string;
  signaturePlace: string;
  signatureDate: string;
};

const euro = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const fmtDate = (iso: string) => {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

function makePdf(p: Payload): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: "Mise en demeure de payer" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const body = (text: string, opts?: object) =>
      doc.font("Helvetica").fontSize(10).fillColor("#1e293b").text(text, opts);
    const bold = (text: string, opts?: object) =>
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(text, opts);
    const small = (text: string) =>
      doc.font("Helvetica").fontSize(8.5).fillColor("#64748b").text(text);

    // En-tête expéditeur
    bold(p.landlordName);
    body(p.landlordAddress);
    doc.moveDown(1.2);

    // Destinataire
    bold(p.tenantName);
    body(p.propertyAddress);
    doc.moveDown(1.2);

    // Lieu et date
    body(`${p.signaturePlace}, le ${fmtDate(p.signatureDate)}`);
    doc.moveDown(0.4);
    body("Envoi par lettre recommandée avec accusé de réception");
    doc.moveDown(1.2);

    // Objet
    bold("Objet : Mise en demeure de payer les loyers impayés");
    doc.moveDown(1.2);

    body("Madame, Monsieur,");
    doc.moveDown(0.6);

    body(
      `Je soussigné(e), ${p.landlordName}, propriétaire du logement situé ${p.propertyAddress}, vous adresse la présente mise en demeure.`
    );
    doc.moveDown(0.6);

    body("À ce jour, vous êtes redevable à mon égard des sommes suivantes au titre des loyers et charges impayés :");
    doc.moveDown(0.4);

    const validRows = p.unpaidRows.filter((r) => r.period || r.amount);
    for (const row of validRows) {
      body(`    • ${row.period} : ${euro(row.amount)}`);
    }
    doc.moveDown(0.3);
    bold(`    Total réclamé : ${euro(p.totalAmount)}`);
    doc.moveDown(0.6);

    bold(
      `Je vous mets en demeure de procéder au règlement de la totalité de cette somme dans un délai de HUIT (8) JOURS à compter de la réception du présent courrier, soit avant le ${fmtDate(p.deadlineDate)}.`
    );
    doc.moveDown(0.6);

    body("À défaut de paiement dans ce délai, je me verrai contraint(e) d'engager les procédures suivantes :");
    doc.moveDown(0.3);
    body(
      "    • Faire délivrer un commandement de payer par voie d'huissier de justice, conformément à l'article 24 de la loi n°89-462 du 6 juillet 1989 ;"
    );
    body(
      "    • Demander en justice la résiliation du contrat de bail et votre expulsion du logement ;"
    );
    body(
      "    • Réclamer le remboursement de la totalité des sommes dues, augmentées des intérêts au taux légal ainsi que des frais de procédure."
    );
    doc.moveDown(0.6);

    body(
      "Je vous invite à prendre contact avec moi dans les meilleurs délais afin de régulariser votre situation ou de convenir d'un plan d'apurement de la dette."
    );
    doc.moveDown(1.2);

    body("Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.");
    doc.moveDown(2);

    bold(p.landlordName);
    doc.moveDown(0.3);
    body("(Signature)");
    doc.moveDown(2);

    // Pied de page légal
    doc.moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).stroke("#e2e8f0");
    doc.moveDown(0.4);
    small(
      "Document établi conformément à l'article 24 de la loi n°89-462 du 6 juillet 1989 tendant à améliorer les rapports locatifs. " +
      "Cette mise en demeure ne constitue pas un commandement de payer au sens de l'article 24, qui doit être délivré par acte d'huissier pour produire ses effets légaux. " +
      "Conservez l'accusé de réception de la lettre recommandée comme preuve de la date de remise au locataire."
    );

    doc.end();
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const payload: Payload = req.body;
  const userCheck = requireMatchingUser(auth, String(payload.userId || ""));
  if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

  // Compléter le profil bailleur si absent
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

  const missing: string[] = [];
  if (!payload.landlordName) missing.push("landlordName");
  if (!payload.tenantName) missing.push("tenantName");
  if (!payload.propertyAddress) missing.push("propertyAddress");
  if (!payload.totalAmount || payload.totalAmount <= 0) missing.push("totalAmount");
  if (!payload.deadlineDate) missing.push("deadlineDate");
  if (!payload.signaturePlace) missing.push("signaturePlace");
  if (!payload.signatureDate) missing.push("signatureDate");
  if (!payload.unpaidRows?.length) missing.push("unpaidRows");
  if (missing.length) return res.status(400).json({ error: `Champs manquants : ${missing.join(", ")}` });

  try {
    const pdf = await makePdf(payload);

    const ts = Date.now();
    const path = `${payload.userId}/standalone/mise-en-demeure-${ts}.pdf`;
    const bucket = "lease-contract-pdfs";

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;

    const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 3600);
    return res.status(200).json({ ok: true, signedUrl: signed?.signedUrl, path });
  } catch (err: any) {
    console.error("[generate-mise-en-demeure]", err);
    return res.status(500).json({ error: err?.message || "Génération impossible." });
  }
}
