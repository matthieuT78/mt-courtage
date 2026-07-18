import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { isLeaseContractKind } from "../../../lib/leaseContract";
import { getUserStorageUsage, invalidateStorageCache } from "../../../lib/storageQuota";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function loadContext(userId: string, leaseId: string) {
  if (!supabaseAdmin) throw new Error("Supabase admin non configuré.");
  const { data: lease } = await supabaseAdmin.from("leases").select("*").eq("id", leaseId).eq("user_id", userId).maybeSingle();
  if (!lease) throw new Error("Bail introuvable.");
  const [{ data: property }, { data: tenant }, { data: landlord }, { data: profile }, { data: document }] = await Promise.all([
    supabaseAdmin.from("properties").select("*").eq("id", lease.property_id).maybeSingle(),
    supabaseAdmin.from("tenants").select("*").eq("id", lease.tenant_id).maybeSingle(),
    supabaseAdmin.from("landlords").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("lease_contract_documents").select("*").eq("lease_id", leaseId).maybeSingle(),
  ]);
  return { lease, property, tenant, landlord, profile, document };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const { userId, leaseId, action, formData, contractKind, signedPdfUrl, externalPdfUrl, fileName } = req.body || {};
    const userCheck = requireMatchingUser(auth, String(userId || ""));
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });
    if (!leaseId) return res.status(400).json({ error: "leaseId requis." });
    const context = await loadContext(String(userId), String(leaseId));
    if (action === "load") return res.status(200).json(context);
    const isLocked = context.document?.status === "signed" || context.document?.status === "archived";
    if (isLocked) {
      return res.status(409).json({ error: "Ce bail est déjà signé et ne peut plus être modifié." });
    }
    if (action === "confirmSigned") {
      if (!context.document?.id || !signedPdfUrl) return res.status(400).json({ error: "Document et PDF signé requis." });
      const { data, error } = await supabaseAdmin
        .from("lease_contract_documents")
        .update({ signed_pdf_url: signedPdfUrl, signed_at: new Date().toISOString(), status: "signed", updated_at: new Date().toISOString() })
        .eq("id", context.document.id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, document: data });
    }
    if (action === "confirmExternal") {
      if (!context.document?.id || !externalPdfUrl) return res.status(400).json({ error: "Document et PDF importé requis." });
      const expectedPrefix = `lease-contract-pdfs:${userId}/${leaseId}/${context.document.id}.external.pdf`;
      if (externalPdfUrl !== expectedPrefix) return res.status(400).json({ error: "Référence du bail importé invalide." });
      const usage = await getUserStorageUsage(String(userId));
      if (usage.usedBytes > usage.quotaBytes) {
        await supabaseAdmin.storage.from("lease-contract-pdfs").remove([`${userId}/${leaseId}/${context.document.id}.external.pdf`]);
        return res.status(409).json({ error: "Quota dépassé : le fichier n’a pas été conservé." });
      }
      const { data, error } = await supabaseAdmin
        .from("lease_contract_documents")
        .update({
          document_source: "external",
          external_pdf_url: externalPdfUrl,
          original_file_name: String(fileName || "bail-importé.pdf").slice(0, 180),
          pdf_url: null,
          signed_pdf_url: null,
          generated_at: null,
          status: "signed",
          signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", context.document.id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, document: data });
    }
    if (action === "deleteExternal") {
      if (!context.document?.id) return res.status(400).json({ error: "Document introuvable." });
      const path = `${userId}/${leaseId}/${context.document.id}.external.pdf`;
      await supabaseAdmin.storage.from("lease-contract-pdfs").remove([path]);
      invalidateStorageCache(String(userId));
      const { data, error } = await supabaseAdmin
        .from("lease_contract_documents")
        .update({
          document_source: "generated",
          external_pdf_url: null,
          original_file_name: null,
          status: "draft",
          signed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", context.document.id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, document: data });
    }
    if (action !== "save" || !isLeaseContractKind(contractKind)) return res.status(400).json({ error: "Action ou type de bail invalide." });
    const payload = {
      user_id: String(userId),
      lease_id: String(leaseId),
      contract_kind: contractKind,
      document_source: "generated",
      external_pdf_url: null,
      original_file_name: null,
      form_data: formData || {},
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin.from("lease_contract_documents").upsert(payload, { onConflict: "lease_id" }).select("*").single();
    if (error) throw error;
    return res.status(200).json({ ok: true, document: data });
  } catch (error: any) {
    console.error("[api/lease-contracts] error:", error);
    return res.status(500).json({ error: error?.message || "Erreur interne" });
  }
}
