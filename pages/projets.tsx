// pages/projets.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

type ProjectType =
  | "capacite"
  | "investissement"
  | "parc"
  | "pret-relais"
  | "pret_relais"
  | string;

type ProjectRow = {
  id: string;
  user_id: string;
  type: ProjectType;
  title: string | null;
  data: any;
  created_at: string;
};

function formatEuro(val: number | undefined | null) {
  if (val === undefined || val === null || Number.isNaN(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number | undefined | null) {
  if (val === undefined || val === null || Number.isNaN(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// Normalisation pour gérer l'ancien type "pret_relais"
function normalizeType(type: ProjectType): ProjectType {
  if (type === "pret_relais") return "pret-relais";
  return type;
}

function typeLabel(type: ProjectType): string {
  const t = normalizeType(type);
  switch (t) {
    case "capacite":
      return "Capacité d'emprunt";
    case "investissement":
      return "Investissement locatif";
    case "parc":
      return "Parc immobilier existant";
    case "pret-relais":
      return "Prêt relais";
    default:
      return "Simulation";
  }
}

function typeBadgeColor(type: ProjectType): string {
  const t = normalizeType(type);
  switch (t) {
    case "capacite":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "investissement":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "parc":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "pret-relais":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export default function ProjetsPage() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingSession(true);
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const session = sessionData?.session;
        if (!session) {
          setLoadingSession(false);
          return;
        }

        setLoadingSession(false);
        setLoadingProjects(true);
        const { data, error: projError } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (projError) throw projError;
        setProjects((data || []) as ProjectRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            "Impossible de récupérer vos projets enregistrés pour le moment."
        );
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, []);

  const handleDelete = async (project: ProjectRow) => {
    const ok = window.confirm(
      "Êtes-vous sûr de vouloir supprimer définitivement ce projet ?"
    );
    if (!ok) return;

    try {
      setDeleteLoadingId(project.id);
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);
      if (error) throw error;

      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      if (expandedId === project.id) {
        setExpandedId(null);
      }
    } catch (err: any) {
      alert(
        "Erreur lors de la suppression du projet : " +
          (err?.message || "erreur inconnue")
      );
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleShare = (project: ProjectRow) => {
    const baseUrl =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = baseUrl ? `${baseUrl}/projets?id=${project.id}` : "";

    const label = typeLabel(project.type);
    const titre = project.title || label;
    const texte =
      project.data?.texte ||
      project.data?.analyse ||
      "Simulation enregistrée sur MT Courtage & Investissement.";

    const subject = `Simulation ${label} – ${titre}`;
    const body = [
      `Bonjour,`,
      "",
      `Je partage avec vous une simulation réalisée sur MT Courtage & Investissement :`,
      `Type de projet : ${label}`,
      `Titre : ${titre}`,
      "",
      "Résumé :",
      texte,
      url ? "" : "",
      url ? `Lien de consultation : ${url}` : "",
      "",
      "— Envoyé depuis MT Courtage & Investissement",
    ]
      .filter(Boolean)
      .join("\n");

    if (typeof navigator !== "undefined" && (navigator as any).share) {
      (navigator as any)
        .share({
          title: subject,
          text: body,
          url,
        })
        .catch(() => {
          // utilisateur qui annule → on ignore
        });
    } else {
      // fallback email
      window.location.href = `mailto:?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;
    }
  };

  const renderDetail = (project: ProjectRow) => {
    const d = project.data || {};
    const type = normalizeType(project.type);

    // CAPACITÉ D'EMPRUNT
    if (type === "capacite") {
      const r = d.resume || {};
      return (
        <div className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Revenus pris en compte
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.revenusPrisEnCompte)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Mensualité max
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.mensualiteMax)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Capital max
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.montantMax)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Prix bien estimé
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.prixBienMax)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Taux d'endettement actuel
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPct(r.tauxEndettementActuel)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Taux avec projet
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPct(r.tauxEndettementAvecProjet)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Budget global financé
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.coutTotalProjetMax)}
              </p>
            </div>
          </div>

          {d.texte && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                Analyse détaillée
              </p>
              {d.texte.split("\n").map((line: string, idx: number) => (
                <p
                  key={idx}
                  className="text-xs sm:text-sm text-slate-800 leading-relaxed"
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    }

    // INVESTISSEMENT LOCATIF
    if (type === "investissement") {
      const r = d.resume || d.resumeRendement || {};
      const g = d.graphData || {};

      return (
        <div className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Coût total projet
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(g.coutTotal)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Rendement brut
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPct(g.rendementBrut)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Rendement net
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPct(g.rendementNetAvantCredit)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Cash-flow mensuel
              </p>
              <p
                className={
                  "mt-1 text-sm font-semibold " +
                  (r.cashflowMensuel >= 0
                    ? "text-emerald-700"
                    : "text-red-600")
                }
              >
                {formatEuro(r.cashflowMensuel)}
              </p>
            </div>
          </div>

          {d.texte && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                Analyse détaillée
              </p>
              {d.texte.split("\n").map((line: string, idx: number) => (
                <p
                  key={idx}
                  className="text-xs sm:text-sm text-slate-800 leading-relaxed"
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    }

    // PARC IMMOBILIER
    if (type === "parc") {
      const r = d.resumeGlobal || {};
      return (
        <div className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Valeur estimée totale
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.valeurTotale)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Loyers annuels
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.loyersAnnuelsTotaux)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Cash-flow global
              </p>
              <p
                className={
                  "mt-1 text-sm font-semibold " +
                  (r.cashflowAnnuelGlobal >= 0
                    ? "text-emerald-700"
                    : "text-red-600")
                }
              >
                {formatEuro(r.cashflowAnnuelGlobal)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Rendement net global
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPct(r.rendementNetGlobal)}
              </p>
            </div>
          </div>

          {d.texte && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                Analyse détaillée
              </p>
              {d.texte.split("\n").map((line: string, idx: number) => (
                <p
                  key={idx}
                  className="text-xs sm:text-sm text-slate-800 leading-relaxed"
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    }

    // PRÊT RELAIS
    if (type === "pret-relais") {
      const r = d.resume || {};
      const analyse: string | undefined = d.analyse || d.texte;

      return (
        <div className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
              <p className="text-[0.7rem] text-amber-700 uppercase tracking-[0.14em]">
                Montant du prêt relais
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.montantRelais)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Mensualité max nouveau prêt
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.mensualiteNouveauMax)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Capital nouveau prêt
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.capitalNouveau)}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              <p className="text-[0.7rem] text-emerald-700 uppercase tracking-[0.14em]">
                Budget d'achat max
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                {formatEuro(r.budgetMax)}
              </p>
            </div>
          </div>

          {analyse && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                Analyse détaillée prêt relais
              </p>
              {analyse.split("\n").map((line: string, idx: number) => (
                <p
                  key={idx}
                  className="text-xs sm:text-sm text-slate-800 leading-relaxed"
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    }

    // PAR DÉFAUT
    return (
      <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
          Détails du projet
        </p>
        <pre className="text-[0.7rem] sm:text-xs text-slate-800 overflow-auto">
          {JSON.stringify(project.data, null, 2)}
        </pre>
      </div>
    );
  };

  const isLoading = loadingSession || loadingProjects;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Vos projets sauvegardés : simulations à présenter à votre banque
              ou à votre conseiller.
            </p>
          </div>
          <div className="text-xs text-slate-500 sm:text-right">
            <Link href="/" className="underline">
              &larr; Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 space-y-4">
        {isLoading && (
          <p className="text-sm text-slate-500">Chargement des projets…</p>
        )}

        {!isLoading && error && (
          <section className="rounded-2xl border border-red-100 bg-red-50 shadow-sm p-5">
            <p className="text-sm text-red-700 font-medium mb-1">
              Erreur de chargement
            </p>
            <p className="text-xs text-red-600">{error}</p>
          </section>
        )}

        {!isLoading && !error && projects.length === 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <p className="text-sm text-slate-700 font-medium mb-1">
              Aucun projet sauvegardé pour le moment.
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Lancez une simulation de capacité d&apos;emprunt, d&apos;investissement
              ou de parc immobilier, puis utilisez le bouton “Sauvegarder”
              pour la retrouver ici.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/capacite"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Calculette capacité d&apos;emprunt
              </Link>
              <Link
                href="/investissement"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Calculette investissement locatif
              </Link>
            </div>
          </section>
        )}

        {!isLoading && !error && projects.length > 0 && (
          <section className="space-y-3">
            {projects.map((project) => {
              const isExpanded = expandedId === project.id;
              const badgeClass = typeBadgeColor(project.type);
              const label = typeLabel(project.type);

              return (
                <article
                  key={project.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold " +
                            badgeClass
                          }
                        >
                          {label}
                        </span>
                        <span className="text-[0.7rem] text-slate-400">
                          {formatDate(project.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {project.title || label}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : project.id)
                        }
                        className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        {isExpanded ? "Masquer les détails" : "Voir les détails"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                      {renderDetail(project)}

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleShare(project)}
                            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg hover:brightness-105 transition"
                          >
                            Partager le projet
                          </button>

                          <button
                            onClick={() => handleDelete(project)}
                            disabled={deleteLoadingId === project.id}
                            className="inline-flex items-center justify-center rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                          >
                            {deleteLoadingId === project.id
                              ? "Suppression…"
                              : "Supprimer le projet"}
                          </button>
                        </div>
                        <p className="text-[0.7rem] text-slate-400">
                          Ces simulations sont indicatives et peuvent être
                          recalculées à tout moment avec vos paramètres
                          actualisés.
                        </p>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Espace
          projets.
        </p>
      </footer>
    </div>
  );
}
