-- Feedback pouce haut/bas sur les réponses de Loky. Écrit uniquement côté
-- serveur (service role) depuis /api/landlord/assistant/feedback ; la policy
-- select existe pour un éventuel affichage futur côté client.

create table if not exists public.assistant_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  rating text not null check (rating in ('up', 'down')),
  question text,
  response text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_feedback_user_id_idx on public.assistant_feedback (user_id);
create index if not exists assistant_feedback_created_at_idx on public.assistant_feedback (created_at desc);

alter table public.assistant_feedback enable row level security;

drop policy if exists assistant_feedback_select_own on public.assistant_feedback;
create policy assistant_feedback_select_own
  on public.assistant_feedback
  for select
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
