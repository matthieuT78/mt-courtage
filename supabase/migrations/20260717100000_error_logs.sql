create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'client',
  error_message text not null,
  error_stack text,
  url text,
  user_id text,
  user_agent text,
  extra jsonb
);

create index if not exists error_logs_created_at_idx on error_logs (created_at desc);

-- Purge automatique des entrées > 30 jours (optionnel, à activer via pg_cron si dispo)
-- select cron.schedule('purge-error-logs', '0 3 * * *', $$delete from error_logs where created_at < now() - interval '30 days'$$);
