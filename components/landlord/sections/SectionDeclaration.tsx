import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import type { Property } from "../../../lib/landlord/types";
import { usePermissions } from "../../PermissionProvider";
import { planAllowsPerformance } from "../../../lib/permissions";
import { LockedPremiumSection } from "../LockedPremiumSection";

type Regime = "lmnp_micro" | "lmnp_reel" | "nu_micro" | "nu_reel" | "pinel";
// meuble_saisonnier_classe = tourisme classé → abattement 71%
type LocationKind = "meuble_longue" | "meuble_saisonnier" | "meuble_saisonnier_classe";
type DeclarationStep = "diagnostic" | "prepare" | "verify" | "export";

type Stored = {
  id: string;
  data: Record<string, unknown>;
};

type Transaction = {
  id: string;
  user_id: string;
  property_id: string | null;
  occurred_at: string;
  direction: "in" | "out";
  status: "expected" | "received" | "paid";
  category: string;
  label: string | null;
  amount: number;
  notes: string | null;
  is_recurring?: boolean | null;
  recurrence_parent_id?: string | null;
};

type ImportTotals = {
  rows: Transaction[];
  grossRent: number;
  chargesRecovered: number;
  otherIncome: number;
  propertyTax: number;
  insurance: number;
  copro: number;
  repairs: number;
  managementFees: number;
  utilities: number;
  interest: number;
  otherExpenses: number;
};

type PropertyFinance = {
  property_id: string;
  tax_regime?: string | null;
  purchase_price?: number | null;
  notary_fees?: number | null;
  agency_fees?: number | null;
  works?: number | null;
};

