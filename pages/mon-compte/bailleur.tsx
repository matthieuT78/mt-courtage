// pages/mon-compte/bailleur.tsx
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AccountLayout from "../../components/account/AccountLayout";
import { supabase } from "../../lib/supabaseClient";

type PaymentMode = "virement" | "prelevement" | "cheque" | "especes";

export default function MonCompteBailleurPage() {
  const router = useRouter();

  const [checkingUser, setCheckingUser] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [isLandlord, setIsLandlord] = useState(false);
  const [landlordName, setLandlordName] = useState("");
  const [landlordAddress, setLandlordAddress] = useState("");
  const [defaultCity, setDefaultCity] = useState("");
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<PaymentMode>("virement");
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);

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
          setIsLandlord(!!meta.is_landlord);
          setLandlordName(meta.landlord_name || "");
          setLandlordAddress(meta.landlord_address || "");
          setDefaultCity(meta.landlord_default_city || "");
          setDefaultPaymentMode((meta.landlord_default_payment_mode as PaymentMode) || "virement");
          setAutoSendEnabled(!!meta.landlord_auto_send_enabled);
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

  const goLogin = () => {
    router.push("/mon-compte?mode=login&redirect=/mon-compte/bailleur");
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (!supabase) return setError("Auth indisponible.");
    if (!isLoggedIn) return setError("Vous devez être connecté.");

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          is_landlord: isLandlord,
          landlord_name: landlordName,
          landlord_address: landlordAddress,
          landlord_default_city: defaultCity,
          landlord_default_payment_mode: defaultPaymentMode,
          landlord_auto_send_enabled: autoSendEnabled,
        },
      });
      if (error) throw error;
      setOk("Espace bailleur mis à jour ✅");
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountLayout userEmail={user?.email ?? null} active="bailleur" onLogout={handleLogout}>
      {checkingUser ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : !isLoggedIn ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Connectez-vous pour configurer votre espace bailleur.</p>
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
          <p className="uppercase tracking-[0.18em] text-[0.7rem] text-amber-700 mb-1">Espace bailleur</p>
          <h1 className="text-lg font-semibold text-slate-900">Paramètres bailleur</h1>
          <p className="text-sm text-slate-600 mt-1 mb-4">
            Ces informations servent de valeurs par défaut dans <span className="font-semibold">/quittances-loyer</span>.
          </p>

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          {ok && (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {ok}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3">
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={isLandlord}
                onChange={(e) => setIsLandlord(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
              />
              <span className="font-medium">Activer mon espace bailleur</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Nom / raison sociale</label>
                <input
                  type="text"
                  value={landlordName}
                  onChange={(e) => setLandlordName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Ville de signature (défaut)</label>
                <input
                  type="text"
                  value={defaultCity}
                  onChange={(e) => setDefaultCity(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-700">Adresse bailleur</label>
              <textarea
                rows={2}
                value={landlordAddress}
                onChange={(e) => setLandlordAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Mode de paiement (défaut)</label>
                <select
                  value={defaultPaymentMode}
                  onChange={(e) => setDefaultPaymentMode(e.target.value as PaymentMode)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="virement">Virement</option>
                  <option value="prelevement">Prélèvement</option>
                  <option value="cheque">Chèque</option>
                  <option value="especes">Espèces</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">Envoi auto (global)</label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoSendEnabled}
                    onChange={(e) => setAutoSendEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                  />
                  <span>Activer l’envoi automatique (option)</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
            >
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/quittances-loyer"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Gérer mes quittances
              </Link>
              <Link
                href="/outils-proprietaire"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Outils propriétaire
              </Link>
            </div>
          </form>
        </>
      )}
    </AccountLayout>
  );
}
