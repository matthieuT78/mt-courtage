ALTER TABLE public.city_external_kpis
  ADD COLUMN IF NOT EXISTS gare_nom text,
  ADD COLUMN IF NOT EXISTS gare_distance_km numeric,
  ADD COLUMN IF NOT EXISTS securite_taux_pour_mille numeric,
  ADD COLUMN IF NOT EXISTS securite_band text,
  ADD COLUMN IF NOT EXISTS securite_year integer;

COMMENT ON COLUMN public.city_external_kpis.gare_nom IS
  'Nom de la gare voyageurs SNCF la plus proche (à vol d''oiseau depuis le centre de la commune). Source : SNCF (liste des gares, data.gouv.fr).';
COMMENT ON COLUMN public.city_external_kpis.gare_distance_km IS
  'Distance à vol d''oiseau jusqu''à gare_nom, en km.';
COMMENT ON COLUMN public.city_external_kpis.securite_taux_pour_mille IS
  'Taux de délinquance composite (cambriolages logement, violences physiques hors cadre familial, vols avec armes, vols violents sans arme, violences sexuelles), pour 1000 habitants. Source : Interstats (Ministère de l''Intérieur, data.gouv.fr).';
COMMENT ON COLUMN public.city_external_kpis.securite_band IS
  'Libellé associé à securite_taux_pour_mille, par percentile national : Très sûr / Sûr / Modéré / Vigilance / Élevé.';
COMMENT ON COLUMN public.city_external_kpis.securite_year IS
  'Année des données de délinquance (securite_taux_pour_mille).';
