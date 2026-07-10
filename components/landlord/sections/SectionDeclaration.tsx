import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
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
type FurnishedAnswer = "unknown" | "yes" | "no";
type ExpenseProfile = "low" | "high";
type AccountingProfile = "solo" | "accountant";

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
};

type ImportTotals = {
  rows: Transaction[];
  grossRent: number;
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

type Props = {
  userId: string;
  properties?: Property[];
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

export function SectionDeclaration({ userId, properties }: Props) {
  const { loading: permissionsLoading, plan } = usePermissions();
  const isPremium = planAllowsPerformance(plan);

  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  const safeProperties = Array.isArray(properties) ? properties : [];
  const propertyById = useMemo(() => new Map(safeProperties.map((p) => [p.id, p])), [safeProperties]);

  const years = useMemo(() => {
    const y = currentYear();
    return [y, y - 1, y - 2, y - 3];
  }, []);

  const [year, setYear] = useState<number>(years[1] ?? currentYear() - 1);
  const [regime, setRegime] = useState<Regime>("lmnp_micro");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [locationKind, setLocationKind] = useState<LocationKind>("meuble_longue");
  const [furnishedAnswer, setFurnishedAnswer] = useState<FurnishedAnswer>("unknown");
  const [expenseProfile, setExpenseProfile] = useState<ExpenseProfile>("low");
  const [accountingProfile, setAccountingProfile] = useState<AccountingProfile>("solo");

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

  // Nu réel : CFE (Cotisation Foncière des Entreprises)
  const [cfe, setCfe] = useState(0);

  // Pinel
  const [pinelAddress, setPinelAddress] = useState("");
  const [pinelAcqYear, setPinelAcqYear] = useState<number>(currentYear() - 1);
  const [pinelAcqPrice, setPinelAcqPrice] = useState(0);
  const [pinelCommitmentYears, setPinelCommitmentYears] = useState<number>(6);

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

  // LMNP réel : intérêts déductibles, amortissement mobilier déductible (immobilier interdit en non-pro)
  const realLmnpBase = Math.max(0, receiptsTotal - commonCharges - amortizationMobilier);

  // Nu réel : intérêts déductibles + CFE déductible
  const realNuBase = Math.max(0, receiptsTotal - commonCharges - cfe);

  // Pinel : revenu foncier = same base as nu réel, mais avec réduction d'impôt séparée
  const pinelRate = PINEL_RATES[pinelCommitmentYears] ?? 0.12;
  const pinelTotalReduction = pinelAcqPrice * pinelRate;
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
    regime === "lmnp_reel" ? commonCharges + amortizationMobilier :
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

  const suggestedRegime: Regime =
    furnishedAnswer === "yes"
      ? expenseProfile === "high" || accountingProfile === "accountant"
        ? "lmnp_reel"
        : "lmnp_micro"
      : furnishedAnswer === "no"
      ? expenseProfile === "high" || accountingProfile === "accountant"
        ? "nu_reel"
        : "nu_micro"
      : regime;

  const suggestedReason =
    furnishedAnswer === "unknown"
      ? "Répondez aux questions pour obtenir une orientation de départ."
      : expenseProfile === "high"
      ? "Vos charges, travaux ou intérêts semblent importants : le réel mérite d'être étudié."
      : "Avec peu de charges à retraiter, le régime micro peut être un bon point de départ.";

  const selectedPropertyLabel =
    selectedPropertyId === "all" ? "Tous les biens" : propertyById.get(selectedPropertyId)?.label || "Bien sélectionné";

  const resetFormFields = () => {
    setRowId(null);
    setLocationKind("meuble_longue");
    setFurnishedAnswer("unknown");
    setExpenseProfile("low");
    setAccountingProfile("solo");
    setGrossRent(0); setChargesRecovered(0); setOtherIncome(0); setDepositReceived(0);
    setInterest(0); setInsurance(0); setPropertyTax(0); setCopro(0);
    setRepairs(0); setManagementFees(0); setUtilities(0); setOtherExpenses(0);
    setAmortizationMobilier(0); setAmortizationImmobilier(0); setCfe(0);
    setPinelAddress(""); setPinelAcqPrice(0); setPinelCommitmentYears(6);
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
        .eq("property_id", selectedPropertyId)
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
      setFurnishedAnswer((d.furnishedAnswer as FurnishedAnswer) || "unknown");
      setExpenseProfile((d.expenseProfile as ExpenseProfile) || "low");
      setAccountingProfile((d.accountingProfile as AccountingProfile) || "solo");
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
        property_id: selectedPropertyId,
        data: {
          locationKind,
          furnishedAnswer,
          expenseProfile,
          accountingProfile,
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
        .upsert(payload, { onConflict: "user_id,year,regime,property_id" })
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
    // Exclure les dépôts de garantie — ils ne sont pas des revenus fiscaux
    const receivedIncome = rows.filter(
      (r) => r.direction === "in" && r.status === "received" && !DEPOSIT_CATEGORIES.has(r.category)
    );
    const paidExpenses = rows.filter((r) => r.direction === "out" && r.status === "paid");
    const sum = (list: Transaction[]) => list.reduce((acc, r) => acc + Number(r.amount || 0), 0);

    return {
      rows,
      grossRent: sum(receivedIncome.filter((r) => r.category === "rent")),
      otherIncome: sum(receivedIncome.filter((r) => r.category !== "rent")),
      interest: sum(paidExpenses.filter((r) => r.category === "loan_interest" || r.category === "interest")),
      propertyTax: sum(paidExpenses.filter((r) => r.category === "tax")),
      insurance: sum(paidExpenses.filter((r) => r.category === "insurance")),
      copro: sum(paidExpenses.filter((r) => r.category === "copro")),
      repairs: sum(paidExpenses.filter((r) => r.category === "repairs")),
      managementFees: sum(paidExpenses.filter((r) => r.category === "management" || r.category === "fees")),
      utilities: sum(paidExpenses.filter((r) => r.category === "utilities")),
      otherExpenses: sum(
        paidExpenses.filter(
          (r) => !["tax", "insurance", "copro", "repairs", "management", "fees", "utilities", "loan_interest", "interest"].includes(r.category)
        )
      ),
    };
  };

  const applyImportPreview = (preview = importPreview) => {
    if (!preview) return;
    setFinanceRows(preview.rows);
    setGrossRent(preview.grossRent);
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

      if (selectedPropertyId !== "all") query = query.eq("property_id", selectedPropertyId);
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
  }, [userId, year, regime, selectedPropertyId, permissionsLoading, isPremium]);

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

    if (regime === "lmnp_reel" && amortizationMobilier === 0)
      list.push({ tone: "amber", text: "LMNP réel sans amortissement mobilier : le résultat est probablement surévalué. Indiquez les amortissements pratiqués." });

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
    amortizationMobilier, amortizationImmobilier, regime, commonCharges, isPinel, pinelAcqPrice,
    chargesRecovered, interest, isMicro,
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
      ["Bien", selectedPropertyLabel],
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
        ["Amortissements mobilier (déductible)", csvNum(amortizationMobilier)],
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
    link.download = `dossier-declaration-${year}-${selectedPropertyId === "all" ? "tous-biens" : selectedPropertyId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const steps: Array<{ key: DeclarationStep; label: string; title: string; desc: string }> = [
    { key: "diagnostic", label: "1", title: "Orienter", desc: "Identifier le type de location et le régime à étudier." },
    { key: "prepare",    label: "2", title: "Préparer", desc: "Année, bien, régime et import Finance." },
    { key: "verify",     label: "3", title: "Vérifier", desc: "Contrôler les montants et le régime le plus cohérent." },
    { key: "export",     label: "4", title: "Exporter", desc: "Alertes, justificatifs et dossier comptable." },
  ];

  const completionItems = [
    { label: "Diagnostic réalisé",    ok: furnishedAnswer !== "unknown" },
    { label: "Périmètre choisi",      ok: !!year && !!regime && !!selectedPropertyId },
    { label: "Recettes renseignées",  ok: receiptsTotal > 0 },
    { label: "Charges contrôlées",    ok: commonCharges > 0 || isMicro },
    { label: "Dossier sauvegardé",    ok: !!rowId },
  ];
  const completionPct = Math.round((completionItems.filter((item) => item.ok).length / completionItems.length) * 100);

  const propertyDossiers = useMemo(() => {
    const selectedReady = selectedPropertyId !== "all" && receiptsTotal > 0;
    return safeProperties.map((property) => {
      const isSelected = property.id === selectedPropertyId;
      const progress = isSelected ? completionPct : 0;
      const tone = isSelected && selectedReady ? "emerald" : isSelected ? "amber" : "slate";
      return {
        property,
        isSelected,
        progress,
        tone: tone as "emerald" | "amber" | "red" | "slate",
        label: property.label || property.address_line1 || "Logement",
        city: property.city || property.postal_code || "Adresse à compléter",
      };
    });
  }, [safeProperties, selectedPropertyId, receiptsTotal, completionPct]);

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

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[#f6f9fc] px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Aide à la déclaration</p>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight text-slate-950">
                Transformer l'année locative en dossier fiscal clair.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                lokt.fr vous aide à choisir le bon périmètre, importer les écritures Finance, vérifier les montants et préparer une synthèse exploitable pour vous ou votre comptable.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dossier prêt</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{completionPct}%</p>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
              {steps.map((step) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActiveStep(step.key)}
                  className={cx(
                    "flex min-w-[9.5rem] items-center gap-2 rounded-2xl border px-3 py-2 text-left transition",
                    activeStep === step.key ? "border-[#635bff]/30 bg-[#635bff]/5 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", activeStep === step.key ? brandBg + " " + brandText : "bg-slate-100 text-slate-700")}>
                    {step.label}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950">{step.title}</span>
                    <span className="block truncate text-[0.72rem] text-slate-500">{step.desc}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Avancement</p>
                  <p className="text-sm font-semibold text-slate-950">{completionPct}% prêt</p>
                </div>
                <div className="flex -space-x-1">
                  {completionItems.map((item) => (
                    <span
                      key={item.label}
                      className={cx("h-2.5 w-2.5 rounded-full ring-2 ring-slate-50", item.ok ? "bg-emerald-500" : "bg-slate-300")}
                      title={item.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 p-5">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <Stat label="Recettes" value={eur(receiptsTotal)} sub="Hors dépôt" />
            <Stat label="Charges" value={eur(chargesStatDisplay)} sub={isReal ? "Déductibles estimées" : "Indicatif (micro)"} />
            <Stat label="Base imposable" value={eur(taxableApprox)} sub={`Régime ${regimeLabel(regime)}`} />
            <Stat label="Import" value={String(financeRows.length)} sub={`${selectedPropertyLabel} · ${year}`} />
          </div>

          {err ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
          {info ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div> : null}

          <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Dossiers par logement</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Sélectionnez un bien pour préparer un dossier fiscal dédié. "Tous les biens" reste possible pour une vue consolidée.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPropertyId("all")}
                className={cx("rounded-full border px-3 py-1.5 text-xs font-semibold", selectedPropertyId === "all" ? "border-[#635bff]/30 bg-[#635bff]/5 text-[#4f46e5]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
              >
                Vue consolidée
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {propertyDossiers.slice(0, 6).map((dossier) => (
                <button
                  key={dossier.property.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(dossier.property.id)}
                  className={cx(
                    "rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5",
                    dossier.isSelected ? "border-[#635bff]/35 bg-[#635bff]/5 shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{dossier.label}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{dossier.city}</p>
                    </div>
                    <span className={cx("shrink-0 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold", statusToneClass(dossier.tone))}>
                      {dossier.isSelected ? `${dossier.progress}%` : "À préparer"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ── Étape 1 : Diagnostic ─────────────────────────────────── */}
          {activeStep === "diagnostic" ? (
            <div className="space-y-4">
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-gradient-to-r from-[#eef2ff] via-white to-[#ecfeff] p-5">
                  <p className="text-sm font-semibold text-slate-950">1. Orientation de départ</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Répondez simplement. L'objectif n'est pas de trancher juridiquement, mais d'éviter de partir dans le mauvais dossier.
                  </p>
                </div>
                <div className="grid gap-4 p-5 lg:grid-cols-[1fr,320px]">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Type de location</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {[
                          ["yes", "Meublé"],
                          ["no", "Vide"],
                          ["unknown", "Je ne sais pas"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setFurnishedAnswer(value as FurnishedAnswer)}
                            className={cx("rounded-2xl border px-4 py-3 text-sm font-semibold transition", furnishedAnswer === value ? "border-[#635bff]/40 bg-[#635bff]/5 text-[#4f46e5]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Niveau de charges</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setExpenseProfile("low")}
                          className={cx("rounded-2xl border px-4 py-3 text-left text-sm transition", expenseProfile === "low" ? "border-[#635bff]/40 bg-[#635bff]/5" : "border-slate-200 bg-white hover:bg-slate-50")}
                        >
                          <span className="font-semibold text-slate-950">Peu de charges</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">Pas ou peu de travaux, intérêts ou frais à déduire.</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpenseProfile("high")}
                          className={cx("rounded-2xl border px-4 py-3 text-left text-sm transition", expenseProfile === "high" ? "border-[#635bff]/40 bg-[#635bff]/5" : "border-slate-200 bg-white hover:bg-slate-50")}
                        >
                          <span className="font-semibold text-slate-950">Charges importantes</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">Crédit, travaux, copro, assurance, gestion ou amortissement.</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Sortie attendue</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setAccountingProfile("solo")}
                          className={cx("rounded-2xl border px-4 py-3 text-left text-sm transition", accountingProfile === "solo" ? "border-[#635bff]/40 bg-[#635bff]/5" : "border-slate-200 bg-white hover:bg-slate-50")}
                        >
                          <span className="font-semibold text-slate-950">Je veux comprendre</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">Synthèse lisible pour déclarer plus sereinement.</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountingProfile("accountant")}
                          className={cx("rounded-2xl border px-4 py-3 text-left text-sm transition", accountingProfile === "accountant" ? "border-[#635bff]/40 bg-[#635bff]/5" : "border-slate-200 bg-white hover:bg-slate-50")}
                        >
                          <span className="font-semibold text-slate-950">Je transmets à un expert</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">Dossier détaillé avec sources et justificatifs.</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <aside className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Régime à étudier</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-950">{regimeLabel(suggestedRegime)}</p>
                    <p className="mt-2 text-sm leading-6 text-emerald-900">{suggestedReason}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setRegime(suggestedRegime);
                        setActiveStep("prepare");
                      }}
                      className="mt-4 w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Utiliser cette orientation
                    </button>
                  </aside>
                </div>
              </section>
            </div>
          ) : null}

          {/* ── Étape 2 : Préparer ───────────────────────────────────── */}
          {activeStep === "prepare" ? (
            <div className="space-y-4">
              <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">1. Choisir le périmètre</p>
                    <p className="mt-1 text-sm text-slate-600">Sélectionnez l'exercice, le bien et le régime que vous voulez préparer.</p>
                  </div>
                  <button type="button" onClick={importFromFinance} disabled={loading} className={cx("inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold", brandBg, brandText, brandHover, loading && "opacity-60")}>
                    <ArrowPathIcon className="h-4 w-4" />
                    Importer Finance
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Année déclarée</label>
                    <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Bien</label>
                    <select value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                      <option value="all">Tous les biens</option>
                      {safeProperties.map((property) => (
                        <option key={property.id} value={property.id}>{property.label || property.address_line1 || "Bien"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Régime travaillé</label>
                    <select value={regime} onChange={(e) => setRegime(e.target.value as Regime)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                      {(Object.keys(REGIME_LABELS) as Regime[]).map((key) => (
                        <option key={key} value={key}>{regimeLabel(key)}</option>
                      ))}
                    </select>
                  </div>
                  {isLmnp ? (
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Type de meublé</label>
                      <select value={locationKind} onChange={(e) => setLocationKind(e.target.value as LocationKind)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="meuble_longue">Meublé longue durée (abattement 50 %)</option>
                        <option value="meuble_saisonnier">Meublé saisonnier non classé (abattement 50 %)</option>
                        <option value="meuble_saisonnier_classe">Meublé tourisme classé (abattement 71 %)</option>
                      </select>
                    </div>
                  ) : null}
                </div>

                {isPinel ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-900">Informations Pinel</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-slate-700">Adresse du bien</label>
                        <input value={pinelAddress} onChange={(e) => setPinelAddress(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Ex : 12 rue des Lilas, 75011 Paris" />
                      </div>
                      <Field label="Année d'acquisition" value={pinelAcqYear} onChange={setPinelAcqYear} />
                      <Field label="Prix d'acquisition (€)" value={pinelAcqPrice} onChange={setPinelAcqPrice} hint="Utilisé pour calculer la réduction d'impôt" />
                      <div>
                        <label className="text-xs font-semibold text-slate-700">Durée d'engagement</label>
                        <select value={pinelCommitmentYears} onChange={(e) => setPinelCommitmentYears(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                          <option value={6}>6 ans — réduction 12 %</option>
                          <option value={9}>9 ans — réduction 18 %</option>
                          <option value={12}>12 ans — réduction 21 %</option>
                        </select>
                      </div>
                      {pinelAcqPrice > 0 ? (
                        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                          <p className="text-xs font-semibold text-indigo-900">Réduction Pinel estimée</p>
                          <p className="mt-1 text-lg font-bold text-indigo-950">{eur(pinelYearlyReduction)} / an</p>
                          <p className="text-xs text-indigo-700">{eur(pinelTotalReduction)} total sur {pinelCommitmentYears} ans</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>

              {importPreview ? (
                <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-cyan-950">Aperçu de l'import Finance</p>
                      <p className="mt-1 text-sm leading-6 text-cyan-900">
                        Les champs ne sont pas remplacés tant que vous ne validez pas. Les dépôts de garantie ont été exclus automatiquement.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setImportPreview(null)} className="rounded-full border border-cyan-300 bg-white/70 px-4 py-2 text-sm font-semibold text-cyan-950 hover:bg-white">
                        Ignorer
                      </button>
                      <button type="button" onClick={() => applyImportPreview()} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                        Importer ces montants
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Loyers" value={eur(importPreview.grossRent)} sub={`${importPreview.rows.length} écriture(s)`} />
                    <Stat label="Autres recettes" value={eur(importPreview.otherIncome)} />
                    <Stat label="Intérêts d'emprunt" value={eur(importPreview.interest)} />
                    <Stat label="Charges classées" value={eur(importPreview.propertyTax + importPreview.insurance + importPreview.copro + importPreview.repairs + importPreview.managementFees + importPreview.utilities)} />
                  </div>
                </section>
              ) : null}

              <div className="flex justify-end">
                <button type="button" onClick={() => setActiveStep("verify")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  Vérifier les montants
                </button>
              </div>
            </div>
          ) : null}

          {/* ── Étape 3 : Vérifier ───────────────────────────────────── */}
          {activeStep === "verify" ? (
            <div className="space-y-4">
              <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">2. Contrôler les montants</p>
                    <p className="mt-1 text-sm text-slate-600">Les montants peuvent venir de Finance ou être corrigés manuellement.</p>
                  </div>
                  <button type="button" onClick={save} disabled={loading} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                    {loading ? "Sauvegarde..." : rowId ? "Sauvegarder" : "Créer le dossier"}
                  </button>
                </div>

                <div className="mt-4 space-y-5">
                  {/* Recettes */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 mb-3">Recettes</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Loyers encaissés" value={grossRent} onChange={setGrossRent} />
                      <Field
                        label="Charges récupérées"
                        value={chargesRecovered}
                        onChange={setChargesRecovered}
                        hint={isNu ? "S'ajoutent aux revenus fonciers — ne sont pas déductibles" : undefined}
                      />
                      <Field label="Autres recettes" value={otherIncome} onChange={setOtherIncome} />
                      <Field
                        label="Dépôt garantie (indicatif)"
                        value={depositReceived}
                        onChange={setDepositReceived}
                        hint="Non imposable sauf si conservé définitivement"
                      />
                    </div>
                  </div>

                  {/* Charges déductibles */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 mb-3">
                      {isMicro ? "Charges (indicatif — non utilisées en micro)" : "Charges déductibles"}
                    </p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field
                        label="Intérêts d'emprunt"
                        value={interest}
                        onChange={setInterest}
                        hint={isMicro ? "Non déductibles en micro (abattement forfaitaire)" : undefined}
                      />
                      <Field label="Assurances (PNO / GLI)" value={insurance} onChange={setInsurance} />
                      <Field label="Taxe foncière" value={propertyTax} onChange={setPropertyTax} />
                      <Field label="Copro non récupérable" value={copro} onChange={setCopro} />
                      <Field label="Travaux / entretien" value={repairs} onChange={setRepairs} />
                      <Field label="Gestion / conciergerie" value={managementFees} onChange={setManagementFees} />
                      <Field label="Eau / élec / internet" value={utilities} onChange={setUtilities} />
                      <Field label="Autres charges" value={otherExpenses} onChange={setOtherExpenses} />
                      {regime === "nu_reel" ? (
                        <Field
                          label="CFE (Cotisation Foncière)"
                          value={cfe}
                          onChange={setCfe}
                          hint="Déductible en réel foncier — non applicable en micro"
                        />
                      ) : null}
                    </div>
                  </div>

                  {/* Amortissements LMNP réel */}
                  {regime === "lmnp_reel" ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 mb-3">Amortissements LMNP réel</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field
                          label="Amortissement mobilier (déductible)"
                          value={amortizationMobilier}
                          onChange={setAmortizationMobilier}
                          hint="Meubles, équipements, électroménager — durée 5-10 ans"
                        />
                        <Field
                          label="Amortissement immobilier (info)"
                          value={amortizationImmobilier}
                          onChange={setAmortizationImmobilier}
                          hint="Non déductible en LMNP non-professionnel — uniquement informatif"
                        />
                      </div>
                      {amortizationImmobilier > 0 ? (
                        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          L'amortissement immobilier n'est pas déductible en LMNP non-professionnel. Seul le mobilier est pris en compte dans le calcul du résultat.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-950">Lecture automatique</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className={cx("rounded-2xl border p-4", isLmnp ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-slate-50")}>
                    <p className="text-sm font-semibold text-slate-900">Meublé LMNP</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {locationKind === "meuble_saisonnier_classe" ? "Micro-BIC tourisme classé (abattement 71 %)" : "Micro-BIC (abattement 50 %)"}
                    </p>
                    <p className="text-sm font-semibold text-slate-800">{eur(microBicBase)}</p>
                    <p className="mt-2 text-xs text-slate-500">Réel LMNP (résultat)</p>
                    <p className="text-sm font-semibold text-slate-800">{eur(realLmnpBase)}</p>
                  </div>
                  <div className={cx("rounded-2xl border p-4", isNu || isPinel ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-slate-50")}>
                    <p className="text-sm font-semibold text-slate-900">Location nue</p>
                    <p className="mt-2 text-xs text-slate-500">Micro-foncier (abattement 30 %)</p>
                    <p className="text-sm font-semibold text-slate-800">{eur(microFoncierBase)}</p>
                    <p className="mt-2 text-xs text-slate-500">Réel foncier (résultat)</p>
                    <p className="text-sm font-semibold text-slate-800">{eur(realNuBase)}</p>
                  </div>
                </div>
                {isPinel && pinelAcqPrice > 0 ? (
                  <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                    <p className="text-sm font-semibold text-indigo-900">Pinel — réduction d'impôt</p>
                    <p className="mt-1 text-xs text-indigo-700">
                      Réduction = {(pinelRate * 100).toFixed(0)} % × {eur(pinelAcqPrice)} = {eur(pinelTotalReduction)} sur {pinelCommitmentYears} ans
                    </p>
                    <p className="text-lg font-bold text-indigo-950">{eur(pinelYearlyReduction)} / an</p>
                    <p className="mt-1 text-xs text-indigo-600">La base imposable reste le revenu foncier (location nue réel ou micro).</p>
                  </div>
                ) : null}
                {recommendedMode ? (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
                    <SparklesIcon className="mr-2 inline h-4 w-4" />
                    {recommendedMode}
                  </div>
                ) : null}
              </section>

              <div className="flex justify-between gap-2">
                <button type="button" onClick={() => setActiveStep("prepare")} className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Retour
                </button>
                <button type="button" onClick={() => setActiveStep("export")} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  Voir les points à traiter
                </button>
              </div>
            </div>
          ) : null}

          {/* ── Étape 4 : Export ─────────────────────────────────────── */}
          {activeStep === "export" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">Points à traiter</p>
                  <div className="mt-3 space-y-2">
                    {alerts.map((alert, idx) => (
                      <div key={idx} className={cx("rounded-2xl border px-3 py-3 text-sm", alert.tone === "red" ? "border-red-200 bg-red-50 text-red-800" : alert.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900")}>
                        {alert.tone !== "emerald" ? <ExclamationTriangleIcon className="mr-2 inline h-4 w-4" /> : <CheckCircleIcon className="mr-2 inline h-4 w-4" />}
                        {alert.text}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">Justificatifs à garder</p>
                  <div className="mt-3 space-y-2">
                    {checklist.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-slate-700">{item.label}</span>
                        <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", item.ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>
                          {item.ok ? "OK" : "À vérifier"}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Dossier à exporter</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Synthèse {year} pour {selectedPropertyLabel} : recettes {eur(receiptsTotal)}, base imposable estimée {eur(taxableApprox)} ({regimeLabel(regime)}).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={save} disabled={loading} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60">
                      {loading ? "Sauvegarde..." : "Sauvegarder"}
                    </button>
                    <button type="button" onClick={exportDossier} className={cx("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold", brandBg, brandText, brandHover)}>
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Exporter le dossier
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                Cette aide prépare vos chiffres et vos justificatifs. Elle ne remplace pas la déclaration officielle sur impots.gouv ni l'avis d'un professionnel.
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
