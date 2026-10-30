-- Le refresh DVF bi-annuel supprime toutes les lignes d'une année avant de
-- les réinsérer (client.table(...).delete().eq("year", year)) — sans index
-- sur `year`, cette suppression doit scanner toute la table (334k lignes
-- toutes années confondues, et ça grossit à chaque refresh), ce qui a fait
-- timeout en production (postgrest.exceptions.APIError: canceling statement
-- due to statement timeout, code 57014) lors du rattrapage du 30/10/2026.
CREATE INDEX IF NOT EXISTS idx_city_market_benchmarks_history_year
  ON public.city_market_benchmarks_history (year);
