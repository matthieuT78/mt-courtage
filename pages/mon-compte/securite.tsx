// pages/mon-compte/securite.tsx
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import AccountLayout from "../../components/account/AccountLayout";
import { supabase } from "../../lib/supabaseClient";
import { signOutAll } from "../../lib/authUtils";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors";

export default function MonCompteSecuritePage() {
  const router = useRouter();

  const [checkingUser, setCheckingUser] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailOk, setEmailOk] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdOk, setPwdOk] = useState<string | null>(null);

  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsOk, setPrefsOk] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteInputRef = useRef<HTMLInputElement>(null);

  const isLoggedIn = !!user?.email;
  const isGoogleUser =
    user?.app_metadata?.provider === "google" ||
    user?.identities?.some((id: any) => id.provider === "google");

  useEffect(() => {
    const run = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        const u = data.user ?? null;
        setUser(u);
        if (u) setNewsletterOptIn(!!u.user_metadata?.newsletter_opt_in);
      } catch {
        setUser(null);
      } finally {
        setCheckingUser(false);
      }
    };
    run();
  }, []);

  const handleLogout = async () => { await signOutAll(); };
  const goLogin = () => router.push("/mon-compte?mode=login&redirect=/mon-compte/securite");

  const handleChangeEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailOk(null);
    if (!supabase) return setEmailError("Auth indisponible.");
    if (!isLoggedIn) return setEmailError("Vous devez être connecté.");
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      return setEmailError("Merci de renseigner une adresse e-mail valide.");
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      setEmailOk("Un email de confirmation a été envoyé à " + trimmed + ". Le changement sera effectif après confirmation.");
      setNewEmail("");
    } catch (err: any) {
      setEmailError(err?.message || "Erreur lors du changement d'email.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdOk(null);
    if (!supabase) return setPwdError("Auth indisponible.");
    if (!isLoggedIn) return setPwdError("Vous devez être connecté.");
    if (!newPassword) return setPwdError("Merci de renseigner un nouveau mot de passe.");
    if (newPassword !== newPassword2) return setPwdError("Les mots de passe ne correspondent pas.");
    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwdOk("Mot de passe mis à jour ✓");
      setNewPassword("");
      setNewPassword2("");
    } catch (err: any) {
      setPwdError(err?.message || "Erreur mise à jour mot de passe.");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSavePreferences = async (e: FormEvent) => {
    e.preventDefault();
    setPrefsError(null);
    setPrefsOk(null);
    if (!supabase) return setPrefsError("Auth indisponible.");
    if (!isLoggedIn) return setPrefsError("Vous devez être connecté.");
    setPrefsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { newsletter_opt_in: newsletterOptIn } });
      if (error) throw error;
      setPrefsOk("Préférences enregistrées ✓");
    } catch (err: any) {
      setPrefsError(err?.message || "Erreur de mise à jour.");
    } finally {
      setPrefsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!supabase) return setDeleteError("Auth indisponible.");
    if (deleteConfirm.trim().toLowerCase() !== "supprimer") {
      return setDeleteError("Tapez exactement « supprimer » pour confirmer.");
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Session expirée, reconnectez-vous.");
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Erreur lors de la suppression.");
      await signOutAll();
      router.push("/?compte=supprime");
    } catch (err: any) {
      setDeleteError(err?.message || "Erreur inattendue.");
      setDeleteLoading(false);
    }
  };

  return (
    <AccountLayout userEmail={user?.email ?? null} active="securite" onLogout={handleLogout}>
      {checkingUser ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : !isLoggedIn ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm max-w-xl">
          <h1 className="text-lg font-semibold text-slate-900">Connexion requise</h1>
          <p className="mt-2 text-sm text-slate-600">Connectez-vous pour gérer votre mot de passe et vos préférences.</p>
          <button
            type="button"
            onClick={goLogin}
            className="mt-5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Me connecter
          </button>
        </div>
      ) : (
        <div className="space-y-5 max-w-2xl">

          {/* Header */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm sm:px-8">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sky-600 mb-1">Sécurité</p>
            <h1 className="text-xl font-semibold text-slate-900">Mot de passe & préférences</h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">
              Gérez votre mot de passe, vos emails et les paramètres de votre compte.
            </p>
          </div>

          {/* Email */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">Adresse e-mail</p>
            <p className="text-xs text-slate-500 mb-5">
              Email actuel : <span className="font-semibold text-slate-700">{user?.email}</span>
            </p>

            {isGoogleUser ? (
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Compte Google</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Votre email est géré par Google. Pour le modifier, rendez-vous dans les paramètres de votre compte Google.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {emailError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{emailError}</div>}
                {emailOk && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{emailOk}</div>}
                <form onSubmit={handleChangeEmail} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Nouvel e-mail</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className={inputCls}
                      placeholder="nouveau@email.fr"
                      autoComplete="email"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
                    >
                      {emailLoading ? "Envoi…" : "Changer l'e-mail"}
                    </button>
                    <p className="text-xs text-slate-500">Un lien de confirmation sera envoyé à la nouvelle adresse.</p>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Mot de passe */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-5">Mot de passe</p>

            {isGoogleUser ? (
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Connexion via Google</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Votre connexion est gérée par Google — aucun mot de passe lokt.fr n'est associé à votre compte.
                    Pour changer votre mot de passe, rendez-vous dans votre compte Google.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {pwdError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pwdError}</div>}
                {pwdOk && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{pwdOk}</div>}
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Nouveau mot de passe</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputCls}
                        placeholder="••••••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Confirmation</label>
                      <input
                        type="password"
                        value={newPassword2}
                        onChange={(e) => setNewPassword2(e.target.value)}
                        className={inputCls}
                        placeholder="••••••••••••"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={pwdLoading}
                      className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
                    >
                      {pwdLoading ? "Mise à jour…" : "Mettre à jour"}
                    </button>
                    <p className="text-xs text-slate-500">12 caractères minimum recommandés.</p>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Emails */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-5">Emails lokt.fr</p>

            {prefsError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{prefsError}</div>
            )}
            {prefsOk && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{prefsOk}</div>
            )}

            <form onSubmit={handleSavePreferences} className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newsletterOptIn}
                  onChange={(e) => setNewsletterOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-600"
                />
                <span className="text-sm text-slate-700">
                  Recevoir les actualités produit et conseils lokt.fr
                </span>
              </label>
              <button
                type="submit"
                disabled={prefsLoading}
                className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                {prefsLoading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </form>
          </div>

          {/* Zone dangereuse */}
          <div className="rounded-3xl border border-red-100 bg-white px-6 py-6 shadow-sm sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-500 mb-2">Zone dangereuse</p>
            <p className="text-sm text-slate-600 leading-6">
              La suppression est <strong className="text-slate-900">irréversible</strong> — toutes vos données bailleur, baux, locataires et documents seront effacés.
              Un abonnement payant actif est résilié immédiatement.
            </p>
            <button
              type="button"
              onClick={() => { setShowDeleteModal(true); setDeleteConfirm(""); setDeleteError(null); }}
              className="mt-4 rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
            >
              Supprimer mon compte
            </button>
          </div>
        </div>
      )}

      {/* Modale de confirmation */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-red-600 mb-1">Action irréversible</p>
            <h2 className="text-base font-semibold text-slate-900">Supprimer mon compte</h2>
            <p className="mt-2.5 text-sm leading-6 text-slate-600">
              Votre compte, vos données et votre abonnement Stripe seront supprimés définitivement.
              Les données de facturation sont conservées pour obligation légale.
            </p>

            <div className="mt-5 space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Tapez{" "}
                <span className="font-mono font-bold text-red-700">supprimer</span>{" "}
                pour confirmer
              </label>
              <input
                ref={deleteInputRef}
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoFocus
                placeholder="supprimer"
                className={inputCls + " focus:ring-red-500/20"}
              />
            </div>

            {deleteError && (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {deleteError}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirm.trim().toLowerCase() !== "supprimer"}
                className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleteLoading ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
