-- KPI complémentaires par commune, issus de sources publiques externes au DVF
-- (INSEE Filosofi/recensement, ADEME DPE, "Carte des loyers" DGALN/ANIL).
-- Une seule ligne par commune (instantané courant, pas d'historique multi-
-- année comme city_market_benchmarks_history) — chaque source a son propre
-- rythme de rafraîchissement (~annuel), gérée par pipeline séparé.
CREATE TABLE IF NOT EXISTS public.city_external_kpis (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  insee_code text NOT NULL UNIQUE,

  -- INSEE Filosofi (revenus) — année de référence Filosofi (ex. 2021)
  revenu_median numeric,
  filosofi_year integer,

  -- INSEE recensement (population / logements) — année de référence (ex. 2021)
  population integer,
  logements_total integer,
  residences_principales integer,
  residences_secondaires integer,
  logements_vacants integer,
  recensement_year integer,

  -- ADEME DPE (diagnostics depuis juillet 2021, cumulatif)
  dpe_total integer,
  dpe_fg integer,
  dpe_updated_at timestamptz,

  -- Carte des loyers (DGALN/ANIL, prix d'annonce modélisé) — année de référence
  loyer_predit_appartement numeric,
  loyer_predit_maison numeric,
  loyers_year integer,

  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_city_external_kpis_insee ON public.city_external_kpis (insee_code);

ALTER TABLE public.city_external_kpis ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.city_external_kpis FROM anon, authenticated;
