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

type LandlordRow = {
  user_id: string;
  display_name: string | null;
  address: string | null;
  default_city: string | null;
  default_payment_mode: string | null;
  properties_count: number | null;
  auto_send_enabled: boolean | null;
  created_at?: string;
  updated_at?: string;

  // champs détaillés (si présents)
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;

  default_issue_place?: string | null;
  default_payment_method?: string | null;

  auto_send_frequency?: string | null; // ex: "monthly"
  auto_send_day?: number | null; // 1..31
  auto_send_hour?: number | null; // 0..23
};

type PropertyRow = {
  id: string;
  user_id: string;
  label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  updated_at?: string;
};

type TenantRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
};

type LeaseRow = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string; // NOT NULL
  end_date: string | null;
  rent_amount: string | number | null; // numeric
  charges_amount: string | number | null; // numeric
  deposit_amount: string | number | null;
  payment_day: number | null;
  payment_method: string | null;
  status: string | null; // si tu l'as
  auto_reminder_enabled: boolean | null;
  auto_quittance_enabled: boolean | null;
  reminder_day_of_month: number | null;
  reminder_email: string | null;
  tenant_receipt_email: string | null;
  timezone: string | null;
  created_at: string;
  updated_at?: string;
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

function formatDateFR(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "2-digit" });
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
  const allowed: Tab[] = ["infos", "securite", "projets", "bailleur"];
  return allowed.includes(cleaned as Tab) ? (cleaned as Tab) : "infos";
}

function getMode(raw: any): Mode {
  return raw === "register" ? "register" : "login";
}

