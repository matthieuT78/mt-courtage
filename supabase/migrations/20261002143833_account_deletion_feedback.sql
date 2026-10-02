-- Jusqu'ici, la raison de suppression de compte (saisie dans la modale de
-- pages/mon-compte/securite.tsx) n'était restituée que par l'alerte
-- Telegram (pages/api/account/delete.ts) — rien n'était conservé pour des
-- statistiques ultérieures (motifs de churn les plus fréquents, etc.).
-- Table séparée sans FK vers auth.users (le compte est déjà supprimé au
-- moment de l'insertion), même principe que billing_retention_archive :
-- on ne garde que ce qui sert les stats, pas de PII.
create table if not exists public.account_deletion_feedback (
  id uuid primary key default gen_random_uuid(),
  original_user_id uuid,
  reason text,
  had_subscription boolean not null default false,
  deleted_at timestamptz not null default now()
);

-- Pas de policy = accès refusé à anon/authenticated ; seul le service role
-- (supabaseAdmin, utilisé uniquement côté serveur) peut lire/écrire.
alter table public.account_deletion_feedback enable row level security;
