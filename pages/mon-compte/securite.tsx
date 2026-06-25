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

          {/* Mot de passe */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-5">Mot de passe</p>

            {pwdError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pwdError}</div>
            )}
            {pwdOk && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{pwdOk}</div>
            )}

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
