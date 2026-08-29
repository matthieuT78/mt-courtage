-- Marquage "corrigé" d'un feedback négatif sur Loky, pour le réduire à une
-- ligne compacte côté admin et laisser la place aux retours non traités.

alter table public.assistant_feedback
  add column if not exists resolved boolean not null default false,
  add column if not exists resolved_at timestamptz;

notify pgrst, 'reload schema';
