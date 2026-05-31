create table if not exists public.rent_reminder_followup_sends (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null,
  user_id uuid not null,
  followup_day integer not null check (followup_day > 0),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (token_id, followup_day)
);

create index if not exists rent_reminder_followup_sends_user_idx
  on public.rent_reminder_followup_sends (user_id, sent_at desc);

alter table public.rent_reminder_followup_sends enable row level security;

drop policy if exists rent_reminder_followup_sends_select_own on public.rent_reminder_followup_sends;
create policy rent_reminder_followup_sends_select_own
  on public.rent_reminder_followup_sends
  for select
  using (auth.uid() = user_id);
