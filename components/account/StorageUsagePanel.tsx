import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type StorageData = {
  usedBytes: number;
  quotaBytes: number;
  availableBytes: number;
};

const fmt = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} Mo`;
};
async function authHeaders(json = false) {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée.");
  return { Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}
export function StorageUsagePanel() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const percent = data?.quotaBytes ? Math.min(100, Math.round((data.usedBytes / data.quotaBytes) * 100)) : 0;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/account/storage", { headers: await authHeaders() });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Chargement impossible.");
      setData(json);
    } catch (error: any) {
      setErr(error?.message || "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Stockage documentaire</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Quittances, états des lieux, photos, contrats et DPE archivés dans lokt.</p>
        </div>
        <p className="text-sm font-semibold text-slate-900">{loading && !data ? "…" : `${fmt(data?.usedBytes || 0)} / ${fmt(data?.quotaBytes || 0)}`}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${percent}%` }} /></div>
      <p className="mt-2 text-xs text-slate-500">{percent}% utilisé · {fmt(data?.availableBytes || 0)} disponibles</p>
      {err ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{err}</p> : null}
      <Link href="/espace-bailleur?tab=documents" className="mt-4 inline-flex text-xs font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">
        Ouvrir le coffre documentaire
      </Link>
    </section>
  );
}
