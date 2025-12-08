// pages/auth.tsx
import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type Mode = "login" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage(
        "Le service d'authentification n'est pas disponible (configuration Supabase manquante)."
      );
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage("✅ Connexion réussie, redirection en cours...");
        if (typeof window !== "undefined") {
          setTimeout(() => {
            window.location.href = "/mon-compte";
          }, 800);
        }
      } else {
        // inscription
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        setMessage(
          "✅ Compte créé. Vérifiez vos e-mails si la confirmation est activée, puis connectez-vous."
        );
        setMode("login");
      }
    } catch (err: any) {
      setMessage("❌ " + (err?.message || "Une erreur est survenue."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-md mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              MT Courtage &amp; Investissement
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Espace client – connexion & inscription.
            </p>
          </div>
          <Link href="/" className="text-xs text-slate-500 underline">
            &larr; Retour
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          {/* Onglets login / signup */}
          <div className="flex items-center justify-center gap-2 rounded-full bg-slate-100 p-1 text-xs">
            <button
              onClick={() => setMode("login")}
              className={
                "flex-1 rounded-full px-3 py-1.5 " +
                (mode === "login"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              Connexion
            </button>
            <button
              onClick={() => setMode("signup")}
              className={
                "flex-1 rounded-full px-3 py-1.5 " +
                (mode === "signup"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              Inscription
            </button>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Nom / Prénom (affiché dans l&apos;espace client)
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={mode === "signup"}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-slate-700">Adresse e-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading
                ? "Veuillez patienter..."
                : mode === "login"
                ? "Se connecter"
                : "Créer mon compte"}
            </button>
          </form>

          <p className="text-[0.75rem] text-slate-500 text-center">
            {mode === "login" ? (
              <>
                Pas encore inscrit ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="underline"
                >
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà inscrit ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="underline"
                >
                  Se connecter
                </button>
              </>
            )}
          </p>

          {message && (
            <p className="text-[0.75rem] text-slate-600 text-center whitespace-pre-line">
              {message}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
