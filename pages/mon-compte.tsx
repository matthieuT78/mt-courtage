// pages/mon-compte.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type Mode = "login" | "register";
type Tab = "infos" | "profil" | "securite" | "projets" | "bailleur";

type ProjectType = "capacite" | "investissement" | "parc" | "pret-relais" | string;

type ProjectRow = {
  id: string;
  user_id: string;
  type: ProjectType;
  title: string | null;
  data: any;
  created_at: string;
};

type PaymentMode = "virement" | "prelevement" | "cheque" | "especes";
type AccountType = "particulier" | "pro";
type SubscriptionPlan = "free" | "annual_40" | "monthly_49";

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  account_type: AccountType | null;
  subscription_plan: SubscriptionPlan | null;
  is_admin?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type LandlordRow = {
  user_id: string;
  display_name: string | null;
  address: string | null;
  default_city: string | null;
  default_payment_mode: string | null;

  properties_count: number | null;

  auto_send_enabled: boolean | null;
  auto_send_frequency: string | null; // monthly / quarterly / yearly
  auto_send_day: number | null; // 1..31
  auto_send_hour: number | null; // 0..23

  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;

  default_issue_place: string | null;
  default_payment_method: string | null;

  created_at?: string | null;
  updated_at?: string | null;
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
  const value = Array.isArray(raw) ? raw[0] : raw;
  const cleaned = String(value ?? "").trim().toLowerCase().replace(/\/$/, "");
  const allowed: Tab[] = ["infos", "profil", "securite", "projets", "bailleur"];
  return allowed.includes(cleaned as Tab) ? (cleaned as Tab) : "infos";
}

function getMode(raw: any): Mode {
  return raw === "register" ? "register" : "login";
}

