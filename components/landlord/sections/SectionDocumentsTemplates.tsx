import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownTrayIcon,
  DocumentTextIcon,
  EyeIcon,
  FolderIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { SectionModeles, TEMPLATES as MODELES_TEMPLATES } from "./SectionModeles";

type DocTab = "vault" | "modeles";
import { usePermissions } from "../../PermissionProvider";
import { supabase } from "../../../lib/supabaseClient";

type PropertyLite = { id: string; label?: string | null; address?: string | null; address_line1?: string | null; postal_code?: string | null; city?: string | null; status?: string | null };
type TenantLite = { id: string; full_name?: string | null; email?: string | null; status?: string | null; archived_at?: string | null };
type LeaseLite = {
  id: string;
  property_id?: string | null;
  tenant_id?: string | null;
  co_tenant_id?: string | null;
  co_tenant_name?: string | null;
  rent_amount?: number | null;
  charges_amount?: number | null;
  deposit_amount?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
};

type ProfileLite = { full_name?: string | null; address_line1?: string | null; postal_code?: string | null; city?: string | null } | null;

type Props = {
  userId: string;
  userEmail?: string | null;
  properties?: PropertyLite[];
  tenants?: TenantLite[];
  leases?: LeaseLite[];
  profile?: ProfileLite;
};

type DocumentKind = "Bail" | "État des lieux" | "DPE" | "Quittance" | "Facture" | "Eau" | "Photo" | "Autre";
type FolderKey = "all" | "properties" | "leases" | "inventories" | "receipts" | "invoices" | "diagnostics" | "tools" | "photos";
type DocumentSort = "date_desc" | "date_asc" | "size_desc" | "size_asc";

type VaultDocument = {
  id: string;
  kind: DocumentKind;
  title: string;
  context: string;
  propertyId?: string | null;
  leaseId?: string | null;
  status?: string | null;
  date?: string | null;
  sizeBytes?: number | null;
  source: string;
  open?: (win?: Window | null) => Promise<void>;
  download?: () => Promise<void>;
  deletable?: boolean;
};

type StorageData = {
  usedBytes: number;
  quotaBytes: number;
  availableBytes: number;
  plan?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "Date inconnue";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date inconnue";
  return d.toLocaleDateString("fr-FR");
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Mo";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} Mo`;
}

