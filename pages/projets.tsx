// pages/projets.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
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

const Bar = dynamic(
  () => import("react-chartjs-2").then((m) => m.Bar),
  { ssr: false }
);

const Line = dynamic(
  () => import("react-chartjs-2").then((m) => m.Line),
  { ssr: false }
);

type ProjectRow = {
  id: string;
  type: string;
  title: string;
  created_at: string;
  data: any; // { resume: {...}, texte: string, graphData?: {...} }
};

function formatEuro(val: number) {
  if (Number.isNaN(val) || val === undefined || val === null) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (Number.isNaN(val) || val === undefined || val === null) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

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

export default function ProjetsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const renderMultiline = (text: string) =>
    text.split("\n").map((line, idx) => (
      <p key={idx} className="text-xs text-slate-700 leading-relaxed">
        {line}
      </p>
    ));

  // --- Détail par type de projet ---

  const renderCapaciteDetail = (p: ProjectRow) => {
    const resume = p.data?.resume || {};
    const texte = p.data?.texte as string | undefined;

    return (
      <div className="mt-3 space-y-3">
        {/* Cartes de synthèse capacité d'emprunt */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Revenus pris en compte
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.revenusPrisEnCompte)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Mensualité max disponible
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.mensualiteMax)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Capital finançable (approx.)
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.montantMax)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Taux d&apos;endettement après projet
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatPct(resume.tauxEndettementAvecProjet)}
            </p>
          </div>
        </div>

        {/* Budget du bien potentiel */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-emerald-700 uppercase tracking-[0.14em]">
              Prix de bien cible
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-900">
              {formatEuro(resume.prixBienMax)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Frais de notaire estimés
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.fraisNotaireEstimes)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Frais d&apos;agence estimés
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.fraisAgenceEstimes)}
            </p>
          </div>
        </div>

        {/* Analyse narrative */}
        {texte && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
              Analyse détaillée de la capacité d&apos;emprunt
            </p>
            {renderMultiline(texte)}
          </div>
        )}
      </div>
    );
  };

  const renderInvestissementDetail = (p: ProjectRow) => {
    const resume = p.data?.resume || {};
    const texte = p.data?.texte as string | undefined;
    const g = p.data?.graphData;

    // Préparation des graphes si données dispo
    let barData: any = null;
    let lineData: any = null;

    if (g) {
      const {
        loyersAnnuels,
        chargesTotales,
        annuiteCredit,
        resultatNetAnnuel,
        dureeCredLoc,
      } = g;

      barData = {
        labels: ["Loyers bruts", "Charges", "Crédit + assurance", "Résultat net"],
        datasets: [
          {
            label: "Montants annuels (€)",
            data: [loyersAnnuels, chargesTotales, annuiteCredit, resultatNetAnnuel],
            backgroundColor: ["#22c55e", "#fb923c", "#38bdf8", "#0f172a"],
          },
        ],
      };

      const horizon = Math.min(Math.max(dureeCredLoc || 20, 5), 30);
      const annualCF = resultatNetAnnuel || 0;
      const labels = [];
      const data = [];
      let cumul = 0;
      for (let year = 1; year <= horizon; year++) {
        cumul += annualCF;
        labels.push(`Année ${year}`);
        data.push(cumul);
      }

      lineData = {
        labels,
        datasets: [
          {
            label: "Cash-flow cumulé (€)",
            data,
            borderColor: "#0f172a",
            backgroundColor: "rgba(15, 23, 42, 0.08)",
            tension: 0.25,
          },
        ],
      };
    }

    return (
      <div className="mt-3 space-y-4">
        {/* Cartes synthèse */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Résultat net annuel
            </p>
            <p
              className={
                "mt-1 text-sm font-semibold " +
                (resume.resultatNetAnnuel >= 0
                  ? "text-emerald-700"
                  : "text-red-600")
              }
            >
              {formatEuro(resume.resultatNetAnnuel)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Rendement net avant crédit
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatPct(resume.rendementNetAvantCredit)}
            </p>
          </div>
          {g && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                Coût total du projet
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(g.coutTotal)}
              </p>
            </div>
          )}
        </div>

        {/* Graphiques si disponibles */}
        {g && barData && lineData && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[0.7rem] text-slate-600 mb-2">
                Flux annuels : loyers bruts, charges, crédit + assurance et résultat net.
              </p>
              <Bar
                data={barData}
                options={{
                  plugins: {
                    legend: {
                      labels: {
                        color: "#0f172a",
                        font: { size: 11 },
                      },
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

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[0.7rem] text-slate-600 mb-2">
                Cash-flow cumulé année par année (hypothèse de paramètres constants).
              </p>
              <Line
                data={lineData}
                options={{
                  plugins: {
                    legend: {
                      labels: {
                        color: "#0f172a",
                        font: { size: 11 },
                      },
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
        )}

        {!g && (
          <p className="text-[0.7rem] text-slate-500">
            Ce projet ne contient pas encore de données de graphique sauvegardées. Les
            prochaines simulations d&apos;investissement enregistreront également les
            graphes pour une analyse complète ici.
          </p>
        )}

        {/* Analyse narrative */}
        {texte && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
              Analyse détaillée de la rentabilité
            </p>
            {renderMultiline(texte)}
          </div>
        )}
      </div>
    );
  };

  const renderPretRelaisDetail = (p: ProjectRow) => {
    const resume = p.data?.resume || {};
    const texte = p.data?.texte as string | undefined;

    return (
      <div className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Valeur estimée du bien
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.valeurBien || 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Capital restant dû
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resume.crd || 0)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-emerald-700 uppercase tracking-[0.14em]">
              Montant de prêt relais estimé
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-900">
              {formatEuro(resume.montantRelais || 0)}
            </p>
          </div>
        </div>

        {texte && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
              Lecture et commentaires
            </p>
            {renderMultiline(texte)}
          </div>
        )}
      </div>
    );
  };

  const renderParcDetail = (p: ProjectRow) => {
    const resumeGlobal = p.data?.resumeGlobal || {};
    const biens = p.data?.biens || [];
    const texte = p.data?.texte as string | undefined;
    const graph = p.data?.graphData;

    let barData: any = null;
    if (graph && graph.labels && graph.cashflows) {
      barData = {
        labels: graph.labels,
        datasets: [
          {
            label: "Cash-flow annuel par bien (€)",
            data: graph.cashflows,
            backgroundColor: "#0f172a",
          },
        ],
      };
    }

    return (
      <div className="mt-3 space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Valeur totale du parc
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatEuro(resumeGlobal.valeurTotale || 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Cash-flow annuel global
            </p>
            <p
              className={
                "mt-1 text-sm font-semibold " +
                (resumeGlobal.cashflowAnnuelGlobal >= 0
                  ? "text-emerald-700"
                  : "text-red-600")
              }
            >
              {formatEuro(resumeGlobal.cashflowAnnuelGlobal || 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Rendement brut moyen
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatPct(resumeGlobal.rendementBrutMoyen || 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
              Nombre de biens
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {biens.length || 0}
            </p>
          </div>
        </div>

        {barData && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-[0.7rem] text-slate-600 mb-2">
              Comparaison des cash-flows annuels par bien.
            </p>
            <Bar
              data={barData}
              options={{
                plugins: {
                  legend: {
                    labels: {
                      color: "#0f172a",
                      font: { size: 11 },
                    },
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
        )}

        {texte && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
              Analyse globale du parc
            </p>
            {renderMultiline(texte)}
          </div>
        )}
      </div>
    );
  };

  const renderProjectDetail = (p: ProjectRow) => {
    switch (p.type) {
      case "capacite":
        return renderCapaciteDetail(p);
      case "investissement":
        return renderInvestissementDetail(p);
      case "pret-relais":
        return renderPretRelaisDetail(p);
      case "parc":
        return renderParcDetail(p);
      default:
        return (
          <p className="mt-2 text-xs text-slate-500">
            Type de projet non reconnu pour l&apos;affichage détaillé.
          </p>
        );
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
              Retrouvez ici les simulations enregistrées depuis les différents outils, avec
              le même niveau de détail que lors de la réalisation de la simulation.
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
            la capacité d&apos;emprunt, l&apos;investissement locatif, le prêt relais ou
            l&apos;analyse de parc, puis utilisez le bouton &quot;Sauvegarder dans mon
            espace&quot;.
          </p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const isOpen = expandedId === p.id;
              return (
                <article
                  key={p.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((cur) => (cur === p.id ? null : p.id))
                    }
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        {labelType(p.type)}
                      </p>
                      <h2 className="text-sm font-semibold text-slate-900">
                        {p.title || "Simulation sans titre"}
                      </h2>
                      <p className="text-[0.7rem] text-slate-500 mt-0.5">
                        Créé le {formatDate(p.created_at)}
                      </p>
                    </div>
                    <span className="text-[0.8rem] text-slate-500">
                      {isOpen ? "Masquer le détail ▲" : "Voir le détail ▼"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="pt-3 mt-3 border-t border-slate-100">
                      {renderProjectDetail(p)}
                    </div>
                  )}
                </article>
              );
            })}
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
