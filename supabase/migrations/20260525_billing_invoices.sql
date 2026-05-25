create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  stripe_invoice_id text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  invoice_number text,
  amount_due integer,
  amount_paid integer,
  currency text,
  status text,
  hosted_invoice_url text,
  invoice_pdf_url text,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  finalized_at timestamptz,
  stripe_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_invoices_user_created_idx
  on public.billing_invoices (user_id, stripe_created_at desc nulls last, created_at desc);

create index if not exists billing_invoices_subscription_idx
  on public.billing_invoices (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.billing_invoices enable row level security;

drop policy if exists billing_invoices_select_own on public.billing_invoices;

create policy billing_invoices_select_own
  on public.billing_invoices
  for select
  using (auth.uid() = user_id);
