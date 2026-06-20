// =========================
// ./components/landlord/sections/SectionEtatDesLieux.tsx
// VERSION : Wizard + scroll-jump fix + sortie=copy entrée (rooms+items via DB) + upload PDF signé (archivage)
// =========================
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PhotoIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle, WorkflowIntro } from "../UiBits";
import type { Lease, Property, Tenant } from "../../../lib/landlord/types";
import { isSelectableLeaseLike } from "../../../lib/landlord/archiveFilters";
import RepairsGuideCard from "../RepairsGuideCard";

/* ======================================================
   TYPES
====================================================== */

type InventoryReport = {
  id: string;
  user_id: string;
  lease_id: string | null;
  report_type: "entry" | "exit";
  status: "draft" | "ready" | "signed" | "archived";
  attachment_status?: "attached" | "standalone";
  property_id?: string | null;
  tenant_id?: string | null;
  property_label?: string | null;
  property_address_line1?: string | null;
  property_address_line2?: string | null;
  property_postal_code?: string | null;
  property_city?: string | null;
  occupant_label?: string | null;
  occupant_email?: string | null;
  occupant_phone?: string | null;
  performed_at: string | null;
  performed_place: string | null;
  counters_json: any | null;
  general_notes: string | null;
  pdf_url: string | null;
  document_source?: "generated" | "external" | null;
  original_file_name?: string | null;
  created_at: string;
  updated_at: string;
};

type InventoryRoom = {
  id: string;
  report_id: string;
  name: string;
  floor_level: string | null;
  notes: string | null;
  sort_order: number;
};

type InventoryItem = {
  id: string;
  report_id: string;
  room_id: string | null;
  category: string;
  label: string;
  condition: "neuf" | "tres_bon" | "bon" | "moyen" | "mauvais";
  wear_level: number | null;
  description: string | null;
  defect_tags: string[] | null;
  is_clean: boolean | null;
  is_functional: boolean | null;
  recommended_action: string | null;
  estimated_cost: number | null;
  severity: number | null;
};

type InventoryPhoto = {
  id: string;
  user_id: string;
  report_id: string;
  item_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  preview_url?: string | null;
};

type Props = {
  userId: string;
  leases?: Lease[];
  properties?: Property[];
  tenants?: Tenant[];
  onRefresh?: () => Promise<void>;
};

async function authJsonHeaders() {
  if (!supabase) throw new Error("Supabase n’est pas configuré.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function safeJson(resp: Response) {
  const raw = await resp.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {}
  return { raw, json };
}

/* ======================================================
   HELPERS UI / LIBELLÉS UTILISATEUR
====================================================== */

const conditionOptions: Array<{ v: InventoryItem["condition"]; label: string }> = [
  { v: "neuf", label: "Neuf" },
  { v: "tres_bon", label: "Très bon" },
  { v: "bon", label: "Bon" },
  { v: "moyen", label: "Moyen" },
  { v: "mauvais", label: "Mauvais" },
];

const FIELD_STRUCTURE_PRESETS = [
  { kind: "mur" as const, category: "Mur", label: "État général" },
  { kind: "sol" as const, category: "Sol", label: "Revêtement" },
  { kind: "plafond" as const, category: "Plafond", label: "État général" },
  { kind: "porte" as const, category: "Porte", label: "Ouverture / serrure" },
  { kind: "fenetre" as const, category: "Fenêtre", label: "Ouverture / vitrage" },
];

const statusUi = (s?: InventoryReport["status"] | null) => {
  const v = (s || "draft").toLowerCase() as InventoryReport["status"];
  const label =
    v === "draft"
      ? "Brouillon"
      : v === "ready"
      ? "Prêt à imprimer / partager"
      : v === "signed"
      ? "Signé (verrouillé)"
      : v === "archived"
      ? "Archivé (verrouillé)"
      : "Brouillon";

  const tone =
    v === "signed"
      ? ("emerald" as const)
      : v === "ready"
      ? ("amber" as const)
      : v === "archived"
      ? ("red" as const)
      : ("slate" as const);

  return { v, label, tone };
};

const reportTypeLabel = (t?: InventoryReport["report_type"] | null) => {
  if (t === "entry") return "État des lieux d’entrée";
  if (t === "exit") return "État des lieux de sortie";
  return "État des lieux";
};

const workflowUi = (report?: InventoryReport | null) => {
  if (!report) {
    return {
      label: "À créer",
      desc: "Choisis un parcours : saisie dans lokt.fr ou import d’un PDF externe.",
      tone: "slate" as const,
    };
  }
  if (report.status === "signed" || report.status === "archived") {
    return {
      label: "Terminé",
      desc:
        report.document_source === "external"
          ? "PDF externe archivé. Aucune autre action n’est attendue."
          : "PDF signé archivé. Aucune autre action n’est attendue.",
      tone: "emerald" as const,
    };
  }
  if (report.status === "ready" || report.pdf_url) {
    return {
      label: "À signer",
      desc: "Le PDF est prêt. Importe la version signée pour terminer.",
      tone: "amber" as const,
    };
  }
  return {
    label: "En cours",
    desc: "Reprends la saisie pour compléter puis générer le PDF.",
    tone: "slate" as const,
  };
};

const sortReportsEntryFirst = (list: InventoryReport[]) => {
  const prio = (t: InventoryReport["report_type"]) => (t === "entry" ? 0 : 1);
  return [...list].sort((a, b) => {
    const pa = prio(a.report_type);
    const pb = prio(b.report_type);
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function Badge({
  tone,
  children,
}: {
  tone: "slate" | "emerald" | "amber" | "red";
  children: React.ReactNode;
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold " + cls}>
      {children}
    </span>
  );
}

/* ======================================================
   ✅ MODAL
====================================================== */

function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220]" style={{ overflowAnchor: "none" }}>
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label="Fermer" />

      <div className="absolute inset-0 p-3 sm:p-6 overflow-y-auto" style={{ overflowAnchor: "none" }}>
        <div className="mx-auto w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col">
          <div className="shrink-0 px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">État des lieux</p>
              <p className="text-base font-semibold text-slate-900 truncate">{title}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Fermer
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5" style={{ overflowAnchor: "none" }}>
            {children}
          </div>

          {footer ? <div className="shrink-0 px-5 py-4 border-t border-slate-200 bg-white">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   Room illustration (emoji)
====================================================== */

function RoomIllustration({
  type,
}: {
  type:
    | "entree"
    | "sejour"
    | "cuisine"
    | "chambre"
    | "sdb"
    | "wc"
    | "couloir"
    | "bureau"
    | "buanderie"
    | "dressing"
    | "balcon"
    | "garage"
    | "cave";
}) {
  const emojiMap: Record<string, string> = {
    entree: "🚪",
    sejour: "🛋️",
    cuisine: "🍽️",
    chambre: "🛏️",
    sdb: "🛁",
    wc: "🚽",
    couloir: "➡️",
    bureau: "💻",
    buanderie: "🧺",
    dressing: "👕",
    balcon: "🌿",
    garage: "🚗",
    cave: "📦",
  };
  const emoji = emojiMap[type] || "🏠";
  return (
    <div className="w-full aspect-square rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
      <span className="text-5xl">{emoji}</span>
    </div>
  );
}

/* ======================================================
   WIZARD HELPERS
====================================================== */

type WizardStep = "plan" | "rooms" | "finalize";

type RoomPresetKey =
  | "entree"
  | "sejour"
  | "cuisine"
  | "chambre"
  | "sdb"
  | "wc"
  | "couloir"
  | "bureau"
  | "buanderie"
  | "dressing"
  | "balcon"
  | "garage"
  | "cave";

function guessPresetKeyFromRoomName(name: string): RoomPresetKey {
  const n = (name || "").toLowerCase();
  if (n.includes("entrée") || n.includes("entree")) return "entree";
  if (n.includes("sejour") || n.includes("séjour") || n.includes("salon") || n.includes("living")) return "sejour";
  if (n.includes("cuisine")) return "cuisine";
  if (n.includes("chambre")) return "chambre";
  if (n.includes("salle de bain") || n.includes("sdb") || n.includes("salle d'eau") || n.includes("salle d’eau")) return "sdb";
  if (n.includes("wc") || n.includes("toilet")) return "wc";
  if (n.includes("couloir") || n.includes("palier")) return "couloir";
  if (n.includes("bureau")) return "bureau";
  if (n.includes("buanderie")) return "buanderie";
  if (n.includes("dressing")) return "dressing";
  if (n.includes("balcon") || n.includes("terrasse")) return "balcon";
  if (n.includes("garage")) return "garage";
  if (n.includes("cave")) return "cave";
  return "sejour";
}

const SUGGESTED_PRESETS: Array<{ name: string; key: RoomPresetKey }> = [
  { name: "Entrée", key: "entree" },
  { name: "Séjour", key: "sejour" },
  { name: "Cuisine", key: "cuisine" },
  { name: "Chambre", key: "chambre" },
  { name: "Chambre 2", key: "chambre" },
  { name: "Chambre 3", key: "chambre" },
  { name: "Salle de bain", key: "sdb" },
  { name: "Salle d’eau", key: "sdb" },
  { name: "WC", key: "wc" },
  { name: "WC 2", key: "wc" },
  { name: "Couloir", key: "couloir" },
  { name: "Bureau", key: "bureau" },
  { name: "Buanderie", key: "buanderie" },
  { name: "Dressing", key: "dressing" },
  { name: "Balcon / Terrasse", key: "balcon" },
  { name: "Garage", key: "garage" },
  { name: "Cave", key: "cave" },
];

const INVENTORY_BUCKET = "inventory-pdfs";
const INVENTORY_PHOTOS_BUCKET = "inventory-photos";
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_RAW_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_STORED_PHOTO_BYTES = 900 * 1024;
const MAX_PHOTOS_PER_ITEM = 3;

async function compressObservationPhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Format refusé : utilise une image JPEG, PNG ou WebP.");
  }
  if (file.size > MAX_RAW_PHOTO_BYTES) {
    throw new Error("Photo trop volumineuse : 8 Mo maximum avant compression.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Cette image ne peut pas être lue."));
      img.src = objectUrl;
    });

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Compression de l’image impossible.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    for (const quality of [0.76, 0.68, 0.58, 0.48]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_STORED_PHOTO_BYTES) return blob;
    }
    throw new Error("La photo reste trop volumineuse après compression. Choisis une image plus légère.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function parseInventoryPdfUrl(pdfUrl?: string | null) {
  const raw = String(pdfUrl || "").trim();
  if (!raw) return null;
  const sepIndex = raw.indexOf(":");
  const bucket = sepIndex >= 0 ? raw.slice(0, sepIndex) : INVENTORY_BUCKET;
  const path = sepIndex >= 0 ? raw.slice(sepIndex + 1) : raw;
  if (!bucket || !path) return null;
  return { bucket, path };
}

