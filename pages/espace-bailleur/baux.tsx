import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppHeader from "../../components/AppHeader";
import { supabase } from "../../lib/supabaseClient";

type SimpleUser = { id: string; email?: string };

type Lease = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string; // NOT NULL
  end_date: string | null;
  rent_amount: number | null;
  charges_amount: number | null;
  deposit_amount: number | null;
  payment_day: number | null;
  payment_method: string | null;
  status: string | null;
  auto_reminder_enabled: boolean | null;
  auto_quittance_enabled: boolean | null;
  reminder_day_of_month: number | null;
  reminder_email: string | null;
  tenant_receipt_email: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
};

type Property = {
  id: string;
  label: string | null;
  city: string | null;
};

type Tenant = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const formatEuro = (val: number | null | undefined) => {
  if (val == null || Number.isNaN(val)) return "—";
  return Number(val).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const clampInt = (val: string, min: number, max: number, fallback: number) => {
  const n = parseInt(String(val ?? ""), 10);
  const safe = Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, safe));
};

const parseMoneyNullable = (raw: string): number | null => {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const normalized = s.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const todayISOInTZ = (timeZone = "Europe/Paris") => {
  // fr-CA => YYYY-MM-DD (pratique pour <input type="date" />)
  return new Intl.DateTimeFormat("fr-CA", { timeZone }).format(new Date());
};

export default function EspaceBailleurBauxPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<SimpleUser | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [leases, setLeases] = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => leases.find((l) => l.id === selectedId) || null,
    [leases, selectedId]
  );

  // Form (V1: configuration de suivi quittances/loyers)
  const [form, setForm] = useState({
    property_id: "",
    tenant_id: "",
    start_date: todayISOInTZ("Europe/Paris"),
    end_date: "",
    rent_amount: "",
    charges_amount: "",
    deposit_amount: "",
    payment_day: "1",
    payment_method: "virement",
    status: "active",
    auto_quittance_enabled: true,
    auto_reminder_enabled: false,
    reminder_day_of_month: "1",
    reminder_email: "",
    tenant_receipt_email: "",
    timezone: "Europe/Paris",
  });

  // -------- Auth guard
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const u = data.session?.user;
        if (!mounted) return;

        if (!u?.id) {
          router.replace(
            `/mon-compte?mode=login&redirect=${encodeURIComponent("/espace-bailleur/baux")}`
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
            `/mon-compte?mode=login&redirect=${encodeURIComponent("/espace-bailleur/baux")}`
          );
          return;
        }
        setUser({ id: u.id, email: u.email ?? undefined });
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => sub?.subscription?.unsubscribe?.();
  }, [router]);

  const refresh = async (uid: string) => {
    setLoading(true);
    setErr(null);
    try {
      const [
        { data: lData, error: lErr },
        { data: pData, error: pErr },
        { data: tData, error: tErr },
      ] = await Promise.all([
        supabase.from("leases").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("properties").select("id,label,city").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("tenants").select("id,full_name,email").eq("user_id", uid).order("created_at", { ascending: false }),
      ]);

      if (lErr) throw lErr;
      if (pErr) throw pErr;
      if (tErr) throw tErr;

      setLeases((lData as any) ?? []);
      setProperties((pData as any) ?? []);
      setTenants((tData as any) ?? []);
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger vos configurations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) refresh(user.id);
  }, [user?.id]);

  const propertyById = useMemo(() => {
    const m = new Map<string, Property>();
    properties.forEach((p) => m.set(p.id, p));
    return m;
  }, [properties]);

  const tenantById = useMemo(() => {
    const m = new Map<string, Tenant>();
    tenants.forEach((t) => m.set(t.id, t));
    return m;
  }, [tenants]);

  // Compteur "configurations actives" (corrigé)
  const activeLeasesCount = useMemo(() => {
    const now = new Date();
    return leases.filter((l) => {
      const status = (l.status || "").toLowerCase();
      const startOk = !!l.start_date && new Date(l.start_date) <= now;
      const notEnded = !l.end_date || new Date(l.end_date) >= now;

      if (status === "active") return startOk && notEnded;
      if (!status) return startOk && notEnded;
      return false;
    }).length;
  }, [leases]);

  const leaseLimit = 5;
  const overLimit = activeLeasesCount > leaseLimit;

  // Sync form when selecting
  useEffect(() => {
    setOk(null);
    setErr(null);

    if (!selected) {
      setForm((s) => ({
        ...s,
        property_id: "",
        tenant_id: "",
        start_date: todayISOInTZ(s.timezone || "Europe/Paris"),
        end_date: "",
        rent_amount: "",
        charges_amount: "",
        deposit_amount: "",
        payment_day: "1",
        payment_method: "virement",
        status: "active",
        auto_quittance_enabled: true,
        auto_reminder_enabled: false,
        reminder_day_of_month: "1",
        reminder_email: "",
        tenant_receipt_email: "",
        timezone: "Europe/Paris",
      }));
      return;
    }

    setForm({
      property_id: selected.property_id || "",
      tenant_id: selected.tenant_id || "",
      start_date: selected.start_date || todayISOInTZ(selected.timezone || "Europe/Paris"),
      end_date: selected.end_date || "",
      rent_amount: selected.rent_amount != null ? String(selected.rent_amount) : "",
      charges_amount: selected.charges_amount != null ? String(selected.charges_amount) : "",
      deposit_amount: selected.deposit_amount != null ? String(selected.deposit_amount) : "",
      payment_day: selected.payment_day != null ? String(selected.payment_day) : "1",
      payment_method: selected.payment_method || "virement",
      status: selected.status || "active",
      auto_quittance_enabled: !!selected.auto_quittance_enabled,
      auto_reminder_enabled: !!selected.auto_reminder_enabled,
      reminder_day_of_month: selected.reminder_day_of_month != null ? String(selected.reminder_day_of_month) : "1",
      reminder_email: selected.reminder_email || "",
      tenant_receipt_email: selected.tenant_receipt_email || "",
      timezone: selected.timezone || "Europe/Paris",
    });
  }, [selected]);

  // Auto-remplissage email quittance depuis le locataire si vide
  useEffect(() => {
    const t = tenantById.get(form.tenant_id);
    if (!t?.email) return;
    if (form.tenant_receipt_email) return;
    setForm((s) => ({ ...s, tenant_receipt_email: t.email || "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tenant_id, tenantById]);

  // Auto-remplissage email de rappel depuis le user si activation + vide
  useEffect(() => {
    if (!form.auto_reminder_enabled) return;
    if (form.reminder_email) return;
    if (!user?.email) return;
    setForm((s) => ({ ...s, reminder_email: user.email || "" }));
  }, [form.auto_reminder_enabled, form.reminder_email, user?.email]);

  const computedTotal = useMemo(() => {
    const rent = parseMoneyNullable(form.rent_amount) ?? 0;
    const charges = parseMoneyNullable(form.charges_amount) ?? 0;
    return rent + charges;
  }, [form.rent_amount, form.charges_amount]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      // Limite Pro (bloquante à la création)
      if (!selectedId && overLimit) {
        throw new Error(`Vous avez déjà ${activeLeasesCount} configurations actives (seuil : ${leaseLimit}).`);
      }

      if (!form.property_id) throw new Error("Veuillez sélectionner un bien.");
      if (!form.tenant_id) throw new Error("Veuillez sélectionner un locataire.");
      if (!form.start_date) throw new Error("La date de début est obligatoire.");

      const paymentDayNum = clampInt(form.payment_day || "1", 1, 31, 1);
      const reminderDayNum = clampInt(form.reminder_day_of_month || "1", 1, 31, 1);

      const rent = parseMoneyNullable(form.rent_amount);
      const charges = parseMoneyNullable(form.charges_amount);
      const deposit = parseMoneyNullable(form.deposit_amount);

      if (form.rent_amount.trim() && rent == null) throw new Error("Loyer invalide.");
      if (form.charges_amount.trim() && charges == null) throw new Error("Charges invalides.");
      if (form.deposit_amount.trim() && deposit == null) throw new Error("Dépôt invalide.");

      const payload = {
        user_id: user.id,
        property_id: form.property_id,
        tenant_id: form.tenant_id,
        start_date: form.start_date, // NOT NULL
        end_date: form.end_date ? form.end_date : null,
        rent_amount: rent,
        charges_amount: charges,
        deposit_amount: deposit,
        payment_day: paymentDayNum,
        payment_method: form.payment_method || null,
        status: form.status || "active",
        auto_quittance_enabled: !!form.auto_quittance_enabled,
        auto_reminder_enabled: !!form.auto_reminder_enabled,
        reminder_day_of_month: reminderDayNum,
        reminder_email: form.auto_reminder_enabled ? (form.reminder_email ? form.reminder_email : null) : null,
        tenant_receipt_email: form.tenant_receipt_email ? form.tenant_receipt_email : null,
        timezone: form.timezone || "Europe/Paris",
      };

      if (selectedId) {
        const { error } = await supabase.from("leases").update(payload).eq("id", selectedId).eq("user_id", user.id);
        if (error) throw error;
        setOk("Configuration mise à jour.");
      } else {
        const { data, error } = await supabase.from("leases").insert(payload).select().single();
        if (error) throw error;
        setOk("Configuration créée.");
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
    if (!confirm("Supprimer cette configuration ? (Quittances/loyers liés peuvent empêcher la suppression)")) return;

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const { error } = await supabase.from("leases").delete().eq("id", selectedId).eq("user_id", user.id);
      if (error) throw error;

      setOk("Configuration supprimée.");
      setSelectedId(null);
      await refresh(user.id);
    } catch (e: any) {
      setErr(e?.message || "Suppression impossible (quittances/loyers existants ?).");
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
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Quittances & loyers</h1>
                <p className="text-xs text-slate-600">
                  Configurez le suivi mensuel : loyer, charges, jour de paiement, emails et automatisations.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/espace-bailleur"
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  ← Tableau de bord
                </Link>
                <Link
                  href="/espace-bailleur/biens"
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Biens
                </Link>
                <Link
                  href="/espace-bailleur/locataires"
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[0.75rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Locataires
                </Link>
              </div>
            </div>

            {/* Notice V1 (info + cadrage juridique) */}
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              <div className="flex flex-col gap-1">
                <p className="font-semibold">Information (V1)</p>
                <p className="text-sky-900">
                  Cette page sert à configurer le <span className="font-semibold">suivi des loyers</span> et la{" "}
                  <span className="font-semibold">génération des quittances</span> (montants, période, envoi, relances).
                  Elle ne génère pas encore un <span className="font-semibold">contrat de bail</span> au sens juridique
                  (document signé + annexes).
                </p>
              </div>
            </div>

            {overLimit && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Vous avez <span className="font-semibold">{activeLeasesCount}</span> configurations actives (seuil :{" "}
                {leaseLimit}). 👉 Prévoir une offre Pro au-delà de 5.
              </div>
            )}

            {err && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}
            {ok && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {ok}
              </div>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)]">
            {/* Left list */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Mes configurations</p>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  + Nouvelle configuration
                </button>
              </div>

              {loading && <p className="text-xs text-slate-500">Chargement…</p>}

              {!loading && leases.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
                  Aucune configuration. Créez-en une pour générer et suivre les quittances (bien + locataire).
                </div>
              )}

              <div className="space-y-2">
                {leases.map((l) => {
                  const active = l.id === selectedId;
                  const p = propertyById.get(l.property_id);
                  const t = tenantById.get(l.tenant_id);
                  const total = Number(l.rent_amount ?? 0) + Number(l.charges_amount ?? 0);

                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedId(l.id)}
                      className={
                        "w-full text-left rounded-xl border px-3 py-3 transition " +
                        (active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                      }
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {p?.label || "Bien"} • {t?.full_name || "Locataire"}
                      </p>
                      <p className="mt-0.5 text-[0.75rem] text-slate-600">
                        Total mensuel : <span className="font-semibold">{formatEuro(total)}</span>
                        {" • "}Début : {l.start_date}
                        {l.end_date ? ` • Fin : ${l.end_date}` : ""}
                      </p>
                      <p className="mt-1 text-[0.75rem] text-slate-600">
                        Statut : <span className="font-semibold">{l.status || "—"}</span> • Paiement :{" "}
                        <span className="font-semibold">{l.payment_day ?? "—"}</span>
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Right form */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                {selected ? "Modifier la configuration" : "Nouvelle configuration"}
              </p>

              <form onSubmit={onSave} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Bien</label>
                    <select
                      value={form.property_id}
                      onChange={(e) => setForm((s) => ({ ...s, property_id: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">— Sélectionner —</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label || "Bien"} {p.city ? `(${p.city})` : ""}
                        </option>
                      ))}
                    </select>
                    {properties.length === 0 && (
                      <p className="text-[0.7rem] text-amber-700">Aucun bien : créez-en un dans “Biens”.</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Locataire</label>
                    <select
                      value={form.tenant_id}
                      onChange={(e) => setForm((s) => ({ ...s, tenant_id: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">— Sélectionner —</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name || "Locataire"} {t.email ? `(${t.email})` : ""}
                        </option>
                      ))}
                    </select>
                    {tenants.length === 0 && (
                      <p className="text-[0.7rem] text-amber-700">Aucun locataire : créez-en un dans “Locataires”.</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Début de suivi <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Fin (optionnel)</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Charges (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.charges_amount}
                      onChange={(e) => setForm((s) => ({ ...s, charges_amount: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Dépôt (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.deposit_amount}
                      onChange={(e) => setForm((s) => ({ ...s, deposit_amount: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[0.75rem] text-slate-700">Total mensuel (loyer + charges)</p>
                  <p className="text-sm font-semibold text-slate-900">{formatEuro(computedTotal)}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Jour de paiement (1–31)</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={form.payment_day}
                      onChange={(e) => setForm((s) => ({ ...s, payment_day: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Mode de paiement</label>
                    <select
                      value={form.payment_method}
                      onChange={(e) => setForm((s) => ({ ...s, payment_method: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="virement">Virement</option>
                      <option value="prelevement">Prélèvement</option>
                      <option value="cheque">Chèque</option>
                      <option value="especes">Espèces</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Statut</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="active">Actif</option>
                      <option value="ended">Terminé</option>
                      <option value="draft">Brouillon</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                  <p className="text-[0.75rem] font-semibold text-slate-900">Automatisations</p>

                  <label className="inline-flex items-center gap-2 text-[0.8rem] text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.auto_quittance_enabled}
                      onChange={(e) => setForm((s) => ({ ...s, auto_quittance_enabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    <span>Auto-quittance mensuelle (pour ce locataire)</span>
                  </label>

                  <label className="inline-flex items-center gap-2 text-[0.8rem] text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.auto_reminder_enabled}
                      onChange={(e) => setForm((s) => ({ ...s, auto_reminder_enabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    <span>Rappel automatique (loyer dû / retard)</span>
                  </label>

                  <div className={"grid gap-3 sm:grid-cols-2 " + (!form.auto_reminder_enabled ? "opacity-60" : "")}>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Jour de rappel (1–31)</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={form.reminder_day_of_month}
                        onChange={(e) => setForm((s) => ({ ...s, reminder_day_of_month: e.target.value }))}
                        disabled={!form.auto_reminder_enabled}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Email de rappel</label>
                      <input
                        type="email"
                        value={form.reminder_email}
                        onChange={(e) => setForm((s) => ({ ...s, reminder_email: e.target.value }))}
                        disabled={!form.auto_reminder_enabled}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Email quittance (locataire)</label>
                      <input
                        type="email"
                        value={form.tenant_receipt_email}
                        onChange={(e) => setForm((s) => ({ ...s, tenant_receipt_email: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Timezone</label>
                      <input
                        value={form.timezone}
                        onChange={(e) => setForm((s) => ({ ...s, timezone: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={loading || (!selectedId && overLimit)}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    title={!selectedId && overLimit ? "Limite atteinte : offre Pro requise." : undefined}
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

                  <Link
                    href="/quittances-loyer"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Gérer les quittances →
                  </Link>
                </div>

                <p className="text-[0.7rem] text-slate-500">
                  ⚠️ Important : le filtrage par <span className="font-semibold">user_id</span> côté client ne suffit pas.
                  Activez les <span className="font-semibold">RLS</span> sur les tables et ajoutez des policies basées sur{" "}
                  <span className="font-semibold">auth.uid() = user_id</span>.
                </p>
              </form>
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
