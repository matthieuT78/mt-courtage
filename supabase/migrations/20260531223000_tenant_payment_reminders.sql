create table if not exists public.tenant_payment_reminder_settings (
  lease_id uuid primary key references public.leases(id) on delete cascade,
  user_id uuid not null,
  auto_enabled boolean not null default false,
  auto_delay_days integer not null default 3 check (auto_delay_days between 1 and 30),
  default_channel text not null default 'both' check (default_channel in ('email', 'messaging', 'both')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_payment_reminder_settings_user_idx
  on public.tenant_payment_reminder_settings (user_id);

create table if not exists public.tenant_payment_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lease_id uuid not null references public.leases(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  reason text not null check (reason in ('unpaid', 'partial')),
  trigger_type text not null check (trigger_type in ('manual', 'automatic')),
  channels text[] not null,
  subject text not null,
  body text not null,
  missing_amount numeric(12, 2) not null default 0,
  status text not null check (status in ('sent', 'partial', 'failed')),
  error_message text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists tenant_payment_reminder_sends_user_sent_idx
  on public.tenant_payment_reminder_sends (user_id, sent_at desc);

create unique index if not exists tenant_payment_reminder_sends_auto_period_uidx
  on public.tenant_payment_reminder_sends (lease_id, period_start, period_end)
  where trigger_type = 'automatic' and status in ('sent', 'partial');

alter table public.tenant_payment_reminder_settings enable row level security;
alter table public.tenant_payment_reminder_sends enable row level security;

update public.tenant_payment_reminder_sends
set reason = 'partial'
where reason = 'charges_missing';

alter table public.tenant_payment_reminder_sends
  drop constraint if exists tenant_payment_reminder_sends_reason_check;

alter table public.tenant_payment_reminder_sends
  add constraint tenant_payment_reminder_sends_reason_check
  check (reason in ('unpaid', 'partial'));

drop policy if exists tenant_payment_reminder_settings_select_own on public.tenant_payment_reminder_settings;
create policy tenant_payment_reminder_settings_select_own
  on public.tenant_payment_reminder_settings for select
  using (auth.uid() = user_id);

drop policy if exists tenant_payment_reminder_settings_manage_own on public.tenant_payment_reminder_settings;
create policy tenant_payment_reminder_settings_manage_own
  on public.tenant_payment_reminder_settings for all
  using (
    auth.uid() = user_id
    and exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.leases l where l.id = lease_id and l.user_id = auth.uid())
  );

drop policy if exists tenant_payment_reminder_sends_select_own on public.tenant_payment_reminder_sends;
create policy tenant_payment_reminder_sends_select_own
  on public.tenant_payment_reminder_sends for select
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
