// pages/mon-compte/projets.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AccountLayout from "../../components/account/AccountLayout";
import { supabase } from "../../lib/supabaseClient";

type ProjectRow = {
  id: string;
  user_id: string;
  type: string;
  title: string | null;
  data: any;
  created_at: string;
};

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MonCompteProjetsPage() {
  const router = useRouter();

  const [checkingUser, setCheckingUser] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const isLoggedIn = !!user?.email;

  useEffect(() => {
    const run = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        setUser(data.user ?? null);
      } catch {
        setUser(null);
      } finally {
        setCheckingUser(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!supabase || !isLoggedIn) return;
      try {
        setLoading(true);
        setError(null);
        const { data: sessionData, error: sErr } = await supabase.auth.getSession();
        if (sErr || !sessionData.session) throw new Error("Session invalide, reconnectez-vous.");

        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", sessionData.session.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProjects((data || []) as ProjectRow[]);
      } catch (err: any) {
        setError(err?.message || "Impossible de charger vos projets.");
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [isLoggedIn]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  const goLogin = () => router.push("/mon-compte?mode=login&redirect=/mon-compte/projets");

  const handleDelete = async (p: ProjectRow) => {
    const ok = window.confirm("Supprimer définitivement ce projet ?");
    if (!ok) return;

    try {
      setDeleteLoadingId(p.id);
      const { error } = await supabase.from("projects").delete().eq("id", p.id);
      if (error) throw error;
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      if (expandedId === p.id) setExpandedId(null);
    } catch (err: any) {
      alert("Erreur suppression : " + (err?.message || "inconnue"));
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <AccountLayout userEmail={user?.email ?? null} active="projets" onLogout={handleLogout}>
      {checkingUser ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : !isLoggedIn ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Connectez-vous pour voir vos projets.</p>
          <button
            type="button"
            onClick={goLogin}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Me connecter
          </button>
        </div>
      ) : (
        <>
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-900 mb-1">Projets</p>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Mes projets sauvegardés</h1>

          {loading && <p className="text-sm text-slate-500">Chargement…</p>}
          {!loading && error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">
              {error}
            </div>
          )}

          {!loading && !error && projects.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700 font-medium mb-1">Aucun projet.</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Link
                  href="/capacite"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Calculette capacité
                </Link>
                <Link
                  href="/investissement"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Investissement locatif
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && projects.length > 0 && (
            <section className="space-y-3">
              {projects.map((p) => {
                const isExpanded = expandedId === p.id;
                return (
                  <article key={p.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[0.7rem] text-slate-500">{formatDateTime(p.created_at)}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{p.title || p.type}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          {isExpanded ? "Masquer" : "Détails"}
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={deleteLoadingId === p.id}
                          className="inline-flex items-center justify-center rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-[0.7rem] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          {deleteLoadingId === p.id ? "Supp…" : "Supprimer"}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
                        <pre className="text-[0.7rem] sm:text-xs text-slate-800 overflow-auto">
                          {JSON.stringify(p.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </AccountLayout>
  );
}
