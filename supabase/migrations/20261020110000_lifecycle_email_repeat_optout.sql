-- Passe les emails de cycle de vie (relances d'activation) d'un envoi unique
-- à des relances plafonnées (jusqu'à 4 tentatives par étape bloquée, espacées
-- de 7 jours) : on a donc besoin de pouvoir enregistrer plusieurs lignes pour
-- le même (user_id, email_key), et d'une table de désinscription puisque ces
-- emails peuvent désormais revenir plusieurs fois.

alter table public.lifecycle_email_sends
  drop constraint if exists lifecycle_email_sends_user_id_email_key_key;

create index if not exists lifecycle_email_sends_user_key_idx
  on public.lifecycle_email_sends (user_id, email_key, sent_at desc);

create table if not exists public.lifecycle_email_optouts (
  user_id uuid primary key,
  opted_out_at timestamptz not null default now()
);

alter table public.lifecycle_email_optouts enable row level security;

drop policy if exists lifecycle_email_optouts_select_own on public.lifecycle_email_optouts;
create policy lifecycle_email_optouts_select_own
  on public.lifecycle_email_optouts
  for select
  using (auth.uid() = user_id);
