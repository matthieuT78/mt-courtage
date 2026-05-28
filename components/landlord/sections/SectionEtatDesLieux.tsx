// =========================
// ./components/landlord/sections/SectionEtatDesLieux.tsx
// VERSION : Wizard + scroll-jump fix + sortie=copy entrée (rooms+items via DB) + upload PDF signé (archivage)
// =========================
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import type { Lease, Property, Tenant } from "../../../lib/landlord/types";
import RepairsGuideCard from "../RepairsGuideCard";

/* ======================================================
   TYPES
====================================================== */

type InventoryReport = {
  id: string;
  user_id: string;
  lease_id: string;
  report_type: "entry" | "exit";
  status: "draft" | "ready" | "signed" | "archived";
  performed_at: string | null;
  performed_place: string | null;
  counters_json: any | null;
  general_notes: string | null;
  pdf_url: string | null;
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
   NOTICE / WORKFLOW V1 (impression + upload signé)
====================================================== */

function NoticeTop() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#f6f9fc] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <ClipboardDocumentCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#635bff]" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-slate-950">Parcours sur place</p>
          <p className="mt-1 text-sm text-slate-600">
            Dans le logement, avance pièce par pièce : ajoute les pièces, marque une pièce sans anomalie avec{" "}
            <span className="font-semibold">“Pièce OK”</span>, note uniquement les défauts utiles, puis finalise le PDF à faire signer.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-950">1. Préparer</p>
          <p className="mt-1 text-xs text-slate-600">Choisir le bail, créer l’entrée ou la sortie, vérifier date et lieu.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-950">2. Relever</p>
          <p className="mt-1 text-xs text-slate-600">Pièces, état, anomalies, compteurs, clés, badges et observations.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-950">3. Signer</p>
          <p className="mt-1 text-xs text-slate-600">Générer le PDF, le faire signer, puis importer le PDF signé pour verrouiller.</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Un état des lieux signé ou archivé est verrouillé pour préserver la valeur du document.
      </p>
    </div>
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

function parseInventoryPdfUrl(pdfUrl?: string | null) {
  const raw = String(pdfUrl || "").trim();
  if (!raw) return null;
  const sepIndex = raw.indexOf(":");
  const bucket = sepIndex >= 0 ? raw.slice(0, sepIndex) : INVENTORY_BUCKET;
  const path = sepIndex >= 0 ? raw.slice(sepIndex + 1) : raw;
  if (!bucket || !path) return null;
  return { bucket, path };
}

function openPdfUrl(url: string) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
// =========================
// BLOCK 2/4
// =========================
export function SectionEtatDesLieux({ userId, leases, properties, tenants, onRefresh }: Props) {
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeProps = Array.isArray(properties) ? properties : [];
  const safeTenants = Array.isArray(tenants) ? tenants : [];

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
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [reports, setReports] = useState<InventoryReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const [rooms, setRooms] = useState<InventoryRoom[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);

  const [search, setSearch] = useState("");

  const selectedReport = useMemo(() => reports.find((r) => r.id === selectedReportId) || null, [reports, selectedReportId]);
  const selectedLease = useMemo(() => safeLeases.find((l: any) => l.id === selectedLeaseId) || null, [safeLeases, selectedLeaseId]);
  const selectedProperty = selectedLease ? propertyById.get((selectedLease as any).property_id) || null : null;
  const defaultReportPlace = propertyPlaceLabel(selectedProperty);

  const selectedLeaseNiceLabel = selectedLease ? leaseLabel(selectedLease as any) : "—";
  const reportLabel = selectedReport ? reportTypeLabel(selectedReport.report_type) : "—";

  const isLocked = selectedReport?.status === "signed" || selectedReport?.status === "archived";
  const hasPdf = !!selectedReport?.pdf_url;
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
      }
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger les états des lieux.");
    } finally {
      setLoading(false);
    }
  };

  const loadReportDetails = async (reportId: string) => {
    if (!supabase || !reportId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const [{ data: rRooms, error: eRooms }, { data: rItems, error: eItems }] = await Promise.all([
        supabase.from("inventory_rooms").select("*").eq("report_id", reportId).order("sort_order", { ascending: true }),
        supabase.from("inventory_items").select("*").eq("report_id", reportId).order("created_at", { ascending: true }),
      ]);

      if (eRooms) throw eRooms;
      if (eItems) throw eItems;

      setRooms((rRooms || []) as any);
      setItems((rItems || []) as any);
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger le détail de l’état des lieux.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLeaseId && userId) {
      setReports([]);
      setSelectedReportId(null);
      setRooms([]);
      setItems([]);
      loadReportsForLease(selectedLeaseId);
    } else {
      setReports([]);
      setSelectedReportId(null);
      setRooms([]);
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaseId, userId]);

  useEffect(() => {
    if (selectedReportId) loadReportDetails(selectedReportId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReportId]);

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
        setOk(`${reportTypeLabel(type)} déjà existant — ouverture ✅`);
        await loadReportDetails(exists.id);
        openWizard(exists.id);
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
        openPdfUrl(json.signedUrl);
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

      openPdfUrl(signed.signedUrl);

      setOk("PDF ouvert ✅");
    } catch (e: any) {
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
    if (!supabase || !userId || !selectedLeaseId || !selectedReportId) return;
    if (!selectedReport) return;

    if (selectedReport.status === "archived") {
      setErr("Document archivé : import impossible.");
      return;
    }

    if (file.type !== "application/pdf") {
      setErr("Fichier invalide : PDF uniquement.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const path = buildPdfPath({ reportId: selectedReportId, userId, leaseId: selectedLeaseId, kind: "signed" });

      const { error: eUp } = await supabase.storage.from(INVENTORY_BUCKET).upload(path, file, {
        upsert: true,
        contentType: "application/pdf",
      });
      if (eUp) throw eUp;

      // On pointe pdf_url sur le PDF signé et on verrouille en “signed”
      const { error: eUpd } = await supabase
        .from("inventory_reports")
        .update({ pdf_url: `${INVENTORY_BUCKET}:${path}`, status: "signed" })
        .eq("id", selectedReportId)
        .eq("user_id", userId);
      if (eUpd) throw eUpd;

      await loadReportsForLease(selectedLeaseId);
      await loadReportDetails(selectedReportId);

      setOk("PDF signé importé ✅ (statut : Signé)");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’importer le PDF signé.");
    } finally {
      setLoading(false);
      if (signedFileInputRef.current) signedFileInputRef.current.value = "";
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
    if (!rooms.length) return 0;
    const roomsOk = roomsWithItems.filter((x) => x.items.length > 0).length;
    return Math.round((roomsOk / rooms.length) * 100);
  }, [rooms, roomsWithItems]);

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

  const leaseStarterCards = useMemo(() => safeLeases.slice(0, 4), [safeLeases]);

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
    if (!selectedReportId || !userId || !selectedLeaseId) return;
    if (isLocked) {
      setErr("Document verrouillé : impossible de finaliser.");
      return;
    }
    if (!selectedReport?.performed_at) {
      setErr("Renseigne la date et l’heure de la visite dans le bloc “Infos” avant de générer le PDF.");
      return;
    }
    const finalPlace = (selectedReport.performed_place || "").trim() || defaultReportPlace;
    if (!finalPlace) {
      setErr(
        "Renseigne le champ “Lieu” dans le bloc “Infos” avant de générer le PDF. Il s’agit de l’adresse où la visite est réalisée, par exemple : 12 rue Victor Hugo, 75000 Paris."
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

      await loadReportsForLease(selectedLeaseId);
      await loadReportDetails(selectedReportId);

      setOk("EDL finalisé ✅ PDF généré (à imprimer)");
      await closeWizard();
    } catch (e: any) {
      try {
        if (previousStatus !== "ready") {
          await supabase.from("inventory_reports").update({ status: previousStatus }).eq("id", selectedReportId).eq("user_id", userId);
          if (selectedLeaseId) await loadReportsForLease(selectedLeaseId);
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

                          <button
                            type="button"
                            disabled={wizardRoomIndex >= rooms.length - 1}
                            onClick={() => preserveWizardScroll(() => setWizardRoomIndex((i) => Math.min(rooms.length - 1, i + 1)))}
                            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            Pièce suivante →
                          </button>
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
        title="Créer, compléter, imprimer et archiver un état des lieux"
        desc="Complète l’EDL via l’assistant, génère un PDF à imprimer, puis importe le PDF signé pour archivage."
      />

      <NoticeTop />

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.10),transparent_34%),linear-gradient(135deg,#f8fafc,#ffffff_48%,#f6f9fc)]" />
          <div className="relative grid gap-5 p-5 lg:grid-cols-[1fr,420px] lg:p-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-700">
                <BuildingOffice2Icon className="h-4 w-4" aria-hidden="true" />
                Dossier de visite
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-950 sm:text-2xl">Sélectionne le bail avant de commencer</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                L’état des lieux dépend du logement et du locataire. Une fois le bail choisi, tu retrouves les états des lieux existants, les informations terrain, les compteurs et le mode téléphone.
              </p>

              {selectedLeaseId ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#635bff]">Bail sélectionné</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{selectedLeaseNiceLabel}</p>
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
                  Aucun bail disponible. Crée d’abord un bail dans la section Baux pour préparer un état des lieux.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bail à utiliser</label>
              <select
                value={selectedLeaseId}
                onChange={(e) => setSelectedLeaseId(e.target.value)}
                className="mt-2 min-h-[48px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:border-[#635bff] focus:outline-none focus:ring-4 focus:ring-[#635bff]/10"
              >
                <option value="">Sélectionner un bail</option>
                {safeLeases.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {leaseLabel(l)}
                  </option>
                ))}
              </select>

              <div className="mt-4 grid gap-2">
                {!selectedReportId ? (
                  <button
                    type="button"
                    disabled={!selectedLeaseId || loading}
                    onClick={() => createReport("entry")}
                    className="inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Créer l’état des lieux d’entrée
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!selectedLeaseId || loading}
                  onClick={() => createReport("exit")}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-50 disabled:opacity-50"
                >
                  Créer la sortie depuis l’entrée
                </button>
                {selectedReportId ? (
                  <button
                    type="button"
                    disabled={loading || isLocked}
                    onClick={() => {
                      if (!selectedReportId) return;
                      openWizard(selectedReportId, selectedReport?.status === "ready" || hasPdf ? "finalize" : undefined);
                    }}
                    className="order-first inline-flex min-h-[46px] items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {primaryReportActionLabel}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* zone messages : réserve la place => évite layout shift (scroll jump) */}
      <div className="min-h-[44px] space-y-2" style={{ overflowAnchor: "none" }}>
        {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
        {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}
      </div>

      {/* Résumé / Actions */}
      {selectedLeaseId ? (
      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white" style={{ overflowAnchor: "none" }}>
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-[#f6f9fc]" />
          <div className="relative p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Résumé</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                  {selectedLeaseId ? selectedLeaseNiceLabel : "Sélectionne un bail pour démarrer"}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone="slate">{reportLabel}</Badge>
                  {selectedReport ? <Badge tone={statusUi(selectedReport.status).tone}>Statut : {statusUi(selectedReport.status).label}</Badge> : null}
                  {isLocked ? <Badge tone="red">Verrouillé</Badge> : <Badge tone="slate">Modifiable</Badge>}
                  {hasPdf ? <Badge tone="emerald">PDF disponible</Badge> : <Badge tone="slate">PDF non disponible</Badge>}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:items-end">
                <div className="flex items-center gap-2">
                  <Badge tone="emerald">Complétude : {completeness}%</Badge>
                  <div className="h-2 w-32 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${completeness}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    disabled={loading || !selectedReportId || !hasPdf}
                    onClick={openPdf}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 sm:min-h-0 sm:rounded-full sm:text-xs"
                    title={!hasPdf ? "Le PDF sera créé lors de la finalisation." : "Ouvrir le PDF"}
                  >
                    Ouvrir le PDF
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
                  <button
                    type="button"
                    disabled={loading || !selectedReportId || !hasPdf || selectedReport?.status === "archived"}
                    onClick={() => signedFileInputRef.current?.click()}
                    className={cx(
                      "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 sm:min-h-0 sm:rounded-full sm:text-xs",
                      selectedReport?.status === "archived"
                        ? "border border-slate-300 bg-slate-100 text-slate-500"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                    )}
                    title={!hasPdf ? "Génère d’abord le PDF (finaliser)." : "Importer le PDF signé pour archiver"}
                  >
                    <DocumentArrowUpIcon className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
                    Importer le PDF signé
                  </button>

                  <button
                    type="button"
                    disabled={loading || !selectedReportId}
                    onClick={() => setViewOpen(true)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 sm:min-h-0 sm:rounded-full sm:text-xs"
                  >
                    Consulter (lecture)
                  </button>

                  <button
                    type="button"
                    disabled={loading || !selectedReportId || isLocked}
                    onClick={() =>
                      selectedReportId && openWizard(selectedReportId, selectedReport?.status === "ready" || hasPdf ? "finalize" : undefined)
                    }
                    className={cx(
                      "col-span-2 inline-flex min-h-[48px] items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 sm:col-span-1 sm:min-h-0 sm:rounded-full sm:text-xs",
                      isLocked
                        ? "border border-slate-300 bg-slate-100 text-slate-500"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                    )}
                    title={isLocked ? "EDL signé/archivé : modification désactivée" : "Ouvrir l’assistant"}
                  >
                    {primaryReportActionLabel}
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600">
              Note : “EDL de sortie” reprend automatiquement les pièces + éléments de l’EDL d’entrée (si l’entrée existe).
            </p>
          </div>
        </div>
      </div>
      ) : null}

      {/* Contenu */}
      {selectedLeaseId ? (
      <div className="grid gap-4 lg:grid-cols-[420px,1fr]" style={{ overflowAnchor: "none" }}>
        {/* LEFT */}
        <aside className="flex flex-col gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Changer de bail</p>
            <select
              value={selectedLeaseId}
              onChange={(e) => setSelectedLeaseId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— Sélectionner un bail —</option>
              {safeLeases.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {leaseLabel(l)}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={!selectedLeaseId || loading}
                onClick={() => createReport("entry")}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                + Créer EDL d’entrée
              </button>
              <button
                type="button"
                disabled={!selectedLeaseId || loading}
                onClick={() => createReport("exit")}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                + Créer EDL de sortie (copie entrée)
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">2) États des lieux</p>

            {reports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                {selectedLeaseId ? "Aucun état des lieux pour ce bail." : "Choisis un bail pour afficher les états des lieux."}
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => {
                  const active = r.id === selectedReportId;
                  const title = reportTypeLabel(r.report_type);
                  const st = statusUi(r.status);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReportId(r.id)}
                      className={cx(
                        "w-full text-left rounded-2xl border px-3 py-3 transition",
                        active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{title}</p>
                          <p className="mt-1 text-xs text-slate-600">Créé le {new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone={st.tone}>Statut : {st.label}</Badge>
                            {r.pdf_url ? <Badge tone="emerald">PDF ✅</Badge> : <Badge tone="slate">PDF —</Badge>}
                          </div>
                        </div>

                        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800">
                          {active ? "Ouvert" : "Ouvrir →"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedReport ? (
            <div className="order-first rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Infos</p>

              {isLocked ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Cet état des lieux est <span className="font-semibold">verrouillé</span> (signé/archivé).
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">Date / heure</label>
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
                  <label className="text-[0.7rem] text-slate-700">Lieu de la visite</label>
                  <input
                    disabled={isLocked}
                    value={selectedReport.performed_place || ""}
                    onChange={(e) => updateReport({ performed_place: e.target.value })}
                    placeholder={defaultReportPlace || "Ex : 12 rue Victor Hugo, 75000 Paris"}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                  <p className="text-[0.7rem] text-slate-500">Adresse où l’état des lieux est réalisé. Par défaut, l’adresse du bien est utilisée.</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[0.7rem] text-slate-700">Notes générales</label>
                <textarea
                  rows={3}
                  disabled={isLocked}
                  value={selectedReport.general_notes || ""}
                  onChange={(e) => updateReport({ general_notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900">Compteurs et clés</p>
                  <p className="mt-1 text-[0.72rem] text-slate-600">
                    Ces informations apparaissent dans le PDF et facilitent la remise des lieux.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["electricity", "Compteur électricité"],
                    ["water", "Compteur eau"],
                    ["gas", "Compteur gaz"],
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

                <div className="grid gap-3 sm:grid-cols-3">
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
            </div>
          ) : null}
        </aside>

        {/* RIGHT */}
        <section className="space-y-4">
          {!selectedReportId ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
              Sélectionne un bail puis ouvre un état des lieux.
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

      <RepairsGuideCard />

      {ViewModal()}
      {WizardOverlay()}
    </div>
  );
}
