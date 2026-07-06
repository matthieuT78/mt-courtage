-- RIB bailleur : IBAN/BIC stockés pour affichage dans l'espace locataire (virement uniquement)
-- Données personnelles financières — accès restreint au bailleur propriétaire (RLS)
ALTER TABLE public.landlords
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS bic  TEXT;
