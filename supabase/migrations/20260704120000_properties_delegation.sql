-- Gestion déléguée par bien
-- delegated_services : tableau de clés parmi 'mise_en_location', 'bail_edl', 'gestion_courante', 'depot_garantie'
-- delegation_agency_name : nom libre de l'agence / gestionnaire (optionnel)

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS delegated_services text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delegation_agency_name text;
