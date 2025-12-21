import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import type { Lease, Property, Tenant } from "../../../lib/landlord/types";

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

const conditionOptions: Array<{ v: InventoryItem["condition"]; label: string }> = [
  { v: "neuf", label: "Neuf" },
  { v: "tres_bon", label: "Très bon" },
  { v: "bon", label: "Bon" },
  { v: "moyen", label: "Moyen" },
  { v: "mauvais", label: "Mauvais" },
];

const defaultRoomTemplates = [
  "Entrée",
  "Séjour",
  "Cuisine",
  "Chambre 1",
  "Chambre 2",
  "Salle de bain",
  "WC",
  "Couloir",
  "Balcon / Terrasse",
];

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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 p-3 sm:p-6 flex items-center justify-center">
        <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
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

          <div className="p-5">{children}</div>

          {footer ? <div className="px-5 py-4 border-t border-slate-200 bg-white">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

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

  const [selectedLeaseId, setSelectedLeaseId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [reports, setReports] = useState<InventoryReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const [rooms, setRooms] = useState<InventoryRoom[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);

  const [tab, setTab] = useState<"rooms" | "info">("rooms");
  const [search, setSearch] = useState("");

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId]
  );

  const leaseLabel = (l: Lease) => {
    const p = propertyById.get((l as any).property_id);
    const t = tenantById.get((l as any).tenant_id);
    // ✅ juste nom bien + nom locataire (sans mail / ville)
    return `${(p as any)?.label || "Bien"} — ${(t as any)?.full_name || "Locataire"}`;
  };

  const safeRefresh = async () => {
    try {
      await onRefresh?.();
    } catch {
      // no-op
    }
  };

  const loadReportsForLease = async (leaseId: string) => {
    if (!supabase || !userId || !leaseId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { data, error } = await supabase
        .from("inventory_reports")
        .select("*")
        .eq("user_id", userId)
        .eq("lease_id", leaseId);

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
      setErr(e?.message || "Erreur lors du chargement des états des lieux.");
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
      setErr(e?.message || "Erreur lors du chargement du détail.");
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
      setTab("rooms");
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

  const prefillRooms = async (reportId: string) => {
    if (!supabase || !reportId) return;
    const { data: existing } = await supabase.from("inventory_rooms").select("id").eq("report_id", reportId).limit(1);
    if ((existing || []).length) return;

    const payload = defaultRoomTemplates.map((name, idx) => ({
      report_id: reportId,
      name,
      floor_level: null,
      notes: null,
      sort_order: idx,
    }));

    await supabase.from("inventory_rooms").insert(payload);
  };

  const createReport = async (type: "entry" | "exit") => {
    if (!supabase || !userId || !selectedLeaseId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const exists = reports.find((r) => r.report_type === type);
      if (exists) {
        setSelectedReportId(exists.id);
        throw new Error(`Un état des lieux ${type === "entry" ? "d’entrée" : "de sortie"} existe déjà.`);
      }

      const { data, error } = await supabase
        .from("inventory_reports")
        .insert({
          user_id: userId,
          lease_id: selectedLeaseId,
          report_type: type,
          status: "draft",
          performed_at: new Date().toISOString(),
          performed_place: "",
          counters_json: null,
          general_notes: "",
        })
        .select("*")
        .single();

      if (error) throw error;

      setOk("État des lieux créé ✅");

      await loadReportsForLease(selectedLeaseId);
      setSelectedReportId((data as any).id);

      await prefillRooms((data as any).id);
      await loadReportDetails((data as any).id);
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de la création.");
    } finally {
      setLoading(false);
    }
  };

  const addRoom = async (payload: { name: string; floor_level?: string; notes?: string }) => {
    if (!supabase || !selectedReportId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const sort = rooms.length ? Math.max(...rooms.map((r) => r.sort_order || 0)) + 1 : 0;
      const { error } = await supabase.from("inventory_rooms").insert({
        report_id: selectedReportId,
        name: (payload.name || "").trim(),
        floor_level: (payload.floor_level || "").trim() || null,
        notes: (payload.notes || "").trim() || null,
        sort_order: sort,
      });
      if (error) throw error;

      setOk("Pièce ajoutée ✅");
      await loadReportDetails(selectedReportId);
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de l’ajout de pièce.");
    } finally {
      setLoading(false);
    }
  };

  const deleteRoom = async (roomId: string) => {
    if (!supabase || !selectedReportId) return;
    if (!confirm("Supprimer cette pièce ? (les éléments associés seront supprimés)")) return;

    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const { error } = await supabase.from("inventory_rooms").delete().eq("id", roomId).eq("report_id", selectedReportId);
      if (error) throw error;
      setOk("Pièce supprimée 🗑️");
      await loadReportDetails(selectedReportId);
    } catch (e: any) {
      setErr(e?.message || "Suppression impossible.");
    } finally {
      setLoading(false);
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
      setErr(e?.message || "Erreur lors de l’ajout d’élément.");
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (itemId: string, patch: Partial<InventoryItem>) => {
    if (!supabase) return;
    try {
      await supabase.from("inventory_items").update(patch).eq("id", itemId);
      setItems((prev) => prev.map((it) => (it.id === itemId ? ({ ...it, ...patch } as any) : it)));
    } catch {
      // no-op
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!supabase || !selectedReportId) return;
    if (!confirm("Supprimer cet élément ?")) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase.from("inventory_items").delete().eq("id", itemId);
      if (error) throw error;
      setOk("Élément supprimé 🗑️");
      await loadReportDetails(selectedReportId);
    } catch (e: any) {
      setErr(e?.message || "Suppression impossible.");
    } finally {
      setLoading(false);
    }
  };

  const updateReport = async (patch: Partial<InventoryReport>) => {
    if (!supabase || !selectedReportId) return;

    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase
        .from("inventory_reports")
        .update(patch)
        .eq("id", selectedReportId)
        .eq("user_id", userId);

      if (error) throw error;

      setReports((prev) => prev.map((r) => (r.id === selectedReportId ? ({ ...r, ...patch } as any) : r)));
      setOk("Informations enregistrées ✅");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’enregistrer.");
    }
  };

  /* ======================================================
     PDF : OUVRIR SI EXISTE, SINON GÉNÉRER PUIS OUVRIR
     + bouton "Régénérer"
     + anti popup-blocker (ouvre un onglet tout de suite)
  ====================================================== */

  const openPdf = async () => {
    if (!selectedReportId || !userId) return;

    // ✅ anti popup-blocker : on ouvre immédiatement un onglet
    const win = window.open("about:blank", "_blank", "noopener,noreferrer");

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const r = await fetch(
        `/api/inventory/pdf-url?reportId=${encodeURIComponent(selectedReportId)}&userId=${encodeURIComponent(userId)}`
      );

      const raw = await r.text();
      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {}

      if (!r.ok) throw new Error(json?.error || raw || `Erreur ${r.status}`);
      if (!json?.signedUrl) throw new Error("URL manquante");

      if (win) win.location.href = json.signedUrl;
      else window.open(json.signedUrl, "_blank", "noopener,noreferrer");

      setOk("PDF ouvert ✅");
    } catch (e: any) {
      if (win) win.close();
      setErr(e?.message || "Impossible d’ouvrir le PDF.");
    } finally {
      setLoading(false);
    }
  };

  const generatePdf = async () => {
    if (!selectedReportId || !userId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const rGen = await fetch("/api/inventory/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: selectedReportId, userId }),
      });

      const rawGen = await rGen.text();
      let jsonGen: any = null;
      try {
        jsonGen = rawGen ? JSON.parse(rawGen) : null;
      } catch {}

      if (!rGen.ok) throw new Error(jsonGen?.error || rawGen || `Erreur ${rGen.status}`);

      // refresh pour récupérer pdf_url dans la liste
      await loadReportsForLease(selectedLeaseId);
      setOk("PDF généré ✅");
    } catch (e: any) {
      setErr(e?.message || "Erreur génération PDF.");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  // ✅ Bouton principal : "Ouvrir si existe, sinon générer puis ouvrir"
  const generateOrOpenPdf = async () => {
    if (!selectedReportId) return;

    setErr(null);
    setOk(null);

    const rep = reports.find((r) => r.id === selectedReportId) || null;

    if (rep?.pdf_url) {
      await openPdf();
      return;
    }

    try {
      await generatePdf();
      await openPdf();
    } catch {
      // erreurs déjà affichées
    }
  };

  // ✅ Force régénération (même si pdf_url existe)
  const regeneratePdfAndOpen = async () => {
    if (!selectedReportId) return;
    try {
      await generatePdf(); // /api/inventory/pdf fait un upload upsert -> remplace le PDF
      await openPdf();
    } catch {
      // erreurs déjà affichées
    }
  };

  /* ======================================================
     COMPUTED
  ====================================================== */

  const roomsWithItems = useMemo(() => {
    const byRoom = new Map<string, InventoryItem[]>();
    for (const it of items) {
      const rid = it.room_id || "__no_room__";
      const arr = byRoom.get(rid) || [];
      arr.push(it);
      byRoom.set(rid, arr);
    }
    return rooms.map((r) => ({
      room: r,
      items: byRoom.get(r.id) || [],
    }));
  }, [rooms, items]);

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
          const hay = [it.category, it.label, it.description || "", ...(it.defect_tags || [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
        return { room, items: its };
      })
      .filter(({ room, items }) => {
        const roomHit = (room.name || "").toLowerCase().includes(q);
        return roomHit || items.length > 0;
      });
  }, [roomsWithItems, search]);

  const selectedLease = useMemo(
    () => safeLeases.find((l: any) => l.id === selectedLeaseId) || null,
    [safeLeases, selectedLeaseId]
  );
  const selectedLeaseNiceLabel = selectedLease ? leaseLabel(selectedLease as any) : "—";
  const reportLabel = selectedReport ? (selectedReport.report_type === "entry" ? "EDL d’entrée" : "EDL de sortie") : "—";

  const selectedReportStatusTone = (s?: InventoryReport["status"] | null) => {
    const v = (s || "").toLowerCase();
    if (v === "signed") return "emerald" as const;
    if (v === "ready") return "amber" as const;
    if (v === "draft") return "slate" as const;
    if (v === "archived") return "red" as const;
    return "slate" as const;
  };

  // ----- MODALS -----
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [roomDraft, setRoomDraft] = useState({ name: "", floor_level: "", notes: "" });

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemRoomId, setItemRoomId] = useState<string>("");
  const [itemDraft, setItemDraft] = useState({
    category: "Mur",
    label: "",
    condition: "bon" as InventoryItem["condition"],
    wear_level: 2 as any,
    is_clean: true,
    is_functional: true,
    description: "",
    defect_tags: "",
    severity: 0 as any,
  });

  const openAddItem = (roomId: string) => {
    setItemRoomId(roomId);
    setItemDraft({
      category: "Mur",
      label: "",
      condition: "bon",
      wear_level: 2,
      is_clean: true,
      is_functional: true,
      description: "",
      defect_tags: "",
      severity: 0,
    });
    setItemModalOpen(true);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="État des lieux"
        title="Une expérience “contractuelle” : claire, rapide, exportable en PDF"
        desc="Choisis un bail → ouvre/crée un EDL → remplis pièces & éléments → ouvre le PDF."
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>
      ) : null}

      {/* HEADER SUMMARY */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50" />
          <div className="relative p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Résumé</p>
                <p className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                  {selectedLeaseId ? selectedLeaseNiceLabel : "Sélectionne un bail pour démarrer"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone="slate">{reportLabel}</Badge>
                  {selectedReport ? (
                    <Badge tone={selectedReportStatusTone(selectedReport.status)}>
                      Statut : {(selectedReport.status || "draft").toUpperCase()}
                    </Badge>
                  ) : null}
                  {selectedReport?.pdf_url ? <Badge tone="emerald">PDF disponible</Badge> : <Badge tone="slate">PDF non généré</Badge>}
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="emerald">Complétude : {completeness}%</Badge>
                  <div className="h-2 w-32 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${completeness}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={loading || !selectedReportId}
                    onClick={generateOrOpenPdf}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {loading ? "Préparation…" : "Ouvrir le PDF"}
                  </button>

                  {selectedReport?.pdf_url ? (
                    <button
                      type="button"
                      disabled={loading || !selectedReportId}
                      onClick={regeneratePdfAndOpen}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Régénérer le PDF
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600">
              Astuce : remplis au moins 1 élément par pièce pour obtenir un EDL hyper propre en PDF.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px,1fr]">
        {/* LEFT */}
        <aside className="space-y-3">
          {/* Bail */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">1) Bail</p>
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
                disabled={loading || !selectedLeaseId}
                onClick={() => createReport("entry")}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                + Créer EDL entrée
              </button>

              <button
                type="button"
                disabled={loading || !selectedLeaseId}
                onClick={() => createReport("exit")}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                + Créer EDL sortie
              </button>
            </div>
          </div>

          {/* Reports */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">2) États des lieux</p>

            {reports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                {selectedLeaseId ? "Aucun EDL pour ce bail (crée une entrée ou une sortie)." : "Choisis un bail pour afficher les EDL."}
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => {
                  const active = r.id === selectedReportId;
                  const title = r.report_type === "entry" ? "EDL d’entrée" : "EDL de sortie";

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedReportId(r.id);
                        setTab("rooms");
                      }}
                      className={cx(
                        "w-full text-left rounded-2xl border px-3 py-3 transition",
                        active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{title}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            Créé le {new Date(r.created_at).toLocaleDateString("fr-FR")}
                            {r.performed_place ? ` • ${r.performed_place}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone={selectedReportStatusTone(r.status)}>Statut : {(r.status || "draft").toUpperCase()}</Badge>
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

          {/* Tips */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Bonnes pratiques</p>
            <ul className="mt-2 text-sm text-slate-800 space-y-2">
              <li>
                <span className="font-semibold">Factuel</span> : mesures, localisation, taille (“tache 3cm près porte”).
              </li>
              <li>
                <span className="font-semibold">Complet</span> : au moins 1 élément par pièce.
              </li>
              <li>
                <span className="font-semibold">Traçable</span> : tags défauts (“fissure, trou, humidité…”).
              </li>
            </ul>
          </div>
        </aside>

        {/* RIGHT */}
        <section className="space-y-4">
          {!selectedReportId ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
              Sélectionne un bail puis ouvre/crée un état des lieux.
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="rounded-2xl border border-slate-200 bg-white p-2 inline-flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab("rooms")}
                  className={cx(
                    "rounded-xl px-4 py-2 text-xs font-semibold transition",
                    tab === "rooms" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  3) Pièces & éléments
                </button>
                <button
                  type="button"
                  onClick={() => setTab("info")}
                  className={cx(
                    "rounded-xl px-4 py-2 text-xs font-semibold transition",
                    tab === "info" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  Infos EDL
                </button>
              </div>

              {tab === "info" ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Informations de l’état des lieux</p>
                      <p className="text-xs text-slate-600">Ces infos apparaissent dans le PDF (date, lieu, notes).</p>
                    </div>
                    <Badge tone="slate">Auto-enregistrement</Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Date / heure de réalisation</label>
                      <input
                        type="datetime-local"
                        value={selectedReport?.performed_at ? new Date(selectedReport.performed_at).toISOString().slice(0, 16) : ""}
                        onChange={(e) => {
                          const iso = e.target.value ? new Date(e.target.value).toISOString() : null;
                          updateReport({ performed_at: iso });
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Lieu</label>
                      <input
                        value={selectedReport?.performed_place || ""}
                        onChange={(e) => updateReport({ performed_place: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Ex : Sur place, 12 rue…"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Notes générales</label>
                    <textarea
                      rows={4}
                      value={selectedReport?.general_notes || ""}
                      onChange={(e) => updateReport({ general_notes: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder="Ex : logement globalement propre, traces d’usage normales…"
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-900">Statut</p>
                    <p className="mt-1 text-xs text-slate-700">
                      Brouillon → Prêt → Signé (et Archivé si besoin).
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["draft", "ready", "signed", "archived"] as InventoryReport["status"][]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateReport({ status: s })}
                          className={cx(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold",
                            selectedReport?.status === s
                              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                          )}
                        >
                          {s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === "rooms" ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Pièces & éléments</p>
                      <p className="text-xs text-slate-600">Ajoute des pièces, puis des éléments par pièce (mur, sol, équipements…).</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRoomDraft({ name: "", floor_level: "", notes: "" });
                          setRoomModalOpen(true);
                        }}
                        disabled={loading}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        + Ajouter une pièce
                      </button>
                    </div>
                  </div>

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
                      Aucune pièce. Clique sur <span className="font-semibold">“Ajouter une pièce”</span> (ou crée l’EDL puis laisse le template se remplir).
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredRoomsWithItems.map(({ room, items }) => (
                        <details key={room.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden" open>
                          <summary className="cursor-pointer list-none p-4 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {room.name}{" "}
                                {room.floor_level ? <span className="text-slate-500 text-xs">• {room.floor_level}</span> : null}
                              </p>
                              {room.notes ? <p className="mt-1 text-xs text-slate-600">{room.notes}</p> : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge tone={items.length ? "emerald" : "slate"}>{items.length} élément(s)</Badge>
                              </div>
                            </div>

                            <div className="shrink-0 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openAddItem(room.id);
                                }}
                                disabled={loading}
                                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                              >
                                + Élément
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteRoom(room.id);
                                }}
                                disabled={loading}
                                className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Supprimer
                              </button>
                            </div>
                          </summary>

                          <div className="px-4 pb-4">
                            {items.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                                Aucun élément. Clique sur <span className="font-semibold">“+ Élément”</span>.
                              </div>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2">
                                {items.map((it) => (
                                  <div key={it.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
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
                                          <Badge tone="slate">
                                            État : {conditionOptions.find((x) => x.v === it.condition)?.label || it.condition}
                                          </Badge>
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
                                          onChange={(e) => updateItem(it.id, { condition: e.target.value as any })}
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
                                          onChange={(e) =>
                                            updateItem(it.id, { wear_level: e.target.value === "" ? null : Number(e.target.value) })
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
                                          onChange={(e) => updateItem(it.id, { is_clean: e.target.checked })}
                                          className="h-4 w-4"
                                        />
                                        Propre
                                      </label>

                                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={it.is_functional === true}
                                          onChange={(e) => updateItem(it.id, { is_functional: e.target.checked })}
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
                                        onChange={(e) => updateItem(it.id, { description: e.target.value })}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                                        placeholder="Décris factuellement : taille, localisation, etc."
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[0.7rem] text-slate-700">Tags défauts (virgules)</label>
                                      <input
                                        value={(it.defect_tags || []).join(", ")}
                                        onChange={(e) =>
                                          updateItem(it.id, {
                                            defect_tags: e.target.value
                                              .split(",")
                                              .map((s) => s.trim())
                                              .filter(Boolean),
                                          })
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
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      {/* MODAL: Add room */}
      <Modal
        open={roomModalOpen}
        title="Ajouter une pièce"
        onClose={() => setRoomModalOpen(false)}
        footer={
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => setRoomModalOpen(false)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={loading || !(roomDraft.name || "").trim()}
              onClick={async () => {
                const name = (roomDraft.name || "").trim();
                if (!name) return;
                await addRoom({ name, floor_level: roomDraft.floor_level, notes: roomDraft.notes });
                setRoomModalOpen(false);
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Nom *</label>
            <input
              value={roomDraft.name}
              onChange={(e) => setRoomDraft((s) => ({ ...s, name: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Ex : Chambre 3, Garage, Cave…"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Étage / niveau (optionnel)</label>
              <input
                value={roomDraft.floor_level}
                onChange={(e) => setRoomDraft((s) => ({ ...s, floor_level: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex : RDC, 1er…"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Notes (optionnel)</label>
              <input
                value={roomDraft.notes}
                onChange={(e) => setRoomDraft((s) => ({ ...s, notes: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex : pièce lumineuse, peinture récente…"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-700">
              Astuce : une pièce = un conteneur d’éléments (murs/sols/équipements). Ça rend le PDF hyper lisible.
            </p>
          </div>
        </div>
      </Modal>

      {/* MODAL: Add item */}
      <Modal
        open={itemModalOpen}
        title="Ajouter un élément"
        onClose={() => setItemModalOpen(false)}
        footer={
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => setItemModalOpen(false)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={loading || !(itemDraft.category || "").trim() || !(itemDraft.label || "").trim()}
              onClick={async () => {
                const tags = (itemDraft.defect_tags || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);

                await addItem({
                  room_id: itemRoomId,
                  category: itemDraft.category,
                  label: itemDraft.label,
                  condition: itemDraft.condition,
                  wear_level: itemDraft.wear_level === null ? null : Number(itemDraft.wear_level),
                  is_clean: !!itemDraft.is_clean,
                  is_functional: !!itemDraft.is_functional,
                  description: itemDraft.description,
                  defect_tags: tags,
                  severity: itemDraft.severity ?? 0,
                });

                setItemModalOpen(false);
              }}
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Ajouter l’élément
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Catégorie *</label>
              <input
                value={itemDraft.category}
                onChange={(e) => setItemDraft((s) => ({ ...s, category: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex : Mur, Sol, Plafond, Fenêtre…"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Élément / localisation *</label>
              <input
                value={itemDraft.label}
                onChange={(e) => setItemDraft((s) => ({ ...s, label: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex : Mur côté fenêtre, Parquet séjour…"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">État</label>
              <select
                value={itemDraft.condition}
                onChange={(e) => setItemDraft((s) => ({ ...s, condition: e.target.value as any }))}
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
                value={itemDraft.wear_level as any}
                onChange={(e) =>
                  setItemDraft((s) => ({ ...s, wear_level: e.target.value === "" ? null : Number(e.target.value) }))
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
                value={itemDraft.severity as any}
                onChange={(e) => setItemDraft((s) => ({ ...s, severity: e.target.value === "" ? 0 : Number(e.target.value) }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!itemDraft.is_clean}
                onChange={(e) => setItemDraft((s) => ({ ...s, is_clean: e.target.checked }))}
                className="h-4 w-4"
              />
              Propre
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!itemDraft.is_functional}
                onChange={(e) => setItemDraft((s) => ({ ...s, is_functional: e.target.checked }))}
                className="h-4 w-4"
              />
              Fonctionnel
            </label>
          </div>

          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Observations</label>
            <textarea
              rows={3}
              value={itemDraft.description}
              onChange={(e) => setItemDraft((s) => ({ ...s, description: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Ex : tache 3cm près de la porte, rayure 20cm…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Tags défauts (virgules)</label>
            <input
              value={itemDraft.defect_tags}
              onChange={(e) => setItemDraft((s) => ({ ...s, defect_tags: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="tache, fissure, trou, humidité…"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-700">
              Règle d’or : <span className="font-semibold">décris factuellement</span> (taille, localisation, nombre). C’est ce qui rend l’EDL solide.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
