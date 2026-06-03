import { useEffect, useMemo, useState } from "react";

type CountRow = { count: number };
type StatsPayload = {
  ok: boolean;
  generated_at: string;
  total: number;
  window_days: number;
  dataWarnings?: string[];
  byTool: { tool: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byDay: { day: string; count: number }[];
  consents: {
    consent_analysis_yes: number;
    consent_contact_yes: number;
    consent_analysis_rate: number;
    consent_contact_rate: number;
  };
  leads: {
    total: number;
    windowTotal: number;
    avgPerDay: number;
    withPhone: number;
    withPhoneRate: number;
    linkedToAccount: number;
    linkedToAccountRate: number;
    uniqueEmails: number;
    latestLeadAt: string | null;
    hottestTool: { tool: string; count: number } | null;
  };
  leadQuality: {
    scored: number;
    hot: number;
    warm: number;
    cold: number;
    avgScore: number;
    avgBudget: number | null;
    medianBudget: number | null;
    p90Budget: number | null;
    avgContribution: number | null;
    avgLoan: number | null;
    byBudgetRange: ({ range: string } & CountRow)[];
    byTier: ({ tier: string } & CountRow)[];
    byTool: ({ tool: string } & CountRow)[];
    top: Array<{
      id: string;
      tool: string;
      city: string | null;
      postal_code: string | null;
      created_at: string | null;
      score: number;
      tier: string;
      budget: number | null;
      propertyValue: number | null;
      loan: number | null;
      contribution: number | null;
      cashflow: number | null;
      netYield: number | null;
      hasPhone: boolean;
      consentContact: boolean;
      reasons: string[];
    }>;
  };
  users: {
    total: number;
    withEmail: number;
    confirmed: number;
    confirmedRate: number;
    windowTotal: number;
    latestUserAt: string | null;
    profiles: number;
    profileCompletionRate: number;
  };
  subscriptions: {
    total: number;
    active: number;
    activePaid: number;
    freeLandlordUsers: number;
    paidConversionRate: number;
    mrr: number;
    arr: number;
    arpu: number;
    byPlan: ({ plan: string; label: string } & CountRow)[];
    byStatus: ({ status: string } & CountRow)[];
    cancelAtPeriodEnd: number;
  };
  landlord: {
    landlordUsers: number;
    properties: { total: number; active: number; archived: number; windowTotal: number; byStatus: ({ status: string } & CountRow)[] };
    leases: { total: number; active: number; byStatus: ({ status: string } & CountRow)[] };
    tenants: { total: number; archived: number; active: number };
    receipts: {
      total: number;
      windowTotal: number;
      monthTotal: number;
      sent: number;
      pdfReady: number;
      failed: number;
      totalAmount: number;
      monthAmount: number;
      byStatus: ({ status: string } & CountRow)[];
    };
  };
  conversion: {
    leadEmailToAccountRate: number;
    accountToLandlordRate: number;
    accountToPaidRate: number;
    landlordToPaidRate: number;
  };
};

type LeadRow = {
  id: string;
  created_at: string;
  tool: string;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  postal_code: string | null;
  city: string | null;
  consent_analysis: boolean;
  consent_contact: boolean;
  status: string | null;
};

type Plan = "calc_blur" | "calc_full" | "landlord_5" | "landlord_15" | "landlord_unlimited";

type AdminSubscription = {
  plan: Plan;
  status: string;
  ends_at: string | null;
  billing_interval: string | null;
  updated_at: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  cancel_at_period_end?: boolean | null;
};

type AdminUserRow = {
  id: string;
  email: string;
  full_name?: string | null;
  is_admin: boolean;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  account_tier?: string | null;
  subscription_plan?: string | null;
  effective_plan: Plan;
  subscription: AdminSubscription | null;
};

const PLAN_LABELS: Record<Plan, string> = {
  calc_blur: "Calculatrice limitée",
  calc_full: "Gratuit",
  landlord_5: "Bailleur Starter",
  landlord_15: "Bailleur Essentiel",
  landlord_unlimited: "Full droits",
};

const EDITABLE_PLANS: Plan[] = ["calc_full", "landlord_5", "landlord_15", "landlord_unlimited"];

function formatPct(value: number | null | undefined) {
  return ((value || 0) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function formatEuro(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function StatCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "slate" | "emerald" | "cyan" | "amber" | "rose";
}) {
  const tones = {
    slate: "border-slate-200 bg-white",
    emerald: "border-emerald-200 bg-emerald-50",
    cyan: "border-cyan-200 bg-cyan-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
  };
  return (
    <div className={cx("rounded-2xl border p-4 shadow-sm", tones[tone])}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold leading-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
    </div>
  );
}

function BarList({
  title,
  rows,
  labelKey,
}: {
  title: string;
  rows: Array<Record<string, any> & CountRow>;
  labelKey: string;
}) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <div className="mt-4 space-y-3">
        {rows.length ? (
          rows.slice(0, 8).map((row) => (
            <div key={String(row[labelKey])}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-700">{String(row[labelKey])}</span>
                <span className="font-semibold text-slate-950">{row.count}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Aucune donnée.</p>
        )}
      </div>
    </div>
  );
}

function FunnelStep({ label, value, rate }: { label: string; value: string; rate: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{rate}</p>
    </div>
  );
}

function qualityTone(tier: string) {
  if (tier === "Chaud") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tier === "À travailler") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function planTone(plan: Plan) {
  if (plan === "landlord_unlimited") return "border-indigo-200 bg-indigo-50 text-indigo-800";
  if (plan === "landlord_15") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  if (plan === "landlord_5") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function AdminLeadsPage() {
  const [token, setToken] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [statsErr, setStatsErr] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [tool, setTool] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [listErr, setListErr] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const [accountUsers, setAccountUsers] = useState<AdminUserRow[]>([]);
  const [accountErr, setAccountErr] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [savingPlanForUserId, setSavingPlanForUserId] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRows / pageSize)), [totalRows, pageSize]);
  const maxDaily = useMemo(() => Math.max(...(stats?.byDay || []).map((row) => row.count), 1), [stats?.byDay]);

  useEffect(() => {
    const t = window.localStorage.getItem("ADMIN_TOKEN") || "";
    setToken(t);
    setTokenSaved(!!t);
  }, []);

  const saveToken = () => {
    window.localStorage.setItem("ADMIN_TOKEN", token);
    setTokenSaved(true);
  };

  async function fetchStats() {
    setLoadingStats(true);
    setStatsErr(null);
    try {
      const resp = await fetch(`/api/admin/leads/stats?days=${days}`, { headers: { "x-admin-token": token } });
      const payload = await resp.json();
      if (!resp.ok) throw new Error(payload?.error || "Erreur stats");
      setStats(payload);
    } catch (e: any) {
      setStatsErr(e?.message || "Erreur inconnue");
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }

  async function fetchList() {
    setLoadingList(true);
    setListErr(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (tool) params.set("tool", tool);
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const resp = await fetch(`/api/admin/leads/list?${params.toString()}`, { headers: { "x-admin-token": token } });
      const payload = await resp.json();
      if (!resp.ok) throw new Error(payload?.error || "Erreur liste");
      setRows(payload.items || []);
      setTotalRows(payload.total || 0);
    } catch (e: any) {
      setListErr(e?.message || "Erreur inconnue");
      setRows([]);
      setTotalRows(0);
    } finally {
      setLoadingList(false);
    }
  }

  async function fetchAccounts() {
    setLoadingAccounts(true);
    setAccountErr(null);
    try {
      const resp = await fetch("/api/admin/users", { headers: { "x-admin-token": token } });
      const payload = await resp.json();
      if (!resp.ok || !payload?.ok) throw new Error(payload?.error || "Erreur comptes");
      setAccountUsers(payload.users || []);
    } catch (e: any) {
      setAccountErr(e?.message || "Erreur inconnue");
      setAccountUsers([]);
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function updateAccountPlan(row: AdminUserRow, plan: Plan) {
    setSavingPlanForUserId(row.id);
    setAccountErr(null);
    setAccountMessage(null);
    try {
      const resp = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({ userId: row.id, plan, status: "active" }),
      });
      const payload = await resp.json();
      if (!resp.ok || !payload?.ok) throw new Error(payload?.error || "Erreur mise à jour");

      setAccountUsers((prev) =>
        prev.map((userRow) =>
          userRow.id === row.id
            ? {
                ...userRow,
                effective_plan: plan,
                subscription_plan: plan,
                subscription: {
                  plan,
                  status: "active",
                  ends_at: null,
                  billing_interval: "manual",
                  updated_at: new Date().toISOString(),
                },
              }
            : userRow
        )
      );
      setAccountMessage(`Abonnement mis à jour pour ${row.email}.`);
      await fetchAccounts();
    } catch (e: any) {
      setAccountErr(e?.message || "Erreur inconnue");
    } finally {
      setSavingPlanForUserId(null);
    }
  }

  useEffect(() => {
    if (!token) return;
    fetchStats();
    fetchList();
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setPage(1);
  }, [tool, status, q, pageSize, token]);

  useEffect(() => {
    if (!token) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tool, status, q, pageSize, token]);

  const refreshAll = async () => {
    await Promise.all([fetchStats(), fetchList(), fetchAccounts()]);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-900 bg-slate-950 shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr,420px]">
            <div className="p-6 sm:p-8">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-cyan-200">Admin local lokt.fr</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Cockpit d’acquisition, espace bailleur et revenus.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Vue pilotage pour comprendre quelles calculettes génèrent des leads, combien de comptes passent sur l’espace bailleur,
                quelles offres convertissent et où regarder pour améliorer le business.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Leads</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Utilisateurs</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Abonnements</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Biens, baux, quittances</span>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/[0.04] p-6 lg:border-l lg:border-t-0">
              <label className="text-xs font-semibold text-slate-200">ADMIN_TOKEN</label>
              <input
                type="password"
                value={token}
                onChange={(e) => {
                  setTokenSaved(false);
                  setToken(e.target.value);
                }}
                placeholder="Token local"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm text-slate-950"
              />
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Stocké dans ton navigateur via localStorage. Cette page est à garder locale, non poussée.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={saveToken} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
                  {tokenSaved ? "Token enregistré" : "Enregistrer"}
                </button>
                <button
                  onClick={refreshAll}
                  disabled={!token || loadingStats || loadingList}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Rafraîchir
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Période d’analyse</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Vue sur {days} jours</h2>
              {stats?.generated_at ? <p className="mt-1 text-xs text-slate-500">Dernière génération : {formatDate(stats.generated_at)}</p> : null}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {[7, 30, 90, 365].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDays(value)}
                  className={cx(
                    "rounded-full border px-4 py-2 text-sm font-semibold",
                    days === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  {value} j
                </button>
              ))}
              <button
                onClick={fetchStats}
                disabled={!token || loadingStats}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loadingStats ? "Chargement..." : "Mettre à jour"}
              </button>
            </div>
          </div>

          {statsErr ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{statsErr}</p> : null}
          {stats?.dataWarnings?.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Données partielles : {stats.dataWarnings.join(" · ")}
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-indigo-700">Comptes & droits</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Utilisateurs avec compte lokt.fr</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Tous les comptes Supabase Auth, avec profil, dernière subscription et plan effectif. Le menu permet de forcer un abonnement manuel immédiatement.
              </p>
            </div>
            <button
              onClick={fetchAccounts}
              disabled={!token || loadingAccounts}
              className="rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
            >
              {loadingAccounts ? "Chargement..." : "Rafraîchir comptes"}
            </button>
          </div>

          {accountErr ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">❌ {accountErr}</p> : null}
          {accountMessage ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✅ {accountMessage}</p> : null}

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[1040px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="p-3 text-xs text-slate-600">Utilisateur</th>
                  <th className="p-3 text-xs text-slate-600">Rôle</th>
                  <th className="p-3 text-xs text-slate-600">Plan effectif</th>
                  <th className="p-3 text-xs text-slate-600">Profil</th>
                  <th className="p-3 text-xs text-slate-600">Subscription</th>
                  <th className="p-3 text-xs text-slate-600">Dernière connexion</th>
                  <th className="p-3 text-xs text-slate-600">Changer les droits</th>
                </tr>
              </thead>
              <tbody>
                {accountUsers.map((row) => {
                  const saving = savingPlanForUserId === row.id;
                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="p-3 align-top">
                        <p className="font-semibold text-slate-950">{row.full_name || row.email}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                        <p className="mt-1 text-[0.68rem] text-slate-400">Créé le {formatDate(row.created_at)}</p>
                      </td>
                      <td className="p-3 align-top">
                        <span
                          className={cx(
                            "inline-flex rounded-full border px-2 py-1 text-xs font-semibold",
                            row.is_admin ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"
                          )}
                        >
                          {row.is_admin ? "Admin" : "Utilisateur"}
                        </span>
                      </td>
                      <td className="p-3 align-top">
                        <span className={cx("inline-flex rounded-full border px-2 py-1 text-xs font-semibold", planTone(row.effective_plan))}>
                          {PLAN_LABELS[row.effective_plan]}
                        </span>
                      </td>
                      <td className="p-3 align-top text-slate-700">
                        <p>{row.account_tier || "free"}</p>
                        <p className="text-xs text-slate-400">{row.subscription_plan || "aucun plan profil"}</p>
                      </td>
                      <td className="p-3 align-top text-slate-700">
                        <p className="font-medium">{row.subscription?.status || "fallback gratuit"}</p>
                        <p className="text-xs text-slate-400">
                          {row.subscription?.billing_interval === "manual"
                            ? "forcé manuel"
                            : row.subscription?.stripe_subscription_id
                            ? "Stripe"
                            : "sans abonnement Stripe"}
                        </p>
                        {row.subscription?.updated_at ? <p className="text-xs text-slate-400">Maj {formatDate(row.subscription.updated_at)}</p> : null}
                      </td>
                      <td className="p-3 align-top text-slate-700">{formatDate(row.last_sign_in_at)}</td>
                      <td className="p-3 align-top">
                        <div className="flex items-center gap-2">
                          <select
                            value={row.effective_plan}
                            disabled={!token || saving}
                            onChange={(event) => updateAccountPlan(row, event.target.value as Plan)}
                            className="min-w-[190px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                            aria-label={`Changer les droits de ${row.email}`}
                          >
                            {EDITABLE_PLANS.map((plan) => (
                              <option key={plan} value={plan}>
                                {PLAN_LABELS[plan]}
                              </option>
                            ))}
                          </select>
                          {saving ? <span className="text-xs text-slate-500">Sauvegarde...</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!accountUsers.length ? (
                  <tr>
                    <td colSpan={7} className="p-5 text-center text-slate-500">
                      {token ? "Aucun compte trouvé." : "Renseigne le token admin pour charger les comptes."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {stats ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Leads totaux" value={formatNumber(stats.leads.total)} detail={`${formatNumber(stats.leads.windowTotal)} sur ${days} jours`} tone="cyan" />
              <StatCard label="Comptes créés" value={formatNumber(stats.users.total)} detail={`${formatNumber(stats.users.windowTotal)} nouveaux sur la période`} />
              <StatCard label="MRR estimé" value={formatEuro(stats.subscriptions.mrr)} detail={`${formatEuro(stats.subscriptions.arr)} ARR estimé`} tone="emerald" />
              <StatCard label="Abonnés payants" value={formatNumber(stats.subscriptions.activePaid)} detail={`${formatPct(stats.subscriptions.paidConversionRate)} des comptes`} tone="amber" />
              <StatCard label="Utilisateurs bailleur" value={formatNumber(stats.landlord.landlordUsers)} detail={`${formatPct(stats.conversion.accountToLandlordRate)} des comptes`} />
              <StatCard label="Biens actifs" value={formatNumber(stats.landlord.properties.active)} detail={`${formatNumber(stats.landlord.properties.total)} biens au total`} />
              <StatCard label="Baux actifs" value={formatNumber(stats.landlord.leases.active)} detail={`${formatNumber(stats.landlord.leases.total)} baux au total`} />
              <StatCard label="Quittances mois" value={formatNumber(stats.landlord.receipts.monthTotal)} detail={`${formatEuro(stats.landlord.receipts.monthAmount)} générés ce mois`} tone="emerald" />
            </section>

            <section className="overflow-hidden rounded-[2rem] border border-slate-900 bg-slate-950 p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-cyan-200">Entonnoir business</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Du lead au propriétaire payant.</h2>
                </div>
                <p className="max-w-md text-sm leading-6 text-slate-300">
                  Les taux servent à repérer où agir : qualité de lead, création de compte, adoption bailleur, puis passage au payant.
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <FunnelStep label="Emails lead" value={formatNumber(stats.leads.uniqueEmails)} rate="Base exploitable" />
                <FunnelStep label="Comptes" value={formatNumber(stats.users.total)} rate={`${formatPct(stats.conversion.leadEmailToAccountRate)} vs emails leads`} />
                <FunnelStep label="Bailleurs" value={formatNumber(stats.landlord.landlordUsers)} rate={`${formatPct(stats.conversion.accountToLandlordRate)} vs comptes`} />
                <FunnelStep label="Payants" value={formatNumber(stats.subscriptions.activePaid)} rate={`${formatPct(stats.conversion.landlordToPaidRate)} vs bailleurs`} />
                <FunnelStep label="ARPU" value={formatEuro(stats.subscriptions.arpu)} rate="Par abonné actif" />
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <BarList title="Leads par calculette" rows={stats.byTool} labelKey="tool" />
              <BarList title="Offres et abonnements" rows={stats.subscriptions.byPlan} labelKey="label" />
              <BarList title="Statuts quittances" rows={stats.landlord.receipts.byStatus} labelKey="status" />
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Qualité commerciale des leads</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Prioriser les projets avec vraie valeur business.</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Score basé sur les montants déclarés, l’apport, le prêt ou CRD, la rentabilité/cash-flow quand disponible, le téléphone
                    et le consentement contact.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900">
                  {formatNumber(stats.leadQuality.scored)} leads scorés
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard label="Leads chauds" value={formatNumber(stats.leadQuality.hot)} detail={`${formatNumber(stats.leadQuality.warm)} à travailler`} tone="emerald" />
                <StatCard label="Score moyen" value={`${formatNumber(stats.leadQuality.avgScore)}/100`} detail="sur les leads exploitables" tone="cyan" />
                <StatCard label="Budget moyen" value={formatEuro(stats.leadQuality.avgBudget)} detail={`Médiane ${formatEuro(stats.leadQuality.medianBudget)}`} />
                <StatCard label="Budget P90" value={formatEuro(stats.leadQuality.p90Budget)} detail="haut de panier projet" tone="amber" />
                <StatCard label="Apport moyen" value={formatEuro(stats.leadQuality.avgContribution)} detail={`Prêt moyen ${formatEuro(stats.leadQuality.avgLoan)}`} />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <BarList title="Répartition par niveau" rows={stats.leadQuality.byTier} labelKey="tier" />
                <BarList title="Tranches de budget" rows={stats.leadQuality.byBudgetRange} labelKey="range" />
                <BarList title="Qualité par calculette" rows={stats.leadQuality.byTool} labelKey="tool" />
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-950">Top leads qualitatifs</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white">
                      <tr className="text-left">
                        <th className="p-3 text-xs text-slate-600">Score</th>
                        <th className="p-3 text-xs text-slate-600">Calculette</th>
                        <th className="p-3 text-xs text-slate-600">Localité</th>
                        <th className="p-3 text-xs text-slate-600">Budget / valeur</th>
                        <th className="p-3 text-xs text-slate-600">Apport</th>
                        <th className="p-3 text-xs text-slate-600">Prêt / CRD</th>
                        <th className="p-3 text-xs text-slate-600">Indicateurs</th>
                        <th className="p-3 text-xs text-slate-600">Pourquoi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.leadQuality.top.map((lead) => (
                        <tr key={lead.id} className="border-t border-slate-100">
                          <td className="p-3">
                            <span className={cx("inline-flex rounded-full border px-2 py-1 text-xs font-semibold", qualityTone(lead.tier))}>
                              {lead.score}/100 · {lead.tier}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-900">{lead.tool}</td>
                          <td className="p-3 text-slate-700">{lead.city || "-"} {lead.postal_code ? `(${lead.postal_code})` : ""}</td>
                          <td className="p-3 text-slate-700">{formatEuro(lead.budget ?? lead.propertyValue)}</td>
                          <td className="p-3 text-slate-700">{lead.contribution != null ? formatEuro(lead.contribution) : "-"}</td>
                          <td className="p-3 text-slate-700">{lead.loan != null ? formatEuro(lead.loan) : "-"}</td>
                          <td className="p-3 text-slate-700">
                            {lead.cashflow != null ? `${formatEuro(lead.cashflow)}/mois` : ""}
                            {lead.cashflow != null && lead.netYield != null ? " · " : ""}
                            {lead.netYield != null ? `${formatNumber(lead.netYield)} % net` : ""}
                            {lead.cashflow == null && lead.netYield == null ? "-" : ""}
                          </td>
                          <td className="p-3 text-slate-700">{lead.reasons.length ? lead.reasons.join(", ") : "-"}</td>
                        </tr>
                      ))}
                      {!stats.leadQuality.top.length ? (
                        <tr>
                          <td colSpan={8} className="p-5 text-center text-slate-500">
                            Aucun lead n’a encore assez de données financières pour être scoré.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.35fr,0.65fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Volume leads quotidien</p>
                    <p className="text-xs text-slate-500">Sur la fenêtre sélectionnée.</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatNumber(stats.leads.avgPerDay)} / jour</p>
                </div>
                <div className="mt-5 flex h-56 items-end gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  {stats.byDay.map((row) => (
                    <div key={row.day} className="flex min-w-[18px] flex-1 flex-col items-center justify-end gap-2">
                      <div
                        title={`${row.day} : ${row.count}`}
                        className="w-full rounded-t-lg bg-gradient-to-t from-slate-900 to-cyan-500"
                        style={{ height: `${Math.max(row.count ? 8 : 2, (row.count / maxDaily) * 190)}px` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <StatCard label="Consentement contact" value={formatPct(stats.consents.consent_contact_rate)} detail={`${stats.consents.consent_contact_yes} leads contactables`} tone="emerald" />
                <StatCard label="Téléphone renseigné" value={formatPct(stats.leads.withPhoneRate)} detail={`${stats.leads.withPhone} leads avec numéro`} />
                <StatCard label="Comptes confirmés" value={formatPct(stats.users.confirmedRate)} detail={`${stats.users.confirmed} emails confirmés`} />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <BarList title="Statuts leads" rows={stats.byStatus} labelKey="status" />
              <BarList title="Statuts biens" rows={stats.landlord.properties.byStatus} labelKey="status" />
              <BarList title="Statuts baux" rows={stats.landlord.leases.byStatus} labelKey="status" />
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Renseigne ton token admin puis clique sur Rafraîchir pour charger le cockpit.
          </section>
        )}

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Exploration leads</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Liste filtrable</h2>
            </div>
            <button onClick={fetchList} disabled={!token || loadingList} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {loadingList ? "Chargement..." : "Rafraîchir"}
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-5">
            <input value={tool} onChange={(e) => setTool(e.target.value)} placeholder="Calculette" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Statut" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, ville, code postal" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm md:col-span-2" />
            <select value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value, 10))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>{n} lignes</option>
              ))}
            </select>
          </div>

          {listErr ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{listErr}</p> : null}

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="p-3 text-xs text-slate-600">Date</th>
                  <th className="p-3 text-xs text-slate-600">Calculette</th>
                  <th className="p-3 text-xs text-slate-600">Email</th>
                  <th className="p-3 text-xs text-slate-600">Ville</th>
                  <th className="p-3 text-xs text-slate-600">Téléphone</th>
                  <th className="p-3 text-xs text-slate-600">Consentements</th>
                  <th className="p-3 text-xs text-slate-600">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap p-3 text-slate-700">{formatDate(row.created_at)}</td>
                    <td className="p-3 font-semibold text-slate-900">{row.tool || "-"}</td>
                    <td className="p-3 text-slate-700">{row.email || "-"}</td>
                    <td className="p-3 text-slate-700">{row.city || "-"} {row.postal_code ? `(${row.postal_code})` : ""}</td>
                    <td className="p-3 text-slate-700">{row.phone || "-"}</td>
                    <td className="p-3 text-slate-700">Analyse {row.consent_analysis ? "oui" : "non"} · Contact {row.consent_contact ? "oui" : "non"}</td>
                    <td className="p-3 text-slate-700">{row.status || "-"}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={7} className="p-5 text-center text-slate-500">Aucun résultat.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600">{totalRows} leads · page {page} / {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Précédent</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Suivant</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
