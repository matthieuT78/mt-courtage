create table if not exists public.signup_confirmation_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists signup_confirmation_reminder_sends_user_idx
  on public.signup_confirmation_reminder_sends (user_id);

alter table public.signup_confirmation_reminder_sends enable row level security;

drop policy if exists signup_confirmation_reminder_sends_select_own on public.signup_confirmation_reminder_sends;
create policy signup_confirmation_reminder_sends_select_own
  on public.signup_confirmation_reminder_sends
  for select
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
