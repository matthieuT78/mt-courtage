// pages/projets.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabaseClient";

import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
} from "chart.js";

ChartJS.register(
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement
);

const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), {
  ssr: false,
});
const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), {
  ssr: false,
});

function formatEuro(val: number) {
  if (val === null || val === undefined || Number.isNaN(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (val === null || val === undefined || Number.isNaN(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

type ProjectType = "capacite" | "investissement" | "parc" | string;

type ProjectRow = {
  id: string;
  type: ProjectType;
  title: string;
  data: any;
  created_at: string;
};

export default function ProjetsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        if (!supabase) {
          setErrorMsg(
            "Le service de sauvegarde n'est pas disponible (configuration Supabase manquante)."
          );
          setLoading(false);
          return;
        }

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const session = sessionData?.session;
        if (!session) {
          setErrorMsg(
            "Vous devez être connecté pour consulter vos projets sauvegardés."
          );
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setProjects((data || []) as ProjectRow[]);
      } catch (err: any) {
        setErrorMsg(
          "Erreur lors du chargement des projets : " +
            (err?.message || "erreur inconnue")
        );
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleDelete = async (project: ProjectRow) => {
    if (!supabase) {
      alert(
        "Le service de sauvegarde n'est pas disponible (configuration Supabase manquante)."
      );
      return;
    }

    const ok = window.confirm(
      `Voulez-vous vraiment supprimer le projet "${project.title}" ? Cette action est définitive.`
    );
    if (!ok) return;

    try {
      setDeletingId(project.id);
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (error) throw error;

      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch (err: any) {
      alert(
        "Erreur lors de la suppression du projet : " +
          (err?.message || "erreur inconnue")
      );
    } finally {
      setDeletingId(null);
    }
  };

  // --- RENDERS PAR TYPE ---

  const renderCapacite = (p: ProjectRow) => {
    const resume = p.data?.resume;
    const texte: string | undefined = p.data?.texte;

    if (!resume) {
      return <p className="text-sm text-slate-500">Données incomplètes.</p>;
    }

    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Revenus pris en compte
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.revenusPrisEnCompte)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Mensualité max disponible
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.mensualiteMax)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Capital empruntable
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.montantMax)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Prix de bien estimé
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.prixBienMax)}
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em] mb-1">
            Taux d&apos;endettement
          </p>
          <p className="text-xs text-slate-600">
            Actuel :{" "}
            <span className="font-semibold">
              {formatPct(resume.tauxEndettementActuel)}
            </span>{" "}
            – Après projet :{" "}
            <span className="font-semibold">
              {formatPct(resume.tauxEndettementAvecProjet)}
            </span>
          </p>
        </div>

        {texte && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
              Analyse détaillée
            </p>
            {texte.split("\n").map((line, i) => (
              <p key={i} className="text-xs text-slate-800 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderInvestissement = (p: ProjectRow) => {
    const resume = p.data?.resume;
    const texte: string | undefined = p.data?.texte;
    const g = p.data?.graphData;

    if (!resume || !g) {
      return <p className="text-sm text-slate-500">Données incomplètes.</p>;
    }

    const barData = {
      labels: ["Loyers bruts", "Charges", "Crédit + assurance", "Résultat net"],
      datasets: [
        {
          label: "Flux annuels (€)",
          data: [
            g.loyersAnnuels,
            g.chargesTotales,
            g.annuiteCredit,
            g.resultatNetAnnuel,
          ],
          backgroundColor: ["#22c55e", "#fb923c", "#38bdf8", "#0f172a"],
        },
      ],
    };

    const horizon = Math.min(Math.max(g.dureeCredLoc || 10, 5), 30);
    const labels: string[] = [];
    const dataVals: number[] = [];
    let cumul = 0;
    for (let year = 1; year <= horizon; year++) {
      cumul += g.resultatNetAnnuel || 0;
      labels.push(`Année ${year}`);
      dataVals.push(cumul);
    }

    const lineData = {
      labels,
      datasets: [
        {
          label: "Cash-flow cumulé (€)",
          data: dataVals,
          borderColor: "#0f172a",
          backgroundColor: "rgba(15,23,42,0.08)",
          tension: 0.25,
        },
      ],
    };

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Coût total projet
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(g.coutTotal)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Rendement brut
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatPct(g.rendementBrut)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Rendement net avant crédit
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatPct(g.rendementNetAvantCredit)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Cash-flow mensuel
            </p>
            <p
              className={
                "mt-1 text-sm font-semibold " +
                (resume.cashflowMensuel >= 0
                  ? "text-emerald-700"
                  : "text-red-600")
              }
            >
              {formatEuro(resume.cashflowMensuel)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-600 mb-2">
              Flux annuels : loyers, charges, crédit + assurance, résultat net.
            </p>
            <Bar
              data={barData}
              options={{
                plugins: {
                  legend: {
                    labels: { color: "#0f172a", font: { size: 11 } },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: "#0f172a", font: { size: 10 } },
                    grid: { color: "#e5e7eb" },
                  },
                  y: {
                    ticks: { color: "#0f172a", font: { size: 10 } },
                    grid: { color: "#e5e7eb" },
                  },
                },
              }}
            />
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-600 mb-2">
              Cash-flow cumulé année par année.
            </p>
            <Line
              data={lineData}
              options={{
                plugins: {
                  legend: {
                    labels: { color: "#0f172a", font: { size: 11 } },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: "#0f172a", font: { size: 9 } },
                    grid: { color: "#e5e7eb" },
                  },
                  y: {
                    ticks: { color: "#0f172a", font: { size: 10 } },
                    grid: { color: "#e5e7eb" },
                  },
                },
              }}
            />
          </div>
        </div>

        {texte && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
              Analyse détaillée
            </p>
            {texte.split("\n").map((line, i) => (
              <p key={i} className="text-xs text-slate-800 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderParc = (p: ProjectRow) => {
    const biens = p.data?.biens || [];
    const resumeGlobal = p.data?.resumeGlobal;
    const texte: string | undefined = p.data?.texte;

    if (!resumeGlobal || !Array.isArray(biens) || biens.length === 0) {
      return <p className="text-sm text-slate-500">Données incomplètes.</p>;
    }

    const labels = biens.map(
      (b: any, idx: number) => b.nom || `Bien #${idx + 1}`
    );
    const cashFlows = biens.map((b: any) => b.resultatNetAnnuel || 0);
    const rendements = biens.map((b: any) => b.rendementNet || 0);

    const barData = {
      labels,
      datasets: [
        {
          label: "Cash-flow annuel (€)",
          data: cashFlows,
          backgroundColor: cashFlows.map((v: number) =>
            v >= 0 ? "#22c55e" : "#ef4444"
          ),
        },
      ],
    };

    const lineData = {
      labels,
      datasets: [
        {
          label: "Rendement net (%)",
          data: rendements,
          borderColor: "#0f172a",
          backgroundColor: "rgba(15,23,42,0.08)",
          tension: 0.25,
        },
      ],
    };

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Valeur du parc
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resumeGlobal.valeurParc)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Encours de crédit
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resumeGlobal.encoursCredit)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Cash-flow mensuel global
            </p>
            <p
              className={
                "mt-1 text-sm font-semibold " +
                (resumeGlobal.cashflowMensuelGlobal >= 0
                  ? "text-emerald-700"
                  : "text-red-600")
              }
            >
              {formatEuro(resumeGlobal.cashflowMensuelGlobal)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Rendement net moyen
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatPct(resumeGlobal.rendementNetMoyen)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-600 mb-2">
              Cash-flow annuel par bien.
            </p>
            <Bar
              data={barData}
              options={{
                plugins: { legend: { display: false } },
                scales: {
                  x: {
                    ticks: { color: "#0f172a", font: { size: 9 } },
                    grid: { color: "#e5e7eb" },
                  },
                  y: {
                    ticks: { color: "#0f172a", font: { size: 10 } },
                    grid: { color: "#e5e7eb" },
                  },
                },
              }}
            />
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-600 mb-2">
              Rendement net par bien.
            </p>
            <Line
              data={lineData}
              options={{
                plugins: {
                  legend: { labels: { color: "#0f172a", font: { size: 11 } } },
                },
                scales: {
                  x: {
                    ticks: { color: "#0f172a", font: { size: 9 } },
                    grid: { color: "#e5e7eb" },
                  },
                  y: {
                    ticks: { color: "#0f172a", font: { size: 10 } },
                    grid: { color: "#e5e7eb" },
                  },
                },
              }}
            />
          </div>
        </div>

        {texte && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
              Analyse globale
            </p>
            {texte.split("\n").map((line, i) => (
              <p key={i} className="text-xs text-slate-800 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderProjectDetails = (p: ProjectRow) => {
    if (p.type === "capacite") return renderCapacite(p);
    if (p.type === "investissement") return renderInvestissement(p);
    if (p.type === "parc") return renderParc(p);
    return (
      <p className="text-sm text-slate-500">
        Type de projet non reconnu ou non encore géré dans l&apos;interface.
      </p>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Vos projets sauvegardés (capacité, investissements, parc).
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
        {loading && (
          <p className="text-sm text-slate-500">
            Chargement de vos projets sauvegardés…
          </p>
        )}

        {!loading && errorMsg && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}

        {!loading && !errorMsg && projects.length === 0 && (
          <p className="text-sm text-slate-500">
            Aucun projet sauvegardé pour le moment. Lancez une simulation puis
            utilisez le bouton “Sauvegarder ce projet”.
          </p>
        )}

        <div className="space-y-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-0.5">
                    {p.type === "capacite"
                      ? "CALCULETTE CAPACITÉ"
                      : p.type === "investissement"
                      ? "INVESTISSEMENT LOCATIF"
                      : p.type === "parc"
                      ? "PARC IMMOBILIER"
                      : "PROJET"}
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {p.title}
                  </h2>
                  <p className="text-[0.7rem] text-slate-500 mt-0.5">
                    Créé le{" "}
                    {new Date(p.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={deletingId === p.id}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[0.7rem] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    {deletingId === p.id ? "Suppression..." : "Supprimer le projet"}
                  </button>
                  <button
                    onClick={() => toggleExpand(p.id)}
                    className="rounded-full border border-slate-300 bg-slate-900 px-3 py-1.5 text-[0.7rem] font-semibold text-white hover:bg-slate-800"
                  >
                    {expandedId === p.id ? "Masquer le détail" : "Voir le détail"}
                  </button>
                </div>
              </div>

              {expandedId === p.id && (
                <div className="mt-4 border-t border-slate-200 pt-4 space-y-3">
                  {renderProjectDetails(p)}
                </div>
              )}
            </div>
          ))}
        </div>
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
