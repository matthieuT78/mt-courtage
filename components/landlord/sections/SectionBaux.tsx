// components/landlord/sections/SectionBaux.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import { ExpandableSection } from "../ui/ExpandableSection";
import { ExpandableRow } from "../ui/ExpandableRow";
import { badge, cx, pluralFR } from "../ui/uiHelpers";

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
  created_at?: string | null;
  updated_at?: string | null;
};

type Props = {
  userId: string;
  leases?: Lease[];
  properties?: PropertyLite[];
  tenants?: TenantLite[];
  onRefresh: () => Promise<void>;
};

/* ======================================================
   HELPERS
====================================================== */

const CREATE_ID = "__create__";

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

function paymentTypeLabel(v?: string | null) {
  return (v || "").toLowerCase() === "terme_echu" ? "Fin de période (terme échu)" : "Début de période (terme à échoir)";
}
function paymentTypeShort(v?: string | null) {
  return (v || "").toLowerCase() === "terme_echu" ? "échu" : "à échoir";
}

const isActiveLease = (l: Lease) => (l.status || "").toLowerCase() === "active";
const isDraftLease = (l: Lease) => (l.status || "").toLowerCase() === "draft";
const isEndedLease = (l: Lease) => (l.status || "").toLowerCase() === "ended";

const statusTone = (s?: string | null) => {
  const v = (s || "").toLowerCase();
  if (v === "active") return "emerald" as const;
  if (v === "ended") return "amber" as const;
  if (v === "draft") return "slate" as const;
  return "slate" as const;
};

/* ======================================================
   QUITTANCES: TIMELINE HELPERS
====================================================== */

const parisNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));

const fmtFR = (d: Date) =>
  d.toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "2-digit", timeZone: "Europe/Paris" });

const yyyymmFR = (d: Date) =>
  d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", timeZone: "Europe/Paris" });

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const lastDayOfMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
const clampDay = (y: number, m0: number, day: number) => Math.min(Math.max(1, day), lastDayOfMonth(y, m0));

type ReceiptSchedule = {
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  generateAt: Date;
  label: string; // ex: "décembre 2025"
};

function nextReceiptScheduleForLease(
  lease: { payment_day?: number | null; payment_type?: string | null },
  now = parisNow()
): ReceiptSchedule {
  const paymentDayRaw = Number(lease.payment_day || 1);
  const pType = (lease.payment_type || "terme_a_echoir").toLowerCase();

  for (let add = -1; add <= 3; add++) {
    const base = new Date(now.getFullYear(), now.getMonth() + add, 1);

    if (pType === "terme_a_echoir") {
      const ps = monthStart(base);
      const pe = monthEnd(base);
      const day = clampDay(ps.getFullYear(), ps.getMonth(), paymentDayRaw);
      const due = new Date(ps.getFullYear(), ps.getMonth(), day);

      const gen = new Date(due);
      gen.setDate(gen.getDate() + 2);

      if (gen.getTime() >= now.getTime())
        return { periodStart: ps, periodEnd: pe, dueDate: due, generateAt: gen, label: yyyymmFR(ps) };
    } else {
      const ps = monthStart(base);
      const pe = monthEnd(base);

      const nextMonth = new Date(ps.getFullYear(), ps.getMonth() + 1, 1);
      const day = clampDay(nextMonth.getFullYear(), nextMonth.getMonth(), paymentDayRaw);
      const due = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day);

      const gen = new Date(due);
      gen.setDate(gen.getDate() + 2);

      if (gen.getTime() >= now.getTime())
        return { periodStart: ps, periodEnd: pe, dueDate: due, generateAt: gen, label: yyyymmFR(ps) };
    }
  }

  const ps = monthStart(now);
  const pe = monthEnd(now);
  const day = clampDay(now.getFullYear(), now.getMonth(), paymentDayRaw);
  const due = new Date(now.getFullYear(), now.getMonth(), day);
  const gen = new Date(due);
  gen.setDate(gen.getDate() + 2);
  return { periodStart: ps, periodEnd: pe, dueDate: due, generateAt: gen, label: yyyymmFR(ps) };
}