export default function MonComptePage() {
  const router = useRouter();

  const tab: Tab = getTab(router.query.tab);
  const mode: Mode = getMode(router.query.mode);

  // Auth form
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  // Session
  const [checkingUser, setCheckingUser] = useState(true);
  const [user, setUser] = useState<any>(null);
  const isLoggedIn = !!user?.id;

  // Redirect param
  const redirectParam =
    typeof router.query.redirect === "string" && router.query.redirect.startsWith("/")
      ? router.query.redirect
      : null;

  // Dashboard
  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [projectsCountLoading, setProjectsCountLoading] = useState(false);

  // Projects tab
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

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

  // ---- PROFIL (DB: profiles) ----
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("FR");

  const [accountType, setAccountType] = useState<AccountType>("particulier");
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>("free");

  // ---- BAILLEUR (DB: landlords) ----
  const [bailleurLoading, setBailleurLoading] = useState(false);
  const [bailleurError, setBailleurError] = useState<string | null>(null);
  const [bailleurOk, setBailleurOk] = useState<string | null>(null);

  const [isLandlord, setIsLandlord] = useState(false);

  const [landlordName, setLandlordName] = useState("");
  const [landlordAddress, setLandlordAddress] = useState(""); // fallback/legacy
  const [landlordAddr1, setLandlordAddr1] = useState("");
  const [landlordAddr2, setLandlordAddr2] = useState("");
  const [landlordPostalCode, setLandlordPostalCode] = useState("");
  const [landlordCity, setLandlordCity] = useState("");
  const [landlordCountry, setLandlordCountry] = useState("FR");

  const [defaultCity, setDefaultCity] = useState(""); // legacy label in UI
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<PaymentMode>("virement");

  const [propertiesCount, setPropertiesCount] = useState<number>(1);

  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [autoSendFrequency, setAutoSendFrequency] = useState<string>("monthly");
  const [autoSendDay, setAutoSendDay] = useState<number>(1);
  const [autoSendHour, setAutoSendHour] = useState<number>(9);

  const goToTab = (next: Tab) => {
    const nextQuery: Record<string, any> = { ...router.query, tab: next };
    router.push({ pathname: "/mon-compte", query: nextQuery }, undefined, { shallow: true });
  };

  const setModeInUrl = (m: Mode) => {
    const nextQuery: Record<string, any> = { ...router.query, mode: m };
    router.push({ pathname: "/mon-compte", query: nextQuery }, undefined, { shallow: true });
  };

  const redirectAfterAuth = () => {
    if (redirectParam) router.push(redirectParam);
    else router.push({ pathname: "/mon-compte", query: { tab: "infos" } });
  };

  const resetAllState = () => {
    setNewsletterOptIn(false);

    setFirstName("");
    setLastName("");
    setPhone("");
    setAddr1("");
    setAddr2("");
    setPostalCode("");
    setCity("");
    setCountry("FR");
    setAccountType("particulier");
    setSubscriptionPlan("free");

    setIsLandlord(false);
    setLandlordName("");
    setLandlordAddress("");
    setLandlordAddr1("");
    setLandlordAddr2("");
    setLandlordPostalCode("");
    setLandlordCity("");
    setLandlordCountry("FR");
    setDefaultCity("");
    setDefaultPaymentMode("virement");
    setPropertiesCount(1);
    setAutoSendEnabled(false);
    setAutoSendFrequency("monthly");
    setAutoSendDay(1);
    setAutoSendHour(9);

    setProjectsCount(null);
  };

  const hydrateFromUser = async (u: any | null) => {
    setUser(u);

    if (!u) {
      resetAllState();
      return;
    }

    // newsletter in auth metadata (ok de laisser ici)
    const meta = u.user_metadata || {};
    setNewsletterOptIn(!!meta.newsletter_opt_in);

    // ---- DB: profiles ----
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      const pr = (p as ProfileRow | null) ?? null;

      if (pr) {
        setFirstName(pr.first_name || "");
        setLastName(pr.last_name || "");

        // full_name fallback
        if (!pr.first_name && !pr.last_name && pr.full_name) {
          const parts = pr.full_name.split(" ");
          setFirstName(parts.slice(0, -1).join(" ") || "");
          setLastName(parts.slice(-1).join(" ") || "");
        }

        setPhone(pr.phone || "");
        setAddr1(pr.address_line1 || "");
        setAddr2(pr.address_line2 || "");
        setPostalCode(pr.postal_code || "");
        setCity(pr.city || "");
        setCountry(pr.country || "FR");
        setAccountType((pr.account_type as AccountType) || "particulier");
        setSubscriptionPlan((pr.subscription_plan as SubscriptionPlan) || "free");
      }
    } catch {
      // si table profiles RLS ou non dispo => on ne bloque pas l’accès
    }

    // ---- DB: landlords ----
    try {
      const { data: l } = await supabase
        .from("landlords")
        .select("*")
        .eq("user_id", u.id)
        .maybeSingle();

      const lr = (l as LandlordRow | null) ?? null;

      if (lr) {
        setIsLandlord(true);

        setLandlordName(lr.display_name || "");
        setLandlordAddress(lr.address || "");
        setLandlordAddr1(lr.address_line1 || "");
        setLandlordAddr2(lr.address_line2 || "");
        setLandlordPostalCode(lr.postal_code || "");
        setLandlordCity(lr.city || "");
        setLandlordCountry(lr.country || "FR");

        setDefaultCity(lr.default_issue_place || lr.default_city || "");
        setDefaultPaymentMode(
          (lr.default_payment_method as PaymentMode) ||
            (lr.default_payment_mode as PaymentMode) ||
            "virement"
        );

        setPropertiesCount(lr.properties_count ?? 1);

        setAutoSendEnabled(!!lr.auto_send_enabled);
        setAutoSendFrequency(lr.auto_send_frequency || "monthly");
        setAutoSendDay(lr.auto_send_day ?? 1);
        setAutoSendHour(lr.auto_send_hour ?? 9);
      } else {
        setIsLandlord(false);
      }
    } catch {
      // ignore
    }

    // projects count
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

  // Session init + listener
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

  // Load projects when needed
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

  // ---------- PROFIL (profiles) ----------
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) return;

    setProfileError(null);
    setProfileOk(null);
    setProfileLoading(true);

    try {
      const fullName = `${firstName} ${lastName}`.trim();

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName || null,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        address_line1: addr1 || null,
        address_line2: addr2 || null,
        postal_code: postalCode || null,
        city: city || null,
        country: country || "FR",
        account_type: accountType,
        subscription_plan: subscriptionPlan,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      // refresh local
      const { data } = await supabase.auth.getUser();
      await hydrateFromUser(data.user ?? null);

      setProfileOk("Profil enregistré ✅");
    } catch (err: any) {
      setProfileError(err?.message || "Erreur lors de l’enregistrement du profil.");
    } finally {
      setProfileLoading(false);
    }
  };

  // ---------- BAILLEUR (landlords) ----------
  const handleSaveLandlord = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) return;

    setBailleurError(null);
    setBailleurOk(null);
    setBailleurLoading(true);

    try {
      // si pas activé, on laisse quand même enregistrer (mais tu peux choisir delete)
      const safeCount = Math.max(1, Math.min(999, Number(propertiesCount || 1)));
      const safeDay = Math.max(1, Math.min(31, Number(autoSendDay || 1)));
      const safeHour = Math.max(0, Math.min(23, Number(autoSendHour ?? 9)));

      const { error } = await supabase.from("landlords").upsert({
        user_id: user.id,
        display_name: landlordName || null,

        // legacy field (texte libre)
        address: landlordAddress || null,

        // address détaillée
        address_line1: landlordAddr1 || null,
        address_line2: landlordAddr2 || null,
        postal_code: landlordPostalCode || null,
        city: landlordCity || null,
        country: landlordCountry || "FR",

        // defaults
        default_city: defaultCity || null, // legacy
        default_payment_mode: defaultPaymentMode, // legacy

        default_issue_place: defaultCity || null,
        default_payment_method: defaultPaymentMode,

        properties_count: safeCount,

        auto_send_enabled: !!autoSendEnabled,
        auto_send_frequency: autoSendFrequency || "monthly",
        auto_send_day: safeDay,
        auto_send_hour: safeHour,

        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      // on considère bailleur activé si une ligne existe
      setIsLandlord(true);

      const { data } = await supabase.auth.getUser();
      await hydrateFromUser(data.user ?? null);

      setBailleurOk("Espace bailleur mis à jour ✅");
    } catch (err: any) {
      setBailleurError(err?.message || "Erreur lors de l’enregistrement.");
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

    let score = 20;
    if (firstName && lastName) score += 20;
    if (addr1 && postalCode && city) score += 20;
    if (phone) score += 10;
    if (subscriptionPlan !== "free") score += 10;
    if (isLandlord && landlordName) score += 10;
    if (isLandlord && safeNonEmpty(landlordAddr1 || landlordAddress) && landlordPostalCode && landlordCity) score += 10;
    return Math.min(score, 100);
  }, [
    isLoggedIn,
    firstName,
    lastName,
    addr1,
    postalCode,
    city,
    phone,
    subscriptionPlan,
    isLandlord,
    landlordName,
    landlordAddr1,
    landlordAddress,
    landlordPostalCode,
    landlordCity,
  ]);

  function safeNonEmpty(v: string) {
    return !!String(v || "").trim();
  }

  const planLabel =
    subscriptionPlan === "annual_40"
      ? "Pro (40€ / an)"
      : subscriptionPlan === "monthly_49"
      ? "Pro (49€ / mois)"
      : "Gratuit";

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[240px,1fr]">
          {/* SIDEBAR */}
          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 h-fit">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-3">Mon espace</p>

            {checkingUser ? (
              <p className="text-sm text-slate-500">Chargement…</p>
            ) : isLoggedIn ? (
              <>
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1">Connecté en tant que :</p>
                  <p className="text-sm font-semibold text-slate-900 break-all">{user.email}</p>
                  <p className="mt-1 text-[0.7rem] text-slate-500">
                    Plan : <span className="font-semibold">{planLabel}</span>
                  </p>
                </div>

                <nav className="space-y-1 text-sm">
                  {([
                    ["infos", "Tableau de bord"],
                    ["profil", "Profil (identité)"],
                    ["bailleur", "Espace bailleur"],
                    ["securite", "Sécurité & préférences"],
                    ["projets", "Mes projets"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={
                        "w-full text-left rounded-lg px-3 py-2 " +
                        (tab === key ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50")
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
                        <span className="font-semibold">{redirectParam ?? `/mon-compte?tab=${tab}`}</span>
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
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Tableau de bord</p>
                <h2 className="text-lg font-semibold text-slate-900">Vue d’ensemble</h2>
                <p className="text-sm text-slate-600 mt-1 mb-4">
                  Profil, bailleur, projets et accès rapide aux quittances.
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Compte</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{planLabel}</p>
                    <p className="mt-1 text-xs text-slate-500 break-all">{user.email}</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Projets sauvegardés</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {projectsCountLoading ? "…" : projectsCount ?? "—"}
                    </p>
                    <button type="button" onClick={() => goToTab("projets")} className="mt-1 text-xs text-slate-600 underline">
                      Voir mes projets
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Profil</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{profileCompletion}%</p>
                    <p className="mt-1 text-xs text-slate-500">Complétude</p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-amber-50/60 px-4 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-[0.75rem] font-semibold text-slate-900">Espace bailleur</p>
                      <p className="text-xs text-slate-700 mt-1">
                        {isLandlord ? "Votre espace bailleur est configuré." : "Activez-le pour gérer quittances, biens et envois automatiques."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToTab("bailleur")}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      {isLandlord ? "Ouvrir l’espace bailleur" : "Configurer l’espace bailleur"}
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href="/quittances-loyer" className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400">
                    Quittances de loyer
                  </Link>
                  <Link href="/outils-proprietaire" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                    Outils propriétaire
                  </Link>
                  <Link href="/capacite" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                    Nouvelle simulation capacité
                  </Link>
                </div>
              </>
            ) : tab === "profil" ? (
              <>
                {/* PROFIL */}
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-sky-700 mb-1">Profil</p>
                <h2 className="text-lg font-semibold text-slate-900">Identité & coordonnées</h2>
                <p className="text-sm text-slate-600 mt-1 mb-4">
                  Ces informations sont stockées en base (<span className="font-semibold">profiles</span>).
                </p>

                {profileError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{profileError}</div>
                )}
                {profileOk && (
                  <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{profileOk}</div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Prénom</label>
                      <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Nom</label>
                      <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Téléphone</label>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Type de compte</label>
                      <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="particulier">Particulier</option>
                        <option value="pro">Professionnel</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs text-slate-700">Adresse (ligne 1)</label>
                      <input value={addr1} onChange={(e) => setAddr1(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Adresse (ligne 2)</label>
                      <input value={addr2} onChange={(e) => setAddr2(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Code postal</label>
                      <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Ville</label>
                      <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Pays</label>
                      <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-900 mb-2">Abonnement (sélection fonctionnelle, paiement géré ailleurs)</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="radio" checked={subscriptionPlan === "free"} onChange={() => setSubscriptionPlan("free")} />
                        Gratuit
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="radio" checked={subscriptionPlan === "annual_40"} onChange={() => setSubscriptionPlan("annual_40")} />
                        40€ / an
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="radio" checked={subscriptionPlan === "monthly_49"} onChange={() => setSubscriptionPlan("monthly_49")} />
                        49€ / mois
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    {profileLoading ? "Enregistrement..." : "Enregistrer mon profil"}
                  </button>
                </form>
              </>
            ) : tab === "bailleur" ? (
              <>
                {/* BAILLEUR */}
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-amber-700 mb-1">Espace bailleur</p>
                <h2 className="text-lg font-semibold text-slate-900">Paramètres bailleur</h2>
                <p className="text-sm text-slate-600 mt-1 mb-4">
                  Ces informations sont stockées en base (<span className="font-semibold">landlords</span>) et serviront de valeurs par défaut dans{" "}
                  <span className="font-semibold">/quittances-loyer</span>.
                </p>

                {bailleurError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{bailleurError}</div>
                )}
                {bailleurOk && (
                  <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{bailleurOk}</div>
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
                      <input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Nombre de biens (pour la suite)</label>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={propertiesCount}
                        onChange={(e) => setPropertiesCount(parseInt(e.target.value || "1", 10) || 1)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs text-slate-700">Adresse (ligne 1)</label>
                      <input value={landlordAddr1} onChange={(e) => setLandlordAddr1(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Adresse (ligne 2)</label>
                      <input value={landlordAddr2} onChange={(e) => setLandlordAddr2(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Code postal</label>
                      <input value={landlordPostalCode} onChange={(e) => setLandlordPostalCode(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Ville</label>
                      <input value={landlordCity} onChange={(e) => setLandlordCity(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Pays</label>
                      <input value={landlordCountry} onChange={(e) => setLandlordCountry(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                  </div>

                  {/* legacy textarea kept optional */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">Adresse bailleur (texte libre - optionnel)</label>
                    <textarea
                      rows={2}
                      value={landlordAddress}
                      onChange={(e) => setLandlordAddress(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Ville de signature / émission (défaut)</label>
                      <input value={defaultCity} onChange={(e) => setDefaultCity(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700">Mode de paiement par défaut</label>
                      <select
                        value={defaultPaymentMode}
                        onChange={(e) => setDefaultPaymentMode(e.target.value as PaymentMode)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="virement">Virement</option>
                        <option value="prelevement">Prélèvement</option>
                        <option value="cheque">Chèque</option>
                        <option value="especes">Espèces</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <p className="text-xs font-semibold text-slate-900">Envoi automatique (global)</p>

                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={autoSendEnabled}
                        onChange={(e) => setAutoSendEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                      />
                      <span>Activer l’envoi automatique</span>
                    </label>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">Fréquence</label>
                        <select
                          value={autoSendFrequency}
                          onChange={(e) => setAutoSendFrequency(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="monthly">Mensuel</option>
                          <option value="quarterly">Trimestriel</option>
                          <option value="yearly">Annuel</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">Jour (1–31)</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={autoSendDay}
                          onChange={(e) => setAutoSendDay(parseInt(e.target.value || "1", 10) || 1)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">Heure (0–23)</label>
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={autoSendHour}
                          onChange={(e) => setAutoSendHour(parseInt(e.target.value || "9", 10) || 9)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                        <p className="text-[0.7rem] text-slate-500">Par défaut : 09h</p>
                      </div>
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
                    <Link href="/quittances-loyer" className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                      Gérer mes quittances
                    </Link>
                    <Link href="/outils-proprietaire" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                      Outils propriétaire
                    </Link>
                  </div>
                </form>
              </>
            ) : tab === "securite" ? (
              <>
                {/* SECURITY */}
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-900 mb-1">Sécurité & préférences</p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Protégez votre compte</h2>

                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">Changer mon mot de passe</p>

                  {pwdError && (
                    <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] text-red-700">{pwdError}</div>
                  )}
                  {pwdOk && (
                    <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.7rem] text-emerald-700">{pwdOk}</div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">Nouveau mot de passe</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-700">Confirmer</label>
                        <input type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <button type="submit" disabled={pwdLoading} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                      {pwdLoading ? "Mise à jour..." : "Mettre à jour"}
                    </button>
                  </form>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">Newsletter</p>

                  {prefsError && (
                    <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] text-red-700">{prefsError}</div>
                  )}
                  {prefsOk && (
                    <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.7rem] text-emerald-700">{prefsOk}</div>
                  )}

                  <form onSubmit={handleSavePreferences} className="space-y-3">
                    <label className="flex items-start gap-2 text-sm text-slate-800">
                      <input type="checkbox" checked={newsletterOptIn} onChange={(e) => setNewsletterOptIn(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                      <span>Je souhaite recevoir la newsletter.</span>
                    </label>
                    <button type="submit" disabled={prefsLoading} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60">
                      {prefsLoading ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                {/* PROJECTS */}
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-900 mb-1">Mes projets</p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Projets sauvegardés</h2>

                {projectsLoading && <p className="text-sm text-slate-500">Chargement…</p>}
                {!projectsLoading && projectsError && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">{projectsError}</div>
                )}

                {!projectsLoading && !projectsError && projects.length === 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-700 font-medium mb-1">Aucun projet.</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Link href="/capacite" className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                        Calculette capacité
                      </Link>
                      <Link href="/investissement" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
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
                        <article key={p.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={"inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold " + typeBadgeColor(p.type)}>
                                  {typeLabel(p.type)}
                                </span>
                                <span className="text-[0.7rem] text-slate-400">{formatDateTime(p.created_at)}</span>
                              </div>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{p.title || typeLabel(p.type)}</p>
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
                              <pre className="text-[0.7rem] sm:text-xs text-slate-800 overflow-auto">{JSON.stringify(p.data, null, 2)}</pre>
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
