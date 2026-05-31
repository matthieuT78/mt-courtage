export const LANDLORD_ALERT_PREFERENCE_KEYS = [
  "late_payment",
  "due_soon",
  "receipt_to_finalize",
  "rent_revision_due",
  "lease_end",
  "expired_active_lease",
  "entry_inventory_missing",
  "exit_inventory_to_prepare",
  "tenant_email_missing",
  "owner_email_missing",
] as const;

export type LandlordAlertPreferenceKey = (typeof LANDLORD_ALERT_PREFERENCE_KEYS)[number];

export type LandlordAlertPreferences = Record<LandlordAlertPreferenceKey, boolean> & {
  digest_enabled: boolean;
};

export const DEFAULT_LANDLORD_ALERT_PREFERENCES: LandlordAlertPreferences = {
  digest_enabled: true,
  late_payment: true,
  due_soon: true,
  receipt_to_finalize: true,
  rent_revision_due: true,
  lease_end: true,
  expired_active_lease: true,
  entry_inventory_missing: true,
  exit_inventory_to_prepare: true,
  tenant_email_missing: true,
  owner_email_missing: true,
};

export function normalizeLandlordAlertPreferences(row?: Record<string, unknown> | null): LandlordAlertPreferences {
  return Object.fromEntries(
    Object.entries(DEFAULT_LANDLORD_ALERT_PREFERENCES).map(([key, defaultValue]) => [
      key,
      typeof row?.[key] === "boolean" ? row[key] : defaultValue,
    ])
  ) as LandlordAlertPreferences;
}
