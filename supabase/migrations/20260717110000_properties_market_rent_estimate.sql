-- Loyer de marché estimé par bien (comparaison au loyer réel dans la section Performance)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS market_rent_estimate numeric(12,2);
