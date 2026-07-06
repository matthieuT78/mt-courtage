import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabaseTenant as supabase } from "../../lib/supabaseTenantClient";

// type=invite  → nouveau locataire, doit créer un mot de passe
// type=recovery → locataire existant ré-invité, on le connecte directement sans forcer un changement de mdp
type Mode = "detecting" | "set-password" | "login";

export default function TenantConnexionPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("detecting");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setMode("login");
      return;
    }

    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const isNewInvite = hash.includes("type=invite");
    const isReInvite = hash.includes("type=recovery");
    const hasMagicHash = isNewInvite || isReInvite;

    const handleSession = (session: any | null) => {
      if (!session) { setMode("login"); return; }
      if (isNewInvite) {
        setMode("set-password");
      } else {
        router.replace("/espace-locataire");
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        handleSession(session);
      }
    });

    if (!hasMagicHash) {
      // Pas de lien magique : vérifier la session existante
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          router.replace("/espace-locataire");
        } else {
          setMode("login");
        }
      });
    } else {
      // Lien magique présent : laisser onAuthStateChange gérer.
      // Timeout de sécurité : si le token est invalide/expiré et que l'event
      // ne fire jamais, on sort du mode detecting après 4 secondes.
      const fallback = setTimeout(() => setMode("login"), 4000);
      return () => {
        clearTimeout(fallback);
        listener.subscription.unsubscribe();
      };
    }

    return () => { listener.subscription.unsubscribe(); };
  }, [router]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) {
      setErr("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (password !== password2) {
      setErr("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    router.replace("/espace-locataire");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }
    router.replace("/espace-locataire");
  };

  const brandBar = "h-1.5 bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]";
  const brandBg = "bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]";
  const inputCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
  const labelCls = "block space-y-1 text-xs font-semibold text-slate-700";

  if (mode === "detecting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f9fc]">
        <p className="text-sm text-slate-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f9fc] px-4">
      <Head>
        <title>Connexion locataire | lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className={brandBar} />
          <div className="p-8">
            <div className="mb-6 flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-xl ${brandBg} text-xs font-semibold text-white shadow-sm`}
              >
                L
              </span>
              <p className="text-[0.7rem] lowercase tracking-[0.18em] text-slate-600">lokt.fr</p>
            </div>

            {mode === "set-password" ? (
              <>
                <h1 className="text-xl font-semibold text-slate-950">Bienvenue !</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Votre bailleur vous a invite sur lokt.fr. Choisissez un mot de passe pour
                  acceder a votre espace locataire.
                </p>
                <form onSubmit={handleSetPassword} className="mt-6 space-y-4">
                  <label className={labelCls}>
                    Mot de passe
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="8 caracteres minimum"
                      className={inputCls}
                      autoFocus
                    />
                  </label>
                  <label className={labelCls}>
                    Confirmer le mot de passe
                    <input
                      type="password"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      required
                      placeholder="Repetez le mot de passe"
                      className={inputCls}
                    />
                  </label>
                  {err ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {err}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-slate-950 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {loading ? "Enregistrement..." : "Acceder a mon espace"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-slate-950">Connexion</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Connectez-vous pour acceder a votre espace locataire.
                </p>
                <form onSubmit={handleLogin} className="mt-6 space-y-4">
                  <label className={labelCls}>
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="votre@email.fr"
                      className={inputCls}
                      autoFocus
                    />
                  </label>
                  <label className={labelCls}>
                    Mot de passe
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </label>
                  {err ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {err}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-slate-950 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {loading ? "Connexion..." : "Se connecter"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Espace reserve aux locataires. Vous etes bailleur ?{" "}
          <a href="/mon-compte" className="underline">
            Connexion bailleur
          </a>
        </p>
      </div>
    </div>
  );
}
