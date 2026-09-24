-- subscriptions.user_id est la clé primaire de la table (une ligne par
-- utilisateur) et référence auth.users en ON DELETE CASCADE : supprimer un
-- compte (pages/api/account/delete.ts) efface donc silencieusement sa ligne
-- d'abonnement, alors que ce sont des données comptables soumises à une
-- obligation légale de conservation de 10 ans (Code de commerce art.
-- L.123-22). Comme user_id est la PK, on ne peut pas juste la détacher
-- (contrairement aux leads) : on archive les champs comptables essentiels
-- dans une table séparée, sans FK vers auth.users, avant la suppression.
create table if not exists public.billing_retention_archive (
  id uuid primary key default gen_random_uuid(),
  original_user_id uuid,
  plan text,
  status text,
  price_cents integer,
  interval text,
  billing_interval text,
  started_at timestamptz,
  ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  archived_at timestamptz not null default now()
);

-- Pas de policy = accès refusé à anon/authenticated (comme email_logs,
-- error_logs, account_deletion_notices) ; seul le service role (supabaseAdmin,
-- utilisé uniquement côté serveur) peut lire/écrire cette table.
alter table public.billing_retention_archive enable row level security;
