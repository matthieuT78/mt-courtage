// components/landlord/sections/SectionInventaire.tsx
import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveBoxArrowDownIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle, formatEuro } from "../UiBits";
import type { Lease, Property, PropertyFinance } from "../../../lib/landlord/types";
import { getLmnpItemStatus, propertyRequiresLmnpInventory, type LmnpInventoryStatus } from "../../../lib/landlord/lmnpInventory";

type InventoryCondition = "neuf" | "tres_bon" | "bon" | "moyen" | "a_remplacer";
type InventoryStatus = LmnpInventoryStatus;

type PropertyInventoryItem = {
  id: string;
  user_id: string;
  property_id: string;
  room: string | null;
  category: string;
  label: string;
  required_quantity: number;
  actual_quantity: number | null;
  condition: InventoryCondition;
  is_required_lmnp: boolean;
  replacement_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  userId: string;
  properties?: Property[];
  propertyFinance?: PropertyFinance[];
  leases?: Lease[];
};

const LMNP_REQUIRED_ITEMS = [
  { room: "Chambre", category: "Literie", label: "Literie avec couette ou couverture", required_quantity: 1 },
  { room: "Chambre", category: "Occultation", label: "Volets, stores ou rideaux dans les chambres", required_quantity: 1 },
  { room: "Cuisine", category: "Cuisson", label: "Plaques de cuisson", required_quantity: 1 },
  { room: "Cuisine", category: "Cuisson", label: "Four ou four micro-ondes", required_quantity: 1 },
  { room: "Cuisine", category: "Froid", label: "Réfrigérateur avec congélateur ou freezer", required_quantity: 1 },
  // Le décret n° 2015-981 impose une "vaisselle nécessaire à la prise des repas"
  // sans fixer de quantité — la pratique du secteur retient 4 à 6 couverts pour
  // un studio (majorité du parc LMNP) ; on part sur 4, borne basse prudente.
  { room: "Cuisine", category: "Vaisselle", label: "Assiettes", required_quantity: 4 },
  { room: "Cuisine", category: "Vaisselle", label: "Verres", required_quantity: 4 },
  { room: "Cuisine", category: "Vaisselle", label: "Bols", required_quantity: 4 },
  { room: "Cuisine", category: "Ustensiles", label: "Fourchettes", required_quantity: 4 },
  { room: "Cuisine", category: "Ustensiles", label: "Couteaux", required_quantity: 4 },
  { room: "Cuisine", category: "Ustensiles", label: "Cuillères", required_quantity: 4 },
  { room: "Cuisine", category: "Ustensiles", label: "Ustensiles de cuisine", required_quantity: 1 },
  { room: "Cuisine", category: "Cuisson", label: "Casseroles et poêles", required_quantity: 1 },
  { room: "Séjour", category: "Mobilier", label: "Table", required_quantity: 1 },
  { room: "Séjour", category: "Mobilier", label: "Sièges", required_quantity: 2 },
  { room: "Rangement", category: "Mobilier", label: "Étagères ou rangements", required_quantity: 1 },
  { room: "Toutes pièces", category: "Éclairage", label: "Luminaires", required_quantity: 1 },
  { room: "Entretien", category: "Ménage", label: "Matériel d’entretien adapté au logement", required_quantity: 1 },
];

const EXTRA_PRESETS = [
  { room: "Entretien", category: "Ménage", label: "Aspirateur", required_quantity: 1 },
  { room: "Chambre", category: "Literie", label: "Oreillers", required_quantity: 2 },
  { room: "Chambre", category: "Literie", label: "Protège-matelas", required_quantity: 1 },
  { room: "Cuisine", category: "Électroménager", label: "Cafetière", required_quantity: 1 },
  { room: "Cuisine", category: "Électroménager", label: "Bouilloire", required_quantity: 1 },
  { room: "Cuisine", category: "Électroménager", label: "Grille-pain", required_quantity: 1 },
  { room: "Salle de bain", category: "Linge", label: "Serviettes", required_quantity: 4 },
];

