// pages/projets.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import Link from "next/link";

type Project = {
  id: string;
  type: string;
  title: string;
  data: any;
  created_at: string;
};

export default function ProjetsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        router.push("/mon-compte?redirect=/projets");
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProjects(data as Project[]);
      }
      setLoading(false);
    };

    load();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">
            Mes projets sauvegardés
          </h1>
          <Link href="/" className="text-xs text-slate-500 underline">
            &larr; Accueil
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun projet sauvegardé pour le moment. Lancez une simulation puis
            utilisez le bouton &quot;Sauvegarder ce projet&quot;.
          </p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="rounded-xl bg-white border border-slate-200 shadow-sm p-4"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {p.type.toUpperCase()}
                </p>
                <h2 className="text-sm font-semibold text-slate-900 mt-1">
                  {p.title}
                </h2>
                <p className="text-[0.7rem] text-slate-500 mt-1">
                  Créé le {new Date(p.created_at).toLocaleString("fr-FR")}
                </p>
                <pre className="mt-2 text-[0.7rem] bg-slate-50 border border-slate-100 rounded-lg p-2 text-slate-700 overflow-x-auto">
                  {JSON.stringify(p.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
