import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../../components/AppHeader";
import { supabase } from "../../lib/supabaseClient";

type SimpleUser = { id: string; email?: string };

type Tenant = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Lease = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  status: string | null;
  created_at: string;
};

type Property = {
  id: string;
  label: string | null;
};

const fmt = (v?: string | null) => (v ? v : "—");

export default function EspaceBailleurLocatairesPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<SimpleUser | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => tenants.find((t) => t.id === selectedId) || null,
    [tenants, selectedId]
  );

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    notes: "",
  });

  // ---------- Auth
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const u = data.session?.user;
        if (!mounted) return;

        if (!u?.id) {
          router.replace(
            `/mon-compte?mode=login&redirect=${encodeURIComponent("/espace-bailleur/locataires")}`
          );
          return;
        }
        setUser({ id: u.id, email: u.email ?? undefined });
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    const { data: sub } =
      supabase?.auth.onAuthStateChange((_evt, session) => {
        const u = session?.user;
        if (!u?.id) {
          router.replace(
            `/mon-compte?mode=login&redirect=${encodeURIComponent("/espace-bailleur/locataires")}`
          );
          return;
        }
        setUser({ id: u.id, email: u.email ?? undefined });
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => sub?.subscription?.unsubscribe?.();
  }, [router]);

  // ---------- Load
  const refresh = async (uid: string) => {
    setLoading(true);
    setErr(null);
    try {
      const [{ data: tData, error: tErr }, { data: lData, error: lErr }, { data: pData, error: pErr }] =
        await Promise.all([
          supabase.from("tenants").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
          supabase.from("leases").select("id,user_id,property_id,tenant_id,start_date,end_date,status,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
          supabase.from("properties").select("id,label").eq("user_id", uid).order("created_at", { ascending: false }),
        ]);

      if (tErr) throw tErr;
      if (lErr) throw lErr;
      if (pErr) throw pErr;

      setTenants((tData as any) ?? []);
      setLeases((lData as any) ?? []);
      setProperties((pData as any) ?? []);
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger vos locataires.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) refresh(user.id);
  }, [user?.id]);

  // ---------- Sync form
  useEffect(() => {
    setOk(null);
    setErr(null);

    if (!selected) {
      setForm({ full_name: "", email: "", phone: "", notes: "" });
      return;
    }
    setForm({
      full_name: selected.full_name || "",
      email: selected.email || "",
      phone: selected.phone || "",
      notes: selected.notes || "",
    });
  }, [selectedId]); // eslint-disable-line

  // ---------- Active property for tenant
  const activePropertyForTenant = (tenantId: string) => {
    const now = new Date();
    const lease = leases.find((l) => {
      if (l.tenant_id !== tenantId) return false;
      const startOk = l.start_date ? new Date(l.start_date) <= now : false;
      const notEnded = !l.end_date || new Date(l.end_date) >= now;
      if ((l.status || "").toLowerCase() === "active") return true;
      return startOk && notEnded;
    });
    if (!lease) return null;
    return properties.find((p) => p.id === lease.property_id) || null;
  };

  // ---------- CRUD
  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const payload = {
        user_id: user.id,
        full_name: form.full_name?.trim() || "Locataire",
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        notes: form.notes?.trim() || null,
      };

      if (selectedId) {
        const { error } = await supabase.from("tenants").update(payload).eq("id", selectedId).eq("user_id", user.id);
        if (error) throw error;
        setOk("Locataire mis à jour.");
      } else {
        const { data, error } = await supabase.from("tenants").insert(payload).select().single();
        if (error) throw error;
        setOk("Locataire créé.");
        setSelectedId((data as any).id);
      }

      await refresh(user.id);
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de l’enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!user?.id || !selectedId) return;
    if (!confirm("Supprimer ce locataire ? (Les baux liés empêcheront la suppression)")) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase.from("tenants").delete().eq("id", selectedId).eq("user_id", user.id);
      if (error) throw error;

      setOk("Locataire supprimé.");
      setSelectedId(null);
      await refresh(user.id);
    } catch (e: any) {
      setErr(e?.message || "Suppression impossible (baux existants ?).");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 px-4 py-6">
          <div className="max-w-5xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <p className="text-sm text-slate-600">Chargement…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600">ImmoPilot</p>
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Locataires</h1>
                <p className="text-xs text-slate-600">Gérez vos locataires et visualisez leur “bail actif”.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/espace-bailleur" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50">
                  ← Tableau de bord
                </Link>
                <Link href="/espace-bailleur/baux" className="rounded-full bg-slate-900 px-4 py-2 text-[0.75rem] font-semibold text-white hover:bg-slate-800">
                  Baux
                </Link>
                <Link href="/espace-bailleur/biens" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50">
                  Biens
                </Link>
              </div>
            </div>

            {err && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
            {ok && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>}
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)]">
            {/* List */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Mes locataires</p>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  + Nouveau
                </button>
              </div>

              {loading && <p className="text-xs text-slate-500">Chargement…</p>}

              {!loading && tenants.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                  Aucun locataire pour le moment.
                </div>
              )}

              <div className="space-y-2">
                {tenants.map((t) => {
                  const active = t.id === selectedId;
                  const p = activePropertyForTenant(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={
                        "w-full text-left rounded-xl border px-3 py-3 transition " +
                        (active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                      }
                    >
                      <p className="text-sm font-semibold text-slate-900">{t.full_name || "Locataire"}</p>
                      <p className="mt-0.5 text-[0.75rem] text-slate-600">{t.email || "—"} {t.phone ? `• ${t.phone}` : ""}</p>
                      <p className="mt-1 text-[0.75rem] text-slate-600">
                        Bail actif : <span className="font-semibold">{p?.label || "—"}</span>
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Form */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                {selected ? "Modifier le locataire" : "Nouveau locataire"}
              </p>

              <form onSubmit={onSave} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">Nom complet</label>
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Téléphone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">Notes</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {loading ? "Enregistrement…" : selected ? "Mettre à jour" : "Créer"}
                  </button>

                  {selectedId ? (
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Supprimer
                    </button>
                  ) : null}
                </div>
              </form>

              {selectedId ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[0.75rem] font-semibold text-slate-900">Historique des baux</p>
                  <div className="mt-2 space-y-2">
                    {leases.filter((l) => l.tenant_id === selectedId).slice(0, 8).map((l) => {
                      const p = properties.find((x) => x.id === l.property_id);
                      return (
                        <div key={l.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[0.75rem] font-semibold text-slate-900">
                            {p?.label || "Bien"} • {fmt(l.status)}
                          </p>
                          <p className="text-[0.7rem] text-slate-600">
                            Début : {l.start_date} • Fin : {l.end_date || "—"}
                          </p>
                        </div>
                      );
                    })}
                    {leases.filter((l) => l.tenant_id === selectedId).length === 0 && (
                      <p className="text-[0.75rem] text-slate-500">Aucun bail pour ce locataire.</p>
                    )}
                  </div>

                  <div className="mt-3">
                    <Link
                      href="/espace-bailleur/baux"
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[0.75rem] font-semibold text-white hover:bg-slate-800"
                    >
                      Créer / gérer un bail →
                    </Link>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        © {new Date().getFullYear()} ImmoPilot
      </footer>
    </div>
  );
}
