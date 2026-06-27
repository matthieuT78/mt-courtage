// components/PlusValueWizard.tsx
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabaseClient";
import CalculatorWizardShell from "./calculators/CalculatorWizardShell";
import {
  safeEmail,
  loadLeadEmail,
  persistLeadEmail,
  isUnlockedForEmail,
  persistUnlock,
} from "../lib/leads";

const PLUSVALUE_STORAGE_KEY = "plus_value_simulation_v1";

/* ------------------------ Format helpers ------------------------ */
function formatEuro(val: number) {
  if (!Number.isFinite(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
function formatPct(val: number) {
  if (!Number.isFinite(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}
function onlyDigits(s: string) {
  return (s || "").replace(/[^\d]/g, "");
}
function onlyNumberLike(s: string) {
  const cleaned = (s || "").replace(",", ".").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return parts[0] + "." + parts.slice(1).join("");
}
function toInt(v: string, fallback = 0) {
  const x = parseInt(v, 10);
  return Number.isFinite(x) ? x : fallback;
}
function toFloat(v: string, fallback = 0) {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : fallback;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* ------------------------ UI helpers ------------------------ */
function InfoBadge({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1 align-middle">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[0.6rem] font-semibold text-slate-500 cursor-help">
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[125%] z-20 hidden w-72 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-[0.7rem] text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

function StepHint({
  title,
  bullets,
  tone = "info",
}: {
  title: string;
  bullets: string[];
  tone?: "info" | "warn";
}) {
  const styles =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={`rounded-xl border ${styles} px-3 py-2`}>
      <p className="text-[0.75rem] font-semibold">{title}</p>
      <ul className="mt-1 text-[0.75rem] list-disc pl-5 space-y-0.5">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------ Tracking helpers ------------------------ */
function getUtmFromUrl(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const sp = new URLSearchParams(window.location.search);
    const keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "msclkid",
    ];
    const utm: Record<string, string> = {};
    for (const k of keys) {
      const v = sp.get(k);
      if (v) utm[k] = v;
    }
    return Object.keys(utm).length ? utm : null;
  } catch {
    return null;
  }
}
function getSourceLabel(): string {
  if (typeof window === "undefined") return "plus_value_wizard";
  try {
    const ref = document.referrer || "";
    if (!ref) return "direct";
    const refHost = new URL(ref).host;
    const curHost = window.location.host;
    if (refHost && curHost && refHost === curHost) return "internal";
    return `ref:${refHost || "unknown"}`;
  } catch {
    return "direct";
  }
}

/* ------------------------ Loan helpers ------------------------ */
function monthlyPayment(principal: number, annualRatePct: number, years: number) {
  const P = Math.max(0, principal || 0);
  const n = Math.max(0, Math.round((years || 0) * 12));
  const r = Math.max(0, (annualRatePct || 0) / 100) / 12;
  if (P <= 0 || n <= 0) return 0;
  if (r === 0) return P / n;
  return (P * r) / (1 - Math.pow(1 + r, -n));
}

function remainingBalanceFromElapsedYears(params: {
  principal: number;
  annualRatePct: number;
  yearsTotal: number;
  yearsElapsed: number;
}) {
  const P = Math.max(0, params.principal || 0);
  const n = Math.max(0, Math.round((params.yearsTotal || 0) * 12));
  const k = Math.max(0, Math.min(n, Math.round((params.yearsElapsed || 0) * 12)));
  const r = Math.max(0, (params.annualRatePct || 0) / 100) / 12;

  if (P <= 0 || n <= 0) return { balance: 0, payment: 0, monthsTotal: n, monthsElapsed: k };
  if (r === 0) {
    const payment = P / n;
    const balance = Math.max(0, P - payment * k);
    return { balance, payment, monthsTotal: n, monthsElapsed: k };
  }

  const fN = Math.pow(1 + r, n);
  const fK = Math.pow(1 + r, k);
  const denom = fN - 1;
  const balance = denom > 0 ? P * ((fN - fK) / denom) : 0;

  const payment = monthlyPayment(P, params.annualRatePct, params.yearsTotal);
  return { balance: Math.max(0, balance), payment, monthsTotal: n, monthsElapsed: k };
}

/* ------------------------ Fiscal helpers (France - estimation) ------------------------ */
function abatementsFrance(yearsHeld: number) {
  const y = Math.max(0, Math.floor(yearsHeld || 0));

  // IR : 0% jusqu'à 5 ans, 6%/an (6e->21e), puis exonération à 22 ans
  let abIR = 0;
  if (y <= 5) abIR = 0;
  else if (y >= 22) abIR = 100;
  else {
    const y6_21 = clamp(Math.min(y, 21) - 5, 0, 16);
    abIR = clamp(y6_21 * 6, 0, 100);
  }

  // PS : 0% jusqu'à 5 ans, 1.65%/an (6e->21e), 1.6% la 22e, 9%/an (23e->30e)
  let abPS = 0;
  if (y <= 5) abPS = 0;
  else if (y >= 30) abPS = 100;
  else {
    const y6_21 = clamp(Math.min(y, 21) - 5, 0, 16);
    abPS = y6_21 * 1.65;
    if (y >= 22) abPS += 1.6;
    if (y >= 23) {
      const y23_30 = clamp(y - 22, 0, 8);
      abPS += y23_30 * 9;
    }
    abPS = clamp(abPS, 0, 100);
  }

  return { abIR, abPS };
}

function surtaxePlusValueEstimee(gainTaxableIR: number) {
  const g = Math.max(0, gainTaxableIR || 0);
  if (g <= 50000) return 0;

  if (g <= 60000) return Math.max(0, g * 0.02 - (60000 - g) / 20);
  if (g <= 100000) return g * 0.02;
  if (g <= 110000) return Math.max(0, g * 0.03 - (110000 - g) / 10);
  if (g <= 150000) return g * 0.03;
  if (g <= 160000) return Math.max(0, g * 0.04 - (160000 - g) * 0.15);
  if (g <= 200000) return g * 0.04;
  if (g <= 210000) return Math.max(0, g * 0.05 - (210000 - g) * 0.2);
  if (g <= 250000) return g * 0.05;
  if (g <= 260000) return Math.max(0, g * 0.06 - (260000 - g) * 0.25);
  return g * 0.06;
}

function iraPlafondLegal(crd: number, annualRatePct: number) {
  const capital = Math.max(0, crd || 0);
  const rate = Math.max(0, annualRatePct || 0) / 100;
  if (capital <= 0 || rate <= 0) return 0;
  return Math.round(Math.min(capital * 0.03, (capital * rate) / 2));
}

/* ------------------------ Types ------------------------ */
type ResidenceType = "principale" | "secondaire" | "invest";
type RentalTaxMode = "nu" | "lmnp";
type AcquisitionFraisMode = "reel" | "forfait_7_5";
type TravauxMode = "reel" | "forfait_15" | "aucun";

type PVResult = {
  salePrice: number;
  saleCosts: number;
  netSalePriceForPV: number;

  purchasePrice: number;
  acquisitionCosts: number;
  worksCosts: number;
  lmnpAmortizationReintegration: number;
  totalPurchaseCost: number;

  grossGain: number;

  isExempt: boolean;
  yearsHeld: number;
  abIR: number;
  abPS: number;
  taxableIR: number;
  taxablePS: number;
  taxIR: number;
  taxPS: number;
  surtax: number;
  totalTax: number;

  crd: number;
  ira: number;
  iraCap: number;
  loanPayoff: number;
  netCashSeller: number;

  breakevenSalePrice: number;
};

export type PlusValueWizardProps = {
  showSaveButton?: boolean;
};

/* ------------------------ Plan d'action lokt ------------------------ */
type ActionPlanItemType = "blocking" | "warning" | "positive" | "tip";
type ActionPlanItem = { type: ActionPlanItemType; title: string; body: string };

const ACTION_ITEM_CONFIG: Record<
  ActionPlanItemType,
  { Icon: ComponentType<SVGProps<SVGSVGElement>>; badge: string; bg: string; border: string; iconBg: string; iconText: string; titleText: string; badgeCls: string }
> = {
  blocking: { Icon: ExclamationTriangleIcon, badge: "Bloquant",    bg: "bg-red-50",     border: "border-red-200",     iconBg: "bg-red-100",     iconText: "text-red-600",     titleText: "text-red-900",     badgeCls: "bg-red-100 text-red-700" },
  warning:  { Icon: ExclamationCircleIcon,  badge: "A surveiller", bg: "bg-amber-50",   border: "border-amber-200",   iconBg: "bg-amber-100",   iconText: "text-amber-600",   titleText: "text-amber-900",   badgeCls: "bg-amber-100 text-amber-700" },
  positive: { Icon: CheckCircleIcon,        badge: "Atout",        bg: "bg-emerald-50", border: "border-emerald-200", iconBg: "bg-emerald-100", iconText: "text-emerald-600", titleText: "text-emerald-900", badgeCls: "bg-emerald-100 text-emerald-700" },
  tip:      { Icon: LightBulbIcon,          badge: "Conseil",      bg: "bg-indigo-50",  border: "border-indigo-200",  iconBg: "bg-indigo-100",  iconText: "text-indigo-600",  titleText: "text-indigo-900",  badgeCls: "bg-indigo-100 text-indigo-700" },
};

function buildPlusValueActionPlan(
  r: PVResult,
  ctx: { residenceType: ResidenceType; yearsHeld: number; applySurtax: string }
): ActionPlanItem[] {
  const { residenceType, yearsHeld } = ctx;
  const items: ActionPlanItem[] = [];

  // ── BLOCKING ──────────────────────────────────────────────────
  if (r.netCashSeller < 0) {
    const manque = Math.abs(r.netCashSeller);
    items.push({ type: "blocking", title: "Vente à perte nette : le prix ne suffit pas",
      body: `Après impôts (${formatEuro(r.totalTax)}) et remboursement bancaire (${formatEuro(r.loanPayoff)}), il vous manque ${formatEuro(manque)} pour solder l'opération. Soit vous relevez le prix de vente, soit vous apportez des fonds propres à la vente.` });
  }

  // ── WARNINGS ──────────────────────────────────────────────────
  if (!r.isExempt && r.totalTax > r.netSalePriceForPV * 0.10) {
    items.push({ type: "warning", title: "Fiscalité significative — plus de 10% du prix net",
      body: `L'impôt estimé (${formatEuro(r.totalTax)}) représente ${Math.round((r.totalTax / r.netSalePriceForPV) * 100)}% de votre prix net vendeur. Avant de signer, vérifiez avec un notaire si des abattements supplémentaires ou un report de cession peuvent alléger cette charge.` });
  }

  if (r.loanPayoff > r.netSalePriceForPV * 0.50) {
    items.push({ type: "warning", title: "Le prêt absorbe plus de la moitié du prix net",
      body: `Le remboursement bancaire (CRD + IRA = ${formatEuro(r.loanPayoff)}) représente ${Math.round((r.loanPayoff / r.netSalePriceForPV) * 100)}% de votre prix net. Confirmez le CRD exact auprès de votre banque avant de fixer le prix — une erreur de quelques milliers d'euros peut retourner l'opération.` });
  }

  if (!r.isExempt && yearsHeld < 5 && r.grossGain > 0) {
    items.push({ type: "warning", title: "Détention courte — aucun abattement applicable",
      body: `Avec ${yearsHeld} an(s) de détention, les abattements IR/PS démarrent à partir de la 6e année. La plus-value brute (${formatEuro(r.grossGain)}) est donc taxée à plein régime (IR 19% + PS 17,2%).` });
  }

  if (!r.isExempt && r.surtax > 0) {
    items.push({ type: "warning", title: "Surtaxe applicable — plus-value > 50 000€",
      body: `Votre gain taxable IR (${formatEuro(r.taxableIR)}) dépasse le seuil de 50 000€ déclenchant la surtaxe (${formatEuro(r.surtax)} estimée). Ce barème progressif peut aller jusqu'à 6% du gain. Un notaire peut valider ce calcul avant la signature.` });
  }

  if (r.grossGain < 0) {
    items.push({ type: "warning", title: "Moins-value : perte sur le capital investi",
      body: `Vous vendez ${formatEuro(Math.abs(r.grossGain))} en dessous de votre coût d'acquisition (${formatEuro(r.totalPurchaseCost)}). Bonne nouvelle : aucun impôt sur plus-value n'est dû. Mais cette perte n'est pas déductible d'autres revenus en France.` });
  }

  // ── POSITIFS ──────────────────────────────────────────────────
  if (r.isExempt) {
    items.push({ type: "positive", title: "Résidence principale — exonération totale d'impôt",
      body: `La vente d'une résidence principale est exonérée d'IR et de prélèvements sociaux en France, quelle que soit la durée de détention. L'impôt estimé ici est donc nul — votre cash net vendeur est maximisé.` });
  }

  if (!r.isExempt && r.netCashSeller >= 0 && r.netCashSeller > r.netSalePriceForPV * 0.15) {
    items.push({ type: "positive", title: "Cash net confortable après impôts et banque",
      body: `Vous récupérez ${formatEuro(r.netCashSeller)} net, soit ${Math.round((r.netCashSeller / r.netSalePriceForPV) * 100)}% de votre prix net vendeur. Cette réserve couvre aisément les frais de transition (notaire achat suivant, déménagement, fonds propres).` });
  } else if (r.isExempt && r.netCashSeller > 0) {
    items.push({ type: "positive", title: "Cash net positif — opération rentable",
      body: `Vous récupérez ${formatEuro(r.netCashSeller)} net après remboursement bancaire. Sans impôt à payer (résidence principale), cette somme est intégralement disponible pour votre prochain projet.` });
  }

  if (!r.isExempt && yearsHeld >= 22 && residenceType !== "principale") {
    items.push({ type: "positive", title: "Exonération IR totale atteinte — 22 ans de détention",
      body: `Après 22 ans, la plus-value est totalement exonérée d'impôt sur le revenu (IR). Vous ne payez plus que les prélèvements sociaux (PS), dont l'exonération totale intervient à 30 ans.` });
  } else if (!r.isExempt && r.abIR >= 60 && r.abIR < 100) {
    items.push({ type: "positive", title: `Abattement IR de ${Math.round(r.abIR)}% — détention favorable`,
      body: `Votre durée de détention (${yearsHeld} ans) vous donne droit à un abattement IR de ${Math.round(r.abIR)}%. Plus vous attendez (jusqu'à 22 ans), plus l'impôt IR diminue.` });
  }

  // ── CONSEILS ──────────────────────────────────────────────────
  if (!r.isExempt && yearsHeld >= 18 && yearsHeld < 22) {
    const restant = 22 - yearsHeld;
    items.push({ type: "tip", title: `Exonération IR totale dans ${restant} an(s) — vaut-il attendre ?`,
      body: `À 22 ans de détention, la plus-value sera totalement exonérée d'IR. Si vous pouvez reporter la vente de ${restant} an(s), l'économie fiscale serait de ${formatEuro(r.taxIR)}. Comparez cet avantage avec le coût de portage du bien (crédit, charges, fiscalité foncière).` });
  }

  if (!r.isExempt && yearsHeld >= 26 && yearsHeld < 30) {
    const restant = 30 - yearsHeld;
    items.push({ type: "tip", title: `Exonération PS totale dans ${restant} an(s) — dernière ligne droite`,
      body: `À 30 ans, les prélèvements sociaux (PS) seront totalement exonérés. Il vous reste ${restant} an(s). L'économie en jeu est de ${formatEuro(r.taxPS)}. À peser selon votre situation et le marché actuel.` });
  }

  if (r.crd > 0) {
    items.push({ type: "tip", title: "Demandez le CRD exact à votre banque avant de signer",
      body: `Le capital restant dû fluctue chaque mois. Demandez un tableau d'amortissement ou un relevé de CRD à date de vente estimée à votre banque — une erreur de quelques milliers d'euros peut modifier significativement votre cash net.` });
  }

  if (!r.isExempt && r.lmnpAmortizationReintegration > 0) {
    items.push({ type: "tip", title: "LMNP : amortissements réintégrés dans la base taxable",
      body: `En LMNP, les amortissements déduits fiscalement (${formatEuro(r.lmnpAmortizationReintegration)}) sont réintégrés dans le calcul de la plus-value. Cela augmente la base imposable par rapport à une location nue. Un expert-comptable peut valider ce montant.` });
  }

  return items;
}

/* ------------------------ Analysis rendering (PretRelais style) ------------------------ */
const renderAnalysisBlocks = (text: string) => {
  if (!text) return null;

  const sections = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return (
    <div className="space-y-3">
      {sections.map((section, idx) => {
        const lines = section
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (!lines.length) return null;

        const title = lines[0];
        const body = lines.slice(1);

        return (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3">
            <p className="text-[0.75rem] font-semibold text-slate-900 mb-1">{title}</p>
            {body.map((line, i) => (
              <p key={i} className="text-[0.8rem] text-slate-700 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default function PlusValueWizard({ showSaveButton = true }: PlusValueWizardProps) {
  /* ======================== Session ======================== */
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        const s = data.session;
        if (!mounted) return;
        setSessionEmail(s?.user?.email ?? null);
        setSessionUserId(s?.user?.id ?? null);
      } catch {
        // silence
      }
    };
    run();

    const sub =
      supabase?.auth.onAuthStateChange((_e, s) => {
        setSessionEmail(s?.user?.email ?? null);
        setSessionUserId(s?.user?.id ?? null);
      }) ?? null;

    return () => {
      mounted = false;
      sub?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  const isLoggedIn = !!sessionUserId;

  /* ======================== Wizard steps ======================== */
  const [step, setStep] = useState<number>(1);
  const TOTAL_STEPS = 4;
  const [maxStepReached, setMaxStepReached] = useState<number>(1);
  const stepLabels = useMemo(() => ["La vente", "L’achat", "Le crédit", "Fiscalité"], []);
  const progressSteps = useMemo(
    () => [
      { label: stepLabels[0], icon: BanknotesIcon },
      { label: stepLabels[1], icon: BuildingOffice2Icon },
      { label: stepLabels[2], icon: CreditCardIcon },
      { label: stepLabels[3], icon: ScaleIcon },
    ],
    [stepLabels]
  );
  useEffect(() => setMaxStepReached((m) => Math.max(m, step)), [step]);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));
  const goToStep = (target: number) => {
    const t = Math.min(Math.max(target, 1), TOTAL_STEPS);
    if (t <= maxStepReached) setStep(t);
  };

  /* ======================== Common input styles ======================== */
  const inputBase =
    "w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm " +
    "focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const inputSmall =
    "w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm " +
    "focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const selectBase =
    "w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 sm:rounded-lg sm:py-2 sm:text-sm " +
    "focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const labelBase = "text-xs text-slate-700 leading-tight min-h-[2.25rem] flex items-center gap-1";

  /* ======================== Step 1: Vente ======================== */
  const [residenceType, setResidenceType] = useState<ResidenceType>("principale");
  const [rentalTaxMode, setRentalTaxMode] = useState<RentalTaxMode>("nu");
  const [lmnpAmortization, setLmnpAmortization] = useState<string>("0");
  const [yearsHeld, setYearsHeld] = useState<string>("8");

  const [salePrice, setSalePrice] = useState<string>("350000");
  const [saleAgencyFeesSeller, setSaleAgencyFeesSeller] = useState<string>("0");
  const [saleOtherCosts, setSaleOtherCosts] = useState<string>("1000");

  /* ======================== Step 2: Achat ======================== */
  const [purchasePrice, setPurchasePrice] = useState<string>("250000");

  const [acqFraisMode, setAcqFraisMode] = useState<AcquisitionFraisMode>("forfait_7_5");
  const [acqNotaryFees, setAcqNotaryFees] = useState<string>("");
  const [acqAgencyFees, setAcqAgencyFees] = useState<string>("");

  const [travauxMode, setTravauxMode] = useState<TravauxMode>("reel");
  const [travauxAmount, setTravauxAmount] = useState<string>("0");

  /* ======================== Step 3: Crédit ======================== */
  const [loanHas, setLoanHas] = useState<"oui" | "non">("oui");
  const [crdMode, setCrdMode] = useState<"connu" | "estime">("estime");
  const [crdKnown, setCrdKnown] = useState<string>("120000");

  const [loanPrincipal, setLoanPrincipal] = useState<string>("200000");
  const [loanRate, setLoanRate] = useState<string>("2.0");
  const [loanYearsTotal, setLoanYearsTotal] = useState<string>("20");
  const [loanYearsElapsed, setLoanYearsElapsed] = useState<string>("8");

  const [iraMode, setIraMode] = useState<"aucune" | "plafond_legal" | "pourcent">("plafond_legal");
  const [iraPct, setIraPct] = useState<string>("1.0");

  /* ======================== Step 4: Fiscalité ======================== */
  const [applySurtax, setApplySurtax] = useState<"oui" | "non">("oui");

  /* ======================== Résultats ======================== */
  const [result, setResult] = useState<PVResult | null>(null);
  const [actionItems, setActionItems] = useState<ActionPlanItem[]>([]);

  /* ======================== Gate (par calculette) ======================== */
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [consentContact, setConsentContact] = useState<boolean>(false);
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);

  // Email (optionnel)
  const [sendByEmail] = useState<boolean>(true);
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [sendEmailMsg, setSendEmailMsg] = useState<string | null>(null);

  // 1) Restore email depuis session OU localStorage tool-specific
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isLoggedIn) {
      setUnlocked(true);
      if (sessionEmail && !leadEmail) setLeadEmail(sessionEmail);
      return;
    }

    const fromSession = safeEmail(sessionEmail ?? "");
    const fromStorage = loadLeadEmail("plus-value-vente-immobiliere");
    const next = fromSession || fromStorage;

    if (next && safeEmail(leadEmail) !== next) setLeadEmail(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail, isLoggedIn]);

  // 2) Persist email au fil de l’eau (tool-specific)
  useEffect(() => {
    const e = safeEmail(leadEmail);
    if (!e) return;
    persistLeadEmail("plus-value-vente-immobiliere", e);
  }, [leadEmail]);

  // 3) Restore unlock tool-specific (et invalide si email change)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isLoggedIn) {
      setUnlocked(true);
      return;
    }

    const e = safeEmail(leadEmail);
    if (!e) {
      setUnlocked(false);
      return;
    }

    const ok = isUnlockedForEmail("plus-value-vente-immobiliere", e);
    setUnlocked(ok);
  }, [leadEmail, isLoggedIn]);

  const canShowFullAnalysis = useMemo(() => isLoggedIn || unlocked, [isLoggedIn, unlocked]);

  /* ======================== Calcul core ======================== */
  const computeAll = (overrides?: { salePrice?: number }) => {
    const salePriceNum = Number.isFinite(overrides?.salePrice)
      ? Math.max(0, Math.round(overrides!.salePrice!))
      : toInt(salePrice, 0);

    const saleAgencyNum = toInt(saleAgencyFeesSeller, 0);
    const saleOtherNum = toInt(saleOtherCosts, 0);

    const purchasePriceNum = toInt(purchasePrice, 0);
    const yearsHeldNum = Math.max(0, toInt(yearsHeld, 0));

    let acquisitionCosts = 0;
    if (acqFraisMode === "reel") acquisitionCosts = toInt(acqNotaryFees, 0) + toInt(acqAgencyFees, 0);
    else acquisitionCosts = Math.round(purchasePriceNum * 0.075);

    let worksCosts = 0;
    if (travauxMode === "aucun") worksCosts = 0;
    else if (travauxMode === "forfait_15") worksCosts = yearsHeldNum > 5 ? Math.round(purchasePriceNum * 0.15) : 0;
    else worksCosts = toInt(travauxAmount, 0);

    const saleCosts = Math.max(0, saleAgencyNum + saleOtherNum);
    const netSalePriceForPV = Math.max(0, salePriceNum - saleCosts);

    const lmnpAmortizationReintegration =
      residenceType === "invest" && rentalTaxMode === "lmnp" ? Math.max(0, toInt(lmnpAmortization, 0)) : 0;

    const totalPurchaseCost = Math.max(0, purchasePriceNum + acquisitionCosts + worksCosts - lmnpAmortizationReintegration);

    const grossGain = Math.round(netSalePriceForPV - totalPurchaseCost);

    const isExempt = residenceType === "principale";

    const { abIR, abPS } = abatementsFrance(yearsHeldNum);

    const baseGainForTax = isExempt ? 0 : Math.max(0, grossGain);
    const taxableIR = isExempt ? 0 : Math.max(0, baseGainForTax * (1 - abIR / 100));
    const taxablePS = isExempt ? 0 : Math.max(0, baseGainForTax * (1 - abPS / 100));

    const taxIR = isExempt ? 0 : Math.round(taxableIR * 0.19);
    const taxPS = isExempt ? 0 : Math.round(taxablePS * 0.172);

    const surtax = !isExempt && applySurtax === "oui" ? Math.round(surtaxePlusValueEstimee(taxableIR)) : 0;

    const totalTax = Math.max(0, taxIR + taxPS + surtax);

    let crd = 0;
    if (loanHas === "non") crd = 0;
    else {
      if (crdMode === "connu") crd = Math.max(0, toInt(crdKnown, 0));
      else {
        const principal = Math.max(0, toInt(loanPrincipal, 0));
        const rate = Math.max(0, toFloat(loanRate, 0));
        const yTotal = Math.max(0, toInt(loanYearsTotal, 0));
        const yElapsed = Math.max(0, toInt(loanYearsElapsed, 0));

        const { balance } = remainingBalanceFromElapsedYears({
          principal,
          annualRatePct: rate,
          yearsTotal: yTotal,
          yearsElapsed: yElapsed,
        });
        crd = Math.round(balance);
      }
    }

    let ira = 0;
    const iraCap = loanHas === "oui" ? iraPlafondLegal(crd, toFloat(loanRate, 0)) : 0;
    if (loanHas === "oui") {
      if (iraMode === "plafond_legal") ira = iraCap;
      else if (iraMode === "pourcent") {
        const rawIra = Math.round(crd * (toFloat(iraPct, 0) / 100));
        ira = iraCap > 0 ? Math.min(rawIra, iraCap) : rawIra;
      }
      else ira = 0;
    }

    const loanPayoff = Math.max(0, crd + ira);

    const netCashSeller = Math.round(netSalePriceForPV - totalTax - loanPayoff);

    const breakevenSalePrice = Math.round(totalPurchaseCost + saleCosts + loanPayoff);

    return {
      salePrice: salePriceNum,
      saleCosts,
      netSalePriceForPV,

      purchasePrice: purchasePriceNum,
      acquisitionCosts,
      worksCosts,
      lmnpAmortizationReintegration,
      totalPurchaseCost,

      grossGain,

      isExempt,
      yearsHeld: yearsHeldNum,
      abIR,
      abPS,
      taxableIR,
      taxablePS,
      taxIR,
      taxPS,
      surtax,
      totalTax,

      crd,
      ira,
      iraCap,
      loanPayoff,
      netCashSeller,

      breakevenSalePrice,
    } as PVResult;
  };

  const hasResult = !!result;

  const handleCalculate = async () => {
    setUnlockMsg(null);

    if (loanHas === "oui") {
      if (crdMode === "connu") {
        const v = toInt(crdKnown, 0);
        if (!crdKnown || v <= 0) {
          setUnlockMsg("CRD obligatoire : renseignez un capital restant dû (> 0).");
          setStep(3);
          return;
        }
      } else {
        const principal = toInt(loanPrincipal, 0);
        const rate = toFloat(loanRate, 0);
        const yTotal = toInt(loanYearsTotal, 0);
        const yElapsed = toInt(loanYearsElapsed, 0);
        if (principal <= 0 || rate < 0 || yTotal <= 0 || yElapsed < 0) {
          setUnlockMsg("Pour estimer le CRD : capital initial, taux, durée et années écoulées sont requis.");
          setStep(3);
          return;
        }
      }
    }

    const r = computeAll();
    setResult(r);
    setActionItems(buildPlusValueActionPlan(r, { residenceType, yearsHeld: toFloat(yearsHeld, 0), applySurtax }));

    if (typeof window !== "undefined") {
      const payload = {
        residenceType,
        rentalTaxMode,
        lmnpAmortization,
        yearsHeld,
        salePrice,
        saleAgencyFeesSeller,
        saleOtherCosts,
        purchasePrice,
        acqFraisMode,
        acqNotaryFees,
        acqAgencyFees,
        travauxMode,
        travauxAmount,
        loanHas,
        crdMode,
        crdKnown,
        loanPrincipal,
        loanRate,
        loanYearsTotal,
        loanYearsElapsed,
        iraMode,
        iraPct,
        applySurtax,
      };
      window.localStorage.setItem(PLUSVALUE_STORAGE_KEY, JSON.stringify(payload));
    }

  };

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => {
      document.getElementById("resultats-plusvalue")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(t);
  }, [result]);

  /* ======================== Restore inputs ======================== */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PLUSVALUE_STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);

      setResidenceType(saved.residenceType ?? "principale");
      setRentalTaxMode(saved.rentalTaxMode ?? "nu");
      setLmnpAmortization(saved.lmnpAmortization ? String(saved.lmnpAmortization) : "0");
      setYearsHeld(saved.yearsHeld ? String(saved.yearsHeld) : "8");

      setSalePrice(saved.salePrice ? String(saved.salePrice) : "350000");
      setSaleAgencyFeesSeller(saved.saleAgencyFeesSeller ? String(saved.saleAgencyFeesSeller) : "0");
      setSaleOtherCosts(saved.saleOtherCosts ? String(saved.saleOtherCosts) : "1000");

      setPurchasePrice(saved.purchasePrice ? String(saved.purchasePrice) : "250000");

      setAcqFraisMode(saved.acqFraisMode ?? "forfait_7_5");
      setAcqNotaryFees(saved.acqNotaryFees ? String(saved.acqNotaryFees) : "");
      setAcqAgencyFees(saved.acqAgencyFees ? String(saved.acqAgencyFees) : "");

      setTravauxMode(saved.travauxMode ?? "reel");
      setTravauxAmount(saved.travauxAmount ? String(saved.travauxAmount) : "0");

      setLoanHas(saved.loanHas ?? "oui");
      setCrdMode(saved.crdMode ?? "estime");
      setCrdKnown(saved.crdKnown ? String(saved.crdKnown) : "120000");

      setLoanPrincipal(saved.loanPrincipal ? String(saved.loanPrincipal) : "200000");
      setLoanRate(saved.loanRate ? String(saved.loanRate) : "2.0");
      setLoanYearsTotal(saved.loanYearsTotal ? String(saved.loanYearsTotal) : "20");
      setLoanYearsElapsed(saved.loanYearsElapsed ? String(saved.loanYearsElapsed) : "8");

      setIraMode(saved.iraMode ?? "plafond_legal");
      setIraPct(saved.iraPct ? String(saved.iraPct) : "1.0");

      setApplySurtax(saved.applySurtax ?? "oui");

      setUnlockMsg(null);
      setMaxStepReached(1);
      setStep(1);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Erreur restauration simulation plus-value :", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ======================== RPC lead capture ======================== */
  const captureLeadViaRpc = async (params: { email: string; computed: PVResult }) => {
    if (!supabase) throw new Error("Supabase non configuré.");

    const email = safeEmail(params.email);
    if (!email) throw new Error("Email manquant.");

    const utm = (typeof window !== "undefined" ? getUtmFromUrl() : null) ?? null;
    const source = getSourceLabel();

    const payload = {
      meta: { tool: "plus_value", version: "v1" },
      input: {
        residenceType,
        rentalTaxMode,
        lmnpAmortization: toInt(lmnpAmortization, 0),
        yearsHeld: toInt(yearsHeld, 0),
        sale: {
          salePrice: toInt(salePrice, 0),
          agencyFeesSeller: toInt(saleAgencyFeesSeller, 0),
          otherCosts: toInt(saleOtherCosts, 0),
        },
        purchase: {
          purchasePrice: toInt(purchasePrice, 0),
          acqFraisMode,
          acqNotaryFees: toInt(acqNotaryFees, 0),
          acqAgencyFees: toInt(acqAgencyFees, 0),
          travauxMode,
          travauxAmount: toInt(travauxAmount, 0),
        },
        loan: {
          loanHas,
          crdMode,
          crdKnown: toInt(crdKnown, 0),
          principal: toInt(loanPrincipal, 0),
          rate: toFloat(loanRate, 0),
          yearsTotal: toInt(loanYearsTotal, 0),
          yearsElapsed: toInt(loanYearsElapsed, 0),
          iraMode,
          iraPct: toFloat(iraPct, 0),
        },
        fiscal: { applySurtax },
      },
      output: params.computed,
      tracking: {
        source,
        utm,
        referrer: typeof window !== "undefined" ? document.referrer || null : null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        createdAtClient: new Date().toISOString(),
      },
      consent: { consent_analysis: true, consent_contact: consentContact },
      user: { user_id: sessionUserId || null, email: sessionEmail || null },
    };

    const { error } = await supabase.rpc("upsert_lead_v1", {
      p_tool: "plus_value",
      p_email: email,
      p_payload: payload,
      p_postal_code: null,
      p_city: null,
      p_phone: null,
      p_source: source,
      p_utm: utm,
      p_lead_age: null,
      p_project_property_kind: null,
      p_project_usage: null,
      p_project_timeline: null,
      p_project_budget_target: null,
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[rpc upsert_lead_v1] error:", error);
      throw new Error(error.message || "Erreur RPC");
    }
  };

  /* ======================== Email payload ======================== */
  function buildEmailComputed(params: { result: PVResult; displayResult: PVResult }) {
    return {
      meta: { tool: "plus-value-vente-immobiliere", version: "v1_email" },
      input: {
        residenceType,
        rentalTaxMode,
        lmnpAmortization,
        yearsHeld,
        salePrice,
        saleAgencyFeesSeller,
        saleOtherCosts,
        purchasePrice,
        acqFraisMode,
        acqNotaryFees,
        acqAgencyFees,
        travauxMode,
        travauxAmount,
        loanHas,
        crdMode,
        crdKnown,
        loanPrincipal,
        loanRate,
        loanYearsTotal,
        loanYearsElapsed,
        iraMode,
        iraPct,
        applySurtax,
      },
      output: {
        result: params.result,
        displayResult: params.displayResult,
      },
    };
  }

  async function sendPlusValueEmail(email: string, computed: any) {
    setSendEmailMsg(null);
    setSendingEmail(true);

    try {
      const r = await fetch("/api/tools/plus-value-vente-immobiliere/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, computed }),
      });

      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "email_failed");

      setSendEmailMsg("✅ Email envoyé (vérifiez les spams si besoin).");
      return true;
    } catch (e: any) {
      setSendEmailMsg("❌ Envoi email impossible : " + (e?.message || "erreur"));
      return false;
    } finally {
      setSendingEmail(false);
    }
  }

  const handleUnlock = async () => {
    setUnlockMsg(null);

    if (!hasResult) {
      setUnlockMsg("Calculez d’abord votre plus-value pour débloquer l’analyse.");
      return false;
    }

    const email = safeEmail(leadEmail);
    if (!email || !email.includes("@")) {
      setUnlockMsg("Merci de renseigner une adresse e-mail valide.");
      return false;
    }

    setUnlocking(true);
    try {
      await captureLeadViaRpc({ email, computed: result! });

      persistLeadEmail("plus-value-vente-immobiliere", email);
      persistUnlock("plus-value-vente-immobiliere", email);

      setUnlocked(true);
      setUnlockMsg("✅ Rapport prêt. Votre simulation est bien enregistrée.");
      return true;
    } catch (e: any) {
      setUnlockMsg("❌ Impossible d’enregistrer le dossier : " + (e?.message || "erreur inconnue"));
      return false;
    } finally {
      setUnlocking(false);
    }
  };

  /* ======================== Scénario (prix de vente) ======================== */
  const [scenarioEnabled, setScenarioEnabled] = useState<boolean>(false);
  const [salePriceScenario, setSalePriceScenario] = useState<number>(0);

  useEffect(() => {
    if (!result) return;
    setSalePriceScenario(result.salePrice || 0);
    setScenarioEnabled(false);
  }, [result?.salePrice]); // eslint-disable-line react-hooks/exhaustive-deps

  const sliderBounds = useMemo(() => {
    const base = result?.salePrice ? Math.max(1, result.salePrice) : Math.max(1, toInt(salePrice, 0));
    const min = Math.max(0, Math.round(base * 0.8));
    const max = Math.max(min + 1000, Math.round(base * 1.2));
    const step = base <= 500000 ? 1000 : 5000;
    return { min, max, step, base };
  }, [result, salePrice]);

  const scenarioResult = useMemo(() => {
    if (!result) return null;
    const sp = Number.isFinite(salePriceScenario) ? salePriceScenario : result.salePrice;
    return computeAll({ salePrice: sp });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    result,
    salePriceScenario,
        residenceType,
        rentalTaxMode,
        lmnpAmortization,
        yearsHeld,
    saleAgencyFeesSeller,
    saleOtherCosts,
    purchasePrice,
    acqFraisMode,
    acqNotaryFees,
    acqAgencyFees,
    travauxMode,
    travauxAmount,
    loanHas,
    crdMode,
    crdKnown,
    loanPrincipal,
    loanRate,
    loanYearsTotal,
    loanYearsElapsed,
        iraMode,
    iraPct,
    applySurtax,
  ]);

  const displayResult: PVResult | null = useMemo(() => {
    if (!result) return null;
    if (!scenarioEnabled) return result;
    return scenarioResult ?? result;
  }, [result, scenarioEnabled, scenarioResult]);

  /* ======================== Analyse texte ======================== */
  const buildDecisionLabel = (r: PVResult) => {
    if (r.netCashSeller < 0) return "Vente tendue : le prix ne couvre pas totalement impôts et prêt à solder.";
    if (!r.isExempt && r.totalTax > Math.max(1, r.netSalePriceForPV) * 0.08) {
      return "Fiscalité lourde : comparez avec un scénario d’attente ou un prix de vente supérieur.";
    }
    if (r.crd > 0 && r.loanPayoff > Math.max(1, r.netSalePriceForPV) * 0.55) {
      return "Banque dominante : le CRD absorbe une part importante du prix de vente.";
    }
    if (r.netCashSeller > 0) return "Vente lisible : le cash net reste positif après impôts et banque.";
    return "À vérifier : la conclusion dépend surtout du prix de vente final.";
  };

  const buildPlusValueTextDetail = (r: PVResult) => {
    const lines: string[] = [];

    lines.push(
      [
        "1) Résumé (ce que vous récupérez)",
        buildDecisionLabel(r),
        `Cash net vendeur : ${formatEuro(r.netCashSeller)}.`,
        `Prix net vendeur (après frais vendeur) : ${formatEuro(r.netSalePriceForPV)}.`,
        `Prêt à solder (CRD + IRA) : ${formatEuro(r.loanPayoff)}.`,
        `Impôts estimés sur plus-value : ${formatEuro(r.totalTax)}.`,
      ].join("\n")
    );

    lines.push(
      [
        "2) Plus-value (base de calcul)",
        `Plus-value brute : ${formatEuro(r.grossGain)}.`,
        `Coût fiscal retenu : ${formatEuro(r.totalPurchaseCost)} (achat + frais + travaux${r.lmnpAmortizationReintegration > 0 ? " − amortissements LMNP réintégrés" : ""}).`,
        `Prix net vendeur retenu : ${formatEuro(r.netSalePriceForPV)}.`,
        r.lmnpAmortizationReintegration > 0
          ? `LMNP : ${formatEuro(r.lmnpAmortizationReintegration)} d’amortissements déduits sont réintégrés dans cette estimation.`
          : "",
        r.isExempt
          ? "Résidence principale : présumé exonéré dans ce simulateur."
          : `Durée de détention : ${r.yearsHeld} an(s) → abattements : IR ${formatPct(r.abIR)} / PS ${formatPct(r.abPS)}.`,
      ].filter(Boolean).join("\n")
    );

    lines.push(
      [
        "3) Fiscalité (estimation France)",
        r.isExempt
          ? "Impôt = 0 € (exonération présumée)."
          : [
              `Base taxable IR : ${formatEuro(r.taxableIR)} → IR (19%) ≈ ${formatEuro(r.taxIR)}.`,
              `Base taxable PS : ${formatEuro(r.taxablePS)} → PS (17,2%) ≈ ${formatEuro(r.taxPS)}.`,
              `Surtaxe plus-value élevée ≈ ${formatEuro(r.surtax)}.`,
              `Total impôts ≈ ${formatEuro(r.totalTax)}.`,
            ].join("\n"),
      ].join("\n")
    );

    lines.push(
      [
        "4) Crédit / remboursement anticipé",
        `CRD : ${formatEuro(r.crd)}.`,
        `IRA : ${formatEuro(r.ira)}.`,
        r.iraCap > 0 ? `Plafond indicatif utilisé : ${formatEuro(r.iraCap)} (min. 6 mois d’intérêts / 3% du CRD).` : "",
        `Total à solder : ${formatEuro(r.loanPayoff)}.`,
        "À vérifier : attestation banque (le CRD exact peut changer la conclusion).",
      ].filter(Boolean).join("\n")
    );

    lines.push(
      [
        "5) Point de repère",
        `Prix de vente “à l’équilibre” (coût + frais + prêt) ≈ ${formatEuro(r.breakevenSalePrice)}.`,
        "Repère : c’est le prix auquel le cash net vendeur serait proche de 0 € (dans ce modèle).",
        "Documents à réunir : acte d’achat, décompte notaire, factures travaux, tableau d’amortissement ou attestation CRD.",
      ].join("\n")
    );

    return lines.join("\n\n");
  };

  /* ======================== UI ======================== */
  return (
    <div className="space-y-6">
      {/* Wizard */}
      <CalculatorWizardShell
          steps={progressSteps}
          currentIndex={step - 1}
          onStepClick={(index) => goToStep(index + 1)}
          canAccessStep={(index) => index + 1 <= maxStepReached}
          title="Estimez le produit réel de votre vente."
        >
        <div className="calculator-premium-form space-y-5">
        {/* Contenu */}
        <div className="space-y-3 rounded-[1.1rem] border border-slate-100 bg-slate-50/70 p-3 sm:rounded-xl sm:p-4">
          {/* === Step 1 === */}
          {step === 1 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">La vente (le bien que vous vendez)</h2>
              <p className="text-[0.75rem] text-slate-600">
                On calcule d’abord le <strong>prix net vendeur</strong> (prix de vente − frais vendeur). C’est la base
                du calcul de plus-value.
              </p>

              <StepHint
                title="Ce que fait cette étape"
                bullets={[
                  "Calcule le prix net vendeur = prix de vente − frais à votre charge.",
                  "Détermine si vous êtes présumé exonéré (résidence principale).",
                  "La durée de détention sert à estimer les abattements si vous n’êtes pas exonéré.",
                ]}
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Type d’occupation
                    <InfoBadge text="Si vous sélectionnez “résidence principale”, le simulateur considère la plus-value exonérée (0 €). En vrai, il existe des conditions (occupation effective, délais…). Si doute, choisissez “secondaire” pour une estimation prudente." />
                  </label>
                    <select
                      value={residenceType}
                      onChange={(e) => {
                        const next = e.target.value as ResidenceType;
                        setResidenceType(next);
                        if (next !== "invest") setRentalTaxMode("nu");
                      }}
                      className={selectBase}
                    >
                    <option value="principale">Résidence principale</option>
                    <option value="secondaire">Résidence secondaire</option>
                    <option value="invest">Investissement locatif</option>
                    </select>
                  </div>

                  {residenceType === "invest" ? (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700 flex items-center gap-1">
                        Régime locatif
                        <InfoBadge text="Le LMNP peut modifier l’estimation depuis 2025 si des amortissements ont été déduits. Pour une location nue, gardez “location nue”." />
                      </label>
                      <select
                        value={rentalTaxMode}
                        onChange={(e) => setRentalTaxMode(e.target.value as RentalTaxMode)}
                        className={selectBase}
                      >
                        <option value="nu">Location nue / non meublée</option>
                        <option value="lmnp">LMNP / meublé amorti</option>
                      </select>
                    </div>
                  ) : null}

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Durée de détention (années)
                    <InfoBadge text="Cette durée sert à appliquer les abattements (réduction progressive de l’impôt). Barème standard : IR exonéré à 22 ans, PS exonérés à 30 ans." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={yearsHeld}
                    onChange={(e) => setYearsHeld(onlyDigits(e.target.value))}
                    className={inputBase}
                  />
                </div>

                <div className="space-y-1 lg:col-span-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Prix de vente (net acheteur)
                    <InfoBadge text="Prix indiqué au compromis. On retire ensuite vos frais vendeur pour obtenir le “prix net vendeur”." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={salePrice}
                    onChange={(e) => setSalePrice(onlyDigits(e.target.value))}
                    className={inputBase}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Frais d’agence à votre charge
                    <InfoBadge text="Si le vendeur paie l’agence, mettez le montant ici. Sinon laissez 0. Ces frais diminuent le prix net vendeur." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={saleAgencyFeesSeller}
                    onChange={(e) => setSaleAgencyFeesSeller(onlyDigits(e.target.value))}
                    className={inputBase}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Autres frais vendeur
                    <InfoBadge text="Diagnostics, mainlevée, frais divers. Si vous ne savez pas, laissez 0." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={saleOtherCosts}
                    onChange={(e) => setSaleOtherCosts(onlyDigits(e.target.value))}
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[0.75rem] text-slate-700">
                  Prix de vente : <span className="font-semibold">{formatEuro(toInt(salePrice, 0))}</span> — frais vendeur{" "}
                  <span className="font-semibold">
                    {formatEuro(toInt(saleAgencyFeesSeller, 0) + toInt(saleOtherCosts, 0))}
                  </span>{" "}
                  → prix “net vendeur”{" "}
                  <span className="font-semibold">
                    {formatEuro(
                      Math.max(
                        0,
                        toInt(salePrice, 0) - (toInt(saleAgencyFeesSeller, 0) + toInt(saleOtherCosts, 0))
                      )
                    )}
                  </span>
                  .
                </p>
              </div>
            </>
          )}

          {/* === Step 2 === */}
          {step === 2 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">L’achat (le bien que vous avez acheté)</h2>
              <p className="text-[0.75rem] text-slate-600">
                On calcule le <strong>coût total d’acquisition</strong> (prix d’achat + frais + travaux). Plus ce coût
                est élevé, plus la plus-value diminue.
              </p>

              <StepHint
                title="Ce que fait cette étape"
                bullets={[
                  "Additionne prix d’achat + frais d’acquisition (réels ou forfait).",
                  "Ajoute les travaux (réels) ou un forfait 15% si détention > 5 ans (simplifié).",
                  "Le total est soustrait au prix net vendeur pour obtenir la plus-value brute.",
                ]}
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Prix d’achat
                    <InfoBadge text="Prix du bien dans l’acte d’achat (hors frais). On ajoute frais + travaux pour reconstituer le coût d’acquisition." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(onlyDigits(e.target.value))}
                    className={inputBase}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Frais d’acquisition
                    <InfoBadge text="Forfait 7,5% = estimation simple (souvent proche pour l’ancien). Choisissez “réels” si vous avez les montants exacts." />
                  </label>
                  <select
                    value={acqFraisMode}
                    onChange={(e) => setAcqFraisMode(e.target.value as AcquisitionFraisMode)}
                    className={selectBase}
                  >
                    <option value="forfait_7_5">Forfait 7,5% (repère)</option>
                    <option value="reel">Réels (notaire + agence)</option>
                  </select>
                </div>

                {acqFraisMode === "reel" ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700 flex items-center gap-1">
                        Frais de notaire (réels)
                        <InfoBadge text="Décompte notaire / acte d’achat. Ces frais réduisent la plus-value en augmentant le coût d’acquisition." />
                      </label>
                      <input
                        inputMode="numeric"
                        value={acqNotaryFees}
                        onChange={(e) => setAcqNotaryFees(onlyDigits(e.target.value))}
                        className={inputBase}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700 flex items-center gap-1">
                        Frais d’agence (réels)
                        <InfoBadge text="Frais d’agence payés à l’achat (s’ils existent séparément). S’ajoutent au coût d’acquisition." />
                      </label>
                      <input
                        inputMode="numeric"
                        value={acqAgencyFees}
                        onChange={(e) => setAcqAgencyFees(onlyDigits(e.target.value))}
                        className={inputBase}
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2">
                    <p className="text-[0.75rem] text-slate-700">
                      Forfait : <span className="font-semibold">7,5%</span> de{" "}
                      <span className="font-semibold">{formatEuro(toInt(purchasePrice, 0))}</span> ≈{" "}
                      <span className="font-semibold">{formatEuro(Math.round(toInt(purchasePrice, 0) * 0.075))}</span>
                    </p>
                  </div>
                )}

                  <div className="space-y-1">
                    <label className="text-xs text-slate-700 flex items-center gap-1">
                      Travaux
                    <InfoBadge text="Les travaux augmentent le coût d’acquisition. En pratique, seuls certains travaux sont éligibles (factures, nature). Le forfait 15% est un repère simplifié." />
                  </label>
                  <select
                    value={travauxMode}
                    onChange={(e) => setTravauxMode(e.target.value as TravauxMode)}
                    className={selectBase}
                  >
                    <option value="reel">Montant réel</option>
                    <option value="forfait_15">Forfait 15% (si &gt; 5 ans)</option>
        <option value="aucun">Aucun</option>
                  </select>
                </div>

                {travauxMode === "reel" ? (
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700 flex items-center gap-1">
                      Montant travaux
                      <InfoBadge text="Astuce : mettez 0 puis comparez ensuite avec le forfait 15% pour l’ordre de grandeur." />
                    </label>
                    <input
                      inputMode="numeric"
                      value={travauxAmount}
                      onChange={(e) => setTravauxAmount(onlyDigits(e.target.value))}
                      className={inputBase}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2">
                    <p className="text-[0.75rem] text-slate-700">
                      Travaux pris en compte :{" "}
                      <span className="font-semibold">
                        {travauxMode === "aucun"
                          ? formatEuro(0)
                          : toInt(yearsHeld, 0) > 5
                          ? formatEuro(Math.round(toInt(purchasePrice, 0) * 0.15))
                          : "0 € (forfait 15% possible après 5 ans)"}
                      </span>
                    </p>
                  </div>
                  )}

                  {residenceType === "invest" && rentalTaxMode === "lmnp" ? (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-700 flex items-center gap-1">
                        Amortissements LMNP déjà déduits
                        <InfoBadge text="Montant total des amortissements réellement déduits fiscalement. Dans cette estimation, ils augmentent la plus-value imposable. Si vous ne savez pas, laissez 0 puis vérifiez avec votre liasse ou expert-comptable." />
                      </label>
                      <input
                        inputMode="numeric"
                        value={lmnpAmortization}
                        onChange={(e) => setLmnpAmortization(onlyDigits(e.target.value))}
                        className={inputBase}
                      />
                    </div>
                  ) : null}
                </div>
            </>
          )}

          {/* === Step 3 === */}
          {step === 3 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Le crédit (sur le bien vendu)</h2>
              <p className="text-[0.75rem] text-slate-600">
                On estime ce que vous devez encore rembourser au moment de la vente : <strong>CRD</strong> +{" "}
                <strong>IRA</strong> éventuelles.
              </p>

              <StepHint
                title="Ce que fait cette étape"
                bullets={[
                    "CRD obligatoire si vous avez un prêt : c’est le montant à solder le jour de la vente.",
                    "Si vous ne connaissez pas le CRD, on l’estime via amortissement (capital, taux, durée, ancienneté).",
                    "Optionnel : IRA estimées avec un plafond indicatif ou un pourcentage de votre contrat.",
                ]}
                tone="warn"
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
                <div className="space-y-1">
                  <label className={labelBase}>
                    Avez-vous un crédit en cours ?
                    <InfoBadge text="Si vous avez un crédit, on soustrait CRD + IRA de votre prix net vendeur pour obtenir le cash net. Sinon, on met 0." />
                  </label>
                  <select
                    value={loanHas}
                    onChange={(e) => setLoanHas(e.target.value as "oui" | "non")}
                    className={selectBase}
                  >
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </div>

                {loanHas === "oui" ? (
                  <>
                    <div className="space-y-1">
                      <label className={labelBase}>
                        CRD (capital restant dû)
                        <InfoBadge text="Saisissez le CRD exact (attestation banque) ou estimez-le. C’est la variable #1 du cash net." />
                      </label>
                      <select
                        value={crdMode}
                        onChange={(e) => setCrdMode(e.target.value as "connu" | "estime")}
                        className={selectBase}
                      >
                        <option value="connu">Je connais mon CRD</option>
                        <option value="estime">Je l’estime (amortissement)</option>
                      </select>
                    </div>

                    {crdMode === "connu" ? (
                      <div className="space-y-1">
                        <label className={labelBase}>
                          CRD exact (€)
                          <InfoBadge text="Attestation de remboursement anticipé / tableau d’amortissement à date." />
                        </label>
                        <input
                          inputMode="numeric"
                          value={crdKnown}
                          onChange={(e) => setCrdKnown(onlyDigits(e.target.value))}
                          className={inputSmall}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <label className={labelBase}>
                            Capital initial emprunté
                            <InfoBadge text="On reconstruit un amortissement standard. Si votre prêt est atypique (différé/modulation/variable), l’estimation peut être moins précise." />
                          </label>
                          <input
                            inputMode="numeric"
                            value={loanPrincipal}
                            onChange={(e) => setLoanPrincipal(onlyDigits(e.target.value))}
                            className={inputSmall}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className={labelBase}>
                            Taux du prêt (%)
                            <InfoBadge text="Taux nominal annuel. L’assurance n’est pas intégrée dans le CRD." />
                          </label>
                          <input
                            inputMode="decimal"
                            value={loanRate}
                            onChange={(e) => setLoanRate(onlyNumberLike(e.target.value))}
                            className={inputSmall}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className={labelBase}>
                            Durée totale (années)
                            <InfoBadge text="Durée initiale du prêt (convertie en mois pour le calcul)." />
                          </label>
                          <input
                            inputMode="numeric"
                            value={loanYearsTotal}
                            onChange={(e) => setLoanYearsTotal(onlyDigits(e.target.value))}
                            className={inputSmall}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className={labelBase}>
                            Années déjà écoulées
                            <InfoBadge text="Approximation OK. Plus c’est précis, plus le CRD estimé est proche." />
                          </label>
                          <input
                            inputMode="numeric"
                            value={loanYearsElapsed}
                            onChange={(e) => setLoanYearsElapsed(onlyDigits(e.target.value))}
                            className={inputSmall}
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-1">
                      <label className={labelBase}>
                        IRA (remboursement anticipé)
                        <InfoBadge text="Certaines banques facturent des indemnités. Ici, on applique un % du CRD (repère)." />
                      </label>
                        <select
                          value={iraMode}
                          onChange={(e) => setIraMode(e.target.value as "aucune" | "plafond_legal" | "pourcent")}
                          className={selectBase}
                        >
                          <option value="plafond_legal">Plafond indicatif légal</option>
                          <option value="pourcent">Taux prévu au contrat</option>
                          <option value="aucune">Aucune / je ne sais pas</option>
                        </select>
                      </div>

                      {iraMode === "plafond_legal" && crdMode === "connu" ? (
                        <div className="space-y-1">
                          <label className={labelBase}>
                            Taux du prêt (%)
                            <InfoBadge text="Utilisé pour estimer 6 mois d’intérêts et comparer avec 3% du CRD." />
                          </label>
                          <input
                            inputMode="decimal"
                            value={loanRate}
                            onChange={(e) => setLoanRate(onlyNumberLike(e.target.value))}
                            className={inputSmall}
                          />
                          <p className="text-[0.65rem] text-slate-500">Repère : min. 6 mois d’intérêts / 3% du CRD.</p>
                        </div>
                      ) : iraMode === "pourcent" ? (
                        <div className="space-y-1">
                          <label className={labelBase}>
                            Taux IRA contrat (% du CRD)
                            <InfoBadge text="Exemple : CRD 120 000 € et 1% ⇒ 1 200 €. Si un taux du prêt est renseigné, on plafonne aussi par un repère légal indicatif." />
                          </label>
                        <input
                          inputMode="decimal"
                          value={iraPct}
                          onChange={(e) => setIraPct(onlyNumberLike(e.target.value))}
                          className={inputSmall}
                        />
                          <p className="text-[0.65rem] text-slate-500">Repère : souvent 0,5% à 3% selon contrat.</p>
                        </div>
                    ) : (
                      <div className="space-y-1 opacity-0 pointer-events-none select-none">
                        <label className={labelBase}>—</label>
                        <input className={inputSmall} value="" readOnly />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2 lg:col-span-2">
                    <p className="text-[0.75rem] text-slate-700">
                      Aucun crédit : le cash net vendeur dépend surtout des frais de vente et de la fiscalité.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* === Step 4 === */}
          {step === 4 && (
            <>
              <h2 className="text-sm font-semibold text-slate-900">Fiscalité (France — estimation)</h2>
              <p className="text-[0.75rem] text-slate-600">
                On estime l’impôt sur la plus-value : <strong>IR 19%</strong> + <strong>PS 17,2%</strong>, puis on
                applique des <strong>abattements</strong> selon la durée de détention.
              </p>

              <StepHint
                title="Ce que fait cette étape"
                bullets={[
                  "Si résidence principale : 0 € (présumé exonéré dans ce simulateur).",
                  "Sinon : base taxable IR/PS après abattements de durée.",
                    "Option : surtaxe des plus-values imposables supérieures à 50 000 €.",
                ]}
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
                <div className="space-y-1">
                  <label className={labelBase}>
                      Appliquer la surtaxe ?
                      <InfoBadge text="Si la plus-value imposable dépasse 50 000 €, une surtaxe progressive peut s’appliquer. Les terrains à bâtir et cas particuliers ne sont pas traités ici." />
                  </label>
                  <select
                    value={applySurtax}
                    onChange={(e) => setApplySurtax(e.target.value as "oui" | "non")}
                    className={selectBase}
                  >
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2 lg:col-span-2">
                  <p className="text-[0.75rem] text-slate-700">
                    Résidence principale → <span className="font-semibold">présumé exonéré</span> (0 €) dans ce simulateur.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[0.75rem] text-slate-700">
                  Repère : IR 19% + PS 17,2% (abattements selon durée).{" "}
                  <span className="text-slate-500">(Estimation — cas particuliers non gérés.)</span>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 1}
            className="min-h-11 rounded-full border border-slate-200 bg-white px-4 text-[0.8rem] font-semibold text-slate-600 hover:text-slate-900 disabled:cursor-default disabled:opacity-40 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:text-[0.75rem]"
          >
            ← Précédent
          </button>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => {
                setMaxStepReached((m) => Math.max(m, Math.min(step + 1, TOTAL_STEPS)));
                goNext();
              }}
              className="min-h-11 rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                setMaxStepReached(TOTAL_STEPS);
                await handleCalculate();
              }}
              className="min-h-11 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-[0.8rem] font-semibold text-white shadow-lg hover:shadow-2xl active:scale-[0.99]"
            >
              Calculer ma plus-value
            </button>
          )}
        </div>
        </div>
      </CalculatorWizardShell>

      {/* ======================== Résultats ======================== */}
      {(result && displayResult) && <section
        id="resultats-plusvalue"
        className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-700 mb-1">Résultats</p>
            <h2 className="text-sm font-semibold text-slate-900">Plus-value & cash net vendeur</h2>
            <p className="text-[0.75rem] text-slate-600">Synthèse claire + analyse détaillée (débloquée après).</p>
          </div>
        </div>

        {!result || !displayResult ? (
          <p className="text-[0.8rem] text-slate-600">Complétez les étapes puis cliquez sur « Calculer ma plus-value ».</p>
        ) : (
          <>
            {/* Synthèse visible */}
              <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Prix net vendeur</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(displayResult.netSalePriceForPV)}</p>
                <p className="mt-1 text-[0.7rem] text-slate-500">Prix − frais vendeur.</p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                  {displayResult.grossGain >= 0 ? "Plus-value brute" : "Moins-value brute"}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(displayResult.grossGain)}</p>
                <p className="mt-1 text-[0.7rem] text-slate-500">Net vendeur − coût d’acquisition.</p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Impôts estimés</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(displayResult.totalTax)}</p>
                <p className="mt-1 text-[0.7rem] text-slate-500">IR + PS{applySurtax === "oui" ? " + surtaxe" : ""}.</p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Cash net vendeur</p>
                <p
                  className={
                    "mt-1 text-sm font-semibold " +
                    (displayResult.netCashSeller >= 0 ? "text-emerald-700" : "text-rose-700")
                  }
                >
                  {formatEuro(displayResult.netCashSeller)}
                </p>
                <p className="mt-1 text-[0.7rem] text-slate-500">Après impôts + banque.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-700">Verdict vendeur</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{buildDecisionLabel(displayResult)}</p>
                <p className="mt-1 text-[0.75rem] text-slate-700">
                  Le bon réflexe : comparez le prix cible avec un scénario prudent et demandez le CRD exact à la banque avant signature.
                </p>
              </div>

            {/* Scénario (bonus) : seulement si débloqué */}
            {canShowFullAnalysis ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600">Scénario (prix de vente)</p>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{formatEuro(salePriceScenario)}</p>
                  <button
                    type="button"
                    onClick={() => setScenarioEnabled((v) => !v)}
                    className={
                      "rounded-full border px-3 py-1 text-[0.75rem] font-semibold " +
                      (scenarioEnabled
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                    }
                  >
                    {scenarioEnabled ? "Scénario activé" : "Activer le scénario"}
                  </button>
                </div>

                <input
                  type="range"
                  min={sliderBounds.min}
                  max={sliderBounds.max}
                  step={sliderBounds.step}
                  value={salePriceScenario}
                  onChange={(e) => {
                    setSalePriceScenario(toInt(e.target.value, sliderBounds.base));
                    setScenarioEnabled(true);
                  }}
                  className="w-full"
                />

                <div className="text-[0.7rem] text-slate-500 flex justify-between">
                  <span>{formatEuro(sliderBounds.min)}</span>
                  <span>{formatEuro(sliderBounds.max)}</span>
                </div>
              </div>
            ) : null}

            {/* Plan d’action lokt */}
            {canShowFullAnalysis && actionItems.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Plan d&apos;action lokt
                </p>
                {actionItems.map((item, i) => {
                  const cfg = ACTION_ITEM_CONFIG[item.type];
                  return (
                    <div key={i} className={`flex gap-3 rounded-xl border p-3.5 ${cfg.bg} ${cfg.border}`}>
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg} ${cfg.iconText}`}>
                        <cfg.Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-[0.8rem] font-semibold leading-tight ${cfg.titleText}`}>{item.title}</p>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${cfg.badgeCls}`}>{cfg.badge}</span>
                        </div>
                        <p className="mt-1 text-[0.75rem] leading-5 text-slate-600">{item.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !canShowFullAnalysis ? (
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 relative overflow-hidden">
                <div className="blur-sm select-none space-y-2">
                  {[1,2,3].map(n => <div key={n} className={`h-16 rounded-xl border ${n===1?"bg-red-50 border-red-200":n===2?"bg-amber-50 border-amber-200":"bg-emerald-50 border-emerald-200"}`} />)}
                </div>
                <p className="absolute inset-0 flex items-center justify-center text-[0.75rem] font-semibold text-slate-600 text-center px-6">
                  Débloquez l’analyse pour afficher le plan d’action personnalisé (bases taxables, IR/PS, CRD/IRA, scénario).
                </p>
              </div>
            ) : null}

            {/* Gate (PretRelais style) */}
            {!canShowFullAnalysis ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-900 text-white p-5 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-30 blur-3xl bg-cyan-500" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl bg-emerald-400" />

                <div className="relative space-y-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">DÉBLOQUER L’ANALYSE</p>
                  <h3 className="text-lg font-semibold">Conservez votre simulation et débloquez l’analyse détaillée.</h3>

                  <div className="mt-2 rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                    {/* Email */}
                    <div className="space-y-1">
                      <label className="text-xs text-slate-100 font-semibold">Votre e-mail (obligatoire)</label>
                      <input
                        type="email"
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        placeholder="ex: prenom.nom@gmail.com"
                        className="w-full min-w-0 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-base text-white sm:rounded-lg sm:py-2 sm:text-sm placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300"
                      />
                      <p className="text-[0.7rem] text-slate-300">
                        Utilisé pour vous envoyer le rapport et retrouver votre simulation.{" "}
                        <a href="/confidentialite" className="underline hover:text-white">En savoir plus sur vos données personnelles</a>.
                      </p>
                    </div>

                    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consentContact}
                          onChange={(e) => setConsentContact(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10"
                        />
                        <span className="text-[0.75rem] text-slate-200 leading-relaxed">
                          <span className="font-semibold">Optionnel :</span> j’accepte d’être mis en relation avec un conseiller partenaire pour aller plus loin sur mon projet.
                          <span className="block text-[0.7rem] text-slate-300 mt-1">Cette case n’est pas obligatoire pour recevoir le rapport.</span>
                        </span>
                      </label>
                    </div>

                    {/* Bouton */}
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await handleUnlock();
                        const email = safeEmail(leadEmail);

                        if (ok && email && sendByEmail && result && displayResult) {
                          const computed = buildEmailComputed({ result, displayResult });
                          await sendPlusValueEmail(email, computed);
                        }
                      }}
                      disabled={unlocking}
                      className="w-full inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:opacity-95 disabled:opacity-60"
                    >
                      {unlocking ? "Préparation..." : "Recevoir mon rapport"}
                    </button>
                    {sendingEmail ? <p className="text-[0.7rem] text-slate-300">Envoi de l’email…</p> : null}
                    {sendEmailMsg ? <p className="text-[0.7rem] text-slate-200">{sendEmailMsg}</p> : null}

                    {unlockMsg && <p className="text-[0.75rem] text-slate-200">{unlockMsg}</p>}
                  </div>
                </div>
              </div>
            ) : null}

            <p className="mt-3 text-[0.7rem] text-slate-500">
              Simulation indicative. Le détail fiscal dépend de votre situation. Validation notaire recommandée.
            </p>
          </>
        )}
      </section>}
    </div>
  );
}
