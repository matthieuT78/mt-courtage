// pages/quittances-loyer.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  id: string;
  email?: string;
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

export default function QuittancesLoyerPage() {
  const router = useRouter();
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [units, setUnits] = useState<RentalUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  const [receipts, setReceipts] = useState<RentReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  const [savingUnit, setSavingUnit] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Formulaire "bien loué"
  const [formLabel, setFormLabel] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formTenantName, setFormTenantName] = useState("");
  const [formTenantEmail, setFormTenantEmail] = useState("");
  const [formRent, setFormRent] = useState<string>("");
  const [formCharges, setFormCharges] = useState<string>("");
  const [formPaymentDay, setFormPaymentDay] = useState<string>("1");
  const [formAutoEnabled, setFormAutoEnabled] = useState(true);

  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // --- Récupération session utilisateur ---
  useEffect(() => {
    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const sessionUser = data.session?.user ?? null;
        setUser(
          sessionUser
            ? { id: sessionUser.id, email: sessionUser.email ?? undefined }
            : null
        );
      } catch (e) {
        console.error("Erreur session quittances", e);
      } finally {
        setLoadingUser(false);
      }
    };
    fetchSession();
  }, []);

  // --- Charger les biens ---
  useEffect(() => {
    const fetchUnits = async () => {
      if (!supabase || !user) return;
      try {
        setUnitsLoading(true);
        setUnitsError(null);
        const { data, error } = await supabase
          .from("rental_units") // ← adapte au nom réel de ta table
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setUnits((data || []) as RentalUnit[]);
      } catch (err: any) {
        setUnitsError(
          err?.message || "Impossible de charger vos biens loués pour le moment."
        );
      } finally {
        setUnitsLoading(false);
      }
    };
    if (user) fetchUnits();
  }, [user]);

  // --- Charger les dernières quittances ---
  useEffect(() => {
    const fetchReceipts = async () => {
      if (!supabase || !user) return;
      try {
        setReceiptsLoading(true);
        const { data, error } = await supabase
          .from("rent_receipts") // ← adapte au nom réel
          .select("*")
          .in(
            "rental_unit_id",
            units.length ? units.map((u) => u.id) : ["00000000-0000-0000-0000-000000000000"]
          )
          .order("created_at", { ascending: false })
          .limit(30);

        if (error) throw error;
        setReceipts((data || []) as RentReceipt[]);
      } catch (err) {
        console.error("Erreur fetch quittances", err);
      } finally {
        setReceiptsLoading(false);
      }
    };
    if (user && units.length) fetchReceipts();
  }, [user, units]);

  // --- Pré-remplir le formulaire quand on sélectionne un bien ---
  useEffect(() => {
    if (!selectedUnitId) {
      setFormLabel("");
      setFormAddress("");
      setFormTenantName("");
      setFormTenantEmail("");
      setFormRent("");
      setFormCharges("");
      setFormPaymentDay("1");
      setFormAutoEnabled(true);
      return;
    }

    const unit = units.find((u) => u.id === selectedUnitId);
    if (!unit) return;

    setFormLabel(unit.label || "");
    setFormAddress(unit.address || "");
    setFormTenantName(unit.tenant_name || "");
    setFormTenantEmail(unit.tenant_email || "");
    setFormRent(unit.rent_amount != null ? String(unit.rent_amount) : "");
    setFormCharges(unit.charges_amount != null ? String(unit.charges_amount) : "");
    setFormPaymentDay(
      unit.payment_day != null ? String(unit.payment_day) : "1"
    );
    setFormAutoEnabled(unit.auto_quittance_enabled);
  }, [selectedUnitId, units]);

  // --- Helper format € ---
  const formatEuro = (val: number | null | undefined) => {
    if (val == null || Number.isNaN(val)) return "—";
    return val.toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // --- Génération texte quittance (même logique que ton modèle) ---
  const generateQuittanceText = (params: {
    bailleurNom: string;
    bailleurAdresse: string;
    locataireNom: string;
    bienAdresse: string;
    loyerHC: number;
    charges: number;
    periodeDebut: string;
    periodeFin: string;
    datePaiement?: string | null;
    villeQuittance?: string | null;
    dateQuittance?: string | null;
    modePaiement: "virement" | "prelevement" | "cheque" | "especes";
    mentionSolde: boolean;
  }) => {
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

    const periodeStr =
      periodeDebut && periodeFin
        ? `pour la période du ${formatDateFR(
            periodeDebut
          )} au ${formatDateFR(periodeFin)}`
        : "";

    const paiementStr = datePaiement
      ? `payé le ${formatDateFR(datePaiement)}`
      : "dû et réglé";

    const villeDateStr =
      villeQuittance && dateQuittance
        ? `${villeQuittance}, le ${formatDateFR(dateQuittance)}`
        : "";

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
      }, certifie avoir reçu de la part de ${
        locataireNom || "[Nom du locataire]"
      } la somme de ${formatEuro(total)} (${formatEuro(
        loyerHC
      )} de loyer hors charges et ${formatEuro(
        charges
      )} de provisions sur charges)${
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
  };

  // --- Soumission formulaire bien (create/update) ---
  const handleSaveUnit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    setSavingUnit(true);
    setGlobalError(null);
    setGlobalMessage(null);

    try {
      const rentNum = parseFloat(formRent || "0") || 0;
      const chargesNum = parseFloat(formCharges || "0") || 0;
      const paymentDayNum = parseInt(formPaymentDay || "1", 10);

      const payload = {
        user_id: user.id,
        label: formLabel || "Logement sans titre",
        address: formAddress || null,
        tenant_name: formTenantName || null,
        tenant_email: formTenantEmail || null,
        rent_amount: rentNum,
        charges_amount: chargesNum,
        payment_day: paymentDayNum,
        auto_quittance_enabled: formAutoEnabled,
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
        const { data, error } = await supabase
          .from("rental_units")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        const created = data as RentalUnit;
        setUnits((prev) => [...prev, created]);
        setSelectedUnitId(created.id);
        setGlobalMessage("Bien créé.");
      }

      // Rafraîchir liste
      const { data: newList, error: listError } = await supabase
        .from("rental_units")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (!listError && newList) {
        setUnits(newList as RentalUnit[]);
      }
    } catch (err: any) {
      setGlobalError(
        err?.message ||
          "Erreur lors de l’enregistrement du bien. Vérifiez les champs."
      );
    } finally {
      setSavingUnit(false);
    }
  };

  // --- Générer une quittance pour le mois courant pour un bien ---
  const [generatingForId, setGeneratingForId] = useState<string | null>(null);
  const [quittancePreview, setQuittancePreview] = useState<string | null>(null);

  const handleGenerateReceiptForCurrentMonth = async (unit: RentalUnit) => {
    if (!supabase || !user) return;
    setGeneratingForId(unit.id);
    setGlobalError(null);
    setGlobalMessage(null);

    try {
      // Période = mois courant (1er → dernier jour)
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-11

      const periodStart = new Date(year, month, 1);
      const periodEnd = new Date(year, month + 1, 0);

      const toISO = (d: Date) => d.toISOString().slice(0, 10);

      const loyer = unit.rent_amount || 0;
      const charges = unit.charges_amount || 0;

      const texte = generateQuittanceText({
        bailleurNom: user.email || "Bailleur",
        bailleurAdresse: "",
        locataireNom: unit.tenant_name || "Locataire",
        bienAdresse: unit.address || "",
        loyerHC: loyer,
        charges: charges,
        periodeDebut: toISO(periodStart),
        periodeFin: toISO(periodEnd),
        datePaiement: null,
        villeQuittance: "",
        dateQuittance: toISO(now),
        modePaiement: "virement",
        mentionSolde: true,
      });

      // Stockage en base
      const total = loyer + charges;

      const { data, error } = await supabase
        .from("rent_receipts")
        .insert({
          rental_unit_id: unit.id,
          period_start: toISO(periodStart),
          period_end: toISO(periodEnd),
          paid_at: null, // tu pourras le mettre à jour quand le loyer est reçu
          total_amount: total,
          quittance_text: texte,
        })
        .select()
        .single();

      if (error) throw error;

      const created = data as RentReceipt;
      setReceipts((prev) => [created, ...prev]);
      setGlobalMessage("Quittance générée et stockée.");

      setQuittancePreview(texte);

      // 👉 La partie "envoi d'e-mail automatique" se fera côté backend
      // (edge function / cron / trigger) en utilisant cette ligne.
    } catch (err: any) {
      console.error(err);
      setGlobalError(
        err?.message || "Erreur lors de la génération de la quittance."
      );
    } finally {
      setGeneratingForId(null);
    }
  };

  const currentUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) || null,
    [units, selectedUnitId]
  );

  // --- Si non connecté ---
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
              Cet outil nécessite un compte afin de stocker vos biens, vos locataires
              et l&apos;historique de vos quittances.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/mon-compte?mode=login&redirect=/quittances-loyer"
                  )
                }
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Me connecter
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/mon-compte?mode=register&redirect=/quittances-loyer"
                  )
                }
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
              Déclarez vos biens loués, activez l&apos;option d&apos;envoi automatique
              et laissez le système générer vos quittances chaque mois. Cette page
              gère uniquement la configuration et le stockage des quittances ; l&apos;
              envoi automatique se fera côté serveur (cron / edge function).
            </p>

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

          {/* LAYOUT 2 COLONNES : BIENS / FORM + QUITTANCES */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr),minmax(0,1.2fr)]">
            {/* Colonne gauche : liste des biens */}
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
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  + Nouveau bien
                </button>
              </div>

              {unitsLoading && (
                <p className="text-xs text-slate-500">Chargement des biens…</p>
              )}
              {unitsError && (
                <p className="text-xs text-red-600">{unitsError}</p>
              )}

              {!unitsLoading && !unitsError && units.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[0.75rem] text-slate-600">
                  Aucun bien déclaré pour le moment. Commencez par en créer un
                  (adresse + locataire + loyer) pour générer vos premières quittances.
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
                            <p className="font-semibold text-slate-900">
                              {unit.label || "Bien sans titre"}
                            </p>
                            <p className="text-[0.7rem] text-slate-500 line-clamp-2">
                              {unit.address}
                            </p>
                            <p className="mt-1 text-[0.7rem] text-slate-600">
                              Locataire :{" "}
                              <span className="font-medium">
                                {unit.tenant_name || "—"}
                              </span>{" "}
                              • Loyer :{" "}
                              <span className="font-medium">
                                {formatEuro(unit.rent_amount)}
                              </span>{" "}
                              + charges :{" "}
                              <span className="font-medium">
                                {formatEuro(unit.charges_amount)}
                              </span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[0.65rem] text-slate-500">
                              Jour prévu :{" "}
                              <span className="font-semibold">
                                J+{unit.payment_day ?? 1}
                              </span>
                            </p>
                            <p
                              className={
                                "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] border " +
                                (unit.auto_quittance_enabled
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-500")
                              }
                            >
                              {unit.auto_quittance_enabled
                                ? "Auto-quittance activée"
                                : "Auto-quittance désactivée"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Colonne droite : Formulaire bien + actions quittances */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                {currentUnit ? "Modifier le bien & l’auto-quittance" : "Nouveau bien à louer"}
              </p>

              <form onSubmit={handleSaveUnit} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Nom du bien (ex : T2 centre-ville)
                    </label>
                    <input
                      type="text"
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Nom du locataire
                    </label>
                    <input
                      type="text"
                      value={formTenantName}
                      onChange={(e) => setFormTenantName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[0.7rem] text-slate-700">
                    Adresse du logement loué
                  </label>
                  <textarea
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Adresse e-mail du locataire (pour envoi auto)
                    </label>
                    <input
                      type="email"
                      value={formTenantEmail}
                      onChange={(e) => setFormTenantEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">
                        Loyer mensuel hors charges (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRent}
                        onChange={(e) => setFormRent(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-700">
                        Provisions sur charges (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formCharges}
                        onChange={(e) => setFormCharges(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Jour habituel de paiement (1–31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={formPaymentDay}
                      onChange={(e) => setFormPaymentDay(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-700">
                      Auto-quittance mensuelle
                    </label>
                    <label className="inline-flex items-center gap-2 text-[0.8rem] text-slate-700">
                      <input
                        type="checkbox"
                        checked={formAutoEnabled}
                        onChange={(e) => setFormAutoEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
                      />
                      <span>
                        Générer automatiquement une quittance chaque mois (envoi réel
                        géré côté serveur).
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingUnit}
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
                >
                  {savingUnit
                    ? "Enregistrement..."
                    : currentUnit
                    ? "Mettre à jour ce bien"
                    : "Créer ce bien"}
                </button>
              </form>

              {/* Actions quittances sur le bien sélectionné */}
              {currentUnit && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                  <p className="text-[0.75rem] font-semibold text-slate-900">
                    Quittances pour : {currentUnit.label || "Bien sans titre"}
                  </p>
                  <p className="text-[0.7rem] text-slate-600">
                    Utilisez ce bouton pour générer immédiatement la quittance du
                    mois en cours (stockage en base). L&apos;envoi automatique mensuel
                    se fera ensuite via une tâche planifiée côté serveur qui appelera
                    cette même logique.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleGenerateReceiptForCurrentMonth(currentUnit)}
                    disabled={!!generatingForId}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-[0.75rem] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {generatingForId === currentUnit.id
                      ? "Génération en cours..."
                      : "Générer la quittance de ce mois"}
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

          {/* Historique rapides des quittances */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                  Historique des quittances
                </p>
                <p className="text-[0.75rem] text-slate-600">
                  Dernières quittances générées et stockées en base.
                </p>
              </div>
            </div>

            {receiptsLoading && (
              <p className="text-xs text-slate-500">Chargement...</p>
            )}

            {!receiptsLoading && receipts.length === 0 && (
              <p className="text-[0.75rem] text-slate-500">
                Aucune quittance générée pour l&apos;instant.
              </p>
            )}

            {!receiptsLoading && receipts.length > 0 && (
              <div className="space-y-2 text-[0.75rem]">
                {receipts.map((r) => {
                  const unit = units.find((u) => u.id === r.rental_unit_id);
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {unit?.label || "Bien"}
                          </p>
                          <p className="text-[0.7rem] text-slate-500">
                            Période du {r.period_start} au {r.period_end}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            {formatEuro(r.total_amount)}
                          </p>
                          <p className="text-[0.7rem] text-slate-500">
                            Générée le {r.created_at.slice(0, 10)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
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
