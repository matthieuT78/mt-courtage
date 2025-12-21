// pages/mon-compte/index.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import { supabase } from "../../lib/supabaseClient";
import { useAuthUser } from "../../hooks/useAuthUser";

type Mode = "login" | "register";

const safeRedirect = (raw: unknown) => {
  const v = typeof raw === "string" ? raw : "";
  // par défaut → Profil
  if (!v) return "/mon-compte/profil";
  if (!v.startsWith("/")) return "/mon-compte/profil";
  // si on t'envoie vers /mon-compte → profil
  if (v === "/mon-compte") return "/mon-compte/profil";
  return v;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function MonCompteIndexPage() {
  const router = useRouter();
  const { checking, user, isLoggedIn } = useAuthUser();

  const [mode, setMode] = useState<Mode>("login");
  const [redirectPath, setRedirectPath] = useState<string>("/mon-compte/profil");

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

  // ✅ si connecté : redirection immédiate vers la section par défaut
  useEffect(() => {
    if (checking) return;
    if (isLoggedIn) {
      router.replace("/mon-compte/profil");
    }
  }, [checking, isLoggedIn, router]);

  const forgotPwdHref = useMemo(
    () => `/mon-compte/securite?mode=forgot&redirect=${encodeURIComponent(redirectPath)}`,
    [redirectPath]
  );

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

      // après login → profil par défaut (ou redirect si fourni)
      router.replace(redirectPath || "/mon-compte/profil");
    } finally {
      setAuthLoading(false);
    }
  };

  const upsertProfileForUser = async (userId: string) => {
    if (!supabase) throw new Error("Supabase indisponible.");

    const payload: any = {
      id: userId,
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

    const email = regEmail.trim();
    if (!email) return setAuthError("Merci de renseigner un e-mail.");
    if (!regPassword) return setAuthError("Merci de renseigner un mot de passe.");
    if (regPassword !== regPassword2) return setAuthError("Les mots de passe ne correspondent pas.");
    if (!firstName.trim() || !lastName.trim()) return setAuthError("Merci de renseigner votre prénom et votre nom.");
    if (!address1.trim() || !postalCode.trim() || !city.trim()) {
      return setAuthError("Merci de renseigner votre adresse principale (ligne 1, code postal, ville).");
    }
    if (!billingSame) {
      if (!billAddress1.trim() || !billPostalCode.trim() || !billCity.trim()) {
        return setAuthError("Merci de renseigner l’adresse de facturation ou coche “identique”.");
      }
    }

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: regPassword,
        options: {
          data: {
            full_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
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

      setAuthInfo("Compte créé ✅ Vérifiez vos e-mails si la confirmation est activée, puis connectez-vous.");
      setMode("login");
      setLoginEmail(email);
      setLoginPassword("");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
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
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="uppercase tracking-[0.18em] text-[0.7rem] text-sky-700 mb-1">Accès</p>
                  <h1 className="text-lg font-semibold text-slate-900">
                    {mode === "login" ? "Connexion" : "Créer un compte"}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {mode === "login" ? "Connectez-vous pour accéder à votre espace." : "Créez votre compte Izimo."}
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
                    <label htmlFor="login_email" className="text-xs text-slate-700">Adresse e-mail</label>
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
                    <label htmlFor="login_password" className="text-xs text-slate-700">Mot de passe</label>
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
                        <label htmlFor="reg_civility" className="text-xs text-slate-700">Civilité</label>
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
                        <label htmlFor="reg_first_name" className="text-xs text-slate-700">Prénom *</label>
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
                        <label htmlFor="reg_last_name" className="text-xs text-slate-700">Nom *</label>
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
                        <label htmlFor="reg_birth_date" className="text-xs text-slate-700">Date de naissance</label>
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
                        <label htmlFor="reg_phone" className="text-xs text-slate-700">Téléphone</label>
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
                    <p className="text-xs font-semibold text-slate-900">Adresse</p>

                    <div className="mt-3 space-y-1">
                      <label htmlFor="reg_address1" className="text-xs text-slate-700">Adresse (ligne 1) *</label>
                      <input
                        id="reg_address1"
                        name="address_line1"
                        autoComplete="address-line1"
                        value={address1}
                        onChange={(e) => setAddress1(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="mt-3 space-y-1">
                      <label htmlFor="reg_address2" className="text-xs text-slate-700">Adresse (ligne 2)</label>
                      <input
                        id="reg_address2"
                        name="address_line2"
                        autoComplete="address-line2"
                        value={address2}
                        onChange={(e) => setAddress2(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label htmlFor="reg_postal" className="text-xs text-slate-700">Code postal *</label>
                        <input
                          id="reg_postal"
                          name="postal_code"
                          autoComplete="postal-code"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label htmlFor="reg_city" className="text-xs text-slate-700">Ville *</label>
                        <input
                          id="reg_city"
                          name="city"
                          autoComplete="address-level2"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="reg_country" className="text-xs text-slate-700">Pays</label>
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
                          <label htmlFor="bill_address1" className="text-xs text-slate-700">Adresse (ligne 1) *</label>
                          <input
                            id="bill_address1"
                            name="billing_address_line1"
                            value={billAddress1}
                            onChange={(e) => setBillAddress1(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="mt-3 space-y-1">
                          <label htmlFor="bill_address2" className="text-xs text-slate-700">Adresse (ligne 2)</label>
                          <input
                            id="bill_address2"
                            name="billing_address_line2"
                            value={billAddress2}
                            onChange={(e) => setBillAddress2(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <label htmlFor="bill_postal" className="text-xs text-slate-700">Code postal *</label>
                            <input
                              id="bill_postal"
                              name="billing_postal_code"
                              value={billPostalCode}
                              onChange={(e) => setBillPostalCode(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>

                          <div className="space-y-1 sm:col-span-2">
                            <label htmlFor="bill_city" className="text-xs text-slate-700">Ville *</label>
                            <input
                              id="bill_city"
                              name="billing_city"
                              value={billCity}
                              onChange={(e) => setBillCity(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                        </div>

                        <div className="mt-3 space-y-1">
                          <label htmlFor="bill_country" className="text-xs text-slate-700">Pays</label>
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
                      <label htmlFor="reg_email" className="text-xs text-slate-700">Adresse e-mail *</label>
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
                        <label htmlFor="reg_password" className="text-xs text-slate-700">Mot de passe *</label>
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
                        <label htmlFor="reg_password2" className="text-xs text-slate-700">Confirmer *</label>
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
                        <span>Je souhaite recevoir des e-mails d’Izimo.</span>
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
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
