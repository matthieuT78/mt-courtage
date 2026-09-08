-- Code INSEE de la commune du bien — permet de relier un bien aux données de
-- marché DVF déjà collectées (city_market_benchmarks), pour remplacer la
-- projection générique à +2%/an de la valeur estimée (SectionPerformance)
-- par une estimation basée sur le prix réel au m² de la commune.
alter table public.properties
  add column if not exists insee_code text;

comment on column public.properties.insee_code is
  'Code INSEE de la commune (source : citycode de la Base Adresse Nationale). Utilisé pour relier le bien aux données de marché DVF (city_market_benchmarks).';
