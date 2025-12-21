// pages/mon-compte/projets.tsx
import { useEffect, useMemo, useState } from "react";
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

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

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

function euro(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function euro2(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

function number0(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function Badge({ tone, children }: { tone: "slate" | "emerald" | "amber" | "red"; children: React.ReactNode }) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold " + cls}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function toneFromCashflow(v: number) {
  if (!Number.isFinite(v)) return "slate" as const;
  if (v >= 0) return "emerald" as const;
  if (v > -150) return "amber" as const;
  return "red" as const;
}

function InvestmentProjectView({ data }: { data: any }) {
  const inputs = data?.inputs || {};
  const resume = data?.resume || {};
  const graph = data?.graphData || {};
  const opp = data?.opportunity || {};
  const analyse = String(data?.analyse || "").trim();

  const cashflow = Number(resume.cashflowMensuel);
  const resultatNetAnnuel = Number(resume.resultatNetAnnuel);
  const rendementNetAvantCredit = Number(resume.rendementNetAvantCredit);

  const coutTotal = Number(graph.coutTotal ?? (Number(inputs.prixBien || 0) + Number(inputs.fraisNotaire || 0) + Number(inputs.fraisAgence || 0) + Number(inputs.travaux || 0)));
  const apport = Number(inputs.apport);
  const duree = Number(graph.dureeCredLoc ?? inputs.dureeCredLoc);
  const mensualiteCredit = Number(graph.mensualiteCredit);
  const annuiteCredit = Number(graph.annuiteCredit);
  const loyersAnnuels = Number(graph.loyersAnnuels);
  const chargesTotales = Number(graph.chargesTotales);
  const rendementBrut = Number(graph.rendementBrut);

  const titleLine = useMemo(() => {
    const ville = inputs.localite || inputs.city || "";
    const prix = Number(inputs.prixBien);
    const lots = Number(inputs.nbApparts || 1);
    return `${lots} lot(s) • ${ville ? ville + " • " : ""}${Number.isFinite(prix) ? euro(prix) : ""}`.trim();
  }, [inputs]);

  const score = Number(opp.score);
  const scoreTone =
    !Number.isFinite(score) ? ("slate" as const) : score >= 7 ? ("emerald" as const) : score >= 5 ? ("amber" as const) : ("red" as const);

  return (
    <div className="space-y-3">
      {/* En-tête projet */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-slate-600">Synthèse du projet</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{titleLine || "Investissement locatif"}</p>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Cash-flow mensuel</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{euro2(cashflow)}</p>
            <div className="mt-2">
              <Badge tone={toneFromCashflow(cashflow)}>
                {cashflow >= 0 ? "Positif" : "Effort d’épargne"}
              </Badge>
            </div>
          </div>

          <StatCard label="Résultat net annuel" value={euro2(resultatNetAnnuel)} sub="Après charges + crédit (hors fiscalité)" />
          <StatCard label="Rendement net avant crédit" value={pct(rendementNetAvantCredit)} sub="Net de charges, avant emprunt" />
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-2 sm:grid-cols-3">
        <StatCard label="Coût total projet" value={euro(coutTotal)} sub="Achat + notaire + agence + travaux" />
        <StatCard label="Rendement brut" value={pct(rendementBrut)} sub="Loyers bruts / coût total" />
        <StatCard label="Charges annuelles" value={euro(chargesTotales)} sub="Copro + taxe foncière + assurance + gestion" />
      </div>

      {/* Financement */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Financement</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <StatCard label="Apport" value={euro(apport)} />
          <StatCard label="Durée" value={Number.isFinite(duree) ? `${number0(duree)} ans` : "—"} />
          <StatCard label="Mensualité" value={euro2(mensualiteCredit)} sub={Number.isFinite(annuiteCredit) ? `≈ ${euro2(annuiteCredit)} / an` : undefined} />
        </div>
      </div>

      {/* Revenus */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Revenus</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <StatCard label="Loyers annuels" value={euro(loyersAnnuels)} />
          <StatCard label="Location" value={Array.isArray(inputs.locationTypes) ? inputs.locationTypes.join(", ") : "—"} />
          <StatCard label="Nb lots" value={number0(inputs.nbApparts ?? 1)} />
        </div>
      </div>

      {/* Opportunité */}
      {(opp?.comment || (Array.isArray(opp?.improvements) && opp.improvements.length)) && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Opportunité</p>
            <Badge tone={scoreTone}>Score : {Number.isFinite(score) ? `${score}/10` : "—"}</Badge>
          </div>

          {opp?.comment ? <p className="mt-2 text-sm text-slate-700">{String(opp.comment)}</p> : null}

          {Array.isArray(opp?.improvements) && opp.improvements.length ? (
            <ul className="mt-3 space-y-2">
              {opp.improvements.map((s: any, idx: number) => (
                <li key={idx} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  • {String(s)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* Analyse */}
      {analyse ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Analyse</p>
          <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{analyse}</p>
        </div>
      ) : null}
    </div>
  );
}

function UnknownProjectView({ data }: { data: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Détails</p>
      <p className="mt-1 text-xs text-slate-600">Ce type de projet n’a pas encore de rendu dédié.</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-800">Voir le JSON brut (debug)</summary>
        <pre className="mt-2 text-[0.7rem] sm:text-xs text-slate-800 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function ProjectDetails({ p }: { p: ProjectRow }) {
  const type = String(p.type || "").toLowerCase();
  if (type === "investissement") return <InvestmentProjectView data={p.data} />;
  return <UnknownProjectView data={p.data} />;
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
                      <div className="min-w-0">
                        <p className="text-[0.7rem] text-slate-500">{formatDateTime(p.created_at)}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 truncate">{p.title || p.type}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          {isExpanded ? "Masquer" : "Voir"}
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

                    {isExpanded ? (
                      <div className="mt-4">
                        <ProjectDetails p={p} />

                        {/* Debug optionnel */}
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                            JSON brut (debug)
                          </summary>
                          <pre className="mt-2 text-[0.7rem] sm:text-xs text-slate-800 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                            {JSON.stringify(p.data, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ) : null}
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
