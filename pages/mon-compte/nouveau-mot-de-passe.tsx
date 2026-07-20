// pages/mon-compte/nouveau-mot-de-passe.tsx
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import { supabase } from "../../lib/supabaseClient";

type Mode = "detecting" | "set-password" | "invalid";

export default function NouveauMotDePassePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("detecting");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setMode("invalid");
      return;
    }

    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash.includes("type=recovery")) {
      setMode("invalid");
      return;
    }

    let resolved = false;

    const resolveSuccess = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(fallback);
      setMode("set-password");
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") resolveSuccess();
    });

    // Le client peut avoir déjà échangé le token avant que ce listener soit posé.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) resolveSuccess();
    });

    const fallback = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      setErr("Ce lien a expiré ou est invalide. Demandez un nouveau lien.");
      setMode("invalid");
    }, 4000);

    return () => {
      clearTimeout(fallback);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErr(null);
    if (password.length < 8) {
      setErr("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== password2) {
      setErr("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErr(error.message || "Erreur lors de la mise à jour du mot de passe.");
        return;
      }
      setDone(true);
      setTimeout(() => router.replace("/espace-bailleur"), 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Head>
        <title>Nouveau mot de passe | lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AppHeader />
      <div className="h-1 w-full bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400" />

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          {mode === "detecting" ? (
            <p className="text-sm text-slate-500">Vérification du lien…</p>
          ) : mode === "invalid" ? (
            <>
              <h1 className="text-lg font-semibold text-slate-900">Lien invalide ou expiré</h1>
              <p className="mt-2 text-sm text-slate-600">
                {err || "Ce lien de réinitialisation n'est plus valide."}
              </p>
              <a
                href="/mon-compte?mode=forgot"
                className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Demander un nouveau lien
              </a>
            </>
          ) : done ? (
            <>
              <h1 className="text-lg font-semibold text-slate-900">Mot de passe mis à jour ✓</h1>
              <p className="mt-2 text-sm text-slate-600">Redirection vers votre espace bailleur…</p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-slate-900">Choisissez un nouveau mot de passe</h1>
              <p className="mt-1 text-xs text-slate-500">8 caractères minimum.</p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                <div className="space-y-1">
                  <label htmlFor="new_pwd" className="text-xs text-slate-700">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="new_pwd"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="new_pwd2" className="text-xs text-slate-700">
                    Confirmer
                  </label>
                  <input
                    id="new_pwd2"
                    type="password"
                    autoComplete="new-password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                {err ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? "Enregistrement…" : "Mettre à jour le mot de passe"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
