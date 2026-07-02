// pages/mon-compte/index.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import AccountLayout from "../../components/account/AccountLayout";
import PostalCodeCityFields from "../../components/forms/PostalCodeCityFields";
import { StorageUsagePanel } from "../../components/account/StorageUsagePanel";
import { supabase } from "../../lib/supabaseClient";
import { signOutAll } from "../../lib/authUtils";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useProfile } from "../../hooks/useProfile";
import { usePermissions } from "../../components/PermissionProvider";

type Mode = "login" | "register";
type Role = "bailleur" | "locataire";

/**
 * ✅ On autorise un redirect UNIQUEMENT si c'est un chemin interne
 * Mais par défaut → HOME
 */
const safeRedirect = (raw: unknown) => {
  const v = typeof raw === "string" ? raw : "";
  if (!v) return "/";
  if (!v.startsWith("/")) return "/";
  // évite les boucles vers /mon-compte (index)
  if (v === "/mon-compte") return "/";
  return v;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function authRedirectUrl(redirectPath: string) {
  if (typeof window === "undefined") return undefined;
  const url = new URL("/mon-compte", window.location.origin);
  url.searchParams.set("mode", "login");
  const safePath = safeRedirect(redirectPath);
  if (safePath !== "/") url.searchParams.set("redirect", safePath);
  return url.toString();
}

async function checkEmailAlreadyExists(email: string) {
  const response = await fetch("/api/auth/check-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Impossible de vérifier cette adresse e-mail.");
  return !!payload?.exists;
}

export default function MonCompteIndexPage() {
  const router = useRouter();
  const { checking, user, isLoggedIn } = useAuthUser();
  const { loading: profileLoading, profile } = useProfile(user?.id ?? null);
  const { loading: permissionsLoading, plan, maxActiveProperties } = usePermissions();
  const [propertyCount, setPropertyCount] = useState<number | null>(null);

  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("bailleur");
  const [redirectPath, setRedirectPath] = useState<string>("/");

  // login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // register (auth)
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");

  // register (profile)
  const [civility, setCivility] = useState<string>("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");

  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("FR");

  const [billingSame, setBillingSame] = useState(true);
  const [billAddress1, setBillAddress1] = useState("");
  const [billAddress2, setBillAddress2] = useState("");
  const [billPostalCode, setBillPostalCode] = useState("");
  const [billCity, setBillCity] = useState("");
  const [billCountry, setBillCountry] = useState("FR");

  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [refCode, setRefCode] = useState("");

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  // lire query param
  useEffect(() => {
    if (!router.isReady) return;
    const m = router.query.mode as string | undefined;
    setMode(m === "register" ? "register" : "login");
    setRedirectPath(safeRedirect(router.query.redirect));
  }, [router.isReady, router.query.mode, router.query.redirect]);

  // Pré-remplir le code parrainage depuis localStorage (capturé par _app.tsx via ?ref=)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("lokt:ref") || "";
      if (stored) setRefCode(stored);
    } catch {}
  }, []);

  // Si une page a explicitement demandé un redirect, on l'honore. Sinon /mon-compte devient la vue d'ensemble.
  // (Le cas redirectPath === "/" sans login explicite reste la vue compte connecté — pas de redirect auto.)
  useEffect(() => {
    if (!router.isReady) return;
    if (checking) return;
    if (isLoggedIn && redirectPath !== "/") {
      router.replace(redirectPath);
    }
  }, [checking, isLoggedIn, redirectPath, router, router.isReady]);

  useEffect(() => {
    const load = async () => {
      if (!supabase || !user?.id) return;
      const { data } = await supabase.from("properties").select("id,status").eq("user_id", user.id);
      const activeCount = (data ?? []).filter((property: any) => (property?.status || "").toLowerCase() !== "archived").length;
      setPropertyCount(activeCount);
    };
    load();
  }, [user?.id]);

  const forgotPwdHref = useMemo(() => `/mon-compte/securite?mode=forgot`, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);

    if (!supabase) return setAuthError("Auth indisponible.");

    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (error) {
        setAuthError(error.message || "Erreur de connexion.");
        return;
      }

      // Après login : honore le redirect explicite, sinon va vers l'espace bailleur
      router.replace(redirectPath !== "/" ? redirectPath : "/espace-bailleur");
    } finally {
      setAuthLoading(false);
    }
  };

  const upsertProfileForUser = async (userId: string) => {
    if (!supabase) throw new Error("Supabase indisponible.");

    // Code de parrainage déterministe basé sur l'UUID
    const referralCode = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
    // Code parrain : champ du formulaire en priorité, sinon localStorage
    const refInput = refCode.trim().toUpperCase();
    let referredBy: string | null = null;
    try {
      const stored = localStorage.getItem("lokt:ref") || "";
      const candidate = refInput || stored;
      if (candidate && candidate !== referralCode) referredBy = candidate;
      localStorage.removeItem("lokt:ref");
    } catch {}

    const payload: any = {
      id: userId,
      email: normalizeEmail(regEmail) || null,
      referral_code: referralCode,
      ...(referredBy ? { referred_by: referredBy } : {}),
      civility: civility || null,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      full_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || null,
      phone: phone.trim() || null,
      birth_date: birthDate ? birthDate : null,

      address_line1: address1.trim() || null,
      address_line2: address2.trim() || null,
      postal_code: postalCode.trim() || null,
      city: city.trim() || null,
      country: (country || "FR").trim() || "FR",

      billing_same_as_main: !!billingSame,
      billing_address_line1: billingSame ? null : (billAddress1.trim() || null),
      billing_address_line2: billingSame ? null : (billAddress2.trim() || null),
      billing_postal_code: billingSame ? null : (billPostalCode.trim() || null),
      billing_city: billingSame ? null : (billCity.trim() || null),
      billing_country: billingSame ? "FR" : ((billCountry || "FR").trim() || "FR"),

      marketing_opt_in: !!marketingOptIn,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) throw error;
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);

    if (!supabase) return setAuthError("Auth indisponible.");

    const email = normalizeEmail(regEmail);
    if (!email) return setAuthError("Merci de renseigner un e-mail.");
    if (!isEmailLike(email)) return setAuthError("Merci de renseigner une adresse e-mail valide.");
    if (!regPassword) return setAuthError("Merci de renseigner un mot de passe.");
    if (regPassword.length < 8) return setAuthError("Le mot de passe doit contenir au moins 8 caractères.");
    if (regPassword !== regPassword2) return setAuthError("Les mots de passe ne correspondent pas.");
    if (!firstName.trim() || !lastName.trim()) return setAuthError("Merci de renseigner votre prénom et votre nom.");
    if (!address1.trim() || !postalCode.trim() || !city.trim()) {
      return setAuthError("Merci de renseigner l’adresse du propriétaire : elle sert à préremplir les quittances et documents.");
    }
    if (!billingSame) {
      if (!billAddress1.trim() || !billPostalCode.trim() || !billCity.trim()) {
        return setAuthError("Merci de renseigner l’adresse de facturation ou coche “identique”.");
      }
    }

    setAuthLoading(true);
    try {
      const emailAlreadyExists = await checkEmailAlreadyExists(email);
      if (emailAlreadyExists) {
        setAuthError(
          "Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou utilisez “Mot de passe oublié” si besoin."
        );
        setLoginEmail(email);
        setMode("login");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: regPassword,
        options: {
          emailRedirectTo: authRedirectUrl(redirectPath),
          data: {
            full_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
        },
      });

      if (error) {
        const msg = error.message || "Erreur inscription.";
        if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
          setAuthError(
            "Vous avez déjà un compte avec cette adresse e-mail. Merci de vous connecter. Si vous avez oublié votre mot de passe, utilisez “Mot de passe oublié”."
          );
          return;
        }
        setAuthError(msg);
        return;
      }

      const newUserId = data.user?.id;
      if (newUserId) {
        try {
          await upsertProfileForUser(newUserId);
        } catch (e: any) {
          console.warn("[register] profile upsert failed:", e?.message || e);
        }
      }

      if (data.session?.user?.id) {
        router.replace(redirectPath || "/espace-bailleur");
        return;
      }

      setAuthInfo("Compte créé ✅ Vérifiez vos e-mails si la confirmation est activée, puis connectez-vous pour créer votre premier logement gratuit.");
      setMode("login");
      setLoginEmail(email);
      setLoginPassword("");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOutAll();
  };

  const planLabel =
    plan === "landlord_5"
      ? "lokt·one"
      : plan === "landlord_15"
      ? "lokt·plus"
      : plan === "landlord_unlimited"
      ? "Pro / agence"
      : plan === "calc_full"
      ? "Gratuit"
      : "Non connecté";

  const profileCompletion = useMemo(() => {
    const checks = [
      !!profile?.first_name,
      !!profile?.last_name,
      !!profile?.address_line1,
      !!profile?.postal_code,
      !!profile?.city,
      !!profile?.country,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  const renderConnectedOverview = () => {
    const activeCountLabel = propertyCount === null ? "…" : `${propertyCount}`;
    const includedLabel =
      permissionsLoading ? "…" : maxActiveProperties >= 999999 ? "Illimité" : `${maxActiveProperties}`;
    const profileReady = profileCompletion >= 80;

    return (
      <AccountLayout userEmail={user?.email ?? null} active="overview" onLogout={handleLogout}>
        <div className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sky-700">Mon compte</p>
            <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-950">Vue d’ensemble</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Retrouvez l’état de votre compte, votre offre et les raccourcis utiles pour gérer vos logements.
                </p>
              </div>
              <Link href="/espace-bailleur" className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Accéder à l’espace bailleur
              </Link>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Offre actuelle</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{permissionsLoading ? "…" : planLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{includedLabel} logement(s) actif(s) inclus.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Logements actifs</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{activeCountLabel}</p>
              <p className="mt-1 text-xs text-slate-500">Les logements archivés ne comptent pas.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Profil document</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{profileLoading ? "…" : `${profileCompletion}%`}</p>
              <p className="mt-1 text-xs text-slate-500">Adresse utilisée pour quittances et documents.</p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">À faire pour un compte prêt à l’usage</p>
              <div className="mt-4 space-y-3">
                {[
                  {
                    ok: profileReady,
                    title: "Compléter les informations bailleur",
                    desc: "Nom et adresse alimentent les quittances, états des lieux et documents.",
                    href: "/mon-compte/profil",
                  },
                  {
                    ok: (propertyCount ?? 0) > 0,
                    title: "Créer au moins un logement",
                    desc: "Le premier logement actif est inclus gratuitement.",
                    href: "/espace-bailleur?section=biens",
                  },
                  {
                    ok: plan !== "calc_full",
                    title: "Choisir une automatisation si besoin",
                    desc: "Emails, rappels et aide déclaration sont dans les offres payantes.",
                    href: "/mon-compte/abonnement",
                  },
                ].map((item) => (
                  <Link key={item.title} href={item.href} className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-white">
                    <div className="flex gap-3">
                      <span className={(item.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800") + " flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"}>
                        {item.ok ? "✓" : "!"}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.desc}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Raccourcis</p>
              <div className="mt-4 grid gap-2">
                <Link href="/mon-compte/profil" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Modifier mes informations
                </Link>
                <Link href="/mon-compte/abonnement" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Gérer mon abonnement
                </Link>
                <Link href="/mon-compte/securite" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Sécurité et préférences
                </Link>
              </div>
            </div>
          </section>
          <StorageUsagePanel />
        </div>
      </AccountLayout>
    );
  };

  return (
    isLoggedIn && redirectPath === "/" ? (
      renderConnectedOverview()
    ) : (
    <div className="min-h-screen bg-slate-100">
      <Head>
          <title>{`${mode === "register" ? "Inscription" : "Connexion"} | lokt.fr`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AppHeader />
      <div className="h-1 w-full bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400" />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {checking || isLoggedIn ? (
          <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-500">
            Chargement…
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              {/* Toggle Bailleur / Locataire */}
              <div className="mb-5 flex items-center gap-2 rounded-full bg-slate-100 p-1 text-xs w-fit">
                <button
                  type="button"
                  onClick={() => setRole("bailleur")}
                  className={cx(
                    "rounded-full px-4 py-1.5 font-semibold transition",
                    role === "bailleur" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Bailleur
                </button>
                <button
                  type="button"
                  onClick={() => setRole("locataire")}
                  className={cx(
                    "rounded-full px-4 py-1.5 font-semibold transition",
                    role === "locataire" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Locataire
                </button>
              </div>

              {role === "locataire" ? (
                <div className="py-4">
                  <h1 className="text-lg font-semibold text-slate-900">Espace locataire</h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Votre espace locataire est accessible depuis le lien envoyé par votre bailleur, ou directement depuis la page de connexion locataire.
                  </p>
                  <Link
                    href="/espace-locataire/connexion"
                    className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition"
                  >
                    Acceder a mon espace locataire
                  </Link>
                </div>
              ) : (
              <>
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="uppercase tracking-[0.18em] text-[0.7rem] text-sky-700 mb-1">Accès bailleur</p>
                  <h1 className="text-lg font-semibold text-slate-900">
                    {mode === "login" ? "Connexion" : "Créer un compte"}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {mode === "login"
                      ? "Connectez-vous pour accéder à lokt.fr."
                      : "Créez votre accès gratuit. L’adresse du propriétaire préremplit vos quittances et documents."}
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={cx(
                      "rounded-full px-3 py-1.5 font-semibold",
                      mode === "login" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Connexion
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className={cx(
                      "rounded-full px-3 py-1.5 font-semibold",
                      mode === "register" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Inscription
                  </button>
                </div>
              </div>

              {authError ? (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {authError}
                  {authError.toLowerCase().includes("déjà un compte") ? (
                    <div className="mt-2">
                      <a href={forgotPwdHref} className="underline font-semibold">
                        Mot de passe oublié ?
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {authInfo ? (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {authInfo}
                </div>
              ) : null}

              {mode === "login" ? (
                <form onSubmit={handleLogin} className="space-y-3" autoComplete="on">
                  <div className="space-y-1">
                    <label htmlFor="login_email" className="text-xs text-slate-700">
                      Adresse e-mail
                    </label>
                    <input
                      id="login_email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="login_password" className="text-xs text-slate-700">
                      Mot de passe
                    </label>
                    <input
                      id="login_password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {authLoading ? "Connexion..." : "Se connecter"}
                    </button>

                    <a href={forgotPwdHref} className="text-xs text-slate-600 underline">
                      Mot de passe oublié ?
                    </a>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-5" autoComplete="on">
                  {/* Identité */}
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-900">Identité</p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label htmlFor="reg_civility" className="text-xs text-slate-700">
                          Civilité
                        </label>
                        <select
                          id="reg_civility"
                          name="civility"
                          value={civility}
                          onChange={(e) => setCivility(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">—</option>
                          <option value="M.">M.</option>
                          <option value="Mme">Mme</option>
                          <option value="Mx">Mx</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="reg_first_name" className="text-xs text-slate-700">
                          Prénom *
                        </label>
                        <input
                          id="reg_first_name"
                          name="first_name"
                          autoComplete="given-name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="reg_last_name" className="text-xs text-slate-700">
                          Nom *
                        </label>
                        <input
                          id="reg_last_name"
                          name="last_name"
                          autoComplete="family-name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="reg_birth_date" className="text-xs text-slate-700">
                          Date de naissance
                        </label>
                        <input
                          id="reg_birth_date"
                          name="birth_date"
                          type="date"
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="reg_phone" className="text-xs text-slate-700">
                          Téléphone
                        </label>
                        <input
                          id="reg_phone"
                          name="phone"
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Adresse */}
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-900">Adresse du propriétaire</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Utilisée pour préremplir vos quittances, états des lieux et documents bailleur. Vous pourrez la modifier à tout moment.
                    </p>

                    <div className="mt-3 space-y-1">
                      <label htmlFor="reg_address1" className="text-xs text-slate-700">
                        Adresse (ligne 1) *
                      </label>
                      <input
                        id="reg_address1"
                        name="address_line1"
                        autoComplete="address-line1"
                        value={address1}
                        onChange={(e) => setAddress1(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="mt-3 space-y-1">
                      <label htmlFor="reg_address2" className="text-xs text-slate-700">
                        Adresse (ligne 2)
                      </label>
                      <input
                        id="reg_address2"
                        name="address_line2"
                        autoComplete="address-line2"
                        value={address2}
                        onChange={(e) => setAddress2(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <PostalCodeCityFields
                      idPrefix="reg"
                      postalCode={postalCode}
                      city={city}
                      onPostalCodeChange={setPostalCode}
                      onCityChange={setCity}
                    />

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="reg_country" className="text-xs text-slate-700">
                          Pays
                        </label>
                        <input
                          id="reg_country"
                          name="country"
                          autoComplete="country"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <label className="mt-6 inline-flex items-center gap-2 text-sm text-slate-800">
                        <input
                          id="reg_bill_same"
                          name="billing_same_as_main"
                          type="checkbox"
                          checked={billingSame}
                          onChange={(e) => setBillingSame(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span>Adresse de facturation identique</span>
                      </label>
                    </div>

                    {!billingSame ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold text-slate-900">Adresse de facturation</p>

                        <div className="mt-3 space-y-1">
                          <label htmlFor="bill_address1" className="text-xs text-slate-700">
                            Adresse (ligne 1) *
                          </label>
                          <input
                            id="bill_address1"
                            name="billing_address_line1"
                            value={billAddress1}
                            onChange={(e) => setBillAddress1(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="mt-3 space-y-1">
                          <label htmlFor="bill_address2" className="text-xs text-slate-700">
                            Adresse (ligne 2)
                          </label>
                          <input
                            id="bill_address2"
                            name="billing_address_line2"
                            value={billAddress2}
                            onChange={(e) => setBillAddress2(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>

                        <PostalCodeCityFields
                          idPrefix="bill"
                          postalCode={billPostalCode}
                          city={billCity}
                          postalCodeName="billing_postal_code"
                          cityName="billing_city"
                          onPostalCodeChange={setBillPostalCode}
                          onCityChange={setBillCity}
                        />

                        <div className="mt-3 space-y-1">
                          <label htmlFor="bill_country" className="text-xs text-slate-700">
                            Pays
                          </label>
                          <input
                            id="bill_country"
                            name="billing_country"
                            value={billCountry}
                            onChange={(e) => setBillCountry(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    ) : null}
                  </section>

                  {/* Compte */}
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-900">Compte</p>

                    <div className="mt-3 space-y-1">
                      <label htmlFor="reg_email" className="text-xs text-slate-700">
                        Adresse e-mail *
                      </label>
                      <input
                        id="reg_email"
                        name="reg_email"
                        type="email"
                        autoComplete="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="reg_password" className="text-xs text-slate-700">
                          Mot de passe *
                        </label>
                        <input
                          id="reg_password"
                          name="reg_password"
                          type="password"
                          autoComplete="new-password"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="reg_password2" className="text-xs text-slate-700">
                          Confirmer *
                        </label>
                        <input
                          id="reg_password2"
                          name="reg_password2"
                          type="password"
                          autoComplete="new-password"
                          value={regPassword2}
                          onChange={(e) => setRegPassword2(e.target.value)}
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <label htmlFor="reg_ref_code" className="text-xs text-slate-700">
                        Code de parrainage{" "}
                        <span className="text-slate-400">(optionnel)</span>
                      </label>
                      <input
                        id="reg_ref_code"
                        name="ref_code"
                        type="text"
                        value={refCode}
                        onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                        placeholder="Ex : AB12CD34"
                        maxLength={12}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400"
                      />
                      {refCode ? (
                        <p className="text-xs text-emerald-600">Code de parrainage appliqué — vous bénéficierez de 3 mois à −50 % après souscription.</p>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      <label className="inline-flex items-start gap-2 text-sm text-slate-800">
                        <input
                          id="reg_marketing"
                          name="marketing_opt_in"
                          type="checkbox"
                          checked={marketingOptIn}
                          onChange={(e) => setMarketingOptIn(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <span>Je souhaite recevoir des e-mails de lokt.fr.</span>
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {authLoading ? "Création..." : "Créer mon compte"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        J’ai déjà un compte
                      </button>
                    </div>
                  </section>
                </form>
              )}
              </>
              )} {/* end role */}
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
    )
  );
}
