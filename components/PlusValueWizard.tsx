// components/PlusValueWizard.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import LeadGate from "./LeadGate";
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
  return s.replace(/[^\d]/g, "");
}
function onlyNumberLike(s: string) {
  const cleaned = s.replace(",", ".").replace(/[^0-9.]/g, "");
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
function formatSignedEuro(n: number) {
  const sign = n >= 0 ? "+" : "−";
  return `${sign} ${formatEuro(Math.abs(n))}`;
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

  // IR : 0% jusqu'à 5 ans, 6%/an (6e->21e), puis 4% la 22e (exonération)
  let abIR = 0;
  if (y <= 5) abIR = 0;
  else if (y >= 22) abIR = 100;
  else {
    const y6_21 = clamp(Math.min(y, 21) - 5, 0, 16);
    abIR = y6_21 * 6;
    if (y === 22) abIR += 4;
    abIR = clamp(abIR, 0, 100);
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

  if (g <= 60000) return 0.02;
  if (g <= 100000) return 0.03;
  if (g <= 110000) return 0.04;
  if (g <= 150000) return 0.05;
  return 0.06;
}

/* ------------------------ Types ------------------------ */
type ResidenceType = "principale" | "secondaire" | "invest";
type AcquisitionFraisMode = "reel" | "forfait_7_5";
type TravauxMode = "reel" | "forfait_15" | "aucun";

type PVResult = {
  salePrice: number;
  saleCosts: number;
  netSalePriceForPV: number;

  purchasePrice: number;
  acquisitionCosts: number;
  worksCosts: number;
  totalPurchaseCost: number;

  grossGain: number; // peut être négatif

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
  loanPayoff: number;
  netCashSeller: number; // peut être négatif

  breakevenSalePrice: number;
};

export type PlusValueWizardProps = {
  showSaveButton?: boolean;
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
  useEffect(() => setMaxStepReached((m) => Math.max(m, step)), [step]);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));
  const goToStep = (target: number) => {
    const t = Math.min(Math.max(target, 1), TOTAL_STEPS);
    if (t <= maxStepReached) setStep(t);
  };

  /* ======================== Common input styles ======================== */
  const inputBase =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const inputSmall =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const selectBase =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const labelBase = "text-xs text-slate-700 leading-tight min-h-[2.25rem] flex items-center gap-1";

  /* ======================== Step 1: Vente ======================== */
  const [residenceType, setResidenceType] = useState<ResidenceType>("principale");
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

  const [iraMode, setIraMode] = useState<"aucune" | "pourcent">("pourcent");
  const [iraPct, setIraPct] = useState<string>("1.0");
  const [iraFixed, setIraFixed] = useState<string>("0");

  /* ======================== Step 4: Fiscalité ======================== */
  const [applySurtax, setApplySurtax] = useState<"oui" | "non">("oui");

  /* ======================== Résultats ======================== */
  const [result, setResult] = useState<PVResult | null>(null);

  /* ======================== Gate (par calculette) ======================== */
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [leadEmail, setLeadEmail] = useState<string>("");
  const [consentLokt, setConsentLokt] = useState<boolean>(false);
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);

  // 1) Restore email depuis session OU localStorage tool-specific
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isLoggedIn) {
      setUnlocked(true);
      setConsentLokt(true);
      if (sessionEmail && !leadEmail) setLeadEmail(sessionEmail);
      return;
    }

    const fromSession = safeEmail(sessionEmail ?? "");
    const fromStorage = loadLeadEmail("plus_value");
    const next = fromSession || fromStorage;

    if (next && safeEmail(leadEmail) !== next) setLeadEmail(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail, isLoggedIn]);

  // 2) Persist email au fil de l’eau (tool-specific)
  useEffect(() => {
    const e = safeEmail(leadEmail);
    if (!e) return;
    persistLeadEmail("plus_value", e);
  }, [leadEmail]);

  // 3) Restore unlock tool-specific (et invalide si email change)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isLoggedIn) {
      setUnlocked(true);
      setConsentLokt(true);
      return;
    }

    const e = safeEmail(leadEmail);
    if (!e) {
      setUnlocked(false);
      return;
    }

    const ok = isUnlockedForEmail("plus_value", e);
    setUnlocked(ok);
    if (ok) setConsentLokt(true);
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

    const totalPurchaseCost = Math.max(0, purchasePriceNum + acquisitionCosts + worksCosts);

    const grossGain = Math.round(netSalePriceForPV - totalPurchaseCost);

    const isExempt = residenceType === "principale";

    const { abIR, abPS } = abatementsFrance(yearsHeldNum);

    const baseGainForTax = isExempt ? 0 : Math.max(0, grossGain);
    const taxableIR = isExempt ? 0 : Math.max(0, baseGainForTax * (1 - abIR / 100));
    const taxablePS = isExempt ? 0 : Math.max(0, baseGainForTax * (1 - abPS / 100));

    const taxIR = isExempt ? 0 : Math.round(taxableIR * 0.19);
    const taxPS = isExempt ? 0 : Math.round(taxablePS * 0.172);

    const surtaxRate = !isExempt && applySurtax === "oui" ? surtaxePlusValueEstimee(taxableIR) : 0;
    const surtax = !isExempt ? Math.round(taxableIR * surtaxRate) : 0;

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
    if (loanHas === "oui") {
      if (iraMode === "pourcent") ira = Math.round(crd * (toFloat(iraPct, 0) / 100));
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

    if (typeof window !== "undefined") {
      const payload = {
        residenceType,
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
        iraFixed,
        applySurtax,
      };
      window.localStorage.setItem(PLUSVALUE_STORAGE_KEY, JSON.stringify(payload));
    }

    const el = document.getElementById("resultats-plusvalue");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ======================== Restore inputs ======================== */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PLUSVALUE_STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);

      setResidenceType(saved.residenceType ?? "principale");
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

      setIraMode(saved.iraMode ?? "pourcent");
      setIraPct(saved.iraPct ? String(saved.iraPct) : "1.0");
      setIraFixed(saved.iraFixed ? String(saved.iraFixed) : "0");

      setApplySurtax(saved.applySurtax ?? "oui");

      setUnlockMsg(null);
      setMaxStepReached(1);
      setStep(1);
    } catch (e) {
      console.error("Erreur restauration simulation plus-value :", e);
    }
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
      consent: { consent_analysis: true, consent_contact: false },
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
      console.warn("[rpc upsert_lead_v1] error:", error);
      throw new Error(error.message || "Erreur RPC");
    }
  };

  const handleUnlock = async () => {
    setUnlockMsg(null);

    if (!hasResult) {
      setUnlockMsg("Calculez d’abord votre plus-value pour débloquer l’analyse.");
      return;
    }

    const email = safeEmail(leadEmail);
    if (!email || !email.includes("@")) {
      setUnlockMsg("Merci de renseigner une adresse e-mail valide.");
      return;
    }

    if (!consentLokt) {
      setUnlockMsg("Pour débloquer l’analyse, merci d’accepter l’utilisation de vos données (Lokt.fr).");
      return;
    }

    setUnlocking(true);
    try {
      await captureLeadViaRpc({ email, computed: result! });

      persistLeadEmail("plus_value", email);
      persistUnlock("plus_value", email);

      setUnlocked(true);
      setUnlockMsg("✅ Analyse débloquée. (Votre simulation est bien enregistrée.)");
    } catch (e: any) {
      setUnlockMsg("❌ Impossible d’enregistrer le dossier : " + (e?.message || "erreur inconnue"));
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

  const scenarioDelta = useMemo(() => {
    if (!result || !scenarioResult) return null;
    return {
      salePrice: salePriceScenario - result.salePrice,
      grossGain: scenarioResult.grossGain - result.grossGain,
      totalTax: scenarioResult.totalTax - result.totalTax,
      netCashSeller: scenarioResult.netCashSeller - result.netCashSeller,
    };
  }, [result, scenarioResult, salePriceScenario]);

  const showCashNegativeWarning = !!displayResult && displayResult.netCashSeller < 0;
  const showLossInfo = !!displayResult && displayResult.grossGain < 0;

  /* ======================== UI - Stepper ======================== */
  return (
    <div className="space-y-6">
      {/* Wizard */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5 sm:p-6 space-y-5">
        {/* Stepper */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 overflow-x-auto">
            <div className="flex items-center gap-2 whitespace-nowrap pr-2">
              {stepLabels.map((label, index) => {
                const num = index + 1;
                const active = step === num;
                const done = step > num;
                const clickable = num <= maxStepReached;

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => goToStep(num)}
                    disabled={!clickable}
                    className={
                      "inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 transition border " +
                      (active
                        ? "bg-slate-900 text-white border-slate-900"
                        : done
                        ? "bg-emerald-50 text-slate-900 border-emerald-200 hover:bg-emerald-100"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50") +
                      (clickable ? "" : " opacity-60 cursor-not-allowed")
                    }
                    aria-label={`Aller à l’étape ${num} : ${label}`}
                    title={label}
                  >
                    <span
                      className={
                        "flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-semibold " +
                        (active
                          ? "bg-white text-slate-900"
                          : done
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 text-slate-700")
                      }
                    >
                      {num}
                    </span>
                    <span className={"text-[0.72rem] " + (active ? "font-semibold" : "")}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[0.7rem] text-slate-500 shrink-0">
            Étape {step} / {TOTAL_STEPS}
          </p>
        </div>

        {/* Contenu */}
        <div className="border border-slate-100 rounded-xl bg-slate-50/70 p-4 space-y-3">
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
                    <InfoBadge text="Comment ça marche : si vous sélectionnez “résidence principale”, le simulateur considère la plus-value exonérée (0 €). En vrai, il existe des conditions (occupation effective, délais, dépendances…). Si vous n’êtes pas sûr, choisissez “secondaire” pour une estimation prudente." />
                  </label>
                  <select
                    value={residenceType}
                    onChange={(e) => setResidenceType(e.target.value as ResidenceType)}
                    className={selectBase}
                  >
                    <option value="principale">Résidence principale</option>
                    <option value="secondaire">Résidence secondaire</option>
                    <option value="invest">Investissement locatif</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Durée de détention (années)
                    <InfoBadge text="Comment ça marche : cette durée sert à appliquer les abattements (réduction progressive de l’impôt). Barème standard : IR exonéré à 22 ans, prélèvements sociaux exonérés à 30 ans. Plus vous détenez longtemps, moins vous payez." />
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
                    <InfoBadge text="Comment ça marche : c’est le prix indiqué sur le compromis. Les frais acheteur (notaire) ne sont pas inclus. Ensuite, on retire vos frais vendeur pour obtenir le “prix net vendeur”." />
                  </label>
                  <input
                    inputMode="numeric"
                    value={salePrice}
                    onChange={(e) => setSalePrice(onlyDigits(e.target.value
))} className={inputBase} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Frais d’agence à votre charge
                    <InfoBadge text="Comment ça marche : si le mandat prévoit que l’agence est payée par le vendeur, mettez le montant ici. Sinon laissez 0. Ces frais diminuent le prix net vendeur et donc la plus-value brute." />
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
                    <InfoBadge text="Comment ça marche : diagnostics, mainlevée, frais divers. Si vous ne savez pas, laissez 0 : l’impact est direct sur le prix net vendeur." />
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
                    <InfoBadge text="Comment ça marche : c’est le prix du bien dans l’acte d’achat (hors frais). On ajoute ensuite frais + travaux pour reconstituer votre coût total d’acquisition." />
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
                    <InfoBadge text="Comment ça marche : forfait 7,5% = estimation simple (souvent proche pour l’ancien). Si vous avez les montants exacts (décompte notaire, factures), choisissez “réels” pour plus de précision." />
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
                        <InfoBadge text="Où le trouver : décompte notaire / acte d’achat. Ces frais augmentent le coût d’acquisition, donc réduisent la plus-value." />
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
                        <InfoBadge text="Comment ça marche : indiquez les frais d’agence payés à l’achat (si séparés). Ils s’ajoutent au coût d’acquisition." />
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
                    <InfoBadge text="Comment ça marche : les travaux augmentent le coût d’acquisition et peuvent réduire la plus-value taxable. En pratique, seuls certains travaux sont éligibles (factures, nature des travaux). Le forfait 15% est un repère simplifié." />
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
                      <InfoBadge text="Astuce : si vous n’avez pas le détail, mettez 0 puis comparez ensuite avec le forfait 15% pour voir l’ordre de grandeur." />
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
                  "Optionnel : estimation d’IRA (% du CRD).",
                ]}
                tone="warn"
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
                <div className="space-y-1">
                  <label className={labelBase}>
                    Avez-vous un crédit en cours ?
                    <InfoBadge text="Comment ça marche : si vous avez un crédit, on soustrait CRD + IRA de votre prix net vendeur pour obtenir le cash net. Sinon, on met 0." />
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
                        <InfoBadge text="Comment ça marche : soit vous saisissez le CRD exact (attestation banque), soit on l’estime. Le CRD est la variable #1 du cash net vendeur." />
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
                          <InfoBadge text="Où le trouver : attestation de remboursement anticipé / tableau d’amortissement à date." />
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
                            <InfoBadge text="Comment ça marche : on reconstruit un amortissement standard. Si votre prêt est atypique (différé/modulation/variable), l’estimation peut être moins précise." />
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
                            <InfoBadge text="Comment ça marche : taux nominal annuel. L’assurance n’est pas intégrée dans le CRD." />
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
                            <InfoBadge text="Comment ça marche : durée initiale du prêt (convertie en mois pour le calcul)." />
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
                            <InfoBadge text="Comment ça marche : approx OK. Plus c’est précis, plus le CRD estimé est proche." />
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
                        IRA (remb. anticipé)
                        <InfoBadge text="Comment ça marche : certaines banques facturent des indemnités. Ici, on applique un % du CRD (repère)." />
                      </label>
                      <select
                        value={iraMode}
                        onChange={(e) => setIraMode(e.target.value as "aucune" | "pourcent")}
                        className={selectBase}
                      >
                        <option value="pourcent">Estimer en % du CRD</option>
                        <option value="aucune">Aucune / je ne sais pas</option>
                      </select>
                    </div>

                    {iraMode === "pourcent" ? (
                      <div className="space-y-1">
                        <label className={labelBase}>
                          IRA (% du CRD)
                          <InfoBadge text="Exemple : CRD 120 000 € et 1% ⇒ 1 200 €. Mets 0 pour ignorer." />
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
                  "Option : surtaxe (modèle simplifié).",
                ]}
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
                <div className="space-y-1">
                  <label className={labelBase}>
                    Appliquer la surtaxe ?
                    <InfoBadge text="Comment ça marche : si la plus-value taxable IR dépasse certains seuils, une surtaxe peut s’appliquer. Ici c’est un modèle simplifié, utile comme repère." />
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
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 1}
            className="text-[0.75rem] text-slate-600 disabled:opacity-40 disabled:cursor-default hover:text-slate-900"
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
              className="rounded-full bg-slate-900 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-slate-800"
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
              className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-[0.8rem] font-semibold text-white shadow-lg hover:shadow-2xl active:scale-[0.99]"
            >
              Calculer ma plus-value
            </button>
          )}
        </div>
      </section>

      {/* ======================== Résultats ======================== */}
      <section
        id="resultats-plusvalue"
        className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4"
      >
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600 mb-1">Résultats de votre simulation</p>
          <h2 className="text-sm font-semibold text-slate-900">Plus-value & cash net vendeur</h2>
          <p className="text-[0.75rem] text-slate-600">
            Chiffres indicatifs. Le détail fiscal dépend de votre situation (notaire).
          </p>
        </div>

        {!result || !displayResult ? (
          <p className="text-[0.8rem] text-slate-600">Complétez les étapes puis cliquez sur « Calculer ma plus-value ».</p>
        ) : (
          <>
            {(displayResult.netCashSeller < 0 || displayResult.grossGain < 0) && (
              <div
                className={
                  "rounded-xl border px-4 py-3 " +
                  (displayResult.netCashSeller < 0
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-amber-200 bg-amber-50 text-amber-900")
                }
              >
                {displayResult.netCashSeller < 0 ? (
                  <>
                    <p className="text-[0.8rem] font-semibold">⚠️ Cash net vendeur négatif</p>
                    <p className="mt-1 text-[0.75rem]">
                      Avec ces hypothèses, la vente ne couvre pas (impôts + remboursement banque). Vérifiez en priorité :{" "}
                      <span className="font-semibold">CRD exact</span>, IRA et frais.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[0.8rem] font-semibold">Info : moins-value</p>
                    <p className="mt-1 text-[0.75rem]">
                      Vous êtes en moins-value. Dans ce modèle, l’impôt sur la plus-value est donc à 0 €.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Scénario */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Scénario : prix de vente</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatEuro(salePriceScenario)}{" "}
                    <span className="text-xs font-normal text-slate-500">(base : {formatEuro(result.salePrice)})</span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[0.7rem] text-slate-500">Mode</p>
                  <button
                    type="button"
                    onClick={() => setScenarioEnabled((v) => !v)}
                    className={
                      "mt-1 inline-flex items-center rounded-full border px-3 py-1 text-[0.75rem] font-semibold " +
                      (scenarioEnabled
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                    }
                    aria-label="Activer/désactiver le scénario"
                    title="Quand activé, toute l’analyse ci-dessous utilise le prix de vente du scénario."
                  >
                    {scenarioEnabled ? "Scénario activé" : "Scénario désactivé"}
                  </button>
                </div>
              </div>

              <div>
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
                  aria-label="Ajuster le prix de vente scénario"
                />
                <div className="mt-1 flex items-center justify-between text-[0.7rem] text-slate-500">
                  <span>{formatEuro(sliderBounds.min)}</span>
                  <span>{formatEuro(sliderBounds.max)}</span>
                </div>
              </div>

              {scenarioDelta ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Δ Plus-value brute</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatSignedEuro(scenarioDelta.grossGain)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Δ Impôts estimés</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatSignedEuro(scenarioDelta.totalTax)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-900 px-3 py-2.5 text-white">
                    <p className="text-[0.65rem] uppercase tracking-[0.14em] text-emerald-200">Δ Cash net vendeur</p>
                    <p className="mt-1 text-sm font-semibold text-white">{formatSignedEuro(scenarioDelta.netCashSeller)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[0.7rem] text-slate-500">
                  Déplace le curseur pour voir l’impact (le scénario s’applique à toute l’analyse).
                </p>
              )}
            </div>

            {/* Résumé principal */}
            <div className="grid gap-3 sm:grid-cols-4 items-stretch">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">
                  {displayResult.grossGain >= 0 ? "Plus-value brute" : "Moins-value brute"}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(displayResult.grossGain)}</p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">
                  (Prix net vendeur) − (coût acquisition + travaux).
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Impôts estimés</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(displayResult.totalTax)}</p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">
                  IR {formatEuro(displayResult.taxIR)} · PS {formatEuro(displayResult.taxPS)} · surtaxe{" "}
                  {formatEuro(displayResult.surtax)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-slate-500 uppercase tracking-[0.14em]">Remboursement prêt</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatEuro(displayResult.loanPayoff)}</p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-500">
                  CRD {formatEuro(displayResult.crd)} · IRA {formatEuro(displayResult.ira)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-900 text-white px-3 py-2.5 h-full flex flex-col">
                <p className="text-[0.65rem] text-emerald-200 uppercase tracking-[0.14em]">Cash net vendeur</p>
                <p className="mt-1 text-2xl font-semibold text-white">{formatEuro(displayResult.netCashSeller)}</p>
                <p className="mt-auto pt-1 text-[0.7rem] text-slate-200">Après frais vente, impôts et prêt.</p>
              </div>
            </div>

            {/* Hypothèses / limites */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600">Hypothèses & limites</p>
                  <p className="mt-1 text-[0.8rem] font-semibold text-slate-900">
                    Simulation indicative, validation notaire recommandée.
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-slate-700">
                  Estimation
                </span>
              </div>

              <ul className="text-[0.75rem] text-slate-700 list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Résidence principale</span> : “présumé exonéré” ici — conditions réelles non vérifiées.
                </li>
                <li>
                  <span className="font-semibold">Travaux</span> : éligibilité / forfait 15% dépendent de conditions et justificatifs.
                </li>
                <li>
                  <span className="font-semibold">CRD estimé</span> : prêt atypique (différé/modulation/variable) = estimation moins fiable.
                </li>
                <li>
                  <span className="font-semibold">Surtaxe</span> : modèle simplifié, indicatif.
                </li>
              </ul>

              <details className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                <summary className="cursor-pointer text-[0.75rem] font-semibold text-slate-800">
                  Voir le détail des abattements utilisés
                </summary>
                <div className="mt-2 text-[0.75rem] text-slate-700 space-y-1">
                  <p>
                    <span className="font-semibold">IR</span> : 0% jusqu’à 5 ans, puis 6%/an (6e→21e), puis 4% la 22e (exonération).
                  </p>
                  <p>
                    <span className="font-semibold">PS</span> : 0% jusqu’à 5 ans, puis 1,65%/an (6e→21e), puis 1,6% la 22e, puis 9%/an (23e→30e).
                  </p>
                </div>
              </details>
            </div>

            {/* 🔒 Gate */}
            {!canShowFullAnalysis ? (
              <LeadGate
                theme="cyan-emerald"
                title="Sauvegarder & recevoir le récap Lokt.fr™"
                subtitle="Recevez un récap clair + checklist notaire, et sauvegardez votre simulation. Pas de démarchage."
                email={leadEmail}
                setEmail={setLeadEmail}
                consent={consentLokt}
                setConsent={setConsentLokt}
                unlocking={unlocking}
                unlockMsg={unlockMsg}
                onUnlock={handleUnlock}
              />
            ) : null}

            {/* ✅ Partie débloquée */}
            {canShowFullAnalysis ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3 space-y-3">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600">Plan d&apos;action Lokt.fr™</p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[0.75rem] text-slate-700">
                      <span className="font-semibold">1) CRD exact</span> (attestation banque).
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">C’est la variable #1 du cash net vendeur.</p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[0.75rem] text-slate-700">
                      <span className="font-semibold">2) Travaux</span> (factures + liste).
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">Peut réduire la base taxable si non exonéré.</p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[0.75rem] text-slate-700">
                      <span className="font-semibold">3) Notaire</span> (exonérations / cas particuliers).
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">Le simulateur est un repère, pas un calcul notarial.</p>
                  </div>
                </div>
              </div>
            ) : null}

            <p className="mt-2 text-[0.65rem] text-slate-500">
              Résultats indicatifs. Ne constitue pas un avis fiscal / une offre. Validation notaire recommandée.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
