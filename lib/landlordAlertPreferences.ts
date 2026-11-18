export const LANDLORD_ALERT_PREFERENCE_KEYS = [
  "late_payment",
  "receipt_to_finalize",
  "rent_revision_due",
  "lease_end",
  "expired_active_lease",
  "entry_inventory_missing",
  "exit_inventory_to_prepare",
  "tenant_email_missing",
  "co_tenant_email_missing",
  // owner_email_missing retiré le 2026-11-18 : depuis que rent-reminders.ts
  // et rent-followups.ts se replient sur l'email réel du compte quand
  // reminder_email est vide, cette alerte ne détectait plus un vrai manque —
  // tous les comptes réels (35/35) ont un auth.users.email renseigné, le
  // repli ne pouvait jamais échouer. Elle se déclenchait sur un champ vide
  // sans conséquence réelle, pas sur un problème fonctionnel.
  "deposit_not_collected",
  "deposit_return_overdue",
  "avenant_pending",
  "insurance_certificate_missing",
  "dpe_missing",
  "teom_overcharge_risk",
] as const;

export type LandlordAlertPreferenceKey = (typeof LANDLORD_ALERT_PREFERENCE_KEYS)[number];

export type LandlordAlertPreferences = Record<LandlordAlertPreferenceKey, boolean> & {
  digest_enabled: boolean;
};

export const FREE_LANDLORD_ALERT_KEYS: LandlordAlertPreferenceKey[] = [
  "late_payment",
  "receipt_to_finalize",
  "tenant_email_missing",
  "co_tenant_email_missing",
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
  co_tenant_email_missing: true,
  deposit_not_collected: true,
  deposit_return_overdue: true,
  avenant_pending: true,
  insurance_certificate_missing: true,
  dpe_missing: true,
  teom_overcharge_risk: true,
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
