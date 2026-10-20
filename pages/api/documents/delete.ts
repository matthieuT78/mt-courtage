import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireApiUser, requireMatchingUser } from "../../../lib/apiAuth";
import { parseStoredLeaseContractUrl } from "../../../lib/leaseContract";

// Les quittances ne sont volontairement pas couvertes ici : elles sont la
// pièce de référence du suivi financier, pas un simple fichier joint — leur
// suppression resterait un sujet à part s'il est un jour demandé.
type DocKind = "contract" | "inventory" | "dpe" | "finance-doc";

function parseDocumentId(documentId: string): { kind: DocKind; id: string } | null {
  const prefixes: Array<{ prefix: string; kind: DocKind }> = [
    { prefix: "contract-", kind: "contract" },
    { prefix: "inventory-", kind: "inventory" },
    { prefix: "dpe-", kind: "dpe" },
    { prefix: "finance-doc-", kind: "finance-doc" },
  ];
  for (const { prefix, kind } of prefixes) {
    if (documentId.startsWith(prefix)) return { kind, id: documentId.slice(prefix.length) };
  }
  return null;
}

async function removeStorageObject(bucket?: string | null, path?: string | null) {
  if (!bucket || !path) return;
  try {
    await supabaseAdmin!.storage.from(bucket).remove([path]);
  } catch {
    // best-effort : si le fichier est déjà absent du storage, on supprime quand même la ligne en base.
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const userId = String(req.body?.userId || "");
    const documentId = String(req.body?.documentId || "");
    if (!userId || !documentId) return res.status(400).json({ error: "userId et documentId requis." });

    const userCheck = requireMatchingUser(auth, userId);
    if (!userCheck.ok) return res.status(userCheck.status).json({ error: userCheck.error });

    const parsed = parseDocumentId(documentId);
    if (!parsed) return res.status(400).json({ error: "documentId invalide." });
    const { kind, id } = parsed;

    if (kind === "contract") {
      const { data: doc } = await supabaseAdmin.from("lease_contract_documents").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
      if (!doc) return res.status(404).json({ error: "Document introuvable." });
      if (doc.signed_pdf_url) {
        return res.status(409).json({ error: "Ce bail est signé — suppression bloquée pour ne pas perdre une pièce contractuelle." });
      }
      const storage = parseStoredLeaseContractUrl(doc.external_pdf_url || doc.pdf_url);
      await removeStorageObject(storage?.bucket, storage?.path);
      const del = await supabaseAdmin.from("lease_contract_documents").delete().eq("id", id);
      if (del.error) return res.status(500).json({ error: del.error.message });
      return res.status(200).json({ ok: true });
    }

    if (kind === "inventory") {
      const { data: report } = await supabaseAdmin.from("inventory_reports").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
      if (!report) return res.status(404).json({ error: "Document introuvable." });
      const status = String(report.status || "").toLowerCase();
      const deletable = report.document_source === "external" || status === "draft";
      if (!deletable) {
        return res.status(409).json({ error: "Cet état des lieux est finalisé — suppression bloquée pour ne pas perdre une pièce contractuelle." });
      }
      const raw = String(report.pdf_url || "");
      const sep = raw.indexOf(":");
      if (sep > 0) await removeStorageObject(raw.slice(0, sep), raw.slice(sep + 1));
      const del = await supabaseAdmin.from("inventory_reports").delete().eq("id", id);
      if (del.error) return res.status(500).json({ error: del.error.message });
      return res.status(200).json({ ok: true });
    }

    if (kind === "dpe") {
      const { data: dpe } = await supabaseAdmin.from("property_dpe_documents").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
      if (!dpe) return res.status(404).json({ error: "Document introuvable." });
      await removeStorageObject(dpe.storage_bucket, dpe.storage_path);
      const del = await supabaseAdmin.from("property_dpe_documents").delete().eq("id", id);
      if (del.error) return res.status(500).json({ error: del.error.message });
      return res.status(200).json({ ok: true });
    }

    // finance-doc
    const { data: doc } = await supabaseAdmin.from("transaction_documents").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!doc) return res.status(404).json({ error: "Document introuvable." });
    await removeStorageObject(doc.storage_bucket, doc.storage_path);
    const del = await supabaseAdmin.from("transaction_documents").delete().eq("id", id);
    if (del.error) return res.status(500).json({ error: del.error.message });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[api/documents/delete] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
