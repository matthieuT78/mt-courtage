// components/landlord/sections/SectionBaux.tsx
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

type Mode = "idle" | "view" | "edit" | "create";

/* ======================================================
   HELPERS
====================================================== */

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

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

/* ======================================================
   QUITTANCES: TIMELINE HELPERS (UX)
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

function paymentTypeLabel(v?: string | null) {
  return (v || "").toLowerCase() === "terme_echu" ? "Fin de période (terme échu)" : "Début de période (terme à échoir)";
}
function paymentTypeShort(v?: string | null) {
  return (v || "").toLowerCase() === "terme_echu" ? "terme échu" : "terme à échoir";
}

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

      if (gen.getTime() >= now.getTime()) {
        return { periodStart: ps, periodEnd: pe, dueDate: due, generateAt: gen, label: yyyymmFR(ps) };
      }
    } else {
      const ps = monthStart(base);
      const pe = monthEnd(base);

      const nextMonth = new Date(ps.getFullYear(), ps.getMonth() + 1, 1);
      const day = clampDay(nextMonth.getFullYear(), nextMonth.getMonth(), paymentDayRaw);
      const due = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day);

      const gen = new Date(due);
      gen.setDate(gen.getDate() + 2);

      if (gen.getTime() >= now.getTime()) {
        return { periodStart: ps, periodEnd: pe, dueDate: due, generateAt: gen, label: yyyymmFR(ps) };
      }
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
   UI ATOMS
====================================================== */

function Badge({ tone, children }: { tone: "slate" | "emerald" | "amber" | "red"; children: React.ReactNode }) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-slate-50 text-slate-800";

  return <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold", cls)}>{children}</span>;
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
  defaultOpen,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <summary className="cursor-pointer list-none px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : <span className="text-xs text-slate-500">Ouvrir/Fermer</span>}
      </summary>
      <div className="p-4">{children}</div>
    </details>
  );
}

function TinyKpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

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

  // Filtres
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
        const hay = [
          p?.label,
          p?.city,
          t?.full_name,
          t?.email,
          l.start_date,
          l.end_date || "",
          String(l.rent_amount ?? ""),
          String(l.charges_amount ?? ""),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
  }, [safeLeases, q, statusFilter, propertyById, tenantById]);

  // KPIs
  const stats = useMemo(() => {
    const total = safeLeases.length;
    const active = safeLeases.filter((l) => (l.status || "").toLowerCase() === "active").length;
    const ended = safeLeases.filter((l) => (l.status || "").toLowerCase() === "ended").length;
    const draft = safeLeases.filter((l) => (l.status || "").toLowerCase() === "draft").length;
    return { total, active, ended, draft };
  }, [safeLeases]);

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

  // Garants
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

  // Modal édition garant
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
    // eslint-disable-next-line no-alert
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

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const safeRefresh = async () => {
    try {
      await withTimeout(onRefresh(), 4000);
    } catch (e: any) {
      console.warn("[SectionBaux] refresh skipped:", e?.message || e);
    }
  };

  /* ======================================================
     NAV
  ====================================================== */

  const openCreate = () => {
    setErr(null);
    setOk(null);
    setSelectedId(null);
    resetForm();
    setGuarantorIds([]);
    setMode("create");
  };

  const openView = async (id: string) => {
    setErr(null);
    setOk(null);
    setSelectedId(id);
    setMode("view");
    await loadGuarantorsForLease(id);
  };

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

  const closeDetail = () => {
    setMode("idle");
    setSelectedId(null);
    setErr(null);
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

  const statusTone = (s?: string | null) => {
    const v = (s || "").toLowerCase();
    if (v === "active") return "emerald" as const;
    if (v === "ended") return "amber" as const;
    if (v === "draft") return "slate" as const;
    return "slate" as const;
  };

  const isActiveLease = (l: Lease) => (l.status || "").toLowerCase() === "active";

  const leaseMeta = (l: Lease) => {
    const p = propertyById.get(l.property_id);
    const t = tenantById.get(l.tenant_id);
    const total = Number(l.rent_amount || 0) + Number(l.charges_amount || 0);

    const tenantLine = t?.email ? `${t?.full_name || "Locataire"} • ${t.email}` : t?.full_name || "Locataire";
    const propertyLine = [p?.label || "Bien", p?.city ? `(${p.city})` : ""].filter(Boolean).join(" ");

    return {
      title: `${p?.label || "Bien"} • ${t?.full_name || "Locataire"}`,
      propertyLine,
      tenantLine,
      dates: `Début : ${l.start_date}${l.end_date ? ` • Fin : ${l.end_date}` : ""}`,
      total,
    };
  };

  const quickEndLease = async (lease: Lease) => {
    if (!userId) return;
    const p = propertyById.get(lease.property_id);
    const t = tenantById.get(lease.tenant_id);
    const label = `${p?.label || "Bien"} • ${t?.full_name || "Locataire"}`;

    // eslint-disable-next-line no-alert
    if (!confirm(`Mettre fin au bail :\n${label}\n\n→ Statut: ended\n→ Date de fin: ${lease.end_date || todayISO()}\n\nConfirmer ?`)) return;

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
      setSelectedId((prev) => prev);
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
        updated_at: new Date().toISOString(),
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
        if (leaseId) {
          setSelectedId(leaseId);
          setMode("view");
        } else {
          setMode("idle");
        }
      }

      if (leaseId) {
        await syncGuarantors(leaseId);
      }

      await safeRefresh();
    } catch (e: any) {
      console.error("[saveLease] error:", e);
      setErr(e?.message || "Erreur lors de l’enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!userId || !selectedId) return;
    // eslint-disable-next-line no-alert
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
      await safeRefresh();
    } catch (e: any) {
      console.error("[SectionBaux] delete error:", e);
      setErr(e?.message || "Suppression impossible (quittances/loyers existants ?).");
    } finally {
      setLoading(false);
    }
  };

  const rightTitle =
    mode === "create" ? "Nouveau bail" : mode === "edit" ? "Modifier le bail" : mode === "view" ? "Détail du bail" : "Détail";

  const computedTotal = (toNumberOrNull(form.rent_amount) ?? 0) + (toNumberOrNull(form.charges_amount) ?? 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle kicker="Baux" title="Contrats" desc="Vue moderne : liste claire + détail en sections repliables." />

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div> : null}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (bien, locataire, email, date, montant…)…"
            className="w-full sm:w-[420px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <TinyKpi label="Total" value={stats.total} />
            <TinyKpi label="Actifs" value={stats.active} />
            <TinyKpi label="Terminés" value={stats.ended} />
            <TinyKpi label="Brouillons" value={stats.draft} />
          </div>

          <button
            type="button"
            onClick={(e) => {
              stop(e);
              openCreate();
            }}
            className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            + Nouveau bail
          </button>
        </div>
      </div>

      {/* Master / Detail */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT: LIST */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Liste</p>
              <p className="text-sm font-semibold text-slate-900">
                {filteredLeases.length} bail{filteredLeases.length > 1 ? "x" : ""}
              </p>
            </div>

            {selected ? (
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  closeDetail();
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Désélectionner
              </button>
            ) : null}
          </div>

          {filteredLeases.length === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-700">
              Aucun bail. Clique sur <span className="font-semibold">“Nouveau bail”</span>.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredLeases.map((l) => {
                const meta = leaseMeta(l);
                const sched = nextReceiptScheduleForLease(l);
                const isSelected = l.id === selectedId;

                return (
                  <div
                    key={l.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openView(l.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openView(l.id);
                    }}
                    className={cx(
                      "p-4 cursor-pointer transition",
                      isSelected ? "bg-slate-50" : "bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">{meta.title}</p>
                          <Badge tone={statusTone(l.status)}>{(l.status || "—").toUpperCase()}</Badge>
                          <Badge tone={l.auto_quittance_enabled ? "emerald" : "amber"}>
                            {l.auto_quittance_enabled ? "Quittance auto" : "Quittance manuel"}
                          </Badge>
                        </div>

                        <p className="mt-1 text-xs text-slate-700">
                          <span className="font-semibold">{meta.propertyLine}</span>
                          <span className="text-slate-400"> • </span>
                          <span className="truncate">{meta.tenantLine}</span>
                        </p>

                        <p className="mt-1 text-xs text-slate-600">{meta.dates}</p>

                        <div className="mt-2 grid gap-1 text-xs text-slate-700">
                          <p>
                            Total mensuel : <span className="font-semibold">{formatEuro(meta.total)}</span>{" "}
                            <span className="text-slate-500">
                              ({formatEuro(l.rent_amount)} + {formatEuro(l.charges_amount)})
                            </span>
                          </p>
                          <p>
                            Paiement : <span className="font-semibold">J{l.payment_day ?? "—"}</span>{" "}
                            <span className="text-slate-500">•</span>{" "}
                            <span className="font-semibold">{l.payment_method || "—"}</span>{" "}
                            <span className="text-slate-500">• {paymentTypeShort(l.payment_type)}</span>
                          </p>
                          <p>
                            Prochaine quittance :{" "}
                            {l.auto_quittance_enabled ? (
                              <span className="font-semibold">{fmtFR(sched.generateAt)}</span>
                            ) : (
                              <span className="text-slate-500">auto OFF</span>
                            )}
                            <span className="text-slate-500"> • période {sched.label}</span>
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              stop(e);
                              openView(l.id);
                            }}
                            className="rounded-full bg-slate-900 px-3.5 py-1.5 text-[0.72rem] font-semibold text-white hover:bg-slate-800"
                          >
                            Ouvrir
                          </button>

                          <button
                            type="button"
                            disabled={loading}
                            onClick={(e) => {
                              stop(e);
                              setSelectedId(l.id);
                              setMode("view");
                              loadGuarantorsForLease(l.id);
                              setTimeout(() => {
                                if (l.id) openEdit();
                              }, 0);
                            }}
                            className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-[0.72rem] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
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
                            className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-[0.72rem] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
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
                              className="rounded-full border border-amber-300 bg-white px-3.5 py-1.5 text-[0.72rem] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                            >
                              Mettre fin
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 hidden xl:flex flex-col items-end gap-2">
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right">
                          <p className="text-[0.7rem] text-slate-500">Total</p>
                          <p className="text-sm font-semibold text-slate-900">{formatEuro(meta.total)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: DETAIL / FORM */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Baux</p>
              <p className="text-sm font-semibold text-slate-900">{rightTitle}</p>
              {mode !== "create" && selected ? (
                <p className="mt-1 text-xs text-slate-600 truncate">{leaseMeta(selected).title}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-600">{mode === "create" ? "Crée un nouveau bail en quelques champs." : "Sélectionne un bail dans la liste."}</p>
              )}
            </div>

            <div className="shrink-0 flex flex-wrap gap-2">
              {mode === "view" && selected ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={(e) => {
                    stop(e);
                    openEdit();
                  }}
                  className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Modifier
                </button>
              ) : null}

              {mode === "view" && selected ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={(e) => {
                    stop(e);
                    onDelete();
                  }}
                  className="rounded-full border border-red-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Supprimer
                </button>
              ) : null}

              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  closeDetail();
                }}
                className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Retour
              </button>
            </div>
          </div>

          <div className="p-4 overflow-auto space-y-4">
            {/* EMPTY */}
            {mode === "idle" && !selected ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-700">
                Clique sur un bail à gauche pour afficher une fiche complète ici.
              </div>
            ) : null}

            {/* VIEW */}
            {mode === "view" && selected ? (
              <>
                {/* Bandeau résumé */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(selected.status)}>{(selected.status || "—").toUpperCase()}</Badge>
                    <Badge tone={selected.auto_quittance_enabled ? "emerald" : "amber"}>
                      {selected.auto_quittance_enabled ? "Quittance auto" : "Quittance manuel"}
                    </Badge>
                    <Badge tone={selected.auto_reminder_enabled ? "emerald" : "slate"}>
                      {selected.auto_reminder_enabled ? "Rappel ON" : "Rappel OFF"}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-800">
                    <p>
                      Total mensuel :{" "}
                      <span className="font-semibold">
                        {formatEuro(Number(selected.rent_amount || 0) + Number(selected.charges_amount || 0))}
                      </span>{" "}
                      <span className="text-slate-500">
                        (loyer {formatEuro(selected.rent_amount)} + charges {formatEuro(selected.charges_amount)})
                      </span>
                    </p>
                    <p className="text-sm text-slate-700">
                      Paiement : <span className="font-semibold">J{selected.payment_day ?? "—"}</span>{" "}
                      <span className="text-slate-400">•</span>{" "}
                      <span className="font-semibold">{selected.payment_method || "—"}</span>{" "}
                      <span className="text-slate-400">•</span>{" "}
                      <span className="font-semibold">{paymentTypeShort(selected.payment_type)}</span>
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {isActiveLease(selected) ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={(e) => {
                          stop(e);
                          quickEndLease(selected);
                        }}
                        className="rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                      >
                        Mettre fin au bail
                      </button>
                    ) : null}

                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => {
                        stop(e);
                        quickToggleQuittance(selected);
                      }}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Quittance {selected.auto_quittance_enabled ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>

                {/* Sections repliables (VIEW) */}
                <SectionCard title="Bien & locataire" subtitle="Informations principales" defaultOpen>
                  <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-800">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">Bien</p>
                      <p className="mt-1 font-semibold">{propertyById.get(selected.property_id)?.label || "—"}</p>
                      {propertyById.get(selected.property_id)?.city ? (
                        <p className="text-xs text-slate-600">{propertyById.get(selected.property_id)?.city}</p>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">Locataire</p>
                      <p className="mt-1 font-semibold">{tenantById.get(selected.tenant_id)?.full_name || "—"}</p>
                      {tenantById.get(selected.tenant_id)?.email ? (
                        <p className="text-xs text-slate-600">{tenantById.get(selected.tenant_id)?.email}</p>
                      ) : null}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Contrat" subtitle="Dates, statut, timezone" defaultOpen={false}>
                  <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-800">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">Dates</p>
                      <p className="mt-1 font-semibold">Début : {selected.start_date}</p>
                      <p className="text-sm text-slate-700">Fin : {selected.end_date || "—"}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">Paramètres</p>
                      <p className="mt-1 text-sm text-slate-800">
                        Timezone : <span className="font-semibold">{selected.timezone || "Europe/Paris"}</span>
                      </p>
                      <p className="text-sm text-slate-800">
                        Statut : <span className="font-semibold">{(selected.status || "—").toUpperCase()}</span>
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Paiement" subtitle="Jour, mode, échéance" defaultOpen={false}>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
                    <p>
                      Jour : <span className="font-semibold">{selected.payment_day ?? "—"}</span>
                    </p>
                    <p className="mt-1">
                      Mode : <span className="font-semibold">{selected.payment_method || "—"}</span>
                    </p>
                    <p className="mt-1 text-slate-700">
                      Échéance : <span className="font-semibold">{paymentTypeLabel(selected.payment_type)}</span>
                    </p>
                  </div>
                </SectionCard>

                <SectionCard title="Cinématique quittance" subtitle="Prochaine génération, règle J+2" defaultOpen={false}>
                  {(() => {
                    const sched = nextReceiptScheduleForLease(selected);
                    return (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                          <p>
                            1) Échéance : <span className="font-semibold">Jour {selected.payment_day ?? "—"}</span>{" "}
                            <span className="text-slate-500">({paymentTypeLabel(selected.payment_type)})</span>
                          </p>
                          <p className="mt-1">
                            2) Génération PDF : <span className="font-semibold">J+2 après l’échéance</span>{" "}
                            <span className="text-slate-500">(cron 09:00 Europe/Paris)</span>
                          </p>
                        </div>

                        {selected.auto_quittance_enabled ? (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-sm text-emerald-900 font-semibold">Prochaine génération automatique</p>
                            <p className="mt-1 text-sm text-emerald-900">
                              {fmtFR(sched.generateAt)} <span className="text-emerald-700">• période {sched.label}</span>
                            </p>
                            <p className="text-xs text-emerald-800 mt-1">Échéance estimée : {fmtFR(sched.dueDate)}</p>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm text-amber-900 font-semibold">Quittance auto désactivée</p>
                            <p className="text-xs text-amber-900 mt-1">Active “Quittance auto” pour générer le PDF automatiquement à J+2.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </SectionCard>

                <SectionCard
                  title="Garants"
                  subtitle="Contacts liés au bail"
                  defaultOpen={false}
                  right={
                    <button
                      type="button"
                      onClick={() => selected?.id && loadGuarantorsForLease(selected.id)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Rafraîchir
                    </button>
                  }
                >
                  {guarantorIds.length === 0 ? (
                    <p className="text-sm text-slate-600">Aucun garant associé.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
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

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        stop(e);
                        openEdit();
                      }}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Modifier les garants (via édition)
                    </button>
                  </div>
                </SectionCard>
              </>
            ) : null}

            {/* CREATE / EDIT */}
            {mode === "create" || mode === "edit" ? (
              <div className="space-y-4" data-stop-nav>
                {/* Résumé + actions */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Résumé</p>
                      <p className="mt-1 text-sm text-slate-800">
                        Bien : <span className="font-semibold">{propertyById.get(form.property_id)?.label || "—"}</span>
                        <span className="text-slate-400"> • </span>
                        Locataire : <span className="font-semibold">{tenantById.get(form.tenant_id)?.full_name || "—"}</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        Total : <span className="font-semibold">{formatEuro(computedTotal)}</span>
                        <span className="text-slate-400"> • </span>
                        Paiement : <span className="font-semibold">J{form.payment_day}</span>
                        <span className="text-slate-400"> • </span>
                        <span className="font-semibold">{form.payment_method || "—"}</span>
                        <span className="text-slate-400"> • </span>
                        <span className="font-semibold">{paymentTypeShort(form.payment_type)}</span>
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
                          else closeDetail();
                        }}
                        className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>

                <SectionCard title="Identité du bail" subtitle="Bien, locataire, dates, statut" defaultOpen>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Bien *</label>
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
                      <label className="text-[0.7rem] text-slate-700">Locataire *</label>
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

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
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

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                </SectionCard>

                <SectionCard title="Paiement & montants" subtitle="Loyer, charges, dépôt, échéance" defaultOpen={false}>
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

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
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

                  {/* Aperçu planning quittance */}
                  {(() => {
                    const fakeLease = { payment_day: Number(form.payment_day || 1), payment_type: form.payment_type };
                    const sched = nextReceiptScheduleForLease(fakeLease as any, parisNow());
                    return (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-900">Aperçu planning quittance</p>
                        <p className="mt-1 text-sm text-slate-700">
                          Échéance : <span className="font-semibold">Jour {form.payment_day}</span> •{" "}
                          <span className="text-slate-600">{paymentTypeLabel(form.payment_type)}</span>
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          Génération PDF : <span className="font-semibold">{fmtFR(sched.generateAt)}</span>{" "}
                          <span className="text-slate-500">(période {sched.label})</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Règle : génération automatique à J+2 après l’échéance (cron 09:00 Europe/Paris).</p>
                      </div>
                    );
                  })()}
                </SectionCard>

                <SectionCard title="Automatisations" subtitle="Quittance auto + rappel auto" defaultOpen={false}>
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

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Jour rappel (1–31)</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={form.reminder_day_of_month}
                        onChange={(e) => setForm((s) => ({ ...s, reminder_day_of_month: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Email rappel (optionnel)</label>
                      <input
                        type="email"
                        value={form.reminder_email}
                        onChange={(e) => setForm((s) => ({ ...s, reminder_email: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="ex: moi@domaine.fr"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[0.7rem] text-slate-700">Email quittance locataire (optionnel)</label>
                      <input
                        type="email"
                        value={form.tenant_receipt_email}
                        onChange={(e) => setForm((s) => ({ ...s, tenant_receipt_email: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="si différent de la fiche locataire"
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* GARANTS */}
                <SectionCard
                  title="Garants"
                  subtitle="Sélection, ajout, modification, archivage"
                  defaultOpen={false}
                  right={
                    <button
                      type="button"
                      onClick={() => loadContacts()}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Rafraîchir
                    </button>
                  }
                >
                  {/* Ajout garant */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
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

                  {/* Sélection + actions */}
                  <div className="mt-3">
                    {contactsLoading ? (
                      <p className="text-xs text-slate-600">Chargement…</p>
                    ) : activeGuarantors.length === 0 ? (
                      <p className="text-sm text-slate-700">Aucun garant disponible.</p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-auto pr-1">
                        {activeGuarantors.map((c) => {
                          const checked = guarantorIds.includes(c.id);

                          return (
                            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleGuarantor(c.id)}
                                  className="mt-1"
                                />

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

                    <p className="mt-2 text-[0.7rem] text-slate-500">
                      Astuce : décocher = retire du bail. “Supprimer” = archive le garant (il n’apparaît plus).
                    </p>
                  </div>
                </SectionCard>
              </div>
            ) : null}
          </div>
        </div>
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
    </div>
  );
}
