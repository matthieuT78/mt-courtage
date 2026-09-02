ALTER TABLE public.city_external_kpis
  ADD COLUMN IF NOT EXISTS investment_score smallint,
  ADD COLUMN IF NOT EXISTS investment_score_band text;

COMMENT ON COLUMN public.city_external_kpis.investment_score IS
  'Score lokt.fr 0-100 : potentiel d''investissement locatif (percentile pondéré de rendement, tension locative, évolution des prix et risque DPE F/G). Null si données insuffisantes pour être fiable.';
COMMENT ON COLUMN public.city_external_kpis.investment_score_band IS
  'Libellé associé à investment_score : Excellent / Bon / Moyen / Limité / Faible potentiel.';
