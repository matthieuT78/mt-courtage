// pages/mon-compte.tsx
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";
import Link from "next/link";
import ProjectsPanel from "../components/ProjectsPanel";

type Mode = "login" | "register";
type AccountTab = "infos" | "projets" | "securite";

export default function MonComptePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [activeTab, setActiveTab] = useState<AccountTab>("infos");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);

  // Déduire le mode depuis l'URL (login / register)
  useEffect(() => {
    if (!router.isReady) return;
    const modeQuery = router.query.mode as string | undefined;
    if (modeQuery === "register") {
      setMode("register");
    } else {
      setMode("login");
    }
  }, [router.isReady, router.query.mode]);

  // Déduire l'onglet actif depuis l'URL (?tab=...)
  useEffect(() => {
    if (!router.isReady) return;
    const tabQuery = router.query.tab as string | undefined;
    if (tabQuery === "projets" || tabQuery === "securite" || tabQuery === "infos") {
      setActiveTab(tabQuery);
    } else {
      setActiveTab("infos");
    }
  }, [router.isReady, router.query.tab]);

  // Récupérer l'utilisateur connecté
  useEffect(() => {
    const fetchUser = async () => {
      if (!supabase) {
        setCheckingUser(false);
        return;
      }
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUserEmail(data.user.email ?? null);
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

  const goToTab = (tab: AccountTab) => {
    setActiveTab(tab);
    router.push(
      {
        pathname: "/mon-compte",
        query: { ...router.query, tab },
      },
      undefined,
      { shallow: true }
    );
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
                    className={`w-full text-left rounded-lg px-3 py-2 ${
                      activeTab === "infos"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => goToTab("infos")}
                  >
                    Informations personnelles
                  </button>
                  <button
                    type="button"
                    className={`w-full text-left rounded-lg px-3 py-2 ${
                      activeTab === "projets"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => goToTab("projets")}
                  >
                    Mes projets sauvegardés
                  </button>
                  <button
                    type="button"
                    className={`w-full text-left rounded-lg px-3 py-2 ${
                      activeTab === "securite"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => goToTab("securite")}
                  >
                    Sécurité & mot de passe
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
                        (capacité d&apos;emprunt, investissement, parc
                        immobilier) et de les retrouver plus tard.
                      </p>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <>
                {activeTab === "infos" && (
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
                      adresse est utilisée pour associer vos projets sauvegardés
                      et pour vous recontacter si nécessaire.
                    </p>
                    <p className="text-sm text-slate-500">
                      Dans les prochaines évolutions, cet espace permettra de
                      gérer vos informations personnelles plus finement
                      (coordonnées complètes, objectifs patrimoniaux,
                      préférences de contact…) afin de préparer au mieux un
                      accompagnement sur-mesure.
                    </p>
                  </>
                )}

                {activeTab === "projets" && <ProjectsPanel />}

                {activeTab === "securite" && (
                  <>
                    <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-600 mb-1">
                      Sécurité
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">
                      Sécurité & mot de passe
                    </h2>
                    <p className="text-sm text-slate-600 mb-3">
                      La gestion avancée du mot de passe (réinitialisation,
                      changement depuis l&apos;interface) sera intégrée dans une
                      prochaine version.
                    </p>
                    <p className="text-sm text-slate-500 mb-2">
                      En attendant, si vous avez oublié votre mot de passe,
                      utilisez la fonction{" "}
                      <span className="font-semibold">“mot de passe oublié”</span>{" "}
                      proposée par votre fournisseur d&apos;authentification ou
                      contactez directement MT Courtage pour être accompagné.
                    </p>
                    <p className="text-xs text-slate-400">
                      Pensez à utiliser un mot de passe unique, suffisamment
                      long, et idéalement stocké dans un gestionnaire de mots de
                      passe.
                    </p>
                  </>
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
