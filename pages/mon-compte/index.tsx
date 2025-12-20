// pages/mon-compte/index.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AccountLayout from "../../components/account/AccountLayout";
import { supabase } from "../../lib/supabaseClient";

type Mode = "login" | "register";

const safeRedirect = (raw: unknown) => {
  const v = typeof raw === "string" ? raw : "";
  return v.startsWith("/") ? v : "/mon-compte";
};

export default function MonCompteHomePage() {
  const router = useRouter();

  // éviter mismatch SSR/CSR : on ne lit pas router.query au 1er rendu
  const [mode, setMode] = useState<Mode>("login");
  const [redirectPath, setRedirectPath] = useState<string>("/mon-compte");
  const [routerReady, setRouterReady] = useState(false);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  const [checkingUser, setCheckingUser] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [projectsCountLoading, setProjectsCountLoading] = useState(false);

  const isLoggedIn = !!user?.id;

  // lire query seulement quand router prêt
  useEffect(() => {
    if (!router.isReady) return;

    setRouterReady(true);

    const m = router.query.mode as string | undefined;
    setMode(m === "register" ? "register" : "login");

    setRedirectPath(safeRedirect(router.query.redirect));
  }, [router.isReady, router.query.mode, router.query.redirect]);

  const redirectAfterAuth = () => {
    router.replace(redirectPath);
  };

  const refreshProjectsCount = async (u: any | null) => {
    if (!supabase || !u?.id) {
      setProjectsCount(null);
      return;
    }

    try {
      setProjectsCountLoading(true);
      const { count, error } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.id);

      if (error) throw error;
      setProjectsCount(count ?? 0);
    } catch {
      setProjectsCount(null);
    } finally {
      setProjectsCountLoading(false);
    }
  };

  // bootstrap auth + sync temps réel
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        if (!supabase) {
          if (!mounted) return;
          setUser(null);
          setCheckingUser(false);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        const u = data.session?.user ?? null;
        setUser(u);
        setCheckingUser(false);
        refreshProjectsCount(u);

        const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
          if (!mounted) return;
          const nextUser = session?.user ?? null;
          setUser(nextUser);
          setCheckingUser(false);
          refreshProjectsCount(nextUser);
        });

        unsubscribe = () => sub.subscription.unsubscribe();
      } catch {
        if (!mounted) return;
        setUser(null);
        setCheckingUser(false);
      }
    };

    init();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase?.auth.signOut();
    } finally {
      // IMPORTANT : on sort vers l’accueil, pas vers un redirect “protégé”
      router.replace("/");
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);

    if (!supabase) return setAuthError("Auth indisponible.");

    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (error) setAuthError(error.message || "Erreur de connexion.");
      else redirectAfterAuth();
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);

    if (!supabase) return setAuthError("Auth indisponible.");
    if (!authEmail || !authPassword) return setAuthError("Merci de renseigner un e-mail et un mot de passe.");
    if (authPassword !== authPassword2) return setAuthError("Les mots de passe ne correspondent pas.");

    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });

      if (error) setAuthError(error.message || "Erreur inscription.");
      else {
        setAuthInfo("Compte créé. Vérifiez vos e-mails puis connectez-vous.");
        setMode("login");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const landlordActive = useMemo(() => {
    const meta = user?.user_metadata || {};
    return !!meta.is_landlord;
  }, [user]);

  return (
    <AccountLayout userEmail={user?.email ?? null} active="dashboard" onLogout={handleLogout}>
      {checkingUser ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : !isLoggedIn ? (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">
                Accès à votre espace
              </p>
              <h1 className="text-lg font-semibold text-slate-900">
                {mode === "login" ? "Connexion" : "Créer un compte"}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Vous pourrez ensuite accéder à vos outils (quittances, projets, etc.).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">Mot de passe</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
                  <span className="font-semibold">{routerReady ? redirectPath : "/mon-compte"}</span>
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Confirmer</label>
                  <input
                    type="password"
                    value={authPassword2}
                    onChange={(e) => setAuthPassword2(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
      ) : (
        <>
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Mon compte</p>
          <h1 className="text-lg font-semibold text-slate-900">Vue d’ensemble</h1>
          <p className="text-sm text-slate-600 mt-1 mb-4">
            Accès rapide à l’espace bailleur, aux quittances et à vos projets sauvegardés.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Compte</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Actif</p>
              <p className="mt-1 text-xs text-slate-500 break-all">{user.email}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Projets</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {projectsCountLoading ? "…" : projectsCount ?? "—"}
              </p>
              <Link href="/mon-compte/projets" className="mt-1 inline-block text-xs text-slate-600 underline">
                Voir mes projets
              </Link>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Bailleur</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {landlordActive ? "Activé" : "Non activé"}
              </p>
              <Link href="/mon-compte/bailleur" className="mt-1 inline-block text-xs text-slate-600 underline">
                Ouvrir
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/quittances-loyer"
              className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400"
            >
              Quittances de loyer
            </Link>
            <Link
              href="/outils-proprietaire"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Outils propriétaire
            </Link>
            <Link
              href="/capacite"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Nouvelle simulation capacité
            </Link>
          </div>
        </>
      )}
    </AccountLayout>
  );
}
