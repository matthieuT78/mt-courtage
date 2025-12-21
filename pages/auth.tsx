// pages/auth.tsx
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type Mode = "login" | "signup";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function normalizeSupabaseErrorMessage(msg?: string) {
  const m = (msg || "").toLowerCase();
  if (!m) return "Une erreur est survenue.";
  if (m.includes("invalid login credentials")) return "Identifiants invalides.";
  if (m.includes("email not confirmed")) return "Email non confirmé. Vérifie ta boîte mail.";
  if (m.includes("user already registered") || m.includes("already registered"))
    return "Un compte existe déjà avec cet email.";
  if (m.includes("password should be at least")) return "Mot de passe trop court.";
  return msg || "Une erreur est survenue.";
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [fullName, setFullName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!email.trim() || !password) return false;
    if (mode === "signup") {
      if (!fullName.trim()) return false;
      if (!acceptTerms) return false;
      if (password.length < 8) return false;
      if (password !== password2) return false;
    }
    return true;
  }, [loading, email, password, password2, mode, fullName, acceptTerms]);

  const resetMessages = () => setMessage(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!supabase) {
      setMessage({
        tone: "err",
        text: "Le service d'authentification n'est pas disponible (configuration Supabase manquante).",
      });
      return;
    }

    // validations front (signup)
    if (mode === "signup") {
      if (!fullName.trim()) {
        setMessage({ tone: "err", text: "Merci de renseigner ton nom / prénom." });
        return;
      }
      if (!acceptTerms) {
        setMessage({ tone: "err", text: "Merci d’accepter les conditions pour créer un compte." });
        return;
      }
      if (password.length < 8) {
        setMessage({ tone: "err", text: "Mot de passe : 8 caractères minimum." });
        return;
      }
      if (password !== password2) {
        setMessage({ tone: "err", text: "Les mots de passe ne correspondent pas." });
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        setMessage({ tone: "ok", text: "✅ Connexion réussie, redirection en cours..." });

        if (typeof window !== "undefined") {
          setTimeout(() => {
            window.location.href = "/mon-compte";
          }, 600);
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              // tu peux ajouter ici : plan, source, etc.
              // plan: "free",
            },
          },
        });

        if (error) throw error;

        setMessage({
          tone: "ok",
          text: "✅ Compte créé.\nVérifie tes e-mails si la confirmation est activée, puis connecte-toi.",
        });

        // bascule en login + reset passwords
        setMode("login");
        setPassword("");
        setPassword2("");
      }
    } catch (err: any) {
      setMessage({ tone: "err", text: "❌ " + normalizeSupabaseErrorMessage(err?.message) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* top glow */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-28 left-1/4 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <header className="relative border-b border-white/10 bg-slate-950/40 backdrop-blur">
        <div className="max-w-md mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-slate-400">Izimo</p>
            <h1 className="text-xl font-semibold text-white tracking-tight truncate">
              Connexion &amp; Inscription
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Accède à ton espace et gère tes baux, EDL et documents.
            </p>
          </div>
          <Link href="/" className="text-xs text-slate-300 underline hover:text-white">
            &larr; Retour
          </Link>
        </div>
      </header>

      <main className="relative flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur p-5 sm:p-6 space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-center gap-2 rounded-full bg-white/5 p-1 text-xs border border-white/10">
            <button
              type="button"
              onClick={() => {
                resetMessages();
                setMode("login");
              }}
              className={cx(
                "flex-1 rounded-full px-3 py-2 font-semibold transition",
                mode === "login" ? "bg-white text-slate-900" : "text-slate-200 hover:text-white"
              )}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => {
                resetMessages();
                setMode("signup");
              }}
              className={cx(
                "flex-1 rounded-full px-3 py-2 font-semibold transition",
                mode === "signup" ? "bg-white text-slate-900" : "text-slate-200 hover:text-white"
              )}
            >
              Inscription
            </button>
          </div>

          {/* Message */}
          {message ? (
            <div
              className={cx(
                "rounded-2xl border px-3 py-2 text-sm whitespace-pre-line",
                message.tone === "ok"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                  : message.tone === "err"
                  ? "border-red-400/30 bg-red-500/10 text-red-100"
                  : "border-white/10 bg-white/5 text-slate-200"
              )}
            >
              {message.text}
            </div>
          ) : null}

          <form className="space-y-3" onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-slate-200">Nom / Prénom</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    placeholder="Ex : Martin Dupont"
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-1">
              <label className="text-xs text-slate-200">Adresse e-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                placeholder="toi@email.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-200">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 pr-24 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder={mode === "signup" ? "8 caractères minimum" : "Ton mot de passe"}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] font-semibold text-slate-200 hover:bg-white/10"
                >
                  {showPwd ? "Masquer" : "Afficher"}
                </button>
              </div>
              {mode === "signup" ? (
                <p className="text-[0.7rem] text-slate-400">Conseil : mélange lettres, chiffres, et 1 symbole.</p>
              ) : null}
            </div>

            {mode === "signup" ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-slate-200">Confirmer le mot de passe</label>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    placeholder="Répète le mot de passe"
                  />
                  {password2 && password !== password2 ? (
                    <p className="text-[0.7rem] text-red-200">Les mots de passe ne correspondent pas.</p>
                  ) : null}
                </div>

                <label className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-[0.75rem] text-slate-200">
                    J’accepte les conditions d’utilisation et la politique de confidentialité.
                  </span>
                </label>
              </>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full mt-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {loading ? "Veuillez patienter..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <p className="text-[0.75rem] text-slate-300 text-center">
            {mode === "login" ? (
              <>
                Pas encore inscrit ?{" "}
                <button type="button" onClick={() => setMode("signup")} className="underline hover:text-white">
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà inscrit ?{" "}
                <button type="button" onClick={() => setMode("login")} className="underline hover:text-white">
                  Se connecter
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
