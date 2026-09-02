-- Prix médian au m² par nombre de pièces (T1/T2/T3/T4+), par commune, sur la
-- dernière année disponible uniquement (pas d'historique multi-année ici :
-- le graphique d'évolution global de city_market_benchmarks_history couvre
-- déjà la tendance ; cette table sert juste à comparer les types de biens
-- au sein d'une même commune, à l'instant présent).
CREATE TABLE IF NOT EXISTS public.city_market_benchmarks_rooms (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  insee_code text NOT NULL,
  year integer NOT NULL,
  room_bracket text NOT NULL CHECK (room_bracket IN ('T1', 'T2', 'T3', 'T4+')),
  price_m2 numeric,
  n_transactions integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT city_market_benchmarks_rooms_unique UNIQUE (insee_code, year, room_bracket)
);

CREATE INDEX IF NOT EXISTS idx_city_market_benchmarks_rooms_insee
  ON public.city_market_benchmarks_rooms (insee_code);

ALTER TABLE public.city_market_benchmarks_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.city_market_benchmarks_rooms FROM anon, authenticated;
