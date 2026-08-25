import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  FolderOpenIcon,
  HomeModernIcon,
  MapPinIcon,
  PhotoIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { usePermissions } from "../../PermissionProvider";
import { planAllowsDocumentSharing } from "../../../lib/permissions";
import { SectionTitle } from "../UiBits";
import { NiceSelect } from "../ui/NiceSelect";
import type { Lease, Property, PropertyFinance, PropertyLot, Tenant } from "../../../lib/landlord/types";
import { isActivePropertyLike, isEDLSelectableLease } from "../../../lib/landlord/archiveFilters";
import { leaseRequiresLmnpInventory, getLmnpItemStatus } from "../../../lib/landlord/lmnpInventory";
import AddressAutocomplete from "../../forms/AddressAutocomplete";
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
  is_lmnp_required?: boolean;
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
  propertyLots?: PropertyLot[];
  tenants?: Tenant[];
  propertyFinance?: PropertyFinance[];
  onRefresh?: () => Promise<void>;
  onNavigateToBaux?: () => void;
  onNavigateToInventaire?: () => void;
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

// "neuf"/"tres_bon" sont des nuances de "bon" (rien à signaler) — seul "moyen"/"mauvais"
// signale un problème qui justifie de documenter usure/propreté/fonctionnement/photos.
const CONDITION_NEEDS_DETAIL: Record<InventoryItem["condition"], boolean> = {
  neuf: false,
  tres_bon: false,
  bon: false,
  moyen: true,
  mauvais: true,
};

