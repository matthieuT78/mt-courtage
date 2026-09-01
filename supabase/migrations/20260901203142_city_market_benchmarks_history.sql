-- Historique des prix DVF par commune (une ligne par commune et par année), pour
-- calculer une évolution ("+8 % sur 2 ans") plutôt que le seul instantané déjà
-- stocké dans city_market_benchmarks. Contrainte unique (insee_code, year) pour
-- permettre un upsert idempotent à chaque refresh (biannuel via GitHub Actions)
-- sans dupliquer une année déjà présente.
CREATE TABLE IF NOT EXISTS public.city_market_benchmarks_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  insee_code text NOT NULL,
  year integer NOT NULL,
  city_name text,
  postal_code text,
  reference_price_m2_sale numeric,
  reference_rent_m2 numeric,
  n_transactions integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT city_market_benchmarks_history_insee_year_unique UNIQUE (insee_code, year)
);

CREATE INDEX IF NOT EXISTS idx_city_market_benchmarks_history_insee
  ON public.city_market_benchmarks_history (insee_code);

-- Même politique d'accès que city_market_benchmarks : table de cache interne
-- lue uniquement côté serveur (service role), jamais exposée au client.
ALTER TABLE public.city_market_benchmarks_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.city_market_benchmarks_history FROM anon, authenticated;
