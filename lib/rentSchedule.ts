import { getLeaseRentPeriod } from "./rentPeriod";

type LeaseSchedule = {
  start_date?: string | null;
  end_date?: string | null;
  rent_amount?: number | null;
  charges_amount?: number | null;
  payment_day?: number | null;
  payment_type?: string | null;
};

function clampDayInMonth(year: number, monthIndex: number, value: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(Math.round(value) || 1, 1), lastDay);
}

function localDate(value?: string | null) {
  const normalized = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getLeasePaymentDueDate(lease: LeaseSchedule, yyyymm: string) {
  const rentPeriod = getLeaseRentPeriod(lease, yyyymm);
  if (!rentPeriod) return null;

  const [year, month] = yyyymm.split("-").map(Number);
  if (!year || !month) return null;

  const paymentType = String(lease.payment_type || "terme_a_echoir").toLowerCase();
  const dueMonth = paymentType === "terme_echu" ? new Date(year, month, 1) : new Date(year, month - 1, 1);
  const dueDate = new Date(
    dueMonth.getFullYear(),
    dueMonth.getMonth(),
    clampDayInMonth(dueMonth.getFullYear(), dueMonth.getMonth(), Number(lease.payment_day || 1))
  );

  const periodStart = localDate(rentPeriod.periodStart);
  if (paymentType !== "terme_echu" && periodStart && periodStart > dueDate) return periodStart;
  return dueDate;
}

