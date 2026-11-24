-- Audit du widget (2026-11-24) : 2 corrections.
--
-- 1. notify-agency n'était protégé que par un rate-limit par IP (5/min) —
--    insuffisant car agency_token est nécessairement public (visible dans le
--    code source de la page qui héberge l'iframe) : n'importe qui peut
--    l'extraire et spammer une agence précise de fausses notifications de
--    lead depuis plusieurs IP. Ajout d'un plafond par token, suivi en base
--    (persiste across invocations serverless, contrairement à un compteur
--    en mémoire).
--
-- 2. Aucune visibilité sur l'usage réel de l'iframe (seul lead_count
--    s'incrémente, uniquement si le visiteur consent à être recontacté).
--    Ajout d'un compteur de vues par agence (token présent) et d'un agrégat
--    anonyme par simulateur/jour (pas de token requis — couvre aussi les
--    blogs, qui n'activent jamais la transmission de leads).
alter table public.widget_agencies
  add column if not exists notif_window_start timestamptz,
  add column if not exists notif_window_count integer not null default 0,
  add column if not exists view_count integer not null default 0,
  add column if not exists last_viewed_at timestamptz;

create table if not exists public.widget_embed_views (
  simulator text not null,
  day date not null default current_date,
  view_count integer not null default 0,
  primary key (simulator, day)
);

alter table public.widget_embed_views enable row level security;
revoke all on table public.widget_embed_views from anon, authenticated;
