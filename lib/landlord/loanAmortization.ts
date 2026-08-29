// lib/landlord/loanAmortization.ts
//
// Calcule un vrai tableau d'amortissement mois par mois à partir du montant
// emprunté, du taux, de la durée et d'un différé optionnel — au lieu de
// laisser l'utilisateur saisir à la main une mensualité, une date de fin et
// un montant d'intérêts mensuels fixe. La part d'intérêts dans une mensualité
// diminue mécaniquement chaque mois, même à taux fixe : un chiffre statique
// pour les intérêts (utilisé pour la déduction LMNP réel) est donc faux dès
// la 2e année du prêt. Ce module est la seule source de vérité pour ce calcul.

export type LoanDeferralType = "partial" | "total" | null | undefined;

export type LoanAmortizationInput = {
  amount: number;
  ratePercent: number;
  startDate: string; // YYYY-MM-DD
  durationMonths: number; // durée totale du prêt, différé inclus
  deferralType?: LoanDeferralType;
  deferralMonths?: number | null;
};

export type LoanMonthEntry = {
  yyyymm: string; // "2026-09"
  interest: number;
  principal: number;
  payment: number;
  balanceAfter: number;
};

export type LoanAmortizationSchedule = {
  monthlyPayment: number; // mensualité en phase d'amortissement (après le différé, s'il y en a un)
  endYear: number;
  endMonth: number;
  months: LoanMonthEntry[];
  interestForMonth: (yyyymm: string) => number;
  interestForYear: (year: number) => number;
  // Capital restant dû à une date donnée (ex: "2026-08" pour aujourd'hui). Contrairement à une
  // ré-estimation par annuité sur la durée restante, cette valeur est exacte y compris pendant
  // ou juste après un différé (la mensualité post-différé ne s'applique pas uniformément sur
  // toute la durée restante, une annuité naïve serait donc fausse dans ce cas précis).
  balanceAt: (yyyymm: string) => number;
};

function addMonths(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

const MAX_MONTHS = 480; // 40 ans — garde-fou contre une saisie aberrante

export function computeLoanAmortization(input: LoanAmortizationInput): LoanAmortizationSchedule | null {
  const amount = Number(input.amount || 0);
  const ratePercent = Number(input.ratePercent || 0);
  const durationMonths = Math.min(MAX_MONTHS, Math.max(0, Math.round(Number(input.durationMonths || 0))));
  const deferralMonths = Math.max(0, Math.round(Number(input.deferralMonths || 0)));
  const deferralType: LoanDeferralType = deferralMonths > 0 ? input.deferralType || "partial" : null;
  const startMonth = String(input.startDate || "").slice(0, 7);

  if (amount <= 0 || durationMonths <= 0 || !/^\d{4}-\d{2}$/.test(startMonth)) return null;

  const monthlyRate = ratePercent / 100 / 12;
  const amortizingMonths = Math.max(1, durationMonths - Math.min(deferralMonths, durationMonths - 1));

  const months: LoanMonthEntry[] = [];
  let balance = amount;

  // Phase de différé : total = aucune mensualité versée, les intérêts courus sont
  // capitalisés (ajoutés au capital) ; partiel = seuls les intérêts sont versés
  // chaque mois, le capital ne bouge pas. C'est le fonctionnement standard des
  // prêts locatifs avec différé en France.
  for (let i = 0; i < durationMonths - amortizingMonths; i++) {
    const interest = balance * monthlyRate;
    if (deferralType === "total") {
      balance += interest;
      months.push({ yyyymm: addMonths(startMonth, i), interest, principal: 0, payment: 0, balanceAfter: balance });
    } else {
      months.push({ yyyymm: addMonths(startMonth, i), interest, principal: 0, payment: interest, balanceAfter: balance });
    }
  }

  // Mensualité constante sur la phase d'amortissement, calculée sur le capital
  // restant à la sortie du différé (donc plus élevée qu'un calcul naïf si le
  // différé était total, puisque les intérêts capitalisés s'y ajoutent).
  const monthlyPayment =
    monthlyRate > 0 ? (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -amortizingMonths)) : balance / amortizingMonths;

  const deferredCount = months.length;
  for (let i = 0; i < amortizingMonths; i++) {
    const interest = balance * monthlyRate;
    const isLastMonth = i === amortizingMonths - 1;
    const principal = isLastMonth ? balance : monthlyPayment - interest;
    balance = Math.max(0, balance - principal);
    months.push({
      yyyymm: addMonths(startMonth, deferredCount + i),
      interest,
      principal,
      payment: principal + interest,
      balanceAfter: balance,
    });
  }

  const lastEntry = months[months.length - 1];
  const [endYear, endMonth] = lastEntry.yyyymm.split("-").map(Number);
  const byMonth = new Map(months.map((entry) => [entry.yyyymm, entry]));

  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    endYear,
    endMonth,
    months,
    interestForMonth: (yyyymm: string) => byMonth.get(yyyymm)?.interest ?? 0,
    interestForYear: (year: number) => {
      const prefix = `${year}-`;
      let sum = 0;
      for (const entry of months) {
        if (entry.yyyymm.startsWith(prefix)) sum += entry.interest;
      }
      return Math.round(sum * 100) / 100;
    },
    balanceAt: (yyyymm: string) => {
      if (yyyymm < startMonth) return Math.round(amount * 100) / 100;
      let last: LoanMonthEntry | null = null;
      for (const entry of months) {
        if (entry.yyyymm > yyyymm) break;
        last = entry;
      }
      return last ? Math.round(last.balanceAfter * 100) / 100 : 0;
    },
  };
}
