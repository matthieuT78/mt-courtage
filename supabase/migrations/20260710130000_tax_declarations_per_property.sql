-- Ajoute property_id dans la clé unique des dossiers de déclaration
-- (chaque bien a désormais son propre dossier par année/régime)
alter table public.tax_declarations
  add column if not exists property_id text not null default 'all';

alter table public.tax_declarations
  drop constraint if exists tax_declarations_user_id_year_regime_key;

alter table public.tax_declarations
  add constraint tax_declarations_user_year_regime_property_key
  unique (user_id, year, regime, property_id);