function openPdfUrl(url: string, opened?: Window | null) {
  if (opened) {
    opened.location.href = url;
    return;
  }

  const next = window.open(url, "_blank", "noopener,noreferrer");
  if (!next) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

function openBlankPdfWindow() {
  const opened = window.open("about:blank", "_blank");
  if (!opened) {
    return null;
  }
  opened.document.write("<p style=\"font-family:system-ui,sans-serif;padding:24px\">Ouverture du PDF...</p>");
  return opened;
}
// =========================
// BLOCK 2/4
// =========================
export function SectionEtatDesLieux({ userId, leases, properties, tenants, onRefresh }: Props) {
  const safeLeases = useMemo(() => (Array.isArray(leases) ? leases : []), [leases]);
  const safeProps = useMemo(() => (Array.isArray(properties) ? properties : []), [properties]);
  const safeTenants = useMemo(() => (Array.isArray(tenants) ? tenants : []), [tenants]);

  const propertyById = useMemo(() => {
    const m = new Map<string, Property>();
    for (const p of safeProps) m.set((p as any).id, p);
    return m;
  }, [safeProps]);

  const tenantById = useMemo(() => {
    const m = new Map<string, Tenant>();
    for (const t of safeTenants) m.set((t as any).id, t);
    return m;
  }, [safeTenants]);

  const activeLeases = useMemo(() => safeLeases.filter(isSelectableLeaseLike), [safeLeases]);

  const leaseLabel = (l: Lease) => {
    const p = propertyById.get((l as any).property_id);
    const t = tenantById.get((l as any).tenant_id);
    return `${(p as any)?.label || "Logement"} — ${(t as any)?.full_name || "Locataire"}`;
  };

  const propertyPlaceLabel = (p?: Property | null) =>
    [p?.address_line1, p?.address_line2, [p?.postal_code, p?.city].filter(Boolean).join(" ")]
      .filter((part) => String(part || "").trim())
      .join(", ");

  const safeRefresh = async () => {
    try {
      await onRefresh?.();
    } catch {
      // no-op
    }
  };

  const [selectedLeaseId, setSelectedLeaseId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const xhrUploadPdf = (signedUrl: string, file: File): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedUrl);
      xhr.setRequestHeader("Content-Type", "application/pdf");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload échoué (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Erreur réseau lors de l'upload."));
      xhr.send(file);
    });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [reports, setReports] = useState<InventoryReport[]>([]);
  const [standaloneReports, setStandaloneReports] = useState<InventoryReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const [rooms, setRooms] = useState<InventoryRoom[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [photos, setPhotos] = useState<InventoryPhoto[]>([]);
  const [photoBusyItemId, setPhotoBusyItemId] = useState<string | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<Record<string, { tone: "error" | "success"; message: string }>>({});

  const [search, setSearch] = useState("");
  const [creationMode, setCreationMode] = useState<"lease" | "standalone">("lease");
  const [attachLeaseId, setAttachLeaseId] = useState("");
  const [standaloneForm, setStandaloneForm] = useState({
    reportType: "entry" as "entry" | "exit",
    propertyLabel: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    city: "",
    occupantLabel: "",
    occupantEmail: "",
    occupantPhone: "",
  });

  const selectedReport = useMemo(() => reports.find((r) => r.id === selectedReportId) || null, [reports, selectedReportId]);
  const selectedLease = useMemo(() => activeLeases.find((l: any) => l.id === selectedLeaseId) || null, [activeLeases, selectedLeaseId]);
  const selectedProperty = selectedLease ? propertyById.get((selectedLease as any).property_id) || null : null;
  const standalonePlaceLabel = selectedReport
    ? [
        selectedReport.property_address_line1,
        selectedReport.property_address_line2,
        [selectedReport.property_postal_code, selectedReport.property_city].filter(Boolean).join(" "),
      ]
        .filter((part) => String(part || "").trim())
        .join(", ")
    : "";
  const defaultReportPlace = propertyPlaceLabel(selectedProperty) || standalonePlaceLabel;

  const selectedLeaseNiceLabel = selectedLease ? leaseLabel(selectedLease as any) : "—";
  const selectedStandaloneLabel = selectedReport
    ? `${selectedReport.property_label || selectedReport.property_address_line1 || "État des lieux libre"}${
        selectedReport.occupant_label ? ` — ${selectedReport.occupant_label}` : ""
      }`
    : "—";
  const selectedContextLabel = selectedLease ? selectedLeaseNiceLabel : selectedStandaloneLabel;
  const reportLabel = selectedReport ? reportTypeLabel(selectedReport.report_type) : "—";
  const reportTypeTone =
    selectedReport?.report_type === "exit"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : selectedReport?.report_type === "entry"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : "border-slate-200 bg-slate-50 text-slate-800";

  const isLocked = selectedReport?.status === "signed" || selectedReport?.status === "archived";
  const hasPdf = !!selectedReport?.pdf_url;
  const isExternalReport = selectedReport?.document_source === "external";
  const selectedWorkflow = workflowUi(selectedReport);
  const entryReport = useMemo(() => reports.find((r) => r.report_type === "entry") || null, [reports]);
  const exitReport = useMemo(() => reports.find((r) => r.report_type === "exit") || null, [reports]);
  const primaryReportActionLabel = selectedReport
    ? selectedReport.status === "ready" || hasPdf
      ? "Finaliser l’EDL"
      : "Reprendre la saisie"
    : "Créer l’état des lieux";
  const counters = (selectedReport?.counters_json && typeof selectedReport.counters_json === "object" ? selectedReport.counters_json : {}) as Record<string, any>;

  // ✅ Scroll preserve (wizard) + anti “retour en haut”
  const wizardScrollRef = useRef<HTMLDivElement | null>(null);
  const preserveWizardScroll = (fn: () => void) => {
    const el = wizardScrollRef.current;
    const top = el?.scrollTop ?? 0;
    fn();
    requestAnimationFrame(() => {
      if (el) el.scrollTop = top;
    });
  };

  // input file upload PDF signé
  const signedFileInputRef = useRef<HTMLInputElement | null>(null);
  const externalEntryFileInputRef = useRef<HTMLInputElement | null>(null);
  const externalExitFileInputRef = useRef<HTMLInputElement | null>(null);

  const makeTempId = () => `tmp_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  /* ======================================================
     LOADERS
  ====================================================== */

  const loadReportsForLease = async (leaseId: string) => {
    if (!supabase || !userId || !leaseId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { data, error } = await supabase.from("inventory_reports").select("*").eq("user_id", userId).eq("lease_id", leaseId);
      if (error) throw error;

      const sorted = sortReportsEntryFirst(((data || []) as any) || []);
      setReports(sorted);

      const entry = sorted.find((r) => r.report_type === "entry") || null;
      setSelectedReportId(entry?.id ?? sorted[0]?.id ?? null);

      if (!sorted.length) {
        setRooms([]);
        setItems([]);
        setPhotos([]);
      }
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger les états des lieux.");
    } finally {
      setLoading(false);
    }
  };

  const loadStandaloneReports = async () => {
    if (!supabase || !userId) return;

    try {
      const { data, error } = await supabase
        .from("inventory_reports")
        .select("*")
        .eq("user_id", userId)
        .is("lease_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setStandaloneReports(((data || []) as InventoryReport[]) || []);
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger les états des lieux libres.");
    }
  };

  const loadReportDetails = async (reportId: string) => {
    if (!supabase || !reportId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const [{ data: rRooms, error: eRooms }, { data: rItems, error: eItems }, { data: rPhotos, error: ePhotos }] = await Promise.all([
        supabase.from("inventory_rooms").select("*").eq("report_id", reportId).order("sort_order", { ascending: true }),
        supabase.from("inventory_items").select("*").eq("report_id", reportId).order("created_at", { ascending: true }),
        supabase.from("inventory_photos").select("*").eq("report_id", reportId).order("created_at", { ascending: true }),
      ]);

      if (eRooms) throw eRooms;
      if (eItems) throw eItems;
      if (ePhotos) throw ePhotos;

      setRooms((rRooms || []) as any);
      setItems((rItems || []) as any);
      const nextPhotos = ((rPhotos || []) as InventoryPhoto[]) || [];
      const withPreview = await Promise.all(
        nextPhotos.map(async (photo) => {
          const { data } = await supabase.storage.from(photo.storage_bucket || INVENTORY_PHOTOS_BUCKET).createSignedUrl(photo.storage_path, 60 * 60);
          return { ...photo, preview_url: data?.signedUrl || null };
        })
      );
      setPhotos(withPreview);
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger le détail de l’état des lieux.");
    } finally {
      setLoading(false);
    }
  };

  // Réagit uniquement au changement de bail sélectionné ou d'userId.
  // activeLeases et selectedReportId sont intentionnellement exclus des deps :
  // les inclure provoquait un clignotement à chaque re-render parent (nouveau
  // tableau activeLeases) et une boucle clear→load→setSelectedReportId→clear.
  useEffect(() => {
    if (!selectedLeaseId || !userId) {
      setReports([]);
      setSelectedReportId(null);
      setRooms([]);
      setItems([]);
      setPhotos([]);
      return;
    }
    setReports([]);
    setSelectedReportId(null);
    setRooms([]);
    setItems([]);
    setPhotos([]);
    loadReportsForLease(selectedLeaseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaseId, userId]);

  // Effet séparé : si le bail sélectionné disparaît (suppression, archivage),
  // on le désélectionne proprement sans toucher aux données déjà chargées.
  useEffect(() => {
    if (selectedLeaseId && !activeLeases.some((lease: any) => lease.id === selectedLeaseId)) {
      setSelectedLeaseId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeases]);

  useEffect(() => {
    if (selectedReportId) loadReportDetails(selectedReportId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReportId]);

  useEffect(() => {
    void loadStandaloneReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ======================================================
     HELPERS DB : trouver l’EDL d’entrée (fiable, pas via state)
  ====================================================== */

  const findEntryReportIdForLease = async (leaseId: string): Promise<string | null> => {
    if (!supabase || !userId || !leaseId) return null;
    const { data, error } = await supabase
      .from("inventory_reports")
      .select("id")
      .eq("user_id", userId)
      .eq("lease_id", leaseId)
      .eq("report_type", "entry")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data as any)?.id ?? null;
  };

  /* ======================================================
     MUTATIONS : copie entrée -> sortie (rooms + items)
====================================================== */

  const copyEntryToExit = async (entryReportId: string, exitReportId: string) => {
    if (!supabase) throw new Error("Supabase indisponible.");

    const [{ data: entryRooms, error: eRooms }, { data: entryItems, error: eItems }] = await Promise.all([
      supabase.from("inventory_rooms").select("*").eq("report_id", entryReportId).order("sort_order", { ascending: true }),
      supabase.from("inventory_items").select("*").eq("report_id", entryReportId).order("created_at", { ascending: true }),
    ]);
    if (eRooms) throw eRooms;
    if (eItems) throw eItems;

    const rRooms = ((entryRooms || []) as InventoryRoom[]) || [];
    const rItems = ((entryItems || []) as InventoryItem[]) || [];

    if (!rRooms.length) return { roomsCopied: 0, itemsCopied: 0 };

    // 1) créer les rooms dans la sortie, en séquentiel pour mapper proprement
    const roomIdMap = new Map<string, string>(); // entryRoomId -> exitRoomId
    for (const r of rRooms) {
      const { data: newRoom, error: eIns } = await supabase
        .from("inventory_rooms")
        .insert({
          report_id: exitReportId,
          name: r.name,
          floor_level: r.floor_level,
          notes: r.notes,
          sort_order: r.sort_order,
        })
        .select("id")
        .single();
      if (eIns) throw eIns;
      roomIdMap.set(r.id, (newRoom as any).id);
    }

    // 2) copier items
    const payloadItems = rItems.map((it) => ({
      report_id: exitReportId,
      room_id: it.room_id ? roomIdMap.get(it.room_id) ?? null : null,
      category: (it.category || "").trim(),
      label: (it.label || "").trim(),
      condition: it.condition,
      wear_level: it.wear_level,
      description: it.description,
      defect_tags: it.defect_tags || [],
      is_clean: it.is_clean,
      is_functional: it.is_functional,
      recommended_action: it.recommended_action,
      estimated_cost: it.estimated_cost,
      severity: it.severity ?? 0,
    }));

    if (payloadItems.length) {
      const { error: eInsItems } = await supabase.from("inventory_items").insert(payloadItems);
      if (eInsItems) throw eInsItems;
    }

    return { roomsCopied: rRooms.length, itemsCopied: payloadItems.length };
  };

  const createReport = async (type: "entry" | "exit") => {
    if (!supabase || !userId || !selectedLeaseId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      // déjà existant ?
      const exists = reports.find((r) => r.report_type === type);
      if (exists) {
        setSelectedReportId(exists.id);
        await loadReportDetails(exists.id);
        if (exists.status === "signed" || exists.status === "archived") {
          setOk(`${reportTypeLabel(type)} déjà signé : sélectionné en lecture.`);
        } else {
          setOk(`${reportTypeLabel(type)} déjà existant — reprise de la saisie ✅`);
          openWizard(exists.id, exists.status === "ready" || exists.pdf_url ? "finalize" : undefined);
        }
        return;
      }

      // ✅ si sortie : chercher l’entrée en DB (fiable)
      let entryReportId: string | null = null;
      if (type === "exit") {
        entryReportId = await findEntryReportIdForLease(selectedLeaseId);
      }

      // créer report
      const { data, error } = await supabase
        .from("inventory_reports")
        .insert({
          user_id: userId,
          lease_id: selectedLeaseId,
          report_type: type,
          status: "draft",
          performed_at: new Date().toISOString(),
          performed_place: defaultReportPlace,
          counters_json: null,
          general_notes: "",
          pdf_url: null,
        })
        .select("*")
        .single();

      if (error) throw error;

      const reportId = (data as any).id as string;

      // ✅ copie entrée -> sortie
      if (type === "exit" && entryReportId) {
        try {
          const { roomsCopied, itemsCopied } = await copyEntryToExit(entryReportId, reportId);
          setOk(`EDL de sortie créé ✅ (copie entrée : ${roomsCopied} pièce(s), ${itemsCopied} élément(s))`);
        } catch (copyErr: any) {
          console.error(copyErr);
          setOk("EDL de sortie créé ✅ (copie entrée impossible — tu peux compléter manuellement)");
        }
      } else {
        setOk("État des lieux créé ✅");
      }

      setSelectedReportId(reportId);

      await loadReportsForLease(selectedLeaseId);
      await safeRefresh();
      await loadReportDetails(reportId);

      openWizard(reportId);
    } catch (e: any) {
      setErr(e?.message || "Impossible de créer l’état des lieux.");
    } finally {
      setLoading(false);
    }
  };

  const createStandaloneReport = async () => {
    if (!supabase || !userId) return;

    const propertyLabel = standaloneForm.propertyLabel.trim();
    const addressLine1 = standaloneForm.addressLine1.trim();
    const occupantLabel = standaloneForm.occupantLabel.trim();

    if (!propertyLabel && !addressLine1) {
      setErr("Renseigne au moins le nom du logement ou son adresse pour créer un état des lieux libre.");
      return;
    }
    if (!occupantLabel) {
      setErr("Renseigne le nom de l’occupant. Tu pourras le modifier ou rattacher le document à un bail ensuite.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const payload: Partial<InventoryReport> = {
        user_id: userId,
        lease_id: null,
        attachment_status: "standalone",
        report_type: standaloneForm.reportType,
        status: "draft",
        performed_at: new Date().toISOString(),
        performed_place: [addressLine1, standaloneForm.addressLine2.trim(), [standaloneForm.postalCode.trim(), standaloneForm.city.trim()].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(", "),
        property_label: propertyLabel || addressLine1,
        property_address_line1: addressLine1,
        property_address_line2: standaloneForm.addressLine2.trim(),
        property_postal_code: standaloneForm.postalCode.trim(),
        property_city: standaloneForm.city.trim(),
        occupant_label: occupantLabel,
        occupant_email: standaloneForm.occupantEmail.trim(),
        occupant_phone: standaloneForm.occupantPhone.trim(),
        counters_json: null,
        general_notes: "",
        pdf_url: null,
      };

      const { data, error } = await supabase.from("inventory_reports").insert(payload).select("*").single();
      if (error || !data?.id) throw error || new Error("Création impossible.");

      const report = data as InventoryReport;
      setSelectedLeaseId("");
      setReports([report]);
      setSelectedReportId(report.id);
      setStandaloneForm({
        reportType: "entry",
        propertyLabel: "",
        addressLine1: "",
        addressLine2: "",
        postalCode: "",
        city: "",
        occupantLabel: "",
        occupantEmail: "",
        occupantPhone: "",
      });
      await loadStandaloneReports();
      await loadReportDetails(report.id);
      openWizard(report.id);
      setOk("État des lieux libre créé ✅ Tu pourras le rattacher à un bail plus tard.");
    } catch (e: any) {
      setErr(e?.message || "Impossible de créer l’état des lieux libre.");
    } finally {
      setLoading(false);
    }
  };

  const openStandaloneReport = async (report: InventoryReport) => {
    setSelectedLeaseId("");
    setReports([report]);
    setSelectedReportId(report.id);
    await loadReportDetails(report.id);
  };

  const attachStandaloneReportToLease = async (reportId: string, leaseId: string) => {
    if (!supabase || !userId || !reportId || !leaseId) return;
    const lease = activeLeases.find((item: any) => item.id === leaseId);
    if (!lease) {
      setErr("Choisis un bail actif pour rattacher ce document.");
      return;
    }
    const property = propertyById.get((lease as any).property_id) || null;
    const tenant = tenantById.get((lease as any).tenant_id) || null;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase
        .from("inventory_reports")
        .update({
          lease_id: leaseId,
          attachment_status: "attached",
          property_id: (lease as any).property_id || null,
          tenant_id: (lease as any).tenant_id || null,
          property_label: (property as any)?.label || null,
          property_address_line1: (property as any)?.address_line1 || null,
          property_address_line2: (property as any)?.address_line2 || null,
          property_postal_code: (property as any)?.postal_code || null,
          property_city: (property as any)?.city || null,
          occupant_label: (tenant as any)?.full_name || null,
          occupant_email: (tenant as any)?.email || null,
          occupant_phone: (tenant as any)?.phone || null,
        })
        .eq("id", reportId)
        .eq("user_id", userId);
      if (error) throw error;

      setSelectedLeaseId(leaseId);
      setAttachLeaseId("");
      await loadStandaloneReports();
      await loadReportsForLease(leaseId);
      await loadReportDetails(reportId);
      setSelectedReportId(reportId);
      setOk("État des lieux rattaché au bail ✅");
    } catch (e: any) {
      setErr(e?.message || "Impossible de rattacher l’état des lieux.");
    } finally {
      setLoading(false);
    }
  };

  const updateReport = async (patch: Partial<InventoryReport>) => {
    if (!supabase || !selectedReportId) return;

    if (isLocked) {
      setErr("Ce document est verrouillé (signé ou archivé).");
      return;
    }

    const reportId = selectedReportId;
    const previousReport = selectedReport;

    setErr(null);
    setOk(null);
    setReports((prev) => prev.map((r) => (r.id === reportId ? ({ ...r, ...patch } as any) : r)));

    try {
      const { error } = await supabase.from("inventory_reports").update(patch).eq("id", reportId).eq("user_id", userId);
      if (error) throw error;
    } catch (e: any) {
      if (previousReport) setReports((prev) => prev.map((r) => (r.id === reportId ? previousReport : r)));
      setErr(e?.message || "Impossible d’enregistrer.");
    }
  };

  const updateCounterField = async (key: string, value: string) => {
    const next = { ...counters, [key]: value };
    await updateReport({ counters_json: next as any });
  };

  const addItem = async (payload: {
    room_id: string;
    category: string;
    label: string;
    condition: InventoryItem["condition"];
    wear_level: number | null;
    is_clean: boolean;
    is_functional: boolean;
    description?: string;
    defect_tags?: string[];
    severity?: number | null;
  }) => {
    if (!supabase || !selectedReportId) return;

    if (isLocked) {
      setErr("Ce document est verrouillé (signé ou archivé).");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase.from("inventory_items").insert({
        report_id: selectedReportId,
        room_id: payload.room_id,
        category: (payload.category || "").trim(),
        label: (payload.label || "").trim(),
        condition: payload.condition,
        wear_level: payload.wear_level,
        description: (payload.description || "").trim(),
        defect_tags: payload.defect_tags || [],
        is_clean: payload.is_clean,
        is_functional: payload.is_functional,
        recommended_action: null,
        estimated_cost: null,
        severity: payload.severity ?? 0,
      });

      if (error) throw error;

      setOk("Élément ajouté ✅");
      await loadReportDetails(selectedReportId);
    } catch (e: any) {
      setErr(e?.message || "Impossible d’ajouter l’élément.");
    } finally {
      setLoading(false);
    }
  };

  const addItemsBatch = async (
    payloads: Array<{
      room_id: string;
      category: string;
      label: string;
      condition: InventoryItem["condition"];
      wear_level: number | null;
      is_clean: boolean;
      is_functional: boolean;
      description?: string;
      defect_tags?: string[];
      severity?: number | null;
    }>
  ) => {
    if (!supabase || !selectedReportId || !payloads.length) return;

    if (isLocked) {
      setErr("Ce document est verrouillé (signé ou archivé).");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase.from("inventory_items").insert(
        payloads.map((payload) => ({
          report_id: selectedReportId,
          room_id: payload.room_id,
          category: (payload.category || "").trim(),
          label: (payload.label || "").trim(),
          condition: payload.condition,
          wear_level: payload.wear_level,
          description: (payload.description || "").trim(),
          defect_tags: payload.defect_tags || [],
          is_clean: payload.is_clean,
          is_functional: payload.is_functional,
          recommended_action: null,
          estimated_cost: null,
          severity: payload.severity ?? 0,
        }))
      );

      if (error) throw error;

      setOk(`${payloads.length} élément(s) ajouté(s) ✅`);
      await loadReportDetails(selectedReportId);
    } catch (e: any) {
      setErr(e?.message || "Impossible d’ajouter les éléments.");
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (itemId: string, patch: Partial<InventoryItem>) => {
    if (!supabase || !selectedReportId) return;
    if (isLocked) return;

    const reportId = selectedReportId;
    const previousItem = items.find((it) => it.id === itemId) || null;
    setItems((prev) => prev.map((it) => (it.id === itemId ? ({ ...it, ...patch } as any) : it)));

    try {
      const { error } = await supabase.from("inventory_items").update(patch).eq("id", itemId).eq("report_id", reportId);
      if (error) throw error;
    } catch {
      if (previousItem) setItems((prev) => prev.map((it) => (it.id === itemId ? previousItem : it)));
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!supabase || !selectedReportId) return;

    if (isLocked) {
      setErr("Ce document est verrouillé (signé ou archivé).");
      return;
    }

    if (!confirm("Supprimer cet élément ?")) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const itemPhotos = photos.filter((photo) => photo.item_id === itemId);
      if (itemPhotos.length) {
        const { error: deletePhotosError } = await supabase.storage
          .from(INVENTORY_PHOTOS_BUCKET)
          .remove(itemPhotos.map((photo) => photo.storage_path));
        if (deletePhotosError) throw deletePhotosError;
      }
      const { error } = await supabase.from("inventory_items").delete().eq("id", itemId).eq("report_id", selectedReportId);
      if (error) throw error;

      setOk("Élément supprimé 🗑️");
      await loadReportDetails(selectedReportId);
    } catch (e: any) {
      setErr(e?.message || "Impossible de supprimer cet élément.");
    } finally {
      setLoading(false);
    }
  };

  const uploadItemPhoto = async (itemId: string, file: File) => {
    if (!supabase || !userId || !selectedReportId) return;
    if (isLocked) {
      setPhotoFeedback((prev) => ({ ...prev, [itemId]: { tone: "error", message: "Ce document est verrouillé : les photos ne peuvent plus être modifiées." } }));
      return;
    }

    const currentPhotos = photos.filter((photo) => photo.item_id === itemId);
    if (currentPhotos.length >= MAX_PHOTOS_PER_ITEM) {
      setPhotoFeedback((prev) => ({ ...prev, [itemId]: { tone: "error", message: `Maximum ${MAX_PHOTOS_PER_ITEM} photos par observation.` } }));
      return;
    }

    setPhotoBusyItemId(itemId);
    setPhotoFeedback((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    let storagePath: string | null = null;
    try {
      const compressed = await compressObservationPhoto(file);
      storagePath = `${userId}/${selectedReportId}/${itemId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(storagePath, compressed, {
        cacheControl: "3600",
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("inventory_photos").insert({
        user_id: userId,
        report_id: selectedReportId,
        item_id: itemId,
        storage_bucket: INVENTORY_PHOTOS_BUCKET,
        storage_path: storagePath,
        mime_type: "image/jpeg",
        size_bytes: compressed.size,
      });
      if (insertError) throw insertError;

      await loadReportDetails(selectedReportId);
      setPhotoFeedback((prev) => ({ ...prev, [itemId]: { tone: "success", message: "Photo ajoutée à l’observation." } }));
    } catch (e: any) {
      if (storagePath) await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove([storagePath]);
      setPhotoFeedback((prev) => ({ ...prev, [itemId]: { tone: "error", message: e?.message || "Impossible d’ajouter la photo." } }));
    } finally {
      setPhotoBusyItemId(null);
    }
  };

  const deleteItemPhoto = async (photo: InventoryPhoto) => {
    if (!supabase || !selectedReportId) return;
    if (isLocked) {
      setPhotoFeedback((prev) => ({
        ...prev,
        [photo.item_id]: { tone: "error", message: "Ce document est verrouillé : les photos ne peuvent plus être modifiées." },
      }));
      return;
    }
    if (!confirm("Supprimer cette photo de l’observation ?")) return;

    setPhotoBusyItemId(photo.item_id);
    setPhotoFeedback((prev) => {
      const next = { ...prev };
      delete next[photo.item_id];
      return next;
    });
    try {
      const { error: deleteFileError } = await supabase.storage.from(photo.storage_bucket || INVENTORY_PHOTOS_BUCKET).remove([photo.storage_path]);
      if (deleteFileError) throw deleteFileError;
      const { error: deleteRowError } = await supabase.from("inventory_photos").delete().eq("id", photo.id).eq("user_id", userId);
      if (deleteRowError) throw deleteRowError;
      await loadReportDetails(selectedReportId);
      setPhotoFeedback((prev) => ({ ...prev, [photo.item_id]: { tone: "success", message: "Photo supprimée." } }));
    } catch (e: any) {
      setPhotoFeedback((prev) => ({ ...prev, [photo.item_id]: { tone: "error", message: e?.message || "Impossible de supprimer la photo." } }));
    } finally {
      setPhotoBusyItemId(null);
    }
  };
  // =========================
// BLOCK 3/4
// =========================
  /* ======================================================
     PDF : ouverture + upload signé (archivage)
  ====================================================== */

  const canOpenPdf = useMemo(() => {
    const s = selectedReport?.status;
    if (!selectedReportId) return false;
    if (!hasPdf) return false;
    return s === "ready" || s === "signed" || s === "archived";
  }, [selectedReport?.status, selectedReportId, hasPdf]);

  const openPdf = async () => {
    if (!selectedReportId || !userId) return;

    if (!canOpenPdf) {
      setErr("Le PDF n’est disponible qu’une fois l’état des lieux finalisé et généré.");
      return;
    }

    const pdfWindow = openBlankPdfWindow();
    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      // 1) Essaye l’API existante (si déjà en place)
      const headers = await authJsonHeaders();
      const r = await fetch(`/api/inventory/pdf-url?reportId=${encodeURIComponent(selectedReportId)}&userId=${encodeURIComponent(userId)}`, {
        headers,
      });
      const raw = await r.text();
      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {}

      if (r.ok && json?.signedUrl) {
        openPdfUrl(json.signedUrl, pdfWindow);
        setOk("PDF ouvert ✅");
        return;
      }

      // 2) Fallback direct storage (supporte "inventory-pdfs:path" et ancien "path")
      if (!selectedReport?.pdf_url) throw new Error(json?.error || raw || "URL manquante");
      const parsed = parseInventoryPdfUrl(selectedReport.pdf_url);
      if (!parsed) throw new Error("pdf_url invalide.");
      const { data: signed, error: eSigned } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60);
      if (eSigned) throw eSigned;
      if (!signed?.signedUrl) throw new Error("Impossible de signer l’URL du PDF.");

      openPdfUrl(signed.signedUrl, pdfWindow);

      setOk("PDF ouvert ✅");
    } catch (e: any) {
      pdfWindow?.close();
      setErr(e?.message || "Impossible d’ouvrir le PDF.");
    } finally {
      setLoading(false);
    }
  };

  const buildPdfPath = (opts: { reportId: string; userId: string; leaseId: string; kind: "generated" | "signed" }) => {
    // path “stable” pour retrouver facilement
    // -> si tu veux changer plus tard, fais-le aussi côté API pdf-url
    const suffix = opts.kind === "signed" ? "signed" : "generated";
    return `inventory/${opts.userId}/${opts.leaseId}/${opts.reportId}.${suffix}.pdf`;
  };

  const uploadSignedPdf = async (file: File) => {
    if (!supabase || !userId || !selectedReportId) return;
    if (!selectedReport) return;

    if (selectedReport.status === "archived") {
      setErr("Document archivé : import impossible.");
      return;
    }

    if (file.type !== "application/pdf") {
      setErr("Fichier invalide : PDF uniquement.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setErr("PDF trop volumineux : 10 Mo maximum.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const headers = await authJsonHeaders();
      const uploadUrlResp = await fetch("/api/inventory/signed-upload-url", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, reportId: selectedReportId, kind: "signed", sizeBytes: file.size }),
      });
      const { raw, json } = await safeJson(uploadUrlResp);
      if (!uploadUrlResp.ok) throw new Error(json?.error || raw || `Erreur ${uploadUrlResp.status}`);

      const fallbackLeaseKey = selectedLeaseId || selectedReport.lease_id || "standalone";
      const path = String(json?.path || buildPdfPath({ reportId: selectedReportId, userId, leaseId: fallbackLeaseKey, kind: "signed" }));
      const signedUrl = String(json?.signedUrl || "");
      if (!signedUrl) throw new Error("URL d’upload signée indisponible.");

      setUploadProgress(0);
      await xhrUploadPdf(signedUrl, file);
      setUploadProgress(null);

      // On pointe pdf_url sur le PDF signé et on verrouille en “signed”
      const { error: eUpd } = await supabase
        .from("inventory_reports")
        .update({ pdf_url: `${INVENTORY_BUCKET}:${path}`, status: "signed", document_source: "generated", original_file_name: file.name })
        .eq("id", selectedReportId)
        .eq("user_id", userId);
      if (eUpd) throw eUpd;

      if (selectedLeaseId) {
        await loadReportsForLease(selectedLeaseId);
      } else {
        await loadStandaloneReports();
      }
      await loadReportDetails(selectedReportId);

      setOk("PDF signé importé ✅ (statut : Signé)");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’importer le PDF signé.");
    } finally {
      setLoading(false);
      if (signedFileInputRef.current) signedFileInputRef.current.value = "";
    }
  };

  const uploadExternalPdf = async (type: "entry" | "exit", file: File) => {
    if (!supabase || !userId) return;
    if (!selectedLeaseId && creationMode !== "standalone") return;
    if (file.type !== "application/pdf") {
      setErr("Fichier invalide : importe un PDF.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setErr("PDF trop volumineux : 10 Mo maximum.");
      return;
    }

    const existing = reports.find((report) => report.report_type === type) || null;
    if (existing?.status === "signed" || existing?.status === "archived") {
      setErr(`${reportTypeLabel(type)} déjà verrouillé : remplace-le uniquement après archivage administratif hors lokt.fr.`);
      return;
    }
    if (existing && !window.confirm(`${reportTypeLabel(type)} existe déjà. Remplacer son parcours lokt.fr par le PDF externe finalisé ?`)) {
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      let reportId = existing?.id || "";
      if (!reportId) {
        const { data, error } = await supabase
          .from("inventory_reports")
          .insert({
            user_id: userId,
            lease_id: selectedLeaseId || null,
            attachment_status: selectedLeaseId ? "attached" : "standalone",
            report_type: type,
            status: "draft",
            performed_at: new Date().toISOString(),
            performed_place: defaultReportPlace,
            counters_json: null,
            general_notes: "",
            pdf_url: null,
            document_source: "external",
            original_file_name: file.name,
          })
          .select("id")
          .single();
        if (error || !data?.id) throw error || new Error("Création de la fiche état des lieux impossible.");
        reportId = String(data.id);
      }

      const headers = await authJsonHeaders();
      const uploadUrlResp = await fetch("/api/inventory/signed-upload-url", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, reportId, kind: "external", sizeBytes: file.size }),
      });
      const { raw, json } = await safeJson(uploadUrlResp);
      if (!uploadUrlResp.ok) throw new Error(json?.error || raw || `Erreur ${uploadUrlResp.status}`);

      const path = String(json?.path || "");
      const signedUrl = String(json?.signedUrl || "");
      if (!path || !signedUrl) throw new Error("URL d’upload signée indisponible.");

      setUploadProgress(0);
      await xhrUploadPdf(signedUrl, file);
      setUploadProgress(null);

      const { error: updateError } = await supabase
        .from("inventory_reports")
        .update({
          pdf_url: `${INVENTORY_BUCKET}:${path}`,
          status: "signed",
          document_source: "external",
          original_file_name: file.name,
        })
        .eq("id", reportId)
        .eq("user_id", userId);
      if (updateError) throw updateError;

      if (selectedLeaseId) {
        await loadReportsForLease(selectedLeaseId);
      } else {
        await loadStandaloneReports();
      }
      setSelectedReportId(reportId);
      await loadReportDetails(reportId);
      await safeRefresh();
      setOk(`${reportTypeLabel(type)} externe importé et archivé ✅`);
    } catch (e: any) {
      setErr(e?.message || "Impossible d’importer le PDF externe.");
    } finally {
      setLoading(false);
      if (externalEntryFileInputRef.current) externalEntryFileInputRef.current.value = "";
      if (externalExitFileInputRef.current) externalExitFileInputRef.current.value = "";
    }
  };

  /* ======================================================
     COMPUTED
  ====================================================== */

  const itemsByRoomId = useMemo(() => {
    const m = new Map<string, InventoryItem[]>();
    for (const it of items) {
      const rid = it.room_id || "__no_room__";
      const arr = m.get(rid) || [];
      arr.push(it);
      m.set(rid, arr);
    }
    return m;
  }, [items]);

  const photosByItemId = useMemo(() => {
    const m = new Map<string, InventoryPhoto[]>();
    for (const photo of photos) {
      const arr = m.get(photo.item_id) || [];
      arr.push(photo);
      m.set(photo.item_id, arr);
    }
    return m;
  }, [photos]);

  const roomsWithItems = useMemo(() => {
    return rooms.map((r) => ({ room: r, items: itemsByRoomId.get(r.id) || [] }));
  }, [rooms, itemsByRoomId]);

  const fieldChecklist = useMemo(
    () => [
      { label: "Bail choisi", done: !!selectedLeaseId },
      { label: "EDL créé", done: !!selectedReportId },
      { label: "Date et lieu", done: !!selectedReport?.performed_at && !!(selectedReport?.performed_place || "").trim() },
      { label: "Pièces renseignées", done: rooms.length > 0 && rooms.every((r) => (itemsByRoomId.get(r.id) || []).length > 0) },
      { label: "Compteurs / clés", done: ["electricity", "water", "gas", "keys", "badges", "remotes"].some((k) => !!String(counters[k] || "").trim()) },
      { label: "PDF généré", done: hasPdf },
      { label: "PDF signé importé", done: selectedReport?.status === "signed" || selectedReport?.status === "archived" },
    ],
    [counters, hasPdf, itemsByRoomId, rooms, selectedLeaseId, selectedReport?.performed_at, selectedReport?.performed_place, selectedReport?.status, selectedReportId]
  );

  const completeness = useMemo(() => {
    if (selectedReport?.document_source === "external" && isLocked) return 100;
    if (!rooms.length) return 0;
    const roomsOk = roomsWithItems.filter((x) => x.items.length > 0).length;
    return Math.round((roomsOk / rooms.length) * 100);
  }, [isLocked, rooms, roomsWithItems, selectedReport?.document_source]);

  const filteredRoomsWithItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roomsWithItems;

    return roomsWithItems
      .map(({ room, items }) => {
        const its = items.filter((it) => {
          const hay = [it.category, it.label, it.description || "", ...(it.defect_tags || [])].filter(Boolean).join(" ").toLowerCase();
          return hay.includes(q);
        });
        return { room, items: its };
      })
      .filter(({ room, items }) => {
        const roomHit = (room.name || "").toLowerCase().includes(q);
        return roomHit || items.length > 0;
      });
  }, [roomsWithItems, search]);

  const roomsCompletionPct = useMemo(() => {
    if (!rooms.length) return 0;
    const okRooms = rooms.filter((r) => (itemsByRoomId.get(r.id) || []).length > 0).length;
    return Math.round((okRooms / rooms.length) * 100);
  }, [rooms, itemsByRoomId]);

  const leaseStarterCards = useMemo(() => activeLeases.slice(0, 4), [activeLeases]);

  /* ======================================================
     VIEW (lecture seule)
  ====================================================== */

  const [viewOpen, setViewOpen] = useState(false);

  const ViewModal = () => {
    if (!selectedReportId) return null;

    const rep = selectedReport;
    const title = rep ? reportTypeLabel(rep.report_type) : "État des lieux";

    return (
      <Modal
        open={viewOpen}
        title={`Consulter — ${title}`}
        onClose={() => setViewOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setViewOpen(false)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Fermer
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="slate">{title}</Badge>
              {rep ? <Badge tone={statusUi(rep.status).tone}>Statut : {statusUi(rep.status).label}</Badge> : null}
              {rep?.performed_at ? <Badge tone="slate">Date : {new Date(rep.performed_at).toLocaleString("fr-FR")}</Badge> : null}
              {rep?.performed_place ? <Badge tone="slate">Lieu : {rep.performed_place}</Badge> : null}
              {isLocked ? <Badge tone="red">Verrouillé</Badge> : null}
            </div>
            {rep?.general_notes ? <p className="mt-2 text-sm text-slate-700">{rep.general_notes}</p> : null}
          </div>

          <div className="space-y-3">
            {rooms.map((r) => {
              const its = itemsByRoomId.get(r.id) || [];
              return (
                <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                      {r.floor_level ? <p className="text-xs text-slate-600">{r.floor_level}</p> : null}
                      {r.notes ? <p className="text-xs text-slate-600 mt-1">{r.notes}</p> : null}
                    </div>
                    <Badge tone={its.length ? "emerald" : "slate"}>{its.length} élément(s)</Badge>
                  </div>

                  {its.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {its.map((it) => (
                        <div key={it.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {it.category} • {it.label}
                          </p>
                          <p className="text-xs text-slate-700 mt-1">
                            État : {conditionOptions.find((x) => x.v === it.condition)?.label || it.condition} • Usure : {it.wear_level ?? "—"}/5 •
                            Gravité : {it.severity ?? 0}/5
                          </p>
                          {it.description ? <p className="text-xs text-slate-700 mt-2">{it.description}</p> : null}
                          {(it.defect_tags || []).length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(it.defect_tags || []).map((t, idx) => (
                                <span
                                  key={`${it.id}-${idx}`}
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.7rem] font-semibold text-slate-700"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      Aucun élément pour cette pièce.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    );
  };
  // =========================
// BLOCK 4/4
// =========================
  /* ======================================================
     WIZARD
  ====================================================== */

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("plan");
  const [wizardReportId, setWizardReportId] = useState<string | null>(null);
  const [wizardRoomIndex, setWizardRoomIndex] = useState(0);

  // Pièces actuelles (DB) + sélection multiple (suppression)
  const [roomRows, setRoomRows] = useState<Array<{ id: string; name: string; key: RoomPresetKey; selected: boolean }>>([]);

  // Suggestions (ajout) — rien coché par défaut
  const [suggestedRooms, setSuggestedRooms] = useState<Array<{ tempId: string; name: string; key: RoomPresetKey; checked: boolean }>>([]);

  // Ajout manuel
  const [customRoomName, setCustomRoomName] = useState("");

  const wizardStepsMeta = useMemo(() => {
    return [
      { key: "plan" as const, label: "Pièces", desc: "Ajouter / supprimer des pièces" },
      { key: "rooms" as const, label: "Décrire", desc: "Ajouter structure, équipements, observations" },
      { key: "finalize" as const, label: "Finaliser", desc: "Générer le PDF à imprimer" },
    ];
  }, []);

  const wizardProgressPct = useMemo(() => {
    const idx = wizardStepsMeta.findIndex((x) => x.key === wizardStep);
    return Math.round(((idx + 1) / wizardStepsMeta.length) * 100);
  }, [wizardStep, wizardStepsMeta]);

  const openWizard = (reportId: string, preferredStep?: WizardStep) => {
    if (isLocked) {
      setErr("Document verrouillé : l’assistant est désactivé.");
      return;
    }
    setWizardReportId(reportId);
    setWizardOpen(true);

    if (preferredStep) {
      setWizardStep(preferredStep);
      setWizardRoomIndex(0);
    } else if (rooms.length > 0) {
      setWizardStep("rooms");
      setWizardRoomIndex(0);
    } else {
      setWizardStep("plan");
      setWizardRoomIndex(0);
    }
  };

  const closeWizard = async () => {
    setWizardOpen(false);
    setWizardReportId(null);
    setWizardStep("plan");
    setWizardRoomIndex(0);
    if (selectedReportId) await loadReportDetails(selectedReportId);
  };

  useEffect(() => {
    if (!wizardOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWizard();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardOpen]);

  useEffect(() => {
    if (wizardOpen && wizardReportId && wizardReportId !== selectedReportId) {
      setSelectedReportId(wizardReportId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardOpen, wizardReportId]);

  // Hydrate step plan
  useEffect(() => {
    if (!wizardOpen) return;
    if (wizardStep !== "plan") return;

    const current = (rooms || []).map((r) => ({
      id: r.id,
      name: r.name,
      key: guessPresetKeyFromRoomName(r.name),
      selected: false,
    }));
    setRoomRows(current);

    const sug = SUGGESTED_PRESETS.map((r) => ({
      tempId: makeTempId(),
      name: r.name,
      key: r.key,
      checked: false,
    }));
    setSuggestedRooms(sug);
    setCustomRoomName("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardOpen, wizardStep, rooms.length]);

  const selectedRoomsCount = useMemo(() => roomRows.filter((r) => r.selected).length, [roomRows]);
  const selectedItemsCount = useMemo(() => {
    const ids = roomRows.filter((r) => r.selected).map((r) => r.id);
    return ids.reduce((acc, id) => acc + ((itemsByRoomId.get(id) || []).length), 0);
  }, [roomRows, itemsByRoomId]);

  const toggleSelectAllCurrent = (v: boolean) => {
    preserveWizardScroll(() => {
      setRoomRows((prev) => prev.map((r) => ({ ...r, selected: v })));
    });
  };

  const deleteSelectedRooms = async () => {
    if (!supabase || !selectedReportId) return;
    if (isLocked) return;

    const ids = roomRows.filter((r) => r.selected).map((r) => r.id);
    if (!ids.length) return;

    if (!confirm(`Supprimer ${ids.length} pièce(s) et ${selectedItemsCount} élément(s) lié(s) ?`)) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error: eDelItems } = await supabase.from("inventory_items").delete().in("room_id", ids).eq("report_id", selectedReportId);
      if (eDelItems) throw eDelItems;

      const { error: eDelRooms } = await supabase.from("inventory_rooms").delete().in("id", ids).eq("report_id", selectedReportId);
      if (eDelRooms) throw eDelRooms;

      setOk("Pièces supprimées ✅");
      await loadReportDetails(selectedReportId);
      setWizardStep("plan");
    } catch (e: any) {
      setErr(e?.message || "Impossible de supprimer les pièces.");
    } finally {
      setLoading(false);
    }
  };

  const applyAddSuggestions = async () => {
    if (!supabase || !selectedReportId) return;
    if (isLocked) return;

    const toAdd = suggestedRooms.filter((s) => s.checked && (s.name || "").trim());
    if (!toAdd.length) {
      setOk("Aucune pièce à ajouter.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const existingNames = new Set((rooms || []).map((r) => (r.name || "").trim().toLowerCase()));

      const payload = toAdd
        .map((r) => ({ name: r.name.trim() }))
        .filter((r) => !existingNames.has(r.name.toLowerCase()))
        .map((r, idx) => ({
          report_id: selectedReportId,
          name: r.name,
          floor_level: null,
          notes: null,
          sort_order: rooms.length + idx,
        }));

      if (!payload.length) {
        setOk("Toutes ces pièces existent déjà (pas de doublons).");
        return;
      }

      const { error } = await supabase.from("inventory_rooms").insert(payload);
      if (error) throw error;

      setOk(`${payload.length} pièce(s) ajoutée(s) ✅`);
      await loadReportDetails(selectedReportId);
      setWizardStep("plan");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’ajouter les pièces.");
    } finally {
      setLoading(false);
    }
  };

  const addCustomRoom = async () => {
    if (!supabase || !selectedReportId) return;
    if (isLocked) return;

    const name = (customRoomName || "").trim();
    if (!name) return;

    const lower = name.toLowerCase();
    const existingNames = new Set((rooms || []).map((r) => (r.name || "").trim().toLowerCase()));
    if (existingNames.has(lower)) {
      setOk("Cette pièce existe déjà.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase.from("inventory_rooms").insert({
        report_id: selectedReportId,
        name,
        floor_level: null,
        notes: null,
        sort_order: rooms.length,
      });
      if (error) throw error;

      setOk("Pièce ajoutée ✅");
      setCustomRoomName("");
      await loadReportDetails(selectedReportId);
      setWizardStep("plan");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’ajouter la pièce.");
    } finally {
      setLoading(false);
    }
  };

  const currentRoom = rooms[wizardRoomIndex] || null;
  const currentRoomItems = currentRoom ? itemsByRoomId.get(currentRoom.id) || [] : [];

  const roomCompletionBadgeTone = (roomId: string) => {
    const c = (itemsByRoomId.get(roomId) || []).length;
    if (c >= 6) return "emerald" as const;
    if (c >= 1) return "amber" as const;
    return "slate" as const;
  };

  const roomCompletionLabel = (roomId: string) => {
    const c = (itemsByRoomId.get(roomId) || []).length;
    if (c >= 6) return "Bien rempli";
    if (c >= 1) return "En cours";
    return "À faire";
  };

  const roomHasCategory = (roomId: string, category: string) => {
    const wanted = category.trim().toLowerCase();
    return (itemsByRoomId.get(roomId) || []).some((it) => (it.category || "").trim().toLowerCase() === wanted);
  };

  const quickAddStructure = async (roomId: string, kind: "mur" | "sol" | "plafond" | "fenetre" | "porte" | "radiateur") => {
    if (isLocked) return;

    const presets: Record<string, { category: string; label: string }> = {
      ...FIELD_STRUCTURE_PRESETS.reduce((acc, p) => ({ ...acc, [p.kind]: { category: p.category, label: p.label } }), {}),
      radiateur: { category: "Radiateur", label: "Fixation / fonctionnement" },
    };

    const p = presets[kind];
    await addItem({
      room_id: roomId,
      category: p.category,
      label: p.label,
      condition: "bon",
      wear_level: 2,
      is_clean: true,
      is_functional: true,
      description: "",
      defect_tags: [],
      severity: 0,
    });
  };

  const markCurrentRoomOk = async () => {
    if (!currentRoom || isLocked) return;
    const missing = FIELD_STRUCTURE_PRESETS.filter((p) => !roomHasCategory(currentRoom.id, p.category));
    if (!missing.length) {
      setOk("Cette pièce possède déjà la structure minimale.");
      return;
    }

    await addItemsBatch(
      missing.map((p) => ({
        room_id: currentRoom.id,
        category: p.category,
        label: p.label,
        condition: "bon",
        wear_level: 1,
        is_clean: true,
        is_functional: true,
        description: "Rien à signaler.",
        defect_tags: [],
        severity: 0,
      }))
    );
  };

  const goPrevWizard = async () => {
    if (wizardStep === "finalize") return setWizardStep("rooms");
    if (wizardStep === "rooms") return setWizardStep("plan");
  };

  const goNextWizard = async () => {
    if (wizardStep === "plan") {
      setWizardStep("rooms");
      setWizardRoomIndex(0);
      return;
    }
    if (wizardStep === "rooms") {
      setWizardStep("finalize");
      return;
    }
  };

  const wizardRoomKey = useMemo(() => {
    if (!currentRoom) return "sejour" as RoomPresetKey;
    return guessPresetKeyFromRoomName(currentRoom.name);
  }, [currentRoom]);

  /* ======================================================
     FINALISATION : READY => PDF AUTO (à imprimer)
  ====================================================== */

  const finalizeToReady = async () => {
    if (!selectedReportId || !userId) return;
    if (isLocked) {
      setErr("Document verrouillé : impossible de finaliser.");
      return;
    }
    if (!selectedReport?.performed_at) {
      setErr("Renseigne la date et l’heure dans la dernière étape “Finaliser” avant de générer le PDF.");
      return;
    }
    const finalPlace = (selectedReport.performed_place || "").trim() || defaultReportPlace;
    if (!finalPlace) {
      setErr(
        "Renseigne le champ “Lieu de signature / visite” dans la dernière étape “Finaliser”. C’est l’adresse où l’état des lieux est réalisé, par exemple : 12 rue Victor Hugo, 75000 Paris."
      );
      return;
    }
    if (!rooms.length) {
      setErr("Ajoute au moins une pièce avant de finaliser l’état des lieux.");
      return;
    }

    const emptyRooms = rooms.filter((r) => !(itemsByRoomId.get(r.id) || []).length);
    if (emptyRooms.length && !confirm(`${emptyRooms.length} pièce(s) n’ont aucun relevé. Finaliser quand même ?`)) {
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);
    const previousStatus = selectedReport?.status || "draft";

    try {
      // 1) status ready
      const { error } = await supabase
        .from("inventory_reports")
        .update({ status: "ready", performed_place: finalPlace })
        .eq("id", selectedReportId)
        .eq("user_id", userId);
      if (error) throw error;

      // 2) génération via API existante
      const headers = await authJsonHeaders();
      const rGen = await fetch("/api/inventory/pdf", {
        method: "POST",
        headers,
        body: JSON.stringify({ reportId: selectedReportId, userId }),
      });

      const rawGen = await rGen.text();
      let jsonGen: any = null;
      try {
        jsonGen = rawGen ? JSON.parse(rawGen) : null;
      } catch {}

      if (!rGen.ok) throw new Error(jsonGen?.error || rawGen || `Erreur ${rGen.status}`);

      if (selectedLeaseId) {
        await loadReportsForLease(selectedLeaseId);
      } else {
        await loadStandaloneReports();
      }
      await loadReportDetails(selectedReportId);

      setOk("EDL finalisé ✅ PDF généré (à imprimer)");
      await closeWizard();
    } catch (e: any) {
      try {
        if (previousStatus !== "ready") {
          await supabase.from("inventory_reports").update({ status: previousStatus }).eq("id", selectedReportId).eq("user_id", userId);
          if (selectedLeaseId) {
            await loadReportsForLease(selectedLeaseId);
          } else {
            await loadStandaloneReports();
          }
        }
      } catch {
        // rollback best effort
      }
      setErr(e?.message || "Impossible de finaliser.");
    } finally {
      setLoading(false);
    }
  };

  /* ======================================================
     Add-item modal (wizard-only)
  ====================================================== */

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({
    category: "Mur",
    label: "",
    condition: "bon" as InventoryItem["condition"],
    wear_level: 2 as number | null,
    is_clean: true,
    is_functional: true,
    description: "",
    defect_tags: "",
    severity: 0,
  });

  const openAddForRoom = (roomId: string, preset?: Partial<typeof addDraft>) => {
    if (!roomId) return;
    if (isLocked) return;

    setAddDraft({
      category: preset?.category ?? "Mur",
      label: preset?.label ?? "",
      condition: (preset?.condition as any) ?? "bon",
      wear_level: preset?.wear_level ?? 2,
      is_clean: preset?.is_clean ?? true,
      is_functional: preset?.is_functional ?? true,
      description: preset?.description ?? "",
      defect_tags: preset?.defect_tags ?? "",
      severity: preset?.severity ?? 0,
    });
    setAddOpen(true);
  };

  /* ======================================================
     ✅ Wizard overlay
  ====================================================== */

  const WizardOverlay = () => {
    if (!wizardOpen) return null;

    const currentStepMeta = wizardStepsMeta.find((s) => s.key === wizardStep)!;

    const StepPill = ({ idx, step }: { idx: number; step: (typeof wizardStepsMeta)[number] }) => {
      const active = step.key === wizardStep;
      const done = wizardStepsMeta.findIndex((x) => x.key === wizardStep) > idx;
      return (
        <div className={cx("flex items-center gap-2 min-w-0")}>
          <div
            className={cx(
              "h-7 w-7 rounded-full border flex items-center justify-center text-xs font-bold",
              done
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700"
            )}
          >
            {done ? "✓" : idx + 1}
          </div>
          <div className="min-w-0">
            <p className={cx("text-xs font-semibold truncate", active ? "text-slate-900" : "text-slate-700")}>{step.label}</p>
            <p className="text-[0.7rem] text-slate-500 truncate">{step.desc}</p>
          </div>
        </div>
      );
    };

    return (
      <div className="fixed inset-0 z-[200]" style={{ overflowAnchor: "none" }}>
        <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeWizard} />

        <div className="absolute inset-0 p-0 sm:p-6 overflow-y-auto" style={{ overflowAnchor: "none" }}>
          <div className="mx-auto flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:rounded-3xl">
            {/* Header */}
            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Mode terrain</p>
                  <p className="text-base font-semibold text-slate-900 truncate">{currentStepMeta.label}</p>
                  <p className="text-xs text-slate-600 mt-1">{currentStepMeta.desc}</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <span className="text-xs font-semibold text-slate-800">{wizardProgressPct}%</span>
                    <div className="h-2 w-32 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${wizardProgressPct}%` }} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeWizard}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Fermer
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {wizardStepsMeta.map((s, idx) => (
                  <StepPill key={s.key} idx={idx} step={s} />
                ))}
              </div>
            </div>

            {/* Body */}
            <div ref={wizardScrollRef} className="flex-1 overflow-y-auto p-4 pb-28 sm:p-5 sm:pb-5" style={{ overflowAnchor: "none" }}>
              {uploadProgress !== null ? (
                <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-sky-700">Upload en cours…</span>
                    <span className="text-xs font-semibold text-sky-700">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-100">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {err ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
              {ok ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}

              {/* STEP: PLAN */}
              {wizardStep === "plan" ? (
                <div className="grid gap-5 lg:grid-cols-[1fr,420px]">
                  {/* Colonne gauche : pièces actuelles */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Pièces actuelles</p>
                          <p className="text-xs text-slate-600 mt-1">Sélection multiple possible. Supprimer une pièce supprime ses éléments.</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone="slate">{roomRows.length} pièce(s)</Badge>
                          {selectedRoomsCount > 0 ? (
                            <Badge tone="amber">
                              {selectedRoomsCount} sélectionnée(s) • {selectedItemsCount} élément(s)
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      {roomRows.length === 0 ? (
                        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                          Aucune pièce pour l’instant.
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => toggleSelectAllCurrent(true)}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              Tout sélectionner
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSelectAllCurrent(false)}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              Tout désélectionner
                            </button>

                            <button
                              type="button"
                              disabled={loading || isLocked || selectedRoomsCount === 0}
                              onClick={deleteSelectedRooms}
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              Supprimer la sélection
                            </button>
                          </div>

                          {selectedRoomsCount > 0 ? (
                            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                              <span className="font-semibold">Impact :</span> {selectedRoomsCount} pièce(s) et{" "}
                              <span className="font-semibold">{selectedItemsCount}</span> élément(s) seront supprimés.
                            </div>
                          ) : null}

                          <div className="mt-3 space-y-2">
                            {roomRows.map((r) => (
                              <label key={r.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <input
                                  type="checkbox"
                                  checked={r.selected}
                                  onChange={(e) =>
                                    preserveWizardScroll(() =>
                                      setRoomRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, selected: e.target.checked } : x)))
                                    )
                                  }
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
                                  <p className="text-xs text-slate-600">{(itemsByRoomId.get(r.id) || []).length} élément(s)</p>
                                </div>
                                <Badge tone={roomCompletionBadgeTone(r.id)}>{roomCompletionLabel(r.id)}</Badge>
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Colonne droite : ajouter */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-[#f6f9fc] p-5">
                      <p className="text-sm font-semibold text-slate-900">Ajouter des pièces</p>
                      <p className="text-xs text-slate-700 mt-2">Coche uniquement ce que tu veux ajouter. Aucun doublon.</p>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-900">Ajout rapide (manuel)</p>
                        <div className="mt-2 flex gap-2">
                          <input
                            value={customRoomName}
                            onChange={(e) => setCustomRoomName(e.target.value)}
                            placeholder="Ex : Cellier, Véranda..."
                            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            disabled={loading || isLocked || !(customRoomName || "").trim()}
                            onClick={addCustomRoom}
                            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            + Ajouter
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 max-h-[360px] overflow-auto pr-1" style={{ overflowAnchor: "none" }}>
                        {suggestedRooms.map((s) => (
                          <label key={s.tempId} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                            <input
                              type="checkbox"
                              checked={s.checked}
                              onChange={(e) =>
                                preserveWizardScroll(() =>
                                  setSuggestedRooms((prev) => prev.map((x) => (x.tempId === s.tempId ? { ...x, checked: e.target.checked } : x)))
                                )
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                              <p className="text-[0.7rem] text-slate-500">{s.key}</p>
                            </div>
                          </label>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <Badge tone="slate">{suggestedRooms.filter((x) => x.checked).length} cochée(s)</Badge>
                        <button
                          type="button"
                          disabled={loading || isLocked || suggestedRooms.every((x) => !x.checked)}
                          onClick={applyAddSuggestions}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Ajouter les pièces cochées
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-900">Tip</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Tu peux revenir ici à tout moment : <span className="font-semibold">rien ne s’efface</span>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* STEP: ROOMS */}
              {wizardStep === "rooms" ? (
                <div className="grid gap-4 lg:grid-cols-[340px,1fr]">
                  <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Progression</p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge tone="emerald">{roomsCompletionPct}% pièces avec au moins 1 élément</Badge>
                        <div className="h-2 w-28 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${roomsCompletionPct}%` }} />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">Objectif : au moins 1 élément par pièce (structure minimale).</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Pièces</p>
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 pr-1 lg:block lg:max-h-[420px] lg:space-y-2 lg:overflow-auto" style={{ overflowAnchor: "none" }}>
                        {rooms.map((r, idx) => {
                          const active = idx === wizardRoomIndex;
                          const tone = roomCompletionBadgeTone(r.id);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => preserveWizardScroll(() => setWizardRoomIndex(idx))}
                              className={cx(
                                "min-w-[180px] text-left rounded-2xl border px-3 py-3 transition lg:w-full",
                                active ? "border-slate-900 bg-white" : "border-slate-200 bg-white/70 hover:bg-white"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
                                  <p className="text-xs text-slate-600 mt-1">{(itemsByRoomId.get(r.id) || []).length} élément(s)</p>
                                </div>
                                <Badge tone={tone}>{roomCompletionLabel(r.id)}</Badge>
                              </div>
                            </button>
                          );
                        })}
                        {!rooms.length ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                            Aucune pièce. Ajoute-en dans l’onglet “Pièces”.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </aside>

                  <section className="space-y-4">
                    {!currentRoom ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
                        Sélectionne une pièce.
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-[#f6f9fc]" />
                            <div className="relative p-4 sm:p-5">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Pièce en cours</p>
                                  <p className="text-lg font-semibold text-slate-900 truncate">{currentRoom.name}</p>
                                  <p className="text-xs text-slate-600 mt-1">
                                    Ajoute d’abord la <span className="font-semibold">structure</span>, puis les équipements.
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge tone={currentRoomItems.length ? "emerald" : "slate"}>{currentRoomItems.length} élément(s)</Badge>
                                    <Badge tone="slate">
                                      Étape {wizardRoomIndex + 1}/{rooms.length}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="hidden shrink-0 sm:block sm:w-[160px] lg:w-[220px]">
                                  <RoomIllustration type={wizardRoomKey} />
                                </div>
                              </div>

                              <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                                <button
                                  type="button"
                                  disabled={loading || isLocked}
                                  onClick={markCurrentRoomOk}
                                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:rounded-full sm:text-xs"
                                >
                                  <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
                                  Pièce OK
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openAddForRoom(currentRoom.id)}
                                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:rounded-full sm:text-xs"
                                >
                                  <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                                  Ajouter un élément
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openAddForRoom(currentRoom.id, {
                                      category: "Défaut",
                                      label: "",
                                      condition: "moyen",
                                      wear_level: 3,
                                      is_clean: false,
                                      is_functional: true,
                                      severity: 3,
                                    })
                                  }
                                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 sm:rounded-full sm:text-xs"
                                >
                                  <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
                                  Ajouter un dégât
                                </button>

                                <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                                  {[
                                    ["mur", "Mur"],
                                    ["sol", "Sol"],
                                    ["plafond", "Plafond"],
                                    ["fenetre", "Fenêtre"],
                                    ["porte", "Porte"],
                                    ["radiateur", "Radiateur"],
                                  ].map(([k, label]) => (
                                    <button
                                      key={k}
                                      type="button"
                                      onClick={() => quickAddStructure(currentRoom.id, k as any)}
                                      className="min-h-[40px] rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 sm:rounded-full"
                                    >
                                      + {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Add modal */}
                        <Modal
                          open={addOpen}
                          title={`Ajouter un élément — ${currentRoom.name}`}
                          onClose={() => setAddOpen(false)}
                          footer={
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setAddOpen(false)}
                                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                disabled={loading || !(addDraft.category || "").trim() || !(addDraft.label || "").trim() || !currentRoom?.id}
                                onClick={async () => {
                                  if (!currentRoom?.id) return;
                                  const tags = (addDraft.defect_tags || "")
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean);

                                  await addItem({
                                    room_id: currentRoom.id,
                                    category: addDraft.category,
                                    label: addDraft.label,
                                    condition: addDraft.condition,
                                    wear_level: addDraft.wear_level === null ? null : Number(addDraft.wear_level),
                                    is_clean: !!addDraft.is_clean,
                                    is_functional: !!addDraft.is_functional,
                                    description: addDraft.description,
                                    defect_tags: tags,
                                    severity: addDraft.severity ?? 0,
                                  });

                                  setAddOpen(false);
                                  setAddDraft((s) => ({ ...s, label: "", description: "", defect_tags: "", severity: 0 }));
                                }}
                                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                Ajouter
                              </button>
                            </div>
                          }
                        >
                          <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <label className="text-[0.7rem] text-slate-700">Catégorie *</label>
                                <input
                                  value={addDraft.category}
                                  onChange={(e) => preserveWizardScroll(() => setAddDraft((s) => ({ ...s, category: e.target.value })))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[0.7rem] text-slate-700">Élément / localisation *</label>
                                <input
                                  value={addDraft.label}
                                  onChange={(e) => preserveWizardScroll(() => setAddDraft((s) => ({ ...s, label: e.target.value })))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                  placeholder="Ex : mur nord, porte entrée, robinet..."
                                />
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="space-y-1">
                                <label className="text-[0.7rem] text-slate-700">État</label>
                                <select
                                  value={addDraft.condition}
                                  onChange={(e) => preserveWizardScroll(() => setAddDraft((s) => ({ ...s, condition: e.target.value as any })))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                >
                                  {conditionOptions.map((o) => (
                                    <option key={o.v} value={o.v}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[0.7rem] text-slate-700">Usure (0–5)</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={5}
                                  value={addDraft.wear_level ?? ""}
                                  onWheel={(e) => {
                                    e.preventDefault();
                                    (e.currentTarget as HTMLInputElement).blur();
                                  }}
                                  onChange={(e) =>
                                    preserveWizardScroll(() =>
                                      setAddDraft((s) => ({ ...s, wear_level: e.target.value === "" ? null : Number(e.target.value) }))
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[0.7rem] text-slate-700">Gravité (0–5)</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={5}
                                  value={addDraft.severity ?? 0}
                                  onWheel={(e) => {
                                    e.preventDefault();
                                    (e.currentTarget as HTMLInputElement).blur();
                                  }}
                                  onChange={(e) =>
                                    preserveWizardScroll(() =>
                                      setAddDraft((s) => ({ ...s, severity: e.target.value === "" ? 0 : Number(e.target.value) }))
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                />
                              </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={!!addDraft.is_clean}
                                  onChange={(e) => preserveWizardScroll(() => setAddDraft((s) => ({ ...s, is_clean: e.target.checked })))}
                                  className="h-4 w-4"
                                />
                                Propre
                              </label>

                              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={!!addDraft.is_functional}
                                  onChange={(e) => preserveWizardScroll(() => setAddDraft((s) => ({ ...s, is_functional: e.target.checked })))}
                                  className="h-4 w-4"
                                />
                                Fonctionnel
                              </label>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[0.7rem] text-slate-700">Observations</label>
                              <textarea
                                rows={3}
                                value={addDraft.description}
                                onChange={(e) => preserveWizardScroll(() => setAddDraft((s) => ({ ...s, description: e.target.value })))}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[0.7rem] text-slate-700">Tags défauts (virgules)</label>
                              <input
                                value={addDraft.defect_tags}
                                onChange={(e) => preserveWizardScroll(() => setAddDraft((s) => ({ ...s, defect_tags: e.target.value })))}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                placeholder="tache, fissure, trou..."
                              />
                            </div>
                          </div>
                        </Modal>

                        {/* Items list */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Éléments de la pièce</p>
                              <p className="text-xs text-slate-600">Ajuste : état/usure/tags/observations.</p>
                            </div>
                            <Badge tone="slate">{currentRoomItems.length} élément(s)</Badge>
                          </div>

                          {currentRoomItems.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                              Aucun élément encore. Clique sur “+ Ajouter un élément” ou utilise les boutons structure.
                            </div>
                          ) : (
                            <div className="grid gap-3 xl:grid-cols-2">
                              {currentRoomItems.map((it) => (
                                <div key={it.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-900 truncate">
                                        {it.category} • {it.label}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-600">
                                        Gravité : <span className="font-semibold">{it.severity ?? 0}</span> • Usure :{" "}
                                        <span className="font-semibold">{it.wear_level ?? "—"}</span>/5
                                      </p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <Badge tone="slate">État : {conditionOptions.find((x) => x.v === it.condition)?.label || it.condition}</Badge>
                                        {it.is_clean ? <Badge tone="emerald">Propre</Badge> : <Badge tone="amber">À nettoyer</Badge>}
                                        {it.is_functional ? <Badge tone="emerald">Fonctionnel</Badge> : <Badge tone="red">Non OK</Badge>}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => deleteItem(it.id)}
                                      className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                                    >
                                      Supprimer
                                    </button>
                                  </div>

                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="space-y-1">
                                      <label className="text-[0.7rem] text-slate-700">État</label>
                                      <select
                                        value={it.condition}
                                        onChange={(e) => preserveWizardScroll(() => updateItem(it.id, { condition: e.target.value as any }))}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                      >
                                        {conditionOptions.map((o) => (
                                          <option key={o.v} value={o.v}>
                                            {o.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[0.7rem] text-slate-700">Usure (0–5)</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={5}
                                        value={it.wear_level ?? ""}
                                        onWheel={(e) => {
                                          e.preventDefault();
                                          (e.currentTarget as HTMLInputElement).blur();
                                        }}
                                        onChange={(e) =>
                                          preserveWizardScroll(() =>
                                            updateItem(it.id, { wear_level: e.target.value === "" ? null : Number(e.target.value) })
                                          )
                                        }
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={it.is_clean === true}
                                        onChange={(e) => preserveWizardScroll(() => updateItem(it.id, { is_clean: e.target.checked }))}
                                        className="h-4 w-4"
                                      />
                                      Propre
                                    </label>

                                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={it.is_functional === true}
                                        onChange={(e) => preserveWizardScroll(() => updateItem(it.id, { is_functional: e.target.checked }))}
                                        className="h-4 w-4"
                                      />
                                      Fonctionnel
                                    </label>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[0.7rem] text-slate-700">Observations</label>
                                    <textarea
                                      rows={3}
                                      value={it.description ?? ""}
                                      onChange={(e) => preserveWizardScroll(() => updateItem(it.id, { description: e.target.value }))}
                                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[0.7rem] text-slate-700">Tags défauts (virgules)</label>
                                    <input
                                      value={(it.defect_tags || []).join(", ")}
                                      onChange={(e) =>
                                        preserveWizardScroll(() =>
                                          updateItem(it.id, {
                                            defect_tags: e.target.value
                                              .split(",")
                                              .map((s) => s.trim())
                                              .filter(Boolean),
                                          })
                                        )
                                      }
                                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                      placeholder="tache, fissure, trou..."
                                    />
                                  </div>

                                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-semibold text-slate-900">Photos de l’observation</p>
                                        <p className="mt-1 text-[0.7rem] leading-4 text-slate-600">
                                          Jusqu’à {MAX_PHOTOS_PER_ITEM} photos. Elles sont compressées avant l’envoi et intégrées au PDF.
                                        </p>
                                      </div>
                                      <Badge tone="slate">{(photosByItemId.get(it.id) || []).length}/{MAX_PHOTOS_PER_ITEM}</Badge>
                                    </div>

                                    {photoFeedback[it.id] ? (
                                      <div
                                        className={cx(
                                          "mt-3 rounded-lg border px-3 py-2 text-xs font-semibold",
                                          photoFeedback[it.id].tone === "error"
                                            ? "border-red-200 bg-red-50 text-red-700"
                                            : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                        )}
                                      >
                                        {photoFeedback[it.id].message}
                                      </div>
                                    ) : null}

                                    {(photosByItemId.get(it.id) || []).length ? (
                                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {(photosByItemId.get(it.id) || []).map((photo) => (
                                          <div key={photo.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                            {photo.preview_url ? (
                                              <img src={photo.preview_url} alt="Observation" className="aspect-[4/3] w-full object-cover" />
                                            ) : (
                                              <div className="flex aspect-[4/3] items-center justify-center text-xs text-slate-500">Aperçu indisponible</div>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => void deleteItemPhoto(photo)}
                                              disabled={isLocked || photoBusyItemId === it.id}
                                              className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/95 text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
                                              title="Supprimer la photo"
                                              aria-label="Supprimer la photo"
                                            >
                                              <TrashIcon className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}

                                    {!isLocked && (photosByItemId.get(it.id) || []).length < MAX_PHOTOS_PER_ITEM ? (
                                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50">
                                        <PhotoIcon className="h-4 w-4" aria-hidden="true" />
                                        {photoBusyItemId === it.id ? "Compression et envoi..." : "Ajouter une photo"}
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp"
                                          capture="environment"
                                          disabled={photoBusyItemId === it.id}
                                          className="sr-only"
                                          onChange={(e) => {
                                            const file = e.currentTarget.files?.[0];
                                            e.currentTarget.value = "";
                                            if (file) void uploadItemPhoto(it.id, file);
                                          }}
                                        />
                                      </label>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={wizardRoomIndex <= 0}
                            onClick={() => preserveWizardScroll(() => setWizardRoomIndex((i) => Math.max(0, i - 1)))}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                          >
                            ← Pièce précédente
                          </button>

                          {wizardRoomIndex < rooms.length - 1 ? (
                            <button
                              type="button"
                              onClick={() => preserveWizardScroll(() => setWizardRoomIndex((i) => Math.min(rooms.length - 1, i + 1)))}
                              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              Pièce suivante →
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </section>
                </div>
              ) : null}

              {/* STEP: FINALIZE */}
              {wizardStep === "finalize" ? (
                <div className="grid gap-5 lg:grid-cols-[1fr,420px]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Résumé</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Clique sur <span className="font-semibold">“Finaliser & générer le PDF”</span> : tu obtiens un PDF à{" "}
                        <span className="font-semibold">imprimer</span> et faire signer.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="emerald">Complétude : {completeness}%</Badge>
                        <Badge tone="slate">{rooms.length} pièce(s)</Badge>
                        <Badge tone="slate">{items.length} élément(s)</Badge>
                      </div>

                      {selectedReport ? (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <label className="text-[0.7rem] font-semibold text-slate-700">Date et heure de la visite</label>
                              <input
                                type="datetime-local"
                                disabled={isLocked}
                                value={selectedReport.performed_at ? new Date(selectedReport.performed_at).toISOString().slice(0, 16) : ""}
                                onChange={(e) => {
                                  const iso = e.target.value ? new Date(e.target.value).toISOString() : null;
                                  updateReport({ performed_at: iso });
                                }}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[0.7rem] font-semibold text-slate-700">Lieu de signature / visite</label>
                              <input
                                disabled={isLocked}
                                value={selectedReport.performed_place || ""}
                                onChange={(e) => updateReport({ performed_place: e.target.value })}
                                placeholder={defaultReportPlace || "Ex : 12 rue Victor Hugo, 75000 Paris"}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                              />
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-900">Compteurs</p>
                            <div className="mt-2 grid gap-3 sm:grid-cols-3">
                              {[
                                ["electricity", "Électricité"],
                                ["water", "Eau"],
                                ["gas", "Gaz"],
                              ].map(([key, label]) => (
                                <div key={key} className="space-y-1">
                                  <label className="text-[0.7rem] text-slate-700">{label}</label>
                                  <input
                                    disabled={isLocked}
                                    value={String(counters[key] || "")}
                                    onChange={(e) => updateCounterField(key, e.target.value)}
                                    placeholder="Index / relevé"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-900">Remise des accès</p>
                            <div className="mt-2 grid gap-3 sm:grid-cols-3">
                              {[
                                ["keys", "Clés"],
                                ["badges", "Badges"],
                                ["remotes", "Télécommandes"],
                              ].map(([key, label]) => (
                                <div key={key} className="space-y-1">
                                  <label className="text-[0.7rem] text-slate-700">{label}</label>
                                  <input
                                    disabled={isLocked}
                                    value={String(counters[key] || "")}
                                    onChange={(e) => updateCounterField(key, e.target.value)}
                                    placeholder="Ex : 2 jeux"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[0.7rem] font-semibold text-slate-700">Notes générales à faire apparaître au PDF</label>
                            <textarea
                              rows={3}
                              disabled={isLocked}
                              value={selectedReport.general_notes || ""}
                              onChange={(e) => updateReport({ general_notes: e.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                            />
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-900">Après signature</p>
                        <p className="mt-1 text-xs text-slate-700">
                          Reviens sur la page principale et clique sur <span className="font-semibold">“Importer le PDF signé”</span> pour archiver.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-[#f6f9fc] p-5">
                      <p className="text-sm font-semibold text-slate-900">Conseil ✅</p>
                      <p className="text-xs text-slate-700 mt-2">
                        Si une pièce n’a aucun élément, ajoute au minimum : <span className="font-semibold">mur + sol + plafond + ouverture</span>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-12px_24px_rgba(15,23,42,0.08)] sm:px-5 sm:py-4 sm:shadow-none">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={loading || wizardStep === "plan"}
                  onClick={goPrevWizard}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 sm:min-h-0 sm:rounded-full sm:text-xs"
                >
                  ← Retour
                </button>

                <div className="flex items-center gap-2">
                  {wizardStep !== "finalize" ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={goNextWizard}
                      className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:min-h-0 sm:rounded-full sm:text-xs"
                    >
                      {wizardStep === "plan" ? "Continuer →" : "Finaliser →"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={loading || isLocked}
                      onClick={finalizeToReady}
                      className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:min-h-0 sm:rounded-full sm:text-xs"
                    >
                      {loading ? "Génération en cours..." : "Finaliser & générer le PDF"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ======================================================
     MAIN PAGE
  ====================================================== */

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-5 sm:p-5" style={{ overflowAnchor: "none" }}>
      <SectionTitle
        kicker="État des lieux"
        title="Préparer une entrée ou une sortie"
        desc="Choisissez le contexte, complétez la visite, puis conservez un document finalisé et verrouillé."
      />

      <WorkflowIntro
        title="Deux façons de démarrer"
        description="Vous pouvez partir d’un bail pour préremplir le logement et le locataire, ou créer un état des lieux libre si la location n’est pas encore rattachée."
        steps={[
          { title: "Choisir le dossier", text: "Sélectionnez un bail actif, reprenez un état des lieux existant ou créez un dossier libre." },
          { title: "Faire la visite", text: "Renseignez pièces, équipements, compteurs, clés, photos et observations utiles." },
          { title: "Finaliser le document", text: "Générez ou importez le PDF finalisé. Une fois signé ou archivé, il est verrouillé." },
        ]}
        note="Pour une sortie, lokt.fr peut repartir de l’état des lieux d’entrée afin d’éviter une double saisie."
      />

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.10),transparent_34%),linear-gradient(135deg,#f8fafc,#ffffff_48%,#f6f9fc)]" />
          <div className="relative grid gap-5 p-5 lg:grid-cols-[1fr,420px] lg:p-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-700">
                <BuildingOffice2Icon className="h-4 w-4" aria-hidden="true" />
                Dossier de visite
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-950 sm:text-2xl">Prépare un état des lieux</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                Choisis un bail pour préremplir le logement et le locataire, ou crée un état des lieux libre si le bail n’est pas encore prêt.
              </p>

              {selectedLeaseId || selectedReportId ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#635bff]">{selectedLeaseId ? "Bail sélectionné" : "État des lieux libre"}</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{selectedContextLabel}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="slate">{reports.length} état(s) des lieux</Badge>
                    {selectedReport ? <Badge tone={statusUi(selectedReport.status).tone}>{statusUi(selectedReport.status).label}</Badge> : null}
                    {hasPdf ? <Badge tone="emerald">PDF disponible</Badge> : null}
                  </div>
                </div>
              ) : leaseStarterCards.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {leaseStarterCards.map((l: any) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedLeaseId(l.id)}
                      className="group min-h-[72px] rounded-2xl border border-slate-200 bg-white/90 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#635bff]/30 hover:shadow-md"
                    >
                      <span className="block text-sm font-semibold text-slate-950">{leaseLabel(l)}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#635bff]">
                        Ouvrir ce dossier
                        <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-700">
                  {safeLeases.length
                    ? "Aucun bail actif disponible. Les baux archivés restent dans les archives et ne sont plus proposés pour un nouvel état des lieux."
                    : "Aucun bail disponible. Crée d’abord un bail dans la section Baux pour préparer un état des lieux."}
                </div>
              )}

              {!selectedLeaseId && standaloneReports.length ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">À rattacher</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {standaloneReports.slice(0, 4).map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => openStandaloneReport(report)}
                        className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-[#635bff]/30 hover:shadow-md"
                      >
                        <span className="block text-sm font-semibold text-slate-950">
                          {report.property_label || report.property_address_line1 || "État des lieux libre"}
                        </span>
                        <span className="mt-1 block text-xs text-slate-600">{report.occupant_label || "Occupant à préciser"}</span>
                        <span className="mt-2 inline-flex text-xs font-semibold text-[#635bff]">Ouvrir le dossier →</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setCreationMode("lease")}
                  className={cx(
                    "rounded-xl px-3 py-2 text-sm font-semibold transition",
                    creationMode === "lease" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
                  )}
                >
                  Depuis un bail
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreationMode("standalone");
                    setSelectedLeaseId("");
                  }}
                  className={cx(
                    "rounded-xl px-3 py-2 text-sm font-semibold transition",
                    creationMode === "standalone" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
                  )}
                >
                  EDL libre
                </button>
              </div>

              {creationMode === "standalone" ? (
                <div className="mb-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Créer sans bail</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Utile avant la signature du bail ou si le bail a été fait ailleurs. Le rattachement restera possible ensuite.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={standaloneForm.reportType}
                      onChange={(e) => setStandaloneForm((prev) => ({ ...prev, reportType: e.target.value as "entry" | "exit" }))}
                      className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
                    >
                      <option value="entry">Entrée</option>
                      <option value="exit">Sortie</option>
                    </select>
                    <input
                      value={standaloneForm.propertyLabel}
                      onChange={(e) => setStandaloneForm((prev) => ({ ...prev, propertyLabel: e.target.value }))}
                      placeholder="Nom du logement"
                      className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
                    />
                  </div>
                  <input
                    value={standaloneForm.addressLine1}
                    onChange={(e) => setStandaloneForm((prev) => ({ ...prev, addressLine1: e.target.value }))}
                    placeholder="Adresse"
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
                  />
                  <div className="grid gap-2 sm:grid-cols-[120px,1fr]">
                    <input
                      value={standaloneForm.postalCode}
                      onChange={(e) => setStandaloneForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                      placeholder="Code postal"
                      className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
                    />
                    <input
                      value={standaloneForm.city}
                      onChange={(e) => setStandaloneForm((prev) => ({ ...prev, city: e.target.value }))}
                      placeholder="Ville"
                      className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
                    />
                  </div>
                  <input
                    value={standaloneForm.occupantLabel}
                    onChange={(e) => setStandaloneForm((prev) => ({ ...prev, occupantLabel: e.target.value }))}
                    placeholder="Nom de l’occupant"
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={standaloneForm.occupantEmail}
                      onChange={(e) => setStandaloneForm((prev) => ({ ...prev, occupantEmail: e.target.value }))}
                      placeholder="Email occupant"
                      className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
                    />
                    <input
                      value={standaloneForm.occupantPhone}
                      onChange={(e) => setStandaloneForm((prev) => ({ ...prev, occupantPhone: e.target.value }))}
                      placeholder="Téléphone"
                      className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={createStandaloneReport}
                    disabled={loading}
                    className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Créer l’état des lieux libre
                  </button>
                </div>
              ) : null}

              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bail à utiliser</label>
              <select
                value={selectedLeaseId}
                onChange={(e) => setSelectedLeaseId(e.target.value)}
                className="mt-2 min-h-[48px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:border-[#635bff] focus:outline-none focus:ring-4 focus:ring-[#635bff]/10"
              >
                <option value="">Sélectionner un bail</option>
                {activeLeases.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {leaseLabel(l)}
                  </option>
                ))}
              </select>

              <div className="mt-4 grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Actions disponibles</p>
                <button
                  type="button"
                  disabled={!selectedLeaseId || loading || entryReport?.status === "signed" || entryReport?.status === "archived"}
                  onClick={() => createReport("entry")}
                  className={cx(
                    "inline-flex min-h-[46px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-50",
                    entryReport
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                      : "bg-slate-950 text-white hover:bg-slate-800"
                  )}
                  title={
                    entryReport?.status === "signed" || entryReport?.status === "archived"
                      ? "L’état des lieux d’entrée est signé : il est verrouillé."
                      : entryReport
                      ? "Reprendre l’état des lieux d’entrée."
                      : "Créer l’état des lieux d’entrée."
                  }
                >
                  {entryReport ? "Reprendre l’entrée" : "Créer l’entrée"}
                </button>
                <button
                  type="button"
                  disabled={!selectedLeaseId || loading || !entryReport || exitReport?.status === "signed" || exitReport?.status === "archived"}
                  onClick={() => createReport("exit")}
                  className={cx(
                    "inline-flex min-h-[46px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-50",
                    exitReport
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                      : "border border-slate-300 bg-white text-slate-950 hover:bg-slate-50"
                  )}
                  title={
                    !entryReport
                      ? "Crée d’abord l’état des lieux d’entrée."
                      : exitReport?.status === "signed" || exitReport?.status === "archived"
                      ? "L’état des lieux de sortie est signé : il est verrouillé."
                      : exitReport
                      ? "Reprendre l’état des lieux de sortie."
                      : "Créer la sortie en copiant les pièces de l’entrée."
                  }
                >
                  {exitReport ? "Reprendre la sortie" : "Créer la sortie depuis l’entrée"}
                </button>

                <div className="my-1 border-t border-slate-200" />
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">PDF réalisé à l’extérieur</p>
                <input
                  ref={externalEntryFileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadExternalPdf("entry", file);
                  }}
                />
                <input
                  ref={externalExitFileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadExternalPdf("exit", file);
                  }}
                />
                <button
                  type="button"
                  disabled={!selectedLeaseId || loading || entryReport?.status === "signed" || entryReport?.status === "archived"}
                  onClick={() => externalEntryFileInputRef.current?.click()}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-50 disabled:opacity-50"
                >
                  <DocumentArrowUpIcon className="h-4 w-4" aria-hidden="true" />
                  Importer l’entrée en PDF
                </button>
                <button
                  type="button"
                  disabled={!selectedLeaseId || loading || exitReport?.status === "signed" || exitReport?.status === "archived"}
                  onClick={() => externalExitFileInputRef.current?.click()}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-50 disabled:opacity-50"
                >
                  <DocumentArrowUpIcon className="h-4 w-4" aria-hidden="true" />
                  Importer la sortie en PDF
                </button>
                <p className="text-[0.7rem] leading-4 text-slate-500">PDF finalisé uniquement, 10 Mo maximum. Le document importé est archivé et verrouillé.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* zone messages : réserve la place => évite layout shift (scroll jump) */}
      <div className="min-h-[44px] space-y-2" style={{ overflowAnchor: "none" }}>
        {uploadProgress !== null ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-sky-700">Upload en cours…</span>
              <span className="text-xs font-semibold text-sky-700">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-100">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : null}
        {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
        {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}
      </div>

      {/* Résumé / Actions */}
      {selectedReportId ? (
      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white" style={{ overflowAnchor: "none" }}>
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-[#f6f9fc]" />
          <div className="relative p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Résumé</p>
                <div className={cx("mt-2 inline-flex rounded-2xl border px-4 py-3", reportTypeTone)}>
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] opacity-75">Document sélectionné</p>
                    <p className="mt-1 text-base font-extrabold sm:text-lg">{reportLabel}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm sm:text-base font-semibold text-slate-900 truncate">
                  {selectedContextLabel}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!selectedLeaseId ? <Badge tone="amber">Non rattaché</Badge> : null}
                  <Badge tone={selectedWorkflow.tone}>{selectedWorkflow.label}</Badge>
                  {isExternalReport ? <Badge tone="slate">Import agence / prestataire</Badge> : null}
                </div>
                <p className="mt-2 max-w-xl text-sm leading-5 text-slate-600">{selectedWorkflow.desc}</p>
              </div>

              <div className="flex flex-col gap-2 sm:items-end">
                {!selectedLeaseId && selectedReportId && !isLocked ? (
                  <div className="grid w-full gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:w-80">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">Rattacher à un bail</p>
                    <select
                      value={attachLeaseId}
                      onChange={(e) => setAttachLeaseId(e.target.value)}
                      className="min-h-[40px] rounded-xl border border-amber-200 bg-white px-3 text-sm font-semibold text-slate-900"
                    >
                      <option value="">Choisir un bail actif</option>
                      {activeLeases.map((lease: any) => (
                        <option key={lease.id} value={lease.id}>
                          {leaseLabel(lease)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={loading || !attachLeaseId}
                      onClick={() => selectedReportId && attachStandaloneReportToLease(selectedReportId, attachLeaseId)}
                      className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-amber-900 px-3 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
                    >
                      Rattacher ce document
                    </button>
                  </div>
                ) : null}

                {!isLocked ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Complétude {completeness}%</span>
                  <div className="h-2 w-32 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${completeness}%` }} />
                  </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    disabled={loading || !selectedReportId || !hasPdf}
                    onClick={openPdf}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 sm:min-h-0 sm:rounded-full sm:text-xs"
                    title={!hasPdf ? "Le PDF sera créé lors de la finalisation." : selectedReport?.status === "signed" ? "Ouvrir le PDF signé" : "Ouvrir le PDF"}
                  >
                    {isExternalReport ? "Ouvrir le PDF externe" : selectedReport?.status === "signed" ? "Ouvrir PDF signé" : "Ouvrir le PDF"}
                  </button>

                  {/* Upload PDF signé */}
                  <input
                    ref={signedFileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadSignedPdf(f);
                    }}
                  />
                  {!isLocked ? (
                    <button
                      type="button"
                      disabled={loading || !selectedReportId || !hasPdf}
                      onClick={() => signedFileInputRef.current?.click()}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 sm:min-h-0 sm:rounded-full sm:text-xs"
                      title={!hasPdf ? "Génère d’abord le PDF (finaliser)." : "Importer le PDF signé pour archiver"}
                    >
                      <DocumentArrowUpIcon className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
                      Importer le PDF signé
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={loading || !selectedReportId}
                    onClick={() => setViewOpen(true)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 sm:min-h-0 sm:rounded-full sm:text-xs"
                  >
                    Consulter (lecture)
                  </button>

                  {!isLocked ? (
                    <button
                      type="button"
                      disabled={loading || !selectedReportId}
                      onClick={() =>
                        selectedReportId && openWizard(selectedReportId, selectedReport?.status === "ready" || hasPdf ? "finalize" : undefined)
                      }
                      className="col-span-2 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 sm:col-span-1 sm:min-h-0 sm:rounded-full sm:text-xs"
                      title="Ouvrir l’assistant"
                    >
                      {primaryReportActionLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {!isLocked ? (
              <p className="mt-3 text-xs text-slate-600">
                {selectedLeaseId
                  ? "L’état des lieux de sortie reprend automatiquement les pièces et éléments de l’entrée lorsqu’elle existe."
                  : "Ce document est libre : il peut être finalisé tel quel ou rattaché à un bail actif plus tard."}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      ) : null}

      {/* Contenu */}
      {selectedLeaseId || selectedReportId ? (
      <div className="grid gap-4 lg:grid-cols-[420px,1fr]" style={{ overflowAnchor: "none" }}>
        {/* LEFT */}
        <aside className="flex flex-col gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">2) États des lieux</p>

            {reports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                {selectedLeaseId ? "Aucun état des lieux pour ce bail." : "Choisis un bail ou ouvre un état des lieux libre."}
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => {
                  const active = r.id === selectedReportId;
                  const title = reportTypeLabel(r.report_type);
                  const actionLabel =
                    r.status === "signed" || r.status === "archived"
                      ? "Lecture"
                      : r.status === "ready" || r.pdf_url
                      ? "Finaliser"
                      : "Saisir";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReportId(r.id)}
                      className={cx(
                        "w-full text-left rounded-2xl border px-3 py-3 transition",
                        active ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{title}</p>
                          <p className="mt-1 text-xs text-slate-600">Créé le {new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone={workflowUi(r).tone}>{workflowUi(r).label}</Badge>
                            {r.document_source === "external" ? <Badge tone="slate">PDF externe</Badge> : null}
                          </div>
                        </div>

                        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800">
                          {active ? "Sélectionné" : `${actionLabel} →`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </aside>

        {/* RIGHT */}
        <section className="space-y-4">
          {!selectedReportId ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
              Sélectionne un bail puis ouvre un état des lieux.
            </div>
          ) : isExternalReport && isLocked ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Document externe archivé</p>
              <p className="mt-2 text-base font-semibold text-slate-950">Aucune étape supplémentaire n’est attendue.</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Le PDF finalisé par l’agence ou le prestataire est conservé dans lokt.fr et disponible depuis ce dossier.
              </p>
              {selectedReport?.original_file_name ? (
                <p className="mt-3 text-xs text-slate-500">Fichier : {selectedReport.original_file_name}</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher (pièce, élément, tags, notes)…"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm"
                  />
                </div>
                <Badge tone="slate">{items.length} élément(s)</Badge>
              </div>

              {rooms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
                  Aucune pièce. Utilise “Ouvrir l’assistant” en haut pour ajouter des pièces.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRoomsWithItems.map(({ room, items }) => (
                    <details key={room.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden" open={false}>
                      <summary className="cursor-pointer list-none p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {room.name} {room.floor_level ? <span className="text-slate-500 text-xs">• {room.floor_level}</span> : null}
                          </p>
                          {room.notes ? <p className="mt-1 text-xs text-slate-600">{room.notes}</p> : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone={items.length ? "emerald" : "slate"}>{items.length} élément(s)</Badge>
                          </div>
                        </div>
                      </summary>

                      <div className="px-4 pb-4">
                        {items.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">Aucun élément.</div>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2">
                            {items.map((it) => (
                              <div key={it.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {it.category} • {it.label}
                                </p>
                                <p className="text-xs text-slate-600">
                                  État : {conditionOptions.find((x) => x.v === it.condition)?.label || it.condition} • Usure : {it.wear_level ?? "—"}/5 •
                                  Gravité : {it.severity ?? 0}/5
                                </p>
                                {it.description ? <p className="text-xs text-slate-700">{it.description}</p> : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      ) : null}

      {selectedReportId && !isExternalReport && !isLocked ? <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start gap-3">
          <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Checklist terrain</p>
            <p className="mt-1 text-xs text-slate-600">À garder sous les yeux pendant la visite, surtout sur téléphone.</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {fieldChecklist.map((item) => (
            <div
              key={item.label}
              className={cx(
                "rounded-xl border px-3 py-2 text-xs font-semibold",
                item.done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <CheckCircleIcon className={cx("h-4 w-4", item.done ? "text-emerald-700" : "text-slate-400")} aria-hidden="true" />
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div> : null}

      <RepairsGuideCard />

      {ViewModal()}
      {WizardOverlay()}
    </div>
  );
}
