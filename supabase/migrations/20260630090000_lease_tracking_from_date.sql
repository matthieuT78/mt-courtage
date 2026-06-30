-- Date de début du suivi des paiements dans lokt.fr
-- Permet d'importer un bail existant sans générer un backlog d'alertes rétroactives.
-- NULL = suivi depuis start_date (comportement historique)
ALTER TABLE leases ADD COLUMN IF NOT EXISTS tracking_from_date date;
