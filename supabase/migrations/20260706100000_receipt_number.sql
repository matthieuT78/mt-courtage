-- Numérotation séquentielle des quittances
-- Format : QU-YYYY-NNNN (ex: QU-2026-0001) par bailleur par année

ALTER TABLE public.rent_receipts
  ADD COLUMN IF NOT EXISTS receipt_number TEXT;

-- Fonction pour générer le prochain numéro séquentiel
CREATE OR REPLACE FUNCTION generate_receipt_number(p_user_id TEXT, p_year INT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN receipt_number ~ ('^QU-' || p_year || '-[0-9]+$')
      THEN CAST(split_part(receipt_number, '-', 3) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM public.rent_receipts
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM created_at) = p_year;

  RETURN 'QU-' || p_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;
