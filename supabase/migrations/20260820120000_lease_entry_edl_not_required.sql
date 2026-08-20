-- Option pour désactiver l'alerte "État des lieux d'entrée manquant" sur un
-- bail précis (ex: bailleur qui choisit délibérément de ne pas en faire un).
-- Sur le même modèle que receipts_disabled — un flag par bail plutôt qu'un
-- interrupteur global, pour ne pas couper l'alerte sur les autres baux.
ALTER TABLE leases ADD COLUMN IF NOT EXISTS entry_edl_not_required boolean NOT NULL DEFAULT false;
