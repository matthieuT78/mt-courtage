create table if not exists public.landlord_alert_notification_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  alert_key text not null,
  preference_key text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists landlord_alert_notification_sends_user_key_uidx
  on public.landlord_alert_notification_sends (user_id, alert_key);

create index if not exists landlord_alert_notification_sends_user_sent_idx
  on public.landlord_alert_notification_sends (user_id, sent_at desc);

alter table public.landlord_alert_notification_sends enable row level security;

drop policy if exists landlord_alert_notification_sends_select_own on public.landlord_alert_notification_sends;
create policy landlord_alert_notification_sends_select_own
  on public.landlord_alert_notification_sends
  for select
  using (auth.uid() = user_id);
