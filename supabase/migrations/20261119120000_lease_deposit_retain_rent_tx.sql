-- Suite de 20260618150000_lease_deposit_lifecycle.sql : une retenue sur caution peut couvrir
-- à la fois des loyers/charges impayés (revenu locatif) et des dommages (pas un revenu) —
-- désormais deux écritures Finance distinctes, donc deux liens de transaction à tracker.
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS deposit_retain_rent_tx_id uuid;
