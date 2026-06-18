-- Suivi du cycle de vie de la caution (dépôt de garantie)
-- Encaissement, restitution, retenue + liens vers les écritures Finance
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS deposit_paid_at        date,
  ADD COLUMN IF NOT EXISTS deposit_paid_amount     numeric(12,2),
  ADD COLUMN IF NOT EXISTS deposit_returned_at     date,
  ADD COLUMN IF NOT EXISTS deposit_returned_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS deposit_retained_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS deposit_retained_reason text,
  ADD COLUMN IF NOT EXISTS deposit_collection_tx_id uuid,
  ADD COLUMN IF NOT EXISTS deposit_return_tx_id    uuid,
  ADD COLUMN IF NOT EXISTS deposit_retain_tx_id    uuid;
