// pages/mon-compte/index.tsx
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import AccountLayout from "../../components/account/AccountLayout";
import { supabase } from "../../lib/supabaseClient";
import { useAuthUser } from "../../hooks/useAuthUser";

type Mode = "login" | "register";

const safeRedirect = (raw: unknown) => {
  const v = typeof raw === "string" ? raw : "";
  return v.startsWith("/") ? v : "/mon-compte";
};

export default function MonCompteHomePage() {
  const router = useRouter();
  const { checking, user, isLoggedIn } = useAuthUser();

  const [mode, setMode] = useState<Mode>("login");
  const [redirectPath, setRedirectPath] = useState<string>("/mon-compte");

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const m = router.query.mode as string | undefined;
    setMode(m === "register" ? "register" : "login");
    setRedirectPath(safeRedirect(router.query.redirect));
  }, [router.isReady, router.query.mode, router.query.redirect]);

  const redirectAfterAuth = () => router.replace(redirectPath);

  const handleLogout = async () => {
    try {
      await supabase?.auth.signOut();
    } finally {
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
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
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
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message || "Erreur inscription.");
      else {
        setAuthInfo("Compte créé. Vérifiez vos e-mails puis connectez-vous.");
        setMode("login");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  if (checking) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-500">Chargement…</div>;

  return (
    <AccountLayout userEmail={user?.email ?? null} active="home" onLogout={handleLogout}>
      {!isLoggedIn ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 max-w-xl">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Accès</p>
              <h2 className="text-lg font-semibold text-slate-900">{mode === "login" ? "Connexion" : "Créer un compte"}</h2>
              <p className="text-xs text-slate-500 mt-1">Accédez à votre profil et à votre espace client.</p>
            </div>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
            >
              {mode === "login" ? "Créer un compte" : "J’ai déjà un compte"}
            </button>
          </div>

          {authError ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{authError}</div> : null}
          {authInfo ? <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{authInfo}</div> : null}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Adresse e-mail</label>
                <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Mot de passe</label>
                <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required />
              </div>

              <button type="submit" disabled={authLoading} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                {authLoading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Adresse e-mail</label>
                <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Mot de passe</label>
                  <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Confirmer</label>
                  <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" type="password" value={authPassword2} onChange={(e) => setAuthPassword2(e.target.value)} required />
                </div>
              </div>

              <button type="submit" disabled={authLoading} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                {authLoading ? "Création..." : "Créer mon compte"}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Vue d’ensemble</p>
            <h2 className="text-lg font-semibold text-slate-900">Bienvenue 👋</h2>
            <p className="text-sm text-slate-600 mt-1">
              Tu peux gérer tes informations personnelles dans l’onglet <span className="font-semibold">Profil</span>.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-900">Prochaine étape</h3>
            <p className="mt-1 text-sm text-slate-600">Complète ton profil (adresse, téléphone…).</p>
            <a href="/mon-compte/profil" className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
              Ouvrir mon profil
            </a>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
