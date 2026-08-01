-- Trace les emails de cycle de vie (relances d'activation) déjà envoyés à chaque utilisateur,
-- pour ne jamais en renvoyer un deuxième — même principe que signup_confirmation_reminder_sends
-- et rent_reminder_followup_sends.

create table if not exists public.lifecycle_email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, email_key)
);

create index if not exists lifecycle_email_sends_user_idx
  on public.lifecycle_email_sends (user_id);

alter table public.lifecycle_email_sends enable row level security;

drop policy if exists lifecycle_email_sends_select_own on public.lifecycle_email_sends;
create policy lifecycle_email_sends_select_own
  on public.lifecycle_email_sends
  for select
  using (auth.uid() = user_id);
