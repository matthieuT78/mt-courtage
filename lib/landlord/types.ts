// lib/landlord/types.ts
export type SimpleUser = { id: string; email?: string };

export type LandlordSettings = {
  user_id: string;
  display_name: string | null;
  address: string | null;
  default_city: string | null;
  default_payment_method: string | null;
  default_issue_place: string | null;
  auto_send_enabled: boolean | null;
  auto_send_frequency: string | null;
  auto_send_day: number | null;
  auto_send_hour: number | null;
  iban: string | null;
  bic: string | null;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: string;
  user_id: string;
  label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  status?: string | null;
  created_at: string;
  updated_at: string;
  delegated_services?: string[];
  delegation_agency_name?: string | null;
};

export type PropertyFinance = {
  property_id: string;
  user_id: string;
  purchase_price: number | null;
  notary_fees?: number | null;
  agency_fees?: number | null;
  works?: number | null;
  down_payment?: number | null;
  loan_monthly?: number | null;
  loan_insurance_monthly?: number | null;
  loan_rate_percent?: number | null;
  loan_remaining_months?: number | null;
  loan_end_year?: number | null;
  tax_regime?: string | null;
  fixed_charges_monthly?: number | null;
  fixed_charges_frequency?: "monthly" | "quarterly" | "yearly" | null;
  property_tax_yearly?: number | null;
  pno_insurance_monthly?: number | null;
  copro_charges_monthly?: number | null;
  cfe_yearly?: number | null;
  loan_interest_monthly?: number | null;
  bank_fees_monthly?: number | null;
  maintenance_monthly?: number | null;
  rental_tax_monthly?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type Tenant = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status?: string | null;
  archived_at?: string | null;
  archived_reason?: string | null;
  created_at: string;
  updated_at: string;
};

export type Lease = {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  rent_amount: number | null;
  charges_amount: number | null;
  deposit_amount: number | null;
  deposit_paid_at?: string | null;
  deposit_paid_amount?: number | null;
  deposit_returned_at?: string | null;
  deposit_returned_amount?: number | null;
  deposit_retained_amount?: number | null;
  deposit_retained_reason?: string | null;
  deposit_collection_tx_id?: string | null;
  deposit_return_tx_id?: string | null;
  deposit_retain_tx_id?: string | null;
  payment_day: number | null;
  payment_type?: string | null;
  payment_method: string | null;
  lease_kind?: string | null;
  auto_renewal_enabled?: boolean | null;
  status: string | null;
  auto_reminder_enabled: boolean | null;
  auto_quittance_enabled: boolean | null;
  receipts_disabled?: boolean | null;
  reminder_day_of_month: number | null;
  reminder_email: string | null;
  tenant_receipt_email: string | null;
  timezone: string | null;
  tracking_from_date?: string | null;
  irl_sent_at?: string | null;
  irl_applied_at?: string | null;
  irl_apply_on?: string | null;
  created_at: string;
  updated_at: string;
};

export type RentPayment = {
  id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
  rent_amount?: number | null;
  charges_amount?: number | null;
  total_amount: number | null;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type RentReceipt = {
  id: string;
  lease_id: string;
  payment_id: string | null;
  period_start: string;
  period_end: string;
  total_amount: number | null;
  issue_date: string | null;
  issue_place: string | null;
  issued_at: string | null;
  content_text: string | null;
  pdf_url: string | null;
  sent_to_tenant_email: string | null;
  sent_at: string | null;
  receipt_number: string | null;
  created_at: string;
};