function formatMoney(n: number | string | null | undefined) {
  if (n == null) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(v)) return "—";
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function clampInt(val: any, min: number, max: number, fallback: number) {
  const n = parseInt(String(val ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export default function MonComptePage() {
  const router = useRouter();

  // URL-derived state
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
  const isLoggedIn = !!user?.id;

  // redirect
  const redirectParam =
    typeof router.query.redirect === "string" && router.query.redirect.startsWith("/")
      ? router.query.redirect
      : null;

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
    else router.push({ pathname: "/mon-compte", query: { tab } });
  };

  // Dashboard / projects counter
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

  // Projects tab
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // -------------------------
  // Bailleur dashboard states
  // -------------------------
  type BailleurSubTab = "params" | "biens" | "locataires" | "baux";
  const [bSub, setBSub] = useState<BailleurSubTab>("params");

  // Data
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [receiptCountsByLease, setReceiptCountsByLease] = useState<Record<string, number>>({});

  // Loading / error
  const [bLoading, setBLoading] = useState(false);
  const [bError, setBError] = useState<string | null>(null);
  const [bOk, setBOk] = useState<string | null>(null);

  // Forms: landlord
  const [ldDisplayName, setLdDisplayName] = useState("");
  const [ldAddressLine1, setLdAddressLine1] = useState("");
  const [ldAddressLine2, setLdAddressLine2] = useState("");
  const [ldPostalCode, setLdPostalCode] = useState("");
  const [ldCity, setLdCity] = useState("");
  const [ldCountry, setLdCountry] = useState("France");
  const [ldDefaultIssuePlace, setLdDefaultIssuePlace] = useState("");
  const [ldDefaultPaymentMethod, setLdDefaultPaymentMethod] = useState("virement");
  const [ldAutoSendEnabled, setLdAutoSendEnabled] = useState(false);
  const [ldAutoSendFrequency, setLdAutoSendFrequency] = useState("monthly");
  const [ldAutoSendDay, setLdAutoSendDay] = useState(1);
  const [ldAutoSendHour, setLdAutoSendHour] = useState(9);

  // Forms: property
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [pLabel, setPLabel] = useState("");
  const [pLine1, setPLine1] = useState("");
  const [pLine2, setPLine2] = useState("");
  const [pPostal, setPPostal] = useState("");
  const [pCity, setPCity] = useState("");
  const [pCountry, setPCountry] = useState("France");

  // Forms: tenant
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [tFullName, setTFullName] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tPhone, setTPhone] = useState("");
  const [tNotes, setTNotes] = useState("");

  // Forms: lease
  const [creatingLease, setCreatingLease] = useState(false);
  const [editingLeaseId, setEditingLeaseId] = useState<string | null>(null);

  const [lPropertyId, setLPropertyId] = useState<string>("");
  const [lTenantId, setLTenantId] = useState<string>("");
  const [lStartDate, setLStartDate] = useState<string>("");
  const [lEndDate, setLEndDate] = useState<string>("");
  const [lRentAmount, setLRentAmount] = useState<string>("");
  const [lChargesAmount, setLChargesAmount] = useState<string>("");
  const [lDepositAmount, setLDepositAmount] = useState<string>("");
  const [lPaymentDay, setLPaymentDay] = useState<number>(1);
  const [lPaymentMethod, setLPaymentMethod] = useState<string>("virement");
  const [lAutoQuittance, setLAutoQuittance] = useState<boolean>(true);
  const [lTenantReceiptEmail, setLTenantReceiptEmail] = useState<string>("");

  const hydrateLandlordForm = (row: LandlordRow | null) => {
    if (!row) {
      setLdDisplayName("");
      setLdAddressLine1("");
      setLdAddressLine2("");
      setLdPostalCode("");
      setLdCity("");
      setLdCountry("France");
      setLdDefaultIssuePlace("");
      setLdDefaultPaymentMethod("virement");
      setLdAutoSendEnabled(false);
      setLdAutoSendFrequency("monthly");
      setLdAutoSendDay(1);
      setLdAutoSendHour(9);
      return;
    }

    setLdDisplayName(row.display_name || "");
    setLdAddressLine1(row.address_line1 || "");
    setLdAddressLine2(row.address_line2 || "");
    setLdPostalCode(row.postal_code || "");
    setLdCity(row.city || "");
    setLdCountry(row.country || "France");

    setLdDefaultIssuePlace(row.default_issue_place || row.default_city || "");
    setLdDefaultPaymentMethod(row.default_payment_method || row.default_payment_mode || "virement");

    setLdAutoSendEnabled(!!row.auto_send_enabled);
    setLdAutoSendFrequency(row.auto_send_frequency || "monthly");
    setLdAutoSendDay(row.auto_send_day ?? 1);
    setLdAutoSendHour(row.auto_send_hour ?? 9);
  };

  const resetPropertyForm = () => {
    setEditingPropertyId(null);
    setPLabel("");
    setPLine1("");
    setPLine2("");
    setPPostal("");
    setPCity("");
    setPCountry("France");
  };

  const resetTenantForm = () => {
    setEditingTenantId(null);
    setTFullName("");
    setTEmail("");
    setTPhone("");
    setTNotes("");
  };

  const resetLeaseForm = () => {
    setCreatingLease(false);
    setEditingLeaseId(null);
    setLPropertyId("");
    setLTenantId("");
    setLStartDate("");
    setLEndDate("");
    setLRentAmount("");
    setLChargesAmount("");
    setLDepositAmount("");
    setLPaymentDay(1);
    setLPaymentMethod("virement");
    setLAutoQuittance(true);
    setLTenantReceiptEmail("");
  };

  const activeLeaseByPropertyId = useMemo(() => {
    const map: Record<string, LeaseRow> = {};
    for (const l of leases) {
      const isActive = !l.end_date; // actif = end_date IS NULL
      if (isActive) map[l.property_id] = l;
    }
    return map;
  }, [leases]);

  // -------------------------
  // Session bootstrap
  // -------------------------
  const hydrateFromUser = async (u: any | null) => {
    setUser(u);

    if (!u) {
      setNewsletterOptIn(false);
      setProjectsCount(null);
      setLandlord(null);
      setProperties([]);
      setTenants([]);
      setLeases([]);
      setReceiptCountsByLease({});
      hydrateLandlordForm(null);
      return;
    }

    // Newsletter -> tu peux le garder en user_metadata si tu veux
    const meta = u.user_metadata || {};
    setNewsletterOptIn(!!meta.newsletter_opt_in);

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

  // -------------------------
  // Load projects when needed
  // -------------------------
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

  // -------------------------
  // Bailleur: load all
  // -------------------------
  const loadBailleurDashboard = async () => {
    if (!isLoggedIn) return;
    setBLoading(true);
    setBError(null);
    setBOk(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (!u) throw new Error("Session invalide.");

      // landlords (1 row by user_id)
      const { data: ld, error: ldErr } = await supabase
        .from("landlords")
        .select("*")
        .eq("user_id", u.id)
        .maybeSingle();

      if (ldErr) throw ldErr;
      setLandlord((ld as LandlordRow) || null);
      hydrateLandlordForm((ld as LandlordRow) || null);

      // properties
      const { data: props, error: pErr } = await supabase
        .from("properties")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: true });
      if (pErr) throw pErr;
      setProperties((props || []) as PropertyRow[]);

      // tenants
      const { data: tens, error: tErr } = await supabase
        .from("tenants")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: true });
      if (tErr) throw tErr;
      setTenants((tens || []) as TenantRow[]);

      // leases (history included)
      const { data: ls, error: lErr } = await supabase
        .from("leases")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false });
      if (lErr) throw lErr;
      const leasesRows = (ls || []) as LeaseRow[];
      setLeases(leasesRows);

      // receipts counts by lease
      const leaseIds = leasesRows.map((x) => x.id);
      if (leaseIds.length) {
        const { data: rc, error: rcErr } = await supabase
          .from("rent_receipts")
          .select("lease_id")
          .in("lease_id", leaseIds);

        if (rcErr) throw rcErr;

        const counts: Record<string, number> = {};
        for (const row of (rc || []) as any[]) {
          const id = row.lease_id as string;
          counts[id] = (counts[id] || 0) + 1;
        }
        setReceiptCountsByLease(counts);
      } else {
        setReceiptCountsByLease({});
      }
    } catch (err: any) {
      setBError(err?.message || "Erreur lors du chargement de l’espace bailleur.");
    } finally {
      setBLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    if (tab !== "bailleur") return;
    loadBailleurDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isLoggedIn]);

  // -------------------------
  // AUTH handlers
  // -------------------------
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

  // -------------------------
  // SECURITY handlers
  // -------------------------
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

  // -------------------------
  // Bailleur handlers
  // -------------------------
  const handleSaveLandlord = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) return;
    setBError(null);
    setBOk(null);

    try {
      setBLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (!u) throw new Error("Session invalide.");

      const payload: Partial<LandlordRow> = {
        user_id: u.id,
        display_name: ldDisplayName || null,

        address_line1: ldAddressLine1 || null,
        address_line2: ldAddressLine2 || null,
        postal_code: ldPostalCode || null,
        city: ldCity || null,
        country: ldCountry || null,

        default_issue_place: ldDefaultIssuePlace || null,
        default_payment_method: ldDefaultPaymentMethod || null,

        auto_send_enabled: ldAutoSendEnabled,
        auto_send_frequency: ldAutoSendFrequency || "monthly",
        auto_send_day: clampInt(ldAutoSendDay, 1, 31, 1),
        auto_send_hour: clampInt(ldAutoSendHour, 0, 23, 9),

        // optionnel (si tu veux garder une redondance)
        properties_count: properties.length,
      };

      // upsert by user_id (il faut une contrainte unique sur landlords.user_id)
      const { error } = await supabase.from("landlords").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      setBOk("Paramètres bailleur enregistrés ✅");
      await loadBailleurDashboard();
    } catch (err: any) {
      setBError(err?.message || "Erreur lors de l’enregistrement des paramètres bailleur.");
    } finally {
      setBLoading(false);
    }
  };

  const handleSaveProperty = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) return;
    setBError(null);
    setBOk(null);

    try {
      setBLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (!u) throw new Error("Session invalide.");

      const payload = {
        user_id: u.id,
        label: pLabel || null,
        address_line1: pLine1 || null,
        address_line2: pLine2 || null,
        postal_code: pPostal || null,
        city: pCity || null,
        country: pCountry || null,
      };

      if (editingPropertyId) {
        const { error } = await supabase
          .from("properties")
          .update(payload)
          .eq("id", editingPropertyId)
          .eq("user_id", u.id);
        if (error) throw error;
        setBOk("Bien mis à jour ✅");
      } else {
        const { error } = await supabase.from("properties").insert(payload);
        if (error) throw error;
        setBOk("Bien créé ✅");
      }

      resetPropertyForm();
      await loadBailleurDashboard();
      setBSub("biens");
    } catch (err: any) {
      setBError(err?.message || "Erreur lors de l’enregistrement du bien.");
    } finally {
      setBLoading(false);
    }
  };

  const handleEditProperty = (p: PropertyRow) => {
    setEditingPropertyId(p.id);
    setPLabel(p.label || "");
    setPLine1(p.address_line1 || "");
    setPLine2(p.address_line2 || "");
    setPPostal(p.postal_code || "");
    setPCity(p.city || "");
    setPCountry(p.country || "France");
    setBSub("biens");
  };

  const handleDeleteProperty = async (p: PropertyRow) => {
    const ok = window.confirm("Supprimer définitivement ce bien ?");
    if (!ok) return;
    try {
      setBLoading(true);
      const { error } = await supabase.from("properties").delete().eq("id", p.id);
      if (error) throw error;
      setBOk("Bien supprimé ✅");
      await loadBailleurDashboard();
    } catch (err: any) {
      setBError(err?.message || "Erreur suppression bien.");
    } finally {
      setBLoading(false);
    }
  };

  const handleSaveTenant = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) return;
    setBError(null);
    setBOk(null);

    try {
      setBLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (!u) throw new Error("Session invalide.");

      const payload = {
        user_id: u.id,
        full_name: tFullName || null,
        email: tEmail || null,
        phone: tPhone || null,
        notes: tNotes || null,
      };

      if (editingTenantId) {
        const { error } = await supabase
          .from("tenants")
          .update(payload)
          .eq("id", editingTenantId)
          .eq("user_id", u.id);
        if (error) throw error;
        setBOk("Locataire mis à jour ✅");
      } else {
        const { error } = await supabase.from("tenants").insert(payload);
        if (error) throw error;
        setBOk("Locataire créé ✅");
      }

      resetTenantForm();
      await loadBailleurDashboard();
      setBSub("locataires");
    } catch (err: any) {
      setBError(err?.message || "Erreur lors de l’enregistrement du locataire.");
    } finally {
      setBLoading(false);
    }
  };

  const handleEditTenant = (t: TenantRow) => {
    setEditingTenantId(t.id);
    setTFullName(t.full_name || "");
    setTEmail(t.email || "");
    setTPhone(t.phone || "");
    setTNotes(t.notes || "");
    setBSub("locataires");
  };

  const handleDeleteTenant = async (t: TenantRow) => {
    const ok = window.confirm("Supprimer définitivement ce locataire ?");
    if (!ok) return;
    try {
      setBLoading(true);
      const { error } = await supabase.from("tenants").delete().eq("id", t.id);
      if (error) throw error;
      setBOk("Locataire supprimé ✅");
      await loadBailleurDashboard();
    } catch (err: any) {
      setBError(err?.message || "Erreur suppression locataire.");
    } finally {
      setBLoading(false);
    }
  };

  const handleOpenCreateLease = () => {
    resetLeaseForm();
    setCreatingLease(true);
    setBSub("baux");

    // defaults
    const today = new Date().toISOString().slice(0, 10);
    setLStartDate(today);
    setLPaymentDay(1);
    setLPaymentMethod(ldDefaultPaymentMethod || "virement");
    setLAutoQuittance(true);
  };

  const handleEditLease = (l: LeaseRow) => {
    setCreatingLease(true);
    setEditingLeaseId(l.id);

    setLPropertyId(l.property_id);
    setLTenantId(l.tenant_id);
    setLStartDate(l.start_date || "");
    setLEndDate(l.end_date || "");
    setLRentAmount(l.rent_amount != null ? String(l.rent_amount) : "");
    setLChargesAmount(l.charges_amount != null ? String(l.charges_amount) : "");
    setLDepositAmount(l.deposit_amount != null ? String(l.deposit_amount) : "");
    setLPaymentDay(l.payment_day ?? 1);
    setLPaymentMethod(l.payment_method || ldDefaultPaymentMethod || "virement");
    setLAutoQuittance(!!l.auto_quittance_enabled);
    setLTenantReceiptEmail(l.tenant_receipt_email || "");
    setBSub("baux");
  };

  const handleCloseLease = async (l: LeaseRow) => {
    const ok = window.confirm("Clôturer ce bail (fin de location) ?");
    if (!ok) return;

    try {
      setBLoading(true);
      const end = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("leases")
        .update({ end_date: end })
        .eq("id", l.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setBOk("Bail clôturé ✅");
      await loadBailleurDashboard();
    } catch (err: any) {
      setBError(err?.message || "Erreur clôture bail.");
    } finally {
      setBLoading(false);
    }
  };

  const handleSaveLease = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) return;

    setBError(null);
    setBOk(null);

    try {
      setBLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData.session?.user;
      if (!u) throw new Error("Session invalide.");

      if (!lPropertyId) throw new Error("Merci de sélectionner un appartement.");
      if (!lTenantId) throw new Error("Merci de sélectionner un locataire.");
      if (!lStartDate) throw new Error("Merci de renseigner la date de début (start_date).");

      // Empêcher 2 baux actifs sur le même bien (sécurité UX)
      const existingActive = leases.find((x) => x.property_id === lPropertyId && !x.end_date && x.id !== editingLeaseId);
      if (existingActive) {
        throw new Error(
          "Ce bien a déjà un bail actif. Clôturez d’abord le bail actuel avant d’en créer un nouveau."
        );
      }

      const payload: Partial<LeaseRow> = {
        user_id: u.id,
        property_id: lPropertyId,
        tenant_id: lTenantId,
        start_date: lStartDate,
        end_date: lEndDate ? lEndDate : null,

        rent_amount: lRentAmount ? Number(lRentAmount) : null,
        charges_amount: lChargesAmount ? Number(lChargesAmount) : null,
        deposit_amount: lDepositAmount ? Number(lDepositAmount) : null,

        payment_day: clampInt(lPaymentDay, 1, 31, 1),
        payment_method: lPaymentMethod || null,

        auto_quittance_enabled: lAutoQuittance,
        tenant_receipt_email: lTenantReceiptEmail || null,
        timezone: "Europe/Paris",
      };

      if (editingLeaseId) {
        const { error } = await supabase
          .from("leases")
          .update(payload)
          .eq("id", editingLeaseId)
          .eq("user_id", u.id);
        if (error) throw error;
        setBOk("Bail mis à jour ✅");
      } else {
        const { error } = await supabase.from("leases").insert(payload);
        if (error) throw error;
        setBOk("Bail créé ✅");
      }

      resetLeaseForm();
      await loadBailleurDashboard();
      setBSub("baux");
    } catch (err: any) {
      setBError(err?.message || "Erreur lors de l’enregistrement du bail.");
    } finally {
      setBLoading(false);
    }
  };

  // -------------------------
  // Projects delete
  // -------------------------
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
    // petite complétude simple (tu pourras l’améliorer)
    let score = 40;
    if (newsletterOptIn) score += 10;
    if (landlord?.display_name) score += 15;
    if (properties.length > 0) score += 15;
    if (tenants.length > 0) score += 20;
    return Math.min(score, 100);
  }, [isLoggedIn, newsletterOptIn, landlord?.display_name, properties.length, tenants.length]);

  const propertyLabel = (id: string) => {
    const p = properties.find((x) => x.id === id);
    return p?.label || "Bien";
  };
  const tenantLabel = (id: string) => {
    const t = tenants.find((x) => x.id === id);
    return t?.full_name || "Locataire";
  };

  const propertyFullAddress = (p: PropertyRow) => {
    const parts = [
      p.address_line1,
      p.address_line2,
      [p.postal_code, p.city].filter(Boolean).join(" "),
      p.country,
    ].filter(Boolean);
    return parts.join(", ");
  };

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[240px,1fr]">
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
                  <li>Accéder à l’espace bailleur</li>
                  <li>Gérer appartements / locataires / baux</li>
                  <li>Générer des quittances</li>
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
                      Connectez-vous pour accéder au dashboard bailleur.
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
                  Votre compte + accès aux outils bailleur.
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
                      Profil bailleur
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{profileCompletion}%</p>
                    <p className="mt-1 text-xs text-slate-500">Complétude</p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-amber-50/60 px-4 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-[0.75rem] font-semibold text-slate-900">Espace bailleur</p>
                      <p className="text-xs text-slate-700 mt-1">
                        Gérez vos biens, vos locataires, vos baux et vos quittances.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToTab("bailleur")}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Ouvrir l’espace bailleur
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
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
                {/* BAILLEUR DASHBOARD */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div>
                    <p className="uppercase tracking-[0.18em] text-[0.7rem] text-amber-700 mb-1">
                      Dashboard bailleur
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900">Biens • Locataires • Baux</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Ici vous paramétrez tout ce qui est nécessaire pour générer des quittances.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => loadBailleurDashboard()}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      disabled={bLoading}
                    >
                      {bLoading ? "Actualisation…" : "Actualiser"}
                    </button>

                    <Link
                      href="/quittances-loyer"
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Aller aux quittances →
                    </Link>
                  </div>
                </div>

                {bError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {bError}
                  </div>
                )}
                {bOk && (
                  <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {bOk}
                  </div>
                )}

                {/* KPIs */}
                <div className="grid gap-3 sm:grid-cols-4 mb-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Biens</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{properties.length}</p>
                    <p className="text-xs text-slate-500">Appartements / logements</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Locataires</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{tenants.length}</p>
                    <p className="text-xs text-slate-500">Contacts enregistrés</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Baux actifs</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {leases.filter((x) => !x.end_date).length}
                    </p>
                    <p className="text-xs text-slate-500">Locataires en cours</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Auto-envoi</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {landlord?.auto_send_enabled ? "ON" : "OFF"}
                    </p>
                    <p className="text-xs text-slate-500">Règles globales</p>
                  </div>
                </div>

                {/* Sub navigation */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    ["params", "Paramètres bailleur"],
                    ["biens", "Mes appartements"],
                    ["locataires", "Mes locataires"],
                    ["baux", "Mes baux (liaisons)"],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setBSub(k as BailleurSubTab)}
                      className={
                        "rounded-full px-4 py-2 text-xs font-semibold border " +
                        (bSub === k
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* PARAMS */}
                {bSub === "params" && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-2">
                      Paramètres bailleur
                    </p>

                    <form onSubmit={handleSaveLandlord} className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Nom / raison sociale</label>
                          <input
                            type="text"
                            value={ldDisplayName}
                            onChange={(e) => setLdDisplayName(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Lieu d’émission par défaut</label>
                          <input
                            type="text"
                            value={ldDefaultIssuePlace}
                            onChange={(e) => setLdDefaultIssuePlace(e.target.value)}
                            placeholder="Ex: Paris"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Adresse (ligne 1)</label>
                          <input
                            type="text"
                            value={ldAddressLine1}
                            onChange={(e) => setLdAddressLine1(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Adresse (ligne 2)</label>
                          <input
                            type="text"
                            value={ldAddressLine2}
                            onChange={(e) => setLdAddressLine2(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Code postal</label>
                          <input
                            type="text"
                            value={ldPostalCode}
                            onChange={(e) => setLdPostalCode(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Ville</label>
                          <input
                            type="text"
                            value={ldCity}
                            onChange={(e) => setLdCity(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Pays</label>
                          <input
                            type="text"
                            value={ldCountry}
                            onChange={(e) => setLdCountry(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Mode de paiement par défaut</label>
                          <select
                            value={ldDefaultPaymentMethod}
                            onChange={(e) => setLdDefaultPaymentMethod(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="virement">Virement</option>
                            <option value="prelevement">Prélèvement</option>
                            <option value="cheque">Chèque</option>
                            <option value="especes">Espèces</option>
                          </select>
                          <p className="text-[0.7rem] text-slate-500 mt-1">
                            Utilisé par défaut lors de la création de quittances.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Auto-envoi des quittances</label>
                          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={ldAutoSendEnabled}
                              onChange={(e) => setLdAutoSendEnabled(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                            />
                            <span>Activer l’auto-envoi (global)</span>
                          </label>

                          <div className="grid gap-2 sm:grid-cols-3 mt-2">
                            <div className="space-y-1">
                              <label className="text-[0.7rem] text-slate-600">Fréquence</label>
                              <select
                                value={ldAutoSendFrequency}
                                onChange={(e) => setLdAutoSendFrequency(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                              >
                                <option value="monthly">Mensuel</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[0.7rem] text-slate-600">Jour (1–31)</label>
                              <input
                                type="number"
                                min={1}
                                max={31}
                                value={ldAutoSendDay}
                                onChange={(e) => setLdAutoSendDay(clampInt(e.target.value, 1, 31, 1))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[0.7rem] text-slate-600">Heure (0–23)</label>
                              <input
                                type="number"
                                min={0}
                                max={23}
                                value={ldAutoSendHour}
                                onChange={(e) => setLdAutoSendHour(clampInt(e.target.value, 0, 23, 9))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={bLoading}
                        className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
                      >
                        {bLoading ? "Enregistrement…" : "Enregistrer les paramètres"}
                      </button>
                    </form>
                  </section>
                )}

                {/* BIENS */}
                {bSub === "biens" && (
                  <section className="grid gap-4 lg:grid-cols-[1fr,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                            Mes appartements
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            Un bien = une adresse. Le locataire actif est géré via un bail.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => resetPropertyForm()}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          + Nouveau
                        </button>
                      </div>

                      {properties.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                          Aucun bien. Créez votre premier appartement.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {properties.map((p) => {
                            const activeLease = activeLeaseByPropertyId[p.id];
                            return (
                              <div
                                key={p.id}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">
                                      {p.label || "Appartement"}
                                    </p>
                                    <p className="text-xs text-slate-600 mt-1">
                                      {propertyFullAddress(p) || "—"}
                                    </p>
                                    <p className="text-[0.7rem] text-slate-500 mt-1">
                                      Locataire actif :{" "}
                                      <span className="font-semibold text-slate-700">
                                        {activeLease ? tenantLabel(activeLease.tenant_id) : "Aucun"}
                                      </span>
                                    </p>
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleEditProperty(p)}
                                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                                    >
                                      Modifier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteProperty(p)}
                                      className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-[0.7rem] font-semibold text-red-700 hover:bg-red-100"
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-2">
                        {editingPropertyId ? "Modifier un appartement" : "Créer un appartement"}
                      </p>

                      <form onSubmit={handleSaveProperty} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Nom du bien</label>
                          <input
                            type="text"
                            value={pLabel}
                            onChange={(e) => setPLabel(e.target.value)}
                            placeholder="Ex: Studio République"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs text-slate-700">Adresse (ligne 1)</label>
                            <input
                              type="text"
                              value={pLine1}
                              onChange={(e) => setPLine1(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-700">Adresse (ligne 2)</label>
                            <input
                              type="text"
                              value={pLine2}
                              onChange={(e) => setPLine2(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <label className="text-xs text-slate-700">Code postal</label>
                            <input
                              type="text"
                              value={pPostal}
                              onChange={(e) => setPPostal(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-700">Ville</label>
                            <input
                              type="text"
                              value={pCity}
                              onChange={(e) => setPCity(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-700">Pays</label>
                            <input
                              type="text"
                              value={pCountry}
                              onChange={(e) => setPCountry(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={bLoading}
                            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                          >
                            {bLoading ? "Enregistrement…" : editingPropertyId ? "Mettre à jour" : "Créer"}
                          </button>
                          {editingPropertyId && (
                            <button
                              type="button"
                              onClick={() => resetPropertyForm()}
                              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              Annuler
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  </section>
                )}

                {/* LOCATAIRES */}
                {bSub === "locataires" && (
                  <section className="grid gap-4 lg:grid-cols-[1fr,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                            Mes locataires
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            Vous pourrez les associer à un appartement via un bail.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => resetTenantForm()}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          + Nouveau
                        </button>
                      </div>

                      {tenants.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                          Aucun locataire. Ajoutez votre premier locataire.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tenants.map((t) => (
                            <div
                              key={t.id}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 truncate">
                                    {t.full_name || "Locataire"}
                                  </p>
                                  <p className="text-xs text-slate-600 mt-1">
                                    {t.email || "—"} {t.phone ? `• ${t.phone}` : ""}
                                  </p>
                                  {t.notes && (
                                    <p className="text-[0.7rem] text-slate-500 mt-1 line-clamp-2">
                                      {t.notes}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEditTenant(t)}
                                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTenant(t)}
                                    className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-[0.7rem] font-semibold text-red-700 hover:bg-red-100"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-2">
                        {editingTenantId ? "Modifier un locataire" : "Créer un locataire"}
                      </p>

                      <form onSubmit={handleSaveTenant} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Nom complet</label>
                          <input
                            type="text"
                            value={tFullName}
                            onChange={(e) => setTFullName(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs text-slate-700">Email</label>
                            <input
                              type="email"
                              value={tEmail}
                              onChange={(e) => setTEmail(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-700">Téléphone</label>
                            <input
                              type="text"
                              value={tPhone}
                              onChange={(e) => setTPhone(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-700">Notes</label>
                          <textarea
                            rows={3}
                            value={tNotes}
                            onChange={(e) => setTNotes(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={bLoading}
                            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                          >
                            {bLoading ? "Enregistrement…" : editingTenantId ? "Mettre à jour" : "Créer"}
                          </button>
                          {editingTenantId && (
                            <button
                              type="button"
                              onClick={() => resetTenantForm()}
                              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              Annuler
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  </section>
                )}

                {/* BAUX */}
                {bSub === "baux" && (
                  <section className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                            Mes baux
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            Un bail = un couple <span className="font-semibold">Appartement + Locataire</span>.
                            Le bail actif est celui sans date de fin.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenCreateLease}
                          className="rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400"
                        >
                          + Créer un bail
                        </button>
                      </div>

                      {(properties.length === 0 || tenants.length === 0) && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 mb-3">
                          Pour créer un bail, vous devez avoir au moins{" "}
                          <span className="font-semibold">1 bien</span> et{" "}
                          <span className="font-semibold">1 locataire</span>.
                        </div>
                      )}

                      {leases.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                          Aucun bail. Créez un bail pour définir le locataire actif d’un appartement.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {leases.map((l) => {
                            const isActive = !l.end_date;
                            const receiptsCount = receiptCountsByLease[l.id] || 0;

                            return (
                              <div
                                key={l.id}
                                className={
                                  "rounded-xl border px-3 py-3 " +
                                  (isActive ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50")
                                }
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={
                                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold " +
                                          (isActive
                                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                            : "border-slate-200 bg-white text-slate-600")
                                        }
                                      >
                                        {isActive ? "Bail actif" : "Historique"}
                                      </span>
                                      <span className="text-[0.7rem] text-slate-500">
                                        Début : {formatDateFR(l.start_date)}{" "}
                                        {l.end_date ? `• Fin : ${formatDateFR(l.end_date)}` : ""}
                                      </span>
                                    </div>

                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                      {propertyLabel(l.property_id)} — {tenantLabel(l.tenant_id)}
                                    </p>

                                    <p className="mt-1 text-[0.75rem] text-slate-700">
                                      Loyer : <span className="font-semibold">{formatMoney(l.rent_amount)}</span>{" "}
                                      • Charges :{" "}
                                      <span className="font-semibold">{formatMoney(l.charges_amount)}</span>{" "}
                                      • Paiement :{" "}
                                      <span className="font-semibold">
                                        J{l.payment_day ?? 1} ({l.payment_method || "—"})
                                      </span>
                                    </p>

                                    <p className="mt-1 text-[0.7rem] text-slate-500">
                                      Quittances liées :{" "}
                                      <span className="font-semibold text-slate-700">{receiptsCount}</span>{" "}
                                      • Auto-quittance :{" "}
                                      <span className="font-semibold text-slate-700">
                                        {l.auto_quittance_enabled ? "ON" : "OFF"}
                                      </span>
                                    </p>
                                  </div>

                                  <div className="flex gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleEditLease(l)}
                                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                                    >
                                      Modifier
                                    </button>
                                    {isActive && (
                                      <button
                                        type="button"
                                        onClick={() => handleCloseLease(l)}
                                        className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-[0.7rem] font-semibold text-red-700 hover:bg-red-100"
                                      >
                                        Clôturer
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-2">
                        {editingLeaseId ? "Modifier le bail" : "Créer un bail"}
                      </p>

                      {!creatingLease ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                          Cliquez sur <span className="font-semibold">“Créer un bail”</span> pour lier un locataire à un
                          appartement (locataire actif).
                        </div>
                      ) : (
                        <form onSubmit={handleSaveLease} className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs text-slate-700">Appartement</label>
                            <select
                              value={lPropertyId}
                              onChange={(e) => setLPropertyId(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            >
                              <option value="">— Sélectionner —</option>
                              {properties.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label || "Appartement"} — {propertyFullAddress(p)}
                                </option>
                              ))}
                            </select>
                            <p className="text-[0.7rem] text-slate-500 mt-1">
                              Astuce : un bien ne peut avoir qu’un seul bail actif.
                            </p>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs text-slate-700">Locataire</label>
                            <select
                              value={lTenantId}
                              onChange={(e) => setLTenantId(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            >
                              <option value="">— Sélectionner —</option>
                              {tenants.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.full_name || "Locataire"} {t.email ? `(${t.email})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <label className="text-xs text-slate-700">Début de bail *</label>
                              <input
                                type="date"
                                value={lStartDate}
                                onChange={(e) => setLStartDate(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-slate-700">Fin de bail</label>
                              <input
                                type="date"
                                value={lEndDate}
                                onChange={(e) => setLEndDate(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1">
                              <label className="text-xs text-slate-700">Loyer (€)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={lRentAmount}
                                onChange={(e) => setLRentAmount(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-slate-700">Charges (€)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={lChargesAmount}
                                onChange={(e) => setLChargesAmount(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-slate-700">Dépôt (€)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={lDepositAmount}
                                onChange={(e) => setLDepositAmount(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1">
                              <label className="text-xs text-slate-700">Jour paiement (1–31)</label>
                              <input
                                type="number"
                                min={1}
                                max={31}
                                value={lPaymentDay}
                                onChange={(e) => setLPaymentDay(clampInt(e.target.value, 1, 31, 1))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-slate-700">Mode de paiement</label>
                              <select
                                value={lPaymentMethod}
                                onChange={(e) => setLPaymentMethod(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              >
                                <option value="virement">Virement</option>
                                <option value="prelevement">Prélèvement</option>
                                <option value="cheque">Chèque</option>
                                <option value="especes">Espèces</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-slate-700">Email quittance</label>
                              <input
                                type="email"
                                value={lTenantReceiptEmail}
                                onChange={(e) => setLTenantReceiptEmail(e.target.value)}
                                placeholder="(optionnel) destinataire"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={lAutoQuittance}
                              onChange={(e) => setLAutoQuittance(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                            />
                            <span>Activer auto-quittance sur ce bail</span>
                          </label>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="submit"
                              disabled={bLoading}
                              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                              {bLoading ? "Enregistrement…" : editingLeaseId ? "Mettre à jour" : "Créer le bail"}
                            </button>
                            <button
                              type="button"
                              onClick={() => resetLeaseForm()}
                              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              Annuler
                            </button>
                          </div>

                          <p className="text-[0.7rem] text-slate-500">
                            * requis — pour éviter l’erreur <span className="font-semibold">start_date NOT NULL</span>.
                          </p>
                        </form>
                      )}
                    </div>
                  </section>
                )}
              </>
            ) : tab === "securite" ? (
              <>
                {/* SECURITY */}
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-900 mb-1">
                  Sécurité & préférences
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Protégez votre compte</h2>

                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">Changer mon mot de passe</p>
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
                  <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">Newsletter</p>
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
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-900 mb-1">Mes projets</p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Projets sauvegardés</h2>

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
                        <article key={p.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
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
