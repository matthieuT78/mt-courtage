// pages/mon-compte.tsx
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";
import Link from "next/link";

type Mode = "login" | "register";
type Tab = "infos" | "securite";

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

  // Onglet actif (pour l'utilisateur connecté)
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

  // Déduire l'onglet actif (infos / securite) pour l'utilisateur connecté
  useEffect(() => {
    if (!router.isReady) return;
    const tabQuery = router.query.tab as string | undefined;
    if (tabQuery === "securite") {
      setActiveTab("securite");
    } else {
      setActiveTab("infos");
    }
  }, [router.isReady, router.query.tab]);

  // Récupérer l'utilisateur connecté & ses préférences (newsletter)
  useEffect(() => {
    const fetchUser = async () => {
      if (!supabase) {
        setCheckingUser(false);
        return;
      }
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUserEmail(data.user.email ?? null);
        const meta = (data.user as any).user_metadata || {};
        setNewsletterOptIn(!!meta.newsletter_opt_in);
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
        setPwdError(error.message || "Erreur lors de la mise à jour du mot de passe.");
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
                    Tableau de bord & infos
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
                  <Link
                    href="/mon-compte?tab=projets"
                    className="block rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
                  >
                    Mes projets sauvegardés
                  </Link>
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
              <>
                <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                  Profil
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Informations personnelles & accès
                </h2>
                <p className="text-sm text-slate-600 mb-4">
                  Vous êtes connecté avec l&apos;adresse{" "}
                  <span className="font-semibold">{userEmail}</span>. Cette
                  adresse est utilisée pour associer vos projets sauvegardés et
                  pour vous recontacter si nécessaire.
                </p>
                <p className="text-sm text-slate-500">
                  Dans les prochaines évolutions, cet espace permettra de gérer
                  vos informations personnelles plus finement (coordonnées
                  complètes, objectifs patrimoniaux, préférences de contact…)
                  afin de préparer au mieux un accompagnement sur-mesure.
                </p>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700 mb-1">
                    Astuce
                  </p>
                  <p>
                    Rendez-vous dans l&apos;onglet{" "}
                    <span className="font-semibold">
                      “Sécurité &amp; préférences”
                    </span>{" "}
                    pour mettre à jour votre mot de passe et vos préférences
                    de newsletter.
                  </p>
                </div>
              </>
            ) : (
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