async function authHeaders() {
  if (!supabase) throw new Error("Supabase n’est pas configuré.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return { Authorization: `Bearer ${token}` };
}

async function safeSelect<T>(table: string, select: string, userId: string, orderColumn = "created_at") {
  if (!supabase) return [] as T[];
  const { data, error } = await supabase.from(table).select(select).eq("user_id", userId).order(orderColumn, { ascending: false }).limit(80);
  if (error) {
    console.warn(`[documents] ${table}:`, error.message);
    return [] as T[];
  }
  return (Array.isArray(data) ? data : []) as T[];
}

async function safeSelectByLeaseIds<T>(table: string, select: string, leaseIds: string[], orderColumn = "created_at") {
  if (!supabase || leaseIds.length === 0) return [] as T[];
  const { data, error } = await supabase.from(table).select(select).in("lease_id", leaseIds).order(orderColumn, { ascending: false }).limit(80);
  if (error) {
    console.warn(`[documents] ${table}:`, error.message);
    return [] as T[];
  }
  return (Array.isArray(data) ? data : []) as T[];
}

function statusLabel(status?: string | null) {
  if (!status) return "Archivé";
  if (status === "draft") return "Brouillon";
  if (status === "ready") return "Prêt";
  if (status === "signed") return "Signé";
  if (status === "finalized") return "Finalisé";
  if (status === "archived") return "Archivé";
  return status;
}

function kindTone(kind: DocumentKind) {
  if (kind === "Bail") return "border-indigo-200 bg-indigo-50 text-indigo-800";
  if (kind === "État des lieux") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  if (kind === "DPE") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (kind === "Quittance") return "border-violet-200 bg-violet-50 text-violet-800";
  if (kind === "Facture") return "border-amber-200 bg-amber-50 text-amber-800";
  if (kind === "Eau") return "border-sky-200 bg-sky-50 text-sky-800";
  if (kind === "Photo") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function folderForDocument(doc: VaultDocument): FolderKey {
  if (doc.kind === "Bail") return "leases";
  if (doc.kind === "État des lieux") return "inventories";
  if (doc.kind === "DPE") return "diagnostics";
  if (doc.kind === "Quittance") return "receipts";
  if (doc.kind === "Facture") return "invoices";
  if (doc.kind === "Eau") return "tools";
  if (doc.kind === "Photo") return "photos";
  return "all";
}

function fileExtension(kind: DocumentKind) {
  if (kind === "Photo") return "JPG/PNG";
  return "PDF";
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function documentTime(doc: VaultDocument) {
  const time = new Date(doc.date || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareDocuments(a: VaultDocument, b: VaultDocument, sort: DocumentSort) {
  const titleCompare = a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
  if (sort === "size_desc" || sort === "size_asc") {
    const sizeA = Number(a.sizeBytes || 0);
    const sizeB = Number(b.sizeBytes || 0);
    const hasSizeA = sizeA > 0;
    const hasSizeB = sizeB > 0;
    if (hasSizeA !== hasSizeB) return hasSizeA ? -1 : 1;
    if (hasSizeA && sizeA !== sizeB) return sort === "size_desc" ? sizeB - sizeA : sizeA - sizeB;
    const dateCompare = documentTime(b) - documentTime(a);
    return dateCompare || titleCompare;
  }

  const dateCompare = sort === "date_asc" ? documentTime(a) - documentTime(b) : documentTime(b) - documentTime(a);
  return dateCompare || titleCompare;
}

export function SectionDocumentsTemplates({ userId, properties, tenants, leases, profile }: Props) {
  const { loading, canUseLandlord } = usePermissions();
  const [tab, setTab] = useState<DocTab>("vault");
  const [folder, setFolder] = useState<FolderKey>("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DocumentSort>("date_desc");
  const [ok, setOk] = useState<string | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [vaultDocuments, setVaultDocuments] = useState<VaultDocument[]>([]);
  const [storageData, setStorageData] = useState<StorageData | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<VaultDocument | null>(null);

  const safeProperties = Array.isArray(properties) ? properties : [];
  const safeTenants = Array.isArray(tenants) ? tenants : [];
  const safeLeases = Array.isArray(leases) ? leases : [];

  const propertyById = useMemo(() => new Map(safeProperties.map((p) => [p.id, p])), [safeProperties]);
  const tenantById = useMemo(() => new Map(safeTenants.map((t) => [t.id, t])), [safeTenants]);
  const leaseById = useMemo(() => new Map(safeLeases.map((l) => [l.id, l])), [safeLeases]);

  const locked = !loading && !canUseLandlord;

  const openUrl = (url: string, win?: Window | null) => {
    if (win) { win.location.href = url; return; }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadUrl = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = safeFileName(filename) || "document.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getLeaseDocumentUrl = async (documentId: string) => {
    const response = await fetch(`/api/lease-contracts/pdf-url?userId=${encodeURIComponent(userId)}&documentId=${encodeURIComponent(documentId)}`, {
      headers: await authHeaders(),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.signedUrl) throw new Error(json?.error || "Impossible d’ouvrir le bail.");
    return String(json.signedUrl);
  };

  const getInventoryDocumentUrl = async (reportId: string) => {
    const response = await fetch(`/api/inventory/pdf-url?reportId=${encodeURIComponent(reportId)}&userId=${encodeURIComponent(userId)}`, {
      headers: await authHeaders(),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.signedUrl) throw new Error(json?.error || "Impossible d’ouvrir l’état des lieux.");
    return String(json.signedUrl);
  };

  const getDpeDocumentUrl = async (documentId: string) => {
    const response = await fetch(`/api/account/dpe-url?id=${encodeURIComponent(documentId)}`, { headers: await authHeaders() });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.signedUrl) throw new Error(json?.error || "Impossible d’ouvrir le DPE.");
    return String(json.signedUrl);
  };

  const getReceiptDocumentUrl = async (receiptId: string, pdfUrl: string) => {
    const response = await fetch("/api/receipts/signed-url", {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ receiptId, pdf_url: pdfUrl, expiresIn: 600 }),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.signedUrl) throw new Error(json?.error || "Impossible d’ouvrir la quittance.");
    return String(json.signedUrl);
  };

  const getStorageDocumentUrl = async (bucket: string, path: string) => {
    if (!supabase) throw new Error("Supabase n’est pas configuré.");
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
    if (error || !data?.signedUrl) throw error || new Error("Impossible d’ouvrir le document.");
    return data.signedUrl;
  };

  useEffect(() => {
    if (!userId || locked || !supabase) return;
    let cancelled = false;

    const loadVault = async () => {
      setDocsLoading(true);
      setDocsError(null);
      try {
        const leaseIds = Array.from(leaseById.keys()).map(String);
        const [contracts, reports, dpes, receipts, financeDocuments, waterAllocations, waterReadings] = await Promise.all([
          safeSelect<any>("lease_contract_documents", "id,lease_id,status,contract_kind,pdf_url,signed_pdf_url,external_pdf_url,original_file_name,generated_at,signed_at,updated_at,created_at", userId, "updated_at"),
          safeSelect<any>("inventory_reports", "id,lease_id,report_type,status,pdf_url,document_source,original_file_name,performed_at,updated_at,created_at", userId, "updated_at"),
          safeSelect<any>("property_dpe_documents", "id,property_id,file_name,size_bytes,created_at,updated_at", userId, "created_at"),
          safeSelectByLeaseIds<any>("rent_receipts", "id,lease_id,period_start,period_end,total_amount,pdf_url,issued_at,created_at", leaseIds, "created_at"),
          safeSelect<any>("transaction_documents", "id,transaction_id,property_id,storage_bucket,storage_path,file_name,mime_type,size_bytes,document_kind,created_at,updated_at", userId, "created_at"),
          safeSelect<any>("water_allocations", "id,property_id,site_id,title,period_start,period_end,invoice_storage_path,invoice_file_name,invoice_size_bytes,status,created_at,updated_at", userId, "created_at"),
          safeSelect<any>("water_allocation_readings", "id,allocation_id,site_unit_id,unit_label,occupant_label,photo_storage_path,photo_file_name,photo_size_bytes,created_at", userId, "created_at"),
        ]);

        const documents: VaultDocument[] = [];

        contracts.forEach((doc) => {
          const lease = doc.lease_id ? leaseById.get(String(doc.lease_id)) : null;
          const property = lease?.property_id ? propertyById.get(String(lease.property_id)) : null;
          const tenant = lease?.tenant_id ? tenantById.get(String(lease.tenant_id)) : null;
          const getUrl = () => getLeaseDocumentUrl(doc.id);
          documents.push({
            id: `contract-${doc.id}`,
            kind: "Bail",
            title: doc.original_file_name || "Contrat de bail",
            context: [property?.label || property?.address, tenant?.full_name].filter(Boolean).join(" · ") || "Bail enregistré",
            propertyId: lease?.property_id || null,
            leaseId: doc.lease_id,
            status: doc.status,
            date: doc.signed_at || doc.generated_at || doc.updated_at || doc.created_at,
            source: "Baux",
            open: doc.pdf_url || doc.signed_pdf_url || doc.external_pdf_url ? async (win?: Window | null) => openUrl(await getUrl(), win) : undefined,
            download: doc.pdf_url || doc.signed_pdf_url || doc.external_pdf_url ? async () => downloadUrl(await getUrl(), doc.original_file_name || "bail.pdf") : undefined,
            // Signé = pièce contractuelle définitive, jamais supprimable depuis cette section.
            deletable: !doc.signed_pdf_url,
          });
        });

        reports.forEach((report) => {
          const lease = report.lease_id ? leaseById.get(String(report.lease_id)) : null;
          const propertyId = lease?.property_id || null;
          const property = propertyId ? propertyById.get(String(propertyId)) : null;
          const title = report.report_type === "exit" ? "État des lieux de sortie" : "État des lieux d’entrée";
          const getUrl = () => getInventoryDocumentUrl(report.id);
          documents.push({
            id: `inventory-${report.id}`,
            kind: "État des lieux",
            title: report.original_file_name || title,
            context: property?.label || property?.address || "Dossier non rattaché",
            propertyId,
            leaseId: report.lease_id,
            status: report.status,
            date: report.performed_at || report.updated_at || report.created_at,
            source: "États des lieux",
            open: report.pdf_url ? async (win?: Window | null) => openUrl(await getUrl(), win) : undefined,
            download: report.pdf_url ? async () => downloadUrl(await getUrl(), `${title}.pdf`) : undefined,
            // Finalisé (prêt/signé/archivé) et généré par lokt = pièce contractuelle, pas supprimable.
            deletable: report.document_source === "external" || String(report.status || "").toLowerCase() === "draft",
          });
        });

        dpes.forEach((dpe) => {
          const property = dpe.property_id ? propertyById.get(String(dpe.property_id)) : null;
          const getUrl = () => getDpeDocumentUrl(dpe.id);
          documents.push({
            id: `dpe-${dpe.id}`,
            kind: "DPE",
            title: dpe.file_name || "DPE",
            context: property?.label || property?.address || "Diagnostic logement",
            propertyId: dpe.property_id,
            status: "archived",
            date: dpe.created_at || dpe.updated_at,
            sizeBytes: dpe.size_bytes,
            source: "Logements",
            open: async (win?: Window | null) => openUrl(await getUrl(), win),
            download: async () => downloadUrl(await getUrl(), dpe.file_name || "dpe.pdf"),
            deletable: true,
          });
        });

        receipts
          .filter((receipt) => receipt.pdf_url)
          .forEach((receipt) => {
            const lease = receipt.lease_id ? leaseById.get(String(receipt.lease_id)) : null;
            const property = lease?.property_id ? propertyById.get(String(lease.property_id)) : null;
            const tenant = lease?.tenant_id ? tenantById.get(String(lease.tenant_id)) : null;
            const title = `Quittance ${formatDate(receipt.period_start)} - ${formatDate(receipt.period_end)}`;
            const getUrl = () => getReceiptDocumentUrl(receipt.id, receipt.pdf_url);
            documents.push({
              id: `receipt-${receipt.id}`,
              kind: "Quittance",
              title,
              context: [property?.label || property?.address, tenant?.full_name].filter(Boolean).join(" · ") || "Quittance générée",
              propertyId: lease?.property_id || null,
              leaseId: receipt.lease_id,
              status: "finalized",
              date: receipt.issued_at || receipt.created_at,
              source: "Quittances",
              open: async (win?: Window | null) => openUrl(await getUrl(), win),
              download: async () => downloadUrl(await getUrl(), `${title}.pdf`),
            });
          });

        financeDocuments.forEach((doc) => {
          const property = doc.property_id ? propertyById.get(String(doc.property_id)) : null;
          const bucket = doc.storage_bucket || "finance-documents";
          const path = doc.storage_path;
          const getUrl = () => getStorageDocumentUrl(bucket, path);
          documents.push({
            id: `finance-doc-${doc.id}`,
            kind: "Facture",
            title: doc.file_name || "Facture",
            context: property?.label || property?.address || "Écriture Finance",
            propertyId: doc.property_id,
            status: "archived",
            date: doc.created_at || doc.updated_at,
            sizeBytes: doc.size_bytes,
            source: "Finance",
            open: path ? async (win?: Window | null) => openUrl(await getUrl(), win) : undefined,
            download: path ? async () => downloadUrl(await getUrl(), doc.file_name || "facture.pdf") : undefined,
            deletable: true,
          });
        });

        waterAllocations
          .filter((allocation) => allocation.invoice_storage_path)
          .forEach((allocation) => {
            const property = allocation.property_id ? propertyById.get(String(allocation.property_id)) : null;
            documents.push({
              id: `water-invoice-${allocation.id}`,
              kind: "Eau",
              title: allocation.invoice_file_name || allocation.title || "Facture d’eau",
              context: property?.label || allocation.title || "Répartition d’eau",
              propertyId: allocation.property_id,
              status: allocation.status,
              date: allocation.period_end || allocation.updated_at || allocation.created_at,
              sizeBytes: allocation.invoice_size_bytes,
              source: "Boîte à outils",
            });
          });

        waterReadings
          .filter((reading) => reading.photo_storage_path)
          .forEach((reading) => {
            documents.push({
              id: `water-photo-${reading.id}`,
              kind: "Photo",
              title: reading.photo_file_name || `Photo compteur ${reading.unit_label || ""}`.trim(),
              context: reading.occupant_label || reading.unit_label || "Relevé compteur",
              status: "archived",
              date: reading.created_at,
              sizeBytes: reading.photo_size_bytes,
              source: "Boîte à outils",
            });
          });

        documents.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        if (!cancelled) setVaultDocuments(documents);
      } catch (error: any) {
        if (!cancelled) setDocsError(error?.message || "Impossible de charger les documents.");
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    };

    loadVault();
    return () => {
      cancelled = true;
    };
  }, [userId, locked, leaseById, propertyById, tenantById, reloadToken]);

  const deleteDocument = async (doc: VaultDocument) => {
    setDeletingDocId(doc.id);
    setDocsError(null);
    setOk(null);
    try {
      const resp = await fetch("/api/documents/delete", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ userId, documentId: doc.id }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.error || "Suppression impossible.");
      setOk("Document supprimé.");
      setConfirmDeleteDoc(null);
      setReloadToken((t) => t + 1);
    } catch (error: any) {
      setDocsError(error?.message || "Suppression impossible.");
    } finally {
      setDeletingDocId(null);
    }
  };

  useEffect(() => {
    if (!userId || locked || !supabase) return;
    let cancelled = false;

    const loadStorage = async () => {
      setStorageLoading(true);
      setStorageError(null);
      try {
        const response = await fetch("/api/account/storage", { headers: await authHeaders() });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || "Impossible de charger le stockage.");
        if (!cancelled) setStorageData(json);
      } catch (error: any) {
        if (!cancelled) setStorageError(error?.message || "Impossible de charger le stockage.");
      } finally {
        if (!cancelled) setStorageLoading(false);
      }
    };

    loadStorage();
    return () => {
      cancelled = true;
    };
  }, [userId, locked]);

  const propertiesInVault = useMemo(() => {
    const ids = new Set(vaultDocuments.filter((d) => d.propertyId).map((d) => d.propertyId!));
    return safeProperties.filter((p) => ids.has(p.id));
  }, [vaultDocuments, safeProperties]);

  const filteredVaultDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = vaultDocuments.filter((doc) => {
      const hay = [doc.kind, doc.title, doc.context, doc.status, doc.source].join(" ").toLowerCase();
      const matchesFolder = folder === "all" || folderForDocument(doc) === folder || (folder === "properties" && !!doc.propertyId);
      const matchesProperty = folder !== "properties" || !selectedPropertyId || doc.propertyId === selectedPropertyId;
      return matchesFolder && matchesProperty && (!q || hay.includes(q));
    });
    return [...rows].sort((a, b) => compareDocuments(a, b, sort));
  }, [vaultDocuments, query, folder, selectedPropertyId, sort]);

  const docStats = useMemo(() => {
    const pdfReady = vaultDocuments.filter((doc) => !!doc.open).length;
    const byKind = new Set(vaultDocuments.map((doc) => doc.kind));
    return { total: vaultDocuments.length, pdfReady, kinds: byKind.size };
  }, [vaultDocuments]);
  const storagePercent = storageData?.quotaBytes ? Math.min(100, Math.round((storageData.usedBytes / storageData.quotaBytes) * 100)) : 0;

  const folders = useMemo(() => {
    const items: Array<{ key: FolderKey; label: string; hint: string }> = [
      { key: "all", label: "Tous les fichiers", hint: "Tout le coffre" },
      { key: "properties", label: "Par logement", hint: "Pièces rattachées" },
      { key: "leases", label: "Baux", hint: "Contrats" },
      { key: "inventories", label: "États des lieux", hint: "Entrées / sorties" },
      { key: "receipts", label: "Quittances", hint: "PDF mensuels" },
      { key: "invoices", label: "Factures", hint: "Justificatifs Finance" },
      { key: "diagnostics", label: "Diagnostics", hint: "DPE" },
      { key: "tools", label: "Outils", hint: "Eau, charges" },
      { key: "photos", label: "Photos", hint: "Relevés, preuves" },
    ];
    return items.map((item) => ({
      ...item,
      count: vaultDocuments.filter((doc) => item.key === "all" || folderForDocument(doc) === item.key || (item.key === "properties" && !!doc.propertyId)).length,
    }));
  }, [vaultDocuments]);

  const TABS = [
    { key: "vault"   as const, label: "Coffre documentaire", icon: FolderIcon,       count: docsLoading ? null : vaultDocuments.length },
    { key: "modeles" as const, label: "Modèles de lettres",  icon: PencilSquareIcon, count: MODELES_TEMPLATES.filter((t) => t.status === "available").length },
  ];

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

      {/* ── En-tête unifié ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Documents</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Documents & Modèles</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {tab === "vault" ? "Tous vos fichiers générés, en un seul endroit." : "Générez des courriers juridiques prêts à envoyer."}
          </p>
        </div>
        {tab === "vault" && (
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm shrink-0">
            <div>
              <p className="font-semibold text-slate-900">{docStats.total}</p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500">Docs</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">{docStats.pdfReady}</p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500">PDF</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">{storageLoading && !storageData ? "…" : `${storagePercent}%`}</p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500">Stockage</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Onglets ────────────────────────────────────────────────── */}
      <div className="flex rounded-2xl bg-slate-100/80 p-1 gap-1">
        {TABS.map(({ key, label, icon: Icon, count }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cx(
                "relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 sm:px-4",
                active
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className={cx("h-4 w-4 transition-colors shrink-0", active ? "text-indigo-500" : "text-slate-400")} aria-hidden="true" />
              <span className="min-w-0 truncate">{label}</span>
              {count != null && count > 0 && (
                <span className={cx(
                  "rounded-full px-2 py-0.5 text-[0.68rem] font-semibold shrink-0",
                  active ? "bg-indigo-50 text-indigo-600" : "bg-white/70 text-slate-400"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Modèles tab ───────────────────────────────────────────── */}
      {tab === "modeles" && <SectionModeles userId={userId} properties={properties} tenants={tenants} leases={leases} profile={profile} />}

      {/* ── Coffre tab ────────────────────────────────────────────── */}
      {tab === "vault" && <>

      {locked ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Fonction premium</p>
          <p className="mt-1">
            Le plan gratuit garde la gestion manuelle du premier logement. Le coffre documentaire complet est inclus dans les abonnements lokt·one et lokt·plus.
          </p>
          <Link
            href="/tarifs"
            className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Voir les abonnements
          </Link>
        </div>
      ) : null}

      {ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div> : null}
      {docsError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{docsError}</div> : null}
      {storageError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{storageError}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">État du stockage documentaire</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Baux, états des lieux, quittances, DPE, photos et factures conservés sur votre compte.
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              {storageLoading && !storageData
                ? "Chargement…"
                : `${formatBytes(storageData?.usedBytes || 0)} / ${formatBytes(storageData?.quotaBytes || 0)}`}
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div
              className={cx(
                "h-full rounded-full",
                storagePercent >= 90 ? "bg-red-500" : storagePercent >= 70 ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {storagePercent}% utilisé · {formatBytes(storageData?.availableBytes || 0)} disponibles
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-end">
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as DocumentSort)}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm lg:w-56"
          disabled={locked}
        >
          <option value="date_desc">Plus récent d’abord</option>
          <option value="date_asc">Plus ancien d’abord</option>
          <option value="size_desc">Plus lourd d’abord</option>
          <option value="size_asc">Plus léger d’abord</option>
        </select>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un document..."
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm lg:max-w-sm"
          disabled={locked}
        />
      </div>

      <div className={cx("grid gap-4 xl:grid-cols-[280px,1fr]", locked && "opacity-60")}>
          <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <div className="space-y-1">
              {folders.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { setFolder(item.key); if (item.key !== "properties") setSelectedPropertyId(null); }}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                    folder === item.key ? "bg-white text-slate-950 shadow-sm" : "text-slate-700 hover:bg-white/70"
                  )}
                >
                  <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", folder === item.key ? "bg-[#eef2ff] text-[#4f46e5]" : "bg-white text-slate-500")}>
                    <FolderIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className="block truncate text-xs text-slate-500">{item.hint}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{item.count}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0">
          {docsLoading ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Chargement des documents…</div>
          ) : filteredVaultDocuments.length ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{folders.find((item) => item.key === folder)?.label || "Fichiers"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{filteredVaultDocuments.length} fichier{filteredVaultDocuments.length > 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-xs text-slate-500">Les documents signés restent conservés pour la traçabilité.</p>
                </div>
                {folder === "properties" && propertiesInVault.length > 1 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedPropertyId(null)}
                      className={cx(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                        !selectedPropertyId
                          ? "border-[#635bff]/30 bg-[#635bff]/10 text-[#635bff]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      Tous
                    </button>
                    {propertiesInVault.map((p) => {
                      const label = p.label || p.address || p.city || "Logement";
                      const isActive = selectedPropertyId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPropertyId(isActive ? null : p.id)}
                          className={cx(
                            "max-w-[160px] truncate rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                            isActive
                              ? "border-[#635bff]/30 bg-[#635bff]/10 text-[#635bff]"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {filteredVaultDocuments.map((doc) => (
                  <div key={doc.id} className="grid gap-2 px-3 py-2.5 transition hover:bg-slate-50 lg:grid-cols-[minmax(0,1.6fr),minmax(0,0.95fr),0.38fr,0.42fr] lg:items-center">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", kindTone(doc.kind))}>
                        <DocumentTextIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{doc.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-slate-500">{fileExtension(doc.kind)}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-xs text-slate-500">{statusLabel(doc.status)}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-xs text-slate-500">{doc.sizeBytes ? formatBytes(doc.sizeBytes) : "taille inconnue"}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-xs text-slate-500">{doc.source}</span>
                        </div>
                      </div>
                    </div>
                    <p className="min-w-0 text-sm text-slate-600 lg:truncate">{doc.context}</p>
                    <p className="text-xs text-slate-500">{formatDate(doc.date)}</p>
                    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                      {doc.open ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const win = window.open("about:blank", "_blank");
                            if (win) win.document.write("<p style=\"font-family:system-ui,sans-serif;padding:24px\">Chargement...</p>");
                            try {
                              await doc.open?.(win);
                            } catch (error: any) {
                              win?.close();
                              setOk(null);
                              setDocsError(error?.message || "Impossible d’ouvrir le document.");
                            }
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-950 px-2.5 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <EyeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          Voir
                        </button>
                      ) : (
                        <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-500">Dans {doc.source}</span>
                      )}
                      {doc.download ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await doc.download?.();
                            } catch (error: any) {
                              setOk(null);
                              setDocsError(error?.message || "Impossible de télécharger le document.");
                            }
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          PDF
                        </button>
                      ) : null}
                      {doc.deletable ? (
                        <button
                          type="button"
                          disabled={deletingDocId === doc.id}
                          onClick={() => setConfirmDeleteDoc(doc)}
                          className={cx(
                            "inline-flex h-8 items-center gap-1.5 rounded-full border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50",
                            deletingDocId === doc.id && "opacity-60"
                          )}
                        >
                          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          Supprimer
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-semibold text-slate-950">Aucun document retrouvé pour le moment.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Les baux générés, états des lieux finalisés, DPE, quittances PDF et pièces attachées apparaîtront ici au fur et à mesure.
              </p>
            </div>
          )}
          </section>
      </div>

      {confirmDeleteDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <p className="text-sm font-semibold text-slate-950">Supprimer ce document ?</p>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              « {confirmDeleteDoc.title} » sera définitivement supprimé. Cette action est irréversible.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDoc(null)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deletingDocId === confirmDeleteDoc.id}
                onClick={() => deleteDocument(confirmDeleteDoc)}
                className={cx(
                  "rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500",
                  deletingDocId === confirmDeleteDoc.id && "opacity-60"
                )}
              >
                {deletingDocId === confirmDeleteDoc.id ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      </>}
    </div>
  );
}
