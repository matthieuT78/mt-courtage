-- Un seul token par agence plutôt qu'un par (agence, simulateur) : une
-- agence qui coche plusieurs simulateurs sur /widget doit recevoir tous ses
-- leads avec un seul code à copier, pas un token différent par calculette.
-- Table vide en prod à ce stade (fonctionnalité jamais encore utilisée par
-- une vraie agence) — aucune donnée à migrer, juste la contrainte à revoir.
drop index if exists public.widget_agencies_email_simulator_idx;

create unique index if not exists widget_agencies_email_idx
  on public.widget_agencies (agency_email);

comment on column public.widget_agencies.simulator is
  'Simulateur utilisé lors de la création du token (information seule — un token couvre tous les simulateurs de l''agence, cf. widget_agencies_email_idx).';
