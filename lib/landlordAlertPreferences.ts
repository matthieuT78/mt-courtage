export const LANDLORD_ALERT_PREFERENCE_KEYS = [
  "late_payment",
  "receipt_to_finalize",
  "rent_revision_due",
  "lease_end",
  "expired_active_lease",
  "entry_inventory_missing",
  "exit_inventory_to_prepare",
  "tenant_email_missing",
  "owner_email_missing",
  "deposit_not_collected",
  "deposit_return_overdue",
] as const;

export type LandlordAlertPreferenceKey = (typeof LANDLORD_ALERT_PREFERENCE_KEYS)[number];

export type LandlordAlertPreferences = Record<LandlordAlertPreferenceKey, boolean> & {
  digest_enabled: boolean;
};

export const FREE_LANDLORD_ALERT_KEYS: LandlordAlertPreferenceKey[] = [
  "late_payment",
  "receipt_to_finalize",
  "tenant_email_missing",
  "owner_email_missing",
];

export function planAllowsAllLandlordAlerts(plan: Plan) {
  return plan === "landlord_5" || plan === "landlord_15" || plan === "landlord_unlimited";
}

export function planAllowsLandlordAlert(plan: Plan, key: LandlordAlertPreferenceKey) {
  return planAllowsAllLandlordAlerts(plan) || FREE_LANDLORD_ALERT_KEYS.includes(key);
}

export const DEFAULT_LANDLORD_ALERT_PREFERENCES: LandlordAlertPreferences = {
  digest_enabled: true,
  late_payment: true,
  receipt_to_finalize: true,
  rent_revision_due: true,
  lease_end: true,
  expired_active_lease: true,
  entry_inventory_missing: true,
  exit_inventory_to_prepare: true,
  tenant_email_missing: true,
  owner_email_missing: true,
  deposit_not_collected: true,
  deposit_return_overdue: true,
};

export function normalizeLandlordAlertPreferences(row?: Record<string, unknown> | null): LandlordAlertPreferences {
  return Object.fromEntries(
    Object.entries(DEFAULT_LANDLORD_ALERT_PREFERENCES).map(([key, defaultValue]) => [
      key,
      typeof row?.[key] === "boolean" ? row[key] : defaultValue,
    ])
  ) as LandlordAlertPreferences;
}
import type { Plan } from "./permissions";
