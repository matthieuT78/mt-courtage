import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";

/* ======================================================
   TYPES
====================================================== */

export type Lease = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  rent_amount: number | null;
  charges_amount: number | null;
  deposit_amount: number | null;
  payment_day: number | null;
  payment_method: string | null;

  // ✅ Nouveau (plus clair que "type")
  payment_type?: string | null; // "terme_a_echoir" | "terme_echu"

  status: string | null;
  auto_reminder_enabled: boolean | null;
  auto_quittance_enabled: boolean | null;
  reminder_day_of_month: number | null;
  reminder_email: string | null;
  tenant_receipt_email: string | null;
  timezone: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PropertyLite = {
  id: string;
  label: string | null;
  city?: string | null;
};

export type TenantLite = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Contact = {
  id: string;
  user_id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  contact_type?: string | null; // "guarantor"
  archived_at?: string | null;
};

type Props = {
  userId: string;
  leases?: Lease[];
  properties?: PropertyLite[];
  tenants?: TenantLite[];
  onRefresh: () => Promise<void>;
};

type Mode = "idle" | "view" | "edit" | "create";

/* ======================================================
   HELPERS
====================================================== */

const todayISO = () => new Date().toISOString().slice(0, 10);

const clampInt = (v: string, min: number, max: number, fallback: number) => {
  const n = parseInt(v || "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const toNumberOrNull = (v: string) => {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const formatEuro = (val: number | null | undefined) => {
  if (val == null || Number.isNaN(val as any)) return "—";
  return Number(val).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const badge = (tone: "slate" | "emerald" | "amber" | "red", label: string) => {
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
      {label}
    </span>
  );
};

const withTimeout = async <T,>(p: Promise<T>, ms = 4000): Promise<T> => {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout réseau (${ms}ms)`)), ms)),
  ]);
};

const stop = (e: React.SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const buildFullName = (first?: string, last?: string) =>
  [String(first || "").trim(), String(last || "").trim()].filter(Boolean).join(" ").trim();

const isArchivedContact = (c: Contact) => !!c.archived_at;

/* ======================================================
   COMPONENT
====================================================== */

export function SectionBaux({ userId, leases, properties, tenants, onRefresh }: Props) {
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeProps = Array.isArray(properties) ? properties : [];
  const safeTenants = Array.isArray(tenants) ? tenants : [];

  const propertyById = useMemo(() => {
    const m = new Map<string, PropertyLite>();
    for (const p of safeProps) m.set(p.id, p);
    return m;
  }, [safeProps]);

  const tenantById = useMemo(() => {
    const m = new Map<string, TenantLite>();
    for (const t of safeTenants) m.set(t.id, t);
    return m;
  }, [safeTenants]);

  const [mode, setMode] = useState<Mode>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => safeLeases.find((l) => l.id === selectedId) || null, [safeLeases, selectedId]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Mini-filtres
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "ended" | "draft">("all");

  const filteredLeases = useMemo(() => {
    const query = q.trim().toLowerCase();
    return safeLeases
      .filter((l) => (statusFilter === "all" ? true : (l.status || "").toLowerCase() === statusFilter))
      .filter((l) => {
        if (!query) return true;
        const p = propertyById.get(l.property_id);
        const t = tenantById.get(l.tenant_id);
        const hay = [p?.label, t?.full_name, l.start_date, l.end_date || "", String(l.rent_amount ?? "")]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
  }, [safeLeases, q, statusFilter, propertyById, tenantById]);

  // Form (create/edit)
  const [form, setForm] = useState({
    property_id: "",
    tenant_id: "",
    start_date: todayISO(),
    end_date: "",
    rent_amount: "",
    charges_amount: "",
    deposit_amount: "",
    payment_day: "1",
    payment_method: "virement",

    // ✅ plus clair
    payment_type: "terme_a_echoir",

    status: "active",
    auto_quittance_enabled: true,
    auto_reminder_enabled: false,
    reminder_day_of_month: "1",
    reminder_email: "",
    tenant_receipt_email: "",
    timezone: "Europe/Paris",
  });

  const resetForm = () => {
    setForm({
      property_id: "",
      tenant_id: "",
      start_date: todayISO(),
      end_date: "",
      rent_amount: "",
      charges_amount: "",
      deposit_amount: "",
      payment_day: "1",
      payment_method: "virement",
      payment_type: "terme_a_echoir",
      status: "active",
      auto_quittance_enabled: true,
      auto_reminder_enabled: false,
      reminder_day_of_month: "1",
      reminder_email: "",
      tenant_receipt_email: "",
      timezone: "Europe/Paris",
    });
  };

  // Garants (contacts + liaison)
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [guarantorIds, setGuarantorIds] = useState<string[]>([]);

  const activeGuarantors = useMemo(
    () => contacts.filter((c) => (c.contact_type || "") === "guarantor").filter((c) => !isArchivedContact(c)),
    [contacts]
  );

  const loadContacts = async () => {
    if (!userId) return;
    setContactsLoading(true);
    try {
      if (!supabase) throw new Error("Supabase non initialisé.");

      const { data, error } = await supabase
        .from("contacts")
        .select("id,user_id,full_name,first_name,last_name,email,phone,notes,contact_type,archived_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(Array.isArray(data) ? (data as any) : []);
    } catch (e: any) {
      console.error("[SectionBaux] loadContacts error:", e);
      setErr(e?.message || "Impossible de charger les contacts (garants).");
    } finally {
      setContactsLoading(false);
    }
  };

  const loadGuarantorsForLease = async (leaseId: string) => {
    if (!userId) return;
    try {
      if (!supabase) throw new Error("Supabase non initialisé.");

      const { data, error } = await supabase
        .from("lease_guarantors")
        .select("contact_id")
        .eq("user_id", userId)
        .eq("lease_id", leaseId);

      if (error) throw error;

      const ids = (Array.isArray(data) ? data : []).map((r: any) => r.contact_id).filter(Boolean);
      setGuarantorIds(ids);
    } catch (e: any) {
      console.error("[SectionBaux] loadGuarantorsForLease error:", e);
      // pas bloquant
    }
  };

  const toggleGuarantor = (id: string) => {
    setGuarantorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const removeGuarantorFromSelection = (id: string) => {
    setGuarantorIds((prev) => prev.filter((x) => x !== id));
  };

  const syncGuarantors = async (leaseId: string) => {
    if (!userId) return;
    if (!supabase) throw new Error("Supabase non initialisé.");

    const { error: delErr } = await supabase.from("lease_guarantors").delete().eq("user_id", userId).eq("lease_id", leaseId);
    if (delErr) throw delErr;

    if (!guarantorIds.length) return;

    const rows = guarantorIds.map((contact_id) => ({
      user_id: userId,
      lease_id: leaseId,
      contact_id,
    }));

    const { error: insErr } = await supabase.from("lease_guarantors").insert(rows);
    if (insErr) throw insErr;
  };

  // Form création garant
  const [guarantorForm, setGuarantorForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const createGuarantor = async () => {
    if (!userId) return;
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");

      const full_name = buildFullName(guarantorForm.first_name, guarantorForm.last_name);
      if (!full_name) throw new Error("Renseigne au moins le prénom ou le nom du garant.");

      const payload = {
        user_id: userId,
        first_name: guarantorForm.first_name.trim() || null,
        last_name: guarantorForm.last_name.trim() || null,
        full_name: full_name || null,
        email: guarantorForm.email.trim() || null,
        phone: guarantorForm.phone.trim() || null,
        notes: guarantorForm.notes.trim() || null,
        contact_type: "guarantor",
      };

      const { data, error } = await supabase.from("contacts").insert(payload).select("id").single();
      if (error) throw error;

      await loadContacts();

      const newId = (data as any)?.id;
      if (newId) setGuarantorIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));

      setGuarantorForm({ first_name: "", last_name: "", email: "", phone: "", notes: "" });
      setOk("Garant ajouté ✅");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’ajouter le garant.");
    }
  };

  // ✅ MODAL édition garant
  const [editGuarantorOpen, setEditGuarantorOpen] = useState(false);
  const [editGuarantorId, setEditGuarantorId] = useState<string | null>(null);
  const [editGuarantorDraft, setEditGuarantorDraft] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const openEditGuarantor = (c: Contact) => {
    setEditGuarantorId(c.id);
    setEditGuarantorDraft({
      first_name: String(c.first_name || ""),
      last_name: String(c.last_name || ""),
      email: String(c.email || ""),
      phone: String(c.phone || ""),
      notes: String(c.notes || ""),
    });
    setEditGuarantorOpen(true);
  };

  const updateGuarantor = async () => {
    if (!userId || !editGuarantorId) return;
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");

      const full_name = buildFullName(editGuarantorDraft.first_name, editGuarantorDraft.last_name);
      if (!full_name) throw new Error("Le garant doit avoir au moins un prénom ou un nom.");

      const patch = {
        first_name: editGuarantorDraft.first_name.trim() || null,
        last_name: editGuarantorDraft.last_name.trim() || null,
        full_name: full_name || null,
        email: editGuarantorDraft.email.trim() || null,
        phone: editGuarantorDraft.phone.trim() || null,
        notes: editGuarantorDraft.notes.trim() || null,
        contact_type: "guarantor",
        archived_at: null, // si jamais tu ré-édites un contact archivé
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("contacts").update(patch).eq("id", editGuarantorId).eq("user_id", userId);
      if (error) throw error;

      await loadContacts();
      setOk("Garant mis à jour ✅");
      setEditGuarantorOpen(false);
      setEditGuarantorId(null);
    } catch (e: any) {
      setErr(e?.message || "Impossible de mettre à jour le garant.");
    }
  };

  // ✅ suppression = archivage (et unlink si bail existant)
  const archiveGuarantor = async (contactId: string) => {
    if (!userId) return;
    if (!confirm("Archiver ce garant ? (il ne sera plus sélectionnable)")) return;

    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");

      const { error } = await supabase
        .from("contacts")
        .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", contactId)
        .eq("user_id", userId);

      if (error) throw error;

      // retire de l'UI
      removeGuarantorFromSelection(contactId);

      // si on est sur un bail existant (edit/view), on supprime aussi la liaison immédiatement
      const leaseId = selected?.id || selectedId;
      if (leaseId) {
        await supabase.from("lease_guarantors").delete().eq("user_id", userId).eq("lease_id", leaseId).eq("contact_id", contactId);
      }

      await loadContacts();
      setOk("Garant archivé 🗑️");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’archiver le garant.");
    }
  };

  // init contacts au montage
  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Quand on ouvre “create”
  const openCreate = () => {
    setErr(null);
    setOk(null);
    setSelectedId(null);
    resetForm();
    setGuarantorIds([]);
    setMode("create");
  };

  // Quand on ouvre “view”
  const openView = async (id: string) => {
    setErr(null);
    setOk(null);
    setSelectedId(id);
    setMode("view");
    await loadGuarantorsForLease(id);
  };

  // Quand on passe en “edit”
  const openEdit = async () => {
    if (!selected) return;
    setErr(null);
    setOk(null);
    setForm({
      property_id: selected.property_id || "",
      tenant_id: selected.tenant_id || "",
      start_date: selected.start_date || todayISO(),
      end_date: selected.end_date || "",
      rent_amount: selected.rent_amount != null ? String(selected.rent_amount) : "",
      charges_amount: selected.charges_amount != null ? String(selected.charges_amount) : "",
      deposit_amount: selected.deposit_amount != null ? String(selected.deposit_amount) : "",
      payment_day: selected.payment_day != null ? String(selected.payment_day) : "1",
      payment_method: selected.payment_method || "virement",
      payment_type: (selected.payment_type as any) || "terme_a_echoir",
      status: selected.status || "active",
      auto_quittance_enabled: !!selected.auto_quittance_enabled,
      auto_reminder_enabled: !!selected.auto_reminder_enabled,
      reminder_day_of_month: selected.reminder_day_of_month != null ? String(selected.reminder_day_of_month) : "1",
      reminder_email: selected.reminder_email || "",
      tenant_receipt_email: selected.tenant_receipt_email || "",
      timezone: selected.timezone || "Europe/Paris",
    });
    await loadGuarantorsForLease(selected.id);
    setMode("edit");
  };

  const closeDrawer = () => {
    setMode("idle");
    setErr(null);
  };

  const safeRefresh = async () => {
    try {
      await withTimeout(onRefresh(), 4000);
    } catch (e: any) {
      console.warn("[SectionBaux] refresh skipped:", e?.message || e);
    }
  };

  /* ======================================================
     PDF MODAL (premium) - inchangé
  ====================================================== */

  const PDF_URL = "/docs/votre-habitat-repare-entretien.pdf";
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!guideOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGuideOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [guideOpen]);

  /* ======================================================
     CRUD
  ====================================================== */

  const saveLease = async () => {
    if (!userId) {
      setErr("userId manquant (DashboardShell / useLandlordDashboard).");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");
      if (!form.property_id) throw new Error("Veuillez sélectionner un bien.");
      if (!form.tenant_id) throw new Error("Veuillez sélectionner un locataire.");
      if (!form.start_date) throw new Error("La date de début de bail est obligatoire.");
      if (mode === "edit" && !selectedId) throw new Error("Impossible de modifier : bail non sélectionné.");

      const paymentDayNum = clampInt(form.payment_day, 1, 31, 1);
      const reminderDayNum = clampInt(form.reminder_day_of_month, 1, 31, 1);

      const rent = toNumberOrNull(form.rent_amount) ?? 0;
      const charges = toNumberOrNull(form.charges_amount) ?? 0;
      const deposit = toNumberOrNull(form.deposit_amount);

      const payload: any = {
        user_id: userId,
        property_id: form.property_id,
        tenant_id: form.tenant_id,
        start_date: form.start_date,
        end_date: form.end_date ? form.end_date : null,
        rent_amount: rent,
        charges_amount: charges,
        deposit_amount: deposit,
        payment_day: paymentDayNum,
        payment_method: form.payment_method || null,
        payment_type: form.payment_type || null,
        status: form.status || "active",
        auto_quittance_enabled: !!form.auto_quittance_enabled,
        auto_reminder_enabled: !!form.auto_reminder_enabled,
        reminder_day_of_month: reminderDayNum,
        reminder_email: form.reminder_email ? form.reminder_email : null,
        tenant_receipt_email: form.tenant_receipt_email ? form.tenant_receipt_email : null,
        timezone: form.timezone || "Europe/Paris",
      };

      let leaseId = selectedId;

      if (mode === "edit" && selectedId) {
        const { error } = await supabase.from("leases").update(payload).eq("id", selectedId).eq("user_id", userId);
        if (error) throw error;
        leaseId = selectedId;
        setOk("Bail mis à jour ✅");
        setMode("view");
      } else {
        const { data, error } = await supabase.from("leases").insert(payload).select("id").single();
        if (error) throw error;
        leaseId = (data as any)?.id ?? null;
        setOk("Bail créé ✅");
        setSelectedId(leaseId);
        setMode("idle");
      }

      if (leaseId) {
        await syncGuarantors(leaseId);
      }

      safeRefresh();
    } catch (e: any) {
      console.error("[saveLease] error:", e);
      setErr(e?.message || "Erreur lors de l’enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!userId || !selectedId) return;
    if (!confirm("Supprimer ce bail ? (Quittances/loyers liés peuvent empêcher la suppression)")) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      await supabase.from("lease_guarantors").delete().eq("user_id", userId).eq("lease_id", selectedId);

      const { error } = await supabase.from("leases").delete().eq("id", selectedId).eq("user_id", userId);
      if (error) throw error;

      setOk("Bail supprimé ✅");
      setSelectedId(null);
      setMode("idle");
      safeRefresh();
    } catch (e: any) {
      console.error("[SectionBaux] delete error:", e);
      setErr(e?.message || "Suppression impossible (quittances/loyers existants ?).");
    } finally {
      setLoading(false);
    }
  };

  /* ======================================================
     UI HELPERS
  ====================================================== */

  const leaseCardLabel = (l: Lease) => {
    const p = propertyById.get(l.property_id);
    const t = tenantById.get(l.tenant_id);
    return {
      title: `${p?.label || "Bien"} • ${t?.full_name || "Locataire"}`,
      sub: `Début : ${l.start_date}${l.end_date ? ` • Fin : ${l.end_date}` : ""}`,
      total: Number(l.rent_amount || 0) + Number(l.charges_amount || 0),
    };
  };

  const statusTone = (s?: string | null) => {
    const v = (s || "").toLowerCase();
    if (v === "active") return "emerald" as const;
    if (v === "ended") return "amber" as const;
    if (v === "draft") return "slate" as const;
    return "slate" as const;
  };

  const drawerOpen = mode !== "idle";
  const drawerTitle = mode === "create" ? "Nouveau bail" : mode === "edit" ? "Modifier le bail" : "Consulter le bail";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle kicker="Baux" title="Contrats" desc="Liste + fiche. Ajoute/modifie/supprime des garants et synchronise en base." />

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (bien, locataire, date…)…"
            className="w-full sm:w-80 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full sm:w-44 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="draft">Brouillons</option>
            <option value="ended">Terminés</option>
          </select>
        </div>

        <button
          type="button"
          onClick={(e) => {
            stop(e);
            openCreate();
          }}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          + Nouveau bail
        </button>
      </div>

      {/* List */}
      {filteredLeases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
          Aucun bail. Clique sur <span className="font-semibold">“Nouveau bail”</span>.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredLeases.map((l) => {
            const meta = leaseCardLabel(l);
            return (
              <button
                key={l.id}
                type="button"
                onClick={(e) => {
                  stop(e);
                  openView(l.id);
                }}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{meta.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{meta.sub}</p>
                    <p className="mt-2 text-xs text-slate-700">
                      Total mensuel : <span className="font-semibold">{formatEuro(meta.total)}</span>{" "}
                      <span className="text-slate-500">
                        ({formatEuro(l.rent_amount)} + {formatEuro(l.charges_amount)})
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {badge(statusTone(l.status), (l.status || "—").toUpperCase())}
                    {badge(l.auto_quittance_enabled ? "emerald" : "amber", l.auto_quittance_enabled ? "Quittance auto" : "Quittance manuel")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50">
          <button type="button" onClick={closeDrawer} className="absolute inset-0 bg-black/30" aria-label="Fermer" />

          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Baux</p>
                <p className="text-base font-semibold text-slate-900">{drawerTitle}</p>
                {mode !== "create" && selected ? <p className="mt-1 text-xs text-slate-600">{leaseCardLabel(selected).title}</p> : null}
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <div className="p-4 overflow-auto space-y-4">
              {/* VIEW */}
              {mode === "view" ? (
                !selected ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    Bail introuvable (rafraîchis la liste).
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {badge(statusTone(selected.status), (selected.status || "—").toUpperCase())}
                        {badge(selected.auto_quittance_enabled ? "emerald" : "amber", selected.auto_quittance_enabled ? "Quittance auto" : "Quittance manuel")}
                        {badge(selected.auto_reminder_enabled ? "emerald" : "slate", selected.auto_reminder_enabled ? "Rappel ON" : "Rappel OFF")}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 mt-3 text-sm text-slate-800">
                        <div>
                          <p className="text-xs text-slate-500">Début</p>
                          <p className="font-semibold">{selected.start_date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Fin</p>
                          <p className="font-semibold">{selected.end_date || "—"}</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">Total mensuel</p>
                          <p className="font-semibold">{formatEuro(Number(selected.rent_amount || 0) + Number(selected.charges_amount || 0))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Paiement</p>
                          <p className="font-semibold">
                            Jour {selected.payment_day ?? "—"} • {selected.payment_method || "—"}
                          </p>
                          <p className="text-xs text-slate-500">
                            Échéance :{" "}
                            <span className="font-semibold">
                              {selected.payment_type === "terme_echu"
                                ? "Fin de période"
                                : selected.payment_type === "terme_a_echoir"
                                ? "Début de période"
                                : "—"}
                            </span>
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">Dépôt</p>
                          <p className="font-semibold">{formatEuro(selected.deposit_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Timezone</p>
                          <p className="font-semibold">{selected.timezone || "Europe/Paris"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Garants (view) */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-900">Garants</p>
                      {guarantorIds.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">Aucun garant associé.</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {guarantorIds
                            .map((id) => contacts.find((c) => c.id === id))
                            .filter(Boolean)
                            .map((c) => (
                              <span
                                key={(c as any).id}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800"
                              >
                                {(c as any).full_name || "Garant"}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          stop(e);
                          openEdit();
                        }}
                        className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        disabled={loading}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          stop(e);
                          onDelete();
                        }}
                        className="rounded-full border border-red-300 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        disabled={loading}
                      >
                        Supprimer
                      </button>
                    </div>
                  </>
                )
              ) : null}

              {/* CREATE / EDIT */}
              {mode === "create" || mode === "edit" ? (
                <div className="space-y-3" data-stop-nav>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Bien</label>
                        <select
                          value={form.property_id}
                          onChange={(e) => setForm((s) => ({ ...s, property_id: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">— Sélectionner —</option>
                          {safeProps.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label || "Bien"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Locataire</label>
                        <select
                          value={form.tenant_id}
                          onChange={(e) => setForm((s) => ({ ...s, tenant_id: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">— Sélectionner —</option>
                          {safeTenants.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name || "Locataire"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Début de bail *</label>
                        <input
                          type="date"
                          value={form.start_date}
                          onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Fin (optionnel)</label>
                        <input
                          type="date"
                          value={form.end_date}
                          onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Loyer (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.rent_amount}
                          onChange={(e) => setForm((s) => ({ ...s, rent_amount: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Charges (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.charges_amount}
                          onChange={(e) => setForm((s) => ({ ...s, charges_amount: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Dépôt (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.deposit_amount}
                          onChange={(e) => setForm((s) => ({ ...s, deposit_amount: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Jour paiement (1–31)</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={form.payment_day}
                          onChange={(e) => setForm((s) => ({ ...s, payment_day: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Mode paiement</label>
                        <select
                          value={form.payment_method}
                          onChange={(e) => setForm((s) => ({ ...s, payment_method: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="virement">Virement</option>
                          <option value="prelevement">Prélèvement</option>
                          <option value="cheque">Chèque</option>
                          <option value="especes">Espèces</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Échéance</label>
                        <select
                          value={form.payment_type}
                          onChange={(e) => setForm((s) => ({ ...s, payment_type: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="terme_a_echoir">Début de période</option>
                          <option value="terme_echu">Fin de période</option>
                        </select>
                        <p className="text-[0.7rem] text-slate-500">Début = à échoir • Fin = à échu</p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Statut</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="active">Actif</option>
                          <option value="ended">Terminé</option>
                          <option value="draft">Brouillon</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Timezone</label>
                        <select
                          value={form.timezone}
                          onChange={(e) => setForm((s) => ({ ...s, timezone: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="Europe/Paris">Europe/Paris</option>
                          <option value="Europe/London">Europe/London</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 pt-1">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!form.auto_quittance_enabled}
                          onChange={(e) => setForm((s) => ({ ...s, auto_quittance_enabled: e.target.checked }))}
                          className="h-4 w-4"
                        />
                        Quittance auto
                      </label>

                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!form.auto_reminder_enabled}
                          onChange={(e) => setForm((s) => ({ ...s, auto_reminder_enabled: e.target.checked }))}
                          className="h-4 w-4"
                        />
                        Rappel auto
                      </label>
                    </div>
                  </div>

                  {/* ✅ GARANTS */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">Garants</p>
                      <button
                        type="button"
                        onClick={() => loadContacts()}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Rafraîchir
                      </button>
                    </div>

                    {/* Ajout garant */}
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Ajouter un garant</p>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          placeholder="Prénom"
                          value={guarantorForm.first_name}
                          onChange={(e) => setGuarantorForm((s) => ({ ...s, first_name: e.target.value }))}
                        />
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          placeholder="Nom"
                          value={guarantorForm.last_name}
                          onChange={(e) => setGuarantorForm((s) => ({ ...s, last_name: e.target.value }))}
                        />
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          type="email"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          placeholder="Email (optionnel)"
                          value={guarantorForm.email}
                          onChange={(e) => setGuarantorForm((s) => ({ ...s, email: e.target.value }))}
                        />
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          placeholder="Téléphone (optionnel)"
                          value={guarantorForm.phone}
                          onChange={(e) => setGuarantorForm((s) => ({ ...s, phone: e.target.value }))}
                        />
                      </div>

                      <textarea
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Notes (optionnel)"
                        value={guarantorForm.notes}
                        onChange={(e) => setGuarantorForm((s) => ({ ...s, notes: e.target.value }))}
                      />

                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={createGuarantor}
                          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          + Ajouter
                        </button>
                      </div>
                    </div>

                    {/* Sélection + actions (modifier/supprimer) */}
                    {contactsLoading ? (
                      <p className="text-xs text-slate-600">Chargement…</p>
                    ) : activeGuarantors.length === 0 ? (
                      <p className="text-sm text-slate-700">Aucun garant disponible.</p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-auto pr-1">
                        {activeGuarantors.map((c) => {
                          const checked = guarantorIds.includes(c.id);

                          return (
                            <div key={c.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <div className="flex items-start gap-2">
                                <input type="checkbox" checked={checked} onChange={() => toggleGuarantor(c.id)} className="mt-1" />

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{c.full_name || "Garant"}</p>
                                  {(c.email || c.phone) ? (
                                    <p className="mt-0.5 text-xs text-slate-600 truncate">
                                      {c.email ? c.email : ""}{c.email && c.phone ? " • " : ""}{c.phone ? c.phone : ""}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="shrink-0 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditGuarantor(c)}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => archiveGuarantor(c.id)}
                                    className="rounded-full border border-red-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-red-700 hover:bg-red-50"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-[0.7rem] text-slate-500">
                      Astuce : décocher = retire du bail. “Supprimer” = archive le garant (il n’apparaît plus).
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => {
                        stop(e);
                        if (loading) return;
                        saveLease();
                      }}
                      className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {loading ? "Enregistrement…" : mode === "edit" ? "Mettre à jour" : "Créer"}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        stop(e);
                        if (mode === "edit") setMode("view");
                        else closeDrawer();
                      }}
                      className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL EDIT GARANT */}
      {editGuarantorOpen ? (
        <div className="fixed inset-0 z-[60]">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setEditGuarantorOpen(false)} />
          <div className="absolute inset-0 p-3 sm:p-6 flex items-center justify-center">
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Garant</p>
                  <p className="text-base font-semibold text-slate-900 truncate">Modifier le garant</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditGuarantorOpen(false)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Fermer
                </button>
              </div>

              <div className="p-5 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Prénom"
                    value={editGuarantorDraft.first_name}
                    onChange={(e) => setEditGuarantorDraft((s) => ({ ...s, first_name: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Nom"
                    value={editGuarantorDraft.last_name}
                    onChange={(e) => setEditGuarantorDraft((s) => ({ ...s, last_name: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="email"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Email (optionnel)"
                    value={editGuarantorDraft.email}
                    onChange={(e) => setEditGuarantorDraft((s) => ({ ...s, email: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Téléphone (optionnel)"
                    value={editGuarantorDraft.phone}
                    onChange={(e) => setEditGuarantorDraft((s) => ({ ...s, phone: e.target.value }))}
                  />
                </div>

                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Notes (optionnel)"
                  value={editGuarantorDraft.notes}
                  onChange={(e) => setEditGuarantorDraft((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>

              <div className="px-5 py-4 border-t border-slate-200 bg-white flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditGuarantorOpen(false)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={updateGuarantor}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* PREMIUM MODAL PDF (inchangé) */}
      {guideOpen ? (
        <div className="fixed inset-0 z-[60]">
          <button type="button" aria-label="Fermer le guide" onClick={() => setGuideOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="absolute inset-0 p-3 sm:p-6">
            <div className="h-full w-full rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Guide</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">Réparations locatives — qui paie quoi ?</p>
                </div>

                <div className="flex items-center gap-2">
                  <a href={PDF_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50">
                    Ouvrir dans un onglet
                  </a>
                  <button type="button" onClick={() => setGuideOpen(false)} className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                    Fermer (ESC)
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-white">
                <iframe title="Guide réparations locatives" src={`${PDF_URL}#view=FitH`} className="w-full h-full" />
              </div>

              <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-white">
                <p className="text-[0.75rem] text-slate-500">
                  Astuce : pour chercher dans le PDF, utilise <span className="font-semibold">Ctrl+F</span> (ou ⌘F).
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