// Petit repère visuel par élément : la liste réglementaire est connue et
// fixe, donc une correspondance exacte par libellé suffit pour l'essentiel.
// Une correspondance par catégorie prend le relais pour tout élément
// personnalisé ajouté par l'utilisateur.
const ITEM_ICON_BY_LABEL: Record<string, string> = {
  "Literie avec couette ou couverture": "🛏️",
  "Volets, stores ou rideaux dans les chambres": "🪟",
  "Plaques de cuisson": "🔥",
  "Four ou four micro-ondes": "♨️",
  "Réfrigérateur avec congélateur ou freezer": "🧊",
  "Assiettes": "🍽️",
  "Verres": "🥂",
  "Bols": "🥣",
  "Fourchettes": "🍴",
  "Couteaux": "🔪",
  "Cuillères": "🥄",
  "Ustensiles de cuisine": "🍳",
  "Casseroles et poêles": "🥘",
  "Table": "🛋️",
  "Sièges": "🪑",
  "Étagères ou rangements": "🗄️",
  "Luminaires": "💡",
  "Matériel d’entretien adapté au logement": "🧹",
  "Aspirateur": "🧹",
  "Oreillers": "☁️",
  "Protège-matelas": "🛏️",
  "Cafetière": "☕",
  "Bouilloire": "🫖",
  "Grille-pain": "🍞",
  "Serviettes": "🧺",
};

const ITEM_ICON_BY_CATEGORY: Record<string, string> = {
  Literie: "🛏️",
  Occultation: "🪟",
  Cuisson: "🔥",
  Froid: "🧊",
  Vaisselle: "🍽️",
  Ustensiles: "🍴",
  Mobilier: "🛋️",
  Éclairage: "💡",
  Ménage: "🧹",
  Électroménager: "🔌",
  Linge: "🧺",
};

const DEFAULT_ITEM_ICON = "📦";

function iconForItem(item: { label: string; category: string }): string {
  return ITEM_ICON_BY_LABEL[item.label] || ITEM_ICON_BY_CATEGORY[item.category] || DEFAULT_ITEM_ICON;
}

const conditionOptions: Array<{ value: InventoryCondition; label: string }> = [
  { value: "neuf", label: "Neuf" },
  { value: "tres_bon", label: "Très bon" },
  { value: "bon", label: "Bon" },
  { value: "moyen", label: "Moyen" },
  { value: "a_remplacer", label: "À remplacer" },
];

const conditionLabel = (value: InventoryCondition) => conditionOptions.find((c) => c.value === value)?.label || value;

const statusOf = (item: PropertyInventoryItem): InventoryStatus => getLmnpItemStatus(item);

function calcItemReplacementQty(item: PropertyInventoryItem): number {
  const missingQty = Math.max(0, Number(item.required_quantity || 0) - Number(item.actual_quantity || 0));
  return statusOf(item) === "replace" ? Math.max(1, Number(item.required_quantity || 1)) : missingQty;
}

function calcReplacementBudget(items: PropertyInventoryItem[]): number {
  return items.reduce((acc, item) => acc + calcItemReplacementQty(item) * Number(item.replacement_cost || 0), 0);
}

const statusLabel = (status: InventoryStatus) => {
  if (status === "missing") return "Manquant";
  if (status === "partial") return "Incomplet";
  if (status === "replace") return "À remplacer";
  return "OK";
};

const statusTone = (status: InventoryStatus) => {
  if (status === "missing" || status === "replace") return "border-red-200 bg-red-50 text-red-800";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
};

