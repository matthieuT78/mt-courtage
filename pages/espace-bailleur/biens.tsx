import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../../components/AppHeader";
import { supabase } from "../../lib/supabaseClient";

type SimpleUser = { id: string; email?: string };

type Property = {
  id: string;
  user_id: string;
  label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
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

type Tenant = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const fmt = (v?: string | null) => (v ? v : "—");

export default function EspaceBailleurBiensPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<SimpleUser | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => properties.find((p) => p.id === selectedId) || null,
    [properties, selectedId]
  );

  const [form, setForm] = useState({
    label: "",
    address_line1: "",
    address_line2: "",
    postal_code: "",
    city: "",
    country: "France",
  });

  // ---------- Auth guard
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        const u = data.session?.user;
        if (!mounted) return;

        if (!u?.id) {
          router.replace(
            `/mon-compte?mode=login&redirect=${encodeURIComponent("/espace-bailleur/biens")}`
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
            `/mon-compte?mode=login&redirect=${encodeURIComponent("/espace-bailleur/biens")}`
          );
          return;
        }
        setUser({ id: u.id, email: u.email ?? undefined });
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => sub?.subscription?.unsubscribe?.();
  }, [router]);

  // ---------- Load data
  const refresh = async (uid: string) => {
    setLoading(true);
    setErr(null);
    try {
      const [{ data: pData, error: pErr }, { data: lData, error: lErr }, { data: tData, error: tErr }] =
        await Promise.all([
          supabase.from("properties").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
          supabase.from("leases").select("id,user_id,property_id,tenant_id,start_date,end_date,status,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
          supabase.from("tenants").select("id,full_name,email").eq("user_id", uid).order("created_at", { ascending: false }),
        ]);

      if (pErr) throw pErr;
      if (lErr) throw lErr;
      if (tErr) throw tErr;

      setProperties((pData as any) ?? []);
      setLeases((lData as any) ?? []);
      setTenants((tData as any) ?? []);
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger vos biens.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) refresh(user.id);
  }, [user?.id]);

  // ---------- Sync form when selecting
  useEffect(() => {
    setOk(null);
    setErr(null);

    if (!selected) {
      setForm({
        label: "",
        address_line1: "",
        address_line2: "",
        postal_code: "",
        city: "",
        country: "France",
      });
      return;
    }

    setForm({
      label: selected.label || "",
      address_line1: selected.address_line1 || "",
      address_line2: selected.address_line2 || "",
      postal_code: selected.postal_code || "",
      city: selected.city || "",
      country: selected.country || "France",
    });
  }, [selectedId]); // eslint-disable-line

  // ---------- Helpers
  const activeTenantForProperty = (propertyId: string) => {
    const now = new Date();
    const lease = leases.find((l) => {
      if (l.property_id !== propertyId) return false;
      const startOk = l.start_date ? new Date(l.start_date) <= now : false;
      const notEnded = !l.end_date || new Date(l.end_date) >= now;
      if ((l.status || "").toLowerCase() === "active") return true;
      return startOk && notEnded;
    });
    if (!lease) return null;
    return tenants.find((t) => t.id === lease.tenant_id) || null;
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
        label: form.label?.trim() || "Bien sans titre",
        address_line1: form.address_line1?.trim() || null,
        address_line2: form.address_line2?.trim() || null,
        postal_code: form.postal_code?.trim() || null,
        city: form.city?.trim() || null,
        country: form.country?.trim() || "France",
      };

      if (selectedId) {
        const { error } = await supabase.from("properties").update(payload).eq("id", selectedId).eq("user_id", user.id);
        if (error) throw error;
        setOk("Bien mis à jour.");
      } else {
        const { data, error } = await supabase.from("properties").insert(payload).select().single();
        if (error) throw error;
        setOk("Bien créé.");
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
    if (!confirm("Supprimer ce bien ? (Les baux liés empêcheront la suppression)")) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase.from("properties").delete().eq("id", selectedId).eq("user_id", user.id);
      if (error) throw error;

      setOk("Bien supprimé.");
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
          {/* Header */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600">ImmoPilot</p>
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Biens</h1>
                <p className="text-xs text-slate-600">Gérez vos appartements (adresse, libellé) et retrouvez le locataire actif.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/espace-bailleur" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50">
                  ← Tableau de bord
                </Link>
                <Link href="/espace-bailleur/baux" className="rounded-full bg-slate-900 px-4 py-2 text-[0.75rem] font-semibold text-white hover:bg-slate-800">
                  Baux
                </Link>
                <Link href="/espace-bailleur/locataires" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50">
                  Locataires
                </Link>
              </div>
            </div>

            {err && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
            {ok && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>}
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)]">
            {/* Left list */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Mes biens</p>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  + Nouveau
                </button>
              </div>

              {loading && <p className="text-xs text-slate-500">Chargement…</p>}

              {!loading && properties.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                  Aucun bien pour le moment. Créez votre premier appartement.
                </div>
              )}

              <div className="space-y-2">
                {properties.map((p) => {
                  const active = p.id === selectedId;
                  const activeTenant = activeTenantForProperty(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={
                        "w-full text-left rounded-xl border px-3 py-3 transition " +
                        (active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                      }
                    >
                      <p className="text-sm font-semibold text-slate-900">{p.label || "Bien sans titre"}</p>
                      <p className="mt-0.5 text-[0.75rem] text-slate-600">
                        {[p.address_line1, p.address_line2, `${p.postal_code || ""} ${p.city || ""}`].filter(Boolean).join(" • ") || "Adresse non renseignée"}
                      </p>
                      <p className="mt-1 text-[0.75rem] text-slate-600">
                        Locataire actif : <span className="font-semibold">{activeTenant?.full_name || "—"}</span>
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Right form */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                {selected ? "Modifier le bien" : "Nouveau bien"}
              </p>

              <form onSubmit={onSave} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">Nom du bien</label>
                  <input
                    value={form.label}
                    onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">Adresse (ligne 1)</label>
                  <input
                    value={form.address_line1}
                    onChange={(e) => setForm((s) => ({ ...s, address_line1: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Adresse (ligne 2)</label>
                    <input
                      value={form.address_line2}
                      onChange={(e) => setForm((s) => ({ ...s, address_line2: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Code postal</label>
                    <input
                      value={form.postal_code}
                      onChange={(e) => setForm((s) => ({ ...s, postal_code: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Ville</label>
                    <input
                      value={form.city}
                      onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Pays</label>
                    <input
                      value={form.country}
                      onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
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
                  <p className="text-[0.7rem] text-slate-600">
                    (Le locataire actif est déterminé par le bail “actif” ou sans fin.)
                  </p>
                  <div className="mt-2 space-y-2">
                    {leases.filter((l) => l.property_id === selectedId).slice(0, 8).map((l) => {
                      const t = tenants.find((x) => x.id === l.tenant_id);
                      return (
                        <div key={l.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[0.75rem] font-semibold text-slate-900">
                            {t?.full_name || "Locataire"} • {fmt(l.status)}
                          </p>
                          <p className="text-[0.7rem] text-slate-600">
                            Début : {l.start_date} • Fin : {l.end_date || "—"}
                          </p>
                        </div>
                      );
                    })}
                    {leases.filter((l) => l.property_id === selectedId).length === 0 && (
                      <p className="text-[0.75rem] text-slate-500">Aucun bail pour ce bien.</p>
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
