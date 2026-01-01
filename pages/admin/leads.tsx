import { useEffect, useMemo, useState } from "react";

type StatsPayload = {
  ok: boolean;
  total: number;
  byTool: { tool: string; count: number }[];
  byStatus: { status: string; count: number }[];
  consents: {
    consent_analysis_yes: number;
    consent_contact_yes: number;
    consent_analysis_rate: number;
    consent_contact_rate: number;
  };
  byDay: { day: string; count: number }[];
  window_days: number;
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

function formatPct(x: number) {
  return (x * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
}

export default function AdminLeadsPage() {
  // Token admin (stocké localement pour toi)
  const [token, setToken] = useState<string>("");
  const [tokenSaved, setTokenSaved] = useState<boolean>(false);

  useEffect(() => {
    const t = window.localStorage.getItem("ADMIN_TOKEN") || "";
    setToken(t);
    setTokenSaved(!!t);
  }, []);

  const saveToken = () => {
    window.localStorage.setItem("ADMIN_TOKEN", token);
    setTokenSaved(true);
  };

  // Stats
  const [days, setDays] = useState<number>(30);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [statsErr, setStatsErr] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Liste
  const [tool, setTool] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [rows, setRows] = useState<LeadRow[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [listErr, setListErr] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalRows / pageSize));
  }, [totalRows, pageSize]);

  async function fetchStats() {
    setLoadingStats(true);
    setStatsErr(null);
    try {
      const r = await fetch(`/api/admin/leads/stats?days=${days}`, {
        headers: { "x-admin-token": token },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Erreur stats");
      setStats(j);
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
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (tool) params.set("tool", tool);
      if (status) params.set("status", status);
      if (q) params.set("q", q);

      const r = await fetch(`/api/admin/leads/list?${params.toString()}`, {
        headers: { "x-admin-token": token },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Erreur liste");

      setRows(j.items || []);
      setTotalRows(j.total || 0);
    } catch (e: any) {
      setListErr(e?.message || "Erreur inconnue");
      setRows([]);
      setTotalRows(0);
    } finally {
      setLoadingList(false);
    }
  }

  // Auto refresh quand token dispo
  useEffect(() => {
    if (!token) return;
    fetchStats();
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Refresh liste quand filtres changent
  useEffect(() => {
    if (!token) return;
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, status, q, pageSize]);

  useEffect(() => {
    if (!token) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tool, status, q, pageSize, token]);

  return (
    <div className="min-h-screen bg-slate-100">
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-500 mb-1">
            Admin — Leads
          </p>
          <h1 className="text-xl font-semibold text-slate-900">Tableau de bord</h1>
          <p className="text-sm text-slate-600 mt-1">
            Page isolée. Accès via token admin (stocké en local).
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3 items-end">
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-700">ADMIN_TOKEN</label>
              <input
                type="password"
                value={token}
                onChange={(e) => {
                  setTokenSaved(false);
                  setToken(e.target.value);
                }}
                placeholder="Colle ton token ici"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
              <p className="mt-1 text-[0.7rem] text-slate-500">
                (Tu le définis dans les env du projet : <code>ADMIN_TOKEN</code>)
              </p>
            </div>
            <button
              onClick={saveToken}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {tokenSaved ? "Token enregistré" : "Enregistrer"}
            </button>
          </div>
        </div>

        {/* STATS */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Stats globales</h2>
              <p className="text-[0.75rem] text-slate-600">Synthèse et tendances.</p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="text-[0.7rem] text-slate-600">Fenêtre (jours)</label>
                <input
                  type="number"
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value || "30", 10))}
                  className="mt-1 w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={fetchStats}
                disabled={!token || loadingStats}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {loadingStats ? "Chargement..." : "Rafraîchir"}
              </button>
            </div>
          </div>

          {statsErr ? (
            <p className="text-sm text-red-600">❌ {statsErr}</p>
          ) : !stats ? (
            <p className="text-sm text-slate-500">Renseigne le token puis rafraîchis.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Total leads</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.total}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Consent analyse</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatPct(stats.consents.consent_analysis_rate)}
                  </p>
                  <p className="text-[0.7rem] text-slate-500">
                    {stats.consents.consent_analysis_yes} / {stats.total}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Consent contact</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatPct(stats.consents.consent_contact_rate)}
                  </p>
                  <p className="text-[0.7rem] text-slate-500">
                    {stats.consents.consent_contact_yes} / {stats.total}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Fenêtre</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{stats.window_days} jours</p>
                  <p className="text-[0.7rem] text-slate-500">Série “leads / jour”.</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-900 mb-2">Leads par outil</p>
                  <div className="space-y-2">
                    {stats.byTool.map((r) => (
                      <div key={r.tool} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{r.tool}</span>
                        <span className="font-semibold text-slate-900">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-900 mb-2">Répartition des statuts</p>
                  <div className="space-y-2">
                    {stats.byStatus.map((r) => (
                      <div key={r.status} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{r.status}</span>
                        <span className="font-semibold text-slate-900">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-900 mb-2">Leads par jour (sur la fenêtre)</p>
                <div className="grid gap-2 sm:grid-cols-6">
                  {stats.byDay.slice(-36).map((d) => (
                    <div key={d.day} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                      <p className="text-[0.65rem] text-slate-500">{d.day}</p>
                      <p className="text-sm font-semibold text-slate-900">{d.count}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[0.7rem] text-slate-500">
                  (Affichage compact. Si tu veux un graphe, je te le fais.)
                </p>
              </div>
            </>
          )}
        </section>

        {/* LISTE */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Leads (liste)</h2>
              <p className="text-[0.75rem] text-slate-600">Filtrage + pagination.</p>
            </div>
            <button
              onClick={fetchList}
              disabled={!token || loadingList}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loadingList ? "Chargement..." : "Rafraîchir"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="text-[0.7rem] text-slate-600">Tool</label>
              <input
                value={tool}
                onChange={(e) => setTool(e.target.value)}
                placeholder="ex: capacite / pret-relais"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[0.7rem] text-slate-600">Status</label>
              <input
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="ex: new"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[0.7rem] text-slate-600">Recherche</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="email, ville, code postal…"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-[0.7rem] text-slate-600">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {listErr ? <p className="text-sm text-red-600">❌ {listErr}</p> : null}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="p-3 text-xs text-slate-600">Date</th>
                  <th className="p-3 text-xs text-slate-600">Tool</th>
                  <th className="p-3 text-xs text-slate-600">Email</th>
                  <th className="p-3 text-xs text-slate-600">Ville / CP</th>
                  <th className="p-3 text-xs text-slate-600">Téléphone</th>
                  <th className="p-3 text-xs text-slate-600">Consent</th>
                  <th className="p-3 text-xs text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200">
                    <td className="p-3 text-slate-700">
                      {new Date(r.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-3 text-slate-700">{r.tool}</td>
                    <td className="p-3 text-slate-700">{r.email || "-"}</td>
                    <td className="p-3 text-slate-700">
                      {(r.city || "-") + " / " + (r.postal_code || "-")}
                    </td>
                    <td className="p-3 text-slate-700">{r.phone || "-"}</td>
                    <td className="p-3 text-slate-700">
                      A:{r.consent_analysis ? "✅" : "—"} C:{r.consent_contact ? "✅" : "—"}
                    </td>
                    <td className="p-3 text-slate-700">{r.status || "-"}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="p-3 text-slate-500">
                      Aucun résultat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[0.75rem] text-slate-600">
              {totalRows} leads — page {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                ←
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                →
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