const csvCell = (value: string | number | null | undefined) => {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(String(value || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-600">{sub}</p> : null}
    </div>
  );
}

export function SectionInventaire({ userId, properties, leases }: Props) {
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  const lmnpPropertyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of properties || []) {
      if (propertyRequiresLmnpInventory(p.id, leases, properties)) ids.add(p.id);
    }
    return ids;
  }, [properties, leases]);

  const safeProperties = useMemo(() =>
    (Array.isArray(properties) ? properties : []).filter(
      (p) => lmnpPropertyIds.has(p.id) && String(p.status || "").toLowerCase() !== "archived"
    ),
  [properties, lmnpPropertyIds]);

  const propertyById = useMemo(() => new Map(safeProperties.map((p) => [p.id, p])), [safeProperties]);

  const [items, setItems] = useState<PropertyInventoryItem[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [filterText, setFilterText] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | "">("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Saisie locale des champs numériques (quantité, coût) : on ne sauvegarde
  // qu'au blur, pas à chaque frappe — sinon l'input se désactive pendant
  // l'aller-retour Supabase et perd le focus à chaque caractère tapé.
  const [numDrafts, setNumDrafts] = useState<Record<string, { required_quantity?: string; actual_quantity?: string; replacement_cost?: string }>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);
  const [confirmDeleteBulk, setConfirmDeleteBulk] = useState(false);

  useEffect(() => {
    if (!err) return;
    const t = setTimeout(() => setErr(null), 3000);
    return () => clearTimeout(t);
  }, [err]);

  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(null), 3000);
    return () => clearTimeout(t);
  }, [ok]);

  const [form, setForm] = useState({
    room: "Cuisine",
    category: "Vaisselle",
    label: "",
    required_quantity: "1",
    actual_quantity: "1",
    condition: "bon" as InventoryCondition,
    is_required_lmnp: false,
    replacement_cost: "",
    notes: "",
  });
  const autoInitDoneRef = useRef<Set<string>>(new Set());

  const selectedProperty = selectedPropertyId ? propertyById.get(selectedPropertyId) || null : null;
  const propertyItems = useMemo(() => items.filter((item) => item.property_id === selectedPropertyId), [items, selectedPropertyId]);

  const categories = useMemo(() => Array.from(new Set(propertyItems.map((item) => item.category).filter(Boolean))).sort(), [propertyItems]);

  const summary = useMemo(() => {
    const required = propertyItems.filter((item) => item.is_required_lmnp);
    const missing = propertyItems.filter((item) => ["missing", "partial"].includes(statusOf(item)));
    const replace = propertyItems.filter((item) => statusOf(item) === "replace");
    const replacementBudget = calcReplacementBudget(propertyItems);
    const requiredOk = required.filter((item) => statusOf(item) === "ok").length;
    const compliance = required.length ? Math.round((requiredOk / required.length) * 100) : 0;
    return {
      total: propertyItems.length,
      required: required.length,
      compliance,
      missing: missing.length,
      replace: replace.length,
      replacementBudget,
    };
  }, [propertyItems]);

  const filteredItems = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    return propertyItems.filter((item) => {
      const status = statusOf(item);
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterStatus && status !== filterStatus) return false;
      if (!text) return true;
      const hay = [item.room || "", item.category, item.label, conditionLabel(item.condition), statusLabel(status), item.notes || ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(text);
    });
  }, [propertyItems, filterCategory, filterStatus, filterText]);

  const groupedByRoom = useMemo(() => {
    const map = new Map<string, PropertyInventoryItem[]>();
    for (const item of filteredItems) {
      const room = item.room || "Non classé";
      map.set(room, [...(map.get(room) || []), item]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const selectedIds = useMemo(() => Object.keys(selectedItemIds).filter((id) => selectedItemIds[id]), [selectedItemIds]);
  const allFilteredSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every((item) => !!selectedItemIds[item.id]);
  }, [filteredItems, selectedItemIds]);

  useEffect(() => {
    setSelectedItemIds({});
  }, [selectedPropertyId, filterText, filterCategory, filterStatus]);

  const toggleSelectItem = (itemId: string) => {
    setSelectedItemIds((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const toggleSelectAllFiltered = () => {
    if (filteredItems.length === 0) return;
    setSelectedItemIds((prev) => {
      const next = { ...prev };
      const target = !allFilteredSelected;
      for (const item of filteredItems) next[item.id] = target;
      return next;
    });
  };

  const actionPlan = useMemo(() => {
    const actions: string[] = [];
    if (propertyItems.length === 0) {
      actions.push("Créer l’inventaire meublé de base pour vérifier rapidement les obligations minimales.");
      return actions;
    }
    if (summary.compliance < 100) {
      actions.push(`Compléter les éléments LMNP manquants : conformité actuelle ${summary.compliance}%.`);
    }
    if (summary.replace > 0) {
      actions.push(`Remplacer ${summary.replace} élément(s) usé(s) avant relocation ou état des lieux de sortie.`);
    }
    if (summary.replacementBudget > 0) {
      actions.push(`Prévoir environ ${formatEuro(summary.replacementBudget)} pour revenir au niveau attendu.`);
    }
    if (propertyItems.some((item) => !item.replacement_cost && statusOf(item) !== "ok")) {
      actions.push("Renseigner un coût de remplacement sur les manquants pour obtenir un budget fiable.");
    }
    if (actions.length === 0) actions.push("Inventaire cohérent : contrôler les quantités avant chaque entrée/sortie de locataire.");
    return actions.slice(0, 4);
  }, [propertyItems, summary]);

  const loadInventory = async () => {
    if (!supabase || !userId) return;
    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { data, error } = await supabase
        .from("property_inventory_items")
        .select("*")
        .eq("user_id", userId)
        .order("room", { ascending: true })
        .order("category", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;
      setItems(((data || []) as PropertyInventoryItem[]) || []);
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger l’inventaire. Vérifiez que les migrations d’inventaire sont appliquées.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!selectedPropertyId && safeProperties.length > 0) setSelectedPropertyId(safeProperties[0].id);
  }, [safeProperties, selectedPropertyId]);

  // Auto-init : si le bien sélectionné est LMNP et n'a aucun item → insérer la liste réglementaire
  useEffect(() => {
    if (!supabase || !userId || !selectedPropertyId) return;
    if (!lmnpPropertyIds.has(selectedPropertyId)) return;
    if (loading) return;
    if (autoInitDoneRef.current.has(selectedPropertyId)) return;
    const hasItems = items.some((i) => i.property_id === selectedPropertyId);
    if (hasItems) return;

    autoInitDoneRef.current.add(selectedPropertyId);

    const payload = LMNP_REQUIRED_ITEMS.map((item) => ({
      user_id: userId,
      property_id: selectedPropertyId,
      room: item.room,
      category: item.category,
      label: item.label,
      required_quantity: item.required_quantity,
      actual_quantity: 0,
      condition: "bon" as InventoryCondition,
      is_required_lmnp: true,
      replacement_cost: null,
      notes: null,
    }));

    (async () => {
      const { error } = await supabase.from("property_inventory_items").insert(payload);
      if (error) {
        setErr(error.message || "Impossible d'initialiser l'inventaire LMNP.");
        autoInitDoneRef.current.delete(selectedPropertyId);
      } else {
        await loadInventory();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, items, loading, lmnpPropertyIds, userId]);

  const createBaseInventory = async () => {
    if (!supabase || !userId || !selectedPropertyId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const existingLabels = new Set(propertyItems.map((item) => item.label.toLowerCase()));
      const payload = LMNP_REQUIRED_ITEMS.filter((item) => !existingLabels.has(item.label.toLowerCase())).map((item) => ({
        user_id: userId,
        property_id: selectedPropertyId,
        room: item.room,
        category: item.category,
        label: item.label,
        required_quantity: item.required_quantity,
        actual_quantity: 0,
        condition: "bon" as InventoryCondition,
        is_required_lmnp: true,
        replacement_cost: null,
        notes: null,
      }));

      if (payload.length === 0) {
        setOk("L’inventaire LMNP de base est déjà présent.");
        return;
      }

      const { error } = await supabase.from("property_inventory_items").insert(payload);
      if (error) throw error;
      setOk(`Obligations LMNP restaurées ✅ (${payload.length} élément${payload.length > 1 ? "s" : ""} ajouté${payload.length > 1 ? "s" : ""})`);
      await loadInventory();
    } catch (e: any) {
      setErr(e?.message || "Impossible de restaurer les obligations LMNP.");
    } finally {
      setLoading(false);
    }
  };

  const addPreset = (preset: (typeof EXTRA_PRESETS)[number]) => {
    setForm((prev) => ({
      ...prev,
      room: preset.room,
      category: preset.category,
      label: preset.label,
      required_quantity: String(preset.required_quantity),
      actual_quantity: String(preset.required_quantity),
      is_required_lmnp: false,
    }));
    setAddOpen(true);
  };

  const addItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !userId || !selectedPropertyId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!form.label.trim()) throw new Error("Ajoutez un libellé.");
      const payload = {
        user_id: userId,
        property_id: selectedPropertyId,
        room: form.room.trim() || null,
        category: form.category.trim() || "Autre",
        label: form.label.trim(),
        required_quantity: Math.max(0, Math.round(num(form.required_quantity))),
        actual_quantity: form.actual_quantity.trim() === "" ? 0 : Math.max(0, Math.round(num(form.actual_quantity))),
        condition: form.condition,
        is_required_lmnp: form.is_required_lmnp,
        replacement_cost: form.replacement_cost ? Math.max(0, num(form.replacement_cost)) : null,
        notes: form.notes.trim() || null,
      };
      const { error } = await supabase.from("property_inventory_items").insert(payload);
      if (error) throw error;
      setOk("Élément ajouté ✅");
      setAddOpen(false);
      setForm((prev) => ({ ...prev, label: "", notes: "", replacement_cost: "", actual_quantity: "1", room: "Cuisine", category: "Vaisselle" }));
      await loadInventory();
    } catch (e: any) {
      setErr(e?.message || "Impossible d’ajouter l’élément.");
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (itemId: string, patch: Partial<PropertyInventoryItem>) => {
    if (!supabase || !userId) return;
    setSavingId(itemId);
    setErr(null);
    setOk(null);
    try {
      const { error } = await supabase
        .from("property_inventory_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("user_id", userId);
      if (error) throw error;
      setItems((prev) => prev.map((item) => (item.id === itemId ? ({ ...item, ...patch } as PropertyInventoryItem) : item)));
    } catch (e: any) {
      setErr(e?.message || "Impossible de mettre à jour l’élément.");
    } finally {
      setSavingId(null);
    }
  };

  const clearNumDraft = (itemId: string, field: "required_quantity" | "actual_quantity" | "replacement_cost") => {
    setNumDrafts((prev) => {
      const entry = prev[itemId];
      if (!entry || !(field in entry)) return prev;
      const { [field]: _drop, ...rest } = entry;
      const next = { ...prev };
      if (Object.keys(rest).length) next[itemId] = rest; else delete next[itemId];
      return next;
    });
  };

  const commitQuantityField = (
    item: PropertyInventoryItem,
    field: "required_quantity" | "actual_quantity",
    rawValue: string
  ) => {
    clearNumDraft(item.id, field);
    const parsed = field === "actual_quantity" && rawValue.trim() === "" ? 0 : Math.max(0, Math.round(num(rawValue)));
    if (Number(item[field] ?? 0) !== parsed) void updateItem(item.id, { [field]: parsed } as Partial<PropertyInventoryItem>);
  };

  const commitReplacementCost = (item: PropertyInventoryItem, rawValue: string) => {
    clearNumDraft(item.id, "replacement_cost");
    const parsed = rawValue.trim() === "" ? null : Math.max(0, num(rawValue));
    if ((item.replacement_cost ?? null) !== parsed) void updateItem(item.id, { replacement_cost: parsed });
  };

  const deleteItem = async (itemId: string) => {
    if (!supabase || !userId) return;
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const { error } = await supabase.from("property_inventory_items").delete().eq("id", itemId).eq("user_id", userId);
      if (error) throw error;
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setOk("Élément supprimé ✅");
    } catch (e: any) {
      setErr(e?.message || "Impossible de supprimer l’élément.");
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedItems = async () => {
    if (!supabase || !userId) return;
    const ids = selectedIds;
    if (ids.length === 0) return;

    const label = `${ids.length} élément${ids.length > 1 ? "s" : ""}`;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase
        .from("property_inventory_items")
        .delete()
        .eq("user_id", userId)
        .in("id", ids);

      if (error) throw error;

      setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
      setSelectedItemIds({});
      setOk(`${label} supprimé${ids.length > 1 ? "s" : ""} ✅`);
    } catch (e: any) {
      setErr(e?.message || "Impossible de supprimer la sélection.");
    } finally {
      setLoading(false);
    }
  };

  const exportInventory = () => {
    if (filteredItems.length === 0) {
      setErr("Aucun élément à exporter avec les filtres actuels.");
      return;
    }

    const headers = ["Bien", "Pièce", "Catégorie", "Élément", "Qté attendue", "Qté réelle", "Statut", "État", "Obligatoire LMNP", "Coût remplacement", "Notes"];
    const rows = filteredItems.map((item) => [
      selectedProperty?.label || "Bien",
      item.room || "",
      item.category,
      item.label,
      item.required_quantity,
      item.actual_quantity ?? "",
      statusLabel(statusOf(item)),
      conditionLabel(item.condition),
      item.is_required_lmnp ? "Oui" : "Non",
      Number(item.replacement_cost || 0).toFixed(2).replace(".", ","),
      item.notes || "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const propertySlug = (selectedProperty?.label || "inventaire").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `inventaire-meuble-${propertySlug || "bien"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setOk(`Export inventaire prêt ✅ (${filteredItems.length} ligne${filteredItems.length > 1 ? "s" : ""})`);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <SectionTitle
        kicker="Inventaire"
        title="Inventaire du logement meublé"
        desc="Suivez les meubles, équipements, vaisselle, linge et consommables mis à disposition. L’objectif : conformité LMNP, contrôle des manquants et budget de remplacement."
      />

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 p-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
            <ListBulletIcon className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-indigo-950">Créer la dotation</p>
            <p className="mt-0.5 text-xs leading-4 text-indigo-900/60">Charger les obligations LMNP minimales puis ajouter les équipements réellement fournis.</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl bg-violet-50 p-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100">
            <MagnifyingGlassIcon className="h-4 w-4 text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-violet-950">Contrôler les quantités</p>
            <p className="mt-0.5 text-xs leading-4 text-violet-900/60">Attendu vs réel, état de chaque élément, coût unitaire de remplacement.</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 p-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <ArchiveBoxArrowDownIcon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-950">Formaliser via l’état des lieux</p>
            <p className="mt-0.5 text-xs leading-4 text-emerald-900/60">L’entrée et la sortie se documentent dans le module État des lieux, déjà relié à cet inventaire — PDF et signature inclus.</p>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr,auto] lg:items-end">
          <div>
            <label className="text-xs font-semibold text-slate-600">Bien à inventorier</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              disabled={safeProperties.length === 0}
            >
              {safeProperties.length === 0
                ? <option value="">Aucun bien LMNP — configurez le régime fiscal dans Finance</option>
                : safeProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.label || `${property.address_line1 || "Bien"} ${property.city || ""}`.trim()}
                    </option>
                  ))
              }
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadInventory}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowPathIcon className="h-4 w-4" />
              {loading ? "Chargement..." : "Actualiser"}
            </button>
            <button
              type="button"
              onClick={createBaseInventory}
              disabled={!selectedPropertyId || loading}
              className={cx("inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50", (!selectedPropertyId || loading) && "opacity-60")}
            >
              <HomeModernIcon className="h-4 w-4" />
              Restaurer obligations LMNP
            </button>
          </div>
        </div>
        {(selectedProperty as any)?.type === "building" && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            Cet immeuble a plusieurs lots : l’inventaire mobilier reste partagé au niveau de l’immeuble pour l’instant —
            un élément déclaré ici s’applique à tous les lots, il n’est pas encore possible de le distinguer par lot.
          </p>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Éléments</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
          <p className="mt-1 text-xs text-slate-500">dans le bien sélectionné</p>
        </div>
        <div className={cx("rounded-2xl border p-4", summary.compliance === 100 ? "border-emerald-200 bg-emerald-50" : summary.compliance >= 80 ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50")}>
          <p className={cx("text-[0.7rem] uppercase tracking-[0.18em]", summary.compliance === 100 ? "text-emerald-700" : summary.compliance >= 80 ? "text-amber-700" : "text-red-700")}>Conformité LMNP</p>
          <p className={cx("mt-1 text-2xl font-bold", summary.compliance === 100 ? "text-emerald-900" : summary.compliance >= 80 ? "text-amber-900" : "text-red-900")}>{summary.compliance}%</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-white/60">
            <div
              className={cx("h-1.5 rounded-full transition-all duration-500", summary.compliance === 100 ? "bg-emerald-500" : summary.compliance >= 80 ? "bg-amber-500" : "bg-red-500")}
              style={{ width: `${summary.compliance}%` }}
            />
          </div>
          <p className={cx("mt-1.5 text-xs", summary.compliance === 100 ? "text-emerald-700" : summary.compliance >= 80 ? "text-amber-700" : "text-red-700")}>{summary.required} obligatoire{summary.required > 1 ? "s" : ""}</p>
        </div>
        <div className={cx("rounded-2xl border p-4", summary.missing > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white")}>
          <p className={cx("text-[0.7rem] uppercase tracking-[0.18em]", summary.missing > 0 ? "text-red-700" : "text-slate-500")}>Manquants</p>
          <p className={cx("mt-1 text-2xl font-bold", summary.missing > 0 ? "text-red-900" : "text-slate-900")}>{summary.missing}</p>
          <p className={cx("mt-1 text-xs", summary.missing > 0 ? "text-red-600" : "text-slate-500")}>quantité insuffisante</p>
        </div>
        <div className={cx("rounded-2xl border p-4", summary.replacementBudget > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white")}>
          <p className={cx("text-[0.7rem] uppercase tracking-[0.18em]", summary.replacementBudget > 0 ? "text-amber-700" : "text-slate-500")}>Budget</p>
          <p className={cx("mt-1 text-2xl font-bold", summary.replacementBudget > 0 ? "text-amber-900" : "text-slate-900")}>{formatEuro(summary.replacementBudget)}</p>
          <p className={cx("mt-1 text-xs", summary.replacementBudget > 0 ? "text-amber-700" : "text-slate-500")}>remplacement estimé</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-5 w-5 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-900">Plan d’action</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">Ce qu’il reste à traiter avant une entrée, une relocation ou un contrôle.</p>
          <div className="mt-4 space-y-2">
            {actionPlan.map((action, index) => (
              <div key={index} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 mt-0.5">{index + 1}</span>
                <p className="text-sm leading-5 text-slate-800">{action}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Ajout rapide</p>
              <p className="mt-1 text-xs text-slate-600">Complétez la base avec les équipements réellement fournis dans le logement.</p>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <PlusIcon className="h-4 w-4" />
              Nouvel élément
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {EXTRA_PRESETS.map((preset) => (
              <button
                key={`${preset.category}-${preset.label}`}
                type="button"
                onClick={() => addPreset(preset)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span aria-hidden="true">{iconForItem(preset)}</span> + {preset.label}
              </button>
            ))}
          </div>

          {addOpen ? (
            <form onSubmit={addItem} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input value={form.room} onChange={(e) => setForm((s) => ({ ...s, room: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Pièce" />
                <input value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Catégorie" />
                <input value={form.label} onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))} className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Ex : assiettes plates, aspirateur, couette..." />
                <input inputMode="numeric" value={form.required_quantity} onChange={(e) => setForm((s) => ({ ...s, required_quantity: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Quantité attendue" />
                <input inputMode="numeric" value={form.actual_quantity} onChange={(e) => setForm((s) => ({ ...s, actual_quantity: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Quantité réelle" />
                <select value={form.condition} onChange={(e) => setForm((s) => ({ ...s, condition: e.target.value as InventoryCondition }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  {conditionOptions.map((condition) => (
                    <option key={condition.value} value={condition.value}>
                      {condition.label}
                    </option>
                  ))}
                </select>
                <input inputMode="decimal" value={form.replacement_cost} onChange={(e) => setForm((s) => ({ ...s, replacement_cost: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Coût remplacement unitaire" />
                <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.is_required_lmnp} onChange={(e) => setForm((s) => ({ ...s, is_required_lmnp: e.target.checked }))} className="h-4 w-4" />
                  Élément obligatoire pour un logement meublé
                </label>
                <input value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Note : marque, emplacement, précision..." />
              </div>
              <div className="mt-3 flex justify-end">
                <button type="submit" disabled={loading || !selectedPropertyId} className={cx("rounded-full px-4 py-2 text-sm font-semibold", brandBg, brandText, brandHover, (loading || !selectedPropertyId) && "opacity-60")}>
                  Ajouter
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Inventaire détaillé</p>
            <p className="mt-1 text-xs text-slate-600">Contrôlez les quantités : attendu vs réel, état, coût de remplacement et conformité meublée.</p>
          </div>
          <button
            type="button"
            onClick={exportInventory}
            disabled={filteredItems.length === 0}
            className={cx("inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold", filteredItems.length === 0 ? "bg-slate-200 text-slate-600" : `${brandBg} ${brandText} ${brandHover}`)}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export Excel
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr,220px,220px]">
          <input value={filterText} onChange={(e) => setFilterText(e.target.value)} className="rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm" placeholder="Rechercher : assiette, aspirateur, chambre..." />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
            <option value="">Toutes catégories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as InventoryStatus | "")} className="rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
            <option value="">Tous statuts</option>
            <option value="missing">Manquant</option>
            <option value="partial">Incomplet</option>
            <option value="replace">À remplacer</option>
            <option value="ok">OK</option>
          </select>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAllFiltered}
              disabled={filteredItems.length === 0 || loading}
              className="h-4 w-4"
            />
            Sélectionner les éléments affichés
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}
            </span>
            {selectedIds.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedItemIds({})}
                disabled={loading}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                Annuler la sélection
              </button>
            ) : null}
            {confirmDeleteBulk ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-700">Supprimer {selectedIds.length} élément(s) ?</span>
                <button type="button" onClick={() => { setConfirmDeleteBulk(false); void deleteSelectedItems(); }} className="rounded-full bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700">Oui</button>
                <button type="button" onClick={() => setConfirmDeleteBulk(false)} className="rounded-full border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Non</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteBulk(true)}
                disabled={loading || selectedIds.length === 0}
                className={cx(
                  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
                  selectedIds.length === 0 ? "bg-slate-200 text-slate-600" : "bg-red-600 text-white hover:bg-red-500",
                  loading && "opacity-60"
                )}
              >
                <TrashIcon className="h-4 w-4" />
                Supprimer la sélection
              </button>
            )}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-900">Aucun élément dans l’inventaire</p>
            <p className="mt-1 text-sm text-slate-600">Créez la base LMNP ou ajoutez vos premiers équipements.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {groupedByRoom.map(([room, roomItems]) => (
              <div key={room} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{room}</p>
                <div className="mt-3 space-y-2">
                  {roomItems.map((item) => {
                    const status = statusOf(item);
                    const isSelected = !!selectedItemIds[item.id];
                    return (
                      <div
                        key={item.id}
                        className={cx(
                          "rounded-2xl border bg-white p-3 transition",
                          isSelected ? "border-cyan-300 ring-2 ring-cyan-100" : "border-slate-200"
                        )}
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectItem(item.id)}
                              disabled={loading}
                              className="mt-1 h-4 w-4 shrink-0"
                              aria-label={`Sélectionner ${item.label}`}
                            />
                            <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base leading-none" aria-hidden="true">{iconForItem(item)}</span>
                              <p className="font-semibold text-slate-900">{item.label}</p>
                              <span className={cx("rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", statusTone(status))}>{statusLabel(status)}</span>
                              {item.is_required_lmnp ? <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[0.7rem] font-semibold text-cyan-800">LMNP</span> : null}
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                              {item.category} · attendu {item.required_quantity} · réel {item.actual_quantity ?? "—"}
                              {item.notes ? ` · ${item.notes}` : ""}
                            </p>
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-5 xl:w-[700px]">
                            <div className="flex flex-col gap-1">
                              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Attendu</span>
                              <input
                                inputMode="numeric"
                                value={numDrafts[item.id]?.required_quantity ?? String(item.required_quantity)}
                                disabled={savingId === item.id}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setNumDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], required_quantity: v } }));
                                }}
                                onBlur={(e) => commitQuantityField(item, "required_quantity", e.target.value)}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Réel</span>
                              <input
                                inputMode="numeric"
                                value={numDrafts[item.id]?.actual_quantity ?? String(item.actual_quantity ?? "")}
                                disabled={savingId === item.id}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setNumDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], actual_quantity: v } }));
                                }}
                                onBlur={(e) => commitQuantityField(item, "actual_quantity", e.target.value)}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">État</span>
                              <select
                                value={item.condition}
                                disabled={savingId === item.id}
                                onChange={(e) => updateItem(item.id, { condition: e.target.value as InventoryCondition })}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                              >
                                {conditionOptions.map((condition) => (
                                  <option key={condition.value} value={condition.value}>
                                    {condition.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Coût unit.</span>
                              <input
                                inputMode="decimal"
                                value={numDrafts[item.id]?.replacement_cost ?? String(item.replacement_cost ?? "")}
                                disabled={savingId === item.id}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setNumDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], replacement_cost: v } }));
                                }}
                                onBlur={(e) => commitReplacementCost(item, e.target.value)}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                placeholder="0 €"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400 invisible">—</span>
                              {confirmDeleteItemId === item.id ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-red-700">Confirmer ?</span>
                                  <button type="button" onClick={() => { void deleteItem(item.id); setConfirmDeleteItemId(null); }} className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">Oui</button>
                                  <button type="button" onClick={() => setConfirmDeleteItemId(null)} className="rounded-md border px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Non</button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteItemId(item.id)}
                                  className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                                  title="Supprimer"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
