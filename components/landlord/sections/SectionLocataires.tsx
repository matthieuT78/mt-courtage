import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";

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

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

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

export function SectionLocataires({ userId, tenants, leases, properties, onRefresh }: Props) {
  const safeTenants = Array.isArray(tenants) ? tenants : [];
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeProperties = Array.isArray(properties) ? properties : [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"az" | "recent">("az");
  const [showArchived, setShowArchived] = useState(false);

  const selected = useMemo(
    () => safeTenants.find((t) => t.id === selectedId) || null,
    [safeTenants, selectedId]
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Form prénom/nom
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
    archived_reason: "",
  });

  useEffect(() => {
    setOk(null);
    setErr(null);

    if (!selected) {
      setForm({ first_name: "", last_name: "", email: "", phone: "", notes: "", archived_reason: "" });
      return;
    }

    const fromCols = {
      first_name: (selected.first_name || "").trim(),
      last_name: (selected.last_name || "").trim(),
    };

    const fromFull = splitFullName(selected.full_name);

    setForm({
      first_name: fromCols.first_name || fromFull.first,
      last_name: fromCols.last_name || fromFull.last,
      email: selected.email || "",
      phone: selected.phone || "",
      notes: selected.notes || "",
      archived_reason: selected.archived_reason || "",
    });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ======================================================
     Helpers
  ====================================================== */

  const propertyById = useMemo(() => {
    const m = new Map<string, PropertyLite>();
    for (const p of safeProperties) m.set(p.id, p);
    return m;
  }, [safeProperties]);

  const activeLeaseForTenant = (tenantId: string) => {
    const now = new Date();
    const lease = safeLeases.find((l) => {
      if (!l || l.tenant_id !== tenantId) return false;

      const startOk = l.start_date ? new Date(l.start_date) <= now : false;
      const notEnded = !l.end_date || new Date(l.end_date) >= now;

      if ((l.status || "").toLowerCase() === "active") return true;
      return startOk && notEnded;
    });

    return lease || null;
  };

  const activePropertyForTenant = (tenantId: string) => {
    const lease = activeLeaseForTenant(tenantId);
    if (!lease) return null;
    return propertyById.get(lease.property_id) || null;
  };

  const hasAnyLeaseForTenant = (tenantId: string) =>
    safeLeases.some((l) => l?.tenant_id === tenantId);

  const leasesForSelected = useMemo(() => {
    if (!selectedId) return [];
    return safeLeases.filter((l) => l?.tenant_id === selectedId).slice(0, 12);
  }, [safeLeases, selectedId]);

  const safeRefresh = async () => {
    try {
      await onRefresh?.();
    } catch (e) {
      console.error("[SectionLocataires] onRefresh error:", e);
    }
  };

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const filteredTenants = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = safeTenants
      .filter((t) => (showArchived ? true : !isArchived(t)))
      .filter((t) => {
        if (!q) return true;
        const name = (displayName(t) || "").toLowerCase();
        const email = (t.email || "").toLowerCase();
        const phone = (t.phone || "").toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      });

    if (sort === "recent") {
      base.sort((a, b) => {
        const da = new Date(a.updated_at || a.created_at || 0).getTime();
        const db = new Date(b.updated_at || b.created_at || 0).getTime();
        return db - da;
      });
    } else {
      base.sort((a, b) => {
        const na = (displayName(a) || "Locataire").toLowerCase();
        const nb = (displayName(b) || "Locataire").toLowerCase();
        return na.localeCompare(nb);
      });
    }
    return base;
  }, [safeTenants, query, sort, showArchived]);

  /* ======================================================
     CRUD
  ====================================================== */

  const saveTenant = async () => {
    if (!userId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

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

      if (selectedId) {
        const res = await withTimeout(
          Promise.resolve(
            supabase
              .from("tenants")
              .update(payload)
              .eq("id", selectedId)
              .eq("user_id", userId)
              .select("id, full_name, first_name, last_name, archived_at")
              .single()
          )
        );
        // @ts-ignore
        if ((res as any)?.error) throw (res as any).error;
        setOk("Locataire mis à jour ✅");
      } else {
        const res = await withTimeout(
          Promise.resolve(
            supabase
              .from("tenants")
              .insert(payload)
              .select("id, full_name, first_name, last_name, archived_at")
              .single()
          )
        );
        // @ts-ignore
        if ((res as any)?.error) throw (res as any).error;

        const newId = (res as any)?.data?.id ?? null;
        setOk("Locataire créé ✅");
        setSelectedId(newId);
      }

      await safeRefresh();
    } catch (e: any) {
      console.error("[saveTenant] error:", e);
      setErr(e?.message || "Erreur lors de l’enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const archiveTenant = async () => {
    if (!userId || !selectedId) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const res = await withTimeout(
        Promise.resolve(
          supabase
            .from("tenants")
            .update({
              archived_at: new Date().toISOString(),
              archived_reason: form.archived_reason?.trim() || null,
            })
            .eq("id", selectedId)
            .eq("user_id", userId)
            .select("id, archived_at")
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

  const restoreTenant = async () => {
    if (!userId || !selectedId) return;

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
            .eq("id", selectedId)
            .eq("user_id", userId)
            .select("id, archived_at")
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

  const deleteTenant = async () => {
    if (!userId || !selectedId) return;

    if (hasAnyLeaseForTenant(selectedId)) {
      setErr("Suppression impossible : ce locataire est lié à un bail.");
      return;
    }

    if (!confirm("Supprimer définitivement ce locataire ?")) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const res = await withTimeout(
        Promise.resolve(
          supabase
            .from("tenants")
            .delete()
            .eq("id", selectedId)
            .eq("user_id", userId)
        )
      );
      // @ts-ignore
      if ((res as any)?.error) throw (res as any).error;

      setOk("Locataire supprimé ✅");
      setSelectedId(null);
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

  const selectedIsArchived = selected ? isArchived(selected) : false;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Locataires"
        title="Gestion des locataires"
        desc="Créez, modifiez, archivez. Conservez l’historique et les quittances."
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)]">
        {/* LIST */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Mes locataires</p>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                setSelectedId(null);
              }}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
            >
              + Nouveau
            </button>
          </div>

          {/* Search + sort + toggle archived */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  🔎
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher (nom, email, téléphone)…"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Afficher les locataires archivés
            </label>
          </div>

          {loading ? <p className="text-xs text-slate-500">Chargement…</p> : null}

          {!loading && filteredTenants.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-700">
              {safeTenants.length === 0 ? "Aucun locataire pour le moment." : "Aucun résultat."}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTenants.map((t) => {
                const active = t.id === selectedId;
                const activeLease = activeLeaseForTenant(t.id);
                const p = activePropertyForTenant(t.id);
                const hasLease = hasAnyLeaseForTenant(t.id);
                const archived = isArchived(t);

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      setSelectedId(t.id);
                    }}
                    className={cx(
                      "w-full text-left rounded-2xl border px-3 py-3 transition relative overflow-hidden",
                      active
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:bg-slate-50 hover:shadow-sm",
                      archived ? "opacity-80" : ""
                    )}
                  >
                    <div
                      className={cx(
                        "absolute left-0 top-0 h-full w-1",
                        active ? "bg-emerald-500" : "bg-transparent"
                      )}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        <div
                          className={cx(
                            "shrink-0 h-10 w-10 rounded-2xl border flex items-center justify-center text-sm font-semibold",
                            active
                              ? "border-emerald-200 bg-white text-slate-900"
                              : "border-slate-200 bg-slate-50 text-slate-800"
                          )}
                          title="Locataire"
                        >
                          {initials(t.first_name, t.last_name, t.full_name)}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {displayName(t)}
                          </p>

                          <p className="mt-0.5 text-[0.75rem] text-slate-600 truncate">
                            {(t.email || "—") + (t.phone ? ` • ${t.phone}` : "")}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {archived ? (
                              <span className="inline-flex items-center rounded-full bg-slate-200 text-slate-800 px-2.5 py-1 text-[0.7rem] font-semibold">
                                Archivé
                              </span>
                            ) : activeLease ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[0.7rem] font-semibold">
                                Actif
                              </span>
                            ) : hasLease ? (
                              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 text-[0.7rem] font-semibold">
                                Historique
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-[0.7rem] font-semibold">
                                Sans bail
                              </span>
                            )}

                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-slate-800">
                              🏠 {p?.label || "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800">
                        Ouvrir →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[0.7rem] text-slate-500 pt-1">
            Astuce : archive au lieu de supprimer pour garder quittances & historique.
          </p>
        </section>

        {/* FORM */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
              {selected ? "Modifier le locataire" : "Nouveau locataire"}
            </p>

            {selected ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
                {initials(selected.first_name, selected.last_name, selected.full_name)}
              </span>
            ) : null}
          </div>

          {/* Quick actions */}
          {selected ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-900">Actions rapides</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    copyToClipboard(selected.email || "");
                    setOk(selected.email ? "Email copié ✅" : "Aucun email à copier.");
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Copier email
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    copyToClipboard(sanitizePhone(selected.phone));
                    setOk(selected.phone ? "Téléphone copié ✅" : "Aucun téléphone à copier.");
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Copier tél.
                </button>

                {selected.email ? (
                  <a
                    onClick={(e) => e.stopPropagation()}
                    href={`mailto:${selected.email}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Envoyer un email
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {/* PRENOM / NOM */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[0.7rem] text-slate-700">Prénom</label>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Ex : Marie"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[0.7rem] text-slate-700">Nom</label>
                <input
                  value={form.last_name}
                  onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Ex : Dupont"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[0.7rem] text-slate-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="nom@email.fr"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[0.7rem] text-slate-700">Téléphone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="06 00 00 00 00"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Infos utiles (préférence de contact, particularités, etc.)"
              />
            </div>

            {/* Raison d’archivage (facultatif) */}
            <div className="space-y-1">
              <label className="text-[0.7rem] text-slate-700">Raison d’archivage (optionnel)</label>
              <input
                value={form.archived_reason}
                onChange={(e) => setForm((s) => ({ ...s, archived_reason: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Ex : Départ le 30/06, état des lieux fait…"
              />
            </div>

            {/* ✅ Boutons : Mettre à jour + Archiver (même niveau). ✅ Nouveau supprimé */}
            <div className="flex flex-wrap gap-2 pt-2 items-center">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  if (loading) return;
                  saveTenant();
                }}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {loading ? "Enregistrement…" : selected ? "Mettre à jour" : "Créer"}
              </button>

              {selectedId ? (
                !selectedIsArchived ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      if (loading) return;
                      archiveTenant();
                    }}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Archiver
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      if (loading) return;
                      restoreTenant();
                    }}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Restaurer
                  </button>
                )
              ) : null}

              {selectedId && selectedIsArchived && selected?.archived_at ? (
                <span className="text-[0.75rem] text-slate-600">
                  Archivé le {new Date(selected.archived_at).toLocaleDateString()}
                </span>
              ) : null}
            </div>

            {/* Danger zone: suppression définitive si aucun bail */}
            {selectedId && selected && !hasAnyLeaseForTenant(selectedId) ? (
              <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-800">Suppression définitive</p>
                <p className="mt-1 text-[0.75rem] text-red-700">
                  Possible uniquement si aucun bail n’est associé. Sinon, archive.
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    if (loading) return;
                    deleteTenant();
                  }}
                  disabled={loading}
                  className="mt-2 inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-4 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  Supprimer
                </button>
              </div>
            ) : null}
          </div>

          {/* HISTORY */}
          {selectedId ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[0.75rem] font-semibold text-slate-900">Historique des baux</p>

              <div className="mt-2 space-y-2">
                {leasesForSelected.length === 0 ? (
                  <p className="text-[0.75rem] text-slate-500">Aucun bail pour ce locataire.</p>
                ) : (
                  leasesForSelected.map((l) => {
                    const p = propertyById.get(l.property_id);
                    return (
                      <div key={l.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[0.75rem] font-semibold text-slate-900">
                          🏠 {p?.label || "Bien"} • {fmt(l.status)}
                        </p>
                        <p className="text-[0.7rem] text-slate-600">
                          Début : {l.start_date} • Fin : {l.end_date || "—"}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              <p className="mt-2 text-[0.7rem] text-slate-500">
                (Le bail actif est déterminé par le statut “active” ou une fin absente / future.)
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
