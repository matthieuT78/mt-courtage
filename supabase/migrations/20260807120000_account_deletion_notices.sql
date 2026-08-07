-- RGPD : suppression automatique des comptes jamais confirmés (limitation de la
-- conservation). Pipeline : relance hebdo (signup_confirmation_reminder_sends,
-- 24h à 30j) -> avertissement final à 30j (cette table, delai de grace 7j) ->
-- suppression définitive si toujours non confirmé.

create table if not exists public.account_deletion_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  notified_at timestamptz not null default now(),
  scheduled_deletion_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists account_deletion_notices_user_id_key
  on public.account_deletion_notices(user_id);

notify pgrst, 'reload schema';