/* ======================================================
   COMPONENT
====================================================== */

type Mode = "idle" | "create" | "edit";

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

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Search (UX identique aux autres pages)
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = safeLeases.filter((l) => {
      if (!query) return true;
      const p = propertyById.get(l.property_id);
      const t = tenantById.get(l.tenant_id);
      const hay = [
        p?.label,
        p?.city,
        t?.full_name,
        t?.email,
        l.start_date,
        l.end_date || "",
        String(l.rent_amount ?? ""),
        String(l.charges_amount ?? ""),
        String(l.payment_day ?? ""),
        String(l.payment_method ?? ""),
        String(l.status ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });

    const actifs = base.filter((l) => isActiveLease(l));
    const archives = base.filter((l) => !isActiveLease(l)); // ended + draft

    // tri simple : récents d’abord
    const sortRecent = (a: Lease, b: Lease) => {
      const da = new Date(a.updated_at || a.created_at || 0).getTime();
      const db = new Date(b.updated_at || b.created_at || 0).getTime();
      return db - da;
    };

    return {
      actifs: actifs.sort(sortRecent),
      archives: archives.sort(sortRecent),
    };
  }, [safeLeases, q, propertyById, tenantById]);

  const leaseLine = (l: Lease) => {
    const p = propertyById.get(l.property_id);
    const t = tenantById.get(l.tenant_id);
    const total = Number(l.rent_amount || 0) + Number(l.charges_amount || 0);

    return {
      propertyLabel: p?.label || "Bien",
      tenantName: t?.full_name || "Locataire",
      tenantEmail: t?.email || null,
      city: p?.city || null,
      total,
      status: (l.status || "—").toUpperCase(),
      quittance: l.auto_quittance_enabled ? "Auto" : "Manuel",
      pay: `J${l.payment_day ?? "—"} • ${l.payment_method || "—"} • ${paymentTypeShort(l.payment_type)}`,
    };
  };

  const safeRefresh = async () => {
    try {
      await withTimeout(onRefresh(), 4000);
    } catch (e: any) {
      console.warn("[SectionBaux] refresh skipped:", e?.message || e);
    }
  };

  /* ======================================================
     CONTACTS / GARANTS
  ====================================================== */

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
        .select("id,user_id,full_name,first_name,last_name,email,phone,notes,contact_type,archived_at,created_at,updated_at")
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
      setGuarantorIds([]);
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

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ======================================================
     GUARANTOR CREATE + EDIT MODAL
  ====================================================== */

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
        archived_at: null,
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

      removeGuarantorFromSelection(contactId);

      if (expandedId && expandedId !== CREATE_ID) {
        await supabase
          .from("lease_guarantors")
          .delete()
          .eq("user_id", userId)
          .eq("lease_id", expandedId)
          .eq("contact_id", contactId);
      }

      await loadContacts();
      setOk("Garant archivé 🗑️");
    } catch (e: any) {
      setErr(e?.message || "Impossible d’archiver le garant.");
    }
  };

  /* ======================================================
     FORM (CREATE / EDIT)
  ====================================================== */

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

  const openCreate = () => {
    setErr(null);
    setOk(null);
    setMode("create");
    setEditingId(null);
    resetForm();
    setGuarantorIds([]);
  };

  const openEdit = async (lease: Lease) => {
    setErr(null);
    setOk(null);
    setMode("edit");
    setEditingId(lease.id);

    setForm({
      property_id: lease.property_id || "",
      tenant_id: lease.tenant_id || "",
      start_date: lease.start_date || todayISO(),
      end_date: lease.end_date || "",
      rent_amount: lease.rent_amount != null ? String(lease.rent_amount) : "",
      charges_amount: lease.charges_amount != null ? String(lease.charges_amount) : "",
      deposit_amount: lease.deposit_amount != null ? String(lease.deposit_amount) : "",
      payment_day: lease.payment_day != null ? String(lease.payment_day) : "1",
      payment_method: lease.payment_method || "virement",
      payment_type: (lease.payment_type as any) || "terme_a_echoir",
      status: lease.status || "active",
      auto_quittance_enabled: !!lease.auto_quittance_enabled,
      auto_reminder_enabled: !!lease.auto_reminder_enabled,
      reminder_day_of_month: lease.reminder_day_of_month != null ? String(lease.reminder_day_of_month) : "1",
      reminder_email: lease.reminder_email || "",
      tenant_receipt_email: lease.tenant_receipt_email || "",
      timezone: lease.timezone || "Europe/Paris",
    });

    await loadGuarantorsForLease(lease.id);
  };

  const cancelEdit = () => {
    setMode("idle");
    setEditingId(null);
    resetForm();
    setGuarantorIds([]);
  };

  /* ======================================================
     CRUD
  ====================================================== */

  const patchLease = async (leaseId: string, patch: Partial<Lease>) => {
    if (!userId) throw new Error("userId manquant.");
    if (!supabase) throw new Error("Supabase non initialisé.");

    const payload: any = { ...patch, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("leases").update(payload).eq("id", leaseId).eq("user_id", userId);
    if (error) throw error;
  };

  const quickEndLease = async (lease: Lease) => {
    if (!userId) return;
    const meta = leaseLine(lease);
    if (
      !confirm(
        `Mettre fin au bail :\n${meta.propertyLabel} • ${meta.tenantName}\n\n→ Statut: ended\n→ Date de fin: ${
          lease.end_date || todayISO()
        }\n\nConfirmer ?`
      )
    )
      return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      await patchLease(lease.id, {
        status: "ended",
        end_date: lease.end_date || todayISO(),
      });
      setOk("Bail terminé ✅");
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible de mettre fin au bail.");
    } finally {
      setLoading(false);
    }
  };

  const quickToggleQuittance = async (lease: Lease) => {
    if (!userId) return;
    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      await patchLease(lease.id, { auto_quittance_enabled: !lease.auto_quittance_enabled });
      setOk(`Quittance auto ${!lease.auto_quittance_enabled ? "activée" : "désactivée"} ✅`);
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible de modifier l’option quittance.");
    } finally {
      setLoading(false);
    }
  };

  const saveLease = async () => {
    if (!userId) {
      setErr("userId manquant.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
      if (!form.property_id) throw new Error("Veuillez sélectionner un bien.");
      if (!form.tenant_id) throw new Error("Veuillez sélectionner un locataire.");
      if (!form.start_date) throw new Error("La date de début de bail est obligatoire.");

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
        updated_at: new Date().toISOString(),
      };

      let leaseId: string | null = null;

      if (mode === "edit") {
        if (!editingId) throw new Error("Aucun bail en cours d’édition.");
        const { error } = await supabase.from("leases").update(payload).eq("id", editingId).eq("user_id", userId);
        if (error) throw error;
        leaseId = editingId;
        setOk("Bail mis à jour ✅");
      } else {
        const { data, error } = await supabase.from("leases").insert(payload).select("id").single();
        if (error) throw error;
        leaseId = (data as any)?.id ?? null;
        setOk("Bail créé ✅");
      }

      if (leaseId) {
        await syncGuarantors(leaseId);
        setExpandedId(leaseId);
        await loadGuarantorsForLease(leaseId);
      }

      setMode("idle");
      setEditingId(null);
      resetForm();
      setGuarantorIds([]);

      await safeRefresh();
    } catch (e: any) {
      console.error("[saveLease] error:", e);
      setErr(e?.message || "Erreur lors de l’enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (leaseId: string) => {
    if (!userId) return;
    if (!confirm("Supprimer ce bail ? (Quittances/loyers liés peuvent empêcher la suppression)")) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");

      await supabase.from("lease_guarantors").delete().eq("user_id", userId).eq("lease_id", leaseId);

      const { error } = await supabase.from("leases").delete().eq("id", leaseId).eq("user_id", userId);
      if (error) throw error;

      setOk("Bail supprimé ✅");

      if (expandedId === leaseId) setExpandedId(null);
      if (editingId === leaseId) cancelEdit();

      await safeRefresh();
    } catch (e: any) {
      console.error("[SectionBaux] delete error:", e);
      setErr(e?.message || "Suppression impossible (quittances/loyers existants ?).");
    } finally {
      setLoading(false);
    }
  };

  /* ======================================================
     UI (DETAILS + FORM)
  ====================================================== */

  const renderLeaseDetails = (l: Lease) => {
    const p = propertyById.get(l.property_id);
    const t = tenantById.get(l.tenant_id);
    const sched = nextReceiptScheduleForLease(l);

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {badge(statusTone(l.status), (l.status || "—").toUpperCase())}
            {badge(l.auto_quittance_enabled ? "emerald" : "amber", l.auto_quittance_enabled ? "Quittance auto" : "Quittance manuel")}
            {badge(l.auto_reminder_enabled ? "emerald" : "slate", l.auto_reminder_enabled ? "Rappel ON" : "Rappel OFF")}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                stop(e);
                openEdit(l);
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Modifier
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                stop(e);
                quickToggleQuittance(l);
              }}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Quittance {l.auto_quittance_enabled ? "ON" : "OFF"}
            </button>

            {isActiveLease(l) ? (
              <button
                type="button"
                disabled={loading}
                onClick={(e) => {
                  stop(e);
                  quickEndLease(l);
                }}
                className="rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
              >
                Mettre fin
              </button>
            ) : null}

            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                stop(e);
                onDelete(l.id);
              }}
              className="rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Supprimer
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Bien</p>
            <p className="mt-1 font-semibold text-slate-900">{p?.label || "—"}</p>
            {p?.city ? <p className="text-xs text-slate-600">{p.city}</p> : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Locataire</p>
            <p className="mt-1 font-semibold text-slate-900">{t?.full_name || "—"}</p>
            {t?.email ? <p className="text-xs text-slate-600">{t.email}</p> : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Dates</p>
            <p className="mt-1 text-slate-900">
              <span className="font-semibold">Début</span> : {l.start_date}
            </p>
            <p className="text-slate-700">
              <span className="font-semibold">Fin</span> : {l.end_date || "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Paiement</p>
            <p className="mt-1 text-slate-900">
              <span className="font-semibold">Jour</span> {l.payment_day ?? "—"} • {l.payment_method || "—"}
            </p>
            <p className="text-xs text-slate-600">
              Échéance : <span className="font-semibold">{paymentTypeLabel(l.payment_type)}</span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Montants</p>
            <p className="mt-1 text-slate-900">
              <span className="font-semibold">Total</span> :{" "}
              {formatEuro(Number(l.rent_amount || 0) + Number(l.charges_amount || 0))}
            </p>
            <p className="text-xs text-slate-600">
              Loyer {formatEuro(l.rent_amount)} • Charges {formatEuro(l.charges_amount)} • Dépôt {formatEuro(l.deposit_amount)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Planning quittance</p>
            <p className="mt-1 text-sm text-slate-800">
              Échéance estimée : <span className="font-semibold">{fmtFR(sched.dueDate)}</span>{" "}
              <span className="text-slate-500">({paymentTypeShort(l.payment_type)})</span>
            </p>
            <p className="mt-1 text-sm text-slate-800">
              Génération PDF (J+2) : <span className="font-semibold">{fmtFR(sched.generateAt)}</span>{" "}
              <span className="text-slate-500">• période {sched.label}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">Règle : génération automatique à J+2 après l’échéance.</p>
          </div>
        </div>
      </div>
    );
  };

  const renderLeaseForm = () => {
    const fakeLease = { payment_day: Number(form.payment_day || 1), payment_type: form.payment_type };
    const sched = nextReceiptScheduleForLease(fakeLease as any, parisNow());

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{mode === "edit" ? "Modifier le bail" : "Nouveau bail"}</p>
            <p className="text-xs text-slate-500">Sauvegarde en bas.</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                stop(e);
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
                cancelEdit();
                setExpandedId(null);
              }}
              className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Bien *</label>
            <select
              value={form.property_id}
              onChange={(e) => setForm((s) => ({ ...s, property_id: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
            <label className="text-[0.7rem] text-slate-700">Locataire *</label>
            <select
              value={form.tenant_id}
              onChange={(e) => setForm((s) => ({ ...s, tenant_id: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Fin (optionnel)</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Charges (€)</label>
            <input
              type="number"
              step="0.01"
              value={form.charges_amount}
              onChange={(e) => setForm((s) => ({ ...s, charges_amount: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Dépôt (€)</label>
            <input
              type="number"
              step="0.01"
              value={form.deposit_amount}
              onChange={(e) => setForm((s) => ({ ...s, deposit_amount: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Mode paiement</label>
            <select
              value={form.payment_method}
              onChange={(e) => setForm((s) => ({ ...s, payment_method: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="terme_a_echoir">Début de période</option>
              <option value="terme_echu">Fin de période</option>
            </select>
            <p className="text-[0.7rem] text-slate-500">Début = à échoir • Fin = à échu</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Aperçu planning quittance</p>
          <p className="mt-1 text-sm text-slate-800">
            Échéance : <span className="font-semibold">Jour {form.payment_day}</span> •{" "}
            <span className="text-slate-600">{paymentTypeLabel(form.payment_type)}</span>
          </p>
          <p className="mt-1 text-sm text-slate-800">
            Génération PDF (J+2) : <span className="font-semibold">{fmtFR(sched.generateAt)}</span>{" "}
            <span className="text-slate-500">(période {sched.label})</span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[0.7rem] text-slate-700">Statut</label>
            <select
              value={form.status}
              onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Europe/London">Europe/London</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
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

        {/* GARANTS */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-900">Garants</p>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                loadContacts();
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
            >
              Rafraîchir
            </button>
          </div>

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
                onClick={(e) => {
                  stop(e);
                  createGuarantor();
                }}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                + Ajouter
              </button>
            </div>
          </div>

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
                        {c.email || c.phone ? (
                          <p className="mt-0.5 text-xs text-slate-600 truncate">
                            {c.email ? c.email : ""}
                            {c.email && c.phone ? " • " : ""}
                            {c.phone ? c.phone : ""}
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

          <p className="text-[0.7rem] text-slate-500">Décocher = retire du bail. “Supprimer” = archive le garant.</p>
        </div>
      </div>
    );
  };

  /* ======================================================
     EXPAND LOGIC (aligné ExpandableRow)
  ====================================================== */

  const openRow = async (id: string | null) => {
    setErr(null);
    setOk(null);

    // fermeture -> stop édition
    if (!id) {
      setExpandedId(null);
      cancelEdit();
      return;
    }

    setExpandedId(id);

    if (id === CREATE_ID) {
      openCreate();
      return;
    }

    // ouvre un bail : charge garants
    await loadGuarantorsForLease(id);
  };

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Baux"
        title="Contrats"
        desc="Même UX partout : une ligne Créer + sections Actifs / Archivés. Chaque ligne est cliquable."
      />

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}

      {/* Toolbar (simple + cohérente) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xl">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (bien, locataire, email, date, montant…)…"
            className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900"
          />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setErr(null);
            setOk(null);
            setLoading(true);
            try {
              await onRefresh();
              setOk("Données rafraîchies ✅");
            } catch (e: any) {
              setErr(e?.message || "Erreur rafraîchissement.");
            } finally {
              setLoading(false);
            }
          }}
          className={cx(
            "rounded-full px-4 py-2 text-xs font-semibold",
            "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
            loading && "opacity-60"
          )}
        >
          {loading ? "…" : "Rafraîchir"}
        </button>
      </div>

      <div className="grid gap-4">
        {/* ✅ LIGNE CRÉER (pas de section) */}
        <ExpandableRow
          id={CREATE_ID}
          expandedId={expandedId}
          setExpandedId={(id) => {
            // ExpandableRow donne id ou null
            openRow(id);
          }}
          tone="sky"
          hideRight
          left={
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {badge("sky", "Créer")}
                <p className="text-sm font-semibold text-slate-900">+ Nouveau bail</p>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">Choisis un bien + un locataire, puis configure les options.</p>
            </div>
          }
        >
          {renderLeaseForm()}
        </ExpandableRow>

        {/* ✅ ACTIFS */}
        <ExpandableSection
          title="Actifs"
          subtitle="Clique une ligne pour voir / modifier."
          right={badge("emerald", pluralFR(filtered.actifs.length, "bail"))}
          defaultOpen={true}
        >
          {filtered.actifs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun bail actif.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.actifs.map((l) => {
                const meta = leaseLine(l);
                const open = expandedId === l.id;
                const sched = nextReceiptScheduleForLease(l);

                return (
                  <ExpandableRow
                    key={l.id}
                    id={l.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => openRow(id)}
                    left={
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {meta.propertyLabel} <span className="text-slate-500 font-normal">• {meta.tenantName}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 truncate">
                          {meta.city ? `${meta.city} • ` : ""}
                          Début {l.start_date}
                          {l.end_date ? ` • Fin ${l.end_date}` : ""}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {badge(statusTone(l.status), meta.status)}
                          {badge(l.auto_quittance_enabled ? "emerald" : "amber", l.auto_quittance_enabled ? "Quittance auto" : "Quittance manuel")}
                          {badge("slate", `${formatEuro(meta.total)}`)}
                          {badge("slate", meta.pay)}
                          {l.auto_quittance_enabled ? badge("slate", `Prochaine: ${fmtFR(sched.generateAt)}`) : null}
                        </div>
                      </div>
                    }
                    right={open ? badge("slate", "Ouvert") : null}
                  >
                    {mode === "edit" && editingId === l.id ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">{renderLeaseForm()}</div>
                    ) : (
                      renderLeaseDetails(l)
                    )}
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>

        {/* ✅ ARCHIVÉS (= ended + draft) */}
        <ExpandableSection
          title="Archivés"
          subtitle="Terminés et brouillons."
          right={badge("amber", pluralFR(filtered.archives.length, "bail"))}
          defaultOpen={false}
        >
          {filtered.archives.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun bail archivé.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.archives.map((l) => {
                const meta = leaseLine(l);
                const open = expandedId === l.id;

                return (
                  <ExpandableRow
                    key={l.id}
                    id={l.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => openRow(id)}
                    left={
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {meta.propertyLabel} <span className="text-slate-500 font-normal">• {meta.tenantName}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 truncate">
                          {(isEndedLease(l) ? "Terminé" : isDraftLease(l) ? "Brouillon" : "—") +
                            " • Début " +
                            l.start_date +
                            (l.end_date ? ` • Fin ${l.end_date}` : "")}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {badge(statusTone(l.status), meta.status)}
                          {badge("slate", `${formatEuro(meta.total)}`)}
                          {badge("slate", meta.pay)}
                        </div>
                      </div>
                    }
                    right={open ? badge("slate", "Ouvert") : null}
                  >
                    {mode === "edit" && editingId === l.id ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">{renderLeaseForm()}</div>
                    ) : (
                      renderLeaseDetails(l)
                    )}
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>
      </div>

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
                  onClick={(e) => {
                    stop(e);
                    updateGuarantor();
                  }}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
