// pages/quittances-loyer.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type LeaseJoin = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;

  start_date: string;
  end_date: string | null;

  rent_amount: number;
  charges_amount: number;

  payment_day: number;
  payment_method: string;
  status: string;

  auto_quittance_enabled: boolean;
  auto_quittance_frequency: string | null; // added
  reminder_day_of_month: number | null; // existing
  auto_quittance_hour: number | null; // added
  timezone: string | null; // existing
  tenant_receipt_email: string | null;

  property: {
    id: string;
    label: string | null;
    address_line1: string | null;
    address_line2: string | null;
    postal_code: string | null;
    city: string | null;
    country: string | null;
  };

  tenant: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
};

type ReceiptJoin = {
  id: string;
  lease_id: string;

  period_start: string;
  period_end: string;

  rent_amount: number | null;
  charges_amount: number | null;
  total_amount: number | null;

  issue_date: string | null;
  issue_place: string | null;
  issued_at: string | null;

  content_text: string | null;
  pdf_url: string | null;

  sent_to_tenant_email: string | null;
  sent_at: string | null;

  created_at: string;

  lease?: {
    id: string;
    property?: { label: string | null };
    tenant?: { full_name: string | null };
  };
};

type PaymentMode = "virement" | "prelevement" | "cheque" | "especes";
type Frequency = "monthly" | "quarterly" | "yearly";

const formatEuro = (val: number | null | undefined) => {
  if (val == null || Number.isNaN(val)) return "—";
  return val.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
};

const formatDateFR = (val?: string | null) => {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "2-digit" });
};

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const getMonthPeriod = (base: Date) => {
  const y = base.getFullYear();
  const m = base.getMonth();
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
};

function paymentModeLabel(mode: PaymentMode) {
  switch (mode) {
    case "virement":
      return "par virement bancaire";
    case "cheque":
      return "par chèque";
    case "especes":
      return "en espèces";
    case "prelevement":
    default:
      return "par prélèvement";
  }
}

function buildPropertyAddress(p: LeaseJoin["property"]) {
  const lines = [
    p.address_line1,
    p.address_line2,
    [p.postal_code, p.city].filter(Boolean).join(" "),
    p.country,
  ].filter(Boolean);
  return lines.join(", ");
}

function generateQuittanceText(params: {
  bailleurNom: string;
  bailleurAdresse?: string | null;

  locataireNom: string;
  bienAdresse?: string | null;

  loyerHC: number;
  charges: number;

  periodeDebut: string;
  periodeFin: string;

  modePaiement: PaymentMode;
  villeQuittance?: string | null;
  dateQuittance: string;
  mentionSolde: boolean;
}) {
  const total = (params.loyerHC || 0) + (params.charges || 0);

  const lignes: string[] = [];
  lignes.push(params.bailleurNom || "Nom du bailleur");
  if (params.bailleurAdresse) lignes.push(params.bailleurAdresse);
  lignes.push("");

  lignes.push(`À l'attention de : ${params.locataireNom || "Nom du locataire"}`);
  lignes.push("");

  lignes.push("QUITTANCE DE LOYER");
  lignes.push("".padEnd(22, "="));
  lignes.push("");

  lignes.push(
    `Je soussigné(e) ${params.bailleurNom || "[Nom du bailleur]"}, propriétaire du logement situé ${
      params.bienAdresse || "[Adresse du logement]"
    }, certifie avoir reçu de la part de ${params.locataireNom || "[Nom du locataire]"} la somme de ${formatEuro(
      total
    )} (${formatEuro(params.loyerHC)} de loyer hors charges et ${formatEuro(params.charges)} de provisions sur charges) ` +
      `pour la période du ${formatDateFR(params.periodeDebut)} au ${formatDateFR(params.periodeFin)}, ${
        paymentModeLabel(params.modePaiement)
      }.`
  );

  lignes.push("");

  if (params.mentionSolde) {
    lignes.push(
      "La présente quittance vaut reçu pour toutes sommes versées à ce jour au titre des loyers et charges pour la période indiquée et éteint, à ce titre, toute dette de locataire envers le bailleur pour ladite période."
    );
    lignes.push("");
  }

  lignes.push(
    "La présente quittance ne préjuge en rien du paiement des loyers et charges antérieurs ou ultérieurs non quittancés."
  );
  lignes.push("");

  if (params.villeQuittance) {
    lignes.push(`${params.villeQuittance}, le ${formatDateFR(params.dateQuittance)}`);
    lignes.push("");
  } else {
    lignes.push(`Fait le ${formatDateFR(params.dateQuittance)}`);
    lignes.push("");
  }

  lignes.push("Signature du bailleur :");
  lignes.push("");
  lignes.push("____________________________________");
  return lignes.join("\n");
}

