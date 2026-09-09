-- Dédoublonnage de la veille juridique hebdo (cron legal-watch) : un texte JORF déjà
-- alerté sur Telegram ne doit pas l'être une seconde fois lors d'une exécution suivante.
create table if not exists public.legal_watch_seen_texts (
  cid text primary key,
  title text,
  jorf_ref text,
  published_at date,
  seen_at timestamptz not null default now()
);

alter table public.legal_watch_seen_texts enable row level security;
revoke all on table public.legal_watch_seen_texts from anon, authenticated;
