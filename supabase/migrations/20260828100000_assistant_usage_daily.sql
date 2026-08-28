-- Plafond quotidien de messages pour l'assistant IA du cockpit bailleur.
-- Un seul compteur par utilisateur/jour, incrémenté côté serveur (service role)
-- à chaque appel à /api/landlord/assistant/chat. Aucune écriture cliente
-- n'est nécessaire : la policy select existe pour un éventuel affichage futur
-- côté client, mais la route API lit/écrit toujours via supabaseAdmin.

create table if not exists public.assistant_usage_daily (
  user_id uuid not null,
  usage_date date not null default current_date,
  message_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.assistant_usage_daily enable row level security;

drop policy if exists assistant_usage_daily_select_own on public.assistant_usage_daily;
create policy assistant_usage_daily_select_own
  on public.assistant_usage_daily
  for select
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