function ConditionTapButtons({
  value,
  onChange,
}: {
  value: InventoryItem["condition"];
  onChange: (v: InventoryItem["condition"]) => void;
}) {
  const isGoodTier = value === "bon" || value === "neuf" || value === "tres_bon";
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => onChange("bon")}
          className={cx(
            "min-h-[40px] rounded-xl border px-2 text-sm font-semibold transition-colors",
            isGoodTier
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          )}
        >
          Bon
        </button>
        <button
          type="button"
          onClick={() => onChange("moyen")}
          className={cx(
            "min-h-[40px] rounded-xl border px-2 text-sm font-semibold transition-colors",
            value === "moyen"
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          )}
        >
          Moyen
        </button>
        <button
          type="button"
          onClick={() => onChange("mauvais")}
          className={cx(
            "min-h-[40px] rounded-xl border px-2 text-sm font-semibold transition-colors",
            value === "mauvais"
              ? "border-red-600 bg-red-600 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          )}
        >
          Mauvais
        </button>
      </div>
      {isGoodTier && (
        <div className="flex flex-wrap gap-1.5">
          {(["neuf", "tres_bon"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(value === v ? "bon" : v)}
              className={cx(
                "rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold transition-colors",
                value === v
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              )}
            >
              {v === "neuf" ? "Neuf" : "Très bon"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Éléments structurels communs à toute pièce — créés automatiquement dès
// qu'une pièce est ajoutée, pour guider le bailleur au lieu de lui demander
// d'inventer la liste sur place (état "bon" par défaut, à ajuster d'un tap).
const STRUCTURAL_TEMPLATE: Array<{ category: string; label: string }> = [
  { category: "Sol", label: "Revêtement" },
  { category: "Mur", label: "État général" },
  { category: "Plafond", label: "État général" },
  { category: "Porte", label: "Ouverture / serrure" },
  { category: "Fenêtre", label: "Ouverture / vitrage" },
  { category: "Électricité", label: "Prises électriques" },
  { category: "Électricité", label: "Interrupteurs" },
  { category: "Électricité", label: "Luminaires" },
  { category: "Chauffage", label: "Radiateur" },
];

// Équipements propres à certains types de pièce, ajoutés en plus du socle
// structurel ci-dessus.
const ROOM_EQUIPMENT_TEMPLATE: Partial<Record<RoomPresetKey, Array<{ category: string; label: string }>>> = {
  cuisine: [
    { category: "Cuisson", label: "Plaques de cuisson" },
    { category: "Cuisson", label: "Four ou four micro-ondes" },
    { category: "Froid", label: "Réfrigérateur" },
    { category: "Équipement", label: "Évier" },
    { category: "Rangement", label: "Meubles hauts et bas" },
  ],
  sdb: [
    { category: "Équipement", label: "Douche ou baignoire" },
    { category: "Équipement", label: "Lavabo / meuble vasque" },
    { category: "Équipement", label: "Miroir" },
    { category: "Ventilation", label: "VMC" },
  ],
  wc: [
    { category: "Équipement", label: "Cuvette" },
    { category: "Équipement", label: "Chasse d'eau" },
  ],
  chambre: [{ category: "Rangement", label: "Placard / penderie" }],
  dressing: [{ category: "Rangement", label: "Penderie / étagères" }],
  buanderie: [{ category: "Rangement", label: "Meuble / rangement" }],
  entree: [{ category: "Rangement", label: "Placard / rangement" }],
};

function templateItemsForRoomKey(key: RoomPresetKey): Array<{ category: string; label: string }> {
  return [...STRUCTURAL_TEMPLATE, ...(ROOM_EQUIPMENT_TEMPLATE[key] || [])];
}


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
      desc: "Le PDF est prêt. Envoie-le pour signature électronique.",
      tone: "amber" as const,
    };
  }
  return {
    label: "En cours",
    desc: "Reprends la saisie pour compléter puis générer le PDF.",
    tone: "slate" as const,
  };
};

const fmtDateFR = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
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

type WizardStep = "intro" | "config" | "rooms" | "finalize";

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
const MAX_STORED_PHOTO_BYTES = 130 * 1024;
const MAX_PHOTOS_PER_ITEM = 3;
const COUNTER_KEYS = ["electricity", "water", "gas"] as const;

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

    const maxSide = 1000;
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

    for (const quality of [0.72, 0.62, 0.52, 0.42, 0.32]) {
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
export function SectionEtatDesLieux({ userId, leases, properties, propertyLots, tenants, propertyFinance, onRefresh, onNavigateToBaux, onNavigateToInventaire }: Props) {
  const { plan } = usePermissions();
  const canShareDocuments = planAllowsDocumentSharing(plan);
  const safeLeases = useMemo(() => (Array.isArray(leases) ? leases : []), [leases]);
  const safeProps = useMemo(() => (Array.isArray(properties) ? properties : []), [properties]);
  const safeTenants = useMemo(() => (Array.isArray(tenants) ? tenants : []), [tenants]);
  const safePropertyLots = useMemo(() => (Array.isArray(propertyLots) ? propertyLots : []), [propertyLots]);

  const propertyById = useMemo(() => {
    const m = new Map<string, Property>();
    for (const p of safeProps) m.set(p.id, p);
    return m;
  }, [safeProps]);

  const lotById = useMemo(() => {
    const m = new Map<string, PropertyLot>();
    for (const lot of safePropertyLots) m.set(lot.id, lot);
    return m;
  }, [safePropertyLots]);

  const tenantById = useMemo(() => {
    const m = new Map<string, Tenant>();
    for (const t of safeTenants) m.set(t.id, t);
    return m;
  }, [safeTenants]);

  const activeLeases = useMemo(() => safeLeases.filter(isEDLSelectableLease), [safeLeases]);

  // Sur un immeuble, plusieurs baux partagent le même bien — sans le nom du
  // lot, impossible de savoir quel logement l'état des lieux concerne.
  const propertyLabelForLease = (l: Pick<Lease, "property_id" | "lot_id">) => {
    const p = propertyById.get(l.property_id);
    const lot = l.lot_id ? lotById.get(l.lot_id) : null;
    return lot ? `${p?.label || "Logement"} · ${lot.label}` : p?.label || "Logement";
  };

  const leaseLabel = (l: Lease) => {
    const t = tenantById.get(l.tenant_id);
    return `${propertyLabelForLease(l)} — ${t?.full_name || "Locataire"}`;
  };

  const propertyPlaceLabel = (p?: Property | null, lot?: PropertyLot | null) =>
    [p?.address_line1, lot?.label || p?.address_line2, [p?.postal_code, p?.city].filter(Boolean).join(" ")]
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
  const [sendingTenant, setSendingTenant] = useState(false);
  const [tenantEmailSent, setTenantEmailSent] = useState<string | null>(null);
  const [sigEdlLoading, setSigEdlLoading] = useState(false);
  const [sigEdlSent, setSigEdlSent] = useState(false);
  const [sigEdlRequestId, setSigEdlRequestId] = useState<string | null>(null);
  const [sigEdlWarning, setSigEdlWarning] = useState<string | null>(null);
  const [sigEdlCancelLoading, setSigEdlCancelLoading] = useState(false);
  const [lmnpSyncLoading, setLmnpSyncLoading] = useState(false);
  const [lmnpSyncDone, setLmnpSyncDone] = useState(false);
  const [lmnpInventoryEmptyForProperty, setLmnpInventoryEmptyForProperty] = useState(false);
  const [sigEdlError, setSigEdlError] = useState<string | null>(null);

  const [reports, setReports] = useState<InventoryReport[]>([]);
  const [standaloneReports, setStandaloneReports] = useState<InventoryReport[]>([]);
  const [completedExitLeaseIds, setCompletedExitLeaseIds] = useState<Set<string>>(new Set());
  // Baux ayant déjà au moins un état des lieux — sert à distinguer "dossier
  // existant" (panneau de gauche) de "rien encore créé" (le bail n'apparaît
  // alors que dans le sélecteur du formulaire de création, à droite).
  const [leaseIdsWithReport, setLeaseIdsWithReport] = useState<Set<string>>(new Set());
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const [rooms, setRooms] = useState<InventoryRoom[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [photos, setPhotos] = useState<InventoryPhoto[]>([]);
  const [photoBusyItemId, setPhotoBusyItemId] = useState<string | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<Record<string, { tone: "error" | "success"; message: string }>>({});
  const [optimisticItemPhotoUrl, setOptimisticItemPhotoUrl] = useState<Record<string, string>>({});
  const [counterPhotoBusyKey, setCounterPhotoBusyKey] = useState<string | null>(null);
  const [counterPhotoFeedback, setCounterPhotoFeedback] = useState<Record<string, { tone: "error" | "success"; message: string }>>({});
  const [counterPhotoUrls, setCounterPhotoUrls] = useState<Record<string, string>>({});
  const [optimisticCounterPhotoUrl, setOptimisticCounterPhotoUrl] = useState<Record<string, string>>({});

  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);
  // Éléments repliés par défaut (résumé seulement) : évite qu'un clic sur
  // "Pièce OK" (5 éléments d'un coup) n'affiche 5 formulaires complets à la
  // fois. On déplie un élément uniquement quand le bailleur veut l'ajuster.
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const toggleItemExpanded = (id: string) =>
    preserveWizardScroll(() => setExpandedItemIds((prev) => ({ ...prev, [id]: !prev[id] })));
  // Usure/propreté/fonctionnement/observations/tags/photos ne s'affichent que si
  // l'état tapé est Moyen/Mauvais, ou si le bailleur force l'ouverture pour un
  // élément en bon état (ex : vouloir quand même ajouter une photo).
  const [forcedDetailItemIds, setForcedDetailItemIds] = useState<Record<string, boolean>>({});
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState<string | null>(null);
  const [confirmReplaceExternalPdf, setConfirmReplaceExternalPdf] = useState<{ type: "entry" | "exit"; file: File } | null>(null);
  const [confirmDeleteRoomsOpen, setConfirmDeleteRoomsOpen] = useState(false);
  const [confirmFinalizeEmptyRooms, setConfirmFinalizeEmptyRooms] = useState(false);

  const [search, setSearch] = useState("");
  const [creationMode, setCreationMode] = useState<"lease" | "standalone">("lease");
  const [attachLeaseId, setAttachLeaseId] = useState("");
  const [creationWizardStep, setCreationWizardStep] = useState<1 | 2 | null>(null);
  const [creationWizardReportType, setCreationWizardReportType] = useState<"entry" | "exit" | null>(null);
  const externalCreationWizardFileInputRef = React.useRef<HTMLInputElement>(null);

  const resetCreationWizard = () => {
    setCreationWizardStep(null);
    setCreationWizardReportType(null);
  };
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
  const selectedLease = useMemo(() => activeLeases.find((l) => l.id === selectedLeaseId) || null, [activeLeases, selectedLeaseId]);
  const leaseEnded = useMemo(() => {
    if (!selectedLease) return false;
    if (selectedLease.status === "archived" || selectedLease.status === "ended" || selectedLease.status === "terminated") return true;
    if (selectedLease.end_date && new Date(selectedLease.end_date) < new Date()) return true;
    return false;
  }, [selectedLease]);
  // Choisit entre créer/reprendre directement (cas courant : bail, pas
  // délégué, pas d'entrée externe à réimporter) et passer par l'écran
  // "Comment souhaitez-vous créer ?" (cas standalone, délégué à une agence,
  // ou sortie après une entrée importée en PDF externe — dans ces cas la
  // saisie guidée n'est pas la seule option, il faut laisser le choix).
  const startOrCreateReport = (type: "entry" | "exit", mode: "lease" | "standalone") => {
    setCreationWizardReportType(type);
    setCreationMode(mode);
    if (mode === "lease") {
      const existing = reports.find((r) => r.report_type === type);
      const delegatedImportOnly =
        !!selectedProperty?.delegated_services?.includes("bail_edl") ||
        (type === "exit" && entryReport?.document_source === "external");
      if (existing || !delegatedImportOnly) {
        void createReport(type);
        resetCreationWizard();
        return;
      }
    }
    setCreationWizardStep(2);
  };
  const startWizardStep3 = (type: "entry" | "exit") => startOrCreateReport(type, "lease");
  const selectedProperty = selectedLease ? propertyById.get(selectedLease.property_id) || null : null;
  const selectedLot = selectedLease?.lot_id ? lotById.get(selectedLease.lot_id) || null : null;

  // Le bien est-il censé être suivi en LMNP, mais sans aucun élément
  // obligatoire encore configuré dans la section Inventaire ? Dans ce cas,
  // le préremplissage de l'EDL entrée n'a rien à copier — on prévient plutôt
  // que de laisser l'EDL paraître vide sans explication.
  useEffect(() => {
    if (!supabase || !userId || !selectedProperty?.id) { setLmnpInventoryEmptyForProperty(false); return; }
    if (!leaseRequiresLmnpInventory(selectedLease, leases, properties)) {
      setLmnpInventoryEmptyForProperty(false);
      return;
    }
    let mounted = true;
    (async () => {
      let query = supabase
        .from("property_inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("property_id", selectedProperty.id)
        .eq("is_required_lmnp", true);
      query = selectedLease?.lot_id ? query.eq("lot_id", selectedLease.lot_id) : query.is("lot_id", null);
      const { count } = await query;
      if (mounted) setLmnpInventoryEmptyForProperty(!count);
    })();
    return () => { mounted = false; };
  }, [selectedProperty?.id, selectedLease, leases, userId]);
  const standalonePlaceLabel = selectedReport
    ? [
        selectedReport.property_address_line1,
        selectedReport.property_address_line2,
        [selectedReport.property_postal_code, selectedReport.property_city].filter(Boolean).join(" "),
      ]
        .filter((part) => String(part || "").trim())
        .join(", ")
    : "";
  const defaultReportPlace = propertyPlaceLabel(selectedProperty, selectedLot) || standalonePlaceLabel;

  const selectedLeaseNiceLabel = selectedLease ? leaseLabel(selectedLease) : "—";
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
  const effectiveTenantEmail = selectedReport?.occupant_email
    || (selectedLease?.tenant_id ? tenantById.get(selectedLease.tenant_id)?.email || null : null)
    || null;

  // L'état "déjà envoyé en signature" ne doit pas dépendre uniquement de l'action
  // en session (sinon fermer puis rouvrir le dossier fait disparaître l'info et
  // le bouton "Annuler la demande" avec elle) — on relit la demande active en base
  // à chaque changement de rapport sélectionné.
  useEffect(() => {
    if (!supabase || !selectedReport?.id || !hasPdf) {
      setSigEdlSent(false);
      setSigEdlRequestId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("signature_requests")
        .select("id, status")
        .eq("inventory_report_id", selectedReport.id)
        .in("status", ["pending", "partially_signed"])
        .maybeSingle();
      if (cancelled) return;
      setSigEdlSent(!!data);
      setSigEdlRequestId(data?.id || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedReport?.id, hasPdf]);
  const selectedWorkflow = workflowUi(selectedReport);
  const entryReport = useMemo(() => reports.find((r) => r.report_type === "entry") || null, [reports]);
  const exitReport = useMemo(() => reports.find((r) => r.report_type === "exit") || null, [reports]);
  const primaryReportActionLabel = selectedReport
    ? selectedReport.status === "ready" || hasPdf
      ? "Finaliser l’EDL"
      : "Reprendre la saisie"
    : "Créer l’état des lieux";
  const counters = (selectedReport?.counters_json && typeof selectedReport.counters_json === "object" ? selectedReport.counters_json : {}) as Record<string, any>;

  useEffect(() => {
    if (!supabase) return;
    const paths = COUNTER_KEYS.map((key) => [key, String(counters[`${key}_photo_path`] || "")] as const).filter(([, path]) => !!path);
    if (paths.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        paths.map(async ([key, path]) => {
          const { data } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).createSignedUrl(path, 60 * 60);
          return [key, data?.signedUrl || ""] as const;
        })
      );
      if (cancelled) return;
      setCounterPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [key, url] of entries) {
          if (url) next[key] = url;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counters.electricity_photo_path, counters.water_photo_path, counters.gas_photo_path]);

  // ✅ Scroll preserve (wizard) + anti "retour en haut"
  const wizardScrollRef = useRef<HTMLDivElement | null>(null);
  const preserveWizardScroll = (fn: () => void) => {
    const el = wizardScrollRef.current;
    const top = el?.scrollTop ?? 0;
    fn();
    requestAnimationFrame(() => {
      if (el) el.scrollTop = top;
    });
  };


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
      const [{ data: standalone, error: e1 }, { data: exitDone, error: e2 }, { data: withReport, error: e3 }] = await Promise.all([
        supabase
          .from("inventory_reports")
          .select("*")
          .eq("user_id", userId)
          .is("lease_id", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("inventory_reports")
          .select("lease_id")
          .eq("user_id", userId)
          .eq("report_type", "exit")
          .in("status", ["signed", "archived"])
          .not("lease_id", "is", null),
        supabase
          .from("inventory_reports")
          .select("lease_id")
          .eq("user_id", userId)
          .not("lease_id", "is", null),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      setStandaloneReports(((standalone || []) as InventoryReport[]) || []);
      setCompletedExitLeaseIds(new Set((exitDone || []).map((r: any) => r.lease_id)));
      setLeaseIdsWithReport(new Set((withReport || []).map((r: any) => r.lease_id)));
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
    if (selectedLeaseId && !activeLeases.some((lease) => lease.id === selectedLeaseId)) {
      setSelectedLeaseId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeases]);

  useEffect(() => {
    if (selectedReportId) loadReportDetails(selectedReportId);
    setTenantEmailSent(null);
    setSigEdlSent(false);
    setSigEdlError(null);
    setLmnpSyncDone(false);
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
      is_lmnp_required: it.is_lmnp_required ?? false,
    }));

    if (payloadItems.length) {
      const { error: eInsItems } = await supabase.from("inventory_items").insert(payloadItems);
      if (eInsItems) throw eInsItems;
    }

    return { roomsCopied: rRooms.length, itemsCopied: payloadItems.length };
  };

  /* ======================================================
     MUTATIONS : pont avec l'inventaire LMNP du bien
====================================================== */

  const LMNP_CONDITION_TO_EDL: Record<string, InventoryItem["condition"]> = {
    neuf: "neuf",
    tres_bon: "tres_bon",
    bon: "bon",
    moyen: "moyen",
    a_remplacer: "mauvais",
  };

  // Préremplit l'EDL d'entrée avec les éléments obligatoires LMNP déjà
  // enregistrés sur le bien (section Inventaire), plutôt que de les faire
  // ressaisir. Les lignes créées sont taguées is_lmnp_required pour pouvoir
  // les repérer plus tard (comparatif + resynchronisation à la sortie).
  const prefillLmnpItemsForEntry = async (propertyId: string, reportId: string, lotId?: string | null) => {
    if (!supabase || !userId) return { roomsCreated: 0, itemsCreated: 0 };

    let itemsQuery = supabase
      .from("property_inventory_items")
      .select("room, category, label, required_quantity, actual_quantity, condition")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .eq("is_required_lmnp", true);
    itemsQuery = lotId ? itemsQuery.eq("lot_id", lotId) : itemsQuery.is("lot_id", null);
    const { data: lmnpItems, error } = await itemsQuery;
    if (error) throw error;
    if (!lmnpItems || !lmnpItems.length) return { roomsCreated: 0, itemsCreated: 0 };

    const roomNames = Array.from(new Set(lmnpItems.map((it: any) => (it.room || "").trim() || "Autre")));
    const roomIdByName = new Map<string, string>();
    for (let i = 0; i < roomNames.length; i++) {
      const { data: newRoom, error: eIns } = await supabase
        .from("inventory_rooms")
        .insert({ report_id: reportId, name: roomNames[i], floor_level: null, notes: null, sort_order: i })
        .select("id")
        .single();
      if (eIns) throw eIns;
      roomIdByName.set(roomNames[i], (newRoom as any).id);
    }

    const payload = lmnpItems.map((it: any) => {
      const required = Number(it.required_quantity || 1);
      const actual = Number(it.actual_quantity || 0);
      const status = getLmnpItemStatus({ required_quantity: required, actual_quantity: actual, condition: it.condition });
      const isMissing = status === "missing";
      const isPartial = status === "partial";
      const description = isMissing
        ? `Élément LMNP obligatoire — quantité requise : ${required}, quantité constatée : 0. ⚠ Absent de l'inventaire à ce jour.`
        : isPartial
        ? `Élément LMNP obligatoire — quantité requise : ${required}, quantité constatée : ${actual}. ⚠ Incomplet.`
        : `Élément LMNP obligatoire — quantité requise : ${required}.`;
      return {
        report_id: reportId,
        room_id: roomIdByName.get((it.room || "").trim() || "Autre") || null,
        category: it.category || "",
        label: it.label,
        condition: LMNP_CONDITION_TO_EDL[it.condition] || "bon",
        wear_level: null,
        description,
        defect_tags: isMissing ? ["Manquant"] : isPartial ? ["Quantité incomplète"] : [],
        is_clean: true,
        is_functional: !isMissing,
        recommended_action: null,
        estimated_cost: null,
        severity: isMissing ? 3 : isPartial ? 2 : 0,
        is_lmnp_required: true,
      };
    });

    const { error: eInsItems } = await supabase.from("inventory_items").insert(payload);
    if (eInsItems) throw eInsItems;

    // Checklist structurelle standard (Sol/Mur/Plafond/Porte/Fenêtre/Électricité/
    // Chauffage + équipements par type de pièce), en plus des items LMNP — pour
    // que ces pièces préremplies aient la même base que celles créées via
    // "Ajouter des pièces" (applyAddSuggestions/addCustomRoom).
    const structuralPayload = roomNames.flatMap((name) => {
      const roomId = roomIdByName.get(name);
      if (!roomId) return [];
      const key = guessPresetKeyFromRoomName(name);
      const lmnpKeysForRoom = new Set(
        lmnpItems
          .filter((it: any) => ((it.room || "").trim() || "Autre") === name)
          .map((it: any) => `${(it.category || "").trim().toLowerCase()}|${(it.label || "").trim().toLowerCase()}`)
      );
      return templateItemsForRoomKey(key)
        .filter((t) => !lmnpKeysForRoom.has(`${t.category.trim().toLowerCase()}|${t.label.trim().toLowerCase()}`))
        .map((t) => ({
          report_id: reportId,
          room_id: roomId,
          category: t.category,
          label: t.label,
          condition: "bon" as const,
          wear_level: 1,
          description: "",
          defect_tags: [],
          is_clean: true,
          is_functional: true,
          recommended_action: null,
          estimated_cost: null,
          severity: 0,
        }));
    });

    if (structuralPayload.length) {
      const { error: eInsStruct } = await supabase.from("inventory_items").insert(structuralPayload);
      if (eInsStruct) throw eInsStruct;
    }

    return { roomsCreated: roomNames.length, itemsCreated: payload.length + structuralPayload.length };
  };

  const EDL_CONDITION_TO_LMNP: Record<string, string> = {
    neuf: "neuf",
    tres_bon: "tres_bon",
    bon: "bon",
    moyen: "moyen",
    mauvais: "a_remplacer",
  };

  // Reporte l'état constaté à la sortie sur l'inventaire LMNP permanent du
  // bien, pour les seuls éléments qui y avaient été rattachés à l'entrée
  // (is_lmnp_required). Ne modifie que la condition — la quantité reste de
  // la responsabilité du bailleur dans la section Inventaire.
  // Le filtre porte aussi sur la pièce (`roomName`), pas seulement le libellé :
  // deux éléments LMNP peuvent légitimement partager le même libellé dans des
  // pièces différentes (ex. "Couette" en Chambre 1 et Chambre 2) — sans ce
  // filtre, mettre à jour l'un écrasait silencieusement l'état de l'autre.
  const syncLmnpInventoryFromExit = async (
    propertyId: string,
    lmnpItemsInReport: Array<InventoryItem & { roomName?: string | null }>,
    lotId?: string | null
  ) => {
    if (!supabase || !userId || !lmnpItemsInReport.length) return { updated: 0 };
    let updated = 0;
    for (const it of lmnpItemsInReport) {
      let query = supabase
        .from("property_inventory_items")
        .update({ condition: EDL_CONDITION_TO_LMNP[it.condition] || "bon" }, { count: "exact" })
        .eq("user_id", userId)
        .eq("property_id", propertyId)
        .eq("label", it.label);
      query = lotId ? query.eq("lot_id", lotId) : query.is("lot_id", null);
      if (it.roomName) query = query.eq("room", it.roomName);
      const { error, count } = await query;
      if (!error && count) updated += count;
    }
    return { updated };
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
        if (!entryReportId) {
          setErr("Aucun état des lieux d’entrée trouvé pour ce bail. Crée-le d’abord — ou importe un PDF externe si l’entrée a été réalisée hors lokt.fr.");
          return;
        }
      }

      // créer report
      const _lease = safeLeases.find((l) => l.id === selectedLeaseId) || null;
      const _tenant = _lease?.tenant_id ? tenantById.get(_lease.tenant_id) || null : null;
      const _property = _lease?.property_id ? propertyById.get(_lease.property_id) || null : null;
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
          tenant_id: _lease?.tenant_id || null,
          property_id: _lease?.property_id || null,
          occupant_label: _tenant?.full_name || null,
          occupant_email: _tenant?.email || null,
          occupant_phone: _tenant?.phone || null,
          property_label: _property?.label || null,
          property_address_line1: _property?.address_line1 || null,
          property_address_line2: _property?.address_line2 || null,
          property_postal_code: _property?.postal_code || null,
          property_city: _property?.city || null,
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
      } else if (type === "entry" && _property?.id && leaseRequiresLmnpInventory(_lease, leases, properties)) {
        try {
          const { itemsCreated } = await prefillLmnpItemsForEntry(_property.id, reportId, _lease?.lot_id);
          setOk(
            itemsCreated > 0
              ? `État des lieux créé ✅ (${itemsCreated} élément(s) LMNP obligatoire(s) prérempli(s) depuis l'inventaire du bien)`
              : "État des lieux créé ✅"
          );
        } catch (prefillErr: any) {
          console.error(prefillErr);
          setOk("État des lieux créé ✅ (préremplissage LMNP impossible — tu peux compléter manuellement)");
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

  const createStandaloneReport = async (reportTypeOverride?: "entry" | "exit") => {
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
        report_type: reportTypeOverride ?? standaloneForm.reportType,
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
    const lease = activeLeases.find((item) => item.id === leaseId);
    if (!lease) {
      setErr("Choisis un bail actif pour rattacher ce document.");
      return;
    }
    const property = propertyById.get(lease.property_id) || null;
    const tenant = tenantById.get(lease.tenant_id) || null;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { data: updated, error } = await supabase
        .from("inventory_reports")
        .update({
          lease_id: leaseId,
          attachment_status: "attached",
          property_id: lease.property_id || null,
          tenant_id: lease.tenant_id || null,
          property_label: property?.label || null,
          property_address_line1: property?.address_line1 || null,
          property_address_line2: property?.address_line2 || null,
          property_postal_code: property?.postal_code || null,
          property_city: property?.city || null,
          occupant_label: tenant?.full_name || null,
          occupant_email: tenant?.email || null,
          occupant_phone: tenant?.phone || null,
        })
        .eq("id", reportId)
        .eq("user_id", userId)
        .select("report_type")
        .single();
      if (error) throw error;

      // Un EDL libre rattaché après coup à un bail meublé n'a jamais pu recevoir
      // le préremplissage LMNP (aucun bien réel n'existait à sa création) — on le
      // fait maintenant, seulement s'il s'agit d'une entrée et qu'aucun élément
      // LMNP n'a déjà été ajouté (évite un double-préremplissage).
      let lmnpMessage = "";
      if (lease.property_id && updated?.report_type === "entry" && leaseRequiresLmnpInventory(lease, leases, properties)) {
        try {
          const { count } = await supabase
            .from("inventory_items")
            .select("id", { count: "exact", head: true })
            .eq("report_id", reportId)
            .eq("is_lmnp_required", true);
          if (!count) {
            const { itemsCreated } = await prefillLmnpItemsForEntry(lease.property_id, reportId, lease.lot_id);
            if (itemsCreated > 0) lmnpMessage = ` (${itemsCreated} élément(s) LMNP obligatoire(s) prérempli(s))`;
          }
        } catch (lmnpErr) {
          console.error(lmnpErr);
          // Non bloquant : le rattachement lui-même a réussi, seul le préremplissage a échoué.
        }
      }

      setSelectedLeaseId(leaseId);
      setAttachLeaseId("");
      await loadStandaloneReports();
      await loadReportsForLease(leaseId);
      await loadReportDetails(reportId);
      setSelectedReportId(reportId);
      setOk(`État des lieux rattaché au bail ✅${lmnpMessage}`);
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

  // Photo de compteur : stockée directement dans counters_json (clé `${key}_photo_path`),
  // pas via inventory_photos — cette table exige un item_id réel (observation de pièce),
  // ce qui ne correspond pas à un relevé de compteur. Le bucket storage accepte déjà
  // n'importe quel chemin sous `${userId}/...` (policy RLS basée sur le dossier, pas sur
  // l'existence d'un item), donc aucune migration n'est nécessaire.
  const uploadCounterPhoto = async (key: string, file: File, localPreviewUrl?: string) => {
    if (!supabase || !userId || !selectedReportId) return;
    if (isLocked) {
      setCounterPhotoFeedback((prev) => ({ ...prev, [key]: { tone: "error", message: "Ce document est verrouillé : les photos ne peuvent plus être modifiées." } }));
      return;
    }

    setCounterPhotoBusyKey(key);
    setCounterPhotoFeedback((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    const previousPath = String(counters[`${key}_photo_path`] || "") || null;
    let storagePath: string | null = null;
    try {
      const compressed = await compressObservationPhoto(file);
      storagePath = `${userId}/${selectedReportId}/counters/${key}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(storagePath, compressed, {
        cacheControl: "3600",
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      await updateCounterField(`${key}_photo_path`, storagePath);
      if (previousPath) await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove([previousPath]);

      setCounterPhotoFeedback((prev) => ({ ...prev, [key]: { tone: "success", message: "Photo du relevé ajoutée." } }));
    } catch (e: any) {
      if (storagePath) await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove([storagePath]);
      setCounterPhotoFeedback((prev) => ({ ...prev, [key]: { tone: "error", message: e?.message || "Impossible d’ajouter la photo." } }));
    } finally {
      setCounterPhotoBusyKey(null);
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setOptimisticCounterPhotoUrl((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }
  };

  const deleteCounterPhoto = async (key: string) => {
    if (!supabase) return;
    const path = String(counters[`${key}_photo_path`] || "");
    if (!path) return;
    if (isLocked) {
      setCounterPhotoFeedback((prev) => ({ ...prev, [key]: { tone: "error", message: "Ce document est verrouillé : les photos ne peuvent plus être modifiées." } }));
      return;
    }
    setCounterPhotoBusyKey(key);
    try {
      const { error: deleteFileError } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove([path]);
      if (deleteFileError) throw deleteFileError;
      await updateCounterField(`${key}_photo_path`, "");
      setCounterPhotoUrls((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setCounterPhotoFeedback((prev) => ({ ...prev, [key]: { tone: "success", message: "Photo supprimée." } }));
    } catch (e: any) {
      setCounterPhotoFeedback((prev) => ({ ...prev, [key]: { tone: "error", message: e?.message || "Impossible de supprimer la photo." } }));
    } finally {
      setCounterPhotoBusyKey(null);
    }
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

    setConfirmDeleteItemId(null);
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

  const uploadItemPhoto = async (itemId: string, file: File, localPreviewUrl?: string) => {
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
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setOptimisticItemPhotoUrl((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
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
    setConfirmDeletePhotoId(null);
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


  const handleSendToTenant = async () => {
    if (!selectedReport?.occupant_email || !selectedReport.pdf_url) return;
    if (!canShareDocuments) {
      setErr("Le partage de documents avec le locataire nécessite un abonnement lokt.one ou supérieur.");
      return;
    }
    setSendingTenant(true);
    setErr(null);
    try {
      const res = await fetch("/api/inventory/send-to-tenant", {
        method: "POST",
        headers: await authJsonHeaders(),
        body: JSON.stringify({
          reportId: selectedReport.id,
          userId,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Erreur d'envoi");
      setTenantEmailSent(selectedReport.occupant_email);
      setOk(`Email envoyé à ${selectedReport.occupant_email} ✅`);
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de l'envoi de l'email");
    } finally {
      setSendingTenant(false);
    }
  };

  const cancelEdlSignature = async () => {
    if (!sigEdlRequestId) return;
    setSigEdlCancelLoading(true); setSigEdlError(null);
    try {
      const res = await fetch("/api/signatures/cancel", {
        method: "POST",
        headers: await authJsonHeaders(),
        body: JSON.stringify({ id: sigEdlRequestId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Annulation impossible.");
      setSigEdlSent(false);
      setSigEdlRequestId(null);
      setSigEdlWarning(null);
      setOk("Demande de signature annulée ✅ Tu peux en renvoyer une nouvelle.");
    } catch (e: any) {
      setSigEdlError(e?.message || "Annulation impossible.");
    } finally {
      setSigEdlCancelLoading(false);
    }
  };

  const sendEdlForSignature = async () => {
    if (!selectedReport?.pdf_url || !effectiveTenantEmail) return;
    setSigEdlLoading(true); setSigEdlError(null); setSigEdlWarning(null);
    try {
      const { data: sessionData } = await supabase!.auth.getSession();
      const landlordEmail = sessionData.session?.user?.email;
      if (!landlordEmail) throw new Error("Session expirée. Reconnecte-toi.");
      const reportTypeLabel = selectedReport.report_type === "entry" ? "Entrée" : "Sortie";
      const address = [
        selectedReport.property_address_line1,
        selectedReport.property_city,
      ].filter(Boolean).join(", ");
      const documentLabel = `EDL ${reportTypeLabel} — ${selectedReport.occupant_label || effectiveTenantEmail}${address ? ` — ${address}` : ""}`;
      const res = await fetch("/api/signatures/create", {
        method: "POST",
        headers: await authJsonHeaders(),
        body: JSON.stringify({
          document_type: "edl",
          document_label: documentLabel,
          inventory_report_id: selectedReport.id,
          lease_id: selectedReport.lease_id,
          property_id: selectedLease?.property_id || null,
          original_pdf_url: selectedReport.pdf_url,
          landlord_email: landlordEmail,
          tenant_email: effectiveTenantEmail,
          tenant_name: selectedReport.occupant_label || effectiveTenantEmail,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // Déjà envoyé (ou demande bloquée) — on garde l'id pour permettre l'annulation.
        setSigEdlSent(true);
        if (json?.existingRequestId) setSigEdlRequestId(json.existingRequestId);
        return;
      }
      if (!res.ok) throw new Error(json?.error || "Erreur lors de l'envoi.");
      setSigEdlSent(true);
      if (json?.id) setSigEdlRequestId(json.id);
      if (json?.emailWarning) setSigEdlWarning(json.emailWarning);
    } catch (e: any) {
      setSigEdlError(e?.message || "Envoi impossible.");
    } finally {
      setSigEdlLoading(false);
    }
  };

  const uploadExternalPdf = async (type: "entry" | "exit", file: File, force = false) => {
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
    if (existing && !force) {
      setConfirmReplaceExternalPdf({ type, file });
      return;
    }
    setConfirmReplaceExternalPdf(null);

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

      if (existing?.pdf_url) {
        fetch("/api/inventory/cleanup-superseded-pdf", {
          method: "POST",
          headers,
          body: JSON.stringify({ userId, reportId, previousPdfUrl: existing.pdf_url }),
        }).catch(() => {
          // best-effort : un ancien PDF non nettoyé n'est qu'un espace de stockage perdu, pas une erreur bloquante.
        });
      }

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
      { label: "Signature électronique", done: selectedReport?.status === "signed" || selectedReport?.status === "archived" },
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

  // Nombre d'éléments LMNP déjà préremplis dans ce dossier — affiché comme
  // "endroit dédié" à l'inventaire LMNP sur l'écran de configuration.
  const editingReportLmnpItemsCount = useMemo(() => items.filter((it) => it.is_lmnp_required).length, [items]);

  // Total réel des obligations LMNP du bien (même source que la section
  // Inventaire) — sert à contextualiser la carte ci-dessous avec un "X sur Y",
  // pour ne pas laisser croire que le prérempli couvre toute l'obligation.
  const [lmnpTotalRequiredCount, setLmnpTotalRequiredCount] = useState(0);

  const activeOnlyLeases = useMemo(() => activeLeases.filter((l) => (l.status || "active") === "active"), [activeLeases]);
  const endedPendingLeases = useMemo(
    () =>
      activeLeases.filter((l) => {
        if (l.status !== "ended" || completedExitLeaseIds.has(l.id)) return false;
        // Un bien archivé = le bailleur a explicitement arrêté de le gérer (vendu,
        // repris...) : pas la peine de continuer à réclamer un EDL de sortie dessus.
        const property = propertyById.get(l.property_id);
        return isActivePropertyLike(property);
      }),
    [activeLeases, completedExitLeaseIds, propertyById]
  );
  // Tous les baux actifs, qu'ils aient déjà un dossier EDL ou non — cliquer un
  // bail ouvre le tableau de bord entrée/sortie, qui propose "Créer" ou
  // "Reprendre" selon le cas. Un seul point d'entrée pour choisir un bail
  // (auparavant : cette liste ne montrait que les baux avec dossier existant,
  // et un second sélecteur de bail redondant vivait dans le panneau de droite).
  // Les baux déjà comptabilisés dans "EDL de sortie à finaliser" sont exclus
  // pour ne pas les faire apparaître deux fois.
  const leaseStarterCards = useMemo(
    () => activeOnlyLeases.filter((l) => !endedPendingLeases.some((e) => e.id === l.id)).slice(0, 8),
    [activeOnlyLeases, endedPendingLeases]
  );

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
              {rep?.performed_at ? <Badge tone="slate">Date : {fmtDateFR(rep.performed_at)}</Badge> : null}
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
                            Gravité : {it.severity ?? 0}/3
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
  const [wizardStep, setWizardStep] = useState<WizardStep>("rooms");
  const [wizardReportId, setWizardReportId] = useState<string | null>(null);
  const [wizardRoomIndex, setWizardRoomIndex] = useState(0);

  // Pièces actuelles (DB) + sélection multiple (suppression)
  const [roomRows, setRoomRows] = useState<Array<{ id: string; name: string; key: RoomPresetKey; selected: boolean }>>([]);

  // Suggestions (ajout) — rien coché par défaut
  const [suggestedRooms, setSuggestedRooms] = useState<Array<{ tempId: string; name: string; key: RoomPresetKey; checked: boolean }>>([]);

  // Ajout manuel
  const [customRoomName, setCustomRoomName] = useState("");

  useEffect(() => {
    if (!supabase || !userId || wizardStep !== "config" || !selectedReport?.property_id) return;
    let cancelled = false;
    (async () => {
      const reportLease = safeLeases.find((l) => l.id === selectedReport.lease_id) || null;
      let query = supabase
        .from("property_inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("property_id", selectedReport.property_id)
        .eq("is_required_lmnp", true);
      query = reportLease?.lot_id ? query.eq("lot_id", reportLease.lot_id) : query.is("lot_id", null);
      const { count } = await query;
      if (!cancelled) setLmnpTotalRequiredCount(count || 0);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, selectedReport?.property_id, selectedReport?.lease_id, safeLeases, userId]);

  const wizardStepsMeta = useMemo(() => {
    return [
      { key: "intro" as const, label: "Bienvenue", desc: "Comment se déroule l'état des lieux" },
      { key: "config" as const, label: "Configuration du logement", desc: "Choisir les pièces à visiter" },
      { key: "rooms" as const, label: "Pièces & détails", desc: "Décrire chaque élément, pièce par pièce" },
      { key: "finalize" as const, label: "Finaliser", desc: "Générer le PDF et signer" },
    ];
  }, []);

  const wizardProgressPct = useMemo(() => {
    const idx = wizardStepsMeta.findIndex((x) => x.key === wizardStep);
    return Math.round(((idx + 1) / wizardStepsMeta.length) * 100);
  }, [wizardStep, wizardStepsMeta]);

  const openWizard = async (reportId: string, preferredStep?: WizardStep) => {
    // Vérifier le statut du rapport CIBLE, pas du rapport actuellement sélectionné.
    // isLocked dépend du rendu courant (stale closure) et est faux quand on vient de créer
    // un nouveau rapport (ex : EDL sortie) alors que l’EDL d’entrée signé était sélectionné.
    const targetReport = reports.find((r) => r.id === reportId);
    const targetIsLocked = targetReport
      ? targetReport.status === "signed" || targetReport.status === "archived"
      : false; // rapport pas encore en state = vient d’être créé = draft, pas verrouillé
    if (targetIsLocked) {
      setErr("Document verrouillé : l’assistant est désactivé.");
      return;
    }

    let startStep: WizardStep = preferredStep || "rooms";
    if (!preferredStep && supabase) {
      // Dossier vide (jamais aucune pièce) → écran d'accueil + configuration.
      // Dossier déjà entamé → on saute directement au détail des pièces.
      const { count } = await supabase
        .from("inventory_rooms")
        .select("id", { count: "exact", head: true })
        .eq("report_id", reportId);
      startStep = (count || 0) === 0 ? "intro" : "rooms";
    }

    setWizardReportId(reportId);
    setWizardOpen(true);
    setWizardStep(startStep);
    setWizardRoomIndex(0);
  };

  const closeWizard = async () => {
    setWizardOpen(false);
    setWizardReportId(null);
    setWizardStep("rooms");
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

  // Hydrate l'étape "config" (choix des pièces du logement)
  useEffect(() => {
    if (!wizardOpen) return;
    if (wizardStep !== "config") return;

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

  // Comparatif entrée/sortie : charge les éléments de l'EDL d'entrée en lecture
  // seule pour signaler, sur chaque élément de l'EDL de sortie, une dégradation
  // par rapport à l'état constaté à l'entrée — sans dupliquer ni modifier les
  // données d'entrée.
  const [entryComparisonMap, setEntryComparisonMap] = useState<Map<string, InventoryItem["condition"]>>(new Map());

  const entryComparisonKey = (roomName: string, category: string, label: string) =>
    `${(roomName || "").trim().toLowerCase()}|${(category || "").trim().toLowerCase()}|${(label || "").trim().toLowerCase()}`;

  useEffect(() => {
    if (!supabase) return;
    if (!wizardOpen || selectedReport?.report_type !== "exit" || !entryReport?.id) {
      setEntryComparisonMap(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: entryRooms }, { data: entryItems }] = await Promise.all([
        supabase.from("inventory_rooms").select("id, name").eq("report_id", entryReport.id),
        supabase.from("inventory_items").select("room_id, category, label, condition").eq("report_id", entryReport.id),
      ]);
      if (cancelled) return;
      const roomNameById = new Map((entryRooms || []).map((r: any) => [r.id, r.name]));
      const map = new Map<string, InventoryItem["condition"]>();
      for (const it of entryItems || []) {
        const roomName = roomNameById.get((it as any).room_id) || "";
        map.set(entryComparisonKey(roomName, (it as any).category, (it as any).label), (it as any).condition);
      }
      setEntryComparisonMap(map);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardOpen, selectedReport?.report_type, entryReport?.id]);

  const CONDITION_RANK: Record<InventoryItem["condition"], number> = {
    neuf: 0,
    tres_bon: 1,
    bon: 2,
    moyen: 3,
    mauvais: 4,
  };

  const degradedItemsCount = useMemo(() => {
    if (selectedReport?.report_type !== "exit" || !entryComparisonMap.size) return 0;
    const roomNameById = new Map((rooms || []).map((r) => [r.id, r.name]));
    let count = 0;
    for (const it of items) {
      const roomName = roomNameById.get(it.room_id || "") || "";
      const entryCondition = entryComparisonMap.get(entryComparisonKey(roomName, it.category, it.label));
      if (entryCondition && CONDITION_RANK[it.condition] > CONDITION_RANK[entryCondition]) count++;
    }
    return count;
  }, [items, rooms, entryComparisonMap, selectedReport?.report_type]);

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

    setConfirmDeleteRoomsOpen(false);
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
    } catch (e: any) {
      setErr(e?.message || "Impossible de supprimer les pièces.");
    } finally {
      setLoading(false);
    }
  };

  const applyAddSuggestions = async () => {
    const reportId = wizardReportId || selectedReportId;
    if (!supabase || !reportId) return;
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

      const toInsert = toAdd.filter((r) => !existingNames.has(r.name.trim().toLowerCase()));
      const payload = toInsert.map((r, idx) => ({
        report_id: reportId,
        name: r.name.trim(),
        floor_level: null,
        notes: null,
        sort_order: rooms.length + idx,
      }));

      if (!payload.length) {
        setOk("Toutes ces pièces existent déjà (pas de doublons).");
        return;
      }

      const { data: inserted, error } = await supabase.from("inventory_rooms").insert(payload).select("*");
      if (error) throw error;

      // Checklist standard préremplie pour chaque pièce ajoutée, plutôt que
      // de demander au bailleur de construire la liste lui-même sur place.
      const itemPayloads = (inserted || []).flatMap((room: any, idx: number) => {
        const key = toInsert[idx]?.key || guessPresetKeyFromRoomName(room.name);
        return templateItemsForRoomKey(key).map((t) => ({
          report_id: reportId,
          room_id: room.id,
          category: t.category,
          label: t.label,
          condition: "bon" as const,
          wear_level: 1,
          description: "",
          defect_tags: [],
          is_clean: true,
          is_functional: true,
          recommended_action: null,
          estimated_cost: null,
          severity: 0,
        }));
      });
      if (itemPayloads.length) {
        const { error: eItems } = await supabase.from("inventory_items").insert(itemPayloads);
        if (eItems) throw eItems;
      }

      setOk(`${(inserted || []).length} pièce(s) ajoutée(s) ✅ (checklist préremplie)`);
      await loadReportDetails(reportId);
    } catch (e: any) {
      setErr(e?.message || "Impossible d’ajouter les pièces.");
    } finally {
      setLoading(false);
    }
  };

  const addCustomRoom = async () => {
    const reportId = wizardReportId || selectedReportId;
    if (!supabase || !reportId) return;
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
      const { data: inserted, error } = await supabase.from("inventory_rooms").insert({
        report_id: reportId,
        name,
        floor_level: null,
        notes: null,
        sort_order: rooms.length,
      }).select("*").single();
      if (error) throw error;

      const key = guessPresetKeyFromRoomName(name);
      const itemPayloads = templateItemsForRoomKey(key).map((t) => ({
        report_id: reportId,
        room_id: (inserted as any).id,
        category: t.category,
        label: t.label,
        condition: "bon" as const,
        wear_level: 1,
        description: "",
        defect_tags: [],
        is_clean: true,
        is_functional: true,
        recommended_action: null,
        estimated_cost: null,
        severity: 0,
      }));
      if (itemPayloads.length) {
        const { error: eItems } = await supabase.from("inventory_items").insert(itemPayloads);
        if (eItems) throw eItems;
      }

      setCustomRoomName("");
      setOk("Pièce ajoutée ✅ (checklist préremplie)");
      await loadReportDetails(reportId);
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

  const roomHasCategoryLabel = (roomId: string, category: string, label: string) => {
    const wantedCategory = category.trim().toLowerCase();
    const wantedLabel = label.trim().toLowerCase();
    return (itemsByRoomId.get(roomId) || []).some(
      (it) => (it.category || "").trim().toLowerCase() === wantedCategory && (it.label || "").trim().toLowerCase() === wantedLabel
    );
  };

  const missingTemplateItemsForRoom = (roomId: string, key: RoomPresetKey) =>
    templateItemsForRoomKey(key).filter((t) => !roomHasCategoryLabel(roomId, t.category, t.label));

  const markCurrentRoomOk = async () => {
    if (!currentRoom || isLocked) return;
    const missing = missingTemplateItemsForRoom(currentRoom.id, wizardRoomKey);
    if (!missing.length) {
      setOk("Cette pièce possède déjà la checklist standard.");
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
    if (wizardStep === "rooms") return setWizardStep("config");
    if (wizardStep === "config") return setWizardStep("intro");
  };

  const goNextWizard = async () => {
    if (wizardStep === "intro") {
      setWizardStep("config");
      return;
    }
    if (wizardStep === "config") {
      if (!rooms.length) {
        setErr("Ajoute au moins une pièce avant de continuer.");
        return;
      }
      setErr(null);
      setWizardStep("rooms");
      return;
    }
    if (wizardStep === "rooms") {
      if (!rooms.length) {
        setErr("Ajoute au moins une pièce avant de continuer.");
        return;
      }
      setErr(null);
      setWizardStep("finalize");
      return;
    }
  };

  const wizardRoomKey = useMemo(() => {
    if (!currentRoom) return "sejour" as RoomPresetKey;
    return guessPresetKeyFromRoomName(currentRoom.name);
  }, [currentRoom]);

  const currentRoomMissingTemplateCount = useMemo(() => {
    if (!currentRoom) return 0;
    return missingTemplateItemsForRoom(currentRoom.id, wizardRoomKey).length;
  }, [currentRoom, wizardRoomKey, itemsByRoomId]);

  const handleSyncLmnpFromExit = async () => {
    if (!selectedReport?.property_id) return;
    const roomNameById = new Map(rooms.map((r) => [r.id, r.name]));
    const lmnpItemsInReport = items
      .filter((it) => it.is_lmnp_required)
      .map((it) => ({ ...it, roomName: it.room_id ? roomNameById.get(it.room_id) || null : null }));
    if (!lmnpItemsInReport.length) return;
    setLmnpSyncLoading(true);
    setErr(null);
    try {
      const reportLease = safeLeases.find((l) => l.id === selectedReport.lease_id) || null;
      const { updated } = await syncLmnpInventoryFromExit(selectedReport.property_id, lmnpItemsInReport, reportLease?.lot_id);
      setOk(`Inventaire LMNP mis à jour ✅ (${updated} élément(s))`);
      setLmnpSyncDone(true);
    } catch (e: any) {
      setErr(e?.message || "Impossible de mettre à jour l'inventaire LMNP.");
    } finally {
      setLmnpSyncLoading(false);
    }
  };

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
      setErr("Renseigne la date et l'heure dans la dernière étape \"Finaliser\" avant de générer le PDF.");
      return;
    }
    const finalPlace = (selectedReport.performed_place || "").trim() || defaultReportPlace;
    if (!finalPlace) {
      setErr(
        "Renseigne le champ \"Lieu de signature / visite\" dans la dernière étape \"Finaliser\". C'est l'adresse où l'état des lieux est réalisé, par exemple : 12 rue Victor Hugo, 75000 Paris."
      );
      return;
    }
    if (!rooms.length) {
      setErr("Ajoute au moins une pièce avant de finaliser l’état des lieux.");
      return;
    }

    setConfirmFinalizeEmptyRooms(false);
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
  const [addDraftForceDetail, setAddDraftForceDetail] = useState(false);
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
    setAddDraftForceDetail(false);
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

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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

              {/* STEP: INTRO */}
              {wizardStep === "intro" ? (
                <div className="mx-auto max-w-2xl space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-indigo-600">Comment ça se passe</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">Un état des lieux, pièce par pièce</h3>
                    <ol className="mt-4 space-y-3 text-sm text-slate-700">
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">1</span>
                        <span>Choisis les pièces du logement (salon, cuisine, chambres...) — on te propose une liste, modifiable à tout moment.</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">2</span>
                        <span>Chaque pièce arrive avec une checklist déjà remplie (sol, mur, plafond, équipements...) — tu ajustes seulement ce qui n'est pas en bon état.</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">3</span>
                        <span>Une fois toutes les pièces passées en revue, tu génères le PDF officiel.</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">4</span>
                        <span>Tu peux ensuite l'envoyer en signature électronique au locataire, si besoin.</span>
                      </li>
                    </ol>
                  </div>
                </div>
              ) : null}

              {/* STEP: CONFIG (choix des pièces du logement) */}
              {wizardStep === "config" ? (
                <div className="space-y-4">
                  {editingReportLmnpItemsCount > 0 && (
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                      <p className="text-sm font-semibold text-indigo-900">
                        Inventaire LMNP : {editingReportLmnpItemsCount}
                        {lmnpTotalRequiredCount > 0 ? ` sur ${lmnpTotalRequiredCount}` : ""} élément(s) obligatoire(s) déjà repris dans cet EDL
                      </p>
                      <p className="mt-1 text-xs text-indigo-700">
                        {lmnpTotalRequiredCount > editingReportLmnpItemsCount
                          ? `${lmnpTotalRequiredCount - editingReportLmnpItemsCount} élément(s) obligatoire(s) de l'inventaire LMNP ne sont pas (ou plus) dans cet EDL — vérifie les pièces concernées.`
                          : "Ajoutés automatiquement depuis l'inventaire LMNP du bien, dans les pièces correspondantes."}
                      </p>
                      {onNavigateToInventaire && (
                        <button
                          type="button"
                          onClick={onNavigateToInventaire}
                          className="mt-2 text-xs font-semibold text-indigo-700 underline hover:text-indigo-900"
                        >
                          Voir l'inventaire LMNP →
                        </button>
                      )}
                    </div>
                  )}
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
                              onClick={() => setConfirmDeleteRoomsOpen(true)}
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              Supprimer la sélection
                            </button>
                          </div>

                          {selectedRoomsCount > 0 ? (
                            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                              {confirmDeleteRoomsOpen ? (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold">Supprimer {selectedRoomsCount} pièce(s) et {selectedItemsCount} élément(s) ?</span>
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => void deleteSelectedRooms()} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500">Oui</button>
                                    <button type="button" onClick={() => setConfirmDeleteRoomsOpen(false)} className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50">Non</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span className="font-semibold">Impact :</span> {selectedRoomsCount} pièce(s) et{" "}
                                  <span className="font-semibold">{selectedItemsCount}</span> élément(s) seront supprimés.
                                </>
                              )}
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

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">{suggestedRooms.filter((x) => x.checked).length} cochée(s)</span>
                        <button
                          type="button"
                          disabled={loading || isLocked || suggestedRooms.every((x) => !x.checked)}
                          onClick={applyAddSuggestions}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Ajouter les pièces cochées →
                        </button>
                      </div>

                      <div className="mt-3 space-y-2 max-h-[360px] overflow-auto pr-1" style={{ overflowAnchor: "none" }}>
                        {suggestedRooms.map((s) => (
                          <label key={s.tempId} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 cursor-pointer">
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
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-900">Tip</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Tu peux revenir ici à tout moment : <span className="font-semibold">rien ne s’efface</span>.
                      </p>
                    </div>
                  </div>
                </div>
                </div>
              ) : null}

              {/* STEP: ROOMS (détail pièce par pièce, navigation par onglets) */}
              {wizardStep === "rooms" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Progression</p>
                      <span className="text-xs font-semibold text-slate-700">{roomsCompletionPct}% pièces avec au moins 1 élément</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${roomsCompletionPct}%` }} />
                    </div>
                  </div>

                  {/* Onglets pièces */}
                  <div className="flex flex-wrap gap-2" style={{ overflowAnchor: "none" }}>
                    {rooms.map((r, idx) => {
                      const active = idx === wizardRoomIndex;
                      const tone = roomCompletionBadgeTone(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => preserveWizardScroll(() => setWizardRoomIndex(idx))}
                          className={cx(
                            "rounded-full border px-4 py-2 text-sm font-semibold transition",
                            active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {r.name}
                          <span className={cx("ml-2 inline-block h-1.5 w-1.5 rounded-full align-middle", active ? "bg-white/70" : tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-slate-300")} />
                        </button>
                      );
                    })}
                    {!rooms.length ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                        Aucune pièce. Reviens à l'étape précédente pour en ajouter.
                      </div>
                    ) : null}
                  </div>

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

                              <div className="mt-4">
                                <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-start">
                                  {currentRoomMissingTemplateCount > 0 && (
                                    <div>
                                      <button
                                        type="button"
                                        disabled={loading || isLocked}
                                        onClick={markCurrentRoomOk}
                                        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto sm:rounded-full sm:text-xs"
                                      >
                                        <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
                                        Tout est en bon état
                                      </button>
                                      <p className="mt-1 text-[0.68rem] text-slate-500">
                                        Ajoute {currentRoomMissingTemplateCount} élément(s) standard de cette pièce (sol, murs...), tous en bon état.
                                      </p>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openAddForRoom(currentRoom.id)}
                                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:rounded-full sm:text-xs"
                                  >
                                    <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                                    Ajouter un élément
                                  </button>
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

                            <div className="space-y-1">
                              <label className="text-[0.7rem] text-slate-700">État</label>
                              <ConditionTapButtons
                                value={addDraft.condition}
                                onChange={(v) =>
                                  preserveWizardScroll(() =>
                                    setAddDraft((s) => ({
                                      ...s,
                                      condition: v,
                                      severity: CONDITION_NEEDS_DETAIL[v] ? Math.max(s.severity ?? 0, 3) : 0,
                                    }))
                                  )
                                }
                              />
                            </div>

                            {!(CONDITION_NEEDS_DETAIL[addDraft.condition] || addDraftForceDetail) ? (
                              <button
                                type="button"
                                onClick={() => setAddDraftForceDetail(true)}
                                className="text-xs font-semibold text-slate-600 underline"
                              >
                                + Ajouter usure, propreté ou note
                              </button>
                            ) : (
                              <>
                                <div className="grid gap-3 sm:grid-cols-2">
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
                                    <label className="text-[0.7rem] text-slate-700">Gravité (0–3)</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={3}
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

                                <p className="text-[0.7rem] text-slate-500">
                                  Les photos pourront être ajoutées juste après, depuis la fiche de l'élément.
                                </p>
                              </>
                            )}
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
                              Aucun élément encore. Clique sur "+ Ajouter un élément" ou utilise les boutons structure.
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
                                      {selectedReport?.report_type === "exit" && currentRoom && (() => {
                                        const entryCondition = entryComparisonMap.get(
                                          entryComparisonKey(currentRoom.name, it.category, it.label)
                                        );
                                        if (!entryCondition || entryCondition === it.condition) return null;
                                        const degraded = CONDITION_RANK[it.condition] > CONDITION_RANK[entryCondition];
                                        const entryLabel = conditionOptions.find((x) => x.v === entryCondition)?.label || entryCondition;
                                        return (
                                          <p className={cx("mt-1.5 text-[0.7rem] font-semibold", degraded ? "text-red-700" : "text-emerald-700")}>
                                            {degraded ? "⚠ Dégradation" : "Amélioration"} depuis l'entrée : {entryLabel} → {conditionOptions.find((x) => x.v === it.condition)?.label || it.condition}
                                          </p>
                                        );
                                      })()}
                                    </div>

                                    {confirmDeleteItemId === it.id ? (
                                      <div className="flex shrink-0 items-center gap-1">
                                        <button type="button" onClick={() => void deleteItem(it.id)} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500">Oui</button>
                                        <button type="button" onClick={() => setConfirmDeleteItemId(null)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Non</button>
                                      </div>
                                    ) : (
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => toggleItemExpanded(it.id)}
                                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                          {expandedItemIds[it.id] ? "Réduire" : "Modifier"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteItemId(it.id)}
                                          className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                                        >
                                          Supprimer
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {expandedItemIds[it.id] && (
                                  <>
                                  <div className="space-y-1">
                                    <label className="text-[0.7rem] text-slate-700">État</label>
                                    <ConditionTapButtons
                                      value={it.condition}
                                      onChange={(v) =>
                                        preserveWizardScroll(() =>
                                          updateItem(it.id, {
                                            condition: v,
                                            severity: CONDITION_NEEDS_DETAIL[v] ? Math.max(it.severity ?? 0, 3) : 0,
                                          })
                                        )
                                      }
                                    />
                                  </div>

                                  {!(CONDITION_NEEDS_DETAIL[it.condition] || forcedDetailItemIds[it.id]) ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        preserveWizardScroll(() => setForcedDetailItemIds((prev) => ({ ...prev, [it.id]: true })))
                                      }
                                      className="text-xs font-semibold text-slate-600 underline"
                                    >
                                      + Ajouter usure, propreté, note ou photo
                                    </button>
                                  ) : (
                                  <>
                                  <div className="grid gap-2 sm:grid-cols-2">
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

                                    {(photosByItemId.get(it.id) || []).length || optimisticItemPhotoUrl[it.id] ? (
                                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {optimisticItemPhotoUrl[it.id] ? (
                                          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                            <img src={optimisticItemPhotoUrl[it.id]} alt="Envoi en cours" className="aspect-[4/3] w-full object-cover opacity-60" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            </div>
                                          </div>
                                        ) : null}
                                        {(photosByItemId.get(it.id) || []).map((photo) => (
                                          <div key={photo.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                            {photo.preview_url ? (
                                              <img src={photo.preview_url} alt="Observation" className="aspect-[4/3] w-full object-cover" />
                                            ) : (
                                              <div className="flex aspect-[4/3] items-center justify-center text-xs text-slate-500">Aperçu indisponible</div>
                                            )}
                                            {confirmDeletePhotoId === photo.id ? (
                                              <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                                                <button type="button" onClick={() => void deleteItemPhoto(photo)} className="rounded-full bg-red-600 px-2 py-1 text-[0.65rem] font-semibold text-white hover:bg-red-500">Oui</button>
                                                <button type="button" onClick={() => setConfirmDeletePhotoId(null)} className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[0.65rem] font-semibold text-slate-700 hover:bg-slate-50">Non</button>
                                              </div>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => setConfirmDeletePhotoId(photo.id)}
                                                disabled={isLocked || photoBusyItemId === it.id}
                                                className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/95 text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
                                                title="Supprimer la photo"
                                                aria-label="Supprimer la photo"
                                              >
                                                <TrashIcon className="h-4 w-4" aria-hidden="true" />
                                              </button>
                                            )}
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
                                            if (file) {
                                              const localUrl = URL.createObjectURL(file);
                                              setOptimisticItemPhotoUrl((prev) => ({ ...prev, [it.id]: localUrl }));
                                              void uploadItemPhoto(it.id, file, localUrl);
                                            }
                                          }}
                                        />
                                      </label>
                                    ) : null}
                                  </div>
                                  </>
                                  )}
                                  </>
                                  )}
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
                        Clique sur <span className="font-semibold">"Finaliser & générer le PDF"</span> : tu obtiens un PDF à{" "}
                        <span className="font-semibold">imprimer</span> et faire signer.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="emerald">Complétude : {completeness}%</Badge>
                        <Badge tone="slate">{rooms.length} pièce(s)</Badge>
                        <Badge tone="slate">{items.length} élément(s)</Badge>
                        {degradedItemsCount > 0 && (
                          <Badge tone="red">⚠ {degradedItemsCount} dégradation(s) vs entrée</Badge>
                        )}
                      </div>

                      {selectedReport?.report_type === "exit" && (() => {
                        const lmnpItemsInReport = items.filter((it) => it.is_lmnp_required);
                        if (!lmnpItemsInReport.length) return null;
                        const lmnpDegraded = lmnpItemsInReport.filter((it) => it.condition === "mauvais");
                        const canSync = selectedReport.status === "ready" || selectedReport.status === "signed" || selectedReport.status === "archived";
                        return (
                          <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                            <p className="text-xs font-semibold text-indigo-900">
                              Inventaire LMNP : {lmnpItemsInReport.length} élément(s) obligatoire(s) suivi(s) dans cet EDL
                              {lmnpDegraded.length > 0 ? ` — ${lmnpDegraded.length} en mauvais état` : ""}
                            </p>
                            {lmnpDegraded.length > 0 && (
                              <p className="mt-1 text-[0.7rem] text-indigo-700">
                                {lmnpDegraded.map((it) => it.label).join(", ")}
                              </p>
                            )}
                            {canSync && (
                              <button
                                type="button"
                                disabled={lmnpSyncLoading || lmnpSyncDone}
                                onClick={() => void handleSyncLmnpFromExit()}
                                className="mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
                              >
                                {lmnpSyncDone ? "Inventaire LMNP mis à jour ✓" : lmnpSyncLoading ? "Mise à jour…" : "Mettre à jour l'inventaire LMNP depuis cet EDL →"}
                              </button>
                            )}
                          </div>
                        );
                      })()}

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
                            <p className="text-[0.68rem] text-slate-500 mt-0.5">Index relevé au moment de la visite</p>
                            <div className="mt-2 grid gap-3 sm:grid-cols-3">
                              {[
                                ["electricity", "Électricité", "Ex : 12 345 kWh"],
                                ["water", "Eau", "Ex : 1 234 m³"],
                                ["gas", "Gaz", "Ex : 456 m³"],
                              ].map(([key, label, placeholder]) => {
                                const photoPath = String(counters[`${key}_photo_path`] || "");
                                const photoUrl = counterPhotoUrls[key];
                                const busy = counterPhotoBusyKey === key;
                                const feedback = counterPhotoFeedback[key];
                                return (
                                  <div key={key} className="space-y-1">
                                    <label className="text-[0.7rem] text-slate-700">{label}</label>
                                    <input
                                      disabled={isLocked}
                                      value={String(counters[key] || "")}
                                      onChange={(e) => updateCounterField(key, e.target.value)}
                                      placeholder={placeholder}
                                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                                    />
                                    {photoPath ? (
                                      <div className="flex items-center gap-2">
                                        {photoUrl ? (
                                          <a href={photoUrl} target="_blank" rel="noreferrer">
                                            <img src={photoUrl} alt={`Photo compteur ${label}`} className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                                          </a>
                                        ) : (
                                          <div className="h-12 w-12 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
                                        )}
                                        {!isLocked ? (
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void deleteCounterPhoto(key)}
                                            className="text-[0.68rem] font-semibold text-red-600 hover:underline disabled:opacity-50"
                                          >
                                            Supprimer la photo
                                          </button>
                                        ) : null}
                                      </div>
                                    ) : optimisticCounterPhotoUrl[key] ? (
                                      <div className="relative inline-block h-12 w-12 overflow-hidden rounded-lg border border-slate-200">
                                        <img src={optimisticCounterPhotoUrl[key]} alt="Envoi en cours" className="h-full w-full object-cover opacity-60" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        </div>
                                      </div>
                                    ) : !isLocked ? (
                                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1.5 text-[0.68rem] font-semibold text-slate-700 hover:bg-slate-50">
                                        <PhotoIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                        {busy ? "Envoi..." : "Photo du relevé"}
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp"
                                          capture="environment"
                                          disabled={busy}
                                          className="sr-only"
                                          onChange={(e) => {
                                            const file = e.currentTarget.files?.[0];
                                            e.currentTarget.value = "";
                                            if (file) {
                                              const localUrl = URL.createObjectURL(file);
                                              setOptimisticCounterPhotoUrl((prev) => ({ ...prev, [key]: localUrl }));
                                              void uploadCounterPhoto(key, file, localUrl);
                                            }
                                          }}
                                        />
                                      </label>
                                    ) : null}
                                    {feedback ? (
                                      <p className={`text-[0.65rem] ${feedback.tone === "error" ? "text-red-600" : "text-emerald-600"}`}>{feedback.message}</p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-900">Remise des accès</p>
                            <p className="text-[0.68rem] text-slate-500 mt-0.5">Quantités remises au locataire</p>
                            <div className="mt-2 grid gap-3 sm:grid-cols-3">
                              {[
                                ["keys", "Clés", "Ex : 2 jeux"],
                                ["badges", "Badges", "Ex : 1 badge"],
                                ["remotes", "Télécommandes", "Ex : 1 télécommande"],
                              ].map(([key, label, placeholder]) => (
                                <div key={key} className="space-y-1">
                                  <label className="text-[0.7rem] text-slate-700">{label}</label>
                                  <input
                                    disabled={isLocked}
                                    value={String(counters[key] || "")}
                                    onChange={(e) => updateCounterField(key, e.target.value)}
                                    placeholder={placeholder}
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

                      {hasPdf ? (
                        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                          <p className="text-xs font-semibold text-emerald-900">PDF généré ✅</p>
                          <p className="mt-1 text-xs text-emerald-800">
                            Tu peux l'ouvrir, le télécharger, ou l'envoyer directement en signature électronique.
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={loading}
                              onClick={openPdf}
                              className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                            >
                              Ouvrir le PDF
                            </button>
                            {!isLocked && effectiveTenantEmail ? (
                              sigEdlSent ? (
                                <>
                                  <span className="inline-flex min-h-[40px] items-center rounded-full border border-emerald-200 bg-white px-4 text-xs font-semibold text-emerald-800">
                                    Liens de signature envoyés ✓
                                  </span>
                                  {sigEdlRequestId && (
                                    <button
                                      type="button"
                                      disabled={sigEdlCancelLoading}
                                      onClick={cancelEdlSignature}
                                      className="text-xs font-semibold text-slate-500 underline hover:text-slate-700 disabled:opacity-60"
                                    >
                                      {sigEdlCancelLoading ? "Annulation…" : "Annuler la demande"}
                                    </button>
                                  )}
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={sigEdlLoading}
                                  onClick={sendEdlForSignature}
                                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-[#635bff]/30 bg-white px-4 text-xs font-semibold text-[#635bff] hover:bg-[#635bff]/10 disabled:opacity-60"
                                >
                                  {sigEdlLoading ? "Envoi…" : "Signature électronique →"}
                                </button>
                              )
                            ) : null}
                          </div>
                          {sigEdlWarning ? <p className="mt-2 text-xs text-amber-700">⚠ {sigEdlWarning}</p> : null}
                          {sigEdlError ? <p className="mt-2 text-xs text-red-600">{sigEdlError}</p> : null}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                          <p className="text-xs font-semibold text-slate-900">Signature électronique</p>
                          <p className="mt-1 text-xs text-slate-700">
                            Disponible juste après avoir généré le PDF ci-dessous.
                          </p>
                        </div>
                      )}
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
                  disabled={loading || wizardStep === "intro"}
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
                      {wizardStep === "intro" ? "Commencer →" : wizardStep === "config" ? "Continuer →" : "Finaliser →"}
                    </button>
                  ) : hasPdf ? (
                    <button
                      type="button"
                      onClick={closeWizard}
                      className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:min-h-0 sm:rounded-full sm:text-xs"
                    >
                      Fermer
                    </button>
                  ) : confirmFinalizeEmptyRooms ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-700">{rooms.filter((r) => !(itemsByRoomId.get(r.id) || []).length).length} pièce(s) sans relevé. Finaliser quand même ?</span>
                      <button type="button" onClick={() => void finalizeToReady()} className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 sm:min-h-0 sm:rounded-full sm:text-xs">Oui</button>
                      <button type="button" onClick={() => setConfirmFinalizeEmptyRooms(false)} className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 sm:min-h-0 sm:rounded-full sm:text-xs">Non</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={loading || isLocked}
                      onClick={() => {
                        const emptyRooms = rooms.filter((r) => !(itemsByRoomId.get(r.id) || []).length);
                        if (emptyRooms.length) { setConfirmFinalizeEmptyRooms(true); return; }
                        void finalizeToReady();
                      }}
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

      {!selectedLeaseId && !selectedReportId && (
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 p-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
            <FolderOpenIcon className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-indigo-950">Choisir le dossier</p>
            <p className="mt-0.5 text-xs leading-4 text-indigo-900/60">Bail actif, état des lieux existant ou dossier libre si la location n’est pas encore rattachée.</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl bg-violet-50 p-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100">
            <ClipboardDocumentListIcon className="h-4 w-4 text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-violet-950">Faire la visite</p>
            <p className="mt-0.5 text-xs leading-4 text-violet-900/60">Pièces, équipements, compteurs, clés, photos et observations.</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 p-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <DocumentCheckIcon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-950">Finaliser le document</p>
            <p className="mt-0.5 text-xs leading-4 text-emerald-900/60">Générez ou importez le PDF. Une fois signé ou archivé, il est verrouillé.</p>
          </div>
        </div>
      </div>
      )}

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

              {(selectedLeaseId || selectedReportId) && creationWizardStep === null ? (
                <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">
                        {selectedLeaseId ? "Bail sélectionné" : "État des lieux libre"}
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-slate-950">{selectedContextLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedLeaseId(""); setSelectedReportId(null); resetCreationWizard(); }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      Revenir à la liste
                    </button>
                  </div>

                  {/* Alerte bail terminé sans sortie */}
                  {selectedLeaseId && leaseEnded && !exitReport && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <p className="text-xs leading-5 text-amber-800">
                        Ce bail est <strong>terminé</strong> — l'état des lieux de sortie n'a pas encore été créé.{" "}
                        <button type="button" onClick={() => startWizardStep3("exit")} className="font-semibold underline hover:no-underline">
                          Créer la sortie →
                        </button>
                      </p>
                    </div>
                  )}

                  {/* Dashboard entrée / sortie */}
                  {selectedLeaseId && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {/* Carte entrée */}
                      <div className={cx(
                        "rounded-xl border p-3",
                        entryReport ? (entryReport.status === "signed" || entryReport.status === "archived" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50") : "border-slate-200 bg-slate-50"
                      )}>
                        <p className="text-[0.62rem] font-semibold uppercase tracking-widest text-slate-500">Entrée</p>
                        {entryReport ? (
                          <>
                            <p className={cx("mt-1 text-sm font-semibold", entryReport.status === "signed" || entryReport.status === "archived" ? "text-emerald-900" : "text-amber-900")}>
                              {statusUi(entryReport.status).label}
                            </p>
                            {entryReport.performed_at && (
                              <p className="text-xs text-slate-500">Le {fmtDateFR(entryReport.performed_at)}</p>
                            )}
                            {entryReport.document_source === "external" && (
                              <span className="mt-0.5 inline-block text-xs text-slate-500">PDF externe</span>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {entryReport.status !== "signed" && entryReport.status !== "archived" ? (
                                <button
                                  type="button"
                                  onClick={() => { setSelectedReportId(entryReport.id); openWizard(entryReport.id, (entryReport.status === "ready" || !!entryReport.pdf_url) ? "finalize" : undefined); }}
                                  className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                                >
                                  {(entryReport.status === "ready" || !!entryReport.pdf_url) ? "Finaliser →" : "Reprendre la saisie →"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => { setSelectedReportId(entryReport.id); setViewOpen(true); }}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Consulter
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="mt-1 text-sm font-semibold text-slate-400">Non créé</p>
                            <button type="button" onClick={() => startWizardStep3("entry")}
                              className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                              Créer l'entrée →
                            </button>
                          </>
                        )}
                      </div>

                      {/* Carte sortie */}
                      <div className={cx(
                        "rounded-xl border p-3",
                        exitReport ? (exitReport.status === "signed" || exitReport.status === "archived" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")
                          : leaseEnded ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-slate-50"
                      )}>
                        <p className="text-[0.62rem] font-semibold uppercase tracking-widest text-slate-500">Sortie</p>
                        {exitReport ? (
                          <>
                            <p className={cx("mt-1 text-sm font-semibold", exitReport.status === "signed" || exitReport.status === "archived" ? "text-emerald-900" : "text-amber-900")}>
                              {statusUi(exitReport.status).label}
                            </p>
                            {exitReport.performed_at && (
                              <p className="text-xs text-slate-500">Le {fmtDateFR(exitReport.performed_at)}</p>
                            )}
                            {exitReport.document_source === "external" && (
                              <span className="mt-0.5 inline-block text-xs text-slate-500">PDF externe</span>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {exitReport.status !== "signed" && exitReport.status !== "archived" ? (
                                <button
                                  type="button"
                                  onClick={() => { setSelectedReportId(exitReport.id); openWizard(exitReport.id, (exitReport.status === "ready" || !!exitReport.pdf_url) ? "finalize" : undefined); }}
                                  className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                                >
                                  {(exitReport.status === "ready" || !!exitReport.pdf_url) ? "Finaliser →" : "Reprendre la saisie →"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => { setSelectedReportId(exitReport.id); setViewOpen(true); }}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Consulter
                              </button>
                            </div>
                          </>
                        ) : !entryReport ? (
                          <p className="mt-1 text-xs text-slate-400">Entrée requise d'abord</p>
                        ) : (
                          <>
                            <p className={cx("mt-1 text-sm font-semibold", leaseEnded ? "text-amber-700" : "text-slate-400")}>
                              {leaseEnded ? "Manquante" : "Non créée"}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {leaseEnded ? "Bail terminé — à traiter" : "Bail en cours"}
                            </p>
                            <button type="button" onClick={() => startWizardStep3("exit")}
                              className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                              Créer la sortie →
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* EDL libre (sans bail) */}
                  {!selectedLeaseId && selectedReport && (
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="slate">{reports.length} état(s) des lieux</Badge>
                      <Badge tone={statusUi(selectedReport.status).tone}>{statusUi(selectedReport.status).label}</Badge>
                      {hasPdf ? <Badge tone="emerald">PDF disponible</Badge> : null}
                    </div>
                  )}
                </div>
              ) : creationWizardStep !== null ? null : leaseStarterCards.length || endedPendingLeases.length ? (
                <>
                  {leaseStarterCards.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Choisir un bail</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {leaseStarterCards.map((l) => {
                          const hasDossier = leaseIdsWithReport.has(l.id);
                          const isDelegatedEdl = !!propertyById.get(l.property_id)?.delegated_services?.includes("bail_edl");
                          return (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => setSelectedLeaseId(l.id)}
                              className="group min-h-[72px] rounded-2xl border border-slate-200 bg-white/90 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#635bff]/30 hover:shadow-md"
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="block text-sm font-semibold text-slate-950">{leaseLabel(l)}</span>
                                {isDelegatedEdl && !hasDossier && (
                                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-700">
                                    Agence
                                  </span>
                                )}
                              </span>
                              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#635bff]">
                                {hasDossier ? "Ouvrir ce dossier" : isDelegatedEdl ? "Importer le PDF de l'agence" : "Créer l'état des lieux"}
                                <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {endedPendingLeases.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">EDL de sortie à finaliser</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {endedPendingLeases.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setSelectedLeaseId(l.id)}
                            className="group min-h-[72px] rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                          >
                            <span className="block text-sm font-semibold text-slate-950">{leaseLabel(l)}</span>
                            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                              Bail terminé — finaliser la sortie
                              <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-700">
                  {!safeLeases.length
                    ? "Aucun bail disponible. Crée d’abord un bail dans la section Baux pour préparer un état des lieux."
                    : !activeOnlyLeases.length
                    ? "Aucun bail actif disponible. Les baux définitivement archivés ne sont plus proposés ici."
                    : "Aucun dossier commencé pour l'instant. Utilise « + État des lieux libre » à droite pour démarrer sans bail."}
                </div>
              )}

              {!selectedLeaseId && creationWizardStep === null && standaloneReports.length ? (
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

            {/* ── Wizard création EDL ──────────────────────────────── */}
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">

              {/* Hidden file inputs (kept for upload functions) */}
              <input ref={externalEntryFileInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadExternalPdf("entry", f); }} />
              <input ref={externalExitFileInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadExternalPdf("exit", f); }} />
              <input ref={externalCreationWizardFileInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f || !creationWizardReportType) return;
                  if (creationWizardReportType === "entry") void uploadExternalPdf("entry", f);
                  else void uploadExternalPdf("exit", f);
                  resetCreationWizard();
                }} />

              {creationWizardStep === null && (selectedLeaseId || selectedReportId) ? (
                /* Un bail/dossier est déjà sélectionné à gauche : les actions
                   (créer/reprendre) sont sur son tableau de bord, pas ici. */
                <div className="flex h-full min-h-[120px] items-center justify-center px-2 text-center">
                  <p className="text-xs text-slate-500">← Utilise les actions du bail sélectionné, à gauche.</p>
                </div>
              ) : creationWizardStep === null ? (
                /* ── État repos : le choix d'un bail se fait dans la liste à
                   gauche ; ce bouton ne sert que pour le cas sans bail. ── */
                <div className="space-y-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Pas encore de bail ?</p>
                  <button
                    type="button"
                    onClick={() => { setCreationMode("standalone"); setCreationWizardStep(1); }}
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <span className="text-base">+</span> État des lieux libre
                  </button>
                  <p className="text-xs text-slate-500">Sélectionne plutôt un bail à gauche si le bien concerné en a déjà un.</p>
                </div>
              ) : (
                /* ── Wizard actif ─────────────────────────────────────── */
                <div className="space-y-4">
                  {/* Progress indicator */}
                  <div className="flex items-center justify-between">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Étape {creationWizardStep}/2
                    </p>
                    <button type="button" onClick={resetCreationWizard} className="text-xs text-slate-400 hover:text-slate-600">
                      Annuler
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2].map((s) => (
                      <div key={s} className={"h-1 flex-1 rounded-full transition-colors " + (s <= (creationWizardStep ?? 0) ? "bg-slate-950" : "bg-slate-200")} />
                    ))}
                  </div>

                  {/* ── Step 1 : uniquement le cas "sans bail" (choisir un bail
                       se fait normalement depuis la liste à gauche) — sauf
                       via "Changer" à l'étape 2, qui revient ici en mode
                       "lease" pour permettre de sélectionner un autre bail. ── */}
                  {creationWizardStep === 1 && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {creationMode === "lease" ? "Quel bail ?" : "État des lieux sans bail"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {creationMode === "lease"
                          ? "Le bail pré-remplit le logement et le locataire."
                          : "Le logement et le locataire seront à préciser. Le rattachement à un bail peut aussi être fait plus tard."}
                      </p>
                      <div className="grid gap-2">
                        {creationMode === "lease" ? (
                          <>
                            <NiceSelect
                              icon={HomeModernIcon}
                              value={selectedLeaseId}
                              onChange={(id) => { setSelectedLeaseId(id); setCreationMode("lease"); }}
                              placeholder="— Sélectionner un bail —"
                              options={[...activeOnlyLeases, ...endedPendingLeases].map((l) => ({
                                value: l.id,
                                label: propertyLabelForLease(l),
                                subtitle: tenantById.get(l.tenant_id)?.full_name || "Locataire",
                              }))}
                            />
                            {!selectedLeaseId && (
                              <button
                                type="button"
                                onClick={() => setCreationMode("standalone")}
                                className="inline-flex min-h-[46px] w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Continuer sans bail (rattacher plus tard)
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <span className="text-xs text-slate-700">État des lieux libre, sans bail</span>
                            <button type="button" onClick={() => setCreationMode("lease")} className="ml-2 shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                              Choisir un bail existant
                            </button>
                          </div>
                        )}
                      </div>

                      {(selectedLeaseId || creationMode === "standalone") && (
                        <div className="space-y-3 border-t border-slate-100 pt-3">
                          {selectedProperty && Array.isArray(selectedProperty.delegated_services) && selectedProperty.delegated_services.includes("bail_edl") && (
                            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                              <p className="text-xs leading-5 text-amber-800">
                                États des lieux délégués{selectedProperty.delegation_agency_name ? ` à ${selectedProperty.delegation_agency_name}` : " à votre gestionnaire"} — la saisie guidée est désactivée pour ce bien. Importez le PDF fourni par votre gestionnaire.
                              </p>
                            </div>
                          )}
                          {creationMode === "standalone" && (
                            <p className="text-xs text-slate-500">Sans bail rattaché, les deux sont possibles.</p>
                          )}
                          {creationMode === "lease" && !entryReport && (
                            <p className="text-xs text-amber-600">Aucune entrée existante — créez-la d’abord pour pouvoir copier les pièces lors de la sortie.</p>
                          )}
                          <div className="grid gap-2">
                            <button
                              type="button"
                              onClick={() => startOrCreateReport("entry", creationMode)}
                              disabled={creationMode === "lease" && (entryReport?.status === "signed" || entryReport?.status === "archived")}
                              className={cx(
                                "inline-flex min-h-[46px] w-full items-center justify-between rounded-2xl border px-4 text-sm font-semibold transition disabled:opacity-40",
                                entryReport ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                              )}
                            >
                              <span>État des lieux d’entrée</span>
                              {entryReport ? <span className="text-xs font-normal text-emerald-600">Reprendre</span> : <span className="text-slate-400">→</span>}
                            </button>
                            <button
                              type="button"
                              onClick={() => startOrCreateReport("exit", creationMode)}
                              disabled={creationMode === "lease" && (!entryReport || exitReport?.status === "signed" || exitReport?.status === "archived")}
                              className={cx(
                                "inline-flex min-h-[46px] w-full items-center justify-between rounded-2xl border px-4 text-sm font-semibold transition disabled:opacity-40",
                                exitReport ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                              )}
                            >
                              <span>État des lieux de sortie</span>
                              {exitReport ? <span className="text-xs font-normal text-emerald-600">Reprendre</span> : <span className="text-slate-400">→</span>}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Step 3 : lokt.fr ou PDF ? ─────────────────────── */}
                  {creationWizardStep === 2 && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-900">
                        Comment souhaitez-vous {creationWizardReportType === "entry" ? "créer l’entrée" : "créer la sortie"} ?
                      </p>

                      {/* Bail sélectionné + lien changer */}
                      {creationMode === "lease" && selectedLeaseId && (
                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="truncate text-xs text-slate-700">
                            {selectedLeaseNiceLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCreationWizardStep(1)}
                            className="ml-2 shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Changer
                          </button>
                        </div>
                      )}

                      {/* Bien LMNP sans inventaire configuré : rien à préremplir dans cet EDL */}
                      {creationWizardReportType === "entry" && lmnpInventoryEmptyForProperty && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-5 text-amber-800">
                              Ce bien est suivi en LMNP mais la liste des 18 éléments obligatoires n'est pas encore configurée dans la
                              section Inventaire — cet état des lieux sera créé sans préremplissage LMNP.
                            </p>
                            {onNavigateToInventaire && (
                              <button
                                type="button"
                                onClick={onNavigateToInventaire}
                                className="mt-1 text-xs font-semibold text-amber-900 underline hover:no-underline"
                              >
                                Configurer l'inventaire LMNP →
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bien délégué ou sortie après entrée PDF externe : import uniquement */}
                      {(selectedProperty?.delegated_services?.includes("bail_edl")) ||
                       (creationMode === "lease" && creationWizardReportType === "exit" && entryReport?.document_source === "external") ? (
                        <>
                          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                            <p className="text-xs leading-5 text-amber-800">
                              {selectedProperty?.delegated_services?.includes("bail_edl")
                                ? `Les états des lieux de ce bien sont gérés par ${selectedProperty.delegation_agency_name || "votre gestionnaire"}. Importez directement le PDF fourni.`
                                : "L’entrée a été gérée par une agence (PDF importé). La sortie doit aussi être importée en PDF — la saisie guidée n’est pas disponible."}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => externalCreationWizardFileInputRef.current?.click()}
                            className="inline-flex min-h-[46px] w-full items-center gap-3 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base">📄</span>
                            <div className="text-left">
                              <p>{loading ? "Import en cours…" : "Importer le PDF fourni par votre gestionnaire"}</p>
                              <p className="text-[0.72rem] font-normal text-white/60">PDF finalisé, 10 Mo max — archivé et verrouillé</p>
                            </div>
                          </button>
                        </>
                      ) : (
                        <div className="grid gap-2">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              if (creationMode === "lease" && creationWizardReportType) {
                                void createReport(creationWizardReportType);
                              } else {
                                void createStandaloneReport(creationWizardReportType ?? "entry");
                              }
                              resetCreationWizard();
                            }}
                            className="inline-flex min-h-[46px] w-full items-center gap-3 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base">📝</span>
                            <div className="text-left">
                              <p>Saisir dans lokt.fr</p>
                              <p className="text-[0.72rem] font-normal text-white/60">Guidé pièce par pièce, photos, signature</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => externalCreationWizardFileInputRef.current?.click()}
                            className="inline-flex min-h-[46px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base">📄</span>
                            <div className="text-left">
                              <p>{loading ? "Import en cours…" : "Importer un PDF existant"}</p>
                              <p className="text-[0.72rem] font-normal text-slate-500">PDF finalisé, 10 Mo max — archivé et verrouillé</p>
                            </div>
                          </button>
                        </div>
                      )}


                      {/* Standalone form (only when no lease) */}
                      {creationMode === "standalone" && (
                        <div className="mt-2 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-xs font-semibold text-slate-600">Informations du logement</p>
                          <input value={standaloneForm.propertyLabel} onChange={(e) => setStandaloneForm((p) => ({ ...p, propertyLabel: e.target.value }))}
                            placeholder="Nom du logement" className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900" />
                          <AddressAutocomplete
                            id="edl_standalone_address1"
                            hint={false}
                            addressLine1={standaloneForm.addressLine1}
                            postalCode={standaloneForm.postalCode}
                            city={standaloneForm.city}
                            onAddressLine1Change={(v) => setStandaloneForm((p) => ({ ...p, addressLine1: v }))}
                            onPostalCodeChange={(v) => setStandaloneForm((p) => ({ ...p, postalCode: v }))}
                            onCityChange={(v) => setStandaloneForm((p) => ({ ...p, city: v }))}
                            placeholder="Adresse"
                            className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                          />
                          <input value={standaloneForm.occupantLabel} onChange={(e) => setStandaloneForm((p) => ({ ...p, occupantLabel: e.target.value }))}
                            placeholder="Nom de l’occupant" className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900" />
                        </div>
                      )}

                      <button type="button" onClick={() => setCreationWizardStep(1)} className="text-xs text-slate-400 hover:text-slate-600">← Retour</button>
                    </div>
                  )}
                </div>
              )}
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

      {selectedReportId && !isExternalReport && !isLocked ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
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
        </div>
      ) : null}

      {/* Résumé — contexte + PDF + caution */}
      {selectedReportId ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-4" style={{ overflowAnchor: "none" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx("inline-flex rounded-xl border px-3 py-1.5 text-sm font-bold", reportTypeTone)}>{reportLabel}</span>
              <span className="text-sm font-semibold text-slate-900 truncate">{selectedContextLabel}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={selectedWorkflow.tone}>{selectedWorkflow.label}</Badge>
              {isExternalReport ? <Badge tone="slate">PDF externe</Badge> : null}
              {!selectedLeaseId ? <Badge tone="amber">Non rattaché</Badge> : null}
              {!isLocked ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-emerald-500" style={{ width: `${completeness}%` }} />
                  </div>
                  {completeness}% complété
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || !hasPdf}
              onClick={openPdf}
              className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              title={!hasPdf ? "Le PDF sera créé lors de la finalisation." : undefined}
            >
              {isExternalReport ? "Ouvrir le PDF externe" : selectedReport?.status === "signed" ? "Ouvrir PDF signé" : "Ouvrir le PDF"}
            </button>


            {isLocked && hasPdf && effectiveTenantEmail ? (
              canShareDocuments ? (
                <button
                  type="button"
                  disabled={sendingTenant || !!tenantEmailSent}
                  onClick={handleSendToTenant}
                  className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-4 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
                  title={tenantEmailSent ? `Envoyé à ${tenantEmailSent}` : `Envoyer le PDF à ${effectiveTenantEmail}`}
                >
                  {sendingTenant ? "Envoi…" : tenantEmailSent ? "Email envoyé ✓" : "Envoyer au locataire"}
                </button>
              ) : (
                <Link
                  href="/tarifs"
                  className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                  title="Le partage de documents avec le locataire nécessite un abonnement lokt.one ou supérieur."
                >
                  Envoyer au locataire 🔒
                </Link>
              )
            ) : null}

            {hasPdf && !isLocked && effectiveTenantEmail ? (
              sigEdlSent ? (
                <>
                  <span className="inline-flex min-h-[36px] items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-semibold text-emerald-800">
                    Liens de signature envoyés ✓
                  </span>
                  {sigEdlRequestId && (
                    <button
                      type="button"
                      disabled={sigEdlCancelLoading}
                      onClick={cancelEdlSignature}
                      className="text-xs font-semibold text-slate-500 underline hover:text-slate-700 disabled:opacity-60"
                    >
                      {sigEdlCancelLoading ? "Annulation…" : "Annuler la demande"}
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled={sigEdlLoading}
                  onClick={sendEdlForSignature}
                  className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full border border-[#635bff]/30 bg-[#635bff]/5 px-4 text-xs font-semibold text-[#635bff] hover:bg-[#635bff]/10 disabled:opacity-60"
                >
                  {sigEdlLoading ? "Envoi…" : "Signature électronique →"}
                </button>
              )
            ) : null}
            {sigEdlWarning ? <span className="text-xs text-amber-700">⚠ {sigEdlWarning}</span> : null}
            {sigEdlError ? <span className="text-xs text-red-600">{sigEdlError}</span> : null}
          </div>
        </div>

        {!selectedLeaseId && !isLocked ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex-1">
              <NiceSelect
                icon={HomeModernIcon}
                value={attachLeaseId}
                onChange={(id) => setAttachLeaseId(id)}
                placeholder="Rattacher à un bail actif…"
                options={activeLeases.map((lease) => ({
                  value: lease.id,
                  label: propertyLabelForLease(lease),
                  subtitle: tenantById.get(lease.tenant_id)?.full_name || "Locataire",
                }))}
              />
            </div>
            <button
              type="button"
              disabled={loading || !attachLeaseId}
              onClick={() => selectedReportId && attachStandaloneReportToLease(selectedReportId, attachLeaseId)}
              className="inline-flex min-h-[36px] items-center justify-center rounded-xl bg-amber-900 px-3 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
            >
              Rattacher
            </button>
          </div>
        ) : null}

        {!isLocked ? (
          <p className="mt-3 text-xs text-slate-600">
            {selectedLeaseId
              ? entryReport?.document_source === "external"
                ? "L’entrée a été importée en PDF : la sortie sera créée vierge. Ajoutez les pièces manuellement."
                : "L’état des lieux de sortie reprend automatiquement les pièces et éléments de l’entrée lorsqu’elle existe."
              : "Ce document est libre : il peut être finalisé tel quel ou rattaché à un bail actif plus tard."}
          </p>
        ) : null}

        {isLocked && selectedReport?.report_type === "exit" && onNavigateToBaux ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-900">
              EDL de sortie archivé — des dégradations à retenir sur le dépôt de garantie ?
            </p>
            <button
              type="button"
              onClick={onNavigateToBaux}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
            >
              Gérer la caution
              <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      ) : null}

      {/* Contenu */}
      {selectedLeaseId || selectedReportId ? (
      <div style={{ overflowAnchor: "none" }}>
        <section className="space-y-4">
          {!selectedReportId ? (
            null
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
                  Aucune pièce. Utilise "Ouvrir l’assistant" en haut pour ajouter des pièces.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRoomsWithItems.map(({ room, items }) => (
                    <details key={room.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden" open>
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
                                  Gravité : {it.severity ?? 0}/3
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

      <RepairsGuideCard />

      {ViewModal()}
      {WizardOverlay()}

      {confirmReplaceExternalPdf ? (
        <Modal
          open={!!confirmReplaceExternalPdf}
          title="Remplacer l'état des lieux ?"
          onClose={() => setConfirmReplaceExternalPdf(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReplaceExternalPdf(null)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void uploadExternalPdf(confirmReplaceExternalPdf.type, confirmReplaceExternalPdf.file, true)}
                className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
              >
                Oui, remplacer
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-700">
            {reportTypeLabel(confirmReplaceExternalPdf.type)} existe déjà. Remplacer son parcours lokt.fr par le PDF externe finalisé ?
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