type Props = {
  userId: string;
  properties?: Property[];
  propertyFinance?: PropertyFinance[];
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function eur(n: number) {
  if (!Number.isFinite(n)) return "0 €";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function toNumber(v: unknown) {
  const n = typeof v === "number" ? v : parseFloat(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function currentYear() {
  return new Date().getFullYear();
}

function yearRange(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

// FR-locale number for CSV (comma decimal, no currency symbol)
function csvNum(n: number) {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(2).replace(".", ",");
}

function csvCell(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-600">{sub}</p> : null}
    </div>
  );
}

function Field({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      {hint ? <p className="text-[0.7rem] text-slate-500 leading-4">{hint}</p> : null}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(toNumber(e.target.value))}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        min={0}
      />
    </div>
  );
}

const REGIME_LABELS: Record<Regime, string> = {
  lmnp_micro: "LMNP · Micro-BIC",
  lmnp_reel: "LMNP · Réel",
  nu_micro: "Location nue · Micro-foncier",
  nu_reel: "Location nue · Réel",
  pinel: "Pinel",
};

function regimeLabel(regime: Regime) {
  return REGIME_LABELS[regime] || regime;
}

function statusToneClass(tone: "emerald" | "amber" | "red" | "slate") {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "red") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

// Catégories Finance qui ne sont pas des revenus fiscaux
const DEPOSIT_CATEGORIES = new Set(["deposit_collected", "deposit_returned", "deposit"]);

// Taux de réduction d'impôt Pinel selon durée d'engagement
const PINEL_RATES: Record<number, number> = { 6: 0.12, 9: 0.18, 12: 0.21 };

export function SectionDeclaration({ userId, properties, propertyFinance }: Props) {
  const { loading: permissionsLoading, plan } = usePermissions();
  const isPremium = planAllowsPerformance(plan);

  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  const safeProperties = Array.isArray(properties) ? properties : [];
  const propertyById = useMemo(() => new Map(safeProperties.map((p) => [p.id, p])), [safeProperties]);

  // Grouper les biens par catégorie fiscale (depuis property_finance.tax_regime)
  const fiscalGroups = useMemo(() => {
    const lmnp: string[] = [];
    const nu: string[] = [];
    const pinel: string[] = [];
    for (const fin of propertyFinance || []) {
      const tr = fin.tax_regime || "";
      if (tr === "lmnp_micro" || tr === "lmnp_real") lmnp.push(fin.property_id);
      else if (tr === "nu_micro" || tr === "nu_real") nu.push(fin.property_id);
      else if (tr === "pinel") pinel.push(fin.property_id);
    }
    return { lmnp, nu, pinel };
  }, [propertyFinance]);

  const years = useMemo(() => {
    const y = currentYear();
    return [y, y - 1, y - 2, y - 3];
  }, []);

  const [year, setYear] = useState<number>(years[1] ?? currentYear() - 1);
  const [regime, setRegime] = useState<Regime>("lmnp_micro");

  // IDs des biens contribuant au régime actif (après déclaration de `regime`)
  const relevantPropertyIds = useMemo(() => {
    if (regime.startsWith("lmnp")) return new Set(fiscalGroups.lmnp);
    if (regime.startsWith("nu")) return new Set(fiscalGroups.nu);
    if (regime === "pinel") return new Set(fiscalGroups.pinel);
    return new Set<string>();
  }, [regime, fiscalGroups]);

  const [locationKind, setLocationKind] = useState<LocationKind>("meuble_longue");
  // Recettes
  const [grossRent, setGrossRent] = useState(0);
  const [chargesRecovered, setChargesRecovered] = useState(0);
  const [otherIncome, setOtherIncome] = useState(0);
  const [depositReceived, setDepositReceived] = useState(0);

  // Charges déductibles communes
  const [interest, setInterest] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [propertyTax, setPropertyTax] = useState(0);
  const [copro, setCopro] = useState(0);
  const [repairs, setRepairs] = useState(0);
  const [managementFees, setManagementFees] = useState(0);
  const [utilities, setUtilities] = useState(0);
  const [otherExpenses, setOtherExpenses] = useState(0);

  // LMNP réel : amortissements (mobilier uniquement en non-pro)
  const [amortizationMobilier, setAmortizationMobilier] = useState(0);
  const [amortizationImmobilier, setAmortizationImmobilier] = useState(0);
  // Stock d'amortissements non utilisés des exercices précédents (reportés indéfiniment en LMNP non-pro)
  const [lmnpCarryForward, setLmnpCarryForward] = useState(0);

  // Nu réel : CFE (Cotisation Foncière des Entreprises)
  const [cfe, setCfe] = useState(0);

  // Pinel
  const [pinelAddress, setPinelAddress] = useState("");
  const [pinelAcqYear, setPinelAcqYear] = useState<number>(currentYear() - 1);
  const [pinelAcqPrice, setPinelAcqPrice] = useState(0);
  const [pinelCommitmentYears, setPinelCommitmentYears] = useState<number>(6);

  const [showGuide, setShowGuide] = useState(() => {
    try { return localStorage.getItem("lokt_decl_guide_dismissed") !== "1"; } catch { return true; }
  });
  const dismissGuide = () => {
    setShowGuide(false);
    try { localStorage.setItem("lokt_decl_guide_dismissed", "1"); } catch { /* noop */ }
  };

  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [financeRows, setFinanceRows] = useState<Transaction[]>([]);
  const [importPreview, setImportPreview] = useState<ImportTotals | null>(null);
  const [activeStep, setActiveStep] = useState<DeclarationStep>("diagnostic");

  const isLmnp = regime.startsWith("lmnp");
  const isNu = regime.startsWith("nu");
  const isPinel = regime === "pinel";
  const isReal = regime.endsWith("reel");
  const isMicro = regime.endsWith("micro");

  const pinelPropertyId = fiscalGroups.pinel[0] ?? null;

  // Recettes fiscales (hors dépôt de garantie)
  const receiptsTotal = grossRent + chargesRecovered + otherIncome;

  // Charges communes (toutes options) — hors CFE (spécifique nu réel)
  const commonCharges = interest + insurance + propertyTax + copro + repairs + managementFees + utilities + otherExpenses;

  // Abattement micro-BIC selon type de meublé
  // Longue durée / saisonnier non classé : 50% → base = 50%
  // Meublé de tourisme classé : 71% → base = 29%
  const microBicRate = locationKind === "meuble_saisonnier_classe" ? 0.29 : 0.5;
  const microBicBase = Math.max(0, receiptsTotal * microBicRate);

  // Micro-foncier : abattement 30% → base = 70%
  const microFoncierBase = Math.max(0, receiptsTotal * 0.7);

  // LMNP réel : calcul en deux étapes (règle fiscale : amortissements ne peuvent pas créer un déficit BIC non-pro)
  // Étape 1 : résultat avant amortissements
  const resultBeforeAmort = receiptsTotal - commonCharges;
  // Étape 2 : déficit BIC réel (charges > recettes, hors amortissements) — reportable 10 ans sur BIC non-pro
  const lmnpBicDeficit = Math.min(0, resultBeforeAmort);
  // Étape 3 : amortissements disponibles = mobilier N + stock reporté des années précédentes
  const amortizationTotal = amortizationMobilier + lmnpCarryForward;
  // Étape 4 : amortissements effectivement déduits (plafonnés au résultat disponible)
  const amortizationUsed = Math.min(amortizationTotal, Math.max(0, resultBeforeAmort));
  // Étape 5 : stock à reporter sur N+1 (sans limite de durée)
  const amortizationDeferred = amortizationTotal - amortizationUsed;
  // Résultat fiscal : 0 si amortissements couvrent, bénéfice sinon
  const realLmnpBase = Math.max(0, resultBeforeAmort) - amortizationUsed;

  // Nu réel : résultat net (peut être négatif → déficit foncier imputable 10 700 €/an sur revenu global)
  const realNuBase = receiptsTotal - commonCharges - cfe;

  // Pinel : revenu foncier = same base as nu réel, mais avec réduction d'impôt séparée
  const pinelRate = PINEL_RATES[pinelCommitmentYears] ?? 0.12;
  const pinelAcqPriceCapped = Math.min(pinelAcqPrice, 300_000);
  const pinelTotalReduction = pinelAcqPriceCapped * pinelRate;
  const pinelYearlyReduction = pinelCommitmentYears > 0 ? Math.round(pinelTotalReduction / pinelCommitmentYears) : 0;
  const pinelRevenusBase = realNuBase; // Pinel = location nue, base imposable = réel ou micro-foncier

  // Base imposable selon régime actif — utilisée dans les stats de synthèse
  const taxableApprox =
    regime === "lmnp_micro" ? microBicBase :
    regime === "lmnp_reel" ? realLmnpBase :
    regime === "nu_micro" ? microFoncierBase :
    regime === "nu_reel" ? realNuBase :
    isPinel ? pinelRevenusBase :
    0;

  // Charges affichées dans la stat "Charges" (contextualisées)
  const chargesStatDisplay =
    regime === "nu_reel" ? commonCharges + cfe :
    regime === "lmnp_reel" ? commonCharges + amortizationUsed :
    commonCharges;

  const recommendedMode = isLmnp
    ? realLmnpBase < microBicBase
      ? "Le réel LMNP semble plus favorable à vérifier."
      : "Le micro-BIC semble suffisant à ce stade."
    : isNu
    ? realNuBase < microFoncierBase
      ? "Le réel foncier semble plus favorable à vérifier."
      : "Le micro-foncier semble suffisant à ce stade."
    : "";

  const categoryLabel =
    isLmnp ? `LMNP — ${isMicro ? "Micro-BIC" : "Réel"} (${fiscalGroups.lmnp.length} bien${fiscalGroups.lmnp.length > 1 ? "s" : ""})` :
    isPinel ? `Pinel (${fiscalGroups.pinel.length} bien${fiscalGroups.pinel.length > 1 ? "s" : ""})` :
    isNu ? `Location nue — ${isMicro ? "Micro-foncier" : "Réel"} (${fiscalGroups.nu.length} bien${fiscalGroups.nu.length > 1 ? "s" : ""})` :
    "Catégorie à définir";

  const resetFormFields = () => {
    setRowId(null);
    setLocationKind("meuble_longue");
    setGrossRent(0); setChargesRecovered(0); setOtherIncome(0); setDepositReceived(0);
    setInterest(0); setInsurance(0); setPropertyTax(0); setCopro(0);
    setRepairs(0); setManagementFees(0); setUtilities(0); setOtherExpenses(0);
    setAmortizationMobilier(0); setAmortizationImmobilier(0); setLmnpCarryForward(0); setCfe(0);
    setPinelCommitmentYears(6);
    // Pinel : auto-fill depuis la fiche bien + Finance plutôt que vider les champs
    if (isPinel && pinelPropertyId) {
      const p = propertyById.get(pinelPropertyId);
      const addr = p ? [p.address_line1, p.postal_code, p.city].filter(Boolean).join(", ") : "";
      setPinelAddress(addr || "");
      const fin = (propertyFinance || []).find((f) => f.property_id === pinelPropertyId);
      const total = fin ? (fin.purchase_price || 0) + (fin.notary_fees || 0) + (fin.agency_fees || 0) + (fin.works || 0) : 0;
      setPinelAcqPrice(total);
    } else {
      setPinelAddress(""); setPinelAcqPrice(0);
    }
  };

  const load = async () => {
    if (!supabase || !userId || !isPremium) return;
    setLoading(true);
    setErr(null);
    setInfo(null);

    try {
      const { data, error } = await supabase
        .from("tax_declarations")
        .select("*")
        .eq("user_id", userId)
        .eq("year", year)
        .eq("regime", regime)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        resetFormFields();
        setInfo("Aucune préparation sauvegardée pour ce bien / exercice.");
        return;
      }

      const d = ((data as Stored).data || {}) as Record<string, unknown>;
      setRowId((data as Stored).id);
      setLocationKind((d.locationKind as LocationKind) || "meuble_longue");
      setGrossRent(toNumber(d.grossRent));
      setChargesRecovered(toNumber(d.chargesRecovered));
      setOtherIncome(toNumber(d.otherIncome));
      setDepositReceived(toNumber(d.depositReceived));
      setInterest(toNumber(d.interest));
      setInsurance(toNumber(d.insurance));
      setPropertyTax(toNumber(d.propertyTax));
      setCopro(toNumber(d.copro));
      setRepairs(toNumber(d.repairs));
      setManagementFees(toNumber(d.managementFees));
      setUtilities(toNumber(d.utilities));
      setOtherExpenses(toNumber(d.otherExpenses));
      // Backward compat: anciens dossiers avaient "amortization" (sans split)
      setAmortizationMobilier(toNumber(d.amortizationMobilier ?? d.amortization));
      setAmortizationImmobilier(toNumber(d.amortizationImmobilier));
      setLmnpCarryForward(toNumber(d.lmnpCarryForward));
      setCfe(toNumber(d.cfe));
      setPinelAddress(String(d.pinelAddress || ""));
      setPinelAcqYear(Number.isFinite(d.pinelAcqYear) ? (d.pinelAcqYear as number) : currentYear() - 1);
      setPinelAcqPrice(toNumber(d.pinelAcqPrice));
      setPinelCommitmentYears(Number.isFinite(d.pinelCommitmentYears) ? (d.pinelCommitmentYears as number) : 6);
      setInfo("Préparation chargée ✅");
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Impossible de charger la préparation.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!supabase || !userId || !isPremium) return;
    setLoading(true);
    setErr(null);
    setInfo(null);

    try {
      const payload = {
        user_id: userId,
        year,
        regime,
        data: {
          locationKind,
          grossRent,
          chargesRecovered,
          otherIncome,
          depositReceived,
          interest,
          insurance,
          propertyTax,
          copro,
          repairs,
          managementFees,
          utilities,
          otherExpenses,
          amortizationMobilier,
          amortizationImmobilier,
          lmnpCarryForward,
          cfe,
          pinelAddress,
          pinelAcqYear,
          pinelAcqPrice,
          pinelCommitmentYears,
          savedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("tax_declarations")
        .upsert(payload, { onConflict: "user_id,year,regime" })
        .select("id")
        .single();

      if (error) throw error;
      setRowId((data as { id: string })?.id || null);
      setInfo("Dossier déclaration sauvegardé ✅");
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Erreur de sauvegarde.");
    } finally {
      setLoading(false);
    }
  };

  const buildImportTotals = (rows: Transaction[]): ImportTotals => {
    // Exclure les dépôts de garantie et les parents récurrents (templates).
    // Les instances enfants (recurrence_parent_id != null) sont des paiements réels → conservées.
    const receivedIncome = rows.filter(
      (r) => r.direction === "in" && r.status === "received" && !DEPOSIT_CATEGORIES.has(r.category) && r.is_recurring !== true
    );
    const paidExpenses = rows.filter((r) => r.direction === "out" && r.status === "paid" && r.is_recurring !== true);
    const sum = (list: Transaction[]) => list.reduce((acc, r) => acc + Number(r.amount || 0), 0);

    return {
      rows,
      grossRent: sum(receivedIncome.filter((r) => r.category === "rent")),
      chargesRecovered: sum(receivedIncome.filter((r) => r.category === "charges_recovered")),
      otherIncome: sum(receivedIncome.filter((r) => r.category !== "rent" && r.category !== "charges_recovered")),
      interest: sum(paidExpenses.filter((r) => r.category === "loan_interest" || r.category === "interest")),
      propertyTax: sum(paidExpenses.filter((r) => r.category === "tax")),
      insurance: sum(paidExpenses.filter((r) => r.category === "insurance")),
      copro: sum(paidExpenses.filter((r) => r.category === "copro")),
      repairs: sum(paidExpenses.filter((r) => r.category === "repairs")),
      managementFees: sum(paidExpenses.filter((r) => r.category === "management" || r.category === "fees")),
      utilities: sum(paidExpenses.filter((r) => r.category === "utilities")),
      otherExpenses: sum(
        paidExpenses.filter(
          // "loan" = mensualité crédit (capital + intérêts) → non déductible en tant que tel
          // seul "loan_interest" / "interest" l'est ; exclure "loan" évite de gonfler les charges
          (r) => !["tax", "insurance", "copro", "repairs", "management", "fees", "utilities", "loan_interest", "interest", "loan"].includes(r.category)
        )
      ),
    };
  };

  const applyImportPreview = (preview = importPreview) => {
    if (!preview) return;
    setFinanceRows(preview.rows);
    setGrossRent(preview.grossRent);
    setChargesRecovered(preview.chargesRecovered);
    setOtherIncome(preview.otherIncome);
    setInterest(preview.interest);
    setPropertyTax(preview.propertyTax);
    setInsurance(preview.insurance);
    setCopro(preview.copro);
    setRepairs(preview.repairs);
    setManagementFees(preview.managementFees);
    setUtilities(preview.utilities);
    setOtherExpenses(preview.otherExpenses);
    setImportPreview(null);
    setInfo(`Montants Finance appliqués ✅ (${preview.rows.length} écriture${preview.rows.length > 1 ? "s" : ""})`);
  };

  const importFromFinance = async () => {
    if (!supabase || !userId || !isPremium) return;
    setLoading(true);
    setErr(null);
    setInfo(null);

    try {
      const { start, end } = yearRange(year);
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("occurred_at", start)
        .lte("occurred_at", end)
        .order("occurred_at", { ascending: true });

      if (relevantPropertyIds.size > 0) query = query.in("property_id", Array.from(relevantPropertyIds));
      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Transaction[];
      const preview = buildImportTotals(rows);
      setImportPreview(preview);
      setInfo(`Finance a trouvé ${rows.length} écriture${rows.length > 1 ? "s" : ""} (dépôts exclus). Vérifiez l'aperçu avant application.`);
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Impossible d'importer depuis Finance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoading && isPremium) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, year, regime, permissionsLoading, isPremium]);

  const alerts = useMemo(() => {
    const list: Array<{ tone: "amber" | "red" | "emerald"; text: string }> = [];

    if (depositReceived > 0)
      list.push({ tone: "amber", text: "Dépôt de garantie saisi : ne l'intégrez pas aux recettes sauf s'il est conservé définitivement." });

    if (isNu && receiptsTotal > 15000 && isMicro)
      list.push({ tone: "red", text: "Plafond micro-foncier dépassé : les recettes > 15 000 € imposent le régime réel foncier." });

    if (isMicro && interest > 0)
      list.push({ tone: "amber", text: `Intérêts d'emprunt (${eur(interest)}) : non déductibles en régime micro (abattement forfaitaire). Inutile de les saisir sauf pour comparaison réel.` });

    if (isLmnp && realLmnpBase + 1000 < microBicBase)
      list.push({ tone: "amber", text: "Le réel LMNP semble plus favorable que le micro-BIC. À confirmer avec un comptable." });

    if (isNu && !isPinel && realNuBase + 1000 < microFoncierBase)
      list.push({ tone: "amber", text: "Le réel foncier semble plus favorable que le micro-foncier. Vérifiez les charges déductibles." });

    if (regime === "lmnp_reel" && amortizationMobilier === 0 && lmnpCarryForward === 0)
      list.push({ tone: "amber", text: "LMNP réel sans amortissement mobilier : le résultat est probablement surévalué. Indiquez les amortissements pratiqués." });

    if (regime === "lmnp_reel" && amortizationDeferred > 0)
      list.push({ tone: "amber", text: `${eur(amortizationDeferred)} d'amortissements non utilisés à reporter sur ${year + 1}. Notez ce montant pour le pré-renseigner dans le dossier ${year + 1}.` });

    if (regime === "lmnp_reel" && amortizationImmobilier > 0)
      list.push({ tone: "red", text: `Amortissement immobilier (${eur(amortizationImmobilier)}) : non déductible en LMNP non-professionnel. Seul le mobilier s'amortit. Vérifiez avec votre comptable.` });

    if (isPinel && pinelAcqPrice === 0)
      list.push({ tone: "amber", text: "Renseignez le prix d'acquisition pour calculer votre réduction d'impôt Pinel." });

    if (chargesRecovered > 0 && isNu)
      list.push({ tone: "amber", text: `Charges récupérées (${eur(chargesRecovered)}) : en location nue, elles s'ajoutent aux revenus fonciers mais ne sont pas déductibles comme charges propriétaire.` });

    if (commonCharges === 0 && receiptsTotal > 0 && !isMicro)
      list.push({ tone: "amber", text: "Aucune charge saisie en régime réel : importez Finance ou vérifiez vos justificatifs." });

    if (list.length === 0)
      list.push({ tone: "emerald", text: "Aucune incohérence évidente détectée. Gardez tous les justificatifs avant déclaration." });

    return list;
  }, [
    depositReceived, isNu, receiptsTotal, isLmnp, realLmnpBase, microBicBase, realNuBase, microFoncierBase,
    amortizationMobilier, amortizationImmobilier, amortizationDeferred, lmnpCarryForward,
    regime, commonCharges, isPinel, pinelAcqPrice, chargesRecovered, interest, isMicro, year,
  ]);

  const checklist = useMemo(() => [
    { label: "Quittances / loyers encaissés",         ok: grossRent > 0 },
    { label: "Taxe foncière",                         ok: propertyTax > 0 || isMicro,          skipIf: isMicro },
    { label: "Assurance PNO / GLI",                   ok: insurance > 0 || isMicro,            skipIf: isMicro },
    { label: "Copropriété / appels de fonds",         ok: copro > 0 || isMicro,                skipIf: isMicro },
    { label: "Factures travaux / entretien",          ok: repairs > 0 || isMicro,              skipIf: isMicro },
    { label: "Frais gestion / agence",                ok: managementFees > 0 || isMicro,       skipIf: isMicro },
    { label: "Intérêts d'emprunt (si crédit)",        ok: interest > 0 || !isReal,             skipIf: isMicro },
    { label: "Amortissements mobilier",               ok: amortizationMobilier > 0,            skipIf: regime !== "lmnp_reel" },
    { label: "Prix d'acquisition Pinel",              ok: pinelAcqPrice > 0,                   skipIf: !isPinel },
    { label: "Inventaire LMNP du logement meublé",   ok: true,                                skipIf: !isLmnp },
  ].filter((item) => !item.skipIf), [
    grossRent, propertyTax, insurance, copro, repairs, managementFees,
    interest, amortizationMobilier, pinelAcqPrice, isMicro, isReal, isLmnp, isPinel, regime,
  ]);

  const exportDossier = () => {
    const rows: Array<[string, string]> = [
      ["Année", String(year)],
      ["Catégorie", categoryLabel],
      ["Régime choisi", regimeLabel(regime)],
      ["Recettes loyers", csvNum(grossRent)],
      ["Charges récupérées", csvNum(chargesRecovered)],
      ["Autres recettes", csvNum(otherIncome)],
      ["Dépôt garantie (indicatif)", csvNum(depositReceived)],
      ["Intérêts d'emprunt", csvNum(interest)],
      ["Assurances", csvNum(insurance)],
      ["Taxe foncière", csvNum(propertyTax)],
      ["Copropriété", csvNum(copro)],
      ["Travaux / entretien", csvNum(repairs)],
      ["Gestion / agence", csvNum(managementFees)],
      ["Eau / élec / internet", csvNum(utilities)],
      ["Autres charges", csvNum(otherExpenses)],
      ...(regime === "lmnp_reel" ? [
        ["Amortissements mobilier N", csvNum(amortizationMobilier)],
        ["Amortissements reportés N-1", csvNum(lmnpCarryForward)],
        ["Amortissements total disponibles", csvNum(amortizationTotal)],
        ["Amortissements effectivement déduits", csvNum(amortizationUsed)],
        ["Amortissements à reporter N+1", csvNum(amortizationDeferred)],
        ["Amortissements immobilier (non déductible LMNP non-pro)", csvNum(amortizationImmobilier)],
      ] as Array<[string, string]> : []),
      ...(regime === "nu_reel" ? [["CFE (Cotisation Foncière)", csvNum(cfe)]] as Array<[string, string]> : []),
      ["---", "---"],
      ["Micro-BIC (base imposable)", csvNum(microBicBase)],
      ["Micro-foncier (base imposable)", csvNum(microFoncierBase)],
      ["Réel LMNP (résultat)", csvNum(realLmnpBase)],
      ["Réel Nu (résultat)", csvNum(realNuBase)],
      ["Régime actif — base estimée", csvNum(taxableApprox)],
      ...(isPinel ? [
        ["Réduction Pinel totale", csvNum(pinelTotalReduction)],
        ["Réduction Pinel annuelle", csvNum(pinelYearlyReduction)],
      ] as Array<[string, string]> : []),
      ["Lecture", recommendedMode],
    ];

    const csv = [["Champ", "Valeur (€)"], ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dossier-declaration-${year}-${regime}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };


  // Guide de déclaration : montant exact à reporter + formulaire + cases (indicatifs)
  const declarationGuide = useMemo(() => {
    // En LMNP réel, même sans recettes on peut avoir un déficit BIC ou des amortissements à reporter
    const lmnpReelHasData = regime === "lmnp_reel" && (receiptsTotal > 0 || commonCharges > 0 || amortizationTotal > 0);
    if (receiptsTotal === 0 && regime !== "pinel" && !lmnpReelHasData) return null;
    if (regime === "pinel" && pinelAcqPrice === 0) return null;
    if (regime === "lmnp_micro") return {
      montantLabel: "Recettes brutes à déclarer",
      montant: receiptsTotal,
      montantNote: `Les impôts appliquent ensuite l'abattement ${locationKind === "meuble_saisonnier_classe" ? "71 %" : "50 %"} automatiquement — base imposable résultante : ${eur(microBicBase)}`,
      formulaire: "2042-C-PRO",
      caseHint: "Section « Locations meublées non professionnelles / Micro-BIC » — case recettes brutes (ex : 5ND)",
      isDeficit: false,
      needsAccountant: false,
      accountantNote: null,
    };
    if (regime === "lmnp_reel") {
      // Cas A : déficit BIC (charges > recettes, hors amortissements) — reportable 10 ans sur BIC non-pro
      if (lmnpBicDeficit < 0) return {
        montantLabel: "Déficit BIC à reporter",
        montant: Math.abs(lmnpBicDeficit),
        montantNote: `Vos charges (${eur(commonCharges)}) dépassent vos recettes (${eur(receiptsTotal)}). Ce déficit BIC non-professionnel n'est pas imputable sur le revenu global — il se reporte 10 ans sur les BIC non-pro.${amortizationTotal > 0 ? ` Les ${eur(amortizationTotal)} d'amortissements sont mis en réserve et reportés sans limite de durée.` : ""}`,
        formulaire: "2031 + 2042-C-PRO",
        caseHint: "Section « BIC non professionnels / Réel » — case déficit (ex : 5NL)",
        isDeficit: true,
        needsAccountant: true,
        accountantNote: "Le formulaire 2031 (liasse fiscale) est obligatoire. Un comptable ou l'adhésion à un CGA est fortement recommandé.",
      };
      // Cas B : résultat positif ou nul après amortissements
      return {
        montantLabel: realLmnpBase > 0 ? "Bénéfice à déclarer" : "Résultat nul",
        montant: realLmnpBase,
        montantNote: realLmnpBase > 0
          ? `Résultat net après charges et amortissements mobiliers (${eur(amortizationUsed)} déduits).${amortizationDeferred > 0 ? ` ${eur(amortizationDeferred)} d'amortissements non utilisés sont reportés sur ${year + 1} sans limite de durée.` : ""}`
          : `Vos amortissements (${eur(amortizationUsed)} déduits sur ${eur(amortizationTotal)} disponibles) couvrent intégralement le résultat.${amortizationDeferred > 0 ? ` ${eur(amortizationDeferred)} sont reportés sur ${year + 1} sans limite de durée.` : ""}`,
        formulaire: "2031 + 2042-C-PRO",
        caseHint: realLmnpBase > 0
          ? "Section « BIC non professionnels / Réel » — case bénéfice (ex : 5NK)"
          : "Section « BIC non professionnels / Réel » — résultat nul, case bénéfice (ex : 5NK) = 0",
        isDeficit: false,
        needsAccountant: true,
        accountantNote: "Le formulaire 2031 (liasse fiscale) est obligatoire. Un comptable ou l'adhésion à un CGA est fortement recommandé pour le LMNP réel.",
      };
    }
    if (regime === "nu_micro") return {
      montantLabel: "Recettes brutes à déclarer",
      montant: receiptsTotal,
      montantNote: `Les impôts appliquent l'abattement 30 % automatiquement — base imposable résultante : ${eur(microFoncierBase)}. Plafond micro-foncier : 15 000 €/an.`,
      formulaire: "2042",
      caseHint: "Section « Revenus fonciers / Micro-foncier » — case revenus bruts (ex : 4BE)",
      isDeficit: false,
      needsAccountant: false,
      accountantNote: null,
    };
    if (regime === "nu_reel") return {
      montantLabel: realNuBase >= 0 ? "Revenu net foncier à déclarer" : "Déficit foncier à déduire",
      montant: Math.abs(realNuBase),
      montantNote: realNuBase >= 0
        ? "Revenus locatifs nets après déduction de toutes les charges réelles"
        : `Déficit imputable sur le revenu global dans la limite de 10 700 €/an — le surplus se reporte 10 ans sur les revenus fonciers`,
      formulaire: "2044 + 2042",
      caseHint: realNuBase >= 0
        ? "Formulaire 2044 → reporter en case revenus nets (ex : 4BA sur la 2042)"
        : "Formulaire 2044 → case déficit imputable revenu global (ex : 4BC) ou report (ex : 4BB)",
      isDeficit: realNuBase < 0,
      needsAccountant: false,
      accountantNote: "Le formulaire 2044 détaille chaque charge déductible. Faisable seul, mais une vérification ligne par ligne s'impose.",
    };
    if (regime === "pinel") return {
      montantLabel: "Réduction d'impôt annuelle",
      montant: pinelYearlyReduction,
      montantNote: `${(pinelRate * 100).toFixed(0)} % × ${eur(pinelAcqPriceCapped)}${pinelAcqPrice > 300_000 ? ` (plafond légal 300 000 € appliqué sur ${eur(pinelAcqPrice)})` : ""} = ${eur(pinelTotalReduction)} sur ${pinelCommitmentYears} ans. Les revenus fonciers nets (${eur(pinelRevenusBase)}) sont à déclarer séparément sur la 2044.`,
      formulaire: "2042-C + 2044",
      caseHint: "Cases réduction Pinel (ex : 7QA pour 6 ans, 7QB pour 9 ans, 7QC pour 12 ans) — vérifiez l'année de votre investissement",
      isDeficit: false,
      needsAccountant: false,
      accountantNote: "La réduction Pinel est plafonnée à 300 000 € d'investissement. Vérifiez votre acte d'acquisition et votre bail.",
    };
    return null;
  }, [
    regime, receiptsTotal, microBicBase, microFoncierBase, realLmnpBase, realNuBase,
    pinelYearlyReduction, pinelRevenusBase, pinelTotalReduction, pinelAcqPrice, pinelAcqPriceCapped,
    pinelCommitmentYears, pinelRate, locationKind,
    lmnpBicDeficit, amortizationUsed, amortizationDeferred, amortizationTotal, commonCharges, year, cfe,
  ]);


  if (!permissionsLoading && !isPremium) {
    return (
      <LockedPremiumSection config={{
        eyebrow: "Fonctionnalité lokt·plus",
        title: "Aide à la déclaration réservée au plan lokt·plus",
        desc: "Préparez un dossier fiscal exploitable : import Finance, ventilation par bien, comparaison micro/réel, alertes d'incohérence, checklist justificatifs et export pour votre comptable.",
        requiredPlan: "lokt·plus",
        planId: "landlord_15",
        cta: "Upgrade vers lokt·plus",
        features: [
          "Import automatique des recettes et charges Finance",
          "Comparaison micro-BIC / régime réel par bien",
          "Alertes d'incohérence et checklist justificatifs",
          "Export synthèse à transmettre à votre comptable",
        ],
      }} />
    );
  }

  const noCat = fiscalGroups.lmnp.length === 0 && fiscalGroups.nu.length === 0 && fiscalGroups.pinel.length === 0;
  const hasCat = !noCat;

  return (
    <div className="space-y-5">

      {/* ── Guide explicatif (masquable) ── */}
      {showGuide && (
        <section className="relative overflow-hidden rounded-3xl border border-[#635bff]/20 bg-gradient-to-br from-[#635bff]/5 via-white to-cyan-50 p-5">
          <button
            type="button"
            onClick={dismissGuide}
            className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Comment ça marche</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#635bff] text-xs font-bold text-white">1</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Choisissez votre catégorie</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Vos biens sont classés automatiquement — <strong>LMNP</strong>, <strong>location nue</strong> ou <strong>Pinel</strong> — selon le régime que vous avez configuré dans Finance.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#635bff] text-xs font-bold text-white">2</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Importez vos loyers</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Cliquez <strong>Importer Finance</strong> pour récupérer en un clic vos loyers et charges de l'exercice, ou saisissez-les manuellement. Choisissez ensuite le régime : micro ou réel.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#635bff] text-xs font-bold text-white">3</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Obtenez le montant à déclarer</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Le montant exact, le formulaire et la case à remplir s'affichent automatiquement. Sauvegardez ou exportez en CSV pour votre comptable.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[0.67rem] leading-5 text-slate-400">
              Aide à la préparation uniquement — non un logiciel officiel. Vérifiez sur <strong className="text-slate-500">impots.gouv.fr</strong> avant de déclarer.
            </p>
            <a
              href="/guides/declarer-revenus-locatifs"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 ml-4 rounded-full border border-[#635bff]/30 bg-white px-3 py-1.5 text-[0.72rem] font-semibold text-[#635bff] hover:bg-[#635bff]/5 transition"
            >
              Guide complet →
            </a>
          </div>
        </section>
      )}

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Aide à la déclaration</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Revenus locatifs {year}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" onClick={importFromFinance} disabled={loading} className={cx("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold", brandBg, brandText, brandHover, loading && "opacity-60")}>
            <ArrowPathIcon className="h-4 w-4" />
            {loading ? "Chargement…" : "Importer Finance"}
          </button>
        </div>
      </div>

      {err && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}
      {info && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{info}</div>}

      {/* Import preview */}
      {importPreview && (
        <div className="rounded-2xl border border-[#635bff]/25 bg-[#635bff]/5 px-4 py-4">
          <p className="text-sm font-semibold text-slate-950">
            Finance — {importPreview.rows.length} écriture{importPreview.rows.length > 1 ? "s" : ""} trouvée{importPreview.rows.length > 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Loyers : {eur(importPreview.grossRent)} · Intérêts : {eur(importPreview.interest)} · Assurance : {eur(importPreview.insurance)} · Taxe foncière : {eur(importPreview.propertyTax)}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => applyImportPreview()} className={cx("rounded-full px-4 py-1.5 text-sm font-semibold", brandBg, brandText)}>Appliquer</button>
            <button type="button" onClick={() => setImportPreview(null)} className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Ignorer</button>
          </div>
        </div>
      )}

      {/* ── Aucun régime configuré ── */}
      {noCat && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-semibold text-amber-900">Aucun régime fiscal configuré</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Rendez-vous dans <strong>Finance → Stratégie financière</strong> pour définir le régime de chaque bien :{" "}
            <strong>LMNP</strong> (meublé), <strong>location nue</strong> ou <strong>Pinel</strong>.
            Cette information est nécessaire pour préparer votre déclaration.
          </p>
        </section>
      )}

      {/* ── Onglets catégorie ── */}
      {hasCat && (
        <div className="flex flex-wrap gap-2">
          {fiscalGroups.lmnp.length > 0 && (
            <button type="button" onClick={() => setRegime(isLmnp ? regime : "lmnp_micro")}
              className={cx("rounded-full border px-4 py-2 text-sm font-semibold transition", isLmnp ? "border-[#635bff]/30 bg-[#635bff]/10 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
              Meublé LMNP{fiscalGroups.lmnp.length > 1 ? ` — ${fiscalGroups.lmnp.length} biens` : ""}
            </button>
          )}
          {fiscalGroups.nu.length > 0 && (
            <button type="button" onClick={() => setRegime(isNu ? regime : "nu_micro")}
              className={cx("rounded-full border px-4 py-2 text-sm font-semibold transition", isNu ? "border-[#635bff]/30 bg-[#635bff]/10 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
              Location nue{fiscalGroups.nu.length > 1 ? ` — ${fiscalGroups.nu.length} biens` : ""}
            </button>
          )}
          {fiscalGroups.pinel.length > 0 && (
            <button type="button" onClick={() => setRegime("pinel")}
              className={cx("rounded-full border px-4 py-2 text-sm font-semibold transition", isPinel ? "border-[#635bff]/30 bg-[#635bff]/10 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
              Pinel{fiscalGroups.pinel.length > 1 ? ` — ${fiscalGroups.pinel.length} biens` : ""}
            </button>
          )}
        </div>
      )}

      {/* ── Carte catégorie ── */}
      {hasCat && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* Biens inclus */}
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <p className="text-xs text-slate-500">
              {(isLmnp ? fiscalGroups.lmnp : isPinel ? fiscalGroups.pinel : fiscalGroups.nu)
                .map((id) => { const p = propertyById.get(id); return p?.label || p?.address_line1 || "Bien"; })
                .join(" · ")}
            </p>
          </div>

          <div className="space-y-7 p-5">

            {/* Régime (non Pinel) */}
            {!isPinel && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Régime</p>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                  {(isLmnp
                    ? [["lmnp_micro", "Micro-BIC"], ["lmnp_reel", "Réel"]] as const
                    : [["nu_micro", "Micro-foncier"], ["nu_reel", "Réel foncier"]] as const
                  ).map(([r, label]) => (
                    <button key={r} type="button" onClick={() => setRegime(r as Regime)}
                      className={cx("rounded-lg px-4 py-2 text-sm font-semibold transition", regime === r ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  {isMicro
                    ? isLmnp ? `Abattement ${locationKind === "meuble_saisonnier_classe" ? "71 %" : "50 %"} appliqué automatiquement par les impôts` : "Abattement 30 % appliqué automatiquement par les impôts"
                    : "Vous déduisez vos charges réelles — renseignez-les ci-dessous"}
                </p>
                {isLmnp && isMicro && (
                  <select value={locationKind} onChange={(e) => setLocationKind(e.target.value as LocationKind)}
                    className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="meuble_longue">Meublé longue durée (abattement 50 %)</option>
                    <option value="meuble_saisonnier">Meublé saisonnier non classé (abattement 50 %)</option>
                    <option value="meuble_saisonnier_classe">Meublé de tourisme classé (abattement 71 %)</option>
                  </select>
                )}
              </div>
            )}

            {/* Recettes */}
            {!isPinel && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recettes {year}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Loyers perçus (€)" value={grossRent} onChange={setGrossRent} />
                  <Field label="Charges récupérées (€)" value={chargesRecovered} onChange={setChargesRecovered} />
                  <Field label="Autres recettes (€)" value={otherIncome} onChange={setOtherIncome} />
                  <Field label="Dépôt de garantie reçu (€)" value={depositReceived} onChange={setDepositReceived} hint="Indicatif — ne pas l'inclure dans les recettes fiscales" />
                </div>
              </div>
            )}

            {/* Charges déductibles (réel uniquement) */}
            {isReal && !isPinel && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Charges déductibles</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Intérêts d'emprunt (€)" value={interest} onChange={setInterest} />
                  <Field label="Assurance (€)" value={insurance} onChange={setInsurance} />
                  <Field label="Taxe foncière (€)" value={propertyTax} onChange={setPropertyTax} />
                  <Field label="Charges copropriété (€)" value={copro} onChange={setCopro} />
                  <Field label="Travaux / réparations (€)" value={repairs} onChange={setRepairs} />
                  <Field label="Frais de gestion (€)" value={managementFees} onChange={setManagementFees} />
                  <Field label="Eau, électricité, divers (€)" value={utilities} onChange={setUtilities} />
                  <Field label="Autres charges (€)" value={otherExpenses} onChange={setOtherExpenses} />
                  {isLmnp && <Field label="Amortissements mobilier N (€)" value={amortizationMobilier} onChange={setAmortizationMobilier} hint="Mobilier et équipements — déductible en LMNP non-pro" />}
                  {isLmnp && <Field label="Amortissements reportés N-1 (€)" value={lmnpCarryForward} onChange={setLmnpCarryForward} hint="Stock non utilisé des exercices précédents (reportable sans limite)" />}
                  {isNu && <Field label="CFE (€)" value={cfe} onChange={setCfe} hint="Cotisation Foncière des Entreprises" />}
                </div>
              </div>
            )}

            {/* Pinel */}
            {isPinel && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Dispositif Pinel</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Adresse du bien</label>
                    <input value={pinelAddress} onChange={(e) => setPinelAddress(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Ex : 12 rue des Lilas, 75011 Paris" />
                    {pinelAddress && (propertyById.get(pinelPropertyId ?? "")?.address_line1) &&
                      pinelAddress.startsWith(propertyById.get(pinelPropertyId ?? "")?.address_line1 ?? "___") && (
                      <p className="mt-1 text-[0.68rem] text-slate-400">Récupéré depuis la fiche bien</p>
                    )}
                  </div>
                  <Field label="Année d'acquisition" value={pinelAcqYear} onChange={setPinelAcqYear} />
                  <div>
                    <Field label="Prix d'acquisition (€)" value={pinelAcqPrice} onChange={setPinelAcqPrice} />
                    {pinelAcqPrice > 0 && (() => {
                      const fin = (propertyFinance || []).find((f) => f.property_id === pinelPropertyId);
                      const total = (fin?.purchase_price || 0) + (fin?.notary_fees || 0) + (fin?.agency_fees || 0) + (fin?.works || 0);
                      return total > 0 && pinelAcqPrice === total
                        ? <p className="mt-1 text-[0.68rem] text-slate-400">Récupéré depuis Finance (achat + frais + travaux)</p>
                        : null;
                    })()}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Durée d'engagement</label>
                    <select value={pinelCommitmentYears} onChange={(e) => setPinelCommitmentYears(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                      <option value={6}>6 ans — réduction 12 %</option>
                      <option value={9}>9 ans — réduction 18 %</option>
                      <option value={12}>12 ans — réduction 21 %</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Revenus fonciers Pinel (loyers + charges récupérées) */}
            {isPinel && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Revenus fonciers {year}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Loyers perçus (€)" value={grossRent} onChange={setGrossRent} />
                  <Field label="Charges récupérées (€)" value={chargesRecovered} onChange={setChargesRecovered} />
                  <Field label="Autres recettes (€)" value={otherIncome} onChange={setOtherIncome} />
                </div>
              </div>
            )}

            {/* Charges déductibles Pinel (formulaire 2044, régime réel foncier) */}
            {isPinel && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Charges déductibles (formulaire 2044)</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Intérêts d'emprunt (€)" value={interest} onChange={setInterest} />
                  <Field label="Assurance (€)" value={insurance} onChange={setInsurance} />
                  <Field label="Taxe foncière (€)" value={propertyTax} onChange={setPropertyTax} />
                  <Field label="Charges copropriété (€)" value={copro} onChange={setCopro} />
                  <Field label="Travaux / réparations (€)" value={repairs} onChange={setRepairs} />
                  <Field label="Frais de gestion (€)" value={managementFees} onChange={setManagementFees} />
                </div>
              </div>
            )}

            {/* ── Ce que vous déclarez ── */}
            {declarationGuide ? (
              <div className="rounded-3xl border-2 border-[#635bff]/20 bg-gradient-to-br from-[#635bff]/5 to-white p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Ce que vous déclarez aux impôts</p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{declarationGuide.montantLabel}</p>
                    <p className="mt-0.5 text-3xl font-bold tracking-tight text-slate-950">
                      {declarationGuide.isDeficit ? "−" : ""}{eur(declarationGuide.montant)}
                    </p>
                    <p className="mt-2 max-w-md text-xs leading-5 text-slate-600">{declarationGuide.montantNote}</p>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">Formulaire</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-950">{declarationGuide.formulaire}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{declarationGuide.caseHint}</p>
                  </div>
                </div>
                {declarationGuide.needsAccountant && declarationGuide.accountantNote && (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs leading-5 text-amber-900">{declarationGuide.accountantNote}</p>
                  </div>
                )}
                {!declarationGuide.needsAccountant && declarationGuide.accountantNote && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">{declarationGuide.accountantNote}</p>
                )}
                <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[0.67rem] leading-5 text-slate-400">
                    <ExclamationTriangleIcon className="mr-1 inline h-3 w-3 text-amber-400" />
                    Cases indicatives — les numéros changent chaque année. Vérifiez sur{" "}
                    <strong className="text-slate-500">impots.gouv.fr</strong> avant de déclarer.
                    lokt.fr n'est pas un logiciel de déclaration officiel.
                  </p>
                  <a
                    href="/guides/declarer-revenus-locatifs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-full border border-[#635bff]/30 bg-white px-3 py-1.5 text-[0.72rem] font-semibold text-[#635bff] hover:bg-[#635bff]/5 transition"
                  >
                    Guide complet →
                  </a>
                </div>
              </div>
            ) : receiptsTotal === 0 && !isPinel ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
                <p className="text-sm text-slate-500">Aucune recette renseignée pour {categoryLabel}.</p>
                <button
                  type="button"
                  onClick={importFromFinance}
                  disabled={loading}
                  className={cx("inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold", brandBg, brandText, brandHover, loading && "opacity-60")}
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Importer depuis Finance
                </button>
                <p className="text-xs text-slate-400">ou saisissez les loyers manuellement dans le champ "Recettes" ci-dessus</p>
              </div>
            ) : null}

            {/* Alertes */}
            {alerts.filter((a) => a.tone !== "emerald").length > 0 && (
              <div className="space-y-2">
                {alerts.filter((a) => a.tone !== "emerald").map((alert, idx) => (
                  <div key={idx} className={cx("flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm",
                    alert.tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900")}>
                    <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    {alert.text}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">
                {regimeLabel(regime)} · {year}{rowId ? " · Sauvegardé ✓" : ""}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={save} disabled={loading}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60">
                  {loading ? "Sauvegarde…" : "Sauvegarder"}
                </button>
                <button type="button" onClick={exportDossier}
                  className={cx("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold", brandBg, brandText, brandHover)}>
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Exporter CSV
                </button>
              </div>
            </div>

          </div>
        </section>
      )}
    </div>
  );
}
