// pages/mon-compte.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type Mode = "login" | "register";
type Tab = "infos" | "securite" | "projets" | "bailleur";

type ProjectType = "capacite" | "investissement" | "parc" | "pret-relais" | string;

type ProjectRow = {
  id: string;
  user_id: string;
  type: ProjectType;
  title: string | null;
  data: any;
  created_at: string;
};

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
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

function typeLabel(type: ProjectType): string {
  switch (type) {
    case "capacite":
      return "Capacité d'emprunt";
    case "investissement":
      return "Investissement locatif";
    case "parc":
      return "Parc immobilier";
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

function getTab(raw: any): Tab {
  // Next peut donner string | string[].
  const value = Array.isArray(raw) ? raw[0] : raw;

  const cleaned = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, ""); // enlève un slash final

  const allowed: Tab[] = ["infos", "securite", "projets", "bailleur"];
  return allowed.includes(cleaned as Tab) ? (cleaned as Tab) : "infos";
}

function getMode(raw: any): Mode {
  return raw === "register" ? "register" : "login";
}

export default function MonComptePage() {
  const router = useRouter();

  // URL-derived UI state (✅ source of truth)
  const tab: Tab = getTab(router.query.tab);
  const mode: Mode = getMode(router.query.mode);

  // Auth form
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  // User session
  const [checkingUser, setCheckingUser] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Dashboard
  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [projectsCountLoading, setProjectsCountLoading] = useState(false);

  // Security
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdOk, setPwdOk] = useState<string | null>(null);

  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsOk, setPrefsOk] = useState<string | null>(null);

  // Bailleur (user_metadata)
  const [bailleurLoading, setBailleurLoading] = useState(false);
  const [bailleurError, setBailleurError] = useState<string | null>(null);
  const [bailleurOk, setBailleurOk] = useState<string | null>(null);

  const [isLandlord, setIsLandlord] = useState(false);
  const [landlordName, setLandlordName] = useState("");
  const [landlordAddress, setLandlordAddress] = useState("");
  const [defaultCity, setDefaultCity] = useState("");
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<
    "virement" | "prelevement" | "cheque" | "especes"
  >("virement");
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);

  // Projects tab
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const isLoggedIn = !!user?.id;

  const redirectParam =
    typeof router.query.redirect === "string" && router.query.redirect.startsWith("/")
      ? router.query.redirect
      : null;

  const goToTab = (next: Tab) => {
    // conserve redirect et enlève mode (inutile quand connecté)
    const nextQuery: Record<string, any> = { ...router.query, tab: next };
    router.push({ pathname: "/mon-compte", query: nextQuery }, undefined, { shallow: true });
  };

  const setModeInUrl = (m: Mode) => {
    const nextQuery: Record<string, any> = { ...router.query, mode: m };
    router.push({ pathname: "/mon-compte", query: nextQuery }, undefined, { shallow: true });
  };

  const redirectAfterAuth = () => {
    // si redirect est fourni -> on y va
    // sinon on reste sur /mon-compte en conservant tab
    if (redirectParam) router.push(redirectParam);
    else router.push({ pathname: "/mon-compte", query: { tab } });
  };

  const hydrateFromUser = async (u: any | null) => {
    setUser(u);

    if (!u) {
      setNewsletterOptIn(false);
      setIsLandlord(false);
      setLandlordName("");
      setLandlordAddress("");
      setDefaultCity("");
      setDefaultPaymentMode("virement");
      setAutoSendEnabled(false);
      setProjectsCount(null);
      return;
    }

    const meta = u.user_metadata || {};
    setNewsletterOptIn(!!meta.newsletter_opt_in);

    setIsLandlord(!!meta.is_landlord);
    setLandlordName(meta.landlord_name || "");
    setLandlordAddress(meta.landlord_address || "");
    setDefaultCity(meta.landlord_default_city || "");
    setDefaultPaymentMode(meta.landlord_default_payment_mode || "virement");
    setAutoSendEnabled(!!meta.landlord_auto_send_enabled);

    // Compteur projets
    try {
      setProjectsCountLoading(true);
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.id);
      setProjectsCount(count ?? 0);
    } finally {
      setProjectsCountLoading(false);
    }
  };

  // ✅ Session robuste (la clé du problème)
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        await hydrateFromUser(data.session?.user ?? null);
        setCheckingUser(false);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setCheckingUser(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      await hydrateFromUser(session?.user ?? null);
      setCheckingUser(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Charge les projets seulement quand onglet "projets"
  useEffect(() => {
    const fetchProjects = async () => {
      if (!isLoggedIn || tab !== "projets") return;

      try {
        setProjectsLoading(true);
        setProjectsError(null);

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) throw new Error("Session invalide, reconnectez-vous.");

        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", sessionData.session.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProjects((data || []) as ProjectRow[]);
      } catch (err: any) {
        setProjectsError(err?.message || "Impossible de charger vos projets.");
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchProjects();
  }, [isLoggedIn, tab]);

  // ---------- AUTH ----------
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);

    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (error) {
        setAuthError(error.message || "Erreur de connexion.");
        return;
      }

      redirectAfterAuth();
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);

    if (!authEmail || !authPassword) {
      setAuthError("Merci de renseigner un e-mail et un mot de passe.");
      return;
    }
    if (authPassword !== authPassword2) {
      setAuthError("Les mots de passe ne correspondent pas.");
      return;
    }

    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });

      if (error) {
        setAuthError(error.message || "Erreur inscription.");
        return;
      }

      setAuthInfo("Compte créé. Vérifiez vos e-mails puis connectez-vous.");
      setModeInUrl("login");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // ---------- SECURITY ----------
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdOk(null);

    if (!newPassword) return setPwdError("Merci de renseigner un nouveau mot de passe.");
    if (newPassword !== newPassword2) return setPwdError("Les mots de passe ne correspondent pas.");

    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) setPwdError(error.message || "Erreur mise à jour mot de passe.");
      else {
        setPwdOk("Mot de passe mis à jour ✅");
        setNewPassword("");
        setNewPassword2("");
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSavePreferences = async (e: FormEvent) => {
    e.preventDefault();
    setPrefsError(null);
    setPrefsOk(null);

    setPrefsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { newsletter_opt_in: newsletterOptIn },
      });
      if (error) setPrefsError(error.message || "Erreur de mise à jour.");
      else setPrefsOk("Préférences enregistrées ✅");
    } finally {
      setPrefsLoading(false);
    }
  };

  // ---------- BAILLEUR ----------
  const handleSaveLandlord = async (e: FormEvent) => {
    e.preventDefault();
    setBailleurError(null);
    setBailleurOk(null);

    setBailleurLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          is_landlord: isLandlord,
          landlord_name: landlordName,
          landlord_address: landlordAddress,
          landlord_default_city: defaultCity,
          landlord_default_payment_mode: defaultPaymentMode,
          landlord_auto_send_enabled: autoSendEnabled,
        },
      });
      if (error) throw error;

      // Refresh user local
      const { data } = await supabase.auth.getUser();
      await hydrateFromUser(data.user ?? null);

      setBailleurOk("Espace bailleur mis à jour ✅");
    } catch (err: any) {
      setBailleurError(err?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setBailleurLoading(false);
    }
  };

  // ---------- PROJECTS ----------
  const handleDeleteProject = async (project: ProjectRow) => {
    const ok = window.confirm("Supprimer définitivement ce projet ?");
    if (!ok) return;

    try {
      setDeleteLoadingId(project.id);
      const { error } = await supabase.from("projects").delete().eq("id", project.id);
      if (error) throw error;

      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      if (expandedId === project.id) setExpandedId(null);
      setProjectsCount((prev) => (prev !== null ? Math.max(prev - 1, 0) : prev));
    } catch (err: any) {
      alert("Erreur suppression : " + (err?.message || "inconnue"));
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const profileCompletion = useMemo(() => {
    if (!isLoggedIn) return 0;
    let score = 50;
    if (newsletterOptIn) score += 10;
    if (isLandlord && landlordName && landlordAddress) score += 40;
    return Math.min(score, 100);
  }, [isLoggedIn, newsletterOptIn, isLandlord, landlordName, landlordAddress]);

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[220px,1fr]">
          {/* SIDEBAR */}
          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 h-fit">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-3">
              Mon espace
            </p>

            {checkingUser ? (
              <p className="text-sm text-slate-500">Chargement…</p>
            ) : isLoggedIn ? (
              <>
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1">Connecté en tant que :</p>
                  <p className="text-sm font-semibold text-slate-900 break-all">{user.email}</p>
                </div>

                <nav className="space-y-1 text-sm">
                  {([
                    ["infos", "Tableau de bord"],
                    ["bailleur", "Espace bailleur"],
                    ["securite", "Sécurité & préférences"],
                    ["projets", "Mes projets"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={
                        "w-full text-left rounded-lg px-3 py-2 " +
                        (tab === key
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-50")
                      }
                      onClick={() => goToTab(key)}
                    >
                      {label}
                    </button>
                  ))}

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
                <p>Connectez-vous pour :</p>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>Sauvegarder vos simulations</li>
                  <li>Accéder aux outils avancés</li>
                  <li>Gérer vos quittances bailleur</li>
                </ul>
              </div>
            )}
          </aside>

          {/* MAIN PANEL */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            {checkingUser ? (
              <p className="text-sm text-slate-500">Chargement...</p>
            ) : !isLoggedIn ? (
              <>
                {/* AUTH */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                      Accès à votre espace
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {mode === "login" ? "Connexion" : "Créer un compte"}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Vous pourrez ensuite accéder à vos outils (dont l’espace bailleur).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModeInUrl(mode === "login" ? "register" : "login")}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {mode === "login" ? "Créer un compte" : "J’ai déjà un compte"}
                  </button>
                </div>

                {authError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {authError}
                  </div>
                )}
                {authInfo && (
                  <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {authInfo}
                  </div>
                )}

                {mode === "login" ? (
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Adresse e-mail</label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Mot de passe</label>
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {authLoading ? "Connexion..." : "Se connecter"}
                      </button>
                      <p className="text-[0.7rem] text-slate-500">
                        Redirection :{" "}
                        <span className="font-semibold">
                          {redirectParam ?? `/mon-compte?tab=${tab}`}
                        </span>
                      </p>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Adresse e-mail</label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">Mot de passe</label>
                        <input
                          type="password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">Confirmer</label>
                        <input
                          type="password"
                          value={authPassword2}
                          onChange={(e) => setAuthPassword2(e.target.value)}
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {authLoading ? "Création..." : "Créer mon compte"}
                    </button>
                  </form>
                )}
              </>
            ) : tab === "infos" ? (
              <>
                {/* DASHBOARD */}
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Tableau de bord
                </p>
                <h2 className="text-lg font-semibold text-slate-900">Vue d’ensemble</h2>
                <p className="text-sm text-slate-600 mt-1 mb-4">
                  Vos projets + accès rapide à l’espace bailleur.
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                      Compte
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Actif</p>
                    <p className="mt-1 text-xs text-slate-500 break-all">{user.email}</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                      Projets sauvegardés
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {projectsCountLoading ? "…" : projectsCount ?? "—"}
                    </p>
                    <button
                      type="button"
                      onClick={() => goToTab("projets")}
                      className="mt-1 text-xs text-slate-600 underline"
                    >
                      Voir mes projets
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                      Profil
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {profileCompletion}%
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Complétude</p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-amber-50/60 px-4 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-[0.75rem] font-semibold text-slate-900">
                        Espace bailleur
                      </p>
                      <p className="text-xs text-slate-700 mt-1">
                        {isLandlord
                          ? "Votre espace bailleur est activé."
                          : "Activez-le pour gérer quittances, biens et envois automatiques."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToTab("bailleur")}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      {isLandlord ? "Ouvrir l’espace bailleur" : "Activer l’espace bailleur"}
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Link
                    href="/capacite"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Nouvelle simulation capacité
                  </Link>
                  <Link
                    href="/outils-proprietaire"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Outils propriétaire
                  </Link>
                  <Link
                    href="/quittances-loyer"
                    className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400"
                  >
                    Quittances de loyer
                  </Link>
                </div>
              </>
            ) : tab === "bailleur" ? (
              <>
                {/* BAILLEUR */}
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-amber-700 mb-1">
                  Espace bailleur
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Paramètres bailleur (utilisés pour vos quittances)
                </h2>
                <p className="text-sm text-slate-600 mt-1 mb-4">
                  Configurez votre profil bailleur. Ces infos serviront de valeurs par défaut dans
                  <span className="font-semibold"> /quittances-loyer</span>.
                </p>

                {bailleurError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {bailleurError}
                  </div>
                )}
                {bailleurOk && (
                  <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {bailleurOk}
                  </div>
                )}

                <form onSubmit={handleSaveLandlord} className="space-y-3">
                  <label className="flex items-start gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={isLandlord}
                      onChange={(e) => setIsLandlord(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                    />
                    <span className="font-medium">Activer mon espace bailleur</span>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Nom / raison sociale</label>
                      <input
                        type="text"
                        value={landlordName}
                        onChange={(e) => setLandlordName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Ville de signature (défaut)</label>
                      <input
                        type="text"
                        value={defaultCity}
                        onChange={(e) => setDefaultCity(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">Adresse bailleur</label>
                    <textarea
                      rows={2}
                      value={landlordAddress}
                      onChange={(e) => setLandlordAddress(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Mode de paiement par défaut</label>
                      <select
                        value={defaultPaymentMode}
                        onChange={(e) => setDefaultPaymentMode(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="virement">Virement</option>
                        <option value="prelevement">Prélèvement</option>
                        <option value="cheque">Chèque</option>
                        <option value="especes">Espèces</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Envoi auto (global)</label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={autoSendEnabled}
                          onChange={(e) => setAutoSendEnabled(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                        />
                        <span>Activer l’envoi automatique (option)</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={bailleurLoading}
                    className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
                  >
                    {bailleurLoading ? "Enregistrement..." : "Enregistrer l’espace bailleur"}
                  </button>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/outils-proprietaire"
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Outils propriétaire
                    </Link>
                    <Link
                      href="/quittances-loyer"
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Gérer mes quittances
                    </Link>
                  </div>
                </form>
              </>
            ) : tab === "securite" ? (
              <>
                {/* SECURITY */}
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-900 mb-1">
                  Sécurité & préférences
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Protégez votre compte
                </h2>

                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">
                    Changer mon mot de passe
                  </p>
                  {pwdError && (
                    <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] text-red-700">
                      {pwdError}
                    </div>
                  )}
                  {pwdOk && (
                    <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.7rem] text-emerald-700">
                      {pwdOk}
                    </div>
                  )}
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">Nouveau mot de passe</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">Confirmer</label>
                        <input
                          type="password"
                          value={newPassword2}
                          onChange={(e) => setNewPassword2(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={pwdLoading}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {pwdLoading ? "Mise à jour..." : "Mettre à jour"}
                    </button>
                  </form>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">
                    Newsletter
                  </p>
                  {prefsError && (
                    <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] text-red-700">
                      {prefsError}
                    </div>
                  )}
                  {prefsOk && (
                    <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.7rem] text-emerald-700">
                      {prefsOk}
                    </div>
                  )}
                  <form onSubmit={handleSavePreferences} className="space-y-3">
                    <label className="flex items-start gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={newsletterOptIn}
                        onChange={(e) => setNewsletterOptIn(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span>Je souhaite recevoir la newsletter.</span>
                    </label>
                    <button
                      type="submit"
                      disabled={prefsLoading}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {prefsLoading ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                {/* PROJECTS */}
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-900 mb-1">
                  Mes projets
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Projets sauvegardés
                </h2>

                {projectsLoading && <p className="text-sm text-slate-500">Chargement…</p>}
                {!projectsLoading && projectsError && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">
                    {projectsError}
                  </div>
                )}

                {!projectsLoading && !projectsError && projects.length === 0 && (
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

                {!projectsLoading && !projectsError && projects.length > 0 && (
                  <section className="space-y-3">
                    {projects.map((p) => {
                      const isExpanded = expandedId === p.id;
                      return (
                        <article
                          key={p.id}
                          className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold " +
                                    typeBadgeColor(p.type)
                                  }
                                >
                                  {typeLabel(p.type)}
                                </span>
                                <span className="text-[0.7rem] text-slate-400">
                                  {formatDateTime(p.created_at)}
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {p.title || typeLabel(p.type)}
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : p.id)}
                                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                              >
                                {isExpanded ? "Masquer" : "Détails"}
                              </button>
                              <button
                                onClick={() => handleDeleteProject(p)}
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
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} MT Courtage &amp; Investissement</p>
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
