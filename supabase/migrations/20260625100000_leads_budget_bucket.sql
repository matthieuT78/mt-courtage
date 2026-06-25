-- Ajoute la colonne budget_bucket sur la table leads.
-- Permet de conserver une tranche de budget agrégée après anonymisation RGPD,
-- sans garder le montant exact (project_budget_target) qui devient quasi-identifiant.
--
-- Tranches : <150k | 150-250k | 250-400k | 400-600k | >600k

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS budget_bucket text;
