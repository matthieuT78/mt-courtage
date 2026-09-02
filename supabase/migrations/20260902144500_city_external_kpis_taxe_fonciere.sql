ALTER TABLE public.city_external_kpis
  ADD COLUMN IF NOT EXISTS taxe_fonciere_tfb numeric,
  ADD COLUMN IF NOT EXISTS taxe_fonciere_teom numeric,
  ADD COLUMN IF NOT EXISTS taxe_fonciere_year integer;

COMMENT ON COLUMN public.city_external_kpis.taxe_fonciere_tfb IS
  'Taux global de taxe foncière sur les propriétés bâties (commune + intercommunalité), en % de la valeur locative cadastrale. Source : DGFiP (data.economie.gouv.fr, dataset fiscalite-locale-des-particuliers-geo).';
COMMENT ON COLUMN public.city_external_kpis.taxe_fonciere_teom IS
  'Taux plein de la taxe d''enlèvement des ordures ménagères (TEOM), en %. Même source.';
COMMENT ON COLUMN public.city_external_kpis.taxe_fonciere_year IS
  'Exercice fiscal (année) auquel se rapportent taxe_fonciere_tfb/teom.';
