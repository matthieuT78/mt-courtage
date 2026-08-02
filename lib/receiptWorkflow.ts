import PDFDocument from "pdfkit";
import { supabaseAdmin } from "./supabaseAdmin";
import { getLeaseRentPeriodFromDate } from "./rentPeriod";
import { removeTrackedPartialPaymentTransactions, syncDelegatedRentTransaction } from "./rentPaymentFinance";

type Result = {
  ok: true;
  receiptId: string;
  paymentId: string | null;
  status: "generated" | "sent";
  // Bail en "quittances agence" : aucune quittance n'a été générée, seule la Finance a été mise à jour.
  delegated?: boolean;
  email: {
    attempted: boolean;
    ok: boolean;
    disabled: boolean;
    error: string | null;
    to: string | null;
    cc: string | null;
  };
  signedUrl: string | null;
};

const BUCKET = "rent-receipts-pdfs";

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function euro(v: unknown) {
  const n = Number(v || 0);
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDateFR(v: string) {
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function monthLabelFR(yyyymm: string) {
  const [y, m] = String(yyyymm).split("-").map(Number);
  if (!y || !m) return yyyymm;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function slugify(s: string) {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function receiptLabel(tenantName: string, city: string, yyyymm: string) {
  const parts = [tenantName, city, monthLabelFR(yyyymm)].filter(Boolean);
  return parts.join(" - ");
}

function parsePdfUrl(pdfUrl?: string | null) {
  if (!pdfUrl) return null;
  const idx = String(pdfUrl).indexOf(":");
  if (idx <= 0) return null;
  const bucket = String(pdfUrl).slice(0, idx);
  const path = String(pdfUrl).slice(idx + 1);
  if (bucket !== BUCKET || !path) return null;
  return { bucket, path };
}

function buildReceiptText(params: {
  landlordName: string;
  tenantName: string;
  propertyAddress: string;
  periodStart: string;
  periodEnd: string;
  rent: number;
  charges: number;
  total: number;
  paymentMethod?: string | null;
}) {
  return [
    `Je soussigné(e), ${params.landlordName || "le bailleur"}, reconnais avoir reçu de ${params.tenantName || "le locataire"} la somme de ${euro(params.total)} (dont ${euro(params.rent)} de loyer hors charges et ${euro(params.charges)} de provisions sur charges), au titre du paiement du loyer et des charges pour le logement situé :`,
    `${params.propertyAddress || "—"}`,
    ``,
    `Cette somme couvre la période du ${formatDateFR(params.periodStart)} au ${formatDateFR(params.periodEnd)}.`,
    params.paymentMethod ? `Mode de paiement : ${params.paymentMethod}.` : "",
    ``,
    `La présente quittance vaut reçu pour solde de toute dette locative pour la période indiquée.`,
    ``,
    `Le ${formatDateFR(todayISO())}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildPdfBuffer(text: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").text("Quittance de loyer", { align: "left" });
    doc.moveDown(0.8);
    doc.fontSize(11).font("Helvetica").text(text, { lineGap: 5 });
    doc.end();
  });
}

async function sendEmailViaResend(params: {
  to: string;
  cc?: string | null;
  subject: string;
  html: string;
  filename: string;
  pdf: Buffer;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return { ok: false as const, disabled: true, error: "Email non configuré (RESEND_API_KEY / RESEND_FROM manquants)." };
  }

  const payload: any = {
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: [{ filename: params.filename, content: params.pdf.toString("base64") }],
  };
  if (params.cc) payload.cc = params.cc;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = await r.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    // ignore
  }

  if (!r.ok) return { ok: false as const, disabled: false, error: json?.message || raw || `Erreur Resend ${r.status}` };
  return { ok: true as const, disabled: false, error: null };
}

export async function confirmLeasePaymentAndSendReceipt(params: {
  userId: string;
  leaseId: string;
  periodStart: string;
  periodEnd: string;
  landlordEmail?: string | null;
  generateEndpointUrl?: string | null;
  internalSecret?: string | null;
}): Promise<Result> {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");

  const userId = safeStr(params.userId);
  const leaseId = safeStr(params.leaseId);
  const periodStart = safeStr(params.periodStart);
  const periodEnd = safeStr(params.periodEnd);
  if (!userId || !leaseId || !periodStart || !periodEnd) throw new Error("Paramètres quittance incomplets.");

  const leaseRes = await supabaseAdmin.from("leases").select("*").eq("id", leaseId).single();
  if (leaseRes.error || !leaseRes.data) throw new Error("Bail introuvable.");
  const lease: any = leaseRes.data;
  if (String(lease.user_id) !== userId) throw new Error("Accès refusé.");

  const [{ data: tenant }, { data: property }, { data: landlord }, { data: landlordProfile }] = await Promise.all([
    supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).maybeSingle(),
    supabaseAdmin.from("properties").select("*").eq("id", lease.property_id).maybeSingle(),
    supabaseAdmin.from("landlords").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);

  const rentPeriod = getLeaseRentPeriodFromDate(lease, periodStart);
  if (!rentPeriod) throw new Error("Cette période est en dehors des dates du bail.");
  const normalizedPeriodStart = rentPeriod.periodStart;
  const normalizedPeriodEnd = rentPeriod.periodEnd;
  const { rent, charges, total } = rentPeriod;

  // Quittances déléguées à une agence : jamais de PDF ni d'envoi au locataire — cette
  // confirmation (déclenchée par un lien email ou l'app) ne sert qu'à alimenter la Finance
  // du bailleur, exactement comme la confirmation manuelle depuis la section Quittances.
  if (lease.receipts_disabled) {
    const existingPayment = await supabaseAdmin
      .from("rent_payments")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("period_start", normalizedPeriodStart)
      .eq("period_end", normalizedPeriodEnd)
      .maybeSingle();

    const paymentPayload = {
      lease_id: leaseId,
      period_start: normalizedPeriodStart,
      period_end: normalizedPeriodEnd,
      rent_amount: rent,
      charges_amount: charges,
      total_amount: total,
      due_date: normalizedPeriodStart,
      paid_at: new Date().toISOString(),
      payment_method: lease.payment_method || null,
      source: "owner_confirm_email",
      updated_at: new Date().toISOString(),
    };

    let paymentId: string;
    if (existingPayment.data?.id) {
      paymentId = existingPayment.data.id;
      const updPay = await supabaseAdmin.from("rent_payments").update(paymentPayload).eq("id", paymentId);
      if (updPay.error) throw updPay.error;
    } else {
      const insPay = await supabaseAdmin.from("rent_payments").insert(paymentPayload).select("id").single();
      if (insPay.error || !insPay.data) throw new Error(insPay.error?.message || "Création paiement échouée.");
      paymentId = insPay.data.id;
    }

    await removeTrackedPartialPaymentTransactions({ leaseId, periodStart: normalizedPeriodStart, periodEnd: normalizedPeriodEnd });
    await syncDelegatedRentTransaction({
      userId,
      propertyId: lease.property_id ?? null,
      leaseId,
      periodStart: normalizedPeriodStart,
      periodEnd: normalizedPeriodEnd,
      amount: total,
    });

    return {
      ok: true,
      receiptId: "",
      paymentId,
      status: "generated",
      delegated: true,
      email: { attempted: false, ok: false, disabled: true, error: null, to: null, cc: null },
      signedUrl: null,
    };
  }

  const issueDate = todayISO();

  const tenantName = safeStr((tenant as any)?.full_name) || "Locataire";
  // "landlords.display_name" n'est renseigné par aucune UI du site — se rabattre
  // sur profiles.full_name avant le libellé générique "Bailleur".
  const landlordName = safeStr((landlord as any)?.display_name) || safeStr((landlordProfile as any)?.full_name) || "Bailleur";
  const propertyCity = safeStr((property as any)?.city);
  const yyyymm = normalizedPeriodStart.slice(0, 7);
  const label = receiptLabel(tenantName, propertyCity, yyyymm);
  const emailSubject = `Quittance de loyer - ${label}`;
  const pdfFilename = `quittance-${slugify(label) || yyyymm}.pdf`;
  const propertyAddress =
    [
      safeStr((property as any)?.address_line1),
      safeStr((property as any)?.address_line2),
      [safeStr((property as any)?.postal_code), safeStr((property as any)?.city)].filter(Boolean).join(" "),
      safeStr((property as any)?.country || "FR"),
    ]
      .filter(Boolean)
      .join(", ") || safeStr((property as any)?.label);

  const contentText = buildReceiptText({
    landlordName,
    tenantName,
    propertyAddress,
    periodStart: normalizedPeriodStart,
    periodEnd: normalizedPeriodEnd,
    rent,
    charges,
    total,
    paymentMethod: lease.payment_method,
  });

  // Clean up stale draft receipts for the same period_start but a different period_end.
  // Prevents unique constraint conflicts when period_end changes after end_date is updated on the lease.
  const yyyymmR = normalizedPeriodStart.slice(0, 7);
  await supabaseAdmin
    .from("rent_receipts")
    .delete()
    .eq("lease_id", leaseId)
    .eq("period_start", normalizedPeriodStart)
    .eq("status", "draft")
    .neq("period_end", normalizedPeriodEnd);

  let receipt: any = null;
  const existingReceipt = await supabaseAdmin
    .from("rent_receipts")
    .select("*")
    .eq("lease_id", leaseId)
    .eq("period_start", normalizedPeriodStart)
    .gte("period_end", `${yyyymmR}-01`)
    .lte("period_end", `${yyyymmR}-31`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingReceipt.error) throw existingReceipt.error;

  if (existingReceipt.data) {
    const upd = await supabaseAdmin
      .from("rent_receipts")
      .update({
        period_end: normalizedPeriodEnd,
        rent_amount: rent,
        charges_amount: charges,
        total_amount: total,
        issue_date: issueDate,
        content_text: existingReceipt.data.content_text || contentText,
        status: existingReceipt.data.status || "generated",
        edited_at: new Date().toISOString(),
      })
      .eq("id", existingReceipt.data.id)
      .select("*")
      .single();
    if (upd.error || !upd.data) throw new Error(upd.error?.message || "Update quittance échoué.");
    receipt = upd.data;
  } else {
    const ins = await supabaseAdmin
      .from("rent_receipts")
      .upsert({
        lease_id: leaseId,
        owner_user_id: userId,
        period_start: normalizedPeriodStart,
        period_end: normalizedPeriodEnd,
        rent_amount: rent,
        charges_amount: charges,
        total_amount: total,
        issue_date: issueDate,
        issued_at: new Date().toISOString(),
        content_text: contentText,
        status: "generated",
      }, { onConflict: "lease_id,period_start,period_end" })
      .select("*")
      .single();
    if (ins.error || !ins.data) throw new Error(ins.error?.message || "Création quittance échouée.");
    receipt = ins.data;
  }

  let paymentId: string | null = receipt.payment_id || null;
  const existingPayment = await supabaseAdmin
    .from("rent_payments")
    .select("id")
    .eq("lease_id", leaseId)
    .eq("period_start", normalizedPeriodStart)
    .eq("period_end", normalizedPeriodEnd)
    .maybeSingle();

  const paymentPayload = {
    lease_id: leaseId,
    period_start: normalizedPeriodStart,
    period_end: normalizedPeriodEnd,
    rent_amount: rent,
    charges_amount: charges,
    total_amount: total,
    due_date: normalizedPeriodStart,
    paid_at: new Date().toISOString(),
    payment_method: lease.payment_method || null,
    source: "owner_confirm_email",
    updated_at: new Date().toISOString(),
  };

  if (existingPayment.data?.id) {
    paymentId = existingPayment.data.id;
    const updPay = await supabaseAdmin.from("rent_payments").update(paymentPayload).eq("id", paymentId);
    if (updPay.error) throw updPay.error;
  } else {
    const insPay = await supabaseAdmin.from("rent_payments").insert(paymentPayload).select("id").single();
    if (insPay.error || !insPay.data) throw new Error(insPay.error?.message || "Création paiement échouée.");
    paymentId = insPay.data.id;
  }

  let parsedPdf = parsePdfUrl(receipt.pdf_url);
  let pdfBuffer: Buffer | null = null;

  // Tenter la génération Puppeteer via l'endpoint interne avant le fallback PDFKit
  if (!parsedPdf && params.generateEndpointUrl && params.internalSecret) {
    try {
      await fetch(params.generateEndpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": params.internalSecret },
        body: JSON.stringify({ userId, leaseId, periodStart: normalizedPeriodStart, periodEnd: normalizedPeriodEnd }),
      });
      const r1 = await supabaseAdmin.from("rent_receipts").select("*").eq("id", receipt.id).single();
      if (r1.data?.pdf_url) receipt = r1.data;
      parsedPdf = parsePdfUrl(receipt.pdf_url);
    } catch {
      // fallback PDFKit
    }
  }

  if (!parsedPdf) {
    pdfBuffer = await buildPdfBuffer(receipt.content_text || contentText);
    const yyyymm = normalizedPeriodStart.slice(0, 7) || "quittance";
    const filenamePart = `quittance-${yyyymm}.pdf`;
    const storagePath = `${userId}/${leaseId}/${receipt.id}/${filenamePart}`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) throw up.error;

    const pdfUrl = `${BUCKET}:${storagePath}`;
    const updReceipt = await supabaseAdmin
      .from("rent_receipts")
      .update({
        pdf_url: pdfUrl,
        payment_id: paymentId,
        archived_at: new Date().toISOString(),
        edited_at: new Date().toISOString(),
      })
      .eq("id", receipt.id)
      .select("*")
      .single();
    if (updReceipt.error || !updReceipt.data) throw new Error(updReceipt.error?.message || "Update PDF quittance échoué.");
    receipt = updReceipt.data;
    parsedPdf = parsePdfUrl(pdfUrl);
  }

  if (!parsedPdf) throw new Error("pdf_url invalide après génération.");

  const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(parsedPdf.path, 60 * 10);
  if (signed.error || !signed.data?.signedUrl) throw new Error(signed.error?.message || "Signed URL échouée.");

  if (!pdfBuffer) {
    const pdfResp = await fetch(signed.data.signedUrl);
    if (pdfResp.ok) pdfBuffer = Buffer.from(await pdfResp.arrayBuffer());
  }

  const toEmail = safeStr(lease.tenant_receipt_email) || safeStr((tenant as any)?.email);
  let ccEmail = safeStr(params.landlordEmail) || safeStr(lease.reminder_email) || null;
  if (!ccEmail) {
    const ownerRes = await supabaseAdmin.auth.admin.getUserById(userId);
    ccEmail = safeStr(ownerRes.data?.user?.email) || null;
  }
  const alreadySent = String(receipt.status || "").toLowerCase() === "sent" && !!receipt.sent_at;

  let email = { ok: false, disabled: false, error: "Email non tenté." };
  if (alreadySent) {
    email = { ok: true, disabled: false, error: null };
  } else if (!toEmail) {
    email = { ok: false, disabled: false, error: "Email locataire manquant." };
  } else if (!pdfBuffer) {
    email = { ok: false, disabled: false, error: "PDF indisponible pour pièce jointe." };
  } else {
    email = await sendEmailViaResend({
      to: toEmail,
      cc: ccEmail,
      subject: emailSubject,
      filename: pdfFilename,
      pdf: pdfBuffer,
      html: `
        <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.5">
          <p>Bonjour,</p>
          <p>Veuillez trouver en pièce jointe votre quittance de loyer pour <b>${monthLabelFR(yyyymm)}</b>.</p>
          <p>Cordialement,<br/>lokt.fr</p>
        </div>
      `,
    });
  }

  await removeTrackedPartialPaymentTransactions({
    leaseId,
    periodStart: normalizedPeriodStart,
    periodEnd: normalizedPeriodEnd,
  });

  await supabaseAdmin.from("transactions").upsert(
    [
      {
        user_id: userId,
        property_id: lease.property_id ?? null,
        lease_id: leaseId,
        receipt_id: receipt.id,
        occurred_at: periodEnd,
        direction: "in",
        status: "received",
        category: "rent",
        label: "Loyer (quittance confirmée)",
        amount: total,
        notes: null,
        updated_at: new Date().toISOString(),
      },
    ] as any,
    { onConflict: "user_id,receipt_id" }
  );

  const finalStatus: "generated" | "sent" = email.ok ? "sent" : "generated";
  const upd = await supabaseAdmin
    .from("rent_receipts")
    .update({
      payment_id: paymentId,
      status: finalStatus,
      sent_to_tenant_email: toEmail || receipt.sent_to_tenant_email || null,
      sent_at: email.ok ? receipt.sent_at || new Date().toISOString() : receipt.sent_at || null,
      send_error: email.ok ? null : email.error,
      edited_at: new Date().toISOString(),
    })
    .eq("id", receipt.id);
  if (upd.error) throw upd.error;

  if (toEmail) {
    try {
      await supabaseAdmin.from("email_logs").insert({
        user_id: userId,
        lease_id: leaseId,
        receipt_id: receipt.id,
        to_email: toEmail,
        subject: `Quittance de loyer - ${periodStart.slice(0, 7)}`,
        body_preview: `Quittance ${periodStart.slice(0, 7)}`,
        sent_at: new Date().toISOString(),
        status: email.ok ? "sent" : email.disabled ? "disabled" : "error",
        error_message: email.ok ? null : email.error,
      });
    } catch {
      // log non bloquant
    }
  }

  return {
    ok: true,
    receiptId: receipt.id,
    paymentId,
    status: finalStatus,
    email: {
      attempted: !!toEmail && !alreadySent,
      ok: email.ok,
      disabled: email.disabled,
      error: email.ok ? null : email.error,
      to: toEmail || null,
      cc: ccEmail,
    },
    signedUrl: signed.data.signedUrl,
  };
}
