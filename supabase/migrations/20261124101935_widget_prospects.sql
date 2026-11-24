-- Liste des prospects (agences immobilières, blogs immo) pour la campagne
-- d'envoi automatique du widget /widget (simulateurs gratuits intégrables,
-- avec mention "Propulsé par lokt.fr" — backlink). Stockée en base plutôt
-- que dans un CSV local car la route cron qui envoie les emails tourne sur
-- Vercel (serverless, pas de disque persistant entre exécutions).
create table if not exists widget_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  segment text not null check (segment in ('agence', 'blog')),
  city text,
  source text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'bounced', 'unsubscribed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists widget_prospects_status_idx on widget_prospects (status);

-- Accès service_role uniquement (table interne, jamais exposée côté client).
alter table widget_prospects enable row level security;
