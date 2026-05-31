type LeaseRentPeriod = {
  start_date?: string | null;
  end_date?: string | null;
  rent_amount?: number | null;
  charges_amount?: number | null;
};

const pad2 = (value: number) => String(value).padStart(2, "0");
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function dateOnly(value?: string | null) {
  const normalized = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function monthBounds(yyyymm: string) {
  const match = String(yyyymm || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    daysInMonth,
    monthStart: `${year}-${pad2(month)}-01`,
    monthEnd: `${year}-${pad2(month)}-${pad2(daysInMonth)}`,
  };
}

export function getLeaseRentPeriod(lease: LeaseRentPeriod, yyyymm: string) {
  const bounds = monthBounds(yyyymm);
  if (!bounds) return null;

  const leaseStart = dateOnly(lease.start_date);
  const leaseEnd = dateOnly(lease.end_date);
  const periodStart = leaseStart && leaseStart > bounds.monthStart ? leaseStart : bounds.monthStart;
  const periodEnd = leaseEnd && leaseEnd < bounds.monthEnd ? leaseEnd : bounds.monthEnd;
  if (periodStart > periodEnd) return null;

  const billedDays = Number(periodEnd.slice(8, 10)) - Number(periodStart.slice(8, 10)) + 1;
  const ratio = billedDays / bounds.daysInMonth;
  const rent = roundMoney(Number(lease.rent_amount || 0) * ratio);
  const charges = roundMoney(Number(lease.charges_amount || 0) * ratio);

  return {
    periodStart,
    periodEnd,
    billedDays,
    daysInMonth: bounds.daysInMonth,
    ratio,
    rent,
    charges,
    total: roundMoney(rent + charges),
    prorated: billedDays !== bounds.daysInMonth,
  };
}

export function getLeaseRentPeriodFromDate(lease: LeaseRentPeriod, periodDate: string) {
  return getLeaseRentPeriod(lease, String(periodDate || "").slice(0, 7));
}
