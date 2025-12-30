// components/landlord/sections/SectionLocataires.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import { ExpandableSection } from "../ui/ExpandableSection";
import { ExpandableRow } from "../ui/ExpandableRow";
import { badge, cx, pluralFR } from "../ui/uiHelpers";

/* ======================================================
   TYPES
====================================================== */

export type Tenant = {
  id: string;
  user_id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived_at?: string | null;
  archived_reason?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Lease = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  status: string | null;
  created_at?: string;
};

export type PropertyLite = {
  id: string;
  label: string | null;
};

type Props = {
  userId: string;
  tenants?: Tenant[];
  leases?: Lease[];
  properties?: PropertyLite[];
  onRefresh: () => Promise<void>;
};

const fmt = (v?: string | null) => (v ? v : "—");

/* ======================================================
   UTIL
====================================================== */

const withTimeout = async <T,>(p: Promise<T>, ms = 15000) => {
  let t: any;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`Timeout réseau (${ms}ms)`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
};

function buildFullName(first?: string, last?: string) {
  const f = (first || "").trim();
  const l = (last || "").trim();
  return [f, l].filter(Boolean).join(" ").trim();
}

function splitFullName(full?: string | null) {
  const s = (full || "").trim();
  if (!s) return { first: "", last: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function initials(first?: string | null, last?: string | null, fallbackFull?: string | null) {
  const f = (first || "").trim();
  const l = (last || "").trim();
  if (f || l) return ((f[0] || "L") + (l[0] || "")).toUpperCase();

  const n = (fallbackFull || "").trim();
  if (!n) return "L";
  const parts = n.split(/\s+/).slice(0, 2);
  const a = parts[0]?.[0] || "L";
  const b = parts.length > 1 ? parts[1]?.[0] : "";
  return (a + b).toUpperCase();
}

function displayName(t: Tenant) {
  const n = buildFullName(t.first_name || "", t.last_name || "");
  return n || (t.full_name || "Locataire");
}

function sanitizePhone(p?: string | null) {
  if (!p) return "";
  return p.replace(/\s+/g, "");
}

function copyToClipboard(v: string) {
  if (!v) return;
  navigator.clipboard?.writeText(v).catch(() => {});
}

function isArchived(t: Tenant) {
  return !!t.archived_at;
}

/* ======================================================
   COMPONENT
====================================================== */

const CREATE_ID = "__create__";

export function SectionLocataires({ userId, tenants, leases, properties, onRefresh }: Props) {
  const safeTenants = Array.isArray(tenants) ? tenants : [];
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeProperties = Array.isArray(properties) ? properties : [];

  const [expandedId, setExpandedId] = useState<string | null>(null); // row ouverte (create ou tenant id)
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"az" | "recent">("az");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const propertyById = useMemo(() => {
    const m = new Map<string, PropertyLite>();
    for (const p of safeProperties) m.set(p.id, p);
    return m;
  }, [safeProperties]);

  const activeLeaseForTenant = (tenantId: string) => {
    const now = new Date();
    return (
      safeLeases.find((l) => {
        if (!l || l.tenant_id !== tenantId) return false;

        const startOk = l.start_date ? new Date(l.start_date) <= now : false;
        const notEnded = !l.end_date || new Date(l.end_date) >= now;

        if ((l.status || "").toLowerCase() === "active") return true;
        return startOk && notEnded;
      }) || null
    );
  };

  const activePropertyForTenant = (tenantId: string) => {
    const lease = activeLeaseForTenant(tenantId);
    if (!lease) return null;
    return propertyById.get(lease.property_id) || null;
  };

  const hasAnyLeaseForTenant = (tenantId: string) => safeLeases.some((l) => l?.tenant_id === tenantId);

  const leasesForTenant = (tenantId: string) => safeLeases.filter((l) => l?.tenant_id === tenantId).slice(0, 12);

  const safeRefresh = async () => {
    try {
      await onRefresh?.();
    } catch (e) {
      console.error("[SectionLocataires] onRefresh error:", e);
    }
  };

  /* ======================================================
     DATA LISTS (actifs / archivés)
  ====================================================== */

  const normalized = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = safeTenants.filter((t) => {
      if (!q) return true;
      const name = (displayName(t) || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      const phone = (t.phone || "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });

    const sorter = (a: Tenant, b: Tenant) => {
      if (sort === "recent") {
        const da = new Date(a.updated_at || a.created_at || 0).getTime();
        const db = new Date(b.updated_at || b.created_at || 0).getTime();
        return db - da;
      }
      const na = (displayName(a) || "Locataire").toLowerCase();
      const nb = (displayName(b) || "Locataire").toLowerCase();
      return na.localeCompare(nb);
    };

    const actifs = base.filter((t) => !isArchived(t)).sort(sorter);
    const archives = base.filter((t) => isArchived(t)).sort(sorter);

    return { actifs, archives };
  }, [safeTenants, query, sort]);

  /* ======================================================
     FORMS
  ====================================================== */

  const emptyForm = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
    archived_reason: "",
  };

  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForms, setEditForms] = useState<Record<string, typeof emptyForm>>({});

  // hydrate edit form quand on expand un tenant
  useEffect(() => {
    setErr(null);
    setOk(null);

    if (!expandedId || expandedId === CREATE_ID) return;
    const t = safeTenants.find((x) => x.id === expandedId);
    if (!t) return;

    setEditForms((prev) => {
      if (prev[expandedId]) return prev;

      const fromCols = { first_name: (t.first_name || "").trim(), last_name: (t.last_name || "").trim() };
      const fromFull = splitFullName(t.full_name);

      return {
        ...prev,
        [expandedId]: {
          first_name: fromCols.first_name || fromFull.first,
          last_name: fromCols.last_name || fromFull.last,
          email: t.email || "",
          phone: t.phone || "",
          notes: t.notes || "",
          archived_reason: t.archived_reason || "",
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  /* ======================================================
     CRUD
  ====================================================== */

  const saveTenant = async (tenantId?: string) => {
    if (!userId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const isEdit = !!tenantId;
      const form = isEdit ? editForms[tenantId!] : createForm;
      if (!form) throw new Error("Formulaire introuvable.");

      const full_name = buildFullName(form.first_name, form.last_name) || "Locataire";

      const payload = {
        user_id: userId,
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        full_name,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        notes: form.notes?.trim() || null,
        archived_reason: form.archived_reason?.trim() || null,
      };

      if (isEdit) {
        const res = await withTimeout(
          Promise.resolve(
            supabase.from("tenants").update(payload).eq("id", tenantId).eq("user_id", userId).select("id").single()
          )
        );
        // @ts-ignore
        if ((res as any)?.error) throw (res as any).error;
        setOk("Locataire mis à jour ✅");
      } else {
        const res = await withTimeout(
          Promise.resolve(supabase.from("tenants").insert(payload).select("id").single())
        );
        // @ts-ignore
        if ((res as any)?.error) throw (res as any).error;

        const newId = (res as any)?.data?.id ?? null;

        setOk("Locataire créé ✅");
        setCreateForm(emptyForm);
        setExpandedId(newId || null);
      }

      await safeRefresh();
    } catch (e: any) {
      console.error("[saveTenant] error:", e);
      setErr(e?.message || "Erreur lors de l’enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const archiveTenant = async (tenantId: string) => {
    if (!userId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");
      const f = editForms[tenantId];
      const reason = f?.archived_reason?.trim() || null;

      const res = await withTimeout(
        Promise.resolve(
          supabase
            .from("tenants")
            .update({ archived_at: new Date().toISOString(), archived_reason: reason })
            .eq("id", tenantId)
            .eq("user_id", userId)
            .select("id")
            .single()
        )
      );
      // @ts-ignore
      if ((res as any)?.error) throw (res as any).error;

      setOk("Locataire archivé ✅");
      await safeRefresh();
    } catch (e: any) {
      console.error("[archiveTenant] error:", e);
      setErr(e?.message || "Archivage impossible.");
    } finally {
      setLoading(false);
    }
  };

  const restoreTenant = async (tenantId: string) => {
    if (!userId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const res = await withTimeout(
        Promise.resolve(
          supabase
            .from("tenants")
            .update({ archived_at: null, archived_reason: null })
            .eq("id", tenantId)
            .eq("user_id", userId)
            .select("id")
            .single()
        )
      );
      // @ts-ignore
      if ((res as any)?.error) throw (res as any).error;

      setOk("Locataire restauré ✅");
      await safeRefresh();
    } catch (e: any) {
      console.error("[restoreTenant] error:", e);
      setErr(e?.message || "Restauration impossible.");
    } finally {
      setLoading(false);
    }
  };

  const deleteTenant = async (tenantId: string) => {
    if (!userId) return;

    if (hasAnyLeaseForTenant(tenantId)) {
      setErr("Suppression impossible : ce locataire est lié à un bail. Archive-le plutôt.");
      return;
    }
    if (!confirm("Supprimer définitivement ce locataire ?")) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const res = await withTimeout(Promise.resolve(supabase.from("tenants").delete().eq("id", tenantId).eq("user_id", userId)));
      // @ts-ignore
      if ((res as any)?.error) throw (res as any).error;

      setOk("Locataire supprimé ✅");
      if (expandedId === tenantId) setExpandedId(null);
      await safeRefresh();
    } catch (e: any) {
      console.error("[deleteTenant] error:", e);
      setErr(e?.message || "Suppression impossible.");
    } finally {
      setLoading(false);
    }
  };

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Locataires"
        title="Gestion des locataires"
        desc="Même UX partout : une ligne Créer + sections Actifs / Archivés. Chaque ligne est cliquable."
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>
      ) : null}

      {/* TOOLBAR */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (nom, email, téléphone)…"
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-1 inline-flex self-start">
            <button
              type="button"
              onClick={() => setSort("az")}
              className={cx(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                sort === "az" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              A → Z
            </button>
            <button
              type="button"
              onClick={() => setSort("recent")}
              className={cx(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                sort === "recent" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              Récents
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {/* ✅ LIGNE CRÉER (pas de section) */}
        <ExpandableRow
          id={CREATE_ID}
          expandedId={expandedId}
          setExpandedId={(id) => {
            // Quand on ouvre "Créer", on reset les messages
            setErr(null);
            setOk(null);
            setExpandedId(id);
          }}
          tone="sky"
          hideRight
          left={
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {badge("sky", "Créer")}
                <p className="text-sm font-semibold text-slate-900">+ Nouveau locataire</p>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">Clique pour ouvrir le formulaire.</p>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Prénom</label>
              <input
                value={createForm.first_name}
                onChange={(e) => setCreateForm((s) => ({ ...s, first_name: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex : Marie"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Nom</label>
              <input
                value={createForm.last_name}
                onChange={(e) => setCreateForm((s) => ({ ...s, last_name: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex : Dupont"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Email</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="nom@email.fr"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Téléphone</label>
              <input
                value={createForm.phone}
                onChange={(e) => setCreateForm((s) => ({ ...s, phone: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="06 00 00 00 00"
              />
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <label className="text-[0.7rem] text-slate-700">Notes</label>
            <textarea
              rows={3}
              value={createForm.notes}
              onChange={(e) => setCreateForm((s) => ({ ...s, notes: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => saveTenant(undefined)}
              className="rounded-full bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {loading ? "Enregistrement…" : "Créer"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => setExpandedId(null)}
              className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </ExpandableRow>

        {/* 1) ACTIFS */}
        <ExpandableSection
          title="Actifs"
          subtitle="Clique une ligne pour voir / modifier."
          right={badge("emerald", pluralFR(normalized.actifs.length, "locataire"))}
          defaultOpen={true}
        >
          {normalized.actifs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun locataire actif.
            </div>
          ) : (
            <div className="space-y-2">
              {normalized.actifs.map((t) => {
                const open = expandedId === t.id;
                const activeLease = activeLeaseForTenant(t.id);
                const p = activePropertyForTenant(t.id);
                const hasLease = hasAnyLeaseForTenant(t.id);

                const f =
                  editForms[t.id] ??
                  ({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    notes: "",
                    archived_reason: "",
                  } as const);

                return (
                  <ExpandableRow
                    key={t.id}
                    id={t.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => {
                      setErr(null);
                      setOk(null);
                      setExpandedId(id);
                    }}
                    left={
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 h-10 w-10 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-800">
                            {initials(t.first_name, t.last_name, t.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{displayName(t)}</p>
                            <p className="mt-0.5 text-[0.75rem] text-slate-600 truncate">
                              {(t.email || "—") + (t.phone ? ` • ${t.phone}` : "")}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {activeLease ? badge("emerald", "Actif") : hasLease ? badge("slate", "Historique") : badge("amber", "Sans bail")}
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-slate-800">
                                🏠 {p?.label || "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    }
                    right={open ? badge("slate", "Ouvert") : null}
                  >
                    {/* Quick actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          copyToClipboard(t.email || "");
                          setOk(t.email ? "Email copié ✅" : "Aucun email.");
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Copier email
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          copyToClipboard(sanitizePhone(t.phone));
                          setOk(t.phone ? "Téléphone copié ✅" : "Aucun téléphone.");
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Copier tél.
                      </button>

                      {t.email ? (
                        <a
                          onClick={(e) => e.stopPropagation()}
                          href={`mailto:${t.email}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Envoyer un email
                        </a>
                      ) : null}
                    </div>

                    {/* Form */}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Prénom</label>
                        <input
                          value={f.first_name}
                          onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, first_name: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Nom</label>
                        <input
                          value={f.last_name}
                          onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, last_name: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Email</label>
                        <input
                          type="email"
                          value={f.email}
                          onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, email: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[0.7rem] text-slate-700">Téléphone</label>
                        <input
                          value={f.phone}
                          onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, phone: e.target.value } }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Notes</label>
                      <textarea
                        rows={3}
                        value={f.notes}
                        onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, notes: e.target.value } }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="mt-3 space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Raison d’archivage (optionnel)</label>
                      <input
                        value={f.archived_reason}
                        onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, archived_reason: e.target.value } }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder="Ex : départ, état des lieux…"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => saveTenant(t.id)}
                        className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {loading ? "Enregistrement…" : "Mettre à jour"}
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => archiveTenant(t.id)}
                        className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Archiver
                      </button>

                      {!hasLease ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => deleteTenant(t.id)}
                          className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      ) : (
                        <span className="text-[0.75rem] text-slate-600">Suppression désactivée (lié à un bail).</span>
                      )}
                    </div>

                    {/* History */}
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[0.75rem] font-semibold text-slate-900">Historique des baux</p>
                      <div className="mt-2 space-y-2">
                        {leasesForTenant(t.id).length === 0 ? (
                          <p className="text-[0.75rem] text-slate-500">Aucun bail.</p>
                        ) : (
                          leasesForTenant(t.id).map((l) => {
                            const prop = propertyById.get(l.property_id);
                            return (
                              <div key={l.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                <p className="text-[0.75rem] font-semibold text-slate-900">
                                  🏠 {prop?.label || "Bien"} • {fmt(l.status)}
                                </p>
                                <p className="text-[0.7rem] text-slate-600">
                                  Début : {l.start_date} • Fin : {l.end_date || "—"}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>

        {/* 2) ARCHIVÉS */}
        <ExpandableSection
          title="Archivés"
          subtitle="Restaure si besoin, ou supprime si aucun bail."
          right={badge("amber", pluralFR(normalized.archives.length, "locataire"))}
          defaultOpen={false}
        >
          {normalized.archives.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun locataire archivé.
            </div>
          ) : (
            <div className="space-y-2">
              {normalized.archives.map((t) => {
                const f =
                  editForms[t.id] ??
                  ({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    notes: "",
                    archived_reason: t.archived_reason || "",
                  } as const);

                return (
                  <ExpandableRow
                    key={t.id}
                    id={t.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => {
                      setErr(null);
                      setOk(null);
                      setExpandedId(id);
                    }}
                    left={
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 h-10 w-10 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-800">
                            {initials(t.first_name, t.last_name, t.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{displayName(t)}</p>
                            <p className="mt-0.5 text-[0.75rem] text-slate-600 truncate">
                              {(t.email || "—") + (t.phone ? ` • ${t.phone}` : "")}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {badge("amber", "Archivé")}
                              {t.archived_at ? badge("slate", `Le ${new Date(t.archived_at).toLocaleDateString("fr-FR")}`) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    }
                  >
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Raison d’archivage</label>
                      <input
                        value={f.archived_reason}
                        onChange={(e) => setEditForms((m) => ({ ...m, [t.id]: { ...f, archived_reason: e.target.value } }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => restoreTenant(t.id)}
                        className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Restaurer
                      </button>

                      {!hasAnyLeaseForTenant(t.id) ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => deleteTenant(t.id)}
                          className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      ) : (
                        <span className="text-[0.75rem] text-slate-600">Suppression désactivée (lié à un bail).</span>
                      )}
                    </div>
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>
      </div>
    </div>
  );
}
