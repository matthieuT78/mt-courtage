// pages/projets.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type ProjectRow = {
  id: string;
  type: string;
  title: string;
  created_at: string;
  data: any;
};

export default function ProjetsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!supabase) {
        setError(
          "Le service de sauvegarde n'est pas disponible (configuration Supabase manquante)."
        );
        setLoadingUser(false);
        setLoadingProjects(false);
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setUser(null);
        setLoadingUser(false);
        if (typeof window !== "undefined") {
          window.location.href = "/auth";
        }
        return;
      }

      setUser(data.user);
      setLoadingUser(false);

      const { data: rows, error: projError } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false });

      if (projError) {
        setError(projError.message);
      } else {
        setProjects((rows || []) as ProjectRow[]);
      }
      setLoadingProjects(false);
    };

    init();
  }, []);

  if (loadingUser || loadingProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">
          Chargement de vos projets sauvegardés...
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const labelType = (type: string) => {
    switch (type) {
      case "capacite":
        return "Capacité d'emprunt";
      case "investissement":
        return "Investissement locatif";
      case "pret-relais":
        return "Prêt relais";
      case "parc":
        return "Parc immobilier";
      default:
        return type;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              Mes projets sauvegardés
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Retrouvez ici les simulations enregistrées depuis les différents outils.
            </p>
          </div>
          <Link href="/" className="text-xs text-slate-500 underline">
            &larr; Accueil
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {projects.length === 0 ? (
          <p className="text-sm text-slate-500">
            Vous n&apos;avez pas encore de projet sauvegardé. Lancez une simulation dans
            la capacité d&apos;emprunt, l&apos;investissement locatif ou le prêt relais,
            puis utilisez le bouton &quot;Sauvegarder dans mon espace&quot;.
          </p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {labelType(p.type)}
                    </p>
                    <h2 className="text-sm font-semibold text-slate-900">
                      {p.title || "Simulation sans titre"}
                    </h2>
                  </div>
                  <p className="text-[0.7rem] text-slate-500">
                    {formatDate(p.created_at)}
                  </p>
                </div>
                {p.data?.resume && (
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">Résumé rapide : </span>
                    {/* On affiche 1–2 infos simples si disponibles */}
                    {p.type === "capacite" && p.data.resume.montantMax && (
                      <>
                        capital finançable ≈{" "}
                        <span className="font-mono">
                          {Number(p.data.resume.montantMax).toLocaleString("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </>
                    )}
                    {p.type === "investissement" && p.data.resume.rendementNetAvantCredit && (
                      <>
                        rendement net avant crédit ≈{" "}
                        <span className="font-mono">
                          {Number(
                            p.data.resume.rendementNetAvantCredit
                          ).toLocaleString("fr-FR", {
                            maximumFractionDigits: 2,
                          })}
                          %
                        </span>
                      </>
                    )}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Espace client.
        </p>
      </footer>
    </div>
  );
}
