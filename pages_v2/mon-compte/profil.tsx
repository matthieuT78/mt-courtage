// pages/mon-compte/profil.tsx
import AccountLayout from "../../components/account/AccountLayout";
import { supabase } from "../../lib/supabaseClient";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useProfile } from "../../hooks/useProfile";

export default function MonCompteProfilPage() {
  const { checking, user, isLoggedIn } = useAuthUser();
  const { loading, profile, error, ok, save, setProfile } = useProfile(user?.id ?? null);

  const handleLogout = async () => {
    try {
      await supabase?.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  };

  if (checking) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-500">Chargement…</div>;

  return (
    <AccountLayout userEmail={user?.email ?? null} active="profile" onLogout={handleLogout}>
      {!isLoggedIn ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900">Accès requis</h2>
          <p className="text-sm text-slate-600 mt-1">Merci de te connecter sur la page Mon compte.</p>
          <a className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white" href="/mon-compte">
            Aller à la connexion
          </a>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 max-w-2xl">
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-emerald-600 mb-1">Profil</p>
          <h2 className="text-lg font-semibold text-slate-900">Mes informations</h2>
          <p className="text-sm text-slate-600 mt-1">Ces données sont enregistrées dans la table <code className="text-xs">profiles</code>.</p>

          {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
          {ok ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{ok}</div> : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-700">Prénom</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={profile?.first_name ?? ""}
                onChange={(e) => setProfile((p) => ({ ...(p || { id: user.id } as any), first_name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700">Nom</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={profile?.last_name ?? ""}
                onChange={(e) => setProfile((p) => ({ ...(p || { id: user.id } as any), last_name: e.target.value }))}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-slate-700">Téléphone</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={profile?.phone ?? ""}
                onChange={(e) => setProfile((p) => ({ ...(p || { id: user.id } as any), phone: e.target.value }))}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-slate-700">Adresse ligne 1</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={profile?.address_line1 ?? ""}
                onChange={(e) => setProfile((p) => ({ ...(p || { id: user.id } as any), address_line1: e.target.value }))}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-slate-700">Adresse ligne 2</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={profile?.address_line2 ?? ""}
                onChange={(e) => setProfile((p) => ({ ...(p || { id: user.id } as any), address_line2: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700">Code postal</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={profile?.postal_code ?? ""}
                onChange={(e) => setProfile((p) => ({ ...(p || { id: user.id } as any), postal_code: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700">Ville</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={profile?.city ?? ""}
                onChange={(e) => setProfile((p) => ({ ...(p || { id: user.id } as any), city: e.target.value }))}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-slate-700">Pays</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={profile?.country ?? "FR"}
                onChange={(e) => setProfile((p) => ({ ...(p || { id: user.id } as any), country: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                save({
                  first_name: profile?.first_name ?? null,
                  last_name: profile?.last_name ?? null,
                  phone: profile?.phone ?? null,
                  address_line1: profile?.address_line1 ?? null,
                  address_line2: profile?.address_line2 ?? null,
                  postal_code: profile?.postal_code ?? null,
                  city: profile?.city ?? null,
                  country: profile?.country ?? "FR",
                })
              }
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Email (auth) : <span className="font-semibold break-all">{user.email}</span>
          </p>
        </div>
      )}
    </AccountLayout>
  );
}
