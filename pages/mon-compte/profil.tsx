// pages/mon-compte/profil.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AccountLayout from "../../components/account/AccountLayout";
import { signOutAll } from "../../lib/authUtils";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useProfile } from "../../hooks/useProfile";
import { supabase } from "../../lib/supabaseClient";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import AddressAutocomplete from "../../components/forms/AddressAutocomplete";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors";

const inputErrorCls =
  "w-full rounded-xl border border-red-400 bg-red-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-200 transition-colors";

const selectCls = inputCls + " cursor-pointer";
const selectErrorCls = inputErrorCls + " cursor-pointer";

// Validation structurelle (longueur/pays) + clé de contrôle mod-97 (norme ISO 7064).
function isValidIban(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

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
  const router = useRouter();
  const { checking, user, isLoggedIn } = useAuthUser();
  const { loading, profile, error, ok, save, setProfile } = useProfile(user?.id ?? null);
  const [billingSame, setBillingSame] = useState<boolean | null>(null);
  const [showHighlight, setShowHighlight] = useState(false);

  // RIB state
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [ribSaving, setRibSaving] = useState(false);
  const [ribFeedback, setRibFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ribLoaded, setRibLoaded] = useState(false);

  useEffect(() => {
    if (!supabase || !user?.id) return;
    supabase.from("landlords").select("iban,bic").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setIban(data?.iban || "");
      setBic(data?.bic || "");
      setRibLoaded(true);
    });
  }, [user?.id]);

  const saveRib = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user?.id) return;
    setRibFeedback(null);
    const cleanIban = iban.replace(/\s/g, "").toUpperCase();
    const cleanBic = bic.replace(/\s/g, "").toUpperCase();
    if (cleanIban && !isValidIban(cleanIban)) {
      setRibFeedback({ ok: false, msg: "Cet IBAN n'est pas valide. Vérifiez qu'il est complet et correctement recopié." });
      return;
    }
    setRibSaving(true);
    try {
      const { error } = await supabase.from("landlords").upsert(
        { user_id: user.id, iban: cleanIban || null, bic: cleanBic || null, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      setIban(cleanIban);
      setBic(cleanBic);
      setRibFeedback({ ok: true, msg: cleanIban ? "Coordonnées bancaires enregistrées." : "Coordonnées bancaires supprimées." });
    } catch (err: any) {
      setRibFeedback({ ok: false, msg: err?.message || "Erreur lors de l'enregistrement." });
    } finally {
      setRibSaving(false);
    }
  };

  const clearRib = async () => {
    setIban("");
    setBic("");
    if (!supabase || !user?.id) return;
    setRibSaving(true);
    setRibFeedback(null);
    try {
      await supabase.from("landlords").upsert(
        { user_id: user.id, iban: null, bic: null, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      setRibFeedback({ ok: true, msg: "Coordonnées bancaires supprimées." });
    } catch (err: any) {
      setRibFeedback({ ok: false, msg: err?.message || "Erreur." });
    } finally {
      setRibSaving(false);
    }
  };

  // Champs obligatoires pour le profil bailleur
  const isEmpty = (v: string | null | undefined) => !v?.trim();
  const inputC = (v: string | null | undefined) => isEmpty(v) && showHighlight ? inputErrorCls : inputCls;
  const selectC = (v: string | null | undefined) => isEmpty(v) && showHighlight ? selectErrorCls : selectCls;

  useEffect(() => {
    if (router.query.highlight !== "1" || loading) return;
    setShowHighlight(true);
    // Scroller sur le premier champ vide après le rendu
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>("[data-highlight-empty]");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLInputElement | HTMLSelectElement | null)?.focus?.();
    }, 150);
  }, [router.query.highlight, loading]);

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
                  className={inputC(profile?.first_name)}
                  {...(isEmpty(profile?.first_name) && showHighlight ? { "data-highlight-empty": "" } : {})}
                  value={profile?.first_name ?? ""}
                  placeholder="Jean"
                  onChange={(e) => set({ first_name: e.target.value })}
                />
              </Field>

              <Field label="Nom">
                <input
                  className={inputC(profile?.last_name)}
                  {...(isEmpty(profile?.last_name) && showHighlight ? { "data-highlight-empty": "" } : {})}
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
              <div className="sm:col-span-2">
                <AddressAutocomplete
                  id="profil_address1"
                  label="Adresse ligne 1"
                  addressLine1={profile?.address_line1 ?? ""}
                  postalCode={profile?.postal_code ?? ""}
                  city={profile?.city ?? ""}
                  onAddressLine1Change={(v) => set({ address_line1: v })}
                  onPostalCodeChange={(v) => set({ postal_code: v })}
                  onCityChange={(v) => set({ city: v })}
                  className={inputC(profile?.address_line1)}
                />
              </div>
              <Field label="Adresse ligne 2" full>
                <input className={inputCls} value={profile?.address_line2 ?? ""} placeholder="Appartement 3B"
                  onChange={(e) => set({ address_line2: e.target.value })} />
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
                <div className="sm:col-span-2">
                  <AddressAutocomplete
                    id="profil_billing_address1"
                    label="Adresse ligne 1"
                    addressLine1={profile?.billing_address_line1 ?? ""}
                    postalCode={profile?.billing_postal_code ?? ""}
                    city={profile?.billing_city ?? ""}
                    onAddressLine1Change={(v) => set({ billing_address_line1: v })}
                    onPostalCodeChange={(v) => set({ billing_postal_code: v })}
                    onCityChange={(v) => set({ billing_city: v })}
                  />
                </div>
                <Field label="Adresse ligne 2" full>
                  <input className={inputCls} value={profile?.billing_address_line2 ?? ""} placeholder="Appartement 3B"
                    onChange={(e) => set({ billing_address_line2: e.target.value })} />
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

          {/* RIB */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">Coordonnées bancaires</p>
            <p className="text-sm text-slate-500 mb-4">
              Votre IBAN est affiché dans l'espace locataire pour les instructions de virement. Vous pouvez le supprimer à tout moment.
            </p>
            <div className="mb-4 flex gap-2.5 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
              <p className="text-xs leading-5 text-indigo-800">
                <span className="font-semibold">Donnée personnelle financière (RGPD).</span> Votre IBAN n'est jamais inclus dans les e-mails.
                Seul un locataire avec un bail actif en mode virement peut le consulter.
              </p>
            </div>
            {!ribLoaded ? (
              <p className="text-sm text-slate-400">Chargement…</p>
            ) : (
              <form onSubmit={saveRib} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">IBAN</label>
                    <input
                      type="text"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      placeholder="FR76 3000 6000 0112 3456 7890 189"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={42}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm tracking-wider text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                    {iban.replace(/\s/g, "").length > 0 && (
                      <p className="mt-1 font-mono text-[0.68rem] text-slate-500">
                        {iban.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim()}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      BIC / SWIFT <span className="font-normal text-slate-400">(optionnel)</span>
                    </label>
                    <input
                      type="text"
                      value={bic}
                      onChange={(e) => setBic(e.target.value)}
                      placeholder="BNPAFRPPXXX"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={11}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm uppercase tracking-wider text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={ribSaving}
                    className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
                  >
                    {ribSaving ? "Enregistrement…" : "Enregistrer le RIB"}
                  </button>
                  {(iban || bic) && (
                    <button
                      type="button"
                      onClick={clearRib}
                      disabled={ribSaving}
                      className="rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
                {ribFeedback && (
                  <p className={`text-sm ${ribFeedback.ok ? "text-emerald-700" : "text-red-700"}`}>{ribFeedback.msg}</p>
                )}
              </form>
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
