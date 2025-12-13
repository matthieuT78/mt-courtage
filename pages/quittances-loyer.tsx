// pages/quittances-loyer.tsx
import { FormEvent, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type PaymentMode = "virement" | "prelevement" | "cheque" | "especes";

type AuthedUser = {
  id: string;
  email?: string;
  user_metadata?: any;
};

// DOIT correspondre à ta table SQL, par ex. "rental_units"
type RentalUnit = {
  id: string;
  user_id: string;
  label: string | null;
  address: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  rent_amount: number | null;
  charges_amount: number | null;
  payment_day: number | null; // jour du mois prévu (1–31)
  auto_quittance_enabled: boolean;
  created_at: string;
};

// DOIT correspondre à ta table SQL, par ex. "rent_receipts"
type RentReceipt = {
  id: string;
  rental_unit_id: string;
  period_start: string;
  period_end: string;
  paid_at: string | null;
  total_amount: number;
  quittance_text: string;
  created_at: string;
};

// -------------------------
// Helpers (purs)
// -------------------------
const formatEuro = (val: number | null | undefined) => {
  if (val == null || Number.isNaN(val)) return "—";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const formatDateFR = (val?: string | null) => {
  if (!val) return "";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
};

const getMonthPeriod = (base: Date) => {
  const y = base.getFullYear();
  const m = base.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start, end };
};

function generateQuittanceText(params: {
  bailleurNom: string;
  bailleurAdresse?: string | null;
  locataireNom: string;
  bienAdresse?: string | null;
  loyerHC: number;
  charges: number;
  periodeDebut: string;
  periodeFin: string;
  datePaiement?: string | null;
  villeQuittance?: string | null;
  dateQuittance?: string | null;
  modePaiement: PaymentMode;
  mentionSolde: boolean;
}) {
  const {
    bailleurNom,
    bailleurAdresse,
    locataireNom,
    bienAdresse,
    loyerHC,
    charges,
    periodeDebut,
    periodeFin,
    datePaiement,
    villeQuittance,
    dateQuittance,
    modePaiement,
    mentionSolde,
  } = params;

  const total = (loyerHC || 0) + (charges || 0);

  const periodeStr =
    periodeDebut && periodeFin
      ? `pour la période du ${formatDateFR(periodeDebut)} au ${formatDateFR(periodeFin)}`
      : "";

  const paiementStr = datePaiement ? `payé le ${formatDateFR(datePaiement)}` : "dû et réglé";

  const villeDateStr =
    villeQuittance && dateQuittance ? `${villeQuittance}, le ${formatDateFR(dateQuittance)}` : "";

  const modePaiementLabel =
    modePaiement === "virement"
      ? "par virement bancaire"
      : modePaiement === "cheque"
      ? "par chèque"
      : modePaiement === "especes"
      ? "en espèces"
      : "par prélèvement";

  const lignes: string[] = [];

  if (bailleurNom || bailleurAdresse) {
    lignes.push(`${bailleurNom || "Nom du bailleur"}`);
    if (bailleurAdresse) lignes.push(bailleurAdresse);
    lignes.push("");
  }

  if (locataireNom) {
    lignes.push(`À l'attention de : ${locataireNom}`);
    lignes.push("");
  }

  lignes.push("QUITTANCE DE LOYER");
  lignes.push("".padEnd(22, "="));
  lignes.push("");

  lignes.push(
    `Je soussigné(e) ${bailleurNom || "[Nom du bailleur]"}, propriétaire du logement situé ${
      bienAdresse || "[Adresse du logement]"
    }, certifie avoir reçu de la part de ${locataireNom || "[Nom du locataire]"} la somme de ${formatEuro(
      total
    )} (${formatEuro(loyerHC)} de loyer hors charges et ${formatEuro(charges)} de provisions sur charges)${
      periodeStr ? ` ${periodeStr}` : ""
    }, ${paiementStr} ${modePaiementLabel}.`
  );

  lignes.push("");

  if (mentionSolde) {
    lignes.push(
      "La présente quittance vaut reçu pour toutes sommes versées à ce jour au titre des loyers et charges pour la période indiquée et éteint, à ce titre, toute dette de locataire envers le bailleur pour ladite période."
    );
    lignes.push("");
  }

  lignes.push(
    "La présente quittance ne préjuge en rien du paiement des loyers et charges antérieurs ou ultérieurs non quittancés."
  );
  lignes.push("");

  if (villeDateStr) {
    lignes.push(villeDateStr);
    lignes.push("");
  }

  lignes.push("Signature du bailleur :");
  lignes.push("");
  lignes.push("____________________________________");

  return lignes.join("\n");
}

// -------------------------
// Hooks simples
// -------------------------
function useAuthedUser() {
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        const u = data.session?.user ?? null;
        setUser(
          u
            ? {
                id: u.id,
                email: u.email ?? undefined,
                user_metadata: u.user_metadata ?? {},
              }
            : null
        );
      } catch (e) {
        console.error("Erreur session quittances", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
}

function getLandlordDefaults(user: AuthedUser | null) {
  const meta = user?.user_metadata || {};

  const firstName = String(meta.first_name || "").trim();
  const lastName = String(meta.last_name || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const bailleurNom =
    String(meta.landlord_name || "").trim() || fullName || user?.email || "Bailleur";

  const bailleurAdresse =
    String(meta.landlord_address || "").trim() ||
    String(meta.address_line1 || "").trim() ||
    "";

  const villeQuittance =
    String(meta.landlord_default_city || "").trim() || String(meta.city || "").trim() || "";

  const modePaiement = (meta.landlord_default_payment_mode || "virement") as PaymentMode;

  const rawCount = meta.landlord_properties_count;
  const propertiesCount =
    typeof rawCount === "number" ? rawCount : parseInt(String(rawCount || "0"), 10) || 0;

  const isLandlord = !!meta.is_landlord;

  const landlordReady =
    !!String(meta.landlord_name || "").trim() && !!String(meta.landlord_address || "").trim();

  return {
    isLandlord,
    landlordReady,
    bailleurNom,
    bailleurAdresse,
    villeQuittance,
    modePaiement,
    propertiesCount,
  };
}

// -------------------------
// Form reducer
// -------------------------
type UnitFormState = {
  label: string;
  address: string;
  tenantName: string;
  tenantEmail: string;
  rent: string;
  charges: string;
  paymentDay: string;
  autoEnabled: boolean;
};

const emptyForm: UnitFormState = {
  label: "",
  address: "",
  tenantName: "",
  tenantEmail: "",
  rent: "",
  charges: "",
  paymentDay: "1",
  autoEnabled: true,
};

type UnitFormAction =
  | { type: "reset" }
  | { type: "load"; payload: Partial<UnitFormState> }
  | { type: "set"; field: keyof UnitFormState; value: string | boolean };

function unitFormReducer(state: UnitFormState, action: UnitFormAction): UnitFormState {
  switch (action.type) {
    case "reset":
      return { ...emptyForm };
    case "load":
      return { ...state, ...action.payload };
    case "set":
      return { ...state, [action.field]: action.value } as UnitFormState;
    default:
      return state;
  }
}

// -------------------------
// Page
// -------------------------
export default function QuittancesLoyerPage() {
  const router = useRouter();
  const { user, loading: loadingUser } = useAuthedUser();
  const landlordDefaults = useMemo(() => getLandlordDefaults(user), [user]);

  const [units, setUnits] = useState<RentalUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  const [receipts, setReceipts] = useState<RentReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const currentUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) || null,
    [units, selectedUnitId]
  );

  const [form, dispatch] = useReducer(unitFormReducer, emptyForm);

  const [savingUnit, setSavingUnit] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [generatingForId, setGeneratingForId] = useState<string | null>(null);
  const [quittancePreview, setQuittancePreview] = useState<string | null>(null);

  const maxUnits = landlordDefaults.propertiesCount; // 0 = illimité
  const reachedLimit = maxUnits > 0 && units.length >= maxUnits;

  const refreshUnits = useCallback(async () => {
    if (!supabase || !user) return;
    try {
      setUnitsLoading(true);
      setUnitsError(null);
      const { data, error } = await supabase
        .from("rental_units")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setUnits((data || []) as RentalUnit[]);
    } catch (err: any) {
      setUnitsError(err?.message || "Impossible de charger vos biens loués pour le moment.");
    } finally {
      setUnitsLoading(false);
    }
  }, [user]);

  const refreshReceipts = useCallback(async () => {
    if (!supabase || !user) return;
    if (!units.length) {
      setReceipts([]);
      return;
    }
    try {
      setReceiptsLoading(true);
      const { data, error } = await supabase
        .from("rent_receipts")
        .select("*")
        .in("rental_unit_id", units.map((u) => u.id))
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setReceipts((data || []) as RentReceipt[]);
    } catch (err) {
      console.error("Erreur fetch quittances", err);
    } finally {
      setReceiptsLoading(false);
    }
  }, [user, units]);

  // Load units on login
  useEffect(() => {
    if (user) refreshUnits();
  }, [user, refreshUnits]);

  // Load receipts when units change
  useEffect(() => {
    if (user) refreshReceipts();
  }, [user, refreshReceipts]);

  // Sync form when selecting a unit
  useEffect(() => {
    setGlobalError(null);
    setGlobalMessage(null);
    setQuittancePreview(null);

    if (!selectedUnitId) {
      dispatch({ type: "reset" });
      return;
    }

    const unit = units.find((u) => u.id === selectedUnitId);
    if (!unit) return;

    dispatch({
      type: "load",
      payload: {
        label: unit.label || "",
        address: unit.address || "",
        tenantName: unit.tenant_name || "",
        tenantEmail: unit.tenant_email || "",
        rent: unit.rent_amount != null ? String(unit.rent_amount) : "",
        charges: unit.charges_amount != null ? String(unit.charges_amount) : "",
        paymentDay: unit.payment_day != null ? String(unit.payment_day) : "1",
        autoEnabled: !!unit.auto_quittance_enabled,
      },
    });
  }, [selectedUnitId, units]);

  // Save unit (create/update)
  const handleSaveUnit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;

    // bloque la création d’un nouveau bien si limite atteinte
    if (!selectedUnitId && reachedLimit) {
      setGlobalError(
        `Limite atteinte (${units.length}/${maxUnits}). Modifiez le nombre de biens dans /mon-compte?tab=bailleur.`
      );
      return;
    }

    setSavingUnit(true);
    setGlobalError(null);
    setGlobalMessage(null);

    try {
      const rentNum = parseFloat(form.rent || "0") || 0;
      const chargesNum = parseFloat(form.charges || "0") || 0;
      const paymentDayNum = Math.min(31, Math.max(1, parseInt(form.paymentDay || "1", 10) || 1));

      const payload = {
        user_id: user.id,
        label: form.label || "Logement sans titre",
        address: form.address || null,
        tenant_name: form.tenantName || null,
        tenant_email: form.tenantEmail || null,
        rent_amount: rentNum,
        charges_amount: chargesNum,
        payment_day: paymentDayNum,
        auto_quittance_enabled: form.autoEnabled,
      };

      if (selectedUnitId) {
        const { error } = await supabase
          .from("rental_units")
          .update(payload)
          .eq("id", selectedUnitId)
          .eq("user_id", user.id);
        if (error) throw error;
        setGlobalMessage("Bien mis à jour.");
      } else {
        const { data, error } = await supabase.from("rental_units").insert(payload).select().single();
        if (error) throw error;
        const created = data as RentalUnit;
        setGlobalMessage("Bien créé.");
        setSelectedUnitId(created.id);
      }

      await refreshUnits();
    } catch (err: any) {
      setGlobalError(err?.message || "Erreur lors de l’enregistrement du bien. Vérifiez les champs.");
    } finally {
      setSavingUnit(false);
    }
  };

  // Generate receipt for current month
  const handleGenerateReceiptForCurrentMonth = async (unit: RentalUnit) => {
    if (!supabase || !user) return;

    setGeneratingForId(unit.id);
    setGlobalError(null);
    setGlobalMessage(null);

    try {
      const now = new Date();
      const { start, end } = getMonthPeriod(now);

      const loyer = unit.rent_amount || 0;
      const charges = unit.charges_amount || 0;
      const total = loyer + charges;

      const texte = generateQuittanceText({
        bailleurNom: landlordDefaults.bailleurNom,
        bailleurAdresse: landlordDefaults.bailleurAdresse,
        locataireNom: unit.tenant_name || "Locataire",
        bienAdresse: unit.address || "",
        loyerHC: loyer,
        charges,
        periodeDebut: toISODate(start),
        periodeFin: toISODate(end),
        datePaiement: null,
        villeQuittance: landlordDefaults.villeQuittance,
        dateQuittance: toISODate(now),
        modePaiement: landlordDefaults.modePaiement,
        mentionSolde: true,
      });

      const { data, error } = await supabase
        .from("rent_receipts")
        .insert({
          rental_unit_id: unit.id,
          period_start: toISODate(start),
          period_end: toISODate(end),
          paid_at: null,
          total_amount: total,
          quittance_text: texte,
        })
        .select()
        .single();

      if (error) throw error;

      const created = data as RentReceipt;
      setReceipts((prev) => [created, ...prev]);
      setQuittancePreview(texte);
      setGlobalMessage("Quittance générée et stockée.");
    } catch (err: any) {
      console.error(err);
      setGlobalError(err?.message || "Erreur lors de la génération de la quittance.");
    } finally {
      setGeneratingForId(null);
    }
  };

  // -------------------------
  // UI: not logged in
  // -------------------------
  if (!loadingUser && !user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 px-4 py-6">
          <div className="max-w-xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-600">
              Quittances de loyer
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              Connectez-vous pour gérer vos quittances
            </h1>
            <p className="text-sm text-slate-600">
              Cet outil nécessite un compte afin de stocker vos biens, vos locataires et l&apos;historique
              de vos quittances.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/mon-compte?mode=login&redirect=/quittances-loyer")}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Me connecter
              </button>
              <button
                type="button"
                onClick={() => router.push("/mon-compte?mode=register&redirect=/quittances-loyer")}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Créer un compte bailleur
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------
  // UI: main
  // -------------------------
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* HEADER */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-600">
              Quittances de loyer
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Générez, stockez et automatisez vos quittances de loyer.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Déclarez vos biens loués et générez vos quittances mensuelles. L&apos;envoi automatique se fera
              côté serveur (cron / edge function) en s’appuyant sur vos paramètres.
            </p>

            {(!landlordDefaults.isLandlord || !landlordDefaults.landlordReady) && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Pensez à compléter votre{" "}
                <a className="underline" href="/mon-compte?tab=bailleur">
                  profil bailleur
                </a>{" "}
                (nom + adresse) pour générer des quittances propres.
              </div>
            )}

            {globalError && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {globalError}
              </div>
            )}
            {globalMessage && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {globalMessage}
              </div>
            )}
          </section>

          {/* LAYOUT */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr),minmax(0,1.2fr)]">
            {/* LEFT: units */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                    Mes biens loués
                  </p>
                  <p className="text-xs text-slate-600">
                    Sélectionnez un bien pour configurer les quittances.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedUnitId(null)}
                  disabled={reachedLimit}
                  className={
                    "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold " +
                    (reachedLimit
                      ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50")
                  }
                >
                  + Nouveau bien
                </button>
              </div>

              {maxUnits > 0 && (
                <div className="text-[0.7rem] text-slate-500">
                  Biens déclarés : <span className="font-semibold">{units.length}</span> / {maxUnits}
                  {reachedLimit && (
                    <>
                      {" "}
                      – Limite atteinte.{" "}
                      <a className="underline" href="/mon-compte?tab=bailleur">
                        Modifier le nombre de biens
                      </a>
                    </>
                  )}
                </div>
              )}

              {unitsLoading && <p className="text-xs text-slate-500">Chargement des biens…</p>}
              {unitsError && <p className="text-xs text-red-600">{unitsError}</p>}

              {!unitsLoading && !unitsError && units.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[0.75rem] text-slate-600">
                  Aucun bien déclaré. Créez votre premier bien pour générer vos quittances.
                </div>
              )}

              {!unitsLoading && units.length > 0 && (
                <div className="space-y-2">
                  {units.map((unit) => {
                    const active = unit.id === selectedUnitId;
                    return (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => setSelectedUnitId(unit.id)}
                        className={
                          "w-full text-left rounded-xl border px-3 py-2.5 text-xs transition " +
                          (active
                            ? "border-amber-400 bg-amber-50"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{unit.label || "Bien sans titre"}</p>
                            <p className="text-[0.7rem] text-slate-500 line-clamp-2">{unit.address}</p>
                            <p className="mt-1 text-[0.7rem] text-slate-600">
                              Locataire : <span className="font-medium">{unit.tenant_name || "—"}</span> • Loyer :{" "}
                              <span className="font-medium">{formatEuro(unit.rent_amount)}</span> + charges :{" "}
                              <span className="font-medium">{formatEuro(unit.charges_amount)}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[0.65rem] text-slate-500">
                              Jour prévu : <span className="font-semibold">{unit.payment_day ?? 1}</span>
                            </p>
                            <p
                              className={
                                "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] border " +
                                (unit.auto_quittance_enabled
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-500")
                              }
                            >
                              {unit.auto_quittance_enabled ? "Auto-quittance activée" : "Auto-quittance désactivée"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* RIGHT: form + actions */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                {currentUnit ? "Modifier le bien & l’auto-quittance" : "Nouveau bien à louer"}
              </p>

              <form onSubmit={handleSaveUnit} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Nom du bien</label>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) => dispatch({ type: "set", field: "label", value: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Nom du locataire</label>
                    <input
                      type="text"
                      value={form.tenantName}
                      onChange={(e) => dispatch({ type: "set", field: "tenantName", value: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">Adresse du logement loué</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => dispatch({ type: "set", field: "address", value: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Email du locataire (envoi auto)</label>
                    <input
                      type="email"
                      value={form.tenantEmail}
                      onChange={(e) => dispatch({ type: "set", field: "tenantEmail", value: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Loyer HC (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.rent}
                        onChange={(e) => dispatch({ type: "set", field: "rent", value: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">Charges (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.charges}
                        onChange={(e) => dispatch({ type: "set", field: "charges", value: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Jour habituel de paiement (1–31)</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={form.paymentDay}
                      onChange={(e) => dispatch({ type: "set", field: "paymentDay", value: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">Auto-quittance mensuelle</label>
                    <label className="inline-flex items-center gap-2 text-[0.8rem] text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.autoEnabled}
                        onChange={(e) => dispatch({ type: "set", field: "autoEnabled", value: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                      />
                      <span>Générer automatiquement une quittance chaque mois.</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingUnit}
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
                >
                  {savingUnit ? "Enregistrement..." : currentUnit ? "Mettre à jour ce bien" : "Créer ce bien"}
                </button>
              </form>

              {currentUnit && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                  <p className="text-[0.75rem] font-semibold text-slate-900">
                    Quittances pour : {currentUnit.label || "Bien sans titre"}
                  </p>
                  <p className="text-[0.7rem] text-slate-600">
                    Générez la quittance du mois en cours (stockée en base). L&apos;envoi automatique utilisera la
                    même logique côté serveur.
                  </p>

                  <button
                    type="button"
                    onClick={() => handleGenerateReceiptForCurrentMonth(currentUnit)}
                    disabled={!!generatingForId}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[0.75rem] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {generatingForId === currentUnit.id ? "Génération en cours..." : "Générer la quittance de ce mois"}
                  </button>

                  {quittancePreview && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 max-h-52 overflow-auto">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-1">
                        Aperçu de la dernière quittance générée
                      </p>
                      <pre className="whitespace-pre-wrap text-[0.75rem] text-slate-800 leading-relaxed">
                        {quittancePreview}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* History */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Historique des quittances</p>
            <p className="text-[0.75rem] text-slate-600">Dernières quittances générées et stockées en base.</p>

            {receiptsLoading && <p className="text-xs text-slate-500">Chargement...</p>}

            {!receiptsLoading && receipts.length === 0 && (
              <p className="text-[0.75rem] text-slate-500">Aucune quittance générée pour l&apos;instant.</p>
            )}

            {!receiptsLoading && receipts.length > 0 && (
              <div className="space-y-2 text-[0.75rem]">
                {receipts.map((r) => {
                  const unit = units.find((u) => u.id === r.rental_unit_id);
                  return (
                    <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{unit?.label || "Bien"}</p>
                          <p className="text-[0.7rem] text-slate-500">
                            Période du {r.period_start} au {r.period_end}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">{formatEuro(r.total_amount)}</p>
                          <p className="text-[0.7rem] text-slate-500">
                            Générée le {String(r.created_at || "").slice(0, 10)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="text-right">
            <a href="/outils-proprietaire" className="text-[0.75rem] text-slate-500 underline underline-offset-2">
              ← Retour à la boîte à outils propriétaire
            </a>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils pour propriétaires et investisseurs.
        </p>
        <p className="mt-1">
          Contact :{" "}
          <a href="mailto:mtcourtage@gmail.com" className="underline">
            mtcourtage@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
