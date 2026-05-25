alter table public.subscriptions
  add column if not exists billing_interval text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists cancel_at_period_end boolean not null default false;

create index if not exists subscriptions_user_updated_idx
  on public.subscriptions (user_id, updated_at desc);

create index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;
