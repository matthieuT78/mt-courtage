-- Jetons d'intégration pour le widget simulateur embarqué sur le site
-- d'une agence (cf. pages/widget.tsx, pages/embed/capacite.tsx). Évite que
-- l'email de l'agence apparaisse en clair dans l'URL de l'iframe (visible
-- dans le code source de la page de l'agence) : le snippet généré ne
-- transporte qu'un token opaque, résolu côté serveur uniquement (voir
-- pages/api/tools/capacite/widget-token.ts et notify-agency.ts). Le token
-- est généré en code applicatif (crypto.randomBytes), pas en SQL, pour ne
-- pas dépendre d'une extension Postgres particulière.
--
-- lead_count donne aussi à l'agence un repère de volume (inclus dans
-- chaque email de lead : "lead n°X reçu via ce widget") sans construire de
-- compte ni de dashboard complet — cohérent avec le MVP sans configurateur
-- ni compte partenaire (cf. pages/widget.tsx).
create table if not exists public.widget_agencies (
  token text primary key,
  agency_email text not null,
  site_label text,
  simulator text not null default 'capacite',
  lead_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_lead_at timestamptz
);

create unique index if not exists widget_agencies_email_simulator_idx
  on public.widget_agencies (agency_email, simulator);

alter table public.widget_agencies enable row level security;
revoke all on table public.widget_agencies from anon, authenticated;
