// pages/mon-compte/profil.tsx
import { useState } from "react";
import AccountLayout from "../../components/account/AccountLayout";
import { signOutAll } from "../../lib/authUtils";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useProfile } from "../../hooks/useProfile";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors";

const selectCls = inputCls + " cursor-pointer";

function Field({ label, children, full, hint }: { label: string; children: React.ReactNode; full?: boolean; hint?: string }) {
  return (
    <div className={full ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default function MonCompteProfilPage() {
  const { checking, user, isLoggedIn } = useAuthUser();
  const { loading, profile, error, ok, save, setProfile } = useProfile(user?.id ?? null);
  const [billingSame, setBillingSame] = useState<boolean | null>(null);

  const handleLogout = async () => { await signOutAll(); };

  if (checking) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-sm text-slate-500">Chargement…</p>
    </div>
  );

  const isSame = billingSame ?? profile?.billing_same_as_main ?? true;

  const set = (patch: Record<string, any>) =>
    setProfile((p) => ({ ...(p || { id: user?.id } as any), ...patch }));

  const handleSave = () => {
    save({
      civility: profile?.civility ?? null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      company_name: profile?.company_name ?? null,
      phone: profile?.phone ?? null,
      birth_date: profile?.birth_date ?? null,
      address_line1: profile?.address_line1 ?? null,
      address_line2: profile?.address_line2 ?? null,
      postal_code: profile?.postal_code ?? null,
      city: profile?.city ?? null,
      country: profile?.country ?? "FR",
      billing_same_as_main: isSame,
      billing_address_line1: isSame ? null : (profile?.billing_address_line1 ?? null),
      billing_address_line2: isSame ? null : (profile?.billing_address_line2 ?? null),
      billing_postal_code: isSame ? null : (profile?.billing_postal_code ?? null),
      billing_city: isSame ? null : (profile?.billing_city ?? null),
      billing_country: isSame ? null : (profile?.billing_country ?? "FR"),
    });
  };

  return (
    <AccountLayout userEmail={user?.email ?? null} active="profile" onLogout={handleLogout}>
      {!isLoggedIn ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm max-w-xl">
          <h2 className="text-lg font-semibold text-slate-900">Connexion requise</h2>
          <p className="mt-2 text-sm text-slate-600">Connectez-vous pour accéder à votre profil.</p>
          <a href="/mon-compte" className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Me connecter
          </a>
        </div>
      ) : (
        <div className="space-y-5 max-w-2xl">

          {/* Header */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm sm:px-8">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-600 mb-1">Profil</p>
            <h1 className="text-xl font-semibold text-slate-900">Mes informations</h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">
              Ces données préremplissent vos quittances, baux et documents bailleur.
            </p>
          </div>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-700">{error}</div>}
          {ok && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm text-emerald-700">{ok}</div>}

          {/* Identité */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-5">Identité</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Civilité">
                <select
                  className={selectCls}
                  value={profile?.civility ?? ""}
                  onChange={(e) => set({ civility: e.target.value || null })}
                >
                  <option value="">—</option>
                  <option value="M.">M.</option>
                  <option value="Mme">Mme</option>
                  <option value="Mx">Mx</option>
                </select>
              </Field>

              <Field label="Date de naissance">
                <input
                  type="date"
                  className={inputCls}
                  value={profile?.birth_date ?? ""}
                  onChange={(e) => set({ birth_date: e.target.value || null })}
                />
              </Field>

              <Field label="Prénom">
                <input
                  className={inputCls}
                  value={profile?.first_name ?? ""}
                  placeholder="Jean"
                  onChange={(e) => set({ first_name: e.target.value })}
                />
              </Field>

              <Field label="Nom">
                <input
                  className={inputCls}
                  value={profile?.last_name ?? ""}
                  placeholder="Dupont"
                  onChange={(e) => set({ last_name: e.target.value })}
                />
              </Field>

              <Field label="Téléphone" full>
                <input
                  className={inputCls}
                  value={profile?.phone ?? ""}
                  placeholder="06 12 34 56 78"
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </Field>

              <Field
                label="Raison sociale / SCI"
                full
                hint="Optionnel — si vous gérez vos biens via une société, le nom apparaîtra sur les documents."
              >
                <input
                  className={inputCls}
                  value={profile?.company_name ?? ""}
                  placeholder="SCI des Lilas"
                  onChange={(e) => set({ company_name: e.target.value || null })}
                />
              </Field>
            </div>
          </div>

          {/* Adresse principale */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-5">Adresse du propriétaire</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Adresse ligne 1" full>
                <input className={inputCls} value={profile?.address_line1 ?? ""} placeholder="12 rue de la Paix"
                  onChange={(e) => set({ address_line1: e.target.value })} />
              </Field>
              <Field label="Adresse ligne 2" full>
                <input className={inputCls} value={profile?.address_line2 ?? ""} placeholder="Appartement 3B"
                  onChange={(e) => set({ address_line2: e.target.value })} />
              </Field>
              <Field label="Code postal">
                <input className={inputCls} value={profile?.postal_code ?? ""} placeholder="75001"
                  onChange={(e) => set({ postal_code: e.target.value })} />
              </Field>
              <Field label="Ville">
                <input className={inputCls} value={profile?.city ?? ""} placeholder="Paris"
                  onChange={(e) => set({ city: e.target.value })} />
              </Field>
              <Field label="Pays" full>
                <select className={selectCls} value={profile?.country ?? "FR"} onChange={(e) => set({ country: e.target.value })}>
                  <option value="FR">France</option>
                  <option value="BE">Belgique</option>
                  <option value="CH">Suisse</option>
                  <option value="LU">Luxembourg</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Adresse de facturation */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            <div className="flex items-center justify-between gap-4 mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Adresse de facturation</p>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSame}
                  onChange={(e) => setBillingSame(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-xs font-medium text-slate-700">Identique à l'adresse principale</span>
              </label>
            </div>

            {isSame ? (
              <p className="text-sm text-slate-400">Adresse de facturation identique à l'adresse du propriétaire.</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Adresse ligne 1" full>
                  <input className={inputCls} value={profile?.billing_address_line1 ?? ""} placeholder="12 rue de la Paix"
                    onChange={(e) => set({ billing_address_line1: e.target.value })} />
                </Field>
                <Field label="Adresse ligne 2" full>
                  <input className={inputCls} value={profile?.billing_address_line2 ?? ""} placeholder="Appartement 3B"
                    onChange={(e) => set({ billing_address_line2: e.target.value })} />
                </Field>
                <Field label="Code postal">
                  <input className={inputCls} value={profile?.billing_postal_code ?? ""} placeholder="75001"
                    onChange={(e) => set({ billing_postal_code: e.target.value })} />
                </Field>
                <Field label="Ville">
                  <input className={inputCls} value={profile?.billing_city ?? ""} placeholder="Paris"
                    onChange={(e) => set({ billing_city: e.target.value })} />
                </Field>
                <Field label="Pays" full>
                  <select className={selectCls} value={profile?.billing_country ?? "FR"}
                    onChange={(e) => set({ billing_country: e.target.value })}>
                    <option value="FR">France</option>
                    <option value="BE">Belgique</option>
                    <option value="CH">Suisse</option>
                    <option value="LU">Luxembourg</option>
                  </select>
                </Field>
              </div>
            )}
          </div>

          {/* Pied */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm sm:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs text-slate-500">
              Email de connexion : <span className="font-semibold text-slate-700 break-all">{user?.email}</span>
              <a href="/mon-compte/securite" className="ml-2 underline hover:text-slate-900">Modifier</a>
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={handleSave}
              className="shrink-0 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