export default function QuittancesLoyerPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [leases, setLeases] = useState<LeaseJoin[]>([]);
  const [leasesLoading, setLeasesLoading] = useState(false);
  const [leasesError, setLeasesError] = useState<string | null>(null);

  const [receipts, setReceipts] = useState<ReceiptJoin[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);

  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const selectedLease = useMemo(
    () => leases.find((l) => l.id === selectedLeaseId) || null,
    [leases, selectedLeaseId]
  );

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const selectedReceipt = useMemo(
    () => receipts.find((r) => r.id === selectedReceiptId) || null,
    [receipts, selectedReceiptId]
  );

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [previewText, setPreviewText] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<"template" | "saved">("template");

  // Bailleur: pour l’instant on réutilise du metadata (comme tu fais dans /mon-compte)
  // Si tu as une table "landlords" + "profiles", on pourra remplacer ça après.
  const [bailleurNom, setBailleurNom] = useState("");
  const [bailleurAdresse, setBailleurAdresse] = useState("");
  const [villeQuittance, setVilleQuittance] = useState("");

  // Options quittance/template
  const [mentionSolde, setMentionSolde] = useState(true);

  // Auto-send params (stockés sur lease)
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoFrequency, setAutoFrequency] = useState<Frequency>("monthly");
  const [autoDay, setAutoDay] = useState<number>(5);
  const [autoHour, setAutoHour] = useState<number>(9);
  const [timezone, setTimezone] = useState<string>("Europe/Paris");

  const refreshLeases = async (uid: string) => {
    setLeasesLoading(true);
    setLeasesError(null);
    try {
      const { data, error } = await supabase
        .from("leases")
        .select(
          `
          *,
          property:properties(*),
          tenant:tenants(*)
        `
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeases((data || []) as any);
      if (!selectedLeaseId && (data || []).length) setSelectedLeaseId((data as any)[0].id);
    } catch (e: any) {
      setLeasesError(e?.message || "Impossible de charger vos baux.");
    } finally {
      setLeasesLoading(false);
    }
  };

  const refreshReceipts = async () => {
    setReceiptsLoading(true);
    setReceiptsError(null);
    try {
      const { data, error } = await supabase
        .from("rent_receipts")
        .select(
          `
          *,
          lease:leases(
            id,
            property:properties(label),
            tenant:tenants(full_name)
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setReceipts((data || []) as any);
    } catch (e: any) {
      setReceiptsError(e?.message || "Impossible de charger les quittances.");
    } finally {
      setReceiptsLoading(false);
    }
  };

  // Session
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const u = data.session?.user ?? null;
        if (!mounted) return;

        if (!u) {
          router.push("/mon-compte?mode=login&redirect=/quittances-loyer");
          return;
        }

        setUser(u);

        // hydrate bailleur depuis user_metadata (comme /mon-compte)
        const meta = u.user_metadata || {};
        setBailleurNom(meta.landlord_name || u.email || "Bailleur");
        setBailleurAdresse(meta.landlord_address || "");
        setVilleQuittance(meta.landlord_default_city || "");
      } finally {
        if (mounted) setLoadingUser(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // Load leases + receipts
  useEffect(() => {
    if (!user) return;
    refreshLeases(user.id);
    refreshReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // When lease changes, sync autosend fields
  useEffect(() => {
    if (!selectedLease) return;

    setAutoEnabled(!!selectedLease.auto_quittance_enabled);

    const f = (selectedLease.auto_quittance_frequency as Frequency) || "monthly";
    setAutoFrequency(f);

    setAutoDay(selectedLease.reminder_day_of_month ?? selectedLease.payment_day ?? 5);
    setAutoHour(selectedLease.auto_quittance_hour ?? 9);
    setTimezone(selectedLease.timezone || "Europe/Paris");

    // Reset preview when switching lease
    setPreviewText("");
    setPreviewMode("template");
    setSelectedReceiptId(null);
  }, [selectedLease]);

  // Click receipt => show saved text
  const openReceipt = (r: ReceiptJoin) => {
    setSelectedReceiptId(r.id);
    setPreviewMode("saved");
    setPreviewText(r.content_text || "");
  };

  // Preview template without saving
  const handlePreview = () => {
    if (!selectedLease) return;
    const now = new Date();
    const { start, end } = getMonthPeriod(now);

    const texte = generateQuittanceText({
      bailleurNom,
      bailleurAdresse,
      locataireNom: selectedLease.tenant.full_name || "Locataire",
      bienAdresse: buildPropertyAddress(selectedLease.property),
      loyerHC: selectedLease.rent_amount || 0,
      charges: selectedLease.charges_amount || 0,
      periodeDebut: toISODate(start),
      periodeFin: toISODate(end),
      modePaiement: (selectedLease.payment_method as PaymentMode) || "virement",
      villeQuittance: villeQuittance || null,
      dateQuittance: toISODate(now),
      mentionSolde,
    });

    setPreviewMode("template");
    setPreviewText(texte);
    setSelectedReceiptId(null);
  };

  // Generate & save receipt
  const handleGenerateAndSave = async () => {
    if (!selectedLease) return;

    setErr(null);
    setMsg(null);

    try {
      const now = new Date();
      const { start, end } = getMonthPeriod(now);

      const rent = selectedLease.rent_amount || 0;
      const charges = selectedLease.charges_amount || 0;
      const total = rent + charges;

      const content = generateQuittanceText({
        bailleurNom,
        bailleurAdresse,
        locataireNom: selectedLease.tenant.full_name || "Locataire",
        bienAdresse: buildPropertyAddress(selectedLease.property),
        loyerHC: rent,
        charges,
        periodeDebut: toISODate(start),
        periodeFin: toISODate(end),
        modePaiement: (selectedLease.payment_method as PaymentMode) || "virement",
        villeQuittance: villeQuittance || null,
        dateQuittance: toISODate(now),
        mentionSolde,
      });

      const { data, error } = await supabase
        .from("rent_receipts")
        .insert({
          lease_id: selectedLease.id,
          period_start: toISODate(start),
          period_end: toISODate(end),
          rent_amount: rent,
          charges_amount: charges,
          total_amount: total,
          issue_date: toISODate(now),
          issue_place: villeQuittance || null,
          issued_at: new Date().toISOString(),
          content_text: content,
          sent_to_tenant_email: selectedLease.tenant_receipt_email || selectedLease.tenant.email || null,
        })
        .select()
        .single();

      if (error) throw error;

      setMsg("Quittance générée & enregistrée ✅");
      setPreviewMode("saved");
      setPreviewText(content);

      // Refresh list (or prepend)
      setReceipts((prev) => [data as any, ...prev]);
      setSelectedReceiptId((data as any).id);
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de la génération/enregistrement de la quittance.");
    }
  };

  // Save autosend config on lease
  const handleSaveAutoSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLease) return;

    setErr(null);
    setMsg(null);

    try {
      const day = Math.max(1, Math.min(28, Number(autoDay) || 5));
      const hour = Math.max(0, Math.min(23, Number(autoHour) || 9));

      const { error } = await supabase
        .from("leases")
        .update({
          auto_quittance_enabled: autoEnabled,
          auto_quittance_frequency: autoFrequency,
          reminder_day_of_month: day,
          auto_quittance_hour: hour,
          timezone,
          tenant_receipt_email:
            selectedLease.tenant_receipt_email ||
            selectedLease.tenant.email ||
            null,
        })
        .eq("id", selectedLease.id);

      if (error) throw error;

      setMsg("Paramètres d’envoi automatique enregistrés ✅");
      // refresh leases to keep UI synced
      await refreshLeases(user.id);
    } catch (e: any) {
      setErr(e?.message || "Erreur enregistrement envoi automatique.");
    }
  };

  if (!loadingUser && !user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-6xl mx-auto grid gap-5 lg:grid-cols-[320px,1fr,1fr]">
          {/* LEFT: receipts list */}
          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 h-fit">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500 mb-2">
              Quittances enregistrées
            </p>

            {receiptsLoading && <p className="text-xs text-slate-500">Chargement…</p>}
            {receiptsError && <p className="text-xs text-red-600">{receiptsError}</p>}

            {!receiptsLoading && !receiptsError && receipts.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Aucune quittance enregistrée pour l’instant.  
                Clique sur <span className="font-semibold">Générer & enregistrer</span>.
              </div>
            )}

            <div className="mt-2 space-y-2 max-h-[70vh] overflow-auto pr-1">
              {receipts.map((r) => {
                const active = r.id === selectedReceiptId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openReceipt(r)}
                    className={
                      "w-full text-left rounded-xl border px-3 py-2 text-xs transition " +
                      (active
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                    }
                  >
                    <p className="font-semibold text-slate-900">
                      {(r.lease?.property?.label || "Bien") + " — " + (r.lease?.tenant?.full_name || "Locataire")}
                    </p>
                    <p className="text-[0.7rem] text-slate-500">
                      Période {r.period_start} → {r.period_end}
                    </p>
                    <p className="text-[0.7rem] text-slate-700">
                      Total : <span className="font-semibold">{formatEuro(r.total_amount)}</span>
                      {" · "}
                      Émise : {formatDateFR(r.issue_date)}
                    </p>
                    <p className="mt-1 text-[0.65rem]">
                      <span
                        className={
                          "inline-flex items-center rounded-full border px-2 py-0.5 " +
                          (r.sent_at
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-500")
                        }
                      >
                        {r.sent_at ? "Envoyée" : "Non envoyée"}
                      </span>
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* MIDDLE: lease + actions */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-600 mb-1">
              Quittances de loyer
            </p>
            <h1 className="text-lg font-semibold text-slate-900">Générer & automatiser</h1>
            <p className="text-xs text-slate-600 mt-1">
              Choisis un bail, prévisualise le modèle, puis enregistre la quittance.
            </p>

            {err && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {err}
              </div>
            )}
            {msg && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {msg}
              </div>
            )}

            {/* Lease picker */}
            <div className="mt-4 space-y-2">
              <label className="text-xs text-slate-700">Bail (bien + locataire)</label>
              {leasesLoading && <p className="text-xs text-slate-500">Chargement…</p>}
              {leasesError && <p className="text-xs text-red-600">{leasesError}</p>}

              <select
                value={selectedLeaseId ?? ""}
                onChange={(e) => setSelectedLeaseId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Sélectionner…
                </option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {(l.property.label || "Bien") + " — " + (l.tenant.full_name || "Locataire")}
                  </option>
                ))}
              </select>
            </div>

            {/* Bailleur quick edit for template */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Nom bailleur (quittance)</label>
                <input
                  value={bailleurNom}
                  onChange={(e) => setBailleurNom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700">Ville (signature)</label>
                <input
                  value={villeQuittance}
                  onChange={(e) => setVilleQuittance(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs text-slate-700">Adresse bailleur</label>
                <textarea
                  rows={2}
                  value={bailleurAdresse}
                  onChange={(e) => setBailleurAdresse(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={mentionSolde}
                  onChange={(e) => setMentionSolde(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>Inclure la mention “solde de tout compte”</span>
              </label>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={!selectedLease}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                Prévisualiser
              </button>

              <button
                type="button"
                onClick={handleGenerateAndSave}
                disabled={!selectedLease}
                className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
              >
                Générer & enregistrer
              </button>

              <button
                type="button"
                onClick={() => router.push("/mon-compte?tab=bailleur")}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Paramètres bailleur
              </button>
            </div>

            {/* Auto-send */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[0.75rem] font-semibold text-slate-900 mb-2">
                Envoi automatique
              </p>
              <form onSubmit={handleSaveAutoSend} className="space-y-3">
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoEnabled}
                    onChange={(e) => setAutoEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>Activer l’envoi automatique des quittances</span>
                </label>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">Fréquence</label>
                    <select
                      value={autoFrequency}
                      onChange={(e) => setAutoFrequency(e.target.value as Frequency)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="monthly">Mensuel</option>
                      <option value="quarterly">Trimestriel</option>
                      <option value="yearly">Annuel</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">Jour (1–28)</label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={autoDay}
                      onChange={(e) => setAutoDay(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">Heure (0–23)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={autoHour}
                      onChange={(e) => setAutoHour(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <p className="text-[0.65rem] text-slate-500">Par défaut : 09h</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">Fuseau horaire</label>
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  <p className="text-[0.65rem] text-slate-500">Ex: Europe/Paris</p>
                </div>

                <button
                  type="submit"
                  disabled={!selectedLease}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Enregistrer l’envoi auto
                </button>
              </form>
            </div>
          </section>

          {/* RIGHT: Preview */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                  Aperçu
                </p>
                <p className="text-xs text-slate-600">
                  {previewMode === "saved" ? "Quittance enregistrée" : "Modèle / prévisualisation"}
                </p>
              </div>

              {selectedReceipt?.pdf_url && (
                <a
                  href={selectedReceipt.pdf_url}
                  className="text-xs underline text-slate-600"
                  target="_blank"
                  rel="noreferrer"
                >
                  Ouvrir PDF
                </a>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 h-[70vh] overflow-auto">
              {previewText ? (
                <pre className="whitespace-pre-wrap text-[0.78rem] text-slate-800 leading-relaxed">
                  {previewText}
                </pre>
              ) : (
                <p className="text-xs text-slate-500">
                  Clique sur <span className="font-semibold">Prévisualiser</span> ou sélectionne une quittance à gauche.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="max-w-6xl mx-auto mt-4 text-right">
          <a href="/outils-proprietaire" className="text-[0.75rem] text-slate-500 underline underline-offset-2">
            ← Retour à la boîte à outils propriétaire
          </a>
        </div>
      </main>
    </div>
  );
}
