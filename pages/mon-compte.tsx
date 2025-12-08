// pages/mon-compte.tsx
import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export default function MonComptePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (!supabase) {
        setLoadingUser(false);
        return;
      }
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setUser(null);
        setLoadingUser(false);
        if (typeof window !== "undefined") {
          router.push("/auth");
        }
        return;
      }
      setUser(data.user);
      setFullName((data.user.user_metadata?.full_name as string) || "");
      setAvatarUrl((data.user.user_metadata?.avatar_url as string) || "");
      setLoadingUser(false);
    };
    fetchUser();
  }, [router]);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    if (!supabase || !user) return;

    setProfileSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          avatar_url: avatarUrl,
        },
      });
      if (error) throw error;
      setProfileMessage("✅ Profil mis à jour.");
    } catch (err: any) {
      setProfileMessage("❌ " + (err?.message || "Erreur lors de la mise à jour."));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!supabase || !user) return;

    if (!newPassword || newPassword !== confirmPassword) {
      setPasswordMessage("❌ Les mots de passe ne correspondent pas.");
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordMessage("✅ Mot de passe mis à jour.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage(
        "❌ " + (err?.message || "Erreur lors de la mise à jour du mot de passe.")
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const initials =
    user?.user_metadata?.full_name?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "M";

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Chargement de votre espace...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              Mon compte
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Gérez vos informations personnelles et vos paramètres d&apos;accès.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-slate-500 underline">
              &larr; Accueil
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Résumé utilisateur */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full border border-slate-200 bg-slate-900 text-white flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-base font-semibold">{initials}</span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {fullName || user.email}
              </p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end text-[0.7rem] text-slate-500">
            <p>ID utilisateur (Supabase)</p>
            <p className="font-mono text-[0.65rem] text-slate-400 truncate max-w-xs">
              {user.id}
            </p>
          </div>
        </section>

        {/* Infos perso & avatar */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Informations personnelles
            </h2>
            <p className="text-xs text-slate-500">
              Ces informations sont utilisées pour personnaliser votre espace et vos
              exports de simulations.
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleProfileSubmit}>
            <div className="space-y-1">
              <label className="text-xs text-slate-700">Nom complet</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700">
                URL de l&apos;avatar (optionnel)
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[0.7rem] text-slate-500">
                Vous pouvez utiliser une URL d&apos;image (hébergement externe ou futur
                stockage dédié).
              </p>
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {profileSaving ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>

            {profileMessage && (
              <p className="text-[0.75rem] text-slate-600 whitespace-pre-line">
                {profileMessage}
              </p>
            )}
          </form>
        </section>

        {/* Mot de passe */}
        <section
          id="password"
          className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4"
        >
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Sécurité & mot de passe
            </h2>
            <p className="text-xs text-slate-500">
              Modifiez votre mot de passe Supabase / MT Courtage. Vous serez invité à
              vous reconnecter si nécessaire.
            </p>
          </div>

          <form className="space-y-3" onSubmit={handlePasswordSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Confirmation du nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordSaving}
              className="rounded-full bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {passwordSaving ? "Mise à jour..." : "Changer mon mot de passe"}
            </button>

            {passwordMessage && (
              <p className="text-[0.75rem] text-slate-600 whitespace-pre-line">
                {passwordMessage}
              </p>
            )}
          </form>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Espace client.
        </p>
      </footer>
    </div>
  );
}
