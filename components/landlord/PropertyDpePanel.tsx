import { useCallback, useEffect, useState } from "react";
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../lib/supabaseClient";

type DpeDocument = {
  id: string;
  property_id: string;
  file_name: string;
  size_bytes: number;
};

async function authHeaders(json = false) {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée.");
  return { Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: await authHeaders(true), body: JSON.stringify(body) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error || "Erreur serveur.");
  return json;
}

const fmt = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;

export function PropertyDpePanel({ propertyId, propertyLabel }: { propertyId: string; propertyLabel: string }) {
  const [dpes, setDpes] = useState<DpeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/account/storage", { headers: await authHeaders() });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Chargement impossible.");
      setDpes((json.dpes || []).filter((dpe: DpeDocument) => dpe.property_id === propertyId));
    } catch (error: any) {
      setErr(error?.message || "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") return setErr("Sélectionne un DPE au format PDF.");
    try {
      setLoading(true); setErr(null); setOk(null);
      const signed = await post("/api/account/dpe-upload-url", { propertyId, fileName: file.name, sizeBytes: file.size });
      const { error } = await supabase!.storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, file, { contentType: "application/pdf" });
      if (error) throw error;
      await post("/api/account/dpe-confirm", { propertyId, bucket: signed.bucket, path: signed.path, fileName: file.name, sizeBytes: file.size });
      setOk("DPE archivé avec succès.");
      await load();
    } catch (error: any) {
      setErr(error?.message || "Import impossible.");
    } finally {
      setLoading(false);
    }
  };

  const open = async (id: string) => {
    try {
      const response = await fetch(`/api/account/dpe-url?id=${encodeURIComponent(id)}`, { headers: await authHeaders() });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Ouverture impossible.");
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setErr(error?.message || "Ouverture impossible.");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Diagnostic de performance énergétique</p>
          <p className="mt-1 text-xs text-slate-500">DPE lié à {propertyLabel || "ce logement"} · PDF de 10 Mo maximum.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
          <ArrowUpTrayIcon className="h-4 w-4" />{loading ? "Chargement..." : "Importer un DPE"}
          <input type="file" accept="application/pdf" className="hidden" disabled={loading} onChange={(event) => upload(event.target.files?.[0])} />
        </label>
      </div>
      {err ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{err}</p> : null}
      {ok ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{ok}</p> : null}
      <div className="mt-3 space-y-2">
        {dpes.map((dpe) => (
          <div key={dpe.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold text-slate-900">DPE</p><p className="text-xs text-slate-500">{dpe.file_name} · {fmt(dpe.size_bytes)}</p></div>
            <button type="button" onClick={() => open(dpe.id)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"><ArrowDownTrayIcon className="h-4 w-4" />Ouvrir</button>
          </div>
        ))}
        {!loading && !dpes.length ? <p className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500">Aucun DPE archivé pour ce logement.</p> : null}
      </div>
    </div>
  );
}
