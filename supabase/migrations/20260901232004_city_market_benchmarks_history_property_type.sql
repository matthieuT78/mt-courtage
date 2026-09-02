-- Distingo maison/appartement dans l'historique des prix DVF : chaque commune
-- et année aura désormais 3 lignes ('tous', 'maison', 'appartement') au lieu
-- d'une seule, pour permettre d'afficher un prix/m² séparé par type de bien
-- sur les pages /prix-m2 (comme immolytics.be).
ALTER TABLE public.city_market_benchmarks_history
  ADD COLUMN IF NOT EXISTS property_type text NOT NULL DEFAULT 'tous';

ALTER TABLE public.city_market_benchmarks_history
  DROP CONSTRAINT IF EXISTS city_market_benchmarks_history_insee_year_unique;

ALTER TABLE public.city_market_benchmarks_history
  ADD CONSTRAINT city_market_benchmarks_history_insee_year_type_unique
  UNIQUE (insee_code, year, property_type);
