-- Option pour désactiver la gestion des quittances sur un bail
-- (ex: bail géré par une agence qui émet ses propres quittances)
ALTER TABLE leases ADD COLUMN IF NOT EXISTS receipts_disabled boolean NOT NULL DEFAULT false;
