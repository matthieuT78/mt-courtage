create table if not exists public.landlord_alert_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  digest_date date not null,
  alert_count integer not null default 0,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists landlord_alert_sends_user_day_uidx
  on public.landlord_alert_sends (user_id, digest_date);

alter table public.landlord_alert_sends enable row level security;

drop policy if exists "Users can read their own alert sends" on public.landlord_alert_sends;
create policy "Users can read their own alert sends"
  on public.landlord_alert_sends
  for select
  using (auth.uid() = user_id);
