-- Ajoute recurring_since sur property_finance.
-- Permet de savoir depuis quand les charges récurrentes (crédit, assurance,
-- copropriété, etc.) s'appliquent à ce bien. Utilisé par le graphe Finance
-- pour ne pas projeter les charges sur des mois antérieurs à cette date,
-- ce qui fausserait l'historique des bailleurs arrivant en cours de bail.
-- NULL = s'applique sur toute la période affichée (comportement actuel).

ALTER TABLE property_finance
  ADD COLUMN IF NOT EXISTS recurring_since date;
