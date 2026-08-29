-- Calculateur d'amortissement de crédit : montant emprunté, date de départ, durée totale
-- et différé optionnel (total ou partiel), pour calculer automatiquement la mensualité, la
-- date de fin, et surtout les intérêts déductibles réels année par année (la part d'intérêts
-- dans une mensualité diminue mécaniquement chaque mois, même à taux fixe — un chiffre
-- fixe comme loan_interest_monthly ne peut jamais être juste au-delà de la 1ère année).
-- Toutes colonnes nullables, aucun défaut : zéro changement de comportement pour les biens
-- existants qui continuent à fonctionner avec la saisie manuelle (loan_monthly, loan_end_year/
-- month, loan_interest_monthly) tant que loan_amount n'est pas renseigné.
ALTER TABLE property_finance ADD COLUMN IF NOT EXISTS loan_amount numeric(12,2);
ALTER TABLE property_finance ADD COLUMN IF NOT EXISTS loan_start_date date;
ALTER TABLE property_finance ADD COLUMN IF NOT EXISTS loan_duration_months integer;
ALTER TABLE property_finance ADD COLUMN IF NOT EXISTS loan_deferral_type text;
ALTER TABLE property_finance ADD COLUMN IF NOT EXISTS loan_deferral_months integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_deferral_type_values'
  ) THEN
    ALTER TABLE property_finance
      ADD CONSTRAINT loan_deferral_type_values CHECK (loan_deferral_type IS NULL OR loan_deferral_type IN ('partial', 'total'));
  END IF;
END $$;
