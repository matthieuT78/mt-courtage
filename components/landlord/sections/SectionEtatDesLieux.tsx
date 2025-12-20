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
  estimated_cost: number | null; // gardé en DB, non affiché (outil légal simple)
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

// ✅ Toujours afficher EDL entrée au-dessus de sortie, quel que soit l'ordre de création
const sortReportsEntryFirst = (list: InventoryReport[]) => {
  const prio = (t: InventoryReport["report_type"]) => (t === "entry" ? 0 : 1);
  return [...list].sort((a, b) => {
    const pa = prio(a.report_type);
    const pb = prio(b.report_type);
    if (pa !== pb) return pa - pb; // entry d'abord
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // plus récent ensuite
  });
};

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

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId]
  );

  const leaseLabel = (l: Lease) => {
    const p = propertyById.get((l as any).property_id);
    const t = tenantById.get((l as any).tenant_id);
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
      // ⚠️ on ne dépend plus du tri SQL pour l'ordre d'affichage
      const { data, error } = await supabase
        .from("inventory_reports")
        .select("*")
        .eq("user_id", userId)
        .eq("lease_id", leaseId);

      if (error) throw error;

      const sorted = sortReportsEntryFirst(((data || []) as any) || []);
      setReports(sorted);

      // ✅ auto-select : entrée si existe, sinon le premier
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

  // ✅ Fix “liste parfois vide”: l'effet dépend aussi de userId.
  useEffect(() => {
    if (selectedLeaseId && userId) {
      // on évite l'effet “résidus” en changeant de bail
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

      // ✅ reload (tri + auto-select entrée)
      await loadReportsForLease(selectedLeaseId);

      // ✅ forcer la sélection du report créé si tu viens de le créer (utile si tu crées sortie)
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

  const addRoom = async () => {
    if (!supabase || !selectedReportId) return;
    const name = prompt("Nom de la pièce (ex: Chambre 3, Garage…) ?");
    if (!name) return;

    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const sort = rooms.length ? Math.max(...rooms.map((r) => r.sort_order || 0)) + 1 : 0;

      const { error } = await supabase.from("inventory_rooms").insert({
        report_id: selectedReportId,
        name,
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

  const addItem = async (roomId: string) => {
    if (!supabase || !selectedReportId) return;
    const category = prompt("Catégorie (type) — ex: Mur, Sol, Plafond, Fenêtre, Porte, Radiateur…", "Mur");
    if (!category) return;
    const label = prompt("Élément (détail/localisation) — ex: Mur côté fenêtre, Parquet séjour…", "Mur principal");
    if (!label) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase.from("inventory_items").insert({
        report_id: selectedReportId,
        room_id: roomId,
        category,
        label,
        condition: "bon",
        wear_level: 2,
        description: "",
        defect_tags: [],
        is_clean: true,
        is_functional: true,
        recommended_action: null,
        estimated_cost: null,
        severity: 0,
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

  // ✅ UX: 1 bouton = génère si besoin + ouvre le PDF
  const downloadOrGeneratePdf = async () => {
    if (!selectedReportId || !supabase) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { data: rep, error: repErr } = await supabase
        .from("inventory_reports")
        .select("id,pdf_url")
        .eq("id", selectedReportId)
        .single();

      if (repErr) throw repErr;

      if (!rep?.pdf_url) {
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

        // Refresh liste (et tri/auto-select)
        await loadReportsForLease(selectedLeaseId);
      }

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

      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
      setOk("PDF prêt ✅");
    } catch (e: any) {
      setErr(e?.message || "Erreur PDF.");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="État des lieux"
        title="Entrée / Sortie, pièces, éléments & PDF"
        desc="Outil légal simple : description précise, cohérente, et export PDF."
      />

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
        {/* LEFT */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Bail</p>
            <select
              value={selectedLeaseId}
              onChange={(e) => setSelectedLeaseId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                + EDL entrée
              </button>
              <button
                type="button"
                disabled={loading || !selectedLeaseId}
                onClick={() => createReport("exit")}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
              >
                + EDL sortie
              </button>
            </div>

            <div className="pt-2">
              <p className="text-xs text-slate-600">
                Complétude : <span className="font-semibold text-slate-900">{completeness}%</span>
              </p>
              <div className="mt-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${completeness}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">États des lieux</p>

            {reports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                {selectedLeaseId && !userId ? "Chargement utilisateur…" : "Aucun état des lieux pour ce bail."}
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => {
                  const active = r.id === selectedReportId;
                  const label = r.report_type === "entry" ? "Entrée" : "Sortie";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReportId(r.id)}
                      className={
                        "w-full text-left rounded-xl border px-3 py-3 transition " +
                        (active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                      }
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        📝 EDL {label}{" "}
                        <span className="text-slate-500 text-xs">• {new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-700">
                        Statut : <span className="font-semibold">{r.status}</span>
                        {r.pdf_url ? " • PDF ✅" : " • PDF —"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={loading || !selectedReportId}
                onClick={downloadOrGeneratePdf}
                className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {loading ? "Préparation du PDF…" : "Télécharger le PDF"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Comment remplir ?</p>
            <div className="text-sm text-slate-800 space-y-2">
              <p className="font-semibold">1) Choisis le bail puis crée l’EDL (entrée ou sortie).</p>
              <p>
                <span className="font-semibold">2) Ajoute / vérifie les pièces</span> (Entrée, Séjour, Cuisine…),
                puis ajoute des éléments importants dans chaque pièce.
              </p>
              <p>
                <span className="font-semibold">3) Catégorie vs Élément :</span>
                <br />
                <span className="font-semibold">Catégorie</span> = type (Mur, Sol, Plafond, Fenêtre…).
                <br />
                <span className="font-semibold">Élément</span> = détail/localisation (Mur côté fenêtre, Parquet séjour…).
              </p>
              <p>
                <span className="font-semibold">4) Observations :</span> factuel + mesurable. Exemple : “tache 3 cm près de la porte”, “rayures 20 cm”.
              </p>
              <p>
                <span className="font-semibold">5) Tags défauts :</span> aide à retrouver vite (tache, fissure, trou…).
              </p>
            </div>
          </div>
        </aside>

        {/* RIGHT */}
        <section className="space-y-4">
          {!selectedReportId ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
              Sélectionne un bail puis crée (ou ouvre) un état des lieux.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pièces</p>
                  <p className="text-xs text-slate-600">Ajoute des pièces puis des éléments (mur, sol, équipements…).</p>
                </div>
                <button
                  type="button"
                  onClick={addRoom}
                  disabled={loading}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  + Ajouter une pièce
                </button>
              </div>

              {roomsWithItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                  Aucune pièce. Clique sur “Ajouter une pièce”.
                </div>
              ) : (
                <div className="space-y-3">
                  {roomsWithItems.map(({ room, items }) => (
                    <div key={room.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {room.name}{" "}
                            {room.floor_level ? <span className="text-slate-500 text-xs">• {room.floor_level}</span> : null}
                          </p>
                          {room.notes ? <p className="text-xs text-slate-600">{room.notes}</p> : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => addItem(room.id)}
                            disabled={loading}
                            className="rounded-full bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
                          >
                            + Élément
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRoom(room.id)}
                            disabled={loading}
                            className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                          >
                            Supprimer pièce
                          </button>
                        </div>
                      </div>

                      {items.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                          Aucun élément dans cette pièce. Clique sur “+ Élément”.
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {items.map((it) => (
                            <div key={it.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 truncate">
                                    {it.category} • {it.label}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Gravité : {it.severity ?? 0} • Usure : {it.wear_level ?? "—"}/5
                                  </p>
                                </div>
                                <button type="button" onClick={() => deleteItem(it.id)} className="text-xs text-red-700 hover:underline">
                                  Supprimer
                                </button>
                              </div>

                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <label className="text-[0.7rem] text-slate-700">État</label>
                                  <select
                                    value={it.condition}
                                    onChange={(e) => updateItem(it.id, { condition: e.target.value as any })}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
                                      updateItem(it.id, {
                                        wear_level: e.target.value === "" ? null : Number(e.target.value),
                                      })
                                    }
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[0.7rem] text-slate-700">Tags défauts (séparés par virgule)</label>
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
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                  placeholder="tache, fissure, trou..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
