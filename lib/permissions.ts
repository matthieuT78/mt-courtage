// lib/permissions.ts
export type Plan =
  | "calc_blur" // visiteur (ou connecté sans inscription ? -> on le garde pour non connecté)
  | "calc_full" // inscrit gratuit (détail visible)
  | "landlord_5"
  | "landlord_15"
  | "landlord_unlimited";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive";

export const DEFAULT_LOGGED_IN_PLAN: Plan = "calc_full";
export const DEFAULT_LOGGED_OUT_PLAN: Plan = "calc_blur";

export function isSubscriptionActive(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "active" || s === "trialing";
}

export function planAllowsCalculator(plan: Plan) {
  // Tous les plans ont accès aux calculettes, mais le détail peut être flouté.
  return true;
}

export function planShowsCalcDetails(plan: Plan) {
  // Visiteur -> détail flouté
  return plan !== "calc_blur";
}

export function planAllowsLandlord(plan: Plan) {
  return plan === "landlord_5" || plan === "landlord_15" || plan === "landlord_unlimited";
}

export function landlordMaxActiveLeases(plan: Plan): number {
  switch (plan) {
    case "landlord_5":
      return 5;
    case "landlord_15":
      return 15;
    case "landlord_unlimited":
      return 999999;
    default:
      return 0;
  }
}
