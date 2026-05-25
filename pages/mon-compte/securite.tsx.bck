// pages/mon-compte/securite.tsx
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import AccountLayout from "../../components/account/AccountLayout";
import { supabase } from "../../lib/supabaseClient";

export default function MonCompteSecuritePage() {
  const router = useRouter();

  const [checkingUser, setCheckingUser] = useState(true);
  const [user, setUser] = useState<any>(null);

  // password
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdOk, setPwdOk] = useState<string | null>(null);

  // newsletter
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsOk, setPrefsOk] = useState<string | null>(null);

  const isLoggedIn = !!user?.email;

  useEffect(() => {
    const run = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        const u = data.user ?? null;
        setUser(u);
        if (u) {
          const meta = u.user_metadata || {};
          setNewsletterOptIn(!!meta.newsletter_opt_in);
        }
      } catch {
        setUser(null);
      } finally {
        setCheckingUser(false);
      }
    };
    run();
  }, []);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
  };

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
      setPwdOk("Mot de passe mis à jour ✅");
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
      const { error } = await supabase.auth.updateUser({
        data: { newsletter_opt_in: newsletterOptIn },
      });
      if (error) throw error;
      setPrefsOk("Préférences enregistrées ✅");
    } catch (err: any) {
      setPrefsError(err?.message || "Erreur de mise à jour.");
    } finally {
      setPrefsLoading(false);
    }
  };

  return (
    <AccountLayout userEmail={user?.email ?? null} active="securite" onLogout={handleLogout}>
      {checkingUser ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : !isLoggedIn ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Connectez-vous pour gérer la sécurité.</p>
          <button
            type="button"
            onClick={goLogin}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Me connecter
          </button>
        </div>
      ) : (
        <>
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-slate-900 mb-1">Sécurité</p>
          <h1 className="text-lg font-semibold text-slate-900 mb-4">Sécurité & préférences</h1>

          {/* Password */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">Changer mon mot de passe</p>
            {pwdError && (
              <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] text-red-700">
                {pwdError}
              </div>
            )}
            {pwdOk && (
              <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.7rem] text-emerald-700">
                {pwdOk}
              </div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Nouveau mot de passe</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Confirmer</label>
                  <input
                    type="password"
                    value={newPassword2}
                    onChange={(e) => setNewPassword2(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={pwdLoading}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {pwdLoading ? "Mise à jour..." : "Mettre à jour"}
              </button>
            </form>
          </div>

          {/* Newsletter */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[0.75rem] font-semibold text-slate-800 mb-2">Newsletter</p>
            {prefsError && (
              <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] text-red-700">
                {prefsError}
              </div>
            )}
            {prefsOk && (
              <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.7rem] text-emerald-700">
                {prefsOk}
              </div>
            )}
            <form onSubmit={handleSavePreferences} className="space-y-3">
              <label className="flex items-start gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={newsletterOptIn}
                  onChange={(e) => setNewsletterOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Je souhaite recevoir la newsletter.</span>
              </label>
              <button
                type="submit"
                disabled={prefsLoading}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
              >
                {prefsLoading ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </div>
        </>
      )}
    </AccountLayout>
  );
}
