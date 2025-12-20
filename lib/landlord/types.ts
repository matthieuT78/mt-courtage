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
  created_at: string;
  updated_at: string;
};

export type Tenant = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
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
  payment_day: number | null;
  payment_method: string | null;
  status: string | null;
  auto_reminder_enabled: boolean | null;
  auto_quittance_enabled: boolean | null;
  reminder_day_of_month: number | null;
  reminder_email: string | null;
  tenant_receipt_email: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
};

export type RentPayment = {
  id: string;
  lease_id: string;
  period_start: string;
  period_end: string;
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
  created_at: string;
};
