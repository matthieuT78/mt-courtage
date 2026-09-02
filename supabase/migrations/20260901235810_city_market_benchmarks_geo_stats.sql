-- Agrégats prix DVF au niveau département / région / national, calculés sur
-- les transactions individuelles (pas une moyenne des médianes communales).
-- Sert aux pages hub /prix-m2/departement/[x] et /prix-m2/region/[x], à la
-- carte choroplèthe, et à la comparaison "prix vs moyenne départementale"
-- sur les pages ville. Volume trivial (~110 zones x 5 ans x 3 types).
CREATE TABLE IF NOT EXISTS public.city_market_benchmarks_geo_stats (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  geo_type text NOT NULL CHECK (geo_type IN ('departement', 'region', 'national')),
  geo_code text NOT NULL,
  year integer NOT NULL,
  property_type text NOT NULL DEFAULT 'tous',
  price_m2 numeric,
  n_transactions integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT city_market_benchmarks_geo_stats_unique UNIQUE (geo_type, geo_code, year, property_type)
);

CREATE INDEX IF NOT EXISTS idx_city_market_benchmarks_geo_stats_lookup
  ON public.city_market_benchmarks_geo_stats (geo_type, geo_code);

ALTER TABLE public.city_market_benchmarks_geo_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.city_market_benchmarks_geo_stats FROM anon, authenticated;
