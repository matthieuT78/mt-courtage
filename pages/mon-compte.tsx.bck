// pages/mon-compte.tsx
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";
import Link from "next/link";
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

// Enregistrement Chart.js une seule fois
ChartJS.register(
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement
);

// Charts dynamiques côté client
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), {
  ssr: false,
});
const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), {
  ssr: false,
});

type Mode = "login" | "register";
type Tab = "infos" | "securite" | "projets";

type ProjectType =
  | "capacite"
  | "investissement"
  | "parc"
  | "pret-relais"
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

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "Information non disponible";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Information non disponible";
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(type: ProjectType): string {
  switch (type) {
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
  switch (type) {
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

export default function MonComptePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);

  // Infos utilisateur pour le tableau de bord
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [lastSignInAt, setLastSignInAt] = useState<string | null>(null);
  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [projectsCountLoading, setProjectsCountLoading] = useState(false);

  // Onglet actif
  const [activeTab, setActiveTab] = useState<Tab>("infos");

  // Sécurité : changement de mot de passe
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdMessage, setPwdMessage] = useState<string | null>(null);

  // Préférences : newsletter
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);

  // Projets (onglet "projets")
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // Déduire le mode (login/register) depuis l'URL pour un utilisateur non connecté
  useEffect(() => {
    if (router.isReady) {
      const modeQuery = router.query.mode as string | undefined;
      if (modeQuery === "register") {
        setMode("register");
      } else {
        setMode("login");
      }
    }
  }, [router.isReady, router.query.mode]);

  // Déduire l'onglet actif (infos / securite / projets)
  useEffect(() => {
    if (!router.isReady) return;
    const tabQuery = router.query.tab as string | undefined;
    if (tabQuery === "securite") {
      setActiveTab("securite");
    } else if (tabQuery === "projets") {
      setActiveTab("projets");
    } else {
      setActiveTab("infos");
    }
  }, [router.isReady, router.query.tab]);

  // Récupérer l'utilisateur connecté & ses préférences (newsletter) + infos pour le tableau de bord
  useEffect(() => {
    const fetchUser = async () => {
      if (!supabase) {
        setCheckingUser(false);
        return;
      }
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        const rawUser: any = data.user;
        setUserEmail(rawUser.email ?? null);

        const meta = rawUser.user_metadata || {};
        setNewsletterOptIn(!!meta.newsletter_opt_in);

        setEmailVerified(
          !!(rawUser.email_confirmed_at || rawUser.confirmed_at)
        );
        setLastSignInAt(rawUser.last_sign_in_at || null);

        // Compter les projets pour le tableau de bord
        try {
          setProjectsCountLoading(true);
          const { count, error: projectsCountError } = await supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("user_id", rawUser.id);

          if (!projectsCountError) {
            setProjectsCount(count ?? 0);
          }
        } finally {
          setProjectsCountLoading(false);
        }
      } else {
        setUserEmail(null);
      }
      setCheckingUser(false);
    };
    fetchUser();
  }, []);

  const redirectAfterAuth = () => {
    const redirectParam = router.query.redirect;
    const redirectPath =
      typeof redirectParam === "string" && redirectParam.startsWith("/")
        ? redirectParam
        : "/";
    router.push(redirectPath);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setInfoMessage(null);

    if (!supabase) {
      setGlobalError(
        "Le service d'authentification n'est pas disponible pour le moment."
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setGlobalError(error.message || "Erreur de connexion.");
      } else {
        redirectAfterAuth();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setInfoMessage(null);

    if (!supabase) {
      setGlobalError(
        "Le service d'authentification n'est pas disponible pour le moment."
      );
      return;
    }

    if (!email || !password) {
      setGlobalError("Merci de renseigner un e-mail et un mot de passe.");
      return;
    }

    if (password !== passwordConfirm) {
      setGlobalError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setGlobalError(error.message || "Erreur lors de l'inscription.");
      } else {
        setInfoMessage(
          "Compte créé. Un e-mail de confirmation peut vous être envoyé. Vous pouvez maintenant vous connecter."
        );
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserEmail(null);
    router.push("/");
  };

  const isLoggedIn = !!userEmail;

  const goToTab = (tab: Tab) => {
    setActiveTab(tab);
    router.push({
      pathname: "/mon-compte",
      query: { tab },
    });
  };

  // Changement de mot de passe
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdMessage(null);

    if (!supabase) {
      setPwdError("Service d'authentification indisponible.");
      return;
    }

    if (!newPassword) {
      setPwdError("Merci de renseigner un nouveau mot de passe.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setPwdError("Les mots de passe ne correspondent pas.");
      return;
    }

    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setPwdError(
          error.message || "Erreur lors de la mise à jour du mot de passe."
        );
      } else {
        setPwdMessage("Votre mot de passe a été mis à jour avec succès.");
        setNewPassword("");
        setNewPasswordConfirm("");
      }
    } finally {
      setPwdLoading(false);
    }
  };

  // Mise à jour des préférences (newsletter)
  const handleSavePreferences = async (e: FormEvent) => {
    e.preventDefault();
    setPrefsError(null);
    setPrefsMessage(null);

    if (!supabase) {
      setPrefsError("Service d'authentification indisponible.");
      return;
    }

    setPrefsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { newsletter_opt_in: newsletterOptIn },
      });
      if (error) {
        setPrefsError(
          error.message || "Erreur lors de la mise à jour de vos préférences."
        );
      } else {
        setPrefsMessage("Vos préférences ont bien été mises à jour.");
      }
    } finally {
      setPrefsLoading(false);
    }
  };

  // Chargement des projets quand onglet "projets" + utilisateur connecté
  useEffect(() => {
    const fetchProjects = async () => {
      if (!supabase || !isLoggedIn || activeTab !== "projets") return;

      try {
        setProjectsLoading(true);
        setProjectsError(null);

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          throw new Error(
            "Impossible de récupérer votre session. Merci de vous reconnecter."
          );
        }

        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", sessionData.session.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setProjects((data || []) as ProjectRow[]);
      } catch (err: any) {
        setProjectsError(
          err?.message ||
            "Impossible de récupérer vos projets enregistrés pour le moment."
        );
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLoggedIn]);

  const handleDeleteProject = async (project: ProjectRow) => {
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

      // Mettre à jour le compteur de projets dans le tableau de bord
      setProjectsCount((prev) => (prev !== null ? Math.max(prev - 1, 0) : prev));
    } catch (err: any) {
      alert(
        "Erreur lors de la suppression du projet : " +
          (err?.message || "erreur inconnue")
      );
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleShareProject = (project: ProjectRow) => {
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

  // Petit helper pour rendre un texte multi-lignes sous forme de blocs
  const renderAnalysisBlocks = (text: string) => {
    if (!text) return null;
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return (
      <div className="space-y-2">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2"
          >
            <span className="mt-1 text-xs text-emerald-600">●</span>
            <p className="text-[0.8rem] text-slate-800 leading-relaxed">
              {line}
            </p>
          </div>
        ))}
      </div>
    );
  };

  const renderProjectDetail = (project: ProjectRow) => {
    const d = project.data || {};
    const type = project.type;

    // CAPACITÉ D'EMPRUNT
    if (type === "capacite") {
      const r = d.resume || {};
      const texte = d.texte || d.analyse || "";

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

          {texte && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                Analyse détaillée
              </p>
              {renderAnalysisBlocks(texte)}
            </div>
          )}
        </div>
      );
    }

    // INVESTISSEMENT LOCATIF
    if (type === "investissement") {
      const r = d.resume || d.resumeRendement || {};
      const g = d.graphData || {};
      const inputs = d.inputs || {};
      const localite =
        inputs.localite ||
        (inputs.city
          ? `${inputs.city.name} (${inputs.city.postalCode})`
          : null);
      const surfaceM2 = inputs.surfaceM2 || inputs.surface || null;
      const listingUrl = inputs.listingUrl || d.listingUrl || null;
      const analyseText = d.analyse || d.texte || "";

      // Préparation des données graphiques si dispo
      let barData: any = null;
      let lineData: any = null;

      if (
        g &&
        typeof g.loyersAnnuels === "number" &&
        typeof g.chargesTotales === "number" &&
        typeof g.annuiteCredit === "number" &&
        typeof g.resultatNetAnnuel === "number"
      ) {
        barData = {
          labels: [
            "Loyers bruts",
            "Charges",
            "Crédit + assurance",
            "Résultat net",
          ],
          datasets: [
            {
              label: "Montants annuels (€)",
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

        const duree = g.dureeCredLoc || 0;
        const horizon = Math.min(Math.max(duree, 5), 30);
        const annualCF = g.resultatNetAnnuel;
        const labels: string[] = [];
        const data: number[] = [];
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
          {/* Contexte du bien */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Contexte du projet
            </p>
            <div className="mt-1 text-xs text-slate-700 space-y-1.5">
              {localite && (
                <p>
                  Localité :{" "}
                  <span className="font-semibold">{localite}</span>
                </p>
              )}
              {surfaceM2 && (
                <p>
                  Surface :{" "}
                  <span className="font-semibold">
                    {surfaceM2.toLocaleString("fr-FR", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    m²
                  </span>
                </p>
              )}
              {listingUrl && (
                <p className="break-all">
                  Annonce associée :{" "}
                  <a
                    href={listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-700 underline"
                  >
                    {listingUrl}
                  </a>
                </p>
              )}
              {!localite && !surfaceM2 && !listingUrl && (
                <p className="text-slate-500">
                  Paramètres détaillés non disponibles pour ce projet (ancienne
                  version de la sauvegarde).
                </p>
              )}
            </div>
          </div>

          {/* Tuiles de synthèse */}
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

          {/* Analyse narrative complète */}
          {analyseText && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                Analyse détaillée
              </p>
              {renderAnalysisBlocks(analyseText)}
            </div>
          )}

          {/* Graphiques si on a les données */}
          {barData && lineData && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs text-slate-600 mb-2">
                  Flux annuels : loyers bruts, charges, crédit + assurance et
                  résultat net.
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
                <p className="text-xs text-slate-600 mb-2">
                  Cash-flow cumulé année par année (paramètres constants).
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
        </div>
      );
    }

    // PARC IMMOBILIER
    if (type === "parc") {
      const r = d.resumeGlobal || {};
      const texte = d.texte || d.analyse || "";
      return (
        <div className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Valeur estimée totale
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatEuro(r.valeurTotale ?? r.valeurParc)}
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
                  ((r.cashflowAnnuelGlobal ?? r.cashflowMensuelGlobal * 12) >= 0
                    ? "text-emerald-700"
                    : "text-red-600")
                }
              >
                {formatEuro(
                  r.cashflowAnnuelGlobal ??
                    (r.cashflowMensuelGlobal != null
                      ? r.cashflowMensuelGlobal * 12
                      : undefined)
                )}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                Rendement net global
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatPct(r.rendementNetGlobal ?? r.rendementNetMoyen)}
              </p>
            </div>
          </div>

          {texte && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                Analyse détaillée
              </p>
              {renderAnalysisBlocks(texte)}
            </div>
          )}
        </div>
      );
    }

    // 🔹 PRÊT RELAIS
    if (type === "pret-relais") {
      const r = d.resume || {};
      const inputs = d.inputs || {};
      const texte = d.analyse || d.texte || "";

      return (
        <div className="mt-3 space-y-4">
          {/* Contexte synthétique */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
              Contexte de la simulation
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-slate-700">
              <p>
                Valeur estimée du bien actuel :{" "}
                <span className="font-semibold">
                  {formatEuro(inputs.valeurBienActuel)}
                </span>
              </p>
              <p>
                Capital restant dû :{" "}
                <span className="font-semibold">
                  {formatEuro(inputs.crdActuel)}
                </span>
              </p>
              <p>
                Revenu mensuel net du foyer :{" "}
                <span className="font-semibold">
                  {formatEuro(inputs.revMensuels)}
                </span>
              </p>
              <p>
                Taux d&apos;endettement cible :{" "}
                <span className="font-semibold">
                  {formatPct(inputs.tauxEndettement)}
                </span>
              </p>
            </div>
          </div>

          {/* Tuiles de synthèse prêt relais */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
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
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
              <p className="text-[0.7rem] text-emerald-700 uppercase tracking-[0.14em]">
                Budget d&apos;achat max
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-800">
                {formatEuro(r.budgetMax)}
              </p>
            </div>
          </div>

          {/* Analyse détaillée narrative */}
          {texte && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-1">
                Analyse détaillée
              </p>
              {renderAnalysisBlocks(texte)}
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

  // Complétude "simple" du profil (évolutif plus tard)
  const profileCompletion = (() => {
    if (!isLoggedIn) return 0;
    let score = 40; // compte créé + email
    if (emailVerified) score += 30;
    if (newsletterOptIn) score += 20;
    return Math.min(score, 100);
  })();

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[220px,1fr]">
          {/* MENU LATÉRAL GAUCHE */}
          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 h-fit">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-3">
              Mon espace
            </p>

            {isLoggedIn ? (
              <>
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1">
                    Connecté en tant que :
                  </p>
                  <p className="text-sm font-semibold text-slate-900 break-all">
                    {userEmail}
                  </p>
                </div>

                <nav className="space-y-1 text-sm">
                  <button
                    type="button"
                    className={
                      "w-full text-left rounded-lg px-3 py-2 " +
                      (activeTab === "infos"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50")
                    }
                    onClick={() => goToTab("infos")}
                  >
                    Tableau de bord & profil
                  </button>
                  <button
                    type="button"
                    className={
                      "w-full text-left rounded-lg px-3 py-2 " +
                      (activeTab === "securite"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50")
                    }
                    onClick={() => goToTab("securite")}
                  >
                    Sécurité & préférences
                  </button>
                  <button
                    type="button"
                    className={
                      "w-full text-left rounded-lg px-3 py-2 " +
                      (activeTab === "projets"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50")
                    }
                    onClick={() => goToTab("projets")}
                  >
                    Mes projets sauvegardés
                  </button>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2 text-red-600 hover:bg-red-50"
                    onClick={handleLogout}
                  >
                    Déconnexion
                  </button>
                </nav>
              </>
            ) : (
              <div className="text-xs text-slate-500">
                <p>Connectez-vous ou créez un compte pour :</p>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>Enregistrer vos simulations</li>
                  <li>Retrouver vos projets plus tard</li>
                  <li>Préparer vos rendez-vous bancaires</li>
                </ul>
              </div>
            )}
          </aside>

          {/* CONTENU PRINCIPAL */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            {checkingUser ? (
              <p className="text-sm text-slate-500">Chargement...</p>
            ) : !isLoggedIn ? (
              // ------- NON CONNECTÉ : LOGIN / REGISTER -------
              <>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                      Accès à votre espace
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {mode === "login"
                        ? "Connexion à votre compte"
                        : "Créer un compte MT Courtage"}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Utilisez un e-mail que vous consultez régulièrement : il
                      servira à centraliser vos simulations et échanges.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setMode(mode === "login" ? "register" : "login")
                    }
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {mode === "login"
                      ? "Pas encore inscrit ?"
                      : "Déjà un compte ?"}
                  </button>
                </div>

                {globalError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {globalError}
                  </div>
                )}

                {infoMessage && (
                  <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {infoMessage}
                  </div>
                )}

                {mode === "login" ? (
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">
                        Adresse e-mail
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">
                        Mot de passe
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {loading ? "Connexion..." : "Se connecter"}
                      </button>
                      <p className="text-[0.7rem] text-slate-500">
                        Après connexion, vous serez redirigé vers{" "}
                        <span className="font-semibold">
                          {typeof router.query.redirect === "string"
                            ? router.query.redirect
                            : "/"}
                        </span>
                        .
                      </p>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">
                        Adresse e-mail
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">
                          Mot de passe
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">
                          Confirmer le mot de passe
                        </label>
                        <input
                          type="password"
                          value={passwordConfirm}
                          onChange={(e) =>
                            setPasswordConfirm(e.target.value)
                          }
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {loading ? "Création en cours..." : "Créer mon compte"}
                      </button>
                      <p className="text-[0.7rem] text-slate-500 max-w-xs">
                        Votre compte vous permet de sauvegarder vos simulations
                        (capacité d&apos;emprunt, investissement, parc immobilier)
                        et de les retrouver plus tard.
                      </p>
                    </div>
                  </form>
                )}
              </>
            ) : activeTab === "infos" ? (
              // ------- ONGLET INFOS / TABLEAU DE BORD -------
              <>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Tableau de bord
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Vue d&apos;ensemble de votre compte
                </h2>
                <p className="text-sm text-slate-600 mt-1 mb-4">
                  Gérez vos informations, suivez vos projets immobiliers et
                  préparez sereinement vos futurs rendez-vous bancaires.
                </p>

                {/* Cartes de synthèse */}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                      Statut du compte
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      Compte actif
                    </p>
                    <p className="mt-1 text-xs text-slate-500 break-all">
                      {userEmail}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      {emailVerified
                        ? "E-mail vérifié ✔"
                        : "E-mail non encore vérifié"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                      Projets sauvegardés
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {projectsCountLoading
                        ? "Calcul en cours…"
                        : projectsCount === null
                        ? "—"
                        : `${projectsCount} projet${
                            (projectsCount || 0) > 1 ? "s" : ""
                          }`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Retrouver vos simulations dans{" "}
                      <button
                        type="button"
                        onClick={() => goToTab("projets")}
                        className="underline underline-offset-2"
                      >
                        “Mes projets sauvegardés”
                      </button>
                      .
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                      Dernière connexion
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatDateTime(lastSignInAt)}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Pour sécuriser votre compte, pensez à mettre à jour
                      régulièrement votre mot de passe.
                    </p>
                  </div>
                </div>

                {/* Complétude de profil */}
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[0.75rem] font-semibold text-slate-800">
                        Complétude de votre profil
                      </p>
                      <p className="mt-1 text-xs text-slate-500 max-w-md">
                        Plus votre profil est complet, plus il est simple de
                        préparer un accompagnement personnalisé et de suivre
                        l&apos;évolution de vos projets.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-slate-900">
                        {profileCompletion}%
                      </p>
                      <p className="text-[0.7rem] text-slate-500">
                        Profil complété
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>

                  <ul className="mt-3 space-y-1 text-[0.75rem] text-slate-600">
                    <li>✔ Compte créé avec votre adresse e-mail principale</li>
                    <li>
                      {emailVerified ? (
                        <>✔ Adresse e-mail vérifiée</>
                      ) : (
                        <>À faire : vérifier votre adresse e-mail via le lien reçu</>
                      )}
                    </li>
                    <li>
                      {newsletterOptIn ? (
                        <>
                          ✔ Inscrit à la newsletter (modifiable dans l&apos;onglet
                          “Sécurité &amp; préférences”)
                        </>
                      ) : (
                        <>
                          Optionnel : vous pouvez activer la newsletter pour
                          recevoir nos conseils et actualités.
                        </>
                      )}
                    </li>
                  </ul>
                </div>

                {/* Actions rapides */}
                <div className="mt-6">
                  <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">
                    Actions rapides
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => goToTab("projets")}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Consulter mes projets sauvegardés
                    </button>
                    <button
                      type="button"
                      onClick={() => goToTab("securite")}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Mettre à jour mot de passe / newsletter
                    </button>
                    <div className="flex gap-2">
                      <Link
                        href="/capacite"
                        className="flex-1 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Nouvelle simulation capacité
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Bloc aide / contact */}
                <div className="mt-6 rounded-xl border border-slate-200 bg-emerald-50/60 px-4 py-3 text-xs text-slate-700">
                  <p className="font-semibold text-slate-800 mb-1">
                    Besoin d&apos;aide ou d&apos;un avis sur vos simulations ?
                  </p>
                  <p className="mb-1">
                    Vous pouvez nous écrire directement pour analyser vos
                    projets, préparer un rendez-vous bancaire ou poser vos
                    questions sur une situation spécifique.
                  </p>
                  <p>
                    Contact :{" "}
                    <a
                      href="mailto:mtcourtage@gmail.com"
                      className="underline underline-offset-2"
                    >
                      mtcourtage@gmail.com
                    </a>
                  </p>
                </div>
              </>
            ) : activeTab === "securite" ? (
              // ------- ONGLET SÉCURITÉ & PRÉFÉRENCES -------
              <>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-900 mb-1">
                  Sécurité &amp; préférences
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Protégez votre compte et choisissez vos communications
                </h2>
                <p className="text-sm text-slate-600 mb-4">
                  Mettez à jour votre mot de passe et indiquez si vous souhaitez
                  recevoir les newsletters MT Courtage &amp; Investissement.
                </p>

                {/* Bloc changement de mot de passe */}
                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">
                    Changer mon mot de passe
                  </p>
                  {pwdError && (
                    <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] text-red-700">
                      {pwdError}
                    </div>
                  )}
                  {pwdMessage && (
                    <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.7rem] text-emerald-700">
                      {pwdMessage}
                    </div>
                  )}
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">
                          Nouveau mot de passe
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">
                          Confirmer le nouveau mot de passe
                        </label>
                        <input
                          type="password"
                          value={newPasswordConfirm}
                          onChange={(e) =>
                            setNewPasswordConfirm(e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={pwdLoading}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {pwdLoading
                        ? "Mise à jour..."
                        : "Mettre à jour mon mot de passe"}
                    </button>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Idéalement, utilisez un mot de passe long, unique et
                      contenant lettres, chiffres et caractères spéciaux.
                    </p>
                  </form>
                </div>

                {/* Bloc préférences newsletter */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">
                    Préférences de communication
                  </p>
                  {prefsError && (
                    <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] text-red-700">
                      {prefsError}
                    </div>
                  )}
                  {prefsMessage && (
                    <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.7rem] text-emerald-700">
                      {prefsMessage}
                    </div>
                  )}
                  <form onSubmit={handleSavePreferences} className="space-y-3">
                    <label className="flex items-start gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={newsletterOptIn}
                        onChange={(e) =>
                          setNewsletterOptIn(e.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span>
                        Je souhaite recevoir la newsletter MT Courtage &amp;
                        Investissement (sélection d&apos;articles, conseils
                        pratiques, nouveautés sur les simulateurs).
                      </span>
                    </label>
                    <p className="text-[0.7rem] text-slate-500">
                      Vous pourrez modifier ce choix à tout moment. Votre
                      adresse ne sera jamais utilisée pour du spam ni transmise
                      à des tiers.
                    </p>
                    <button
                      type="submit"
                      disabled={prefsLoading}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {prefsLoading
                        ? "Enregistrement..."
                        : "Enregistrer mes préférences"}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              // ------- ONGLET PROJETS -------
              <>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-900 mb-1">
                  Mes projets sauvegardés
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Simulations prêtes à être partagées avec votre banque
                </h2>
                <p className="text-sm text-slate-600 mb-4">
                  Retrouvez ici vos simulations de capacité d&apos;emprunt, vos
                  projets d&apos;investissement locatif et vos analyses de parc
                  immobilier déjà sauvegardés.
                </p>

                {projectsLoading && (
                  <p className="text-sm text-slate-500">
                    Chargement de vos projets…
                  </p>
                )}

                {!projectsLoading && projectsError && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">
                    {projectsError}
                  </div>
                )}

                {!projectsLoading &&
                  !projectsError &&
                  projects.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-700 font-medium mb-1">
                        Aucun projet sauvegardé pour le moment.
                      </p>
                      <p className="text-xs text-slate-500 mb-3">
                        Lancez une simulation depuis les calculettes (capacité
                        d&apos;emprunt, investissement locatif, parc immobilier…)
                        puis utilisez le bouton “Sauvegarder ce projet”.
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
                    </div>
                  )}

                {!projectsLoading &&
                  !projectsError &&
                  projects.length > 0 && (
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
                                    {formatDateTime(project.created_at)}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                  {project.title || label}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    setExpandedId(
                                      isExpanded ? null : project.id
                                    )
                                  }
                                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                                >
                                  {isExpanded
                                    ? "Masquer les détails"
                                    : "Voir les détails"}
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                                {renderProjectDetail(project)}

                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() =>
                                        handleShareProject(project)
                                      }
                                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg hover:brightness-105 transition"
                                    >
                                      Partager le projet
                                    </button>

                                    <button
                                      onClick={() =>
                                        handleDeleteProject(project)
                                      }
                                      disabled={
                                        deleteLoadingId === project.id
                                      }
                                      className="inline-flex items-center justify-center rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                                    >
                                      {deleteLoadingId === project.id
                                        ? "Suppression…"
                                        : "Supprimer le projet"}
                                    </button>
                                  </div>
                                  <p className="text-[0.7rem] text-slate-400">
                                    Ces simulations sont indicatives et peuvent
                                    être recalculées à tout moment avec vos
                                    paramètres actualisés.
                                  </p>
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </section>
                  )}
              </>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils de
          simulation immobilière.
        </p>
        <p className="mt-1">
          Contact :{" "}
          <a href="mailto:mtcourtage@gmail.com" className="underline">
            mtcourtage@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
