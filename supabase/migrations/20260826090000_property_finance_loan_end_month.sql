-- Précision optionnelle du mois de fin de crédit (1-12), pour affiner le calcul du capital
-- restant dû estimé (Performance) et l'opportunité de renégociation (Dashboard), qui
-- supposaient jusqu'ici une fin en décembre (ou juin pour le Dashboard) faute de mieux.
-- Nullable : aucun changement de comportement pour les biens existants qui ne le renseignent pas.
ALTER TABLE property_finance ADD COLUMN IF NOT EXISTS loan_end_month smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_end_month_range'
  ) THEN
    ALTER TABLE property_finance
      ADD CONSTRAINT loan_end_month_range CHECK (loan_end_month IS NULL OR (loan_end_month >= 1 AND loan_end_month <= 12));
  END IF;
END $$;
